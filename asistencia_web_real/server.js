const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function defaultDb() {
  return {
    groups: [],
    currentGroupId: ''
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb(), null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (error) {
    return defaultDb();
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getGroupOr404(db, groupId, res) {
  const group = db.groups.find(g => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Grupo no encontrado.' });
    return null;
  }
  return group;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

app.get('/api/groups', (req, res) => {
  const db = readDb();

  const groups = db.groups
    .slice()
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es'))
    .map(group => ({
      id: group.id,
      name: group.name
    }));

  res.json({
    groups,
    currentGroupId: db.currentGroupId || ''
  });
});

app.post('/api/groups', (req, res) => {
  const db = readDb();
  const name = String(req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Escribe el nombre del grupo.' });
  }

  const exists = db.groups.some(group => normalize(group.name) === normalize(name));
  if (exists) {
    return res.status(409).json({ error: 'Ese grupo ya existe.' });
  }

  const group = {
    id: makeId(),
    name,
    students: [],
    attendance: {}
  };

  db.groups.push(group);
  db.currentGroupId = group.id;
  writeDb(db);

  res.status(201).json({
    ok: true,
    group,
    currentGroupId: db.currentGroupId
  });
});

app.put('/api/groups/current', (req, res) => {
  const db = readDb();
  const groupId = String(req.body.groupId || '').trim();

  if (!groupId) {
    db.currentGroupId = '';
    writeDb(db);
    return res.json({ ok: true, currentGroupId: '' });
  }

  const group = db.groups.find(g => g.id === groupId);
  if (!group) {
    return res.status(404).json({ error: 'Grupo no encontrado.' });
  }

  db.currentGroupId = groupId;
  writeDb(db);

  res.json({ ok: true, currentGroupId: groupId });
});

app.get('/api/students', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const sorted = group.students.slice().sort((a, b) =>
    normalize(a.name).localeCompare(normalize(b.name), 'es')
  );

  res.json(sorted);
});

app.post('/api/students', (req, res) => {
  const db = readDb();
  const groupId = String(req.body.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const name = String(req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Escribe el nombre del estudiante.' });
  }

  const exists = group.students.some(student => normalize(student.name) === normalize(name));
  if (exists) {
    return res.status(409).json({ error: 'Ese estudiante ya existe.' });
  }

  const student = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    phone: String(req.body.phone || '').trim(),
    parentName: String(req.body.parentName || '').trim(),
    parentPhone: String(req.body.parentPhone || '').trim(),
    createdAt: new Date().toISOString()
  };

  group.students.push(student);
  writeDb(db);
  res.status(201).json(student);
});

app.put('/api/students/:id', (req, res) => {
  const db = readDb();
  const groupId = String(req.body.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;
  
  const id = req.params.id;
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const parentName = String(req.body.parentName || '').trim();
  const parentPhone = String(req.body.parentPhone || '').trim();
  const student = group.students.find(item => item.id === id);

  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'El nombre no puede ir vacio.' });
  }

 const duplicate = group.students.some(item => item.id !== id && normalize(item.name) === normalize(name));
  if (duplicate) {
    return res.status(409).json({ error: 'Ya existe un estudiante con ese nombre.' });
  }

  student.name = name;
  student.phone = phone;
  student.parentName = parentName;
  student.parentPhone = parentPhone;
  student.updatedAt = new Date().toISOString();

  writeDb(db);
  res.json(student);
});

app.delete('/api/students/:id', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const id = req.params.id;
  const before = group.students.length;
  group.students = group.students.filter(student => student.id !== id);

  if (group.students.length === before) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  for (const date of Object.keys(group.attendance)) {
  if (group.attendance[date] && group.attendance[date][id]) {
    delete group.attendance[date][id];
  }
}

  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/attendance/:date', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const date = req.params.date || todayISO();
  res.json(group.attendance[date] || {});
});

app.put('/api/attendance/:date/:studentId', (req, res) => {
  const db = readDb();
  const groupId = String(req.body.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const date = req.params.date;
  const studentId = req.params.studentId;
  const status = String(req.body.status || '').trim();
  const teacher = String(req.body.teacher || '').trim();

  if (!group.students.find(student => student.id === studentId)) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  if (!group.attendance[date]) group.attendance[date] = {};

  if (!status) {
    delete group.attendance[date][studentId];
    writeDb(db);
    return res.json({ ok: true, cleared: true });
  }

  if (!['Presente', 'Ausente'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  group.attendance[date][studentId] = {
    status,
    teacher,
    updatedAt: new Date().toISOString()
  };

  writeDb(db);
  res.json({ ok: true, record: group.attendance[date][studentId] });
});

app.delete('/api/attendance/:date', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  delete group.attendance[req.params.date];
  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/attendance/:date', (req, res) => {
  const db = readDb();
  delete db.attendance[req.params.date];
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const history = Object.keys(group.attendance)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
     const records = group.attendance[date] || {};
      let present = 0;
      let absent = 0;

      Object.values(records).forEach(record => {
        if (record.status === 'Presente') present += 1;
        if (record.status === 'Ausente') absent += 1;
      });

      return {
        date,
       totalStudents: group.students.length,
        marked: Object.keys(records).length,
        present,
        absent,
        unmarked: Math.max(group.students.length - present - absent, 0)
      };
    });

  res.json(history);
});

app.get('/api/history/:date', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  const date = req.params.date;
  const records = group.attendance[date] || {};

  const students = group.students
    .slice()
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es'))
    .map(student => ({
      id: student.id,
      name: student.name,
      phone: student.phone || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      status: records[student.id]?.status || '',
      teacher: records[student.id]?.teacher || '',
      updatedAt: records[student.id]?.updatedAt || ''
    }));

  res.json({
    date,
    institutionName: group.name || '',
    students
  });
});

app.delete('/api/history', (req, res) => {
  const db = readDb();
  const groupId = String(req.query.groupId || '').trim();
  const group = getGroupOr404(db, groupId, res);
  if (!group) return;

  group.attendance = {};
  writeDb(db);
  res.json({ ok: true });
});

app.get('/*rest', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDb();

app.listen(PORT, () => {
  console.log(`Asistencia web lista en http://localhost:${PORT}`);
});
