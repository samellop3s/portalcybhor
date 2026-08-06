// ============================================
// Módulo Financeiro - Cybhor Tech Portal v2
// ============================================
// Controle de receitas e despesas com resumo mensal,
// gráficos de fluxo de caixa e exportação CSV.

import { api } from "../shared/api-client.js";
import { getSocket } from "../shared/socket-client.js";
import { initPortalShell } from "../shared/portal-shell.js";
import {
  escapeHTML,
  formatCurrencyBRL,
  parseCurrencyToCents,
  formatDateBR,
  dateInputToEpoch,
  epochToDateInput,
  downloadCSV,
  escapeCsvCell
} from "../shared/utils.js";

const TYPE_LABELS = { income: 'Receita', expense: 'Despesa' };

let currentUser = null;
let transactions = {};
let cashflowChart = null;
let categoryChart = null;

const tableBody = document.querySelector('#transactions-table tbody');
const emptyState = document.getElementById('transactions-empty');
const filterMonth = document.getElementById('filter-month');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const transactionForm = document.getElementById('transaction-form');
const modalEl = document.getElementById('transactionModal');
let transactionModal = null;

initPortalShell({
  active: 'finance',
  onUserReady: (user) => {
    currentUser = user;
    applyPermissions();
    startRealtimeSync();
  }
});

transactionModal = new bootstrap.Modal(modalEl);

// Mês corrente (local) como filtro inicial
filterMonth.value = epochToDateInput(Date.now()).slice(0, 7);

[filterMonth, filterType, filterCategory].forEach(el => {
  el.addEventListener('change', renderAll);
});

document.getElementById('btn-add-transaction').addEventListener('click', () => {
  prepareModalForCreate();
});

document.getElementById('btn-export-finance').addEventListener('click', exportCSV);

transactionForm.addEventListener('submit', handleFormSubmit);

function canManageTransactions() {
  return !!currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Integrante');
}

function applyPermissions() {
  if (currentUser && !canManageTransactions()) {
    document.getElementById('btn-add-transaction').classList.add('d-none');
  }
}

function arrayToMap(list) {
  const map = {};
  list.forEach(item => { map[item.id] = item; });
  return map;
}

async function startRealtimeSync() {
  try {
    const { transactions: txList } = await api.get('/finance/transactions');
    transactions = arrayToMap(txList);
    populateCategoryFilter();
    renderAll();
  } catch (error) {
    console.error('Erro ao carregar lançamentos financeiros:', error);
  }

  const socket = getSocket();
  socket.on('financeTx:created', (tx) => {
    transactions[tx.id] = tx;
    populateCategoryFilter();
    renderAll();
  });
  socket.on('financeTx:updated', (tx) => {
    transactions[tx.id] = tx;
    populateCategoryFilter();
    renderAll();
  });
  socket.on('financeTx:deleted', ({ id }) => {
    delete transactions[id];
    populateCategoryFilter();
    renderAll();
  });
}

function populateCategoryFilter() {
  const categories = [...new Set(Object.values(transactions).map(t => t.category))].sort();
  const currentValue = filterCategory.value;
  filterCategory.innerHTML = '<option value="">Todas as categorias</option>' +
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if (categories.includes(currentValue)) {
    filterCategory.value = currentValue;
  }
}

function getFilteredTransactions() {
  const monthValue = filterMonth.value; // aaaa-mm
  const typeValue = filterType.value;
  const categoryValue = filterCategory.value;

  return Object.entries(transactions)
    .map(([id, tx]) => ({ id, ...tx }))
    .filter(tx => {
      if (monthValue) {
        const txMonth = epochToDateInput(tx.date).slice(0, 7);
        if (txMonth !== monthValue) return false;
      }
      if (typeValue && tx.type !== typeValue) return false;
      if (categoryValue && tx.category !== categoryValue) return false;
      return true;
    })
    .sort((a, b) => b.date - a.date);
}

function renderAll() {
  const filtered = getFilteredTransactions();
  renderSummary(filtered);
  renderTable(filtered);
  renderCashflowChart();
  renderCategoryChart(filtered);
}

function renderSummary(filtered) {
  const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amountCents, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amountCents, 0);

  // Saldo total considera TODOS os lançamentos, independente do filtro
  const totalBalance = Object.values(transactions)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amountCents : -t.amountCents), 0);

  document.getElementById('stat-balance').textContent = formatCurrencyBRL(totalBalance);
  document.getElementById('stat-income').textContent = formatCurrencyBRL(income);
  document.getElementById('stat-expense').textContent = formatCurrencyBRL(expense);
  document.getElementById('stat-count').textContent = filtered.length;

  const balanceEl = document.getElementById('stat-balance');
  balanceEl.classList.toggle('text-danger', totalBalance < 0);
}

function renderTable(filtered) {
  tableBody.innerHTML = '';
  emptyState.classList.toggle('d-none', filtered.length > 0);

  const canManage = canManageTransactions();
  const isAdmin = currentUser && currentUser.role === 'Admin';

  filtered.forEach(tx => {
    const isIncome = tx.type === 'income';
    const canEdit = canManage && (isAdmin || tx.createdBy === currentUser.uid);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-nowrap">${formatDateBR(tx.date)}</td>
      <td>
        <span class="badge ${isIncome ? 'badge-income' : 'badge-expense'} me-1">${TYPE_LABELS[tx.type] || tx.type}</span>
        ${escapeHTML(tx.description)}
      </td>
      <td><span class="badge badge-neutral">${escapeHTML(tx.category)}</span></td>
      <td class="text-end text-nowrap fw-bold ${isIncome ? 'text-success' : 'text-danger'}">
        ${isIncome ? '+' : '-'} ${formatCurrencyBRL(tx.amountCents)}
      </td>
      <td class="small text-muted">${escapeHTML(tx.createdByName || '-')}</td>
      <td class="text-end text-nowrap">
        ${canEdit ? `
          <button class="btn btn-sm btn-link text-info p-1 edit-tx-btn" data-id="${tx.id}" title="Editar"><i data-lucide="pencil" style="width: 15px;"></i></button>
          <button class="btn btn-sm btn-link text-danger p-1 delete-tx-btn" data-id="${tx.id}" title="Excluir"><i data-lucide="trash-2" style="width: 15px;"></i></button>
        ` : ''}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll('.edit-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => prepareModalForEdit(btn.dataset.id));
  });
  tableBody.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderCashflowChart() {
  const ctx = document.getElementById('cashflow-chart').getContext('2d');
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' })
    });
  }

  const incomeData = months.map(m => sumByMonth(m.key, 'income') / 100);
  const expenseData = months.map(m => sumByMonth(m.key, 'expense') / 100);

  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#e2e8f0' : '#334155';
  const gridColor = isDark ? 'rgba(226, 232, 240, 0.12)' : 'rgba(15, 23, 42, 0.08)';

  if (cashflowChart) cashflowChart.destroy();
  cashflowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Receitas', data: incomeData, backgroundColor: '#16a34a' },
        { label: 'Despesas', data: expenseData, backgroundColor: '#dc2626' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}

function sumByMonth(monthKey, type) {
  return Object.values(transactions)
    .filter(t => t.type === type && epochToDateInput(t.date).slice(0, 7) === monthKey)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

function renderCategoryChart(filtered) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  const expenses = filtered.filter(t => t.type === 'expense');

  const byCategory = {};
  expenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amountCents;
  });

  const labels = Object.keys(byCategory);
  const data = labels.map(l => byCategory[l] / 100);
  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#e2e8f0' : '#334155';

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Sem despesas'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: ['#f97316', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#64748b']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
    }
  });
}

function prepareModalForCreate() {
  transactionForm.reset();
  document.getElementById('transaction-id').value = '';
  document.getElementById('transaction-date').value = epochToDateInput(Date.now());
  document.getElementById('transactionModalLabel').textContent = 'Novo Lançamento';
}

function prepareModalForEdit(txId) {
  const tx = transactions[txId];
  if (!tx) return;

  document.getElementById('transaction-id').value = txId;
  document.getElementById('transaction-type').value = tx.type;
  document.getElementById('transaction-date').value = epochToDateInput(tx.date);
  document.getElementById('transaction-description').value = tx.description;
  document.getElementById('transaction-category').value = tx.category;
  document.getElementById('transaction-amount').value = (tx.amountCents / 100).toFixed(2).replace('.', ',');
  document.getElementById('transactionModalLabel').textContent = 'Editar Lançamento';
  transactionModal.show();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const txId = document.getElementById('transaction-id').value;
  const amountCents = parseCurrencyToCents(document.getElementById('transaction-amount').value);
  const date = dateInputToEpoch(document.getElementById('transaction-date').value);

  if (amountCents === null || amountCents === 0) {
    alert('Informe um valor válido maior que zero.');
    return;
  }
  if (!date) {
    alert('Informe uma data válida.');
    return;
  }

  const payload = {
    type: document.getElementById('transaction-type').value,
    description: document.getElementById('transaction-description').value.trim(),
    category: document.getElementById('transaction-category').value,
    amountCents,
    date
  };

  try {
    if (txId) {
      await api.patch(`/finance/transactions/${txId}`, payload);
    } else {
      await api.post('/finance/transactions', payload);
    }
    transactionModal.hide();
    transactionForm.reset();
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    alert('Erro ao salvar lançamento: permissão negada.');
  }
}

async function deleteTransaction(txId) {
  if (!confirm('Deseja realmente excluir este lançamento?')) return;
  try {
    await api.delete(`/finance/transactions/${txId}`);
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    alert('Erro ao excluir lançamento: permissão negada.');
  }
}

function exportCSV() {
  const filtered = getFilteredTransactions();
  const lines = ['Data,Tipo,Descrição,Categoria,Valor (R$),Registrado por'];

  filtered.forEach(tx => {
    lines.push([
      formatDateBR(tx.date),
      TYPE_LABELS[tx.type] || tx.type,
      tx.description,
      tx.category,
      ((tx.type === 'income' ? 1 : -1) * tx.amountCents / 100).toFixed(2).replace('.', ','),
      tx.createdByName || '-'
    ].map(escapeCsvCell).join(','));
  });

  downloadCSV(lines.join('\n'), `financeiro_${filterMonth.value || 'todos'}.csv`);
}
