/**
 * Royale-mode helpers.
 *
 * Royale has phases of 20 seconds each. We never wait the full phase —
 * the server auto-advances via `checkAllPlayersActed` as soon as every
 * active player has acted. Tests should drive every active page inside
 * each phase so the suite stays fast.
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { FIXTURE_ANSWERS } from './game';

export interface RoyaleSession {
  contexts: BrowserContext[];
  pages: Page[];
  dispose: () => Promise<void>;
}

/** Open N isolated browser contexts (one per royale seat). */
export async function openRoyaleSession(browser: Browser, n: number): Promise<RoyaleSession> {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < n; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    contexts.push(ctx);
    pages.push(page);
  }
  return {
    contexts,
    pages,
    dispose: async () => {
      for (const ctx of contexts) {
        await ctx.close().catch(() => {});
      }
    },
  };
}

/** Drive the home page through the Royale create flow. Returns the 6-digit code. */
export async function createRoyaleRoom(
  page: Page,
  opts: { hostName?: string; players: 3 | 4 }
): Promise<string> {
  const hostName = opts.hostName ?? 'Hostess';
  await page.goto('/');
  await page.getByTestId('home-create-btn').click();

  // Mode selection: switch to royale, pick player count.
  await page.getByTestId('mode-option-royale').click();
  await expect(page.getByTestId('royale-player-count-picker')).toBeVisible();
  await page.getByTestId(`royale-player-count-${opts.players}`).click();
  await page.getByTestId('mode-continue-btn').click();

  // Category: default landmarks.
  await page.getByTestId('category-continue-btn').click();

  // Name input.
  await page.getByTestId('home-name-input').fill(hostName);
  await page.getByTestId('home-name-submit').click();

  await page.waitForURL(/\/game\/\d{6}/, { timeout: 15_000 });
  const match = page.url().match(/\/game\/(\d{6})/);
  if (!match) throw new Error(`Bad royale URL: ${page.url()}`);
  return match[1];
}

/** Join an existing royale room via the home-page code input. */
export async function joinRoyaleRoom(
  page: Page,
  code: string,
  name: string
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('home-join-input').fill(code);
  await page.getByTestId('home-join-btn').click();
  await page.getByTestId('home-name-input').fill(name);
  await page.getByTestId('home-name-submit').click();
  await page.waitForURL(new RegExp(`/game/${code}`), { timeout: 15_000 });
}

/** Read the current royale phase from a page. */
export async function getRoyalePhase(page: Page): Promise<string | null> {
  const ind = page.getByTestId('royale-phase-indicator');
  return await ind.getAttribute('data-phase');
}

/** Wait for the indicator to show the requested phase. */
export async function waitForRoyalePhase(
  page: Page,
  phase: 'reveal' | 'guess',
  timeout = 25_000
): Promise<void> {
  await expect(page.getByTestId('royale-phase-indicator')).toHaveAttribute(
    'data-phase',
    phase,
    { timeout }
  );
}

/**
 * Wait for the royale game to actually start. Royale has no
 * `game-status-banner` (that's normal-mode UI); instead the grids and the
 * phase indicator render once the first phase begins. We wait for the
 * royale grids to appear and the phase indicator to leave the `idle` state.
 */
export async function waitForRoyaleStarted(page: Page, timeout = 30_000): Promise<void> {
  await expect(page.getByTestId('royale-grids')).toBeVisible({ timeout });
  await expect(page.getByTestId('royale-phase-indicator')).toBeVisible({ timeout });
}

/** Read this page's own player-index from the my-points sidebar's nearest data-testid. */
export async function getMyPlayerIndexFromGrid(page: Page): Promise<number> {
  // The grid keyed `data-is-me="true"` exposes data-player-index.
  const myGrid = page.locator('[data-testid^="royale-grid-"][data-is-me="true"]').first();
  await expect(myGrid).toBeVisible({ timeout: 5_000 });
  const idx = await myGrid.getAttribute('data-player-index');
  if (idx === null) throw new Error('royale-grid for self missing data-player-index');
  return Number(idx);
}

/** Pick the lowest tile index not yet revealed in the given target's royale grid. */
export async function pickUnrevealedTile(
  page: Page,
  targetPlayerIndex: number
): Promise<number> {
  const grid = page.locator(`[data-testid="royale-grid-${targetPlayerIndex}"] [data-testid="game-grid"]`).first();
  await expect(grid).toBeVisible({ timeout: 5_000 });
  for (let i = 0; i < 100; i++) {
    const tile = grid.locator(`[data-testid="tile-${i}"]`);
    const revealed = await tile.getAttribute('data-revealed');
    if (revealed === 'false') return i;
  }
  throw new Error(`No unrevealed tiles in royale-grid-${targetPlayerIndex}`);
}

/**
 * In reveal phase, every active page picks a tile on the first opponent's
 * grid (lowest playerIndex that isn't me). Server auto-advances when all
 * have acted.
 *
 * @param pages   Active player pages still in the game.
 * @param myIndices Parallel array of each page's own playerIndex.
 */
export async function royaleRevealAllPlayers(
  pages: Page[],
  myIndices: number[]
): Promise<void> {
  // Each page: click any opponent grid card to focus, then click an
  // unrevealed tile on that grid.
  await Promise.all(
    pages.map(async (page, i) => {
      const myIdx = myIndices[i];
      // Pick the lowest other player index as target.
      const allGrids = await page.locator('[data-testid^="royale-grid-"][data-player-index]').all();
      const targets: number[] = [];
      for (const g of allGrids) {
        const ip = await g.getAttribute('data-player-index');
        if (ip !== null && Number(ip) !== myIdx) targets.push(Number(ip));
      }
      if (targets.length === 0) return;
      targets.sort((a, b) => a - b);
      const target = targets[0];
      const tile = await pickUnrevealedTile(page, target);
      const grid = page.locator(`[data-testid="royale-grid-${target}"] [data-testid="game-grid"]`).first();
      await grid.locator(`[data-testid="tile-${tile}"]`).click();
    })
  );
}

/**
 * In guess phase, every active page submits a guess. If `correctFor` is
 * supplied with a target player-index, that page submits the fixture
 * answer (taken from the target's grid hash). Other pages submit a
 * deliberate wrong guess. Returns once all pages have submitted.
 */
export async function royaleGuessAllPlayers(
  pages: Page[],
  myIndices: number[],
  opts: { correctTargetForIndex?: number; correctTarget?: number } = {}
): Promise<void> {
  await Promise.all(
    pages.map(async (page, i) => {
      const myIdx = myIndices[i];
      // Pick the first opponent grid as the target.
      const allGrids = await page.locator('[data-testid^="royale-grid-"][data-player-index]').all();
      const targets: number[] = [];
      for (const g of allGrids) {
        const ip = await g.getAttribute('data-player-index');
        if (ip !== null && Number(ip) !== myIdx) targets.push(Number(ip));
      }
      targets.sort((a, b) => a - b);
      if (targets.length === 0) return;

      let targetIdx = targets[0];
      let guessText = 'nope wrong guess';

      if (opts.correctTargetForIndex === myIdx && opts.correctTarget !== undefined) {
        targetIdx = opts.correctTarget;
        const grid = page.locator(`[data-testid="royale-grid-${targetIdx}"]`).first();
        const hash = await grid.locator('[data-testid="game-grid"]').first().getAttribute('data-image-hash');
        if (hash && FIXTURE_ANSWERS[hash]) {
          guessText = FIXTURE_ANSWERS[hash];
        }
      }

      // A correct guess can place the actor and, in turn, auto-place the last
      // remaining player — ending the game and unmounting the guess UI on
      // every page. Pages that haven't submitted yet must not block forever on
      // a `guess-input` that has been replaced by the results screen.
      const guessInput = page.getByTestId('guess-input');
      try {
        await guessInput.waitFor({ state: 'visible', timeout: 5_000 });
      } catch {
        return; // game ended (leaderboard showing) — nothing left to submit
      }

      // Select target via the GridSelector, then type the guess.
      const selectBtn = page.getByTestId(`royale-grid-select-${targetIdx}`);
      if (await selectBtn.count() > 0) {
        await selectBtn.click().catch(() => {});
      }
      try {
        await guessInput.fill(guessText, { timeout: 5_000 });
        await page.getByTestId('guess-submit').click({ timeout: 5_000 });
      } catch {
        // The game may have ended between the visibility check and submit.
      }
    })
  );
}

/** Read the placements off the royale leaderboard at game end. */
export async function readLeaderboard(page: Page): Promise<
  { place: number; playerIndex: number; playerName: string; points: number }[]
> {
  await expect(page.getByTestId('royale-leaderboard')).toBeVisible({ timeout: 15_000 });
  const rows = await page.locator('[data-testid^="royale-leaderboard-row-"]').all();
  const result: { place: number; playerIndex: number; playerName: string; points: number }[] = [];
  for (const row of rows) {
    const place = Number(await row.getAttribute('data-place'));
    const playerIndex = Number(await row.getAttribute('data-player-index'));
    const playerName = (await row.getAttribute('data-player-name')) ?? '';
    const points = Number(await row.getAttribute('data-points'));
    result.push({ place, playerIndex, playerName, points });
  }
  result.sort((a, b) => a.place - b.place);
  return result;
}

/** Return true if THIS page's player has been placed in royale. */
export async function isMyPlayerPlaced(page: Page): Promise<boolean> {
  const myGrid = page.locator('[data-testid^="royale-grid-"][data-is-me="true"]').first();
  if ((await myGrid.count()) === 0) return false;
  const place = await myGrid.getAttribute('data-place');
  return !!place && place !== '';
}

/** Wait for the royale leaderboard to render. */
export async function waitForRoyaleLeaderboard(page: Page, timeout = 30_000): Promise<void> {
  await expect(page.getByTestId('royale-leaderboard')).toBeVisible({ timeout });
}

/** Read the room's gameState off the game-room wrapper. */
export async function getGameState(page: Page): Promise<string | null> {
  return await page.getByTestId('game-status-banner').getAttribute('data-state');
}
