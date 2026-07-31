// ============================================
// Profile Routes
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import * as profileController from './profile.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createUploadMiddleware, IMAGE_MIME_TYPES } from '../../utils/upload.js';

const router = Router();

const messageSchema = z.object({
  profileMessage: z.string().trim().max(300)
});

const photoUpload = createUploadMiddleware({
  maxSizeBytes: 5 * 1024 * 1024,
  allowedMimeTypes: IMAGE_MIME_TYPES
});

router.use(requireAuth);

router.patch('/message', validateBody(messageSchema), asyncHandler(profileController.updateMessage));
router.post('/photo', photoUpload.single('photo'), asyncHandler(profileController.uploadPhoto));
router.delete('/photo', asyncHandler(profileController.removePhoto));

export default router;
