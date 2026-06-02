/**
 * Feature #13 — Vs-AI mode produces at least one AI action.
 *
 * One test per difficulty (easy / medium / hard). We don't measure AI
 * "smartness" — that would be flaky and test-mode bypasses Gemini
 * (lib/aiGuessService.ts short-circuits to `null` so the AI uses the
 * deterministic `heuristicGuessFromMasked` fallback). We only assert
 * that within a reasonable window, the AI performs at least one
 * observable action: a tile reveal on the human's grid, a hint use,
 * or a turn handoff back to the human.
 */
import { test, expect, type Page } from '@playwright/test';
import { createVsAiRoom, waitForAiAction, type VsAiDifficulty } from '../fixtures/vsAi';
import { waitForGameState, isMyTurn } from '../fixtures/game';
import { clickActorOpponentTile } from '../fixtures/powerUps';

const DIFFICULTIES: VsAiDifficulty[] = ['easy', 'medium', 'hard'];

test.describe('Feature #13 — Vs-AI mode', () => {
  for (const difficulty of DIFFICULTIES) {
    test(`AI takes at least one action on ${difficulty}`, async ({ page }) => {
      test.setTimeout(60_000);

      await createVsAiRoom(page, difficulty, 'Alice');
      await waitForGameState(page, 'playing', 30_000);

      // The PlayerInfo for the AI should mark it as AI.
      const aiPlayerInfo = page.locator('[data-testid="player-info"][data-is-ai="true"]').first();
      await expect(aiPlayerInfo).toBeVisible({ timeout: 10_000 });
      await expect(aiPlayerInfo).toHaveAttribute('data-ai-difficulty', difficulty);

      // If it's the human's turn, reveal a tile to hand control to the AI.
      if (await isMyTurn(page)) {
        await clickActorOpponentTile(page, 50);
      }

      // Wait for visible AI activity.
      await waitForAiAction(page, 20_000);
    });
  }
});
