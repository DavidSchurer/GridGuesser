/**
 * Feature #7 — All seven power-ups produce their observable effect.
 *
 * Each sub-test spins up a fresh two-player session. Test mode seeds
 * both players with 100 points (see lib/gameRoomService.ts), so every
 * power-up — including nuke (30) — is affordable immediately.
 *
 * Assertions look at the smallest concrete effect that proves the
 * server applied the power-up:
 *
 *   peek        — peekTiles render with `data-peek="true"` on the actor's
 *                  opponent grid (peek doesn't permanently reveal tiles).
 *   skip        — `data-is-my-turn` stays "true" for the actor after their
 *                  next reveal-tile action (server flag `skipTurnActive`).
 *   revealLine  — 10 contiguous tiles on the actor's target row are
 *                  revealed.
 *   freeze      — opponent sees `powerup-frozen-banner` on their next turn.
 *   fog         — observer's grid loses 4 previously-revealed tiles.
 *   reveal2x2   — 4 contiguous tiles in a 2x2 are revealed.
 *   nuke        — all 100 tiles flip to revealed.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import {
  createRoomAsHost,
  joinRoomAsGuest,
  isMyTurn,
  waitForGameState,
} from '../fixtures/game';
import {
  usePowerUp,
  getMyPoints,
  getActorOpponentImageHash,
  clickActorOpponentTile,
  countRevealedByHash,
} from '../fixtures/powerUps';

interface ActorObserver {
  actor: Page;
  observer: Page;
}

/** Identify who has the turn after a fresh game starts. */
async function whoseTurn(hostPage: Page, joinerPage: Page): Promise<ActorObserver> {
  const hostTurn = await isMyTurn(hostPage);
  const joinerTurn = await isMyTurn(joinerPage);
  expect(hostTurn !== joinerTurn, 'exactly one player should have the turn').toBe(true);
  return {
    actor: hostTurn ? hostPage : joinerPage,
    observer: hostTurn ? joinerPage : hostPage,
  };
}

async function setupGame(browser: Browser) {
  const session = await openTwoPlayerSession(browser);
  const { hostPage, joinerPage } = session;
  const code = await createRoomAsHost(hostPage, { hostName: 'Alice' });
  await joinRoomAsGuest(joinerPage, code, 'Bob');
  await waitForGameState(hostPage, 'playing');
  await waitForGameState(joinerPage, 'playing');
  return { session, hostPage, joinerPage, code };
}

test.describe('Feature #7 — Power-ups', () => {
  test('peek temporarily exposes a 3x3 area on the opponent grid', async ({ browser }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);

      await usePowerUp(actor, 'peek', { tileIndex: 44 });

      // Peek doesn't permanently reveal — it adds peekTiles to client state.
      // The actor's opponent grid should show `data-peek` on the centered 3x3.
      const grid = actor.locator('[data-testid="game-grid"][data-is-opponent-grid="true"]').first();
      await expect(grid.locator('[data-peek="true"]')).toHaveCount(9, { timeout: 5_000 });

      // Cost: peek = 4 points
      const after = await getMyPoints(actor);
      expect(before - after).toBe(4);
    } finally {
      await session.dispose();
    }
  });

  test('skip lets the actor reveal a tile without passing the turn', async ({ browser }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);

      await usePowerUp(actor, 'skip');

      // Cost: 5 points. Poll because the deduction arrives via the
      // `power-up-used` socket round-trip, not synchronously on click.
      await expect.poll(() => getMyPoints(actor), { timeout: 5_000 }).toBe(before - 5);

      // The next tile reveal should not pass the turn.
      await expect(actor.getByTestId('game-status-banner')).toHaveAttribute('data-is-my-turn', 'true');
      await clickActorOpponentTile(actor, 17);
      await expect(actor.getByTestId('game-status-banner')).toHaveAttribute(
        'data-is-my-turn',
        'true',
        { timeout: 5_000 }
      );
    } finally {
      await session.dispose();
    }
  });

  test('revealLine reveals all 10 tiles in a row on the opponent grid', async ({ browser }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);
      const hash = await getActorOpponentImageHash(actor);
      const baselineRevealed = await countRevealedByHash(actor, hash);

      await usePowerUp(actor, 'revealLine', { lineType: 'row', lineIndex: 3 });

      await expect
        .poll(() => countRevealedByHash(actor, hash), { timeout: 5_000 })
        .toBeGreaterThanOrEqual(baselineRevealed + 10);

      const after = await getMyPoints(actor);
      expect(before - after).toBe(6);
    } finally {
      await session.dispose();
    }
  });

  test('freeze blocks the opponent from using power-ups on their next turn', async ({
    browser,
  }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor, observer } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);

      await usePowerUp(actor, 'freeze');

      // Cost: 6 points. Poll for the socket round-trip deduction.
      await expect.poll(() => getMyPoints(actor), { timeout: 5_000 }).toBe(before - 6);

      // After actor passes (freeze is instant; turn passes), observer should
      // see the frozen banner during their turn. Reveal a tile by the actor
      // so the turn flips to the observer. (Freeze doesn't pass the turn —
      // it's instant — so the actor still needs to reveal a tile to pass.)
      await clickActorOpponentTile(actor, 11);

      await expect(observer.getByTestId('game-status-banner')).toHaveAttribute(
        'data-is-my-turn',
        'true',
        { timeout: 5_000 }
      );
      await expect(observer.getByTestId('powerup-frozen-banner')).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await session.dispose();
    }
  });

  test('fog re-hides up to 4 previously revealed tiles on the actor\'s own image', async ({
    browser,
  }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      // First, the observer needs to reveal a bunch of tiles on the actor's
      // image so fog has something to re-hide. Take 5 alternating turns.
      let turn = await whoseTurn(hostPage, joinerPage);
      for (let i = 0; i < 6; i++) {
        await clickActorOpponentTile(turn.actor, i);
        // Wait for turn to flip, then re-identify actor/observer.
        await expect(turn.actor.getByTestId('game-status-banner')).toHaveAttribute(
          'data-is-my-turn',
          'false',
          { timeout: 5_000 }
        );
        turn = await whoseTurn(hostPage, joinerPage);
      }

      // Now the next actor uses fog on themselves: hides 4 tiles on their
      // own image (i.e. tiles the opponent had revealed).
      // Fog targets `revealedTiles[playerIndex]` — the actor's own image.
      // We need the actor to have at least one revealed tile on their own
      // image; given the back-and-forth, both have a few.
      const myOwnGrid = turn.actor.locator(
        '[data-testid="game-grid"][data-is-opponent-grid="false"]'
      ).first();
      const myOwnHash = await myOwnGrid.getAttribute('data-image-hash');
      expect(myOwnHash).toBeTruthy();
      const revealedBefore = await countRevealedByHash(turn.actor, myOwnHash!);
      expect(revealedBefore, 'opponent should have revealed some tiles by now').toBeGreaterThan(0);

      const pointsBefore = await getMyPoints(turn.actor);
      await usePowerUp(turn.actor, 'fog');
      // Cost: 8 points. Poll for the socket round-trip deduction.
      await expect.poll(() => getMyPoints(turn.actor), { timeout: 5_000 }).toBe(pointsBefore - 8);

      // Up to 4 tiles should be re-hidden. If the opponent only revealed N<4,
      // exactly N are hidden. Either way the count strictly decreases.
      const expectedHidden = Math.min(4, revealedBefore);
      await expect
        .poll(() => countRevealedByHash(turn.actor, myOwnHash!), { timeout: 5_000 })
        .toBe(revealedBefore - expectedHidden);
    } finally {
      await session.dispose();
    }
  });

  test('reveal2x2 reveals 4 contiguous tiles in a 2x2 block', async ({ browser }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);
      const hash = await getActorOpponentImageHash(actor);
      const baseline = await countRevealedByHash(actor, hash);

      // Pick a tile somewhere middle-of-the-grid (row 3, col 3 → index 33)
      await usePowerUp(actor, 'reveal2x2', { tileIndex: 33 });

      await expect
        .poll(() => countRevealedByHash(actor, hash), { timeout: 5_000 })
        .toBeGreaterThanOrEqual(baseline + 4);

      const after = await getMyPoints(actor);
      expect(before - after).toBe(8);
    } finally {
      await session.dispose();
    }
  });

  test('nuke reveals all 100 tiles on the opponent grid', async ({ browser }) => {
    const { session, hostPage, joinerPage } = await setupGame(browser);
    try {
      const { actor } = await whoseTurn(hostPage, joinerPage);
      const before = await getMyPoints(actor);
      expect(before, 'test mode should seed 100 starting points').toBeGreaterThanOrEqual(30);
      const hash = await getActorOpponentImageHash(actor);

      await usePowerUp(actor, 'nuke');

      await expect
        .poll(() => countRevealedByHash(actor, hash), { timeout: 5_000 })
        .toBe(100);

      const after = await getMyPoints(actor);
      expect(before - after).toBe(30);
    } finally {
      await session.dispose();
    }
  });
});
