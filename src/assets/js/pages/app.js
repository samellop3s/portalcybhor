import { api, ApiError } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import { initializeTheme, setupThemeToggle } from "../shared/theme.js";
import { getInitials, escapeHTML } from "../shared/utils.js";
import storageManager from "../shared/storage-manager.js";
import mobileMenuController from "../shared/mobile-menu.js";

// Local State
let currentUser = null;
let allUsers = {};
let stages = {};
let tasks = {};

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
const btnRhPortal = document.getElementById('btn-rh-portal');
const drawerBtnRh = document.getElementById('drawer-btn-rh');
const btnIdeasPanel = document.getElementById('btn-ideas-panel');

// Kanban Board
const kanbanBoard = document.getElementById('kanban-board');
const addStageArea = document.getElementById('add-stage-area');

// Modals forms
const addStageForm = document.getElementById('add-stage-form');
const addTaskForm = document.getElementById('add-task-form');

if (btnIdeasPanel) {
  btnIdeasPanel.addEventListener('click', () => {
    window.location.href = 'ideas.html';
  });
}

initializeTheme();
setupThemeToggle();

// Boostrap Modal Instances (for closing programmatically)
let addStageModal, addTaskModal;

// Initialize Modals safely depending on document ready state
function initModals() {
  addStageModal = new bootstrap.Modal(document.getElementById('addStageModal'));
  addTaskModal = new bootstrap.Modal(document.getElementById('addTaskModal'));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initModals);
} else {
  initModals();
}

/* ==========================================
   AUTH & ROUTING FLOW
   ========================================== */

async function bootstrapApp() {
  try {
    const { user } = await api.get('/auth/me');
    currentUser = user;
    await startRealtimeSync();
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      showAuthUI();
    } else {
      console.error('Erro ao verificar sessão:', error);
      showAuthUI();
    }
  }
}

bootstrapApp();

// Realtime Sync Init
async function startRealtimeSync() {
  // Load cached data from localStorage first (for offline/quick load)
  const cachedTasks = storageManager.loadTasks();
  const cachedStages = storageManager.loadStages();

  if (Object.keys(cachedTasks).length > 0) {
    tasks = cachedTasks;
  }
  if (Object.keys(cachedStages).length > 0) {
    stages = cachedStages;
  }

  try {
    const [{ users }, { stages: stageList }, { tasks: taskList }] = await Promise.all([
      api.get('/users'),
      api.get('/stages'),
      api.get('/tasks')
    ]);

    allUsers = arrayToMap(users, 'uid');
    stages = arrayToMap(stageList);
    tasks = arrayToMap(taskList);

    storageManager.saveStages(stages);
    storageManager.saveTasks(tasks);

    populateAssigneeDropdowns();
    updateHeader();
    updatePermissionsUI();
    renderKanban();

    if (mobileMenuController) {
      mobileMenuController.updateUserInfo(currentUser.name, currentUser.role, getInitials(currentUser.name), currentUser.photoURL);
    }
  } catch (error) {
    console.error('Erro ao carregar dados do portal:', error);
  }

  setupSocketListeners();

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

function arrayToMap(list, idField = 'id') {
  const map = {};
  list.forEach(item => {
    map[item[idField]] = item;
  });
  return map;
}

/* ==========================================
   REALTIME EVENTS (SOCKET.IO)
   ========================================== */

let stageChatSocketHandler = null;
let taskChatSocketHandler = null;
let taskAttachmentCreatedHandler = null;
let taskAttachmentDeletedHandler = null;

function setupSocketListeners() {
  const socket = getSocket();

  socket.on('user:created', (user) => {
    allUsers[user.uid] = user;
    populateAssigneeDropdowns();
  });

  socket.on('user:updated', (user) => {
    allUsers[user.uid] = user;
    if (currentUser && user.uid === currentUser.uid) {
      currentUser = { ...currentUser, ...user };
      updateHeader();
      if (mobileMenuController) {
        mobileMenuController.updateUserInfo(currentUser.name, currentUser.role, getInitials(currentUser.name), currentUser.photoURL);
      }
    }
    populateAssigneeDropdowns();
    renderKanban();
  });

  socket.on('user:deleted', ({ uid }) => {
    delete allUsers[uid];
    populateAssigneeDropdowns();
    renderKanban();
  });

  socket.on('stage:created', (stage) => {
    stages[stage.id] = stage;
    storageManager.saveStages(stages);
    renderKanban();
  });

  socket.on('stage:deleted', ({ id }) => {
    delete stages[id];
    Object.keys(tasks).forEach(taskId => {
      if (tasks[taskId].stageId === id) delete tasks[taskId];
    });
    storageManager.saveStages(stages);
    storageManager.saveTasks(tasks);
    renderKanban();
  });

  socket.on('task:created', (task) => {
    tasks[task.id] = task;
    storageManager.saveTasks(tasks);
    renderKanban();
  });

  socket.on('task:updated', (task) => {
    tasks[task.id] = task;
    storageManager.saveTasks(tasks);
    renderKanban();
  });

  socket.on('task:deleted', ({ id }) => {
    delete tasks[id];
    storageManager.saveTasks(tasks);
    renderKanban();
  });
}

/* ==========================================
   AUTH ACTIONS
   ========================================== */

// Show Auth Form UI
function showAuthUI() {
  loadingOverlay.classList.add('d-none');
  mainApp.classList.add('d-none');
  authSection.classList.remove('d-none');
}

// Login Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  authAlert.classList.add('d-none');

  try {
    const { user } = await api.post('/auth/login', { email, password });
    currentUser = user;
    authSection.classList.add('d-none');
    await startRealtimeSync();
  } catch (error) {
    loadingOverlay.classList.add('d-none');
    showAuthError("Falha no login: verifique suas credenciais.");
    console.error(error);
  }
});

// Logout action
btnLogout.addEventListener('click', () => {
  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  api.post('/auth/logout').finally(() => {
    window.location.reload();
  });
});

if (headerUserAvatar) {
  headerUserAvatar.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
}

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
  else if (currentUser.role === 'Rh') badgeClass = 'role-rh';

  headerUserRoleBadge.innerHTML = `<span class="badge ${badgeClass}">${currentUser.role}</span>`;

  // Set Initials or Photo Avatar
  const initials = getInitials(currentUser.name);
  if (currentUser.photoURL) {
    headerUserAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  } else {
    headerUserAvatar.textContent = initials;
  }
}

function canModifyPortalContent() {
  return !!currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Integrante');
}

function updatePermissionsUI() {
  if (!currentUser) return;

  const isAdmin = currentUser.role === 'Admin';
  const isRh = currentUser.role === 'Rh';

  // Show Admin Portal Button & Stage Creation Controls
  if (isAdmin) {
    if (btnAdminPortal) btnAdminPortal.classList.remove('d-none');
    addStageArea.classList.remove('d-none');
  } else {
    if (btnAdminPortal) btnAdminPortal.classList.add('d-none');
    addStageArea.classList.add('d-none');
  }

  if (isAdmin || isRh) {
    if (btnRhPortal) btnRhPortal.classList.remove('d-none');
    if (drawerBtnRh) drawerBtnRh.classList.remove('d-none');
  } else {
    if (btnRhPortal) btnRhPortal.classList.add('d-none');
    if (drawerBtnRh) drawerBtnRh.classList.add('d-none');
  }
}

function populateAssigneeDropdowns() {
  const taskAssignee = document.getElementById('task-assignee');
  const promoteTaskAssignee = document.getElementById('promote-task-assignee');

  let options = '<option value="" disabled selected>Selecione um integrante...</option>';

  Object.keys(allUsers).forEach(uid => {
    const user = allUsers[uid];
    options += `<option value="${uid}">${user.name} (${user.role})</option>`;
  });

  if (taskAssignee) taskAssignee.innerHTML = options;
  if (promoteTaskAssignee) promoteTaskAssignee.innerHTML = options;
}

function getPriorityNotificationColor(priority = 'medium') {
  switch (priority) {
    case 'high': return '#dc2626';
    case 'medium': return '#ff6b00';
    case 'low': return '#2563eb';
    default: return '#00d4ff';
  }
}

function buildLucideNotificationIcon(priority = 'medium') {
  const color = getPriorityNotificationColor(priority);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 4.5 3 5.5 3 9H3c0-3.5 3-4.5 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function showAppToast(message, variant = 'info', accentColor = '#00d4ff', iconMarkup = '') {
  let toastContainer = document.getElementById('app-toast-container');

  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'app-toast-container';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1080';
    document.body.appendChild(toastContainer);
  }

  const iconContent = iconMarkup.startsWith('data:image/svg+xml')
    ? `<img src="${iconMarkup}" alt="" style="width: 18px; height: 18px; display: block;" />`
    : (iconMarkup || '<i data-lucide="shield-check" style="width: 18px; height: 18px;"></i>');

  const toastEl = document.createElement('div');
  toastEl.className = 'toast border-0 shadow-lg';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.style.background = 'rgba(10, 14, 24, 0.92)';
  toastEl.style.borderLeft = `4px solid ${accentColor}`;
  toastEl.style.backdropFilter = 'blur(6px)';
  toastEl.style.color = '#e6f7ff';
  toastEl.innerHTML = `
    <div class="d-flex align-items-start p-2">
      <div class="me-3 mt-1" style="font-size: 1.1rem; color: ${accentColor};">
        ${iconContent}
      </div>
      <div class="toast-body ps-1 pe-2">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;

  toastContainer.appendChild(toastEl);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  const toast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: 5000
  });

  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

function showTaskScheduledNotification(taskTitle, taskAssigneeName = 'Equipe', priority = 'medium') {
  const notificationTitle = 'Tarefa agendada';
  const notificationBody = `A tarefa "${taskTitle}" foi agendada para ${taskAssigneeName}.`;
  const accentColor = getPriorityNotificationColor(priority);
  const notificationIcon = buildLucideNotificationIcon(priority);

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, {
        body: notificationBody,
        icon: notificationIcon
      });
      return;
    }

    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(notificationTitle, {
            body: notificationBody,
            icon: notificationIcon
          });
        } else {
          showAppToast(notificationBody, 'info', accentColor, buildLucideNotificationIcon(priority));
        }
      }).catch(() => {
        showAppToast(notificationBody, 'info', accentColor, buildLucideNotificationIcon(priority));
      });
      return;
    }
  }

  showAppToast(notificationBody, 'info', accentColor, buildLucideNotificationIcon(priority));
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
      : '';    // Render header
    colDiv.innerHTML = `
      <div class="column-header">
        <h6 class="column-title"><i data-lucide="folder" class="text-info" style="width:16px;"></i> ${stage.title}</h6>
        ${deleteColBtn}
      </div>
      <div class="task-list" id="task-list-${stageId}" data-stage-id="${stageId}">
        <!-- Tasks rendered here -->
      </div>
      <div class="mt-3 d-flex flex-column gap-2">
        <button class="btn btn-cyber w-100 py-1.5 open-add-task-btn" data-stage-id="${stageId}" ${currentUser && !canModifyPortalContent() ? 'disabled' : ''}>
          <i data-lucide="plus" style="width: 16px;"></i> Adicionar Tarefa
        </button>
        <button class="btn btn-cyber-secondary w-100 py-1.5 open-stage-chat-btn" data-stage-id="${stageId}">
          <i data-lucide="messages-square" style="width: 16px;"></i> Abrir Chat da Etapa
        </button>
      </div>
    `;

    kanbanBoard.appendChild(colDiv);

    // Fill tasks
    const colTaskList = colDiv.querySelector(`.task-list`);
    const stageTasks = Object.keys(tasks)
      .map(id => ({ id, ...tasks[id] }))
      .filter(t => t.stageId === stageId)
      .filter(t => t.status !== 'done' && t.status !== 'failed');

    if (stageTasks.length === 0) {
      colTaskList.innerHTML = '<div class="text-center py-4 text-muted small drag-placeholder">Arraste tarefas aqui</div>';
    } else {
      stageTasks.forEach(task => {
        const assignee = allUsers[task.assigneeId] ? allUsers[task.assigneeId].name : 'Desconhecido';
        const initials = getInitials(assignee);

        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.setAttribute('draggable', currentUser && canModifyPortalContent() ? 'true' : 'false');
        taskCard.setAttribute('data-task-id', task.id);

        // Navigation buttons for accessibility/mobile
        const showNav = currentUser && canModifyPortalContent();
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
          <h6 class="text-light mb-1">${escapeHTML(task.title)}</h6>
          <p class="text-muted small mb-2 text-truncate-3">${escapeHTML(task.description)}</p>
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <div class="user-avatar" style="width: 24px; height: 24px; font-size: 0.65rem; box-shadow: none;" title="${assignee}">${initials}</div>
              <span class="text-muted small text-truncate" style="max-width: 100px;">${assignee}</span>
            </div>
            <div class="task-actions">
              ${leftBtn}
              ${rightBtn}
              <!-- Details & Chat button -->
              <button class="btn btn-sm btn-link text-info open-task-details-btn p-0 ms-1" data-task-id="${task.id}" title="Ver detalhes, chat e anexos">
                <i data-lucide="message-square" style="width:14px;"></i>
              </button>
              <!-- Completion buttons -->
              ${canModifyPortalContent() ? `
                <button class="btn btn-sm btn-cyber-success complete-task-btn ms-1" data-task-id="${task.id}" title="Concluir tarefa com sucesso">
                  <i data-lucide="check" style="width:14px;"></i>
                </button>
                <button class="btn btn-sm btn-cyber-danger fail-task-btn ms-1" data-task-id="${task.id}" title="Marcar tarefa como falha">
                  <i data-lucide="x" style="width:14px;"></i>
                </button>
              ` : ''}
              ${deleteBtn}
            </div>
          </div>
        `;

        // Reflect task status visually
        if (task.status === 'done') taskCard.classList.add('done');
        if (task.status === 'failed') taskCard.classList.add('failed');
        colTaskList.appendChild(taskCard);
      });
    }

    // Attach drag events to task cards (Desktop workflow)
    if (currentUser && canModifyPortalContent()) {
      setupDragAndDropEvents(colTaskList, stageId);
    }
  });

  // Attach event handlers to dynamic board buttons
  attachKanbanClickHandlers();
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
        await api.patch(`/tasks/${taskId}/move`, { stageId });
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

function attachKanbanClickHandlers() {
  // Delete Stage Handler
  document.querySelectorAll('.delete-stage-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stageId = btn.getAttribute('data-stage-id');
      if (confirm(`Tem certeza que deseja excluir esta etapa? Todas as tarefas desta coluna também serão apagadas.`)) {
        try {
          await api.delete(`/stages/${stageId}`);
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
          await api.delete(`/tasks/${taskId}`);
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
        await api.patch(`/tasks/${taskId}/move`, { stageId: targetStage });
      } catch (error) {
        console.error("Error moving task:", error);
      }
    });
  });

  // Complete Task (success) Handler
  document.querySelectorAll('.complete-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      if (!taskId) return;
      if (!confirm('Confirmar que esta tarefa foi finalizada com sucesso?')) return;

      try {
        await api.patch(`/tasks/${taskId}/status`, { status: 'done' });
      } catch (error) {
        console.error('Erro ao marcar tarefa como concluída:', error);
        alert('Erro ao atualizar tarefa: ' + error.message);
      }
    });
  });

  // Fail Task Handler
  document.querySelectorAll('.fail-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      if (!taskId) return;
      if (!confirm('Confirmar que esta tarefa falhou/exige retrabalho?')) return;

      try {
        await api.patch(`/tasks/${taskId}/status`, { status: 'failed' });
      } catch (error) {
        console.error('Erro ao marcar tarefa como falha:', error);
        alert('Erro ao atualizar tarefa: ' + error.message);
      }
    });
  });

  // Stage Chat Handler
  document.querySelectorAll('.open-stage-chat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stageId = btn.getAttribute('data-stage-id');
      openStageChat(stageId);
    });
  });

  // Task Details Handler
  document.querySelectorAll('.open-task-details-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      openTaskDetails(taskId);
    });
  });
}

// Add Stage Submission
addStageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('new-stage-title').value.trim();

  try {
    await api.post('/stages', { title });
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
    await api.post('/tasks', { title, description, priority, assigneeId, stageId });

    const assigneeName = allUsers[assigneeId]?.name || 'Equipe';
    showTaskScheduledNotification(title, assigneeName, priority);

    addTaskModal.hide();
    addTaskForm.reset();
  } catch (error) {
    alert("Erro ao adicionar tarefa: permissão negada.");
  }
});

// ============================================
// CHAT & ATTACHMENTS FOR STAGES & TASKS
// ============================================

let openStageChatId = null;
const stageChatModalEl = document.getElementById('stageChatModal');
let stageChatModal = null;

if (stageChatModalEl) {
  stageChatModal = new bootstrap.Modal(stageChatModalEl);
  stageChatModalEl.addEventListener('hidden.bs.modal', () => {
    openStageChatId = null;
    if (stageChatSocketHandler) {
      getSocket().off('stageChatMessage:created', stageChatSocketHandler);
      stageChatSocketHandler = null;
    }
  });
}

function renderChatMessage(container, msg) {
  const isMine = msg.senderId === (currentUser ? currentUser.uid : null);

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isMine ? 'message-mine' : 'message-other'}`;

  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(msg.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' });

  messageDiv.innerHTML = `
    <div class="message-info">${isMine ? 'Você' : escapeHTML(msg.senderName)} • ${dateStr} às ${timeStr}</div>
    <div class="message-bubble rounded shadow-sm">${escapeHTML(msg.text)}</div>
  `;

  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

async function openStageChat(stageId) {
  if (!stages[stageId]) return;

  openStageChatId = stageId;
  document.getElementById('stage-chat-title-span').textContent = stages[stageId].title;

  const messagesContainer = document.getElementById('stage-chat-messages');
  messagesContainer.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm text-info me-2"></div>Carregando mensagens...</div>';

  const chatForm = document.getElementById('stage-chat-form');
  chatForm.reset();

  try {
    const { messages } = await api.get(`/chat/stages/${stageId}/messages`);
    messagesContainer.innerHTML = '';
    if (messages.length === 0) {
      messagesContainer.innerHTML = '<div class="text-center py-4 text-muted small">Nenhuma mensagem nesta etapa ainda. Envie a primeira!</div>';
    } else {
      messages.forEach(msg => renderChatMessage(messagesContainer, msg));
    }
  } catch (error) {
    console.error('Erro ao carregar mensagens da etapa:', error);
    messagesContainer.innerHTML = '<div class="text-center py-4 text-danger small">Erro ao carregar mensagens.</div>';
  }

  if (stageChatSocketHandler) {
    getSocket().off('stageChatMessage:created', stageChatSocketHandler);
  }
  stageChatSocketHandler = (msg) => {
    if (msg.stageId !== openStageChatId) return;
    const emptyState = messagesContainer.querySelector('.text-muted.small');
    if (emptyState && messagesContainer.children.length === 1) messagesContainer.innerHTML = '';
    renderChatMessage(messagesContainer, msg);
  };
  getSocket().on('stageChatMessage:created', stageChatSocketHandler);

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Você precisa estar logado para enviar mensagens.");
      return;
    }

    const input = document.getElementById('stage-chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
      await api.post(`/chat/stages/${stageId}/messages`, { text });
      input.value = '';
    } catch (error) {
      console.error("Erro ao enviar mensagem na etapa:", error);
      alert("Erro ao enviar mensagem: permissão negada.");
    }
  };

  stageChatModal.show();
}

let openTaskDetailsId = null;
const taskDetailsModalEl = document.getElementById('taskDetailsModal');
let taskDetailsModal = null;

if (taskDetailsModalEl) {
  taskDetailsModal = new bootstrap.Modal(taskDetailsModalEl);
  taskDetailsModalEl.addEventListener('hidden.bs.modal', () => {
    openTaskDetailsId = null;
    const socket = getSocket();
    if (taskChatSocketHandler) {
      socket.off('taskChatMessage:created', taskChatSocketHandler);
      taskChatSocketHandler = null;
    }
    if (taskAttachmentCreatedHandler) {
      socket.off('taskAttachment:created', taskAttachmentCreatedHandler);
      taskAttachmentCreatedHandler = null;
    }
    if (taskAttachmentDeletedHandler) {
      socket.off('taskAttachment:deleted', taskAttachmentDeletedHandler);
      taskAttachmentDeletedHandler = null;
    }
  });
}

function renderAttachmentItem(container, file) {
  const isMine = file.uploadedBy === (currentUser ? currentUser.uid : null);
  const isAdmin = currentUser && currentUser.role === 'Admin';

  const itemDiv = document.createElement('div');
  itemDiv.className = 'attachment-item';
  itemDiv.setAttribute('data-attachment-id', file.id);

  const isImage = file.type.startsWith('image/');
  let mediaPreview = '';
  if (isImage) {
    mediaPreview = `<img class="attachment-thumb" src="${file.url}" alt="${escapeHTML(file.name)}" />`;
  } else {
    let iconName = 'file';
    if (file.type === 'application/pdf') iconName = 'file-text';
    else if (file.type.includes('word') || file.type.includes('officedocument')) iconName = 'file-type-2';

    mediaPreview = `
      <div class="attachment-icon-wrapper">
        <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
      </div>
    `;
  }

  const canDelete = isMine || isAdmin;
  const deleteBtnMarkup = canDelete
    ? `<button class="btn btn-sm btn-link text-danger p-1 delete-attachment-btn" data-attachment-id="${file.id}"><i data-lucide="trash-2" style="width: 16px;"></i></button>`
    : '';

  itemDiv.innerHTML = `
    <div class="attachment-meta">
      ${mediaPreview}
      <div class="attachment-name-box">
        <a href="${file.url}" target="_blank" class="attachment-name text-truncate d-block" style="max-width: 170px;" title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</a>
        <div class="attachment-info-sub">Por ${escapeHTML(file.uploadedByName)}</div>
      </div>
    </div>
    <div>
      ${deleteBtnMarkup}
    </div>
  `;

  container.appendChild(itemDiv);

  const deleteBtn = itemDiv.querySelector('.delete-attachment-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm("Deseja realmente excluir este anexo?")) return;
      try {
        await api.delete(`/attachments/${file.id}`);
      } catch (error) {
        console.error("Erro ao deletar anexo:", error);
        alert("Erro ao excluir o anexo: " + error.message);
      }
    };
  }
}

async function openTaskDetails(taskId) {
  const task = tasks[taskId];
  if (!task) return;

  openTaskDetailsId = taskId;
  document.getElementById('task-details-title').textContent = task.title;

  const priorityEl = document.getElementById('task-details-priority');
  priorityEl.className = `task-priority priority-${task.priority}`;
  priorityEl.textContent = task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa';

  const statusEl = document.getElementById('task-details-status');
  statusEl.textContent = task.status === 'done' ? 'Concluída' : task.status === 'failed' ? 'Falhou' : 'Pendente';
  statusEl.className = `badge ${task.status === 'done' ? 'bg-success' : task.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`;

  document.getElementById('task-details-description').textContent = task.description;

  const assignee = allUsers[task.assigneeId] ? allUsers[task.assigneeId].name : 'Desconhecido';
  const assigneeInitials = getInitials(assignee);
  document.getElementById('task-details-assignee-name').textContent = assignee;

  const assigneeAvatarEl = document.getElementById('task-details-assignee-avatar');
  const assigneeUser = allUsers[task.assigneeId];
  if (assigneeUser && assigneeUser.photoURL) {
    assigneeAvatarEl.innerHTML = `<img src="${assigneeUser.photoURL}" alt="" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
  } else {
    assigneeAvatarEl.innerHTML = assigneeInitials;
  }

  const creator = allUsers[task.creatorId] ? allUsers[task.creatorId].name : 'Desconhecido';
  document.getElementById('task-details-creator-name').textContent = creator;

  document.getElementById('task-details-created-at').textContent = new Date(task.createdAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  document.getElementById('task-details-scheduled-at').textContent = new Date(task.scheduledAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Chat
  const chatMessagesContainer = document.getElementById('task-chat-messages');
  chatMessagesContainer.innerHTML = '<div class="text-center py-3 text-muted small"><div class="spinner-border spinner-border-sm text-info me-2"></div>Carregando chat...</div>';

  const chatForm = document.getElementById('task-chat-form');
  chatForm.reset();

  try {
    const { messages } = await api.get(`/chat/tasks/${taskId}/messages`);
    chatMessagesContainer.innerHTML = '';
    if (messages.length === 0) {
      chatMessagesContainer.innerHTML = '<div class="text-center py-4 text-muted small">Nenhuma mensagem neste chat ainda.</div>';
    } else {
      messages.forEach(msg => renderChatMessage(chatMessagesContainer, msg));
    }
  } catch (error) {
    console.error('Erro ao carregar chat da tarefa:', error);
    chatMessagesContainer.innerHTML = '<div class="text-center py-4 text-danger small">Erro ao carregar chat.</div>';
  }

  const socket = getSocket();
  if (taskChatSocketHandler) socket.off('taskChatMessage:created', taskChatSocketHandler);
  taskChatSocketHandler = (msg) => {
    if (msg.taskId !== openTaskDetailsId) return;
    if (chatMessagesContainer.children.length === 1 && chatMessagesContainer.querySelector('.text-muted.small')) {
      chatMessagesContainer.innerHTML = '';
    }
    renderChatMessage(chatMessagesContainer, msg);
  };
  socket.on('taskChatMessage:created', taskChatSocketHandler);

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const input = document.getElementById('task-chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
      await api.post(`/chat/tasks/${taskId}/messages`, { text });
      input.value = '';
    } catch (error) {
      console.error("Erro ao enviar mensagem na tarefa:", error);
      alert("Erro ao enviar mensagem: permissão negada.");
    }
  };

  // Attachments
  const attachmentsListContainer = document.getElementById('task-attachments-list');
  attachmentsListContainer.innerHTML = '<div class="text-center py-3 text-muted small">Carregando anexos...</div>';

  const uploadFileInput = document.getElementById('task-attachment-file');
  uploadFileInput.value = '';

  const btnUpload = document.getElementById('btn-upload-attachment');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');

  progressContainer.classList.add('d-none');
  progressBar.style.width = '0%';

  try {
    const { attachments } = await api.get(`/tasks/${taskId}/attachments`);
    attachmentsListContainer.innerHTML = '';
    if (attachments.length === 0) {
      attachmentsListContainer.innerHTML = '<div class="text-center py-4 text-muted small">Nenhum anexo nesta tarefa.</div>';
    } else {
      attachments.forEach(file => renderAttachmentItem(attachmentsListContainer, file));
    }
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Erro ao carregar anexos:', error);
    attachmentsListContainer.innerHTML = '<div class="text-center py-4 text-danger small">Erro ao carregar anexos.</div>';
  }

  if (taskAttachmentCreatedHandler) socket.off('taskAttachment:created', taskAttachmentCreatedHandler);
  taskAttachmentCreatedHandler = (file) => {
    if (file.taskId !== openTaskDetailsId) return;
    const emptyState = attachmentsListContainer.querySelector('.text-muted.small');
    if (emptyState) attachmentsListContainer.innerHTML = '';
    renderAttachmentItem(attachmentsListContainer, file);
    if (window.lucide) lucide.createIcons();
  };
  socket.on('taskAttachment:created', taskAttachmentCreatedHandler);

  if (taskAttachmentDeletedHandler) socket.off('taskAttachment:deleted', taskAttachmentDeletedHandler);
  taskAttachmentDeletedHandler = ({ id, taskId: deletedTaskId }) => {
    if (deletedTaskId !== openTaskDetailsId) return;
    const item = attachmentsListContainer.querySelector(`[data-attachment-id="${id}"]`);
    if (item) item.remove();
    if (attachmentsListContainer.children.length === 0) {
      attachmentsListContainer.innerHTML = '<div class="text-center py-4 text-muted small">Nenhum anexo nesta tarefa.</div>';
    }
  };
  socket.on('taskAttachment:deleted', taskAttachmentDeletedHandler);

  btnUpload.onclick = async () => {
    if (!currentUser) return;
    if (currentUser.role === 'Visualizador') {
      alert("Visualizadores não podem enviar arquivos.");
      return;
    }

    const file = uploadFileInput.files[0];
    if (!file) {
      alert("Selecione um arquivo primeiro.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo não pode exceder o tamanho máximo de 10MB.");
      return;
    }

    btnUpload.disabled = true;
    progressContainer.classList.remove('d-none');
    progressBar.style.width = '0%';

    try {
      progressBar.style.width = '50%';
      const formData = new FormData();
      formData.append('file', file);
      await api.upload(`/tasks/${taskId}/attachments`, formData);
      progressBar.style.width = '100%';

      uploadFileInput.value = '';
      setTimeout(() => {
        progressContainer.classList.add('d-none');
        progressBar.style.width = '0%';
        btnUpload.disabled = false;
      }, 1000);

    } catch (error) {
      console.error("Erro no upload do arquivo:", error);
      alert("Erro ao enviar o arquivo: " + error.message);
      progressContainer.classList.add('d-none');
      btnUpload.disabled = false;
    }
  };

  const chatTabButton = document.getElementById('task-chat-tab');
  if (chatTabButton) {
    bootstrap.Tab.getOrCreateInstance(chatTabButton).show();
  }

  taskDetailsModal.show();
}
