# ── deps stage ──
# Use pnpm with hoisted node-linker so all transitive deps are reachable at
# runtime. The repo has several undeclared transitive deps (express,
# body-parser internals, etc.) that work in dev because pnpm exposes them
# through nested node_modules but break under strict resolution from the
# compiled output. Hoisting eliminates the whole class of MODULE_NOT_FOUND.
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN echo "node-linker=hoisted" > .npmrc && \
    echo "shamefully-hoist=true" >> .npmrc && \
    echo "auto-install-peers=true" >> .npmrc
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile=false

# ── build stage ──
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /repo/.npmrc ./.npmrc
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY . .

# Generate prisma client and build all required workspaces.
RUN pnpm --filter @diyaa/db prisma:generate
RUN pnpm --filter @diyaa/types build
RUN pnpm --filter @diyaa/db build
RUN pnpm --filter @diyaa/api build

# Workspace package.json `main` fields point at TypeScript source for dev.
# Repoint them at the just-built JS so Node can require('@diyaa/db') at runtime.
RUN node -e "const f='packages/db/package.json',j=require('./'+f);j.main='dist/index.js';j.types='dist/index.d.ts';require('fs').writeFileSync(f,JSON.stringify(j,null,2));"
RUN node -e "const f='packages/types/package.json',j=require('./'+f);j.main='dist/index.js';j.types='dist/index.d.ts';require('fs').writeFileSync(f,JSON.stringify(j,null,2));"

# ── runtime stage ──
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Install the prisma CLI globally so `prisma migrate deploy` is on PATH.
RUN npm install -g prisma@5.22.0

# Copy the entire monorepo from the build stage. With node-linker=hoisted,
# the root /repo/node_modules contains every dep flat, so module resolution
# from anywhere inside the workspace just works.
COPY --from=build /repo /app

EXPOSE 3001
WORKDIR /app/apps/api
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo 'FATAL: DATABASE_URL is not set' >&2; exit 1; fi && prisma migrate deploy --schema=../../packages/db/prisma/schema.prisma && node dist/apps/api/src/main.js"]
