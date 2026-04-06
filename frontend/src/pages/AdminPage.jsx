import { useState, useEffect } from "react";
import { serverAPI, loadTestAPI } from "../services/api";
import { getSocket } from "../services/socket";
import toast from "react-hot-toast";
import axios from "axios";

const SERVER_IDS = [1, 2, 3, 4];

export default function AdminPage() {
  const [serverStatuses, setServerStatuses] = useState({});
  const [loadTestConfig, setLoadTestConfig] = useState({
    vus: 10,
    duration: "30s",
    auctionId: "",
  });
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestOutput, setLoadTestOutput] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [leaderLog, setLeaderLog] = useState([]);

  useEffect(() => {
    fetchServerStatuses();
    const interval = setInterval(fetchServerStatuses, 5000);
    const socket = getSocket();

    socket.on("leader-changed", (data) => {
      setLeaderLog((prev) =>
        [
          {
            time: new Date().toLocaleTimeString(),
            message: `Leader changed to Server ${data.newLeader}`,
            type: "leader",
          },
          ...prev,
        ].slice(0, 50),
      );
      toast(`New Leader: Server ${data.newLeader}`, { duration: 5000 });
    });

    socket.on("server-event", (data) => {
      setLeaderLog((prev) =>
        [
          {
            time: new Date().toLocaleTimeString(),
            message: data.message,
            type: data.type?.toLowerCase() || "info",
          },
          ...prev,
        ].slice(0, 50),
      );
    });

    socket.on("server-status", (data) => {
      setServerStatuses((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(data.peers).map(([id, status]) => [
            id,
            { ...status, serverId: id },
          ]),
        ),
      }));
    });

    socket.on("load-test-output", (data) => {
      setLoadTestOutput((prev) => [
        ...prev.slice(-100),
        {
          text: data.text.trim(),
          type: data.type,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    });

    socket.on("load-test-complete", (data) => {
      setLoadTestRunning(false);
      toast.success(`Load test complete (exit code: ${data.code})`);
    });

    return () => {
      clearInterval(interval);
      socket.off("leader-changed");
      socket.off("server-event");
      socket.off("server-status");
      socket.off("load-test-output");
      socket.off("load-test-complete");
    };
  }, []);

  const fetchServerStatuses = async () => {
    const statuses = {};
    await Promise.allSettled(
      SERVER_IDS.map(async (id) => {
        try {
          const res = await axios.get("http://localhost/health", {
            timeout: 2000,
            headers: { "x-target-server": id },
          });
          statuses[id] = { online: true, ...res.data };
        } catch {
          statuses[id] = { online: false, serverId: id };
        }
      }),
    );
    try {
      const res = await serverAPI.getInfo();
      setSystemInfo(res.data);
      statuses[parseInt(res.data.serverId)] = { online: true, ...res.data };
    } catch {}
    setServerStatuses(statuses);
  };

  const startLoadTest = async () => {
    if (!loadTestConfig.auctionId.trim()) {
      toast.error("Please enter an Auction ID");
      return;
    }
    try {
      setLoadTestRunning(true);
      setLoadTestOutput([]);
      await loadTestAPI.start(loadTestConfig);
      toast.success(
        `Load test started: ${loadTestConfig.vus} VUs × ${loadTestConfig.duration}`,
      );
    } catch (err) {
      setLoadTestRunning(false);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to start load test",
      );
    }
  };

  const stopLoadTest = async () => {
    try {
      await loadTestAPI.stop();
      setLoadTestRunning(false);
      toast("Load test stopped", { icon: "⏹" });
    } catch {
      toast.error("Failed to stop load test");
    }
  };

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 96 }}>
      {/* Header */}
      <div style={{ marginBottom: 36, animation: "fadeIn 0.4s ease" }}>
        <h1
          style={{
            fontSize: 24,
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--text-1)",
            letterSpacing: "-0.5px",
          }}
        >
          System <span className="text-gradient">Admin</span>
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>
          Monitor server health, trigger load tests, and observe distributed
          system behavior.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── Left ─────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Server Grid */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  color: "var(--text-1)",
                }}
              >
                Server Nodes
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={fetchServerStatuses}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
                Refresh
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
              }}
            >
              {SERVER_IDS.map((id) => (
                <ServerCard
                  key={id}
                  serverId={id}
                  status={serverStatuses[id]}
                  systemInfo={systemInfo}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "12px 14px",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text-2)",
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "var(--accent-light)" }}>
                Distributed System:
              </strong>{" "}
              Leader handles all writes → replicates to followers → Socket.io
              broadcasts to clients → Bully election on failure. Stop a Docker
              container to simulate failure.
            </div>
          </div>

          {/* Event Log */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h2
              style={{
                fontSize: 15,
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                marginBottom: 16,
                color: "var(--text-1)",
              }}
            >
              System Event Log
            </h2>

            <div
              style={{
                maxHeight: 260,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {leaderLog.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 20px",
                    color: "var(--text-3)",
                    fontSize: 13,
                  }}
                >
                  No events yet. Events will appear here in real time.
                </div>
              ) : (
                leaderLog.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "7px 11px",
                      borderRadius: 6,
                      background:
                        entry.type === "leader"
                          ? "var(--amber-dim)"
                          : "var(--bg-raised)",
                      border: `1px solid ${entry.type === "leader" ? "rgba(245,158,11,0.18)" : "var(--border)"}`,
                      fontSize: 12,
                      color: "var(--text-2)",
                      animation: "slideIn 0.25s ease",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-3)",
                        marginRight: 8,
                        fontSize: 11,
                      }}
                    >
                      {entry.time}
                    </span>
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right — Load Test ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="glass-card" style={{ padding: 22 }}>
            <h2
              style={{
                fontSize: 15,
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                marginBottom: 4,
                color: "var(--text-1)",
              }}
            >
              k6 Load Test
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Simulate concurrent bidders to stress test the system.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Target Auction ID</label>
                <input
                  id="load-test-auction-id"
                  className="input-field"
                  type="text"
                  placeholder="Paste auction ID here"
                  value={loadTestConfig.auctionId}
                  onChange={(e) =>
                    setLoadTestConfig((prev) => ({
                      ...prev,
                      auctionId: e.target.value,
                    }))
                  }
                  disabled={loadTestRunning}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Virtual Users (VUs)</label>
                <input
                  id="load-test-vus"
                  className="input-field"
                  type="number"
                  min="1"
                  max="500"
                  value={loadTestConfig.vus}
                  onChange={(e) =>
                    setLoadTestConfig((prev) => ({
                      ...prev,
                      vus: parseInt(e.target.value) || 10,
                    }))
                  }
                  disabled={loadTestRunning}
                  style={{ marginBottom: 7 }}
                />
                <div style={{ display: "flex", gap: 5 }}>
                  {[10, 25, 50, 100].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`btn btn-sm ${loadTestConfig.vus === v ? "btn-primary" : "btn-ghost"}`}
                      onClick={() =>
                        setLoadTestConfig((prev) => ({ ...prev, vus: v }))
                      }
                      disabled={loadTestRunning}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Duration</label>
                <input
                  id="load-test-duration"
                  className="input-field"
                  type="text"
                  placeholder="e.g. 30s, 2m"
                  value={loadTestConfig.duration}
                  onChange={(e) =>
                    setLoadTestConfig((prev) => ({
                      ...prev,
                      duration: e.target.value,
                    }))
                  }
                  disabled={loadTestRunning}
                  style={{ marginBottom: 7 }}
                />
                <div style={{ display: "flex", gap: 5 }}>
                  {["15s", "30s", "1m", "5m"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`btn btn-sm ${loadTestConfig.duration === d ? "btn-primary" : "btn-ghost"}`}
                      onClick={() =>
                        setLoadTestConfig((prev) => ({ ...prev, duration: d }))
                      }
                      disabled={loadTestRunning}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {!loadTestRunning ? (
                <button
                  id="start-load-test-btn"
                  className="btn btn-success"
                  onClick={startLoadTest}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Start Load Test
                </button>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "var(--green-dim)",
                      border: "1px solid var(--green-border)",
                    }}
                  >
                    <span className="live-dot" />
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--green)",
                        fontWeight: 600,
                      }}
                    >
                      Running… {loadTestConfig.vus} VUs
                    </span>
                  </div>
                  <button
                    id="stop-load-test-btn"
                    className="btn btn-danger"
                    onClick={stopLoadTest}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Stop Test
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* k6 Output */}
          {loadTestOutput.length > 0 && (
            <div className="glass-card" style={{ padding: 18 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: "var(--green)",
                }}
              >
                k6 Output
              </h3>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "var(--text-2)",
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {loadTestOutput.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      color:
                        line.type === "stderr" ? "var(--red)" : "var(--text-2)",
                    }}
                  >
                    <span style={{ color: "var(--text-3)", marginRight: 6 }}>
                      {line.time}
                    </span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NGINX Info */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text-3)",
              lineHeight: 1.8,
            }}
          >
            <strong
              style={{
                color: "var(--text-2)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Load Balancer (NGINX)
            </strong>
            Strategy: Least Connections
            <br />
            Upstream: S1:3001 → S2:3002 → S3:3003 → S4:3004
            <br />
            WebSocket: Upgrade headers enabled
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerCard({ serverId, status = { online: false }, systemInfo }) {
  const isLeader = status.isLeader || systemInfo?.currentLeader == serverId;
  const isOnline = status.online !== false;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 10,
        background: "var(--bg-raised)",
        border: `1px solid ${
          !isOnline
            ? "rgba(248,113,113,0.22)"
            : isLeader
              ? "rgba(245,158,11,0.25)"
              : "var(--border)"
        }`,
        transition: "all 0.25s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Leader glow */}
      {isLeader && isOnline && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.07), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: isOnline
                ? isLeader
                  ? "var(--amber-dim)"
                  : "var(--accent-dim)"
                : "var(--red-dim)",
              border: `1px solid ${
                isOnline
                  ? isLeader
                    ? "rgba(245,158,11,0.25)"
                    : "var(--accent-border)"
                  : "rgba(248,113,113,0.22)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: isOnline
                ? isLeader
                  ? "var(--amber)"
                  : "var(--accent-light)"
                : "var(--red)",
            }}
          >
            S{serverId}
          </div>
          <div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}
            >
              Server {serverId}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Port 300{serverId}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isOnline
                ? isLeader
                  ? "var(--amber)"
                  : "var(--green)"
                : "var(--red)",
              animation: isOnline ? "pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: isOnline
                ? isLeader
                  ? "var(--amber)"
                  : "var(--green)"
                : "var(--red)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {isOnline ? (isLeader ? "Leader" : "Follower") : "Offline"}
          </span>
        </div>
      </div>

      {isOnline && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <InfoRow
            label="Uptime"
            value={status.uptime ? `${Math.floor(status.uptime)}s` : "—"}
          />
          <InfoRow label="Lamport" value={status.lamportClock ?? "—"} />
          <InfoRow
            label="Leader"
            value={status.currentLeader ? `S${status.currentLeader}` : "?"}
          />
        </div>
      )}

      {!isOnline && (
        <div
          style={{
            fontSize: 12,
            color: "var(--red)",
            textAlign: "center",
            paddingTop: 4,
          }}
        >
          Unreachable
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-2)",
          fontFamily: "monospace",
        }}
      >
        {value}
      </span>
    </div>
  );
}
