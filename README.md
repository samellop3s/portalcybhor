# Portal Cybhor Tech — v2

Portal de organização e gestão de projetos da equipe Cybhor Tech. A v2 é uma central versátil de trabalho com módulos de **Projetos (Kanban)**, **Desenvolvimento**, **Financeiro**, **Marketing**, **Ideias** e **Dashboard**, tudo sincronizado em tempo real via WebSocket sobre uma API própria em Node.js + PostgreSQL.

## Módulos

| Módulo | Página | O que faz |
| --- | --- | --- |
| Projetos | `index.html` | Kanban de etapas e tarefas com chat, anexos e prioridades |
| Desenvolvimento | `development.html` | Rastreador de bugs (severidade/status), releases com changelog e links úteis (repos, docs, ambientes) |
| Financeiro | `finance.html` | Receitas e despesas, saldo, fluxo de caixa (6 meses), despesas por categoria e exportação CSV |
| Marketing | `marketing.html` | Campanhas por canal com orçamento/status e calendário de conteúdo |
| Ideias | `ideas.html` | Mural de ideias com votação da equipe |
| Dashboard | `dashboard.html` | Estatísticas de produtividade e exportação de relatórios |
| Admin | `admin.html` | Gestão de usuários e papéis (somente Admin) |
| Perfil | `profile.html` | Dados e foto do usuário |

## Stack

- **Frontend:** HTML5 + JavaScript vanilla (ES Modules), Bootstrap 5.3, Lucide Icons, Chart.js, DOMPurify
- **Backend:** Node.js + Express (arquitetura Router → Controller → Service), autenticação JWT em cookie `httpOnly`
- **Banco de dados:** PostgreSQL, acessado via `pg` com *prepared statements* (`$1, $2...`), sem ORM
- **Tempo real:** Socket.IO (WebSocket), autenticado pelo mesmo cookie da sessão HTTP
- **Armazenamento de arquivos:** Qualquer storage compatível com S3 (MinIO local/self-hosted, AWS S3, Cloudflare R2...)
- **Orquestração:** Docker Compose (Postgres + MinIO + API + Nginx servindo o frontend estático)

## Estrutura do projeto

```
portalcybhor/
├── src/                             # Frontend estático
│   ├── index.html                   # Login + Kanban de projetos
│   ├── development.html             # Módulo Desenvolvimento
│   ├── finance.html                 # Módulo Financeiro
│   ├── marketing.html               # Módulo Marketing
│   ├── ideas.html / dashboard.html / admin.html / profile.html
│   └── assets/
│       ├── css/style.css            # Design system (tema claro/escuro)
│       └── js/
│           ├── pages/                 # Um script por página (finance.js, marketing.js, ...)
│           └── shared/                # Módulos compartilhados
│               ├── api-client.js      # Wrapper fetch() com cookies httpOnly
│               ├── socket-client.js   # Singleton do cliente Socket.IO
│               ├── portal-shell.js    # Header/nav v2 + auth guard das páginas de módulo
│               ├── theme.js           # Tema claro/escuro
│               ├── mobile-menu.js     # Gaveta de navegação mobile
│               ├── storage-manager.js # Cache local (localStorage)
│               └── utils.js           # Formatação de moeda/data, CSV, escape de HTML
├── backend/                         # API REST + WebSocket
│   ├── src/
│   │   ├── server.js                # Bootstrap HTTP + Socket.IO
│   │   ├── app.js                   # Configuração do Express (middlewares, rotas)
│   │   ├── config/                  # env, conexão com Postgres, cliente S3
│   │   ├── db/                      # schema.sql + script de migração
│   │   ├── middlewares/             # auth, roles, validação (Zod), erros
│   │   ├── modules/                 # auth, users, profile, stages, tasks, ideas,
│   │   │                            # finance, marketing, devhub, chat, attachments
│   │   ├── sockets/                 # Registro de handlers e emissão de eventos
│   │   └── utils/                   # httpError, senha (bcryptjs), upload (multer)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml               # Orquestra postgres, minio, api e web (nginx)
├── frontend.Dockerfile              # Build da imagem estática do frontend
├── nginx.frontend.conf              # Proxy reverso /api e /socket.io para a API
└── .env.example                     # Variáveis usadas pelo docker-compose
```

## Papéis e permissões

| Papel | Permissões |
| --- | --- |
| **Admin** | Tudo: gerencia usuários, etapas e pode editar/excluir qualquer registro |
| **Integrante** | Cria e edita tarefas, lançamentos, campanhas, bugs, releases e links |
| **Visualizador** | Acesso somente leitura em todos os módulos |

As permissões são aplicadas em duas camadas: na interface (botões ocultos) e nas rotas da API (`requireRole` + verificação de "dono ou Admin" em cada `service`), que são a camada de segurança real.

## Modelo de dados (PostgreSQL)

Ver o schema completo em [`backend/src/db/schema.sql`](backend/src/db/schema.sql). Principais tabelas:

```
users                    # Perfil: name, email, password_hash, role, photo_url...
stages, tasks            # Kanban de projetos
ideas, idea_votes        # Mural de ideias com votos
finance_transactions     # type (income|expense), amount_cents, category, occurred_at...
marketing_campaigns      # name, channel, status, budget_cents, start_date...
marketing_posts          # title, channel, date, status (draft|scheduled|published)
dev_bugs                 # title, severity, status, assignee_id...
dev_releases             # version, title, notes (changelog), release_date
dev_links                # title, url, category
stage_chat_messages
task_chat_messages       # Mensagens em tempo real
task_attachments         # Metadados de anexos (arquivos no S3/MinIO)
```

> Valores monetários são armazenados em **centavos** (inteiro) para evitar erros de arredondamento de ponto flutuante.

## Como rodar localmente com Docker (recomendado)

Requer [Docker](https://docs.docker.com/get-docker/) e Docker Compose.

1. Clone o repositório e configure as variáveis de ambiente:

```bash
git clone https://github.com/samellop3s/portalcybhor.git
cd portalcybhor
cp .env.example .env
```

2. Edite o `.env` e defina, no mínimo, `JWT_SECRET`, `POSTGRES_PASSWORD` e `MINIO_ROOT_PASSWORD` com valores fortes (nunca use os valores de exemplo em produção).

3. Suba os serviços e aplique o schema do banco:

```bash
docker compose up -d --build
docker compose run --rm migrate
```

4. Acesse `http://localhost:8080`. O primeiro usuário criado via `POST /api/auth/register` (endpoint liberado apenas enquanto não existe nenhum usuário no banco) vira o Admin inicial; a partir daí, novas contas só são criadas pelo próprio Admin em **Admin → Cadastrar membro**.

Serviços expostos:

| Serviço | URL |
| --- | --- |
| Frontend (via Nginx) | `http://localhost:8080` |
| API (direto, útil para debug) | `http://localhost:4000` |
| Console do MinIO | `http://localhost:9001` |

## Como rodar em desenvolvimento (sem Docker)

1. Suba um PostgreSQL e um storage S3-compatible (ou use o MinIO isoladamente: `docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"`).
2. Configure o backend:

```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL, S3_* e JWT_SECRET
npm install
npm run migrate        # aplica src/db/schema.sql
npm run dev             # http://localhost:4000
```

3. Configure o frontend para apontar para a API separada:

```bash
cd src/assets/js/shared
cp config.example.js config.js
# edite config.js: export const API_BASE_URL = 'http://localhost:4000';
```

4. Sirva a pasta `src/` com qualquer servidor estático (ES Modules não funcionam via `file://`):

```bash
npx serve src
# ou
python -m http.server 8000 --directory src
```

5. Acesse `http://localhost:8000` (ou a porta indicada). Nesse modo, como frontend e API ficam em origens diferentes, garanta que `CORS_ORIGIN` no `.env` do backend inclua a origem do frontend.

## Segurança

- Senhas com `bcryptjs` (hash + salt); nunca armazenadas em texto plano.
- Sessão via JWT em cookie `httpOnly` + `SameSite`, não acessível por JavaScript no navegador.
- Todas as consultas SQL usam *prepared statements* (`$1, $2...`) — nunca concatenação de strings.
- Validação e sanitização de entrada com **Zod** em todas as rotas de escrita.
- Erros nunca vazam *stack trace* ao cliente: são logados no servidor e retornam mensagens genéricas.
- Rate limiting nas rotas da API (mais restritivo em `/api/auth`).
- Segredos (senhas de banco, `JWT_SECRET`, credenciais do storage) só existem em variáveis de ambiente — nunca no código-fonte.

## Convenções de contribuição

- Uma página do frontend = um script em `src/assets/js/pages/`; lógica compartilhada vai para `src/assets/js/shared/`.
- Sempre escape conteúdo vindo do usuário com `escapeHTML()` antes de inserir no DOM.
- No backend, cada módulo segue `routes → controller → service`: a rota só aponta o caminho e valida o corpo da requisição (Zod); o `service` concentra as regras de negócio e o acesso ao banco.
- Toda nova tabela/coluna precisa de uma migração em `backend/src/db/schema.sql` (usando `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` idempotentes).
- Toda mutação relevante deve emitir um evento Socket.IO (`entity:created` / `entity:updated` / `entity:deleted`) via `emitEvent()` para manter os clientes conectados sincronizados.
- Não commitar credenciais: use `.env` (baseado em `.env.example`) tanto na raiz (Docker) quanto em `backend/.env` (dev local).
