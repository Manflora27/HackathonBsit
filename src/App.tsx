import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { authConfigured } from "./lib/supabase";
import Check from "./pages/Check";
import ClassPage from "./pages/ClassPage";
import Demo from "./pages/Demo";
import Landing from "./pages/Landing";
import Learn from "./pages/Learn";
import MapPage from "./pages/MapPage";
import Settings from "./pages/Settings";
import Solve from "./pages/Solve";
import StudentHome from "./pages/StudentHome";
import Teacher from "./pages/Teacher";
import TestRun from "./pages/TestRun";
import Trace from "./pages/Trace";
import Unit from "./pages/Unit";
import Welcome from "./pages/Welcome";
import { useStore } from "./store";

/** Signed in, or a demo/guest session. Teachers are never guests. */
function Gate({ children, teacher = false }: { children: React.ReactNode; teacher?: boolean }) {
  const { consent, role, demo } = useStore();
  const { user, profile, ready } = useAuth();
  if (!consent) return <Navigate to="/" replace />;
  if (demo) return <>{children}</>;
  if (authConfigured && !ready) return null;
  if (user) {
    if (!profile?.account_type || !profile.onboarded_at) return <Navigate to="/welcome" replace />;
    if (teacher && profile.account_type !== "teacher") return <Navigate to="/student" replace />;
    return <>{children}</>;
  }
  if (role === "guest" && !teacher) return <>{children}</>;
  return <Navigate to="/" replace />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/student" element={<Gate><StudentHome /></Gate>} />
        <Route path="/map" element={<Gate><MapPage /></Gate>} />
        <Route path="/solve/:problemId" element={<Gate><Solve /></Gate>} />
        <Route path="/trace" element={<Gate><Trace /></Gate>} />
        <Route path="/check/:subject" element={<Gate><Check /></Gate>} />
        <Route path="/unit/:unitId" element={<Gate><Unit /></Gate>} />
        <Route path="/learn/:skillId" element={<Gate><Learn /></Gate>} />
        <Route path="/teacher" element={<Gate teacher><Teacher /></Gate>} />
        <Route path="/teacher/:classId" element={<Gate teacher><ClassPage /></Gate>} />
        <Route path="/test/:testId" element={<Gate><TestRun /></Gate>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
