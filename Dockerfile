# syntax=docker/dockerfile:1

# ---- deps: install node_modules from the lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: compile the standalone Next.js server ----
FROM node:22-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# lib/env.ts requires the service-role key to be set at build time; the real
# key is only provided at runtime, so use a placeholder scoped to this command.
RUN SUPABASE_SERVICE_ROLE_KEY=build-placeholder npm run build

# ---- runner: minimal image with only the standalone output ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Runtime-only secrets (never baked into the image):
# SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET
CMD ["node", "server.js"]
