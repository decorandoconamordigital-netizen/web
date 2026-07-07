'use strict';

const LEGACY_KEY = 'eucaPanelData';
const CURRENT_FAIR_KEY = 'eucaCurrentFair';
const FAIR_PROFILES = {
  euca: { eventName: 'EUCA', eventDate: '2026-07-11', location: 'Bosques de Eucalipto', stallCount: 40, stallPrice: 0 },
  plate: { eventName: 'PLATE', eventDate: '2026-07-12', location: 'Predio Plate', stallCount: 40, stallPrice: 0 },
};

let currentFair = localStorage.getItem(CURRENT_FAIR_KEY) || 'euca';
let state = loadState();
let selectedStall = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaults(fair = currentFair) {
  return {
    settings: { ...FAIR_PROFILES[fair] },
    movements: [],
    participants: [],
    stalls: {},
  };
}

function storageKey(fair = currentFair) {
  return `${LEGACY_KEY}_${fair}`;
}

function loadState() {
  const defaults = createDefaults();
  const legacy = currentFair === 'euca' ? readLegacy() : {};
  try {
    const raw = localStorage.getItem(storageKey()) || (currentFair === 'euca' ? localStorage.getItem(LEGACY_KEY) : null);
    return raw ? normalize(JSON.parse(raw)) : normalize({ ...defaults, ...legacy });
  } catch {
    return structuredClone(defaults);
  }
}

function readLegacy() {
  const out = {};
  try {
    const feriantes = JSON.parse(localStorage.getItem('db_feriantes') || '[]');
    if (feriantes.length) {
      out.participants = feriantes.map((f) => ({
        id: f.id || uid('part'),
        name: f.nombre || '',
        category: f.rubro || '',
        phone: f.telefono || '',
        email: '',
        status: 'activo',
      }));
    }

    const caja = JSON.parse(localStorage.getItem('db_caja') || '[]');
    if (caja.length) {
      out.movements = caja.map((m) => ({
        id: String(m.id || uid('mov')),
        detail: m.detalle || m.concepto || '',
        type: (m.tipo || 'ingreso').toLowerCase().startsWith('g') ? 'gasto' : 'ingreso',
        amount: Number(m.monto) || 0,
        date: toISODate(m.fecha) || today(),
        source: 'legacy',
      }));
    }

    const mapa = JSON.parse(localStorage.getItem('db_mapa_puestos') || '{}');
    if (Object.keys(mapa).length) {
      out.stalls = Object.fromEntries(
        Object.entries(mapa).map(([number, id]) => [number, {
          participantId: id,
          notes: '',
          paymentStatus: 'pendiente',
          paymentAmount: 0,
          paymentMethod: 'efectivo',
          movementId: '',
        }]),
      );
    }
  } catch {
    // Si los datos heredados están dañados, se ignoran para no bloquear la app.
  }
  return out;
}

function normalize(data) {
  const settings = { ...createDefaults().settings, ...(data.settings || {}) };
  settings.stallPrice = Number(settings.stallPrice) || 0;

  return {
    settings,
    movements: Array.isArray(data.movements) ? data.movements.map((m) => ({
      id: m.id || uid('mov'),
      detail: m.detail || '',
      type: m.type === 'gasto' ? 'gasto' : 'ingreso',
      amount: Number(m.amount) || 0,
      date: m.date || today(),
      source: m.source || 'manual',
    })) : [],
    participants: Array.isArray(data.participants) ? data.participants.map((p) => ({
      id: p.id || uid('part'),
      name: p.name || '',
      category: p.category || '',
      phone: p.phone || '',
      email: p.email || '',
      status: p.status || 'activo',
    })) : [],
    stalls: normalizeStalls(data.stalls),
  };
}

function normalizeStalls(stalls) {
  if (!stalls || typeof stalls !== 'object') return {};
  return Object.fromEntries(Object.entries(stalls).map(([number, stall]) => [number, {
    participantId: stall.participantId || '',
    notes: stall.notes || '',
    paymentStatus: stall.paymentStatus || 'pendiente',
    paymentAmount: Number(stall.paymentAmount) || 0,
    paymentMethod: stall.paymentMethod || 'efectivo',
    movementId: stall.movementId || '',
  }]));
}

function save() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  $('#save-status').textContent = `● Guardado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  renderAll();
}

function money(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value) || 0);
}

function toISODate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = String(value).split('/');
  return parts.length === 3 ? `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : null;
}

function dateFmt(date) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function setView() {
  const view = (location.hash || '#dashboard').slice(1);
  $$('.view').forEach((node) => node.classList.toggle('active', node.id === `view-${view}`));
  $$('.nav a').forEach((link) => link.classList.toggle('active', link.dataset.view === view));
  $('#page-title').textContent = {
    dashboard: 'Dashboard',
    contabilidad: 'Contabilidad',
    participantes: 'Participantes',
    puestos: 'Puestos',
    configuracion: 'Configuración',
  }[view] || 'Dashboard';
  $('.sidebar').classList.remove('open');
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderAccounting();
  renderParticipants();
  renderStalls();
  renderSettings();
}

function totals() {
  const income = state.movements.filter((m) => m.type === 'ingreso').reduce((acc, mov) => acc + Number(mov.amount), 0);
  const expense = state.movements.filter((m) => m.type === 'gasto').reduce((acc, mov) => acc + Number(mov.amount), 0);
  const occupied = Object.keys(state.stalls).length;
  const paidStalls = Object.values(state.stalls).filter((stall) => stall.paymentStatus === 'pagado').length;
  return {
    income,
    expense,
    balance: income - expense,
    occupied,
    paidStalls,
    free: Math.max(0, state.settings.stallCount - occupied),
  };
}

function stat(label, value, extra = '') {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong><small>${extra}</small></div>`;
}

function renderDashboard() {
  if (!$('#dashboard-stats')) return;
  const data = totals();
  $('#hero-event-name').textContent = state.settings.eventName;
  $('#hero-event-meta').textContent = state.settings.location;
  $('#hero-date').textContent = dateFmt(state.settings.eventDate);
  $('#dashboard-stats').innerHTML = [
    stat('Saldo', money(data.balance), 'Caja actual'),
    stat('Participantes', state.participants.length, 'Registrados'),
    stat('Puestos libres', data.free, `de ${state.settings.stallCount}`),
    stat('Pagos de puestos', data.paidStalls, `${data.occupied} ocupados`),
  ].join('');
  $('#dashboard-movements').innerHTML = state.movements.slice(-5).reverse().map((mov) => `<tr><td>${dateFmt(mov.date)}</td><td>${escapeHtml(mov.detail)}</td><td>${mov.type}</td><td class="${mov.type === 'ingreso' ? 'amount-income' : 'amount-expense'}">${money(mov.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin movimientos.</td></tr>';
  $('#dashboard-assignments').innerHTML = Object.entries(state.stalls).slice(-6).map(([number, stall]) => `<div class="activity-item"><strong>Puesto ${number}</strong><br>${participantName(stall.participantId)} · ${stall.paymentStatus === 'pagado' ? 'Pagado' : 'Pendiente'}</div>`).join('') || '<p class="empty">Sin puestos asignados.</p>';
}

function renderAccounting() {
  if (!$('#movement-table')) return;
  const data = totals();
  $('#accounting-stats').innerHTML = [
    stat('Ingresos', money(data.income)),
    stat('Gastos', money(data.expense)),
    stat('Saldo', money(data.balance)),
    stat('Movimientos', state.movements.length),
  ].join('');
  const query = ($('#movement-search')?.value || '').toLowerCase();
  const rows = state.movements
    .filter((mov) => `${mov.detail} ${mov.type}`.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));
  $('#movement-table').innerHTML = rows.map((mov) => `<tr><td>${dateFmt(mov.date)}</td><td>${escapeHtml(mov.detail)}${mov.source === 'puesto' ? '<br><small>Generado desde Puestos</small>' : ''}</td><td>${mov.type}</td><td class="${mov.type === 'ingreso' ? 'amount-income' : 'amount-expense'}">${money(mov.amount)}</td><td class="row-actions"><button data-edit-movement="${mov.id}">Editar</button><button data-delete-movement="${mov.id}">Eliminar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay movimientos.</td></tr>';
}

function renderParticipants() {
  if (!$('#participant-table')) return;
  const query = ($('#participant-search')?.value || '').toLowerCase();
  const rows = state.participants.filter((participant) => `${participant.name} ${participant.category} ${participant.phone} ${participant.email}`.toLowerCase().includes(query));
  $('#participant-table').innerHTML = rows.map((participant) => {
    const stallNumber = stallByParticipant(participant.id);
    const stall = stallNumber ? state.stalls[stallNumber] : null;
    return `<tr><td><strong>${escapeHtml(participant.name)}</strong></td><td>${escapeHtml(participant.category)}</td><td>${escapeHtml(participant.phone)}<br><small>${escapeHtml(participant.email)}</small></td><td><span class="badge">${participant.status}</span></td><td>${stallNumber || '-'}${stall ? `<br><small>${stall.paymentStatus === 'pagado' ? `Pagado ${money(stall.paymentAmount)}` : 'Pago pendiente'}</small>` : ''}</td><td class="row-actions"><button data-edit-participant="${participant.id}">Editar</button><button data-delete-participant="${participant.id}">Eliminar</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">No hay participantes.</td></tr>';
}

function participantName(id) {
  return escapeHtml(state.participants.find((participant) => participant.id === id)?.name || 'Participante eliminado');
}

function participantRawName(id) {
  return state.participants.find((participant) => participant.id === id)?.name || 'Participante eliminado';
}

function stallByParticipant(id) {
  return Object.entries(state.stalls).find(([, stall]) => stall.participantId === id)?.[0];
}

function renderStalls() {
  if (!$('#stall-map')) return;
  $('#stall-map').innerHTML = Array.from({ length: state.settings.stallCount }, (_, index) => {
    const number = index + 1;
    const stall = state.stalls[number];
    const paymentLabel = stall?.paymentStatus === 'pagado' ? 'Pagado' : 'Pendiente';
    return `<button class="stall ${stall ? 'busy' : 'free'} ${selectedStall === number ? 'selected' : ''}" data-stall="${number}" title="${stall ? participantName(stall.participantId) : 'Libre'}">${number}<br><small>${stall ? paymentLabel : 'Libre'}</small></button>`;
  }).join('');
  $('#stall-participant').innerHTML = '<option value="">-- Sin asignar --</option>' + state.participants
    .filter((participant) => participant.status === 'activo')
    .map((participant) => `<option value="${participant.id}">${escapeHtml(participant.name)} · ${escapeHtml(participant.category)}</option>`)
    .join('');

  if (selectedStall) {
    const stall = state.stalls[selectedStall] || {};
    $('#stall-panel-title').textContent = `Puesto ${selectedStall}`;
    $('#stall-number').value = selectedStall;
    $('#stall-participant').value = stall.participantId || '';
    $('#stall-payment-status').value = stall.paymentStatus || 'pendiente';
    $('#stall-payment-amount').value = stall.paymentAmount || state.settings.stallPrice || '';
    $('#stall-payment-method').value = stall.paymentMethod || 'efectivo';
    $('#stall-notes').value = stall.notes || '';
  }
}

function renderSettings() {
  if (!$('#settings-form')) return;
  $('#setting-event-name').value = state.settings.eventName;
  $('#setting-event-date').value = state.settings.eventDate;
  $('#setting-location').value = state.settings.location;
  $('#setting-stalls').value = state.settings.stallCount;
  $('#setting-stall-price').value = state.settings.stallPrice;
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 2400);
}

function upsertStallPaymentMovement(stallNumber, stall) {
  if (stall.paymentStatus !== 'pagado' || !stall.participantId || !stall.paymentAmount) {
    if (stall.movementId) {
      state.movements = state.movements.filter((mov) => mov.id !== stall.movementId);
      stall.movementId = '';
    }
    return;
  }

  const movement = {
    id: stall.movementId || uid('mov'),
    detail: `Pago puesto ${stallNumber} - ${participantRawName(stall.participantId)} (${stall.paymentMethod})`,
    type: 'ingreso',
    amount: Number(stall.paymentAmount),
    date: today(),
    source: 'puesto',
  };
  stall.movementId = movement.id;
  state.movements = state.movements.filter((mov) => mov.id !== movement.id).concat(movement);
}

function addParticipantPaymentMovement(participant, amount, method) {
  const parsedAmount = Number(amount);
  if (!parsedAmount) return;
  state.movements.push({
    id: uid('mov'),
    detail: `Pago inicial participante - ${participant.name} (${method})`,
    type: 'ingreso',
    amount: parsedAmount,
    date: today(),
    source: 'participante',
  });
}

function switchFair(fair) {
  if (!FAIR_PROFILES[fair]) return;
  currentFair = fair;
  localStorage.setItem(CURRENT_FAIR_KEY, fair);
  selectedStall = null;
  state = loadState();
  renderAll();
  toast(`Administrando feria ${FAIR_PROFILES[fair].eventName}`);
}

function bind() {
  window.addEventListener('hashchange', setView);
  $('#menu-toggle').onclick = () => $('.sidebar').classList.toggle('open');
  $('#fair-selector').value = currentFair;
  $('#fair-selector').addEventListener('change', (event) => switchFair(event.target.value));
  $('#movement-date').value = today();

  $('#movement-form').onsubmit = (event) => {
    event.preventDefault();
    const id = $('#movement-id').value || uid('mov');
    const item = {
      id,
      detail: $('#movement-detail').value.trim(),
      type: $('#movement-type').value,
      amount: Number($('#movement-amount').value),
      date: $('#movement-date').value,
      source: 'manual',
    };
    state.movements = state.movements.filter((mov) => mov.id !== id).concat(item);
    event.target.reset();
    $('#movement-date').value = today();
    $('#movement-id').value = '';
    $('#cancel-movement-edit').hidden = true;
    save();
    toast('Movimiento guardado');
  };

  $('#participant-form').onsubmit = (event) => {
    event.preventDefault();
    const id = $('#participant-id').value || uid('part');
    const isNew = !state.participants.some((participant) => participant.id === id);
    const participant = {
      id,
      name: $('#participant-name').value.trim(),
      category: $('#participant-category').value.trim(),
      phone: $('#participant-phone').value.trim(),
      email: $('#participant-email').value.trim(),
      status: $('#participant-status').value,
    };
    state.participants = state.participants.filter((item) => item.id !== id).concat(participant);
    if (isNew) {
      addParticipantPaymentMovement(participant, $('#participant-payment-amount').value, $('#participant-payment-method').value);
    }
    event.target.reset();
    $('#participant-id').value = '';
    $('#cancel-participant-edit').hidden = true;
    save();
    toast(isNew ? 'Participante y pago guardados' : 'Participante actualizado');
  };

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.editMovement) editMovement(button.dataset.editMovement);
    if (button.dataset.deleteMovement && confirm('¿Eliminar movimiento?')) {
      state.movements = state.movements.filter((mov) => mov.id !== button.dataset.deleteMovement);
      Object.values(state.stalls).forEach((stall) => {
        if (stall.movementId === button.dataset.deleteMovement) {
          stall.movementId = '';
          stall.paymentStatus = 'pendiente';
        }
      });
      save();
    }
    if (button.dataset.editParticipant) editParticipant(button.dataset.editParticipant);
    if (button.dataset.deleteParticipant && confirm('¿Eliminar participante y liberar sus puestos?')) {
      const id = button.dataset.deleteParticipant;
      state.participants = state.participants.filter((participant) => participant.id !== id);
      Object.keys(state.stalls).forEach((number) => {
        if (state.stalls[number].participantId === id) delete state.stalls[number];
      });
      save();
    }
    if (button.dataset.stall) {
      selectedStall = Number(button.dataset.stall);
      renderStalls();
    }
  });

  $('#stall-form').onsubmit = (event) => {
    event.preventDefault();
    if (!selectedStall) return toast('Selecciona un puesto');
    const participantId = $('#stall-participant').value;
    if (!participantId) {
      delete state.stalls[selectedStall];
    } else {
      Object.keys(state.stalls).forEach((number) => {
        if (state.stalls[number].participantId === participantId && Number(number) !== selectedStall) delete state.stalls[number];
      });
      const previous = state.stalls[selectedStall] || {};
      const stall = {
        participantId,
        notes: $('#stall-notes').value.trim(),
        paymentStatus: $('#stall-payment-status').value,
        paymentAmount: Number($('#stall-payment-amount').value) || 0,
        paymentMethod: $('#stall-payment-method').value,
        movementId: previous.movementId || '',
      };
      upsertStallPaymentMovement(selectedStall, stall);
      state.stalls[selectedStall] = stall;
    }
    save();
    toast('Puesto y contabilidad actualizados');
  };

  $('#release-stall').onclick = () => {
    if (!selectedStall) return;
    const movementId = state.stalls[selectedStall]?.movementId;
    if (movementId) state.movements = state.movements.filter((mov) => mov.id !== movementId);
    delete state.stalls[selectedStall];
    save();
    toast('Puesto liberado');
  };

  $('#settings-form').onsubmit = (event) => {
    event.preventDefault();
    state.settings = {
      eventName: $('#setting-event-name').value.trim(),
      eventDate: $('#setting-event-date').value,
      location: $('#setting-location').value.trim(),
      stallCount: Number($('#setting-stalls').value),
      stallPrice: Number($('#setting-stall-price').value) || 0,
    };
    Object.keys(state.stalls).forEach((number) => {
      if (Number(number) > state.settings.stallCount) delete state.stalls[number];
    });
    save();
    toast('Configuración guardada');
  };

  $('#export-backup').onclick = exportBackup;
  $('#import-backup').onchange = importBackup;
  $('#reset-data').onclick = () => {
    if (confirm('¿Borrar todos los datos locales?')) {
      state = createDefaults();
      save();
      toast('Datos reiniciados');
    }
  };
  ['movement-search', 'participant-search'].forEach((id) => $('#'+id)?.addEventListener('input', renderAll));
  $('#cancel-movement-edit').onclick = () => {
    $('#movement-form').reset();
    $('#movement-date').value = today();
    $('#movement-id').value = '';
    $('#cancel-movement-edit').hidden = true;
  };
  $('#cancel-participant-edit').onclick = () => {
    $('#participant-form').reset();
    $('#participant-id').value = '';
    $('#cancel-participant-edit').hidden = true;
  };
}

function editMovement(id) {
  const movement = state.movements.find((item) => item.id === id);
  if (!movement) return;
  $('#movement-id').value = movement.id;
  $('#movement-detail').value = movement.detail;
  $('#movement-type').value = movement.type;
  $('#movement-amount').value = movement.amount;
  $('#movement-date').value = movement.date;
  $('#cancel-movement-edit').hidden = false;
  location.hash = 'contabilidad';
}

function editParticipant(id) {
  const participant = state.participants.find((item) => item.id === id);
  if (!participant) return;
  $('#participant-id').value = participant.id;
  $('#participant-name').value = participant.name;
  $('#participant-category').value = participant.category;
  $('#participant-phone').value = participant.phone;
  $('#participant-email').value = participant.email;
  $('#participant-status').value = participant.status;
  $('#participant-payment-amount').value = '';
  $('#cancel-participant-edit').hidden = false;
  location.hash = 'participantes';
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `EUCA-PANEL-backup-${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  $('#backup-preview').textContent = JSON.stringify(state, null, 2);
  toast('Respaldo exportado');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalize(JSON.parse(reader.result));
      save();
      $('#backup-preview').textContent = 'Respaldo importado correctamente.';
      toast('Respaldo importado');
    } catch {
      $('#backup-preview').textContent = 'El archivo no es un respaldo JSON válido.';
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  bind();
  setView();
});
