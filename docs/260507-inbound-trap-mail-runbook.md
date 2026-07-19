# Malak Inbound Trap Mail Runbook

Date: 2026-05-07
Status: Operational

## Scope

This runbook covers the owned inbound-only email trap used by Malak for
defensive CTI evidence collection.

Active trap:

```text
trap-email-malak-spamtrap-primary@etzhayyim.com
```

Telnyx/SMS is intentionally not active in this phase.

## Flow

```text
owned sender / external inbound mail
  -> *@etzhayyim.com Cloudflare Email Routing catch-all
  -> etzhayyim-email-relay Worker email() handler
  -> PDS record:
     did:web:ml1nb0nd.etzhayyim.com / com.etzhayyim.apps.mailer.inboundEmail
  -> LaunchAgent com.etzhayyim.malak-trap-sync, every 300s
  -> vertex_malak_trap_message
```

`etzhayyim-email-relay` must send PDS write calls with both:

- `x-kotodama-verified: true`
- `x-etzhayyim-internal-hmac`, signed with Secrets Store `claim_settler_hmac`

Without the HMAC, PDS returns `401 AuthRequired`.

## Commands

Manual sync:

```bash
50-infra/launchd/malak-trap-sync.sh
```

Health:

```bash
50-infra/launchd/malak-trap-health.sh
```

Raw npm commands:

```bash
cd 30-graph/graph-schema
DATABASE_URL="$(security find-generic-password -s etzhayyim.rw -a ROOT_URL -w)" npm run -s malak:traps:sync
DATABASE_URL="$(security find-generic-password -s etzhayyim.rw -a ROOT_URL -w)" npm run -s malak:traps:health -- --strict
```

## Expected Health

Current verified state:

```json
{
  "status": "ok",
  "activeEmailTrapCount": 2,
  "pdsTrapInboundCount": 2,
  "evidenceCount": 2,
  "missingEvidenceCount": 0,
  "lagMs": 0
}
```

The active evidence rows are redacted/hash-first. This is expected because
inbound mailer records may store subject/body/to-local as encrypted or redacted
values.

## LaunchAgent

Label:

```text
com.etzhayyim.malak-trap-sync
```

Paths:

```text
50-infra/launchd/com.etzhayyim.malak-trap-sync.plist
50-infra/launchd/malak-trap-sync.sh
~/.etzhayyim/malak-trap-sync.log
~/.etzhayyim/malak-trap-sync.err
```

Verify:

```bash
launchctl print "gui/$(id -u)/com.etzhayyim.malak-trap-sync" | rg 'state =|last exit code|run interval|runs ='
```

## Safety Boundary

Do not actively register this address on phishing sites. Do not send outbound
messages to abuse teams, suspected actors, or external services from this trap
without a separate legal/abuse review. This phase is receive-only.
