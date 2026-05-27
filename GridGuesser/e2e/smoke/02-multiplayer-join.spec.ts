/**
 * Smoke #2 — Multiplayer plumbing works.
 *
 * Proves: a host can create a room, a second player can join via the
 * 6-digit code, and both clients transition from `waiting` to `playing`.
 * If this breaks, no multiplayer game can ever start.
 *
 * Flow:
 *   1. Host (context A) creates a room → captures the 6-digit code.
 *   2. Joiner (context B) enters the code on the home page → joins.
 *   3. Both pages observe game-status-banner[data-state="playing"].
 *   4. Both pages render two game grids and show the same room code.
 */
import { test, expect } from '@playwright/test';
import { openTwoPlayerSession } from '../fixtures/twoPlayer';
import { createRoomAsHost, joinRoomAsGuest, waitForGameState } from '../fixtures/game';

test.describe('Smoke #2 — Two-player room start', () => {
  test('host creates, joiner joins, both reach playing state', async ({ browser }) => {
    const session = await openTwoPlayerSession(browser);
    try {
      const { hostPage, joinerPage } = session;

      // ── Step 1: host creates a room ──
      const roomCode = await createRoomAsHost(hostPage, { hostName: 'Alice' });
      expect(roomCode).toMatch(/^\d{6}$/);

      // ── Step 2: joiner joins via the 6-digit code ──
      await joinRoomAsGuest(joinerPage, roomCode, 'Bob');

      // ── Step 3: both pages reach playing state ──
      await waitForGameState(hostPage, 'playing');
      await waitForGameState(joinerPage, 'playing');

      // ── Step 4: both grids render and both pages show the same room code ──
      await expect(hostPage.locator('[data-testid="game-grid"]')).toHaveCount(2);
      await expect(joinerPage.locator('[data-testid="game-grid"]')).toHaveCount(2);

      await expect(hostPage.getByTestId('room-code-display')).toHaveAttribute('data-room-code', roomCode);
      await expect(joinerPage.getByTestId('room-code-display')).toHaveAttribute('data-room-code', roomCode);
    } finally {
      await session.dispose();
    }
  });
});
