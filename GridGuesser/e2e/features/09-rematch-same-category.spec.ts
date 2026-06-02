/**
 * Feature #9 — Rematch flow (same category).
 *
 * Both players agree to a rematch without changing the category. The
 * server resets the room state and fetches new images, then emits
 * `rematch-start` + `game-start`. Both clients return to `playing`.
 *
 * Assertions after rematch:
 *   - game-status-banner returns to `data-state="playing"` on both pages.
 *   - data-winner is cleared.
 *   - No previously revealed tiles persist (sample of tiles is hidden).
 *   - Points are back to 100 (test-mode seed).
 *   - The opponent grid's image hash may or may not differ — the fixture
 *     pool has only 4 SVGs, so we don't assert it's different. We DO
 *     assert that the answer (looked up via fixture map) is still in the
 *     pool, which proves the room is in test mode and the new game's
 *     images were re-fetched.
 */
import { test, expect, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
  getOpponentAnswer,
  FIXTURE_ANSWERS,
} from '../fixtures/game';
import { getMyPoints } from '../fixtures/powerUps';
import {
  requestRematch,
  acceptOpponentRematch,
  waitForRematchStart,
} from '../fixtures/rematch';

test.describe('Feature #9 — Rematch with same category', () => {
  test('both players agree → new game starts with reset state', async ({ browser }) => {
    test.setTimeout(90_000); // rematch fetches images, can take time
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      // ── Set up a started game and end it via a correct guess ──
      const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, code, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      const hostTurn = await isMyTurn(hostPage);
      const winner: Page = hostTurn ? hostPage : joinerPage;
      const loser: Page = hostTurn ? joinerPage : hostPage;

      const answer = await getOpponentAnswer(winner);
      await winner.getByTestId('guess-input').fill(answer);
      await winner.getByTestId('guess-submit').click();

      await waitForGameState(winner, 'finished');
      await waitForGameState(loser, 'finished');

      // ── Rematch — winner requests, loser accepts ──
      await requestRematch(winner);
      await acceptOpponentRematch(loser);

      // ── Both pages return to `playing` with cleared state ──
      await waitForRematchStart(winner);
      await waitForRematchStart(loser);

      // Winner field should be cleared.
      const winnerBanner = winner.getByTestId('game-status-banner');
      const loserBanner = loser.getByTestId('game-status-banner');
      await expect(winnerBanner).not.toHaveAttribute('data-winner', /[01]/);
      await expect(loserBanner).not.toHaveAttribute('data-winner', /[01]/);

      // Points back to 100 (test mode seed) for both players.
      await expect.poll(() => getMyPoints(winner), { timeout: 5_000 }).toBe(100);
      await expect.poll(() => getMyPoints(loser), { timeout: 5_000 }).toBe(100);

      // Sample tiles should be hidden on the new game.
      const sample = [0, 25, 50, 75, 99];
      for (const idx of sample) {
        const tiles = winner.locator(`[data-testid="tile-${idx}"]`);
        await expect(tiles).toHaveCount(2);
        // At least one of the two tiles (the opponent grid we'll be guessing)
        // should be hidden — game just started, only fully revealed at
        // game-end. We assert BOTH are hidden because the test-mode rematch
        // starts clean.
        await expect(tiles.first()).toHaveAttribute('data-revealed', 'false');
        await expect(tiles.nth(1)).toHaveAttribute('data-revealed', 'false');
      }

      // Verify the new opponent answer is still a known fixture (proves
      // the server is still serving test-mode images).
      const newAnswer = await getOpponentAnswer(winner);
      const knownAnswers = Object.values(FIXTURE_ANSWERS);
      expect(knownAnswers).toContain(newAnswer);
    } finally {
      await session.dispose();
    }
  });
});
