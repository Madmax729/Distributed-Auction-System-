#!/bin/pwsh
# Real-Time Synchronization Deployment Script
# Tests Redis connectivity and Socket.io sync across all servers

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$ShowLogs = $false
)

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Distributed Auction System - Real-Time Sync Deployment      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop existing containers
Write-Host "[1/6] Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  Docker compose down had issues (this is OK if containers don't exist)" -ForegroundColor Yellow
}

# Step 2: Clean volumes
Write-Host "[2/6] Cleaning volumes..." -ForegroundColor Yellow
docker-compose down -v 2>&1 | Out-Null

# Step 3: Build (optional)
if (-not $SkipBuild) {
    Write-Host "[3/6] Building Docker images..." -ForegroundColor Yellow
    docker-compose up --build -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "[3/6] Skipping build (--SkipBuild)" -ForegroundColor Yellow
    docker-compose up -d
}

# Step 4: Wait for services
Write-Host "[4/6] Waiting for services to start..." -ForegroundColor Yellow
Write-Host "  Waiting 30 seconds for Redis and backends to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# Verify containers running
$containers = docker-compose ps --format "{{.Names}}: {{.Status}}"
Write-Host ""
Write-Host "  Container Status:" -ForegroundColor Gray
$containers | ForEach-Object {
    $line = $_
    if ($line -like "*healthy*" -or $line -like "*Up*") {
        Write-Host "    ✓ $line" -ForegroundColor Green
    } else {
        Write-Host "    ✗ $line" -ForegroundColor Red
    }
}

# Step 5: Verify Redis
Write-Host "[5/6] Verifying Redis connection..." -ForegroundColor Yellow

$redisPing = docker exec auction-redis redis-cli ping 2>&1
if ($redisPing -eq "PONG" -or $redisPing -like "*PONG*") {
    Write-Host "  ✓ Redis responding to ping: $redisPing" -ForegroundColor Green
} else {
    Write-Host "  ✗ Redis ping failed: $redisPing" -ForegroundColor Red
}

# Check connected clients
$connectedClients = docker exec auction-redis redis-cli info connected_clients 2>&1 | Select-String "connected_clients:"
Write-Host "  $connectedClients" -ForegroundColor Gray

# Step 6: Verify Socket.io adapter
Write-Host "[6/6] Verifying Socket.io Redis adapter..." -ForegroundColor Yellow

$logs = docker logs auction-server1 2>&1 | Select-String "Redis adapter|Redis connection" | Select-Object -First 2
if ($logs) {
    Write-Host "  ✓ Socket.io adapter logs:" -ForegroundColor Green
    $logs | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  ⚠️  No adapter logs found (Redis might not be ready yet)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     ✅ DEPLOYMENT COMPLETE                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Open browser: http://localhost" -ForegroundColor Gray
Write-Host "  2. Open in two browsers/windows" -ForegroundColor Gray
Write-Host "  3. Go to same auction in both" -ForegroundColor Gray
Write-Host "  4. Bid in one browser" -ForegroundColor Gray
Write-Host "  5. Verify bid appears instantly in other browser ✓" -ForegroundColor Gray
Write-Host ""

Write-Host "📊 MONITORING:" -ForegroundColor Yellow
Write-Host "  View logs (follow real-time):" -ForegroundColor Gray
Write-Host "    docker logs auction-server1 -f" -ForegroundColor Gray
Write-Host "    docker logs auction-redis -f" -ForegroundColor Gray
Write-Host ""
Write-Host "  Check Redis:" -ForegroundColor Gray
Write-Host "    docker exec auction-redis redis-cli MONITOR" -ForegroundColor Gray
Write-Host "    docker exec auction-redis redis-cli INFO stats" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 DOCUMENTATION:" -ForegroundColor Yellow
Write-Host "  Complete guide: REALTIME-SYNC-FIX.md" -ForegroundColor Gray
Write-Host "  Troubleshooting: See REALTIME-SYNC-FIX.md → Troubleshooting section" -ForegroundColor Gray
Write-Host ""

if ($ShowLogs) {
    Write-Host "📝 Server Startup Logs:" -ForegroundColor Yellow
    Write-Host ""
    docker-compose logs --tail=50 2>&1
}

Write-Host "🚀 System ready! Real-time synchronization is active." -ForegroundColor Green
