// ============================================
// Upload Middleware Factory (Multer)
// ============================================
// Cria middlewares de upload em memória (buffer) com limite de
// tamanho e whitelist de tipos MIME, replicando as validações
// que antes viviam em storage.rules do Firebase Storage.

import multer from 'multer';
import { badRequest } from './httpError.js';

/**
 * @param {{ maxSizeBytes: number, allowedMimeTypes: string[] }} options
 */
export function createUploadMiddleware({ maxSizeBytes, allowedMimeTypes }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeBytes },
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.some(pattern => pattern.test(file.mimetype))) {
        return cb(badRequest('Tipo de arquivo não permitido.'));
      }
      cb(null, true);
    }
  });
}

export const IMAGE_MIME_TYPES = [/^image\//];

export const ATTACHMENT_MIME_TYPES = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/zip$/,
  /^application\/x-zip-compressed$/,
  /^text\/plain$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./
];
