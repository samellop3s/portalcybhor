// ============================================
// JWT Helpers
// ============================================
// Emissão e verificação de tokens JWT usados no cookie httpOnly
// que autentica requisições REST e conexões WebSocket.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'cybhor_token';

/**
 * Assina um JWT contendo o id e o papel do usuário.
 * @param {{ id: string, role: string }} payload
 * @returns {string}
 */
export function signAuthToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Verifica e decodifica um JWT. Lança erro se inválido/expirado.
 * @param {string} token
 * @returns {{ id: string, role: string, iat: number, exp: number }}
 */
export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function getAuthCookieOptions() {
  // SameSite=Lax: frontend e API na mesma origem via proxy.
  // Evita CSRF cross-site sem quebrar navegação normal.
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}
