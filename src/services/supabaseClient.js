// src/services/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl ? "Configurada" : "NÃO CONFIGURADA");
console.log(
  "Supabase Key:",
  supabaseAnonKey ? "Configurada" : "NÃO CONFIGURADA"
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Variáveis de ambiente do Supabase não configuradas!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
