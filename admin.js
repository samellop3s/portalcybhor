import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Secondary Auth instance to register new users without signing out the admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryRegistrationApp");
const secondaryAuth = getAuth(secondaryApp);

// State
let currentAdmin = null;
let allUsers = {};
let activeListeners = [];

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

/* ==========================================
   AUTH & SECURITY CHECKS
   ========================================== */

onAuthStateChanged(auth, async (user) => {
  // Clear any existing active database listeners
  activeListeners.forEach(unsubscribe => unsubscribe());
  activeListeners = [];

  if (user) {
    // User signed in. Perform authorization check
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        if (userData.role === 'Admin') {
          // Authorized Admin
          currentAdmin = { uid: user.uid, ...userData };
          startAdminRealtimeSync(user.uid);
        } else {
          // Access Denied for Integrante/Visualizador
          showAuthError("Acesso Negado: Esta conta não possui privilégios de Administrador.");
          signOut(auth);
        }
      } else {
        // User has auth but no DB profile
        showAuthError("Perfil de usuário não encontrado.");
        signOut(auth);
      }
    } catch (error) {
      console.error("Authorization check error:", error);
      showAuthError("Erro na autenticação de segurança.");
      signOut(auth);
    }
  } else {
    // Logged out
    currentAdmin = null;
    showLoginScreen();
  }
});

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
    await signInWithEmailAndPassword(auth, email, password);
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
  signOut(auth).then(() => {
    window.location.reload();
  });
});

/* ==========================================
   REALTIME ADMIN DATABASE SYNC
   ========================================== */

function startAdminRealtimeSync(uid) {
  // 1. Sync current admin details
  const adminListener = onValue(ref(db, `users/${uid}`), (snapshot) => {
    if (snapshot.exists()) {
      currentAdmin = { uid, ...snapshot.val() };
      // Double check role changes in real time
      if (currentAdmin.role !== 'Admin') {
        alert("Sua permissão de Administrador foi revogada.");
        signOut(auth);
      }
      updateHeader();
    }
  });
  activeListeners.push(adminListener);

  // 2. Sync all users
  const allUsersListener = onValue(ref(db, 'users'), (snapshot) => {
    if (snapshot.exists()) {
      allUsers = snapshot.val();
      renderAdminPanel();
    }
  });
  activeListeners.push(allUsersListener);

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

function updateHeader() {
  if (!currentAdmin) return;
  headerUserName.textContent = currentAdmin.name;
  const initials = currentAdmin.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  headerUserAvatar.textContent = initials;
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
        await update(ref(db, `users/${targetUid}`), { role: newRole });
      } catch (error) {
        alert("Erro ao alterar cargo: Acesso não autorizado.");
        console.error(error);
        renderAdminPanel(); // Reset UI
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
      // Create user credential securely on secondary instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;
      
      // Store user record in database
      await set(ref(db, `users/${newUser.uid}`), {
        name: name,
        email: email,
        role: role
      });

      // Log out of secondary instance to clean up
      await signOut(secondaryAuth);

      // Close Bootstrap modal
      const registerModalEl = document.getElementById('registerMemberModal');
      const registerModal = bootstrap.Modal.getInstance(registerModalEl);
      if (registerModal) registerModal.hide();
      
      registerMemberForm.reset();
      alert(`Membro "${name}" cadastrado com sucesso!`);
    } catch (error) {
      console.error("Error registering user:", error);
      modalErrorAlert.textContent = "Erro ao cadastrar: " + error.message;
      modalErrorAlert.classList.remove('d-none');
    }
  });
}
