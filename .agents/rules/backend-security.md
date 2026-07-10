---
trigger: glob
glob: **/{api,server,app,routes,controllers,services,lib,middleware}/**/*.{ts,js,py,go,rb,php,java}
description:
---

# Segurança — Backend / API

Aplica-se a rotas, handlers, server actions, controllers e qualquer código que
rode no servidor (endpoints de formulário, integrações, etc.).

## Validação de entrada (server-side)
- Valide e sanitize TODA entrada no servidor, mesmo que já validada no front.
  Use um schema validator (ex.: Zod, Yup, Joi, Pydantic) com allowlist de campos.
- Rejeite payloads desconhecidos/extras e limite tamanho de corpo da requisição.
- Tipos, tamanhos e formatos devem ser estritos (e-mail, telefone, etc.).

## Injeção (SQL/NoSQL/comando)
- SEMPRE use queries parametrizadas ou um ORM/query builder com binding.
  NUNCA concatene entrada do usuário em SQL/consultas.
- Nunca passe entrada do usuário para execução de comando de shell (`exec`,
  `eval`, template de comando). Se inevitável, use APIs seguras e allowlist.

## Autenticação e autorização
- Endpoints que mudam estado ou retornam dados sensíveis exigem verificação de
  autenticação/autorização — nunca confie em IDs ou flags vindos do cliente.
- Cookies de sessão/JWT: `HttpOnly`, `Secure`, `SameSite`, expiração curta e
  rotação. Nunca exponha tokens em URL.

## CSRF e CORS
- Proteja endpoints que alteram estado contra CSRF (token anti-CSRF ou
  verificação de `Origin`/`SameSite`).
- Configure CORS de forma restritiva: liste explicitamente as origens
  permitidas. NUNCA use `Access-Control-Allow-Origin: *` em endpoints com
  credenciais/dados sensíveis.

## Rate limiting e abuso
- Aplique rate limiting/throttling em todos os endpoints públicos, especialmente
  envio de formulários (lead, contato, login), por IP e/ou identificador.
- Valide CAPTCHA/honeypot no servidor (não só no front) antes de processar.
- Para e-mails de saída, proteja contra header injection e relay aberto.

## Headers de resposta
- Defina os headers de segurança no servidor: `Strict-Transport-Security`,
  `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`.

## Erros, logs e dados sensíveis
- Respostas de erro ao cliente devem ser genéricas; detalhes (stack, query)
  ficam apenas em logs internos.
- Nunca logue senhas, tokens, dados de cartão ou PII completa — mascare.
- Use status HTTP corretos e não revele se um e-mail/usuário existe em fluxos
  de autenticação (evite enumeration).

## Upload de arquivos (se houver)
- Valide tipo (MIME real, não só extensão), tamanho e nome. Armazene fora da
  webroot, gere nomes aleatórios e nunca execute o que foi enviado.

## Segredos e integrações
- Carregue segredos de variáveis de ambiente/cofre, nunca hardcoded.
- Chamadas a serviços de terceiros (pagamento, e-mail, CRM) acontecem no
  servidor, mantendo as chaves fora do alcance do cliente.
