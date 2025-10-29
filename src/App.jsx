import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/AuthContext.jsx";
import Header from "@/components/Header.jsx";
import LoginPage from "@/pages/LoginPage.jsx";
import SignUpPage from "@/pages/SignUpPage.jsx";
import DashboardPage from "@/pages/DashboardPage.jsx";
import DeckDetailPage from "@/pages/DeckDetailPage.jsx";
import StudyPage from "@/pages/StudyPage.jsx";
import ImportPage from "@/pages/ImportPage.jsx";
import StatsPage from "@/pages/StatsPage.jsx";
import SearchPage from "@/pages/SearchPage.jsx";
import NotFound from "@/pages/NotFound.jsx";

// Componente de layout para rotas protegidas que inclui o cabeçalho.
function ProtectedLayout() {
  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <Outlet />
      </div>
    </>
  );
}

function ProtectedRoute() {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <ProtectedLayout />;
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
        <Route path="/deck/:deckId/import" element={<ImportPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* A página de estudo não usa o cabeçalho principal para uma experiência focada. */}
      <Route path="/deck/:deckId/study" element={<StudyPage />} />
    </Routes>
  );
}

export default App;
