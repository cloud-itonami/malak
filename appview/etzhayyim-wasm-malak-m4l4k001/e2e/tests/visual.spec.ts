import { test, expect } from '@playwright/test';

const BASE = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';

test.describe('malak.etzhayyim.com — Visual Rendering', () => {
	test('page loads without critical JS errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => {
			if (!e.message.includes('root.svelte') && !e.message.includes('hydrat')) {
				errors.push(e.message);
			}
		});
		await page.goto(BASE, { waitUntil: 'networkidle' });
		await page.waitForTimeout(2000);
		expect(errors).toHaveLength(0);
	});

	test('no failed asset requests', async ({ page }) => {
		const failed: string[] = [];
		page.on('requestfailed', (r) => {
			if (r.url().includes('/_app/')) failed.push(r.url());
		});
		await page.goto(BASE, { waitUntil: 'networkidle' });
		await page.waitForTimeout(2000);
		expect(failed).toHaveLength(0);
	});

	test('manifest advertises fullapp mode', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		expect(r.ok()).toBeTruthy();
		const m = await r.json();
		expect(m.ui).toBe('fullapp');
	});

	test('visual snapshot — homepage', async ({ page }) => {
		await page.goto(BASE, { waitUntil: 'networkidle' });
		await page.waitForTimeout(3000);
		await expect(page).toHaveScreenshot('malak-homepage.png', { maxDiffPixelRatio: 0.05 });
	});

	test('visual snapshot — mobile viewport (390x844)', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(BASE, { waitUntil: 'networkidle' });
		await page.waitForTimeout(3000);
		await expect(page).toHaveScreenshot('malak-mobile.png', { maxDiffPixelRatio: 0.05 });
	});
});
