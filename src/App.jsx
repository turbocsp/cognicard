import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/AuthContext.jsx";
import LoginPage from "@/pages/LoginPage.jsx";
import SignUpPage from "@/pages/SignUpPage.jsx";
import DashboardPage from "@/pages/DashboardPage.jsx";
import DeckDetailPage from "@/pages/DeckDetailPage.jsx";
import StudyPage from "@/pages/StudyPage.jsx";
import ImportPage from "@/pages/ImportPage.jsx";
import StatsPage from "@/pages/StatsPage.jsx";

function ProtectedRoute() {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
        <Route path="/deck/:deckId/study" element={<StudyPage />} />
        <Route path="/deck/:deckId/import" element={<ImportPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
