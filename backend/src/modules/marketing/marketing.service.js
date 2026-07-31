// ============================================
// Marketing Service
// ============================================

import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { emitEvent } from '../../sockets/io.js';

function toCampaignDTO(row) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    budgetCents: Number(row.budget_cents),
    startDate: new Date(row.start_date).getTime(),
    endDate: row.end_date ? new Date(row.end_date).getTime() : null,
    goal: row.goal,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).getTime()
  };
}

function toPostDTO(row) {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    date: new Date(row.post_date).getTime(),
    status: row.status,
    notes: row.notes,
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

/* --------- Campanhas --------- */

export async function listCampaigns() {
  const result = await query('SELECT * FROM marketing_campaigns ORDER BY start_date DESC');
  return result.rows.map(toCampaignDTO);
}

export async function createCampaign({ name, channel, status, budgetCents, startDate, endDate, goal, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO marketing_campaigns (name, channel, status, budget_cents, start_date, end_date, goal, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, $9)
     RETURNING *`,
    [name, channel, status, budgetCents, startDate, endDate ? new Date(endDate) : null, goal, createdBy, createdByName]
  );
  const campaign = toCampaignDTO(result.rows[0]);
  emitEvent('campaign:created', campaign);
  return campaign;
}

export async function updateCampaign(id, user, { name, channel, status, budgetCents, startDate, endDate, goal }) {
  await assertCanManage('marketing_campaigns', id, user);
  const result = await query(
    `UPDATE marketing_campaigns
     SET name = $1, channel = $2, status = $3, budget_cents = $4, start_date = to_timestamp($5 / 1000.0), end_date = $6, goal = $7
     WHERE id = $8
     RETURNING *`,
    [name, channel, status, budgetCents, startDate, endDate ? new Date(endDate) : null, goal, id]
  );
  const campaign = toCampaignDTO(result.rows[0]);
  emitEvent('campaign:updated', campaign);
  return campaign;
}

export async function deleteCampaign(id, user) {
  await assertCanManage('marketing_campaigns', id, user);
  await query('DELETE FROM marketing_campaigns WHERE id = $1', [id]);
  emitEvent('campaign:deleted', { id });
}

/* --------- Posts (Calendário de Conteúdo) --------- */

export async function listPosts() {
  const result = await query('SELECT * FROM marketing_posts ORDER BY post_date ASC');
  return result.rows.map(toPostDTO);
}

export async function createPost({ title, channel, date, status, notes, createdBy, createdByName }) {
  const result = await query(
    `INSERT INTO marketing_posts (title, channel, post_date, status, notes, created_by, created_by_name)
     VALUES ($1, $2, to_timestamp($3 / 1000.0), $4, $5, $6, $7)
     RETURNING *`,
    [title, channel, date, status, notes, createdBy, createdByName]
  );
  const post = toPostDTO(result.rows[0]);
  emitEvent('post:created', post);
  return post;
}

export async function updatePost(id, user, { title, channel, date, status, notes }) {
  await assertCanManage('marketing_posts', id, user);
  const result = await query(
    `UPDATE marketing_posts
     SET title = $1, channel = $2, post_date = to_timestamp($3 / 1000.0), status = $4, notes = $5
     WHERE id = $6
     RETURNING *`,
    [title, channel, date, status, notes, id]
  );
  const post = toPostDTO(result.rows[0]);
  emitEvent('post:updated', post);
  return post;
}

export async function deletePost(id, user) {
  await assertCanManage('marketing_posts', id, user);
  await query('DELETE FROM marketing_posts WHERE id = $1', [id]);
  emitEvent('post:deleted', { id });
}
