# Cognicard

Repositório front-end do Cognicard.

## Pré-requisitos

- Node.js (recomendado v18+)
- npm ou yarn
- Conta e projeto no Supabase

## Instalação

1. Instalar dependências:

```bash
npm install
```

2. Copiar e preencher variáveis de ambiente:

```bash
cp .env.example .env
# editar .env com a URL e a anon key do Supabase
```

3. Rodar em desenvolvimento:

```bash
npm run dev
```

## Supabase / CORS

- No painel do Supabase: Project Settings → API → Allowed Origins, adicione:
  - http://localhost:5173

## Boas práticas

- Não commite arquivos .env (já listados em .gitignore).
- Use branches para features e PRs para revisão de código.
- Configure CI (GitHub Actions) para lint/testes antes do merge.

## Contato

- Instruções adicionais e configuração backend/Supabase devem ser documentadas conforme o projeto evoluir.
