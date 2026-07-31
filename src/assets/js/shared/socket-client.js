// ============================================
// Socket.IO Client - Cybhor Tech Portal
// ============================================
// Instância única (singleton) do cliente WebSocket, autenticada
// pelo mesmo cookie httpOnly usado na API REST. Substitui os
// listeners onValue()/onChildAdded() do Firebase Realtime Database.
//
// Requer o script global do socket.io-client (via CDN) carregado
// antes deste módulo em cada página HTML.

/* global io */
import { API_BASE_URL } from './config.js';

let socketInstance = null;

/**
 * Retorna a instância singleton do socket, criando-a na primeira chamada.
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (!socketInstance) {
    if (typeof io === 'undefined') {
      throw new Error('Cliente socket.io não carregado. Inclua o script do socket.io-client na página.');
    }
    socketInstance = io(API_BASE_URL || undefined, {
      withCredentials: true,
      autoConnect: true
    });
  }
  return socketInstance;
}
