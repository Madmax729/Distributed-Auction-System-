# ─── Backend Dockerfile ──────────────────────────────────────
FROM node:18-alpine

# Install curl (healthcheck), bash, and k6 for load testing
RUN apk add --no-cache curl bash

# Install k6 load testing tool
RUN curl -sSL https://github.com/grafana/k6/releases/download/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz \
    | tar xz -C /usr/local/bin --strip-components=1 k6-v0.50.0-linux-amd64/k6 \
    && chmod +x /usr/local/bin/k6

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
