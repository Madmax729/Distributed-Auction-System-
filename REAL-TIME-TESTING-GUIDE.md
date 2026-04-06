# 🧪 REAL-TIME BID UPDATES - TESTING GUIDE

## Pre-Testing Checklist

✅ MongoDB running...

```powershell
# Check MongoDB
mongod  # or MongoDB Compass running

# Verify connection
curl http://localhost/health
# Should show: {"status":"ok", ...}
```

✅ Backend rebuilt...

```powershell
# Rebuild backend images
docker compose build --no-cache server1 server2 server3 server4

# Restart servers
docker compose restart server1 server2 server3 server4
```

✅ Frontend rebuilt...

```powershell
cd frontend
npm run build
cd ..

# Verify dist exists
ls frontend/dist/
```

✅ Docker compose running...

```powershell
docker compose up -d

# Verify all containers
docker compose ps
# All 5 containers should show "Up"
```

---

## TEST 1: Single User - Basic Real-Time ✓

### Setup

```
1. Open browser: http://localhost (or https://ngrok-url)
2. Create account with username
3. Press F12 (DevTools)
4. Go to Console tab
```

### Test Steps

```
1. Create new auction:
   - Click "Create Auction"
   - Title: "Test Laptop"
   - Starting price: $100
   - Duration: 30 minutes
   - Click Submit

2. Watch Console for logs:
   [Socket.io] Joining room: auction:abc123

3. Place first bid ($101):
   - Enter amount: 101
   - Click "Place Bid"
   - ✅ EXPECT: Bid appears IMMEDIATELY in feed
   - ✅ EXPECT: Current price updates to $101
   - ✅ EXPECT: Toast shows "Bid placed!"
   - ✅ EXPECT: Suggested next bid is $102

4. Place second bid ($150):
   - Enter: 150
   - Click Place
   - ✅ EXPECT: Instant update
   - ✅ EXPECT: Your bid appears at top of feed
   - ✅ EXPECT: Price shows $150

5. Verify NO manual refresh needed
```

### Expected Console Output

```
[Socket.io] Connecting to: http://localhost
[Socket.io] Connected: socket-id-abc123xyz
[Socket.io] Joining room: auction:def456ghi789
[Socket.io] Client xyz joined room: auction:def456ghi789
🔥 RECEIVED BID: {auctionId: "def456...", bid: {...}, currentHighestBid: 150}
```

### Expected UI

```
Bid Feed shows:
- Your Name: $150 (just now) ← Your bid
- Your Name: $101 (1s ago)

Current Price: $150 ✓
Next bid must be: $151 ✓
```

---

## TEST 2: Two Browsers - Real-Time Sync ✓

### Setup

```
1. Open Browser A: http://localhost
   - Username: Alice
   - Create auction: "Test Item"

2. Open Browser B: http://localhost (or different computer on LAN)
   - Username: Bob
   - Open DevTools (F12)
   - Go to Console tab
```

### Test Steps

```
Browser A (Alice):
1. Create auction, starting price $50
2. Place bid: $60
3. Console should show: 🔥 RECEIVED BID: {currentHighestBid: 60}
4. UI shows: Price $60, your bid in feed

Browser B (Bob):
1. Search/find the auction Alice created
2. Open auction details
3. Look at current price
   ✅ EXPECT: Shows $60 (Alice's bid)
   ✅ EXPECT: Alice's bid in feed
4. Console shows: 🔥 RECEIVED BID: {auctionId: "...", ...}
5. Place bid: $75
6. Console: 🔥 RECEIVED BID: $75
7. UI updates instantly

Browser A:
✅ EXPECT: Current price changes to $75 instantly
✅ EXPECT: Bid feed updates with "Bob: $75 (just now)"
✅ EXPECT: Toast: "Bob bid $75" appears
✅ NO manual refresh needed!

Browser B:
9. Place bid: $100
10. UI instantly shows $100

Browser A:
✅ EXPECT: Instantly sees $100 from Bob
✅ No refresh needed!
```

### Success Criteria

```
✅ When Alice places bid → Bob sees it within 100ms
✅ When Bob places bid → Alice sees it within 100ms
✅ Both show same current price
✅ Bid feed in sync
✅ No manual refresh needed
```

---

## TEST 3: Multi-Server Leader/Follower ✓

### Prerequisites

```
All 4 backend servers running (docker compose ps):
- server1 (port 3001)
- server2 (port 3002)
- server3 (port 3003)
- server4 (port 3004) ← Leader (highest ID)
```

### Setup

```
Browser A: http://localhost
Browser B: http://localhost (second device preferred)
```

### Test Steps

```
1. Check which server is leader:
   curl http://localhost/health

   Output: {"currentLeader": 4, ...}
   → Server 4 is leader ✓

2. Browser A - Create auction, bid $100

3. Browser B - View auction
   ✅ EXPECT: See $100 bid from Browser A
   ✅ EXPECT: Instantly updated via Socket.io

4. Browser B - Place bid $150

   Check backend logs:
   docker compose logs server4 | grep "Accepted: 150"
   Output: [Bid][Leader Server 4] Accepted: $150 by uuid...

   Also check followers:
   docker compose logs server1 | grep "Received replication"
   docker compose logs server2 | grep "Received replication"
   docker compose logs server3 | grep "Received replication"

   ✅ EXPECT: All three followers replicated the bid

5. Browser A:
   ✅ EXPECT: Current price updates to $150 instantly
   ✅ EXPECT: Bob's bid in feed
   ✅ EXPECT: Socket event arrived from any server via NGINX

6. Verify multi-server broadcasting:
   - Browser A connected to server1
   - Browser B connected to server3
   - Leader processes on server4
   - Replication to servers 2,3
   - Both browsers get update via their connected server ✓
```

### Expected Logs

```
# Server 4 (Leader) processes bid
[Bid][Leader Server 4] Accepted: $150 by bob-uuid

# Followers receive replication
[Internal][Server 1] Received replication from Leader 4: bid 123...
[Internal][Server 2] Received replication from Leader 4: bid 123...
[Internal][Server 3] Received replication from Leader 4: bid 123...

# Followers broadcast to their clients
[Replication] ✓ Bid applied successfully
[Replication] Broadcast to followers' clients on auction:abc123
```

---

## TEST 4: Socket.io Room Consistency ✓

### Setup

```
Open DevTools Console
```

### Test Steps

```
1. Create/open auction

   Watch console for:
   [Socket.io] Joining room: auction:abc123def456
   [Socket.io] Client xyz joined room: auction:abc123def456

   ✅ EXPECT: Room name format: auction:${auctionId}
   ✅ EXPECT: No room name: auction-${id} (hyphen)

2. Switch to another auction

   Console shows:
   [AuctionPage] Cleanup: removing listeners for auction old-id
   [Socket.io] Leaving room: auction:old-id
   [Socket.io] Leaving room: auction:new-id
   [Socket.io] Joining room: auction:new-id

   ✅ EXPECT: Clean teardown of old room
   ✅ EXPECT: Proper join to new room

3. Place bid

   Network tab shows WebSocket message:
   {
     "type": "new-bid",
     "data": {...}
   }

   ✅ EXPECT: Message arrives via WebSocket
   ✅ EXPECT: Event name: "new-bid" (exact)
   ✅ EXPECT: Contains auctionId, bid data
```

---

## TEST 5: Optimistic Updates ✓

### Test Steps

```
1. Open Browser A - Create auction

2. Place bid with network throttling:
   DevTools → Network tab
   Set throttling: Slow 3G (400ms latency)

3. Click "Place Bid"

   ✅ EXPECT: UI updates INSTANTLY (no wait)
   ✅ EXPECT: Current price shows new bid immediately
   ✅ EXPECT: Bid appears in feed immediately
   ✅ EXPECT: After 2-3 seconds, socket confirms with full data

   Timeline:
   t=0ms: Click Place Bid
   t=5ms: UI shows optimistic bid ✓
   t=2000ms: Socket confirmation arrives
   t=2010ms: UI updates with confirmed data ✓

4. Remove throttling

5. Place another bid

   ✅ EXPECT: Still instant (no network delay visible)
```

### Success Criteria

```
✅ User sees bid immediately upon placing
✅ No "loading" state between click and UI update
✅ Perceived latency = 0 (all latency is hidden on backend)
✅ Socket confirmation matches optimistic update
```

---

## TEST 6: Event Listener Cleanup ✓

### Setup

```
DevTools → Console
```

### Test Steps

```
1. Open auction A
   Console shows: [Socket.io] Joining room: auction:a123...

2. Place few bids
   Each shows: 🔥 RECEIVED BID: {...}

3. Go back (navigate to another page)
   Console shows:
   [AuctionPage] Cleanup: removing listeners for auction a123
   [Socket.io] Leaving room: auction:a123

   ✅ EXPECT: Cleanup logs shown
   ✅ EXPECT: Listeners removed

4. Open auction B
   New join shown:
   [Socket.io] Joining room: auction:b456...

5. Place bid in auction B
   Console shows: 🔥 RECEIVED BID from b456

6. Go back to auction A
   ✅ EXPECT: DO NOT see duplicate events
   ✅ EXPECT: DO NOT see events from auction B
   ✅ EXPECT: Listeners properly isolated
```

---

## TEST 7: Leader Failover ✓

### Setup

```
All 4 servers running
Browser A + B viewing same auction
Both in Console tab
```

### Test Steps

```
1. Verify Server 4 is leader:
   curl http://localhost/health | grep currentLeader

   Output: "currentLeader": 4

2. Browser A/B place bid $75
   ✅ EXPECT: Processed by Server 4
   ✅ EXPECT: Both clients see update

3. Simulate leader crash:
   docker compose stop server4

   Console shows:
   [Socket.io] Disconnected: transport close
   [Socket.io] Reconnection attempt 1

4. Wait 15 seconds (election timeout)

   curl http://localhost/health
   Output: "currentLeader": 3

   ✅ EXPECT: New leader elected (Server 3)
   ✅ EXPECT: Browsers reconnect

5. Both browsers place bid $100

   ✅ EXPECT: Processed by new leader (Server 3)
   ✅ EXPECT: Followers (servers 1,2) replicate
   ✅ EXPECT: Both clients see update
   ✅ EXPECT: NO manual action needed

6. Restart server 4:
   docker compose start server4

   ✅ EXPECT: Server 4 rejoins
   ✅ EXPECT: May become leader again
   ✅ EXPECT: System continues working
```

---

## COMMON ISSUES & FIXES

### Issue: Bid not showing in feed

```
✗ PROBLEM: Clicked Place Bid, nothing happened

DO THIS:
1. Check Console:
   - Do you see: 🔥 RECEIVED BID?
   - If NO → Socket not receiving events
   - If YES → UI not updating (React bug)

FIX IF NO RECEIVED BID:
docker compose logs | grep "auction:"
# Look for room join logs

If join missing:
- Hard refresh: Ctrl+Shift+R
- Check Socket.io is connected:
  console.log(getSocket().connected)
  # Should print: true

FIX IF RECEIVED BID BUT NOT IN UI:
- React state not updating
- Check devtools: React tab
- Look for handleNewBid function
```

### Issue: See other user's bid late (5+ seconds delay)

```
✗ PROBLEM: Alice places bid, Bob sees it after 5 seconds

LIKELY CAUSE:
1. MongoDB slow queries
2. Replication lag on followers
3. Socket.io buffering

CHECK LOGS:
docker compose logs server4 | grep "Lamport\|Accepted"
# Look for timing of acceptance

docker compose logs server1 | grep "Received\|replication"
# Look for replication delay

SOLUTION:
docker compose restart server4  # Restart leader
docker compose restart server1 server2 server3  # Restart followers
```

### Issue: Browser keeps reconnecting (Socket.io keeps showing Disconnected)

```
✗ PROBLEM: Console shows repeated:
[Socket.io] Disconnected: transport close
[Socket.io] Reconnection attempt X

LIKELY CAUSE:
1. NGINX not configured for long-lived WebSocket
2. Proxy timeout too short
3. Firewall blocking WebSocket

CHECK:
cat nginx/nginx.conf | grep -i "proxy_read_timeout"
# Should show: proxy_read_timeout 7d;

SOLUTION:
docker compose down --remove-orphans
docker compose up -d --build  # Rebuild with fixed nginx.conf
Hard refresh: Ctrl+Shift+R
```

### Issue: Optimistic update doesn't match server confirmation

```
✗ PROBLEM: Bid $100 appears, then changes to $95

LIKELY CAUSE:
Backend validation rejected the bid but UI already showed it

FIX:
This is actually safe! Frontend optimistic update + server confirmation flow.
The UI will self-correct if server rejects.

To prevent:
- Add client-side validation BEFORE optimistic update
- Check: newBid > currentHighestBid
- Show error toast if validation fails
```

---

## VERIFICATION MATRIX

| Test                              | Expected | Status   |
| --------------------------------- | -------- | -------- |
| Single user bids appear instantly | ✅       | ⬜ CHECK |
| Two users see each other's bids   | ✅       | ⬜ CHECK |
| Multi-server replication works    | ✅       | ⬜ CHECK |
| Room naming is consistent         | ✅       | ⬜ CHECK |
| Listener cleanup works            | ✅       | ⬜ CHECK |
| Leader failover continues bidding | ✅       | ⬜ CHECK |
| Optimistic updates show instantly | ✅       | ⬜ CHECK |
| No console errors                 | ✅       | ⬜ CHECK |
| All 4 servers exchanging data     | ✅       | ⬜ CHECK |

---

## FINAL TEST: Load Test

```powershell
# Test 10 concurrent bids

cd k6
# Edit load-test.js to increase bid count

# Run load test
docker run --rm -u 0 -v $PWD:/scripts grafana/k6 run /scripts/load-test.js

# EXPECT:
# ✅ All bids appear in real-time
# ✅ No socket errors
# ✅ Latency < 200ms
# ✅ All bids replicated to followers
```

---

## SUCCESS CHECKLIST

- [ ] All 4 backend servers running
- [ ] MongoDB connected
- [ ] Frontend built in dist/
- [ ] NGINX serving frontend
- [ ] TEST 1 passed: Single user real-time ✓
- [ ] TEST 2 passed: Two users sync ✓
- [ ] TEST 3 passed: Multi-server replication ✓
- [ ] TEST 4 passed: Room consistency ✓
- [ ] TEST 5 passed: Optimistic updates ✓
- [ ] TEST 6 passed: Listener cleanup ✓
- [ ] TEST 7 passed: Leader failover ✓
- [ ] No console errors
- [ ] No backend logs errors
- [ ] All features working

---

🎉 If all tests pass, your real-time bid system is **fully operational!**
