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

# Enhanced health check for Vite build
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { \
      host: 'localhost', \
      port: process.env.PORT || 3001, \
      path: '/health', \
      timeout: 8000 \
    }; \
    const req = http.request(options, (res) => { \
      let data = ''; \
      res.on('data', chunk => data += chunk); \
      res.on('end', () => { \
        try { \
          const health = JSON.parse(data); \
          if (res.statusCode === 200 && health.status === 'healthy' && health.build && health.build.directoryExists) { \
            console.log('Health check passed:', health.service, health.buildTool); \
            process.exit(0); \
          } else { \
            console.error('Health check failed:', data); \
            process.exit(1); \
          } \
        } catch(e) { \
          console.error('Health check parse error:', e.message); \
          process.exit(1); \
        } \
      }); \
    }); \
    req.on('error', (err) => { \
      console.error('Health check request error:', err.message); \
      process.exit(1); \
    }); \
    req.on('timeout', () => { \
      console.error('Health check timeout'); \
      process.exit(1); \
    }); \
    req.end();"

# Start application
CMD ["npm", "start"]
