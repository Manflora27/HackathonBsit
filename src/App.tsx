import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Landing from "./pages/Landing";
import Learn from "./pages/Learn";
import MapPage from "./pages/MapPage";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import Solve from "./pages/Solve";
import StudentHome from "./pages/StudentHome";
import Teacher from "./pages/Teacher";
import Trace from "./pages/Trace";
import { useStore } from "./store";

function NeedsConsent({ children }: { children: React.ReactNode }) {
  const consent = useStore((s) => s.consent);
  return consent ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/student" element={<NeedsConsent><StudentHome /></NeedsConsent>} />
        <Route path="/map" element={<NeedsConsent><MapPage /></NeedsConsent>} />
        <Route path="/progress" element={<NeedsConsent><Progress /></NeedsConsent>} />
        <Route path="/solve/:problemId" element={<NeedsConsent><Solve /></NeedsConsent>} />
        <Route path="/trace" element={<NeedsConsent><Trace /></NeedsConsent>} />
        <Route path="/learn/:skillId" element={<NeedsConsent><Learn /></NeedsConsent>} />
        <Route path="/teacher" element={<NeedsConsent><Teacher /></NeedsConsent>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
