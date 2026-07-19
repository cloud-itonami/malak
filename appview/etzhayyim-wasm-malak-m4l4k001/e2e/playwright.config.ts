import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';

export default defineConfig({
	testDir: './tests',
	timeout: 30_000,
	retries: 1,
	workers: 1,
	use: {
		baseURL: BASE_URL,
		headless: true,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		viewport: { width: 390, height: 844 },
	},
	expect: {
		toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
	],
});
