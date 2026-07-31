// ============================================
// Socket.IO Connection Handling
// ============================================
// Autentica cada conexão WebSocket usando o mesmo cookie JWT
// da API REST, mantendo uma única fonte de verdade para auth.

import cookie from 'cookie';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/jwt.js';
import { setIO } from './io.js';

export function registerSocketHandlers(io) {
  setIO(io);

  io.use((socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie || '';
      const parsedCookies = cookie.parse(rawCookies);
      const token = parsedCookies[AUTH_COOKIE_NAME];
      if (!token) {
        return next(new Error('unauthorized'));
      }
      const payload = verifyAuthToken(token);
      socket.user = { id: payload.id, role: payload.role };
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Todos os usuários autenticados compartilham os mesmos eventos
    // de módulo (kanban, financeiro, marketing, dev), assim como as
    // regras do Firebase Realtime Database permitiam leitura ampla
    // para qualquer usuário logado.
    socket.on('disconnect', () => {});
  });
}
