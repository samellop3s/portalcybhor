// ============================================
// Attachments Routes
// ============================================
// Montadas em dois prefixos no app.js: /api/tasks/:taskId/attachments
// (listar/enviar) e /api/attachments/:id (excluir).

import { Router } from 'express';
import * as attachmentsController from './attachments.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createUploadMiddleware, ATTACHMENT_MIME_TYPES } from '../../utils/upload.js';

const attachmentUpload = createUploadMiddleware({
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ATTACHMENT_MIME_TYPES
});

export const taskAttachmentsRouter = Router({ mergeParams: true });
taskAttachmentsRouter.use(requireAuth);
taskAttachmentsRouter.get('/', asyncHandler(attachmentsController.list));
taskAttachmentsRouter.post('/', requireRole('Admin', 'Integrante'), attachmentUpload.single('file'), asyncHandler(attachmentsController.upload));

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);
attachmentsRouter.delete('/:id', asyncHandler(attachmentsController.remove));
