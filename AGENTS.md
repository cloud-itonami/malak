# etzhayyim-project-malak — Cybercrime Intelligence Platform

**malak.etzhayyim.com** — サイバー犯罪者追跡・捜査機関情報提供プラットフォーム (sensitivity: confidential)

## Capability Clusters

malak は以下 2 つの capability cluster で構成される:

| Cluster | NSID prefix | sensitivity | 用途 |
|---|---|---|---|
| **Core** (cybercrime intel) | `com.etzhayyim.apps.malak.{registerThreatActor,createThreatOrg,linkWalletToActor,queryRiskChain,exportStixBundle,draftAgencyReferral,reviewAgencyReferralDraft,exportAgencyReferralPackage,buildAgencyReferralEvidenceBundle,draftPoliceReport,registerPhishingTrapInbox,ingestTrapMessage,runInvestigationTick,getDashboard,getThreatGraph,listThreatActors,listWallets,listAgencyReferralDrafts,listAgencyReferralExports}` | TLP:AMBER/RED | 既存 — ThreatActor/WalletAddress/IntelReport graph + AgencyReferral + INTERPOL 通報 |
| **Surveillance** (formerly mehikari) | `com.etzhayyim.apps.malak.{registerCamera,ingestSurveillanceClip,queryScene,queryPerson,reviewSurveillanceMatches,exportSurveillanceEvidence,listSurveillanceQueries,getSurveillanceAuditTrail}` + `{registerAgencyProspect,draftAgencyOutreach,reviewAgencyOutreach,sendAgencyOutreach,handleAgencyOutreachReply,unsubscribeAgencyOutreach,listAgencyOutreach}` | TLP:RED (face template ciphertext) / TLP:AMBER (outreach) | 監視カメラ シーン/人物検索 + 国際 LEA への B2G 営業 (2026-05-13 統合) |

詳細: `_working/malak/surveillance/` 配下の DESIGN.md / COMPLIANCE-MEMO.md / LEAD-PIPELINE-SEED.md / MURAKUMO-DOMESTIC-CONSTRAINT.md / langgraph_agency_outreach.py。

### Surveillance cluster — 不変条件 (CRITICAL)

1. **顔特徴量は murakumo on-prem (国内 GPU) のみ。** RunPod (US-KS-2) は text-only LLM (gemma-4-26B-A4B-it) 経由でシーン query / 営業 draft に限定。詳細: `_working/malak/surveillance/MURAKUMO-DOMESTIC-CONSTRAINT.md`
2. **person query は legalBasis (warrantRef OR enquiryRef) 必須**。`queryPerson` は edge worker 段階で hard-reject (Lexicon + app.ts 二重ゲート)
3. **outreach の opt-in source は 4 種限定** (`exhibition_list` / `lecture_host` / `referral` / `inbound`)。`registerAgencyProspect` で wire-level enforce
4. **outreach 送信は 09:00-17:00 JST 平日のみ** + sales-manager 承認必須 (consent helper)
5. **国際スコープ**: INTERPOL 196 加盟国を `60-apps/etzhayyim-project-states/data/gov/{cc}/lea.ndjson` で seed。`cooperation_status=restricted/prohibited` の国 (CHN/RUS/IRN/SYR/BLR/MMR/LBY/YEM/AFG ほか) は outreach 対象から hard-exclude
6. **JPN 警察組織** (47 都道府県警 + 警察庁 7 内部局 + 海保 + 11 管区 + JC3) は専用 ndjson (`jpn/ministry.ndjson` + `jpn/prefectural-police.ndjson` + `jpn/public-safety-partners.ndjson`)
7. **RW schema** = `vertex_malak_surveillance_*` prefix (migration `30-graph/graph-schema/migrations/20260513140000_vertex_malak_surveillance_lea_org.ts`)

### Surveillance cluster — Phase gates

| Phase | 状態 |
|---|---|
| Phase 0 (法務 + 設計) | **進行中 (2026-05)** — Kunal CLO triage 期限 2026-06-01、外部弁護士契約 2026-07-15 |
| Phase 1 (警察庁照会 + INTERPOL 接触) | 法務クリア後 |
| Phase 2 (神奈川/大阪/福岡パイロット) | Phase 1 成果次第 |
| Phase 3 (JC3 共同調達 hub) | Phase 2 成功時 |
| Phase 4 (47 都道府県 + INTERPOL 加盟国 段階展開) | 入札参加 |


## Architecture

| 項目 | 値 |
|---|---|
| nanoid | `m4l4k001` |
| URL | `https://malak.etzhayyim.com` / `https://m4l4k001.etzhayyim.com` |
| Runtime | Worker WASM (default) |
| UI mode | appview |
| Sensitivity | **confidential** — TLP:AMBER default, auth required |
| Service path | `/etzhayyim.malak.v1.MalakService` |

## Sensitivity Rules

- **Space joinRule**: `invite` (not public)。全チャンネルへのアクセスは招待制
- **Access Audit**: 全 read/write 操作に `malak_access_log` record を自動記録
- **TLP Classification**: resource type 別に TLP:RED (cases/referrals) ～ TLP:AMBER (actors/reports) を自動付与
- **Clearance Enforcement**: `enforce_classification` で caller clearance vs resource sensitivity を検証
- **Cross-Project Follow**: yabai (risk intelligence) + ipaddress (IP intel) から enrichment を受信
- **INTERPOL Notice**: DecisionClassA (3承認, high) — 最高 governance gate
- **Freeze Escalation**: DecisionClassA (3承認, high) — 暗号資産凍結は最高レベル

## Graph Schema

| Node Label | ID Prefix | 用途 |
|---|---|---|
| `ThreatActor` | `intel:actor-` | サイバー犯罪者プロファイル |
| `WalletAddress` | `intel:wallet-` | ブロックチェーンアドレス |
| `IntelReport` | `intel:report-` | 情報レポート (TLP 分類) |
| `CyberCrimeCase` | `intel:case-` | 捜査案件 |
| `InterpolNotice` | `intel:notice-` | INTERPOL 通報 (Red/Blue/Green/Purple) |
| `AgencyReferral` | `intel:ref-` | 捜査機関への情報提供 |
| `OsintFinding` | `intel:osint-` | OSINT 収集結果 |
| `SanctionEntry` | — | 制裁リストエントリ |
| `FreezeEscalation` | `intel:esc-` | crypto-asset-freeze へのエスカレーション |
| `IncidentLink` | `intel:link-` | 外部インシデントへのリンク |
| `ThreatOrganization` | `intel:org-` | 犯罪組織・APT グループ (type: apt/cybercrime/cartel/fraud_ring/hacktivist/state_sponsored) |
| `EmailMessage` | `intel:email-` | メール intelligence (phishing/spear-phishing/BEC 分析。SPF/DKIM/DMARC 結果付き) |
| `ActorAlias` | `intel:alias-` | アクター別名 (forum handle, marketplace name, chat ID) |
| `ActorInfrastructure` | `intel:infra-` | アクター管理インフラ (domain/IP/server/VPN/proxy/C2) |
| `AccessLog` | `intel:log-` | アクセス監査ログ (view/modify/export/share) |
| `PhishingTrap` | `trap-email-*` / `trap-sms-*` | Owned inbound-only trap inbox / SMS endpoint registration |
| `TrapMessage` | `trapmsg-*` | Trap-originated evidence. Stores provider id, hashes, redacted preview, TLP, and PDS reference |

| Edge | 意味 |
|---|---|
| `CONTROLS_WALLET` | ThreatActor → WalletAddress |
| `REPORTS_ON` | IntelReport → ThreatActor |
| `INVESTIGATES` | CyberCrimeCase → ThreatActor |
| `INCLUDES_INCIDENT` | CyberCrimeCase → IncidentLink |
| `TARGETS` | InterpolNotice → ThreatActor |
| `REFERRED_FOR` | AgencyReferral → CyberCrimeCase |
| `OSINT_FOR` | OsintFinding → ThreatActor |
| `ESCALATION_FOR` | FreezeEscalation → ThreatActor |
| `MEMBER_OF` | ThreatActor → ThreatOrganization (role: leader/member/affiliate/contractor) |
| `SENT_BY` | EmailMessage → ThreatActor (attribution) |
| `TARGETS_BRAND` | EmailMessage → (brand target) |
| `KNOWN_AS` | ThreatActor → ActorAlias |
| `CONTROLS_INFRA` | ThreatActor → ActorInfrastructure |
| `OPERATED_BY` | ThreatOrganization → ThreatActor (leadership) |

## Inbound-Only Trap Evidence

Malak currently has an owned email-only trap path for defensive CTI:

```
trap-email-malak-spamtrap-primary@etzhayyim.com
  → Cloudflare Email Routing catch-all
  → etzhayyim-email-relay Worker
  → PDS did:web:ml1nb0nd.etzhayyim.com / com.etzhayyim.apps.mailer.inboundEmail
  → launchd sync every 5 min
  → vertex_malak_trap_message
```

Operational commands:

```bash
# one-shot sync, idempotent
50-infra/launchd/malak-trap-sync.sh

# health/status, strict nonzero on degraded
50-infra/launchd/malak-trap-health.sh
```

LaunchAgent:

```text
com.etzhayyim.malak-trap-sync
interval: 300 seconds
stdout: ~/.etzhayyim/malak-trap-sync.log
stderr: ~/.etzhayyim/malak-trap-sync.err
```

Safety boundary: this is inbound-only. Do not actively register the address on
phishing sites or submit it to third-party abuse infrastructure without a
separate legal/abuse review. Telnyx/SMS is postponed; current active trap
coverage is email only.

## Path-Based DIDs

Threat actors and organizations as path-based DIDs:
```
did:web:malak.etzhayyim.com:org:lazarus_group         — Lazarus Group (DPRK APT)
did:web:malak.etzhayyim.com:org:conti                 — Conti Ransomware Group
did:web:malak.etzhayyim.com:org:lockbit               — LockBit RaaS
did:web:malak.etzhayyim.com:org:revil                 — REvil/Sodinokibi
did:web:malak.etzhayyim.com:org:apt28                 — APT28/Fancy Bear
did:web:malak.etzhayyim.com:org:apt29                 — APT29/Cozy Bear
did:web:malak.etzhayyim.com:actor:{slug}              — Individual threat actors
```

## Entity DID Collection Design

**エンティティ種別ごとの DID 作成・収集パターン:**

| エンティティ | DID パス | 収集方法 | Record Collection |
|---|---|---|---|
| 犯罪組織/APT | `org:{slug}` | `create_threat_org` → `DIDCreate("org:"+name)` | `malak_threat_organization` |
| 監視対象法人 | `entity:{slug}` | `register_monitored_entity` → `DIDCreate("entity:"+slug)` | `malak_monitored_entity` |
| メールアドレス | — (EmailMessage record) | `ingest_email_message` — from/to/cc, SPF/DKIM/DMARC, classification | `malak_email_message` |
| Telegram/フォーラム名 | — (ActorAlias record) | `register_actor_alias` — platform: forum/marketplace/social_media/chat/email | `malak_actor_alias` |
| サーバー/IP/ドメイン | — (ActorInfrastructure record) | `record_actor_infrastructure` — infra_type: domain/ip/server/vpn/proxy/c2 | `malak_actor_infrastructure` |
| 暗号通貨ウォレット | — (WalletAddress record) | `link_wallet_to_actor` → blockchain forensics | `malak_wallet_address` |
| ダークウェブ情報 | — (OsintFinding record) | Follow onion.etzhayyim.com (`0n10n001`) → `onOnionIntel()` | `malak_onion_intel` |

**DID vs Record の使い分け**: path-based DID (`DIDCreate`) は「独立した identity を持つ entity」(組織、監視対象法人) に使用。個別の indicator (メールアドレス、IP、alias) は ThreatActor/Organization に紐づく Record として graph edge で管理。

**ダークウェブ収集フロー**:
```
onion.etzhayyim.com (0n10n001) → .onion crawl → page/site/crawl record
  → ComAtprotoSyncSubscribeRepos → malak handleComAtprotoSyncSubscribeReposCommit
  → onOnionIntel() → malak_onion_intel record 作成
  → onEntityRelatedOsint() → monitored entities と自動 cross-correlation
  → malak_entity_correlation record 作成
```

**Attribution confidence thresholds**:
- Agency referral: ≥ 0.70
- INTERPOL notice: ≥ 0.80
- Freeze escalation: ≥ 0.85
- Blockchain trace request: ≥ 0.70

## Cross-actor Integration (Invoke)

| 連携先 | Interface | 用途 |
|---|---|---|
| crypto-asset-freeze.etzhayyim.com (`qjp7mjyb`) | `incident-management` | インシデント作成 |
| crypto-asset-freeze.etzhayyim.com (`qjp7mjyb`) | `freeze-management` | 取引所凍結要請 |
| crypto-asset-freeze.etzhayyim.com (`qjp7mjyb`) | `forensic` | ブロックチェーン追跡 |
| lawfirm.etzhayyim.com | `case-management` | 法的案件作成 (agency referral 時自動) |
| sanctions.etzhayyim.com (`sn4c8t1x`) | `ScreenEntity` | OFAC/EU/UN/JP-MOF 制裁リスト照会 |
| interpol entity (`001a6802`) | `execute_task` | INTERPOL notice 提出 |

## Follow-Based Input (reactive pipeline)

| Source | nanoid | Collections | 用途 |
|---|---|---|---|
| yabai.etzhayyim.com | `y8b41k0x` | `entity`, `alert` | Risk intelligence enrichment |
| ipaddress.etzhayyim.com | `n7w1p4d0` | `ip_address`, `ip_analysis` | IP/ASN intelligence |
| sanctions.etzhayyim.com | `sn4c8t1x` | `entry`, `match` | 制裁リスト更新 + match alert |
| onion.etzhayyim.com | `0n10n001` | `page`, `crawl`, `site` | Dark web .onion intelligence |
| INTERPOL entity | `001a6802` | `interpol.intelligence.sharing` | INTERPOL intelligence updates |
| C2ISR OSINT | `atdcxtvm` | `defense.c2isr` | AlienVault/VirusTotal/Shodan IOC |

## Event-Driven Entity Monitoring (Design E)

**ハードコード禁止。全エンティティ登録・分析は AT Protocol event stream で実行。**

```
1. XRPC: register_monitored_entity → ComAtprotoRepoCreateRecord("malakMonitoredEntity")
   → Pipeline → ComAtprotoSyncSubscribeRepos
   → onMonitoredEntityCreated() → auto sanctions screening + social post

2. Follow sources → commit arrives
   → onEntityRelatedOsint() → monitored entities と自動 cross-correlation
   → ComAtprotoRepoCreateRecord("malakEntityCorrelation")

3. XRPC: run_entity_analysis → sanctions cross-actor + threat actors + phishing + darkweb
   → ComAtprotoRepoCreateRecord("malakEntityAnalysis") → risk score
```

**登録例 (XRPC):**
```
POST /xrpc/com.etzhayyim.apps.malak.registerMonitoredEntity
{
  "name": "アサヒビール",
  "entity_type": "corporation",
  "country": "jpn",
  "industry": "beverages",
  "domains": "asahibeer.co.jp,asahigroup-holdings.com",
  "brand_keywords": "アサヒビール,asahi beer,アサヒスーパードライ"
}
```

## Connected Agencies (16)

International: INTERPOL, Europol EC3, FATF
US: FBI IC3, USSS ECTF, SEC
JP: 警察庁サイバー局, 警視庁サイバー犯罪対策課, 神奈川県警, 金融庁
UK: NCA NCCU
DE: BKA SO43
AU: AFP/ACSC
CA: RCMP NC3
SG: SPF CID
KR: 경찰청 사이버수사국

## Protocol Canvas Routes

| Tab | Handler / Source | 内容 |
|---|---|---|
| live | `malak.dashboard` | App canvas UI (メトリクスダッシュボード + cards) |
| talk | AppShell v2 shared | W Protocol chat (全 app 共通、app 固有 handler 不要) |
| vibes | Space public channels | Threat Intel, OSINT Feed, Tips (公開 channel) |
| provider | murakumo | LLM (AppShell v2 shared murakumo.etzhayyim.com) |
| apps | `malak.tools` | ツール・連携アプリ一覧 |

**Note**: `talk` と `provider` は AppShell v2 共通基盤。conversation は `Invoke/Handle (conversation dispatch removed)` で受信。
