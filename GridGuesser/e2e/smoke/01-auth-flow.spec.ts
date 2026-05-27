/**
 * Smoke #1 — Auth works end-to-end.
 *
 * Proves: the auth pipeline (REST endpoint + bcrypt + JWT + httpOnly cookie
 * + AuthContext) survives a full round trip. If this breaks, no logged-in
 * user can sign in, so the leaderboard, stats, and rejoin flows all break.
 *
 * Flow:
 *   1. Sign up with a fresh username/email/password.
 *   2. Verify the httpOnly auth_token cookie is set and the UI shows the user.
 *   3. Log out → cookie cleared, UI returns to logged-out state.
 *   4. Log back in with the same credentials → logged-in state restored.
 */
import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  logoutViaUI,
  makeUniqueUser,
  signUpViaUI,
} from '../fixtures/users';

test.describe('Smoke #1 — Auth flow', () => {
  test('signup → logout → login round-trip', async ({ page, context }) => {
    const creds = makeUniqueUser('smoke1');

    // ── Step 1: sign up ──
    await signUpViaUI(page, creds);

    // ── Step 2: verify the auth_token cookie is set with HttpOnly ──
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'auth_token');
    expect(authCookie, 'auth_token cookie should be set after signup').toBeDefined();
    expect(authCookie?.httpOnly, 'auth_token cookie must be HttpOnly').toBe(true);
    expect(authCookie?.value?.length ?? 0).toBeGreaterThan(20);

    // ── Step 3: log out ──
    await logoutViaUI(page);

    const cookiesAfterLogout = await context.cookies();
    const authAfterLogout = cookiesAfterLogout.find((c) => c.name === 'auth_token');
    expect(
      !authAfterLogout || !authAfterLogout.value,
      'auth_token cookie should be cleared after logout'
    ).toBe(true);

    // ── Step 4: log back in with the same credentials ──
    await loginViaUI(page, creds);

    await expect(page.getByTestId('userprofile-username')).toHaveText(creds.username);
  });
});
