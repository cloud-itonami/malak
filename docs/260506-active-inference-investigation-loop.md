# Malak Active Inference Investigation Loop

Date: 2026-05-06
Status: Implemented phase 1

## Purpose

Malak needs a continuous cybercrime intelligence loop that connects existing
Yabai telemetry, Malak threat actor graphs, blockchain risk signals, and agency
referral workflows without creating an unbounded or unaudited surveillance
system.

This design implements a bounded Active Inference tick:

1. Observe the current actor graph and recent evidence.
2. Convert the observation into candidate investigation actions.
3. Score candidates with expected free energy.
4. Select a next action only when safety and governance gates pass.
5. Persist the tick for audit.
6. Draft agency referral packets only after a separate explicit request.

No command in this phase sends data to an external agency. Agency coordination
is draft-only and requires legal basis, approval reference, TLP classification,
and evidence identifiers.

## Safety Model

The loop is allowed to handle defensive cyber intelligence, public OSINT,
customer-provided evidence, blockchain address correlations, and abuse desk
coordination. It must not perform unauthorized access, credential collection,
covert persistence, invasive device fingerprint expansion, or automated
accusatory disclosure.

Controls:

- `maxIterations` is capped at the command boundary.
- `legalBasis` is required for referral draft creation.
- `approvalRef` is required for referral draft creation.
- `attributionConfidence` is bounded to 0.0-1.0.
- Agency referrals require `attributionConfidence >= 0.70`.
- INTERPOL notice preparation remains a separate DecisionClassA path.
- All outputs are persisted as audit records before any external effect.

## Data Model

`vertex_malak_investigation_tick`

One row per Active Inference investigation tick. It stores the actor, inputs,
candidate actions, expected free energy decomposition, selected action, rejected
actions, governance gate result, and timestamp.

`vertex_malak_agency_referral_draft`

One row per draft referral package. It stores agency, case, actor, legal basis,
approval reference, evidence identifiers, TLP, confidence, summary, payload hash,
and draft state.

`vertex_malak_phishing_trap`

Owned inbound-only trap registrations. The current live trap is email-only under
`etzhayyim.com`; Telnyx/SMS remains postponed.

`vertex_malak_trap_message`

Trap-originated evidence rows. The mailer relay stores inbound email in PDS
first, then `malak-trap-sync` backfills matching trap messages into this table
using provider message ids and stable hashes. Encrypted inbound email remains
redacted in Malak evidence; the promoted fields carry hashes, provider ids, TLP,
and PDS references.

## Commands

`com.etzhayyim.apps.malak.runInvestigationTick`

Scores candidate investigation actions. If no candidates are supplied, the app
derives conservative defaults:

- `collect_evidence`: gather more evidence when confidence is low.
- `enrich_infrastructure`: enrich actor infrastructure and linked wallets.
- `draft_agency_referral`: prepare a draft only when confidence and approval
  are already present.

`com.etzhayyim.apps.malak.draftAgencyReferral`

Creates a referral draft. It does not send email, submit an INTERPOL notice, or
call an external agency API. The draft can be reviewed, exported, and routed
through a later DecisionClassA/DecisionClassB approval process.

## BPMN

`etzhayyim-root/00-contracts/bpmn/com/etzhayyim/malak/runInvestigationTick.bpmn`

The BPMN version mirrors the app command:

1. Evaluate expected free energy through `agent.evaluateExpectedFreeEnergy`.
2. Insert the tick into `vertex_malak_investigation_tick`.
3. Emit `malak.investigation.tick` audit.

The BPMN is seeded by
`20260506190000_seed_malak_active_inference_loop_bpmn.ts`.

`etzhayyim-root/00-contracts/bpmn/com/etzhayyim/malak/draftAgencyReferral.bpmn`

Records a draft-only referral package through dispatcher/BPMN. It computes a
stable JSON SHA-256 payload hash with `generic.hash.json`, inserts
`vertex_malak_agency_referral_draft`, and emits
`malak.agencyReferral.drafted`. This keeps the BPMN route aligned with the app
command route: both create reviewable drafts and neither performs external
submission.

## Trap Evidence Sync

The trap pipeline is operational and bounded:

```text
trap-email-malak-spamtrap-primary@etzhayyim.com
  -> Cloudflare Email Routing
  -> etzhayyim-email-relay
  -> did:web:ml1nb0nd.etzhayyim.com / com.etzhayyim.apps.mailer.inboundEmail
  -> vertex_malak_trap_message
```

Local operations:

```bash
50-infra/launchd/malak-trap-sync.sh
50-infra/launchd/malak-trap-health.sh
```

`com.etzhayyim.malak-trap-sync` is installed as a LaunchAgent with a 300 second
interval. Health checks require zero missing evidence rows between recent PDS
trap records and `vertex_malak_trap_message`.

Safety boundary: no active registration on phishing sites and no outbound abuse
interaction. The trap accepts owned inbound mail only. Agency referral remains
draft-only and still requires approval references and legal basis.
