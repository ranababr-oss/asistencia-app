
const institutionNameInput = document.getElementById('institutionName');
const attendanceDateInput = document.getElementById('attendanceDate');
const teacherNameInput = document.getElementById('teacherName');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const newStudentBtn = document.getElementById('newStudentBtn');
const clearDayBtn = document.getElementById('clearDayBtn');
const refreshBtn = document.getElementById('refreshBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const countTotal = document.getElementById('countTotal');
const countPresent = document.getElementById('countPresent');
const countAbsent = document.getElementById('countAbsent');
const countUnmarked = document.getElementById('countUnmarked');
const studentCounter = document.getElementById('studentCounter');

const studentList = document.getElementById('studentList');
const emptyStudents = document.getElementById('emptyStudents');
const historyList = document.getElementById('historyList');
const emptyHistory = document.getElementById('emptyHistory');

const studentDialog = document.getElementById('studentDialog');
const studentForm = document.getElementById('studentForm');
const dialogTitle = document.getElementById('dialogTitle');
const studentIdInput = document.getElementById('studentId');
const studentNameInput = document.getElementById('studentName');
const cancelDialogBtn = document.getElementById('cancelDialogBtn');

const historyDialog = document.getElementById('historyDialog');
const historyDialogTitle = document.getElementById('historyDialogTitle');
const historyDialogSub = document.getElementById('historyDialogSub');
const historyDetailList = document.getElementById('historyDetailList');
const closeHistoryDialogBtn = document.getElementById('closeHistoryDialogBtn');

let students = [];
let attendance = {};
let history = [];

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let data = null;
  try { data = await response.json(); } catch (e) {}

  if (!response.ok) {
    throw new Error(data?.error || 'Ocurrió un error.');
  }
  return data;
}

function counts() {
  let present = 0;
  let absent = 0;
  students.forEach(student => {
    const status = attendance[student.id]?.status || '';
    if (status === 'Presente') present += 1;
    if (status === 'Ausente') absent += 1;
  });
  return {
    total: students.length,
    present,
    absent,
    unmarked: students.length - present - absent
  };
}

function updateSummary() {
  const c = counts();
  countTotal.textContent = c.total;
  countPresent.textContent = c.present;
  countAbsent.textContent = c.absent;
  countUnmarked.textContent = c.unmarked;
  studentCounter.textContent = c.total + (c.total === 1 ? ' joven' : ' jóvenes');
}

function statusClass(status) {
  if (status === 'Presente') return 's-present';
  if (status === 'Ausente') return 's-absent';
  return 's-none';
}

function statusLabel(status) {
  return status || 'Sin marcar';
}

function renderStudents() {
  studentList.innerHTML = '';
  emptyStudents.style.display = students.length ? 'none' : 'block';

  const ordered = students.slice().sort((a, b) =>
    normalize(a.name).localeCompare(normalize(b.name), 'es')
  );

  ordered.forEach(student => {
    const status = attendance[student.id]?.status || '';

    const item = document.createElement('div');
    item.className = 'student-item';

    const head = document.createElement('div');
    head.className = 'student-head';

    const name = document.createElement('div');
    name.className = 'student-name';
    name.textContent = student.name;

    const badge = document.createElement('div');
    badge.className = 'status ' + statusClass(status);
    badge.textContent = statusLabel(status);

    head.appendChild(name);
    head.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'student-actions';

    const presentBtn = document.createElement('button');
    presentBtn.type = 'button';
    presentBtn.className = 'btn-present';
    presentBtn.textContent = 'Presente';
    presentBtn.onclick = () => setAttendance(student.id, 'Presente');

    const absentBtn = document.createElement('button');
    absentBtn.type = 'button';
    absentBtn.className = 'btn-danger';
    absentBtn.textContent = 'Ausente';
    absentBtn.onclick = () => setAttendance(student.id, 'Ausente');

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-neutral';
    clearBtn.textContent = 'Limpiar';
    clearBtn.onclick = () => setAttendance(student.id, '');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-soft';
    editBtn.textContent = 'Editar';
    editBtn.onclick = () => openStudentDialog(student);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-neutral';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.onclick = () => deleteStudent(student);

    actions.append(presentBtn, absentBtn, clearBtn, editBtn, deleteBtn);
    item.append(head, actions);
    studentList.appendChild(item);
  });

  updateSummary();
}

function renderHistory() {
  historyList.innerHTML = '';
  emptyHistory.style.display = history.length ? 'none' : 'block';

  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';

    const head = document.createElement('div');
    head.className = 'history-head';

    const title = document.createElement('div');
    title.className = 'student-name';
    title.textContent = item.date;

    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = `${item.totalStudents} jóvenes | ${item.present} presentes | ${item.absent} ausentes | ${item.unmarked} sin marcar`;

    const actions = document.createElement('div');
    actions.className = 'student-actions';

    const seeBtn = document.createElement('button');
    seeBtn.type = 'button';
    seeBtn.className = 'btn-soft';
    seeBtn.textContent = 'Ver detalle';
    seeBtn.onclick = () => openHistoryDetail(item.date);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = 'Borrar fecha';
    deleteBtn.onclick = async () => {
      if (!confirm('¿Borrar el registro del ' + item.date + '?')) return;
      await api('/api/attendance/' + item.date, { method: 'DELETE' });
      showToast('Fecha borrada');
      await loadAll();
    };

    actions.append(seeBtn, deleteBtn);
    card.append(head, meta, actions);
    head.append(title);
    historyList.appendChild(card);
  });
}

async function loadConfig() {
  const config = await api('/api/config');
  institutionNameInput.value = config.institutionName || '';
}

async function loadStudents() {
  students = await api('/api/students');
}

async function loadAttendance() {
  const date = attendanceDateInput.value || todayISO();
  attendance = await api('/api/attendance/' + date);
}

async function loadHistory() {
  history = await api('/api/history');
}

async function loadAll() {
  await Promise.all([loadConfig(), loadStudents(), loadAttendance(), loadHistory()]);
  renderStudents();
  renderHistory();
}

async function saveConfig() {
  await api('/api/config', {
    method: 'PUT',
    body: JSON.stringify({ institutionName: institutionNameInput.value.trim() })
  });
  showToast('Institución guardada');
}

function openStudentDialog(student = null) {
  studentIdInput.value = student?.id || '';
  studentNameInput.value = student?.name || '';
  dialogTitle.textContent = student ? 'Editar joven' : 'Agregar joven';
  studentDialog.showModal();
  setTimeout(() => studentNameInput.focus(), 50);
}

function closeStudentDialog() {
  studentDialog.close();
  studentForm.reset();
  studentIdInput.value = '';
}

async function saveStudentFromDialog(event) {
  event.preventDefault();
  const id = studentIdInput.value;
  const name = studentNameInput.value.trim();

  if (!name) {
    showToast('Escribe el nombre');
    studentNameInput.focus();
    return;
  }

  if (id) {
    await api('/api/students/' + id, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
    showToast('Nombre actualizado');
  } else {
    await api('/api/students', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    showToast('Joven agregado');
  }

  closeStudentDialog();
  await loadAll();
}

async function deleteStudent(student) {
  if (!confirm('¿Eliminar a ' + student.name + ' de la lista fija?')) return;
  await api('/api/students/' + student.id, { method: 'DELETE' });
  showToast('Joven eliminado');
  await loadAll();
}

async function setAttendance(studentId, status) {
  await api('/api/attendance/' + attendanceDateInput.value + '/' + studentId, {
    method: 'PUT',
    body: JSON.stringify({
      status,
      teacher: teacherNameInput.value.trim()
    })
  });
  attendance = await api('/api/attendance/' + attendanceDateInput.value);
  renderStudents();
}

async function clearCurrentDay() {
  if (!confirm('¿Limpiar todas las marcas del día actual?')) return;
  await api('/api/attendance/' + attendanceDateInput.value, { method: 'DELETE' });
  attendance = {};
  renderStudents();
  await loadHistory();
  renderHistory();
  showToast('Día limpiado');
}

async function openHistoryDetail(date) {
  const detail = await api('/api/history/' + date);
  historyDialogTitle.textContent = 'Detalle de ' + date;
  historyDialogSub.textContent = detail.institutionName || '';
  historyDetailList.innerHTML = '';

  detail.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'detail-item';

    const head = document.createElement('div');
    head.className = 'student-head';

    const name = document.createElement('div');
    name.className = 'student-name';
    name.textContent = student.name;

    const badge = document.createElement('div');
    badge.className = 'status ' + statusClass(student.status);
    badge.textContent = statusLabel(student.status);

    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    meta.textContent = student.teacher ? 'Marcado por: ' + student.teacher : 'Sin maestro registrado';

    head.append(name, badge);
    item.append(head, meta);
    historyDetailList.appendChild(item);
  });

  historyDialog.showModal();
}

async function clearAllHistory() {
  if (!confirm('¿Seguro que quieres borrar todo el historial?')) return;
  await api('/api/history', { method: 'DELETE' });
  showToast('Historial borrado');
  await loadAll();
}

saveConfigBtn.addEventListener('click', saveConfig);
newStudentBtn.addEventListener('click', () => openStudentDialog());
clearDayBtn.addEventListener('click', clearCurrentDay);
refreshBtn.addEventListener('click', loadAll);
clearHistoryBtn.addEventListener('click', clearAllHistory);
studentForm.addEventListener('submit', saveStudentFromDialog);
cancelDialogBtn.addEventListener('click', closeStudentDialog);
closeHistoryDialogBtn.addEventListener('click', () => historyDialog.close());
attendanceDateInput.addEventListener('change', async () => {
  await loadAttendance();
  renderStudents();
});
institutionNameInput.addEventListener('blur', () => {
  if (institutionNameInput.value.trim()) saveConfig().catch(() => {});
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

attendanceDateInput.value = todayISO();
loadAll().catch(error => {
  alert(error.message || 'No se pudo cargar la app.');
});
