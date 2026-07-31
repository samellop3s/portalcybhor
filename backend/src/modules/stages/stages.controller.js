// ============================================
// Stages Controller
// ============================================

import * as stagesService from './stages.service.js';

export async function list(req, res) {
  const stages = await stagesService.listStages();
  res.json({ stages });
}

export async function create(req, res) {
  const stage = await stagesService.createStage(req.body.title);
  res.status(201).json({ stage });
}

export async function remove(req, res) {
  await stagesService.deleteStage(req.params.id);
  res.status(204).send();
}
