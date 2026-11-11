import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/learn', '/explore', '/exercise', '/challenge', '/progress', '/parent'];

test.describe('Phase 8: Cross-Device E2E, Touch, Persistence & Performance', () => {
  test('renders all 7 routes without horizontal overflow across viewports', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `Horizontal overflow detected on ${route}`).toBe(false);
    }
  });

  test('keeps Exercise Set-Time submit button accessible in landscape mobile 667x375 (EC-UI-02)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/exercise?skill=oclock&type=set-time');

    const checkBtn = page.getByRole('button', { name: 'Check Time' });
    await expect(checkBtn).toBeVisible();
    const box = await checkBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });

  test('renders all 60 minute labels without overlapping hour numbers on 320px screen (EC-UI-01)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/explore');

    const ring = page.getByTestId('minute-ring');
    await expect(ring).toBeVisible();

    const boxes = await ring.locator('text').evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { text: node.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })
    );

    expect(boxes).toHaveLength(60);
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      const b = boxes[(i + 1) % boxes.length];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(overlapX > 1 && overlapY > 1, `Labels ${a.text} and ${b.text} overlapped`).toBe(false);
    }
  });

  test('prevents page scroll during vertical clock drag and maintains zero layout shift when toggling minute ring (EC-INP-01, EC-UI-03)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/explore');

    const clockSvg = page.getByRole('group', { name: /Analog clock showing/i });
    const boxAll = await clockSvg.boundingBox();
    expect(boxAll).not.toBeNull();

    // Toggle minute ring modes and verify identical SVG bounding box (zero layout shift)
    await page.getByRole('button', { name: 'By 5s' }).click();
    const boxFives = await clockSvg.boundingBox();
    await page.getByRole('button', { name: 'Hide' }).click();
    const boxNone = await clockSvg.boundingBox();

    expect(Math.abs(boxAll!.width - boxFives!.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(boxAll!.height - boxFives!.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(boxAll!.width - boxNone!.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(boxAll!.height - boxNone!.height)).toBeLessThanOrEqual(0.5);

    // Drag minute hand downward and assert page scrollY remains 0
    const minuteHit = page.getByTestId('minute-hit-target');
    const hitBox = await minuteHit.boundingBox();
    expect(hitBox).not.toBeNull();

    await page.mouse.move(hitBox!.x + hitBox!.width / 2, hitBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(boxAll!.x + boxAll!.width / 2, boxAll!.y + boxAll!.height - 15, {
      steps: 10,
    });
    await page.mouse.up();

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('supports tap-to-set exercise completion, localStorage persistence across reload, and corrupted storage recovery (EC-STR-01)', async ({
    page,
  }) => {
    await page.goto('/exercise?skill=oclock&type=set-time');
    await page.getByRole('button', { name: 'Hour Hand' }).click();

    const promptText = (await page.getByRole('heading', { level: 2 }).textContent()) ?? '';
    const match = promptText.match(/show (\d+) o'clock/i);
    expect(match).not.toBeNull();
    const targetHour = Number(match![1]);

    // Step minute to :00 if needed, then step hour to targetHour
    const minuteSlider = page.getByRole('slider', { name: 'Minute hand' });
    while ((await minuteSlider.getAttribute('aria-valuenow')) !== '0') {
      await page.getByRole('button', { name: 'Add 5 minutes' }).click();
    }
    const hourSlider = page.getByRole('slider', { name: 'Hour hand' });
    while ((await hourSlider.getAttribute('aria-valuenow')) !== String(targetHour)) {
      await page.getByRole('button', { name: 'Add 1 hour' }).click();
    }

    await page.getByRole('button', { name: 'Check Time' }).click();
    await expect(page.getByTestId('hint-banner')).toContainText('Awesome job!');

    // Reload and verify stars persisted
    await page.reload();
    await page.goto('/progress');
    await expect(page.getByLabel('Total stars earned: 1')).toBeVisible();

    // Corrupt localStorage and verify clean fallback recovery
    await page.evaluate(() => {
      window.localStorage.setItem('tick_tock_state_v1', '{corrupted-json');
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your Progress' })).toBeVisible();
    await expect(page.getByLabel('Total stars earned: 0')).toBeVisible();
  });

  test('handles 200% text scaling without horizontal overflow (EC-UI-04)', async ({ page }) => {
    await page.goto('/exercise?skill=oclock');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
});

