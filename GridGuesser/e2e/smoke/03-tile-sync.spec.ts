/**
 * Smoke #3 — Real-time tile sync.
 *
 * Proves: when one player reveals a tile, the other player's screen
 * reflects it via Socket.IO within 1 second. If this breaks, the game
 * looks broken to whichever player isn't the one clicking.
 *
 * Strategy:
 *   - Determine who has the current turn from `data-is-my-turn` on
 *     game-status-banner. The server assigns currentTurn randomly so
 *     either player may have it.
 *   - The active player clicks tile #42 within their opponent grid.
 *   - On the OTHER player's page, the SAME image hash is rendered as
 *     "Your Grid" (not opponent). We use the hash to disambiguate
 *     because data-testid="tile-42" appears 4 times across both pages
 *     (2 grids × 2 viewers).
 *   - Measure wall-clock latency end-to-end and assert < 1000 ms.
 */
import { test, expect, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
} from '../fixtures/game';

const TARGET_TILE = 42;

test.describe('Smoke #3 — Real-time tile reveal sync', () => {
  test('opponent sees revealed tile within 1 second', async ({ browser }) => {
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      // ── Set up a started game ──
      const roomCode = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, roomCode, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // ── Identify the active player and the observer ──
      const hostTurn = await isMyTurn(hostPage);
      const joinerTurn = await isMyTurn(joinerPage);
      expect(hostTurn !== joinerTurn, 'exactly one player should have the turn').toBe(true);

      const actor: Page = hostTurn ? hostPage : joinerPage;
      const observer: Page = hostTurn ? joinerPage : hostPage;

      // The actor's opponent grid = the grid whose tile we'll click.
      // Its image hash uniquely identifies that grid across both pages.
      const actorOpponentGrid = actor.locator(
        '[data-testid="game-grid"][data-is-opponent-grid="true"]'
      ).first();
      await expect(actorOpponentGrid).toBeVisible();
      const targetHash = await actorOpponentGrid.getAttribute('data-image-hash');
      expect(targetHash, 'opponent grid must expose data-image-hash').toBeTruthy();

      // Locate the specific tile inside the actor's opponent grid.
      const actorTile = actorOpponentGrid.locator(`[data-testid="tile-${TARGET_TILE}"]`);
      await expect(actorTile).toBeVisible();
      await expect(actorTile).toHaveAttribute('data-revealed', 'false');

      // On the observer's page, the same image hash is rendered as their
      // OWN grid. Same hash, different `data-is-opponent-grid` value.
      const observerGrid = observer.locator(
        `[data-testid="game-grid"][data-image-hash="${targetHash}"]`
      );
      await expect(observerGrid).toBeVisible();
      const observerTile = observerGrid.locator(`[data-testid="tile-${TARGET_TILE}"]`);
      await expect(observerTile).toHaveAttribute('data-revealed', 'false');

      // ── Measure sync latency ──
      const t0 = Date.now();
      await actorTile.click();

      await expect(observerTile).toHaveAttribute('data-revealed', 'true', { timeout: 1500 });
      const elapsed = Date.now() - t0;

      console.log(`[smoke3] Tile sync latency: ${elapsed} ms`);
      expect(elapsed, `tile sync took ${elapsed} ms, expected < 1000 ms`).toBeLessThan(1000);

      // Sanity check: the actor's own view also flipped to revealed.
      await expect(actorTile).toHaveAttribute('data-revealed', 'true');
    } finally {
      await session.dispose();
    }
  });
});
