---
description: Auditoria de segurança da landing page contra as rules de segurança e privacidade (front, back e LGPD). Gera um relatório por severidade com correções acionáveis.
---

# /security-review — Auditoria de segurança da landing page

Objetivo: revisar a landing page contra as rules de segurança do projeto e
produzir um relatório acionável. Use as rules como critério de avaliação:
@../rules/security-baseline.md, @../rules/frontend-security.md,
@../rules/backend-security.md e @../rules/privacy-lgpd.md.

Não altere código nesta etapa, a menos que o usuário peça no passo final.
Para cada achado, registre: arquivo:linha, severidade, regra violada e a correção.

## Passos

1. **Mapear o escopo.** Liste a estrutura do projeto e identifique:
   - arquivos de front (UI/componentes/páginas/formulários);
   - código de servidor (rotas, API, handlers, server actions, middleware);
   - formulários de captura de dados (lead, contato, newsletter, checkout);
   - scripts de terceiros (analytics, pixels, CDNs, iframes);
   - uso de variáveis de ambiente e arquivos de configuração.

2. **Segredos e configuração (baseline).**
   - Procure segredos hardcoded (chaves, tokens, senhas, strings de conexão).
   - Verifique se `.env*` está no `.gitignore` e se existe `.env.example`.
   - Confirme que segredos de servidor não estão expostos ao cliente (ex.: uso
     indevido de `NEXT_PUBLIC_`).
   - Verifique HTTPS/HSTS, remoção de `X-Powered-By` e ausência de source maps
     públicos em produção.

3. **Frontend.** Avalie contra `frontend-security`:
   - XSS: `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `document.write`,
     URLs/`href`/`src` montados com entrada do usuário sem sanitização.
   - CSP e headers (clickjacking, `nosniff`, `Referrer-Policy`).
   - SRI em scripts/CDN; `rel="noopener noreferrer"` em `target="_blank"`.
   - Formulários: validação só de UX no front, presença de honeypot/CAPTCHA,
     PII em `localStorage`/`sessionStorage`.

4. **Backend / API.** Avalie contra `backend-security`:
   - Validação server-side com schema; rejeição de campos extras; limite de payload.
   - Queries parametrizadas/ORM (sem concatenação de SQL); ausência de `eval`/exec
     com entrada do usuário.
   - Autenticação/autorização em endpoints sensíveis; cookies `HttpOnly`/`Secure`/`SameSite`.
   - CSRF e CORS restritivo (sem `Allow-Origin: *` com credenciais).
   - Rate limiting em endpoints públicos e validação de CAPTCHA/honeypot no servidor.
   - Headers de segurança definidos no servidor; erros genéricos ao cliente;
     logs sem PII/segredos; validação de upload (se houver).

5. **Privacidade / LGPD.** Avalie contra `privacy-lgpd`:
   - Consentimento explícito e não pré-marcado; link para Política de Privacidade.
   - Minimização de dados (questione campos supérfluos).
   - Scripts de rastreamento carregando só após consentimento (banner de cookies
     com opção real de recusar).
   - Canal para direitos do titular e prazo/retenção de dados.

6. **Dependências (supply chain).**
   - Verifique lockfile versionado e rode/sugira `npm audit` / `pnpm audit`.
   - Aponte dependências obsoletas, sem manutenção ou desnecessárias.

7. **Gerar o relatório.** Apresente os achados agrupados por severidade
   (Crítico / Alto / Médio / Baixo). Para cada item:
   - `arquivo:linha` + descrição do problema;
   - regra violada (baseline / frontend / backend / lgpd);
   - correção concreta recomendada (com trecho de código quando útil).
   Liste também o que está conforme. Termine com um resumo contável
   (total por severidade) e os 3 próximos passos prioritários.

8. **Oferecer correção.** Pergunte ao usuário se deseja que você aplique as
   correções. Se sim, comece pelos itens Críticos/Altos, faça mudanças mínimas
   e seguras, e re-execute os passos relevantes para validar.
