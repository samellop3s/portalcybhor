import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { ref, set, push, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { auth, db } from "../shared/firebase-init.js";
import { initializeTheme, setupThemeToggle } from "../shared/theme.js";
import storageManager from "../shared/storage-manager.js";

// State
let currentUser = null;
let allUsers = {};
let ideas = {};
let stages = {};
let tasks = {};
let activeListeners = [];

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const ideasList = document.getElementById('ideas-list');
const btnLogout = document.getElementById('btn-logout');

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

// Auth & Routing
onAuthStateChanged(auth, async (user) => {
  activeListeners.forEach(unsubscribe => unsubscribe());
  activeListeners = [];

  if (user) {
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const userSnapshot = await get(userRef);
      
      if (userSnapshot.exists()) {
        currentUser = { uid: user.uid, ...userSnapshot.val() };
        startRealtimeSync(user.uid);
      } else {
        alert("Perfil de usuário não encontrado.");
        signOut(auth);
      }
    } catch (error) {
      console.error("Error setting up user profile:", error);
      signOut(auth);
    }
  } else {
    window.location.href = 'index.html';
  }
});

function startRealtimeSync(uid) {
  // Load cached data
  const cachedIdeas = storageManager.loadIdeas();
  const cachedStages = storageManager.loadStages();
  const cachedTasks = storageManager.loadTasks();

  if (Object.keys(cachedIdeas).length > 0) ideas = cachedIdeas;
  if (Object.keys(cachedStages).length > 0) stages = cachedStages;
  if (Object.keys(cachedTasks).length > 0) tasks = cachedTasks;

  // Sync current user
  const userListener = onValue(ref(db, `users/${uid}`), (snapshot) => {
    if (snapshot.exists()) {
      currentUser = { uid, ...snapshot.val() };
    }
  });
  activeListeners.push(userListener);

  // Sync all users
  const allUsersListener = onValue(ref(db, 'users'), (snapshot) => {
    if (snapshot.exists()) {
      allUsers = snapshot.val();
    }
  });
  activeListeners.push(allUsersListener);

  // Sync stages
  const stagesListener = onValue(ref(db, 'stages'), (snapshot) => {
    stages = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveStages(stages);
  });
  activeListeners.push(stagesListener);

  // Sync tasks
  const tasksListener = onValue(ref(db, 'tasks'), (snapshot) => {
    tasks = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveTasks(tasks);
  });
  activeListeners.push(tasksListener);

  // Sync ideas
  const ideasListener = onValue(ref(db, 'ideas'), (snapshot) => {
    ideas = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveIdeas(ideas);
    renderIdeas();
    updateStatistics();
  });
  activeListeners.push(ideasListener);

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
      <h6 class="text-light mb-1">${idea.title}</h6>
      <p class="text-muted small mb-2">${idea.description}</p>
      <div class="small text-secondary mb-3">Sugerido por: <span class="text-info">${idea.authorName}</span></div>
      
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
      
      const currentVoteRef = ref(db, `ideas/${ideaId}/votes/${currentUser.uid}`);
      
      try {
        const snapshot = await get(currentVoteRef);
        const currentVoteVal = snapshot.exists() ? snapshot.val() : null;
        
        const hasVotedSame = currentVoteVal === voteValue;

        if (snapshot.exists() && hasVotedSame) {
          await remove(currentVoteRef);
        } else {
          await set(currentVoteRef, voteValue);
        }
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
      let options = '';
      
      Object.keys(stages).sort((a, b) => stages[a].order - stages[b].order).forEach(id => {
        options += `<option value="${id}">${stages[id].title}</option>`;
      });
      
      promoteTaskStage.innerHTML = options || '<option value="" disabled>Crie uma etapa no Kanban primeiro</option>';
      promoteIdeaModal.show();
    });
  });

  document.querySelectorAll('.btn-discard-idea').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ideaId = btn.getAttribute('data-idea-id');
      if (!ideaId) return;
      if (!confirm('Deseja descartar esta ideia?')) return;

      try {
        await update(ref(db, `ideas/${ideaId}`), { status: 'discarded' });
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
    const newIdeaRef = push(ref(db, 'ideas'));
    await set(newIdeaRef, {
      title,
      description,
      authorId: currentUser.uid,
      authorName: currentUser.name,
      status: 'pending',
      createdAt: Date.now()
    });
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

  const idea = ideas[ideaId];

  try {
    const newTaskRef = push(ref(db, 'tasks'));
    const now = Date.now();
    await set(newTaskRef, {
      title: `[IDEIA] ${idea.title}`,
      description: idea.description,
      priority,
      assigneeId,
      stageId,
      creatorId: currentUser.uid,
      createdAt: now,
      scheduledAt: now,
      status: 'pending'
    });

    await update(ref(db, `ideas/${ideaId}`), { status: 'approved' });

    promoteIdeaModal.hide();
    promoteIdeaForm.reset();
  } catch (error) {
    alert("Erro ao promover ideia: permissão negada.");
    console.error(error);
  }
});

// Logout
btnLogout.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

// Inicialização
initializeTheme();
setupThemeToggle();
if (window.lucide) window.lucide.createIcons();
