// ============================================
// Tasks Controller
// ============================================

import * as tasksService from './tasks.service.js';

export async function list(req, res) {
  const tasks = await tasksService.listTasks();
  res.json({ tasks });
}

export async function create(req, res) {
  const task = await tasksService.createTask({ ...req.body, creatorId: req.user.id });
  res.status(201).json({ task });
}

export async function move(req, res) {
  const task = await tasksService.moveTaskToStage(req.params.id, req.body.stageId);
  res.json({ task });
}

export async function updateStatus(req, res) {
  const task = await tasksService.updateTaskStatus(req.params.id, req.body.status, req.user.id);
  res.json({ task });
}

export async function remove(req, res) {
  await tasksService.deleteTask(req.params.id);
  res.status(204).send();
}
