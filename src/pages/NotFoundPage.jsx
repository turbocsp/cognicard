// src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo'; // Reutilizando o logo para consistência

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-center px-4">
      <div className="mb-8">
        <Logo />
      </div>
      <h1 className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Página Não Encontrada</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Desculpe, a página que você está procurando não existe ou foi movida.
      </p>
      <Link
        to="/dashboard" // Link para um local seguro, como o dashboard
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}

export default NotFoundPage;
