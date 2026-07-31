// ============================================
// Socket.IO Instance Holder
// ============================================
// Mantém uma referência única ao servidor Socket.IO para que
// os services possam emitir eventos de tempo real após cada
// escrita no banco, sem import circular com server.js.

let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

/**
 * Emite um evento para todos os clientes autenticados conectados.
 * Usado pelos services após criar/atualizar/excluir um registro,
 * substituindo o comportamento de tempo real do Firebase onValue.
 * @param {string} event - Nome do evento (ex: 'task:created')
 * @param {object} payload - Dados do evento
 */
export function emitEvent(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}
