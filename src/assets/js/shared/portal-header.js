// ============================================
// Portal Header Builder
// ============================================
// Monta markup do header/drawer a partir da config compartilhada.
// Usado pelo portal-shell e por páginas standalone.

import {
  NAV_ITEMS,
  ROLE_NAV_ITEMS,
  getPageHeaderTheme
} from './portal-header-config.js';

/**
 * @param {string} activeId
 * @returns {string}
 */
export function buildNavLinksMarkup(activeId) {
  return NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="portal-nav-link ${item.id === activeId ? 'active' : ''}" data-nav-id="${item.id}">
      <i data-lucide="${item.icon}" style="width: 16px; height: 16px;"></i>
      <span>${item.label}</span>
    </a>
  `).join('');
}

/**
 * @param {string} activeId
 * @returns {string}
 */
export function buildRoleNavLinksMarkup(activeId) {
  return ROLE_NAV_ITEMS.map((item) => `
    <a id="btn-${item.id === 'admin' ? 'admin-portal' : 'rh-portal'}"
       href="${item.href}"
       class="portal-nav-link d-none ${item.id === activeId ? 'active' : ''}"
       data-nav-id="${item.id}"
       data-roles="${item.roles.join(',')}">
      <i data-lucide="${item.icon}" style="width: 16px; height: 16px;"></i>
      <span>${item.label}</span>
    </a>
  `).join('');
}

/**
 * @param {string} activeId
 * @returns {string}
 */
export function buildDrawerNavMarkup(activeId) {
  const main = NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="drawer-btn ${item.id === activeId ? 'drawer-btn-active' : ''}">
      <i data-lucide="${item.icon}"></i> ${item.label}
    </a>
  `).join('');

  const role = ROLE_NAV_ITEMS.map((item) => `
    <a id="drawer-btn-${item.id === 'admin' ? 'admin' : 'rh'}"
       href="${item.href}"
       class="drawer-btn d-none ${item.id === activeId ? 'drawer-btn-active' : ''}"
       data-roles="${item.roles.join(',')}">
      <i data-lucide="${item.icon}"></i> ${item.label}
    </a>
  `).join('');

  return main + role;
}

/**
 * Brand block (ícone + título + subtítulo) — reutilizado em todos os layouts.
 * @param {import('./portal-header-config.js').PageHeaderTheme} theme
 * @returns {string}
 */
export function buildBrandMarkup(theme) {
  const subtitle = theme.subtitle
    ? `<span class="portal-header-subtitle">${theme.subtitle}</span>`
    : '';

  return `
    <div class="portal-header-brand">
      <span class="portal-header-icon" aria-hidden="true">
        <i data-lucide="${theme.icon}"></i>
      </span>
      <div class="portal-header-titles">
        <h3 class="portal-header-title mb-0">
          ${theme.title}
          ${theme.id === 'projects' ? '<span class="portal-version-badge">v2</span>' : ''}
        </h3>
        ${subtitle}
      </div>
    </div>
  `;
}

/**
 * Ações comuns (tema, avatar, logout).
 * @param {{ showAvatar?: boolean, extraActionsHtml?: string }} [options]
 * @returns {string}
 */
export function buildHeaderActionsMarkup(options = {}) {
  const { showAvatar = true, extraActionsHtml = '' } = options;

  const avatar = showAvatar
    ? `<button type="button" class="user-avatar" id="header-user-avatar" aria-label="Abrir perfil" title="Abrir perfil">--</button>`
    : '';

  return `
    <div class="d-flex align-items-center gap-2 portal-header-actions">
      ${extraActionsHtml}
      <button id="btn-theme-toggle" class="btn btn-cyber btn-cyber-purple py-1 px-3" title="Alternar modo escuro" aria-label="Alternar modo escuro">
        <i data-lucide="moon" class="align-middle"></i>
      </button>
      ${avatar}
      <button id="btn-logout" class="btn btn-cyber btn-cyber-danger py-1 px-3" title="Sair">
        <i data-lucide="log-out" class="align-middle"></i>
      </button>
    </div>
  `;
}

/**
 * @param {string} activeId
 * @param {{ extraActionsHtml?: string, showUserMeta?: boolean }} [options]
 * @returns {string}
 */
export function buildHeaderMarkup(activeId, options = {}) {
  const theme = getPageHeaderTheme(activeId);
  const { extraActionsHtml = '', showUserMeta = false } = options;

  const userMeta = showUserMeta
    ? `<div class="text-end d-none d-sm-block portal-header-user-meta">
         <div class="fw-bold" id="header-user-name">Carregando...</div>
         <div class="small" id="header-user-role-badge"><span class="badge role-visualizador">Carregando</span></div>
       </div>`
    : '';

  let centerHtml = '';
  if (theme.layout === 'module' || theme.layout === 'workspace') {
    centerHtml = `
      <nav class="portal-nav d-flex align-items-center gap-1 flex-wrap ms-auto" aria-label="Navegação principal">
        ${buildNavLinksMarkup(activeId)}
        ${buildRoleNavLinksMarkup(activeId)}
      </nav>
    `;
  } else if (theme.layout === 'admin') {
    centerHtml = `
      <nav class="portal-nav d-flex align-items-center gap-1 flex-wrap ms-auto" aria-label="Navegação admin">
        <a href="index.html" class="portal-nav-link">
          <i data-lucide="layout-grid" style="width: 16px; height: 16px;"></i>
          <span>Portal</span>
        </a>
      </nav>
    `;
  } else if (theme.layout === 'analytics') {
    centerHtml = `
      <nav class="portal-nav d-flex align-items-center gap-1 flex-wrap ms-auto" aria-label="Ações dashboard">
        <button type="button" id="btn-back" class="portal-nav-link portal-nav-btn">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
          <span>Voltar</span>
        </button>
        <button type="button" id="btn-refresh" class="portal-nav-link portal-nav-btn">
          <i data-lucide="refresh-ccw" style="width: 16px; height: 16px;"></i>
          <span>Atualizar</span>
        </button>
        ${buildNavLinksMarkup(activeId)}
        ${buildRoleNavLinksMarkup(activeId)}
      </nav>
    `;
  } else if (theme.layout === 'focus') {
    centerHtml = `
      <nav class="portal-nav d-flex align-items-center gap-1 flex-wrap ms-auto" aria-label="Navegação perfil">
        <a href="index.html" class="portal-nav-link">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
          <span>Voltar</span>
        </a>
      </nav>
    `;
  }

  return `
    <header class="portal-header glass-panel p-3 mb-4 portal-header--${theme.id}"
            style="--portal-header-accent: ${theme.accentCssVar}"
            data-header-layout="${theme.layout}">
      ${buildBrandMarkup(theme)}
      ${centerHtml}
      ${userMeta}
      ${buildHeaderActionsMarkup({
        showAvatar: theme.layout !== 'focus',
        extraActionsHtml
      })}
      <button class="hamburger-btn" id="mobile-menu-btn" aria-label="Abrir menu" title="Abrir menu">
        <i data-lucide="menu" class="align-middle"></i>
      </button>
    </header>
  `;
}

/**
 * @param {string} activeId
 * @param {{ drawerTitle?: string }} [options]
 * @returns {string}
 */
export function buildDrawerMarkup(activeId, options = {}) {
  const theme = getPageHeaderTheme(activeId);
  const drawerTitle = options.drawerTitle || 'Menu';

  let navSection = '';
  if (theme.layout === 'focus') {
    navSection = `
      <a href="index.html" class="drawer-btn">
        <i data-lucide="home"></i> Voltar ao Painel
      </a>
    `;
  } else if (theme.layout === 'admin') {
    navSection = `
      <a href="index.html" class="drawer-btn">
        <i data-lucide="layout-grid"></i> Portal Geral
      </a>
    `;
  } else {
    navSection = buildDrawerNavMarkup(activeId);
  }

  return `
    <div class="drawer-overlay" id="drawer-overlay"></div>
    <div class="mobile-drawer" id="mobile-drawer">
      <div class="drawer-header">
        <h5 class="drawer-title">${drawerTitle}</h5>
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
        ${navSection}
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
