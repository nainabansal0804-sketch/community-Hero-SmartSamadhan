import { Routes, Route, Navigate } from "react-router-dom";
import Home        from "./pages/Home";
import Reporter    from "./pages/Reporter";
import Map         from "./pages/Map";
import IssueDetail from "./pages/IssueDetail";
import Leaderboard from "./pages/Leaderboard";
import Profile     from "./pages/Profile";
import Settings    from "./pages/Settings";
import Dashboard   from "./pages/Dashboard";
import Feed        from "./pages/Feed";
import LiveIssues  from "./pages/LiveIssues";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout      from "./components/AppLayout";

// Wraps a page in AppLayout + ProtectedRoute
function AppPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public landing page (no sidebar) */}
      <Route path="/" element={<Home />} />

      {/* Public map - no login required */}
      <Route path="/map" element={<AppLayout><Map /></AppLayout>} />

      {/* Authenticated pages - sidebar + bottom nav */}
      <Route path="/feed"        element={<AppPage><Feed       /></AppPage>} />
      <Route path="/live-issues" element={<AppPage><LiveIssues /></AppPage>} />
      <Route path="/report"      element={<AppPage><Reporter   /></AppPage>} />
      <Route path="/issue/:id"   element={<AppPage><IssueDetail/></AppPage>} />
      <Route path="/dashboard"   element={<AppPage><Dashboard  /></AppPage>} />
      <Route path="/leaderboard" element={<AppPage><Leaderboard/></AppPage>} />
      <Route path="/profile"     element={<AppPage><Profile    /></AppPage>} />
      <Route path="/settings"    element={<AppPage><Settings   /></AppPage>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
