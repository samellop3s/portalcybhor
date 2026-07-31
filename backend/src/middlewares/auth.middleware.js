// ============================================
// Auth Middleware
// ============================================
// Lê o JWT do cookie httpOnly e anexa { id, role } em req.user.

import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/jwt.js';
import { unauthorized } from '../utils/httpError.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return next(unauthorized());
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (error) {
    next(unauthorized('Sessão inválida ou expirada.'));
  }
}
