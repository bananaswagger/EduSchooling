// server.js — MySQL version

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const session     = require('express-session');
const bcrypt      = require('bcryptjs');
const http        = require('http');
const { Server }  = require('socket.io');
const db          = require('./db');

// Guarda sessões em memória (simples para desenvolvimento local)
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 3000;

const ROLE_PASSWORDS = {
  professor: 'prof2024',
  admin:     'admin2024',
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'eduscheduler-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ── Middlewares ──────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.status(401).json({ error: 'Não autenticado' });
}
function requireEditor(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Não autenticado' });
  if (req.session.user.role === 'aluno') return res.status(403).json({ error: 'Sem permissão' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Não autenticado' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores' });
  next();
}

function broadcast(event, data) { io.emit(event, data); }

// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  const { nome, email, password, role, rolePassword } = req.body;
  if (!nome || !email || !password)
    return res.status(400).json({ error: 'nome, email e password são obrigatórios' });
  const roleDesejado = role || 'aluno';
  if (roleDesejado !== 'aluno') {
    if (!rolePassword) return res.status(403).json({ error: `É necessária a password de ${roleDesejado}` });
    if (rolePassword !== ROLE_PASSWORDS[roleDesejado])
      return res.status(403).json({ error: `Password de ${roleDesejado} incorreta` });
  }
  const [rows] = await db.query('SELECT id FROM utilizadores WHERE email=?', [email]);
  if (rows.length) return res.status(409).json({ error: 'Email já registado' });
  const hash = bcrypt.hashSync(password, 12);
  const [r] = await db.query(
    'INSERT INTO utilizadores (nome, email, password_hash, role) VALUES (?,?,?,?)',
    [nome, email, hash, roleDesejado]
  );
  res.status(201).json({ id: r.insertId, nome, email, role: roleDesejado });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password são obrigatórios' });
  const [rows] = await db.query('SELECT * FROM utilizadores WHERE email=?', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Email ou password incorretos' });
  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Email ou password incorretos' });
  await db.query('UPDATE utilizadores SET ultimo_login=NOW() WHERE id=?', [user.id]);
  req.session.user = { id: user.id, nome: user.nome, email: user.email, role: user.role };
  res.json(req.session.user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Não autenticado' });
  res.json(req.session.user);
});

// ── Utilizadores ─────────────────────────────────────
app.get('/api/utilizadores', requireAdmin, async (req, res) => {
  const [rows] = await db.query('SELECT id, nome, email, role, criado_em, ultimo_login FROM utilizadores ORDER BY nome');
  res.json(rows);
});
app.delete('/api/utilizadores/:id', requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id)
    return res.status(400).json({ error: 'Não podes apagar a tua própria conta' });
  await db.query('DELETE FROM utilizadores WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
app.put('/api/utilizadores/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin','professor','aluno'].includes(role)) return res.status(400).json({ error: 'Role inválido' });
  await db.query('UPDATE utilizadores SET role=? WHERE id=?', [role, req.params.id]);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  TURMAS
// ══════════════════════════════════════════════
app.get('/api/turmas', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM turmas ORDER BY ano, nome');
  res.json(rows);
});
app.post('/api/turmas', requireAdmin, async (req, res) => {
  const { nome, ano, area } = req.body;
  if (!nome || !ano || !area) return res.status(400).json({ error: 'nome, ano e area são obrigatórios' });
  try {
    const [r] = await db.query('INSERT INTO turmas (nome, ano, area) VALUES (?,?,?)', [nome, ano, area]);
    broadcast('turmas:update', {});
    res.status(201).json({ id: r.insertId, nome, ano, area });
  } catch { res.status(409).json({ error: 'Turma já existe' }); }
});
app.put('/api/turmas/:id', requireAdmin, async (req, res) => {
  const { nome, ano, area } = req.body;
  await db.query('UPDATE turmas SET nome=?, ano=?, area=? WHERE id=?', [nome, ano, area, req.params.id]);
  broadcast('turmas:update', {});
  res.json({ ok: true });
});
app.delete('/api/turmas/:id', requireAdmin, async (req, res) => {
  await db.query('DELETE FROM turmas WHERE id=?', [req.params.id]);
  broadcast('turmas:update', {}); broadcast('aulas:update', {});
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  PROFESSORES
// ══════════════════════════════════════════════
app.get('/api/professores', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM professores ORDER BY nome');
  res.json(rows);
});
app.post('/api/professores', requireAdmin, async (req, res) => {
  const { nome, email } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  const [r] = await db.query('INSERT INTO professores (nome, email) VALUES (?,?)', [nome, email||null]);
  broadcast('professores:update', {});
  res.status(201).json({ id: r.insertId });
});
app.put('/api/professores/:id', requireAdmin, async (req, res) => {
  const { nome, email } = req.body;
  await db.query('UPDATE professores SET nome=?, email=? WHERE id=?', [nome, email, req.params.id]);
  broadcast('professores:update', {});
  res.json({ ok: true });
});
app.delete('/api/professores/:id', requireAdmin, async (req, res) => {
  await db.query('DELETE FROM professores WHERE id=?', [req.params.id]);
  broadcast('professores:update', {});
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  DISCIPLINAS
// ══════════════════════════════════════════════
app.get('/api/disciplinas', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM disciplinas ORDER BY nome');
  res.json(rows);
});
app.post('/api/disciplinas', requireAdmin, async (req, res) => {
  const { nome, icone } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  const [r] = await db.query('INSERT INTO disciplinas (nome, icone) VALUES (?,?)', [nome, icone||'📚']);
  broadcast('disciplinas:update', {});
  res.status(201).json({ id: r.insertId });
});
app.put('/api/disciplinas/:id', requireAdmin, async (req, res) => {
  const { nome, icone } = req.body;
  await db.query('UPDATE disciplinas SET nome=?, icone=? WHERE id=?', [nome, icone, req.params.id]);
  broadcast('disciplinas:update', {});
  res.json({ ok: true });
});
app.delete('/api/disciplinas/:id', requireAdmin, async (req, res) => {
  const [rows] = await db.query('SELECT COUNT(*) AS n FROM aulas WHERE disciplina_id=?', [req.params.id]);
  if (rows[0].n > 0) return res.status(409).json({ error: 'Disciplina tem aulas associadas' });
  await db.query('DELETE FROM disciplinas WHERE id=?', [req.params.id]);
  broadcast('disciplinas:update', {});
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  DISPONIBILIDADE
// ══════════════════════════════════════════════
app.get('/api/disponibilidade/:professor_id', requireAuth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT dia_semana, hora_inicio, estado, notas FROM disponibilidade WHERE professor_id=?',
    [req.params.professor_id]
  );
  res.json(rows);
});

// Toggle: se já existe apaga, se não existe cria
app.post('/api/disponibilidade', requireAuth, async (req, res) => {
  const { professor_id, dia_semana, hora_inicio, notas } = req.body;

  // Só o próprio professor ou admin pode editar
  const user = req.session.user;
  if (user.role === 'aluno') return res.status(403).json({ error: 'Sem permissão' });

  // Verifica se já existe
  const [existing] = await db.query(
    'SELECT id FROM disponibilidade WHERE professor_id=? AND dia_semana=? AND hora_inicio=?',
    [professor_id, dia_semana, hora_inicio]
  );

  if (existing.length) {
    // Remove (toggle off)
    await db.query('DELETE FROM disponibilidade WHERE professor_id=? AND dia_semana=? AND hora_inicio=?',
      [professor_id, dia_semana, hora_inicio]);
    res.json({ estado: 'disponivel' });
  } else {
    // Cria (toggle on)
    await db.query(
      'INSERT INTO disponibilidade (professor_id, dia_semana, hora_inicio, notas) VALUES (?,?,?,?)',
      [professor_id, dia_semana, hora_inicio, notas||null]
    );
    res.json({ estado: 'indisponivel' });
  }
  broadcast('disponibilidade:update', { professor_id });
});


// ══════════════════════════════════════════════
app.get('/api/aulas', requireAuth, async (req, res) => {
  const { turma_id, dia, professor_id } = req.query;
  let q = 'SELECT * FROM v_aulas WHERE 1=1';
  const params = [];
  if (turma_id)     { q += ' AND turma=(SELECT nome FROM turmas WHERE id=?)'; params.push(turma_id); }
  if (dia !== undefined) { q += ' AND dia_semana=?'; params.push(dia); }
  if (professor_id) { q += ' AND id IN (SELECT id FROM aulas WHERE professor_id=?)'; params.push(professor_id); }
  q += ' ORDER BY dia_semana, hora_inicio';
  const [rows] = await db.query(q, params);
  res.json(rows);
});

app.post('/api/aulas', requireEditor, async (req, res) => {
  const { turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, duracao, sala } = req.body;
  if (!turma_id || !disciplina_id || !professor_id || dia_semana===undefined || hora_inicio===undefined)
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  const dur     = parseInt(duracao) || 1;
  const dia     = parseInt(dia_semana);
  const hora    = parseInt(hora_inicio);
  const horaFim = hora + dur;

  // Verifica indisponibilidade do professor
  const slots = Array.from({ length: dur }, (_, i) => hora + i);
  const placeholders = slots.map(() => '?').join(',');
  const [indisp] = await db.query(
    `SELECT hora_inicio FROM disponibilidade WHERE professor_id=? AND dia_semana=? AND hora_inicio IN (${placeholders})`,
    [professor_id, dia, ...slots]
  );
  if (indisp.length) {
    const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
    const hora_bloq = HORAS[indisp[0].hora_inicio] || indisp[0].hora_inicio + 'h';
    return res.status(409).json({ error: `O professor está marcado como indisponível às ${hora_bloq} de ${['Segunda','Terça','Quarta','Quinta','Sexta'][dia]}` });
  }

  // Conflito professor
  const [cp] = await db.query(`
    SELECT t.nome AS turma FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE a.professor_id=? AND a.dia_semana=?
      AND a.hora_inicio < ? AND (a.hora_inicio + a.duracao) > ?
  `, [professor_id, dia, horaFim, hora]);
  if (cp.length) return res.status(409).json({ error: `Conflito: este professor já tem aula na turma ${cp[0].turma} neste horário` });

  // Conflito turma
  const [ct] = await db.query(`
    SELECT d.nome AS disciplina FROM aulas a
    JOIN disciplinas d ON d.id = a.disciplina_id
    WHERE a.turma_id=? AND a.dia_semana=?
      AND a.hora_inicio < ? AND (a.hora_inicio + a.duracao) > ?
  `, [turma_id, dia, horaFim, hora]);
  if (ct.length) return res.status(409).json({ error: `Conflito: a turma já tem ${ct[0].disciplina} neste horário` });

  const [r] = await db.query(
    'INSERT INTO aulas (turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, duracao, sala) VALUES (?,?,?,?,?,?,?)',
    [turma_id, disciplina_id, professor_id, dia, hora, dur, sala||'A definir']
  );
  broadcast('aulas:update', { turma_id });
  res.status(201).json({ id: r.insertId });
});

app.put('/api/aulas/:id', requireEditor, async (req, res) => {
  const { disciplina_id, professor_id, dia_semana, hora_inicio, duracao, sala } = req.body;
  const dur     = parseInt(duracao) || 1;
  const dia     = parseInt(dia_semana);
  const hora    = parseInt(hora_inicio);
  const horaFim = hora + dur;
  const id      = req.params.id;

  const [aulaRows] = await db.query('SELECT turma_id FROM aulas WHERE id=?', [id]);
  if (!aulaRows.length) return res.status(404).json({ error: 'Aula não encontrada' });
  const turma_id = aulaRows[0].turma_id;

  // Verifica indisponibilidade do professor
  const slots = Array.from({ length: dur }, (_, i) => hora + i);
  const placeholders = slots.map(() => '?').join(',');
  const [indisp] = await db.query(
    `SELECT hora_inicio FROM disponibilidade WHERE professor_id=? AND dia_semana=? AND hora_inicio IN (${placeholders})`,
    [professor_id, dia, ...slots]
  );
  if (indisp.length) {
    const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
    const hora_bloq = HORAS[indisp[0].hora_inicio] || indisp[0].hora_inicio + 'h';
    return res.status(409).json({ error: `O professor está marcado como indisponível às ${hora_bloq} de ${['Segunda','Terça','Quarta','Quinta','Sexta'][dia]}` });
  }

  const [cp] = await db.query(`
    SELECT t.nome AS turma FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE a.id!=? AND a.professor_id=? AND a.dia_semana=?
      AND a.hora_inicio < ? AND (a.hora_inicio + a.duracao) > ?
  `, [id, professor_id, dia, horaFim, hora]);
  if (cp.length) return res.status(409).json({ error: `Conflito: este professor já tem aula na turma ${cp[0].turma} neste horário` });

  const [ct] = await db.query(`
    SELECT d.nome AS disciplina FROM aulas a
    JOIN disciplinas d ON d.id = a.disciplina_id
    WHERE a.id!=? AND a.turma_id=? AND a.dia_semana=?
      AND a.hora_inicio < ? AND (a.hora_inicio + a.duracao) > ?
  `, [id, turma_id, dia, horaFim, hora]);
  if (ct.length) return res.status(409).json({ error: `Conflito: a turma já tem ${ct[0].disciplina} neste horário` });

  await db.query(
    'UPDATE aulas SET disciplina_id=?, professor_id=?, dia_semana=?, hora_inicio=?, duracao=?, sala=? WHERE id=?',
    [disciplina_id, professor_id, dia, hora, dur, sala, id]
  );
  broadcast('aulas:update', {});
  res.json({ ok: true });
});

app.delete('/api/aulas/:id', requireAdmin, async (req, res) => {
  await db.query('DELETE FROM aulas WHERE id=?', [req.params.id]);
  broadcast('aulas:update', {});
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════
app.get('/api/stats', requireAuth, async (req, res) => {
  const { turma_id } = req.query;
  const filter = turma_id ? 'WHERE turma_id=?' : '';
  const params = turma_id ? [turma_id] : [];
  const [[{ totalAulas }]] = await db.query(`SELECT COUNT(*) AS totalAulas FROM aulas ${filter}`, params);
  const [[{ totalHoras }]] = await db.query(`SELECT COALESCE(SUM(duracao),0) AS totalHoras FROM aulas ${filter}`, params);
  const [porDia] = await db.query(`SELECT dia_semana, COUNT(*) AS aulas, SUM(duracao) AS horas FROM aulas ${filter} GROUP BY dia_semana ORDER BY dia_semana`, params);
  res.json({ totalAulas, totalHoras, porDia });
});

// ── WebSocket ─────────────────────────────────────────
io.on('connection', socket => {
  console.log('🔌 Cliente ligado:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Cliente desligado:', socket.id));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Inicia servidor (cria admin se não existir) ───────
server.listen(PORT, async () => {
  try {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM utilizadores');
    if (n === 0) {
      const hash = bcrypt.hashSync('admin123', 12);
      await db.query('INSERT INTO utilizadores (nome, email, password_hash, role) VALUES (?,?,?,?)',
        ['Administrador', 'admin@escola.pt', hash, 'admin']);
      console.log('✅ Admin criado: admin@escola.pt / admin123');
    }
  } catch (e) { console.error('Erro ao verificar admin:', e.message); }

  console.log(`\n✅ EduScheduler a correr em http://localhost:${PORT}`);
  console.log(`🔑 Password Professor: ${ROLE_PASSWORDS.professor}`);
  console.log(`🔑 Password Admin:     ${ROLE_PASSWORDS.admin}\n`);
});