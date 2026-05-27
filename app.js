import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Local State
let currentUser = null;
let allUsers = {};
let stages = {};
let tasks = {};
let ideas = {};
let activeListeners = [];

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const authAlert = document.getElementById('auth-alert');

// Auth Forms (Registration removed)
const loginForm = document.getElementById('login-form');

// Header Elements
const headerUserName = document.getElementById('header-user-name');
const headerUserRoleBadge = document.getElementById('header-user-role-badge');
const headerUserAvatar = document.getElementById('header-user-avatar');
const btnLogout = document.getElementById('btn-logout');

// Admin Portal Redirect Link
const btnAdminPortal = document.getElementById('btn-admin-portal');

// Kanban Board
const kanbanBoard = document.getElementById('kanban-board');
const addStageArea = document.getElementById('add-stage-area');

// Ideas
const ideasList = document.getElementById('ideas-list');

// Modals forms
const addStageForm = document.getElementById('add-stage-form');
const addTaskForm = document.getElementById('add-task-form');
const addIdeaForm = document.getElementById('add-idea-form');
const promoteIdeaForm = document.getElementById('promote-idea-form');

// Boostrap Modal Instances (for closing programmatically)
let addStageModal, addTaskModal, addIdeaModal, promoteIdeaModal;

// Initialize Modals safely depending on document ready state
function initModals() {
  addStageModal = new bootstrap.Modal(document.getElementById('addStageModal'));
  addTaskModal = new bootstrap.Modal(document.getElementById('addTaskModal'));
  addIdeaModal = new bootstrap.Modal(document.getElementById('addIdeaModal'));
  promoteIdeaModal = new bootstrap.Modal(document.getElementById('promoteIdeaModal'));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initModals);
} else {
  initModals();
}

/* ==========================================
   AUTH & ROUTING FLOW
   ========================================== */

// Handle Auth State Changes
onAuthStateChanged(auth, async (user) => {
  // Clear any existing listeners to prevent leaks
  activeListeners.forEach(unsubscribe => unsubscribe());
  activeListeners = [];

  if (user) {
    // User is logged in
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        // First registration check to bootstrap admin role
        const usersListSnapshot = await get(ref(db, 'users'));
        const hasUsers = usersListSnapshot.exists();
        const role = hasUsers ? 'Integrante' : 'Admin';
        
        // Write user details
        const name = user.displayName || document.getElementById('register-name').value.trim() || 'Usuário Cybhor';
        await set(userRef, {
          name: name,
          email: user.email,
          role: role
        });
      }

      // Start listening to data updates in real-time
      startRealtimeSync(user.uid);

    } catch (error) {
      console.error("Error setting up user profile:", error);
      showAuthError(error.message);
      signOut(auth);
    }
  } else {
    // User is logged out
    currentUser = null;
    showAuthUI();
  }
});

// Realtime Sync Init
function startRealtimeSync(uid) {
  // 1. Sync current user details
  const userListener = onValue(ref(db, `users/${uid}`), (snapshot) => {
    if (snapshot.exists()) {
      currentUser = { uid, ...snapshot.val() };
      updateHeader();
      updatePermissionsUI();
      renderIdeas();
    }
  });
  activeListeners.push(userListener);

  // 2. Sync all users
  const allUsersListener = onValue(ref(db, 'users'), (snapshot) => {
    if (snapshot.exists()) {
      allUsers = snapshot.val();
      populateAssigneeDropdowns();
    }
  });
  activeListeners.push(allUsersListener);

  // 3. Sync project stages
  const stagesListener = onValue(ref(db, 'stages'), (snapshot) => {
    stages = snapshot.exists() ? snapshot.val() : {};
    renderKanban();
  });
  activeListeners.push(stagesListener);

  // 4. Sync tasks
  const tasksListener = onValue(ref(db, 'tasks'), (snapshot) => {
    tasks = snapshot.exists() ? snapshot.val() : {};
    renderKanban();
  });
  activeListeners.push(tasksListener);

  // 5. Sync ideas
  const ideasListener = onValue(ref(db, 'ideas'), (snapshot) => {
    ideas = snapshot.exists() ? snapshot.val() : {};
    renderIdeas();
  });
  activeListeners.push(ideasListener);

  // Transition UI
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.classList.add('d-none');
    }, 500);
    authSection.classList.add('d-none');
    mainApp.classList.remove('d-none');
    lucide.createIcons();
  }, 500);
}

// Show Auth Form UI
function showAuthUI() {
  loadingOverlay.classList.add('d-none');
  mainApp.classList.add('d-none');
  authSection.classList.remove('d-none');
}

// Public self-registration removed

// Login Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  authAlert.classList.add('d-none');

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loadingOverlay.classList.add('d-none');
    showAuthError("Falha no login: verifique suas credenciais.");
    console.error(error);
  }
});

// Public registration submit listener removed

// Logout action
btnLogout.addEventListener('click', () => {
  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  signOut(auth).then(() => {
    window.location.reload();
  });
});

function showAuthError(msg) {
  authAlert.textContent = msg;
  authAlert.classList.remove('d-none');
}

/* ==========================================
   UI STATE & PERMISSIONS MANAGEMENT
   ========================================== */

function updateHeader() {
  if (!currentUser) return;
  headerUserName.textContent = currentUser.name;
  
  // Update Role Badge
  let badgeClass = 'role-visualizador';
  if (currentUser.role === 'Admin') badgeClass = 'role-admin';
  else if (currentUser.role === 'Integrante') badgeClass = 'role-integrante';
  
  headerUserRoleBadge.innerHTML = `<span class="badge ${badgeClass}">${currentUser.role}</span>`;
  
  // Set Initials Avatar
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  headerUserAvatar.textContent = initials;
}

function updatePermissionsUI() {
  if (!currentUser) return;
  
  const isAdmin = currentUser.role === 'Admin';
  
  // Show Admin Portal Button & Stage Creation Controls
  if (isAdmin) {
    if (btnAdminPortal) btnAdminPortal.classList.remove('d-none');
    addStageArea.classList.remove('d-none');
  } else {
    if (btnAdminPortal) btnAdminPortal.classList.add('d-none');
    addStageArea.classList.add('d-none');
  }
}

// Integrated admin panel render removed (moved to admin.js)

function populateAssigneeDropdowns() {
  const taskAssignee = document.getElementById('task-assignee');
  const promoteTaskAssignee = document.getElementById('promote-task-assignee');
  
  let options = '<option value="" disabled selected>Selecione um integrante...</option>';
  
  Object.keys(allUsers).forEach(uid => {
    const user = allUsers[uid];
    options += `<option value="${uid}">${user.name} (${user.role})</option>`;
  });
  
  taskAssignee.innerHTML = options;
  promoteTaskAssignee.innerHTML = options;
}

/* ==========================================
   KANBAN WORKFLOW MANAGEMENT (Stages & Tasks)
   ========================================== */

// Render Kanban board columns
function renderKanban() {
  kanbanBoard.innerHTML = '';
  
  // Sort stages by order
  const sortedStageKeys = Object.keys(stages).sort((a, b) => stages[a].order - stages[b].order);
  
  if (sortedStageKeys.length === 0) {
    kanbanBoard.innerHTML = `
      <div class="text-center text-muted py-5 w-100">
        <i data-lucide="layout-grid" style="width: 48px; height: 48px; opacity: 0.5;"></i>
        <p class="mt-2 mb-0">Nenhuma etapa criada.</p>
        <small>Adicione etapas para começar a organizar as tarefas.</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  sortedStageKeys.forEach((stageId, index) => {
    const stage = stages[stageId];
    
    // Create column card element
    const colDiv = document.createElement('div');
    colDiv.className = 'glass-panel kanban-column';
    colDiv.setAttribute('data-stage-id', stageId);
    
    // Admin check for delete button
    const deleteColBtn = currentUser && currentUser.role === 'Admin' 
      ? `<button class="btn btn-link text-danger p-0 delete-stage-btn" data-stage-id="${stageId}"><i data-lucide="trash-2" style="width: 16px;"></i></button>`
      : '';

    // Render header
    colDiv.innerHTML = `
      <div class="column-header">
        <h6 class="column-title"><i data-lucide="folder" class="text-info" style="width:16px;"></i> ${stage.title}</h6>
        ${deleteColBtn}
      </div>
      <div class="task-list" id="task-list-${stageId}" data-stage-id="${stageId}">
        <!-- Tasks rendered here -->
      </div>
      <div class="mt-3">
        <button class="btn btn-cyber w-100 py-1.5 open-add-task-btn" data-stage-id="${stageId}" ${currentUser && currentUser.role === 'Visualizador' ? 'disabled' : ''}>
          <i data-lucide="plus" style="width: 16px;"></i> Adicionar Tarefa
        </button>
      </div>
    `;
    
    kanbanBoard.appendChild(colDiv);
    
    // Fill tasks
    const colTaskList = colDiv.querySelector(`.task-list`);
    const stageTasks = Object.keys(tasks)
      .map(id => ({ id, ...tasks[id] }))
      .filter(t => t.stageId === stageId);
      
    if (stageTasks.length === 0) {
      colTaskList.innerHTML = '<div class="text-center py-4 text-muted small drag-placeholder">Arraste tarefas aqui</div>';
    } else {
      stageTasks.forEach(task => {
        const assignee = allUsers[task.assigneeId] ? allUsers[task.assigneeId].name : 'Desconhecido';
        const initials = assignee.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.setAttribute('draggable', currentUser && currentUser.role !== 'Visualizador' ? 'true' : 'false');
        taskCard.setAttribute('data-task-id', task.id);
        
        // Navigation buttons for accessibility/mobile
        const showNav = currentUser && currentUser.role !== 'Visualizador';
        const leftBtn = showNav && index > 0 
          ? `<button class="btn btn-sm btn-link text-info p-0 move-task-left-btn" data-task-id="${task.id}" data-current-stage="${stageId}" data-target-stage="${sortedStageKeys[index - 1]}"><i data-lucide="chevron-left" style="width:16px;"></i></button>` 
          : '';
        const rightBtn = showNav && index < sortedStageKeys.length - 1 
          ? `<button class="btn btn-sm btn-link text-info p-0 move-task-right-btn" data-task-id="${task.id}" data-current-stage="${stageId}" data-target-stage="${sortedStageKeys[index + 1]}"><i data-lucide="chevron-right" style="width:16px;"></i></button>` 
          : '';
        
        // Delete button (Admin only)
        const canDelete = currentUser && currentUser.role === 'Admin';
        const deleteBtn = canDelete 
          ? `<button class="btn btn-sm btn-link text-danger p-0 delete-task-btn ms-2" data-task-id="${task.id}"><i data-lucide="trash-2" style="width: 14px;"></i></button>` 
          : '';

        taskCard.innerHTML = `
          <span class="task-priority priority-${task.priority}">${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span>
          <h6 class="text-light mb-1">${task.title}</h6>
          <p class="text-muted small mb-2 text-truncate-3">${task.description}</p>
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <div class="user-avatar" style="width: 24px; height: 24px; font-size: 0.65rem; box-shadow: none;" title="${assignee}">${initials}</div>
              <span class="text-muted small text-truncate" style="max-width: 110px;">${assignee}</span>
            </div>
            <div class="task-actions">
              ${leftBtn}
              ${rightBtn}
              ${deleteBtn}
            </div>
          </div>
        `;
        
        colTaskList.appendChild(taskCard);
      });
    }

    // Attach drag events to task cards (Desktop workflow)
    if (currentUser && currentUser.role !== 'Visualizador') {
      setupDragAndDropEvents(colTaskList, stageId);
    }
  });

  // Attach event handlers to dynamic board buttons
  attachKanbanClickHandlers(sortedStageKeys);
  lucide.createIcons();
}

// Setup Drag & Drop listeners
function setupDragAndDropEvents(taskListContainer, stageId) {
  taskListContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    taskListContainer.classList.add('bg-secondary', 'bg-opacity-10');
  });

  taskListContainer.addEventListener('dragleave', () => {
    taskListContainer.classList.remove('bg-secondary', 'bg-opacity-10');
  });

  taskListContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    taskListContainer.classList.remove('bg-secondary', 'bg-opacity-10');
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && tasks[taskId] && tasks[taskId].stageId !== stageId) {
      try {
        await update(ref(db, `tasks/${taskId}`), { stageId: stageId });
      } catch (error) {
        console.error("Error updates task stage:", error);
      }
    }
  });

  // Set card drag start/end
  taskListContainer.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
      card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function attachKanbanClickHandlers(sortedStageKeys) {
  // Delete Stage Handler
  document.querySelectorAll('.delete-stage-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stageId = btn.getAttribute('data-stage-id');
      if (confirm(`Tem certeza que deseja excluir esta etapa? Todas as tarefas desta coluna também serão apagadas.`)) {
        try {
          // Delete Stage
          await remove(ref(db, `stages/${stageId}`));
          
          // Delete associated tasks
          const updates = {};
          Object.keys(tasks).forEach(id => {
            if (tasks[id].stageId === stageId) {
              updates[`tasks/${id}`] = null;
            }
          });
          if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
          }
        } catch (error) {
          alert("Erro ao excluir etapa: permissão negada.");
        }
      }
    });
  });

  // Open Add Task Modal Handler
  document.querySelectorAll('.open-add-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stageId = btn.getAttribute('data-stage-id');
      document.getElementById('add-task-form').reset();
      document.getElementById('task-stage-id').value = stageId;
      addTaskModal.show();
    });
  });

  // Delete Task Handler
  document.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      if (confirm("Deseja mesmo excluir esta tarefa?")) {
        try {
          await remove(ref(db, `tasks/${taskId}`));
        } catch (error) {
          alert("Erro ao excluir tarefa: permissão negada.");
        }
      }
    });
  });

  // Move Task manually (Accessibility/Mobile)
  document.querySelectorAll('.move-task-left-btn, .move-task-right-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      const targetStage = btn.getAttribute('data-target-stage');
      
      try {
        await update(ref(db, `tasks/${taskId}`), { stageId: targetStage });
      } catch (error) {
        console.error("Error moving task:", error);
      }
    });
  });
}

// Add Stage Submission
addStageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('new-stage-title').value.trim();
  
  try {
    const newStageRef = push(ref(db, 'stages'));
    await set(newStageRef, {
      title: title,
      order: Date.now()
    });
    addStageModal.hide();
    addStageForm.reset();
  } catch (error) {
    alert("Erro ao criar etapa: permissão negada.");
  }
});

// Add Task Submission
addTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const stageId = document.getElementById('task-stage-id').value;
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim();
  const priority = document.getElementById('task-priority').value;
  const assigneeId = document.getElementById('task-assignee').value;

  try {
    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, {
      title,
      description,
      priority,
      assigneeId,
      stageId,
      creatorId: currentUser.uid,
      createdAt: Date.now()
    });
    addTaskModal.hide();
    addTaskForm.reset();
  } catch (error) {
    alert("Erro ao adicionar tarefa: permissão negada.");
  }
});

/* ==========================================
   IDEAS & VOTING PANEL
   ========================================== */

function renderIdeas() {
  ideasList.innerHTML = '';
  
  const activeIdeasKeys = Object.keys(ideas).filter(id => ideas[id].status !== 'approved');

  if (activeIdeasKeys.length === 0) {
    ideasList.innerHTML = `
      <div class="text-center text-muted py-5">
        <i data-lucide="lightbulb" style="width: 48px; height: 48px; opacity: 0.5;"></i>
        <p class="mt-2 mb-0">Nenhuma ideia sugerida ainda.</p>
        <small>Seja o primeiro a propor algo!</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Sort by date created (newest first)
  activeIdeasKeys.reverse().forEach(ideaId => {
    const idea = ideas[ideaId];
    
    // Count votes
    const votesObj = idea.votes || {};
    const totalVotes = Object.keys(votesObj).length;
    const yesVotes = Object.values(votesObj).filter(v => v === true || v === 'true' || v === 'yes').length;
    const noVotes = Object.values(votesObj).filter(v => v === false || v === 'false' || v === 'no').length;
    
    // Percentages
    const yesPct = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50;
    const noPct = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 50;

    // Check my vote
    const myVote = currentUser ? votesObj[currentUser.uid] : undefined;
    const activeYesClass = (myVote === true || myVote === 'true' || myVote === 'yes') ? 'active-yes' : '';
    const activeNoClass = (myVote === false || myVote === 'false' || myVote === 'no') ? 'active-no' : '';

    // Admin promotion button
    const adminActionHtml = currentUser && currentUser.role === 'Admin'
      ? `<button class="btn btn-cyber btn-cyber-success py-1 px-2.5 small btn-promote-idea w-100 mt-3" data-idea-id="${ideaId}">
          <i data-lucide="check" style="width:16px;"></i> Aprovar e Implementar
         </button>`
      : '';

    const card = document.createElement('div');
    card.className = 'idea-card';
    card.innerHTML = `
      <h6 class="text-light mb-1">${idea.title}</h6>
      <p class="text-muted small mb-2">${idea.description}</p>
      <div class="small text-secondary mb-3">Sugerido por: <span class="text-info">${idea.authorName}</span></div>
      
      <!-- Live vote counts -->
      <div class="d-flex justify-content-between small text-muted font-monospace">
        <span>Sim: ${yesVotes} (${yesPct}%)</span>
        <span>Não: ${noVotes} (${noPct}%)</span>
      </div>

      <!-- Live bar -->
      <div class="voting-bar-container">
        <div class="vote-bar-yes" style="width: ${yesPct}%"></div>
        <div class="vote-bar-no" style="width: ${noPct}%"></div>
      </div>

      <!-- Action buttons -->
      <div class="d-flex gap-2">
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

  // Attach voting click listeners
  attachVotingHandlers();
  lucide.createIcons();
}

function attachVotingHandlers() {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ideaId = btn.getAttribute('data-idea-id');
      const voteType = btn.getAttribute('data-vote'); // 'yes' or 'no'
      const voteValue = voteType === 'yes';
      
      const currentVoteRef = ref(db, `ideas/${ideaId}/votes/${currentUser.uid}`);
      
      try {
        const snapshot = await get(currentVoteRef);
        const currentVoteVal = snapshot.exists() ? snapshot.val() : null;
        
        // Normalize comparison (handles booleans and legacy strings)
        const hasVotedSame = (currentVoteVal === voteValue) || 
                             (voteValue === true && (currentVoteVal === 'true' || currentVoteVal === 'yes')) ||
                             (voteValue === false && (currentVoteVal === 'false' || currentVoteVal === 'no'));

        if (snapshot.exists() && hasVotedSame) {
          // Toggle off: remove vote if clicked same button again
          await remove(currentVoteRef);
        } else {
          // Vote or change vote (always write as boolean now)
          await set(currentVoteRef, voteValue);
        }
      } catch (error) {
        console.error("Error updating vote:", error);
        alert("Erro ao computar voto: " + error.message);
      }
    });
  });

  // Promote Idea to Task Handler
  document.querySelectorAll('.btn-promote-idea').forEach(btn => {
    btn.addEventListener('click', () => {
      const ideaId = btn.getAttribute('data-idea-id');
      const idea = ideas[ideaId];
      
      document.getElementById('promote-idea-id').value = ideaId;
      document.getElementById('promote-idea-summary').innerHTML = `A ideia <strong>"${idea.title}"</strong> será transferida para o Kanban do projeto.`;
      
      // Populate stage options
      const promoteTaskStage = document.getElementById('promote-task-stage');
      let options = '';
      
      Object.keys(stages).sort((a, b) => stages[a].order - stages[b].order).forEach(id => {
        options += `<option value="${id}">${stages[id].title}</option>`;
      });
      
      promoteTaskStage.innerHTML = options || '<option value="" disabled>Crie uma etapa no Kanban primeiro</option>';
      promoteIdeaModal.show();
    });
  });
}

// Add Idea Submission
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

// Promote Idea Submission
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
    // 1. Create task
    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, {
      title: `[IDEIA] ${idea.title}`,
      description: idea.description,
      priority,
      assigneeId,
      stageId,
      creatorId: currentUser.uid,
      createdAt: Date.now()
    });

    // 2. Mark idea as approved in database (archived)
    await update(ref(db, `ideas/${ideaId}`), { status: 'approved' });

    promoteIdeaModal.hide();
    promoteIdeaForm.reset();
  } catch (error) {
    alert("Erro ao promover ideia: permissão negada.");
    console.error(error);
  }
});
