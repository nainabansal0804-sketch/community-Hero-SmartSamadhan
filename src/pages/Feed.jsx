import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const SEVERITY_BADGE = {
  Low:      "bg-[#ecfdf5] text-[#059669] border-[#d1fae5]",
  Medium:   "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]",
  High:     "bg-[#fff7ed] text-[#ea580c] border-[#ffedd5]",
  Critical: "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]",
};

const STATUS_PILL = {
  Reported:    "bg-gray-100 text-gray-700",
  Verified:    "bg-blue-50 text-blue-700 border-blue-100",
  Escalated:   "bg-orange-50 text-orange-700 border-orange-100",
  "In Progress": "bg-purple-50 text-purple-700 border-purple-100",
  Resolved:    "bg-green-50 text-green-700 border-green-100",
};

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All"); // "All" or "My Reports"
  const [upvotingId, setUpvotingId] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000);
  };

  // Listen to all issues in real time
  useEffect(() => {
    const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("[Feed] Firestore error:", err);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Filter issues based on active tab
  const filteredIssues = useMemo(() => {
    if (activeTab === "All") return issues;
    if (!user) return [];
    return issues.filter(i => i.reportedBy === user.uid);
  }, [issues, activeTab, user]);

  const handleUpvote = async (issueId, currentUpvotes) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast("Please sign in to upvote!", "error");
      return;
    }
    if (upvotingId === issueId) return;
    setUpvotingId(issueId);

    const upvotesArr = currentUpvotes || [];
    const hasUpvoted = upvotesArr.includes(currentUser.uid);
    const ref = doc(db, "issues", issueId);

    // Optimistically update state
    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        return {
          ...issue,
          upvotes: hasUpvoted
            ? upvotesArr.filter(uid => uid !== currentUser.uid)
            : [...upvotesArr, currentUser.uid]
        };
      }
      return issue;
    }));

    try {
      if (hasUpvoted) {
        await updateDoc(ref, { upvotes: arrayRemove(currentUser.uid) });
      } else {
        await updateDoc(ref, { upvotes: arrayUnion(currentUser.uid) });
      }
      showToast(hasUpvoted ? "Upvote removed" : "Issue upvoted!", "success");
    } catch (err) {
      console.error("[Feed] Upvote error:", err);
      // Revert optimistic update
      setIssues(prev => prev.map(issue => {
        if (issue.id === issueId) {
          return { ...issue, upvotes: upvotesArr };
        }
        return issue;
      }));
      showToast("Failed to update upvote", "error");
    } finally {
      setUpvotingId(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast("Signed in successfully!", "success");
    } catch (err) {
      console.error("[Feed] Auth error:", err);
      showToast("Failed to sign in. Please try again.", "error");
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto w-full space-y-5 pb-24" style={{ fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#151c27] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <span className="material-symbols-outlined text-[#1a56db]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
            Community Feed
          </h1>
          <p className="text-[12.5px] text-[#737686]">Explore reported issues and support your neighbors</p>
        </div>
        <button
          onClick={() => navigate("/report")}
          className="flex items-center justify-center gap-1.5 bg-[#1a56db] text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[#003fb1] transition-all shadow-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Report Civic Issue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e2e8f8] gap-6">
        <button
          onClick={() => setActiveTab("All")}
          className={`pb-3 text-[14px] font-bold border-b-2 transition-all ${
            activeTab === "All"
              ? "border-[#1a56db] text-[#1a56db]"
              : "border-transparent text-[#737686] hover:text-[#1a56db]"
          }`}
        >
          All Reports
        </button>
        <button
          onClick={() => setActiveTab("My Reports")}
          className={`pb-3 text-[14px] font-bold border-b-2 transition-all ${
            activeTab === "My Reports"
              ? "border-[#1a56db] text-[#1a56db]"
              : "border-transparent text-[#737686] hover:text-[#1a56db]"
          }`}
        >
          My Reports
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="bg-white border border-[#e2e8f8] rounded-2xl p-5 space-y-3">
              <div className="skeleton h-48 w-full rounded-xl" />
              <div className="skeleton h-6 w-1/3 rounded-md" />
              <div className="skeleton h-4 w-2/3 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Empty States */}
      {!loading && activeTab === "All" && filteredIssues.length === 0 && (
        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[#c3c5d7] mb-3" style={{ fontSize: "48px" }}>campaign</span>
          <h2 className="text-[16px] font-bold text-[#151c27] mb-1">No issues reported yet</h2>
          <p className="text-[12.5px] text-[#737686] max-w-xs mb-4">Be the first to create a report and kickstart civic action in your area!</p>
          <button
            onClick={() => navigate("/report")}
            className="bg-[#1a56db] text-white px-5 py-2 rounded-xl text-[13px] font-bold hover:bg-[#003fb1] transition-all"
          >
            Report Now
          </button>
        </div>
      )}

      {/* My Reports - Not Logged In Guard */}
      {!loading && activeTab === "My Reports" && !user && (
        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[#c3c5d7] mb-3" style={{ fontSize: "48px" }}>lock</span>
          <h2 className="text-[16px] font-bold text-[#151c27] mb-1">Sign in to view your reports</h2>
          <p className="text-[12.5px] text-[#737686] max-w-xs mb-4">You need to sign in to see the civic issues you have submitted.</p>
          <button
            onClick={handleGoogleSignIn}
            className="inline-flex items-center gap-2 bg-white border border-[#e2e8f8] text-[#434654] px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-[#f0f3ff] transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            Sign In with Google
          </button>
        </div>
      )}

      {/* My Reports - Empty State for Logged In User */}
      {!loading && activeTab === "My Reports" && user && filteredIssues.length === 0 && (
        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[#c3c5d7] mb-3" style={{ fontSize: "48px" }}>rate_review</span>
          <h2 className="text-[16px] font-bold text-[#151c27] mb-1">You haven't reported any issues yet</h2>
          <p className="text-[12.5px] text-[#737686] max-w-xs mb-4">Your submitted issues will show up here. Report an issue to help improve your neighborhood!</p>
          <button
            onClick={() => navigate("/report")}
            className="bg-[#1a56db] text-white px-5 py-2 rounded-xl text-[13px] font-bold hover:bg-[#003fb1] transition-all"
          >
            Submit First Report
          </button>
        </div>
      )}

      {/* Feed List */}
      {!loading && filteredIssues.length > 0 && (
        <div className="space-y-4">
          {filteredIssues.map(issue => {
            const hasUpvoted = issue.upvotes?.includes(user?.uid);
            return (
              <div key={issue.id} className="bg-white border border-[#e2e8f8] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                {issue.photoURL && (
                  <div className="relative h-48 bg-[#f0f3ff] overflow-hidden">
                    {issue.photoURL.includes("/video/") || issue.photoURL.endsWith(".mp4") ? (
                      <video src={issue.photoURL} className="w-full h-full object-cover" muted loop playsInline />
                    ) : (
                      <img src={issue.photoURL} alt={issue.issueType} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${SEVERITY_BADGE[issue.severity] || "bg-gray-100 text-gray-700"}`}>
                        {issue.severity} Severity
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-sm ${STATUS_PILL[issue.status] || "bg-gray-100 text-gray-700"}`}>
                        {issue.status}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[16px] font-bold text-[#151c27] hover:text-[#1a56db] transition-colors cursor-pointer" onClick={() => navigate(`/issue/${issue.id}`)}>
                        {issue.issueType}
                      </h3>
                      {issue.department && (
                        <p className="text-[12px] text-[#737686] font-semibold mt-0.5">🏢 {issue.department}</p>
                      )}
                    </div>
                    {/* Upvote Button */}
                    <button
                      onClick={() => handleUpvote(issue.id, issue.upvotes)}
                      disabled={upvotingId === issue.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold transition-all ${
                        hasUpvoted
                          ? "bg-[#1a56db] text-white border-[#1a56db]"
                          : "bg-white text-[#434654] border-[#e2e8f8] hover:bg-[#f0f3ff]"
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: hasUpvoted ? "'FILL' 1" : "'FILL' 0" }}>
                        thumb_up
                      </span>
                      {issue.upvotes?.length || 0}
                    </button>
                  </div>

                  <p className="text-[13px] text-[#434654] leading-relaxed line-clamp-3">
                    {issue.description}
                  </p>

                  <div className="pt-3.5 border-t border-[#f0f3ff] flex items-center justify-between text-[11px] text-[#737686] font-semibold">
                    <span>📍 {issue.address || "Delhi NCR"}</span>
                    <button
                      onClick={() => navigate(`/issue/${issue.id}`)}
                      className="text-[#1a56db] hover:underline flex items-center gap-0.5"
                    >
                      View details
                      <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}

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
