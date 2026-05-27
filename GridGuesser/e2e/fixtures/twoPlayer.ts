/**
 * Helper for spinning up a two-player session: two isolated browser
 * contexts (separate cookies/localStorage), each with their own page.
 *
 * Usage:
 *   const { hostPage, joinerPage, hostCtx, joinerCtx, dispose } =
 *     await openTwoPlayerSession(browser);
 *   try {
 *     // ... drive both pages ...
 *   } finally {
 *     await dispose();
 *   }
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';

export interface TwoPlayerSession {
  hostCtx: BrowserContext;
  joinerCtx: BrowserContext;
  hostPage: Page;
  joinerPage: Page;
  dispose: () => Promise<void>;
}

export async function openTwoPlayerSession(browser: Browser): Promise<TwoPlayerSession> {
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  return {
    hostCtx,
    joinerCtx,
    hostPage,
    joinerPage,
    dispose: async () => {
      await hostCtx.close().catch(() => {});
      await joinerCtx.close().catch(() => {});
    },
  };
}
