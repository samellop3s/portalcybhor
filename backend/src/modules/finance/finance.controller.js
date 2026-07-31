// ============================================
// Finance Controller
// ============================================

import * as financeService from './finance.service.js';
import * as usersService from '../users/users.service.js';

export async function list(req, res) {
  const transactions = await financeService.listTransactions();
  res.json({ transactions });
}

export async function create(req, res) {
  const users = await usersService.listUsers();
  const author = users.find(u => u.uid === req.user.id);
  const transaction = await financeService.createTransaction({
    ...req.body,
    createdBy: req.user.id,
    createdByName: author ? author.name : 'Usuário Cybhor'
  });
  res.status(201).json({ transaction });
}

export async function update(req, res) {
  const transaction = await financeService.updateTransaction(req.params.id, req.user, req.body);
  res.json({ transaction });
}

export async function remove(req, res) {
  await financeService.deleteTransaction(req.params.id, req.user);
  res.status(204).send();
}
