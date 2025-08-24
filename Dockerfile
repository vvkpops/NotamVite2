# Use Node.js 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
COPY package*.json ./

# Install ALL dependencies first (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the React application with Vite
RUN npm run build

# Verify build was successful
RUN ls -la dist/ && \
    test -f dist/index.html || (echo "Build failed: index.html not found" && exit 1)

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE $PORT

# SIMPLIFIED HEALTHCHECK - Fixed the main issues
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --timeout=10 \
    http://127.0.0.1:${PORT:-3001}/health || exit 1

# Alternative using curl if wget not available
# HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
#   CMD curl -f http://127.0.0.1:${PORT:-3001}/health || exit 1

# Start application
CMD ["npm", "start"]
