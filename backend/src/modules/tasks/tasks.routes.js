// ============================================
// Tasks Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as tasksController from './tasks.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid()
});

const moveTaskSchema = z.object({ stageId: z.string().uuid() });
const updateStatusSchema = z.object({ status: z.enum(['pending', 'done', 'failed']) });

router.use(requireAuth);

router.get('/', asyncHandler(tasksController.list));
router.post('/', requireRole('Admin', 'Integrante'), validateBody(createTaskSchema), asyncHandler(tasksController.create));
router.patch('/:id/move', requireRole('Admin', 'Integrante'), validateBody(moveTaskSchema), asyncHandler(tasksController.move));
router.patch('/:id/status', requireRole('Admin', 'Integrante'), validateBody(updateStatusSchema), asyncHandler(tasksController.updateStatus));
router.delete('/:id', requireRole('Admin'), asyncHandler(tasksController.remove));

export default router;
