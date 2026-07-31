// ============================================
// Marketing Controller
// ============================================

import * as marketingService from './marketing.service.js';
import * as usersService from '../users/users.service.js';

async function getAuthorName(userId) {
  const users = await usersService.listUsers();
  const author = users.find(u => u.uid === userId);
  return author ? author.name : 'Usuário Cybhor';
}

export async function listCampaigns(req, res) {
  const campaigns = await marketingService.listCampaigns();
  res.json({ campaigns });
}

export async function createCampaign(req, res) {
  const createdByName = await getAuthorName(req.user.id);
  const campaign = await marketingService.createCampaign({ ...req.body, createdBy: req.user.id, createdByName });
  res.status(201).json({ campaign });
}

export async function updateCampaign(req, res) {
  const campaign = await marketingService.updateCampaign(req.params.id, req.user, req.body);
  res.json({ campaign });
}

export async function deleteCampaign(req, res) {
  await marketingService.deleteCampaign(req.params.id, req.user);
  res.status(204).send();
}

export async function listPosts(req, res) {
  const posts = await marketingService.listPosts();
  res.json({ posts });
}

export async function createPost(req, res) {
  const createdByName = await getAuthorName(req.user.id);
  const post = await marketingService.createPost({ ...req.body, createdBy: req.user.id, createdByName });
  res.status(201).json({ post });
}

export async function updatePost(req, res) {
  const post = await marketingService.updatePost(req.params.id, req.user, req.body);
  res.json({ post });
}

export async function deletePost(req, res) {
  await marketingService.deletePost(req.params.id, req.user);
  res.status(204).send();
}
