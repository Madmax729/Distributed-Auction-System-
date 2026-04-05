# 🏆 Distributed Online Auction System

A production-quality **distributed auction platform** demonstrating:
- **Leader-Follower Replication** (Bully Algorithm)
- **Lamport Logical Clocks** for bid ordering & tie-breaking
- **Real-time broadcasts** via Socket.io
- **Load balancing** with NGINX (least-connections)
- **Rate limiting** (5 bids/user/second)
- **Fault tolerance** with automatic leader election

---

## 🏗️ Architecture

```
Browser Clients + k6 Virtual Users
        ↓
  NGINX Load Balancer (port 80)
    ↙    ↓    ↘    ↘
  S1    S2    S3    S4    (4 Node.js backends)
    ↘    ↓    ↙    ↙
       MongoDB
```

### Distributed System Flow
1. Client → NGINX → any server node
2. Non-leader nodes **forward writes** to the Leader
3. Leader assigns **Lamport timestamp**, writes to MongoDB
4. Leader **replicates** to all followers via `/api/internal/replicate-bid`
5. All nodes **broadcast** via Socket.io to connected clients


---

## 🚀 Quick Start (Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/)

### Run in one command:
```bash
docker-compose up --build
```

Then open: **http://localhost**

### Individual server access:
| Server | URL | Role |
|--------|-----|------|
| S1 | http://localhost:3001 | Leader (initial) |
| S2 | http://localhost:3002 | Follower |
| S3 | http://localhost:3003 | Follower |
| S4 | http://localhost:3004 | Follower |
| NGINX | http://localhost | Load Balancer |

---

## 💻 Local Development (Without Docker)

### 1. Start MongoDB
```bash
mongod --dbpath ./data
```

### 2. Start Backend Servers (4 terminals)
```bash
# Server 1 (Leader)
cd backend
SERVER_ID=1 PORT=3001 MONGO_URI=mongodb://localhost:27017/auction_system IS_LEADER=true PEER_SERVERS=http://localhost:3002,http://localhost:3003,http://localhost:3004 npm start

# Server 2
SERVER_ID=2 PORT=3002 MONGO_URI=mongodb://localhost:27017/auction_system IS_LEADER=false PEER_SERVERS=http://localhost:3001,http://localhost:3003,http://localhost:3004 npm start

# Server 3
SERVER_ID=3 PORT=3003 ... npm start

# Server 4
SERVER_ID=4 PORT=3004 ... npm start
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```
Open: **http://localhost:5173** (proxies to NGINX on port 80)

---

## 🧪 k6 Load Testing

### Install k6
- Windows: `winget install k6`
- macOS: `brew install k6`
- Linux: [k6 install docs](https://k6.io/docs/getting-started/installation/)

### Run from command line:
```bash
k6 run --vus=50 --duration=60s k6/load-test.js
```

### Or trigger from Admin Panel:
1. Create an auction → copy the Auction ID
2. Go to `/admin`
3. Paste Auction ID, set VUs and duration
4. Click **Start Load Test**

---

## 🔬 Failure Simulation

### Simulate Leader Crash:
```bash
# Stop the current leader container
docker stop auction-server1

# Watch server2/3/4 detect failure and elect new leader
docker logs auction-server2 -f
```

The system will:
1. Detect missed heartbeats (2 consecutive failures = 6 seconds)
2. Trigger Bully election
3. Server with highest ID wins
4. New leader broadcasts COORDINATOR to all peers
5. Clients receive `leader-changed` event in real time

### Restore:
```bash
docker start auction-server1
```

---

## 🧠 Distributed Algorithm Details

### Bully Algorithm (Leader Election)
```
1. Server detects leader failure (missed heartbeats)
2. Sends ELECTION to all servers with higher ID
3. If no response within 2s → self-declare as leader
4. Winner sends COORDINATOR to all peers
5. All servers update their local leader state
```

### Lamport Timestamps
```
- Each server has a counter starting at 0
- On send: counter++, attach to message
- On receive: counter = max(local, received) + 1
- Bids sorted by: (amount DESC, lamportTimestamp ASC, serverId ASC)
```

### Rate Limiting
- 5 bids per user per second (keyed by userId)
- Returns HTTP 429 with retry-after header

### Mutual Exclusion
- Only the Leader processes write operations
- Followers forward bids to Leader via internal HTTP
- Leader uses MongoDB's atomic findOneAndUpdate for consistency

---

## 📁 Folder Structure

```
Auction System/
├── backend/
│   ├── src/
│   │   ├── config/database.js
│   │   ├── distributed/
│   │   │   ├── lamportClock.js    # Logical clock
│   │   │   ├── leaderElection.js  # Bully algorithm
│   │   │   ├── heartbeat.js       # Peer monitoring
│   │   │   └── replication.js     # Leader→follower sync
│   │   ├── middleware/rateLimiter.js
│   │   ├── models/{User,Auction,Bid}.js
│   │   ├── routes/{auction,bid,internal,upload,loadtest}.js
│   │   └── index.js
│   ├── uploads/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   └── src/
│       ├── pages/{HomePage,AuctionPage,CreateAuctionPage,AdminPage}.jsx
│       ├── components/*.jsx
│       ├── services/{api,socket}.js
│       └── App.jsx
├── nginx/nginx.conf
├── k6/load-test.js
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/auctions | List all auctions |
| POST | /api/auctions | Create auction |
| GET | /api/auctions/:id | Get auction + bids |
| POST | /api/auctions/:id/join | Join auction |
| POST | /api/auctions/:id/end | End auction |
| POST | /api/bids | Place bid (leader-routed) |
| GET | /api/bids/:auctionId | Get bids |
| POST | /api/upload | Upload image |
| POST | /api/start-load-test | Trigger k6 |
| POST | /api/stop-load-test | Stop k6 |
| GET | /health | Server health + leader status |
| GET | /api/server-info | Server metadata |
| GET | /api/internal/heartbeat | Peer heartbeat |
| POST | /api/internal/replicate-bid | Replicate bid to follower |
| POST | /api/internal/leader-election | Bully algorithm messages |

---

## 🤝 Socket.io Events

### Server → Client
| Event | Payload |
|-------|---------|
| `new-bid` | `{ auctionId, bid, currentHighestBid, lamportTimestamp }` |
| `auction-created` | `{ auction }` |
| `auction-ended` | `{ auctionId, winner, winnerName, winningBid }` |
| `leader-changed` | `{ newLeader, isCurrentServerLeader }` |
| `server-status` | `{ serverId, peers }` |
| `server-event` | `{ type, message }` |

### Client → Server
| Event | Description |
|-------|-------------|
| `join-auction` | Join room for an auction |
| `leave-auction` | Leave auction room |
