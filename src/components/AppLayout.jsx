import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

// ── Sidebar navigation item ───────────────────────────────────────────────────
function SidebarLink({ to, icon, label, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all relative ${
          isActive
            ? "bg-[#1a56db] text-white shadow-sm"
            : "text-[#434654] hover:bg-[#f0f3ff] hover:text-[#1a56db]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className="material-symbols-outlined transition-all"
            style={{
              fontSize: "20px",
              fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            {icon}
          </span>
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="w-5 h-5 rounded-full bg-[#ea580c] text-white text-[10px] font-bold flex items-center justify-center">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Bottom nav link ────────────────────────────────────────────────────────────
function BottomNavLink({ to, icon, label, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 flex-1 py-2 relative transition-all ${
          isActive ? "text-[#1a56db]" : "text-[#737686]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {badge && (
            <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 rounded-full bg-[#ea580c] text-white text-[9px] font-bold flex items-center justify-center z-10">
              {badge}
            </span>
          )}
          <span
            className="material-symbols-outlined transition-all"
            style={{
              fontSize: "22px",
              fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            {icon}
          </span>
          <span className="text-[10px] font-semibold leading-none">{label}</span>
          {isActive && (
            <span className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1a56db]" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Main AppLayout ─────────────────────────────────────────────────────────────
export default function AppLayout({ children }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen]             = useState(false);
  const [civicPoints, setCivicPoints] = useState(0);
  const [userLevel, setUserLevel]   = useState("Civic Newcomer");
  const menuRef = useRef(null);

  // Real-time civic points + level
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const pts = snap.data()?.civicPoints ?? 0;
      setCivicPoints(pts);
      setUserLevel(getLevel(pts));
    });
    return unsub;
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#f4f6ff] flex" style={{ fontFamily: "var(--font-body)" }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] bg-white border-r border-[#e2e8f8] fixed top-0 left-0 h-full z-30 py-5 px-3 shadow-sm">

        {/* Logo */}
        <div className="px-2 mb-5">
          <NavLink to="/report" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a56db] to-[#003fb1] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
              <span className="material-symbols-outlined text-white" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>
                account_balance
              </span>
            </div>
            <span className="text-[17px] font-extrabold text-[#003fb1]" style={{ fontFamily: "var(--font-display)" }}>
              SmartSamadhan
            </span>
          </NavLink>
        </div>

        {/* Points pill */}
        {user && (
          <div className="mx-1 mb-4 bg-gradient-to-r from-[#dbe1ff] to-[#e8ecff] rounded-xl px-3 py-2.5 border border-[#c3cfff]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-[#434654] uppercase tracking-wide">Civic Points</span>
              <span className="text-[15px] font-extrabold text-[#003fb1]">✦ {civicPoints.toLocaleString()}</span>
            </div>
            <div className="text-[10px] font-semibold text-[#737686]">{userLevel}</div>
            {/* Level progress bar */}
            <div className="mt-1.5 w-full h-1 bg-[#c3cfff] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1a56db] to-[#4f7af8] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (civicPoints % 200) / 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 flex-1">
          <SidebarLink to="/feed"        icon="home"           label="Home"         end />
          <SidebarLink to="/live-issues" icon="verified"       label="Live Issues"      />
          <SidebarLink to="/map"         icon="map"            label="Live Map"         />
          <SidebarLink to="/report"      icon="add_circle"     label="Report Issue"     />
          <SidebarLink to="/dashboard"   icon="bar_chart"      label="Dashboard"        />
          <SidebarLink to="/leaderboard" icon="leaderboard"    label="Leaderboard"      />
          <SidebarLink to="/profile"     icon="account_circle" label="My Profile"       />
        </nav>

        {/* Divider */}
        <div className="my-3 border-t border-[#e2e8f8]" />

        {/* User bottom area */}
        {user && (
          <div className="relative px-1" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#f0f3ff] transition-all group"
              aria-label="User menu"
              aria-expanded={open}
            >
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=1a56db&color=fff&bold=true`}
                alt={user.displayName || "User"}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-[#dbe1ff]"
              />
              <div className="text-left min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-[#151c27] truncate leading-none mb-0.5">
                  {user.displayName || "Civic Hero"}
                </p>
                <p className="text-[10.5px] text-[#737686] truncate">{user.email}</p>
              </div>
              <span
                className="material-symbols-outlined text-[#737686] ml-auto transition-transform"
                style={{ fontSize: "16px", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                expand_more
              </span>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-[#e2e8f8] overflow-hidden z-50">
                <button
                  onClick={() => navigate("/profile")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#434654] hover:bg-[#f0f3ff] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>account_circle</span>
                  View Profile
                </button>
                <button
                  onClick={() => navigate("/settings")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#434654] hover:bg-[#f0f3ff] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>settings</span>
                  Settings
                </button>
                <div className="border-t border-[#e2e8f8]" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Desktop Top Bar ─────────────────────────────────────────── */}
      {/* FIXED: was `hidden md:block` (block ignored flex) → now `hidden md:flex` */}
      <div className="hidden md:flex fixed top-0 left-[220px] right-0 h-14 bg-white/90 backdrop-blur border-b border-[#e2e8f8] z-20 px-6 items-center justify-between shadow-sm">
        {/* Page breadcrumb */}
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[#737686] font-medium">SmartSamadhan</span>
          <span className="text-[#c3c5d7]">/</span>
          <span className="font-semibold text-[#151c27] capitalize">
            {getPageTitle(location.pathname)}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-1.5 bg-[#1a56db] text-white px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold hover:bg-[#003fb1] transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "15px", fontVariationSettings: "'FILL' 1" }}>add_circle</span>
            Report Issue
          </button>
          {user && (
            <div className="flex items-center gap-2 bg-[#f0f3ff] border border-[#dbe1ff] rounded-lg px-3 py-1.5">
              <span className="text-[#1a56db] text-[12px] font-bold">✦ {civicPoints.toLocaleString()}</span>
              <span className="text-[#737686] text-[11px] font-medium">pts</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Header ────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-13 bg-white/90 backdrop-blur border-b border-[#e2e8f8] z-30 px-4 flex items-center justify-between" style={{ height: "52px" }}>
        <NavLink to="/report" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1a56db] to-[#003fb1] flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: "15px", fontVariationSettings: "'FILL' 1" }}>
              account_balance
            </span>
          </div>
          <span className="text-[16px] font-extrabold text-[#003fb1]" style={{ fontFamily: "var(--font-display)" }}>
            SmartSamadhan
          </span>
        </NavLink>

        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-1.5 bg-[#f0f3ff] rounded-lg px-2.5 py-1">
              <span className="text-[#1a56db] text-[12px] font-bold">✦ {civicPoints.toLocaleString()}</span>
            </div>
          )}
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#dbe1ff]"
          >
            {user ? (
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=1a56db&color=fff`}
                alt="profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#dbe1ff] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "18px" }}>account_circle</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 md:ml-[220px] pt-[52px] md:pt-14 pb-20 md:pb-0 min-h-screen">
        <div className="page-enter">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f8] z-30 flex safe-bottom shadow-[0_-1px_12px_rgba(26,86,219,0.08)]">
        <BottomNavLink to="/feed"        icon="home"           label="Home"    end />
        <BottomNavLink to="/live-issues" icon="verified"       label="Live"        />
        <BottomNavLink to="/map"         icon="explore"        label="Map"         />
        <BottomNavLink to="/report"      icon="add_circle"     label="Report"      />
        <BottomNavLink to="/dashboard"   icon="bar_chart"      label="Impact"      />
        <BottomNavLink to="/leaderboard" icon="emoji_events"   label="Rank"        />
        <BottomNavLink to="/profile"     icon="account_circle" label="Profile"     />
      </nav>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLevel(pts) {
  if (pts >= 1000) return "🏆 Civic Legend";
  if (pts >= 500)  return "⭐ Civic Hero";
  if (pts >= 200)  return "🌟 Civic Warrior";
  if (pts >= 100)  return "🔰 Civic Rookie";
  return "🌱 Civic Newcomer";
}

function getPageTitle(path) {
  const map = {
    "/":            "Home",
    "/map":         "Live Map",
    "/report":      "Report Issue",
    "/dashboard":   "Dashboard",
    "/leaderboard": "Leaderboard",
    "/profile":     "My Profile",
    "/settings":    "Settings",
  };
  if (path.startsWith("/issue/")) return "Issue Detail";
  return map[path] || "SmartSamadhan";
}
