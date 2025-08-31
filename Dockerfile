# Stage 1: Build the React app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary files from builder stage and package.json for production dependencies
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.cjs ./
COPY src/utils/cfpsParser.cjs ./src/utils/cfpsParser.cjs
# If you use config.json, uncomment the next line
# COPY config.json ./

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["node", "server.cjs"]
