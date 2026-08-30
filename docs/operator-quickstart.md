# Operator quickstart — malak

Written and walked 2026-08-30 against `d8665c6`. Every command below was run
verbatim and the transcripts are the real output, not illustrations. If a step
here stops working, that is a finding — say so rather than editing the step to
match.

## 0. What this repository is, and what it is not

`git log` has one commit, `chore: extract app repository`. `migration.edn` names
where it came from: `60-apps/etzhayyim-project-malak` at source revision
`011cf6e383bd5abaaef9fc26bfd446190bb361fa` of `etzhayyim/root`.

`README.md` describes twelve MCP methods, a three-repository publishing pipeline
and a Matrix-coordinated agent team. **None of that lives here.** What was
extracted into this repository is the *edge* tier only:

| Path | What it is | Runs today? |
|---|---|---|
| `appview/etzhayyim-wasm-malak-m4l4k001/src/app.ts` | Cloudflare Worker facade, 204 lines, **zero imports** — health, four refusal gates, dispatcher proxy | **yes**, see §1 |
| `appview/etzhayyim-wasm-malak-m4l4k001/svelte/` | SvelteKit front end | no — §4 |
| `appview/etzhayyim-wasm-malak-m4l4k001/e2e/` | Playwright suite aimed at the live site | no — §4 |
| `docs/`, `PROJECT.jsonld`, `README.*` | description of the wider operation | reading only |

The worker tells you itself that the domain logic is elsewhere: `/health`
returns `businessLogic:
40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/primitives/malak.py`,
a path in another tree. Do not go looking for it in this repository.

## 1. The one thing that runs, with no install at all

`src/app.ts` imports nothing. Node ≥ 23 strips TypeScript types on the way in,
so the worker module loads directly — no `npm install`, no bundler, no
`wrangler`. Walked on Node v26.7.0:

```bash
cd "$(git rev-parse --show-toplevel)/appview/etzhayyim-wasm-malak-m4l4k001"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
const {default: app} = await import("./src/app.ts");
const r = await app.fetch(new Request("https://malak.invalid/health"), {APP_NANOID: "m4l4k001"});
console.log(r.status, await r.text());
'
```

```
200 {"ok":true,"actor":"did:web:malak.etzhayyim.com","nanoid":"m4l4k001","execution":"edge-proxy+agentgateway-mcp+langserver","businessLogic":"40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/primitives/malak.py","bpmn":"etzhayyim-root/00-contracts/bpmn/com/etzhayyim/malak"}
```

`/healthz`, `/readyz` and `/_app/meta` answer identically. The host in the URL
is arbitrary — nothing resolves it; the worker only reads the path.

Drop `--disable-warning=...` and Node adds a `MODULE_TYPELESS_PACKAGE_JSON`
notice on stderr. It is noise about a missing `"type": "module"`, not a failure.

## 2. The four refusal gates, and how to see them refuse

`preflightGate` in `src/app.ts` blocks four NSIDs at the edge before anything
leaves the process. The comment above it cites `SAFETY_GATES §6` of a compliance
memo that was **not** extracted into this repository, so this table and the
source are the only description of the rules that you have here.

| NSID suffix | Gate | Refuses when |
|---|---|---|
| `queryPerson` | warrant required | neither `legalBasis.warrantRef` nor `legalBasis.enquiryRef` is a non-empty string |
| `exportSurveillanceEvidence` | two-stage approval | `supervisorDid` or `sectionChiefDid` missing |
| `registerAgencyProspect` | opt-in provenance | `optInSource` not in `{exhibition_list, lecture_host, referral, inbound}`, or `optInAt` missing |
| `sendAgencyOutreach` | business hours | outside 09:00–17:00 Asia/Tokyo Mon–Fri, unless `scheduleHint=nextBusinessHour` |

Run them:

```bash
cd "$(git rev-parse --show-toplevel)/appview/etzhayyim-wasm-malak-m4l4k001"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
const {default: app} = await import("./src/app.ts");
const P = "com.etzhayyim.apps.malak.";
const post = (n, b) => app.fetch(new Request("https://malak.invalid/xrpc/" + P + n, {method: "POST", body: JSON.stringify(b)}), {});
for (const [n, b] of [
  ["queryPerson", {}],
  ["exportSurveillanceEvidence", {supervisorDid: "did:web:supervisor.example"}],
  ["registerAgencyProspect", {optInSource: "scraped_list", optInAt: "2026-08-30T00:00:00Z"}],
  ["registerAgencyProspect", {optInSource: "referral"}],
  ["sendAgencyOutreach", {}],
]) { const r = await post(n, b); console.log(r.status, n, await r.text()); }
'
```

```
403 queryPerson {"status":"denied","error":"WARRANT_OR_ENQUIRY_REQUIRED: queryPerson is hard-gated at edge; provide legalBasis.warrantRef OR legalBasis.enquiryRef."}
403 exportSurveillanceEvidence {"status":"denied","error":"TWO_STAGE_APPROVAL_REQUIRED: exportSurveillanceEvidence requires both supervisorDid and sectionChiefDid."}
403 registerAgencyProspect {"status":"rejectedOptInSource","error":"optInSource must be one of [exhibition_list, lecture_host, referral, inbound]; got \"scraped_list\""}
403 registerAgencyProspect {"status":"rejectedOptInMissing","error":"optInAt is required"}
403 sendAgencyOutreach {"status":"rejectedOutsideHours","error":"Outside 09:00-17:00 JST weekdays; resubmit with scheduleHint=nextBusinessHour to queue."}
```

**The fifth line depends on your clock.** It was walked on a Sunday, so the
business-hour gate fired. Run it at 10:00 JST on a Tuesday and that request
passes the gate instead and behaves like §3. That is the gate working; it is
not a flaky step. The other four are clock-independent.

### 2a. Check that each gate refuses for the reason it names

Five 403s prove very little on their own — a facade that denied everything would
print the same shape. Give each gate exactly what it asks for and it must stop
refusing:

```bash
cd "$(git rev-parse --show-toplevel)/appview/etzhayyim-wasm-malak-m4l4k001"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
const {default: app} = await import("./src/app.ts");
const P = "com.etzhayyim.apps.malak.";
for (const [n, b] of [
  ["queryPerson", {legalBasis: {warrantRef: "SYNTHETIC-NOT-A-REAL-WARRANT"}}],
  ["exportSurveillanceEvidence", {supervisorDid: "did:web:supervisor.example", sectionChiefDid: "did:web:chief.example"}],
  ["registerAgencyProspect", {optInSource: "referral", optInAt: "2026-08-30T00:00:00Z"}],
  ["sendAgencyOutreach", {scheduleHint: "nextBusinessHour"}],
]) {
  try { const r = await app.fetch(new Request("https://malak.invalid/xrpc/" + P + n, {method: "POST", body: JSON.stringify(b)}), {});
        console.log("gate-passed", n, r.status, (await r.text()).slice(0, 120)); }
  catch (e) { console.log("gate-passed", n, "-> dispatcher", String(e.cause?.code ?? e.message)); }
}
'
```

```
gate-passed queryPerson -> dispatcher ENOTFOUND
gate-passed exportSurveillanceEvidence -> dispatcher ENOTFOUND
gate-passed registerAgencyProspect -> dispatcher ENOTFOUND
gate-passed sendAgencyOutreach -> dispatcher ENOTFOUND
```

Every gate handed the request onward, so each of the 403s in §2 came from the
rule it named rather than from a blanket denial. The identifiers above are
deliberately synthetic and nothing acts on them: the request dies at DNS (§4),
so this check cannot cause a lookup, an export or an outreach. **Do not
substitute real warrant, approval or subject identifiers to "make it work."**
Reaching the dispatcher is not the goal of this step; being let go by the gate
is, and `ENOTFOUND` is the evidence.

Two more paths worth knowing, neither of them a gate:

```
400  POST /xrpc/com.etzhayyim.apps.malak.queryPerson with body "{oops"  -> {"error":"InvalidJson"}
404  GET  /nope with no ASSETS binding                                  -> {"error":"NotFound","message":"did:web:malak.etzhayyim.com not found"}
```

An NSID outside the four gated names is proxied unexamined. The gate list is
allow-by-default: only those four are inspected here.

## 3. Where the edge tier stops

Past a gate the worker POSTs to `DISPATCHER_URL`, defaulting to
`https://dispatcher.etzhayyim.com`. That host does not resolve (§4), so a
gate-passing request raises `TypeError` with cause `ENOTFOUND`. The worker has
no catch around `proxyToDispatcher`, so in production this surfaces as a
Worker exception rather than a 5xx body — worth knowing before you change
anything here.

**The gates are the whole of what this repository can still demonstrate.**
Everything behind them was extracted elsewhere.

## 4. What does not run — measured, not assumed

**The deployment is gone.** `wrangler.jsonc` routes `malak.etzhayyim.com/*` and
`m4l4k001.etzhayyim.com/*`; neither has a DNS record, nor do the two hosts the
worker talks to:

```bash
for h in etzhayyim.com malak.etzhayyim.com m4l4k001.etzhayyim.com mcp.etzhayyim.com dispatcher.etzhayyim.com; do
  printf '%-28s %s\n' "$h" "$(dig +short "$h" | head -1)"
done
```

```
etzhayyim.com                104.21.51.111
malak.etzhayyim.com
m4l4k001.etzhayyim.com
mcp.etzhayyim.com
dispatcher.etzhayyim.com
```

The apex has two Cloudflare A records (`104.21.51.111` and `172.67.179.128`) and
`head -1` shows whichever the resolver returns first, so that one line varies
between runs. The four blank lines are the finding: the apex resolves and none
of the four service hosts do, which makes this a missing deployment rather than
a lapsed domain.

**The SvelteKit front end cannot be installed.** `svelte/package.json` depends on
`@etzhayyim/design-system` and `@etzhayyim/vite-plugin-safe-builder` at
`workspace:*`, and the extraction did not bring a `pnpm-workspace.yaml`, a
lockfile or a root `package.json` — there is no workspace above this repository
either. `pnpm install` (10.26.2) stops immediately:

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In : "@etzhayyim/design-system@workspace:*" is in the dependencies
but no package named "@etzhayyim/design-system" is present in the workspace
```

So `pnpm build` and therefore `wrangler deploy` are both unreachable:
`wrangler.jsonc` points `main` at `svelte/.svelte-kit/cloudflare/_worker.js`, a
build output, not at `src/app.ts`. Publishing this repository as it stands is
not possible, and that is the honest state — not a step someone forgot.

**The Playwright suite has no target.** `e2e/playwright.config.ts` reads
`MALAK_BASE_URL` and falls back to `https://malak.etzhayyim.com`, the host that
does not resolve. `health.spec.ts`, `card-api.spec.ts`, `cypher-crud.spec.ts`,
`bdd-quality.spec.ts` and `visual.spec.ts` cannot pass against the default, and
the two checked-in screenshots under
`e2e/tests/visual.spec.ts-snapshots/` are of a site that is no longer served.
Point `MALAK_BASE_URL` at something real before drawing any conclusion from a
run of that suite; a red suite here means "no target", not "regression".

## 5. If you are going to change the gate logic

There is no local test suite in this repository — the maturity scan reads
`test/` at the top level and finds nothing, and the Playwright specs are §4's
problem. Until one exists, §2 plus §2a **is** the check: run both blocks before
and after your change and compare the transcripts. A change that leaves §2
identical and §2a identical has not been exercised by anything.

Both blocks are self-contained and take under a second. Neither needs the
network, a Cloudflare account, or a single installed package.

## 6. Getting the rest of the operation

The MCP methods, the publishing pipeline and the ISCO team in `README.md` are
descriptions of a system whose code is not here. `migration.edn` gives the
coordinate to look at — `60-apps/etzhayyim-project-malak` in `etzhayyim/root`
at `011cf6e383bd5abaaef9fc26bfd446190bb361fa`. Read `README.md` as a statement of
intent for that system, not as a description of this checkout.
