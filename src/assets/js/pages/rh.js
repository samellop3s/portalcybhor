import { api } from '../shared/api-client.js';
import { initPortalShell } from '../shared/portal-shell.js';
import { escapeHTML, formatCurrencyBRL, downloadCSV, escapeCsvCell } from '../shared/utils.js';

let currentUser = null;
let users = [];
let tasks = [];
let financeData = [];
let notesText = '';

const usersCountEl = document.getElementById('rh-users-count');
const tasksCountEl = document.getElementById('rh-tasks-count');
const pendingCountEl = document.getElementById('rh-pending-count');
const doneCountEl = document.getElementById('rh-done-count');
const financeBalanceEl = document.getElementById('rh-finance-balance');
const financeIncomeEl = document.getElementById('rh-finance-income');
const financeExpenseEl = document.getElementById('rh-finance-expense');
const financeTableBody = document.getElementById('rh-finance-table').querySelector('tbody');
const financeEmptyEl = document.getElementById('rh-finance-empty');
const taskTableBody = document.getElementById('rh-task-table').querySelector('tbody');
const notesInput = document.getElementById('rh-notes');
const notesStatus = document.getElementById('rh-notes-status');
const importInput = document.getElementById('rh-import-file');

initPortalShell({
  active: 'rh',
  onUserReady: (user) => {
    currentUser = user;
    if (user.role !== 'Rh' && user.role !== 'Admin') {
      window.location.href = 'index.html';
      return;
    }
    startRhView();
  }
});

notesInput.addEventListener('input', () => {
  notesText = notesInput.value;
  notesStatus.textContent = 'Salvando automaticamente...';
  window.clearTimeout(notesInput.dataset.timer);
  notesInput.dataset.timer = window.setTimeout(() => {
    notesStatus.textContent = 'Anotações salvas localmente';
    localStorage.setItem('rh-notes', notesText);
  }, 400);
});

importInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  financeData = rows.map((row) => ({
    date: row.date || '',
    description: row.description || '',
    category: row.category || 'Outros',
    amountCents: Number(row.amountCents || 0)
  }));
  renderFinance();
  notesStatus.textContent = `Importados ${financeData.length} registros do CSV`;
  event.target.value = '';
});

document.getElementById('btn-export-rh').addEventListener('click', exportRhCsv);

async function startRhView() {
  try {
    const [usersResponse, tasksResponse] = await Promise.all([
      api.get('/users'),
      api.get('/tasks')
    ]);
    users = usersResponse.users || [];
    tasks = tasksResponse.tasks || [];
    notesText = localStorage.getItem('rh-notes') || '';
    notesInput.value = notesText;
    financeData = [];
    renderOverview();
    renderTaskSummary();
    renderFinance();
  } catch (error) {
    console.error('Erro ao carregar área RH:', error);
  }
}

function renderOverview() {
  usersCountEl.textContent = users.length;
  const pending = tasks.filter((task) => task.status !== 'done').length;
  const done = tasks.filter((task) => task.status === 'done').length;
  tasksCountEl.textContent = tasks.length;
  pendingCountEl.textContent = pending;
  doneCountEl.textContent = done;
}

function renderTaskSummary() {
  const byUser = {};
  tasks.forEach((task) => {
    const assigneeName = users.find((user) => user.uid === task.assigneeId)?.name || 'Sem responsável';
    if (!byUser[assigneeName]) {
      byUser[assigneeName] = { pending: 0, done: 0 };
    }
    if (task.status === 'done') byUser[assigneeName].done += 1;
    else byUser[assigneeName].pending += 1;
  });

  taskTableBody.innerHTML = '';
  const rows = Object.entries(byUser).sort(([a], [b]) => a.localeCompare(b));
  if (!rows.length) {
    taskTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Nenhuma demanda cadastrada.</td></tr>';
    return;
  }

  rows.forEach(([name, stats]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(name)}</td>
      <td class="text-center">${stats.pending}</td>
      <td class="text-center">${stats.done}</td>
    `;
    taskTableBody.appendChild(tr);
  });
}

function renderFinance() {
  const financeRows = financeData.length ? financeData : [];
  const income = financeRows.reduce((sum, item) => sum + (item.amountCents > 0 ? item.amountCents : 0), 0);
  const expense = financeRows.reduce((sum, item) => sum + (item.amountCents < 0 ? Math.abs(item.amountCents) : 0), 0);
  const balance = income - expense;

  financeBalanceEl.textContent = formatCurrencyBRL(balance);
  financeIncomeEl.textContent = formatCurrencyBRL(income);
  financeExpenseEl.textContent = formatCurrencyBRL(expense);

  financeTableBody.innerHTML = '';
  if (!financeRows.length) {
    financeEmptyEl.classList.remove('d-none');
    return;
  }
  financeEmptyEl.classList.add('d-none');

  financeRows.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(item.date || '-')}</td>
      <td>${escapeHTML(item.description || '-')}</td>
      <td>${escapeHTML(item.category || 'Outros')}</td>
      <td class="text-end fw-bold ${item.amountCents < 0 ? 'text-danger' : 'text-success'}">${formatCurrencyBRL(item.amountCents)}</td>
    `;
    financeTableBody.appendChild(tr);
  });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() || '';
    });
    return row;
  });
}

function exportRhCsv() {
  const rows = financeData.length ? financeData : [];
  const csv = [
    ['date', 'description', 'category', 'amountCents'].join(','),
    ...rows.map((row) => [row.date, row.description, row.category, row.amountCents].map(escapeCsvCell).join(','))
  ].join('\n');
  downloadCSV(csv, 'rh-finance.csv');
}
