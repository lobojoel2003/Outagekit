import { expect, test } from '@playwright/test';

test.describe('Outagekit', () => {
  test('shows the runtime dial and plan for the example setup', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('runtime-summary')).toContainText('Your setup runs');
    await expect(page.getByTestId('dial')).toBeVisible();
    await expect(page.getByTestId('plan')).toContainText('When to leave');
  });

  test('the dial moves at once when a device is switched off', async ({ page }) => {
    await page.goto('./');
    const summary = page.getByTestId('runtime-summary');
    const before = await summary.textContent();
    await page.getByRole('switch').first().click();
    await expect(summary).not.toHaveText(before ?? '');
  });

  test('downloads a one-page PDF card', async ({ page }) => {
    await page.goto('./#/card');
    await expect(page.getByTestId('fridge-card')).toContainText('POWER OUTAGE PLAN', {
      ignoreCase: true,
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^outage-plan.*\.pdf$/);
  });

  test('keeps working offline after the first visit', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.getByTestId('dial')).toBeVisible();
    // Wait for the service worker to take control, then cut the network.
    await page
      .waitForFunction(
        async () => {
          const registration = await navigator.serviceWorker.ready;
          return Boolean(registration.active) && Boolean(navigator.serviceWorker.controller);
        },
        undefined,
        { timeout: 20_000 },
      )
      .catch(async () => {
        await page.reload();
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
          timeout: 20_000,
        });
      });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('runtime-summary')).toContainText('Your setup runs');
    await page.goto('./#/about');
    await expect(page.getByRole('heading', { level: 1, name: 'About Outagekit' })).toBeVisible();
    await context.setOffline(false);
  });

  test('remembers changes after a reload', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Start empty' }).click();
    await expect(page.getByTestId('runtime-summary')).toContainText('Add your devices');
    await page.reload();
    await expect(page.getByTestId('runtime-summary')).toContainText('Add your devices');
  });
});
