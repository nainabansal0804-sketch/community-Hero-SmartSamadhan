import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#e8ecf8]">
      <div className="skeleton w-8 h-8 rounded-full" />
      <div className="skeleton w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
      <div className="skeleton h-7 w-20 rounded-lg" />
    </div>
  );
}

// ── Podium for top 3 ─────────────────────────────────────────────────────────
function Podium({ users }) {
  if (users.length < 1) return null;

  const podiumOrder = users.length >= 3
    ? [users[1], users[0], users[2]]   // 2nd, 1st, 3rd
    : users.length === 2
    ? [users[1], users[0]]
    : [users[0]];

  const heights = ["h-20", "h-28", "h-16"];
  const bgColors = ["bg-[#e5e7eb]", "bg-gradient-to-b from-[#fef9c3] to-[#fde047]", "bg-gradient-to-b from-[#fff7ed] to-[#fed7aa]"];
  const medals   = ["🥈", "🥇", "🥉"];

  return (
    <div className="flex items-end justify-center gap-3 mb-6 px-4">
      {podiumOrder.map((u, i) => {
        const realRank = users.indexOf(u) + 1;
        return (
          <div key={u.id} className="flex flex-col items-center gap-2 flex-1 max-w-[110px]">
            <div className="relative">
              <img
                src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || "U")}&background=1a56db&color=fff&bold=true`}
                alt={u.displayName}
                className="w-14 h-14 rounded-full object-cover ring-4 ring-white shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 text-[18px]">{medals[i]}</span>
            </div>
            <p className="text-[12px] font-bold text-[#151c27] text-center truncate max-w-full px-1">
              {u.displayName || "Anonymous"}
            </p>
            <p className="text-[11px] font-extrabold text-[#1a56db]">✦ {u.civicPoints ?? 0}</p>
            <div className={`w-full ${heights[i]} ${bgColors[i]} rounded-t-xl flex items-start justify-center pt-2`}>
              <span className="text-[13px] font-black text-white/80">#{realRank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("civicPoints", "desc")))
      .then(snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(err => {
        console.error("[Leaderboard] Firestore error:", err);
        setLoading(false);
      });
  }, []);

  const currentUserRank = user
    ? users.findIndex(u => u.id === user.uid) + 1
    : -1;

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto w-full space-y-5 pb-24">
      {/* Header */}
      <div className="fade-up">
        <h1 className="text-[26px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
          Leaderboard
        </h1>
        <p className="text-[13.5px] text-[#737686] mt-0.5">Top civic contributors in your community</p>
      </div>

      {/* Current user rank banner */}
      {!loading && currentUserRank > 0 && (
        <div className="bg-gradient-to-r from-[#1a56db] to-[#003fb1] text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md fade-up">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-[18px] font-extrabold">
            #{currentUserRank}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold">Your Ranking</p>
            <p className="text-[12px] text-blue-200">
              {currentUserRank === 1
                ? "You're the top contributor! 🏆"
                : `${currentUserRank - 1} place${currentUserRank - 1 !== 1 ? "s" : ""} from the top`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[18px] font-extrabold">
              ✦ {users.find(u => u.id === user.uid)?.civicPoints ?? 0}
            </p>
            <p className="text-[11px] text-blue-200">points</p>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && users.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f0f3ff] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "32px" }}>
              emoji_events
            </span>
          </div>
          <h3 className="text-[18px] font-bold text-[#151c27] mb-1" style={{ fontFamily: "var(--font-display)" }}>
            No heroes yet
          </h3>
          <p className="text-[13.5px] text-[#737686] mb-5">Be the first to report and top the leaderboard!</p>
          <button
            onClick={() => navigate("/report")}
            className="bg-[#1a56db] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#003fb1] transition-all"
          >
            Report First Issue
          </button>
        </div>
      )}

      {/* Podium for top 3 */}
      {!loading && users.length >= 1 && <Podium users={users.slice(0, 3)} />}

      {/* Full list */}
      {!loading && users.length > 0 && (
        <div className="space-y-2">
          {users.map((u, i) => {
            const isCurrentUser = u.id === user?.uid;
            return (
              <div
                key={u.id}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all card-hover fade-up ${
                  i === 0
                    ? "bg-gradient-to-r from-[#fffbeb] to-[#fefce8] border-[#fde68a]"
                    : i === 1
                    ? "bg-white border-[#e5e7eb]"
                    : i === 2
                    ? "bg-gradient-to-r from-[#fff7ed] to-[#fffbeb] border-[#fed7aa]"
                    : isCurrentUser
                    ? "bg-gradient-to-r from-[#f0f3ff] to-[#e8ecff] border-[#dbe1ff]"
                    : "bg-white border-[#f0f3ff] hover:border-[#dbe1ff]"
                }`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* Rank */}
                <div className="text-[18px] font-extrabold w-9 text-center flex-shrink-0">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                    <span className="text-[14px] font-bold text-[#9ca3af]">#{i + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <img
                  src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || "U")}&background=1a56db&color=fff&bold=true`}
                  alt={u.displayName || "User"}
                  className={`w-10 h-10 rounded-full object-cover flex-shrink-0 ${
                    isCurrentUser ? "ring-2 ring-[#1a56db]" : ""
                  }`}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#151c27] truncate flex items-center gap-1.5">
                    {u.displayName || "Anonymous"}
                    {isCurrentUser && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#dbe1ff] text-[#1a56db] rounded-full">
                        You
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11.5px] text-[#737686]">
                      {(u.reportedIssues || []).length} report{(u.reportedIssues || []).length !== 1 ? "s" : ""}
                    </span>
                    {(u.badges || []).slice(0, 3).map(b => (
                      <span key={b.id} title={b.label} className="text-[14px]">{b.emoji}</span>
                    ))}
                    {(u.badges || []).length > 3 && (
                      <span className="text-[10px] text-[#737686]">+{u.badges.length - 3}</span>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[17px] font-extrabold text-[#003fb1]">✦ {u.civicPoints ?? 0}</p>
                  <p className="text-[10px] text-[#737686] font-medium">points</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
