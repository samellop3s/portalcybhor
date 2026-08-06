// ============================================
// Portal Shell v2 - Cybhor Tech Portal
// ============================================
// Injeta header + gaveta mobile, aplica auth guard e sincroniza
// o usuário. O markup visual fica em portal-header.js (DRY).

import { api, ApiError } from './api-client.js';
import { getSocket } from './socket-client.js';
import { initializeTheme, setupThemeToggle } from './theme.js';
import { getInitials } from './utils.js';
import { buildHeaderMarkup, buildDrawerMarkup } from './portal-header.js';

/**
 * Injeta apenas o chrome visual (header + drawer + tema + logout).
 * Use nas páginas que já fazem autenticação por conta própria.
 *
 * @param {string} active
 * @param {{ extraActionsHtml?: string, showUserMeta?: boolean, drawerTitle?: string }} [options]
 * @returns {Promise<Object|null>} mobileMenuController
 */
export async function renderPortalChrome(active, options = {}) {
  const {
    extraActionsHtml = '',
    showUserMeta = false,
    drawerTitle
  } = options;

  const shellContainer = document.getElementById('portal-shell');
  if (!shellContainer) {
    throw new Error('Elemento #portal-shell não encontrado na página.');
  }

  document.querySelectorAll('.drawer-overlay, .mobile-drawer').forEach((el) => el.remove());

  shellContainer.innerHTML = buildHeaderMarkup(active, { extraActionsHtml, showUserMeta });
  document.body.insertAdjacentHTML('afterbegin', buildDrawerMarkup(active, { drawerTitle }));
  document.body.dataset.portalPage = active;

  initializeTheme();
  setupThemeToggle();

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
  return mobileMenuController;
}

/**
 * Inicializa o shell do portal: injeta navegação, aplica tema,
 * protege a página com auth guard e sincroniza dados do usuário.
 *
 * @param {Object} options
 * @param {string} options.active - ID do tema/página (ex: 'finance')
 * @param {Function} [options.onUserReady] - Callback (currentUser, allUsers)
 * @param {string} [options.extraActionsHtml] - HTML extra no header
 * @param {boolean} [options.showUserMeta] - Exibe nome/cargo no header
 * @param {boolean} [options.requireAuth=true] - Redireciona se 401
 */
export async function initPortalShell({
  active,
  onUserReady,
  extraActionsHtml = '',
  showUserMeta = false,
  requireAuth = true
}) {
  const mobileMenuController = await renderPortalChrome(active, {
    extraActionsHtml,
    showUserMeta
  });

  try {
    const { user: currentUser } = await api.get('/auth/me');
    updateShellUserUI(currentUser, mobileMenuController);

    const { users } = await api.get('/users');
    const allUsers = usersArrayToMap(users);

    try {
      const socket = getSocket();
      socket.on('user:updated', (updatedUser) => {
        if (updatedUser.uid === currentUser.uid) {
          Object.assign(currentUser, updatedUser);
          updateShellUserUI(currentUser, mobileMenuController);
        }
      });
    } catch (socketError) {
      console.warn('Realtime indisponível nesta página:', socketError);
    }

    if (typeof onUserReady === 'function') {
      onUserReady(currentUser, allUsers);
    }
  } catch (error) {
    if (requireAuth && error instanceof ApiError && error.statusCode === 401) {
      window.location.href = 'index.html';
      return;
    }
    console.error('Erro ao carregar perfil do usuário:', error);
  }
}

/**
 * @param {Array<Object>} usersList
 * @returns {Object<string, Object>}
 */
function usersArrayToMap(usersList) {
  const map = {};
  usersList.forEach((user) => {
    map[user.uid] = user;
  });
  return map;
}

/**
 * Atualiza avatar, links de papel e dados no drawer.
 * Exportado para páginas que usam renderPortalChrome + auth própria.
 *
 * @param {Object} currentUser
 * @param {Object} [mobileMenuController]
 */
export function updateShellUserUI(currentUser, mobileMenuController) {
  const role = currentUser.role;
  const canAccessRh = role === 'Rh' || role === 'Admin';
  const isAdmin = role === 'Admin';

  toggleRoleLink('btn-rh-portal', 'drawer-btn-rh', canAccessRh);
  toggleRoleLink('btn-admin-portal', 'drawer-btn-admin', isAdmin);

  const headerAvatar = document.getElementById('header-user-avatar');
  if (headerAvatar) {
    if (currentUser.photoURL) {
      headerAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      headerAvatar.textContent = getInitials(currentUser.name);
    }
  }

  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName) headerUserName.textContent = currentUser.name;

  const roleBadge = document.getElementById('header-user-role-badge');
  if (roleBadge) {
    const badgeClass = role === 'Admin'
      ? 'role-admin'
      : role === 'Rh'
        ? 'role-rh'
        : role === 'Integrante'
          ? 'role-integrante'
          : 'role-visualizador';
    roleBadge.innerHTML = `<span class="badge ${badgeClass}">${role}</span>`;
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

/**
 * @param {string} btnId
 * @param {string} drawerId
 * @param {boolean} visible
 */
function toggleRoleLink(btnId, drawerId, visible) {
  const btn = document.getElementById(btnId);
  const drawer = document.getElementById(drawerId);
  if (btn) btn.classList.toggle('d-none', !visible);
  if (drawer) drawer.classList.toggle('d-none', !visible);
}
