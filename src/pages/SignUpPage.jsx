import { useState } from "react";
import { supabase } from "@/supabaseClient";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";

const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes("Failed to fetch")) {
        toast.error(
          "Erro de rede. Verifique sua conexão ou a configuração de CORS no Supabase."
        );
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(
        "Cadastro realizado! Verifique seu e-mail para confirmar a conta."
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <form onSubmit={handleSignUp} className="space-y-6">
          <div>
            <label
              className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="email"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded-md"
            disabled={loading}
          >
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Já tem uma conta?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Faça o login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
