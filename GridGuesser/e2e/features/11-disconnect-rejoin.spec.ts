/**
 * Feature #11 — Disconnect / rejoin flow.
 *
 * Sequence:
 *   1. Host + joiner start a game.
 *   2. The active player reveals a tile (so we have observable state).
 *   3. Capture the host's `gridguesser_active_game` localStorage entry.
 *   4. Close the host's page — server emits `player-disconnected` and
 *      joiner sees `opponent-disconnected-banner` within ~2 seconds.
 *   5. Open a fresh page in the host's original context with the saved
 *      localStorage; load `/game/<roomId>?rejoin=1`.
 *   6. The rejoined page reaches `gameState=playing` again with the same
 *      revealed tile present.
 *   7. Joiner sees `opponent-reconnected-banner`.
 */
import { test, expect, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
} from '../fixtures/game';
import { clickActorOpponentTile } from '../fixtures/powerUps';
import {
  captureGameContext,
  reopenWithStorage,
  simulateDisconnectByClose,
} from '../fixtures/reconnect';

test.describe('Feature #11 — Disconnect & rejoin', () => {
  test('host closes page mid-game, reopens with storage, state restored', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage, hostCtx } = session;

      const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, code, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // Reveal one tile on whichever side has the turn so we can verify
      // the rejoined client still sees it.
      const hostTurn = await isMyTurn(hostPage);
      const actor: Page = hostTurn ? hostPage : joinerPage;
      const TARGET_TILE = 23;
      const grid = actor.locator(
        '[data-testid="game-grid"][data-is-opponent-grid="true"]'
      ).first();
      const revealedHash = await grid.getAttribute('data-image-hash');
      expect(revealedHash, 'opponent grid must expose data-image-hash').toBeTruthy();
      await clickActorOpponentTile(actor, TARGET_TILE);

      // Confirm the tile reveal landed on both pages.
      const expectRevealed = async (page: Page) => {
        const g = page.locator(`[data-testid="game-grid"][data-image-hash="${revealedHash}"]`);
        await expect(g.locator(`[data-testid="tile-${TARGET_TILE}"]`)).toHaveAttribute(
          'data-revealed',
          'true',
          { timeout: 5_000 }
        );
      };
      await expectRevealed(hostPage);
      await expectRevealed(joinerPage);

      // ── Capture host's saved state, then close the host page. ──
      const ctx = await captureGameContext(hostPage);
      expect(ctx.activeGame, 'host should have a saved active game').not.toBeNull();
      await simulateDisconnectByClose(hostPage);

      // ── Joiner sees the disconnect banner. ──
      await expect(joinerPage.getByTestId('opponent-disconnected-banner')).toBeVisible({
        timeout: 10_000,
      });

      // ── Reopen the host in the same context with the saved storage. ──
      const rejoined = await reopenWithStorage(hostCtx, ctx.url, ctx.activeGame);
      await waitForGameState(rejoined, 'playing', 20_000);

      // The previously revealed tile is still revealed on the rejoined page.
      const rejoinedGrid = rejoined.locator(
        `[data-testid="game-grid"][data-image-hash="${revealedHash}"]`
      );
      await expect(rejoinedGrid).toBeVisible();
      await expect(
        rejoinedGrid.locator(`[data-testid="tile-${TARGET_TILE}"]`)
      ).toHaveAttribute('data-revealed', 'true', { timeout: 10_000 });

      // ── Joiner sees the reconnect banner. ──
      await expect(joinerPage.getByTestId('opponent-reconnected-banner')).toBeVisible({
        timeout: 10_000,
      });
      // And the disconnect banner has cleared.
      await expect(joinerPage.getByTestId('opponent-disconnected-banner')).toBeHidden({
        timeout: 10_000,
      });
    } finally {
      await session.dispose();
    }
  });
});
