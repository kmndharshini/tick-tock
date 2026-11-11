# Tick-Tock: Edge Cases & Corner Scenarios

This document catalogs critical edge cases, failure modes, and corner scenarios derived from [`architecture.md`](./architecture.md) and [`implementation-plan.md`](./implementation-plan.md), along with expected system behavior and verification strategies.

---

## 1. Clock Geometry & Hand Physics Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-GEO-01** | **Crossing 12 o'clock (`59 ↔ 00`) during drag** | User drags minute hand clockwise from `:58` past `12` to `:02`, or counter-clockwise from `:02` past `12` to `:58`. | In geared mode, detect shortest signed angular delta across the `360° / 0°` boundary: clockwise crossing increments `hours` (`11 → 12 → 1`); counter-clockwise crossing decrements `hours` (`1 → 12 → 11`). Never jump 11 hours backward. | Unit test `applyMinuteDelta` across `11:59 ↔ 12:00` and `12:59 ↔ 1:00`. |
| **EC-GEO-02** | **Center-pivot singularity (`dx = 0, dy = 0`)** | Pointer lands directly on the clock center `(200, 200)` during drag or tap-to-set. | `atan2(0, 0)` is ambiguous; ignore angle updates while pointer radius $r < 18$ SVG units from center, preserving the previous valid angle. | Unit & component test dragging directly over `(200, 200)`. |
| **EC-GEO-03** | **12-hour representation (`0` vs `12`)** | Mixing `0..11` internal modulo arithmetic with `1..12` display labels. | Normalize `hours` strictly to `1..12` in `clockModel.ts` (`((h - 1 + 12) % 12) + 1`). Never display `00:15` in 12-hour analog exercises; always format as `12:15`. | Unit tests for `normalizeHours(0) === 12`, `normalizeHours(13) === 1`. |
| **EC-GEO-04** | **Hour hand proximity near `:45`–`:59`** | At `3:55`, geared hour hand sits at `117.5°` (almost touching `4`), causing children to set or read `4:55` or `4:00`. | Geared math must place hour hand accurately at `(h % 12) * 30 + m * 0.5`; validator must detect off-by-1 hour errors on `:45`–`:59` and display the contextual "almost at the next hour" hint. | Unit test validator hint classification for target `3:45` vs input `4:45`. |
| **EC-GEO-05** | **Stacked / overlapping hands (`12:00`, `6:33`, `3:16`)** | Hour and minute hands align at nearly the same angle (e.g., both pointing at `12` for `12:00`). | Minute hand renders visually slimmer/longer on top of the thicker/shorter hour hand so both remain visible; hit-testing prioritizes the minute hand on outer radius ($r > 88$) and hour hand on inner radius ($r \le 88$), plus Tap-to-Set toggle lets users explicitly pick `Hour` or `Minute`. | Component test verifying both hands can be selected/moved starting from `12:00`. |
| **EC-GEO-06** | **Switching `gearedHands` (`false → true`) mid-state** | User disables geared hands, sets `3:45` with hour hand left on `3` (`90°`), then re-enables geared mode. | On enabling `gearedHands`, recalculate hour hand visual angle immediately to match `(hours % 12) * 30 + minutes * 0.5` without mutating stored `hours`/`minutes`. | Component test toggling `gearedHands` at `3:45`. |

---

## 2. Touch, Mouse, Pointer & Keyboard Input Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-INP-01** | **Mobile page scroll / pull-to-refresh during clock drag** | Touching and dragging downward on the analog clock on iOS Safari / Android Chrome triggers vertical scrolling or pull-to-refresh. | Apply `touch-action: none` and `overscroll-behavior: contain` on the interactive SVG clock container; call `preventDefault()` on active pointer move if needed. | E2E mobile viewport test verifying `window.scrollY === 0` after vertical hand drag. |
| **EC-INP-02** | **Pointer leaves SVG bounds or browser viewport** | Child drags finger rapidly outside the clock circle or off the edge of the screen. | Call `setPointerCapture(e.pointerId)` on `pointerdown` so angle tracking continues smoothly outside the SVG until `pointerup`; release cleanly on `pointercancel`. | Component test dispatching `pointermove` outside SVG bounding box. |
| **EC-INP-03** | **Multi-touch interference (2 fingers on screen)** | Child rests palm or second finger on tablet screen while dragging a hand. | Track only the active `activePointerId` stored on `pointerdown`; ignore secondary `pointerdown`/`pointermove` events until active pointer ends. | Component test with two concurrent `pointerId`s. |
| **EC-INP-04** | **`pointercancel` from OS gesture or notification** | Incoming call, edge swipe, or system gesture interrupts an active drag. | Handle `onPointerCancel` identically to `onPointerUp`: clear active drag state and snap hand cleanly to the nearest valid tick. | Component test firing `pointercancel` mid-drag. |
| **EC-INP-05** | **Fast radial jump across dial (`> 180°` in one frame)** | Slow device frame rate or quick flick moves pointer from `:05` (`30°`) across center to `:35` (`210°`). | Compute shortest signed angular delta `((newAngle - prevAngle + 540) % 360) - 180` to avoid false hour-wrap flips when dragging rapidly across the center. | Unit test for large single-step angle jumps. |
| **EC-INP-06** | **Tap-to-set vs. unintentional brush** | Child taps dial in Tap-to-Set mode vs. accidentally brushes empty whitespace outside the dial. | Only respond to dial taps within outer ring radius ($18 \le r \le 195$ in viewBox); ignore taps outside the clock circle. | Component test tapping corner `(5, 5)` of SVG viewBox. |
| **EC-INP-07** | **Keyboard focus lost on exercise transition** | User submits answer with `Enter` and component unmounts/remounts clock SVG. | Keep clock SVG mounted across questions (update props instead of remounting by `key`), or programmatically move focus to the next question prompt / `aria-live` heading. | Accessibility keyboard test across 3 consecutive questions. |

---

## 3. `00`–`59` Minute Ring & Responsive Layout Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-UI-01** | **Minute label collision on `320px` screens** | All 60 labels (`00`–`59`) rendered around a small phone viewport become cramped or overlap hour numbers `1`–`12`. | Place hour numbers at inner radius ($r \approx 116$), tick marks at $r = 136..148$, and minute labels at outer radius ($r \approx 180$) inside `viewBox="0 0 400 400"` with compact tabular numerals (`font-variant-numeric: tabular-nums`), rotating/orienting upright so labels never collide. | Visual inspection & Playwright bounding-box overlap check at `320×568`. |
| **EC-UI-02** | **Landscape mobile viewport (short height, e.g., `667×375`)** | Clock uses width-only sizing (`85vw`), pushing buttons and digital readout off-screen vertically. | Size clock container with `min(84vw, 56vh, 460px)` and switch Exercise/Explore layouts to side-by-side 2-column flex/grid in landscape (`@media (orientation: landscape) and (max-height: 500px)`). | E2E layout test at `667×375` asserting submit button is visible without clipping. |
| **EC-UI-03** | **Layout shift when toggling Minute Labels (`all` / `fives` / `none`)** | Showing or hiding the outer minute ring changes the SVG bounding box size. | Keep SVG `viewBox="0 0 400 400"` constant regardless of `MinuteLabelMode`; toggle only the `<MinuteRing />` group visibility so the clock never jumps or resizes. | Component test comparing `getBoundingClientRect()` across all 3 label modes. |
| **EC-UI-04** | **200% browser text zoom / OS large font** | Parent or learner enables large accessibility font scaling. | Keep SVG text inside fixed `viewBox` coordinates (does not overflow container) and allow scrolling/wrapping on surrounding UI cards without fixed `px` height truncation. | Playwright test with `200%` text zoom. |

---

## 4. Exercise Generation, Validation & Daily-Life Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-EX-01** | **Duplicate consecutive questions** | Random generator picks `3:00` twice in a row in `oclock` (only 12 total possible times). | Pass `previousTargetTime` to `exerciseGenerator.ts` and exclude it from the candidate pool (or shuffle a non-repeating deck per round). | Unit test generating 20 consecutive `oclock` questions with zero adjacent duplicates. |
| **EC-EX-02** | **Duplicate or colliding multiple-choice distractors** | Distractor generator produces two identical options (e.g., swapping hands on `6:30` or `12:00` yields the same numbers, or `1:05` swapped = `1:05`? Wait: `1:05` hour=1, min=5 -> swapping hands gives `1:05`? Actually hour hand on `1` (`05` min) and minute hand on `1` (`05` min) -> swapped = `1:05`!). | Deduplicate distractor candidates by formatted `HH:MM` key against the correct answer and existing choices; backfill from deterministic fallback pool until exact choice count (`4`) is reached. | Unit test running generator 500 times per `SkillId` asserting `uniqueChoices.size === 4`. |
| **EC-EX-03** | **Ambiguous 12-hour analog times in "Time in Daily Life"** | An analog clock looks identical for `7:00 AM` (waking up) and `7:00 PM` (dinner/bedtime), or `8:00 AM` (school) vs `8:00 PM` (bedtime). | Always pair Daily Life prompts with clear **time-of-day cues** (sun/moon icon + *"morning"*, *"afternoon"*, *"night"* text), and ensure Daily Life multiple-choice options avoid two plausible times for the same routine (e.g., use distinct times like `7:00`, `12:00`, `4:00`, `9:00`). | Unit test verifying Daily Life question pairs have unambiguous target matches. |
| **EC-EX-04** | **Double-click / rapid tap on Submit or Choice button** | Child taps "Check" or a correct answer card twice rapidly before transition finishes. | Lock submission state (`isSubmitting` / `roundResolved`) immediately on valid/processed action so stars, attempts, and `reviewQueue` updates fire **at most once** per question. | Component test double-clicking a choice card and asserting `starsEarned` increments by 1 round only. |
| **EC-EX-05** | **Swapped-hand hint false positive in Geared Mode** | In geared mode, setting `12:15` moves hour hand slightly past `12`, vs independent mode where hour hand sits squarely on `12`. | Check swapped-hand condition by comparing `userTime` against `(hourFromMinuteHand, minuteFromHourHand)` within ±2 minutes tolerance so diagnostic hint triggers reliably in both geared and independent modes. | Unit test for `diagnoseMistake` in both modes. |
| **EC-EX-06** | **Target time already matches initial clock position** | Random prompt asks *"Show 12:00"* when the clock resets to `12:00` at round start. | Initialize clock to a neutral non-matching time (e.g., `6:00` or random offset != `targetTime`) at the start of every `set-time` question so the child actively sets the hands. | Unit/component test asserting `initialClockTime !== targetTime`. |

---

## 5. Curriculum Progression, Challenge Timer & Review Queue Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-CUR-01** | **Empty `reviewQueue` when opening Review mode** | Child has made zero mistakes (or cleared all review items) and clicks "Review Practice". | Display an encouraging empty state (*"Nothing to review right now—great job! Try a Challenge or Explore mode!"*) with direct CTA buttons rather than crashing on empty array. | Component test rendering Review mode with `reviewQueue = []`. |
| **EC-CUR-02** | **Challenge timer expires while Hint or Transition is active** | Countdown reaches `00:00` while feedback animation is playing or user is mid-drag. | End the round gracefully: cancel active pointer capture, show encouraging summary (*"Time's up! Look at how many you solved!"*), award partial progress/stars earned so far, and never show a harsh failure screen. | Component test advancing fake timers to `0` mid-drag. |
| **EC-CUR-03** | **Browser tab backgrounded during Timed Challenge** | Mobile OS or browser throttles `setInterval` when user switches tabs/apps for 30 seconds. | Compute remaining time from `endTimestamp = startTimestamp + durationMs` using `Date.now()`, not tick counting, so timer stays accurate upon return (and pause timer if user opens Settings/Help modal). | Unit test mocking `Date.now()` across simulated tab sleep. |
| **EC-CUR-04** | **Navigating back mid-exercise or mid-challenge** | Child accidentally hits browser Back or Home icon during round 4 of 5. | Confirm exit lightly if progress > 0 (*"Leave this activity?"*) or safely discard incomplete round without corrupting partial `SkillProgress` counts. | Component test clicking Back mid-challenge. |
| **EC-CUR-05** | **Toggling `unlockAllSkills` from `true` back to `false`** | Parent unlocks all skills for exploration, then disables `unlockAllSkills`. | Never strip stars or progress already earned; compute effective lock state from `progress.unlocked || settings.unlockAllSkills` while keeping `clock-parts` (and any already-earned/unlocked skills) accessible. | Unit test toggling `unlockAllSkills` on and off. |

---

## 6. Audio, Web Speech & Browser Policy Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-AUD-01** | **Autoplay / AudioContext blocked before user gesture** | Browser blocks `AudioContext` or `speechSynthesis` on initial page load before first tap. | Lazily initialize/resume `AudioContext` inside the first user interaction handler (`pointerdown`/`keydown`); swallow rejected promises gracefully. | Unit test mocking suspended `AudioContext` and verifying no unhandled rejection. |
| **EC-AUD-02** | **Speech queue pile-up on rapid tapping** | Child taps the "Read Aloud" speaker button 5 times in 1 second. | Call `window.speechSynthesis.cancel()` immediately before `speak(utterance)` so queued phrases never stack and repeat for 20 seconds. | Unit test asserting `speechSynthesis.cancel()` precedes `speak()`. |
| **EC-AUD-03** | **Muting audio mid-utterance** | User toggles Mute button while TTS is reading a long hint. | Immediately call `speechSynthesis.cancel()` and suspend/mute `AudioContext` gain when `soundEnabled` or `ttsEnabled` turns `false`. | Unit test toggling mute during active speech. |
| **EC-AUD-04** | **Unsupported Web Speech API (headless / restricted WebView)** | `window.speechSynthesis` is `undefined` or `getVoices()` returns `[]`. | Feature-detect `'speechSynthesis' in window`; disable or gracefully no-op TTS without throwing errors or hiding visual text instructions. | Unit test with `window.speechSynthesis = undefined`. |
| **EC-AUD-05** | **Natural time speech phrasing** | Passing raw `"3:05"` to TTS may be read awkwardly by some engines (e.g., `"three colon zero five"`). | Format spoken strings explicitly in `audioService.ts` (e.g., `"3 o'clock"`, `"3 oh 5"`, `"quarter past 3"`, `"half past 3"`). | Unit test for `formatTimeForSpeech(hours, minutes)`. |

---

## 7. Persistence (`localStorage`) & Parent/Teacher Gate Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-STR-01** | **Corrupted or incompatible `localStorage` JSON** | User/extension edits `tick_tock_state_v1`, or schema changes in future release. | Wrap `JSON.parse` in `try/catch`, validate required fields/types, migrate older schema versions if recognized, or cleanly fall back to `DEFAULT_APP_STATE` without crashing. | Unit test loading malformed JSON and missing keys from `localStorage`. |
| **EC-STR-02** | **`localStorage` unavailable or `QuotaExceededError`** | Strict private browsing mode, sandboxed iframe, or full browser storage. | Catch `SecurityError`/`QuotaExceededError` on `getItem`/`setItem` and fall back to in-memory Zustand state for the current session without throwing UI errors. | Unit test mocking `Storage.prototype.setItem` throwing `QuotaExceededError`. |
| **EC-STR-03** | **Parent Gate accessibility & interruption** | Hold-to-unlock button fails for keyboard-only users or gets interrupted by `pointercancel`. | Reset hold progress cleanly on `pointerup`/`pointerleave`/`pointercancel`, AND provide an accessible keyboard-friendly alternative (e.g., simple math check `4 × 3 = ?` or holding `Enter`/`Space` with progress announcement). | Component test verifying both hold-pointer cancellation and math/keyboard unlock. |
| **EC-STR-04** | **Accidental Progress Reset in Parent View** | Parent taps "Reset Progress" button unintentionally. | Require a two-step confirmation dialog (*"Reset all stars and badges? This cannot be undone."*) before wiping persisted state. | Component test verifying single click does not clear `totalStars`. |

---

## 8. Accessibility & Inclusive Design Edge Cases

| ID | Scenario | Root Cause / Trigger | Expected System Behavior | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **EC-A11Y-01** | **Colorblindness / Monochrome display (`forced-colors`)** | User has deuteranopia, protanopia, or Windows High Contrast / `forced-colors: active`. | Hour and minute hands remain distinguishable by **length (`85` vs `132`), stroke width (`10` vs `6`), tip geometry, and optional `"H"`/`"M"` tags**; apply `currentColor`/system color fallbacks under `@media (forced-colors: active)`. | Visual check under grayscale & high-contrast emulation. |
| **EC-A11Y-02** | **Verbose or confusing screen-reader updates during drag** | Firing `aria-live` updates on every `1°` pointer move floods screen readers. | Throttle/defer live announcements until `pointerup` (commit) for drag, while announcing immediately on discrete keyboard `Arrow` steps or Tap-to-Set clicks. | Component test checking `aria-live` text updates on `pointerup` vs `keydown`. |
| **EC-A11Y-03** | **Motion sensitivity (`prefers-reduced-motion: reduce`)** | Animated Learn demonstrations or celebration confetti trigger vestibular discomfort. | Disable confetti/bouncing animations and replace continuous sweeping animations with instant/gentle step transitions when `prefers-reduced-motion: reduce` matches. | CSS/component check with reduced-motion media emulation. |

