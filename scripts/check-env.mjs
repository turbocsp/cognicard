// scripts/check-env.mjs
const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("❌ Variáveis ausentes:", missing.join(", "));
  process.exit(1);
} else {
  console.log("✅ Todas as variáveis de ambiente estão definidas.");
}
