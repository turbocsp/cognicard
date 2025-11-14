// src/AuthContext.jsx
import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { supabase } from "@/supabaseClient";
import { toast } from "react-hot-toast";

const AuthContext = createContext();

// 30 minutos em milissegundos
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Chave para o localStorage
const LAST_ACTIVITY_KEY = "lastActivityTimestamp";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  // <<< 1. Função para ATUALIZAR a última atividade >>>
  // Usamos useCallback para garantir que a função seja estável
  const updateLastActivity = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      console.error("Não foi possível aceder ao localStorage:", e);
    }
  }, []);

  // <<< 2. Função para FAZER LOGOUT >>>
  const handleSignOutInactive = useCallback(() => {
    supabase.auth.signOut();
    localStorage.removeItem(LAST_ACTIVITY_KEY); // Limpa o timestamp
    toast.error("Sessão expirada por inatividade. Faça login novamente.", {
      duration: 5000,
    });
  }, []);

  // <<< 3. Função para VERIFICAR a inatividade >>>
  const checkInactivity = useCallback(() => {
    // Só verifica se o utilizador está logado (tem sessão)
    if (!session) return;

    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();

      if (now - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
        handleSignOutInactive();
      }
    } else {
      // Se não houver timestamp (ex: primeiro login), define um
      updateLastActivity();
    }
  }, [session, handleSignOutInactive, updateLastActivity]);

  // <<< 4. useEffect de Carregamento Inicial (Sessão) >>>
  useEffect(() => {
    setLoading(true);
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setLoading(false);
        if (initialSession) {
          // Se já estava logado, VERIFICA a inatividade primeiro
          checkInactivity();
        }
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);

      if (updatedSession) {
        // Se acabou de fazer login, ATUALIZA o timestamp
        updateLastActivity();
      } else {
        // Se fez logout, limpa o timestamp
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkInactivity, updateLastActivity]); // Depende das nossas funções estáveis

  // <<< 5. useEffect para Eventos de Atividade >>>
  useEffect(() => {
    // Eventos que contam como "atividade"
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
    ];

    // Handler para os eventos
    const activityHandler = () => {
      // Só atualiza se o utilizador estiver logado
      if (session) {
        updateLastActivity();
      }
    };

    // Handler para verificar quando a aba fica visível
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };

    // Adiciona os listeners
    events.forEach((event) => window.addEventListener(event, activityHandler));
    document.addEventListener("visibilitychange", visibilityHandler);

    // Limpeza
    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, activityHandler)
      );
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [session, updateLastActivity, checkInactivity]); // Depende da sessão e das funções

  // (useEffect do 'theme' permanece o mesmo)
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

  return (
    <AuthContext.Provider value={{ session, loading, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
