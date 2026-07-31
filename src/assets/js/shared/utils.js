// ============================================
// Utility Functions - Cybhor Tech Portal
// ============================================
// Funções utilitárias compartilhadas entre módulos.

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
 * Formata um valor em centavos como moeda brasileira (R$)
 * Valores monetários são armazenados em centavos (inteiro)
 * para evitar erros de arredondamento de ponto flutuante.
 * @param {number} amountCents - Valor em centavos
 * @returns {string} Valor formatado (ex: "R$ 1.234,56")
 */
export function formatCurrencyBRL(amountCents) {
  const value = (Number(amountCents) || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Converte texto digitado pelo usuário (ex: "1.234,56") em centavos
 * @param {string} text - Valor digitado
 * @returns {number|null} Valor em centavos ou null se inválido
 */
export function parseCurrencyToCents(text) {
  if (!text) return null;
  const normalized = String(text).replace(/[R$\s.]/g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Formata um timestamp epoch como data brasileira (dd/mm/aaaa)
 * @param {number} ms - Timestamp em milissegundos
 * @returns {string} Data formatada ou '-' se inválida
 */
export function formatDateBR(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Converte o valor de um <input type="date"> (aaaa-mm-dd) em epoch ms
 * ancorado ao meio-dia local para evitar deslocamento de fuso horário.
 * @param {string} dateInputValue - Valor do input date
 * @returns {number|null} Timestamp em milissegundos ou null
 */
export function dateInputToEpoch(dateInputValue) {
  if (!dateInputValue) return null;
  const [year, month, day] = dateInputValue.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

/**
 * Converte epoch ms no formato aceito por <input type="date"> (aaaa-mm-dd)
 * @param {number} ms - Timestamp em milissegundos
 * @returns {string} Data no formato aaaa-mm-dd
 */
export function epochToDateInput(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Faz o download de um conteúdo CSV como arquivo
 * @param {string} csvContent - Conteúdo CSV
 * @param {string} filename - Nome do arquivo (ex: "financeiro.csv")
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Escapa uma célula para uso em CSV
 * @param {*} value - Valor da célula
 * @returns {string} Célula segura para CSV
 */
export function escapeCsvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

