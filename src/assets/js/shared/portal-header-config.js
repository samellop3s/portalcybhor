// ============================================
// Portal Header Config
// ============================================
// Fonte única de verdade para navegação e identidade visual
// de cada página. Evita duplicar títulos/ícones/cores nos HTML.

/** @typedef {'module' | 'workspace' | 'focus' | 'admin' | 'analytics'} HeaderLayout */

/**
 * @typedef {Object} PageHeaderTheme
 * @property {string} id
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} icon
 * @property {string} accentCssVar - CSS color token (ex: var(--primary-cyan))
 * @property {HeaderLayout} layout
 */

export const NAV_ITEMS = [
  { id: 'projects', label: 'Projetos', icon: 'kanban-square', href: 'index.html' },
  { id: 'development', label: 'Desenvolvimento', icon: 'code-2', href: 'development.html' },
  { id: 'finance', label: 'Financeiro', icon: 'wallet', href: 'finance.html' },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone', href: 'marketing.html' },
  { id: 'dashboard', label: 'Dashboard', icon: 'bar-chart-2', href: 'dashboard.html' },
  { id: 'ideas', label: 'Ideias', icon: 'lightbulb', href: 'ideas.html' }
];

export const ROLE_NAV_ITEMS = [
  { id: 'rh', label: 'RH', icon: 'users', href: 'rh.html', roles: ['Admin', 'Rh'] },
  { id: 'admin', label: 'Admin', icon: 'shield-check', href: 'admin.html', roles: ['Admin'] }
];

/** @type {Record<string, PageHeaderTheme>} */
export const PAGE_HEADER_THEMES = {
  projects: {
    id: 'projects',
    title: 'CYBHOR TECH',
    subtitle: 'Workspace · Kanban',
    icon: 'kanban-square',
    accentCssVar: 'var(--primary-orange)',
    layout: 'workspace'
  },
  development: {
    id: 'development',
    title: 'DESENVOLVIMENTO',
    subtitle: 'Bugs · Releases · Links',
    icon: 'code-2',
    accentCssVar: '#38bdf8',
    layout: 'module'
  },
  finance: {
    id: 'finance',
    title: 'FINANCEIRO',
    subtitle: 'Receitas · Despesas · Fluxo',
    icon: 'wallet',
    accentCssVar: '#34d399',
    layout: 'module'
  },
  marketing: {
    id: 'marketing',
    title: 'MARKETING',
    subtitle: 'Campanhas · Conteúdo',
    icon: 'megaphone',
    accentCssVar: '#f472b6',
    layout: 'module'
  },
  dashboard: {
    id: 'dashboard',
    title: 'DASHBOARD',
    subtitle: 'Métricas · Produtividade',
    icon: 'bar-chart-2',
    accentCssVar: '#a78bfa',
    layout: 'analytics'
  },
  ideas: {
    id: 'ideas',
    title: 'IDEIAS',
    subtitle: 'Sugestões · Votação',
    icon: 'lightbulb',
    accentCssVar: '#fbbf24',
    layout: 'module'
  },
  rh: {
    id: 'rh',
    title: 'RECURSOS HUMANOS',
    subtitle: 'Equipe · Demandas',
    icon: 'users',
    accentCssVar: '#2dd4bf',
    layout: 'module'
  },
  admin: {
    id: 'admin',
    title: 'ADMIN',
    subtitle: 'Cargos · Acessos',
    icon: 'shield-check',
    accentCssVar: '#f87171',
    layout: 'admin'
  },
  profile: {
    id: 'profile',
    title: 'MEU PERFIL',
    subtitle: 'Conta · Preferências',
    icon: 'user-round',
    accentCssVar: '#60a5fa',
    layout: 'focus'
  }
};

/**
 * @param {string} pageId
 * @returns {PageHeaderTheme}
 */
export function getPageHeaderTheme(pageId) {
  return PAGE_HEADER_THEMES[pageId] || PAGE_HEADER_THEMES.projects;
}
