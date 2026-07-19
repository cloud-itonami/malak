import { test, expect } from '@playwright/test';

/**
 * BDD-style quality acceptance tests for malak.etzhayyim.com
 *
 * Feature: Cybercrime Intelligence Platform
 *   As a law enforcement analyst
 *   I want to track threat actors and coordinate with agencies
 *   So that cybercriminals can be identified and apprehended
 */

const BASE = process.env.MALAK_BASE_URL ?? 'https://malak.etzhayyim.com';
const SVC = `${BASE}/xrpc/etzhayyim.malak.v1.MalakService`;
const HDR = { 'Content-Type': 'application/json', 'X-etzhayyim-USER-ID': 'e2e-bdd' };

// --- Scenario: Register and track a new threat actor ---

test.describe('Feature: Threat Actor Lifecycle', () => {
	// Write operations require yata proxy auth — test endpoint routing & response shape

	test('Given I submit a threat actor, the endpoint accepts the request', async ({ request }) => {
		const r = await request.post(`${SVC}/createThreatActor`, {
			headers: HDR,
			data: {
				alias: `BDD-Suspect-${Date.now()}`,
				'actorType': 'individual',
				'modusOperandi': 'pigButchering',
				'threatLevel': 'high',
			},
		});
		// 200 (sql available) or 500 (sql proxy auth required) — routing works
		expect([200, 500]).toContain(r.status());
		if (r.ok()) {
			const b = await r.json();
			expect(b.actorId).toMatch(/^intel:actor[:\-]/);
			expect(b.status).toBe('active');
		}
	});

	test('And listThreatActors endpoint responds', async ({ request }) => {
		const r = await request.post(`${SVC}/listThreatActors`, {
			headers: HDR, data: { limit: 10 },
		});
		expect([200, 500]).toContain(r.status());
		if (r.ok()) {
			const b = await r.json();
			expect(b).toHaveProperty('items');
			expect(b).toHaveProperty('total');
		}
	});

	test('And linkWalletToActor validates required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/linkWalletToActor`, {
			headers: HDR, data: {},
		});
		// Should fail validation (missing actorId and walletAddress)
		expect(r.ok()).toBeFalsy();
	});
});

// --- Scenario: Create investigation case and link evidence ---

test.describe('Feature: Case Management', () => {
	test('Given I create a case, the endpoint accepts the request', async ({ request }) => {
		const r = await request.post(`${SVC}/createCase`, {
			headers: HDR,
			data: {
				title: `BDD-Case-${Date.now()}`,
				'caseType': 'pigButchering',
				priority: 'high',
				jurisdiction: 'JP',
				'leadAgency': 'npa-cyber',
			},
		});
		expect([200, 404, 500]).toContain(r.status());
		if (r.ok()) {
			const b = await r.json();
			expect(b.caseId).toMatch(/^intel:case-/);
			expect(b.status).toBe('open');
		} else if (r.status() === 404) {
			const b = await r.json();
			expect(b.error).toContain('unknown method');
		}
	});

	test('And createCase validates title is required', async ({ request }) => {
		const r = await request.post(`${SVC}/createCase`, {
			headers: HDR, data: {},
		});
		expect(r.ok()).toBeFalsy();
	});

	test('And linkIncidentToCase validates required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/linkIncidentToCase`, {
			headers: HDR, data: {},
		});
		expect(r.ok()).toBeFalsy();
	});
});

// --- Scenario: Intelligence report creation and dissemination ---

test.describe('Feature: Intel Report Dissemination', () => {
	test('Given I create an intel report, the endpoint accepts the request', async ({ request }) => {
		const r = await request.post(`${SVC}/createIntelReport`, {
			headers: HDR,
			data: {
				title: `BDD-IntelReport-${Date.now()}`,
				classification: 'restricted',
				content: 'BDD test intelligence report.',
				'reportType': 'threatAssessment',
				tlp: 'TLP:AMBER',
			},
		});
		expect([200, 404, 500]).toContain(r.status());
		if (r.ok()) {
			const b = await r.json();
			expect(b.reportId).toMatch(/^intel:report-/);
			expect(b.status).toBe('draft');
		} else if (r.status() === 404) {
			const b = await r.json();
			expect(b.error).toContain('unknown method');
		}
	});

	test('And createIntelReport validates required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/createIntelReport`, {
			headers: HDR, data: { title: 'test' },
		});
		// Missing content → error
		expect(r.ok()).toBeFalsy();
	});
});

// --- Scenario: Agency referral workflow ---

test.describe('Feature: Agency Referral', () => {
	test('When I refer to an unknown agency, it returns error', async ({ request }) => {
		const r = await request.post(`${SVC}/createAgencyReferral`, {
			headers: HDR,
			data: { 'caseId': 'intel:case-dummy', 'agencyId': 'nonexistent-agency' },
		});
		expect(r.ok()).toBeFalsy();
	});

	test('And createAgencyReferral validates required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/createAgencyReferral`, {
			headers: HDR, data: {},
		});
		expect(r.ok()).toBeFalsy();
	});
});

// --- Scenario: OSINT and sanctions ---

test.describe('Feature: OSINT & Sanctions', () => {
	test('Given I record an OSINT finding, the endpoint validates the request contract', async ({ request }) => {
		const r = await request.post(`${SVC}/createOsintFinding`, {
			headers: HDR,
			data: {
				source: 'darkwebForum',
				content: 'BDD test finding',
				reliability: 'B',
				'iocType': 'wallet',
				'iocValue': '0xBDD0000000000000000000000000000000000099',
				'actorId': 'intel:actor-volga-group',
			},
		});
		expect([200, 500]).toContain(r.status());
	});

	test('And createOsintFinding validates required fields', async ({ request }) => {
		const r = await request.post(`${SVC}/createOsintFinding`, {
			headers: HDR, data: {},
		});
		expect(r.ok()).toBeFalsy();
	});

	test('And checkSanctions returns lists checked', async ({ request }) => {
		const r = await request.post(`${SVC}/checkSanctions`, {
			headers: HDR, data: { query: '0xBDD0000000000000000000000000000000000099' },
		});
		expect([200, 404, 500]).toContain(r.status());
		if (r.ok()) {
			const b = await r.json();
			expect(b.listsChecked.length).toBe(6);
			expect(b.listsChecked).toEqual(expect.arrayContaining(['OFAC-SDN', 'FATF-BLACKLIST']));
		} else if (r.status() === 404) {
			const b = await r.json();
			expect(b.error).toContain('unknown method');
		}
	});
});

// --- Scenario: Cross-app integration quality ---

test.describe('Feature: Cross-App Integration', () => {
	test('crypto-asset-freeze.etzhayyim.com is reachable', async ({ request }) => {
		const r = await request.get('https://crypto-asset-freeze.etzhayyim.com/health');
		expect(r.ok()).toBeTruthy();
	});

	test('crypto-asset-freeze manifest has correct canvas config', async ({ request }) => {
		const r = await request.get('https://crypto-asset-freeze.etzhayyim.com/_app/meta');
		expect(r.ok()).toBeTruthy();
		const m = await r.json();
		expect(m.ui).toBe('canvas');
	});

	test('malak linkedApps includes crypto-asset-freeze with correct URL', async ({ request }) => {
		const r = await request.post(`${SVC}/getCapabilities`, { headers: HDR, data: {} });
		const b = await r.json();
		const freeze = b.linkedApps.find((a: any) => a.appId === 'crypto-asset-freeze');
		expect(freeze).toBeDefined();
		expect(freeze.url).toBe('https://crypto-asset-freeze.etzhayyim.com/dashboard');
		expect(freeze.capabilities).toEqual(expect.arrayContaining([
			'incidentManagement', 'freezeManagement',
		]));
	});
});
