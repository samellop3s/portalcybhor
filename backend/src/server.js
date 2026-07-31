// ============================================
// HTTP + WebSocket Server Bootstrap
// ============================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { registerSocketHandlers } from './sockets/registerSocketHandlers.js';
import { pool } from './config/db.js';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigins,
    credentials: true
  }
});

registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`Portal Cybhor API rodando na porta ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`Recebido ${signal}, encerrando servidor...`);
  httpServer.close(() => console.log('Servidor HTTP encerrado.'));
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
