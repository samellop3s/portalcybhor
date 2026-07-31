// ============================================
// Finance Service
// ============================================

import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toTransactionDTO(row) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    category: row.category,
    amountCents: Number(row.amount_cents),
    date: new Date(row.occurred_at).getTime(),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).getTime()
  };
}

export async function listTransactions() {
  const result = await query('SELECT * FROM finance_transactions ORDER BY occurred_at DESC');
  return result.rows.map(toTransactionDTO);
}

export async function createTransaction({ type, description, category, amountCents, date, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO finance_transactions (type, description, category, amount_cents, occurred_at, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7)
     RETURNING *`,
    [type, description, category, amountCents, date, createdBy, createdByName]
  );
  const transaction = toTransactionDTO(result.rows[0]);
  emitEvent('financeTx:created', transaction);
  return transaction;
}

async function assertCanManage(txId, user) {
  const result = await query('SELECT created_by FROM finance_transactions WHERE id = $1', [txId]);
  if (result.rowCount === 0) {
    throw notFound('Lançamento não encontrado.');
  }
  const isOwner = result.rows[0].created_by === user.id;
  if (user.role !== 'Admin' && !isOwner) {
    throw forbidden();
  }
}

export async function updateTransaction(txId, user, { type, description, category, amountCents, date }) {
  await assertCanManage(txId, user);

  const result = await query(
    `UPDATE finance_transactions
     SET type = $1, description = $2, category = $3, amount_cents = $4, occurred_at = to_timestamp($5 / 1000.0)
     WHERE id = $6
     RETURNING *`,
    [type, description, category, amountCents, date, txId]
  );
  const transaction = toTransactionDTO(result.rows[0]);
  emitEvent('financeTx:updated', transaction);
  return transaction;
}

export async function deleteTransaction(txId, user) {
  await assertCanManage(txId, user);
  await query('DELETE FROM finance_transactions WHERE id = $1', [txId]);
  emitEvent('financeTx:deleted', { id: txId });
}
