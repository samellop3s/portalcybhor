import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { firebaseConfig } from "../shared/config.js";
import StorageManager from "../shared/storage-manager.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Initialize Storage Manager for local persistence
const storageManager = new StorageManager();

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
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeStorageKey = 'cybhorTheme';

// Admin Portal Redirect Link
const btnAdminPortal = document.getElementById('btn-admin-portal');
const btnIdeasPanel = document.getElementById('btn-ideas-panel');

// Kanban Board
const kanbanBoard = document.getElementById('kanban-board');
const addStageArea = document.getElementById('add-stage-area');
const projectStagesColumn = document.getElementById('project-stages-column');

// Modals forms
const addStageForm = document.getElementById('add-stage-form');
const addTaskForm = document.getElementById('add-task-form');

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  if (btnThemeToggle) {
    btnThemeToggle.innerHTML = isDark
      ? '<i data-lucide="sun" class="align-middle"></i>'
      : '<i data-lucide="moon" class="align-middle"></i>';
    btnThemeToggle.setAttribute('aria-label', isDark ? 'Modo claro' : 'Modo escuro');
  }
  localStorage.setItem(themeStorageKey, theme);
  if (window.lucide) lucide.createIcons();
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  const defaultTheme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(defaultTheme);
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

if (btnIdeasPanel) {
  btnIdeasPanel.addEventListener('click', () => {
    window.location.href = 'ideas.html';
  });
}

initializeTheme();

// Boostrap Modal Instances (for closing programmatically)
let addStageModal, addTaskModal;

// Initialize Modals safely depending on document ready state
function initModals() {
  addStageModal = new bootstrap.Modal(document.getElementById('addStageModal'));
  addTaskModal = new bootstrap.Modal(document.getElementById('addTaskModal'));
  // Ideas modals moved to ideas.html
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
        const registerNameInput = document.getElementById('register-name');
        const fallbackName = registerNameInput ? registerNameInput.value.trim() : '';
        const name = user.displayName || fallbackName || 'Usuário Cybhor';
        await set(userRef, {
          name: name,
          email: user.email,
          role: role,
          profileMessage: '',
          profileCreatedAt: Date.now()
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

async function ensureUserProfileDefaults(uid, userData) {
  const updates = {};

  if (typeof userData.profileMessage === 'undefined' || userData.profileMessage === null) {
    updates.profileMessage = '';
  }

  if (typeof userData.profileCreatedAt === 'undefined' || userData.profileCreatedAt === null) {
    updates.profileCreatedAt = Date.now();
  }

  if (!userData.name || userData.name.trim().length === 0) {
    updates.name = 'Usuário Cybhor';
  }

  if (!userData.email) {
    updates.email = '';
  }

  if (!userData.role) {
    updates.role = 'Integrante';
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(db, `users/${uid}`), updates);
  }
}

// Realtime Sync Init
function startRealtimeSync(uid) {
  // Load cached data from localStorage first (for offline/quick load)
  const cachedTasks = storageManager.loadTasks();
  const cachedIdeas = storageManager.loadIdeas();
  const cachedStages = storageManager.loadStages();
  
  if (Object.keys(cachedTasks).length > 0) {
    tasks = cachedTasks;
  }
  if (Object.keys(cachedIdeas).length > 0) {
    ideas = cachedIdeas;
  }
  if (Object.keys(cachedStages).length > 0) {
    stages = cachedStages;
  }

  // 1. Sync current user details
  const userListener = onValue(ref(db, `users/${uid}`), async (snapshot) => {
    if (snapshot.exists()) {
      currentUser = { uid, ...snapshot.val() };
      await ensureUserProfileDefaults(uid, currentUser);
      const refreshedSnapshot = await get(ref(db, `users/${uid}`));
      if (refreshedSnapshot.exists()) {
        currentUser = { uid, ...refreshedSnapshot.val() };
      }
      updateHeader();
      updatePermissionsUI();
      
      // Sync mobile drawer if controller is initialized
      if (window.mobileMenuController) {
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        window.mobileMenuController.updateUserInfo(currentUser.name, currentUser.role, initials, currentUser.photoURL);
      }
      
      // renderUserProfilePanel() moved to profile.html
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
    storageManager.saveStages(stages);
    renderKanban();
  });
  activeListeners.push(stagesListener);

  // 4. Sync tasks
  const tasksListener = onValue(ref(db, 'tasks'), (snapshot) => {
    tasks = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveTasks(tasks);
    renderKanban();
  });
  activeListeners.push(tasksListener);

  // 5. Sync ideas
  const ideasListener = onValue(ref(db, 'ideas'), (snapshot) => {
    ideas = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveIdeas(ideas);
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
  
  headerUserRoleBadge.innerHTML = `<span class="badge ${badgeClass}">${currentUser.role}</span>`;
  
  // Set Initials or Photo Avatar
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  if (currentUser.photoURL) {
    headerUserAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  } else {
    headerUserAvatar.textContent = initials;
  }
}

// renderUserProfilePanel moved to profile.html page
// This function is no longer needed as profile panel is now on a dedicated page

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
      .filter(t => t.stageId === stageId)
      .filter(t => t.status !== 'done' && t.status !== 'failed');
      
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
              <!-- Completion buttons -->
              <button class="btn btn-sm btn-cyber-success complete-task-btn ms-1" data-task-id="${task.id}" title="Concluir tarefa com sucesso">
                <i data-lucide="check" style="width:14px;"></i>
              </button>
              <button class="btn btn-sm btn-cyber-danger fail-task-btn ms-1" data-task-id="${task.id}" title="Marcar tarefa como falha">
                <i data-lucide="x" style="width:14px;"></i>
              </button>
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

  // Complete Task (success) Handler
  document.querySelectorAll('.complete-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-task-id');
      if (!taskId) return;
      if (!confirm('Confirmar que esta tarefa foi finalizada com sucesso?')) return;

      try {
        await update(ref(db, `tasks/${taskId}`), {
          status: 'done',
          completedAt: Date.now(),
          completedBy: currentUser ? currentUser.uid : null
        });
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
        await update(ref(db, `tasks/${taskId}`), {
          status: 'failed',
          completedAt: Date.now(),
          completedBy: currentUser ? currentUser.uid : null
        });
      } catch (error) {
        console.error('Erro ao marcar tarefa como falha:', error);
        alert('Erro ao atualizar tarefa: ' + error.message);
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
    const scheduledAt = Date.now();
    await set(newTaskRef, {
      title,
      description,
      priority,
      assigneeId,
      stageId,
      creatorId: currentUser.uid,
      createdAt: scheduledAt,
      scheduledAt,
      status: 'pending'
    });

    const assigneeName = allUsers[assigneeId]?.name || 'Equipe';
    showTaskScheduledNotification(title, assigneeName, priority);

    addTaskModal.hide();
    addTaskForm.reset();
  } catch (error) {
    alert("Erro ao adicionar tarefa: permissão negada.");
  }
});

/* ==========================================
   IDEAS & VOTING PANEL (Moved to ideas.html)
   ========================================== */

function renderIdeas() {
  // Ideas rendering moved to dedicated ideas.html page
  // This stub kept for backward compatibility with startRealtimeSync()
}
