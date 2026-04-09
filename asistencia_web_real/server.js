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
    config: {
      institutionName: ''
    },
    students: [],
    attendance: {}
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

app.get('/api/config', (req, res) => {
  const db = readDb();
  res.json(db.config);
});

app.put('/api/config', (req, res) => {
  const db = readDb();
  const institutionName = String(req.body.institutionName || '').trim();
  db.config.institutionName = institutionName;
  writeDb(db);
  res.json({ ok: true, config: db.config });
});

app.get('/api/students', (req, res) => {
  const db = readDb();
  const sorted = db.students.slice().sort((a, b) =>
    normalize(a.name).localeCompare(normalize(b.name), 'es')
  );
  res.json(sorted);
});

app.post('/api/students', (req, res) => {
  const db = readDb();
  const name = String(req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Escribe el nombre del estudiante.' });
  }

  const exists = db.students.some(student => normalize(student.name) === normalize(name));
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

app.put('/api/students/:id', (req, res) => {
  const db = readDb();
  const id = req.params.id;
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const parentName = String(req.body.parentName || '').trim();
  const parentPhone = String(req.body.parentPhone || '').trim();
  const student = db.students.find(item => item.id === id);

  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'El nombre no puede ir vacio.' });
  }

  const duplicate = db.students.some(item => item.id !== id && normalize(item.name) === normalize(name));
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
  const id = req.params.id;
  const before = db.students.length;
  db.students = db.students.filter(student => student.id !== id);

  if (db.students.length === before) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  for (const date of Object.keys(db.attendance)) {
    if (db.attendance[date] && db.attendance[date][id]) {
      delete db.attendance[date][id];
    }
  }

  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/attendance/:date', (req, res) => {
  const db = readDb();
  const date = req.params.date || todayISO();
  res.json(db.attendance[date] || {});
});

app.put('/api/attendance/:date/:studentId', (req, res) => {
  const db = readDb();
  const date = req.params.date;
  const studentId = req.params.studentId;
  const status = String(req.body.status || '').trim();
  const teacher = String(req.body.teacher || '').trim();

  if (!db.students.find(student => student.id === studentId)) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  if (!db.attendance[date]) db.attendance[date] = {};

  if (!status) {
    delete db.attendance[date][studentId];
    writeDb(db);
    return res.json({ ok: true, cleared: true });
  }

  if (!['Presente', 'Ausente'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  db.attendance[date][studentId] = {
    status,
    teacher,
    updatedAt: new Date().toISOString()
  };

  writeDb(db);
  res.json({ ok: true, record: db.attendance[date][studentId] });
});

app.delete('/api/attendance/:date', (req, res) => {
  const db = readDb();
  delete db.attendance[req.params.date];
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  const db = readDb();
  const studentsById = Object.fromEntries(db.students.map(student => [student.id, student]));
  const history = Object.keys(db.attendance)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const records = db.attendance[date] || {};
      let present = 0;
      let absent = 0;

      Object.values(records).forEach(record => {
        if (record.status === 'Presente') present += 1;
        if (record.status === 'Ausente') absent += 1;
      });

      return {
        date,
        totalStudents: db.students.length,
        marked: Object.keys(records).length,
        present,
        absent,
        unmarked: Math.max(db.students.length - present - absent, 0)
      };
    });

  res.json(history);
});

app.get('/api/history/:date', (req, res) => {
  const db = readDb();
  const date = req.params.date;
  const records = db.attendance[date] || {};
 const students = db.students
  .slice()
  .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es'))
  .map(student => ({
    id: student.id,
    name: student.name,
    status: records[student.id]?.status || '',
    teacher: records[student.id]?.teacher || '',
    updatedAt: records[student.id]?.updatedAt || ''
  }));

  res.json({
    date,
    institutionName: db.config.institutionName || '',
    students
  });
});

app.delete('/api/history', (req, res) => {
  const db = readDb();
  db.attendance = {};
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
