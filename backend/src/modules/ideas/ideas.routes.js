// ============================================
// Ideas Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as ideasController from './ideas.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const createIdeaSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000)
});

const voteSchema = z.object({ vote: z.boolean().nullable() });

const promoteSchema = z.object({
  stageId: z.string().uuid(),
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string().uuid().nullable().optional()
});

router.use(requireAuth);

router.get('/', asyncHandler(ideasController.list));
router.post('/', validateBody(createIdeaSchema), asyncHandler(ideasController.create));
router.patch('/:id/discard', requireRole('Admin'), asyncHandler(ideasController.discard));
router.put('/:id/vote', requireRole('Admin', 'Integrante'), validateBody(voteSchema), asyncHandler(ideasController.vote));
router.post('/:id/promote', requireRole('Admin'), validateBody(promoteSchema), asyncHandler(ideasController.promote));

export default router;
