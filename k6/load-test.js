// ============================================================
// k6 LOAD TEST SCRIPT
// ============================================================
// Simulates concurrent users placing bids in an auction.
// Run with: k6 run --vus=50 --duration=60s k6/load-test.js
//
// Environment variables:
//   BASE_URL   — Backend URL (default: http://localhost:80)
//   AUCTION_ID — Target auction ID (optional)
// ============================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import ws from 'k6/ws';

// ─── Custom Metrics ─────────────────────────────────────────
const bidSuccessCounter = new Counter('bids_successful');
const bidFailCounter = new Counter('bids_failed');
const bidRateLimitCounter = new Counter('bids_rate_limited');
const bidResponseTime = new Trend('bid_response_time');
const errorRate = new Rate('error_rate');

// ─── Test Configuration ──────────────────────────────────────
export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 50,
  duration: __ENV.DURATION || '60s',
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    error_rate: ['rate<0.1'],           // Error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';
let AUCTION_ID = __ENV.AUCTION_ID || '';

// ─── Setup: Create a shared auction if none provided ─────────
export function setup() {
  if (AUCTION_ID) {
    return { auctionId: AUCTION_ID };
  }

  // Create a test auction
  const userId = `loadtest-setup`;
  const endTime = new Date(Date.now() + 300000).toISOString(); // 5 min from now

  const res = http.post(
    `${BASE_URL}/api/auctions`,
    JSON.stringify({
      itemName: 'k6 Load Test Item',
      description: 'Auto-created by k6 load test',
      startingPrice: 100,
      endTime,
      userId,
      userName: 'LoadTest Setup',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status === 201) {
    const body = JSON.parse(res.body);
    console.log(`[k6 Setup] Created auction: ${body.auction.auctionId}`);
    return { auctionId: body.auction.auctionId };
  }

  console.error('[k6 Setup] Failed to create auction:', res.body);
  return { auctionId: null };
}

// ─── Main Virtual User Scenario ──────────────────────────────
export default function main(data) {
  const { auctionId } = data;

  if (!auctionId) {
    console.error('[k6] No auction ID available');
    return;
  }

  const userId = `vu-${__VU}-${Date.now()}`;
  const userName = `Virtual User ${__VU}`;

  // Step 1: Join the auction
  const joinRes = http.post(
    `${BASE_URL}/api/auctions/${auctionId}/join`,
    JSON.stringify({ userId, userName }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(joinRes, {
    'join auction: status 200': (r) => r.status === 200,
  });

  if (joinRes.status !== 200) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  const auctionData = JSON.parse(joinRes.body);
  let currentBid = auctionData.auction?.currentHighestBid || 100;

  // Step 2: Place multiple bids
  const bidCount = Math.floor(Math.random() * 5) + 3; // 3-7 bids per VU

  for (let i = 0; i < bidCount; i++) {
    // Random bid increment between 1-50
    const bidIncrement = Math.floor(Math.random() * 50) + 1;
    const bidAmount = currentBid + bidIncrement;

    const start = Date.now();
    const bidRes = http.post(
      `${BASE_URL}/api/bids`,
      JSON.stringify({
        auctionId,
        userId,
        userName,
        amount: bidAmount,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
      }
    );
    const duration = Date.now() - start;
    bidResponseTime.add(duration);

    switch (bidRes.status) {
      case 201:
        bidSuccessCounter.add(1);
        errorRate.add(0);
        currentBid = bidAmount;
        break;

      case 400:
        // Bid too low — another VU outbid us, update our reference
        try {
          const body = JSON.parse(bidRes.body);
          if (body.currentHighestBid) {
            currentBid = body.currentHighestBid;
          }
        } catch (e) {}
        errorRate.add(0); // Not a real error
        break;

      case 429:
        // Rate limited
        bidRateLimitCounter.add(1);
        errorRate.add(0);
        sleep(1); // Back off
        break;

      default:
        bidFailCounter.add(1);
        errorRate.add(1);
        break;
    }

    // Sleep between bids (simulate human-like behavior)
    sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
  }

  sleep(1);
}

// ─── Teardown ─────────────────────────────────────────────────
export function teardown(data) {
  console.log('[k6 Teardown] Load test complete');
}
