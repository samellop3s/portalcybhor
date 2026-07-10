---
trigger: model_decision
glob:
description: Aplicar ao criar ou editar qualquer captura de dados pessoais — formulários de lead, contato, newsletter, checkout, cookies, analytics ou rastreamento — para garantir conformidade com a LGPD e boas práticas de privacidade.
---

# Privacidade e LGPD

Landing pages geralmente coletam dados pessoais (nome, e-mail, telefone) via
formulários de lead. Isso exige conformidade com a LGPD (Lei 13.709/2018).
Aplica-se tanto ao front (consentimento/UI) quanto ao back (armazenamento/uso).

## Base legal e consentimento
- Toda coleta de dado pessoal precisa de base legal (consentimento, execução de
  contrato, legítimo interesse, etc.). Para marketing/newsletter, use
  consentimento explícito e específico — nada de checkbox pré-marcado.
- O texto do consentimento deve ser claro e indicar a finalidade do uso.
- Vincule um link para a Política de Privacidade próximo ao botão de envio.

## Minimização e finalidade
- Colete apenas os dados estritamente necessários para a finalidade declarada.
  Questione campos supérfluos no formulário.
- Não reutilize os dados para finalidades diferentes das informadas.

## Cookies e rastreamento
- Scripts de analytics/rastreamento/pixels (Google Analytics, Meta Pixel, etc.)
  só devem carregar APÓS consentimento, via banner de cookies com opção real de
  recusar (não apenas "OK").
- Categorize cookies (necessários vs. analíticos/marketing) e respeite a escolha
  do usuário no carregamento dos scripts.

## Direitos do titular e transparência
- Disponibilize meio de contato (ex.: e-mail do encarregado/DPO) para o titular
  exercer direitos: acesso, correção, exclusão e portabilidade.
- Não compartilhe dados com terceiros sem base legal e transparência.

## Segurança e retenção dos dados
- Dados pessoais em trânsito e em repouso devem ser protegidos (HTTPS,
  criptografia/controle de acesso no armazenamento — ver `backend-security`).
- Defina prazo de retenção e descarte dados quando a finalidade se encerrar.
- Em integrações com CRM/e-mail marketing, garanta que o provedor também trate
  os dados com segurança (cláusulas/contrato de tratamento).

## Implementação
- Ao gerar formulários de captura, inclua por padrão: checkbox de consentimento
  não pré-marcado, link para política de privacidade e finalidade clara.
- Ao adicionar scripts de terceiros, condicione o carregamento ao consentimento.
