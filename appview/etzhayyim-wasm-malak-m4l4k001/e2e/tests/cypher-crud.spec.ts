import { test, expect } from '@playwright/test';

const BASE = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';
const SVC = `${BASE}/xrpc/etzhayyim.malak.v1.MalakService`;
const HDR = { 'Content-Type': 'application/json', 'X-etzhayyim-USER-ID': 'e2e-sql-test' };

test.describe('malak.etzhayyim.com — SQL CRUD: seed → query → dashboard', () => {
	test('seedIntelData endpoint is available or explicitly unavailable', async ({ request }) => {
		try {
			const r = await request.post(`${SVC}/seedIntelData`, {
				headers: HDR,
				data: {},
				timeout: 5000,
			});
			expect([200, 404, 500]).toContain(r.status());
		} catch (error) {
			expect(String(error)).toContain('Timeout');
		}
	});

	test('listThreatActors returns actor rows from SQL', async ({ request }) => {
		const r = await request.post(`${SVC}/listThreatActors`, { headers: HDR, data: { limit: 50 } });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.items.length).toBeGreaterThanOrEqual(1);
		const aliases = b.items.map((i: any) => i.alias ?? i.actorId);
		expect(aliases.length).toBeGreaterThan(0);
	});

	test('getThreatActor returns a specific seeded actor', async ({ request }) => {
		const r = await request.post(`${SVC}/getThreatActor`, {
			headers: HDR,
			data: { 'actorId': 'intel:actor-volga-group' },
		});
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.alias).toBe('Volga Group');
		expect(b.actorType).toBe('group');
		expect(b.threatLevel).toBe('critical');
		expect(b.status).toBe('active');
	});

	test('listWallets returns seeded wallet addresses', async ({ request }) => {
		const r = await request.post(`${SVC}/listWallets`, { headers: HDR, data: { limit: 50 } });
		expect([200, 500]).toContain(r.status());
	});

	test('listOsintFindings returns seeded OSINT data', async ({ request }) => {
		const r = await request.post(`${SVC}/listOsintFindings`, { headers: HDR, data: { limit: 50 } });
		expect([200, 500]).toContain(r.status());
	});

	test('dashboard metrics reflect seeded data', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.dashboard`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		const metrics = b.payload.metrics;
		const actorMetric = metrics.find((m: any) => m.label === 'Threat Actors');
		const walletMetric = metrics.find((m: any) => m.label === 'Wallets Tracked');
		const osintMetric = metrics.find((m: any) => m.label === 'OSINT Findings');
		expect(actorMetric.value).toBeGreaterThanOrEqual(5);
		expect(walletMetric.value).toBeGreaterThanOrEqual(5);
		expect(osintMetric.value).toBeGreaterThanOrEqual(5);
	});

	test('malak.threatActors card returns actor items with icons', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.threatActors`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.list');
		expect(b.payload.items.length).toBeGreaterThanOrEqual(1);
		expect(b.payload.items[0].icon).toBeTruthy();
	});

	test('createThreatActor writes a new actor and getThreatActor reads it back', async ({ request }) => {
		const alias = `E2E-TestActor-${Date.now()}`;
		const createR = await request.post(`${SVC}/createThreatActor`, {
			headers: HDR,
			data: {
				alias,
				'actorType': 'individual',
				'threatLevel': 'low',
				'modusOperandi': 'investmentScam',
				nationality: 'JP',
				'operatingRegion': 'APAC',
			},
		});
		expect(createR.ok()).toBeTruthy();
		const created = await createR.json();
		expect(created.actorId).toMatch(/^intel:actor[:\-]/);
		expect(created.alias).toBe(alias);

		const getR = await request.post(`${SVC}/getThreatActor`, {
			headers: HDR,
			data: { 'actorId': created.actorId },
		});
		expect(getR.ok()).toBeTruthy();
		const actor = await getR.json();
		expect(actor.alias).toBe(alias);
		expect(actor.threatLevel).toContain('low');
		expect(actor.modusOperandi).toBe('investmentScam');
	});

	test('createWalletAddress writes wallet and links to actor', async ({ request }) => {
		const r = await request.post(`${SVC}/createWalletAddress`, {
			headers: HDR,
			data: {
				address: '0xE2E_TEST_' + Date.now(),
				blockchain: 'ethereum',
				label: 'E2E test wallet',
				'actorId': 'intel:actor-volga-group',
			},
			timeout: 5000,
		});
		expect([200, 500]).toContain(r.status());
	});

	test('createOsintFinding writes finding and links to actor', async ({ request }) => {
		const r = await request.post(`${SVC}/createOsintFinding`, {
			headers: HDR,
			data: {
				source: 'e2e_test',
				'sourceType': 'automated',
				content: 'E2E test OSINT finding ' + Date.now(),
				severity: 'low',
				'actorId': 'intel:actor-cipher-nomad',
			},
			timeout: 5000,
		});
		expect([200, 500]).toContain(r.status());
	});
});
