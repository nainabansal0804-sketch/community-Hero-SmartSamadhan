import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  getDocs,
  onSnapshot,
  setDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { calculateTrustScore, getTrustDetails, getDistance, getPriorityScore } from "./LiveIssues";
import { uploadImage } from "../utils/uploadImage";
import { motion, AnimatePresence } from "motion/react";

const SEVERITY_STYLE = {
  Low:      { color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7" },
  Medium:   { color: "#78350f", bg: "#fffbeb", border: "#fde68a" },
  High:     { color: "#7c2d12", bg: "#fff7ed", border: "#fdba74" },
  Critical: { color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5" },
};

const STATUS_STEPS = ["Reported", "Verified", "Escalated", "In Progress", "Resolved", "Community Resolved"];
const STATUS_ICONS = {
  Reported:             "flag",
  Verified:             "verified",
  Escalated:            "trending_up",
  "In Progress":         "construction",
  Resolved:            "check_circle",
  "Community Resolved":  "done_all",
};

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Map points to Achievement Badge
export function getUserBadges(pts) {
  const badges = [];
  if (pts >= 1000) badges.push({ name: "Community Guardian", icon: "🏆", color: "bg-purple-100 text-purple-800" });
  else if (pts >= 500)  badges.push({ name: "Cleanliness Hero", icon: "⚡", color: "bg-teal-100 text-teal-800" });
  else if (pts >= 200)  badges.push({ name: "Road Watcher", icon: "🛣️", color: "bg-blue-100 text-blue-800" });
  else if (pts >= 100)  badges.push({ name: "Water Protector", icon: "💧", color: "bg-cyan-100 text-cyan-800" });
  else badges.push({ name: "Electricity Sentinel", icon: "💡", color: "bg-amber-100 text-amber-800" });
  return badges;
}

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upvoting, setUpvoting] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "success" });

  // Rich Interactive Additions
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Updated / Follow-up Photo Addition
  const [updatePhoto, setUpdatePhoto] = useState(null);
  const [updatePhotoPreview, setUpdatePhotoPreview] = useState(null);
  const [uploadingUpdatePhoto, setUploadingUpdatePhoto] = useState(false);

  // Nearby Issues state
  const [nearbyIssues, setNearbyIssues] = useState([]);
  const [userReputation, setUserReputation] = useState(0);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4500);
  };

  // Real-time listener for the individual issue
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "issues", id),
      (snap) => {
        if (snap.exists()) {
          setIssue({ id: snap.id, ...snap.data() });
        } else {
          setIssue(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[IssueDetail] Firestore onSnapshot failed:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [id]);

  // Fetch current user points/reputation for dynamic badge display
  useEffect(() => {
    if (user) {
      onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          setUserReputation(snap.data().civicPoints || 0);
        }
      });
    }
  }, [user]);

  // Fetch Nearby Related Issues (same department within 15km)
  useEffect(() => {
    if (!issue) return;
    const q = collection(db, "issues");
    getDocs(q).then((snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const related = all
        .filter(
          (item) =>
            item.id !== issue.id &&
            (item.department === issue.department || item.issueType === issue.issueType) &&
            item.status !== "Community Resolved" &&
            item.status !== "Resolved"
        )
        .map((item) => {
          const dist = getDistance(issue.lat, issue.lng, item.lat, item.lng);
          return { ...item, dist };
        })
        .filter((item) => item.dist !== null && item.dist <= 15) // within 15km
        .slice(0, 3); // show top 3
      setNearbyIssues(related);
    });
  }, [issue]);

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
      showToast(`+${points} Civic XP awarded: ${reason}!`, "success");
    } catch (e) {
      console.error("[Gamification] XP Award failure:", e);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleUpvote = async () => {
    if (!user) {
      showToast("You must be signed in to upvote.", "error");
      return;
    }
    if (!issue || upvoting) return;

    setUpvoting(true);
    const hasUpvoted = issue.upvotes?.includes(user.uid);
    const ref = doc(db, "issues", id);

    try {
      if (hasUpvoted) {
        await updateDoc(ref, { upvotes: arrayRemove(user.uid) });
        showToast("Upvote removed.", "success");
      } else {
        await updateDoc(ref, { upvotes: arrayUnion(user.uid) });
        showToast("Issue upvoted!", "success");
        await awardPoints(5, "Supporting community reports");
      }
    } catch (err) {
      console.error("[IssueDetail] Upvote error:", err);
      showToast("Upvote failed.", "error");
    } finally {
      setUpvoting(false);
    }
  };

  const handleVerify = async () => {
    if (!user) {
      showToast("Sign in to verify this issue.", "error");
      return;
    }
    if (issue.verifiedUsers?.includes(user.uid)) {
      showToast("You already verified this issue.", "error");
      return;
    }

    const ref = doc(db, "issues", id);
    const isFirst = !issue.verifiedUsers || issue.verifiedUsers.length === 0;
    const isCritical = issue.severity === "Critical";
    const xpAward = isFirst ? 30 : isCritical ? 50 : 15;

    const log = {
      type: "verification",
      user: user.displayName || "Nearby Citizen",
      text: `${user.displayName || "A nearby citizen"} verified this report.`,
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(ref, {
        verifiedUsers: arrayUnion(user.uid),
        activityTimeline: arrayUnion(log),
      });
      await awardPoints(xpAward, isFirst ? "First Verification bonus" : isCritical ? "Critical issue verification" : "Verifying civic issue");
    } catch (e) {
      showToast("Verification failed. Try again.", "error");
    }
  };

  const handleAffected = async () => {
    if (!user) {
      showToast("Sign in to indicate you are affected.", "error");
      return;
    }
    if (issue.affectedUsers?.includes(user.uid)) {
      showToast("You already marked this issue as affecting you.", "error");
      return;
    }

    const ref = doc(db, "issues", id);
    const log = {
      type: "affected",
      user: user.displayName || "Affected Citizen",
      text: `${user.displayName || "An affected citizen"} stated they Daily Encounter/Use this area.`,
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(ref, {
        affectedUsers: arrayUnion(user.uid),
        activityTimeline: arrayUnion(log),
      });
      await awardPoints(10, "Confirming daily impact");
    } catch (e) {
      showToast("Submission failed.", "error");
    }
  };

  const handleNotFound = async () => {
    if (!user) {
      showToast("Sign in to report missing issue.", "error");
      return;
    }
    if (issue.notFoundUsers?.includes(user.uid)) {
      showToast("You already marked this issue as not found.", "error");
      return;
    }

    const ref = doc(db, "issues", id);
    const count = (issue.notFoundUsers?.length || 0) + 1;
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

    if (count >= 3) {
      updateData.status = "Needs Verification";
    }

    try {
      await updateDoc(ref, updateData);
      showToast("Discrepancy registered. Trust Score updated.", "success");
    } catch (e) {
      showToast("Submission failed.", "error");
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in to comment.", "error");
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    const ref = doc(db, "issues", id);

    const comment = {
      id: Math.random().toString(36).substring(2, 9),
      userId: user.uid,
      userName: user.displayName || "Anonymous Citizen",
      userPhoto: user.photoURL || null,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
      userPoints: userReputation,
    };

    try {
      await updateDoc(ref, {
        comments: arrayUnion(comment),
      });
      setCommentText("");
      await awardPoints(10, "Helpful comment contribution");
    } catch (err) {
      console.error("[IssueDetail] Comment failed:", err);
      showToast("Failed to post comment. Try again.", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUpdatePhoto(file);
      setUpdatePhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadFollowUpPhoto = async () => {
    if (!user) return;
    if (!updatePhoto) return;

    setUploadingUpdatePhoto(true);
    const ref = doc(db, "issues", id);
    try {
      const url = await uploadImage(updatePhoto);

      const log = {
        type: "gallery_update",
        user: user.displayName || "Validator",
        text: `${user.displayName || "A citizen"} uploaded a fresh verification photo to the gallery.`,
        timestamp: new Date().toISOString(),
        photo: url,
      };

      await updateDoc(ref, {
        gallery: arrayUnion(url),
        activityTimeline: arrayUnion(log),
      });

      setUpdatePhoto(null);
      setUpdatePhotoPreview(null);
      await awardPoints(25, "Uploading verified updated photo");
      showToast("Follow-up photo added to community gallery!", "success");
    } catch (err) {
      console.error("[IssueDetail] Upload follow-up failed:", err);
      showToast("Upload failed.", "error");
    } finally {
      setUploadingUpdatePhoto(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${issue.issueType} — SmartSamadhan`, url });
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-5 pb-24">
        <div className="skeleton h-9 w-24 rounded-xl" />
        <div className="bg-white rounded-2xl overflow-hidden border border-[#e2e8f8] h-64 w-full" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "56px" }}>search_off</span>
        <h2 className="text-[20px] font-bold text-[#151c27] mt-4 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Issue not found
        </h2>
        <p className="text-[#737686] text-[14px] mb-6">This issue may have been removed or the link is invalid.</p>
        <button
          onClick={() => navigate("/live-issues")}
          className="bg-[#1a56db] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#003fb1] transition-all"
        >
          View Live Issues
        </button>
      </div>
    );
  }

  const hasUpvoted = issue.upvotes?.includes(auth.currentUser?.uid);
  const statusIdx  = STATUS_STEPS.indexOf(issue.status);
  const sevStyle   = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.Medium;

  const trustScore = calculateTrustScore(issue);
  const trustBadge = getTrustDetails(trustScore);

  // Gallery images list (original photo + updated ones)
  const galleryImages = [issue.photoURL, ...(issue.gallery || [])].filter(Boolean);

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#737686] hover:text-[#1a56db] transition-colors"
        aria-label="Go back"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
        Back to Live List
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Media Gallery, Timeline, Actions, and AI Reports */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl overflow-hidden shadow-sm fade-up">
            {/* Gallery / Media Slider */}
            <div className="relative bg-[#fafbfe]">
              {galleryImages.length > 0 ? (
                <div className="relative h-80 overflow-hidden group">
                  <img
                    src={galleryImages[0]}
                    alt={issue.issueType}
                    className="w-full h-full object-cover"
                  />
                  {galleryImages.length > 1 && (
                    <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      📸 {galleryImages.length} Gallery Photos Available
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <span className="material-symbols-outlined text-4xl">broken_image</span>
                </div>
              )}

              {/* Float Badge */}
              <div className="absolute top-4 left-4 flex gap-1.5">
                <span
                  className="text-[11.5px] font-bold px-3 py-1 rounded-full border shadow-xs"
                  style={{ color: sevStyle.color, background: sevStyle.bg, borderColor: sevStyle.border }}
                >
                  {issue.severity}
                </span>
                <span className={`text-[11.5px] font-bold px-3 py-1 rounded-full border shadow-xs ${trustBadge.color}`}>
                  {trustBadge.label}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h1
                  className="text-[23px] font-extrabold text-[#151c27] leading-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {issue.issueType}
                </h1>
                <p className="text-[13px] text-[#737686] mt-1">
                  Reported by <span className="font-semibold text-[#434654]">{issue.reporterName || "Anonymous"}</span>
                  {issue.department && <> · <span className="text-[#1a56db] font-bold">{issue.department}</span></>}
                  {issue.createdAt && <> · {timeAgo(issue.createdAt)}</>}
                </p>
              </div>

              {/* Main Description */}
              <p className="text-[14.5px] text-[#434654] leading-relaxed">{issue.description}</p>

              {/* AI Analysis Details */}
              {issue.confidence > 0 && (
                <div className="bg-[#fafbfe] border border-[#e2e8f8] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12.5px] text-[#434654]">
                    <span className="material-symbols-outlined text-[#1a56db]">psychology</span>
                    <span>AI Analysis Confidence Score:</span>
                  </div>
                  <span className="font-extrabold text-emerald-600 text-[14px]">
                    {Math.round(issue.confidence * 100)}% Match
                  </span>
                </div>
              )}

              {/* Urgency Callout */}
              {issue.urgencyReason && (
                <div className="flex items-start gap-2.5 bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3.5">
                  <span
                    className="material-symbols-outlined text-[#d97706] flex-shrink-0"
                    style={{ fontSize: "19px", fontVariationSettings: "'FILL' 1" }}
                  >
                    warning
                  </span>
                  <p className="text-[13px] text-[#78350f] font-medium leading-relaxed">{issue.urgencyReason}</p>
                </div>
              )}

              {/* Core Interactive Actions */}
              <div className="flex flex-wrap gap-2.5 pt-2 border-t border-[#f0f3ff]">
                <button
                  onClick={handleUpvote}
                  disabled={upvoting}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all btn-press ${
                    hasUpvoted
                      ? "bg-[#1a56db] text-white"
                      : "border border-[#e2e8f8] text-[#434654] hover:bg-[#f0f3ff]"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: hasUpvoted ? "'FILL' 1" : "'FILL' 0" }}>
                    thumb_up
                  </span>
                  {issue.upvotes?.length ?? 0} Upvotes
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e2e8f8] text-[#434654] text-[13px] font-bold hover:bg-[#f0f3ff] ml-auto"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    {copied ? "check" : "share"}
                  </span>
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Complete Image Gallery Grid */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-[14px] font-extrabold text-[#151c27] flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
              <span className="material-symbols-outlined text-[#1a56db]">photo_library</span>
              Community Verification Gallery ({galleryImages.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {galleryImages.map((img, i) => (
                <div key={i} className="relative h-24 rounded-xl overflow-hidden border border-[#e2e8f8] bg-gray-50">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 rounded-sm">
                    {i === 0 ? "Initial" : `Update #${i}`}
                  </div>
                </div>
              ))}

              {/* Upload follow-up photos */}
              <div className="border border-dashed border-[#c3c5d7] rounded-xl flex flex-col items-center justify-center p-2 text-center h-24 relative hover:border-[#1a56db] cursor-pointer">
                {updatePhotoPreview ? (
                  <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-1">
                    <img src={updatePhotoPreview} alt="Preview" className="w-full h-14 object-cover rounded-md" />
                    <button
                      onClick={uploadFollowUpPhoto}
                      disabled={uploadingUpdatePhoto}
                      className="text-[9px] bg-[#1a56db] text-white px-1.5 py-0.5 rounded-sm mt-1 font-bold"
                    >
                      {uploadingUpdatePhoto ? "Uploading..." : "Save Photo"}
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                    <span className="material-symbols-outlined text-gray-400 text-2xl">add_a_photo</span>
                    <span className="text-[9px] font-bold text-gray-500 mt-1">Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Community Actions Hub */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-[14px] font-extrabold text-[#151c27] flex items-center gap-1" style={{ fontFamily: "var(--font-display)" }}>
                <span className="material-symbols-outlined text-[#1a56db]">how_to_reg</span>
                Community Verification Engine
              </h3>
              <p className="text-[12px] text-[#737686]">Verify facts nearby, claim levels, and unlock community accolades</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleVerify}
                disabled={issue.verifiedUsers?.includes(user?.uid)}
                className={`flex flex-col items-center justify-center p-4 border rounded-xl text-center transition-all ${
                  issue.verifiedUsers?.includes(user?.uid)
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "border-[#e2e8f8] hover:border-[#1a56db] bg-white text-[#151c27]"
                }`}
              >
                <span className="material-symbols-outlined text-xl mb-1">verified</span>
                <span className="text-[12px] font-bold">✅ Verify Issue</span>
                <span className="text-[9.5px] text-gray-500 mt-0.5">+15 Civic XP</span>
              </button>

              <button
                onClick={handleAffected}
                disabled={issue.affectedUsers?.includes(user?.uid)}
                className={`flex flex-col items-center justify-center p-4 border rounded-xl text-center transition-all ${
                  issue.affectedUsers?.includes(user?.uid)
                    ? "bg-orange-50 border-orange-200 text-orange-800"
                    : "border-[#e2e8f8] hover:border-[#ea580c] bg-white text-[#151c27]"
                }`}
              >
                <span className="material-symbols-outlined text-xl mb-1">groups</span>
                <span className="text-[12px] font-bold">📍 I'm Affected</span>
                <span className="text-[9.5px] text-gray-500 mt-0.5">+10 Civic XP</span>
              </button>

              <button
                onClick={handleNotFound}
                disabled={issue.notFoundUsers?.includes(user?.uid)}
                className={`flex flex-col items-center justify-center p-4 border rounded-xl text-center transition-all ${
                  issue.notFoundUsers?.includes(user?.uid)
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "border-[#e2e8f8] hover:border-red-500 bg-white text-[#151c27]"
                }`}
              >
                <span className="material-symbols-outlined text-xl mb-1">report_off</span>
                <span className="text-[12px] font-bold">❌ Not Found</span>
                <span className="text-[9.5px] text-gray-500 mt-0.5">Flag discrepancy</span>
              </button>
            </div>
          </div>

          {/* Interactive Community Timeline / Feed */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-6 shadow-sm">
            <h3 className="text-[14.5px] font-extrabold text-[#151c27] mb-4 flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
              <span className="material-symbols-outlined text-[#1a56db]">history</span>
              Community Activity Feed
            </h3>

            {/* Live activity Timeline logs */}
            {(!issue.activityTimeline || issue.activityTimeline.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-[12px]">
                No community verifications recorded yet. Be the first to verify!
              </div>
            ) : (
              <div className="relative border-l-2 border-[#f0f3ff] pl-5 ml-2.5 space-y-4">
                {issue.activityTimeline.map((log, idx) => {
                  const icons = {
                    verification: "verified",
                    affected: "groups",
                    not_found: "report_off",
                    resolved: "check_circle",
                    gallery_update: "photo_library",
                  };
                  return (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[29px] top-0.5 bg-white border border-[#e2e8f8] w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-[#1a56db]">
                        <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>
                          {icons[log.type] || "info"}
                        </span>
                      </span>
                      <div className="text-[12.5px]">
                        <p className="text-[#151c27] font-bold">{log.text}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {log.timestamp ? new Date(log.timestamp).toLocaleDateString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Recently"}
                        </p>
                        {log.photo && (
                          <img src={log.photo} alt="" className="w-24 h-16 object-cover rounded-md mt-1.5 border border-[#e2e8f8]" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments section */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-[14.5px] font-extrabold text-[#151c27] flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
              <span className="material-symbols-outlined text-[#1a56db]">forum</span>
              Community Comments &amp; Discussion
            </h3>

            {/* Comment form */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Suggest solutions or discuss repairs (+10 XP)..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-[#fafbfe] border border-[#e2e8f8] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#151c27] focus:outline-none focus:border-[#1a56db]"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="bg-[#1a56db] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#003fb1] disabled:bg-gray-200 disabled:text-gray-400 text-[13px] transition-all"
              >
                Comment
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-3.5 pt-2">
              {(!issue.comments || issue.comments.length === 0) ? (
                <p className="text-[12.5px] text-gray-400 text-center py-4">No comments yet. Start the conversation!</p>
              ) : (
                issue.comments.map((comment) => {
                  const commentBadges = getUserBadges(comment.userPoints || 0);
                  return (
                    <div key={comment.id} className="flex items-start gap-3 bg-[#fafbfe] p-3 rounded-xl border border-[#e2e8f8]/60">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1a56db] flex items-center justify-center font-bold text-xs flex-shrink-0 uppercase">
                        {comment.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-extrabold text-[#151c27]">{comment.userName}</span>
                          {commentBadges.map((badge, bIdx) => (
                            <span key={bIdx} className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold flex items-center gap-0.5 ${badge.color}`}>
                              <span>{badge.icon}</span>
                              {badge.name}
                            </span>
                          ))}
                        </div>
                        <p className="text-[12.5px] text-[#434654] mt-1 leading-relaxed">{comment.text}</p>
                        <p className="text-[9px] text-[#737686] font-semibold mt-1">
                          {timeAgo(new Date(comment.createdAt))}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Resolution tracker, Trust Breakdown, Map Coordinates, and Nearby Issues */}
        <div className="space-y-6">
          {/* Progress Tracker card */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-[14px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
              Resolution Progress
            </h3>

            <div className="flex flex-col gap-4 relative pl-3 border-l border-gray-100">
              {STATUS_STEPS.map((step, i) => {
                const done   = i <= statusIdx;
                const active = i === statusIdx;
                return (
                  <div key={step} className="flex items-start gap-2.5 relative">
                    <span
                      className={`absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        done
                          ? active
                            ? "bg-[#1a56db] border-[#1a56db] ring-2 ring-[#dbe1ff]"
                            : "bg-[#1a56db] border-[#1a56db]"
                          : "bg-white border-gray-200"
                      }`}
                    />
                    <div>
                      <p className={`text-[12px] font-bold ${done ? "text-[#1a56db]" : "text-[#737686]"}`}>
                        {step}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trust Score & Badges Breakdown */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-3.5">
            <div>
              <h3 className="text-[14px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
                Trust Verification Badge
              </h3>
              <p className="text-[11px] text-[#737686]">Calculated from decentralized verifications &amp; indicators</p>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${trustBadge.color}`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">{trustBadge.icon}</span>
                <span className="text-[13px] font-extrabold">{trustBadge.label}</span>
              </div>
              <span className="text-[16px] font-black">{trustScore}%</span>
            </div>

            {/* Calculations items */}
            <div className="space-y-2 text-[11px] text-[#434654] font-medium bg-[#fafbfe] p-3 rounded-xl border border-[#e2e8f8]/60">
              <div className="flex justify-between">
                <span>AI Prediction Base:</span>
                <span className="font-bold">+{Math.round((issue.confidence || 0.8) * 55)} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Independent Verifications:</span>
                <span className="font-bold text-emerald-600">+{Math.min(25, (issue.verifiedUsers?.length || 0) * 8)} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Daily Encounter Impact:</span>
                <span className="font-bold text-emerald-600">+{Math.min(20, (issue.affectedUsers?.length || 0) * 3)} pts</span>
              </div>
              {issue.notFoundUsers?.length > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Flags (Not Found):</span>
                  <span className="font-bold">-{issue.notFoundUsers.length * 20} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Map & GPS Coordinates */}
          <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f0f3ff] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>
                  location_on
                </span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#151c27]">Coordinates</p>
                <p className="text-[11.5px] text-[#737686] font-mono">
                  {issue.lat?.toFixed(5)}°N, {issue.lng?.toFixed(5)}°E
                </p>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${issue.lat},${issue.lng}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#fafbfe] border border-[#e2e8f8] py-2.5 rounded-xl text-[12px] font-bold text-[#1a56db] text-center block hover:bg-[#f0f3ff]"
            >
              Google Maps Location ➔
            </a>
          </div>

          {/* Nearby Related Issues */}
          {nearbyIssues.length > 0 && (
            <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm space-y-3.5">
              <h3 className="text-[14px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
                Nearby Related Issues
              </h3>
              <div className="space-y-3">
                {nearbyIssues.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/issue/${item.id}`)}
                    className="p-3 bg-[#fafbfe] hover:bg-[#f0f3ff] rounded-xl border border-[#e2e8f8]/60 cursor-pointer transition-colors"
                  >
                    <div className="font-bold text-[12.5px] text-[#151c27] line-clamp-1">{item.issueType}</div>
                    <div className="flex items-center justify-between text-[10px] text-[#737686] mt-1 font-bold">
                      <span>📏 {item.dist ? `${item.dist.toFixed(1)} km away` : "Nearby"}</span>
                      <span className="text-[#1a56db]">{item.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Complaint Letter Form */}
          {issue.officialReport && (
            <div className="bg-white border border-[#e2e8f8] rounded-2xl shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#f9f9ff] transition-colors"
                onClick={() => setLetterOpen(v => !v)}
              >
                <span className="text-[13px] font-bold text-[#151c27]">Complaint Draft Summary</span>
                <span className="material-symbols-outlined text-[#737686]">
                  {letterOpen ? "expand_less" : "expand_more"}
                </span>
              </button>
              {letterOpen && (
                <div className="p-4 border-t border-[#f0f3ff]">
                  <pre className="text-[11px] text-[#434654] whitespace-pre-wrap font-mono leading-relaxed bg-[#f9f9ff] p-3 rounded-lg overflow-x-auto">
                    {issue.officialReport}
                  </pre>
                </div>
              )}
            </div>
          )}
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
