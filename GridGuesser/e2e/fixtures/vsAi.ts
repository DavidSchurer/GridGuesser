/**
 * vs-AI helpers.
 *
 * The home page flows for vs-AI:
 *   home-vs-ai-btn → category screen → (ai-difficulty-{easy|medium|hard})
 *   → continue → name → URL with `vsAi=1&aiDifficulty=<d>`.
 *
 * Once the game page loads it emits `create-room-with-id` with vsAi=true
 * and the server inserts a synthetic GridBot player at index 1. With
 * GRIDGUESSER_TEST_MODE=1 the AI uses the deterministic heuristic guesser.
 */
import { expect, type Page } from '@playwright/test';
import type { AiDifficulty } from '@/lib/types';

export type VsAiDifficulty = AiDifficulty;

/** Drive the home page through the vs-AI create flow at a given difficulty. */
export async function createVsAiRoom(
  page: Page,
  difficulty: VsAiDifficulty,
  hostName: string = 'Alice'
): Promise<string> {
  await page.goto('/');
  await page.getByTestId('home-vs-ai-btn').click();

  // Category screen with the AI difficulty picker shown.
  await expect(page.getByTestId('ai-difficulty-picker')).toBeVisible();
  await page.getByTestId(`ai-difficulty-${difficulty}`).click();
  await expect(page.getByTestId(`ai-difficulty-${difficulty}`)).toHaveAttribute(
    'data-selected',
    'true'
  );

  await page.getByTestId('category-continue-btn').click();

  // Name input.
  await page.getByTestId('home-name-input').fill(hostName);
  await page.getByTestId('home-name-submit').click();

  await page.waitForURL(/\/game\/\d{6}/, { timeout: 15_000 });
  const match = page.url().match(/\/game\/(\d{6})/);
  if (!match) throw new Error(`Bad vs-AI URL: ${page.url()}`);
  return match[1];
}

/**
 * Wait for visible evidence that the AI took an action: either a tile on
 * the human's grid (index 0's grid, which is the AI's guess target) got
 * revealed, or a hint indicator revealed a letter, or the turn flipped
 * back to the human after starting on the AI side.
 */
export async function waitForAiAction(page: Page, timeoutMs: number = 15_000): Promise<void> {
  const start = Date.now();
  const banner = page.getByTestId('game-status-banner');
  const initialTurn = await banner.getAttribute('data-is-my-turn');

  // The human's own grid is the one labeled `data-is-opponent-grid="false"`.
  const myGrid = page.locator('[data-testid="game-grid"][data-is-opponent-grid="false"]').first();
  await expect(myGrid).toBeVisible();
  const initialRevealCount = await myGrid.locator('[data-revealed="true"]').count();

  while (Date.now() - start < timeoutMs) {
    // Any new reveal on my own grid means the AI revealed a tile.
    const currentReveal = await myGrid.locator('[data-revealed="true"]').count();
    if (currentReveal > initialRevealCount) return;

    // Turn flipped from "not mine" to "mine" → AI must have acted.
    if (initialTurn !== 'true') {
      const now = await banner.getAttribute('data-is-my-turn');
      if (now === 'true') return;
    } else {
      // We started on our turn — wait for it to flip away and back.
      const now = await banner.getAttribute('data-is-my-turn');
      if (now === 'false') return;
    }

    await page.waitForTimeout(250);
  }
  throw new Error('Timed out waiting for AI action');
}
