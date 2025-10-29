// src/App.jsx
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/AuthContext.jsx"; // Import useAuth
import Header from "@/components/Header.jsx";
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

// Layout para rotas protegidas que PRECISAM do Header
function ProtectedLayoutWithHeader() {
  const { session, loading } = useAuth(); // <<< 1. Obter 'loading' do contexto

  if (loading) {
    // <<< 2. Mostrar estado de carregamento enquanto a sessão é verificada
    return <div className="p-8 text-center">Verificando autenticação...</div>;
  }

  if (!session) {
    // <<< 3. Redirecionar SÓ DEPOIS que o loading terminar e não houver sessão
    return <Navigate to="/login" replace />;
  }

  // Se passou pelo loading e tem sessão, renderiza o layout
  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <Outlet />
      </div>
    </>
  );
}

// Layout para rotas protegidas que NÃO usam o Header (ex: StudyPage)
function MinimalProtectedRouteLayout() {
    const { session, loading } = useAuth(); // <<< 1. Obter 'loading'

    if (loading) {
        // <<< 2. Mostrar estado de carregamento
        return <div className="p-8 text-center">Verificando autenticação...</div>;
    }

    if (!session) {
        // <<< 3. Redirecionar SÓ DEPOIS do loading e sem sessão
        return <Navigate to="/login" replace />;
    }

    // Se passou pelo loading e tem sessão, renderiza a rota filha
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

      {/* Agrupamento de Rotas Protegidas COM Header */}
      <Route element={<ProtectedLayoutWithHeader />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/deck/:deckId" element={<DeckDetailPage />} />
        <Route path="/deck/:deckId/import" element={<ImportPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
        {/* Adicione outras rotas que precisam do Header aqui */}
      </Route>

      {/* Agrupamento de Rotas Protegidas SEM Header */}
       <Route element={<MinimalProtectedRouteLayout />}>
        <Route path="/deck/:deckId/study" element={<StudyPage />} />
         {/* Se houver outras rotas protegidas sem header, adicione aqui */}
      </Route>

      {/* Rota Catch-all 404 - Deve ser a ÚLTIMA */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
