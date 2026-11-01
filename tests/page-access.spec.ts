import { test, expect } from '@playwright/test';

for (const path of ['/interview', '/coding', '/history']) {
  test(`signed-out visitors to ${path} go to login`, async ({ page }) => {
    await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      export async function requireUser(){throw Error('Sign in');}
      export async function api(){throw Error('Sign in');}
      export async function authenticateSocket(){}
    ` }));
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp('/login\\?next=' + encodeURIComponent(path)));
  });
}

test('signed-in visitors can see the interview room', async ({ page }) => {
  await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function requireUser(){return {uid:'test'};}
    export async function api(){return {};}
    export async function authenticateSocket(){}
  ` }));
  await page.goto('/interview');
  await expect(page.locator('#account-gate')).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Make your next answer count.'})).toBeVisible();
});
