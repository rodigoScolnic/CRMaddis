const $ = (selector) => document.querySelector(selector);
const state = { token: localStorage.getItem('crmaddis_token'), user: null, clients: [], tasks: [], view: 'dashboard', modalType: null, editingId: null, setupMode: false };
const labels = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada', active: 'Activo', inactive: 'Inactivo', prospect: 'Prospecto', high: 'Alta', medium: 'Media', low: 'Baja' };
const api = async (url, options = {}) => {
  const response = await fetch('/api' + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/auth')) logout(false);
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
  return data;
};
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600); }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }
function dateLabel(value) {
  if (!value) return 'Sin fecha';
  const d = new Date(value + (String(value).length === 10 ? 'T12:00:00' : ''));
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(d);
}
function fullDate(value) { return new Intl.DateTimeFormat('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(value); }
function showAuth(setup) {
  state.setupMode = setup;
  $('#authScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden');
  $('#nameField').classList.toggle('hidden', !setup); $('#setupField').classList.toggle('hidden', !setup);
  $('#authTitle').textContent = setup ? 'Configurá tu espacio' : 'Bienvenido de nuevo';
  $('#authSubtitle').textContent = setup ? 'Creá el usuario administrador para comenzar.' : 'Ingresá para continuar con tus proyectos.';
  $('#authSubmit').innerHTML = setup ? 'Crear administrador <span>→</span>' : 'Ingresar <span>→</span>';
  $('#authPassword').autocomplete = setup ? 'new-password' : 'current-password';
}
async function init() {
  $('#todayLabel').textContent = fullDate(new Date());
  try {
    const status = await api('/auth/status');
    if (!state.token) return showAuth(!status.configured);
    await loadApp();
  } catch (error) { showAuth(false); $('#authError').textContent = error.message; }
}
async function loadApp() {
  try {
    const me = await api('/auth/me'); state.user = me.user;
    $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
    $('#userName').textContent = state.user.name; $('#welcomeName').textContent = state.user.name.split(' ')[0];
    $('#userAvatar').textContent = state.user.name.charAt(0).toUpperCase();
    await refreshAll();
  } catch { logout(false); }
}
async function refreshAll() {
  const [clients, tasks] = await Promise.all([api('/clients'), api('/tasks')]);
  state.clients = clients; state.tasks = tasks;
  $('#navTaskCount').textContent = tasks.filter(t => t.status !== 'completed').length;
  await renderView();
}
function logout(show = true) {
  localStorage.removeItem('crmaddis_token'); state.token = null; state.user = null;
  $('#appShell').classList.add('hidden'); if (show) toast('Sesión cerrada.');
  api('/auth/status').then(s => showAuth(!s.configured)).catch(() => showAuth(false));
}
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#authError').textContent = '';
  const body = { email: $('#authEmail').value, password: $('#authPassword').value };
  const url = state.setupMode ? '/auth/setup' : '/auth/login';
  if (state.setupMode) Object.assign(body, { name: $('#authName').value, setupToken: $('#setupToken').value });
  try {
    const result = await api(url, { method:'POST', body:JSON.stringify(body) });
    state.token = result.token; localStorage.setItem('crmaddis_token', result.token); await loadApp();
  } catch (error) { $('#authError').textContent = error.message; }
});
$('#logoutBtn').addEventListener('click', () => logout());
function setView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + view));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $('#breadcrumbCurrent').textContent = view === 'dashboard' ? 'Resumen' : view === 'tasks' ? 'Tareas' : 'Clientes';
  $('#sidebar').classList.remove('open');
  renderView();
}
document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.go)));
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
async function renderView() {
  if (state.view === 'dashboard') return renderDashboard();
  if (state.view === 'tasks') return renderTasks();
  if (state.view === 'clients') return renderClients();
}
async function renderDashboard() {
  const data = await api('/dashboard');
  $('#statOpen').textContent = data.open_tasks; $('#statSoon').textContent = data.due_soon;
  $('#statOverdue').textContent = data.overdue_tasks; $('#statClients').textContent = data.active_clients;
  $('#statClientSub').textContent = data.total_clients + ' clientes en total';
  $('#upcomingList').innerHTML = data.upcoming.length ? data.upcoming.map(t => `
    <div class="upcoming-item"><button class="task-check" data-complete="${t.id}" title="Marcar como completada">${t.status === 'completed' ? '✓' : ''}</button>
      <div class="task-main"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.client_name || 'Sin cliente')} · <i class="priority-dot priority-${t.priority}"></i>${labels[t.priority]}</small></div>
      <span class="due-date ${t.due_date && new Date(t.due_date+'T12:00:00') < new Date(new Date().toDateString()) ? 'late' : ''}">${dateLabel(t.due_date)}</span></div>`).join('') : '<div class="empty-state"><span>✳</span><strong>Todo despejado</strong><p>No hay tareas pendientes.</p></div>';
  $('#recentList').innerHTML = data.recent.length ? data.recent.map(t => `
    <div class="activity-item"><div class="activity-symbol">${t.status === 'completed' ? '✓' : '↗'}</div><div><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.client_name || 'Sin cliente')} · ${labels[t.status]} · ${dateLabel(t.updated_at.slice(0,10))}</small></div></div>`).join('') : '<div class="empty-state"><strong>Sin actividad todavía</strong><p>Los movimientos aparecerán acá.</p></div>';
}
function renderTasks() {
  const q = ($('#taskSearch').value || '').toLowerCase(), status = $('#taskStatusFilter').value;
  const rows = state.tasks.filter(t => (!status || t.status === status) && (!q || (t.title+' '+(t.client_name||'')).toLowerCase().includes(q)));
  $('#tasksTable').innerHTML = rows.map(t => `
    <tr><td><div class="task-cell"><button class="task-check" data-complete="${t.id}" title="Completar">${t.status === 'completed' ? '✓' : ''}</button><div><strong>${escapeHtml(t.title)}</strong>${t.description ? '<small class="muted" style="display:block;margin-top:3px">'+escapeHtml(t.description.slice(0,52))+'</small>' : ''}</div></div></td>
    <td>${escapeHtml(t.client_name || '—')}</td><td>${dateLabel(t.due_date)}</td><td><span class="pill ${t.priority}">${labels[t.priority]}</span></td><td><span class="pill ${t.status}">${labels[t.status]}</span></td>
    <td><div class="row-actions"><button data-edit-task="${t.id}" title="Editar">✎</button><button data-delete-task="${t.id}" title="Eliminar">⌫</button></div></td></tr>`).join('');
  $('#tasksEmpty').classList.toggle('hidden', rows.length > 0);
}
function renderClients() {
  const q = ($('#clientSearch').value || '').toLowerCase();
  const rows = state.clients.filter(c => (c.name+' '+(c.company||'')+' '+(c.email||'')).toLowerCase().includes(q));
  $('#clientResults').textContent = rows.length + ' resultados';
  $('#clientsGrid').innerHTML = rows.map(c => `
    <article class="client-card"><div class="client-card-top"><div class="client-avatar">${escapeHtml(c.name.charAt(0).toUpperCase())}</div><div style="min-width:0;flex:1"><h3>${escapeHtml(c.name)}</h3><small>${escapeHtml(c.company || labels[c.status])}</small></div><span class="pill ${c.status === 'active' ? 'completed' : c.status === 'prospect' ? 'in_progress' : 'pending'}">${labels[c.status]}</span></div>
    ${c.email ? '<p>✉ '+escapeHtml(c.email)+'</p>' : ''}${c.phone ? '<p>⌕ '+escapeHtml(c.phone)+'</p>' : ''}
    <div class="client-card-bottom"><small>${c.open_tasks} tareas abiertas · ${c.task_count} en total</small><div class="row-actions"><button data-edit-client="${c.id}" title="Editar">✎</button><button data-delete-client="${c.id}" title="Eliminar">⌫</button></div></div></article>`).join('');
  if (!rows.length) $('#clientsGrid').innerHTML = '<div class="panel empty-state" style="grid-column:1/-1"><span>◎</span><strong>No encontramos clientes</strong><p>Probá con otro término o agregá un cliente.</p></div>';
}
function field(label, name, value = '', type = 'text', options = null, full = false, required = false) {
  const val = value ?? '';
  let control = options ? '<select name="'+name+'">'+options.map(o=>'<option value="'+o.value+'" '+(String(val)===String(o.value)?'selected':'')+'>'+o.label+'</option>').join('')+'</select>' :
    type === 'textarea' ? '<textarea name="'+name+'">'+escapeHtml(val)+'</textarea>' : '<input name="'+name+'" type="'+type+'" value="'+escapeHtml(val)+'" '+(required?'required':'')+'>';
  return '<div class="field '+(full?'full-width':'')+'"><label>'+label+'</label>'+control+'</div>';
}
function openModal(type, record = null) {
  state.modalType = type; state.editingId = record?.id || null;
  const edit = !!record, isTask = type === 'task';
  $('#modalEyebrow').textContent = edit ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO';
  $('#modalTitle').textContent = (edit ? 'Editar ' : 'Crear ') + (isTask ? 'tarea' : 'cliente');
  let html = '';
  if (isTask) {
    html += field('Título de la tarea','title',record?.title,'text',null,true,true);
    html += field('Cliente','client_id',record?.client_id || '', 'text', [{value:'',label:'Sin cliente'},...state.clients.map(c=>({value:c.id,label:c.name}))]);
    html += field('Fecha de entrega','due_date',record?.due_date?.slice(0,10),'date');
    html += field('Prioridad','priority',record?.priority || 'medium','text',[{value:'low',label:'Baja'},{value:'medium',label:'Media'},{value:'high',label:'Alta'}]);
    html += field('Estado','status',record?.status || 'pending','text',[{value:'pending',label:'Pendiente'},{value:'in_progress',label:'En progreso'},{value:'completed',label:'Completada'}]);
    html += field('Descripción','description',record?.description,'textarea',null,true);
  } else {
    html += field('Nombre del cliente','name',record?.name,'text',null,true,true);
    html += field('Empresa','company',record?.company);
    html += field('Email','email',record?.email,'email');
    html += field('Teléfono','phone',record?.phone,'tel');
    html += field('Estado','status',record?.status || 'active','text',[{value:'active',label:'Activo'},{value:'prospect',label:'Prospecto'},{value:'inactive',label:'Inactivo'}]);
    html += field('Notas','notes',record?.notes,'textarea',null,true);
  }
  $('#modalFields').innerHTML = html; $('#modalError').textContent = '';
  $('#modalBackdrop').classList.remove('hidden');
  setTimeout(() => $('#modalFields input')?.focus(), 50);
}
function closeModal() { $('#modalBackdrop').classList.add('hidden'); state.modalType = null; }
$('#modalClose').addEventListener('click', closeModal); $('#modalCancel').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', e => { if (e.target === $('#modalBackdrop')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#recordForm').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  if (state.modalType === 'task') body.client_id = body.client_id || null;
  const type = state.modalType, edit = !!state.editingId;
  try {
    await api('/'+(type === 'task' ? 'tasks' : 'clients')+(edit ? '/'+state.editingId : ''), { method:edit?'PUT':'POST', body:JSON.stringify(body) });
    closeModal(); await refreshAll(); toast(edit ? 'Cambios guardados.' : 'Registro creado.');
  } catch (error) { $('#modalError').textContent = error.message; }
});
document.addEventListener('click', async e => {
  const complete = e.target.closest('[data-complete]');
  if (complete) {
    const task = state.tasks.find(t => String(t.id) === complete.dataset.complete);
    if (!task) return;
    try { await api('/tasks/'+task.id+'/status',{method:'PATCH',body:JSON.stringify({status:task.status === 'completed' ? 'pending' : 'completed'})}); await refreshAll(); toast(task.status === 'completed' ? 'Tarea reabierta.' : '¡Tarea completada!'); } catch(err) { toast(err.message); }
  }
  const editTask = e.target.closest('[data-edit-task]');
  if (editTask) openModal('task',state.tasks.find(t=>String(t.id)===editTask.dataset.editTask));
  const editClient = e.target.closest('[data-edit-client]');
  if (editClient) openModal('client',state.clients.find(c=>String(c.id)===editClient.dataset.editClient));
  const delTask = e.target.closest('[data-delete-task]');
  if (delTask && confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) {
    try { await api('/tasks/'+delTask.dataset.deleteTask,{method:'DELETE'}); await refreshAll(); toast('Tarea eliminada.'); } catch(err) { toast(err.message); }
  }
  const delClient = e.target.closest('[data-delete-client]');
  if (delClient && confirm('¿Eliminar este cliente? Las tareas vinculadas quedarán sin cliente.')) {
    try { await api('/clients/'+delClient.dataset.deleteClient,{method:'DELETE'}); await refreshAll(); toast('Cliente eliminado.'); } catch(err) { toast(err.message); }
  }
});
$('#newTaskBtn').addEventListener('click',()=>openModal('task'));
$('#dashboardTaskBtn').addEventListener('click',()=>openModal('task'));
$('#newClientBtn').addEventListener('click',()=>openModal('client'));
$('#quickAddBtn').addEventListener('click',()=>openModal(state.view === 'clients' ? 'client' : 'task'));
$('#taskSearch').addEventListener('input',renderTasks); $('#taskStatusFilter').addEventListener('change',renderTasks); $('#clientSearch').addEventListener('input',renderClients);
init();
