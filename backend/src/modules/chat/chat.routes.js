// ============================================
// Chat Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as chatController from './chat.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const messageSchema = z.object({
  text: z.string().trim().min(1).max(500)
});

router.use(requireAuth);

router.get('/stages/:stageId/messages', asyncHandler(chatController.listStageMessages));
router.post('/stages/:stageId/messages', validateBody(messageSchema), asyncHandler(chatController.createStageMessage));

router.get('/tasks/:taskId/messages', asyncHandler(chatController.listTaskMessages));
router.post('/tasks/:taskId/messages', validateBody(messageSchema), asyncHandler(chatController.createTaskMessage));

export default router;
