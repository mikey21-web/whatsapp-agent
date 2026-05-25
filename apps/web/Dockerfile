FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile=false

FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @diyaa/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/apps/web/next.config.mjs ./next.config.mjs
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web/node_modules ./apps/web/node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
