import { api, ApiError } from "../shared/api-client.js?v=20260806fix";
import { getSocket } from "../shared/socket-client.js?v=20260806fix";
import { getInitials } from "../shared/utils.js";
import storageManager from "../shared/storage-manager.js";
import mobileMenuController from "../shared/mobile-menu.js";
import { renderPortalChrome, updateShellUserUI } from "../shared/portal-shell.js?v=20260806fix";

let currentAdmin = null;
let allUsers = {};
let allTasks = {};
let shellMenuController = null;

const loadingOverlay = document.getElementById('loading-overlay');
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const authAlert = document.getElementById('auth-alert');

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');

function arrayToMap(list, idField = 'id') {
  const map = {};
  if (!Array.isArray(list)) return map;
  list.forEach((item) => {
    if (item && item[idField] != null) {
      map[item[idField]] = item;
    }
  });
  return map;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function showMainApp() {
  loadingOverlay.style.opacity = '0';
  setTimeout(() => loadingOverlay.classList.add('d-none'), 300);
  authSection.classList.add('d-none');
  mainApp.classList.remove('d-none');
}

function getMembersListEl() {
  return document.getElementById('admin-members-list');
}

function getSortedUsers() {
  return Object.values(allUsers).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
  );
}

function renderAdminPanel(errorMessage = '') {
  const listEl = getMembersListEl();
  if (!listEl) {
    console.error('Elemento #admin-members-list não encontrado no DOM.');
    return;
  }

  const usersList = getSortedUsers();
  const countEl = document.getElementById('admin-users-count');
  if (countEl) countEl.textContent = String(usersList.length);

  if (errorMessage) {
    listEl.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger py-4">${escapeHtml(errorMessage)}</td>
      </tr>
    `;
    return;
  }

  if (!usersList.length) {
    listEl.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          Nenhuma conta cadastrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  listEl.innerHTML = '';

  usersList.forEach((user) => {
    const uid = user.uid;
    const isSelf = currentAdmin && uid === currentAdmin.uid;

    const selectHtml = `
      <select class="form-select form-select-cyber member-role-select" data-uid="${uid}" ${isSelf ? 'disabled' : ''}>
        <option value="Integrante" ${user.role === 'Integrante' ? 'selected' : ''}>Integrante</option>
        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
        <option value="Visualizador" ${user.role === 'Visualizador' ? 'selected' : ''}>Visualizador</option>
        <option value="Rh" ${user.role === 'Rh' ? 'selected' : ''}>Rh</option>
      </select>
    `;

    let badgeClass = 'role-visualizador';
    if (user.role === 'Admin') badgeClass = 'role-admin';
    else if (user.role === 'Integrante') badgeClass = 'role-integrante';
    else if (user.role === 'Rh') badgeClass = 'role-rh';

    const tr = document.createElement('tr');
    tr.className = 'member-row';
    tr.dataset.uid = uid;
    tr.innerHTML = `
      <td class="fw-bold">
        ${escapeHtml(user.name || '-')}
        ${isSelf ? '<small class="text-info font-monospace ms-1">(Você)</small>' : ''}
      </td>
      <td class="small">${escapeHtml(user.email || '-')}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(user.role || '-')}</span></td>
      <td>
        <button type="button" class="btn btn-cyber btn-cyber-danger btn-sm delete-member-btn" data-uid="${uid}" ${isSelf ? 'disabled' : ''}>
          <i data-lucide="trash-2" style="width: 14px;"></i> Remover
        </button>
      </td>
      <td>${selectHtml}</td>
    `;
    listEl.appendChild(tr);
  });

  document.querySelectorAll('.member-role-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const targetUid = e.target.getAttribute('data-uid');
      const newRole = e.target.value;
      try {
        await api.patch(`/users/${targetUid}/role`, { role: newRole });
      } catch (error) {
        alert('Erro ao alterar cargo: Acesso não autorizado.');
        console.error(error);
        await loadUsersAndRender();
      }
    });
  });

  document.querySelectorAll('.delete-member-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.getAttribute('data-uid');
      if (!targetUid) return;
      if (!confirm('Deseja realmente remover este usuário do sistema?')) return;
      try {
        await api.delete(`/users/${targetUid}`);
        delete allUsers[targetUid];
        renderAdminPanel();
      } catch (error) {
        console.error('Erro ao remover usuário:', error);
        alert('Falha ao remover usuário. Verifique suas permissões.');
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

async function loadUsersAndRender() {
  try {
    const [{ users }, { tasks }] = await Promise.all([
      api.get('/users'),
      api.get('/tasks')
    ]);

    allUsers = arrayToMap(users, 'uid');
    allTasks = arrayToMap(tasks, 'id');
    storageManager.saveTasks(allTasks);
    renderAdminPanel();
    return true;
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    renderAdminPanel(error.message || 'Falha ao carregar contas. Recarregue a página.');
    return false;
  }
}

function bindRealtime() {
  try {
    const socket = getSocket();
    socket.on('user:created', (user) => {
      if (user?.uid) {
        allUsers[user.uid] = user;
        renderAdminPanel();
      }
    });
    socket.on('user:updated', (user) => {
      if (!user?.uid) return;
      allUsers[user.uid] = user;
      if (currentAdmin && user.uid === currentAdmin.uid) {
        currentAdmin = { ...currentAdmin, ...user };
        if (currentAdmin.role !== 'Admin') {
          alert('Sua permissão de Administrador foi revogada.');
          api.post('/auth/logout').finally(() => window.location.reload());
          return;
        }
        updateShellUserUI(currentAdmin, shellMenuController || mobileMenuController);
      }
      renderAdminPanel();
    });
    socket.on('user:deleted', ({ uid }) => {
      delete allUsers[uid];
      renderAdminPanel();
    });
  } catch (socketError) {
    console.warn('Realtime indisponível no admin:', socketError);
  }
}

async function startAdminRealtimeSync() {
  try {
    shellMenuController = await renderPortalChrome('admin', {
      showUserMeta: true,
      drawerTitle: 'Menu Admin'
    });
    updateShellUserUI(currentAdmin, shellMenuController || mobileMenuController);
  } catch (chromeError) {
    console.error('Falha ao montar header do admin:', chromeError);
  }

  showMainApp();
  await loadUsersAndRender();
  bindRealtime();
  if (window.lucide) window.lucide.createIcons();
}

async function checkAdminAccess() {
  try {
    const { user } = await api.get('/auth/me');
    if (user.role === 'Admin') {
      currentAdmin = user;
      await startAdminRealtimeSync();
      return;
    }
    showAuthError('Acesso Negado: Esta conta não possui privilégios de Administrador.');
    await api.post('/auth/logout');
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      showLoginScreen();
      return;
    }
    console.error('Authorization check error:', error);
    showAuthError('Erro na autenticação de segurança.');
  }
}

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
      showAuthError('Acesso Negado: Esta conta não possui privilégios de Administrador.');
      return;
    }
    currentAdmin = user;
    await startAdminRealtimeSync();
  } catch (error) {
    loadingOverlay.classList.add('d-none');
    showAuthError('Erro de Login: E-mail ou senha incorretos.');
    console.error(error);
  }
});

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
      modalErrorAlert.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
      modalErrorAlert.classList.remove('d-none');
      return;
    }

    try {
      const { user: createdUser } = await api.post('/users', { name, email, password, role });
      if (createdUser?.uid) {
        allUsers[createdUser.uid] = createdUser;
        renderAdminPanel();
      } else {
        await loadUsersAndRender();
      }

      const registerModalEl = document.getElementById('registerMemberModal');
      const registerModal = bootstrap.Modal.getInstance(registerModalEl);
      if (registerModal) registerModal.hide();
      registerMemberForm.reset();
      alert(`Membro "${name}" cadastrado com sucesso!`);
    } catch (error) {
      console.error('Error registering user:', error);
      modalErrorAlert.textContent = 'Erro ao cadastrar: ' + (error.message || 'Tente novamente.');
      modalErrorAlert.classList.remove('d-none');
    }
  });
}

checkAdminAccess();
