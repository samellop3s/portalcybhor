// ============================================
// Chat Service (Etapas e Tarefas)
// ============================================
// Qualquer usuário autenticado pode ler e enviar mensagens,
// mesmo comportamento das regras originais do Firebase.

import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toMessageDTO(row, foreignKeyField, foreignKeyValue) {
  return {
    id: row.id,
    [foreignKeyField]: foreignKeyValue,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    timestamp: new Date(row.created_at).getTime()
  };
}

export async function listStageMessages(stageId) {
  const stageExists = await query('SELECT id FROM stages WHERE id = $1', [stageId]);
  if (stageExists.rowCount === 0) {
    throw notFound('Etapa não encontrada.');
  }

  const result = await query(
    'SELECT * FROM stage_chat_messages WHERE stage_id = $1 ORDER BY created_at ASC',
    [stageId]
  );
  return result.rows.map(row => toMessageDTO(row, 'stageId', stageId));
}

export async function createStageMessage(stageId, senderId, senderName, text) {
  const result = await query(
    `INSERT INTO stage_chat_messages (stage_id, sender_id, sender_name, text)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [stageId, senderId, senderName, text]
  );
  const message = toMessageDTO(result.rows[0], 'stageId', stageId);
  emitEvent('stageChatMessage:created', message);
  return message;
}

export async function listTaskMessages(taskId) {
  const taskExists = await query('SELECT id FROM tasks WHERE id = $1', [taskId]);
  if (taskExists.rowCount === 0) {
    throw notFound('Tarefa não encontrada.');
  }

  const result = await query(
    'SELECT * FROM task_chat_messages WHERE task_id = $1 ORDER BY created_at ASC',
    [taskId]
  );
  return result.rows.map(row => toMessageDTO(row, 'taskId', taskId));
}

export async function createTaskMessage(taskId, senderId, senderName, text) {
  const result = await query(
    `INSERT INTO task_chat_messages (task_id, sender_id, sender_name, text)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [taskId, senderId, senderName, text]
  );
  const message = toMessageDTO(result.rows[0], 'taskId', taskId);
  emitEvent('taskChatMessage:created', message);
  return message;
}
