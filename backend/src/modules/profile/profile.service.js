// ============================================
// Profile Service
// ============================================
// Atualização do recado pessoal e da foto de perfil (armazenada
// no bucket S3-compatible, com chave fixa por usuário para que
// o upload de uma nova foto sobrescreva a anterior automaticamente).

import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET } from '../../config/s3.js';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';
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

function buildFileUrl(storageKey) {
  if (env.s3.publicBaseUrl) {
    return `${env.s3.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
  }
  // Fallback: URL direta ao endpoint S3 (funciona com bucket público em MinIO/R2)
  return `${env.s3.endpoint}/${S3_BUCKET}/${storageKey}`;
}

export async function updateProfileMessage(userId, profileMessage) {
  const result = await query(
    'UPDATE users SET profile_message = $1 WHERE id = $2 RETURNING *',
    [profileMessage, userId]
  );
  if (result.rowCount === 0) {
    throw notFound('Usuário não encontrado.');
  }

  const user = toUserDTO(result.rows[0]);
  emitEvent('user:updated', user);
  return user;
}

export async function uploadProfilePhoto(userId, file) {
  const storageKey = `profile-photos/${userId}/profile`;

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: storageKey,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  const photoUrl = buildFileUrl(storageKey);
  const result = await query(
    'UPDATE users SET photo_url = $1 WHERE id = $2 RETURNING *',
    [photoUrl, userId]
  );
  if (result.rowCount === 0) {
    throw notFound('Usuário não encontrado.');
  }

  const user = toUserDTO(result.rows[0]);
  emitEvent('user:updated', user);
  return user;
}

export async function removeProfilePhoto(userId) {
  const storageKey = `profile-photos/${userId}/profile`;

  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: storageKey }));
  } catch (error) {
    console.error('Não foi possível remover a foto anterior do storage:', error.message);
  }

  const result = await query(
    'UPDATE users SET photo_url = NULL WHERE id = $1 RETURNING *',
    [userId]
  );
  if (result.rowCount === 0) {
    throw notFound('Usuário não encontrado.');
  }

  const user = toUserDTO(result.rows[0]);
  emitEvent('user:updated', user);
  return user;
}
