// ============================================
// Migration Runner
// ============================================
// Aplica o schema.sql no banco configurado em DATABASE_URL.
// Uso: npm run migrate

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = join(__dirname, 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf-8');

  console.log('Aplicando schema.sql no banco de dados...');
  await pool.query(schemaSql);
  console.log('Migração concluída com sucesso.');
  await pool.end();
}

migrate().catch((error) => {
  console.error('Falha ao migrar o banco de dados:', error);
  process.exit(1);
});
