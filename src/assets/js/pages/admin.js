import { api, ApiError } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import { initializeTheme, setupThemeToggle } from "../shared/theme.js";
import { getInitials } from "../shared/utils.js";
import storageManager from "../shared/storage-manager.js";
import mobileMenuController from "../shared/mobile-menu.js";

// State
let currentAdmin = null;
let allUsers = {};
let allTasks = {};

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const authAlert = document.getElementById('auth-alert');

// Forms & Inputs
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');

// Header Elements
const headerUserName = document.getElementById('header-user-name');
const headerUserAvatar = document.getElementById('header-user-avatar');
const btnLogout = document.getElementById('btn-logout');

// Table list
const adminMembersList = document.getElementById('admin-members-list');

initializeTheme();
setupThemeToggle();

function arrayToMap(list, idField = 'id') {
  const map = {};
  list.forEach(item => {
    map[item[idField]] = item;
  });
  return map;
}

/* ==========================================
   AUTH & SECURITY CHECKS
   ========================================== */

async function checkAdminAccess() {
  try {
    const { user } = await api.get('/auth/me');

    if (user.role === 'Admin') {
      currentAdmin = user;
      await startAdminRealtimeSync();
    } else {
      showAuthError("Acesso Negado: Esta conta não possui privilégios de Administrador.");
      await api.post('/auth/logout');
    }
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      showLoginScreen();
      return;
    }
    console.error("Authorization check error:", error);
    showAuthError("Erro na autenticação de segurança.");
  }
}

checkAdminAccess();

function showLoginScreen() {
  loadingOverlay.classList.add('d-none');
  mainApp.classList.add('d-none');
  authSection.classList.remove('d-none');
}

function showAuthError(message) {
  authAlert.textContent = message;
  authAlert.classList.remove('d-none');
  loadingOverlay.classList.add('d-none');
}

// Login Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  authAlert.classList.add('d-none');

  try {
    const { user } = await api.post('/auth/login', { email, password });
    if (user.role !== 'Admin') {
      await api.post('/auth/logout');
      loadingOverlay.classList.add('d-none');
      showAuthError("Acesso Negado: Esta conta não possui privilégios de Administrador.");
      return;
    }
    currentAdmin = user;
    await startAdminRealtimeSync();
  } catch (error) {
    loadingOverlay.classList.add('d-none');
    showAuthError("Erro de Login: E-mail ou senha incorretos.");
    console.error(error);
  }
});

// Logout Action
btnLogout.addEventListener('click', () => {
  loadingOverlay.classList.remove('d-none');
  loadingOverlay.style.opacity = '1';
  api.post('/auth/logout').finally(() => {
    window.location.reload();
  });
});

/* ==========================================
   REALTIME ADMIN DATABASE SYNC
   ========================================== */

async function startAdminRealtimeSync() {
  try {
    const [{ users }, { tasks }] = await Promise.all([
      api.get('/users'),
      api.get('/tasks')
    ]);

    allUsers = arrayToMap(users, 'uid');
    allTasks = arrayToMap(tasks);
    storageManager.saveTasks(allTasks);

    updateHeader();
    renderAdminPanel();

    if (mobileMenuController) {
      mobileMenuController.updateUserInfo(currentAdmin.name, currentAdmin.role, getInitials(currentAdmin.name), currentAdmin.photoURL);
    }
  } catch (error) {
    console.error('Erro ao carregar dados administrativos:', error);
  }

  const socket = getSocket();

  socket.on('user:created', (user) => {
    allUsers[user.uid] = user;
    renderAdminPanel();
  });

  socket.on('user:updated', (user) => {
    allUsers[user.uid] = user;
    if (user.uid === currentAdmin.uid) {
      currentAdmin = { ...currentAdmin, ...user };
      if (currentAdmin.role !== 'Admin') {
        alert("Sua permissão de Administrador foi revogada.");
        api.post('/auth/logout').finally(() => window.location.reload());
        return;
      }
      updateHeader();
      if (mobileMenuController) {
        mobileMenuController.updateUserInfo(currentAdmin.name, currentAdmin.role, getInitials(currentAdmin.name), currentAdmin.photoURL);
      }
    }
    renderAdminPanel();
  });

  socket.on('user:deleted', ({ uid }) => {
    delete allUsers[uid];
    renderAdminPanel();
  });

  socket.on('task:created', (task) => { allTasks[task.id] = task; storageManager.saveTasks(allTasks); });
  socket.on('task:updated', (task) => { allTasks[task.id] = task; storageManager.saveTasks(allTasks); });
  socket.on('task:deleted', ({ id }) => { delete allTasks[id]; storageManager.saveTasks(allTasks); });

  // Smooth loading transition
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

/* ==========================================
   BRAND ANIMATION INITIALIZER
   Splits the brand name into spans for staggered animation
   ========================================== */
function initBrandAnimation() {
  const brand = document.getElementById('brand-name');
  if (!brand) return;
  const text = brand.textContent.trim();
  brand.setAttribute('aria-label', text);
  brand.innerHTML = '';

  // Create spans for each character to stagger animation
  text.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'brand-letter';
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    span.style.animationDelay = `${i * 60}ms`;
    brand.appendChild(span);
  });

  // Restart animation on mouseenter for flair
  brand.addEventListener('mouseenter', () => {
    brand.querySelectorAll('.brand-letter').forEach((el, idx) => {
      el.style.animation = 'none';
      // Force reflow
      void el.offsetWidth;
      el.style.animation = '';
      el.style.animationDelay = `${idx * 40}ms`;
    });
  });
}

// Initialize brand animation on load
initBrandAnimation();

function updateHeader() {
  if (!currentAdmin) return;
  headerUserName.textContent = currentAdmin.name;
  const initials = getInitials(currentAdmin.name);
  if (currentAdmin.photoURL) {
    headerUserAvatar.innerHTML = `<img src="${currentAdmin.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  } else {
    headerUserAvatar.textContent = initials;
  }
}

/* ==========================================
   MEMBER ROLE MANAGEMENT RENDER
   ========================================== */

function renderAdminPanel() {
  if (!currentAdmin) return;

  adminMembersList.innerHTML = '';

  Object.keys(allUsers).forEach(uid => {
    const user = allUsers[uid];
    const isSelf = uid === currentAdmin.uid;

    let selectHtml = `
      <select class="form-select form-select-cyber member-role-select" data-uid="${uid}" ${isSelf ? 'disabled' : ''}>
        <option value="Integrante" ${user.role === 'Integrante' ? 'selected' : ''}>Integrante</option>
        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
        <option value="Visualizador" ${user.role === 'Visualizador' ? 'selected' : ''}>Visualizador</option>
      </select>
    `;

    let badgeClass = 'role-visualizador';
    if (user.role === 'Admin') badgeClass = 'role-admin';
    else if (user.role === 'Integrante') badgeClass = 'role-integrante';

    const tr = document.createElement('tr');
    tr.className = 'member-row';
    tr.innerHTML = `
      <td class="fw-bold text-white">${user.name} ${isSelf ? '<small class="text-info font-monospace">(Você)</small>' : ''}</td>
      <td class="text-muted small">${user.email}</td>
      <td><span class="badge ${badgeClass}">${user.role}</span></td>
      <td>
        <button type="button" class="btn btn-cyber btn-cyber-danger btn-sm delete-member-btn" data-uid="${uid}" ${isSelf ? 'disabled' : ''}>
          <i data-lucide="trash-2" style="width: 14px;"></i> Remover
        </button>
      </td>
      <td>${selectHtml}</td>
    `;

    adminMembersList.appendChild(tr);
  });

  // Attach change event listener to selects
  document.querySelectorAll('.member-role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const targetUid = e.target.getAttribute('data-uid');
      const newRole = e.target.value;

      try {
        await api.patch(`/users/${targetUid}/role`, { role: newRole });
      } catch (error) {
        alert("Erro ao alterar cargo: Acesso não autorizado.");
        console.error(error);
        renderAdminPanel(); // Reset UI
      }
    });
  });

  // Attach delete member buttons
  document.querySelectorAll('.delete-member-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.getAttribute('data-uid');
      if (!targetUid) return;
      if (!confirm('Deseja realmente remover este usuário do sistema? Esta ação excluirá o registro de cadastro e desatribuirá tarefas/votos.')) {
        return;
      }

      try {
        await api.delete(`/users/${targetUid}`);
        alert('Usuário removido do cadastro e dependências atualizadas com sucesso.');
      } catch (error) {
        console.error('Erro ao remover usuário:', error);
        alert('Falha ao remover usuário. Verifique suas permissões.');
      }
    });
  });
}

/* ==========================================
   SECURE ADMIN REGISTRATION OF NEW MEMBERS
   ========================================== */

const registerMemberForm = document.getElementById('register-member-form');
const regName = document.getElementById('reg-member-name');
const regEmail = document.getElementById('reg-member-email');
const regPassword = document.getElementById('reg-member-password');
const regRole = document.getElementById('reg-member-role');
const modalErrorAlert = document.getElementById('modal-error-alert');

if (registerMemberForm) {
  registerMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = regName.value.trim();
    const email = regEmail.value.trim();
    const password = regPassword.value;
    const role = regRole.value;

    modalErrorAlert.classList.add('d-none');

    if (password.length < 6) {
      modalErrorAlert.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      modalErrorAlert.classList.remove('d-none');
      return;
    }

    try {
      await api.post('/users', { name, email, password, role });

      // Close Bootstrap modal
      const registerModalEl = document.getElementById('registerMemberModal');
      const registerModal = bootstrap.Modal.getInstance(registerModalEl);
      if (registerModal) registerModal.hide();

      registerMemberForm.reset();
      alert(`Membro "${name}" cadastrado com sucesso!`);
    } catch (error) {
      console.error("Error registering user:", error);
      modalErrorAlert.textContent = "Erro ao cadastrar: " + (error.message || 'Tente novamente.');
      modalErrorAlert.classList.remove('d-none');
    }
  });
}
