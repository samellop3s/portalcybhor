// ============================================
// Stages Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as stagesController from './stages.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const createStageSchema = z.object({
  title: z.string().trim().min(1).max(120)
});

router.use(requireAuth);

router.get('/', asyncHandler(stagesController.list));
router.post('/', requireRole('Admin'), validateBody(createStageSchema), asyncHandler(stagesController.create));
router.delete('/:id', requireRole('Admin'), asyncHandler(stagesController.remove));

export default router;
