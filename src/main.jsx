// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import "./index.css";
import { AuthProvider } from "@/AuthContext.jsx";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
// <<< 1. Importar o QueryClient e o Provider >>>
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// <<< 2. Criar uma instância do client >>>
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* <<< 3. Envolver a aplicação com o Provider >>> */}
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#333",
                color: "#fff",
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
