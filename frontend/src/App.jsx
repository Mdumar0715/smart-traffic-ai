import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import { Pie, Line, Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler
} from "chart.js"
import "./App.css"

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler)

const lanes = ["lane1", "lane2", "lane3"]
const BASE = "http://127.0.0.1:8000"

/* ─── CHART THEME ─────────────────────────────────────────────────────────── */

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 700, easing: "easeInOutQuart" },
  plugins: {
    legend: {
      labels: {
        color: "#94a3b8",
        font: { family: "'Inter', sans-serif", size: 12, weight: "500" },
        boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 16
      }
    },
    tooltip: {
      backgroundColor: "rgba(10,18,37,0.95)",
      borderColor: "rgba(148,163,184,0.15)",
      borderWidth: 1,
      titleColor: "#f1f5f9",
      bodyColor: "#94a3b8",
      padding: 12, cornerRadius: 10,
      titleFont: { family: "'Space Grotesk', sans-serif", weight: "700", size: 13 },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
      displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true,
    }
  },
  scales: {
    x: {
      grid: { color: "rgba(148,163,184,0.06)", drawBorder: false },
      ticks: { color: "#475569", font: { size: 11 }, maxRotation: 0 },
      border: { display: false }
    },
    y: {
      grid: { color: "rgba(148,163,184,0.06)", drawBorder: false },
      ticks: { color: "#475569", font: { size: 11 }, padding: 8 },
      border: { display: false }
    }
  }
}

const noScaleOpts = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 700, easing: "easeInOutQuart" },
  plugins: {
    legend: {
      position: "right",
      labels: {
        color: "#94a3b8",
        font: { family: "'Inter', sans-serif", size: 12 },
        boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 14
      }
    },
    tooltip: {
      backgroundColor: "rgba(10,18,37,0.95)",
      borderColor: "rgba(148,163,184,0.15)",
      borderWidth: 1, titleColor: "#f1f5f9", bodyColor: "#94a3b8",
      padding: 12, cornerRadius: 10,
    }
  }
}

/* ─── SIGNAL ─────────────────────────────────────────────────────────────── */

function Signal({ color }) {
  return (
    <div className="signal-widget">
      <div className="signal-housing">
        <div className="signal-lens-wrap">
          <div className={`signal-lens ${color === "RED" ? "red-on" : "off"}`} />
        </div>
        <div className="signal-lens-wrap">
          <div className={`signal-lens ${color === "YELLOW" ? "yellow-on" : "off"}`} />
        </div>
        <div className="signal-lens-wrap">
          <div className={`signal-lens ${color === "GREEN" ? "green-on" : "off"}`} />
        </div>
      </div>
      <span className={`signal-label ${color === "GREEN" ? "green" : "red"}`}>{color}</span>
    </div>
  )
}

/* ─── NAV BAR ────────────────────────────────────────────────────────────── */

function NavBar() {
  const loc = useLocation()
  const links = [
    { to: "/",        label: "Dashboard" },
    { to: "/lane1",   label: "Lane 1" },
    { to: "/lane2",   label: "Lane 2" },
    { to: "/lane3",   label: "Lane 3" },
    { to: "/reports", label: "Reports" },
  ]
  return (
    <nav className="nav">
      <Link to="/" className="nav-brand" style={{ textDecoration: "none" }}>
        <div className="nav-brand-icon">🚦</div>
        <span className="nav-brand-text">Smart Traffic AI</span>
      </Link>

      <ul className="nav-links">
        {links.map(l => (
          <li key={l.to}>
            <Link
              to={l.to}
              className={`nav-link ${loc.pathname === l.to ? "active" : ""}`}
            >
              {l.to === "/reports" && <span className="nav-link-reports-dot" />}
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="nav-badge">
        <div className="nav-badge-dot" />
        Live
      </div>
    </nav>
  )
}

/* ─── DENSITY BAR ────────────────────────────────────────────────────────── */

function DensityBar({ value, label }) {
  const pct = Math.min(100, Math.round((value || 0) * 100))
  const cls = pct < 35 ? "density-low" : pct < 70 ? "density-medium" : "density-high"
  return (
    <div className="density-bar-wrap">
      <div className="density-bar-label">
        <span>{label || "Density"}</span>
        <span>{pct}%</span>
      </div>
      <div className="density-bar-track">
        <div className={`density-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ─── VEHICLE STATS PILLS ────────────────────────────────────────────────── */

function VehicleStats({ stats }) {
  const items = [
    { icon: "🚗", label: "Cars",   val: stats?.cars   ?? "—" },
    { icon: "🏍", label: "Bikes",  val: stats?.bikes  ?? "—" },
    { icon: "🚌", label: "Buses",  val: stats?.buses  ?? "—" },
    { icon: "🚛", label: "Trucks", val: stats?.trucks ?? "—" },
  ]
  return (
    <div className="stat-row">
      {items.map(it => (
        <div className="stat-pill" key={it.label}>
          <span>{it.icon}</span>
          <span className="stat-pill-value">{it.val}</span>
          <span style={{ fontSize: "10px", opacity: 0.6 }}>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── UPLOAD BUTTON ──────────────────────────────────────────────────────── */

function UploadBtn({ lane, onUpload }) {
  const id = `upload-${lane}`
  return (
    <label htmlFor={id} className="btn btn-ghost btn-sm file-input-label tooltip-wrap">
      ↑ Upload
      <span className="tooltip-text">Upload video for {lane}</span>
      <input
        id={id}
        type="file"
        accept="video/*"
        className="file-input-hidden"
        onChange={e => onUpload(e, lane)}
      />
    </label>
  )
}

/* ─── GRAPH CARD ─────────────────────────────────────────────────────────── */

function GraphCard({ title, subtitle, badge, children, delay = 0 }) {
  return (
    <div className="card graph-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="graph-header">
        <div>
          <div className="graph-title">{title}</div>
          {subtitle && <div className="graph-subtitle">{subtitle}</div>}
        </div>
        {badge && <span className="graph-badge">{badge}</span>}
      </div>
      <div className="graph-container">{children}</div>
    </div>
  )
}

/* ─── TOAST ──────────────────────────────────────────────────────────────── */

function Toast({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── HERO KPI STRIP ─────────────────────────────────────────────────────── */

function KPICard({ icon, label, value, color, sub }) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className={`kpi-icon-wrap kpi-icon-${color}`}>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

function HeroKPIStrip({ stats, emergency, pedestrian }) {
  const totalVehicles = lanes.reduce((sum, l) => {
    const s = stats[l] || {}
    return sum + (s.cars || 0) + (s.bikes || 0) + (s.buses || 0) + (s.trucks || 0)
  }, 0)
  const avgDensity   = lanes.reduce((sum, l) => sum + (stats[l]?.density    || 0), 0) / 3
  const avgGreenTime = lanes.reduce((sum, l) => sum + (stats[l]?.green_time || 0), 0) / 3
  const alerts       = (emergency ? 1 : 0) + (pedestrian ? 1 : 0)

  return (
    <div className="kpi-strip">
      <KPICard icon="🚗" label="Total Vehicles"  value={totalVehicles}                     color="blue"                         sub="across all lanes" />
      <KPICard icon="🌡️" label="Network Density" value={`${(avgDensity * 100).toFixed(0)}%`} color="purple"                     sub="avg congestion" />
      <KPICard icon="⏱"  label="Avg Green ETA"   value={`${avgGreenTime.toFixed(0)}s`}     color="green"                        sub="signal timing" />
      <KPICard icon="🚨" label="Active Alerts"   value={alerts}                             color={alerts > 0 ? "red" : "teal"} sub={alerts > 0 ? "requires attention" : "all clear"} />
    </div>
  )
}

/* ─── INTERSECTION MAP ───────────────────────────────────────────────────── */

function IntersectionMap({ signal, stats }) {
  const laneData = [
    { lane: "lane1", label: "Lane 1", y: 20 },
    { lane: "lane2", label: "Lane 2", y: 90 },
    { lane: "lane3", label: "Lane 3", y: 160 },
  ]

  return (
    <div className="card intersection-card">
      <div className="card-title">🗺️ Live Intersection Overview</div>
      <div className="intersection-wrap">
        <svg viewBox="0 0 520 234" className="intersection-svg" xmlns="http://www.w3.org/2000/svg">
          {laneData.map(ld => {
            const isGreen     = signal[ld.lane] === "GREEN"
            const density     = stats[ld.lane]?.density || 0
            const vehicleCount = Math.min(7, Math.round(density * 7))
            const sigColor    = isGreen ? "#22c55e" : "#ef4444"

            return (
              <g key={ld.lane}>
                {/* Road surface */}
                <rect x="70" y={ld.y} width="390" height="52" rx="5"
                  fill="#0f172a" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                {/* Signal-tinted road fill */}
                <rect x="70" y={ld.y} width="390" height="52" rx="5"
                  fill={`${sigColor}18`} />
                {/* Dashed center line */}
                {[90, 130, 170, 210, 250, 290, 330, 370, 410].map(x => (
                  <rect key={x} x={x} y={ld.y + 25} width="22" height="2" rx="1"
                    fill="rgba(255,255,255,0.1)" />
                ))}
                {/* Lane label */}
                <text x="36" y={ld.y + 31} fill="#64748b" fontSize="11"
                  textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="600">
                  {ld.label}
                </text>
                {/* Vehicle blocks */}
                {Array.from({ length: vehicleCount }).map((_, vi) => (
                  <rect key={vi} x={78 + vi * 52} y={ld.y + 10} width="36" height="32" rx="6"
                    fill={sigColor} opacity={Math.max(0.35, 0.7 - vi * 0.05)} />
                ))}
                {/* Signal housing */}
                <rect x="464" y={ld.y + 4} width="38" height="44" rx="5"
                  fill="#060d1c" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                {/* Red lens */}
                <circle cx="483" cy={ld.y + 17} r="8"
                  fill={!isGreen ? "#ef4444" : "#1e1e1e"}
                  style={{ filter: !isGreen ? "drop-shadow(0 0 8px #ef4444)" : "none" }} />
                {/* Green lens */}
                <circle cx="483" cy={ld.y + 35} r="8"
                  fill={isGreen ? "#22c55e" : "#1e1e1e"}
                  style={{ filter: isGreen ? "drop-shadow(0 0 8px #22c55e)" : "none" }} />
                {/* ETA text */}
                <text x="483" y={ld.y + 57} textAnchor="middle" fill="#475569"
                  fontSize="9" fontFamily="Inter,sans-serif">
                  {stats[ld.lane]?.green_time ?? 0}s
                </text>
                {/* Arrow */}
                <text x="510" y={ld.y + 33} fill={sigColor}
                  fontSize="22" fontFamily="sans-serif" opacity="0.85">›</text>
              </g>
            )
          })}
        </svg>

        <div className="intersection-legend">
          <span><span style={{ color: "#22c55e" }}>●</span> Green Signal</span>
          <span><span style={{ color: "#ef4444" }}>●</span> Red Signal</span>
          <span>■ Vehicle density</span>
        </div>
      </div>
    </div>
  )
}

/* ─── CONGESTION BANNER ──────────────────────────────────────────────────── */

function CongestionBanner({ density }) {
  const pct = Math.round((density || 0) * 100)
  if (pct < 25) return <div className="congestion-banner congestion-low">▼ LOW TRAFFIC</div>
  if (pct < 55) return <div className="congestion-banner congestion-moderate">◆ MODERATE</div>
  if (pct < 80) return <div className="congestion-banner congestion-high">▲ HIGH TRAFFIC</div>
  return <div className="congestion-banner congestion-critical">⚠ CRITICAL</div>
}

/* ─── LANE HEALTH GAUGE ──────────────────────────────────────────────────── */

function LaneHealthGauge({ stats }) {
  const density = stats?.density || 0
  const health  = Math.max(0, Math.min(100, Math.round((1 - density) * 100)))
  const color   = health > 70 ? "#22c55e" : health > 40 ? "#f59e0b" : "#ef4444"
  const label   = health > 70 ? "HEALTHY" : health > 40 ? "MODERATE" : "CONGESTED"
  const r       = 40
  const circ    = 2 * Math.PI * r   // ≈ 251.33
  const dashLen = (health / 100) * circ

  return (
    <div className="card health-gauge-card">
      <div className="card-title">🎯 Lane Health</div>
      <div className="health-gauge-wrap">
        <svg viewBox="0 0 120 120" className="health-gauge-svg">
          {/* Track */}
          <circle cx="60" cy="60" r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          {/* Arc */}
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dashLen} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }}
          />
          {/* Value */}
          <text x="60" y="56" textAnchor="middle"
            fill={color} fontSize="22" fontWeight="700"
            fontFamily="'Space Grotesk', sans-serif">
            {health}
          </text>
          {/* Label */}
          <text x="60" y="70" textAnchor="middle"
            fill="#64748b" fontSize="8" letterSpacing="1"
            fontFamily="Inter, sans-serif">
            {label}
          </text>
        </svg>
      </div>
      <div className="health-gauge-legend">
        <span style={{ color: "#22c55e" }}>● Healthy</span>
        <span style={{ color: "#f59e0b" }}>● Moderate</span>
        <span style={{ color: "#ef4444" }}>● Congested</span>
      </div>
    </div>
  )
}

/* ─── STATS TABLE ────────────────────────────────────────────────────────── */

function StatsTable({ stats }) {
  const types = [
    { key: "cars",   icon: "🚗", label: "Cars",   color: "#3b82f6" },
    { key: "bikes",  icon: "🏍", label: "Bikes",  color: "#ef4444" },
    { key: "buses",  icon: "🚌", label: "Buses",  color: "#f59e0b" },
    { key: "trucks", icon: "🚛", label: "Trucks", color: "#22c55e" },
  ]
  const total = types.reduce((s, t) => s + (stats?.[t.key] || 0), 0) || 1

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title">📋 Vehicle Breakdown</div>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>Share</th>
            <th>Distribution</th>
          </tr>
        </thead>
        <tbody>
          {types.map(t => {
            const count = stats?.[t.key] || 0
            const pct   = Math.round((count / total) * 100)
            return (
              <tr key={t.key} className="stats-table-row">
                <td>{t.icon} {t.label}</td>
                <td className="stats-count">{count}</td>
                <td className="stats-pct" style={{ color: t.color }}>{pct}%</td>
                <td>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill"
                      style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── EVENT TIMELINE ─────────────────────────────────────────────────────── */

function EventTimeline({ events }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title">📅 Session Event Log</div>
      <div className="timeline-scroll">
        {[...events].reverse().slice(0, 10).map((ev, i) => (
          <div key={i} className={`timeline-item timeline-type-${ev.type}`}>
            <div className="timeline-dot" />
            <div className="timeline-body">
              <div className="timeline-label">{ev.label}</div>
              <div className="timeline-time">{ev.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════════════════ */

function Dashboard() {
  const [stats,      setStats]      = useState({ lane1:{}, lane2:{}, lane3:{} })
  const [signal,     setSignal]     = useState({ lane1:"RED", lane2:"RED", lane3:"RED" })
  const [history,    setHistory]    = useState({ lane1:[], lane2:[], lane3:[] })
  const [emergency,  setEmergency]  = useState(false)
  const [pedestrian, setPedestrian] = useState(false)
  const [toasts,     setToasts]     = useState([])
  const [, forceUpdate]             = useState(0)

  const addToast = useCallback((msg, type = "success", icon = "✅") => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type, icon }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  // Tick for live time
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newStats = {}
        for (const lane of lanes) {
          const res = await axios.get(`${BASE}/stats/${lane}`)
          newStats[lane] = res.data
          const total = (res.data.cars||0)+(res.data.bikes||0)+(res.data.buses||0)+(res.data.trucks||0)
          setHistory(prev => ({ ...prev, [lane]: [...prev[lane], total].slice(-30) }))
        }
        setStats(newStats)
      } catch {/* silent */}
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const uploadVideo = async (e, lane) => {
    const file = e.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    try {
      const res  = await fetch(`${BASE}/upload-video/${lane}`, { method: "POST", body: form })
      const json = await res.json()
      if (json.error) {
        addToast(`Upload error: ${json.error}`, "error", "❌")
      } else {
        addToast(`${lane} video uploaded ✓`, "success", "🎬")
      }
    } catch (err) {
      addToast("Backend offline — start the FastAPI server", "error", "❌")
    }
  }

  const changeSignal = (lane, color) => {
    setSignal(prev => ({ ...prev, [lane]: color }))
    addToast(`${lane} → ${color}`, color === "GREEN" ? "success" : "error",
             color === "GREEN" ? "🟢" : "🔴")
  }

  /* graph data */
  const barColors = ["rgba(59,130,246,0.85)", "rgba(239,68,68,0.85)", "rgba(34,197,94,0.85)"]
  const barBorder = ["#3b82f6", "#ef4444", "#22c55e"]

  const vehicleCompare = {
    labels: ["Lane 1", "Lane 2", "Lane 3"],
    datasets: [{
      label: "Total Vehicles",
      data: lanes.map(l => history[l].slice(-1)[0] || 0),
      backgroundColor: barColors, borderColor: barBorder,
      borderWidth: 2, borderRadius: 8, borderSkipped: false,
    }]
  }

  const trendCompare = {
    labels: history.lane1.map((_, i) => i + 1),
    datasets: [
      { label:"Lane 1", data:history.lane1, borderColor:"#3b82f6", backgroundColor:"rgba(59,130,246,0.08)", tension:0.45, fill:true, pointRadius:0, pointHoverRadius:5, borderWidth:2 },
      { label:"Lane 2", data:history.lane2, borderColor:"#ef4444", backgroundColor:"rgba(239,68,68,0.08)",  tension:0.45, fill:true, pointRadius:0, pointHoverRadius:5, borderWidth:2 },
      { label:"Lane 3", data:history.lane3, borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,0.08)",  tension:0.45, fill:true, pointRadius:0, pointHoverRadius:5, borderWidth:2 },
    ]
  }

  const priorityGraph = {
    labels: ["Lane 1", "Lane 2", "Lane 3"],
    datasets: [{
      label: "Priority Score",
      data: lanes.map(l => history[l].slice(-1)[0] || 0),
      backgroundColor: ["rgba(99,102,241,0.25)", "rgba(99,102,241,0.5)", "rgba(99,102,241,0.8)"],
      borderColor: "#6366f1", borderWidth: 2, borderRadius: 8, borderSkipped: false,
    }]
  }

  const totals          = Object.fromEntries(lanes.map(l => [l, history[l].slice(-1)[0] || 0]))
  const recommendedLane = Object.keys(totals).reduce((a, b) => totals[a] > totals[b] ? a : b)
  const laneLabel       = { lane1:"Lane 1", lane2:"Lane 2", lane3:"Lane 3" }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Traffic Control Dashboard</h1>
        <p className="page-subtitle">Real-time monitoring · {new Date().toLocaleTimeString()}</p>
      </div>

      {/* HERO KPI STRIP */}
      <HeroKPIStrip stats={stats} emergency={emergency} pedestrian={pedestrian} />

      {/* INTERSECTION MAP */}
      <IntersectionMap signal={signal} stats={stats} />

      {/* LANE CARDS */}
      <div className="lanes-grid">
        {lanes.map((lane, i) => (
          <div key={lane} className="card lane-card">
            <CongestionBanner density={stats[lane]?.density} />

            <div className="lane-header">
              <div className="lane-title">
                <div className="lane-num">{i + 1}</div>
                Lane {i + 1}
              </div>
              <UploadBtn lane={lane} onUpload={uploadVideo} />
            </div>

            <div className="stream-wrap" style={{ marginBottom: 14 }}>
              <img
                className="stream-img"
                src={`${BASE}/video-stream/${lane}`}
                alt={`Lane ${i+1} feed`}
                onError={e => { e.target.style.display = "none" }}
              />
              <div className="stream-overlay">
                <span className="stream-live-badge">
                  <span className="live-dot" /> LIVE
                </span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  {stats[lane]?.density != null
                    ? `Density: ${(stats[lane].density * 100).toFixed(0)}%`
                    : "No feed"}
                </span>
              </div>
            </div>

            <div className="lane-body">
              <div className="lane-stats-col">
                <VehicleStats stats={stats[lane]} />
                <DensityBar value={stats[lane]?.density} />
                <div>
                  <span className="eta-badge">⏱ Green ETA: {stats[lane]?.green_time ?? 0}s</span>
                </div>
              </div>
              <Signal color={signal[lane]} />
            </div>
          </div>
        ))}
      </div>

      {/* SIGNAL CONTROLS */}
      <div className="controls-grid">
        {lanes.map((lane, i) => (
          <div key={lane} className="card control-card">
            <div className="control-info">
              <div className="control-label">Lane {i + 1} Signal</div>
              <div className="control-status">
                Current: <span style={{ color: signal[lane] === "GREEN" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {signal[lane]}
                </span>
              </div>
            </div>
            <div className="control-buttons">
              <button className="btn btn-success btn-sm"
                onClick={() => changeSignal(lane, "GREEN")}
                disabled={signal[lane] === "GREEN"}
                style={{ opacity: signal[lane] === "GREEN" ? 0.5 : 1 }}>
                🟢 Green
              </button>
              <button className="btn btn-danger btn-sm"
                onClick={() => changeSignal(lane, "RED")}
                disabled={signal[lane] === "RED"}
                style={{ opacity: signal[lane] === "RED" ? 0.5 : 1 }}>
                🔴 Red
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* GRAPHS */}
      <div className="graphs-grid">
        <GraphCard title="Vehicle Comparison" subtitle="Current counts per lane" badge="Bar">
          <Bar data={vehicleCompare} options={chartDefaults} />
        </GraphCard>
        <GraphCard title="Traffic Trend" subtitle="Last 30 snapshots" badge="Line">
          <Line data={trendCompare} options={chartDefaults} />
        </GraphCard>
        <GraphCard title="Lane Priority" subtitle="AI-computed urgency" badge="Score">
          <Bar data={priorityGraph} options={chartDefaults} />
        </GraphCard>
      </div>

      {/* BOTTOM ROW */}
      <div className="bottom-grid">
        <div className="card ai-rec-card">
          <div className="card-title">
            <span className="ai-sparkle">✨</span>
            AI Recommendation
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Based on live vehicle density analysis:
          </p>
          <div className="ai-rec-chip">
            🚦 Open <strong style={{ margin: "0 4px" }}>{laneLabel[recommendedLane]}</strong> for green signal
          </div>
        </div>

        <div className="card emergency-card">
          <div className="card-title">🚨 Emergency Controls</div>
          <div className="emergency-buttons">
            <button
              className={`btn btn-danger ${emergency ? "emergency-btn-active" : ""}`}
              onClick={() => { setEmergency(p => !p); addToast("Emergency mode toggled", "error", "🚑") }}>
              🚑 Ambulance {emergency ? "ON" : "OFF"}
            </button>
            <button
              className={`btn btn-amber ${pedestrian ? "emergency-btn-active" : ""}`}
              onClick={() => { setPedestrian(p => !p); addToast("Pedestrian mode toggled", "success", "🚶") }}>
              🚶 Pedestrian {pedestrian ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">⚙️ System Status</div>
          <div className="status-list">
            <div className="status-row">
              <span className="status-label">Detection Engine</span>
              <span className="status-val online"><span className="status-dot online" /> Running</span>
            </div>
            <div className="status-row">
              <span className="status-label">Emergency Mode</span>
              <span className={`status-val ${emergency ? "offline" : "online"}`}>
                <span className={`status-dot ${emergency ? "offline" : "online"}`} />
                {emergency ? "ACTIVE" : "Standby"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Pedestrian Mode</span>
              <span className={`status-val ${pedestrian ? "warn" : "online"}`}>
                <span className={`status-dot ${pedestrian ? "warn" : "online"}`} />
                {pedestrian ? "ACTIVE" : "Standby"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">AI Model</span>
              <span className="status-val online"><span className="status-dot online" /> YOLOv8</span>
            </div>
          </div>
        </div>
      </div>

      <Toast toasts={toasts} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   LANE DETAIL PAGE
   ════════════════════════════════════════════════════════════════════════════ */

function LanePage({ lane, title }) {
  const [stats,   setStats]   = useState({})
  const [history, setHistory] = useState([])
  const [events,  setEvents]  = useState([])
  const [toasts,  setToasts]  = useState([])

  const addToast = useCallback((msg, type = "success", icon = "✅") => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type, icon }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  const addEvent = useCallback((label, type = "info") => {
    setEvents(prev => [...prev, { label, type, time: new Date().toLocaleTimeString() }])
  }, [])

  const prevDensityRef = useRef(null)
  const startedRef     = useRef(false)

  useEffect(() => {
    if (!startedRef.current) {
      addEvent(`📡 Monitoring ${title} started`, "success")
      startedRef.current = true
    }
    const interval = setInterval(async () => {
      try {
        const res   = await axios.get(`${BASE}/stats/${lane}`)
        setStats(res.data)
        const total = (res.data.cars||0)+(res.data.bikes||0)+(res.data.buses||0)+(res.data.trucks||0)
        setHistory(prev => [...prev, total].slice(-30))

        const d = res.data.density || 0
        if (prevDensityRef.current !== null) {
          if (d > 0.8 && prevDensityRef.current <= 0.8)
            addEvent("⚠️ Critical density detected!", "warning")
          else if (d > 0.5 && prevDensityRef.current <= 0.5)
            addEvent("🔶 Moderate congestion rising", "warning")
          else if (d < 0.3 && prevDensityRef.current >= 0.3)
            addEvent("✅ Traffic flow improved", "success")
        }
        prevDensityRef.current = d
      } catch {/* silent */}
    }, 1000)
    return () => clearInterval(interval)
  }, [lane, title, addEvent])

  const uploadVideo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    try {
      const res  = await fetch(`${BASE}/upload-video/${lane}`, { method: "POST", body: form })
      const json = await res.json()
      if (json.error) {
        addToast(`Upload error: ${json.error}`, "error", "❌")
        addEvent(`❌ Upload failed: ${json.error}`, "error")
      } else {
        addToast("Video uploaded ✓", "success", "🎬")
        addEvent("🎬 New video feed uploaded", "success")
      }
    } catch (err) {
      addToast("Backend offline — start the FastAPI server", "error", "❌")
      addEvent("❌ Backend not reachable", "error")
    }
  }

  const total = (stats.cars||0)+(stats.bikes||0)+(stats.buses||0)+(stats.trucks||0)

  const pieData = {
    labels: ["Cars","Bikes","Buses","Trucks"],
    datasets: [{
      data: [stats.cars||0, stats.bikes||0, stats.buses||0, stats.trucks||0],
      backgroundColor: ["rgba(59,130,246,0.85)","rgba(239,68,68,0.85)","rgba(245,158,11,0.85)","rgba(34,197,94,0.85)"],
      borderColor: ["#3b82f6","#ef4444","#f59e0b","#22c55e"],
      borderWidth: 2, hoverOffset: 8,
    }]
  }

  const trendData = {
    labels: history.map((_, i) => i + 1),
    datasets: [{
      label: "Total Vehicles",
      data: history,
      borderColor: "#6366f1",
      backgroundColor: "rgba(99,102,241,0.1)",
      tension: 0.45, fill: true, pointRadius: 0, pointHoverRadius: 6, borderWidth: 2.5,
    }]
  }

  const peakData = {
    labels: ["Current", "Session Peak", "Session Avg"],
    datasets: [{
      label: "Vehicles",
      data: [
        history.slice(-1)[0] || 0,
        Math.max(...history, 0),
        history.length ? Math.round(history.reduce((a,b)=>a+b,0)/history.length) : 0
      ],
      backgroundColor: ["rgba(99,102,241,0.85)","rgba(239,68,68,0.75)","rgba(245,158,11,0.75)"],
      borderColor: ["#6366f1","#ef4444","#f59e0b"],
      borderWidth: 2, borderRadius: 8, borderSkipped: false,
    }]
  }

  return (
    <div className="page">
      <div className="lane-detail-header">
        <div>
          <h1 className="page-title">{title} — Analysis</h1>
          <p className="page-subtitle">Real-time vehicle detection & traffic analytics</p>
        </div>
        <UploadBtn lane={lane} onUpload={uploadVideo} />
      </div>

      {/* HERO VIDEO (larger) */}
      <div className="stream-wrap stream-hero" style={{ marginBottom: 24 }}>
        <img
          className="stream-img"
          src={`${BASE}/video-stream/${lane}`}
          alt={`${title} live feed`}
          onError={e => { e.target.style.display = "none" }}
        />

        {/* Floating stats overlay — top left */}
        <div className="stream-floating-stats">
          {[
            { icon:"🚗", val: stats.cars  ||0, lbl:"Cars"   },
            { icon:"🏍", val: stats.bikes ||0, lbl:"Bikes"  },
            { icon:"🚌", val: stats.buses ||0, lbl:"Buses"  },
            { icon:"🚛", val: stats.trucks||0, lbl:"Trucks" },
          ].map(s => (
            <div key={s.lbl} className="floating-stat">
              <span className="floating-stat-icon">{s.icon}</span>
              <span className="floating-stat-val">{s.val}</span>
              <span className="floating-stat-lbl">{s.lbl}</span>
            </div>
          ))}
        </div>

        {/* Vehicle count badge — top right */}
        <div className="stream-count-badge">
          <span className="count-num">{total}</span>
          <span className="count-lbl"> vehicles</span>
        </div>

        <div className="stream-overlay">
          <span className="stream-live-badge"><span className="live-dot" /> LIVE</span>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>
            Density: {stats.density != null ? `${(stats.density * 100).toFixed(0)}%` : "—"}
          </span>
        </div>
      </div>

      {/* MAIN + SIDEBAR */}
      <div className="lane-sidebar-layout">
        <div className="lane-main-col">

          {/* Live counts card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">📊 Live Counts</div>
            <VehicleStats stats={stats} />
            <DensityBar value={stats.density} label="Traffic Density" />
            <div style={{ marginTop: 10 }}>
              <span className="eta-badge">⏱ Green ETA: {stats.green_time ?? 0}s</span>
            </div>
          </div>

          {/* Vehicle breakdown table */}
          <StatsTable stats={stats} />

          {/* Charts row */}
          <div className="lane-detail-grid">
            <GraphCard title="Vehicle Distribution" subtitle="Live breakdown" badge="Pie">
              <Pie data={pieData} options={noScaleOpts} />
            </GraphCard>
            <GraphCard title="Traffic Trend" subtitle="Last 30 snapshots" badge="Live">
              <Line data={trendData} options={chartDefaults} />
            </GraphCard>
          </div>

          {/* Peak analysis chart */}
          <div style={{ marginTop: 20 }}>
            <GraphCard title="Session Analysis" subtitle="Current vs Peak vs Average" badge="Stats">
              <Bar data={peakData} options={chartDefaults} />
            </GraphCard>
          </div>

          {/* Event timeline */}
          {events.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <EventTimeline events={events} />
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="lane-sidebar-col">
          <LaneHealthGauge stats={stats} />
        </div>
      </div>

      <Toast toasts={toasts} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   REPORT PAGE
   ════════════════════════════════════════════════════════════════════════════ */

function ReportPage() {
  const [selectedLane, setSelectedLane] = useState("lane1")
  const [timeRange,    setTimeRange]    = useState("session")
  const [sections, setSections] = useState({
    summary:           true,
    vehicleCounts:     true,
    densityHistory:    true,
    aiRecommendations: true,
  })
  const [stats,  setStats]  = useState({})
  const [history,setHistory]= useState([])
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((msg, type = "success", icon = "✅") => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type, icon }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    setHistory([])
    const interval = setInterval(async () => {
      try {
        const res   = await axios.get(`${BASE}/stats/${selectedLane}`)
        setStats(res.data)
        const total = (res.data.cars||0)+(res.data.bikes||0)+(res.data.buses||0)+(res.data.trucks||0)
        setHistory(prev => [...prev, total].slice(-30))
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [selectedLane])

  const total    = (stats.cars||0)+(stats.bikes||0)+(stats.buses||0)+(stats.trucks||0)
  const density  = ((stats.density || 0) * 100).toFixed(0)
  const peak     = history.length ? Math.max(...history) : 0
  const avg      = history.length ? Math.round(history.reduce((a,b)=>a+b,0)/history.length) : 0
  const laneNames = { lane1:"Lane 1 (Team A)", lane2:"Lane 2 (Team B)", lane3:"Lane 3 (Team C)" }

  const types = [
    { key:"cars",   icon:"🚗", label:"Cars",   color:"#3b82f6" },
    { key:"bikes",  icon:"🏍", label:"Bikes",  color:"#ef4444" },
    { key:"buses",  icon:"🚌", label:"Buses",  color:"#f59e0b" },
    { key:"trucks", icon:"🚛", label:"Trucks", color:"#22c55e" },
  ]

  /* PDF via print */
  const handlePrint = () => {
    const content = document.getElementById("report-content").innerHTML
    const w = window.open("", "_blank")
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Smart Traffic AI — ${laneNames[selectedLane]} Report</title>
      <meta charset="utf-8" />
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;max-width:900px;margin:0 auto}
        h1{font-size:22px;font-weight:700;color:#0f172a;border-bottom:3px solid #6366f1;padding-bottom:12px;margin-bottom:8px}
        .rpt-meta{font-size:12px;color:#64748b;margin-bottom:28px}
        h2{font-size:16px;font-weight:600;color:#334155;margin:28px 0 12px;padding-left:10px;border-left:3px solid #6366f1}
        .report-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .report-kpi-box{border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;background:#f8fafc}
        .report-kpi-val{font-size:28px;font-weight:700;color:#6366f1}
        .report-kpi-lbl{font-size:11px;color:#64748b;margin-top:4px}
        .report-table{width:100%;border-collapse:collapse;font-size:13px}
        .report-table thead tr{background:#f8fafc}
        .report-table th{padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase}
        .report-table td{padding:10px 14px;border-bottom:1px solid #f1f5f9}
        .report-bar-track{height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden}
        .report-bar-fill{height:100%;border-radius:3px}
        .report-ai-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px}
        .report-ai-box p{margin-bottom:10px}
        .report-ai-box ul{margin-left:18px}
        .report-ai-box li{margin-bottom:6px}
        .report-footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
        @media print{body{padding:20px}}
      </style>
    </head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  const handleCopy = () => {
    const text = [
      `Smart Traffic AI — ${laneNames[selectedLane]}`,
      `Generated: ${new Date().toLocaleString()}`,
      "=".repeat(42),
      `Total Vehicles : ${total}`,
      `Traffic Density: ${density}%`,
      `Session Peak   : ${peak}`,
      `Session Average: ${avg}`,
      `Green ETA      : ${stats.green_time || 0}s`,
      "=".repeat(42),
      "Vehicle Breakdown:",
      `  Cars:   ${stats.cars   || 0}`,
      `  Bikes:  ${stats.bikes  || 0}`,
      `  Buses:  ${stats.buses  || 0}`,
      `  Trucks: ${stats.trucks || 0}`,
    ].join("\n")
    navigator.clipboard.writeText(text)
      .then(() => addToast("Report copied to clipboard", "success", "📋"))
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`Smart Traffic AI — ${laneNames[selectedLane]} Report`)
    const body    = encodeURIComponent(
      `Hi,\n\nTraffic report for ${laneNames[selectedLane]}:\n\n` +
      `Total Vehicles: ${total}\nDensity: ${density}%\nPeak: ${peak}\n` +
      `Generated: ${new Date().toLocaleString()}\n\n— Smart Traffic AI System`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const trendData = {
    labels: history.map((_, i) => i + 1),
    datasets: [{
      label: "Vehicle Count",
      data: history,
      borderColor: "#6366f1",
      backgroundColor: "rgba(99,102,241,0.1)",
      tension: 0.45, fill: true, pointRadius: 0, borderWidth: 2.5,
    }]
  }

  const pieData = {
    labels: ["Cars","Bikes","Buses","Trucks"],
    datasets: [{
      data: [stats.cars||0, stats.bikes||0, stats.buses||0, stats.trucks||0],
      backgroundColor: ["rgba(59,130,246,0.85)","rgba(239,68,68,0.85)","rgba(245,158,11,0.85)","rgba(34,197,94,0.85)"],
      borderColor: ["#3b82f6","#ef4444","#f59e0b","#22c55e"],
      borderWidth: 2,
    }]
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📊 Report Generation</h1>
        <p className="page-subtitle">Generate & export individual team / lane performance reports</p>
      </div>

      <div className="report-layout">

        {/* ── CONFIG PANEL ── */}
        <div className="card report-config-card">
          <div className="card-title">⚙️ Report Configuration</div>

          <div className="report-field">
            <label className="report-label">Lane / Team</label>
            <select id="report-lane-select" className="report-select"
              value={selectedLane} onChange={e => setSelectedLane(e.target.value)}>
              <option value="lane1">Lane 1 — Team A</option>
              <option value="lane2">Lane 2 — Team B</option>
              <option value="lane3">Lane 3 — Team C</option>
            </select>
          </div>

          <div className="report-field">
            <label className="report-label">Time Range</label>
            <select id="report-time-range" className="report-select"
              value={timeRange} onChange={e => setTimeRange(e.target.value)}>
              <option value="session">Current Session</option>
              <option value="5min">Last 5 Minutes</option>
              <option value="30min">Last 30 Minutes</option>
              <option value="1hour">Last 1 Hour</option>
            </select>
          </div>

          <div className="report-field">
            <label className="report-label">Include Sections</label>
            <div className="report-checks">
              {[
                ["summary",           "Executive Summary"],
                ["vehicleCounts",     "Vehicle Counts"],
                ["densityHistory",    "Density History"],
                ["aiRecommendations", "AI Recommendations"],
              ].map(([key, lbl]) => (
                <label key={key} className="report-check-item">
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={e => setSections(p => ({ ...p, [key]: e.target.checked }))}
                    className="report-checkbox"
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="report-live-kpis">
            <div className="report-live-kpi">
              <span className="report-live-kpi-val">{total}</span>
              <span className="report-live-kpi-lbl">Vehicles Now</span>
            </div>
            <div className="report-live-kpi">
              <span className="report-live-kpi-val">{density}%</span>
              <span className="report-live-kpi-lbl">Density</span>
            </div>
            <div className="report-live-kpi">
              <span className="report-live-kpi-val">{peak}</span>
              <span className="report-live-kpi-lbl">Session Peak</span>
            </div>
          </div>

          <div className="report-actions">
            <button id="btn-download-pdf" className="btn btn-primary" onClick={handlePrint}>
              📄 Download PDF
            </button>
            <button id="btn-copy-text" className="btn btn-ghost" onClick={handleCopy}>
              📋 Copy Text
            </button>
            <button id="btn-email-report" className="btn btn-ghost" onClick={handleEmail}>
              📧 Email
            </button>
          </div>
        </div>

        {/* ── PREVIEW PANEL ── */}
        <div className="card report-preview-card">
          <div className="report-preview-header">
            <div className="card-title">👁️ Report Preview</div>
            <span className="graph-badge">LIVE PREVIEW</span>
          </div>

          <div className="report-preview-scroll">
            <div id="report-content" className="report-document">

              <h1>Smart Traffic AI — {laneNames[selectedLane]}</h1>
              <p className="rpt-meta">
                Generated: {new Date().toLocaleString()} · Range: {timeRange}
              </p>

              {/* SUMMARY */}
              {sections.summary && (
                <>
                  <h2>📋 Executive Summary</h2>
                  <div className="report-kpi-row">
                    <div className="report-kpi-box">
                      <div className="report-kpi-val">{total}</div>
                      <div className="report-kpi-lbl">Total Vehicles</div>
                    </div>
                    <div className="report-kpi-box">
                      <div className="report-kpi-val">{density}%</div>
                      <div className="report-kpi-lbl">Avg Density</div>
                    </div>
                    <div className="report-kpi-box">
                      <div className="report-kpi-val">{peak}</div>
                      <div className="report-kpi-lbl">Session Peak</div>
                    </div>
                    <div className="report-kpi-box">
                      <div className="report-kpi-val">{avg}</div>
                      <div className="report-kpi-lbl">Session Avg</div>
                    </div>
                  </div>
                </>
              )}

              {/* VEHICLE COUNTS */}
              {sections.vehicleCounts && (
                <>
                  <h2>🚗 Vehicle Count Breakdown</h2>
                  <table className="report-table">
                    <thead>
                      <tr><th>Type</th><th>Count</th><th>Share</th><th>Distribution</th></tr>
                    </thead>
                    <tbody>
                      {types.map(t => {
                        const count = stats[t.key] || 0
                        const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                        return (
                          <tr key={t.key} className="report-table-row">
                            <td>{t.icon} {t.label}</td>
                            <td><strong style={{ color: t.color }}>{count}</strong></td>
                            <td style={{ color: t.color }}>{pct}%</td>
                            <td>
                              <div className="report-bar-track">
                                <div className="report-bar-fill"
                                  style={{ width: `${pct}%`, background: t.color }} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ height: 180, marginTop: 16 }}>
                    <Pie data={pieData} options={noScaleOpts} />
                  </div>
                </>
              )}

              {/* DENSITY HISTORY */}
              {sections.densityHistory && (
                <>
                  <h2>📈 Traffic Density History</h2>
                  <div style={{ height: 180, marginTop: 8 }}>
                    <Line data={trendData} options={chartDefaults} />
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                    {history.length} data points captured this session.
                  </p>
                </>
              )}

              {/* AI RECOMMENDATIONS */}
              {sections.aiRecommendations && (
                <>
                  <h2>🤖 AI Recommendations</h2>
                  <div className="report-ai-box">
                    <p>Based on current traffic density of <strong>{density}%</strong>:</p>
                    <ul>
                      <li>Recommended green duration: <strong>{stats.green_time || 30}s</strong></li>
                      <li>
                        Traffic status:{" "}
                        <strong style={{
                          color: parseInt(density) < 30 ? "#22c55e"
                               : parseInt(density) < 60 ? "#f59e0b"
                               : "#ef4444"
                        }}>
                          {parseInt(density) < 30 ? "✅ Low — Normal flow"
                           : parseInt(density) < 60 ? "⚠️ Moderate — Monitor closely"
                           : "🔴 High — Extend green time"}
                        </strong>
                      </li>
                      <li>Session peak recorded: <strong>{peak} vehicles</strong></li>
                      <li>
                        Suggested action:{" "}
                        <strong>
                          {parseInt(density) > 70
                            ? "Extend green time & consider emergency protocol"
                            : "Maintain current signal timing"}
                        </strong>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              <div className="report-footer">
                <p>
                  Generated by Smart Traffic AI — YOLOv8 Detection Engine ·{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

      <Toast toasts={toasts} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT APP
   ════════════════════════════════════════════════════════════════════════════ */

export default function App() {
  return (
    <Router>
      <div className="app">
        <NavBar />
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/lane1"   element={<LanePage lane="lane1" title="Lane 1" />} />
          <Route path="/lane2"   element={<LanePage lane="lane2" title="Lane 2" />} />
          <Route path="/lane3"   element={<LanePage lane="lane3" title="Lane 3" />} />
          <Route path="/reports" element={<ReportPage />} />
        </Routes>
      </div>
    </Router>
  )
}