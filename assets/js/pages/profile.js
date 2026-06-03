import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js";
import { firebaseConfig } from "../shared/config.js";
import StorageManager from "../shared/storage-manager.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const storageManager = new StorageManager();

// State
let currentUser = null;
let allTasks = {};
let activeListeners = [];

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const btnLogout = document.getElementById('btn-logout');
const btnLogoutAccount = document.getElementById('btn-logout-account');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeStorageKey = 'cybhorTheme';

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
  // Load cached tasks
  const cachedTasks = storageManager.loadTasks();
  if (Object.keys(cachedTasks).length > 0) allTasks = cachedTasks;

  // Sync current user
  const userListener = onValue(ref(db, `users/${uid}`), (snapshot) => {
    if (snapshot.exists()) {
      currentUser = { uid, ...snapshot.val() };
      updateProfileUI();
    }
  });
  activeListeners.push(userListener);

  // Sync tasks
  const tasksListener = onValue(ref(db, 'tasks'), (snapshot) => {
    allTasks = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveTasks(allTasks);
    updateProfileUI();
    updateStatistics();
  });
  activeListeners.push(tasksListener);

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
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
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

  // Contributions (ideas created + tasks created)
  const tasksCreatedByUser = Object.values(allTasks).filter(task => task.creatorId === currentUser.uid).length;
  statsContributions.textContent = tasksCreatedByUser;
}

// Profile Message Form
profileMessageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const message = profileMessageInput.value.trim();
  
  try {
    await update(ref(db, `users/${currentUser.uid}`), { profileMessage: message });
    currentUser.profileMessage = message;
    
    if (profileMessageStatus) {
      profileMessageStatus.textContent = 'Recado salvo';
    }
    profileMessageForm.reset();
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
    
    // Delete previous photo if exists
    if (currentUser.photoURL) {
      try {
        const oldRef = storageRef(storage, `profile-photos/${currentUser.uid}/profile`);
        await deleteObject(oldRef);
      } catch (err) {
        console.log("Não foi possível deletar foto anterior");
      }
    }

    // Upload to Firebase Storage with fixed name for easier deletion
    const fileRef = storageRef(storage, `profile-photos/${currentUser.uid}/profile`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Update user profile with new photo URL
    await update(ref(db, `users/${currentUser.uid}`), { photoURL: downloadURL });
    currentUser.photoURL = downloadURL;
    
    // Update UI completely
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
    
    // Delete from storage
    if (currentUser.photoURL) {
      try {
        const fileRef = storageRef(storage, `profile-photos/${currentUser.uid}/profile`);
        await deleteObject(fileRef);
      } catch (err) {
        console.log("Não foi possível deletar arquivo de armazenamento", err);
      }
    }

    // Remove from database
    await update(ref(db, `users/${currentUser.uid}`), { photoURL: null });
    currentUser.photoURL = null;

    // Reset avatar to initials
    if (profileAvatarLarge && currentUser.name) {
      const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      profileAvatarLarge.innerHTML = initials;
    }

    photoUploadStatus.innerHTML = '<div class="alert alert-success py-2 px-3 small mb-0">✓ Foto removida com sucesso!</div>';
    btnRemovePhoto.style.display = 'none';
  } catch (error) {
    console.error("Erro ao remover foto:", error);
    photoUploadStatus.innerHTML = `<div class="alert alert-danger py-2 px-3 small mb-0">Erro ao remover foto: ${error.message}</div>`;
  }
});

// Logout
btnLogout.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

btnLogoutAccount.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

// Theme Toggle
if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

// Initialize
initializeTheme();
if (window.lucide) window.lucide.createIcons();
