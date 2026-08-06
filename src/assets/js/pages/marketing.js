// ============================================
// Módulo Marketing - Cybhor Tech Portal v2
// ============================================
// Gestão de campanhas e calendário de conteúdo,
// com resumo de orçamento e status em tempo real.

import { api } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import { initPortalShell } from "../shared/portal-shell.js";
import {
  escapeHTML,
  formatCurrencyBRL,
  parseCurrencyToCents,
  formatDateBR,
  dateInputToEpoch,
  epochToDateInput
} from "../shared/utils.js";

const CAMPAIGN_STATUS = {
  planned: { label: 'Planejada', badge: 'badge-neutral' },
  active: { label: 'Ativa', badge: 'badge-success' },
  paused: { label: 'Pausada', badge: 'badge-warning' },
  finished: { label: 'Concluída', badge: 'badge-info' }
};

const POST_STATUS = {
  draft: { label: 'Rascunho', badge: 'badge-neutral' },
  scheduled: { label: 'Agendado', badge: 'badge-warning' },
  published: { label: 'Publicado', badge: 'badge-success' }
};

let currentUser = null;
let campaigns = {};
let posts = {};

const campaignForm = document.getElementById('campaign-form');
const postForm = document.getElementById('post-form');
let campaignModal = null;
let postModal = null;

initPortalShell({
  active: 'marketing',
  onUserReady: (user) => {
    currentUser = user;
    applyPermissions();
    startRealtimeSync();
  }
});

campaignModal = new bootstrap.Modal(document.getElementById('campaignModal'));
postModal = new bootstrap.Modal(document.getElementById('postModal'));

document.getElementById('btn-add-campaign').addEventListener('click', () => {
  campaignForm.reset();
  document.getElementById('campaign-id').value = '';
  document.getElementById('campaign-start').value = epochToDateInput(Date.now());
  document.getElementById('campaignModalLabel').textContent = 'Nova Campanha';
});

document.getElementById('btn-add-post').addEventListener('click', () => {
  postForm.reset();
  document.getElementById('post-id').value = '';
  document.getElementById('post-date').value = epochToDateInput(Date.now());
  document.getElementById('postModalLabel').textContent = 'Novo Conteúdo';
});

document.getElementById('filter-campaign-status').addEventListener('change', renderCampaigns);
document.getElementById('filter-post-status').addEventListener('change', renderPosts);

campaignForm.addEventListener('submit', handleCampaignSubmit);
postForm.addEventListener('submit', handlePostSubmit);

function applyPermissions() {
  if (currentUser && currentUser.role === 'Visualizador') {
    document.getElementById('btn-add-campaign').classList.add('d-none');
    document.getElementById('btn-add-post').classList.add('d-none');
  }
}

function arrayToMap(list) {
  const map = {};
  list.forEach(item => { map[item.id] = item; });
  return map;
}

async function startRealtimeSync() {
  try {
    const [{ campaigns: campaignList }, { posts: postList }] = await Promise.all([
      api.get('/marketing/campaigns'),
      api.get('/marketing/posts')
    ]);
    campaigns = arrayToMap(campaignList);
    posts = arrayToMap(postList);
    renderCampaigns();
    renderPosts();
    renderSummary();
  } catch (error) {
    console.error('Erro ao carregar dados de marketing:', error);
  }

  const socket = getSocket();

  socket.on('campaign:created', (c) => { campaigns[c.id] = c; renderCampaigns(); renderSummary(); });
  socket.on('campaign:updated', (c) => { campaigns[c.id] = c; renderCampaigns(); renderSummary(); });
  socket.on('campaign:deleted', ({ id }) => { delete campaigns[id]; renderCampaigns(); renderSummary(); });

  socket.on('post:created', (p) => { posts[p.id] = p; renderPosts(); renderSummary(); });
  socket.on('post:updated', (p) => { posts[p.id] = p; renderPosts(); renderSummary(); });
  socket.on('post:deleted', ({ id }) => { delete posts[id]; renderPosts(); renderSummary(); });
}

function renderSummary() {
  const campaignList = Object.values(campaigns);
  const postList = Object.values(posts);

  const activeCampaigns = campaignList.filter(c => c.status === 'active');
  const activeBudget = activeCampaigns.reduce((sum, c) => sum + (c.budgetCents || 0), 0);

  document.getElementById('stat-active-campaigns').textContent = activeCampaigns.length;
  document.getElementById('stat-campaign-budget').textContent = formatCurrencyBRL(activeBudget);
  document.getElementById('stat-scheduled-posts').textContent = postList.filter(p => p.status === 'scheduled').length;
  document.getElementById('stat-published-posts').textContent = postList.filter(p => p.status === 'published').length;
}

function canManageItem(item) {
  if (!currentUser || currentUser.role === 'Visualizador' || currentUser.role === 'Rh') return false;
  return currentUser.role === 'Admin' || item.createdBy === currentUser.uid;
}

/* ==========================================
   CAMPANHAS
   ========================================== */

function renderCampaigns() {
  const container = document.getElementById('campaigns-list');
  const statusFilter = document.getElementById('filter-campaign-status').value;

  const list = Object.entries(campaigns)
    .map(([id, c]) => ({ id, ...c }))
    .filter(c => !statusFilter || c.status === statusFilter)
    .sort((a, b) => b.startDate - a.startDate);

  container.innerHTML = '';
  document.getElementById('campaigns-empty').classList.toggle('d-none', list.length > 0);

  list.forEach(c => {
    const status = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.planned;
    const canManage = canManageItem(c);

    const card = document.createElement('div');
    card.className = 'module-item-card';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="flex-grow-1 min-width-0">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span class="badge ${status.badge}">${status.label}</span>
            <span class="badge badge-neutral">${escapeHTML(c.channel)}</span>
          </div>
          <h6 class="mb-1">${escapeHTML(c.name)}</h6>
          ${c.goal ? `<p class="text-muted small mb-2">${escapeHTML(c.goal)}</p>` : ''}
          <div class="d-flex gap-3 flex-wrap small text-muted">
            <span><i data-lucide="coins" style="width: 13px;"></i> ${formatCurrencyBRL(c.budgetCents || 0)}</span>
            <span><i data-lucide="calendar" style="width: 13px;"></i> ${formatDateBR(c.startDate)}${c.endDate ? ' até ' + formatDateBR(c.endDate) : ''}</span>
          </div>
        </div>
        ${canManage ? `
          <div class="text-nowrap">
            <button class="btn btn-sm btn-link text-info p-1 edit-campaign-btn" data-id="${c.id}" title="Editar"><i data-lucide="pencil" style="width: 15px;"></i></button>
            <button class="btn btn-sm btn-link text-danger p-1 delete-campaign-btn" data-id="${c.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.edit-campaign-btn').forEach(btn => {
    btn.addEventListener('click', () => editCampaign(btn.dataset.id));
  });
  container.querySelectorAll('.delete-campaign-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCampaign(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

function editCampaign(id) {
  const c = campaigns[id];
  if (!c) return;

  document.getElementById('campaign-id').value = id;
  document.getElementById('campaign-name').value = c.name;
  document.getElementById('campaign-channel').value = c.channel;
  document.getElementById('campaign-status').value = c.status;
  document.getElementById('campaign-budget').value = c.budgetCents ? (c.budgetCents / 100).toFixed(2).replace('.', ',') : '';
  document.getElementById('campaign-start').value = epochToDateInput(c.startDate);
  document.getElementById('campaign-end').value = c.endDate ? epochToDateInput(c.endDate) : '';
  document.getElementById('campaign-goal').value = c.goal || '';
  document.getElementById('campaignModalLabel').textContent = 'Editar Campanha';
  campaignModal.show();
}

async function handleCampaignSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = document.getElementById('campaign-id').value;
  const startDate = dateInputToEpoch(document.getElementById('campaign-start').value);
  const endDateValue = document.getElementById('campaign-end').value;
  const budgetText = document.getElementById('campaign-budget').value.trim();
  const budgetCents = budgetText ? parseCurrencyToCents(budgetText) : 0;

  if (budgetCents === null) {
    alert('Informe um orçamento válido ou deixe em branco.');
    return;
  }

  const payload = {
    name: document.getElementById('campaign-name').value.trim(),
    channel: document.getElementById('campaign-channel').value,
    status: document.getElementById('campaign-status').value,
    budgetCents: budgetCents || 0,
    startDate,
    endDate: endDateValue ? dateInputToEpoch(endDateValue) : null,
    goal: document.getElementById('campaign-goal').value.trim()
  };

  try {
    if (id) {
      await api.patch(`/marketing/campaigns/${id}`, payload);
    } else {
      await api.post('/marketing/campaigns', payload);
    }
    campaignModal.hide();
    campaignForm.reset();
  } catch (error) {
    console.error('Erro ao salvar campanha:', error);
    alert('Erro ao salvar campanha: permissão negada.');
  }
}

async function deleteCampaign(id) {
  if (!confirm('Deseja realmente excluir esta campanha?')) return;
  try {
    await api.delete(`/marketing/campaigns/${id}`);
  } catch (error) {
    console.error('Erro ao excluir campanha:', error);
    alert('Erro ao excluir campanha: permissão negada.');
  }
}

/* ==========================================
   CALENDÁRIO DE CONTEÚDO
   ========================================== */

function renderPosts() {
  const container = document.getElementById('posts-list');
  const statusFilter = document.getElementById('filter-post-status').value;

  const list = Object.entries(posts)
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => !statusFilter || p.status === statusFilter)
    .sort((a, b) => a.date - b.date);

  container.innerHTML = '';
  document.getElementById('posts-empty').classList.toggle('d-none', list.length > 0);

  list.forEach(p => {
    const status = POST_STATUS[p.status] || POST_STATUS.draft;
    const canManage = canManageItem(p);

    const item = document.createElement('div');
    item.className = 'module-item-card module-item-compact';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center gap-2">
        <div class="d-flex align-items-center gap-3 flex-grow-1 min-width-0">
          <div class="post-date-box">
            <div class="post-date-day">${new Date(p.date).getDate()}</div>
            <div class="post-date-month">${new Date(p.date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
          </div>
          <div class="min-width-0">
            <div class="fw-bold text-truncate">${escapeHTML(p.title)}</div>
            <div class="d-flex gap-2 align-items-center flex-wrap">
              <span class="badge ${status.badge}">${status.label}</span>
              <span class="badge badge-neutral">${escapeHTML(p.channel)}</span>
            </div>
            ${p.notes ? `<div class="text-muted small text-truncate mt-1">${escapeHTML(p.notes)}</div>` : ''}
          </div>
        </div>
        ${canManage ? `
          <div class="text-nowrap">
            <button class="btn btn-sm btn-link text-info p-1 edit-post-btn" data-id="${p.id}" title="Editar"><i data-lucide="pencil" style="width: 15px;"></i></button>
            <button class="btn btn-sm btn-link text-danger p-1 delete-post-btn" data-id="${p.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', () => editPost(btn.dataset.id));
  });
  container.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePost(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

function editPost(id) {
  const p = posts[id];
  if (!p) return;

  document.getElementById('post-id').value = id;
  document.getElementById('post-title').value = p.title;
  document.getElementById('post-channel').value = p.channel;
  document.getElementById('post-date').value = epochToDateInput(p.date);
  document.getElementById('post-status').value = p.status;
  document.getElementById('post-notes').value = p.notes || '';
  document.getElementById('postModalLabel').textContent = 'Editar Conteúdo';
  postModal.show();
}

async function handlePostSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = document.getElementById('post-id').value;
  const payload = {
    title: document.getElementById('post-title').value.trim(),
    channel: document.getElementById('post-channel').value,
    date: dateInputToEpoch(document.getElementById('post-date').value),
    status: document.getElementById('post-status').value,
    notes: document.getElementById('post-notes').value.trim()
  };

  try {
    if (id) {
      await api.patch(`/marketing/posts/${id}`, payload);
    } else {
      await api.post('/marketing/posts', payload);
    }
    postModal.hide();
    postForm.reset();
  } catch (error) {
    console.error('Erro ao salvar conteúdo:', error);
    alert('Erro ao salvar conteúdo: permissão negada.');
  }
}

async function deletePost(id) {
  if (!confirm('Deseja realmente excluir este conteúdo?')) return;
  try {
    await api.delete(`/marketing/posts/${id}`);
  } catch (error) {
    console.error('Erro ao excluir conteúdo:', error);
    alert('Erro ao excluir conteúdo: permissão negada.');
  }
}
