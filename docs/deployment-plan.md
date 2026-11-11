# Tick-Tock: Cloudflare Deployment Plan

This plan covers deploying **Tick-Tock** (`tick-tock-clock-learning`), a 100% client-side Vite + React + TypeScript Single Page Application (SPA), to Cloudflare.

---

## 1. Application Profile & Hosting Requirements

| Property | Value in Codebase | Deployment Implication |
| :--- | :--- | :--- |
| **Build Command** | `npm run build` (`tsc && vite build`) | Runs TypeScript check and bundles static assets into `dist/`. |
| **Output Directory** | `dist/` | Contains `index.html` and hashed `assets/*.js`, `assets/*.css` (~92 KB total gzipped). |
| **Routing** | `BrowserRouter` (`src/app/App.tsx`, `src/app/routes.tsx`) | Deep links (`/learn`, `/explore`, `/exercise`, `/challenge`, `/progress`, `/parent`) require SPA fallback to `/index.html`. |
| **Backend / Secrets** | None (100% client-side) | No API keys, database bindings, or runtime environment variables needed. |
| **Storage & Audio** | Browser `localStorage` (`tick_tock_state_v1`), Web Audio, Web Speech | Runs entirely in the user's browser; HTTPS ensures full Web API compatibility on mobile/desktop. |

---

## 2. Deployment Architecture Options

Cloudflare supports two clean hosting paths for static Vite SPAs:

1. **Option A — Cloudflare Workers with Static Assets (Recommended by Cloudflare for new deployments):**
   - Serves `dist/` from Cloudflare's global edge with native SPA fallback (`"not_found_handling": "single-page-application"`) and `wrangler.jsonc` versioned in Git.
2. **Option B — Cloudflare Pages (Git-connected static hosting):**
   - Zero-config dashboard Git integration with automatic PR preview URLs and build presets (`Vite`, `npm run build`, `dist`).

---

## 3. Phase 1 — Pre-Deployment Preparation

1. **Verify Node.js & Build Health:**
   - Ensure CI / Cloudflare build environment uses Node.js `18+` (Node `20 LTS` recommended).
   - Run full validation locally before deploying:
     ```bash
     npm test
     npm run build
     ```
2. **Verify Production Preview Locally:**
   ```bash
   npm run preview -- --port 4173 --strictPort
   ```
   Confirm deep links (e.g., `http://localhost:4173/exercise?skill=oclock` and `http://localhost:4173/progress`) load without console errors.

3. **Add Security & Caching Headers (`public/_headers`):**
   - Since Tick-Tock serves a child-friendly educational app with zero third-party scripts or external media, add `public/_headers` (supported by both Cloudflare Workers Static Assets and Cloudflare Pages) so Vite copies it into `dist/_headers`:
     ```text
     /*
       X-Content-Type-Options: nosniff
       X-Frame-Options: DENY
       Referrer-Policy: strict-origin-when-cross-origin
       Permissions-Policy: camera=(), microphone=(), geolocation=()

     /assets/*
       Cache-Control: public, max-age=31536000, immutable
     ```

---

## 4. Phase 2 — Deploy via Cloudflare Workers (Static Assets) [Option A]

1. **Install Wrangler CLI (devDependency or global):**
   ```bash
   npm install -D wrangler
   ```
2. **Create `wrangler.jsonc` at repository root:**
   ```jsonc
   {
     "$schema": "./node_modules/wrangler/config-schema.json",
     "name": "tick-tock-clock-learning",
     "compatibility_date": "2026-11-11",
     "assets": {
       "directory": "./dist",
       "not_found_handling": "single-page-application"
     }
   }
   ```
   - `not_found_handling: "single-page-application"` guarantees direct visits or browser refreshes on `/learn`, `/explore`, `/exercise`, `/challenge`, `/progress`, and `/parent` serve `index.html` with HTTP `200`.

3. **Authenticate & Deploy:**
   ```bash
   npx wrangler login
   npm run build
   npx wrangler deploy
   ```
4. **Optional `package.json` Convenience Script:**
   ```json
   "deploy": "npm run build && wrangler deploy"
   ```

---

## 5. Phase 2 (Alternative) — Deploy via Cloudflare Pages [Option B]

1. **Optional SPA Redirect Safety (`public/_redirects`):**
   - Cloudflare Pages serves `index.html` for unknown paths automatically when no `404.html` exists, or you can explicitly add `public/_redirects`:
     ```text
     /* /index.html 200
     ```
2. **Connect Git Repository in Cloudflare Dashboard:**
   - Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
   - Select your repository and configure:
     - **Framework preset:** `Vite`
     - **Build command:** `npm run build`
     - **Build output directory:** `dist`
     - **Environment variable (if needed):** `NODE_VERSION = 20`
3. **Click Save and Deploy.**
   - Every push to the production branch deploys to `https://<project>.pages.dev`, and pull requests receive isolated preview URLs.

---

## 6. Phase 3 — Automated CI/CD (GitHub Actions Example)

If using GitHub Actions instead of Dashboard Git builds, gate deployments on unit/component tests and production builds:

```yaml
name: Deploy Tick-Tock to Cloudflare
on:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Store `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit permission) and `CLOUDFLARE_ACCOUNT_ID` in GitHub Repository Secrets — never commit tokens to the repo.

---

## 7. Phase 4 — Custom Domain, HTTPS & Caching

1. **Custom Domain:**
   - **Workers:** Dashboard → **Workers & Pages → `tick-tock-clock-learning` → Settings → Domains & Routes → Add Custom Domain** (e.g., `clocks.example.com`).
   - **Pages:** Dashboard → **Workers & Pages → `<project>` → Custom domains → Set up a custom domain**.
2. **SSL/TLS:**
   - Ensure SSL/TLS mode is **Full (strict)** and **Always Use HTTPS** is enabled in Cloudflare zone settings.
3. **HTML Cache Policy:**
   - Keep `index.html` revalidated (`max-age=0, must-revalidate` default on Cloudflare edge) while hashed files in `/assets/*` are cached immutably for 1 year so users always receive new releases cleanly.

---

## 8. Phase 5 — Post-Deploy Smoke Test & Rollback Plan

### Post-Deploy Verification Checklist
- [ ] Visit `/` and confirm Home screen renders with zero console/network errors.
- [ ] Hard-refresh deep links (`/learn`, `/explore`, `/exercise?skill=oclock`, `/challenge`, `/progress`, `/parent`) and verify HTTP `200` (no 404).
- [ ] Verify security headers (`X-Content-Type-Options`, `X-Frame-Options`) via browser DevTools Network tab or `curl -I https://<deployed-url>/`.
- [ ] Complete one exercise question, reload the page, and confirm star progress persists in `localStorage`.
- [ ] Test mobile viewport (`360×640` portrait and `667×375` landscape) on a touchscreen device for smooth clock dragging without page scroll.
- [ ] Verify **Parent & Teacher View** gate (`Hold for 2 Seconds` / math check) and `Export JSON Summary`.

### Rollback Procedure
- **Cloudflare Workers:** Run `npx wrangler rollback` or select a previous deployment version under **Deployments** in the Cloudflare Dashboard.
- **Cloudflare Pages:** Open **Deployments** in the project dashboard and click **Rollback to this deployment** on the last known-good release.

