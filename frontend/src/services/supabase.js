// ─── Supabase Client (Browser-Side) ───────────────────────────
// Uses the publishable (anon) key — safe to expose in the browser.
// Used exclusively for Realtime subscriptions and reads.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

// ─── Conversion helpers ────────────────────────────────────────
// Map Supabase snake_case DB rows → camelCase frontend objects

export const toAuction = (row) => ({
  auctionId:          row.auction_id,
  itemName:           row.item_name,
  description:        row.description,
  category:           row.category,
  startingPrice:      row.starting_price,
  currentHighestBid:  row.current_highest_bid,
  highestBidder:      row.highest_bidder,
  highestBidderName:  row.highest_bidder_name,
  bidCount:           row.bid_count,
  status:             row.status,
  endTime:            row.end_time,
  createdBy:          row.created_by,
  createdByName:      row.created_by_name,
  imagePath:          row.image_path,
  lastLamportTimestamp: row.last_lamport_timestamp,
  createdAt:          row.created_at,
});

export const toBid = (row) => ({
  bidId:            row.bid_id,
  auctionId:        row.auction_id,
  userId:           row.user_id,
  userName:         row.user_name,
  amount:           row.amount,
  lamportTimestamp: row.lamport_timestamp,
  serverId:         row.server_id,
  isWinner:         row.is_winner,
  createdAt:        row.created_at,
});

export default supabase;
