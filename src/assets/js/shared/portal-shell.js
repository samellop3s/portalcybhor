// ============================================
// Portal Shell v2 - Cybhor Tech Portal
// ============================================
// Componente compartilhado que injeta o header de navegação,
// a gaveta mobile e aplica o guard de autenticação nas páginas
// de módulo (Financeiro, Marketing, Desenvolvimento).
// Evita duplicação de markup entre as páginas do portal.

import { api, ApiError } from "./api-client.js";
import { getSocket } from "./socket-client.js";
import { initializeTheme, setupThemeToggle } from "./theme.js";
import { getInitials } from "./utils.js";

const NAV_ITEMS = [
  { id: 'projects', label: 'Projetos', icon: 'kanban-square', href: 'index.html' },
  { id: 'development', label: 'Desenvolvimento', icon: 'code-2', href: 'development.html' },
  { id: 'finance', label: 'Financeiro', icon: 'wallet', href: 'finance.html' },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone', href: 'marketing.html' },
  { id: 'dashboard', label: 'Dashboard', icon: 'bar-chart-2', href: 'dashboard.html' },
  { id: 'ideas', label: 'Ideias', icon: 'lightbulb', href: 'ideas.html' }
];

const RH_NAV_ITEM = { id: 'rh', label: 'RH', icon: 'users', href: 'rh.html' };

function buildHeaderMarkup(activeId) {
  const links = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="portal-nav-link ${item.id === activeId ? 'active' : ''}">
      <i data-lucide="${item.icon}" style="width: 16px; height: 16px;"></i>
      <span>${item.label}</span>
    </a>
  `).join('');

  return `
    <header class="glass-panel p-3 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
      <div class="d-flex align-items-center gap-2">
        <i data-lucide="shield-alert" class="text-accent" style="width: 28px; height: 28px;"></i>
        <h3 class="mb-0 fw-bold text-accent">CYBHOR TECH <span class="portal-version-badge">v2</span></h3>
      </div>

      <nav class="portal-nav d-flex align-items-center gap-1 flex-wrap ms-auto">
        ${links}
        <a id="btn-rh-portal" href="rh.html" class="portal-nav-link d-none">
          <i data-lucide="users" style="width: 16px; height: 16px;"></i>
          <span>RH</span>
        </a>
        <a id="btn-admin-portal" href="admin.html" class="portal-nav-link d-none">
          <i data-lucide="shield-check" style="width: 16px; height: 16px;"></i>
          <span>Admin</span>
        </a>
      </nav>

      <div class="d-flex align-items-center gap-2 portal-header-actions">
        <button id="btn-theme-toggle" class="btn btn-cyber btn-cyber-purple py-1 px-3" title="Alternar modo escuro" aria-label="Alternar modo escuro">
          <i data-lucide="moon" class="align-middle"></i>
        </button>
        <button type="button" class="user-avatar" id="header-user-avatar" aria-label="Abrir perfil" title="Abrir perfil">--</button>
        <button id="btn-logout" class="btn btn-cyber btn-cyber-danger py-1 px-3" title="Sair">
          <i data-lucide="log-out" class="align-middle"></i>
        </button>
      </div>

      <button class="hamburger-btn" id="mobile-menu-btn" aria-label="Abrir menu" title="Abrir menu">
        <i data-lucide="menu" class="align-middle"></i>
      </button>
    </header>
  `;
}

function buildDrawerMarkup(activeId) {
  const links = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="drawer-btn ${item.id === activeId ? 'drawer-btn-active' : ''}">
      <i data-lucide="${item.icon}"></i> ${item.label}
    </a>
  `).join('');

  return `
    <div class="drawer-overlay" id="drawer-overlay"></div>
    <div class="mobile-drawer" id="mobile-drawer">
      <div class="drawer-header">
        <h5 class="drawer-title">Menu</h5>
        <button class="drawer-close-btn" id="drawer-close-btn" aria-label="Fechar menu">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="drawer-section" id="drawer-user-section" style="display: none;">
        <div class="drawer-user-info">
          <div class="drawer-user-avatar" id="drawer-user-avatar">--</div>
          <div class="drawer-user-details">
            <div class="drawer-user-name" id="drawer-user-name">Carregando...</div>
            <div class="drawer-user-role" id="drawer-user-role">--</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <span class="drawer-section-title">Navegação</span>
        ${links}
        <a id="drawer-btn-rh" href="rh.html" class="drawer-btn d-none">
          <i data-lucide="users"></i> RH
        </a>
        <a id="drawer-btn-admin" href="admin.html" class="drawer-btn d-none">
          <i data-lucide="shield-check"></i> Admin
        </a>
      </div>

      <div class="drawer-section">
        <span class="drawer-section-title">Configurações</span>
        <button id="drawer-btn-theme" class="drawer-btn">
          <i data-lucide="moon"></i> <span id="drawer-theme-text">Modo Escuro</span>
        </button>
        <button id="drawer-btn-profile" class="drawer-btn">
          <i data-lucide="user"></i> Perfil
        </button>
      </div>

      <div class="drawer-section">
        <button id="drawer-btn-logout" class="drawer-btn" style="border-color: #dc2626; color: #dc2626;">
          <i data-lucide="log-out"></i> Sair
        </button>
      </div>
    </div>
  `;
}

/**
 * Inicializa o shell do portal: injeta navegação, aplica tema,
 * protege a página com auth guard e sincroniza dados do usuário.
 *
 * @param {Object} options
 * @param {string} options.active - ID do item de navegação ativo (ex: 'finance')
 * @param {Function} options.onUserReady - Callback chamado com (currentUser, allUsers)
 *   quando o usuário autenticado e a lista de usuários estiverem carregados.
 */
export async function initPortalShell({ active, onUserReady }) {
  const shellContainer = document.getElementById('portal-shell');
  if (!shellContainer) {
    throw new Error('Elemento #portal-shell não encontrado na página.');
  }

  shellContainer.innerHTML = buildHeaderMarkup(active);
  document.body.insertAdjacentHTML('afterbegin', buildDrawerMarkup(active));

  initializeTheme();
  setupThemeToggle();

  // Import dinâmico: o controller do menu mobile precisa dos elementos já no DOM
  const { default: mobileMenuController } = await import('./mobile-menu.js');

  const headerAvatar = document.getElementById('header-user-avatar');
  if (headerAvatar) {
    headerAvatar.addEventListener('click', () => {
      window.location.href = 'profile.html';
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      api.post('/auth/logout').finally(() => {
        window.location.href = 'index.html';
      });
    });
  }

  if (window.lucide) window.lucide.createIcons();

  try {
    const { user: currentUser } = await api.get('/auth/me');
    updateShellUserUI(currentUser, mobileMenuController);

    const { users } = await api.get('/users');
    const allUsers = usersArrayToMap(users);

    const socket = getSocket();
    socket.on('user:updated', (updatedUser) => {
      if (updatedUser.uid === currentUser.uid) {
        Object.assign(currentUser, updatedUser);
        updateShellUserUI(currentUser, mobileMenuController);
      }
    });

    if (typeof onUserReady === 'function') {
      onUserReady(currentUser, allUsers);
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode === 401) {
      window.location.href = 'index.html';
      return;
    }
    console.error('Erro ao carregar perfil do usuário:', error);
  }
}

/**
 * Converte a lista de usuários retornada pela API (array) no mesmo
 * formato de objeto indexado por uid usado antes com o Firebase.
 * @param {Array<Object>} usersList
 * @returns {Object<string, Object>}
 */
function usersArrayToMap(usersList) {
  const map = {};
  usersList.forEach(user => {
    map[user.uid] = user;
  });
  return map;
}

function updateShellUserUI(currentUser, mobileMenuController) {
  const isAdmin = currentUser.role === 'Admin';
  const canAccessRh = currentUser.role === 'Rh' || currentUser.role === 'Admin';

  const btnRhPortal = document.getElementById('btn-rh-portal');
  const drawerBtnRh = document.getElementById('drawer-btn-rh');
  if (canAccessRh) {
    if (btnRhPortal) btnRhPortal.classList.remove('d-none');
    if (drawerBtnRh) drawerBtnRh.classList.remove('d-none');
  } else {
    if (btnRhPortal) btnRhPortal.classList.add('d-none');
    if (drawerBtnRh) drawerBtnRh.classList.add('d-none');
  }

  const btnAdminPortal = document.getElementById('btn-admin-portal');
  const drawerBtnAdmin = document.getElementById('drawer-btn-admin');
  if (isAdmin) {
    if (btnAdminPortal) btnAdminPortal.classList.remove('d-none');
    if (drawerBtnAdmin) drawerBtnAdmin.classList.remove('d-none');
  } else {
    if (btnAdminPortal) btnAdminPortal.classList.add('d-none');
    if (drawerBtnAdmin) drawerBtnAdmin.classList.add('d-none');
  }

  const headerAvatar = document.getElementById('header-user-avatar');
  if (headerAvatar) {
    if (currentUser.photoURL) {
      headerAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      headerAvatar.textContent = getInitials(currentUser.name);
    }
  }

  if (mobileMenuController) {
    mobileMenuController.updateUserInfo(
      currentUser.name,
      currentUser.role,
      getInitials(currentUser.name),
      currentUser.photoURL
    );
  }

  if (window.lucide) window.lucide.createIcons();
}
