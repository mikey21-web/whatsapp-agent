# ── deps stage ──
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile=false

# ── build stage ──
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @diyaa/db prisma:generate
RUN pnpm --filter @diyaa/api build

# ── runtime stage ──
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Install prisma CLI globally so it's reachable at runtime regardless of
# pnpm's isolated node_modules layout (prisma is only a devDep of @diyaa/db,
# so its bin is not hoisted to /repo/node_modules/.bin).
RUN npm install -g prisma@5.22.0

# Copy the built API
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json

# Copy ALL node_modules from the build stage (includes @prisma/client, ioredis, etc.)
COPY --from=build /repo/node_modules ./node_modules

# Copy prisma schema for migrations
COPY --from=build /repo/packages/db/prisma ./prisma

# Copy the generated prisma client
COPY --from=build /repo/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001
CMD ["sh", "-c", "export DIRECT_URL=\"${DIRECT_URL:-$DATABASE_URL}\" && prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
