import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { updateProfile, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

const NOTIF_LABELS = [
  { key: "notif_nearby",  label: "New issues near me",             icon: "location_on" },
  { key: "notif_status",  label: "Issue status updates",           icon: "update" },
  { key: "notif_upvotes", label: "Community upvotes on my reports", icon: "thumb_up" },
  { key: "notif_weekly",  label: "Weekly impact summary",           icon: "summarize" },
];

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange, id }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a56db] focus-visible:ring-offset-2 ${
        checked ? "bg-[#1a56db]" : "bg-[#d1d5db]"
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = "success" }) {
  if (!message) return null;
  const styles = {
    success: "bg-[#151c27] text-white",
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

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <div className="bg-white border border-[#e2e8f8] rounded-2xl p-6 shadow-sm space-y-4 fade-up">
      <h2 className="text-[15px] font-bold text-[#151c27] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
        <span className="material-symbols-outlined text-[#1a56db]" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState({ msg: "", type: "success" });
  const [toggles, setToggles]         = useState(() => {
    const t = {};
    NOTIF_LABELS.forEach(({ key }) => { t[key] = localStorage.getItem(key) !== "false"; });
    return t;
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: displayName.trim() });
      showToast("✅ Profile updated successfully!", "success");
    } catch (e) {
      console.error("[Settings] Profile update error:", e);
      showToast("❌ Failed to update profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    const newVal = !toggles[key];
    setToggles(t => ({ ...t, [key]: newVal }));
    localStorage.setItem(key, String(newVal));
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto w-full space-y-5 pb-24">
      <Toast message={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex items-center gap-3 fade-up">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl border border-[#e2e8f8] flex items-center justify-center hover:bg-[#f0f3ff] hover:border-[#1a56db] transition-all"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
            Settings
          </h1>
          <p className="text-[12.5px] text-[#737686]">Manage your account &amp; preferences</p>
        </div>
      </div>

      {/* Profile */}
      <SectionCard icon="account_circle" title="Edit Profile">
        {user && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-[#f9f9ff] rounded-xl border border-[#e8ecf8]">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=1a56db&color=fff&bold=true`}
              alt="Your avatar"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <p className="text-[14px] font-bold text-[#151c27]">{user.displayName || "Civic Hero"}</p>
              <p className="text-[12px] text-[#737686]">{user.email}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="display-name" className="block text-[12.5px] font-semibold text-[#434654] mb-1.5">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveProfile()}
              className="w-full border border-[#c3c5d7] rounded-xl px-4 py-2.5 text-[14px] font-medium text-[#151c27] focus:outline-none focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/15 transition-all"
              placeholder="Your display name"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="email-field" className="block text-[12.5px] font-semibold text-[#434654] mb-1.5">
              Email <span className="text-[#9ca3af] font-normal">(via Google — cannot change)</span>
            </label>
            <input
              id="email-field"
              type="email"
              value={user?.email || ""}
              readOnly
              aria-readonly="true"
              className="w-full border border-[#e8ecf8] rounded-xl px-4 py-2.5 text-[14px] text-[#9ca3af] bg-[#f9f9ff] cursor-not-allowed"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving || !displayName.trim()}
            className="w-full bg-gradient-to-r from-[#1a56db] to-[#003fb1] text-white py-2.5 rounded-xl text-[14px] font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon="notifications" title="Notifications">
        <div className="space-y-3">
          {NOTIF_LABELS.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <label htmlFor={`toggle-${key}`} className="flex items-center gap-3 cursor-pointer flex-1">
                <span className="material-symbols-outlined text-[#737686]" style={{ fontSize: "18px" }}>{icon}</span>
                <span className="text-[13.5px] font-medium text-[#434654]">{label}</span>
              </label>
              <Toggle
                id={`toggle-${key}`}
                checked={toggles[key]}
                onChange={() => handleToggle(key)}
              />
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-[#9ca3af]">
          * Notification settings are stored locally. Push notifications require additional setup.
        </p>
      </SectionCard>

      {/* App Info */}
      <SectionCard icon="info" title="App Info">
        <div className="space-y-2">
          {[
            { label: "Version",    value: "1.0.0" },
            { label: "AI Model",   value: "Gemini 2.5 Flash Lite" },
            { label: "Framework",  value: "React 18 + Vite" },
            { label: "Database",   value: "Firebase Firestore" },
            { label: "Maps",       value: "OpenStreetMap + Leaflet" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#f0f3ff] last:border-0">
              <span className="text-[13px] font-semibold text-[#434654]">{label}</span>
              <span className="text-[13px] text-[#737686]">{value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Account danger zone */}
      <SectionCard icon="manage_accounts" title="Account">
        <p className="text-[12.5px] text-[#737686]">
          Signed in as <span className="font-semibold text-[#434654]">{user?.email}</span> via Google.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 border-2 border-[#fca5a5] text-[#dc2626] bg-[#fef2f2] hover:bg-[#fee2e2] py-2.5 rounded-xl text-[14px] font-bold transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
          Sign Out
        </button>
      </SectionCard>
    </div>
  );
}
