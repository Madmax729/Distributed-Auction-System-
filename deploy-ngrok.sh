#!/bin/bash
# ============================================================
# Build and Deploy Distributed Auction System for Ngrok
# ============================================================
# This script builds the frontend and starts all Docker services.
# Usage: ./deploy-ngrok.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DISTRIBUTED AUCTION SYSTEM - Ngrok Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if MongoDB is running
echo ""
echo "✓ Checking MongoDB connection..."
if ! timeout 3 bash -c "echo > /dev/tcp/localhost/27017" 2>/dev/null; then
    echo "⚠ WARNING: MongoDB not detected on localhost:27017"
    echo "   Start MongoDB before running Docker containers!"
    echo "   • Windows: mongod.exe"
    echo "   • Or use MongoDB Compass to start local server"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to cancel..."
fi

# Step 1: Build frontend
echo ""
echo "📦 Building React frontend..."
cd frontend
npm install
npm run build
cd ..

if [ ! -d "frontend/dist" ]; then
    echo "❌ Frontend build failed - no dist directory found"
    exit 1
fi
echo "✅ Frontend build complete"

# Step 2: Stop any running containers
echo ""
echo "🧹 Cleaning up old containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Step 3: Start Docker services
echo ""
echo "🚀 Starting Docker services..."
docker compose up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to become ready (30s)..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."
for i in {1..12}; do
    if curl -s http://localhost/health | grep -q "ok"; then
        echo "✅ Services are healthy"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "⚠ Services may not be fully ready yet"
    fi
    echo "   Attempt $i/12..."
    sleep 3
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Verify MongoDB is running on localhost:27017"
echo "2. Test local access: http://localhost"
echo "3. Start Ngrok: ngrok http 80"
echo "4. Share the Ngrok URL with other users"
echo ""
echo "Container status:"
docker compose ps
echo ""
echo "To view logs:"
echo "  • All services: docker compose logs -f"
echo "  • Specific service: docker compose logs -f server1"
echo "  • NGINX: docker compose logs -f nginx"
echo ""
echo "To stop:" echo "  docker compose down"
echo ""
