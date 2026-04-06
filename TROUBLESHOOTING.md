# 🛠️ TROUBLESHOOTING FLOWCHART

## START HERE IF SOMETHING ISN'T WORKING

```
┌─ Is MongoDB running? ──────────────┐
│                                    │
│  No → Start: mongod                │
│  Yes ↓                             │
│
│  ┌─ Can you access http://localhost/ ? ──┐
│  │                                        │
│  │  No ↓                                  │
│  │  ├─ docker compose ps                 │
│  │  │  └─ All containers "Up"?           │
│  │  │     No  → docker compose restart   │
│  │  │     Yes ↓                          │
│  │  │     └─ docker compose logs -f      │
│  │  │        (Look for error messages)   │
│  │  │                                    │
│  │  Yes ↓                                │
│  │  ┌─ Does page load?                  │
│  │  │                                   │
│  │  │  No  → See "BLANK PAGE" below    │
│  │  │  Yes ↓                            │
│  │  │  └─ Does page say "Loading..."?  │
│  │  │     Yes → Wait 10s, reload       │
│  │  │     No  ↓                         │
│  │  │     ┌─ Open DevTools (F12)       │
│  │  │     └─ Console shows errors?     │
│  │  │        ├─ CORS error             │
│  │  │        │  → docker compose restart nginx
│  │  │        ├─ API 404/500            │
│  │  │        │  → See "API ERRORS" below
│  │  │        ├─ Socket.io fails        │
│  │  │        │  → See "WEBSOCKET" below
│  │  │        └─ No errors              │
│  │  │           → System working!      │
│  │  │                                   │
│  │  └─ Ngrok access working?           │
│  │     Yes → See "NGROK ISSUES"        │
│  │     No                              │
│  │     └─ ngrok http 80 running?       │
│  │        No  → Start it!              │
│  │        Yes ↓                        │
│  │        └─ Can other users see        │
│  │           Ngrok URL loading?        │
│  │           No  → See "NGROK ISSUES"  │
│  │           Yes → Working!            │
│  │                                    │
│  └────────────────────────────────────┘
│
└────────────────────────────────────┘
```

---

## 🔴 SPECIFIC ISSUES

### BLANK PAGE / NO CONTENT

**Browser shows:** Blank page or "Cannot GET /"

**Checklist:**

```
1. Is frontend/dist/ directory exists?
   ls frontend/dist/index.html

2. If not, rebuild:
   cd frontend
   npm install
   npm run build
   cd ..

3. Is NGINX mounted correctly?
   docker exec auction-nginx ls /usr/share/nginx/html/index.html

4. If missing:
   docker compose down
   docker compose up -d

5. If still blank:
   docker compose logs -f nginx
   (Look for error messages)

6. Clear browser cache:
   Ctrl+Shift+Delete
   Clear cache
   Reload page
```

---

### API ERRORS (500 / 404)

**Symptom:**

```
POST /api/auctions → 500 Internal Server Error
POST /api/bids → 500 Internal Server Error
```

**Root Cause – These steps in order:**

**Step 1: Check MongoDB**

```powershell
# Is it running?
mongod

# Expected output: "waiting for connections on port 27017"

# If error: "port 27017 already in use"
# → Kill existing: netstat -ano | findstr 27017
#                  taskkill /PID <PID> /F

# If error about database directory
# → Ensure mongod.exe can write to: C:\data\db
```

**Step 2: Check Backend Logs**

```powershell
docker compose logs server1

# Look for lines with:
# [DB] ✅ MongoDB connected successfully  ← Should see this
# [DB] Connecting to: ...                ← Check connection string

# If error: "ECONNREFUSED 127.0.0.1:27017"
# → MongoDB not running, see Step 1
```

**Step 3: Check .env File**

```powershell
cat .\.env

# Should show:
# MONGO_URI=mongodb://host.docker.internal:27017/auction_system

# If missing or wrong:
# → Update:
cat > .\.env << 'EOF'
MONGO_URI=mongodb://host.docker.internal:27017/auction_system
EOF
```

**Step 4: Restart Backend**

```powershell
docker compose restart server1 server2 server3 server4

# Wait 10 seconds
Start-Sleep -Seconds 10

# Test again:
curl http://localhost/api/server-info
```

**Step 5: Check Docker to Host Connection**

```powershell
# Docker might not be configured for host.docker.internal

# Get your actual IP:
ipconfig | Select-String "IPv4 Address"

# Update .env:
MONGO_URI=mongodb://<YOUR_IP>:27017/auction_system

# Restart:
docker compose down
docker compose up -d --build
```

---

### WEBSOCKET / SOCKET.IO FAILS

**Symptom:**

```
Browser console: "Socket.io connection error"
Or: No real-time updates for bids
Or: WebSocket connection closes immediately
```

**Debug Steps:**

**Step 1: Check Socket Connection**

```javascript
// In browser DevTools Console (F12):

// Check if socket exists
getSocket();

// Expected: Socket object with .id property
// If error: "getSocket is not defined"
// → Page not loading from correct source

// Check connection status:
console.log(socket.connected); // Should be: true
console.log(socket.id); // Should be: long string like "abc123xyz"
```

**Step 2: Check Network Tab**

```
Browser DevTools → Network tab

Look for: websocket connections
- First try: /socket.io/?transport=websocket
- Fallback: /socket.io/?transport=polling

If WebSocket shows "Pending" forever:
→ See Network Timeout Issues below

If shows "101 Switching Protocols":
→ WebSocket connected successfully!
```

**Step 3: Check NGINX WebSocket Support**

```powershell
# Verify NGINX has WebSocket upgrade headers
docker exec auction-nginx cat /etc/nginx/nginx.conf | grep -A5 "socket.io"

# Should show:
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection $connection_upgrade;
```

**Step 4: Restart NGINX**

```powershell
docker compose restart nginx

# Wait 5 seconds
Start-Sleep -Seconds 5

# Test:
curl http://localhost/health

# Retry browser with Ctrl+Shift+R (hard refresh)
```

**Step 5: Check Backend Socket.io**

```powershell
docker compose logs server1 | grep -i "socket"

# Should show:
# [Socket.io] Client connected: abc123xyz

# If not showing:
# → NGINX not forwarding WebSocket properly
# → Check NGINX logs:
docker compose logs nginx
```

**Step 6: Verify trust proxy setting**

```powershell
docker exec auction-server1 node -e "
const app = require('express')();
console.log('trust proxy:', app.get('trust proxy'));
"

# Should output: trust proxy: 1
```

---

### NETWORK TIMEOUT / HANGING CONNECTIONS

**Symptom:**

```
WebSocket shows "Pending" then "FAILED"
Or: Bids placing but not updating
Or: Page freezes after 1-2 minutes
```

**Root Cause:** NGINX timeouts too short

**Check Current Timeouts:**

```powershell
docker exec auction-nginx grep -i "timeout" /etc/nginx/nginx.conf

# Should show:
# proxy_connect_timeout 7d;
# proxy_send_timeout 7d;
# proxy_read_timeout 7d;

# If not 7d, you have old config
```

**Fix:**

```powershell
# Verify nginx.conf has been updated
cat .\nginx\nginx.conf | Select-String "7d"

# Should show 6 matches (3 for /socket.io/ + others)

# If not, manually rebuild:
docker compose down
git checkout -- nginx/nginx.conf  # Reset from git
# (Or copy from NGROK-DEPLOYMENT-GUIDE.md example)
docker compose up -d --build
```

---

### NGROK ISSUES

**Symptom:**

```
Ngrok shows "Forwarding https://abc123.ngrok.io → http://localhost:80"
But users can't access it
Or: Page loads but nothing works (APIs/WebSocket fail)
```

**Checklist:**

**1. Ngrok Command Correct?**

```powershell
# Correct:
ngrok http 80

# Wrong (would forward to port 3000 backend, not NGINX):
ngrok http 3001
```

**2. Local Access Works First?**

```powershell
# MUST work locally before working on Ngrok
curl http://localhost/
curl http://localhost/api/server-info

# If local fails, fix that first (see above sections)
```

**3. Ngrok URL in Browser Correct?**

```powershell
# Ngrok shows:
# Forwarding     https://abc123.ngrok.io -> http://localhost:80

# Use exactly this URL (with https://, not http://)
# Wrong: http://abc123.ngrok.io   ← Don't use this
# Right: https://abc123.ngrok.io  ← Use this
```

**4. HTTPS Warning?**

```
Browser warning about certificate:
"This site is unsafe" / "SEC_ERROR_UNKNOWN_ISSUER"

This is normal for Ngrok in browser:
→ Click "Advanced"
→ Click "Accept the Risk and Continue"

Ngrok uses self-signed certs for trusted endpoints.
```

**5. Ngrok Link Expired?**

```powershell
# Ngrok free tier:
# - URL changes every ~8 hours
# - OR when you close ngrok and restart

# If old URL stops working:
1. Restart ngrok: ngrok http 80
2. Get new URL from ngrok terminal
3. Share new URL with users

# URL format: https://RANDOMSTRING.ngrok.io
```

**6. Browser Console Shows Errors?**

```javascript
// Open DevTools F12 → Console

// Common error: "Socket.io connection error: CORS error"
// → See WEBSOCKET section above

// Common error: "Cannot POST /api/auctions"
// → See API ERRORS section above

// Common error: "Failed to fetch https://abc123.ngrok.io/api"
// → Add Ngrok domain to browser security settings

// Temporary fix: Open Ngrok localhost:4040
// This shows all requests, good for debugging
// ngrok.io/console → View requests
```

**7. Other Users Can't Access?**

```
Shared URL but they get errors:

1. Verify URL is exactly: https://abc123.ngrok.io
   (not http://, not with .ngrok.io/api, just domain)

2. Have them clear their browser cache first:
   Ctrl+Shift+Delete → Clear All

3. Check Ngrok session is still running:
   Ngrok terminal should show "Status online"

4. If Ngrok crashed:
   docker-compose logs -f nginx
   (Might need to restart)

5. If everything fails, restart everything:
   docker compose down --remove-orphans
   .\deploy-ngrok.ps1
   ngrok http 80
```

---

### FAST RECOVERY (Nuclear Option)

**If everything is broken and nothing works:**

```powershell
# Stop everything
docker compose down --remove-orphans

# Kill any stuck processes
Get-Process | Where-Object {$_.Name -like "*docker*" -or $_.Name -like "*mongo*"} | Stop-Process -Force

# Wait 5 seconds
Start-Sleep -Seconds 5

# Clean rebuild
docker compose build --no-cache

# Fresh start
.\deploy-ngrok.ps1

# If still broken, reset to known good state:
$dirs = @("frontend/dist", "frontend/node_modules", "backend/node_modules")
foreach ($dir in $dirs) {
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
}

# Run deploy script again
.\deploy-ngrok.ps1
```

---

## 🎯 QUICK DIAGNOSTIC CHECK (Copy-Paste This Entire Block)

```powershell
echo "=== DISTRIBUTED AUCTION SYSTEM DIAGNOSTIC ==="
echo ""
echo "[1] MongoDB Check"
try { $socket = New-Object System.Net.Sockets.TcpClient; $socket.ConnectAsync("127.0.0.1", 27017).Wait(3000) | Out-Null; Write-Host "✅ MongoDB: Running" -ForegroundColor Green; $socket.Close() } catch { Write-Host "❌ MongoDB: Not running" -ForegroundColor Red }

echo ""
echo "[2] Docker Check"
$status = docker compose ps --format "{{.Status}}" 2>&1
if ($status -like "*Up*") { Write-Host "✅ Docker: All running" -ForegroundColor Green } else { Write-Host "❌ Docker: Not all running" -ForegroundColor Red; docker compose ps }

echo ""
echo "[3] Frontend Check"
if (Test-Path "frontend/dist/index.html") { Write-Host "✅ Frontend: Built" -ForegroundColor Green } else { Write-Host "❌ Frontend: Not built" -ForegroundColor Red }

echo ""
echo "[4] Local API Check"
try { $r = curl -s http://localhost/api/server-info; if ($r -like "*serverid*" -or $r -like "*ServerID*") { Write-Host "✅ API: Responding" -ForegroundColor Green } else { Write-Host "❌ API: Not responding correctly" -ForegroundColor Red } } catch { Write-Host "❌ API: Error" -ForegroundColor Red }

echo ""
echo "[5] Ngrok Check"
if (Get-Process ngrok -ErrorAction SilentlyContinue) { Write-Host "✅ Ngrok: Running" -ForegroundColor Green } else { Write-Host "⚠ Ngrok: Not running" -ForegroundColor Yellow }

echo ""
echo "=== END DIAGNOSTIC ==="
```

---

## ✅ EVERYTHING IS WORKING IF YOU SEE:

1. Browser opens http://localhost → Shows auction app UI
2. Browser DevTools Console shows: `[Socket.io] Connected: <id>`
3. curl http://localhost/api/server-info → Shows JSON
4. curl http://localhost/health → Shows status "ok"
5. Ngrok terminal shows: `Forwarding https://abc123.ngrok.io → http://localhost:80`
6. Open https://abc123.ngrok.io → Shows same UI as localhost
7. Multiple users: Can see each other's bids in real-time

---

## 🆘 STILL STUCK?

Check these files in order:

1. [QUICK-START.md](QUICK-START.md) — 5 minute overview
2. [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) — Verify each step
3. [NGROK-DEPLOYMENT-GUIDE.md](NGROK-DEPLOYMENT-GUIDE.md) — Deep detailed guide

All code modifications are listed in DEPLOYMENT-CHECKLIST.md with line-by-line explanation.

---

**Remember:** 99% of issues are:

1. MongoDB not running
2. Old frontend dist not rebuilt
3. NGINX not restarted after config change

Try restarting in this order:

```powershell
# 1. Start MongoDB
mongod

# 2. Rebuild frontend
cd frontend; npm run build; cd ..

# 3. Rebuild/restart Docker
docker compose down --remove-orphans
docker compose up -d --build
```

That solves 95% of problems! 🎉
