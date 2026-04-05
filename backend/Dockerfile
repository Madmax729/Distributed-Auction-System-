# ─── Backend Dockerfile ──────────────────────────────────────
FROM node:18-alpine

# Install k6 for load testing
RUN apk add --no-cache curl bash && \
    curl -s https://dl.k6.io/key.gpg | gpg --dearmor -o /usr/share/keyrings/k6.gpg 2>/dev/null || true

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port (will be set via ENV)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Start server
CMD ["node", "src/index.js"]
