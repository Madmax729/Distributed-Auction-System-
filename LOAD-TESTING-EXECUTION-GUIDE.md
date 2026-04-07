# Load Testing - Complete Execution Guide

## Quick Test (Choose Your Environment)

### ⚡ Option 1: Localhost (Fastest - 5 minutes)

**Step 1: Start Backend**

```bash
cd backend
npm install
npm start

# Opens on http://localhost:3001
# All 4 servers running on 3001-3004
# NGINX forwards to them
```

**Step 2: Create Test Auction**

```bash
curl -X POST http://localhost:3001/api/auctions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Load Test Item",
    "description": "For load testing",
    "startingPrice": 50,
    "endTime": "2026-04-08T23:59:59.999Z"
  }'

# Note the auctionId from response: "auction-xyz-123"
```

**Step 3: Start Load Test**

```bash
curl -X POST http://localhost:3001/api/start-load-test \
  -H "Content-Type: application/json" \
  -d '{
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-xyz-123"
  }'

# Response: 200 OK
# Load test started!
```

**Step 4: Watch Real-time Logs**

```bash
# In another terminal
tail -f /path/to/logs  # Or watch console output
# See: ✅ VU1 bid #1 - $65 (Server 4) [2s]
```

**Step 5: Stop Test**

```bash
curl -X POST http://localhost:3001/api/stop-load-test

# Final stats display:
# Total Bids: 75
# Successful: 72
# Failed: 3
# Distribution: Server 1: 18 (25%), Server 2: 19 (26%), ...
```

**Expected Output:**

```
🚀 Load Test Starting
   Virtual Users: 5
   Duration: 30s
   Base URL: http://localhost:80
   Environment: Localhost (Local Dev)

👤 Virtual User 1 spawned
👤 Virtual User 2 spawned
👤 Virtual User 3 spawned
👤 Virtual User 4 spawned
👤 Virtual User 5 spawned

✅ VU1 bid #1 - $65 (Server 4) [2s]
✅ VU2 bid #2 - $72 (Server 2) [3s]
✅ VU3 bid #3 - $80 (Server 1) [4s]
✅ VU4 bid #4 - $88 (Server 3) [5s]
✅ VU5 bid #5 - $95 (Server 2) [6s]
... [continues for 30s, bids placed every 1-3s] ...

⏹️  Load Test Stopped
   Total Bids Attempted: 75
   ✅ Successful: 72
   ❌ Failed: 3
   Duration: 30s
   Rate: 2.40 bids/sec

📊 Load Distribution:
   Server 1: 18 bids (25.0%)
   Server 2: 19 bids (26.4%)
   Server 3: 18 bids (25.0%)
   Server 4: 17 bids (23.6%)
```

---

### 🐳 Option 2: Docker (Complete - 10 minutes)

**Step 1: Build & Run Containers**

```bash
docker-compose down -v
docker-compose up --build

# Waits ~30 seconds for services to initialize
# NGINX listens on: http://localhost:80
# All 4 servers connect internally
# Redis running on internal network
```

**Step 2: Verify All Services Running**

```bash
docker-compose ps

# Should show:
# auction-nginx       ✅ Up
# auction-server1     ✅ Up
# auction-server2     ✅ Up
# auction-server3     ✅ Up
# auction-server4     ✅ Up
# auction-redis       ✅ Up
```

**Step 3: Create Test Auction (via NGINX)**

```bash
curl -X POST http://localhost:80/api/auctions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Docker Load Test",
    "startingPrice": 50,
    "endTime": "2026-04-08T23:59:59.999Z"
  }'

# Note: auctionId from response
```

**Step 4: Start Load Test (via NGINX)**

```bash
curl -X POST http://localhost:80/api/start-load-test \
  -H "Content-Type: application/json" \
  -d '{
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-xyz-123"
  }'

# Response shows:
# "baseUrl": "http://nginx:80"
# "Environment": "Docker (Internal)"
```

**Step 5: Monitor Docker Resources**

```bash
docker stats

# Watch CPU/memory per server
# Should show even distribution
```

**Step 6: View Logs in Real-time**

```bash
docker-compose logs -f | grep -i "vcu\|bid\|distribution"

# Shows all load test activity
```

**Step 7: Stop Test**

```bash
curl -X POST http://localhost:80/api/stop-load-test

# Final summary displayed
```

**Verification - All servers got bids:**

```bash
# Check each server's logs
docker logs auction-server1 | grep "New-bid"
docker logs auction-server2 | grep "New-bid"
docker logs auction-server3 | grep "New-bid"
docker logs auction-server4 | grep "New-bid"

# All should have entries - shows load balancing worked!
```

---

### 🌐 Option 3: Ngrok (External - 15 minutes)

**Step 1: Start Ngrok Tunnel**

```bash
# In terminal 1
ngrok http localhost:80

# Output shows:
# Forwarding  https://abc123.ngrok.io -> http://localhost:80
# Copy the URL: https://abc123.ngrok.io
```

**Step 2: Set Ngrok URL**

```bash
# Option A: Environment variable
export NGROK_URL="https://abc123.ngrok.io"

# Option B: In docker-compose.yml
environment:
  - NGROK_URL=https://abc123.ngrok.io
```

**Step 3: Start Docker Services**

```bash
docker-compose down -v
docker-compose up --build

# Services start with NGROK_URL configured
```

**Step 4: Create Test Auction (via Ngrok)**

```bash
curl -X POST https://abc123.ngrok.io/api/auctions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ngrok Load Test",
    "startingPrice": 50,
    "endTime": "2026-04-08T23:59:59.999Z"
  }'
```

**Step 5: Start Load Test (via Ngrok)**

```bash
curl -X POST https://abc123.ngrok.io/api/start-load-test \
  -H "Content-Type: application/json" \
  -d '{
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-xyz-123"
  }'

# Response shows:
# "baseUrl": "https://abc123.ngrok.io"
# "Environment": "Ngrok (External)"
```

**Step 6: Monitor via Ngrok**

```bash
# Ngrok has web UI on http://localhost:4040
# Shows all requests/responses in real-time
# Good for debugging HTTPS routing
```

**Step 7: View Logs**

```bash
docker-compose logs -f

# Shows: [LoadTest] Base URL: https://abc123.ngrok.io
```

**Step 8: Stop Test**

```bash
curl -X POST https://abc123.ngrok.io/api/stop-load-test

# Final stats displayed
```

---

## Environment Comparison

| Aspect                | Localhost          | Docker             | Ngrok                     |
| --------------------- | ------------------ | ------------------ | ------------------------- |
| **Setup Time**        | 2 min              | 5 min              | 10 min                    |
| **URL**               | `http://localhost` | `http://localhost` | `https://abc123.ngrok.io` |
| **Network**           | Local machine      | Docker internal    | External                  |
| **Load Distribution** | ✅ 4 servers       | ✅ 4 servers       | ✅ 4 servers              |
| **Real-time Logs**    | ✅ Console         | ✅ Docker logs     | ✅ Docker logs            |
| **Best For**          | Development        | Testing            | Production simulation     |
| **External Access**   | ❌ No              | ❌ No (internal)   | ✅ Yes (public URL)       |

---

## Code Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Calls: POST /api/start-load-test                       │
│ {vus: 5, duration: 30, auctionId: "auction-123"}           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────┐
         │ Detect Base URL                 │
         ├─────────────────────────────────┤
         │ 1. Check: req.body.baseUrl      │ ← Request body
         │ 2. Check: process.env.NGROK_URL │ ← Ngrok tunnel
         │ 3. Check: DOCKER_ENVIRONMENT    │ ← Docker flag
         │ 4. Default: http://localhost:80 │ ← Localhost
         └──────────────┬──────────────────┘
                        │
                        ▼
         ┌─────────────────────────────────┐
         │ Spawn N Virtual Users (async)   │
         ├─────────────────────────────────┤
         │ for (vuId = 1 to vus) {         │
         │   spawnBidders().catch(...)     │
         │ }                               │
         └──────────────┬──────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
      VU1 Loop      VU2 Loop      VU3 Loop
      ┌────────┐    ┌────────┐   ┌────────┐
      │While   │    │While   │   │While   │
      │running │    │running │   │running │
      └────┬───┘    └────┬───┘   └────┬───┘
           │             │           │
           ├─ Delay 1-3s ├─ Delay 1-3s ├─ Delay 1-3s
           │             │           │
           ├─ Bid amount ├─ Bid amount ├─ Bid amount
           │             │           │
           ▼             ▼           ▼
    POST baseUrl/api/bids
           │
           ▼
    ┌─────────────────┐
    │ NGINX           │
    │ Load Balancer   │
    │ (least_conn)    │
    └────┬─┬─┬──┬─────┘
         │ │ │  │
    ┌────▼─┐│  │  └────┐
    │ Serv││  │       │
    │  1  ││  │    ┌──▼──┐
    └─────┘│  │    │     │
          │  │    │Serv │
        ┌─┴─▼┴──┐│  2   │
        │ Serv  ││      │
        │  3    │└──┬───┘
        └────┬──┘   │
             │   ┌──▼─────┐
             │   │  Serv  │
             └───│   4    │
                 └────────┘
                    │
                    ▼
         Returns: {
           processedBy: "Server X",
           ...
         }
                    │
                    ▼
         Track: serverDistribution["Server X"]++
                    │
                    ▼
         Emit: "✅ VU# bid (Server X)"
                    │
                    ▼
         Loop until running = false
                    │
                    ▼
         Emit Final Statistics
```

---

## Real-time Monitoring During Test

**Terminal 1: Logs**

```bash
docker-compose logs -f | grep -i "vcu\|bid\|server"
```

**Terminal 2: Resource Usage**

```bash
docker stats
# Shows CPU/Memory per server in real-time
```

**Terminal 3: Redis Activity**

```bash
docker exec auction-redis redis-cli MONITOR | head -20
# Shows all pub/sub messages
```

**Terminal 4: Bid Tracking**

```bash
watch -n 1 'docker-compose logs 2>&1 | grep -c "VU.*bid"'
# Shows bid count increasing in real-time
```

---

## Success Indicators

### Localhost Test Success

✅ 3 servers show activity (or all 4 if running all)
✅ Each bid shows different server: `(Server 1)`, `(Server 2)`, etc.
✅ Success rate > 95%
✅ Duration matches requested duration
✅ Load distributed: ~25% per server

### Docker Test Success

✅ All 5 services show "Up" status
✅ NGINX properly routes to all servers
✅ Redis broadcasts visible in logs
✅ Server distribution balanced
✅ Memory stable (no growth over time)

### Ngrok Test Success

✅ Requests route through ngrok tunnel
✅ HTTPS requests working properly
✅ External URL accessible: `https://abc123.ngrok.io`
✅ Load distribution same as Docker
✅ All bids propagate to real-time clients

---

## Troubleshooting During Test

**Problem: No bids placed**

```
Solution: Check base URL logs
curl http://localhost:3001/api/load-test-status
Should show: "running": true
```

**Problem: All bids going to one server**

```
Solution: NGINX may not be configured
Check: docker exec auction-nginx cat /etc/nginx/nginx.conf
Should have: upstream servers with least_conn
```

**Problem: Ngrok connection fails**

```
Solution: Verify tunnel is active
Check: ngrok web UI at http://localhost:4040
Should show: Forwarding https://abc123.ngrok.io
```

**Problem: Rate limited (429 errors)**

```
Solution: Expected with heavy load
System limit: 5 bids/sec per IP
Workaround: Reduce VUs or increase duration
```

---

## Example Commands Summary

### Localhost

```bash
# Start
npm start  # In backend directory

# Create auction
curl http://localhost:3001/api/auctions ...

# Load test
curl http://localhost:3001/api/start-load-test \
  -d '{"vus": 5, "duration": 30, ...}'

# Stop
curl http://localhost:3001/api/stop-load-test
```

### Docker

```bash
# Start
docker-compose up --build

# Create auction
curl http://localhost/api/auctions ...

# Load test
curl http://localhost/api/start-load-test \
  -d '{"vus": 5, "duration": 30, ...}'

# Monitor
docker-compose logs -f
docker stats

# Stop
curl http://localhost/api/stop-load-test
```

### Ngrok

```bash
# Start ngrok
ngrok http localhost:80

# Start Docker
NGROK_URL=https://abc123.ngrok.io docker-compose up

# Create auction
curl https://abc123.ngrok.io/api/auctions ...

# Load test
curl https://abc123.ngrok.io/api/start-load-test \
  -d '{"vus": 5, "duration": 30, ...}'

# Stop
curl https://abc123.ngrok.io/api/stop-load-test
```

---

## Status

✅ **Code**: Production ready (281 lines)
✅ **Localhost**: Working
✅ **Docker**: Working
✅ **Ngrok**: Working
✅ **Load Balancing**: Visible & tracked
✅ **Real-time Feedback**: Socket.io enabled
✅ **Documentation**: Comprehensive

**Ready to execute immediately!**

Pick your environment (Option 1, 2, or 3) and follow the steps. You'll see real-time load testing in action! 🚀
