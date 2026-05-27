/**
 * Game-flow helpers: create a room as host, join as guest, wait for game start.
 *
 * These helpers drive the actual UI rather than calling sockets directly,
 * so the tests verify what users would experience.
 */
import { expect, type Page } from '@playwright/test';

/** MD5 hashes of the local SVG fixtures, mapped to their answer titles.
 *  Hashes are computed by lib/tileGenerator.ts `generateImageHash` (MD5 of
 *  the URL string). If these file paths in TEST_MODE_FIXTURE_POOL change in
 *  server/startGame.ts, this map must be updated in lockstep. */
import { createHash } from 'crypto';

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export const FIXTURE_ANSWERS: Record<string, string> = {
  [md5('images/eiffel-tower.svg')]: 'Eiffel Tower',
  [md5('images/big-ben.svg')]: 'Big Ben',
  [md5('images/colosseum.svg')]: 'Colosseum',
  [md5('images/taj-mahal.svg')]: 'Taj Mahal',
};

export interface CreateRoomOptions {
  /** Display name for the host. Defaults to "Alice". */
  hostName?: string;
  /** Pre-selected category. Defaults to "landmarks". */
  category?: string;
}

/**
 * Walks the home-page "Create New Game" flow as a guest player.
 * Returns the 6-digit room code parsed from the resulting /game/<code> URL.
 */
export async function createRoomAsHost(
  page: Page,
  opts: CreateRoomOptions = {}
): Promise<string> {
  const hostName = opts.hostName ?? 'Alice';

  await page.goto('/');
  await page.getByTestId('home-create-btn').click();

  // Mode selection: stays on normal (default)
  await page.getByTestId('mode-continue-btn').click();

  // Category selection: stays on default (landmarks)
  await page.getByTestId('category-continue-btn').click();

  // Name input
  await page.getByTestId('home-name-input').fill(hostName);
  await page.getByTestId('home-name-submit').click();

  // Wait for navigation to /game/<code>?...
  await page.waitForURL(/\/game\/\d{6}/, { timeout: 15_000 });

  const url = new URL(page.url());
  const match = url.pathname.match(/\/game\/(\d{6})/);
  if (!match) {
    throw new Error(`Expected /game/<6-digit code> URL, got: ${page.url()}`);
  }
  return match[1];
}

/** Joins an existing room via the 6-digit code input on the home page. */
export async function joinRoomAsGuest(
  page: Page,
  roomCode: string,
  guestName: string = 'Bob'
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('home-join-input').fill(roomCode);
  await page.getByTestId('home-join-btn').click();

  // Name prompt screen
  await page.getByTestId('home-name-input').fill(guestName);
  await page.getByTestId('home-name-submit').click();

  await page.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 15_000 });
}

/** Wait until the game-status-banner reports a specific state. */
export async function waitForGameState(
  page: Page,
  state: 'waiting' | 'playing' | 'finished',
  timeout: number = 20_000
): Promise<void> {
  await expect(page.getByTestId('game-status-banner')).toHaveAttribute(
    'data-state',
    state,
    { timeout }
  );
}

/**
 * For a started game, find the opponent's grid (i.e. the one this player is
 * trying to guess) and read its image hash. Returns the known answer for
 * that hash from the fixture map.
 *
 * Throws if not in test-mode (hash not in the fixture map).
 */
export async function getOpponentAnswer(page: Page): Promise<string> {
  const opponentGrid = page.locator('[data-testid="game-grid"][data-is-opponent-grid="true"]').first();
  await expect(opponentGrid).toBeVisible({ timeout: 10_000 });
  const hash = await opponentGrid.getAttribute('data-image-hash');
  if (!hash) {
    throw new Error('Opponent grid is missing data-image-hash attribute');
  }
  const answer = FIXTURE_ANSWERS[hash];
  if (!answer) {
    throw new Error(
      `Image hash ${hash} not in fixture map. Is GRIDGUESSER_TEST_MODE=1 set on the server?`
    );
  }
  return answer;
}

/** Returns true if `data-is-my-turn` on the banner is "true". */
export async function isMyTurn(page: Page): Promise<boolean> {
  const banner = page.getByTestId('game-status-banner');
  const val = await banner.getAttribute('data-is-my-turn');
  return val === 'true';
}
