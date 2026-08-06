import { api } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import storageManager from "../shared/storage-manager.js";
import { initPortalShell } from "../shared/portal-shell.js";
import { getInitials } from "../shared/utils.js";
import mobileMenuController from "../shared/mobile-menu.js";

// State
let currentUser = null;
let allTasks = {};

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const btnLogoutAccount = document.getElementById('btn-logout-account');

// Profile Elements
const profileAvatarLarge = document.getElementById('profile-avatar-large');
const profileUserName = document.getElementById('profile-user-name');
const profileUserEmail = document.getElementById('profile-user-email');
const profileUserRole = document.getElementById('profile-user-role');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profileCreatedDate = document.getElementById('profile-created-date');
const profileCompletedCount = document.getElementById('profile-completed-count');
const profilePendingCount = document.getElementById('profile-pending-count');
const profileFailedCount = document.getElementById('profile-failed-count');
const profileMessageInput = document.getElementById('profile-message-input');
const profileMessageStatus = document.getElementById('profile-message-status');
const profileMessageForm = document.getElementById('profile-message-form');
const btnClearMessage = document.getElementById('btn-clear-message');
const accountEmail = document.getElementById('account-email');

// Photo Upload Elements
const profilePhotoInput = document.getElementById('profile-photo-input');
const btnRemovePhoto = document.getElementById('btn-remove-photo');
const photoUploadStatus = document.getElementById('photo-upload-status');

// Stats Elements
const statsTotalTasks = document.getElementById('stats-total-tasks');
const statsCompletionRate = document.getElementById('stats-completion-rate');
const statsContributions = document.getElementById('stats-contributions');

function arrayToMap(list, idField = 'id') {
  const map = {};
  list.forEach(item => {
    map[item[idField]] = item;
  });
  return map;
}

// Auth & Routing
initPortalShell({
  active: 'profile',
  onUserReady: async (user) => {
    currentUser = user;
    await startRealtimeSync();
  }
});

async function startRealtimeSync() {
  // Load cached tasks
  const cachedTasks = storageManager.loadTasks();
  if (Object.keys(cachedTasks).length > 0) allTasks = cachedTasks;

  try {
    const { tasks } = await api.get('/tasks');
    allTasks = arrayToMap(tasks);
    storageManager.saveTasks(allTasks);
  } catch (error) {
    console.error('Erro ao carregar tarefas:', error);
  }

  updateProfileUI();
  updateStatistics();

  const socket = getSocket();

  socket.on('user:updated', (user) => {
    if (user.uid === currentUser.uid) {
      currentUser = { ...currentUser, ...user };
      updateProfileUI();
    }
  });

  socket.on('task:created', (task) => { allTasks[task.id] = task; storageManager.saveTasks(allTasks); updateProfileUI(); updateStatistics(); });
  socket.on('task:updated', (task) => { allTasks[task.id] = task; storageManager.saveTasks(allTasks); updateProfileUI(); updateStatistics(); });
  socket.on('task:deleted', ({ id }) => { delete allTasks[id]; storageManager.saveTasks(allTasks); updateProfileUI(); updateStatistics(); });

  // Show main content
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.classList.add('d-none');
    }, 500);
    lucide.createIcons();
  }, 500);
}

function updateProfileUI() {
  if (!currentUser) return;

  // Basic Info
  const initials = getInitials(currentUser.name);

  // Sincronizar mobile drawer
  if (mobileMenuController) {
    mobileMenuController.updateUserInfo(currentUser.name, currentUser.role, initials, currentUser.photoURL);
  }

  // Avatar with photo or initials
  if (currentUser.photoURL) {
    profileAvatarLarge.innerHTML = `<img src="${currentUser.photoURL}" alt="Foto de perfil" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    btnRemovePhoto.style.display = 'inline-block';
  } else {
    profileAvatarLarge.textContent = initials;
    btnRemovePhoto.style.display = 'none';
  }

  profileUserName.textContent = currentUser.name;
  profileUserEmail.textContent = currentUser.email || '--';
  profileUserRole.textContent = currentUser.role;
  accountEmail.textContent = currentUser.email || '--';

  // Role Badge
  let badgeClass = 'role-visualizador';
  if (currentUser.role === 'Admin') badgeClass = 'role-admin';
  else if (currentUser.role === 'Rh') badgeClass = 'role-rh';
  else if (currentUser.role === 'Integrante') badgeClass = 'role-integrante';

  profileRoleBadge.innerHTML = `<span class="badge ${badgeClass}">${currentUser.role}</span>`;

  // Created Date
  if (currentUser.profileCreatedAt) {
    const date = new Date(currentUser.profileCreatedAt);
    profileCreatedDate.textContent = date.toLocaleDateString('pt-BR');
  }

  // Message
  if (profileMessageInput) {
    profileMessageInput.value = currentUser.profileMessage || '';
  }

  if (profileMessageStatus) {
    if (currentUser.profileMessage && currentUser.profileMessage.trim().length > 0) {
      profileMessageStatus.textContent = 'Recado salvo';
    } else {
      profileMessageStatus.textContent = 'Recado vazio — salve para atualizar';
    }
  }

  // Task counts
  const completedTasks = Object.values(allTasks).filter(task => task.assigneeId === currentUser.uid && task.status === 'done').length;
  const pendingTasks = Object.values(allTasks).filter(task => task.assigneeId === currentUser.uid && task.status === 'pending').length;
  const failedTasks = Object.values(allTasks).filter(task => task.assigneeId === currentUser.uid && task.status === 'failed').length;

  profileCompletedCount.textContent = completedTasks;
  profilePendingCount.textContent = pendingTasks;
  profileFailedCount.textContent = failedTasks;
}

function updateStatistics() {
  if (!currentUser) return;

  // Total tasks assigned to user
  const userTasks = Object.values(allTasks).filter(task => task.assigneeId === currentUser.uid);
  const completed = userTasks.filter(t => t.status === 'done').length;
  const total = userTasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  statsTotalTasks.textContent = total;
  statsCompletionRate.textContent = `${rate}%`;

  // Contributions (tarefas criadas pelo usuário)
  const tasksCreatedByUser = Object.values(allTasks).filter(task => task.creatorId === currentUser.uid).length;
  statsContributions.textContent = tasksCreatedByUser;
}

// Profile Message Form
profileMessageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const message = profileMessageInput.value.trim();

  try {
    const { user } = await api.patch('/profile/message', { profileMessage: message });
    currentUser = { ...currentUser, ...user };

    if (profileMessageStatus) {
      profileMessageStatus.textContent = 'Recado salvo';
    }
    profileMessageForm.reset();
    profileMessageInput.value = currentUser.profileMessage || '';
  } catch (error) {
    alert("Erro ao salvar recado: " + error.message);
  }
});

// Clear Message Button
btnClearMessage.addEventListener('click', () => {
  if (confirm('Deseja limpar seu recado?')) {
    profileMessageInput.value = '';
    profileMessageForm.dispatchEvent(new Event('submit'));
  }
});

// Photo Upload Handler
profilePhotoInput.addEventListener('change', async (e) => {
  if (!currentUser) return;
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    photoUploadStatus.innerHTML = '<div class="alert alert-danger py-2 px-3 small mb-0">Arquivo muito grande. Máximo 5MB.</div>';
    return;
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    photoUploadStatus.innerHTML = '<div class="alert alert-danger py-2 px-3 small mb-0">Tipo de arquivo inválido. Use JPG, PNG ou WebP.</div>';
    return;
  }

  try {
    photoUploadStatus.innerHTML = '<div class="alert alert-info py-2 px-3 small mb-0">Enviando foto...</div>';

    const formData = new FormData();
    formData.append('photo', file);
    const { user } = await api.upload('/profile/photo', formData);
    currentUser = { ...currentUser, ...user };

    updateProfileUI();

    photoUploadStatus.innerHTML = '<div class="alert alert-success py-2 px-3 small mb-0">✓ Foto enviada com sucesso!</div>';
    profilePhotoInput.value = '';
  } catch (error) {
    console.error("Erro ao enviar foto:", error);
    photoUploadStatus.innerHTML = `<div class="alert alert-danger py-2 px-3 small mb-0">Erro ao enviar foto: ${error.message}</div>`;
  }
});

// Remove Photo Handler
btnRemovePhoto.addEventListener('click', async () => {
  if (!confirm('Deseja remover sua foto de perfil?')) return;

  try {
    photoUploadStatus.innerHTML = '<div class="alert alert-info py-2 px-3 small mb-0">Removendo foto...</div>';

    const { user } = await api.delete('/profile/photo');
    currentUser = { ...currentUser, ...user };

    // Reset avatar to initials
    if (profileAvatarLarge && currentUser.name) {
      const initials = getInitials(currentUser.name);
      profileAvatarLarge.innerHTML = initials;
    }

    photoUploadStatus.innerHTML = '<div class="alert alert-success py-2 px-3 small mb-0">✓ Foto removida com sucesso!</div>';
    btnRemovePhoto.style.display = 'none';
  } catch (error) {
    console.error("Erro ao remover foto:", error);
    photoUploadStatus.innerHTML = `<div class="alert alert-danger py-2 px-3 small mb-0">Erro ao remover foto: ${error.message}</div>`;
  }
});

btnLogoutAccount.addEventListener('click', () => {
  api.post('/auth/logout').finally(() => {
    window.location.href = 'index.html';
  });
});

if (window.lucide) window.lucide.createIcons();
