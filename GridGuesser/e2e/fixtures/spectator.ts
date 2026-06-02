/**
 * Spectator helpers.
 *
 * The host's game page has an "Invite Spectator" button that opens the
 * InviteToWatchModal. The modal renders the 6-char spectator code in
 * `[data-testid="invite-spectator-code"]` with `data-code="..."`.
 *
 * Spectators load `/spectate/<code>` directly. The spectator page exposes:
 *   spectate-loading           — initial joining state
 *   spectate-error             — error wrapper (with spectate-error-message)
 *   spectate-root              — main container, with data-game-state / data-game-mode
 *   spectate-code              — top-right code badge
 *   spectate-watcher-count     — top-right watcher count
 *   spectate-feed              — live event feed (data-event-count)
 *   spectate-feed-event        — per-event row (data-event-type, data-player-index)
 *   spectate-grid-{idx}        — per-player section (data-player-name,
 *                                data-masked-name, data-revealed-count,
 *                                data-image-hash, data-player-index)
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Open the invite modal on the host's game page and read the code. */
export async function getSpectatorCodeFromHost(hostPage: Page): Promise<string> {
  await hostPage.getByTestId('invite-spectator-btn').click();
  const modal = hostPage.getByTestId('invite-modal');
  await expect(modal).toBeVisible({ timeout: 5_000 });
  const code = await hostPage
    .getByTestId('invite-spectator-code')
    .getAttribute('data-code');
  if (!code) throw new Error('invite-spectator-code missing data-code');

  // Close the modal: its full-screen overlay otherwise intercepts pointer
  // events on the game grid behind it.
  await hostPage.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toBeHidden({ timeout: 5_000 });
  return code;
}

/**
 * Open a fresh isolated browser context and navigate to the spectator URL.
 * Returns the page and a dispose() function to clean up.
 */
export async function openSpectatorContext(
  browser: Browser,
  code: string
): Promise<{ page: Page; context: BrowserContext; dispose: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/spectate/${code}`);
  return {
    page,
    context,
    dispose: async () => {
      await context.close().catch(() => {});
    },
  };
}

/** Wait for the spectator page to finish joining (root visible). */
export async function waitForSpectatorReady(page: Page): Promise<void> {
  await expect(page.getByTestId('spectate-root')).toBeVisible({ timeout: 15_000 });
}

/** Wait for at least one feed event of the given type. */
export async function waitForSpectatorEvent(
  page: Page,
  eventType: 'tile' | 'guessCorrect' | 'guessWrong' | 'hint' | 'powerup' | 'info',
  timeout = 5_000
): Promise<void> {
  await expect(
    page.locator(`[data-testid="spectate-feed-event"][data-event-type="${eventType}"]`).first()
  ).toBeVisible({ timeout });
}

/** Count revealed tiles inside a spectator grid section. */
export async function countSpectateRevealed(
  page: Page,
  playerIndex: number
): Promise<number> {
  const section = page.getByTestId(`spectate-grid-${playerIndex}`);
  const raw = await section.getAttribute('data-revealed-count');
  return Number(raw ?? 0);
}
