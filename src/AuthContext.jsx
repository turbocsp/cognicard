// src/AuthContext.jsx
import {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { supabase } from "@/supabaseClient";
import { toast } from "react-hot-toast";

const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  const inactivityTimerRef = useRef(null);

  const handleSignOutInactive = useCallback(() => {
    supabase.auth.signOut();
    toast.error("Sessão expirada por inatividade. Faça login novamente.", {
      duration: 5000,
    });
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(
      handleSignOutInactive,
      INACTIVITY_TIMEOUT_MS
    );
  }, [handleSignOutInactive]);

  useEffect(() => {
    setLoading(true);
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setLoading(false);
        if (initialSession) {
          resetInactivityTimer();
        }
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);

      // <<< CORREÇÃO: Esta verificação de 'loading' já não é necessária aqui >>>
      // if (loading) {
      //     setLoading(false);
      // }

      if (updatedSession) {
        resetInactivityTimer();
      } else {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }
    });

    return () => subscription.unsubscribe();

    // <<< CORREÇÃO AQUI: Removido 'loading' da lista de dependências >>>
  }, [resetInactivityTimer]);

  // (O useEffect para 'window.addEventListener' permanece o mesmo)
  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
    ];

    if (session) {
      events.forEach((event) =>
        window.addEventListener(event, resetInactivityTimer)
      );
    }

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetInactivityTimer)
      );
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [session, resetInactivityTimer]);

  // (O useEffect do 'theme' permanece o mesmo)
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
      {/* <<< CORREÇÃO: Renderiza 'children' ou o ecrã de loading global >>> */}
      {/* Se 'loading' for true, o layout protegido em App.jsx irá esperar */}
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
