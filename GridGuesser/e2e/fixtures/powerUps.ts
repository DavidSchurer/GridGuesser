/**
 * Power-up helpers.
 *
 * Power-up costs (from server/normalModeActions.ts):
 *   peek=4, skip=5, revealLine=6, freeze=6, fog=8, reveal2x2=8, nuke=30
 *
 * In normal mode, the buttons sit in a 3-per-page paginator with the order:
 *   page 0: peek, skip, revealLine
 *   page 1: freeze, fog, reveal2x2
 *   page 2: nuke
 * paginatePowerUpsTo handles flipping to whichever page hosts a given id.
 */
import { expect, type Page } from '@playwright/test';

export const POWERUP_PAGE: Record<string, number> = {
  peek: 0,
  skip: 0,
  revealLine: 0,
  freeze: 1,
  fog: 1,
  reveal2x2: 1,
  nuke: 2,
};

export const POWERUP_COST: Record<string, number> = {
  peek: 4,
  skip: 5,
  revealLine: 6,
  freeze: 6,
  fog: 8,
  reveal2x2: 8,
  nuke: 30,
};

/** Read the current page index off the power-up paginator. */
export async function getCurrentPowerUpPage(page: Page): Promise<number> {
  const indicator = page.getByTestId('powerup-page-indicator');
  const cur = await indicator.getAttribute('data-page');
  return Number(cur) - 1;
}

/** Flip to whichever page hosts the given power-up id. */
export async function paginatePowerUpsTo(page: Page, powerUpId: string): Promise<void> {
  const target = POWERUP_PAGE[powerUpId];
  if (target === undefined) throw new Error(`Unknown power-up id: ${powerUpId}`);

  let current = await getCurrentPowerUpPage(page);
  let safety = 5;
  while (current !== target && safety-- > 0) {
    if (current < target) {
      await page.getByTestId('powerup-page-next').click();
    } else {
      await page.getByTestId('powerup-page-prev').click();
    }
    await page.waitForTimeout(120);
    current = await getCurrentPowerUpPage(page);
  }
  if (current !== target) {
    throw new Error(`Failed to paginate to power-up page ${target} for ${powerUpId}`);
  }
}

/** Read this player's points off the sidebar. */
export async function getMyPoints(page: Page): Promise<number> {
  const el = page.getByTestId('my-points');
  await expect(el).toBeVisible({ timeout: 5_000 });
  const raw = await el.getAttribute('data-points');
  return Number(raw ?? 0);
}

/** Wait until the power-up card for the given id is on screen and affordable. */
export async function waitForPowerUpAvailable(page: Page, powerUpId: string): Promise<void> {
  await paginatePowerUpsTo(page, powerUpId);
  const card = page.getByTestId(`powerup-card-${powerUpId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(card).toHaveAttribute('data-affordable', 'true');
  await expect(card).toHaveAttribute('data-can-use', 'true');
}

export interface UsePowerUpOptions {
  /** Tile index within the opponent's grid (for peek / reveal2x2). */
  tileIndex?: number;
  /** Line direction for revealLine ('row' | 'col'). */
  lineType?: 'row' | 'col';
  /** Row or column index 0-9 for revealLine. */
  lineIndex?: number;
}

/**
 * Click the given power-up card, then satisfy its activation requirements
 * (tile picker for peek/reveal2x2, row/col + tile for revealLine).
 *
 * The instant power-ups (skip, freeze, fog, nuke) just need the click.
 *
 * Targets the actor's own opponent grid (the grid they're guessing).
 */
export async function usePowerUp(
  page: Page,
  powerUpId: string,
  opts: UsePowerUpOptions = {}
): Promise<void> {
  await waitForPowerUpAvailable(page, powerUpId);
  await page.getByTestId(`powerup-card-${powerUpId}`).click();

  if (powerUpId === 'peek' || powerUpId === 'reveal2x2') {
    if (opts.tileIndex === undefined) {
      throw new Error(`${powerUpId} requires tileIndex`);
    }
    await clickActorOpponentTile(page, opts.tileIndex);
    return;
  }

  if (powerUpId === 'revealLine') {
    const dir = opts.lineType ?? 'row';
    const idx = opts.lineIndex ?? 0;
    // Toggle direction via keyboard shortcut: R for row, C for column.
    await page.keyboard.press(dir === 'row' ? 'r' : 'c');
    // The line is selected by clicking ANY tile in that row/col on the
    // opponent grid. We pick the first tile in the line.
    const tileIndex = dir === 'row' ? idx * 10 : idx;
    await clickActorOpponentTile(page, tileIndex);
    return;
  }

  // Instant power-ups (skip, freeze, fog, nuke) take effect on click.
}

/** Click a tile inside the actor's own opponent-grid (the grid being guessed). */
export async function clickActorOpponentTile(page: Page, tileIndex: number): Promise<void> {
  const grid = page
    .locator('[data-testid="game-grid"][data-is-opponent-grid="true"]')
    .first();
  await expect(grid).toBeVisible({ timeout: 5_000 });
  const tile = grid.locator(`[data-testid="tile-${tileIndex}"]`);
  await expect(tile).toBeVisible();
  await tile.click();
}

/** The image hash for the grid the actor is trying to guess. */
export async function getActorOpponentImageHash(page: Page): Promise<string> {
  const grid = page
    .locator('[data-testid="game-grid"][data-is-opponent-grid="true"]')
    .first();
  await expect(grid).toBeVisible({ timeout: 5_000 });
  const hash = await grid.getAttribute('data-image-hash');
  if (!hash) throw new Error('Opponent grid missing data-image-hash');
  return hash;
}

/** Count revealed tiles inside a grid located by image hash on any page. */
export async function countRevealedByHash(page: Page, hash: string): Promise<number> {
  const grid = page.locator(`[data-testid="game-grid"][data-image-hash="${hash}"]`).first();
  await expect(grid).toBeVisible({ timeout: 5_000 });
  return await grid.locator('[data-revealed="true"]').count();
}
