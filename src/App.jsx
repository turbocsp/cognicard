// src/App.jsx
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
import NotFoundPage from "@/pages/NotFoundPage.jsx"; // <<< 1. IMPORTE A NOVA PÁGINA

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
      {/* Rotas Públicas */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Rotas Protegidas com Layout (Header) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
        <Route path="/deck/:deckId/import" element={<ImportPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
        {/* Adicione outras rotas protegidas que usam o Header aqui */}
      </Route>

      {/* Rota Protegida Sem Layout Padrão (StudyPage) */}
      {/* Verificamos a sessão aqui também, ou criamos um wrapper específico se necessário */}
      <Route
        path="/deck/:deckId/study"
        element={
          <ProtectedRouteWrapper> {/* Opcional: Wrapper para proteger sem Header */}
            <StudyPage />
          </ProtectedRouteWrapper>
        }
      />

      {/* <<< 2. ADICIONE A ROTA CATCH-ALL NO FINAL >>> */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// Opcional: Wrapper para rotas protegidas que NÃO usam o ProtectedLayout (Header)
function ProtectedRouteWrapper({ children }) {
    const { session } = useAuth();
    if (!session) {
        return <Navigate to="/login" replace />;
    }
    return children;
}


export default App;
