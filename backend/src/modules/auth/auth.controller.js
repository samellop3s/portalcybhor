// ============================================
// Auth Controller
// ============================================
// Camada fina: só traduz requisição/resposta HTTP e delega
// toda a regra de negócio ao auth.service.

import * as authService from './auth.service.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../../utils/jwt.js';

export async function register(req, res) {
  const { user, token } = await authService.registerUser(req.body);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  res.status(201).json({ user });
}

export async function login(req, res) {
  const { user, token } = await authService.loginUser(req.body);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  res.json({ user });
}

export async function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.status(204).send();
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ user });
}
