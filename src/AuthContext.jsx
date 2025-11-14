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

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "lastActivityTimestamp";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // Começa como true
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  // --- Funções de Callback Estáveis ---

  const updateLastActivity = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      console.error("Não foi possível aceder ao localStorage:", e);
    }
  }, []);

  const handleSignOutInactive = useCallback(() => {
    supabase.auth.signOut();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    toast.error("Sessão expirada por inatividade. Faça login novamente.", {
      duration: 5000,
    });
  }, []);

  const checkInactivity = useCallback(() => {
    // Esta função agora não depende da 'session'
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();

      if (now - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
        handleSignOutInactive();
      }
    } else {
      updateLastActivity();
    }
  }, [handleSignOutInactive, updateLastActivity]);

  // <<< CORREÇÃO 1: useEffect de Carregamento Inicial (Sessão) >>>
  useEffect(() => {
    setLoading(true);
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        if (initialSession) {
          // Se já estava logado, VERIFICA a inatividade imediatamente
          checkInactivity();
        }
        setLoading(false); // Termina o loading
      })
      .catch(() => {
        setLoading(false);
      });

    // Listener para mudanças (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);
      if (updatedSession) {
        updateLastActivity(); // Define o timestamp no login
      } else {
        localStorage.removeItem(LAST_ACTIVITY_KEY); // Limpa no logout
      }
    });

    return () => subscription.unsubscribe();

    // <<< CORREÇÃO 2: Dependências vazias. Só corre UMA VEZ no mount. >>>
  }, [checkInactivity, updateLastActivity]);

  // <<< CORREÇÃO 3: useEffect para Eventos de Atividade >>>
  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
    ];

    const activityHandler = () => {
      // Só atualiza o timestamp se houver uma sessão ativa
      if (session) {
        updateLastActivity();
      }
    };

    const visibilityHandler = () => {
      // Quando a aba fica visível, verifica se a sessão expirou
      if (document.visibilityState === "visible" && session) {
        checkInactivity();
      }
    };

    // Adiciona os listeners
    events.forEach((event) => window.addEventListener(event, activityHandler));
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, activityHandler)
      );
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
    // Depende de 'session' (para saber se deve ouvir) e dos callbacks estáveis
  }, [session, updateLastActivity, checkInactivity]);

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

  // <<< CORREÇÃO 4: Remove o JSX de "Carregando..." מכאן >>>
  // O App.jsx já trata disso.
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
