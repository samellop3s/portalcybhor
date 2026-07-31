// ============================================
// Profile Controller
// ============================================

import * as profileService from './profile.service.js';
import { badRequest } from '../../utils/httpError.js';

export async function updateMessage(req, res) {
  const user = await profileService.updateProfileMessage(req.user.id, req.body.profileMessage);
  res.json({ user });
}

export async function uploadPhoto(req, res) {
  if (!req.file) {
    throw badRequest('Nenhum arquivo enviado.');
  }
  const user = await profileService.uploadProfilePhoto(req.user.id, req.file);
  res.json({ user });
}

export async function removePhoto(req, res) {
  const user = await profileService.removeProfilePhoto(req.user.id);
  res.json({ user });
}
