// ============================================
// Attachments Service
// ============================================
// Upload de anexos de tarefas para storage S3-compatible.
// Se S3_PUBLIC_BASE_URL não estiver configurada (bucket privado),
// gera URLs assinadas temporárias (1 hora) para leitura.

import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from '../../config/s3.js';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { forbidden, notFound, badRequest } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRES_SECONDS = 3600;

async function buildFileUrl(storageKey) {
  if (env.s3.publicBaseUrl) {
    return `${env.s3.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
  }
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: storageKey });
  return getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRES_SECONDS });
}

async function toAttachmentDTO(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.file_name,
    url: await buildFileUrl(row.storage_key),
    type: row.mime_type,
    path: row.storage_key,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: new Date(row.created_at).getTime()
  };
}

export async function listAttachments(taskId) {
  const result = await query(
    'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at ASC',
    [taskId]
  );
  return Promise.all(result.rows.map(toAttachmentDTO));
}

export async function uploadAttachment(taskId, file, uploadedBy, uploadedByName) {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw badRequest('O arquivo não pode exceder o tamanho máximo de 10MB.');
  }

  const storageKey = `task-attachments/${taskId}/${Date.now()}_${file.originalname}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: storageKey,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  const result = await query(
    `INSERT INTO task_attachments (task_id, file_name, storage_key, mime_type, size_bytes, uploaded_by, uploaded_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [taskId, file.originalname, storageKey, file.mimetype, file.size, uploadedBy, uploadedByName]
  );

  const attachment = await toAttachmentDTO(result.rows[0]);
  emitEvent('taskAttachment:created', attachment);
  return attachment;
}

export async function deleteAttachment(attachmentId, user) {
  const result = await query('SELECT * FROM task_attachments WHERE id = $1', [attachmentId]);
  if (result.rowCount === 0) {
    throw notFound('Anexo não encontrado.');
  }

  const attachment = result.rows[0];
  const isOwner = attachment.uploaded_by === user.id;
  if (user.role !== 'Admin' && !isOwner) {
    throw forbidden();
  }

  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: attachment.storage_key }));
  } catch (error) {
    console.error('Erro ao remover arquivo do storage:', error.message);
  }

  await query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);
  emitEvent('taskAttachment:deleted', { id: attachmentId, taskId: attachment.task_id });
}
