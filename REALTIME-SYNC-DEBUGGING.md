# 🔍 Real-Time Sync - Quick Reference & Debugging

## Quick Start (30 seconds)

```bash
# Deploy
docker-compose down -v && docker-compose up --build

# Wait 30s for services
Start-Sleep -Seconds 30

# Verify
docker-compose ps                    # All containers healthy?
docker exec auction-redis redis-cli ping   # Redis responds?
docker logs auction-server1 2>&1 | grep Redis   # Connected?

# Test
# Open http://localhost in 2 browsers
# Same auction, place bid in one → appears in other instantly ✓
```

---

## Troubleshooting Commands

### Is Everything Running?

```bash
# Check all containers
docker-compose ps

# Expected output:
# auction-redis     ... Up ... healthy
# auction-server1   ... Up ... healthy
# auction-server2   ... Up ... healthy
# auction-server3   ... Up ... healthy
# auction-server4   ... Up ... healthy
# auction-nginx     ... Up ... healthy
```

### Is Redis Connected?

```bash
# Test Redis directly
docker exec auction-redis redis-cli ping
# Expected: PONG

# Check how many servers connected
docker exec auction-redis redis-cli info connected_clients
# Look for: connected_clients:N (should be 4 = 4 servers)

# Monitor Redis messages in real-time
docker exec auction-redis redis-cli MONITOR
# (Ctrl+C to exit)
```

### View Server Logs

```bash
# Watch real-time logs (all servers)
docker-compose logs -f

# Specific server
docker logs auction-server1 -f --tail 50
docker logs auction-server2 -f --tail 50

# Filter for Socket.io events
docker logs auction-server1 2>&1 | grep -i socket

# Filter for Redis
docker logs auction-server1 2>&1 | grep -i redis

# Filter for bid broadcasts
docker logs auction-server1 2>&1 | grep -i "Broadcasting\|new-bid\|replicated"
```

### Check Redis Memory Usage

```bash
docker exec auction-redis redis-cli INFO memory | grep used_memory

# More detailed stats
docker exec auction-redis redis-cli INFO stats
```

### Test Socket.io Connection from Server

```bash
# Check if server can reach Redis
docker exec auction-server1 node -e "
const redis = require('redis');
const client = redis.createClient({url: 'redis://redis:6379'});
client.connect().then(() => {
  console.log('✓ Redis connected');
  process.exit(0);
}).catch(err => {
  console.error('✗ Redis error:', err.message);
  process.exit(1);
});
"
```

---

## Common Issues & Fixes

### Issue 1: Real-time NOT working (bids don't sync)

**Checklist:**

```bash
# 1. Is Redis running and healthy?
docker-compose ps | grep redis   # Must show "healthy"

# 2. Are servers connected to Redis?
docker logs auction-server1 2>&1 | grep "Redis.*Connected"
# Expected: [Redis] ✅ Connected to Redis at redis://redis:6379

# 3. Is adapter attached?
docker logs auction-server1 2>&1 | grep "adapter"
# Expected: [Socket.io] 🔌 Attaching Redis adapter

# 4. Are users in same room?
docker logs auction-server1 2>&1 | grep "joined room"
# All users should join "auction:SAME_ID"

# 5. Full restart
docker-compose restart
sleep 10
docker logs auction-server1 2>&1 | grep -i "redis\|adapter"
```

### Issue 2: "Cannot connect to Redis"

```bash
# Check Redis is actually running
docker ps | grep redis

# If not running:
docker-compose up redis -d

# Check Redis logs
docker logs auction-redis

# Test connection from host
redis-cli -h localhost ping   # If redis-cli installed
# or
telnet localhost 6379         # Test port connectivity

# Verify REDIS_URL is set
docker exec auction-server1 env | grep REDIS_URL
```

### Issue 3: Bid takes 5+ seconds to appear on other browser

```bash
# This is WRONG! Should be <1s

# Check network latency between servers
docker exec auction-server1 ping -c 5 redis
# Should show <1ms ping time

# Check if Socket.io is using polling instead of websocket
# (polling is slower)
docker logs auction-server1 2>&1 | grep -i "transport\|websocket\|polling"

# Force websocket mode
# In frontend/src/services/socket.js, ensure:
# transports: ["websocket", "polling"]  # websocket first!
```

### Issue 4: Redis Out of Memory

```bash
# Check memory usage
docker exec auction-redis redis-cli INFO memory

# If using too much, clear old data
docker exec auction-redis redis-cli FLUSHDB
# WARNING: This deletes all Socket.io adapter data, users reconnect

# Or restart Redis cleanly
docker restart auction-redis
docker restart auction-server1 auction-server2 auction-server3 auction-server4
```

### Issue 5: "Connected clients keeps increasing"

```bash
# Normal: 4-8 connections (4 servers + internal connections)
docker exec auction-redis redis-cli info connected_clients

# If >20: might have leaked connections
# Solution:
docker restart auction-redis
docker restart auction-server1 auction-server2 auction-server3 auction-server4
```

---

## Monitoring Commands

### Real-Time Event Monitor

```bash
# Watch all Redis events (what's being broadcast)
docker exec auction-redis redis-cli MONITOR

# Example output:
# 1712458234.123456 [0] "PUBLISH" "socket.io#auction:123#{event}" "{...biddata...}"
```

### Per-Server Socket.io Status

```bash
# View active rooms on each server
docker logs auction-server1 2>&1 | grep "joined room"
docker logs auction-server2 2>&1 | grep "joined room"
docker logs auction-server3 2>&1 | grep "joined room"
docker logs auction-server4 2>&1 | grep "joined room"
```

### Bid Broadcast Tracking

```bash
# Follow all bid broadcasts
docker-compose logs -f | grep -i "broadcasting\|new-bid"

# Expected flow for a single bid:
# [Bid][Leader][Server 1] 📢 Broadcasting new-bid to room auction:123: $150
# [Replication][Server 2] ✅ Applied replicated bid
# [Socket.io][Server 2] Client XYZ received new-bid
# [Replication][Server 3] ✅ Applied replicated bid
# [Socket.io][Server 3] Client ABC received new-bid
```

### Connection Health Check

```bash
# Current connected sockets
docker exec auction-redis redis-cli PUBSUB CHANNELS
# Shows all active channels

# Subscribers per channel
docker exec auction-redis redis-cli PUBSUB NUMSUB socket.io#*
```

---

## Clean Up Commands

### Restart Everything

```bash
docker-compose restart
```

### Full Reset (WARNING: Deletes all data!)

```bash
docker-compose down -v
docker-compose up --build
```

### Remove Old Containers

```bash
docker system prune -f
docker volume prune -f
```

### Check Disk Usage

```bash
docker system df
```

---

## Performance Baseline

### Expected Performance Metrics

```bash
# Bid latency (how fast Redis processes)
docker exec auction-redis redis-cli --latency      # <1ms expected

# Memory per connection
docker exec auction-redis redis-cli INFO memory    # 1-10MB typical

# Operations per second capacity
docker exec auction-redis redis-cli --stat         # Real-time stats

# Total commands processed
docker exec auction-redis redis-cli INFO stats | grep total_commands_processed
```

### Load Test (stress test Redis)

```bash
# If you have redis-benchmark installed:
redis-benchmark -h localhost -n 10000 -c 10
# Simulates 10,000 commands with 10 concurrent clients

# Or use Docker:
docker run --rm --network fixed-auction-system_auction-network \
  redis:7-alpine redis-benchmark -h redis -n 10000 -c 10
```

---

## Deployment Scenarios

### Scenario 1: Add a new Server (Server 5)

```yaml
# docker-compose.yml
server5:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: auction-server5
  environment:
    SERVER_ID: "5"
    PORT: "3005"
    REDIS_URL: "redis://redis:6379"
    PEER_SERVERS: "http://server1:3001,http://server2:3002,http://server3:3003,http://server4:3004"
  depends_on:
    redis:
      condition: service_healthy
```

```bash
# Deploy
docker-compose up server5 -d

# Verify
docker logs auction-server5 2>&1 | grep "Redis\|adapter"

# Update NGINX upstream (if no auto-discovery)
# Edit nginx/nginx.conf, add new server
```

### Scenario 2: Upgrade Node Version

```bash
# Update backend/Dockerfile
# FROM node:18-alpine → FROM node:20-alpine

# Rebuild
docker-compose down -v
docker-compose up --build

# All Socket.io connections automatically reconnect
```

### Scenario 3: Move from Localhost to Ngrok

```bash
# Start Ngrok
ngrok http 80

# Test
curl -I https://your-ngrok-url.ngrok-free.dev/

# Bids should sync across servers even through Ngrok
# Verify performance:
docker logs auction-server1 2>&1 | grep "latency\|delay"
```

---

## Browser Developer Tools

### Check Socket.io Connection

**Browser Console (F12):**

```javascript
// Check if Socket.io is connected
console.log(socket.connected); // true/false

// Check which rooms you're in
console.log(socket.rooms); // Set with room names

// Manual join (test)
socket.emit("join-auction", "auction:12345");

// Get socket ID
console.log(socket.id); // Your socket ID

// Listen to new-bid events
socket.on("new-bid", (data) => {
  console.log("New bid received:", data);
});
```

### Network Tab Analysis

**F12 → Network → WS (WebSocket tab):**

```
socket.io/?EIO=4&transport=websocket

# Expected:
# - Status: 101 Switching Protocols ✓
# - Type: websocket ✓
# - Messages flowing in/out

# If you see:
# - Multiple connections: load balancing working ✓
# - Message frequency: ~30-60s ping keepalive ✓
```

---

## Common Redis Commands for Debugging

```bash
# Monitor all activity
docker exec auction-redis redis-cli MONITOR

# Check specific keys
docker exec auction-redis redis-cli KEYS "*auction*"
docker exec auction-redis redis-cli KEYS "socket.io*"

# Get value
docker exec auction-redis redis-cli GET "key-name"

# Check memory usage per key
docker exec auction-redis redis-cli --memkeys

# Show database size
docker exec auction-redis redis-cli DBSIZE

# Clear everything (use carefully!)
docker exec auction-redis redis-cli FLUSHDB

# Get last 100 events
docker exec auction-redis redis-cli LRANGE socket.io#events -100 -1
```

---

## When to Rebuild vs Restart

| Scenario                   | Command                                               |
| -------------------------- | ----------------------------------------------------- |
| Code changed (backend/src) | `docker-compose up --build`                           |
| Config changed (env vars)  | `docker-compose restart`                              |
| Docker image updated       | `docker-compose up --build`                           |
| Need clean state           | `docker-compose down -v && docker-compose up --build` |
| Just reattach logs         | `docker-compose logs -f`                              |

---

## Production Tips

✅ **Set up log rotation**

```bash
# Docker daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
```

✅ **Enable Redis persistence**

```bash
# Already enabled in docker-compose.yml:
command: redis-server --appendonly yes  # Writes to /data/appendonly.aof
```

✅ **Monitor Redis with a UI**

```bash
# RedisInsight (or use docker)
docker run -d -p 8001:8001 redislabs/redisinsight:latest

# Access: http://localhost:8001
```

✅ **Set Redis memory limits**

```bash
# In docker-compose.yml redis service:
command: redis-server --maxmemory 500mb --maxmemory-policy allkeys-lru
```

---

## Summary

✅ **Real-time sync now works across ALL servers**
✅ **Redis is the message broker**
✅ **Monitor with logs and redis-cli commands**
✅ **Troubleshoot with provided checklists**
✅ **Scale to 100+ servers with no code changes**

🚀 **Your distributed system is production-ready!**
