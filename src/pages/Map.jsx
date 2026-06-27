import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41], popupAnchor: [0, -41] });
L.Marker.mergeOptions({ icon: DefaultIcon });

const SEVERITY_DOT = { Low: "#059669", Medium: "#d97706", High: "#ea580c", Critical: "#dc2626" };
const SEVERITY_LABEL_STYLE = {
  Low:      { color: "#065f46", bg: "#ecfdf5" },
  Medium:   { color: "#78350f", bg: "#fffbeb" },
  High:     { color: "#7c2d12", bg: "#fff7ed" },
  Critical: { color: "#7f1d1d", bg: "#fef2f2" },
};

function createSeverityIcon(severity) {
  const color = SEVERITY_DOT[severity] || "#6b7280";
  const isHigh = severity === "Critical" || severity === "High";
  return L.divIcon({
    html: `<div style="
      width:${isHigh ? 18 : 14}px;
      height:${isHigh ? 18 : 14}px;
      border-radius:50%;
      background:${color};
      border:2.5px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25), 0 0 0 2px ${color}40;
      transition: transform 0.2s
    "></div>`,
    className: "",
    iconSize: [isHigh ? 18 : 14, isHigh ? 18 : 14],
    iconAnchor: [isHigh ? 9 : 7, isHigh ? 9 : 7],
  });
}

// FitBounds — only triggers when issue count changes, not on every render
function FitBounds({ issues }) {
  const map = useMap();
  const boundsKey = issues.length; // only refit when count changes
  useEffect(() => {
    if (issues.length > 0) {
      const bounds = L.latLngBounds(issues.map(i => [i.lat, i.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  // eslint-disable-next-line
  }, [boundsKey, map]);
  return null;
}

// ── MapErrorBoundary ─────────────────────────────────────────────────────────
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[MapErrorBoundary] Leaflet Map crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-6 text-center z-50">
          <span className="material-symbols-outlined text-[#ef4444]" style={{ fontSize: "36px" }}>map</span>
          <p className="text-[14px] font-bold text-[#1f2937] mt-2">Map loading failed</p>
          <p className="text-[12px] text-[#6b7280] mt-1">There was an issue initializing the Leaflet map container.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── RecenterMap ─────────────────────────────────────────────────────────────
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function Map() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [mapCenter, setMapCenter] = useState([28.6139, 77.209]); // Default to New Delhi
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const navigate = useNavigate();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  useEffect(() => {
    const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("[Map] Firestore error:", err);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.warn("[Map] Geolocation permission denied or failed, falling back to New Delhi:", err);
          setMapCenter([28.6139, 77.209]);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", "error");
      return;
    }
    showToast("Retrieving your current location...", "success");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        showToast("Map centered to your location!", "success");
      },
      (err) => {
        console.error("[Map] Geolocation error:", err);
        let msg = "Could not retrieve location. Please check browser permissions.";
        if (err.code === 1) {
          msg = "Location access denied. Please enable location permissions in your browser.";
        } else if (err.code === 2) {
          msg = "Location source unavailable. Please try again.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try again.";
        }
        showToast(msg, "error");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const severities = ["All", "Low", "Medium", "High", "Critical"];
  const filtered = useMemo(
    () => filter === "All" ? issues : issues.filter(i => i.severity === filter),
    [issues, filter]
  );

  // Severity counts for filter badges
  const counts = useMemo(() => {
    const c = {};
    severities.forEach(s => {
      c[s] = s === "All" ? issues.length : issues.filter(i => i.severity === s).length;
    });
    return c;
  // eslint-disable-next-line
  }, [issues]);

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: "var(--font-body)" }}>
      {/* Header bar */}
      <div className="px-4 md:px-6 py-3 bg-white border-b border-[#e2e8f8] flex flex-col sm:flex-row sm:items-center gap-2.5 shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-[18px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
            Live Issue Map
          </h1>
          <p className="text-[12px] text-[#737686]">
            {filtered.length} issue{filtered.length !== 1 ? "s" : ""}{filter !== "All" ? ` · ${filter} severity` : ""} · real-time
          </p>
        </div>

        <div className="sm:ml-auto flex flex-wrap gap-1.5">
          {severities.map(s => {
            const dotColor = s === "All" ? "#1a56db" : SEVERITY_DOT[s];
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold transition-all border ${
                  isActive
                    ? "bg-[#1a56db] text-white border-[#1a56db] shadow-sm"
                    : "bg-white text-[#434654] border-[#e2e8f8] hover:bg-[#f0f3ff] hover:border-[#1a56db]"
                }`}
              >
                {s !== "All" && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? "white" : dotColor }}
                  />
                )}
                {s}
                {counts[s] > 0 && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5 ${
                    isActive ? "bg-white/20 text-white" : "bg-[#f0f3ff] text-[#1a56db]"
                  }`}>
                    {counts[s]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-[#1a56db] border-t-transparent rounded-full spinner" style={{ borderWidth: 3 }} />
              <p className="text-[13px] font-semibold text-[#434654]">Loading issues…</p>
            </div>
          </div>
        )}

        <MapErrorBoundary>
          <MapContainer
            center={mapCenter}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap center={mapCenter} />
            {filtered.length > 0 && <FitBounds issues={filtered} />}
            {filtered.map(issue =>
              issue.lat && issue.lng ? (
                <Marker key={issue.id} position={[issue.lat, issue.lng]} icon={createSeverityIcon(issue.severity)}>
                  <Popup maxWidth={240} minWidth={200}>
                    <div className="space-y-2.5">
                      {issue.photoURL && (
                        <img
                          src={issue.photoURL}
                          alt={issue.issueType}
                          className="w-full h-28 object-cover rounded-lg"
                          style={{ borderRadius: 8 }}
                        />
                      )}
                      <div>
                        <p className="font-bold text-[14px] text-[#151c27] mb-1.5">{issue.issueType}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: SEVERITY_LABEL_STYLE[issue.severity]?.color || "#737686",
                              background: SEVERITY_LABEL_STYLE[issue.severity]?.bg || "#f0f3ff",
                            }}
                          >
                            {issue.severity}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#434654]">
                            {issue.status}
                          </span>
                        </div>
                      </div>
                      {issue.department && (
                        <p className="text-[12px] text-[#737686] flex items-center gap-1">
                          <span style={{ fontSize: "12px" }}>🏢</span> {issue.department}
                        </p>
                      )}
                      {issue.description && (
                        <p className="text-[12px] text-[#434654] leading-relaxed line-clamp-2">{issue.description}</p>
                      )}
                      <button
                        onClick={() => navigate(`/issue/${issue.id}`)}
                        className="w-full bg-[#1a56db] text-white text-[12px] font-bold py-2 rounded-lg hover:bg-[#003fb1] transition-colors"
                      >
                        View Details →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        </MapErrorBoundary>

        {/* Legend */}
        {!loading && (
          <div className="absolute bottom-6 left-4 bg-white/90 backdrop-blur rounded-2xl border border-[#e2e8f8] shadow-md px-4 py-3 z-[400]">
            <p className="text-[10px] font-bold text-[#737686] uppercase tracking-wide mb-2">Severity Legend</p>
            {Object.entries(SEVERITY_DOT).map(([sev, color]) => (
              <div key={sev} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-semibold text-[#434654]">{sev}</span>
                <span className="text-[10px] text-[#737686] ml-auto pl-3">{counts[sev]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Locate Me Floating Button */}
        {!loading && (
          <button
            onClick={handleLocateMe}
            className="absolute bottom-6 right-4 bg-white hover:bg-[#f0f3ff] text-[#1a56db] border border-[#e2e8f8] shadow-md px-4 py-3 rounded-2xl flex items-center gap-2 text-[12px] font-bold transition-all active:scale-95 z-[400]"
            aria-label="Center on my location"
          >
            <span className="material-symbols-outlined text-[16px]">my_location</span>
            My Location
          </button>
        )}

        {/* Empty state overlay */}
        {!loading && filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[200]">
            <div className="bg-white/95 backdrop-blur rounded-2xl border border-[#e2e8f8] shadow-lg px-8 py-6 text-center max-w-xs pointer-events-auto">
              <span className="material-symbols-outlined text-[#c3c5d7] block" style={{ fontSize: "40px" }}>
                location_off
              </span>
              <p className="text-[14px] font-bold text-[#151c27] mt-2">
                {issues.length === 0 ? "No issues reported yet" : "No issues found"}
              </p>
              <p className="text-[12px] text-[#737686] mt-1">
                {issues.length === 0 ? "No reports in the database yet." : `No ${filter} severity issues reported.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = "success" }) {
  if (!message) return null;
  const styles = {
    success: "bg-[#151c27] text-white border border-[#2b3544]",
    error:   "bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]",
  };
  return (
    <div className={`fixed top-6 left-1/2 z-[999] px-5 py-2.5 rounded-2xl shadow-lg text-[13.5px] font-semibold toast-enter ${styles[type]}`}
      style={{ transform: "translateX(-50%)" }}
    >
      {message}
    </div>
  );
}
