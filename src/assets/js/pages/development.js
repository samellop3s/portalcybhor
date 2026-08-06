// ============================================
// Módulo Desenvolvimento - Cybhor Tech Portal v2
// ============================================
// Rastreador de bugs, histórico de releases e
// links úteis do projeto, com sincronização em tempo real.

import { api } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import { initPortalShell } from "../shared/portal-shell.js";
import { escapeHTML, getInitials, formatDateBR, dateInputToEpoch, epochToDateInput } from "../shared/utils.js";

const SEVERITY_LABELS = {
  low: { label: 'Baixa', badge: 'badge-neutral' },
  medium: { label: 'Média', badge: 'badge-warning' },
  high: { label: 'Alta', badge: 'badge-danger' },
  critical: { label: 'Crítica', badge: 'badge-danger' }
};

const STATUS_LABELS = {
  open: { label: 'Aberto', badge: 'badge-danger' },
  in_progress: { label: 'Em progresso', badge: 'badge-warning' },
  resolved: { label: 'Resolvido', badge: 'badge-success' },
  closed: { label: 'Fechado', badge: 'badge-neutral' }
};

const LINK_CATEGORY_ICONS = {
  Repositorio: 'git-branch',
  Documentacao: 'book-open',
  Ambiente: 'server',
  Design: 'palette',
  Ferramenta: 'wrench',
  Outro: 'link'
};

let currentUser = null;
let allUsers = {};
let bugs = {};
let releases = {};
let links = {};

const bugForm = document.getElementById('bug-form');
const releaseForm = document.getElementById('release-form');
const linkForm = document.getElementById('link-form');
let bugModal = null;
let releaseModal = null;
let linkModal = null;

initPortalShell({
  active: 'development',
  onUserReady: (user, users) => {
    currentUser = user;
    allUsers = users;
    populateAssigneeDropdown();
    applyPermissions();
    startRealtimeSync();
  }
});

bugModal = new bootstrap.Modal(document.getElementById('bugModal'));
releaseModal = new bootstrap.Modal(document.getElementById('releaseModal'));
linkModal = new bootstrap.Modal(document.getElementById('linkModal'));

document.getElementById('btn-add-bug').addEventListener('click', () => {
  bugForm.reset();
  document.getElementById('bug-id').value = '';
  document.getElementById('bugModalLabel').textContent = 'Reportar Bug';
});

document.getElementById('btn-add-release').addEventListener('click', () => {
  releaseForm.reset();
  document.getElementById('release-id').value = '';
  document.getElementById('release-date').value = epochToDateInput(Date.now());
  document.getElementById('releaseModalLabel').textContent = 'Nova Release';
});

document.getElementById('btn-add-link').addEventListener('click', () => {
  linkForm.reset();
  document.getElementById('link-id').value = '';
  document.getElementById('linkModalLabel').textContent = 'Novo Link';
});

document.getElementById('filter-bug-status').addEventListener('change', renderBugs);
document.getElementById('filter-bug-severity').addEventListener('change', renderBugs);

bugForm.addEventListener('submit', handleBugSubmit);
releaseForm.addEventListener('submit', handleReleaseSubmit);
linkForm.addEventListener('submit', handleLinkSubmit);

function applyPermissions() {
  if (currentUser && currentUser.role === 'Visualizador') {
    document.getElementById('btn-add-bug').classList.add('d-none');
    document.getElementById('btn-add-release').classList.add('d-none');
    document.getElementById('btn-add-link').classList.add('d-none');
  }
}

function populateAssigneeDropdown() {
  const select = document.getElementById('bug-assignee');
  const currentValue = select.value;
  select.innerHTML = '<option value="">Sem responsável</option>' +
    Object.values(allUsers).map(u => `<option value="${u.uid}">${escapeHTML(u.name)}</option>`).join('');
  select.value = currentValue;
}

function arrayToMap(list) {
  const map = {};
  list.forEach(item => { map[item.id] = item; });
  return map;
}

function canManageItem(item) {
  if (!currentUser || currentUser.role === 'Visualizador' || currentUser.role === 'Rh') return false;
  return currentUser.role === 'Admin' || item.createdBy === currentUser.uid;
}

async function startRealtimeSync() {
  try {
    const [{ bugs: bugList }, { releases: releaseList }, { links: linkList }] = await Promise.all([
      api.get('/devhub/bugs'),
      api.get('/devhub/releases'),
      api.get('/devhub/links')
    ]);
    bugs = arrayToMap(bugList);
    releases = arrayToMap(releaseList);
    links = arrayToMap(linkList);
    renderBugs();
    renderReleases();
    renderLinks();
    renderSummary();
  } catch (error) {
    console.error('Erro ao carregar dados de desenvolvimento:', error);
  }

  const socket = getSocket();

  socket.on('bug:created', (b) => { bugs[b.id] = b; renderBugs(); renderSummary(); });
  socket.on('bug:updated', (b) => { bugs[b.id] = b; renderBugs(); renderSummary(); });
  socket.on('bug:deleted', ({ id }) => { delete bugs[id]; renderBugs(); renderSummary(); });

  socket.on('release:created', (r) => { releases[r.id] = r; renderReleases(); renderSummary(); });
  socket.on('release:updated', (r) => { releases[r.id] = r; renderReleases(); renderSummary(); });
  socket.on('release:deleted', ({ id }) => { delete releases[id]; renderReleases(); renderSummary(); });

  socket.on('link:created', (l) => { links[l.id] = l; renderLinks(); });
  socket.on('link:deleted', ({ id }) => { delete links[id]; renderLinks(); });
}

function renderSummary() {
  const bugList = Object.values(bugs);
  document.getElementById('stat-open-bugs').textContent = bugList.filter(b => b.status === 'open').length;
  document.getElementById('stat-progress-bugs').textContent = bugList.filter(b => b.status === 'in_progress').length;
  document.getElementById('stat-resolved-bugs').textContent = bugList.filter(b => b.status === 'resolved' || b.status === 'closed').length;

  const releaseList = Object.values(releases).sort((a, b) => b.date - a.date);
  document.getElementById('stat-last-release').textContent = releaseList.length > 0 ? releaseList[0].version : '--';
}

/* ==========================================
   BUGS
   ========================================== */

function renderBugs() {
  const container = document.getElementById('bugs-list');
  const statusFilter = document.getElementById('filter-bug-status').value;
  const severityFilter = document.getElementById('filter-bug-severity').value;

  const list = Object.entries(bugs)
    .map(([id, b]) => ({ id, ...b }))
    .filter(b => !statusFilter || b.status === statusFilter)
    .filter(b => !severityFilter || b.severity === severityFilter)
    .sort((a, b) => b.createdAt - a.createdAt);

  container.innerHTML = '';
  document.getElementById('bugs-empty').classList.toggle('d-none', list.length > 0);

  list.forEach(bug => {
    const severity = SEVERITY_LABELS[bug.severity] || SEVERITY_LABELS.medium;
    const status = STATUS_LABELS[bug.status] || STATUS_LABELS.open;
    const assignee = bug.assigneeId ? allUsers[bug.assigneeId] : null;
    const canManage = canManageItem(bug);
    const canChangeStatus = currentUser && currentUser.role === 'Admin' || currentUser.role === 'Integrante';

    const card = document.createElement('div');
    card.className = 'module-item-card';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="flex-grow-1 min-width-0">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span class="badge ${severity.badge}">${severity.label}</span>
            ${canChangeStatus ? `
              <select class="form-select form-select-sm bug-status-select" data-id="${bug.id}" style="width: auto; display: inline-block;">
                ${Object.entries(STATUS_LABELS).map(([value, s]) => `<option value="${value}" ${bug.status === value ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            ` : `<span class="badge ${status.badge}">${status.label}</span>`}
          </div>
          <h6 class="mb-1">${escapeHTML(bug.title)}</h6>
          <p class="text-muted small mb-2">${escapeHTML(bug.description)}</p>
          <div class="d-flex gap-3 flex-wrap small text-muted align-items-center">
            ${assignee ? `<span class="d-flex align-items-center gap-1"><span class="user-avatar-mini">${getInitials(assignee.name)}</span> ${escapeHTML(assignee.name)}</span>` : '<span>Sem responsável</span>'}
            <span>${formatDateBR(bug.createdAt)}</span>
          </div>
        </div>
        ${canManage ? `
          <div class="text-nowrap">
            <button class="btn btn-sm btn-link text-info p-1 edit-bug-btn" data-id="${bug.id}" title="Editar"><i data-lucide="pencil" style="width: 15px;"></i></button>
            <button class="btn btn-sm btn-link text-danger p-1 delete-bug-btn" data-id="${bug.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.bug-status-select').forEach(select => {
    select.addEventListener('change', () => updateBugStatus(select.dataset.id, select.value));
  });
  container.querySelectorAll('.edit-bug-btn').forEach(btn => {
    btn.addEventListener('click', () => editBug(btn.dataset.id));
  });
  container.querySelectorAll('.delete-bug-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBug(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

function editBug(id) {
  const bug = bugs[id];
  if (!bug) return;

  document.getElementById('bug-id').value = id;
  document.getElementById('bug-title').value = bug.title;
  document.getElementById('bug-description').value = bug.description;
  document.getElementById('bug-severity').value = bug.severity;
  document.getElementById('bug-status').value = bug.status;
  document.getElementById('bug-assignee').value = bug.assigneeId || '';
  document.getElementById('bugModalLabel').textContent = 'Editar Bug';
  bugModal.show();
}

async function handleBugSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = document.getElementById('bug-id').value;
  const payload = {
    title: document.getElementById('bug-title').value.trim(),
    description: document.getElementById('bug-description').value.trim(),
    severity: document.getElementById('bug-severity').value,
    status: document.getElementById('bug-status').value,
    assigneeId: document.getElementById('bug-assignee').value || null
  };

  try {
    if (id) {
      await api.patch(`/devhub/bugs/${id}`, payload);
    } else {
      await api.post('/devhub/bugs', payload);
    }
    bugModal.hide();
    bugForm.reset();
  } catch (error) {
    console.error('Erro ao salvar bug:', error);
    alert('Erro ao salvar bug: permissão negada.');
  }
}

async function updateBugStatus(id, status) {
  try {
    await api.patch(`/devhub/bugs/${id}/status`, { status });
  } catch (error) {
    console.error('Erro ao atualizar status do bug:', error);
    alert('Erro ao atualizar status: permissão negada.');
    renderBugs();
  }
}

async function deleteBug(id) {
  if (!confirm('Deseja realmente excluir este bug?')) return;
  try {
    await api.delete(`/devhub/bugs/${id}`);
  } catch (error) {
    console.error('Erro ao excluir bug:', error);
    alert('Erro ao excluir bug: permissão negada.');
  }
}

/* ==========================================
   RELEASES
   ========================================== */

function renderReleases() {
  const container = document.getElementById('releases-list');
  const list = Object.entries(releases)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => b.date - a.date);

  container.innerHTML = '';
  document.getElementById('releases-empty').classList.toggle('d-none', list.length > 0);

  list.forEach(release => {
    const canManage = canManageItem(release);

    const item = document.createElement('div');
    item.className = 'release-item';
    item.innerHTML = `
      <div class="release-marker"></div>
      <div class="release-content">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span class="badge badge-info">${escapeHTML(release.version)}</span>
              <span class="small text-muted">${formatDateBR(release.date)}</span>
            </div>
            <h6 class="mb-1">${escapeHTML(release.title)}</h6>
            <p class="text-muted small mb-0" style="white-space: pre-line;">${escapeHTML(release.notes)}</p>
          </div>
          ${canManage ? `
            <div class="text-nowrap">
              <button class="btn btn-sm btn-link text-info p-1 edit-release-btn" data-id="${release.id}" title="Editar"><i data-lucide="pencil" style="width: 15px;"></i></button>
              <button class="btn btn-sm btn-link text-danger p-1 delete-release-btn" data-id="${release.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.edit-release-btn').forEach(btn => {
    btn.addEventListener('click', () => editRelease(btn.dataset.id));
  });
  container.querySelectorAll('.delete-release-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRelease(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

function editRelease(id) {
  const release = releases[id];
  if (!release) return;

  document.getElementById('release-id').value = id;
  document.getElementById('release-version').value = release.version;
  document.getElementById('release-title').value = release.title;
  document.getElementById('release-notes').value = release.notes;
  document.getElementById('release-date').value = epochToDateInput(release.date);
  document.getElementById('releaseModalLabel').textContent = 'Editar Release';
  releaseModal.show();
}

async function handleReleaseSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = document.getElementById('release-id').value;
  const payload = {
    version: document.getElementById('release-version').value.trim(),
    title: document.getElementById('release-title').value.trim(),
    notes: document.getElementById('release-notes').value.trim(),
    date: dateInputToEpoch(document.getElementById('release-date').value)
  };

  try {
    if (id) {
      await api.patch(`/devhub/releases/${id}`, payload);
    } else {
      await api.post('/devhub/releases', payload);
    }
    releaseModal.hide();
    releaseForm.reset();
  } catch (error) {
    console.error('Erro ao salvar release:', error);
    alert('Erro ao salvar release: permissão negada.');
  }
}

async function deleteRelease(id) {
  if (!confirm('Deseja realmente excluir esta release?')) return;
  try {
    await api.delete(`/devhub/releases/${id}`);
  } catch (error) {
    console.error('Erro ao excluir release:', error);
    alert('Erro ao excluir release: permissão negada.');
  }
}

/* ==========================================
   LINKS ÚTEIS
   ========================================== */

function renderLinks() {
  const container = document.getElementById('links-list');
  const list = Object.entries(links)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

  container.innerHTML = '';
  document.getElementById('links-empty').classList.toggle('d-none', list.length > 0);

  list.forEach(link => {
    const canManage = canManageItem(link);
    const icon = LINK_CATEGORY_ICONS[link.category] || 'link';

    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <div class="module-item-card module-item-compact d-flex align-items-center justify-content-between gap-2">
        <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" class="d-flex align-items-center gap-2 text-decoration-none flex-grow-1 min-width-0">
          <i data-lucide="${icon}" class="text-info flex-shrink-0" style="width: 18px;"></i>
          <div class="min-width-0">
            <div class="fw-bold text-truncate">${escapeHTML(link.title)}</div>
            <div class="small text-muted text-truncate">${escapeHTML(link.category)}</div>
          </div>
        </a>
        ${canManage ? `<button class="btn btn-sm btn-link text-danger p-1 delete-link-btn flex-shrink-0" data-id="${link.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>` : ''}
      </div>
    `;
    container.appendChild(col);
  });

  container.querySelectorAll('.delete-link-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteLink(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

async function handleLinkSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const payload = {
    title: document.getElementById('link-title').value.trim(),
    url: document.getElementById('link-url').value.trim(),
    category: document.getElementById('link-category').value
  };

  try {
    await api.post('/devhub/links', payload);
    linkModal.hide();
    linkForm.reset();
  } catch (error) {
    console.error('Erro ao salvar link:', error);
    alert('Erro ao salvar link: permissão negada.');
  }
}

async function deleteLink(id) {
  if (!confirm('Deseja realmente excluir este link?')) return;
  try {
    await api.delete(`/devhub/links/${id}`);
  } catch (error) {
    console.error('Erro ao excluir link:', error);
    alert('Erro ao excluir link: permissão negada.');
  }
}
