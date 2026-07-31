// ============================================
// Chat Controller
// ============================================

import * as chatService from './chat.service.js';
import * as usersService from '../users/users.service.js';

async function getSenderName(userId) {
  const users = await usersService.listUsers();
  const sender = users.find(u => u.uid === userId);
  return sender ? sender.name : 'Usuário Cybhor';
}

export async function listStageMessages(req, res) {
  const messages = await chatService.listStageMessages(req.params.stageId);
  res.json({ messages });
}

export async function createStageMessage(req, res) {
  const senderName = await getSenderName(req.user.id);
  const message = await chatService.createStageMessage(req.params.stageId, req.user.id, senderName, req.body.text);
  res.status(201).json({ message });
}

export async function listTaskMessages(req, res) {
  const messages = await chatService.listTaskMessages(req.params.taskId);
  res.json({ messages });
}

export async function createTaskMessage(req, res) {
  const senderName = await getSenderName(req.user.id);
  const message = await chatService.createTaskMessage(req.params.taskId, req.user.id, senderName, req.body.text);
  res.status(201).json({ message });
}
