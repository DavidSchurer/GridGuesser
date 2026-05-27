/**
 * Smoke #5 — Wrong guess passes the turn.
 *
 * Proves: a wrong guess is rejected (game continues) and the turn flips
 * to the other player. If this breaks, either games end prematurely on
 * any guess, or turns never advance and the game deadlocks.
 *
 * Flow:
 *   1. Set up a started game.
 *   2. Active player submits a deliberately wrong guess.
 *   3. Game state remains `playing` on both pages.
 *   4. `data-is-my-turn` flips: the previously-inactive player now has the turn.
 */
import { test, expect, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
} from '../fixtures/game';

const NONSENSE_GUESS = 'definitely not the answer xyz123';

test.describe('Smoke #5 — Wrong guess flips the turn', () => {
  test('wrong guess: game stays playing and turn passes to opponent', async ({ browser }) => {
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

      // Confirm the banners agree on whose turn it is before we start
      await expect(actor.getByTestId('game-status-banner')).toHaveAttribute('data-is-my-turn', 'true');
      await expect(observer.getByTestId('game-status-banner')).toHaveAttribute('data-is-my-turn', 'false');

      // ── Step 3: submit a deliberately wrong guess ──
      await actor.getByTestId('guess-input').fill(NONSENSE_GUESS);
      await actor.getByTestId('guess-submit').click();

      // ── Step 4a: game state stays `playing` on BOTH pages ──
      // We give the server a moment to process the guess and re-render.
      await expect(actor.getByTestId('game-status-banner')).toHaveAttribute('data-state', 'playing', { timeout: 5_000 });
      await expect(observer.getByTestId('game-status-banner')).toHaveAttribute('data-state', 'playing', { timeout: 5_000 });

      // ── Step 4b: turn flips — observer is now the active player ──
      await expect(observer.getByTestId('game-status-banner')).toHaveAttribute('data-is-my-turn', 'true', { timeout: 5_000 });
      await expect(actor.getByTestId('game-status-banner')).toHaveAttribute('data-is-my-turn', 'false');
    } finally {
      await session.dispose();
    }
  });
});
