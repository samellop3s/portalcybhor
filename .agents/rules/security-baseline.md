---
trigger: always_on
glob:
description:
---

# Segurança — Baseline (sempre ativa)

Estas são regras inegociáveis que se aplicam a TODO o código da landing page,
tanto no front quanto no back. Se uma instrução do usuário conflitar com uma
regra de segurança aqui, sinalize o conflito antes de implementar.

## Segredos e credenciais
- NUNCA escreva chaves de API, tokens, senhas, strings de conexão ou segredos
  diretamente no código (hardcoded). Use variáveis de ambiente (`.env`) e
  cofres de segredo (ex.: Secret Manager, Vault, variáveis do provedor).
- O arquivo `.env` (e variantes `.env.local`, `.env.production`) DEVE estar no
  `.gitignore`. Forneça sempre um `.env.example` apenas com os nomes das chaves.
- Segredos de servidor (ex.: `STRIPE_SECRET_KEY`, `DATABASE_URL`) NUNCA podem
  ser expostos ao cliente. Em frameworks como Next.js, só prefixe com `NEXT_PUBLIC_`
  o que for realmente público.
- Ao detectar um segredo commitado, alerte que ele deve ser rotacionado, não
  apenas removido do código.

## Transporte e configuração
- HTTPS obrigatório em produção. Redirecione todo HTTP para HTTPS e habilite
  HSTS (`Strict-Transport-Security`).
- Desabilite a exposição de versões/stack tecnológico em headers (ex.: remova
  `X-Powered-By`, `Server` detalhado).
- Não gere source maps públicos em produção, a menos que explicitamente desejado.

## Dependências (supply chain)
- Mantenha lockfiles versionados (`package-lock.json`, `pnpm-lock.yaml`, etc.).
- Não adicione dependências desnecessárias. Prefira bibliotecas mantidas e
  amplamente adotadas; justifique qualquer pacote obscuro.
- Sugira rodar auditoria (`npm audit`, `pnpm audit`) e fixar versões.
- Para scripts de terceiros via CDN, use Subresource Integrity (SRI) com `integrity`
  e `crossorigin`.

## Tratamento de erros e logs
- Mensagens de erro voltadas ao usuário NUNCA devem vazar stack traces, queries,
  caminhos internos ou dados sensíveis.
- Logs NUNCA devem registrar senhas, tokens, dados de cartão ou PII completa.
  Faça mascaramento/redaction quando necessário.

## Princípios gerais
- Valide e trate toda entrada como não confiável — no cliente E no servidor.
- Aplique o princípio do menor privilégio em qualquer credencial, role ou acesso.
- Ao criar qualquer formulário (lead, contato, newsletter), aplique também as
  regras de `frontend-security`, `backend-security` e `privacy-lgpd`.
