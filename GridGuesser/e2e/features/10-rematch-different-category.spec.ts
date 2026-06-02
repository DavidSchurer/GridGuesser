/**
 * Feature #10 — Rematch with a category change.
 *
 * The loser requests rematch and changes the category from the default
 * (landmarks) to `animals`. The host's modal then shows
 * `rematch-opponent-banner` with `data-opponent-category="animals"`.
 *
 * After both accept, the new `game-room` element exposes
 * `data-category="animals"`. Test mode still serves landmark fixtures
 * (the fixture pool is fixed), but `room.category` is what we assert
 * because that's the actual config the server stored.
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
import {
  requestRematch,
  waitForOpponentRematchBanner,
  waitForRematchStart,
  waitForRematchModal,
} from '../fixtures/rematch';

test.describe('Feature #10 — Rematch with different category', () => {
  test('joiner changes category, host sees update, new game uses it', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      await joinRoomAsGuest(joinerPage, code, 'Bob');
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // Confirm starting category is landmarks on both pages.
      await expect(hostPage.getByTestId('game-room')).toHaveAttribute(
        'data-category',
        'landmarks'
      );

      // End the game so the rematch modal can open.
      const hostTurn = await isMyTurn(hostPage);
      const winner: Page = hostTurn ? hostPage : joinerPage;
      const loser: Page = hostTurn ? joinerPage : hostPage;
      const answer = await getOpponentAnswer(winner);
      await winner.getByTestId('guess-input').fill(answer);
      await winner.getByTestId('guess-submit').click();
      await waitForGameState(winner, 'finished');
      await waitForGameState(loser, 'finished');

      // ── Loser requests rematch with `animals` category. ──
      await requestRematch(loser, { category: 'animals' });

      // Host's modal shows the opponent banner with the new category.
      await waitForOpponentRematchBanner(winner, 'animals');

      // Host accepts. Both pages return to playing with the new category.
      await waitForRematchModal(winner);
      await winner.getByTestId('rematch-accept-btn').click();

      await waitForRematchStart(winner);
      await waitForRematchStart(loser);

      await expect(winner.getByTestId('game-room')).toHaveAttribute(
        'data-category',
        'animals',
        { timeout: 15_000 }
      );
      await expect(loser.getByTestId('game-room')).toHaveAttribute(
        'data-category',
        'animals',
        { timeout: 15_000 }
      );
    } finally {
      await session.dispose();
    }
  });
});
