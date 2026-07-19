# malak-mcp-component

`60-apps/etzhayyim-project-malak/legacy-runtime/operation-malak-om7q8r9s` の App 版コンポーネントです。

## Endpoints

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /status`
- `POST /xrpc`
- `POST https://{nanoid}.etzhayyim.com/xrpc`
- `GET /...` (static frontend from `svelte/build`)

## MCP tools

- `TriggerMalakMonitoring`
- `ListIdentifiedActors`
- `ManualBlockchainDisclosure`
- `RegisterFaceTrackerCamera`
- `UpsertFaceWatchlistPerson`
- `ReportFaceMatchSignal`
- `ListFaceTrackerAlerts`
- `GetFaceTrackerStatus`
- `PublishGitHubNote`
- `GetPublishedNotes`
- `PublishIntelNote`
- `GetStatus`

## Notes

- Temporal/legacy runtime 依存を除去し、状態は Cypher graph に永続化します。
- 顔追跡アラートは誤検知抑制のため、30秒内3件以上かつ confidence >= 0.85 の一致で昇格します。
