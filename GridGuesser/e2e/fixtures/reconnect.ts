/**
 * Disconnect / reconnect helpers.
 *
 * Strategy: GridGuesser persists an `gridguesser_active_game` localStorage
 * entry while a game is in progress. The flow is:
 *   1. Capture the localStorage value from the player's page.
 *   2. Close the page (this kills its socket so the server emits
 *      `player-disconnected` to the other side).
 *   3. Open a fresh page on the SAME context, set localStorage to the
 *      captured value, then load /game/<roomId>. The page's mount effect
 *      reads the saved game and calls `rejoin-room` which re-attaches
 *      the player and triggers `player-reconnected`.
 */
import type { BrowserContext, Page } from '@playwright/test';

export const ACTIVE_GAME_KEY = 'gridguesser_active_game';

/** Read the saved active-game blob from localStorage. */
export async function captureActiveGameStorage(page: Page): Promise<string | null> {
  return await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, ACTIVE_GAME_KEY);
}

/** Capture URL + localStorage so we can re-open this game elsewhere. */
export async function captureGameContext(page: Page): Promise<{
  url: string;
  activeGame: string | null;
}> {
  const url = page.url();
  const activeGame = await captureActiveGameStorage(page);
  return { url, activeGame };
}

/** Close the page entirely (kills the websocket, triggers disconnect). */
export async function simulateDisconnectByClose(page: Page): Promise<void> {
  await page.close();
}

/**
 * Open a new page in the given context, seed localStorage with the
 * captured active-game blob, then navigate to the original game URL.
 * The page's rejoin-room flow takes over from there.
 */
export async function reopenWithStorage(
  context: BrowserContext,
  originalUrl: string,
  activeGame: string | null
): Promise<Page> {
  const fresh = await context.newPage();

  // Inject localStorage BEFORE the app code runs so the page-load effect
  // sees the saved active game on first paint.
  if (activeGame) {
    await fresh.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: ACTIVE_GAME_KEY, value: activeGame }
    );
  }

  // Append ?rejoin=1 so the page enters rejoin-mode (see game/[roomId]/page.tsx).
  const url = new URL(originalUrl);
  if (activeGame) {
    url.searchParams.set('rejoin', '1');
  }
  await fresh.goto(url.toString());
  return fresh;
}
