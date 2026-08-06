// ============================================
// Users Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as usersController from './users.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const roleEnum = z.enum(['Admin', 'Integrante', 'Visualizador', 'Rh']);

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  role: roleEnum
});

const updateRoleSchema = z.object({ role: roleEnum });

router.use(requireAuth);

router.get('/', asyncHandler(usersController.list));
router.post('/', requireRole('Admin'), validateBody(createUserSchema), asyncHandler(usersController.create));
router.patch('/:id/role', requireRole('Admin'), validateBody(updateRoleSchema), asyncHandler(usersController.updateRole));
router.delete('/:id', requireRole('Admin'), asyncHandler(usersController.remove));

export default router;
