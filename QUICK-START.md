# ⚡ QUICK START - 5 MINUTES TO NGROK

## Prerequisites (Do Once)

```powershell
# 1. Install Docker Desktop
# Download: https://www.docker.com/products/docker-desktop

# 2. Install Ngrok
# Download: https://ngrok.com/download
# Or: choco install ngrok

# 3. Start MongoDB
mongod  # or use MongoDB Compass
```

## Deploy & Run

### Windows PowerShell

```powershell
cd C:\LocalDiskD\Coding\DCProject\Distributed-Auction-System-

# ONE COMMAND TO BUILD & START
.\deploy-ngrok.ps1

# This script:
# ✓ Builds React frontend
# ✓ Stops old containers
# ✓ Starts all Docker services
# ✓ Waits for health checks
# ✓ Shows what to do next
```

### Manual (if deploy script fails)

```powershell
# 1. Build frontend
cd frontend
npm install
npm run build
cd ..

# 2. Start Docker
docker compose down --remove-orphans
docker compose up -d --build

# 3. Verify running
docker compose ps
curl http://localhost/  # Should show auction app
```

## Expose to Internet

### Terminal 2: Start Ngrok

```powershell
ngrok http 80

# Output:
# Session Status      online
# Account             (free plan)
# Version             3.0.0
# Region              us
# Forwarding          https://abc123.ngrok.io -> http://localhost:80
# Inspecting          http://127.0.0.1:4040
```

### Share Public URL

```
Send this to other users:
https://abc123.ngrok.io

They can:
✓ View auctions in real-time
✓ Place bids with instant updates
✓ See load balanced between 4 servers
✓ Witness leader election if server crashes
```

## Testing

### Local First

```powershell
# Browser: http://localhost
# Check: All auctions load, real-time updates work

# Mobile: http://localhost on phone on same WiFi
# Check: Works from local network
```

### External (Ngrok)

```powershell
# Browser: https://abc123.ngrok.io
# Multiple users: Create different auctions, place competing bids
# Check: Bids appear instantly for all users

# Real-time test:
# User 1: Place bid on auction
# User 2: See bid appear immediately on their screen
# (If fails: See DEBUGGING section below)
```

## Debugging in 30 Seconds

| Issue                    | Fix                                           |
| ------------------------ | --------------------------------------------- |
| `Cannot GET /`           | `cd frontend && npm run build`                |
| API 500 error            | `mongod` start MongoDB                        |
| Socket.io fails          | `docker compose restart nginx`                |
| Wrong Ngrok URL          | Any new session gets new URL - share new link |
| "Connection refused"     | Wait 30s for containers to start              |
| MongoDB connection error | Check `.env` file has `MONGO_URI`             |

## Stop Everything

```powershell
docker compose down
```

## View Logs

```powershell
docker compose logs -f          # Everything
docker compose logs -f nginx    # Just NGINX
docker compose logs -f server1  # Just server 1
```

## Key Files Modified

1. **frontend/src/services/api.js** — Dynamic URL detection
2. **frontend/src/services/socket.js** — HTTPS + Ngrok support
3. **nginx/nginx.conf** — Frontend serving + WebSocket fixes
4. **backend/src/index.js** — Socket.io + CORS for Ngrok
5. **.env** — MongoDB connection

## Architecture Now

```
[Multiple Users on Internet]
          ↓
    Ngrok Tunnel (HTTPS)
          ↓
    NGINX (Load Balancer)
          ↓
    [4 Backend Servers]
    ├─ Server 1 (port 3001)
    ├─ Server 2 (port 3002)
    ├─ Server 3 (port 3003)
    └─ Server 4 (port 3004)
          ↓
    MongoDB (localhost:27017)
```

## Distributed Features Now Visible

### 1. Load Balancing

Each request goes to different server

```
curl https://abc123.ngrok.io/api/server-info
# Run repeatedly, see different serverIds
```

### 2. Leader Election

Highest ID server leads (currently: 4)

```
docker compose stop server4
# Wait 30s
curl https://abc123.ngrok.io/api/server-info
# currentLeader changes to 3
```

### 3. Real-Time Replication

Bid placed on any server, seen everywhere

```
User A places bid on Server 1
User B sees bid instantly on Server 3
```

### 4. Fault Tolerance

System survives server crashes

```
docker compose stop server2
# System still fully operational
docker compose start server2
# Automatically syncs and rejoins
```

---

**Done! Your distributed auction system is now on the internet.** 🎉

For detailed debugging, see: [NGROK-DEPLOYMENT-GUIDE.md](NGROK-DEPLOYMENT-GUIDE.md)
