#!/usr/bin/env pwsh
# ============================================================
# Build and Deploy Distributed Auction System for Ngrok
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DISTRIBUTED AUCTION SYSTEM - Ngrok Deployment" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

# ------------------------------------------------------------
# Check MongoDB
# ------------------------------------------------------------
Write-Host ""
Write-Host "Checking MongoDB connection..." -ForegroundColor Green

$mongoRunning = $false
try {
    $socket = New-Object System.Net.Sockets.TcpClient
    $socket.Connect("127.0.0.1", 27017)
    $mongoRunning = $true
    $socket.Close()
} catch {
    $mongoRunning = $false
}

if (-not $mongoRunning) {
    Write-Host "WARNING: MongoDB not detected on localhost:27017" -ForegroundColor Yellow
    Write-Host "For public access, MongoDB Atlas is recommended!" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue or Ctrl+C to cancel"
}

# ------------------------------------------------------------
# Check Ngrok installed
# ------------------------------------------------------------
Write-Host ""
Write-Host "Checking Ngrok..." -ForegroundColor Green

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "Ngrok is not installed!" -ForegroundColor Red
    Write-Host "Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# Step 1: Build frontend
# ------------------------------------------------------------
Write-Host ""
Write-Host "Building React frontend..." -ForegroundColor Cyan

Push-Location frontend
npm install
npm run build
Pop-Location

if (-not (Test-Path "frontend/dist")) {
    Write-Host "Frontend build failed - no dist directory found" -ForegroundColor Red
    exit 1
}

Write-Host "Frontend build complete" -ForegroundColor Green

# ------------------------------------------------------------
# Step 2: Stop containers
# ------------------------------------------------------------
Write-Host ""
Write-Host "Cleaning old containers..." -ForegroundColor Cyan

try {
    docker compose down --remove-orphans
} catch {
    Write-Host "No containers were running" -ForegroundColor Gray
}

# ------------------------------------------------------------
# Step 3: Start Docker
# ------------------------------------------------------------
Write-Host ""
Write-Host "Starting Docker services..." -ForegroundColor Cyan

docker compose up -d --build

# ------------------------------------------------------------
# Step 4: Wait for services
# ------------------------------------------------------------
Write-Host ""
Write-Host "Waiting for services (30s)..." -ForegroundColor Yellow

Start-Sleep -Seconds 10

# Health check loop
$healthy = $false

for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 2
        if ($response.Content -match "ok") {
            Write-Host "Services are healthy" -ForegroundColor Green
            $healthy = $true
            break
        }
    } catch {
        Write-Host "   Attempt $i/10..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
    }
}

if (-not $healthy) {
    Write-Host "Services may still be starting..." -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Step 5: Start Ngrok
# ------------------------------------------------------------
Write-Host ""
Write-Host "Starting Ngrok tunnel..." -ForegroundColor Cyan

Start-Process ngrok -ArgumentList "http 80"

Write-Host ""
Write-Host "Waiting for Ngrok URL..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# ------------------------------------------------------------
# FINAL OUTPUT
# ------------------------------------------------------------
Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host ""
Write-Host "Open Ngrok dashboard:" -ForegroundColor Cyan
Write-Host "   http://127.0.0.1:4040" -ForegroundColor White

Write-Host ""
Write-Host "Share the HTTPS URL shown in Ngrok with your friends!" -ForegroundColor Green

Write-Host ""
Write-Host "Container status:" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  docker compose logs -f" -ForegroundColor Gray
Write-Host "  docker compose down" -ForegroundColor Gray

Write-Host ""