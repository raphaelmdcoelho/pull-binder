import { Page, expect, test } from '@playwright/test';

// No real credentials and no real third-party network: Supabase and TCGdex are answered here.
const SUPABASE_HOST = 'https://cfqqwlggqybyjhtkkiha.supabase.co';
const STORAGE_KEY = 'sb-cfqqwlggqybyjhtkkiha-auth-token';

test.beforeEach(async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'localhost') external.push(request.url());
  });
  (page as Page & { external: string[] }).external = external;

  await page.route('https://api.tcgdex.net/**', (route) => route.fulfill({ json: [] }));
  await page.route('https://assets.tcgdex.net/**', (route) => route.fulfill({ status: 404 }));
  await page.route(`${SUPABASE_HOST}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/rest/v1/')) {
      return route.fulfill({
        json: [],
        headers: { 'content-range': '*/0', 'access-control-allow-origin': '*' },
      });
    }
    return route.fulfill({ status: 401, json: { message: 'mocked' } });
  });
});

/** A login that supabase-js accepts from storage without calling the server. */
async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ([key]) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: 'e2e.access.token',
          refresh_token: 'e2e-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'e2e@example.test',
            user_metadata: { full_name: 'E2E User' },
          },
        }),
      );
      localStorage.setItem('pb.lang', 'en');
    },
    [STORAGE_KEY],
  );
}

test('loads and sends a signed-out visitor to the login page', async ({ page }) => {
  await page.goto('/collection');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fcollection/);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expect(page).toHaveTitle('Pull Binder');
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('switches the interface language on the Account page', async ({ page }) => {
  await signIn(page);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
  await expect(page.getByTestId('app-version')).toHaveText('Version dev');

  await page.getByLabel('App language').selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: 'Conta', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByTestId('app-version')).toHaveText('Versão dev');
});

test('shows the empty Collection and searches the mocked Catalog', async ({ page }) => {
  await signIn(page);
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'No cards yet' })).toBeVisible();

  await page.getByRole('link', { name: 'Search', exact: true }).click();
  await page.getByLabel('Card name').fill('pikachu');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'No cards found' })).toBeVisible();
});

test('serves a valid, installable manifest and its icons', async ({ page, request }) => {
  await page.goto('/login');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(new URL(href!, page.url()).toString());
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Pull Binder',
    display: 'standalone',
    theme_color: '#2f6f3a',
  });
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test('only talks to the local server and the mocked hosts', async ({ page }) => {
  await signIn(page);
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'No cards yet' })).toBeVisible();
  const external = (page as Page & { external: string[] }).external;
  for (const url of external) {
    expect(
      url.startsWith(SUPABASE_HOST) || /^https:\/\/(api|assets)\.tcgdex\.net\//.test(url),
    ).toBe(true);
  }
});
