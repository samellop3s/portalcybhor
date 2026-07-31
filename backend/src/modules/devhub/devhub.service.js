// ============================================
// DevHub Service (Bugs, Releases, Links)
// ============================================

import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toBugDTO(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).getTime()
  };
}

function toReleaseDTO(row) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    notes: row.notes,
    date: new Date(row.release_date).getTime(),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).getTime()
  };
}

function toLinkDTO(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    category: row.category,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).getTime()
  };
}

async function assertCanManage(table, id, user) {
  const result = await query(`SELECT created_by FROM ${table} WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    throw notFound('Registro não encontrado.');
  }
  const isOwner = result.rows[0].created_by === user.id;
  if (user.role !== 'Admin' && !isOwner) {
    throw forbidden();
  }
}

/* --------- Bugs --------- */

export async function listBugs() {
  const result = await query('SELECT * FROM dev_bugs ORDER BY created_at DESC');
  return result.rows.map(toBugDTO);
}

export async function createBug({ title, description, severity, status, assigneeId, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO dev_bugs (title, description, severity, status, assignee_id, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [title, description, severity, status, assigneeId || null, createdBy, createdByName]
  );
  const bug = toBugDTO(result.rows[0]);
  emitEvent('bug:created', bug);
  return bug;
}

export async function updateBug(id, user, { title, description, severity, status, assigneeId }) {
  await assertCanManage('dev_bugs', id, user);
  const result = await query(
    `UPDATE dev_bugs SET title = $1, description = $2, severity = $3, status = $4, assignee_id = $5
     WHERE id = $6 RETURNING *`,
    [title, description, severity, status, assigneeId || null, id]
  );
  const bug = toBugDTO(result.rows[0]);
  emitEvent('bug:updated', bug);
  return bug;
}

export async function updateBugStatus(id, status) {
  const result = await query(
    'UPDATE dev_bugs SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (result.rowCount === 0) {
    throw notFound('Bug não encontrado.');
  }
  const bug = toBugDTO(result.rows[0]);
  emitEvent('bug:updated', bug);
  return bug;
}

export async function deleteBug(id, user) {
  await assertCanManage('dev_bugs', id, user);
  await query('DELETE FROM dev_bugs WHERE id = $1', [id]);
  emitEvent('bug:deleted', { id });
}

/* --------- Releases --------- */

export async function listReleases() {
  const result = await query('SELECT * FROM dev_releases ORDER BY release_date DESC');
  return result.rows.map(toReleaseDTO);
}

export async function createRelease({ version, title, notes, date, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO dev_releases (version, title, notes, release_date, created_by, created_by_name)
     VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5, $6)
     RETURNING *`,
    [version, title, notes, date, createdBy, createdByName]
  );
  const release = toReleaseDTO(result.rows[0]);
  emitEvent('release:created', release);
  return release;
}

export async function updateRelease(id, user, { version, title, notes, date }) {
  await assertCanManage('dev_releases', id, user);
  const result = await query(
    `UPDATE dev_releases SET version = $1, title = $2, notes = $3, release_date = to_timestamp($4 / 1000.0)
     WHERE id = $5 RETURNING *`,
    [version, title, notes, date, id]
  );
  const release = toReleaseDTO(result.rows[0]);
  emitEvent('release:updated', release);
  return release;
}

export async function deleteRelease(id, user) {
  await assertCanManage('dev_releases', id, user);
  await query('DELETE FROM dev_releases WHERE id = $1', [id]);
  emitEvent('release:deleted', { id });
}

/* --------- Links --------- */

export async function listLinks() {
  const result = await query('SELECT * FROM dev_links ORDER BY category ASC, title ASC');
  return result.rows.map(toLinkDTO);
}

export async function createLink({ title, url, category, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO dev_links (title, url, category, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, url, category, createdBy, createdByName]
  );
  const link = toLinkDTO(result.rows[0]);
  emitEvent('link:created', link);
  return link;
}

export async function deleteLink(id, user) {
  await assertCanManage('dev_links', id, user);
  await query('DELETE FROM dev_links WHERE id = $1', [id]);
  emitEvent('link:deleted', { id });
}
