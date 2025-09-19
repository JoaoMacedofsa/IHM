// Estado e utilidades
const STORAGE_KEY = "ihm-monthly-budget-v1";
const months = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

/** @typedef {{ id: string, type: 'income'|'expense', category: string, amount: number, date: string, fixed: boolean }} Entry */

/** @type {{ entries: Entry[] }} */
let state = { entries: [] };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (_) { /* ignore */ }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// Seletores
const el = {
  toDashboard: document.getElementById('to-dashboard'),
  toPlanner: document.getElementById('to-planner'),
  screenDashboard: document.getElementById('screen-dashboard'),
  screenPlanner: document.getElementById('screen-planner'),
  incomeTotal: document.getElementById('income-total'),
  expenseTotal: document.getElementById('expense-total'),
  balance: document.getElementById('balance'),
  monthSelect: document.getElementById('month-select'),
  hideEmpty: document.getElementById('hide-empty'),
  summaryBody: document.getElementById('summary-body'),
  entryForm: document.getElementById('entry-form'),
  type: document.getElementById('type'),
  category: document.getElementById('category'),
  amount: document.getElementById('amount'),
  date: document.getElementById('date'),
  fixed: document.getElementById('fixed'),
  clearAll: document.getElementById('clear-all'),
  entriesBody: document.getElementById('entries-body'),
};

function navigate(target) {
  const showDashboard = target === 'dashboard';
  el.screenDashboard.classList.toggle('active', showDashboard);
  el.screenPlanner.classList.toggle('active', !showDashboard);
  el.screenPlanner.toggleAttribute('hidden', showDashboard);
  el.screenDashboard.toggleAttribute('hidden', !showDashboard);
}

function ensureMonthOptions() {
  const monthKeys = new Set(state.entries.map(e => getMonthKey(e.date)));
  // sempre incluir mês atual
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  monthKeys.add(currentKey);
  const keysSorted = Array.from(monthKeys).sort();
  el.monthSelect.innerHTML = '';
  for (const key of keysSorted) {
    const [y, m] = key.split('-').map(Number);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${months[m-1]} / ${y}`;
    el.monthSelect.appendChild(opt);
  }
  el.monthSelect.value = currentKey;
}

function computeSummaryForMonth(monthKey) {
  const entries = state.entries.filter(e => getMonthKey(e.date) === monthKey);
  const categoryMap = new Map();
  for (const e of entries) {
    const item = categoryMap.get(e.category) || { income: 0, expense: 0 };
    item[e.type] += e.amount;
    categoryMap.set(e.category, item);
  }
  let totalIncome = 0, totalExpense = 0;
  for (const [, v] of categoryMap) { totalIncome += v.income; totalExpense += v.expense; }
  return { categoryMap, totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

function renderDashboard() {
  const mk = el.monthSelect.value;
  const { categoryMap, totalIncome, totalExpense, balance } = computeSummaryForMonth(mk);
  el.incomeTotal.textContent = formatCurrency(totalIncome);
  el.expenseTotal.textContent = formatCurrency(totalExpense);
  el.balance.textContent = formatCurrency(balance);
  el.balance.classList.toggle('positive', balance >= 0);
  el.balance.classList.toggle('negative', balance < 0);

  const hideEmpty = el.hideEmpty.checked;
  el.summaryBody.innerHTML = '';
  const categories = Array.from(categoryMap.keys()).sort((a,b)=>a.localeCompare(b));
  for (const cat of categories) {
    const v = categoryMap.get(cat);
    if (hideEmpty && v.income === 0 && v.expense === 0) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cat}</td>
      <td>${formatCurrency(v.income)}</td>
      <td>${formatCurrency(v.expense)}</td>
      <td class="${(v.income - v.expense) < 0 ? 'negative' : 'positive'}">${formatCurrency(v.income - v.expense)}</td>
    `;
    el.summaryBody.appendChild(tr);
  }
}

function renderEntries() {
  const mk = el.monthSelect.value;
  const entries = state.entries
    .filter(e => getMonthKey(e.date) === mk)
    .sort((a,b) => new Date(a.date) - new Date(b.date));
  el.entriesBody.innerHTML = '';
  for (const e of entries) {
    const tr = document.createElement('tr');
    tr.dataset.id = e.id;
    const fixedIcon = e.fixed ? '✔️' : '—';
    tr.innerHTML = `
      <td>${e.type === 'income' ? 'Receita' : 'Despesa'}</td>
      <td>${e.category}</td>
      <td>${formatCurrency(e.amount)}</td>
      <td>${new Date(e.date).toLocaleDateString('pt-BR')}</td>
      <td style="text-align:center" title="${e.fixed ? 'Lançamento recorrente' : 'Não recorrente'}">${fixedIcon}</td>
      <td>
        <button class="action" data-action="delete">Excluir</button>
      </td>
    `;
    el.entriesBody.appendChild(tr);
  }
}

function addEntryFromForm() {
  const type = el.type.value;
  const category = el.category.value.trim();
  const amount = Number(el.amount.value);
  const date = el.date.value;
  const fixed = el.fixed.checked;
  if (!category || !date || Number.isNaN(amount) || amount < 0) return;
  /** @type {Entry} */
  const entry = { id: uid(), type, category, amount, date, fixed };
  state.entries.push(entry);
  saveState();
  renderAll();
  el.entryForm.reset();
}

function deleteEntry(id) {
  const idx = state.entries.findIndex(e => e.id === id);
  if (idx !== -1) {
    state.entries.splice(idx, 1);
    saveState();
    renderAll();
  }
}

function clearAllEntries() {
  if (!confirm('Tem certeza que deseja apagar todos os lançamentos?')) return;
  state.entries = [];
  saveState();
  ensureMonthOptions();
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderEntries();
}

// Eventos
function wireEvents() {
  el.toDashboard.addEventListener('click', () => navigate('dashboard'));
  el.toPlanner.addEventListener('click', () => navigate('planner'));
  el.monthSelect.addEventListener('change', renderAll);
  el.hideEmpty.addEventListener('change', renderDashboard);
  el.entryForm.addEventListener('submit', (ev) => { ev.preventDefault(); addEntryFromForm(); });
  el.clearAll.addEventListener('click', clearAllEntries);
  el.entriesBody.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (action === 'delete') {
      const tr = target.closest('tr');
      if (tr && tr.dataset.id) deleteEntry(tr.dataset.id);
    }
  });
}

// Inicialização
function init() {
  loadState();
  ensureMonthOptions();
  const today = new Date();
  el.date.valueAsDate = today;
  wireEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);


