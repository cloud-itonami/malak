import { test, expect } from '@playwright/test';

const BASE = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';

test.describe('malak.etzhayyim.com — Worker Health', () => {
	test('GET /_worker/health returns ok', async ({ request }) => {
		const r = await request.get(`${BASE}/_worker/health`);
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.status).toBe('ok');
	});

	test('GET /health returns ok', async ({ request }) => {
		const r = await request.get(`${BASE}/health`);
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.status).toBe('ok');
	});

	test('GET /_app/meta returns metadata', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.appId).toBeTruthy();
	});
});

test.describe('malak.etzhayyim.com — App Meta', () => {
	test('manifest returns fullapp mode with correct metadata', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		expect(r.ok()).toBeTruthy();
		const m = await r.json();
		expect(m.ui).toBe('fullapp');
		expect(m.accent).toBe('#1e3a5f');
		expect(m.icon).toBe('🕵️');
		expect(m.spaceName).toContain('Malak');
	});

	test('manifest has correct public/private channels', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		const m = await r.json();
		const publicChannels = m.channels.filter((c: any) => c.kind === 'public');
		const privateChannels = m.channels.filter((c: any) => c.kind === 'private');
		expect(publicChannels.length).toBeGreaterThanOrEqual(3);
		expect(privateChannels.length).toBeGreaterThanOrEqual(2);
		expect(publicChannels.map((c: any) => c.name)).toEqual(
			expect.arrayContaining(['Threat Intel', 'OSINT Feed', 'Tips']),
		);
	});

	test('manifest keeps shared talk/vibes/provider handlers unbound', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		const m = await r.json();
		expect(m.ssrRoutes?.talk).toBeUndefined();
		expect(m.ssrRoutes?.vibes).toBeUndefined();
		expect(m.ssrRoutes?.provider).toBeUndefined();
	});

	test('app meta returns version and runtime', async ({ request }) => {
		const r = await request.get(`${BASE}/_app/meta`);
		expect(r.ok()).toBeTruthy();
		const m = await r.json();
		expect(m.runtime).toBe('worker');
		expect(m.ui).toBe('fullapp');
		expect(m.version).toBe('0.2.0');
	});
});
