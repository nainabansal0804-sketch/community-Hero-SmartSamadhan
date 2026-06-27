import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "motion/react";
import { uploadImage } from "../utils/uploadImage";

// Leaflet markers
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41], popupAnchor: [0, -41] });
L.Marker.mergeOptions({ icon: DefaultIcon });

const SEVERITY_COLORS = {
  Low:      "#059669",
  Medium:   "#d97706",
  High:     "#ea580c",
  Critical: "#dc2626",
};

const SEVERITY_BADGE = {
  Low:      "bg-emerald-50 text-emerald-700 border-emerald-100",
  Medium:   "bg-amber-50 text-amber-700 border-amber-100",
  High:     "bg-orange-50 text-orange-700 border-orange-100",
  Critical: "bg-red-50 text-red-700 border-red-100 animate-pulse",
};

const STATUS_PILL = {
  Reported:             "bg-gray-50 text-gray-700 border-gray-200",
  Verified:             "bg-blue-50 text-blue-700 border-blue-100",
  Escalated:            "bg-indigo-50 text-indigo-700 border-indigo-100",
  "In Progress":         "bg-purple-50 text-purple-700 border-purple-100",
  Resolved:            "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Community Resolved":  "bg-teal-50 text-teal-800 border-teal-100 font-bold",
  "Needs Verification": "bg-yellow-50 text-yellow-800 border-yellow-200 font-medium",
};

// Map Recenter Helper
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13, { animate: true });
    }
  }, [center, map]);
  return null;
}

// Calculate Trust Score (0–100)
export function calculateTrustScore(issue) {
  // Base from AI Confidence (0.5 to 1.0)
  let score = Math.round((issue.confidence || 0.8) * 55);

  // Verifications add 8 points each (max 25 pts)
  const verCount = issue.verifiedUsers?.length || 0;
  score += Math.min(25, verCount * 8);

  // Affected count adds 3 points each (max 20 pts)
  const affCount = issue.affectedUsers?.length || 0;
  score += Math.min(20, affCount * 3);

  // Reductions for Issue Not Found (20 pts per flag)
  const notFoundCount = issue.notFoundUsers?.length || 0;
  score -= notFoundCount * 20;

  // Resolution confirmation bonus
  if (issue.status === "Community Resolved" || issue.status === "Resolved") {
    score = 100;
  }

  return Math.max(0, Math.min(100, score));
}

// Trust Badge Details
export function getTrustDetails(score) {
  if (score >= 75) return { label: "Highly Trusted", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: "verified" };
  if (score >= 40) return { label: "Needs Verification", color: "text-amber-700 bg-amber-50 border-amber-200", icon: "help" };
  return { label: "Low Confidence", color: "text-red-700 bg-red-50 border-red-200", icon: "warning" };
}

// Priority Score for Smart Ranking
export function getPriorityScore(issue) {
  let score = 0;
  // Severity Weight
  if (issue.severity === "Critical") score += 100;
  else if (issue.severity === "High") score += 70;
  else if (issue.severity === "Medium") score += 45;
  else score += 20;

  // Citizens Affected
  const affCount = issue.affectedUsers?.length || 0;
  score += affCount * 12;

  // Verification impact
  const verCount = issue.verifiedUsers?.length || 0;
  score += verCount * 5;

  // Trust Score (weighted)
  const trust = calculateTrustScore(issue);
  score += (trust / 100) * 35;

  return score;
}

// Distance computation (Haversine formula)
export function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LiveIssues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [distanceFilter, setDistanceFilter] = useState("All"); // "All", "1", "5", "15", "50"
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [presetSort, setPresetSort] = useState("Priority"); // "Priority", "Verified", "Affected", "Newest", "Trust"

  // Location details
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  // Map configuration
  const [mapCenter, setMapCenter] = useState([28.6139, 77.209]); // Default: New Delhi
  const [mapProvider, setMapProvider] = useState("google"); // "google" (Roadmap), "google-satellite" (Hybrid), "osm" (Standard OpenStreetMap)
  const [toast, setToast] = useState({ msg: "", type: "success" });

  // Resolution image modal / upload action
  const [resolveIssueId, setResolveIssueId] = useState(null);
  const [resolvingPhoto, setResolvingPhoto] = useState(null);
  const [resolvingPreview, setResolvingPreview] = useState(null);
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Pagination / Lazy Loading
  const [visibleCount, setVisibleCount] = useState(6);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4500);
  };

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setMapCenter([coords.lat, coords.lng]);
          setLocating(false);
          showToast("Retrieved your current location!", "success");
        },
        (err) => {
          console.warn("[LiveIssues] Geolocation blocked or failed. Defaulting to Central Delhi.", err);
          setUserCoords({ lat: 28.6139, lng: 77.209 }); // Delhi NCR default
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // Fetch real-time issues
  useEffect(() => {
    const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("[LiveIssues] Firestore listener failed:", err);
        setLoading(false);
        showToast("Failed to load issues in real-time.", "error");
      }
    );
    return unsub;
  }, []);

  // List of unique departments
  const uniqueDepartments = useMemo(() => {
    const deps = new Set(issues.map((i) => i.department).filter(Boolean));
    return ["All", ...Array.from(deps)];
  }, [issues]);

  // Handle Gamification XP Awards Helper
  const awardPoints = async (points, reason) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          civicPoints: increment(points),
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      showToast(`+${points} Civic XP earned for: ${reason}!`, "success");
    } catch (e) {
      console.error("[Gamification] Failed to award points", e);
    }
  };

  // ── Community Verification System Handlers ────────────────────────────────────

  const handleVerifyIssue = async (issueId, verifiedUsers = []) => {
    if (!user) {
      showToast("Please sign in to verify issues!", "error");
      return;
    }
    if (verifiedUsers.includes(user.uid)) {
      showToast("You have already verified this issue.", "error");
      return;
    }

    const issueRef = doc(db, "issues", issueId);
    try {
      // Calculate XP rewards dynamically
      const targetIssue = issues.find((i) => i.id === issueId);
      const isFirst = !verifiedUsers || verifiedUsers.length === 0;
      const isCritical = targetIssue?.severity === "Critical";
      let xpAwarded = 15;
      if (isFirst) xpAwarded = 30; // First Verification bonus
      else if (isCritical) xpAwarded = 50; // Critical issue priority verification

      // Create beautiful activity log
      const log = {
        type: "verification",
        user: user.displayName || "Nearby Citizen",
        text: `${user.displayName || "A nearby citizen"} verified this report.`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(issueRef, {
        verifiedUsers: arrayUnion(user.uid),
        activityTimeline: arrayUnion(log),
      });

      // Award XP
      await awardPoints(xpAwarded, isFirst ? "First Verification bonus" : isCritical ? "Critical issue verification" : "Verifying civic issue");
    } catch (err) {
      console.error("[Verification Hub] Error verifying issue:", err);
      showToast("Could not verify. Please try again.", "error");
    }
  };

  const handleImAffected = async (issueId, affectedUsers = []) => {
    if (!user) {
      showToast("Please sign in to indicate you are affected!", "error");
      return;
    }
    if (affectedUsers.includes(user.uid)) {
      showToast("You already indicated you are affected.", "error");
      return;
    }

    const issueRef = doc(db, "issues", issueId);
    try {
      const log = {
        type: "affected",
        user: user.displayName || "Affected Citizen",
        text: `${user.displayName || "An affected citizen"} stated they Daily Encounter/Use this area.`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(issueRef, {
        affectedUsers: arrayUnion(user.uid),
        activityTimeline: arrayUnion(log),
      });

      await awardPoints(10, "Confirming daily impact");
    } catch (err) {
      console.error("[Verification Hub] Error submitting affected state:", err);
      showToast("Could not submit. Please try again.", "error");
    }
  };

  const handleIssueNotFound = async (issueId, notFoundUsers = []) => {
    if (!user) {
      showToast("Please sign in to report issue missing!", "error");
      return;
    }
    if (notFoundUsers.includes(user.uid)) {
      showToast("You already marked this issue as not found.", "error");
      return;
    }

    const issueRef = doc(db, "issues", issueId);
    try {
      const targetIssue = issues.find((i) => i.id === issueId);
      const updatedNotFoundCount = (notFoundUsers?.length || 0) + 1;

      const log = {
        type: "not_found",
        user: user.displayName || "Validator",
        text: `${user.displayName || "A citizen"} flagged that the issue was not visible or found.`,
        timestamp: new Date().toISOString(),
      };

      const updateData = {
        notFoundUsers: arrayUnion(user.uid),
        activityTimeline: arrayUnion(log),
      };

      // Flag for manual AI / community re-analysis if repeated >= 3
      if (updatedNotFoundCount >= 3) {
        updateData.status = "Needs Verification";
      }

      await updateDoc(issueRef, updateData);
      showToast("Discrepancy registered. Trust Score updated.", "success");
    } catch (err) {
      console.error("[Verification Hub] Error reporting not found:", err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setResolvingPhoto(file);
      setResolvingPreview(URL.createObjectURL(file));
    }
  };

  const submitResolution = async () => {
    if (!user) return;
    if (!resolvingPhoto) {
      showToast("Please take or upload a confirmation photo.", "error");
      return;
    }

    setSubmittingResolution(true);
    try {
      const photoURL = await uploadImage(resolvingPhoto);

      const log = {
        type: "resolved",
        user: user.displayName || "Resolver",
        text: `${user.displayName || "A community member"} completed resolution & uploaded proof photo.`,
        timestamp: new Date().toISOString(),
        photo: photoURL,
      };

      const issueRef = doc(db, "issues", resolveIssueId);
      await updateDoc(issueRef, {
        status: "Community Resolved",
        resolvedPhotoURL: photoURL,
        resolvedAt: serverTimestamp(),
        gallery: arrayUnion(photoURL),
        activityTimeline: arrayUnion(log),
      });

      await awardPoints(25, "Uploading verified issue resolution proof");
      setResolveIssueId(null);
      setResolvingPhoto(null);
      setResolvingPreview(null);
      showToast("Issue resolved! Authorities and neighbors notified.", "success");
    } catch (e) {
      console.error("[Verification Hub] Resolution failed:", e);
      showToast("Failed to post resolution. Try again.", "error");
    } finally {
      setSubmittingResolution(false);
    }
  };

  // ── Filters & Search Logic ───────────────────────────────────────────────────

  const filteredIssues = useMemo(() => {
    let result = [...issues];

    // Search query matches
    if (search.trim()) {
      const queryStr = search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.issueType || "").toLowerCase().includes(queryStr) ||
          (i.description || "").toLowerCase().includes(queryStr) ||
          (i.department || "").toLowerCase().includes(queryStr) ||
          (i.address || "").toLowerCase().includes(queryStr)
      );
    }

    // Severity Filter
    if (severityFilter !== "All") {
      result = result.filter((i) => i.severity === severityFilter);
    }

    // Status Filter
    if (statusFilter !== "All") {
      result = result.filter((i) => i.status === statusFilter);
    }

    // Department Filter
    if (departmentFilter !== "All") {
      result = result.filter((i) => i.department === departmentFilter);
    }

    // Distance Filter
    if (distanceFilter !== "All" && userCoords) {
      const maxDist = parseFloat(distanceFilter);
      result = result.filter((i) => {
        const d = getDistance(userCoords.lat, userCoords.lng, i.lat, i.lng);
        return d !== null && d <= maxDist;
      });
    }

    // Preset / Ordering Views
    result.sort((a, b) => {
      if (presetSort === "Priority") {
        return getPriorityScore(b) - getPriorityScore(a);
      }
      if (presetSort === "Trust") {
        return calculateTrustScore(b) - calculateTrustScore(a);
      }
      if (presetSort === "Affected") {
        return (b.affectedUsers?.length || 0) - (a.affectedUsers?.length || 0);
      }
      if (presetSort === "Verified") {
        return (b.verifiedUsers?.length || 0) - (a.verifiedUsers?.length || 0);
      }
      if (presetSort === "Newest") {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      }
      return 0;
    });

    return result;
  }, [issues, search, severityFilter, statusFilter, departmentFilter, distanceFilter, presetSort, userCoords]);

  // Leaflet Tile URLs
  const getTileUrl = () => {
    if (mapProvider === "google") {
      // Clean Google Roadmap Tiles
      return "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    }
    if (mapProvider === "google-satellite") {
      // Google Hybrid Satellite Tiles
      return "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
    }
    // Standard OpenStreetMap
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  };

  const getTileAttribution = () => {
    if (mapProvider.startsWith("google")) {
      return "&copy; Google Maps Layer / Satellite";
    }
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  };

  return (
    <div className="px-4 md:px-8 py-6 w-full max-w-7xl mx-auto space-y-6 pb-24" style={{ fontFamily: "var(--font-body)" }}>
      {/* ── Top Header and Live Stats Row ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[25px] font-extrabold text-[#151c27] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <span className="material-symbols-outlined text-[#1a56db] text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            Live Issues &amp; Verification Hub
          </h1>
          <p className="text-[13.5px] text-[#737686]">
            Collaborative validation, community verification, and live prioritization
          </p>
        </div>

        <button
          onClick={() => navigate("/report")}
          className="flex items-center gap-2 bg-[#1a56db] text-white px-5 py-3 rounded-2xl text-[13.5px] font-extrabold hover:bg-[#003fb1] hover:-translate-y-0.5 transition-all shadow-md active:translate-y-0"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
          Report New Issue
        </button>
      </div>

      {/* Modern Glassmorphic Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f8] p-4 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#f0f3ff] text-[#1a56db] flex items-center justify-center">
            <span className="material-symbols-outlined">analytics</span>
          </div>
          <div>
            <div className="text-[10px] text-[#737686] font-bold uppercase tracking-wider">Total Active</div>
            <div className="text-[18px] font-extrabold text-[#151c27]">{issues.length} Issues</div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f8] p-4 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined">rule_folder</span>
          </div>
          <div>
            <div className="text-[10px] text-[#737686] font-bold uppercase tracking-wider">Verified Reports</div>
            <div className="text-[18px] font-extrabold text-emerald-700">
              {issues.filter((i) => i.verifiedUsers?.length > 0).length} Reports
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f8] p-4 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div>
            <div className="text-[10px] text-[#737686] font-bold uppercase tracking-wider">Affected Citizens</div>
            <div className="text-[18px] font-extrabold text-orange-600">
              {issues.reduce((sum, i) => sum + (i.affectedUsers?.length || 0), 0)} Confirmed
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f8] p-4 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <span className="material-symbols-outlined">done_all</span>
          </div>
          <div>
            <div className="text-[10px] text-[#737686] font-bold uppercase tracking-wider">Resolved</div>
            <div className="text-[18px] font-extrabold text-teal-700">
              {issues.filter((i) => i.status === "Community Resolved" || i.status === "Resolved").length} Saved
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Map & Dual Layer Switch ── */}
      <div className="bg-white border border-[#e2e8f8] rounded-2xl shadow-sm overflow-hidden flex flex-col relative h-[360px] md:h-[420px]">
        {/* Map Header bar with provider toggles */}
        <div className="bg-[#fafbfe] border-b border-[#e2e8f8] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 z-[401]">
          <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#151c27]">
            <span className="material-symbols-outlined text-[#1a56db]">explore</span>
            Interactive Issue Hotspots
          </div>

          <div className="flex items-center bg-white border border-[#e2e8f8] p-1 rounded-xl shadow-xs gap-1">
            <button
              onClick={() => setMapProvider("osm")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                mapProvider === "osm" ? "bg-[#1a56db] text-white shadow-xs" : "text-[#737686] hover:bg-[#f0f3ff]"
              }`}
            >
              OpenStreetMap
            </button>
            <button
              onClick={() => setMapProvider("google")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                mapProvider === "google" ? "bg-[#1a56db] text-white shadow-xs" : "text-[#737686] hover:bg-[#f0f3ff]"
              }`}
            >
              Google Map
            </button>
            <button
              onClick={() => setMapProvider("google-satellite")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                mapProvider === "google-satellite" ? "bg-[#1a56db] text-white shadow-xs" : "text-[#737686] hover:bg-[#f0f3ff]"
              }`}
            >
              Satellite
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="w-full flex-1 relative z-[10]">
          <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={getTileUrl()} attribution={getTileAttribution()} />
            <RecenterMap center={mapCenter} />

            {filteredIssues.map((issue) => {
              const color = SEVERITY_COLORS[issue.severity] || "#9ca3af";
              const isHigh = issue.severity === "Critical" || issue.severity === "High";
              const mapIcon = L.divIcon({
                html: `<div style="
                  width:${isHigh ? 22 : 16}px;
                  height:${isHigh ? 22 : 16}px;
                  border-radius:50%;
                  background:${color};
                  border:2.5px solid white;
                  box-shadow:0 3px 10px rgba(0,0,0,0.35), 0 0 0 2.5px ${color}45;
                "></div>`,
                className: "",
                iconSize: [isHigh ? 22 : 16, isHigh ? 22 : 16],
                iconAnchor: [isHigh ? 11 : 8, isHigh ? 11 : 8],
              });

              return (
                <Marker key={issue.id} position={[issue.lat, issue.lng]} icon={mapIcon}>
                  <Popup>
                    <div className="p-1 space-y-2 font-sans w-52 max-w-full">
                      {issue.photoURL && (
                        <img src={issue.photoURL} alt="" className="w-full h-20 object-cover rounded-lg" />
                      )}
                      <div>
                        <div className="font-extrabold text-[13.5px] leading-tight text-[#151c27]">{issue.issueType}</div>
                        <div className="text-[11px] text-[#737686] mt-0.5 font-medium">📍 {issue.address || "Delhi NCR"}</div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[issue.severity]}`}>
                          {issue.severity}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#1a56db]">
                          Trust: {calculateTrustScore(issue)}%
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/issue/${issue.id}`)}
                        className="w-full mt-2 bg-[#1a56db] text-white hover:bg-[#003fb1] py-1.5 rounded-lg text-[11px] font-bold transition-all text-center"
                      >
                        Interactive Verification Hub
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Quick Find Me Floating Button */}
          <button
            onClick={() => {
              if (navigator.geolocation) {
                showToast("Retrieving precise coordinates...", "success");
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setMapCenter([pos.coords.latitude, pos.coords.longitude]);
                    showToast("Centered to your physical location!", "success");
                  },
                  (err) => {
                    showToast("Failed to retrieve current GPS state.", "error");
                  }
                );
              }
            }}
            className="absolute bottom-4 right-4 bg-white hover:bg-[#f0f3ff] text-[#1a56db] border border-[#e2e8f8] shadow-md px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-95 z-[400]"
          >
            <span className="material-symbols-outlined text-[15px]">my_location</span>
            Center GPS
          </button>
        </div>
      </div>

      {/* ── Search & Advanced Filters Segment ── */}
      <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Main search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737686]" style={{ fontSize: "20px" }}>
              search
            </span>
            <input
              type="text"
              placeholder="Search reports by title, category, department or area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#fafbfe] border border-[#e2e8f8] rounded-xl text-[14px] font-semibold text-[#151c27] focus:outline-none focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/10 transition-all placeholder:text-[#9396a8]"
            />
          </div>

          {/* Quick preset selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "Priority", label: "🔥 Priority Priority" },
              { id: "Trust", label: "🟢 Highest Trusted" },
              { id: "Affected", label: "📍 Most Affected" },
              { id: "Verified", label: "✅ Most Verified" },
              { id: "Newest", label: "⏱️ Newest Reports" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetSort(p.id)}
                className={`px-3 py-2 rounded-xl text-[11.5px] font-bold transition-all ${
                  presetSort === p.id ? "bg-[#1a56db]/8 text-[#1a56db] border border-[#1a56db]" : "bg-[#fafbfe] text-[#737686] border border-[#e2e8f8] hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {/* Severity */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#737686]">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-[#fafbfe] border border-[#e2e8f8] px-3 py-2 rounded-xl text-[12.5px] font-semibold text-[#434654] focus:outline-none"
            >
              <option value="All">All Severities</option>
              <option value="Critical">🚨 Critical Only</option>
              <option value="High">🟠 High Severity</option>
              <option value="Medium">🟡 Medium Severity</option>
              <option value="Low">🟢 Low Severity</option>
            </select>
          </div>

          {/* Distance Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#737686]">Distance Radius</label>
            <select
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(e.target.value)}
              className="w-full bg-[#fafbfe] border border-[#e2e8f8] px-3 py-2 rounded-xl text-[12.5px] font-semibold text-[#434654] focus:outline-none"
            >
              <option value="All">Any Distance</option>
              <option value="1">Within 1 km</option>
              <option value="5">Within 5 km</option>
              <option value="15">Within 15 km</option>
              <option value="50">Within 50 km</option>
            </select>
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#737686]">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full bg-[#fafbfe] border border-[#e2e8f8] px-3 py-2 rounded-xl text-[12.5px] font-semibold text-[#434654] focus:outline-none overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {uniqueDepartments.map((d) => (
                <option key={d} value={d}>
                  {d === "All" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#737686]">Current Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#fafbfe] border border-[#e2e8f8] px-3 py-2 rounded-xl text-[12.5px] font-semibold text-[#434654] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="Verified">Verified</option>
              <option value="In Progress">In Progress</option>
              <option value="Community Resolved">Community Resolved</option>
              <option value="Needs Verification">Needs Verification</option>
            </select>
          </div>

          {/* Quick reset */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setSeverityFilter("All");
                setDistanceFilter("All");
                setDepartmentFilter("All");
                setStatusFilter("All");
                setPresetSort("Priority");
              }}
              className="w-full border border-dashed border-[#c3c5d7] hover:border-[#1a56db] text-[#737686] hover:text-[#1a56db] py-2 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>restart_alt</span>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Issue Cards Feed Grid ── */}
      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <div className="text-[13.5px] font-bold text-[#434654]">
            Showing <span className="text-[#1a56db]">{filteredIssues.length}</span> live reports based on filter criteria
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
            <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "52px" }}>
              analytics
            </span>
            <h3 className="text-[16px] font-bold text-[#151c27]">No matching civic issues found</h3>
            <p className="text-[12.5px] text-[#737686] max-w-sm leading-relaxed">
              Try relaxing your search terms or expanding the location search radius filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredIssues.slice(0, visibleCount).map((issue, idx) => {
                const trustScore = calculateTrustScore(issue);
                const trustBadge = getTrustDetails(trustScore);
                const dist = userCoords
                  ? getDistance(userCoords.lat, userCoords.lng, issue.lat, issue.lng)
                  : null;

                const hasVerified = issue.verifiedUsers?.includes(user?.uid);
                const hasAffected = issue.affectedUsers?.includes(user?.uid);
                const hasNotFound = issue.notFoundUsers?.includes(user?.uid);

                const timeStr = issue.createdAt?.toDate
                  ? issue.createdAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : "Recently";

                return (
                  <motion.div
                    key={issue.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: Math.min(6, idx) * 0.05 }}
                    className="bg-white border border-[#e2e8f8] rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col h-full group"
                  >
                    {/* Card Header Media area */}
                    <div className="relative h-44 bg-[#f0f3ff] overflow-hidden">
                      {issue.photoURL ? (
                        <img
                          src={issue.photoURL}
                          alt={issue.issueType}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#737686]">
                          <span className="material-symbols-outlined text-4xl">broken_image</span>
                          <span className="text-[11px] mt-1 font-semibold">No Image Provided</span>
                        </div>
                      )}

                      {/* Float badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                        <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${SEVERITY_BADGE[issue.severity] || "bg-gray-100 text-gray-700"}`}>
                          {issue.severity} Severity
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-xs ${STATUS_PILL[issue.status] || "bg-gray-100 text-gray-700"}`}>
                          {issue.status}
                        </span>
                      </div>

                      {/* Confidence Score Float overlay */}
                      {issue.confidence > 0 && (
                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white px-2 py-1 rounded-lg text-[9.5px] font-bold flex items-center gap-1 shadow-xs">
                          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>psychology</span>
                          AI Confidence: {Math.round(issue.confidence * 100)}%
                        </div>
                      )}
                    </div>

                    {/* Card Main Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Title and location */}
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            onClick={() => navigate(`/issue/${issue.id}`)}
                            className="text-[15.5px] font-extrabold text-[#151c27] hover:text-[#1a56db] transition-colors cursor-pointer line-clamp-1"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {issue.issueType}
                          </h3>
                        </div>

                        <p className="text-[11px] text-[#737686] font-semibold mt-0.5 flex items-center gap-1">
                          🏢 <span className="text-[#434654]">{issue.department || "Municipal Board"}</span>
                        </p>

                        <p className="text-[12.5px] text-[#434654] line-clamp-2 mt-2 leading-relaxed">
                          {issue.description}
                        </p>
                      </div>

                      {/* Detailed Meta Items */}
                      <div className="bg-[#fafbfe] border border-[#e2e8f8]/60 rounded-xl p-3 space-y-2 text-[11px]">
                        {/* Distance & Address */}
                        <div className="flex justify-between items-center text-[#434654] font-medium">
                          <span className="text-[#737686] flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[13px]">location_on</span>
                            Distance:
                          </span>
                          <span className="font-bold text-[#151c27]">
                            {dist !== null ? `${dist.toFixed(2)} km away` : "Unknown location"}
                          </span>
                        </div>

                        {/* Trust Score Gauge */}
                        <div className="flex justify-between items-center">
                          <span className="text-[#737686] flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[13px] text-[#1a56db]">verified_user</span>
                            Trust Score:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  trustScore >= 75 ? "bg-emerald-500" : trustScore >= 40 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${trustScore}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-[#151c27]">{trustScore}%</span>
                          </div>
                        </div>

                        {/* Trust Badge label */}
                        <div className="flex justify-between items-center pt-1 border-t border-dashed border-[#e2e8f8]">
                          <span className="text-[#737686]">Verification Badge:</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border ${trustBadge.color} flex items-center gap-0.5`}>
                            <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>{trustBadge.icon}</span>
                            {trustBadge.label}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Community Counts */}
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-emerald-700 flex items-center gap-0.5 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          Verified by {issue.verifiedUsers?.length || 0}
                        </span>
                        <span className="text-orange-700 flex items-center gap-0.5 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
                          <span className="material-symbols-outlined text-[13px]">groups</span>
                          {issue.affectedUsers?.length || 0} Affected
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[#f0f3ff] my-1" />

                      {/* Interactive Action Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Verify Issue Button */}
                        <button
                          onClick={() => handleVerifyIssue(issue.id, issue.verifiedUsers)}
                          disabled={hasVerified}
                          className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11.5px] font-extrabold transition-all btn-press border ${
                            hasVerified
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed"
                              : "bg-white text-[#1a56db] border-[#e2e8f8] hover:bg-[#f0f3ff] hover:border-[#1a56db]"
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            {hasVerified ? "check" : "add_moderator"}
                          </span>
                          {hasVerified ? "Verified" : "Verify Issue"}
                        </button>

                        {/* I'm Affected Button */}
                        <button
                          onClick={() => handleImAffected(issue.id, issue.affectedUsers)}
                          disabled={hasAffected}
                          className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11.5px] font-extrabold transition-all btn-press border ${
                            hasAffected
                              ? "bg-orange-50 text-orange-700 border-orange-200 cursor-not-allowed"
                              : "bg-white text-[#ea580c] border-[#e2e8f8] hover:bg-orange-50/50 hover:border-[#ea580c]"
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            {hasAffected ? "check" : "groups"}
                          </span>
                          {hasAffected ? "Affected" : "I'm Affected"}
                        </button>

                        {/* Issue Not Found button */}
                        <button
                          onClick={() => handleIssueNotFound(issue.id, issue.notFoundUsers)}
                          disabled={hasNotFound}
                          className={`col-span-2 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10.5px] font-bold text-gray-500 hover:text-red-600 transition-all ${
                            hasNotFound ? "text-red-700 bg-red-50/50 cursor-not-allowed" : ""
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>report_off</span>
                          {hasNotFound ? "Flagged Missing" : "Flag: Issue Not Found"}
                        </button>

                        {/* Resolve Issue Button */}
                        {issue.status !== "Community Resolved" && issue.status !== "Resolved" && (
                          <button
                            onClick={() => setResolveIssueId(issue.id)}
                            className="col-span-2 mt-1 flex items-center justify-center gap-1 bg-[#1a56db] text-white hover:bg-[#003fb1] py-2 rounded-xl text-[11.5px] font-bold transition-all btn-press shadow-xs"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check_circle</span>
                            Community Resolve Proof
                          </button>
                        )}
                      </div>

                      {/* ETA & Details view link */}
                      <div className="pt-2 border-t border-[#f0f3ff] flex items-center justify-between text-[10px] text-[#737686] font-bold">
                        <span className="flex items-center gap-0.5">
                          ⏱️ {issue.predictedResolutionTime ? `~${issue.predictedResolutionTime}d ETA` : "No ETA yet"}
                        </span>
                        <button
                          onClick={() => navigate(`/issue/${issue.id}`)}
                          className="text-[#1a56db] hover:underline flex items-center gap-0.5 text-[11px] font-extrabold"
                        >
                          Details &amp; Timeline
                          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Lazy load pagination footer */}
        {filteredIssues.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="px-6 py-3 border border-[#c3c5d7] hover:border-[#1a56db] text-[#434654] hover:text-[#1a56db] rounded-2xl text-[13px] font-bold transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined">expand_more</span>
              Load More Live Issues
            </button>
          </div>
        )}
      </div>

      {/* ── Proof of Resolution Modal Overlay ── */}
      {resolveIssueId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[16px] font-extrabold text-[#151c27] flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                Prove Community Resolution
              </h3>
              <button
                onClick={() => {
                  setResolveIssueId(null);
                  setResolvingPhoto(null);
                  setResolvingPreview(null);
                }}
                className="text-[#737686] hover:text-black"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-[12.5px] text-[#737686] leading-relaxed">
              Help your neighbors by confirming this issue is resolved. Upload a photo of the completed repairs or cleared area to transition this issue to <span className="font-bold text-teal-800">Community Resolved</span> and claim <span className="text-[#1a56db] font-bold">+25 Civic XP</span>!
            </p>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-[#c3c5d7] rounded-xl p-4 text-center cursor-pointer relative hover:border-[#1a56db] transition-colors">
              {resolvingPreview ? (
                <div className="space-y-2">
                  <img src={resolvingPreview} alt="Preview" className="w-full h-36 object-cover rounded-lg" />
                  <button
                    onClick={() => {
                      setResolvingPhoto(null);
                      setResolvingPreview(null);
                    }}
                    className="text-[11px] text-red-500 hover:underline font-bold"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block space-y-2 py-4">
                  <span className="material-symbols-outlined text-4xl text-gray-400">add_a_photo</span>
                  <div className="text-[12px] font-bold text-[#151c27]">Click to snap or upload a photo</div>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setResolveIssueId(null);
                  setResolvingPhoto(null);
                  setResolvingPreview(null);
                }}
                className="px-4 py-2 border border-[#e2e8f8] rounded-xl text-[12px] font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                disabled={submittingResolution || !resolvingPhoto}
                className="px-5 py-2 bg-[#1a56db] text-white hover:bg-[#003fb1] disabled:bg-gray-200 disabled:text-gray-400 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1"
              >
                {submittingResolution ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[14px]">progress_activity</span>
                    Submitting Proof...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">done</span>
                    Submit Resolution Proof
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Alerts / Notifications Indicator */}
      <div className="fixed bottom-6 left-6 z-[400]">
        <div className="bg-[#151c27] text-white text-[11px] px-3.5 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg animate-bounce duration-1000 border border-[#2b3544]">
          <span className="material-symbols-outlined text-amber-400 text-sm">notifications_active</span>
          <span>Verification Engine active nearby in your city</span>
        </div>
      </div>

      {/* Toast notifications */}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}

// Toast component
function Toast({ message, type = "success" }) {
  if (!message) return null;
  const styles = {
    success: "bg-[#151c27] text-white border border-[#2b3544]",
    error:   "bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]",
  };
  return (
    <div
      className={`fixed top-6 left-1/2 z-[1050] px-5 py-2.5 rounded-2xl shadow-lg text-[13.5px] font-bold toast-enter ${styles[type]}`}
      style={{ transform: "translateX(-50%)" }}
    >
      {message}
    </div>
  );
}
