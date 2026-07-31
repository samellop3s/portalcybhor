// ============================================
// Marketing Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as marketingController from './marketing.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.string().trim().min(1).max(40),
  status: z.enum(['planned', 'active', 'paused', 'finished']),
  budgetCents: z.number().int().min(0),
  startDate: z.number().int().positive(),
  endDate: z.number().int().positive().nullable().optional(),
  goal: z.string().trim().max(500).optional().default('')
});

const postSchema = z.object({
  title: z.string().trim().min(1).max(120),
  channel: z.string().trim().min(1).max(40),
  date: z.number().int().positive(),
  status: z.enum(['draft', 'scheduled', 'published']),
  notes: z.string().trim().max(500).optional().default('')
});

router.use(requireAuth);

router.get('/campaigns', asyncHandler(marketingController.listCampaigns));
router.post('/campaigns', requireRole('Admin', 'Integrante'), validateBody(campaignSchema), asyncHandler(marketingController.createCampaign));
router.patch('/campaigns/:id', requireRole('Admin', 'Integrante'), validateBody(campaignSchema), asyncHandler(marketingController.updateCampaign));
router.delete('/campaigns/:id', requireRole('Admin', 'Integrante'), asyncHandler(marketingController.deleteCampaign));

router.get('/posts', asyncHandler(marketingController.listPosts));
router.post('/posts', requireRole('Admin', 'Integrante'), validateBody(postSchema), asyncHandler(marketingController.createPost));
router.patch('/posts/:id', requireRole('Admin', 'Integrante'), validateBody(postSchema), asyncHandler(marketingController.updatePost));
router.delete('/posts/:id', requireRole('Admin', 'Integrante'), asyncHandler(marketingController.deletePost));

export default router;
