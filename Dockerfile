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

# Copy package.json and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built app and server files from the builder stage
COPY --from=builder /app/dist ./dist
COPY server.cjs ./
COPY src/utils/cfpsParser.cjs ./src/utils/cfpsParser.cjs

# If you use config.json and want to include it in the image, uncomment the next line
# COPY config.json ./

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["node", "server.cjs"]
