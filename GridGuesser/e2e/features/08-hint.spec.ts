/**
 * Feature #8 — Hint purchase reveals one letter and deducts 3 points.
 *
 * Hints are bought via the `hint-buy-btn` next to the masked image name.
 * Cost: 3 points (constant HINT_COST in server/normalModeActions.ts and
 * server/index.ts). Each purchase reveals exactly one new alpha-numeric
 * character of the opponent's image title that hasn't been revealed yet
 * to this player.
 *
 * Assertions:
 *   - `masked-image-name`'s `data-revealed-count` increases by exactly 1.
 *   - `masked-image-name`'s `data-hidden-count` decreases by exactly 1.
 *   - The actor's points drop by exactly 3.
 */
import { test, expect } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
} from '../fixtures/game';
import { getMyPoints } from '../fixtures/powerUps';

test.describe('Feature #8 — Hint purchase', () => {
  test('buying a hint reveals one letter and costs 3 points', async ({ browser }) => {
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, code, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // Identify who has the turn and use that player as the hint-buyer.
      // (Hint purchase doesn't actually require being on your turn, but
      // doing it on-turn matches typical play and avoids any client-side
      // disable that we'd hit before deciding whether the click registered.)
      const hostTurn = await isMyTurn(hostPage);
      const buyer = hostTurn ? hostPage : joinerPage;

      // Read baseline points and masked counts.
      const pointsBefore = await getMyPoints(buyer);
      expect(pointsBefore, 'test mode seeds 100 points').toBeGreaterThanOrEqual(3);

      const masked = buyer.getByTestId('masked-image-name');
      const hiddenBefore = Number(await masked.getAttribute('data-hidden-count'));
      const revealedBefore = Number(await masked.getAttribute('data-revealed-count'));
      expect(hiddenBefore, 'opponent title should start fully masked').toBeGreaterThan(0);

      // Click "Hint" (3 pts).
      const hintBtn = buyer.getByTestId('hint-buy-btn');
      await expect(hintBtn).toBeVisible();
      await expect(hintBtn).toHaveAttribute('data-affordable', 'true');
      await hintBtn.click();

      // Expect: one new letter revealed, points down by 3.
      await expect(masked).toHaveAttribute(
        'data-revealed-count',
        String(revealedBefore + 1),
        { timeout: 5_000 }
      );
      await expect(masked).toHaveAttribute(
        'data-hidden-count',
        String(hiddenBefore - 1)
      );

      await expect
        .poll(() => getMyPoints(buyer), { timeout: 5_000 })
        .toBe(pointsBefore - 3);
    } finally {
      await session.dispose();
    }
  });
});
