/**
 * Rematch helpers — drive the GameOver rematch modal.
 *
 * The modal exposes:
 *   rematch-modal             — the dialog, with `data-rematch-requested` /
 *                                `data-opponent-rematch-requested` /
 *                                `data-category-picker-open`.
 *   rematch-btn               — opens the category picker.
 *   rematch-decline-btn       — declines from STATE 1.
 *   rematch-back-home-btn     — leaves to the home page.
 *   rematch-category-picker   — the inline category selector (STATE 1b).
 *   rematch-start-btn         — confirms the rematch request from STATE 1b
 *                                (has `data-category` for assertions).
 *   rematch-back-btn          — returns to STATE 1.
 *   rematch-status-waiting    — shown while waiting on opponent.
 *   rematch-opponent-banner   — visible when only the opponent has requested
 *                                (has `data-opponent-category` /
 *                                 `data-opponent-custom-query`).
 *   rematch-accept-btn        — accept the opponent's request.
 *   rematch-decline-opponent-btn — decline the opponent's request.
 *   rematch-both-ready        — visible right before rematch-start fires.
 */
import { expect, type Page } from '@playwright/test';

export interface RequestRematchOpts {
  /** Optional category override. Defaults to the current room's category. */
  category?: string;
  /** Required iff category === 'custom'. */
  customQuery?: string;
}

/** Wait for the rematch modal to appear (~6s delay after game-end). */
export async function waitForRematchModal(page: Page): Promise<void> {
  await expect(page.getByTestId('rematch-modal')).toBeVisible({ timeout: 15_000 });
}

/** Click Rematch → open category picker → optionally change category → start. */
export async function requestRematch(
  page: Page,
  opts: RequestRematchOpts = {}
): Promise<void> {
  await waitForRematchModal(page);
  await page.getByTestId('rematch-btn').click();
  await expect(page.getByTestId('rematch-category-picker')).toBeVisible();

  if (opts.category) {
    if (opts.category === 'custom') {
      // Switch CategorySelector to custom mode and fill the input.
      const customBtn = page.getByTestId('category-select-custom');
      if (await customBtn.count() > 0) {
        await customBtn.click();
      }
      if (opts.customQuery) {
        await page.getByTestId('category-custom-input').fill(opts.customQuery);
      }
    } else {
      // Need to be inside the preset grid first; click "Select Preset" if visible.
      const presetEntry = page.getByTestId('category-select-preset');
      if (await presetEntry.count() > 0 && await presetEntry.isVisible().catch(() => false)) {
        await presetEntry.click();
      }
      const option = page.getByTestId(`category-option-${opts.category}`);
      await expect(option).toBeVisible({ timeout: 5_000 });
      await option.click();
      await expect(option).toHaveAttribute('data-selected', 'true');
    }
  }

  await page.getByTestId('rematch-start-btn').click();
  await expect(page.getByTestId('rematch-status-waiting')).toBeVisible({ timeout: 5_000 });
}

/**
 * Accept the opponent's rematch request directly (when this page is in
 * STATE 3 — opponent requested first).
 */
export async function acceptOpponentRematch(page: Page): Promise<void> {
  await waitForRematchModal(page);
  await expect(page.getByTestId('rematch-opponent-banner')).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId('rematch-accept-btn').click();
}

/** Wait until rematch-start fires and the game has restarted. */
export async function waitForRematchStart(page: Page): Promise<void> {
  // Modal disappears, then game-status-banner returns to 'playing'.
  await expect(page.getByTestId('rematch-modal')).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId('game-status-banner')).toHaveAttribute(
    'data-state',
    'playing',
    { timeout: 30_000 }
  );
}

/** Wait for the opponent-banner (other side requested) to appear. */
export async function waitForOpponentRematchBanner(
  page: Page,
  expectedCategory?: string
): Promise<void> {
  await waitForRematchModal(page);
  const banner = page.getByTestId('rematch-opponent-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  if (expectedCategory) {
    await expect(banner).toHaveAttribute('data-opponent-category', expectedCategory);
  }
}
