// ============================================
// Users Service
// ============================================
// Gestão de usuários: listagem para dropdowns/chat, criação
// direta por Admin e alteração de cargo (substitui o painel
// admin.html que antes usava uma instância secundária do Firebase).

import { query, withTransaction } from '../../config/db.js';
import { hashPassword } from '../../utils/password.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toUserDTO(row) {
  return {
    uid: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    profileMessage: row.profile_message,
    profileCreatedAt: new Date(row.created_at).getTime(),
    photoURL: row.photo_url || null
  };
}

export async function listUsers() {
  const result = await query('SELECT * FROM users ORDER BY name ASC');
  return result.rows.map(toUserDTO);
}

export async function createUser({ name, email, password, role }) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw badRequest('Este e-mail já está cadastrado.');
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, passwordHash, role]
  );

  const user = toUserDTO(result.rows[0]);
  emitEvent('user:created', user);
  return user;
}

export async function updateUserRole(userId, role) {
  const result = await query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
    [role, userId]
  );
  if (result.rowCount === 0) {
    throw notFound('Usuário não encontrado.');
  }

  const user = toUserDTO(result.rows[0]);
  emitEvent('user:updated', user);
  return user;
}

/**
 * Remove um usuário e limpa referências em tarefas e votos de ideias,
 * espelhando a limpeza em lote que o admin.html fazia no Firebase.
 */
export async function deleteUser(userId) {
  await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (existing.rowCount === 0) {
      throw notFound('Usuário não encontrado.');
    }

    await client.query('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = $1', [userId]);
    await client.query('UPDATE tasks SET creator_id = NULL WHERE creator_id = $1', [userId]);
    await client.query('DELETE FROM idea_votes WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  emitEvent('user:deleted', { uid: userId });
}
