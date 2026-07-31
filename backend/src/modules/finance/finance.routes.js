// ============================================
// Finance Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as financeController from './finance.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  amountCents: z.number().int().positive(),
  date: z.number().int().positive()
});

router.use(requireAuth);

router.get('/transactions', asyncHandler(financeController.list));
router.post('/transactions', requireRole('Admin', 'Integrante'), validateBody(transactionSchema), asyncHandler(financeController.create));
router.patch('/transactions/:id', requireRole('Admin', 'Integrante'), validateBody(transactionSchema), asyncHandler(financeController.update));
router.delete('/transactions/:id', requireRole('Admin', 'Integrante'), asyncHandler(financeController.remove));

export default router;
