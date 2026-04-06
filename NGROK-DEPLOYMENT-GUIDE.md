# 🚀 COMPLETE NGROK DEPLOYMENT GUIDE

## Distributed Online Auction System - Internet Exposure Setup

---

## 📋 TABLE OF CONTENTS

1. [Architecture Review & Issues](#architecture-review)
2. [All Code Changes Made](#code-changes)
3. [Step-by-Step Deployment](#deployment-steps)
4. [Running the System](#running-the-system)
5. [Debugging Guide](#debugging)
6. [Distributed Systems Features](#distributed-features)

---

## 🔍 ARCHITECTURE REVIEW {#architecture-review}

### Issues Identified & Fixed

#### **Issue #1: Hardcoded Localhost URLs** ⚠️ CRITICAL

**Problem:**

```javascript
// BEFORE: ❌ Won't work with Ngrok
const api = axios.create({
  baseURL: "http://localhost/api", // ← Hardcoded for local development
});
```

**Why it fails:** When accessed via `https://abc123.ngrok.io`, the browser tries to reach `http://localhost/api` on the user's machine, not the Ngrok tunnel.

**Fix Applied:**

```javascript
// AFTER: ✅ Dynamic URL detection
const getApiBaseURL = () => {
  const { protocol, host } = window.location;
  return `${protocol}//${host}/api`;
};
```

---

#### **Issue #2: Socket.io Relative Path Problem** ⚠️ HIGH

**Problem:**

```javascript
// BEFORE: ❌ Relative path doesn't auto-detect protocol
socket = io("/", { path: "/socket.io" });
```

**Why it fails:**

- Uses `http://` even if accessed via HTTPS (Ngrok always uses HTTPS)
- WebSocket upgrade fails: `wss://` connection attempted on `http://` server

**Fix Applied:**

```javascript
// AFTER: ✅ Detects HTTPS and full URL
const getSocketURL = () => {
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const { host } = window.location;
  return `${protocol}//${host}`;
};
socket = io(getSocketURL(), { path: "/socket.io" });
```

---

#### **Issue #3: NGINX Missing Proxy Headers** ⚠️ HIGH

**Problem:**

```nginx
# BEFORE: ❌ Missing critical headers
location /api/ {
    proxy_pass http://auction_backend/;
    proxy_set_header Host $host;
    # Missing: X-Forwarded-For, X-Forwarded-Proto, X-Real-IP
}
```

**Why it fails:**

- Backend can't determine client IP address
- CORS origin header handling fails
- Ngrok headers lost in transit

**Fix Applied:**

```nginx
# AFTER: ✅ Full proxy header set
location /api/ {
    proxy_pass http://auction_backend/;

    # Standard headers for Ngrok compatibility
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;
}
```

---

#### **Issue #4: WebSocket Headers Missing in NGINX** ⚠️ HIGH

**Problem:**

```nginx
# BEFORE: ❌ Missing WebSocket-specific settings
location /socket.io/ {
    proxy_pass http://auction_backend/socket.io/;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    # Missing timeout configs, buffering settings
}
```

**Why it fails:**

- Default HTTP timeouts too short (60s)
- WebSocket connections time out through Ngrok (which has stricter policies)
- Buffering interferes with WebSocket stream

**Fix Applied:**

```nginx
# AFTER: ✅ WebSocket-optimized settings
location /socket.io/ {
    proxy_pass http://auction_backend/socket.io/;
    proxy_http_version 1.1;

    # CRITICAL: WebSocket upgrade headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    # Long timeouts for persistent connections
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;

    # Disable buffering (breaks WebSocket streaming)
    proxy_buffering off;
}
```

---

#### **Issue #5: Frontend Not Served** ⚠️ HIGH

**Problem:** NGINX only routed API calls, didn't serve React frontend

**Fix Applied:**

```nginx
# AFTER: ✅ Frontend SPA serving
location ~* \.(js|css|png|jpg|jpeg)$ {
    root /usr/share/nginx/html;
    expires 1d;
    add_header Cache-Control "public, immutable";
}

location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;  # React Router fallback
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

#### **Issue #6: Backend Socket.io Not Configured for NGINX** ⚠️ MEDIUM

**Problem:** Backend didn't trust proxy headers from NGINX

**Fix Applied:**

```javascript
// Trust proxy from NGINX
app.set("trust proxy", 1);

// Configure Socket.io for long-lived Ngrok connections
const io = new Server(server, {
  cors: { origin: "*", credentials: true },
  transports: ["websocket", "polling"],

  // Ngrok-specific tuning
  pingInterval: 30000, // Heartbeat every 30s
  pingTimeout: 60000, // 60s before timeout

  trustProxy: true, // Trust X-Forwarded-* headers
});
```

---

#### **Issue #7: CORS Not Fully Configured** ⚠️ MEDIUM

**Problem:** Basic `origin: '*'` insufficient for Ngrok's strict origin validation

**Fix Applied:**

```javascript
app.use(
  cors({
    origin: "*",
    credentials: true, // Allow credentials
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-user-id"],
  }),
);
```

---

## 💻 CODE CHANGES MADE {#code-changes}

### ✅ Modified Files

#### 1️⃣ **frontend/src/services/api.js** — Dynamic API URL

```javascript
const getApiBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { protocol, host } = window.location;
  return `${protocol}//${host}/api`;
};

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});
```

#### 2️⃣ **frontend/src/services/socket.js** — Ngrok-Compatible WebSocket

```javascript
const getSocketURL = () => {
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const { host } = window.location;
  return `${protocol}//${host}`;
};

export const getSocket = () => {
  socket = io(getSocketURL(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    extraHeaders: {
      "ngrok-skip-browser-warning": "true",
    },
  });
};
```

#### 3️⃣ **nginx/nginx.conf** — Complete Rewrite

- Added frontend static file serving
- Added 7-day timeouts for WebSocket connections
- Added X-Forwarded-\* headers
- Added Ngrok-specific headers
- Configured gzip compression
- Added health check support

#### 4️⃣ **backend/src/index.js** — Socket.io & CORS Updates

- Added `app.set('trust proxy', 1)`
- Configured Socket.io with `trustProxy: true`
- Set ping intervals for Ngrok (30s/60s)
- Added full CORS configuration with credentials
- Added credentials support to Socket.io

#### 5️⃣ **frontend/Dockerfile** — Multi-stage Build

```dockerfile
# Stage 1: Build React app
FROM node:18-alpine AS builder
...
RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

#### 6️⃣ **docker-compose.yml** — Frontend Volume Mount

```yaml
nginx:
  image: nginx:alpine
  volumes:
    - ./frontend/dist:/usr/share/nginx/html:ro # ← Frontend files
    - uploads-data:/app/uploads:ro
```

#### 7️⃣ **deploy-ngrok.ps1** — Deployment Script (Windows)

- Builds frontend
- Starts Docker services
- Health checks
- Provides next steps

---

## 🚀 DEPLOYMENT STEPS {#deployment-steps}

### **Phase 1: Prerequisites**

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop
   - Ensure it's running before proceeding

2. **Install Ngrok**

   ```powershell
   # Using Chocolatey (if installed)
   choco install ngrok

   # Or download from: https://ngrok.com/download
   ```

3. **Start MongoDB** (Critical!)

   ```powershell
   # Option A: Start mongod directly
   mongod

   # Option B: Use MongoDB Compass GUI
   # → Install Compass, click "Create" database
   ```

4. **Verify .env file exists**

   ```powershell
   # Check if .env file exists in project root
   Test-Path .\.env  # Should return $true

   # If not, it was already created in our setup
   Get-Content .\.env
   ```

---

### **Phase 2: Build & Deploy**

#### **Option A: Automated (Recommended for Windows)**

```powershell
cd C:\LocalDiskD\Coding\DCProject\Distributed-Auction-System-

# Run deployment script
.\deploy-ngrok.ps1
```

#### **Option B: Manual Steps**

**Step 1: Build Frontend**

```powershell
cd frontend
npm install
npm run build
cd ..

# Verify dist folder was created
ls frontend/dist  # Should show index.html, assets/, etc.
```

**Step 2: Clean Old Containers**

```powershell
docker compose down --remove-orphans
```

**Step 3: Start Services**

```powershell
docker compose up -d --build
```

**Step 4: Verify Services Started**

```powershell
# Check all containers are running
docker compose ps

# Should show:
# auction-server1   running  (port 3001)
# auction-server2   running  (port 3002)
# auction-server3   running  (port 3003)
# auction-server4   running  (port 3004)
# auction-nginx     running  (port 80)
```

**Step 5: Health Check**

```powershell
# Test NGINX is responding
curl http://localhost/

# Test API is responding
curl http://localhost/api/server-info

# Test health endpoint
curl http://localhost/health
```

---

## 🎯 RUNNING THE SYSTEM {#running-the-system}

### **Step 1: Verify Everything is Running**

```powershell
# Check all containers
docker compose ps

# Check Docker logs
docker compose logs -f

# Test local access
# Open browser: http://localhost
```

### **Step 2: Start Ngrok Tunnel**

```powershell
# Terminal 1: Keep docker compose running
# Terminal 2: Start Ngrok

ngrok http 80

# Output will show:
# Forwarding     https://abc123.ngrok.io -> http://localhost:80
```

### **Step 3: Share Public URL**

```
✅ Share this URL with users:
   https://abc123.ngrok.io

Users can access:
- Frontend: https://abc123.ngrok.io
- API: https://abc123.ngrok.io/api
- Health: https://abc123.ngrok.io/health
```

### **Step 4: Test Multi-User Access**

1. **User 1:** Open https://abc123.ngrok.io → Create auction, place bid
2. **User 2:** Open https://abc123.ngrok.io → Join auction, see real-time updates
3. **Both:** Should see bids in real-time via WebSocket

---

## 🐛 DEBUGGING GUIDE {#debugging}

### **API Returns 500 Error**

**Symptom:**

```
POST /api/bids → 500 Internal Server Error
```

**Debug Steps:**

```powershell
# 1. Check backend logs
docker compose logs server1

# 2. Verify backend can reach MongoDB
docker exec auction-server1 curl http://localhost:3001/health

# 3. Test database connection directly
docker exec auction-server1 node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://host.docker.internal:27017/auction_system')
  .then(() => console.log('✅ DB OK'))
  .catch(e => console.log('❌ DB Failed:', e.message));
"

# 4. Check MONGO_URI in .env
cat .\.env | Select-String "MONGO_URI"

# 5. Restart affected service
docker compose restart server1
```

**Common Causes:**
| Cause | Fix |
|-------|-----|
| MongoDB not running | Start mongod or MongoDB Compass |
| MONGO_URI wrong in .env | Update .env with correct connection string |
| Backend container can't reach host | Ensure `extra_hosts: host.docker.internal:host-gateway` in docker-compose |
| Port conflict | Check `docker ps` for duplicate port bindings |

---

### **Socket.io Connection Fails**

**Symptom:**

```
Console Error: Socket.io connection error: CORS error
Real-time updates not working
```

**Debug Steps:**

```powershell
# 1. Check Socket.io connection in browser console
# Open DevTools (F12) → Console tab
# Should show: "[Socket.io] Connected: abc123xyz"
# If not, check Network tab for socket.io requests

# 2. Check NGINX Socket.io config
docker compose logs nginx

# 3. Test WebSocket directly
$ws = New-WebSocket "ws://localhost/socket.io/?transport=websocket"
$ws.Connect()  # Should not error

# 4. Verify firewall allows WebSocket
# Windows Defender → Allow App Through Firewall
# Ensure port 80 is open

# 5. Restart NGINX
docker compose restart nginx
```

**Common Causes:**
| Cause | Fix |
|-------|-----|
| Frontend using `http://` on HTTPS Ngrok URL | Already fixed in socket.js |
| NGINX WebSocket timeouts too short | Already fixed in nginx.conf (7d timeout) |
| Backend CORS not allowing WebSocket origin | Already fixed with `credentials: true` |
| Firewall blocking port 80 | Allow through Windows Defender |
| `proxy_buffering` enabled | Already disabled in nginx.conf |

---

### **Ngrok Link Works, Frontend Can't Connect**

**Symptom:**

```
Browser shows blank page OR
Console shows: "Cannot GET /api/auctions"
```

**Debug Steps:**

```powershell
# 1. Check frontend was built correctly
ls frontend/dist/
# Should show: index.html, assets/, manifest.json

# 2. Check NGINX is serving frontend files
curl https://abc123.ngrok.io/

# 3. Check NGINX volume mount
docker exec auction-nginx ls /usr/share/nginx/html/
# Should show: index.html, assets/, etc.

# 4. Check browser console for API URL
# Open DevTools (F12) → Console
# Type: `console.log(window.location.origin)`
# Should show: https://abc123.ngrok.io

# 5. Verify NGINX is forwarding API calls
curl https://abc123.ngrok.io/api/server-info

# 6. Rebuild frontend if dist is stale
cd frontend
npm run build
cd ..

# 7. Force NGINX to reload cache
docker compose restart nginx
```

**Common Causes:**
| Cause | Fix |
|-------|-----|
| frontend/dist doesn't exist | Run `cd frontend && npm run build` |
| NGINX docker-compose volume wrong path | Verify: `./frontend/dist:/usr/share/nginx/html` |
| Frontend built without compiled API calls | Run `npm run build` in frontend/ |
| NGINX caching old files | `docker compose restart nginx` |

---

### **Distributed-Only Issues**

**Leader Election Not Operating**

```powershell
# Check leader election logs
docker compose logs server1 | grep -i "leader"

# Force election by stopping leader
docker compose restart server4  # If server4 is leader

# Check new leader elected
curl http://localhost/health | grep currentLeader
```

**Heartbeat Failures**

```powershell
# Check health of all servers
for ($i=1; $i -le 4; $i++) {
    curl "http://localhost:300$i/health"
}

# Check internal communication logs
docker compose logs server1 | grep -i "heartbeat"
```

**Bid Replication Issues**

```powershell
# Place bid on one server
curl -X POST http://localhost:3001/api/bids \
  -H "Content-Type: application/json" \
  -d '{"auctionId": "1", "amount": 100}'

# Check if replicated to other servers
curl http://localhost:3002/api/bids/1
curl http://localhost:3003/api/bids/1
curl http://localhost:3004/api/bids/1
```

---

## 🎓 DISTRIBUTED SYSTEMS FEATURES {#distributed-features}

Your system now demonstrates real distributed concepts:

### **1. Load Balancing** ⚖️

```
Browser Request → Ngrok → NGINX → Chooses one of 4 backend servers
                          (least_conn algorithm)

View with: docker compose logs nginx | grep upstream

Try:
- Create multiple auctions
- Place bids from different browsers
- Each request goes to different server
```

### **2. Leader Election (Bully Algorithm)** 🗳️

```
How it works:
- Server 4 has highest ID → Elected as leader
- Server 4 coordinates data writes
- If Server 4 crashes → Server 3 elected → Server 2 → Server 1

Test it:
docker compose stop server4
# Wait 30s, check /health endpoint
curl http://localhost/health | grep currentLeader
# Should show: "currentLeader": "3"

docker compose start server4
# Current leader reverts to 4
```

### **3. Heartbeat Monitoring** 💓

```
Each server sends heartbeat every 5 seconds:
- Server 1 → Server 2, 3, 4
- Detects crashed servers
- Triggers leader election if needed

View heartbeats: docker compose logs server1 | grep heartbeat
```

### **4. Lamport Logical Clocks** 🕐

```
Orders events consistently across distributed system:
- Each bid gets Lamport timestamp
- Ensures bids ordered correctly despite clock skew

Test:
1. Place bids rapidly from different browsers
2. Check /health endpoint
3. See lamportClock incrementing: 1, 2, 3, 4...
```

### **5. Data Replication** 📋

```
Read-after-write consistency:
- User places bid on Server 1
- Server 1 replicates to Servers 2, 3, 4
- All servers have up-to-date data
- Any server can answer queries consistently

Test:
1. POST bid to server1:3001
2. GET bids from server2:3002
3. Both return same data (replicated)
```

### **6. Fault Tolerance** 🛡️

```
System survives server crashes:
- 3 servers running = fully operational
- 2 servers running = degraded but functional
- 1 server running = read-only (no leader election)

Test:
docker compose stop server2
docker compose stop server3
# System still responsive (server1 + server4)

docker compose start server2
docker compose start server3
# Rejoined servers resync automatically
```

---

## 📊 MONITORING & OBSERVABILITY

### **Real-Time Monitoring**

```powershell
# All logs in real-time
docker compose logs -f

# Specific service
docker compose logs -f server1

# Follow NGINX
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 server1
```

### **Performance Metrics**

```powershell
# Container stats (CPU, Memory, Network)
docker stats auction-server1 auction-server2 auction-nginx

# API latency test
Measure-Command {
    curl -s http://localhost/api/server-info | Out-Null
} | Select-Object TotalMilliseconds

# Concurrent connections
netstat -an | Select-String "ESTABLISHED" | Measure-Object
```

### **Distributed System Metrics**

```powershell
# Check leader status
curl http://localhost/health | ConvertFrom-Json | Select currentLeader, isLeader

# Check Lamport clock progression
for ($i=0; $i -lt 5; $i++) {
    curl -s http://localhost/health | ConvertFrom-Json | Select lamportClock
    Start-Sleep -Milliseconds 200
}

# Check replication lag
# (All servers should have same auction data)
for ($i=1; $i -le 4; $i++) {
    "Server $i:"; curl -s "http://localhost:300$i/api/auctions" | ConvertFrom-Json | Measure-Object -Property length
}
```

---

## 🚨 TROUBLESHOOTING CHECKLIST

Before reporting issues, verify:

- [ ] MongoDB running: `mongod` or MongoDB Compass
- [ ] .env file exists: `cat .\.env | Select-String MONGO_URI`
- [ ] Docker running: `docker ps` (shows containers)
- [ ] All containers healthy: `docker compose ps` (status = Up)
- [ ] Frontend built: `ls frontend/dist/index.html`
- [ ] Local access works: `curl http://localhost`
- [ ] Ngrok running: `ngrok http 80` (shows forwarding URL)
- [ ] External access works: Open Ngrok URL in browser

---

## 📞 QUICK REFERENCE

| Task                 | Command                                                  |
| -------------------- | -------------------------------------------------------- |
| Start system         | `.\deploy-ngrok.ps1` OR `docker compose up -d`           |
| Stop system          | `docker compose down`                                    |
| View logs            | `docker compose logs -f`                                 |
| Rebuild frontend     | `cd frontend && npm run build && cd ..`                  |
| Restart NGINX        | `docker compose restart nginx`                           |
| Restart all backends | `docker compose restart server1 server2 server3 server4` |
| Clean everything     | `docker compose down -v`                                 |
| Start Ngrok          | `ngrok http 80`                                          |
| Test API             | `curl https://abc123.ngrok.io/api/server-info`           |

---

## 📝 FINAL SUMMARY

Your distributed auction system is now:
✅ Frontend: React + Vite (dynamic URL detection)
✅ Backend: 4 Node.js servers (load balanced)
✅ Database: MongoDB (distributed queries)
✅ Protocol: HTTP/HTTPS with WebSocket support
✅ Networking: NGINX reverse proxy + Ngrok tunnel
✅ Distributed: Leader election, heartbeat, replication, Lamport clocks
✅ Ready: For multi-user internet access

**Next step:** Run `.\deploy-ngrok.ps1` and share the Ngrok URL! 🎉
