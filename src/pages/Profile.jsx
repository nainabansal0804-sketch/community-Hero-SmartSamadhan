import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

const SEVERITY_BADGE = {
  Low:      "bg-emerald-50 text-emerald-700 border-emerald-100",
  Medium:   "bg-amber-50 text-amber-700 border-amber-100",
  High:     "bg-orange-50 text-orange-700 border-orange-100",
  Critical: "bg-red-50 text-red-700 border-red-100 animate-pulse font-bold",
};

const STATUS_BADGE = {
  Reported:             "bg-gray-100 text-gray-700 border-gray-200",
  Verified:             "bg-blue-50 text-blue-700 border-blue-100 font-medium",
  Escalated:            "bg-indigo-50 text-indigo-700 border-indigo-100 font-medium",
  "In Progress":         "bg-purple-50 text-purple-700 border-purple-100 font-medium",
  Resolved:            "bg-emerald-50 text-emerald-700 border-emerald-100 font-semibold",
  "Community Resolved":  "bg-teal-50 text-teal-800 border-teal-100 font-bold shadow-xs",
  "Needs Verification": "bg-yellow-50 text-yellow-800 border-yellow-200 font-medium",
};

function getLevel(pts) {
  if (pts >= 1000) return { label: "Civic Legend", icon: "🏆", color: "#d97706", badgeColor: "bg-amber-50 border-amber-200 text-amber-700" };
  if (pts >= 500)  return { label: "Civic Hero",   icon: "⭐", color: "#1a56db", badgeColor: "bg-blue-50 border-blue-200 text-blue-700" };
  if (pts >= 200)  return { label: "Civic Warrior", icon: "🌟", color: "#8b5cf6", badgeColor: "bg-purple-50 border-purple-200 text-purple-700" };
  if (pts >= 100)  return { label: "Civic Rookie",  icon: "🔰", color: "#059669", badgeColor: "bg-emerald-50 border-emerald-200 text-emerald-700" };
  return                 { label: "Civic Newcomer", icon: "🌱", color: "#6b7280", badgeColor: "bg-gray-150 border-gray-200 text-gray-700" };
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ProfileSkeleton() {
  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto w-full space-y-6 pb-24">
      <div className="bg-white rounded-3xl overflow-hidden border border-[#e2e8f8]">
        <div className="skeleton h-32" />
        <div className="px-6 pb-6 -mt-12 space-y-4">
          <div className="skeleton w-24 h-24 rounded-full border-4 border-white" />
          <div className="skeleton h-7 w-48 rounded-lg" />
          <div className="skeleton h-4 w-32 rounded" />
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        </div>
      </div>
      <div className="skeleton h-28 w-full rounded-3xl" />
      <div className="skeleton h-48 w-full rounded-3xl" />
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [userData, setUserData] = useState(null);
  const [myIssues, setMyIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for user data
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) setUserData(snap.data());
    });

    // Load issues
    const loadIssues = async () => {
      try {
        const q = query(collection(db, "issues"), where("reportedBy", "==", user.uid));
        const snap = await getDocs(q);
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.() ?? new Date(0);
            const tb = b.createdAt?.toDate?.() ?? new Date(0);
            return tb - ta;
          });
        setMyIssues(sorted);
      } catch (err) {
        console.error("[Profile] Firestore error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadIssues();
    return unsub;
  }, [user]);

  // Robustly filter out empty or invalid badge items to prevent blank card rendering
  const userBadges = useMemo(() => {
    return (userData?.badges || []).filter(b => b && (b.id || b.label || b.name));
  }, [userData]);

  if (loading || !user) return <ProfileSkeleton />;

  const civicPoints = userData?.civicPoints ?? 0;
  const level       = getLevel(civicPoints);
  const resolved    = myIssues.filter(i => i.status === "Resolved" || i.status === "Community Resolved").length;

  // Level progress percentage calculation relative to the active level bounds
  const nextLevel = civicPoints < 100 ? 100 : civicPoints < 200 ? 200 : civicPoints < 500 ? 500 : 1000;
  let prevLevelPts = 0;
  if (civicPoints >= 1000) {
    prevLevelPts = 1000;
  } else if (civicPoints >= 500) {
    prevLevelPts = 500;
  } else if (civicPoints >= 200) {
    prevLevelPts = 200;
  } else if (civicPoints >= 100) {
    prevLevelPts = 100;
  }
  const range = nextLevel - prevLevelPts;
  const progressInTier = civicPoints - prevLevelPts;
  const levelPct = range > 0 ? Math.min(100, Math.max(0, (progressInTier / range) * 100)) : 100;
  const toNext = Math.max(0, nextLevel - civicPoints);

  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto w-full space-y-6 pb-28" style={{ fontFamily: "var(--font-body)" }}>
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-extrabold text-[#151c27] tracking-tight flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <span className="material-symbols-outlined text-[#1a56db]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            My Civic Profile
          </h1>
          <p className="text-[13px] text-[#737686]">Track your reports, XP badges, and local community score</p>
        </div>
      </div>

      {/* Profile Card Hero */}
      <div className="bg-white border border-[#e2e8f8] rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 relative">
        
        {/* Aesthetic Cover Banner */}
        <div
          className="h-32 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1a56db 0%, #3b82f6 50%, #059669 100%)",
          }}
        >
          {/* Futuristic subtle grid overlay */}
          <div className="absolute inset-0 opacity-15" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "20px 20px"
          }} />
          
          {/* Animated decorative waves */}
          <div className="absolute -bottom-6 left-0 right-0 h-12 bg-white/10 blur-md rounded-[50%]" />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar and Button Row */}
          <div className="flex items-end justify-between -mt-12 mb-5 relative z-10">
            <div className="relative group">
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=1a56db&color=fff&bold=true`}
                alt={user.displayName || "Profile"}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:scale-102 transition-transform duration-300"
              />
              <span className="absolute bottom-1 right-1 bg-emerald-500 text-white w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[12px] font-bold">verified</span>
              </span>
            </div>
            
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 bg-[#fafbfe] border border-[#e2e8f8] text-[#434654] hover:text-[#1a56db] hover:border-[#1a56db] hover:bg-[#f0f3ff] px-4.5 py-2.5 rounded-2xl text-[13px] font-bold transition-all shadow-xs active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit Profile
            </button>
          </div>

          {/* User Details */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-[23px] font-black text-[#151c27] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {user.displayName || "Civic Explorer"}
              </h2>
              
              <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 border shadow-2xs ${level.badgeColor}`}>
                <span>{level.icon}</span>
                <span>{level.label}</span>
              </span>
            </div>
            <p className="text-[13px] text-[#737686] font-medium">{user.email}</p>
          </div>

          {/* Elegant Level Progression Tracker */}
          <div className="mt-6 bg-[#fafbfe] rounded-2xl p-4.5 border border-[#e2e8f8]/80 shadow-2xs">
            <div className="flex justify-between items-center text-[12.5px] mb-2 font-bold text-[#151c27]">
              <span className="flex items-center gap-1 text-[#1a56db]">
                <span className="material-symbols-outlined text-[16px] animate-pulse">military_tech</span>
                Tier Progression
              </span>
              <span className="text-[#737686]">
                {toNext > 0 ? `${toNext} points to ${getLevel(nextLevel).label}` : "Max Milestone Unlocked 🏆"}
              </span>
            </div>
            
            {/* The Progress Bar */}
            <div className="w-full h-3 bg-[#e2e8f8] rounded-full overflow-hidden relative">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  background: `linear-gradient(90deg, ${level.color}, #10b981)`,
                }}
              />
            </div>
            
            <div className="flex justify-between items-center text-[11px] text-[#737686] font-semibold mt-2">
              <span>{civicPoints.toLocaleString()} XP earned</span>
              <span>Target: {nextLevel} XP</span>
            </div>
          </div>

          {/* Beautiful Custom Bento-Style Stats Grid */}
          <div className="grid grid-cols-3 gap-3.5 mt-6">
            {[
              { label: "Civic Points", value: `✦ ${civicPoints.toLocaleString()}`, color: "#1a56db", bg: "from-[#f4f7ff] to-[#eef2ff]", border: "border-[#dbe1ff]", icon: "stars" },
              { label: "Reports Posted", value: myIssues.length, color: "#059669", bg: "from-[#ecfdf5] to-[#f0fdf4]", border: "border-[#bbf7d0]", icon: "campaign" },
              { label: "Resolved Proofs", value: resolved, color: "#d97706", bg: "from-[#fffbeb] to-[#fef3c7]", border: "border-[#fde68a]", icon: "task_alt" },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 text-center border ${s.border} bg-gradient-to-br ${s.bg} shadow-2xs hover:shadow-xs transition-all duration-300 relative group overflow-hidden`}>
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-bl-full pointer-events-none" />
                <span className="material-symbols-outlined transition-transform duration-300 group-hover:scale-110" style={{ fontSize: "20px", color: s.color, fontVariationSettings: "'FILL' 1" }}>
                  {s.icon}
                </span>
                <p className="text-[21px] font-black mt-1.5 leading-none" style={{ color: s.color, fontFamily: "var(--font-display)" }}>
                  {s.value}
                </p>
                <p className="text-[10px] font-bold mt-1 uppercase tracking-wider text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Badges Earned Card Section */}
      <div className="bg-white border border-[#e2e8f8] rounded-3xl p-5 shadow-xs">
        <h3 className="text-[15.5px] font-extrabold text-[#151c27] mb-4.5 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
          <span className="material-symbols-outlined text-[#d97706]" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>
            workspace_premium
          </span>
          Milestone Badges Earned ({userBadges.length})
        </h3>

        {userBadges.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {userBadges.map((b, idx) => {
                const badgeLabel = b.label || b.name || "Civic Contributor";
                const badgeEmoji = b.emoji || b.icon || "🎖️";
                const badgeDesc  = b.desc || b.description || "Active validator in local governance";
                
                return (
                  <motion.div
                    key={b.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: Math.min(6, idx) * 0.05 }}
                    className="flex items-center gap-3.5 bg-[#fafbfe] border border-[#e2e8f8] rounded-2xl px-4 py-3.5 hover:bg-[#f5f8ff] hover:border-[#1a56db]/30 transition-all duration-300 group shadow-2xs"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#f0f3ff] to-[#e0e7ff] flex items-center justify-center text-[24px] flex-shrink-0 shadow-3xs border border-[#e2e8f8] group-hover:scale-105 transition-transform">
                      {badgeEmoji}
                    </div>
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[#151c27] group-hover:text-[#1a56db] transition-colors">{badgeLabel}</p>
                      <p className="text-[11.5px] text-[#737686] font-medium leading-normal mt-0.5">{badgeDesc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center bg-[#fafbfe] border border-dashed border-[#c3c5d7] rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#f0f3ff] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "28px" }}>
                workspace_premium
              </span>
            </div>
            <p className="text-[14px] font-bold text-[#151c27] mb-1">No badges unlocked yet</p>
            <p className="text-[12.5px] text-[#737686] max-w-sm px-4">
              Report issues, confirm solutions, or verify coordinates to unlock your first set of achievements!
            </p>
          </div>
        )}
      </div>

      {/* Reported Issues Section */}
      <div className="bg-white border border-[#e2e8f8] rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4.5">
          <h3 className="text-[15.5px] font-extrabold text-[#151c27] flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "20px" }}>assignment</span>
            My Submitted Reports
          </h3>
          <span className="text-[11px] text-[#1a56db] bg-[#f0f3ff] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            {myIssues.length} total
          </span>
        </div>

        {myIssues.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center bg-[#fafbfe] border border-dashed border-[#c3c5d7] rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#f0f3ff] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "28px" }}>
                campaign
              </span>
            </div>
            <p className="text-[14px] font-bold text-[#151c27] mb-1">No civic reports filed yet</p>
            <p className="text-[12.5px] text-[#737686] mb-4.5 max-w-xs px-2">Report your first civic issue and claim +50 Civic XP right away!</p>
            <button
              onClick={() => navigate("/report")}
              className="bg-[#1a56db] text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold hover:bg-[#003fb1] hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-xs"
            >
              Report First Issue
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {myIssues.map((issue, idx) => {
                return (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25, delay: Math.min(6, idx) * 0.05 }}
                    onClick={() => navigate(`/issue/${issue.id}`)}
                    className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-[#fafbfe] border border-[#e2e8f8]/80 hover:border-[#1a56db]/30 rounded-2xl transition-all duration-300 cursor-pointer group shadow-2xs"
                  >
                    {/* Thumbnail Image */}
                    {issue.photoURL ? (
                      <img
                        src={issue.photoURL}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-2xs group-hover:scale-102 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#f0f3ff] flex items-center justify-center flex-shrink-0 border border-[#e2e8f8]">
                        <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "24px" }}>image</span>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-extrabold text-[#151c27] group-hover:text-[#1a56db] transition-colors truncate">{issue.issueType}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border ${SEVERITY_BADGE[issue.severity] || "bg-gray-100 text-gray-700"}`}>
                          {issue.severity}
                        </span>
                        
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border ${STATUS_BADGE[issue.status] || "bg-gray-100 text-gray-700"}`}>
                          {issue.status}
                        </span>
                        
                        {issue.createdAt && (
                          <span className="text-[10px] text-[#737686] font-medium ml-1 flex items-center gap-0.5">
                            ⏱️ {timeAgo(issue.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron Link icon */}
                    <span
                      className="material-symbols-outlined text-[#c3c5d7] group-hover:text-[#1a56db] group-hover:translate-x-0.5 transition-all"
                      style={{ fontSize: "20px" }}
                    >
                      arrow_forward_ios
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
