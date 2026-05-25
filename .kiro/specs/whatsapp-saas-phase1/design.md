# WhatsApp AI SaaS Platform — Phase 1 Design

## 1. Monorepo Layout

```
diyaa.ai/
├── apps/
│   ├── web/          # Next.js 14 (App Router)
│   └── api/          # NestJS
├── packages/
│   ├── db/           # Prisma schema + generated client
│   └── types/        # Shared TS types
├── docker-compose.yml
├── Caddyfile
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

**Tooling:** pnpm workspaces + Turborepo. Node 20. TypeScript 5.4.

## 2. Database

Postgres 16 with `pgcrypto` and `vector` extensions. Prisma manages schema and migrations.

Schema follows the user-supplied spec with corrections:
- `Contact.metadata Json @default("{}")` — closing-quote typo fixed.
- `Contact.isBlocked` defaults `false`.
- `KBDocument.embedding` declared via `Unsupported("vector(1536)")`; pgvector index created in raw SQL migration.
- Indexes: `Contact(clientId, phone)`, `Conversation(clientId, lastMessageAt)`, `Message(conversationId, createdAt)`, `WhatsappAccount(instanceName)`.
- `RefreshToken` model added for rotation: `{ id, subjectType, subjectId, tokenHash, expiresAt, revokedAt, userAgent, ip }`.

## 3. Authentication

### 3.1 Tokens
- **Access**: JWT HS256, 15 min, payload `{ sub, type, ...scopeIds }`.
- **Refresh**: opaque 256-bit random, httpOnly Secure SameSite=Lax cookie at `/auth/refresh`. Server stores SHA-256 hash. Rotated on each refresh; reuse of revoked token revokes the family.

### 3.2 Endpoints
```
POST /auth/superadmin/login
POST /auth/agency/register     (gated by ALLOW_AGENCY_SIGNUP env)
POST /auth/agency/login
POST /auth/client/login
POST /auth/team/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

### 3.3 Guards
- `JwtAuthGuard` validates access token, attaches `req.principal`.
- `@Roles(...types)` + `RolesGuard` enforce actor type.
- Service-layer queries always filter by tenant ids from principal.
- `@Public()` opts out of auth (login, refresh, webhooks).

### 3.4 Principal
```ts
type Principal =
  | { type: 'SUPER_ADMIN'; id: string }
  | { type: 'AGENCY'; id: string }
  | { type: 'CLIENT'; id: string; agencyId: string }
  | { type: 'TEAM_MEMBER'; id: string; clientId: string; agencyId: string; role: TeamRole };
```

## 4. NestJS Module Map

```
src/
├── auth/        login, refresh, guards, principal, hashing
├── agency/      CRUD by SuperAdmin
├── client/      CRUD by Agency
├── team/        TeamMember CRUD by Client admin
├── whatsapp/    Evolution API client + instance lifecycle
├── webhook/     public Evolution webhooks
├── conversation/ list, assignment, AI toggle
├── message/     send + paginated list
├── contact/     list/get/upsert
├── realtime/    Socket.io gateway
├── queue/       BullMQ setup + processors
├── prisma/      Prisma module wrapper
├── config/      env validation (Zod)
└── common/      filters, decorators, dto helpers
```

Stub modules returning 501 for: `deal`, `pipeline`, `ai-agent`, `knowledge-base`, `flow`, `campaign`, `analytics`, `integrations`, `billing`, `notification`.

## 5. Evolution API Integration

`WhatsappService` wraps a typed Axios client. Methods used in Phase 1:
- `createInstance(name, webhookUrl)`
- `getInstanceQR(name)`
- `getInstanceStatus(name)`
- `sendText(name, to, text)`

Webhook auth: per-instance secret in `apikey` header, verified plus `:instanceName` matches payload.

## 6. Inbound Pipeline

```
POST /webhooks/whatsapp/:instanceName
  → verify apikey
  → WhatsappWebhookService.handleEvent(event)
       'messages.upsert'   → ingestInbound()
       'connection.update' → updateConnectionState()
ingestInbound:
  1. find WhatsappAccount by instanceName (404 → drop)
  2. extract waMessageId, fromPhone, type, content
  3. idempotency: skip if Message.waMessageId exists
  4. upsert Contact{ clientId, phone }
  5. upsert open Conversation
  6. create Message INBOUND
  7. update Conversation.lastMessageAt
  8. emit 'message.created' to client room
  9. enqueue 'inbound-messages' job (no-op processor in Phase 1)
  → 200 OK
```

## 7. Outbound Send

```
POST /messages  { conversationId, content }   (TeamMember/Client)
  → verify conversation.clientId == principal.clientId
  1. create Message OUTBOUND
  2. emit 'message.created'
  3. enqueue 'outbound-messages' job
Worker:
  WhatsappService.sendText() → on success update waMessageId
  on failure: bullmq retries; final fail emits 'message.failed'
```

## 8. Realtime

Socket.io on the same HTTP server. Auth via access token in `auth.token`. On connect, join rooms by principal: `client:{clientId}` (TEAM_MEMBER/CLIENT), `agency:{agencyId}` (AGENCY). Client emits `conversation:join` to enter `conversation:{id}` room after server scope check.

Events server → client: `message.created`, `message.updated`, `conversation.updated`.

## 9. BullMQ

- Queues: `inbound-messages`, `outbound-messages`.
- Connection: shared `IORedis` from `REDIS_URL`.
- Defaults: `attempts: 5`, exponential backoff (2s base), `removeOnComplete: 1000`.
- Workers run in-process for Phase 1.

## 10. Web App

App Router route groups:
```
app/
├── (auth)/login/[role]/page.tsx
├── superadmin/...
├── agency/...
└── dashboard/
    ├── layout.tsx
    ├── page.tsx              redirect → inbox
    └── inbox/page.tsx
```

State: `Zustand` for auth + UI; `TanStack Query` for server data; `socket.io-client` singleton.

UI: shadcn/ui primitives. Tailwind with `--brand` CSS var.

API client: fetch wrapper auto-attaching access token, retrying once on 401 via `/auth/refresh`.

## 11. Config

Zod-validated env at boot. Categories:
- App: `NODE_ENV`, `PORT`, `WEB_ORIGIN`
- DB: `DATABASE_URL`, `DIRECT_URL`
- Redis: `REDIS_URL`
- Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL`, `REFRESH_TTL`
- Evolution: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WEBHOOK_PUBLIC_URL`
- Phase 2+ keys stubbed in `.env.example` only.

## 12. Error Envelope

```json
{ "error": { "code": "FORBIDDEN", "message": "...", "details": {} } }
```

Global `HttpExceptionFilter` produces this. Validation errors map to `VALIDATION_ERROR` with `details.fieldErrors`.

## 13. Deployment

- `docker-compose.yml`: `postgres` (init SQL for `pgcrypto`, `vector`), `redis`, `api`, `web`.
- API multi-stage Dockerfile runs `prisma migrate deploy` on start.
- `Caddyfile` proxies `api.example.com` → api:3001, `app.example.com` → web:3000.

## 14. Testing (Phase 1)

- API: vitest + supertest smoke tests for `/auth/*` and webhook ingestion.
- Web: build must succeed.

## 15. Skeletoned for Later

Empty modules + Prisma models exist for: AIAgent, KnowledgeBase, KBDocument, Flow, Campaign, Pipeline, Stage, Deal, Note, Activity, Subscription. Controllers return 501.
