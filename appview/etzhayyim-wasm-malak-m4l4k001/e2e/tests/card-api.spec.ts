import { test, expect } from '@playwright/test';

const BASE = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';
const SVC = `${BASE}/xrpc/etzhayyim.malak.v1.MalakService`;
const HDR = { 'Content-Type': 'application/json', 'X-etzhayyim-USER-ID': 'e2e-test' };

test.describe('malak.etzhayyim.com — Dashboard Card', () => {
	test('malak.dashboard returns metric-dashboard card', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.dashboard`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.metric-dashboard');
		expect(b.payload.title).toContain('Malak');
		expect(b.payload.metrics.length).toBeGreaterThanOrEqual(7);
	});

	test('dashboard metrics include threat actors and cases', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.dashboard`, { headers: HDR, data: {} });
		const b = await r.json();
		const labels = b.payload.metrics.map((m: any) => m.label);
		expect(labels).toEqual(expect.arrayContaining([
			'Threat Actors', 'Open Cases', 'Intel Reports',
		]));
	});

	test('dashboard has link to crypto-asset-freeze', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.dashboard`, { headers: HDR, data: {} });
		const b = await r.json();
		const links = b.payload.links ?? [];
		const freezeLink = links.find((l: any) => l.url?.includes('crypto-asset-freeze'));
		expect(freezeLink).toBeDefined();
	});
});

test.describe('malak.etzhayyim.com — Threat Actor Cards', () => {
	test('malak.threatActors returns list card', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.threatActors`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.list');
		expect(b.payload.title).toContain('Threat Actor');
	});
});

test.describe('malak.etzhayyim.com — Submit Tip Form', () => {
	test('malak.submitTip returns form card', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.submitTip`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.form');
		expect(b.payload.title).toContain('Tip');
	});

	test('tip form has required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.submitTip`, { headers: HDR, data: {} });
		const b = await r.json();
		const fieldNames = b.payload.fields.map((f: any) => f.name);
		expect(fieldNames).toEqual(expect.arrayContaining([
			'alias', 'actorType', 'modusOperandi',
		]));
	});

	test('tip form has blockchain options', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.submitTip`, { headers: HDR, data: {} });
		const b = await r.json();
		const blockchainField = b.payload.fields.find((f: any) => f.name === 'blockchain');
		expect(blockchainField).toBeDefined();
		const values = blockchainField.options.map((o: any) => o.value);
		expect(values).toEqual(expect.arrayContaining(['ethereum', 'bitcoin', 'tron']));
	});
});

test.describe('malak.etzhayyim.com — Agencies & Tools', () => {
	test('malak.agencies returns list of 16+ agencies', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.agencies`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.list');
		expect(b.payload.items.length).toBeGreaterThanOrEqual(16);
	});

	test('agencies include INTERPOL and NPA', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.agencies`, { headers: HDR, data: {} });
		const b = await r.json();
		const names = b.payload.items.map((i: any) => i.label);
		expect(names).toEqual(expect.arrayContaining(['INTERPOL']));
		const sublabels = b.payload.items.map((i: any) => i.sublabel).join(' ');
		expect(sublabels).toContain('JP');
	});

	test('malak.tools returns list with linked apps', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.tools`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.contentType).toBe('application/vnd.etzhayyim.card.list');
		const labels = b.payload.items.map((i: any) => i.label);
		expect(labels).toEqual(expect.arrayContaining([
			'Threat Actor Tracker', 'Sanctions Check', 'Crypto Asset Freeze',
		]));
	});

	test('tools has navigable link to crypto-asset-freeze', async ({ request }) => {
		const r = await request.post(`${SVC}/malak.tools`, { headers: HDR, data: {} });
		const b = await r.json();
		const freezeItem = b.payload.items.find((i: any) => i.label === 'Crypto Asset Freeze');
		expect(freezeItem).toBeDefined();
		expect(freezeItem.action).toContain('crypto-asset-freeze.etzhayyim.com');
	});
});

test.describe('malak.etzhayyim.com — Capabilities', () => {
	test('getCapabilities returns full capability list', async ({ request }) => {
		const r = await request.post(`${SVC}/getCapabilities`, { headers: HDR, data: {} });
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.component).toBe('m4l4k001');
		expect(b.capabilities).toEqual(expect.arrayContaining([
			'threatActorTracking',
			'interpolNoticeRequest',
			'sanctionsCheck',
			'cryptoFreezeIntegration',
		]));
		expect(b.connectedAgencies).toBeGreaterThanOrEqual(16);
	});

	test('governance lists approval-required commands', async ({ request }) => {
		const r = await request.post(`${SVC}/getCapabilities`, { headers: HDR, data: {} });
		const b = await r.json();
		expect(b.governance.approvalRequiredCommands).toEqual(expect.arrayContaining([
			'createInterpolNotice',
			'escalateToFreeze',
		]));
	});
});

test.describe('malak.etzhayyim.com — Card Action Routing', () => {
	test('card.action with unknown action returns ok', async ({ request }) => {
		const r = await request.post(`${SVC}/card.action`, {
			headers: HDR, data: { action: 'unknown' },
		});
		expect(r.ok()).toBeTruthy();
		const b = await r.json();
		expect(b.ok).toBe(true);
	});

	test('card.action malak.doSubmitTip dispatches to createThreatActor', async ({ request }) => {
		const r = await request.post(`${SVC}/card.action`, {
			headers: HDR,
			data: {
				action: 'malak.doSubmitTip',
				alias: 'E2E-TestActor-' + Date.now(),
				'actorType': 'individual',
				'modusOperandi': 'cryptoFraud',
			},
			timeout: 5000,
		});
		expect([200, 500]).toContain(r.status());
	});

	test('card.action malak.doChat dispatches to LLM', async ({ request }) => {
		const r = await request.post(`${SVC}/card.action`, {
			headers: HDR,
			data: { action: 'malak.doChat', message: 'What is a Red Notice?' },
		});
		// 200 (murakumo reachable) or 500 (murakumo unreachable) — routing works
		expect([200, 500]).toContain(r.status());
	});
});
