import { api } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import storageManager from "../shared/storage-manager.js";
import { initPortalShell } from "../shared/portal-shell.js";

// State
let currentUser = null;
let allUsers = {};
let ideas = {};
let stages = {};

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const ideasList = document.getElementById('ideas-list');

// Modal & Forms
const addIdeaForm = document.getElementById('add-idea-form');
const promoteIdeaForm = document.getElementById('promote-idea-form');
let addIdeaModal, promoteIdeaModal;

function initModals() {
  addIdeaModal = new bootstrap.Modal(document.getElementById('addIdeaModal'));
  promoteIdeaModal = new bootstrap.Modal(document.getElementById('promoteIdeaModal'));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initModals);
} else {
  initModals();
}

function arrayToMap(list, idField = 'id') {
  const map = {};
  list.forEach(item => {
    map[item[idField]] = item;
  });
  return map;
}

initPortalShell({
  active: 'ideas',
  onUserReady: async (user, usersMap) => {
    currentUser = user;
    allUsers = usersMap;
    await startRealtimeSync();
  }
});

async function startRealtimeSync() {
  // Load cached data
  const cachedIdeas = storageManager.loadIdeas();
  const cachedStages = storageManager.loadStages();

  if (Object.keys(cachedIdeas).length > 0) ideas = cachedIdeas;
  if (Object.keys(cachedStages).length > 0) stages = cachedStages;

  try {
    const [{ users }, { stages: stageList }, { ideas: ideaList }] = await Promise.all([
      api.get('/users'),
      api.get('/stages'),
      api.get('/ideas')
    ]);

    allUsers = arrayToMap(users, 'uid');
    stages = arrayToMap(stageList);
    ideas = arrayToMap(ideaList);

    storageManager.saveStages(stages);
    storageManager.saveIdeas(ideas);

    renderIdeas();
    updateStatistics();
  } catch (error) {
    console.error('Erro ao carregar ideias:', error);
  }

  const socket = getSocket();

  socket.on('user:updated', (user) => { allUsers[user.uid] = user; });
  socket.on('user:created', (user) => { allUsers[user.uid] = user; });
  socket.on('user:deleted', ({ uid }) => { delete allUsers[uid]; });

  socket.on('stage:created', (stage) => { stages[stage.id] = stage; storageManager.saveStages(stages); });
  socket.on('stage:deleted', ({ id }) => { delete stages[id]; storageManager.saveStages(stages); });

  socket.on('idea:created', (idea) => {
    ideas[idea.id] = idea;
    storageManager.saveIdeas(ideas);
    renderIdeas();
    updateStatistics();
  });

  socket.on('idea:updated', (idea) => {
    ideas[idea.id] = idea;
    storageManager.saveIdeas(ideas);
    renderIdeas();
    updateStatistics();
  });

  // Show main content
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.classList.add('d-none');
    }, 500);
    lucide.createIcons();
  }, 500);
}

// Render Ideas
function renderIdeas() {
  ideasList.innerHTML = '';

  const activeIdeasKeys = Object.keys(ideas).filter(id => ideas[id].status !== 'approved' && ideas[id].status !== 'discarded');

  if (activeIdeasKeys.length === 0) {
    ideasList.innerHTML = `
      <div class="text-center text-muted py-5">
        <i data-lucide="lightbulb" style="width: 48px; height: 48px; opacity: 0.5;"></i>
        <p class="mt-2 mb-0">Nenhuma ideia sugerida ainda.</p>
        <small>Seja o primeiro a enviar uma!</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  activeIdeasKeys.reverse().forEach(ideaId => {
    const idea = ideas[ideaId];

    // Count votes
    const votesObj = idea.votes || {};
    const totalVotes = Object.keys(votesObj).length;
    const yesVotes = Object.values(votesObj).filter(v => v === true).length;
    const noVotes = Object.values(votesObj).filter(v => v === false).length;

    const yesPct = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50;
    const noPct = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 50;

    // Verificar meu voto
    const myVote = currentUser ? votesObj[currentUser.uid] : undefined;
    const activeYesClass = myVote === true ? 'active-yes' : '';
    const activeNoClass = myVote === false ? 'active-no' : '';

    // Admin buttons
    const adminActionHtml = currentUser && currentUser.role === 'Admin'
      ? `<div class="mt-3 d-flex gap-2">
          <button class="btn btn-cyber btn-cyber-success py-1 px-2.5 small btn-promote-idea flex-grow-1" data-idea-id="${ideaId}">
            <i data-lucide="check" style="width:14px;"></i> Aprovar e Implementar
          </button>
          <button class="btn btn-cyber btn-cyber-danger py-1 px-2.5 small btn-discard-idea flex-grow-1" data-idea-id="${ideaId}">
            <i data-lucide="x" style="width:14px;"></i> Descartar
          </button>
        </div>`
      : '';

    const card = document.createElement('div');
    card.className = 'idea-card mb-3';
    card.innerHTML = `
      <h6 class="text-light mb-1">${DOMPurify.sanitize(idea.title)}</h6>
      <p class="text-muted small mb-2">${DOMPurify.sanitize(idea.description)}</p>
      <div class="small text-secondary mb-3">Sugerido por: <span class="text-info">${DOMPurify.sanitize(idea.authorName)}</span></div>
      
      <div class="d-flex justify-content-between small text-muted font-monospace mb-2">
        <span>Sim: ${yesVotes} (${yesPct}%)</span>
        <span>Não: ${noVotes} (${noPct}%)</span>
      </div>

      <div class="voting-bar-container mb-3">
        <div class="vote-bar-yes" style="width: ${yesPct}%"></div>
        <div class="vote-bar-no" style="width: ${noPct}%"></div>
      </div>

      <div class="d-flex gap-2 mb-2">
        <button class="btn vote-btn flex-grow-1 ${activeYesClass}" data-idea-id="${ideaId}" data-vote="yes" ${currentUser && currentUser.role === 'Visualizador' ? 'disabled' : ''}>
          <i data-lucide="thumbs-up" style="width: 14px;"></i> Sim
        </button>
        <button class="btn vote-btn flex-grow-1 ${activeNoClass}" data-idea-id="${ideaId}" data-vote="no" ${currentUser && currentUser.role === 'Visualizador' ? 'disabled' : ''}>
          <i data-lucide="thumbs-down" style="width: 14px;"></i> Não
        </button>
      </div>

      ${adminActionHtml}
    `;

    ideasList.appendChild(card);
  });

  attachVotingHandlers();
  lucide.createIcons();
}

function attachVotingHandlers() {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ideaId = btn.getAttribute('data-idea-id');
      const voteType = btn.getAttribute('data-vote');
      const voteValue = voteType === 'yes';

      const currentVoteVal = (ideas[ideaId] && ideas[ideaId].votes) ? ideas[ideaId].votes[currentUser.uid] : undefined;
      const hasVotedSame = currentVoteVal === voteValue;

      try {
        await api.put(`/ideas/${ideaId}/vote`, { vote: hasVotedSame ? null : voteValue });
      } catch (error) {
        console.error("Error updating vote:", error);
        alert("Erro ao computar voto: " + error.message);
      }
    });
  });

  document.querySelectorAll('.btn-promote-idea').forEach(btn => {
    btn.addEventListener('click', () => {
      const ideaId = btn.getAttribute('data-idea-id');
      const idea = ideas[ideaId];

      document.getElementById('promote-idea-id').value = ideaId;
      document.getElementById('promote-idea-summary').innerHTML = `A ideia <strong>"${idea.title}"</strong> será transferida para o Kanban do projeto.`;

      const promoteTaskStage = document.getElementById('promote-task-stage');
      let stageOptions = '';
      Object.keys(stages).sort((a, b) => stages[a].order - stages[b].order).forEach(id => {
        stageOptions += `<option value="${id}">${stages[id].title}</option>`;
      });
      promoteTaskStage.innerHTML = stageOptions || '<option value="" disabled>Crie uma etapa no Kanban primeiro</option>';

      const promoteTaskAssignee = document.getElementById('promote-task-assignee');
      let assigneeOptions = '<option value="" disabled selected>Selecione um integrante...</option>';
      Object.keys(allUsers).forEach(uid => {
        const user = allUsers[uid];
        assigneeOptions += `<option value="${uid}">${user.name} (${user.role})</option>`;
      });
      promoteTaskAssignee.innerHTML = assigneeOptions;

      promoteIdeaModal.show();
    });
  });

  document.querySelectorAll('.btn-discard-idea').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ideaId = btn.getAttribute('data-idea-id');
      if (!ideaId) return;
      if (!confirm('Deseja descartar esta ideia?')) return;

      try {
        await api.patch(`/ideas/${ideaId}/discard`);
      } catch (error) {
        console.error('Erro ao descartar ideia:', error);
        alert('Erro ao descartar ideia: ' + error.message);
      }
    });
  });
}

function updateStatistics() {
  const total = Object.keys(ideas).length;
  const pending = Object.values(ideas).filter(i => i.status === 'pending').length;
  const approved = Object.values(ideas).filter(i => i.status === 'approved').length;
  const discarded = Object.values(ideas).filter(i => i.status === 'discarded').length;

  document.getElementById('stats-total').textContent = total;
  document.getElementById('stats-pending').textContent = pending;
  document.getElementById('stats-approved').textContent = approved;
  document.getElementById('stats-discarded').textContent = discarded;
}

// Add Idea Form
addIdeaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('idea-title').value.trim();
  const description = document.getElementById('idea-description').value.trim();

  try {
    await api.post('/ideas', { title, description });
    addIdeaModal.hide();
    addIdeaForm.reset();
  } catch (error) {
    alert("Erro ao enviar ideia: permissão negada.");
  }
});

// Promote Idea Form
promoteIdeaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ideaId = document.getElementById('promote-idea-id').value;
  const stageId = document.getElementById('promote-task-stage').value;
  const priority = document.getElementById('promote-task-priority').value;
  const assigneeId = document.getElementById('promote-task-assignee').value;

  if (!stageId) {
    alert("Crie pelo menos uma etapa no Kanban primeiro!");
    return;
  }

  try {
    await api.post(`/ideas/${ideaId}/promote`, { stageId, priority, assigneeId: assigneeId || null });

    promoteIdeaModal.hide();
    promoteIdeaForm.reset();
  } catch (error) {
    alert("Erro ao promover ideia: permissão negada.");
    console.error(error);
  }
});

// Logout e tema ficam no portal-shell
if (window.lucide) window.lucide.createIcons();
