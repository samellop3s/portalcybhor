// ============================================
// S3-Compatible Storage Client
// ============================================
// Funciona com AWS S3, Cloudflare R2 ou MinIO (self-hosted),
// bastando ajustar S3_ENDPOINT no .env.

import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

export const s3Client = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey
  }
});

export const S3_BUCKET = env.s3.bucket;
