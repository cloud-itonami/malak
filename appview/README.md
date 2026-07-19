# etzhayyim-project-malak App migration

このディレクトリは `legacy-runtime` 実装を残したまま、App 版を段階移行するための配置先です。

## 対象 App services

- `operation-malak-om7q8r9s`

## App 実装方針

- 各 service は `projects/*/wasm/*-component` として順次実装。
- 既存 App runtime は互換運用のため維持。
- HTTP/cron/job エンドポイントから優先して移植。

## 実装済みコンポーネント

- `malak-mcp-component` (`operation-malak-om7q8r9s` 対応)
  - `POST /xrpc`, `POST /{nanoid}/xrpc`
  - `GET /status` で運用状態を参照可能
  - `GET /...` で静的フロント (`svelte/build`) を配信
