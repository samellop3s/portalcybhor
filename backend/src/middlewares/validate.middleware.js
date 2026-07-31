// ============================================
// Validation Middleware (Zod)
// ============================================
// Valida e sanitiza req.body contra um schema Zod antes do
// controller ser executado. Erros de validação são seguros
// para retornar ao cliente (não vazam detalhes internos).

import { badRequest } from '../utils/httpError.js';

/**
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(badRequest('Dados inválidos.', details));
    }
    req.body = result.data;
    next();
  };
}
