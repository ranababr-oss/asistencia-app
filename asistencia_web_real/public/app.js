const groupSelect = document.getElementById('groupSelect');
const newGroupBtn = document.getElementById('newGroupBtn');
const attendanceDateInput = document.getElementById('attendanceDate');
const teacherNameInput = document.getElementById('teacherName');
const saveGroupBtn = document.getElementById('saveGroupBtn');
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

const groupDialog = document.getElementById('groupDialog');
const groupForm = document.getElementById('groupForm');
const groupNameInput = document.getElementById('groupName');
const cancelGroupDialogBtn = document.getElementById('cancelGroupDialogBtn');
const studentDialog = document.getElementById('studentDialog');
const studentForm = document.getElementById('studentForm');
const dialogTitle = document.getElementById('dialogTitle');
const studentIdInput = document.getElementById('studentId');
const studentNameInput = document.getElementById('studentName');
const studentPhoneInput = document.getElementById('studentPhone');
const studentParentNameInput = document.getElementById('studentParentName');
const studentParentPhoneInput = document.getElementById('studentParentPhone');
const cancelDialogBtn = document.getElementById('cancelDialogBtn');

const historyDialog = document.getElementById('historyDialog');
const historyDialogTitle = document.getElementById('historyDialogTitle');
const historyDialogSub = document.getElementById('historyDialogSub');
const historyDetailList = document.getElementById('historyDetailList');
const closeHistoryDialogBtn = document.getElementById('closeHistoryDialogBtn');

const reportDateInput = document.getElementById('reportDate');
const reportStudentSelect = document.getElementById('reportStudent');
const reportMonthInput = document.getElementById('reportMonth');
const reportDayBtn = document.getElementById('reportDayBtn');
const reportStudentBtn = document.getElementById('reportStudentBtn');
const reportMonthBtn = document.getElementById('reportMonthBtn');
const reportOutput = document.getElementById('reportOutput');

let groups = [];
let currentGroupId = '';
let students = [];
let attendance = {};
let history = [];

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function todayMonth() {
  return todayISO().slice(0, 7);
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
function requireGroup() {
  if (!currentGroupId) {
    showToast('Primero crea o selecciona un grupo');
    return false;
  }
  return true;
}

function fillGroupSelect() {
  if (!groupSelect) return;

  groupSelect.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Selecciona un grupo';
  groupSelect.appendChild(first);

  groups
    .slice()
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es'))
    .forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      if (group.id === currentGroupId) {
        option.selected = true;
      }
      groupSelect.appendChild(option);
    });
}

async function loadGroups() {
  const data = await api('/api/groups');
  groups = data.groups || [];
  currentGroupId = data.currentGroupId || '';
  fillGroupSelect();
}

function openGroupDialog() {
  if (!groupDialog) return;
  groupDialog.showModal();
  setTimeout(() => groupNameInput.focus(), 50);
}

function closeGroupDialog() {
  if (!groupDialog) return;
  groupDialog.close();
  groupForm.reset();
  groupNameInput.value = '';
}

async function saveGroupFromDialog(event) {
  event.preventDefault();

  const name = groupNameInput.value.trim();
  if (!name) {
    showToast('Escribe el nombre del grupo');
    groupNameInput.focus();
    return;
  }

  await api('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name })
  });

  showToast('Grupo creado');
  closeGroupDialog();
  await loadGroups();
  await loadAll();
}

async function useSelectedGroup() {
  const groupId = groupSelect.value;

  await api('/api/groups/current', {
    method: 'PUT',
    body: JSON.stringify({ groupId })
  });

  currentGroupId = groupId;
  showToast(groupId ? 'Grupo seleccionado' : 'Sin grupo seleccionado');
  await loadAll();
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {}

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

function fillStudentReportSelect() {
  if (!reportStudentSelect) return;

  reportStudentSelect.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Selecciona un joven';
  reportStudentSelect.appendChild(first);

  students
    .slice()
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es'))
    .forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.textContent = student.name;
      reportStudentSelect.appendChild(option);
    });
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
    name.style.cursor = 'pointer';

    const badge = document.createElement('div');
    badge.className = 'status ' + statusClass(status);
    badge.textContent = statusLabel(status);

    head.appendChild(name);
    head.appendChild(badge);

    const details = document.createElement('div');
    details.className = 'history-meta';
    details.style.display = 'none';
    details.style.marginTop = '10px';
    details.innerHTML = `
      <div><strong>Teléfono:</strong> ${student.phone || 'No registrado'}</div>
      <div><strong>Responsable:</strong> ${student.parentName || 'No registrado'}</div>
      <div><strong>Contacto responsable:</strong> ${student.parentPhone || 'No registrado'}</div>
    `;

    name.onclick = () => {
      details.style.display = details.style.display === 'none' ? 'block' : 'none';
    };

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

    actions.appendChild(presentBtn);
    actions.appendChild(absentBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(head);
    item.appendChild(details);
    item.appendChild(actions);
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

    actions.appendChild(seeBtn);
    actions.appendChild(deleteBtn);

    head.appendChild(title);

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(actions);

    historyList.appendChild(card);
  });
}

async function loadConfig() {
  const config = await api('/api/config');
  institutionNameInput.value = config.institutionName || '';
}

async function loadStudents() {
  if (!currentGroupId) {
    students = [];
    return;
  }
  students = await api('/api/students?groupId=' + encodeURIComponent(currentGroupId));
}

async function loadAttendance() {
  if (!currentGroupId) {
    attendance = {};
    return;
  }

  const date = attendanceDateInput.value || todayISO();
  attendance = await api('/api/attendance/' + date + '?groupId=' + encodeURIComponent(currentGroupId));
}

async function loadHistory() {
  if (!currentGroupId) {
    history = [];
    return;
  }
  history = await api('/api/history?groupId=' + encodeURIComponent(currentGroupId));
}

async function loadAll() {
  await Promise.all([loadStudents(), loadAttendance(), loadHistory()]);
  fillStudentReportSelect();
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
  studentPhoneInput.value = student?.phone || '';
  studentParentNameInput.value = student?.parentName || '';
  studentParentPhoneInput.value = student?.parentPhone || '';
  dialogTitle.textContent = student ? 'Editar joven' : 'Agregar joven';
  studentDialog.showModal();
  setTimeout(() => studentNameInput.focus(), 50);
}

function closeStudentDialog() {
  studentDialog.close();
  studentForm.reset();
  studentIdInput.value = '';
  studentPhoneInput.value = '';
  studentParentNameInput.value = '';
  studentParentPhoneInput.value = '';
}

async function saveStudentFromDialog(event) {
  event.preventDefault();

  if (!requireGroup()) return;

  const id = studentIdInput.value;
  const name = studentNameInput.value.trim();
  const phone = studentPhoneInput.value.trim();
  const parentName = studentParentNameInput.value.trim();
  const parentPhone = studentParentPhoneInput.value.trim();

  if (!name) {
    showToast('Escribe el nombre');
    studentNameInput.focus();
    return;
  }

  const payload = {
    groupId: currentGroupId,
    name,
    phone,
    parentName,
    parentPhone
  };

  if (id) {
    await api('/api/students/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showToast('Joven actualizado');
  } else {
    await api('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Joven agregado');
  }

  closeStudentDialog();
  await loadAll();
}

async function deleteStudent(student) {
  if (!requireGroup()) return;
  if (!confirm('¿Eliminar a ' + student.name + ' de la lista fija?')) return;

  await api('/api/students/' + student.id + '?groupId=' + encodeURIComponent(currentGroupId), {
    method: 'DELETE'
  });

  showToast('Joven eliminado');
  await loadAll();
}

async function setAttendance(studentId, status) {
  if (!requireGroup()) return;

  await api('/api/attendance/' + attendanceDateInput.value + '/' + studentId, {
    method: 'PUT',
    body: JSON.stringify({
      groupId: currentGroupId,
      status,
      teacher: teacherNameInput.value.trim()
    })
  });

  attendance = await api('/api/attendance/' + attendanceDateInput.value + '?groupId=' + encodeURIComponent(currentGroupId));
  renderStudents();
}

async function setAttendance(studentId, status) {
  if (!requireGroup()) return;

  await api('/api/attendance/' + attendanceDateInput.value + '/' + studentId, {
    method: 'PUT',
    body: JSON.stringify({
      groupId: currentGroupId,
      status,
      teacher: teacherNameInput.value.trim()
    })
  });

  attendance = await api('/api/attendance/' + attendanceDateInput.value + '?groupId=' + encodeURIComponent(currentGroupId));
  renderStudents();
}

async function openHistoryDetail(date) {
  if (!requireGroup()) return;

  const detail = await api('/api/history/' + date + '?groupId=' + encodeURIComponent(currentGroupId));

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
    meta.innerHTML = `
      <div>${student.teacher ? 'Marcado por: ' + student.teacher : 'Sin maestro registrado'}</div>
      <div><strong>Teléfono:</strong> ${student.phone || 'No registrado'}</div>
      <div><strong>Responsable:</strong> ${student.parentName || 'No registrado'}</div>
      <div><strong>Contacto responsable:</strong> ${student.parentPhone || 'No registrado'}</div>
    `;

    head.appendChild(name);
    head.appendChild(badge);
    item.appendChild(head);
    item.appendChild(meta);
    historyDetailList.appendChild(item);
  });

  historyDialog.showModal();
}

function renderReportCard(title, lines) {
  if (!reportOutput) return;

  reportOutput.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'history-item';

  const h = document.createElement('div');
  h.className = 'student-name';
  h.textContent = title;

  const body = document.createElement('div');
  body.className = 'history-meta';
  body.style.marginTop = '10px';
  body.style.whiteSpace = 'pre-wrap';
  body.textContent = lines.join('\n');

  card.appendChild(h);
  card.appendChild(body);
  reportOutput.appendChild(card);
}

async function showDayReport() {
  if (!requireGroup()) return;

  const date = reportDateInput.value;
  if (!date) {
    showToast('Selecciona una fecha');
    return;
  }

  const detail = await api('/api/history/' + date + '?groupId=' + encodeURIComponent(currentGroupId));
  const lines = detail.students.map(student => `${student.name}: ${student.status || 'Sin marcar'}`);

  renderReportCard('Reporte del día ' + date, lines.length ? lines : ['No hay datos']);
}

async function showStudentReport() {
  if (!requireGroup()) return;

  const studentId = reportStudentSelect.value;
  if (!studentId) {
    showToast('Selecciona un joven');
    return;
  }

  const student = students.find(s => s.id === studentId);
  const historyItems = await api('/api/history?groupId=' + encodeURIComponent(currentGroupId));
  const lines = [];

  for (const item of historyItems) {
    const detail = await api('/api/history/' + item.date + '?groupId=' + encodeURIComponent(currentGroupId));
    const row = detail.students.find(s => s.id === studentId);
    lines.push(`${item.date}: ${row?.status || 'Sin marcar'}`);
  }

  renderReportCard(
    'Reporte de ' + (student?.name || 'Joven'),
    lines.length ? lines : ['No hay historial']
  );
}

async function showMonthReport() {
  if (!requireGroup()) return;

  const month = reportMonthInput.value;
  if (!month) {
    showToast('Selecciona un mes');
    return;
  }

  const historyItems = await api('/api/history?groupId=' + encodeURIComponent(currentGroupId));
  const filtered = historyItems.filter(item => item.date.startsWith(month));

  if (!filtered.length) {
    renderReportCard('Reporte del mes ' + month, ['No hay registros']);
    return;
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalUnmarked = 0;

  filtered.forEach(item => {
    totalPresent += item.present || 0;
    totalAbsent += item.absent || 0;
    totalUnmarked += item.unmarked || 0;
  });

  const lines = [
    `Fechas con registro: ${filtered.length}`,
    `Presentes acumulados: ${totalPresent}`,
    `Ausentes acumulados: ${totalAbsent}`,
    `Sin marcar acumulados: ${totalUnmarked}`
  ];

  renderReportCard('Reporte del mes ' + month, lines);
}

newGroupBtn.addEventListener('click', openGroupDialog);
saveGroupBtn.addEventListener('click', useSelectedGroup);
newStudentBtn.addEventListener('click', () => {
  if (!requireGroup()) return;
  openStudentDialog();
});
clearDayBtn.addEventListener('click', clearCurrentDay);
refreshBtn.addEventListener('click', loadAll);
clearHistoryBtn.addEventListener('click', async () => {
  if (!requireGroup()) return;
  if (!confirm('¿Seguro que quieres borrar todo el historial?')) return;

  await api('/api/history?groupId=' + encodeURIComponent(currentGroupId), {
    method: 'DELETE'
  });

  showToast('Historial borrado');
  await loadAll();
});

groupForm.addEventListener('submit', saveGroupFromDialog);
cancelGroupDialogBtn.addEventListener('click', closeGroupDialog);

if (closeHistoryDialogBtn) {
  closeHistoryDialogBtn.addEventListener('click', () => {
    historyDialog.close();
  });
}

if (historyDialog) {
  historyDialog.addEventListener('cancel', () => {
    historyDialog.close();
  });
}

if (reportDayBtn) {
  reportDayBtn.addEventListener('click', showDayReport);
}

if (reportStudentBtn) {
  reportStudentBtn.addEventListener('click', showStudentReport);
}

if (reportMonthBtn) {
  reportMonthBtn.addEventListener('click', showMonthReport);
}

attendanceDateInput.addEventListener('change', async () => {
  await loadAttendance();
  renderStudents();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

attendanceDateInput.value = todayISO();

if (reportDateInput) {
  reportDateInput.value = todayISO();
}

if (reportMonthInput) {
  reportMonthInput.value = todayMonth();
}

loadGroups()
  .then(loadAll)
  .catch(error => {
    alert(error.message || 'No se pudo cargar la app.');
  });
