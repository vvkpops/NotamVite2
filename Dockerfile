# Stage 1: builder
FROM node:18-alpine AS builder

WORKDIR /app

# Install build deps
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: runtime
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app and server files
COPY --from=builder /app/dist ./dist
COPY server.cjs ./
# If you rely on config.json in container, copy it (or better: use env vars)
COPY config.json ./

# Expose port
EXPOSE ${PORT:-3001}

# Healthcheck (optional)
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD wget -qO- --timeout=3 http://127.0.0.1:${PORT:-3001}/ping || exit 1

CMD ["node", "server.cjs"]
