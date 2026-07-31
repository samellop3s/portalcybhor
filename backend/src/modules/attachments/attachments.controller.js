// ============================================
// Attachments Controller
// ============================================

import * as attachmentsService from './attachments.service.js';
import * as usersService from '../users/users.service.js';
import { badRequest } from '../../utils/httpError.js';

export async function list(req, res) {
  const attachments = await attachmentsService.listAttachments(req.params.taskId);
  res.json({ attachments });
}

export async function upload(req, res) {
  if (!req.file) {
    throw badRequest('Nenhum arquivo enviado.');
  }
  const users = await usersService.listUsers();
  const uploader = users.find(u => u.uid === req.user.id);
  const attachment = await attachmentsService.uploadAttachment(
    req.params.taskId,
    req.file,
    req.user.id,
    uploader ? uploader.name : 'Usuário Cybhor'
  );
  res.status(201).json({ attachment });
}

export async function remove(req, res) {
  await attachmentsService.deleteAttachment(req.params.id, req.user);
  res.status(204).send();
}
