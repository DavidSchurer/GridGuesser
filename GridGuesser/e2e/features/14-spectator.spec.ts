/**
 * Feature #14 — Spectator flow.
 *
 * Verifies the end-to-end spectate experience:
 *   1. Host + joiner start a game.
 *   2. Host opens the Invite Spectator modal and the test reads the
 *      6-char spectator code.
 *   3. A third browser context opens `/spectate/<code>`.
 *   4. The spectator page reaches `data-game-state="playing"`.
 *   5. Both player grids on the spectator page start with
 *      `data-revealed-count="0"` and a fully-masked `data-masked-name`.
 *   6. Host reveals a tile on the joiner's image.
 *   7. The spectator sees a `tile`-type feed event within 1.5s, and the
 *      matching `spectate-grid-{idx}` data-revealed-count updates.
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
  getSpectatorCodeFromHost,
  openSpectatorContext,
  waitForSpectatorReady,
  waitForSpectatorEvent,
  countSpectateRevealed,
} from '../fixtures/spectator';

test.describe('Feature #14 — Spectator', () => {
  test('spectator joins, sees masked names, and tile updates live', async ({ browser }) => {
    test.setTimeout(90_000);
    const session = await openTwoPlayerSession(browser);

    try {
      const { hostPage, joinerPage } = session;
      const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, code, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // Step 2: read the spectator code from the host's invite modal.
      const spectatorCode = await getSpectatorCodeFromHost(hostPage);
      expect(spectatorCode).toMatch(/^[A-Z0-9]{4,8}$/);

      // Step 3: open a third browser context on /spectate/<code>.
      const spec = await openSpectatorContext(browser, spectatorCode);
      try {
        await waitForSpectatorReady(spec.page);

        const root = spec.page.getByTestId('spectate-root');
        await expect(root).toHaveAttribute('data-game-state', 'playing', {
          timeout: 15_000,
        });
        await expect(spec.page.getByTestId('spectate-code')).toHaveAttribute(
          'data-code',
          spectatorCode
        );

        // Step 5: both grids start masked.
        const grid0 = spec.page.getByTestId('spectate-grid-0');
        const grid1 = spec.page.getByTestId('spectate-grid-1');
        await expect(grid0).toBeVisible();
        await expect(grid1).toBeVisible();
        for (const g of [grid0, grid1]) {
          const masked = await g.getAttribute('data-masked-name');
          expect(masked, 'masked name should not be empty').toBeTruthy();
          expect(masked!.includes('_'), `expected underscores in masked name "${masked}"`).toBe(
            true
          );
          expect(await g.getAttribute('data-revealed-count')).toBe('0');
        }

        // Step 6: active player reveals a tile.
        const hostTurn = await isMyTurn(hostPage);
        const actor: Page = hostTurn ? hostPage : joinerPage;
        const actorOpponentGrid = actor
          .locator('[data-testid="game-grid"][data-is-opponent-grid="true"]')
          .first();
        const revealedHash = await actorOpponentGrid.getAttribute('data-image-hash');
        expect(revealedHash).toBeTruthy();
        const targetTile = 17;
        await clickActorOpponentTile(actor, targetTile);

        // Step 7: spectator sees the event + grid update.
        await waitForSpectatorEvent(spec.page, 'tile', 5_000);

        // Find which spectator grid matches the revealed hash and confirm
        // its data-revealed-count incremented.
        const matchingSpectateGrid = spec.page.locator(
          `[data-testid^="spectate-grid-"][data-image-hash="${revealedHash}"]`
        );
        await expect(matchingSpectateGrid).toBeVisible({ timeout: 5_000 });
        await expect(matchingSpectateGrid).toHaveAttribute('data-revealed-count', '1', {
          timeout: 5_000,
        });

        const targetIdx = Number(await matchingSpectateGrid.getAttribute('data-player-index'));
        await expect.poll(() => countSpectateRevealed(spec.page, targetIdx)).toBe(1);
      } finally {
        await spec.dispose();
      }
    } finally {
      await session.dispose();
    }
  });
});
