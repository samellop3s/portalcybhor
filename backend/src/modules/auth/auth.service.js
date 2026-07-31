// ============================================
// Auth Service
// ============================================
// Regras de negócio de autenticação e cadastro. O endpoint público
// de registro só funciona uma vez, para criar o primeiro Admin do
// sistema (bootstrap). Depois disso, novos membros só podem ser
// cadastrados por um Admin via /api/users — o mesmo comportamento
// do portal original, que não permitia auto-cadastro público.

import { query } from '../../config/db.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signAuthToken } from '../../utils/jwt.js';
import { unauthorized, forbidden } from '../../utils/httpError.js';

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

export async function registerUser({ name, email, password }) {
  const countResult = await query('SELECT COUNT(*)::int AS count FROM users');
  const isFirstUser = countResult.rows[0].count === 0;
  if (!isFirstUser) {
    throw forbidden('O cadastro público está desabilitado. Peça a um administrador para criar sua conta.');
  }

  const passwordHash = await hashPassword(password);
  const insertResult = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'Admin')
     RETURNING *`,
    [name, email, passwordHash]
  );

  const user = toUserDTO(insertResult.rows[0]);
  const token = signAuthToken({ id: user.uid, role: user.role });
  return { user, token };
}

export async function loginUser({ email, password }) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rowCount === 0) {
    throw unauthorized('E-mail ou senha incorretos.');
  }

  const row = result.rows[0];
  const isValidPassword = await comparePassword(password, row.password_hash);
  if (!isValidPassword) {
    throw unauthorized('E-mail ou senha incorretos.');
  }

  const user = toUserDTO(row);
  const token = signAuthToken({ id: user.uid, role: user.role });
  return { user, token };
}

export async function getCurrentUser(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (result.rowCount === 0) {
    throw unauthorized('Usuário não encontrado.');
  }
  return toUserDTO(result.rows[0]);
}
