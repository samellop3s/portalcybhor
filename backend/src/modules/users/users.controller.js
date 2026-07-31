// ============================================
// Users Controller
// ============================================

import * as usersService from './users.service.js';

export async function list(req, res) {
  const users = await usersService.listUsers();
  res.json({ users });
}

export async function create(req, res) {
  const user = await usersService.createUser(req.body);
  res.status(201).json({ user });
}

export async function updateRole(req, res) {
  const user = await usersService.updateUserRole(req.params.id, req.body.role);
  res.json({ user });
}

export async function remove(req, res) {
  await usersService.deleteUser(req.params.id);
  res.status(204).send();
}
