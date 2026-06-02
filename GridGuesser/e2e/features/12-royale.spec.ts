/**
 * Feature #12 — Grid Royale full-game flow.
 *
 * Two tests: 3-player and 4-player rooms. Each round, every still-active
 * page picks an unrevealed tile during the reveal phase, then submits a
 * guess during the guess phase. The lowest-indexed active page submits a
 * deterministic CORRECT guess (looked up from the fixture map), so it
 * places first that round. Others submit wrong text and stay in. After
 * N-1 rounds, the last active player is auto-placed and the leaderboard
 * appears.
 *
 * Because every active page acts inside each phase, the server's
 * `checkAllPlayersActed` (server/index.ts:193) auto-advances phases
 * without waiting for the 20-second timer — keeping tests fast.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  openRoyaleSession,
  createRoyaleRoom,
  joinRoyaleRoom,
  waitForRoyalePhase,
  waitForRoyaleStarted,
  royaleRevealAllPlayers,
  royaleGuessAllPlayers,
  isMyPlayerPlaced,
  waitForRoyaleLeaderboard,
  readLeaderboard,
  getMyPlayerIndexFromGrid,
} from '../fixtures/royale';

/**
 * Play the royale game to completion. Returns the leaderboard rows.
 *
 * @param pages   All player pages (host + joiners), in seat order.
 */
async function playRoyaleToCompletion(pages: Page[]): Promise<void> {
  // Wait for everyone's royale game to start (no game-status-banner in royale).
  for (const p of pages) {
    await waitForRoyaleStarted(p, 30_000);
  }

  // Loop rounds. After N-1 placements, the leaderboard appears.
  // Safety cap: 6 rounds.
  for (let round = 0; round < 6; round++) {
    // Build the list of still-active pages.
    const activePages: Page[] = [];
    const activeIndices: number[] = [];
    for (const p of pages) {
      if (await isMyPlayerPlaced(p)) continue;
      const idx = await getMyPlayerIndexFromGrid(p).catch(() => -1);
      if (idx < 0) continue;
      activePages.push(p);
      activeIndices.push(idx);
    }
    if (activePages.length <= 1) break;

    // Reveal phase — every active page reveals one tile.
    await waitForRoyalePhase(activePages[0], 'reveal', 30_000);
    await royaleRevealAllPlayers(activePages, activeIndices);

    // Guess phase — lowest active index guesses correctly on the
    // next lowest active index's grid. Others guess wrong.
    await waitForRoyalePhase(activePages[0], 'guess', 30_000);
    const correctIdx = activeIndices[0];
    const targetIdx = activeIndices[1];
    await royaleGuessAllPlayers(activePages, activeIndices, {
      correctTargetForIndex: correctIdx,
      correctTarget: targetIdx,
    });

    // Give the server time to process placements + advance phase before
    // the next iteration's active-page sweep reads `data-place`.
    await activePages[0].waitForTimeout(500);
  }

  // Leaderboard should render on every page.
  for (const p of pages) {
    await waitForRoyaleLeaderboard(p, 30_000);
  }
}

test.describe('Feature #12 — Grid Royale', () => {
  test('3-player royale runs through placement order', async ({ browser }) => {
    test.setTimeout(180_000);
    const session = await openRoyaleSession(browser, 3);
    try {
      const [p1, p2, p3] = session.pages;
      const code = await createRoyaleRoom(p1, { hostName: 'P1', players: 3 });
      await Promise.all([
        joinRoyaleRoom(p2, code, 'P2'),
        joinRoyaleRoom(p3, code, 'P3'),
      ]);

      await playRoyaleToCompletion([p1, p2, p3]);

      const board = await readLeaderboard(p1);
      expect(board.length).toBe(3);
      const places = board.map((r) => r.place).sort();
      expect(places).toEqual([1, 2, 3]);
      // Every playerIndex is unique.
      const indices = new Set(board.map((r) => r.playerIndex));
      expect(indices.size).toBe(3);
    } finally {
      await session.dispose();
    }
  });

  test('4-player royale runs through placement order', async ({ browser }) => {
    test.setTimeout(240_000);
    const session = await openRoyaleSession(browser, 4);
    try {
      const [p1, p2, p3, p4] = session.pages;
      const code = await createRoyaleRoom(p1, { hostName: 'P1', players: 4 });
      await Promise.all([
        joinRoyaleRoom(p2, code, 'P2'),
        joinRoyaleRoom(p3, code, 'P3'),
        joinRoyaleRoom(p4, code, 'P4'),
      ]);

      await playRoyaleToCompletion([p1, p2, p3, p4]);

      const board = await readLeaderboard(p1);
      expect(board.length).toBe(4);
      const places = board.map((r) => r.place).sort();
      expect(places).toEqual([1, 2, 3, 4]);
    } finally {
      await session.dispose();
    }
  });
});
