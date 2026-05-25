# Implementation Tasks — All Phases Complete

## Phase 1 — Foundation (DONE)
- Monorepo, Prisma schema with init migration, 4-tier auth with rotating refresh
  cookies, Evolution API + webhooks, Socket.io realtime, BullMQ queues, inbox UI

## Phase 2 — AI + CRM (DONE)
- Claude Sonnet 4 + RAG with pgvector, Sarvam voice transcription
- AI agents, knowledge bases, pipelines, deals kanban, activity timeline

## Phase 3 — Automation (DONE)
- Visual flow builder (React Flow canvas) + 13-node executor
- Campaign broadcasts with throttled BullMQ delivery
- 8 vertical templates with one-click bootstrap

## Phase 4 — Platform (DONE)
- Email infrastructure (Resend) + password reset + email verify + MFA OTP
- Razorpay billing with webhook signature verification, subscription state
  machine, plan-limit enforcement, usage tracking
- Custom domain CNAME with Caddy on-demand TLS

## Phase 5 — Integrations + Polish (DONE in this session)

### Third-party OAuth integrations
- [x] **Shopify** OAuth with HMAC verification on callback, customer + order
      lookup by phone
- [x] **Google Calendar** OAuth with refresh-token rotation, event creation API
- [x] **Zoho CRM** OAuth (token exchange, api domain stored on metadata)
- [x] **Tally** API-key connection (no OAuth)
- [x] **AES-256-GCM encryption at rest** for all OAuth credentials
- [x] **Signed OAuth state** (HMAC-SHA256, 10-min TTL) to prevent CSRF
- [x] Web UI: connect/disconnect cards for each provider with live status

### Mobile PWA
- [x] `manifest.webmanifest` with icons + theme color
- [x] Service worker (`/sw.js`) with cache-first for static, network-first for HTML,
      offline fallback page
- [x] Mobile-responsive sidebar with hamburger toggle
- [x] Apple Web App meta tags

### Analytics aggregation UI
- [x] `/analytics/overview` — inbound/outbound counts, AI %, conversations,
      contacts, deals (won/lost/revenue/win rate), campaigns
- [x] `/analytics/messages-by-day` — bucketed daily counts via raw SQL
- [x] `/analytics/agents` — team performance leaderboard
- [x] Web UI: stat tiles + inline SVG line chart + team table, time-window picker

### Presence + typing indicators
- [x] Socket.io gateway emits `presence:joined` / `presence:left` on
      `conversation:join` / `conversation:leave`
- [x] `typing` event relayed to other agents in the conversation room
- [x] Inbox UI: "Also viewing: <names>" banner + "<name> typing…" indicator
- [x] Throttled typing emit (1.5s debounce)

### CSV bulk contact import
- [x] `POST /contacts/import` accepts raw CSV text
- [x] Tolerates BOM, quoted fields with commas/newlines, doubled quotes
- [x] Header column aliases (phone/mobile/number, name/full name, etc.)
- [x] Idempotent upsert on (clientId, phone), tag merge
- [x] Returns `{ total, created, updated, skipped, errors[] }` for UI feedback
- [x] Web UI: file picker + downloadable template + result summary

### Quick replies
- [x] `QuickReply` model with per-client unique shortcut
- [x] Full CRUD endpoints
- [x] Inbox composer: `/shortcut<space>` auto-expands, picker dropdown when
      composer starts with `/`, dedicated quick-reply button
- [x] Web UI: management page

## Build verification

- `prisma validate` ✓
- `pnpm --filter @diyaa/api build` ✓ (32 modules)
- `pnpm --filter @diyaa/web build` ✓ (26 routes)
- `pnpm --filter @diyaa/api test` ✓

## Nothing remaining

Every feature listed in the original master prompt is implemented and compiling.
