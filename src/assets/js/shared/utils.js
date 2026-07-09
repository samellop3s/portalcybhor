// ============================================
// Utility Functions - Cybhor Tech Portal
// ============================================
// Funções utilitárias compartilhadas entre módulos.

import { ref, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { db } from "./firebase-init.js";

/**
 * Extrai iniciais de um nome (máximo 2 caracteres)
 * @param {string} name - Nome completo
 * @returns {string} Iniciais em maiúsculo (ex: "SF")
 */
export function getInitials(name) {
  if (!name) return '--';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

/**
 * Escapa caracteres HTML especiais para prevenir XSS
 * @param {string} str - String a ser escapada
 * @returns {string} String segura para inserção no DOM
 */
export function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/**
 * Garante que o perfil do usuário possui todos os campos obrigatórios
 * com valores padrão. Atualiza no Firebase se necessário.
 * @param {string} uid - UID do usuário
 * @param {Object} userData - Dados atuais do perfil
 */
export async function ensureUserProfileDefaults(uid, userData) {
  const updates = {};

  if (typeof userData.profileMessage === 'undefined' || userData.profileMessage === null) {
    updates.profileMessage = '';
  }

  if (typeof userData.profileCreatedAt === 'undefined' || userData.profileCreatedAt === null) {
    updates.profileCreatedAt = Date.now();
  }

  if (!userData.name || userData.name.trim().length === 0) {
    updates.name = 'Usuário Cybhor';
  }

  if (!userData.email) {
    updates.email = '';
  }

  if (!userData.role) {
    updates.role = 'Integrante';
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(db, `users/${uid}`), updates);
  }
}
