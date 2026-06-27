import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from "../firebase";
import { signInWithPopup, signInWithDemo, forceMockSystem } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: "auto_awesome",
    title: "Gemini AI Classification",
    desc: "Upload a photo and our AI instantly detects issue type, severity, and routes it to the right department — in under 3 seconds.",
    color: "#1a56db",
    bg: "#f0f3ff",
  },
  {
    icon: "map",
    title: "Live Community Map",
    desc: "See all reported issues in real-time on an interactive map. Track resolution progress and discover hotspots in your area.",
    color: "#059669",
    bg: "#ecfdf5",
  },
  {
    icon: "emoji_events",
    title: "Earn & Compete",
    desc: "Earn Civic Points for every verified report. Unlock badges, climb the leaderboard, and become your city's top civic hero.",
    color: "#d97706",
    bg: "#fffbeb",
  },
];

const STATS = [
  { value: "3s", label: "AI Analysis Time" },
  { value: "5+", label: "Issue Categories" },
  { value: "50", label: "Points Per Report" },
  { value: "100%", label: "Free to Use" },
];

const HOW_IT_WORKS = [
  { step: "01", icon: "photo_camera", title: "Upload Evidence", desc: "Take a photo of the issue — pothole, garbage, broken light." },
  { step: "02", icon: "auto_awesome", title: "AI Classifies", desc: "Gemini AI detects the issue type, severity, and responsible department." },
  { step: "03", icon: "send", title: "Auto-Report", desc: "A formal complaint is generated and routed to the right government body." },
  { step: "04", icon: "emoji_events", title: "Earn Rewards", desc: "Get Civic Points, unlock badges, and track your community impact." },
];

function AnimatedCounter({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const num = parseFloat(target);
    if (isNaN(num)) return;
    const step = Math.ceil(num / 40);
    let cur = 0;
    const t = setInterval(() => {
      cur += step;
      if (cur >= num) { setCount(num); clearInterval(t); }
      else setCount(cur);
    }, 30);
    return () => clearInterval(t);
  }, [target]);
  const numStr = parseFloat(target) ? count : target;
  return <>{numStr}{suffix}</>;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate("/report");
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign-in error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        const msg = err.message || "";
        if (msg.includes("auth/unauthorized-domain") || err.code === "auth/unauthorized-domain") {
          setError("unauthorized-domain");
        } else {
          setError(msg || "Sign-in failed. Please try again.");
        }
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDemoSignIn = async () => {
    setSigningIn(true);
    setError("");
    try {
      forceMockSystem();
      await signInWithDemo();
    } catch (err) {
      console.error("Demo sign-in error:", err);
      setError("Demo sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 md:px-12 py-3.5 bg-white/85 backdrop-blur-md border-b border-[#e2e8f8] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a56db] to-[#003fb1] flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>
              account_balance
            </span>
          </div>
          <span className="text-[18px] font-extrabold text-[#003fb1]" style={{ fontFamily: "var(--font-display)" }}>
            SmartSamadhan
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/map")}
            className="hidden sm:flex items-center gap-1.5 text-[13.5px] font-semibold text-[#434654] hover:text-[#1a56db] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>map</span>
            Live Map
          </button>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="flex items-center gap-2 bg-[#1a56db] text-white px-4 py-2 rounded-xl text-[13.5px] font-bold hover:bg-[#003fb1] transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm disabled:opacity-70"
          >
            {signingIn ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />
            ) : (
              <GoogleIcon />
            )}
            {signingIn ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </nav>

      {error && (
        <div className="mx-auto mt-6 w-full max-w-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 p-5 rounded-2xl shadow-sm text-left">
          {error === "unauthorized-domain" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600 mt-0.5">warning</span>
                <div>
                  <h4 className="text-[14.5px] font-extrabold text-red-800">
                    Firebase Error: Unauthorized Domain
                  </h4>
                  <p className="text-[13px] text-red-700/90 mt-1 leading-relaxed">
                    Google Sign-In blocked this request because this domain is not authorized in your Firebase Console. That is why the Google Accounts selection prompt did not appear.
                  </p>
                </div>
              </div>

              <div className="bg-white/70 border border-red-100 p-4 rounded-xl space-y-3.5 text-[12.5px] text-[#434654]">
                <p className="font-semibold text-red-800">To authorize this domain in your Firebase Console:</p>
                <ol className="list-decimal pl-4 space-y-2 leading-relaxed">
                  <li>
                    Go to the <strong>Firebase Console</strong> &rarr; select your project.
                  </li>
                  <li>
                    Navigate to <strong>Authentication</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Authorized domains</strong>.
                  </li>
                  <li>
                    Click <strong>Add domain</strong> and add:
                    <div className="mt-1.5 flex flex-col gap-1">
                      <code className="bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded font-mono select-all break-all inline-block w-fit">
                        {window.location.hostname}
                      </code>
                      {window.location.hostname !== "localhost" && (
                        <code className="bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded font-mono select-all break-all inline-block w-fit">
                          localhost
                        </code>
                      )}
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={handleDemoSignIn}
                  className="flex-1 bg-[#1a56db] text-white py-2.5 px-4 rounded-xl text-[13px] font-bold hover:bg-[#003fb1] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">account_circle</span>
                  Use Demo Account Instead
                </button>
                <button
                  onClick={() => setError("")}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-2.5 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 text-red-800">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span className="text-[13.5px] font-bold">Sign-In Failed</span>
              </div>
              <p className="text-[12.5px] text-red-700 leading-relaxed">{error}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleDemoSignIn}
                  className="bg-[#1a56db] text-white py-2 px-3.5 rounded-xl text-[12px] font-bold hover:bg-[#003fb1] transition-all"
                >
                  Sign In with Demo Account
                </button>
                <button
                  onClick={() => setError("")}
                  className="bg-transparent hover:bg-black/5 text-gray-600 py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-[#f0f3ff] via-[#ffffff] to-[#e8f5f0]" />
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#1a56db]/5 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#059669]/6 blur-3xl" />
          <div className="absolute top-1/3 right-10 w-[300px] h-[300px] rounded-full bg-[#f59e0b]/5 blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#dbe1ff] text-[#003fb1] text-[12.5px] font-bold px-4 py-1.5 rounded-full fade-up">
            <span className="w-2 h-2 rounded-full bg-[#1a56db] status-blink" />
            Powered by Gemini AI · Built for India
          </div>

          {/* Headline */}
          <h1
            className="text-[44px] sm:text-[60px] md:text-[68px] font-extrabold text-[#151c27] leading-[1.1] tracking-tight fade-up delay-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Report Issues,<br />
            <span className="gradient-text">Shape Your City</span>
          </h1>

          {/* Subheading */}
          <p className="text-[17px] sm:text-[19px] text-[#434654] max-w-2xl mx-auto leading-relaxed fade-up delay-200">
            SmartSamadhan uses Gemini AI to instantly classify civic issues and route complaints
            to the right government department. Earn Civic Points, win badges, and make real change.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center fade-up delay-300">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="group flex items-center justify-center gap-3 bg-[#1a56db] text-white px-8 py-4 rounded-2xl text-[16px] font-bold hover:bg-[#003fb1] hover:-translate-y-1 active:translate-y-0 transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
            >
              {signingIn ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full spinner" />
              ) : (
                <GoogleIcon className="w-5 h-5" />
              )}
              {signingIn ? "Signing in…" : "Continue with Google"}
              {!signingIn && (
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" style={{ fontSize: "18px" }}>
                  arrow_forward
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/map")}
              className="flex items-center justify-center gap-2 border-2 border-[#c3c5d7] text-[#434654] px-8 py-4 rounded-2xl text-[16px] font-bold hover:bg-[#f0f3ff] hover:border-[#1a56db] hover:text-[#1a56db] transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>map</span>
              View Live Map
            </button>
          </div>

          <p className="text-[12.5px] text-[#737686] fade-up delay-400">
            Free to use · No credit card required · Sign in with Google
          </p>
        </div>

        {/* ── Stats band ─────────────────────────────────────────────── */}
        <div className="mt-16 w-full max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 fade-up delay-400">
          {STATS.map((s, i) => (
            <div key={s.label} className={`bg-white border border-[#e2e8f8] rounded-2xl p-4 text-center shadow-sm card-hover delay-${(i + 1) * 100}`}>
              <p className="text-[28px] font-black text-[#1a56db]" style={{ fontFamily: "var(--font-display)" }}>
                {s.value}
              </p>
              <p className="text-[12px] font-semibold text-[#737686] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-t border-[#e2e8f8]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-[12.5px] font-bold uppercase tracking-widest text-[#1a56db] bg-[#dbe1ff] px-4 py-1.5 rounded-full mb-3">
              How It Works
            </span>
            <h2 className="text-[34px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
              Report to resolution in 4 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative text-center">
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+28px)] right-[-50%] h-0.5 bg-gradient-to-r from-[#dbe1ff] to-[#f0f3ff] z-0" />
                )}
                <div className="relative z-10 inline-flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f0f3ff] to-[#e4ecff] flex items-center justify-center border border-[#dbe1ff] shadow-sm">
                    <span
                      className="material-symbols-outlined text-[#1a56db]"
                      style={{ fontSize: "28px", fontVariationSettings: "'FILL' 1" }}
                    >
                      {step.icon}
                    </span>
                  </div>
                  <span className="text-[11px] font-black text-[#1a56db] bg-[#dbe1ff] px-2 py-0.5 rounded-full">
                    STEP {step.step}
                  </span>
                  <h3 className="text-[15px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-[#737686] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#f4f6ff]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-[12.5px] font-bold uppercase tracking-widest text-[#059669] bg-[#ecfdf5] px-4 py-1.5 rounded-full mb-3">
              Features
            </span>
            <h2 className="text-[34px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
              Everything you need to make an impact
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-[#e2e8f8] rounded-2xl p-6 text-left card-hover group shadow-sm"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                  style={{ backgroundColor: f.bg }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "26px", color: f.color, fontVariationSettings: "'FILL' 1" }}
                  >
                    {f.icon}
                  </span>
                </div>
                <h3
                  className="text-[17px] font-bold text-[#151c27] mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {f.title}
                </h3>
                <p className="text-[13.5px] text-[#737686] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#1a56db] to-[#003fb1] text-white text-center">
        <div className="max-w-xl mx-auto space-y-5">
          <h2
            className="text-[34px] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready to make your city better?
          </h2>
          <p className="text-[16px] text-blue-100">
            Join your community, report issues, and earn Civic Points for every contribution.
          </p>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="inline-flex items-center gap-3 bg-white text-[#1a56db] px-8 py-4 rounded-2xl text-[16px] font-extrabold hover:bg-blue-50 hover:-translate-y-1 active:translate-y-0 transition-all shadow-lg"
          >
            <GoogleIcon className="w-5 h-5" />
            {signingIn ? "Signing in…" : "Get Started Free"}
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 bg-white border-t border-[#e2e8f8] text-center text-[12.5px] text-[#737686]">
        <p>
          © {new Date().getFullYear()} SmartSamadhan · Built with React + Firebase + Gemini AI
          <span className="mx-2 text-[#c3c5d7]">·</span>
          Making cities better, one report at a time 🏛️
        </p>
      </footer>
    </div>
  );
}

function GoogleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
