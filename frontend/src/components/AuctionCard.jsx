import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const CATEGORY_ICONS = {
  Electronics: "💻",
  Art: "🎨",
  Collectibles: "🏺",
  Vehicles: "🚗",
  Fashion: "👗",
  Sports: "⚽",
  Books: "📚",
  Other: "📦",
};

// 🔥 Helper: Construct full image URL from relative path
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If already a full URL (http/https), return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  // If relative path, prepend current window origin
  return `${window.location.origin}${imagePath}`;
};

export default function AuctionCard({
  auction,
  onEnd,
  isOwner,
  isWatched,
  onToggleWatch,
}) {
  const [hovered, setHovered] = useState(false);

  const isOngoing = auction.status === "ONGOING";
  const endTime = new Date(auction.endTime);
  const isExpired = endTime < new Date();
  const isLive = isOngoing && !isExpired;
  const timeLeft = isLive
    ? formatDistanceToNow(endTime, { addSuffix: false })
    : null;

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(auction.currentHighestBid || auction.startingPrice);

  const categoryIcon = CATEGORY_ICONS[auction.category] || "📦";
  const imageUrl = getImageUrl(auction.imagePath); // 🔥 Construct full URL

  return (
    <div
      className="glass-card"
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "var(--shadow-lg)" : "none",
        borderColor: hovered ? "var(--border-hover)" : "var(--border)",
        transition:
          "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Image / Placeholder ─────────────────────────────── */}
      <div
        style={{
          height: 150,
          position: "relative",
          flexShrink: 0,
          background: imageUrl
            ? `url(${imageUrl}) center/cover no-repeat`
            : "var(--bg-raised)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!imageUrl && (
          <div style={{ fontSize: 36, opacity: 0.18 }}>{categoryIcon}</div>
        )}

        {/* Status badge */}
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <span className={`badge ${isLive ? "badge-ongoing" : "badge-ended"}`}>
            {isLive ? (
              <>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                LIVE
              </>
            ) : (
              "ENDED"
            )}
          </span>
        </div>

        {/* Watchlist heart */}
        {onToggleWatch && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWatch();
            }}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 30,
              height: 30,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.2s ease, background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.65)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.45)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={isWatched ? "#f59e0b" : "none"}
              stroke={isWatched ? "#f59e0b" : "rgba(255,255,255,0.8)"}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        )}

        {/* Price overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.78))",
            padding: "22px 14px 10px",
          }}
        >
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              fontFamily: "Space Grotesk, sans-serif",
              color: "#f0f4ff",
            }}
          >
            {price}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(240,244,255,0.5)",
              marginTop: 1,
            }}
          >
            {isLive ? "Current bid" : "Final bid"}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "13px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {/* Category + bid count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {auction.category && auction.category !== "Other" ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--accent-light)",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                borderRadius: 4,
                padding: "2px 7px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {auction.category}
            </span>
          ) : (
            <span />
          )}

          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {auction.bidCount || 0} bids
          </span>
        </div>

        {/* Title */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Space Grotesk, sans-serif",
              color: "var(--text-1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 3,
            }}
          >
            {auction.itemName}
          </h3>

          {auction.description && (
            <p
              style={{
                fontSize: 11.5,
                color: "var(--text-3)",
                lineHeight: 1.5,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {auction.description}
            </p>
          )}
        </div>

        {/* Time / winner row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--text-3)",
            borderTop: "1px solid var(--border)",
            paddingTop: 8,
          }}
        >
          {timeLeft ? (
            <span style={{ color: "var(--green)", fontWeight: 600 }}>
              {timeLeft} left
            </span>
          ) : (
            <span>
              {auction.highestBidderName
                ? `Won by ${auction.highestBidderName}`
                : "No bids"}
            </span>
          )}
          {isLive && auction.highestBidderName && (
            <span
              style={{
                color: "var(--text-3)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 90,
                whiteSpace: "nowrap",
              }}
            >
              ↑ {auction.highestBidderName}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 7, marginTop: "auto" }}>
          <Link
            to={`/auction/${auction.auctionId}`}
            className={`btn btn-sm ${isLive ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, justifyContent: "center" }}
          >
            {isLive ? "Bid Now" : "View Results"}
          </Link>

          {isOwner && isLive && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEnd(auction.auctionId);
              }}
              style={{
                color: "var(--red)",
                borderColor: "rgba(248,113,113,0.22)",
                flexShrink: 0,
              }}
            >
              End
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
