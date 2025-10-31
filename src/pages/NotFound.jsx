// src/pages/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{ 
      textAlign: "center", 
      marginTop: "10%", 
      fontFamily: "sans-serif" 
    }}>
      <h1 style={{ fontSize: "3rem", color: "#333" }}>404</h1>
      <p>Página não encontrada 😕</p>
      <Link to="/" style={{ color: "#0070f3", textDecoration: "none" }}>
        Voltar para a página inicial
      </Link>
    </div>
  );
}
