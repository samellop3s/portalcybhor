// ============================================
// Role Middleware
// ============================================
// Restringe uma rota a papéis específicos. Deve ser usado
// sempre após requireAuth (depende de req.user já preenchido).

import { forbidden } from '../utils/httpError.js';

/**
 * @param {...string} allowedRoles - Papéis autorizados (ex: 'Admin', 'Integrante')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(forbidden());
    }
    next();
  };
}
