// src/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "@/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // <<< 1. Adicionar estado loading, inicializar como true
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    setLoading(true); // Garante que começa carregando
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false); // <<< 2. Termina de carregar APÓS buscar a sessão inicial
    }).catch(() => {
        // Mesmo em caso de erro ao buscar a sessão inicial, paramos o loading
        setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);
      // Se a primeira verificação ainda não terminou quando o listener disparar,
      // garantimos que o loading termine aqui também.
      if (loading) {
          setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Dependência vazia para rodar só no mount

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // <<< 3. Fornecer 'loading' no value do Provider >>>
  return (
    <AuthContext.Provider value={{ session, loading, theme, toggleTheme }}>
      {!loading ? children : <div>Carregando aplicação...</div>} {/* Opcional: Mostrar loading global */}
      {/* OU apenas {children} se preferir que os layouts cuidem do loading */}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
      throw new Error('useAuth must be used within an AuthProvider');
  }
  return context; // Retorna o contexto incluindo { session, loading, theme, toggleTheme }
}
