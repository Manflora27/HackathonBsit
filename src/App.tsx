import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./auth";
import { authConfigured } from "./lib/supabase";
import Check from "./pages/Check";
import Demo from "./pages/Demo";
import Landing from "./pages/Landing";
import Help from "./pages/Help";
import Learn from "./pages/Learn";
import MapPage from "./pages/MapPage";
import Settings from "./pages/Settings";
import Solve from "./pages/Solve";
import StudentHome from "./pages/StudentHome";
import Trace from "./pages/Trace";
import Unit from "./pages/Unit";
import Welcome from "./pages/Welcome";
import { useSchoolYearRollover } from "./promotion";
import { useDeviceAccount } from "./account";
import { useStore } from "./store";

/** Signed in, or a demo/guest session. */
function Gate({ children }: { children: React.ReactNode }) {
  const { consent, role, demo } = useStore();
  const { user, profile, ready } = useAuth();
  if (!consent) return <Navigate to="/" replace />;
  if (demo) return <>{children}</>;
  if (authConfigured && !ready) return null;
  if (user) {
    if (!profile?.onboarded_at) return <Navigate to="/welcome" replace />;
    return <>{children}</>;
  }
  if (role === "guest") return <>{children}</>;
  return <Navigate to="/" replace />;
}

/** A crash on one page shows a way out instead of a white screen; moving to another page clears it. */
function RouteBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);
  useSchoolYearRollover();
  useDeviceAccount();
  return (
    <BrowserRouter>
      <RouteBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/student" element={<Gate><StudentHome /></Gate>} />
          <Route path="/map" element={<Gate><MapPage /></Gate>} />
          <Route path="/help" element={<Gate><Help /></Gate>} />
          <Route path="/solve/:problemId" element={<Gate><Solve /></Gate>} />
          <Route path="/trace" element={<Gate><Trace /></Gate>} />
          <Route path="/check/:subject" element={<Gate><Check /></Gate>} />
          <Route path="/unit/:unitId" element={<Gate><Unit /></Gate>} />
          <Route path="/learn/:skillId" element={<Gate><Learn /></Gate>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteBoundary>
    </BrowserRouter>
  );
}
