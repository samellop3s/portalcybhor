// ============================================
// Ideas Service
// ============================================

import { query, withTransaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toIdeaDTO(row, votes = {}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    authorId: row.author_id,
    authorName: row.author_name,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    votes
  };
}

async function loadVotesByIdea(ideaIds) {
  if (ideaIds.length === 0) return {};
  const result = await query(
    `SELECT idea_id, user_id, vote FROM idea_votes WHERE idea_id = ANY($1::uuid[])`,
    [ideaIds]
  );

  const votesByIdea = {};
  result.rows.forEach(row => {
    if (!votesByIdea[row.idea_id]) votesByIdea[row.idea_id] = {};
    votesByIdea[row.idea_id][row.user_id] = row.vote;
  });
  return votesByIdea;
}

export async function listIdeas() {
  const result = await query('SELECT * FROM ideas ORDER BY created_at DESC');
  const votesByIdea = await loadVotesByIdea(result.rows.map(r => r.id));
  return result.rows.map(row => toIdeaDTO(row, votesByIdea[row.id] || {}));
}

export async function createIdea({ title, description, authorId, authorName }) {
  const result = await query(
    `INSERT INTO ideas (title, description, author_id, author_name, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [title, description, authorId, authorName]
  );
  const idea = toIdeaDTO(result.rows[0]);
  emitEvent('idea:created', idea);
  return idea;
}

export async function discardIdea(ideaId) {
  const result = await query(
    "UPDATE ideas SET status = 'discarded' WHERE id = $1 RETURNING *",
    [ideaId]
  );
  if (result.rowCount === 0) {
    throw notFound('Ideia não encontrada.');
  }
  const votesByIdea = await loadVotesByIdea([ideaId]);
  const idea = toIdeaDTO(result.rows[0], votesByIdea[ideaId] || {});
  emitEvent('idea:updated', idea);
  return idea;
}

/**
 * Registra, altera ou remove o voto de um usuário em uma ideia.
 * @param {string|null} vote - true (sim), false (não) ou null (remover voto)
 */
export async function voteOnIdea(ideaId, userId, vote) {
  const ideaExists = await query('SELECT id FROM ideas WHERE id = $1', [ideaId]);
  if (ideaExists.rowCount === 0) {
    throw notFound('Ideia não encontrada.');
  }

  if (vote === null) {
    await query('DELETE FROM idea_votes WHERE idea_id = $1 AND user_id = $2', [ideaId, userId]);
  } else {
    await query(
      `INSERT INTO idea_votes (idea_id, user_id, vote) VALUES ($1, $2, $3)
       ON CONFLICT (idea_id, user_id) DO UPDATE SET vote = EXCLUDED.vote`,
      [ideaId, userId, vote]
    );
  }

  const ideaResult = await query('SELECT * FROM ideas WHERE id = $1', [ideaId]);
  const votesByIdea = await loadVotesByIdea([ideaId]);
  const idea = toIdeaDTO(ideaResult.rows[0], votesByIdea[ideaId] || {});
  emitEvent('idea:updated', idea);
  return idea;
}

/**
 * Transforma uma ideia aprovada em uma nova tarefa no Kanban,
 * marcando a ideia original como "approved" na mesma transação.
 */
export async function promoteIdeaToTask(ideaId, { stageId, priority, assigneeId }) {
  return withTransaction(async (client) => {
    const ideaResult = await client.query('SELECT * FROM ideas WHERE id = $1', [ideaId]);
    if (ideaResult.rowCount === 0) {
      throw notFound('Ideia não encontrada.');
    }
    const idea = ideaResult.rows[0];

    const stageResult = await client.query('SELECT id FROM stages WHERE id = $1', [stageId]);
    if (stageResult.rowCount === 0) {
      throw badRequest('Etapa de destino inválida.');
    }

    const taskResult = await client.query(
      `INSERT INTO tasks (stage_id, title, description, priority, assignee_id, creator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [stageId, `[IDEIA] ${idea.title}`, idea.description, priority, assigneeId || null, idea.author_id]
    );

    const updatedIdeaResult = await client.query(
      "UPDATE ideas SET status = 'approved' WHERE id = $1 RETURNING *",
      [ideaId]
    );

    const task = taskResult.rows[0];
    const updatedIdea = updatedIdeaResult.rows[0];

    emitEvent('task:created', {
      id: task.id,
      stageId: task.stage_id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assigneeId: task.assignee_id,
      creatorId: task.creator_id,
      createdAt: new Date(task.created_at).getTime(),
      scheduledAt: new Date(task.scheduled_at).getTime(),
      completedAt: null,
      completedBy: null
    });
    emitEvent('idea:updated', toIdeaDTO(updatedIdea));

    return { idea: toIdeaDTO(updatedIdea) };
  });
}
