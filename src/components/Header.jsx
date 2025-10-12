import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { supabase } from "@/supabaseClient";
import Logo from "@/components/Logo";

// Este componente cria um cabeçalho consistente para todas as páginas da aplicação após o login.
function Header() {
  const { theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md p-4 mb-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/stats"
            className="font-medium text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
          >
            Estatísticas
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Alternar tema"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button
            onClick={handleSignOut}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
