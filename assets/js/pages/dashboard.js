import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { firebaseConfig } from "../shared/config.js";
import StorageManager from "../shared/storage-manager.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Initialize Storage Manager for local persistence
const storageManager = new StorageManager();

// DOM
const totalEl = document.getElementById('total-tasks');
const doneEl = document.getElementById('count-done');
const failedEl = document.getElementById('count-failed');
const otherEl = document.getElementById('count-other');
const pieCtx = document.getElementById('pieChart').getContext('2d');
const barCtx = document.getElementById('barChart').getContext('2d');
const tasksTableBody = document.querySelector('#tasks-table tbody');

const btnRefresh = document.getElementById('btn-refresh');
const btnBack = document.getElementById('btn-back');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const btnExport = document.getElementById('btn-export-csv');
const btnClear = document.getElementById('btn-clear-filters');
const themeStorageKey = 'cybhorTheme';

let pieChart, barChart;
let tasks = {};
let users = {};
let stages = {};

function formatDateEpoch(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  return d.toLocaleString();
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  if (btnThemeToggle) {
    btnThemeToggle.innerHTML = isDark
      ? '<i data-lucide="sun" class="align-middle"></i>'
      : '<i data-lucide="moon" class="align-middle"></i>';
    btnThemeToggle.setAttribute('aria-label', isDark ? 'Modo claro' : 'Modo escuro');
  }
  localStorage.setItem(themeStorageKey, theme);
  if (window.lucide) window.lucide.createIcons();
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  const defaultTheme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(defaultTheme);
}

function buildCharts(statsByUser) {
  const total = Object.keys(tasks).length;
  const done = Object.values(tasks).filter(t => t.status === 'done').length;
  const failed = Object.values(tasks).filter(t => t.status === 'failed').length;
  const other = total - done - failed;

  totalEl.textContent = total;
  doneEl.textContent = done;
  failedEl.textContent = failed;
  otherEl.textContent = other;

  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#e2e8f0' : '#0f172a';
  const gridColor = isDark ? 'rgba(226, 232, 240, 0.12)' : 'rgba(15, 23, 42, 0.08)';

  // Status column chart
  const statusData = [done, failed, other];
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: 'bar',
    data: {
      labels: ['Concluídas', 'Falhas', 'Outras'],
      datasets: [{
        label: 'Tarefas',
        data: statusData,
        backgroundColor: ['#16a34a', '#dc2626', '#f59e0b'],
        borderColor: ['#16a34a', '#dc2626', '#f59e0b'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: textColor } }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor },
          grid: { color: gridColor }
        }
      }
    }
  });

  // Bar chart: per user
  const labels = Object.keys(statsByUser);
  const doneData = labels.map(k => statsByUser[k].done || 0);
  const failedData = labels.map(k => statsByUser[k].failed || 0);

  if (barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Concluídas', data: doneData, backgroundColor: '#16a34a' },
        { label: 'Falhas', data: failedData, backgroundColor: '#dc2626' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: textColor } }
      },
      scales: {
        x: { stacked: false, ticks: { color: textColor }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}

function buildTable() {
  // Show 50 latest changed tasks (by createdAt or completedAt fallback)
  const arr = Object.keys(tasks).map(id => ({ id, ...tasks[id] }));
  arr.sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
  const slice = arr.slice(0, 50);

  tasksTableBody.innerHTML = '';
  slice.forEach(t => {
    const tr = document.createElement('tr');
    const assignee = users[t.assigneeId] ? users[t.assigneeId].name : (t.assigneeId ? t.assigneeId : '-');
    const stage = stages[t.stageId] ? stages[t.stageId].title : (t.stageId ? t.stageId : '-');
    tr.innerHTML = `
      <td>${t.title || '-'}</td>
      <td>${assignee}</td>
      <td>${stage}</td>
      <td>${t.completedAt ? formatDateEpoch(t.completedAt) : '-'}</td>
      <td>${t.status || 'pending'}</td>
    `;
    tasksTableBody.appendChild(tr);
  });
}

function computeStatsByUser() {
  const stats = {};
  Object.keys(tasks).forEach(id => {
    const t = tasks[id];
    const uid = t.assigneeId || t.creatorId || 'SemAssignee';
    stats[uid] = stats[uid] || { done: 0, failed: 0 };
    if (t.status === 'done') stats[uid].done++;
    if (t.status === 'failed') stats[uid].failed++;
  });

  // Map uids to friendly names in keys
  const mapped = {};
  Object.keys(stats).forEach(uid => {
    const label = users[uid] ? users[uid].name : (uid === 'SemAssignee' ? 'Sem Assignee' : uid);
    mapped[label] = stats[uid];
  });
  return mapped;
}

function escapeCsvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCsvDate(ms) {
  if (!ms) return '';
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

function buildDashboardCsv() {
  const totalTasks = Object.keys(tasks).length;
  const doneTasks = Object.values(tasks).filter(t => t.status === 'done').length;
  const failedTasks = Object.values(tasks).filter(t => t.status === 'failed').length;
  const otherTasks = totalTasks - doneTasks - failedTasks;

  const statsByUser = computeStatsByUser();
  const taskRows = Object.keys(tasks)
    .map(id => ({ id, ...tasks[id] }))
    .sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0))
    .map(task => [
      task.title || '-',
      users[task.assigneeId] ? users[task.assigneeId].name : (task.assigneeId || '-'),
      stages[task.stageId] ? stages[task.stageId].title : (task.stageId || '-'),
      task.status || 'pending',
      task.priority || '-',
      (task.description || '').replace(/\r?\n/g, ' '),
      formatCsvDate(task.createdAt),
      formatCsvDate(task.completedAt)
    ]);

  const lines = [];
  lines.push('Resumo do Dashboard');
  lines.push('Metrica,Valor');
  lines.push(`Total de tarefas,${totalTasks}`);
  lines.push(`Concluídas,${doneTasks}`);
  lines.push(`Falhas,${failedTasks}`);
  lines.push(`Outras,${otherTasks}`);
  lines.push('');
  lines.push('Desempenho por usuário');
  lines.push('Usuário,Concluídas,Falhas');
  Object.keys(statsByUser).sort((a, b) => a.localeCompare(b)).forEach(userName => {
    const userStats = statsByUser[userName];
    lines.push(`${escapeCsvCell(userName)},${userStats.done || 0},${userStats.failed || 0}`);
  });
  lines.push('');
  lines.push('Detalhes das tarefas');
  lines.push('Título,Responsável,Etapa,Status,Prioridade,Descrição,Data de criação,Data de conclusão');
  taskRows.forEach(row => {
    lines.push(row.map(cell => escapeCsvCell(cell)).join(','));
  });

  return lines.join('\n');
}

function attachActions() {
  btnRefresh.addEventListener('click', () => {
    // force rebuild from current memory
    const statsByUser = computeStatsByUser();
    buildCharts(statsByUser);
    buildTable();
  });

  btnBack.addEventListener('click', () => {
    window.history.back();
  });

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  document.body.classList.add('dashboard-page');

  btnExport.addEventListener('click', () => {
    const csv = buildDashboardCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btnClear.addEventListener('click', () => {
    // not many filters implemented yet; simply rebuild
    const statsByUser = computeStatsByUser();
    buildCharts(statsByUser);
    buildTable();
  });
}

// Real-time listeners
function startRealtime() {
  // Load cached data from localStorage first
  const cachedTasks = storageManager.loadTasks();
  const cachedStages = storageManager.loadStages();
  
  if (Object.keys(cachedTasks).length > 0) {
    tasks = cachedTasks;
  }
  if (Object.keys(cachedStages).length > 0) {
    stages = cachedStages;
  }

  // users
  onValue(ref(db, 'users'), snapshot => {
    users = snapshot.exists() ? snapshot.val() : {};
    // rebuild charts when users arrive
    const statsByUser = computeStatsByUser();
    buildCharts(statsByUser);
    buildTable();
  });

  // stages
  onValue(ref(db, 'stages'), snapshot => {
    stages = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveStages(stages);
    buildTable();
  });

  // tasks
  onValue(ref(db, 'tasks'), snapshot => {
    tasks = snapshot.exists() ? snapshot.val() : {};
    storageManager.saveTasks(tasks);
    const statsByUser = computeStatsByUser();
    buildCharts(statsByUser);
    buildTable();
  });
}

initializeTheme();
if (window.lucide) window.lucide.createIcons();

// Auth guard: allow only logged users to view (simpler UX)
onAuthStateChanged(auth, user => {
  if (!user) {
    // redirect to login (reuse index.html)
    window.location.href = './index.html';
    return;
  }

  // start realtime after auth
  startRealtime();
  attachActions();
});
