/**
 * Smoke #6 — Bad URLs and bad inputs don't crash the site.
 *
 * Proves three real "404-shaped" paths the app handles:
 *   1. An unknown Next.js route returns the framework's 404 page (HTTP 404).
 *   2. Trying to join a game that's already in progress shows the friendly
 *      error UI with a Back-to-Home button (not a React error overlay).
 *   3. Submitting an invalid spectator code surfaces a "no game found"
 *      message inline on the home page (not a crash).
 *
 * If any of these regress, users hit dead ends with no recovery path.
 */
import { test, expect } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  waitForGameState,
} from '../fixtures/game';

test.describe('Smoke #6 — Bad URLs don\'t crash', () => {
  test('unknown route returns Next.js 404 page', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    expect(response?.status()).toBe(404);

    // The Next.js default 404 page renders a "404" heading or text.
    // We verify the page rendered something (no React error overlay).
    const errorOverlay = page.locator('nextjs-portal');
    await expect(errorOverlay).toHaveCount(0);

    // The page body should contain the literal "404" text or a not-found marker.
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.toLowerCase()).toMatch(/404|not.?found/);
  });

  test('joining an in-progress game shows the friendly error page', async ({ browser }) => {
    // Create and fully fill a 2-player room
    const session = await openTwoPlayerSession(browser);
    let thirdCtx: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    try {
      const { hostPage, joinerPage } = session;

      const roomCode = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, roomCode, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // A third browser context tries to join the full, in-progress room
      thirdCtx = await browser.newContext();
      const thirdPage = await thirdCtx.newPage();
      await thirdPage.goto(`/game/${roomCode}?name=Charlie`);

      // The friendly error page should render — not a React error overlay
      await expect(thirdPage.getByTestId('error-page')).toBeVisible({ timeout: 15_000 });
      const message = await thirdPage.getByTestId('error-page-message').textContent();
      expect(message?.length ?? 0).toBeGreaterThan(0);

      // The Back-to-Home button works
      await thirdPage.getByTestId('error-page-back').click();
      await thirdPage.waitForURL('/', { timeout: 10_000 });
      await expect(thirdPage.getByTestId('home-create-btn')).toBeVisible();
    } finally {
      await thirdCtx?.close().catch(() => {});
      await session.dispose();
    }
  });

  test('invalid spectator code shows inline error without crashing', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('home-spectate-input').fill('ZZZZ99');
    await page.getByTestId('home-spectate-btn').click();

    // The home page surfaces an inline error and stays on '/'
    await expect(page.getByTestId('home-spectate-error')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/\/$/);

    // The rest of the home page is still interactive (no crash)
    await expect(page.getByTestId('home-create-btn')).toBeVisible();
    await expect(page.getByTestId('home-join-input')).toBeVisible();
  });
});
