# WhatsApp AI SaaS Platform — Phase 1 Requirements

## Scope

Phase 1 (Foundation) of a multi-tenant, white-label WhatsApp AI automation platform. Lays the groundwork for Phases 2–5. Excludes AI agents, RAG, flow builder, campaigns, billing, and integrations.

## Actors

- **SuperAdmin** — platform owner. One per deployment.
- **Agency** — reseller (e.g. diyaa.ai). Manages multiple clients.
- **Client** — SMB end-customer. Owned by exactly one agency.
- **TeamMember** — agent/supervisor/admin under a client.
- **Contact** — WhatsApp end-user messaging the client. Not an authenticated user.

## Functional Requirements

### FR1 — Authentication
- Each actor type has a separate login route and credential store.
- Login returns: short-lived JWT access token (15 min) + httpOnly refresh cookie (7 days, rotated on refresh).
- Logout invalidates the active refresh token.
- Passwords hashed with bcrypt (cost ≥ 12).
- Every protected endpoint enforces actor type and tenant scope.

### FR2 — Tenancy & Scoping
- An Agency can only see/modify its own Clients.
- A Client (and its TeamMembers) can only see/modify resources where `clientId` matches.
- A TeamMember inherits the Client's scope plus a role (ADMIN/SUPERVISOR/AGENT).
- A SuperAdmin can read all data and manage agencies.
- All cross-tenant access attempts return 403.

### FR3 — Agency & Client Provisioning
- SuperAdmin can create/suspend/delete an Agency.
- Agency can create/suspend/delete its Clients.
- Suspended Agency: all child Client logins blocked. Suspended Client: all TeamMember logins blocked.

### FR4 — WhatsApp Account Connection
- A Client registers a WhatsApp Account by providing an instance name.
- Backend creates the instance via Evolution API and stores `instanceName`, `phoneNumber`, `displayName`.
- Backend exposes the QR code for pairing.
- Connection state updates from webhook events.

### FR5 — Inbound Messages
- Evolution API delivers webhooks to `POST /webhooks/whatsapp/:instanceName`.
- Webhook authenticated via shared secret in header.
- Pipeline: verify → resolve `WhatsappAccount` → upsert `Contact` → upsert open `Conversation` → persist `Message` → emit socket event → enqueue background job.
- Idempotency on `waMessageId`.

### FR6 — Shared Inbox
- A TeamMember sees all conversations belonging to their Client.
- Left pane: conversation list with last-message preview, status filter.
- Right pane: message history (paginated), input box.
- Real-time updates via Socket.io.
- Sending a text from the inbox: persists outbound `Message`, dispatches via Evolution API, emits socket event.

### FR7 — Deployment Artifacts
- `docker-compose.yml` runs Postgres, Redis, the API, and the web app.
- `Caddyfile` example for production reverse proxying.
- `.env.example` enumerating every required variable.

## Non-Functional Requirements

- **Stack**: Next.js 14 (App Router), NestJS, Prisma, Postgres, Redis, Socket.io, BullMQ, TypeScript end-to-end.
- **Code quality**: typed everywhere, Zod validation on DTOs, ESLint + Prettier configured.
- **Security**: refresh tokens hashed at rest, CORS locked to known origins, webhook secrets verified, secrets only in env.
- **Observability**: structured request logging, consistent error envelope.

## Out of Scope (Phase 1)

MFA, password reset emails, email verification, custom domains, AI agents, knowledge base/RAG, voice transcription, CRM business logic, flow builder, campaigns, billing, integrations, mobile PWA polish, analytics dashboards. Schema includes these models so later phases plug in cleanly.
