/**
 * Smoke #4 — Win condition fires correctly.
 *
 * Proves: a correct guess from one player ends the game, sets the winner,
 * and propagates the finished state to both clients. If this breaks, no
 * one can ever win — guesses just silently fail.
 *
 * Requires GRIDGUESSER_TEST_MODE=1 on the server so the answers are
 * deterministic ("Eiffel Tower" / "Big Ben") and the test can submit the
 * exact correct answer without scraping it from a non-deterministic source.
 *
 * Flow:
 *   1. Set up a started game (two players, fixture mode).
 *   2. Identify the active player.
 *   3. Read the active player's opponent's hash → look up the known answer.
 *   4. Submit that answer.
 *   5. On both pages: status banner reads `finished`, winner = active player's index.
 *   6. All 100 tiles on both grids become revealed.
 */
import { test, expect, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
  getOpponentAnswer,
} from '../fixtures/game';

test.describe('Smoke #4 — Correct guess wins the game', () => {
  test('submitting the right answer ends the game for both players', async ({ browser }) => {
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      // ── Step 1: start a game ──
      const roomCode = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, roomCode, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // ── Step 2: identify active player ──
      const hostTurn = await isMyTurn(hostPage);
      const actor: Page = hostTurn ? hostPage : joinerPage;
      const observer: Page = hostTurn ? joinerPage : hostPage;
      const expectedWinnerIdx = hostTurn ? 0 : 1;

      // ── Step 3: derive the correct answer from the fixture map ──
      const answer = await getOpponentAnswer(actor);
      console.log(`[smoke4] Active player (idx ${expectedWinnerIdx}) will guess: "${answer}"`);

      // ── Step 4: submit the guess ──
      const input = actor.getByTestId('guess-input');
      await expect(input).toBeVisible();
      await input.fill(answer);
      await actor.getByTestId('guess-submit').click();

      // ── Step 5: both pages see `finished` with the correct winner ──
      await waitForGameState(actor, 'finished', 15_000);
      await waitForGameState(observer, 'finished', 15_000);

      const actorBanner = actor.getByTestId('game-status-banner');
      const observerBanner = observer.getByTestId('game-status-banner');
      await expect(actorBanner).toHaveAttribute('data-winner', String(expectedWinnerIdx));
      await expect(observerBanner).toHaveAttribute('data-winner', String(expectedWinnerIdx));

      // ── Step 6: every tile on both grids is revealed (game-end reveals all) ──
      // Each page renders 2 grids × 100 tiles = 200 tile elements.
      // We sample a representative subset rather than asserting all 200 to
      // keep the test fast and resilient to React re-renders.
      const sampleIndices = [0, 25, 50, 75, 99];
      for (const idx of sampleIndices) {
        const actorTiles = actor.locator(`[data-testid="tile-${idx}"]`);
        await expect(actorTiles).toHaveCount(2);
        await expect(actorTiles.first()).toHaveAttribute('data-revealed', 'true');
        await expect(actorTiles.nth(1)).toHaveAttribute('data-revealed', 'true');

        const observerTiles = observer.locator(`[data-testid="tile-${idx}"]`);
        await expect(observerTiles.first()).toHaveAttribute('data-revealed', 'true');
        await expect(observerTiles.nth(1)).toHaveAttribute('data-revealed', 'true');
      }
    } finally {
      await session.dispose();
    }
  });
});
