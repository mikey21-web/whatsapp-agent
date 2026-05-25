# diyaa.ai — WhatsApp AI SaaS Platform

Multi-tenant, white-label WhatsApp AI automation platform for Indian SMBs.
Production-grade implementation of the original spec, including the visual flow
builder, billing with plan enforcement, custom domain CNAME, and full email
flows.

---

## What's working

### Core
- 4-tier auth (SuperAdmin / Agency / Client / TeamMember)
- JWT access + rotating refresh cookies with token-family revocation on reuse
- Redis-backed rate limiting on login routes
- Helmet, CORS lockdown, env validation, graceful shutdown
- Health/readiness endpoints

### WhatsApp
- Evolution API client with instance lifecycle (create, QR, status)
- Webhook ingest with apikey verification and idempotency
- Real-time inbox via Socket.io
- Outbound send via BullMQ with retry/backoff

### AI
- Claude Sonnet 4 conversation agent with system prompt + RAG
- OpenAI embeddings + pgvector cosine search (ivfflat ANN index)
- Knowledge base CRUD with chunking (1500 chars, sentence boundaries, 200 overlap)
- Sarvam voice transcription (Hindi, Telugu, Tamil, +)
- Per-conversation AI on/off toggle

### CRM
- Multiple pipelines per client with kanban board
- Deals with stage moves, won/lost, activity timeline
- Notes on deals
- Auto-logged activity for every meaningful event

### Automation
- **Visual Flow Builder**: React Flow canvas, 11 node types, drag-drop, inspector
  panel for node config, save draft / save & activate
- 13 backend node kinds: TRIGGER, SEND_MESSAGE, CONDITION, DELAY, ADD_TAG,
  REMOVE_TAG, ASSIGN, AI_RESPOND, WEBHOOK, CREATE_DEAL, MOVE_DEAL_STAGE,
  UPDATE_CONTACT, END
- 6 trigger types: INBOUND_MESSAGE, KEYWORD (exact/contains/regex), NEW_CONTACT,
  DEAL_STAGE_CHANGE, SCHEDULED, WEBHOOK
- Inbound worker invokes flow executor with proper variable substitution

### Campaigns
- Broadcast campaigns with tag-filtered recipient selection
- Throttled BullMQ delivery (5 msgs/sec/campaign)
- Template variables (`{{ name }}`, `{{ phone }}`)
- Per-campaign delivery counters
- Draft → Sending state machine

### Vertical Templates
- Real Estate, Clinic, Coaching, D2C, Hospitality, Education, Finance, General
- Single API call seeds AI agent + pipeline + KB (auto-embedded) + starter flows

### Email
- Resend integration (graceful degradation: logs OTPs/links to console without API key)
- **Password reset** with 30-min tokens that revoke all sessions on success
- **Email verification** with 24h tokens
- **MFA OTP via email** (6 digits, 10min TTL, 5-attempt limit)
- Login flow returns `{ mfaRequired, challenge }` when MFA is enabled

### Billing (Razorpay)
- Subscription create / cancel / fetch via Razorpay API
- **HMAC-SHA256 webhook signature verification** (constant-time compare,
  raw-body captured by middleware)
- State machine: `TRIALING → ACTIVE → PAST_DUE (7-day grace) → CANCELLED`
- Auto-suspend agency after grace period expires
- **Plan limits enforced server-side** before action:
  - `assertCanAddClient` on client create
  - `assertCanAddNumber` on WhatsApp account create
  - `assertCanSendMessage` + `incrementMessages` on every outbound
- Per-agency, per-month `UsageRecord` with composite unique index
- Web billing page with live usage bars + plan picker

### Custom Domain
- Agency self-service domain registration with DNS validation endpoint
- **Caddy `on_demand_tls` ask endpoint** for automatic Let's Encrypt cert
  provisioning per registered custom domain
- Public `/domain/resolve` endpoint for branding lookup by host
- DNS verifier checks CNAME / A records against the apex

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, Tailwind, TanStack Query, Zustand, React Flow, Socket.io client |
| Backend | NestJS 10, Prisma 5, BullMQ, Socket.io |
| Database | Postgres 16 + pgvector + pgcrypto |
| Cache/Queue | Redis 7 |
| AI | Claude Sonnet 4, OpenAI embeddings, Sarvam STT |
| WhatsApp | Evolution API v2 |
| Email | Resend |
| Billing | Razorpay |
| Reverse proxy | Caddy with on-demand TLS |
| Auth | JWT + bcrypt + httpOnly rotating refresh cookies |

---

## Quickstart

```bash
# install
pnpm install

# env
cp .env.example .env
# fill JWT_*_SECRET (each min 32 chars), EVOLUTION_*, optional AI / Resend / Razorpay keys

# infra
docker compose up -d postgres redis

# generate prisma client
pnpm --filter @diyaa/db prisma:generate

# migrate (creates pgcrypto + vector + all 30 tables)
pnpm --filter @diyaa/db prisma:deploy

# seed first super admin (uses SUPERADMIN_BOOTSTRAP_* env)
pnpm --filter @diyaa/db prisma:seed

# dev (api on :3001, web on :3000)
pnpm dev
```

Open http://localhost:3000 and sign in as super admin.

### Production

```bash
docker compose up -d --build
# api auto-runs migrations on container start.
```

Caddy reverse-proxies platform domains and any registered custom domains via
on-demand TLS. See `Caddyfile`.

---

## Architecture highlights

### Auth + MFA flow

```
client → POST /auth/{role}/login (rate-limited)
  if mfaEnabled:
    server creates 6-digit OTP, emails it
    returns { mfaRequired: true, challenge }
  else:
    returns { accessToken, principal } + Set-Cookie: diyaa_rt

mfa: POST /auth/mfa/verify { challenge, code }
    → { accessToken, principal } + Set-Cookie: diyaa_rt

password reset: POST /auth/password/request-reset { email }
    → silent success (never leaks existence)
    → email with 30min reset link

verify email: POST /auth/email/verify { token }
    → marks emailVerifiedAt
```

### Inbound message pipeline

```
WhatsApp → Evolution API → POST /webhooks/whatsapp/:instanceName
  apikey verified
  → upsert Contact + Conversation + Message (idempotent)
  → emit Socket.io 'message.created'
  → enqueue BullMQ inbound job

inbound worker:
  → transcribe voice note via Sarvam (if applicable)
  → log MESSAGE_RECEIVED activity
  → run matching INBOUND_MESSAGE + KEYWORD flows
  → AI agent respond with RAG context
  → if reply: persist + emit + enqueue outbound

outbound worker:
  → assertCanSendMessage(agencyId)        ← plan limit check
  → Evolution API sendText
  → incrementMessages(agencyId)            ← usage tracking
  → emit + log MESSAGE_SENT activity
```

### Razorpay webhook flow

```
Razorpay → POST /webhooks/razorpay (raw body captured by body-parser middleware)
  → x-razorpay-signature verified via HMAC-SHA256 timing-safe equal
  → applyWebhook(event):
      subscription.activated → status: ACTIVE
      subscription.halted    → status: PAST_DUE, graceUntil: +7d
      subscription.cancelled → status: CANCELLED, agency.isActive = false
```

### Custom domain (Caddy on-demand TLS)

```
visitor → https://app.youragency.com → Caddy
  Caddy → GET /domain/allowed?domain=app.youragency.com (api:3001)
    api: lookup Agency by customDomain → 200 if found, 403 otherwise
  Caddy proceeds with Let's Encrypt cert issuance
  Subsequent requests reverse-proxied to api/web by path

UI flow:
  agency sets hostname → POST /agency/domain
  agency clicks Verify → GET /agency/domain/verify
    api resolves CNAME + A records via dns.resolveCname / resolve4
    returns ok + expected + observed records
```

---

## Repo layout

```
apps/
├── api/                 NestJS API (28 modules)
│   └── src/
│       ├── auth/        4-tier login + JWT + refresh + password reset + MFA
│       ├── email/       Resend client + templated emails
│       ├── billing/     Razorpay client + plan limits + webhook
│       ├── domain/      Custom domain CNAME + Caddy ask endpoint
│       ├── flow/        Flow engine + executor (13 node kinds)
│       ├── ai/          Claude + RAG + Sarvam + agent engine
│       ├── crm/         Pipelines + deals + activities
│       ├── campaign/    Broadcast campaigns
│       ├── template/    Vertical templates (8 verticals)
│       ├── whatsapp/    Evolution API client + instance lifecycle
│       ├── webhook/     Public Evolution webhook
│       ├── conversation, message, contact
│       ├── agency, client, team
│       ├── realtime/    Socket.io gateway
│       ├── queue/       BullMQ queues + processors (inbound, outbound, campaigns)
│       ├── common/      filters, guards, decorators, health, rate limit
│       ├── config/      Zod-validated env
│       └── prisma/      Prisma module
└── web/                 Next.js 14
    └── app/
        ├── (auth)/      login, forgot-password, reset-password, verify-email, mfa
        ├── superadmin/, agency/{billing,domain}/
        └── dashboard/{inbox,contacts,deals,agents,knowledge,flows,flows/[id],campaigns,templates,settings}/

packages/
├── db/                  Prisma schema + 2 migrations + seed
└── types/               shared TS contracts

infra/                   Postgres init SQL
.github/workflows/ci.yml
docker-compose.yml
Caddyfile                with on_demand_tls for custom domains
.env.example
```

---

## Spec

`.kiro/specs/whatsapp-saas-phase1/`:
- `requirements.md`
- `design.md`
- `tasks.md` — completion status

---

## License

Proprietary — diyaa.ai
