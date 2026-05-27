/**
 * User-related test fixtures.
 *
 * Each test run gets a fresh, timestamped email so accounts don't collide
 * across runs. Server-side cleanup is the user's responsibility (we don't
 * delete test accounts after each run because there's no admin API for it),
 * but unique emails ensure no two runs ever step on each other.
 */
import { expect, type Page } from '@playwright/test';

export interface TestUserCreds {
  username: string;
  email: string;
  password: string;
}

/** Build a unique set of test credentials. */
export function makeUniqueUser(label: string = 'qa'): TestUserCreds {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    username: `${label}_${stamp}`.slice(0, 20),
    email: `${label}+${stamp}@gridguesser.test`,
    password: 'TestPass123!',
  };
}

/**
 * Walks through the home page → AuthModal signup flow.
 * Leaves the page on the home screen with the user logged in.
 */
export async function signUpViaUI(page: Page, creds: TestUserCreds): Promise<void> {
  await page.goto('/');
  await page.getByTestId('userprofile-login-btn').click();

  // Switch to signup mode if needed
  const form = page.getByTestId('auth-form');
  const mode = await form.getAttribute('data-mode');
  if (mode !== 'signup') {
    await page.getByTestId('auth-switch-mode').click();
    await expect(form).toHaveAttribute('data-mode', 'signup');
  }

  await page.getByTestId('auth-username').fill(creds.username);
  await page.getByTestId('auth-email').fill(creds.email);
  await page.getByTestId('auth-password').fill(creds.password);
  await page.getByTestId('auth-confirm').fill(creds.password);
  await page.getByTestId('auth-submit').click();

  // Wait for the modal to close + logged-in state to render
  await expect(page.getByTestId('userprofile-loggedin')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('userprofile-username')).toHaveText(creds.username);
}

/** Walks through the home page → AuthModal login flow for an existing user. */
export async function loginViaUI(page: Page, creds: TestUserCreds): Promise<void> {
  await page.goto('/');
  await page.getByTestId('userprofile-login-btn').click();

  // Switch to login mode if needed
  const form = page.getByTestId('auth-form');
  const mode = await form.getAttribute('data-mode');
  if (mode !== 'login') {
    await page.getByTestId('auth-switch-mode').click();
    await expect(form).toHaveAttribute('data-mode', 'login');
  }

  await page.getByTestId('auth-email').fill(creds.email);
  await page.getByTestId('auth-password').fill(creds.password);
  await page.getByTestId('auth-submit').click();

  await expect(page.getByTestId('userprofile-loggedin')).toBeVisible({ timeout: 15_000 });
}

/** Logs the current user out via the profile menu. */
export async function logoutViaUI(page: Page): Promise<void> {
  await page.getByTestId('userprofile-menu-toggle').click();
  await page.getByTestId('userprofile-logout-btn').click();
  await expect(page.getByTestId('userprofile-login-btn')).toBeVisible({ timeout: 10_000 });
}
