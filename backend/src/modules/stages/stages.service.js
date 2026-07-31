// ============================================
// Stages Service
// ============================================

import { query, withTransaction } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toStageDTO(row) {
  return {
    id: row.id,
    title: row.title,
    order: Number(row.sort_order)
  };
}

export async function listStages() {
  const result = await query('SELECT * FROM stages ORDER BY sort_order ASC');
  return result.rows.map(toStageDTO);
}

export async function createStage(title) {
  const order = Date.now();
  const result = await query(
    'INSERT INTO stages (title, sort_order) VALUES ($1, $2) RETURNING *',
    [title, order]
  );
  const stage = toStageDTO(result.rows[0]);
  emitEvent('stage:created', stage);
  return stage;
}

/**
 * Remove a etapa e todas as tarefas associadas (ON DELETE CASCADE cuida
 * das tarefas, mensagens de chat e anexos ligados a elas).
 */
export async function deleteStage(stageId) {
  await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM stages WHERE id = $1', [stageId]);
    if (existing.rowCount === 0) {
      throw notFound('Etapa não encontrada.');
    }
    await client.query('DELETE FROM stages WHERE id = $1', [stageId]);
  });

  emitEvent('stage:deleted', { id: stageId });
}
