// server.js — versão simples (só turmas, professores, disciplinas)

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const http       = require('http');
const { Server } = require('socket.io');
const db         = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 3000;

const ROLE_PASSWORDS = { professor: 'prof2024', admin: 'admin2024' };

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'eduscheduler-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.status(401).json({ error: 'Não autenticado' });
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
  if (!user || !bcrypt.compareSync(password, user.password_hash))
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
  const role = req.body?.role;
  if (!role || !['admin','professor','aluno'].includes(role))
    return res.status(400).json({ error: 'Role inválido: ' + role });
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
  broadcast('turmas:update', {});
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
  await db.query('DELETE FROM disciplinas WHERE id=?', [req.params.id]);
  broadcast('disciplinas:update', {});
  res.json({ ok: true });
});

// ── WebSocket ─────────────────────────────────────────
io.on('connection', socket => {
  socket.on('disconnect', () => {});
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

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
  console.log(`\n✅ EduScheduler Simples em http://localhost:${PORT}`);
  console.log(`🔑 Password Professor: ${ROLE_PASSWORDS.professor}`);
  console.log(`🔑 Password Admin:     ${ROLE_PASSWORDS.admin}\n`);
});