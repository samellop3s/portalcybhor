// ============================================
// Ideas Controller
// ============================================

import * as ideasService from './ideas.service.js';
import * as usersService from '../users/users.service.js';

export async function list(req, res) {
  const ideas = await ideasService.listIdeas();
  res.json({ ideas });
}

export async function create(req, res) {
  const users = await usersService.listUsers();
  const author = users.find(u => u.uid === req.user.id);
  const idea = await ideasService.createIdea({
    ...req.body,
    authorId: req.user.id,
    authorName: author ? author.name : 'Usuário Cybhor'
  });
  res.status(201).json({ idea });
}

export async function discard(req, res) {
  const idea = await ideasService.discardIdea(req.params.id);
  res.json({ idea });
}

export async function vote(req, res) {
  const idea = await ideasService.voteOnIdea(req.params.id, req.user.id, req.body.vote);
  res.json({ idea });
}

export async function promote(req, res) {
  const result = await ideasService.promoteIdeaToTask(req.params.id, req.body);
  res.json(result);
}
