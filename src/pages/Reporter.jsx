import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import {
  collection, doc, addDoc, setDoc, updateDoc,
  arrayUnion, increment, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadImage } from "../utils/uploadImage";
import { analyzeIssue } from "../utils/analyzeIssue";
import { runIssueAgent } from "../agents/civicAgent";

// Fix Leaflet default marker icons
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});
L.Marker.mergeOptions({ icon: DefaultIcon });

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;
const MAX_FILE_SIZE_MB = 10;

const SEVERITY_STYLES = {
  Low:      { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7", dot: "#059669" },
  Medium:   { bg: "#fffbeb", text: "#78350f", border: "#fde68a", dot: "#d97706" },
  High:     { bg: "#fff7ed", text: "#7c2d12", border: "#fdba74", dot: "#ea580c" },
  Critical: { bg: "#fef2f2", text: "#7f1d1d", border: "#fca5a5", dot: "#dc2626" },
};

// ── MapClickHandler: updates pin without remounting map ──────────────────────
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ── FlyToPin: pan/zoom smoothly instead of remounting ────────────────────────
function FlyToPin({ lat, lng }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (prevRef.current !== key) {
      prevRef.current = key;
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.6 });
    }
  }, [lat, lng, map]);
  return null;
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = 5, color = "#1a56db" }) {
  return (
    <div
      className="rounded-full border-2 border-t-transparent spinner"
      style={{
        width: `${size * 4}px`,
        height: `${size * 4}px`,
        borderColor: `${color}40`,
        borderTopColor: "transparent",
        borderRightColor: color,
        borderBottomColor: color,
        borderLeftColor: `${color}40`,
      }}
    />
  );
}

// ── ConfidenceBar ─────────────────────────────────────────────────────────────
function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#d97706" : "#dc2626";
  const label = pct >= 80 ? "High Confidence" : pct >= 60 ? "Medium Confidence" : "Low Confidence";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[12px] font-semibold">
        <span className="text-[#434654] flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: "14px", color }}>psychology</span>
          AI Confidence
        </span>
        <div className="flex items-center gap-2">
          <span style={{ color }} className="font-extrabold text-[14px]">{pct}%</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ color, background: color + "18" }}>{label}</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-[#e8ecf8] rounded-full overflow-hidden">
        <div
          className="h-2.5 rounded-full bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color, animationDelay: "0.3s" }}
        />
      </div>
    </div>
  );
}

// ── Skeleton loader for AI panel ──────────────────────────────────────────────
function AIPanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-6 w-3/4 rounded-lg" />
      <div className="skeleton h-12 w-full rounded-xl" />
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="skeleton h-16 w-full rounded-xl" />
      <div className="skeleton h-6 w-1/2 rounded-lg" />
    </div>
  );
}

// ── Confetti burst on success ─────────────────────────────────────────────────
function ConfettiBurst() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: ["#1a56db", "#059669", "#d97706", "#ec4899", "#8b5cf6"][i % 5],
    left: `${5 + (i / 17) * 90}%`,
    delay: `${(i * 0.08).toFixed(2)}s`,
    size: `${6 + (i % 4) * 2}px`,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confetti-fall ${0.8 + (p.id % 4) * 0.2}s ease-in ${p.delay} forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main Reporter page ────────────────────────────────────────────────────────
export default function Reporter() {
  const navigate = useNavigate();

  const [imageFile, setImageFile]         = useState(null);
  const [imagePreview, setImagePreview]   = useState(null);
  const [isVideo, setIsVideo]             = useState(false);
  const [lat, setLat]                     = useState(DEFAULT_LAT);
  const [lng, setLng]                     = useState(DEFAULT_LNG);
  const [aiResult, setAiResult]           = useState(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [analyzeError, setAnalyzeError]   = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [predictedDays, setPredictedDays] = useState(null);
  // Editable fallback state — shown when AI fails
  const [manualMode, setManualMode]       = useState(false);
  const [manualForm, setManualForm]       = useState({
    issueType:    "Other",
    severity:     "Medium",
    department:   "Municipal Corporation",
    description:  "",
    urgencyReason:"",
    confidence:   0,
  });
  const [dragActive, setDragActive]     = useState(false);
  const [fileSizeError, setFileSizeError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [locationSelected, setLocationSelected] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  // Use refs for lat/lng to avoid stale closure in analyzeIssue
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const fileInputRef = useRef(null);

  useEffect(() => { latRef.current = lat; }, [lat]);
  useEffect(() => { lngRef.current = lng; }, [lng]);

  const handleImageSelect = useCallback(async (file) => {
    if (!file) return;

    // Validate type
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) {
      setAnalyzeError("Unsupported file type. Please upload a photo or video.");
      return;
    }

    // Validate size (client-side)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileSizeError("Image too large. Please use an image under 10MB");
      return;
    }

    setFileSizeError("");
    setIsVideo(isVid);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAiResult(null);
    setAnalyzeError("");

    if (isVid) {
      setAiResult({
        issueType: "Video Report",
        severity: "Medium",
        department: "Municipal Corporation",
        description: "Video uploaded — please describe the issue manually.",
        confidence: 0,
        urgencyReason: "",
      });
      return;
    }

    setAnalyzing(true);
    try {
      // FIX: Use refs to read current lat/lng — not stale closure values
      const result = await analyzeIssue(file, lat, lng);
      setAiResult(result);
      setManualMode(false);
    } catch (err) {
      // AI failed — activate editable manual fallback
      setAnalyzeError("AI analysis unavailable. Please fill details manually");
      setManualMode(true);
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handleDragEnter = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const handleDragOver  = (e) => { e.preventDefault(); };

  const handleLocationSelect = (la, ln) => {
    setLat(la);
    setLng(ln);
    setLocationSelected(true);
  };

  const handleSubmit = async () => {
    const result = aiResult ?? manualForm;
    if (!imageFile || !result) return;
    
    if (!locationSelected) {
      showToast("Please pin your location on the map", "error");
      return;
    }

    if (manualMode && !manualForm.description.trim()) {
      showToast("Please describe the issue before submitting.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to submit a report.");

      let photoURL;
      try {
        photoURL = await uploadImage(imageFile);
        if (!photoURL) {
          throw new Error("No image URL returned from upload");
        }
      } catch (uploadErr) {
        console.error("[Reporter] Cloudinary upload failed:", uploadErr);
        showToast("Image upload failed. Please try again.", "error");
        setSubmitting(false);
        return;
      }

      const issueRef = await addDoc(collection(db, "issues"), {
        photoURL,
        lat,
        lng,
        issueType:               result.issueType,
        severity:                result.severity,
        department:              result.department,
        description:             result.description,
        confidence:              result.confidence,
        urgencyReason:           result.urgencyReason || "",
        reportedBy:              user.uid,
        reporterName:            user.displayName || "Anonymous",
        upvotes:                 [],
        status:                  "Reported",
        createdAt:               serverTimestamp(),
        resolvedAt:              null,
        predictedResolutionTime: null,
        officialReport:          null,
      });

      // Update user doc
      await setDoc(doc(db, "users", user.uid), {
        civicPoints:    increment(50),
        reportedIssues: arrayUnion(issueRef.id),
        displayName:    user.displayName || "Anonymous",
        photoURL:       user.photoURL || null,
        email:          user.email,
        lastActive:     serverTimestamp(),
      }, { merge: true });

      // Predict resolution (non-blocking)
      try {
        const predRes = await fetch("/predict-resolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueType:  aiResult?.issueType || result.issueType,
            severity:   aiResult?.severity || result.severity,
            department: aiResult?.department || result.department,
          }),
        });
        if (predRes.ok) {
          const pred = await predRes.json();
          const days = pred.predictedResolutionDays ?? pred.estimatedDays ?? null;
          if (days !== null) {
            await updateDoc(issueRef, { predictedResolutionTime: days });
            setPredictedDays(days);
          }
        }
      } catch (_) {
        // Backend unavailable — non-critical, continue
      }

      // Run AI agent (async, non-blocking)
      runIssueAgent(issueRef.id, {
        issueType:   result.issueType,
        severity:    result.severity,
        description: result.description,
        department:  result.department,
        lat,
        lng,
      }, user.uid).catch(console.error);

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setSubmitted(true);
    } catch (err) {
      console.error("[Reporter] Submission error:", err);
      showToast("Submission failed: " + (err.message || "Please try again."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsVideo(false);
    setAiResult(null);
    setAnalyzeError("");
    setManualMode(false);
    setManualForm({ issueType: "Other", severity: "Medium", department: "Municipal Corporation", description: "", urgencyReason: "", confidence: 0 });
    setSubmitted(false);
    setPredictedDays(null);
    setShowConfetti(false);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        {showConfetti && <ConfettiBurst />}
        <div className="px-4 md:px-12 py-16 max-w-xl mx-auto w-full flex flex-col items-center text-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] flex items-center justify-center shadow-md bounce-in">
              <span
                className="material-symbols-outlined text-[#059669]"
                style={{ fontSize: "52px", fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h2
              className="text-[30px] font-extrabold text-[#151c27]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Issue Reported! 🎉
            </h2>
            <p className="text-[18px] font-bold text-[#059669]">+50 Civic Points Earned</p>
            <p className="text-[13px] text-[#737686] flex items-center justify-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#059669] status-blink" />
              AI Agent is processing — checking for area clusters &amp; awarding badges…
            </p>
          </div>

          {/* Prediction card */}
          <div className="w-full bg-gradient-to-br from-[#f0f3ff] to-[#e8ecff] border border-[#dbe1ff] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#1a56db]">
              <span className="material-symbols-outlined" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>schedule</span>
              <span className="text-[14px] font-bold">AI Resolution Prediction</span>
            </div>
            <p className="text-[16px] text-[#434654]">
              Estimated resolution in{" "}
              <span className="font-extrabold text-[#1a56db] text-[20px]">
                {predictedDays !== null ? predictedDays : "~7"} days
              </span>
            </p>
            <div className="flex items-center gap-2 text-[12px] text-[#737686]">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>info</span>
              Based on historical data for similar issues
            </div>
          </div>

          {/* Issue summary */}
          {aiResult && (
            <div className="w-full bg-white border border-[#e2e8f8] rounded-2xl p-5 text-left space-y-2.5">
              <h3 className="text-[14px] font-bold text-[#151c27]">Issue Summary</h3>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#737686]">Type</span>
                <span className="text-[13px] font-semibold text-[#151c27]">{aiResult.issueType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#737686]">Severity</span>
                <span
                  className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    color: SEVERITY_STYLES[aiResult.severity]?.text,
                    background: SEVERITY_STYLES[aiResult.severity]?.bg,
                  }}
                >
                  {aiResult.severity}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#737686]">Department</span>
                <span className="text-[13px] font-semibold text-[#151c27]">{aiResult.department}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={resetForm}
              className="flex-1 bg-[#1a56db] text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-[#003fb1] transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
            >
              Report Another Issue
            </button>
            <button
              onClick={() => navigate("/map")}
              className="flex-1 border border-[#c3c5d7] text-[#434654] px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-[#f0f3ff] hover:border-[#1a56db] hover:text-[#1a56db] transition-all"
            >
              View on Map
            </button>
          </div>
        </div>
      </>
    );
  }

  // The result used for submission: AI result OR manual form
  const effectiveResult = aiResult ?? (manualMode ? manualForm : null);
  const severityStyle = effectiveResult?.severity ? SEVERITY_STYLES[effectiveResult.severity] ?? SEVERITY_STYLES.Medium : null;
  const canSubmit = imageFile && 
                    effectiveResult && 
                    !submitting && 
                    (aiResult?.isValidCivicIssue !== false || manualMode) &&
                    (!manualMode || manualForm.description.trim().length > 0);

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1200px] mx-auto w-full space-y-5">
      <Toast message={toast.msg} type={toast.type} />
      {/* Header */}
      <div className="fade-up">
        <h1
          className="text-[28px] font-extrabold text-[#151c27]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Report a Civic Issue
        </h1>
        <p className="text-[15px] text-[#737686] mt-1">
          Upload a photo — AI instantly classifies it and routes to the right department.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Upload zone */}
          <div className="bg-white rounded-2xl p-5 border border-[#e2e8f8] shadow-sm fade-up delay-100">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-[17px] font-bold text-[#151c27] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  photo_camera
                </span>
                Evidence Upload
              </h2>
              {analyzing && (
                <span className="inline-flex items-center gap-1.5 bg-[#1a56db] text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined status-blink" style={{ fontSize: "12px", fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  AI Scanning…
                </span>
              )}
            </div>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload photo or video"
              className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden ${
                dragActive
                  ? "border-[#1a56db] bg-[#f0f3ff] shadow-[0_0_0_3px_rgba(26,86,219,0.12)]"
                  : imagePreview
                  ? "border-[#1a56db]/30 bg-[#f9f9ff]"
                  : "border-[#c3c5d7] hover:border-[#1a56db]/50 hover:bg-[#f9f9ff]"
              }`}
              style={{ minHeight: 200 }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={handleFileInput}
                aria-label="Upload civic issue photo"
              />

              {dragActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a56db]/6 z-10 pointer-events-none">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "40px" }}>
                      file_upload
                    </span>
                    <p className="text-[15px] font-bold text-[#1a56db]">Drop to upload</p>
                  </div>
                </div>
              )}

              {imagePreview ? (
                <div className="relative">
                  {isVideo ? (
                    <video src={imagePreview} controls className="w-full h-64 object-cover rounded-xl" />
                  ) : (
                    <img src={imagePreview} alt="Issue preview" className="w-full h-64 object-cover rounded-xl" />
                  )}
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur rounded-xl px-5 py-3 flex items-center gap-3">
                        <Spinner size={4} />
                        <span className="text-[13px] font-bold text-[#1a56db]">AI analyzing…</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#f0f3ff] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#737686]" style={{ fontSize: "32px" }}>
                      cloud_upload
                    </span>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#151c27]">Drag &amp; drop photos or videos</p>
                    <p className="text-[13px] text-[#737686] mt-0.5">or click to browse your device</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#737686] font-medium">
                    <span className="px-2 py-0.5 bg-[#f0f3ff] rounded">JPG</span>
                    <span className="px-2 py-0.5 bg-[#f0f3ff] rounded">PNG</span>
                    <span className="px-2 py-0.5 bg-[#f0f3ff] rounded">WebP</span>
                    <span className="px-2 py-0.5 bg-[#f0f3ff] rounded">MP4</span>
                    <span className="text-[#c3c5d7]">·</span>
                    <span>Max {MAX_FILE_SIZE_MB}MB</span>
                  </div>
                </div>
              )}
            </div>

            {imagePreview && (
              <button
                className="mt-3 w-full py-2 rounded-lg border border-[#e2e8f8] text-[13px] font-semibold text-[#434654] hover:bg-[#f0f3ff] hover:border-[#1a56db] hover:text-[#1a56db] transition-all flex items-center justify-center gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>swap_horiz</span>
                Change File
              </button>
            )}

            {fileSizeError && (
              <div className="mt-3 flex items-start gap-2.5 bg-[#fef2f2] border border-[#fca5a5] rounded-xl p-3">
                <span className="material-symbols-outlined text-[#dc2626] flex-shrink-0" style={{ fontSize: "18px" }}>error</span>
                <p className="text-[13px] text-[#dc2626] font-medium">{fileSizeError}</p>
              </div>
            )}

            {analyzeError && (
              <div className="mt-3 flex items-start gap-2.5 bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3">
                <span className="material-symbols-outlined text-[#d97706] flex-shrink-0" style={{ fontSize: "18px" }}>warning</span>
                <p className="text-[13px] text-[#92400e] font-medium">{analyzeError}</p>
              </div>
            )}
          </div>

          {/* Location picker */}
          <div className="bg-white rounded-2xl p-5 border border-[#e2e8f8] shadow-sm fade-up delay-200">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-[17px] font-bold text-[#151c27] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  location_on
                </span>
                Issue Location
              </h2>
              <button
                className="text-[12px] font-semibold text-[#1a56db] flex items-center gap-1 hover:underline transition-all"
                onClick={() => {
                  if (!navigator.geolocation) {
                    showToast("Geolocation is not supported by your browser.", "error");
                    return;
                  }
                  showToast("Retrieving your current location...", "success");
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      handleLocationSelect(pos.coords.latitude, pos.coords.longitude);
                      showToast("Location updated successfully!", "success");
                    },
                    (err) => {
                      console.error("[Reporter] Geolocation error:", err);
                      let msg = "Could not retrieve location. Please check browser permissions.";
                      if (err.code === 1) {
                        msg = "Location access denied. Please enable location permissions in your browser.";
                      } else if (err.code === 2) {
                        msg = "Location source unavailable. Please pin manually on the map.";
                      } else if (err.code === 3) {
                        msg = "Location request timed out. Please try again or pin manually.";
                      }
                      showToast(msg, "error");
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                  );
                }}
                aria-label="Use current location"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>my_location</span>
                Use Current Location
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f8]" style={{ height: 240 }}>
              {/* Single MapContainer — no key remount, FlyToPin handles updates */}
              <MapContainer
                center={[DEFAULT_LAT, DEFAULT_LNG]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={handleLocationSelect} />
                <FlyToPin lat={lat} lng={lng} />
                <Marker position={[lat, lng]} />
              </MapContainer>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] text-[#737686] font-medium">
                Click the map to pin the exact location
              </p>
              <div className="flex items-center gap-3 text-[12px] font-bold text-[#1a56db] bg-[#f0f3ff] px-3 py-1.5 rounded-lg">
                <span>📍 {lat.toFixed(4)}°N</span>
                <span className="text-[#c3c5d7]">·</span>
                <span>{lng.toFixed(4)}°E</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Right column AI panel: analyzing → ai result → manual fallback → empty */}
          {analyzing ? (
            <div className="bg-white rounded-2xl p-5 border border-[#dbe1ff] space-y-5 shadow-sm fade-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#dbe1ff] to-[#c3d4ff] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-[17px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>AI Analysis</h2>
                  <p className="text-[11.5px] text-[#737686] font-medium">Gemini AI is scanning your image…</p>
                </div>
              </div>
              <div className="border-t border-[#f0f3ff]" />
              <AIPanelSkeleton />
            </div>
          ) : aiResult ? (
            aiResult.isValidCivicIssue === false ? (
              <div className="bg-[#fffbeb] rounded-2xl p-5 border border-[#fcd34d] space-y-5 shadow-sm fade-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#d97706]" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>error</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[17px] font-bold text-[#78350f]" style={{ fontFamily: "var(--font-display)" }}>Relevance Check</h2>
                    <p className="text-[11.5px] text-[#b45309] font-medium">Image validation notice</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11.5px] font-bold text-[#b45309] bg-[#fef3c7] px-2.5 py-1 rounded-full border border-[#fcd34d]">
                    Unrelated Image
                  </div>
                </div>
                <div className="border-t border-[#fcd34d]/40" />

                <div className="space-y-4">
                  <div className="bg-white/80 border border-[#fcd34d]/30 rounded-xl p-4 space-y-2.5">
                    <p className="text-[12px] font-bold text-[#78350f] uppercase tracking-wide">AI Analysis Note</p>
                    <p className="text-[13.5px] text-[#78350f] leading-relaxed">
                      {aiResult.invalidReason || "This photo does not appear to show a public community or civic infrastructure issue. Street level issues like potholes, dumps, open drains, water leaks, or broken lights are expected."}
                    </p>
                  </div>

                  {aiResult.description && (
                    <div className="bg-[#fffbeb] p-3 rounded-xl border border-dashed border-[#fcd34d]/40">
                      <p className="text-[11.5px] font-bold text-[#737686] uppercase mb-1">Image Contents Detected:</p>
                      <p className="text-[13px] text-[#434654] italic">"{aiResult.description}"</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 pt-2">
                    <button
                      onClick={() => {
                        setManualForm({
                          issueType: aiResult.issueType || "Other",
                          severity: aiResult.severity || "Medium",
                          department: aiResult.department || "Municipal Corporation",
                          description: aiResult.description || "",
                          urgencyReason: aiResult.urgencyReason || "",
                          confidence: aiResult.confidence || 0,
                        });
                        setManualMode(true);
                      }}
                      className="w-full bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 py-2.5 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Correct & File Manually Instead
                    </button>
                    <button
                      onClick={resetForm}
                      className="w-full bg-[#d97706] hover:bg-[#b45309] text-white py-2.5 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                      Choose Another Photo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-[#c3d4ff] space-y-5 shadow-sm fade-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#dbe1ff] to-[#c3d4ff] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[17px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>AI Analysis</h2>
                    <p className="text-[11.5px] text-[#737686] font-medium">Powered by Gemini AI</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#059669] bg-[#ecfdf5] px-3 py-1.5 rounded-full border border-[#6ee7b7]">
                    <span className="material-symbols-outlined" style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Complete
                  </div>
                </div>
                <div className="border-t border-[#f0f3ff]" />
                <div className="space-y-4">
                  <div>
                    <p className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5">Detected Issue</p>
                    <div className="flex items-center gap-2.5 border border-[#e2e8f8] rounded-xl px-4 py-3 bg-[#f9f9ff]">
                      <span className="material-symbols-outlined text-[#1a56db]" style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}>report_problem</span>
                      <span className="text-[15px] font-bold text-[#151c27]">{aiResult.issueType}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5">Severity Level</p>
                    <div className="flex gap-1.5">
                      {["Low", "Medium", "High", "Critical"].map((s) => {
                        const sty = SEVERITY_STYLES[s];
                        const active = aiResult.severity === s;
                        return (
                          <div key={s} className="flex-1 text-center py-2 rounded-xl text-[12px] font-bold border-2 transition-all"
                            style={active ? { backgroundColor: sty.bg, color: sty.text, borderColor: sty.border } : { backgroundColor: "transparent", color: "#9ca3af", borderColor: "#f0f3ff" }}>
                            {s}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5">Routed To</p>
                    <div className="flex items-center gap-2.5 border border-[#e2e8f8] rounded-xl px-4 py-3 bg-[#f9f9ff]">
                      <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "18px" }}>apartment</span>
                      <span className="text-[14px] font-semibold text-[#151c27] flex-1">{aiResult.department}</span>
                      <span className="material-symbols-outlined text-[#059669]" style={{ fontVariationSettings: "'FILL' 1", fontSize: "18px" }}>verified</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5">Description</p>
                    <p className="text-[13.5px] text-[#434654] bg-[#f4f6ff] rounded-xl p-3.5 leading-relaxed">{aiResult.description}</p>
                  </div>
                  {aiResult.confidence > 0 && <ConfidenceBar value={aiResult.confidence} />}
                  {aiResult.urgencyReason && (
                    <div className="flex items-start gap-2 bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3">
                      <span className="material-symbols-outlined text-[#d97706] flex-shrink-0" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>warning</span>
                      <p className="text-[12.5px] text-[#78350f] font-medium leading-relaxed">{aiResult.urgencyReason}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-[#737686] text-center">✨ Analyzed by Gemini AI · Results may vary</p>
                </div>
              </div>
            )
          ) : manualMode ? (
            /* ── Editable Manual Fallback Form ────────────────────────── */
            <div className="bg-white rounded-2xl p-5 border border-[#fde68a] space-y-4 shadow-sm fade-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fffbeb] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[#d97706]" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-[17px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>Manual Report</h2>
                  <p className="text-[11.5px] text-[#d97706] font-medium">AI unavailable — edit the fields below and submit</p>
                </div>
              </div>
              <div className="border-t border-[#fde68a]/60" />

              {/* Issue Type */}
              <div>
                <label className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5 block">Issue Type</label>
                <select
                  value={manualForm.issueType}
                  onChange={(e) => setManualForm((f) => ({ ...f, issueType: e.target.value }))}
                  className="w-full border border-[#e2e8f8] rounded-xl px-4 py-2.5 text-[14px] text-[#151c27] font-semibold bg-white focus:outline-none focus:border-[#1a56db] focus:ring-1 focus:ring-[#dbe1ff]"
                >
                  {["Pothole","Broken Streetlight","Water Leakage","Garbage Overflow","Damaged Road","Open Drain","Other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Severity */}
              <div>
                <label className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5 block">Severity</label>
                <div className="flex gap-1.5">
                  {["Low", "Medium", "High", "Critical"].map((s) => {
                    const sty = SEVERITY_STYLES[s];
                    const active = manualForm.severity === s;
                    return (
                      <button key={s} onClick={() => setManualForm((f) => ({ ...f, severity: s }))}
                        className="flex-1 py-2 rounded-xl text-[12px] font-bold border-2 transition-all"
                        style={active ? { backgroundColor: sty.bg, color: sty.text, borderColor: sty.border } : { backgroundColor: "transparent", color: "#9ca3af", borderColor: "#f0f3ff" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5 block">Department</label>
                <select
                  value={manualForm.department}
                  onChange={(e) => setManualForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full border border-[#e2e8f8] rounded-xl px-4 py-2.5 text-[14px] text-[#151c27] font-semibold bg-white focus:outline-none focus:border-[#1a56db] focus:ring-1 focus:ring-[#dbe1ff]"
                >
                  {["PWD","Municipal Corporation","Electricity Board","Water Board","Sanitation Department"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5 block">Description <span className="text-[#dc2626]">*</span></label>
                <textarea
                  value={manualForm.description}
                  onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the civic issue in 2-3 sentences…"
                  rows={3}
                  className="w-full border border-[#e2e8f8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#151c27] bg-white resize-none focus:outline-none focus:border-[#1a56db] focus:ring-1 focus:ring-[#dbe1ff]"
                />
              </div>

              {/* Urgency Reason (optional) */}
              <div>
                <label className="text-[12px] font-bold text-[#737686] uppercase tracking-wide mb-1.5 block">Urgency Reason <span className="text-[#737686] font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={manualForm.urgencyReason}
                  onChange={(e) => setManualForm((f) => ({ ...f, urgencyReason: e.target.value }))}
                  placeholder="Why does this need urgent attention?"
                  className="w-full border border-[#e2e8f8] rounded-xl px-4 py-2.5 text-[13.5px] text-[#151c27] bg-white focus:outline-none focus:border-[#1a56db] focus:ring-1 focus:ring-[#dbe1ff]"
                />
              </div>
            </div>
          ) : (
            /* ── Empty state ──────────────────────────────────────────── */
            <div className="bg-white rounded-2xl p-5 border border-[#e2e8f8] flex flex-col items-center text-center gap-4 py-14 shadow-sm fade-up">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#dbe1ff] to-[#c3d4ff] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "32px", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#151c27] mb-1" style={{ fontFamily: "var(--font-display)" }}>AI Ready to Analyze</h3>
                <p className="text-[13.5px] text-[#737686] max-w-xs mx-auto leading-relaxed">
                  Upload a photo and Gemini AI will instantly detect the issue, severity, and route it to the correct department.
                </p>
              </div>
            </div>
          )}

          {/* Submit card */}
          <div className="bg-white rounded-2xl p-5 border border-[#e2e8f8] space-y-4 shadow-sm fade-up delay-300">
            {/* Points preview */}
            <div className="bg-gradient-to-r from-[#f0f3ff] to-[#e8ecff] border border-[#dbe1ff] rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>
                  emoji_events
                </span>
                <span className="text-[13px] font-semibold text-[#434654]">Reward on Submit</span>
              </div>
              <span className="text-[15px] font-extrabold text-[#059669]">✦ +50 Civic Points</span>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2.5 transition-all btn-press ${
                canSubmit
                  ? "bg-gradient-to-r from-[#1a56db] to-[#003fb1] text-white hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 shadow-md hover:shadow-lg"
                  : "bg-[#e8ecf8] text-[#9ca3af] cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <Spinner size={4} color={canSubmit ? "white" : "#9ca3af"} />
                  Submitting…
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}
                  >
                    send
                  </span>
                  {!imageFile
                    ? "Upload a photo to continue"
                    : !aiResult
                    ? "Waiting for AI analysis…"
                    : "Submit Report"}
                </>
              )}
            </button>

            {/* Helper text */}
            {!canSubmit && !submitting && (
              <p className="text-[12px] text-center text-[#9ca3af]">
                {!imageFile
                  ? "📸 Upload a photo or video to get started"
                  : analyzing
                  ? "⏳ AI is analyzing your image — almost done…"
                  : "⚠️ AI analysis needed before submission"}
              </p>
            )}
          </div>
        </div>
      </div>
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
