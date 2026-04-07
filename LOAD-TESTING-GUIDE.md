# 🧪 Load Testing Guide - Distributed Auction System

## Overview

The load testing system simulates multiple **virtual users** placing bids simultaneously to test:

- ✅ Bid processing under load
- ✅ Real-time socket.io synchronization
- ✅ Load distribution across servers (visible via NGINX balancing)
- ✅ Redis message broker performance
- ✅ Database concurrency

**Key Features:**

- In-process simulation (no external tools needed)
- Real-time Socket.io feedback to UI
- Server distribution tracking
- Automatic statistics collection

---

## Quick Start (2 minutes)

### 1. Start a Load Test from UI

```
Admin Page → Load Testing Section
├─ Virtual Users: 5
├─ Duration: 30s
├─ Auction ID: [select one]
└─ Start Button ▶️
```

### 2. Watch Real-time Logs

Logs stream to the admin panel showing:

```
✅ VU2 bid #1 - $65 (Server 4) [2s]
✅ VU3 bid #2 - $72 (Server 2) [4s]
✅ VU1 bid #3 - $80 (Server 1) [6s]
```

### 3. Stop Test

```
Stop Button ⏹️ → Shows final statistics
```

---

## Understanding the Load Test

### What Happens When You Start?

```
1. System creates N virtual users (VUs)
   └─ Each VU has unique userId and userName

2. Each VU spawns async bidding loop
   ├─ Waits random 1-3 seconds
   ├─ Places random bid ($10-60 increment)
   ├─ Repeats until test stops
   └─ Shows real-time in UI

3. Load Balancer (NGINX) distributes bids
   ├─ Server 1: X bids
   ├─ Server 2: Y bids
   ├─ Server 3: Z bids
   └─ Server 4: W bids

4. Redis broadcasts all bids to all clients
   └─ Real-time synchronization across servers

5. Statistics collected
   ├─ Total bids attempted
   ├─ Success/failure rates
   ├─ Server distribution
   └─ Bids per second rate
```

---

## API Endpoints

### POST `/api/start-load-test`

**Start a load test with virtual users**

**Request Body:**

```json
{
  "vus": 5,
  "duration": 30,
  "auctionId": "auction-123-abc"
}
```

**Parameters:**

- `vus` (number, default: 5) - Virtual users to simulate (1-50 recommended)
- `duration` (number, default: 30) - Test duration in **seconds**
- `auctionId` (string, **required**) - Auction to load test

**Response:**

```json
{
  "message": "Load test started",
  "config": {
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-123-abc"
  },
  "baseUrl": "http://localhost:80"
}
```

**Example with curl:**

```bash
curl -X POST http://localhost:3001/api/start-load-test \
  -H "Content-Type: application/json" \
  -d '{
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-123"
  }'
```

---

### POST `/api/stop-load-test`

**Stop the active load test**

**Response:**

```json
{
  "message": "Load test stopped",
  "stats": {
    "totalBids": 47,
    "successfulBids": 45,
    "failedBids": 2,
    "serverDistribution": {
      "Server 1": 11,
      "Server 2": 12,
      "Server 3": 11,
      "Server 4": 11
    }
  },
  "elapsedSeconds": 30
}
```

---

### GET `/api/load-test-status`

**Check current load test status**

**Response (Running):**

```json
{
  "running": true,
  "config": {
    "vus": 5,
    "duration": 30,
    "auctionId": "auction-123",
    "elapsed": 15
  },
  "stats": {
    "totalBids": 23,
    "successfulBids": 23,
    "failedBids": 0,
    "serverDistribution": {
      "Server 1": 6,
      "Server 2": 6,
      "Server 3": 6,
      "Server 4": 5
    }
  }
}
```

**Response (Not Running):**

```json
{
  "running": false,
  "config": null,
  "stats": {
    "totalBids": 0,
    "successfulBids": 0,
    "failedBids": 0,
    "serverDistribution": {}
  }
}
```

---

## Socket.io Real-Time Events

### Event: `load-test-output`

**Description:** Each log message from the load test

**Emission:**

```javascript
io.emit("load-test-output", {
  text: "✅ VU2 bid #5 - $85 (Server 3) [10s]",
  type: "stdout", // "stdout", "stderr", "info", "warn", "footer"
  timestamp: 1617989400000,
  serverId: "1",
});
```

**Log Types:**

- `stdout` - Regular bid confirmation
- `stderr` - Bid error/failure
- `info` - Status messages (VU spawned, test started, etc.)
- `warn` - Warnings (timeouts, connection issues)
- `footer` - Final summary statistics

---

### Event: `load-test-complete`

**Description:** Emitted when load test stops (auto or manual)

**Emission:**

```javascript
io.emit("load-test-complete", {
  code: 0,
  stats: {
    totalBids: 47,
    successfulBids: 45,
    failedBids: 2,
    serverDistribution: {
      "Server 1": 11,
      "Server 2": 12,
      "Server 3": 11,
      "Server 4": 13,
    },
  },
  elapsed: 30,
});
```

---

## Understanding Statistics

### Example Output

```
🚀 Load Test Starting
   Virtual Users: 5
   Duration: 30s
   Auction ID: auction-123
   Base URL: http://nginx:80
   Total Requests: ~75 bids (1 bid every 1-3s per VU)

👤 Virtual User 1 spawned
👤 Virtual User 2 spawned
👤 Virtual User 3 spawned
👤 Virtual User 4 spawned
👤 Virtual User 5 spawned

✅ VU1 bid #1 - $65 (Server 4) [0s]
✅ VU2 bid #2 - $72 (Server 2) [1s]
✅ VU3 bid #3 - $80 (Server 1) [2s]
... (more bids) ...

⏹️  Load Test Stopped
   Total Bids Attempted: 75
   ✅ Successful: 72
   ❌ Failed: 3
   Duration: 30s
   Rate: 2.40 bids/sec

📊 Load Distribution (Server handling):
   Server 1: 18 bids (25.0%)
   Server 2: 19 bids (26.4%)
   Server 3: 18 bids (25.0%)
   Server 4: 17 bids (23.6%)
```

**Key Metrics:**

- **Success Rate:** (Successful / Total) × 100 = (72/75) × 100 = 96%
- **Bids/Sec:** Successful / Duration = 72 / 30 = 2.4 bids/sec
- **Load Distribution:** Should be roughly even across servers (~25% each)

---

## Test Scenarios

### Scenario 1: Light Load

```
VUs: 3
Duration: 20s
Expected: ~30-40 bids at ~1.5 bids/sec
Distribution: Even across servers
```

**Use case:** Test basic functionality without stress

---

### Scenario 2: Normal Load

```
VUs: 5
Duration: 30s
Expected: ~70-90 bids at ~2.5 bids/sec
Distribution: Should be balanced (~25% each server)
```

**Use case:** Standard testing configuration

---

### Scenario 3: Heavy Load

```
VUs: 15
Duration: 30s
Expected: ~200-280 bids at ~7-9 bids/sec
Distribution: Monitor for uneven distribution
Rate limit: Expect 429 (rate limited) errors
```

**Use case:** Stress test, find bottlenecks

---

### Scenario 4: Sustained Load

```
VUs: 10
Duration: 60s
Expected: ~200-300 bids at ~3.5-5 bids/sec
Duration: Check for memory leaks, connection issues
```

**Use case:** Long-running stability test

---

## Rate Limiting

The system has a rate limit of **5 bids/second per IP**.

**When you hit rate limit:**

- Load test continues but gets 429 responses
- Failed bid count increases
- Real-time log shows rate limit error

**Example Error:**

```
❌ VU4 bid failed: Rate limited — max 5 bids/second
```

**Workaround:** Spread VUs across longer duration or use fewer VUs

---

## Monitoring Load Distribution

### Expected Behavior

With NGINX load balancing (least_conn), bids should distribute **roughly evenly**:

```
Ideal: 25% → 25% → 25% → 25%
                ↓
            Each Server
```

**Example Result:**

```
📊 Load Distribution:
   Server 1: 18 bids (25.0%)  ✅
   Server 2: 19 bids (26.4%)  ✅
   Server 3: 18 bids (25.0%)  ✅
   Server 4: 17 bids (23.6%)  ✅
```

### Uneven Distribution (Red Flag)

If distribution is skewed:

```
Server 1: 10 bids (20%)
Server 2: 8 bids (16%)   ❌ Too low
Server 3: 25 bids (50%)  ❌ Too high
Server 4: 17 bids (34%)  ⚠️ Check why
```

**Investigate:**

- Is one server faster? → Check logs
- Is one server down? → Check `docker-compose ps`
- Is NGINX config correct? → Check `nginx.conf` upstream

---

## Viewing Logs During Test

### Terminal (Backend)

```bash
# Watch all servers
docker-compose logs -f

# Watch specific server
docker-compose logs -f auction-server1

# Search for load test entries
docker logs auction-server1 2>&1 | grep LoadTest
```

### Admin UI

Load test logs auto-stream in real-time:

```
Load Testing Panel
├─ Real-time log output
├─ Live statistics
└─ Server distribution chart (optional)
```

### Redis Monitor

Monitor Redis pub/sub activity:

```bash
docker exec auction-redis redis-cli MONITOR | grep bid
```

---

## Troubleshooting

### Problem: 404 on `/api/start-load-test`

**Cause:** Routes not registered or file has syntax error

**Fix:**

```bash
# Check if loadtest.js syntax is valid
node -c backend/src/routes/loadtest.js

# Restart backend
docker-compose restart auction-server1
```

---

### Problem: Load test starts but no output

**Cause:** global.io not set up correctly

**Fix:** Check that `global.io = io` is in index.js:

```javascript
// backend/src/index.js
global.io = io; // ← This line must exist
```

---

### Problem: All bids fail (getting 400 errors)

**Cause 1:** Auction doesn't exist

- Solution: Check auctionId is correct

**Cause 2:** Auction has ended

- Solution: Start test on an active auction

**Cause 3:** Rate limited (429)

- Solution: Reduce VUs or increase duration

---

### Problem: Uneven server distribution

**Cause:** Possible server issue or NGINX misconfiguration

**Fix:**

```bash
# Check all servers are running
docker-compose ps

# Check NGINX upstream
docker exec auction-nginx cat /etc/nginx/nginx.conf | grep -A 10 upstream

# Manual test single server
curl http://localhost:3001/api/bids/status  # Server 1
curl http://localhost:3002/api/bids/status  # Server 2
```

---

### Problem: Test stuck (won't stop)

**Force stop:**

```bash
curl -X POST http://localhost:3001/api/stop-load-test
```

Or restart backend:

```bash
docker-compose restart
```

---

## Performance Expectations

### Healthy System Metrics

| Metric            | Expected  | Good      | Concerning    |
| ----------------- | --------- | --------- | ------------- |
| Bid Success Rate  | >95%      | >98%      | <90%          |
| Bids/Sec Rate     | 2-5       | 4+        | <1            |
| CPU Usage         | <60%      | <40%      | >80%          |
| Memory Stable     | ✅        | ✅        | Growing       |
| Load Distribution | Within 5% | Within 3% | >10% variance |

---

## Advanced: Custom Load Test

### Manually trigger from Node.js

```javascript
const axios = require("axios");

async function runLoadTest() {
  try {
    const res = await axios.post("http://localhost:3001/api/start-load-test", {
      vus: 10,
      duration: 60,
      auctionId: "auction-123",
    });

    console.log("Test started:", res.data);

    // Wait and check status
    setTimeout(async () => {
      const status = await axios.get(
        "http://localhost:3001/api/load-test-status",
      );
      console.log("Current status:", status.data);
    }, 20000);
  } catch (err) {
    console.error("Test error:", err.message);
  }
}

runLoadTest();
```

---

## Architecture Flow

```
┌──────────────────────────────────────────────┐
│         Admin Panel (UI)                     │
│  Start Button → {vus, duration, auctionId}  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ POST /api/start     │
         │ -load-test          │
         └────────┬────────────┘
                  │
                  ▼
      ┌─────────────────────────────┐
      │  Load Test Manager (Node.js)│
      │ + Active State Tracking     │
      │ + Timer Setup              │
      │ + Statistics Collection    │
      └────────┬────────┬────┬─────┘
               │        │    │
         ┌─────▼──┬─────▼──┬─▼──────┐
         │  VU 1  │  VU 2  │ VU N   │
         │ Loop   │ Loop   │ Loop   │
         └────┬───┴────┬───┴───┬────┘
              │        │       │
              └────┬───┴───┬───┘
                   ▼       ▼
          ┌────────────────────────┐
          │  NGINX Load Balancer   │
          │  (Least Connections)   │
          └────┬────┬────┬────┬────┘
               │    │    │    │
         ┌─────▼──┬─▼───┬─▼──┬─▼────┐
         │ Server │Serv │Serv│Server │
         │   1    │  2  │ 3  │   4   │
         └─────┬──┴─┬───┴─┬──┴─┬─────┘
               │    │     │    │
               └────┼─────┼────┘
                    ▼     ▼
              ┌────────────────┐
              │  Redis Cache   │
              │  (Pub/Sub)     │
              └────────┬───────┘
                       │
              ┌────────▼───────┐
              │ Socket.io      │
              │ Adapter Routes │
              │ to All Clients │
              └────────┬───────┘
                       │
              ┌────────▼──────────┐
              │ Admin Panel (UI)  │
              │ Gets Real-time    │
              │ Socket.io Events  │
              └───────────────────┘
```

---

## Summary

✅ **What Works:**

- Multiple virtual users placing bids simultaneously
- Real-time Socket.io feedback to admin UI
- Automatic load distribution across servers
- Statistics tracking (success rate, bids/sec, server distribution)
- 1-click start/stop from UI
- No external tools needed (in-process Node.js)

✅ **Testing Capabilities:**

- Light/normal/heavy/sustained load scenarios
- Performance monitoring
- Load balancing verification
- Real-time bid synchronization under stress

✅ **Production Ready:**

- Graceful error handling
- Rate limit handling
- Auto-stop on duration
- Clean state management

---

**Status:** ✅ Load Testing System Complete and Ready

**Next Steps:**

1. Start a load test from admin UI
2. Monitor real-time logs
3. Check server distribution
4. Verify all servers receiving bids
5. Monitor Redis throughput
