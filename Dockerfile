# Use Node.js 18 Alpine
FROM node:18-alpine

# Install curl for healthcheck and debugging
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci --include=dev

# Copy all source files
COPY . .

# Build the application
RUN npm run build && \
    echo "Build completed, checking contents:" && \
    ls -la && \
    ls -la dist/ && \
    echo "Index file exists:" && \
    test -f dist/index.html && echo "✅ dist/index.html found" || echo "❌ dist/index.html missing"

# Remove dev dependencies after build
RUN npm prune --production

# Verify production dependencies
RUN echo "Production dependencies:" && \
    npm list --depth=0

# Create a startup script for better debugging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "=== CONTAINER STARTUP DEBUG ==="' >> /app/start.sh && \
    echo 'echo "PORT: $PORT"' >> /app/start.sh && \
    echo 'echo "NODE_ENV: $NODE_ENV"' >> /app/start.sh && \
    echo 'echo "Working directory: $(pwd)"' >> /app/start.sh && \
    echo 'echo "Files in /app:"' >> /app/start.sh && \
    echo 'ls -la' >> /app/start.sh && \
    echo 'echo "Files in dist:"' >> /app/start.sh && \
    echo 'ls -la dist/ 2>/dev/null || echo "No dist directory"' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Railway will set this)
EXPOSE $PORT

# SIMPLIFIED healthcheck that waits for startup
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD curl -f http://127.0.0.1:${PORT:-3001}/ping || exit 1

# Use our debug startup script
CMD ["/app/start.sh"]
