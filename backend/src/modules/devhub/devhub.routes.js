// ============================================
// DevHub Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as devhubController from './devhub.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const bugSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  assigneeId: z.string().uuid().nullable().optional()
});

const bugStatusSchema = z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']) });

const releaseSchema = z.object({
  version: z.string().trim().min(1).max(30),
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().min(1).max(2000),
  date: z.number().int().positive()
});

const linkSchema = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(500),
  category: z.string().trim().min(1).max(40)
});

router.use(requireAuth);

router.get('/bugs', asyncHandler(devhubController.listBugs));
router.post('/bugs', requireRole('Admin', 'Integrante'), validateBody(bugSchema), asyncHandler(devhubController.createBug));
router.patch('/bugs/:id', requireRole('Admin', 'Integrante'), validateBody(bugSchema), asyncHandler(devhubController.updateBug));
router.patch('/bugs/:id/status', requireRole('Admin', 'Integrante'), validateBody(bugStatusSchema), asyncHandler(devhubController.updateBugStatus));
router.delete('/bugs/:id', requireRole('Admin', 'Integrante'), asyncHandler(devhubController.deleteBug));

router.get('/releases', asyncHandler(devhubController.listReleases));
router.post('/releases', requireRole('Admin', 'Integrante'), validateBody(releaseSchema), asyncHandler(devhubController.createRelease));
router.patch('/releases/:id', requireRole('Admin', 'Integrante'), validateBody(releaseSchema), asyncHandler(devhubController.updateRelease));
router.delete('/releases/:id', requireRole('Admin', 'Integrante'), asyncHandler(devhubController.deleteRelease));

router.get('/links', asyncHandler(devhubController.listLinks));
router.post('/links', requireRole('Admin', 'Integrante'), validateBody(linkSchema), asyncHandler(devhubController.createLink));
router.delete('/links/:id', requireRole('Admin', 'Integrante'), asyncHandler(devhubController.deleteLink));

export default router;
