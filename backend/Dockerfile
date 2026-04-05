# ─── Backend Dockerfile ──────────────────────────────────────
FROM node:18-alpine

# Install curl only (needed for healthcheck + k6 script)
RUN apk add --no-cache curl bash

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port (will be set via ENV)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=35s --retries=4 \
  CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Start server
CMD ["node", "src/index.js"]
