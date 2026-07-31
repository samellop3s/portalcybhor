// ============================================
// HttpError
// ============================================
// Erro de aplicação com status HTTP associado.
// Mensagens de HttpError são seguras para exibir ao cliente;
// qualquer outro erro é tratado como falha interna genérica.

export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = 'Não autenticado.') {
  return new HttpError(401, message);
}

export function forbidden(message = 'Você não tem permissão para realizar esta ação.') {
  return new HttpError(403, message);
}

export function notFound(message = 'Recurso não encontrado.') {
  return new HttpError(404, message);
}

export function conflict(message) {
  return new HttpError(409, message);
}
