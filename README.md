# Oficina de Estudos — Plataforma de Campanhas e Materiais Gratuitos

Plataforma web completa composta por **Landing Page Pública** dinâmica e **Painel Administrativo** integrado ao **Supabase** (Banco de Dados, Auth e Storage) e **Resend** (envio automático de e-mails e webhooks de entrega).

---

## Estrutura do Projeto

```
oficina-de-estudos/
├── public/                        # Landing page pública
│   ├── index.html                 # Página principal (consome campanha ativa)
│   ├── privacidade.html           # Política de Privacidade e LGPD
│   └── assets/
│       ├── css/main.css
│       └── js/
│           ├── config.js
│           ├── utils.js
│           └── landing.js
├── admin/                         # Painel administrativo (/admin)
│   ├── login.html                 # Autenticação via Supabase Auth
│   ├── index.html                 # Dashboard com indicadores e gráficos
│   ├── campaigns.html             # Gerenciamento de campanhas e upload de materiais
│   ├── leads.html                 # Gestão de leads, filtros, CSV, WhatsApp e LGPD
│   ├── sends.html                 # Histórico de envios e status Resend
│   ├── settings.html              # Configurações e alteração de senha
│   └── assets/
│       ├── css/admin.css
│       └── js/admin-utils.js
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql # Tabelas, índices, RLS e buckets Storage
│   └── functions/
│       ├── send-material/         # Edge Function: valida lead, grava no DB e envia via Resend
│       └── resend-webhook/        # Edge Function: atualiza status de entrega via webhook Resend
├── .env.example
└── README.md
```

---

## Instalação e Configuração

### 1. Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, execute o script [001_initial_schema.sql](supabase/migrations/001_initial_schema.sql).
   - Isso cria as tabelas `admin_users`, `campaigns`, `leads` e `email_sends`, os índices, as políticas de **Row Level Security (RLS)** e os buckets `campaign-images` (público) e `campaign-materials` (privado).
3. Crie o primeiro usuário administrador em **Authentication → Users** no painel do Supabase.
4. Insira o `id` (UUID) e `email` desse usuário na tabela `public.admin_users`:
   ```sql
   INSERT INTO public.admin_users (id, email)
   VALUES ('UUID-DO-USUARIO', 'admin@seudominio.com.br');
   ```

### 2. Configurar as Edge Functions e o Resend

1. Crie uma conta no [Resend](https://resend.com), verifique seu domínio remetente e gere uma **API Key**.
2. Instale a [Supabase CLI](https://supabase.com/docs/guides/cli) e faça login:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   ```
3. Configure os segredos das Edge Functions:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
   supabase secrets set RESEND_FROM_EMAIL="Oficina de Estudos <materiais@seudominio.com.br>"
   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxx
   ```
4. Faça o deploy das funções:
   ```bash
   supabase functions deploy send-material --no-verify-jwt
   supabase functions deploy resend-webhook --no-verify-jwt
   ```
5. (Opcional recomendado) No painel do Resend, configure um Webhook apontando para:
   `https://SEU_PROJECT_REF.supabase.co/functions/v1/resend-webhook`
   assinando os eventos `email.delivered`, `email.bounced`, `email.complained` e `email.failed`.

### 3. Configurar o Frontend

Nos arquivos HTML (`public/index.html` e `admin/*.html`), substitua `YOUR_SUPABASE_URL` e `YOUR_SUPABASE_ANON_KEY` pelas credenciais públicas do seu projeto Supabase (encontradas em **Project Settings → API**).

> **Segurança:** Nunca insira a `service_role` key nem a `RESEND_API_KEY` nos arquivos do frontend.

### 4. Executar Localmente

Você pode servir a pasta raiz com qualquer servidor HTTP estático (ex.: `npx serve .` ou extensão Live Server):
- Landing Page: `http://localhost:3000/public/index.html`
- Painel Admin: `http://localhost:3000/admin/login.html`

---

## Segurança e LGPD

- **RLS ativo** em todas as tabelas: visitantes anônimos só podem visualizar a campanha ativa (`is_active = true`).
- **Dados de leads isolados**: apenas usuários autenticados presentes em `admin_users` podem ler ou excluir leads.
- **Materiais protegidos**: o bucket `campaign-materials` é privado; a Edge Function gera **Signed URLs** com validade de 7 dias no momento do envio.
- **Exclusão LGPD**: administradores podem excluir leads individualmente no modal de detalhes em `admin/leads.html`.
