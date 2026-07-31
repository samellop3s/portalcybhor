// ============================================
// PostgreSQL Connection Pool
// ============================================
// Pool único compartilhado por toda a aplicação.
// Todas as consultas usam parâmetros posicionados ($1, $2...)
// via node-postgres, que atuam como prepared statements e
// eliminam o risco de SQL Injection.

import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : false
});

/**
 * Executa uma query parametrizada no PostgreSQL.
 * @param {string} text - SQL com placeholders $1, $2...
 * @param {Array} params - Valores dos placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Executa uma função dentro de uma transação (BEGIN/COMMIT/ROLLBACK).
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
