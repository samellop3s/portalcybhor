// ============================================
// DevHub Controller
// ============================================

import * as devhubService from './devhub.service.js';
import * as usersService from '../users/users.service.js';

async function getAuthorName(userId) {
  const users = await usersService.listUsers();
  const author = users.find(u => u.uid === userId);
  return author ? author.name : 'Usuário Cybhor';
}

export async function listBugs(req, res) {
  res.json({ bugs: await devhubService.listBugs() });
}

export async function createBug(req, res) {
  const createdByName = await getAuthorName(req.user.id);
  const bug = await devhubService.createBug({ ...req.body, createdBy: req.user.id, createdByName });
  res.status(201).json({ bug });
}

export async function updateBug(req, res) {
  const bug = await devhubService.updateBug(req.params.id, req.user, req.body);
  res.json({ bug });
}

export async function updateBugStatus(req, res) {
  const bug = await devhubService.updateBugStatus(req.params.id, req.body.status);
  res.json({ bug });
}

export async function deleteBug(req, res) {
  await devhubService.deleteBug(req.params.id, req.user);
  res.status(204).send();
}

export async function listReleases(req, res) {
  res.json({ releases: await devhubService.listReleases() });
}

export async function createRelease(req, res) {
  const createdByName = await getAuthorName(req.user.id);
  const release = await devhubService.createRelease({ ...req.body, createdBy: req.user.id, createdByName });
  res.status(201).json({ release });
}

export async function updateRelease(req, res) {
  const release = await devhubService.updateRelease(req.params.id, req.user, req.body);
  res.json({ release });
}

export async function deleteRelease(req, res) {
  await devhubService.deleteRelease(req.params.id, req.user);
  res.status(204).send();
}

export async function listLinks(req, res) {
  res.json({ links: await devhubService.listLinks() });
}

export async function createLink(req, res) {
  const createdByName = await getAuthorName(req.user.id);
  const link = await devhubService.createLink({ ...req.body, createdBy: req.user.id, createdByName });
  res.status(201).json({ link });
}

export async function deleteLink(req, res) {
  await devhubService.deleteLink(req.params.id, req.user);
  res.status(204).send();
}
