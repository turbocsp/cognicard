// src/App.jsx
// <<< 1. Importar 'useLocation' >>>
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/AuthContext.jsx";
import Header from "@/components/Header.jsx";
// ... (outros imports de páginas)
import LoginPage from "@/pages/LoginPage.jsx";
import SignUpPage from "@/pages/SignUpPage.jsx";
import DashboardPage from "@/pages/DashboardPage.jsx";
import DeckDetailPage from "@/pages/DeckDetailPage.jsx";
import StudyPage from "@/pages/StudyPage.jsx";
import ImportPage from "@/pages/ImportPage.jsx";
import StatsPage from "@/pages/StatsPage.jsx";
import SearchPage from "@/pages/SearchPage.jsx";
import NotFoundPage from "@/pages/NotFoundPage.jsx";

// --- Layouts de Proteção ---

function ProtectedLayoutWithHeader() {
  const { session, loading } = useAuth();
  const location = useLocation(); // <<< 2. Obter a localização atual

  if (loading) {
    return <div className="p-8 text-center">Verificando autenticação...</div>;
  }

  if (!session) {
    // <<< 3. Guardar a localização no 'state' ao redirecionar >>>
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <Outlet />
      </div>
    </>
  );
}

function MinimalProtectedRouteLayout() {
  const { session, loading } = useAuth();
  const location = useLocation(); // <<< 2. Obter a localização atual

  if (loading) {
    return <div className="p-8 text-center">Verificando autenticação...</div>;
  }

  if (!session) {
    // <<< 3. Guardar a localização no 'state' ao redirecionar >>>
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// --- Componente Principal App ---

function App() {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* ... (Restante das rotas inalterado) ... */}
      <Route element={<ProtectedLayoutWithHeader />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
        <Route path="/deck/:deckId/import" element={<ImportPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      <Route element={<MinimalProtectedRouteLayout />}>
        <Route path="/deck/:deckId/study" element={<StudyPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
