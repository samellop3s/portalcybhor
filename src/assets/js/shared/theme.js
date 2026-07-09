// ============================================
// Theme Manager - Cybhor Tech Portal
// ============================================
// Centraliza a lógica de tema (dark/light mode).
// Elimina duplicação de applyTheme/initializeTheme em 5 arquivos.

const THEME_STORAGE_KEY = 'cybhorTheme';

/**
 * Aplica o tema especificado (dark ou light)
 * @param {string} theme - 'dark' ou 'light'
 */
export function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);

  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.innerHTML = isDark
      ? '<i data-lucide="sun" class="align-middle"></i>'
      : '<i data-lucide="moon" class="align-middle"></i>';
    btnThemeToggle.setAttribute('aria-label', isDark ? 'Modo claro' : 'Modo escuro');
  }

  localStorage.setItem(THEME_STORAGE_KEY, theme);
  if (window.lucide) lucide.createIcons();
}

/**
 * Inicializa o tema baseado no localStorage ou preferência do sistema
 */
export function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const defaultTheme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(defaultTheme);
}

/**
 * Configura o event listener do botão de alternar tema
 */
export function setupThemeToggle() {
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}
