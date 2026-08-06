// ============================================
// Express App
// ============================================
// Monta middlewares globais de segurança e todos os routers de
// módulo sob /api/*. A lógica de negócio nunca vive aqui — apenas
// composição de rotas e middlewares transversais.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import stagesRoutes from './modules/stages/stages.routes.js';
import tasksRoutes from './modules/tasks/tasks.routes.js';
import ideasRoutes from './modules/ideas/ideas.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import marketingRoutes from './modules/marketing/marketing.routes.js';
import devhubRoutes from './modules/devhub/devhub.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import { taskAttachmentsRouter, attachmentsRouter } from './modules/attachments/attachments.routes.js';

export const app = express();

app.set('trust proxy', 1);
app.set('etag', false);

app.use(helmet());
app.use(cors({
  origin: env.corsOrigins,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' }
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/stages', stagesRoutes);
app.use('/api/tasks/:taskId/attachments', taskAttachmentsRouter);
app.use('/api/tasks', tasksRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/devhub', devhubRoutes);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/chat', chatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
