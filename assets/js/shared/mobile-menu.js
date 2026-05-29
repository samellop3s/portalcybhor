// ============================================
// Mobile Menu Drawer Controller
// ============================================
// Este arquivo gerencia a gaveta de navegação em dispositivos móveis

class MobileMenuController {
  constructor() {
    this.hamburgerBtn = document.getElementById('mobile-menu-btn');
    this.drawer = document.getElementById('mobile-drawer');
    this.overlay = document.getElementById('drawer-overlay');
    this.closeBtn = document.getElementById('drawer-close-btn');
    this.isDrawerOpen = false;

    this.initializeEventListeners();
    this.initializeDrawerButtons();
  }

  // Inicializa event listeners
  initializeEventListeners() {
    if (this.hamburgerBtn) {
      this.hamburgerBtn.addEventListener('click', () => this.toggleDrawer());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeDrawer());
    }

    // Fechar gaveta ao clicar em um link
    document.querySelectorAll('.drawer-btn, #drawer-btn-dashboard, #drawer-btn-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!btn.id.includes('theme') && !btn.id.includes('profile') && !btn.id.includes('logout') && !btn.id.includes('back') && !btn.id.includes('refresh')) {
          this.closeDrawer();
        }
      });
    });

    // Fechar gaveta ao redimensionar (se voltou para desktop)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.closeDrawer();
      }
    });
  }

  // Inicializa botões da gaveta
  initializeDrawerButtons() {
    // Botão de tema (dark mode)
    const themeBtn = document.getElementById('drawer-btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const headerThemeBtn = document.getElementById('btn-theme-toggle');
        if (headerThemeBtn) {
          headerThemeBtn.click();
        }
        this.updateThemeText();
      });
    }

    // Botão de perfil
    const profileBtn = document.getElementById('drawer-btn-profile');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        const headerProfileBtn = document.getElementById('header-user-avatar');
        if (headerProfileBtn) {
          headerProfileBtn.click();
        }
        this.closeDrawer();
      });
    }

    // Botão de logout
    const logoutBtn = document.getElementById('drawer-btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const headerLogoutBtn = document.getElementById('btn-logout');
        if (headerLogoutBtn) {
          headerLogoutBtn.click();
        }
      });
    }

    // Botão de painel de ideias
    const ideasBtn = document.getElementById('drawer-btn-ideas');
    if (ideasBtn) {
      ideasBtn.addEventListener('click', () => {
        const headerIdeasBtn = document.getElementById('btn-ideas-panel');
        if (headerIdeasBtn) {
          headerIdeasBtn.click();
        }
        this.closeDrawer();
      });
    }

    // Botão de voltar (dashboard)
    const backBtn = document.getElementById('drawer-btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const headerBackBtn = document.getElementById('btn-back');
        if (headerBackBtn) {
          headerBackBtn.click();
        }
        this.closeDrawer();
      });
    }

    // Botão de atualizar (dashboard)
    const refreshBtn = document.getElementById('drawer-btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const headerRefreshBtn = document.getElementById('btn-refresh');
        if (headerRefreshBtn) {
          headerRefreshBtn.click();
        }
        this.closeDrawer();
      });
    }
  }

  // Alterna a gaveta aberta/fechada
  toggleDrawer() {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  // Abre a gaveta
  openDrawer() {
    this.isDrawerOpen = true;
    if (this.drawer) {
      // Remover classe para resetar animações
      this.drawer.classList.remove('active');
      
      // Forçar reflow para reiniciar animação
      void this.drawer.offsetWidth;
      
      // Adicionar classe para iniciar animações
      this.drawer.classList.add('active');
    }
    if (this.overlay) {
      this.overlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden'; // Previne scroll da página
  }

  // Fecha a gaveta
  closeDrawer() {
    this.isDrawerOpen = false;
    if (this.drawer) {
      this.drawer.classList.remove('active');
    }
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    document.body.style.overflow = ''; // Restaura scroll da página
  }

  // Atualiza informações do usuário na gaveta
  updateUserInfo(userName, userRole, userInitials) {
    const userSection = document.getElementById('drawer-user-section');
    const userNameEl = document.getElementById('drawer-user-name');
    const userRoleEl = document.getElementById('drawer-user-role');
    const userAvatarEl = document.getElementById('drawer-user-avatar');

    if (userSection) {
      userSection.style.display = 'block';
    }
    if (userNameEl) {
      userNameEl.textContent = userName || 'Usuário';
    }
    if (userRoleEl) {
      userRoleEl.textContent = userRole || 'Membro';
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = userInitials || '--';
    }
  }

  // Atualiza visibilidade do botão de admin
  updateAdminButton(isAdmin) {
    const adminBtn = document.getElementById('drawer-btn-admin');
    if (adminBtn) {
      if (isAdmin) {
        adminBtn.classList.remove('d-none');
      } else {
        adminBtn.classList.add('d-none');
      }
    }
  }

  // Atualiza texto do botão de tema
  updateThemeText() {
    const themeBtn = document.getElementById('drawer-btn-theme');
    const themeText = document.getElementById('drawer-theme-text');
    
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    if (themeText) {
      themeText.textContent = isDarkMode ? 'Modo Claro' : 'Modo Escuro';
    }
  }

  // Método público para atualizar o ícone da gaveta
  updateDrawerIcon() {
    this.updateThemeText();
  }

  // Sincroniza o estado do admin button entre header e drawer
  syncAdminButton() {
    const headerAdminBtn = document.getElementById('btn-admin-portal');
    const drawerAdminBtn = document.getElementById('drawer-btn-admin');

    if (headerAdminBtn && drawerAdminBtn) {
      if (headerAdminBtn.classList.contains('d-none')) {
        drawerAdminBtn.classList.add('d-none');
      } else {
        drawerAdminBtn.classList.remove('d-none');
      }
    }
  }
}

// Inicializa o controlador do menu quando o DOM está pronto
document.addEventListener('DOMContentLoaded', () => {
  window.mobileMenuController = new MobileMenuController();
});

// Expor globalmente para uso em outros scripts
export default MobileMenuController;

