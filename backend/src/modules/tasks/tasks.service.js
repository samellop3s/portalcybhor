// ============================================
// Tasks Service
// ============================================

import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toTaskDTO(row) {
  return {
    id: row.id,
    stageId: row.stage_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assigneeId: row.assignee_id,
    creatorId: row.creator_id,
    createdAt: new Date(row.created_at).getTime(),
    scheduledAt: new Date(row.scheduled_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    completedBy: row.completed_by
  };
}

export async function listTasks() {
  const result = await query('SELECT * FROM tasks ORDER BY created_at DESC');
  return result.rows.map(toTaskDTO);
}

export async function createTask({ title, description, priority, assigneeId, stageId, creatorId }) {
  const result = await query(
    `INSERT INTO tasks (stage_id, title, description, priority, assignee_id, creator_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [stageId, title, description, priority, assigneeId || null, creatorId]
  );
  const task = toTaskDTO(result.rows[0]);
  emitEvent('task:created', task);
  return task;
}

async function updateTaskFields(taskId, fields) {
  const columns = [];
  const values = [];
  let index = 1;

  for (const [column, value] of Object.entries(fields)) {
    columns.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  }
  values.push(taskId);

  const result = await query(
    `UPDATE tasks SET ${columns.join(', ')} WHERE id = $${index} RETURNING *`,
    values
  );
  if (result.rowCount === 0) {
    throw notFound('Tarefa não encontrada.');
  }

  const task = toTaskDTO(result.rows[0]);
  emitEvent('task:updated', task);
  return task;
}

export function moveTaskToStage(taskId, stageId) {
  return updateTaskFields(taskId, { stage_id: stageId });
}

export function updateTaskStatus(taskId, status, completedBy) {
  const fields = { status };
  if (status === 'done' || status === 'failed') {
    fields.completed_at = new Date();
    fields.completed_by = completedBy;
  } else {
    fields.completed_at = null;
    fields.completed_by = null;
  }
  return updateTaskFields(taskId, fields);
}

export async function deleteTask(taskId) {
  const result = await query('DELETE FROM tasks WHERE id = $1', [taskId]);
  if (result.rowCount === 0) {
    throw notFound('Tarefa não encontrada.');
  }
  emitEvent('task:deleted', { id: taskId });
}
