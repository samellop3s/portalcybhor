---
trigger: glob
glob: **/*.{ts,tsx,js,jsx,vue,svelte,html,astro,css}
description:
---

# Segurança — Frontend

Aplica-se a componentes, páginas, formulários e qualquer código que rode no
navegador da landing page.

## Prevenção de XSS
- NUNCA injete HTML não sanitizado. Evite `innerHTML`, `dangerouslySetInnerHTML`,
  `v-html` e `document.write` com dados dinâmicos.
- Se renderização de HTML for inevitável (ex.: rich text), sanitize com uma
  biblioteca confiável (ex.: DOMPurify) antes de inserir no DOM.
- Renderize conteúdo dinâmico via interpolação/text binding do framework, que
  já faz escaping automático.
- Nunca construa URLs, `href` ou `src` concatenando entrada do usuário sem
  validação (cuidado com `javascript:` e `data:`).

## Segredos no cliente
- Trate tudo que vai ao cliente como público. NUNCA coloque chaves secretas,
  tokens privados ou lógica de autorização sensível no bundle do front.
- Chamadas que exigem segredo devem passar por um endpoint/back próprio, nunca
  expor a credencial no JavaScript.

## Content Security Policy e headers
- Defina uma CSP restritiva (idealmente via header no servidor). Evite
  `unsafe-inline`/`unsafe-eval`; prefira nonces ou hashes para scripts.
- Garanta proteção contra clickjacking com `frame-ancestors` na CSP
  (ou `X-Frame-Options: DENY`/`SAMEORIGIN`).
- Adicione `X-Content-Type-Options: nosniff` e `Referrer-Policy` adequado.

## Formulários (lead, contato, newsletter)
- Faça validação no cliente para UX, mas NUNCA confie nela como segurança — a
  validação real é no servidor (ver `backend-security`).
- Inclua proteção anti-spam/anti-bot: honeypot (campo oculto) e/ou CAPTCHA
  (ex.: reCAPTCHA, Turnstile, hCaptcha) em formulários públicos.
- Aplique `autocomplete` e tipos de input corretos; em campos sensíveis use
  `type="password"` e evite logar valores.
- Não armazene dados de formulário em `localStorage`/`sessionStorage` se forem
  pessoais ou sensíveis.
- Para envios, sempre prefira `fetch`/`POST` para um endpoint próprio em vez de
  enviar direto a serviços de terceiros expondo chaves.

## Recursos externos e iframes
- Para tags `<script>`, `<link>` e `<iframe>` de terceiros, use SRI quando
  possível e adicione `referrerpolicy` e `sandbox` em iframes não confiáveis.
- Em links externos com `target="_blank"`, use `rel="noopener noreferrer"`.
- Carregue apenas domínios na allowlist da CSP; questione qualquer script de
  rastreamento/analytics não essencial.

## Cookies e armazenamento
- Cookies definidos no cliente devem usar `Secure`, `SameSite=Lax`/`Strict`.
  Cookies de sessão/autenticação devem ser `HttpOnly` (definidos no servidor).
- Não persista PII ou tokens em armazenamento do navegador sem necessidade clara.
