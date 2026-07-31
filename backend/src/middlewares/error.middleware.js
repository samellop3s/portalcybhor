// ============================================
// Centralized Error Handler
// ============================================
// Único ponto de tratamento de erros da API. Nunca retorna
// stack traces ao cliente — apenas mensagens seguras. Todo
// erro é logado no servidor para investigação.

import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      console.error(err);
    }
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined
    });
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor. Tente novamente mais tarde.' });
}
