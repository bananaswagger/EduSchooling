// public/js/app.js

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const DIAS  = ['Segunda','Terça','Quarta','Quinta','Sexta'];
const API   = '';

// ── State ──────────────────────────────────────────
const S = {
  turmaId: null,
  turmas: [], profs: [], discs: [], aulas: [],
  view: 'week',
  editAulaId: null,
};

// ── API helpers ────────────────────────────────────
async function api(path, opts={}) {
  const r = await fetch(API + path, {
    headers: {'Content-Type':'application/json'},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||'Erro'); }
  return r.json();
}

// ── Bootstrap ──────────────────────────────────────
async function boot() {
  [S.turmas, S.profs, S.discs] = await Promise.all([
    api('/api/turmas'), api('/api/professores'), api('/api/disciplinas'),
  ]);
  buildTurmaSelect();
  if (S.turmas.length) await App.changeTurma(S.turmas[0].id, false);
  else render();
}

function buildTurmaSelect() {
  const sel = document.getElementById('turmaSelect');
  sel.innerHTML = S.turmas.map(t => `<option value="${t.id}">${t.nome} — ${t.area}</option>`).join('');
  if (S.turmaId) sel.value = S.turmaId;
}


function updateCounts() {}

// ── App controller ─────────────────────────────────
const App = {
  async changeTurma(id, reload=true) {
    S.turmaId = id;
    document.getElementById('turmaSelect').value = id;
    S.aulas = await api(`/api/aulas?turma_id=${id}`);
    if (reload) render();
  },

  setView(v, el) {
    S.view = v;
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.remove('active'));
    if (el) el.classList.add('active');
    ['week','list','discs','profs','stats'].forEach(x => {
      document.getElementById('view'+cap(x)).style.display = x===v?'':'none';
    });
    render();
  },

  onDiscChange() {
    const disc = S.discs.find(d=>d.id==document.getElementById('fDisc').value);
    if (!disc) return;
  },

  async saveAula() {
    const body = {
      turma_id:      parseInt(document.getElementById('fTurma').value),
      disciplina_id: parseInt(document.getElementById('fDisc').value),
      professor_id:  parseInt(document.getElementById('fProf').value),
      dia_semana:    parseInt(document.getElementById('fDia').value),
      hora_inicio:   parseInt(document.getElementById('fHora').value),
      duracao:       parseInt(document.getElementById('fDur').value),
      sala:          document.getElementById('fSala').value.trim() || 'A definir',
    };
    try {
      if (S.editAulaId) {
        await api(`/api/aulas/${S.editAulaId}`, {method:'PUT', body});
        toast('✅ Aula atualizada!');
      } else {
        await api('/api/aulas', {method:'POST', body});
        toast('✅ Aula criada!');
      }
      Modal.close('overlayAdd');
      S.aulas = await api(`/api/aulas?turma_id=${S.turmaId}`);
      updateCounts();
      render();
    } catch(e) { toast('❌ '+e.message, true); }
  },

  async deleteAula() {
    if (!S.editAulaId) return;
    if (!confirm('Apagar esta aula?')) return;
    await api(`/api/aulas/${S.editAulaId}`, {method:'DELETE'});
    toast('🗑 Aula apagada');
    Modal.close('overlayDetail');
    S.aulas = await api(`/api/aulas?turma_id=${S.turmaId}`);
    updateCounts();
    render();
  },
};

// ── Render ─────────────────────────────────────────
function render() {
  if (S.view==='week')  renderWeek();
  if (S.view==='list')  renderList();
  if (S.view==='discs') renderDiscs();
  if (S.view==='profs') renderProfs();
  if (S.view==='stats') renderStats();
}

function filteredAulas() {
  return S.aulas;
}

// Week
function renderWeek() {
  const el = document.getElementById('viewWeek');
  const todayIdx = new Date().getDay()-1; // 0=Mon
  el.innerHTML = `
    <div class="page-head"><div>
      <div class="page-title">Horário Semanal</div>
      <div class="page-sub">${currentTurmaNome()}</div>
    </div></div>
    <div class="week-wrap">
      <div class="week-head">
        <div class="wh-cell"></div>
        ${DIAS.map((d,i)=>{
          const date=new Date();date.setDate(date.getDate()-(date.getDay()-1)+i);
          return `<div class="wh-cell ${i===todayIdx?'today':''}">${d}<span class="dn">${date.getDate()}</span></div>`;
        }).join('')}
      </div>
      <div class="week-body">
        <div class="time-col">${HORAS.map(h=>`<div class="time-cell">${h}</div>`).join('')}</div>
        ${DIAS.map((_,di)=>`
          <div class="day-col">
            ${HORAS.map((_,hi)=>`<div class="day-slot" id="s${di}_${hi}"></div>`).join('')}
          </div>`).join('')}
      </div>
    </div>`;

  (filteredAulas()).forEach(a => {
    const slot = document.getElementById(`s${a.dia_semana}_${a.hora_inicio}`);
    if (!slot) return;
    const h = 76*a.duracao - 6;
    const block = document.createElement('div');
    block.className = 'aula-block';
    block.style.cssText = `top:3px;height:${h}px;background:#e8edfb;border-left-color:#2d5be3;color:#1a1814`;
    block.innerHTML = `
      <div class="ab-disc">${a.icone||'📚'} ${a.disciplina}</div>
      <div class="ab-prof">${a.professor}</div>
      <div class="ab-sala">🚪 ${a.sala}</div>`;
    block.onclick = () => openDetail(a);
    slot.appendChild(block);
  });
}

// List
function renderList() {
  const el = document.getElementById('viewList');
  const aulas = filteredAulas();
  let html = `<div class="page-head"><div>
    <div class="page-title">Lista de Aulas</div>
    <div class="page-sub">${currentTurmaNome()} · ${aulas.length} aula${aulas.length!==1?'s':''}</div>
  </div></div>`;

  DIAS.forEach((d,di) => {
    const dayAulas = aulas.filter(a=>a.dia_semana===di).sort((a,b)=>a.hora_inicio-b.hora_inicio);
    if (!dayAulas.length) return;
    html += `<div class="list-day"><div class="list-day-header">${d}</div>`;
    dayAulas.forEach(a => {
      const fim = HORAS[a.hora_inicio+a.duracao]||'—';
      html += `<div class="list-row" onclick='openDetail(${JSON.stringify(a)})'>
        <div class="lr-time">${HORAS[a.hora_inicio]}<br><span style="color:var(--text3)">${fim}</span></div>
        <div class="lr-bar" style="background:#2d5be3"></div>
        <div class="lr-info">
          <div class="lr-disc">${a.icone||'📚'} ${a.disciplina}</div>
          <div class="lr-prof">${a.professor}</div>
        </div>
        <div class="lr-sala">${a.sala}</div>
      </div>`;
    });
    html += '</div>';
  });

  if (!aulas.length) html += `<div class="empty"><div class="empty-icon">📭</div><p>Nenhuma aula encontrada.</p></div>`;
  el.innerHTML = html;
}

// Discs
function renderDiscs() {
  const el = document.getElementById('viewDiscs');
  const aulas = filteredAulas();
  const uniq = {};
  aulas.forEach(a => {
    if (!uniq[a.disciplina]) uniq[a.disciplina] = {...a, horas:0, turmasCnt:new Set()};
    uniq[a.disciplina].horas += a.duracao;
  });
  const cards = Object.values(uniq);
  el.innerHTML = `<div class="page-head"><div>
    <div class="page-title">Disciplinas</div>
    <div class="page-sub">${cards.length} disciplina${cards.length!==1?'s':''}</div>
  </div></div>
  <div class="disc-grid">${cards.map(a=>`
    <div class="disc-card" style="border-top-color:#2d5be3" onclick='openDetail(${JSON.stringify(a)})'>
      <div class="dc-icon">${a.icone||'📚'}</div>
      <div class="dc-name">${a.disciplina}</div>
      <div class="dc-prof">${a.professor}</div>
      <div class="dc-horas">${a.horas * 50} min/semana</div>
    </div>`).join('')}
  </div>`;
  if (!cards.length) el.innerHTML += `<div class="empty"><div class="empty-icon">📚</div><p>Nenhuma disciplina.</p></div>`;
}

// Profs
function renderProfs() {
  const el = document.getElementById('viewProfs');
  const aulasPorProf = {};
  S.aulas.forEach(a => {
    aulasPorProf[a.professor] = (aulasPorProf[a.professor]||0) + a.duracao;
  });
  el.innerHTML = `<div class="page-head"><div>
    <div class="page-title">Professores</div>
    <div class="page-sub">${S.profs.length} professores</div>
  </div></div>
  <div class="profs-grid">${S.profs.map(p=>{
    const initials = p.nome.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    const horas = aulasPorProf[p.nome]||0;
    return `<div class="prof-card">
      <div class="prof-av">${initials}</div>
      <div class="prof-name">${p.nome}</div>
      <div class="prof-email">${p.email||'—'}</div>
      <div class="prof-grupo">${p.email||''}</div>
      ${horas?`<div class="prof-aulas">${horas*50} min/sem nesta turma</div>`:''}
    </div>`;
  }).join('')}</div>`;
}

// Stats
async function renderStats() {
  const el = document.getElementById('viewStats');
  el.innerHTML = '<div class="loading">A carregar...</div>';
  const stats = await api(`/api/stats?turma_id=${S.turmaId}`);
  const maxD = Math.max(...stats.porDia.map(d=>d.horas),1);
  el.innerHTML = `
    <div class="page-head"><div>
      <div class="page-title">Estatísticas</div>
      <div class="page-sub">${currentTurmaNome()}</div>
    </div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${stats.totalAulas}</div><div class="stat-label">Aulas por semana</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalHoras*50/60|0}h${stats.totalHoras*50%60?stats.totalHoras*50%60+'m':''}</div><div class="stat-label">Tempo semanal</div></div>

      <div class="stat-card"><div class="stat-value">${S.discs.length}</div><div class="stat-label">Disciplinas no sistema</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-top:.8rem">
      <div class="bar-chart">

      <div class="bar-chart">
        <h3>Por Dia da Semana</h3>
        ${stats.porDia.map(d=>`
          <div class="bar-row">
            <div class="bar-label">${DIAS[d.dia_semana]}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${d.horas/maxD*100}%;background:var(--accent)"></div></div>
            <div class="bar-val">${d.horas*50}m</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Detail modal ───────────────────────────────────
function openDetail(a) {
  S.editAulaId = a.id;
  const fim = HORAS[a.hora_inicio+a.duracao]||'—';
  document.getElementById('detTitulo').textContent = `${a.icone||'📚'} ${a.disciplina}`;
  document.getElementById('detGrid').innerHTML = `
    <div class="detail-item"><label>Professor</label><p>${a.professor}</p></div>
    <div class="detail-item"><label>Sala</label><p>${a.sala}</p></div>
    <div class="detail-item"><label>Dia</label><p>${DIAS[a.dia_semana]}</p></div>
    <div class="detail-item"><label>Horário</label><p>${HORAS[a.hora_inicio]} – ${fim}</p></div>
    <div class="detail-item"><label>Duração</label><p>${a.duracao*50} minutos</p></div>`;
  document.getElementById('overlayDetail').classList.add('open');
}

// ── Add/Edit modal ─────────────────────────────────
const Modal = {
  openAdd(aula=null) {
    S.editAulaId = aula?.id || null;
    document.getElementById('addModalTitle').textContent = aula ? 'Editar Aula' : 'Nova Aula';

    // Fill selects
    document.getElementById('fDisc').innerHTML = S.discs.map(d=>`<option value="${d.id}">${d.icone||'📚'} ${d.nome}</option>`).join('');
    document.getElementById('fProf').innerHTML = S.profs.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
    document.getElementById('fHora').innerHTML = HORAS.map((h,i)=>`<option value="${i}">${h}</option>`).join('');
    document.getElementById('fTurma').innerHTML = S.turmas.map(t=>`<option value="${t.id}" ${t.id==S.turmaId?'selected':''}>${t.nome}</option>`).join('');

    if (aula) {
      document.getElementById('fDisc').value = S.discs.find(d=>d.nome===aula.disciplina)?.id||'';
      document.getElementById('fProf').value = S.profs.find(p=>p.nome===aula.professor)?.id||'';
      document.getElementById('fDia').value  = aula.dia_semana;
      document.getElementById('fHora').value = aula.hora_inicio;
      document.getElementById('fDur').value  = aula.duracao;
      document.getElementById('fSala').value = aula.sala;
    } else {
      document.getElementById('fSala').value = '';
    }
    document.getElementById('conflictAlert').style.display='none';
    document.getElementById('overlayAdd').classList.add('open');
  },

  close(id) { document.getElementById(id).classList.remove('open'); },

  async openGestao(entity) {
    const titles = {turmas:'Turmas',professores:'Professores',disciplinas:'Disciplinas'};
    document.getElementById('gestaoTitle').textContent = titles[entity];
    await renderGestao(entity);
    document.getElementById('overlayGestao').classList.add('open');
  }
};

// ── Gestão (CRUD tables) ───────────────────────────
function isAdmin() { return window.currentUser && window.currentUser.role === 'admin'; }

async function renderGestao(entity) {
  const el = document.getElementById('gestaoContent');
  el.innerHTML = '<div class="loading">A carregar...</div>';
  const admin = isAdmin();
  const soLeitura = '<p style="margin-top:1rem;font-size:.82rem;color:var(--text3);text-align:center">👁 Modo leitura — apenas administradores podem fazer alterações.</p>';

  if (entity === 'turmas') {
    const rows = await api('/api/turmas');
    el.innerHTML = `<table class="gestao-table">
      <tr><th>Nome</th><th>Ano</th><th>Área</th>${admin ? '<th></th>' : ''}</tr>
      ${rows.map(r => `<tr>
        <td>${r.nome}</td><td>${r.ano}.º</td><td>${r.area}</td>
        ${admin ? `<td><button class="btn-sm danger" onclick="deleteTurma(${r.id})">Apagar</button></td>` : ''}
      </tr>`).join('')}
    </table>
    ${admin ? `<div class="gestao-add">
      <input type="text" id="gNome" placeholder="Nome (ex: 12.º C)">
      <input type="number" id="gAno" placeholder="Ano" min="10" max="12">
      <input type="text" id="gArea" placeholder="Área (ex: Ciências)">
      <button class="btn-primary" onclick="addTurma()">+ Adicionar</button>
    </div>` : soLeitura}`;
  }

  if (entity === 'professores') {
    const rows = await api('/api/professores');
    el.innerHTML = `<table class="gestao-table">
      <tr><th>Nome</th><th>Email</th>${admin ? '<th></th>' : ''}</tr>
      ${rows.map(r => `<tr>
        <td>${r.nome}</td><td>${r.email||'—'}</td>
        ${admin ? `<td><button class="btn-sm danger" onclick="deleteProf(${r.id})">Apagar</button></td>` : ''}
      </tr>`).join('')}
    </table>
    ${admin ? `<div class="gestao-add">
      <input type="text" id="gPNome" placeholder="Nome">
      <input type="email" id="gPEmail" placeholder="Email">
      <button class="btn-primary" onclick="addProf()">+ Adicionar</button>
    </div>` : soLeitura}`;
  }

  if (entity === 'disciplinas') {
    const rows = await api('/api/disciplinas');
    el.innerHTML = `<table class="gestao-table">
      <tr><th>Nome</th><th>Ícone</th>${admin ? '<th></th>' : ''}</tr>
      ${rows.map(r => `<tr>
        <td>${r.nome}</td>
        <td style="font-size:1.2rem">${r.icone}</td>
        ${admin ? `<td><button class="btn-sm danger" onclick="deleteDisc(${r.id})">Apagar</button></td>` : ''}
      </tr>`).join('')}
    </table>
    ${admin ? `<div class="gestao-add">
      <input type="text" id="gDNome" placeholder="Nome da disciplina">
      <input type="text" id="gDIcone" placeholder="Ícone (emoji)" style="max-width:80px">
      <button class="btn-primary" onclick="addDisc()">+ Adicionar</button>
    </div>` : soLeitura}`;
  }

  if (entity === 'utilizadores') {
    if (!admin) { el.innerHTML = '<p style="padding:1rem;color:var(--text3)">Sem permissão.</p>'; return; }
    const rows = await api('/api/utilizadores');
    el.innerHTML = `<table class="gestao-table">
      <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Último login</th><th></th></tr>
      ${rows.map(r => `<tr>
        <td>${r.nome}</td><td>${r.email}</td>
        <td><select onchange="changeRole(${r.id}, this.value)" style="font-size:.78rem;padding:.2rem .4rem;border-radius:5px;border:1px solid var(--border)">
          ${['admin','professor','aluno'].map(role => `<option value="${role}" ${r.role===role?'selected':''}>${role}</option>`).join('')}
        </select></td>
        <td style="font-size:.75rem;color:var(--text3)">${r.ultimo_login ? new Date(r.ultimo_login).toLocaleString('pt-PT') : 'Nunca'}</td>
        <td><button class="btn-sm danger" onclick="deleteUser(${r.id})">Apagar</button></td>
      </tr>`).join('')}
    </table>`;
  }
}

// Gestão actions
async function addTurma() {
  try {
    await api('/api/turmas',{method:'POST',body:{nome:v('gNome'),ano:parseInt(v('gAno')),area:v('gArea')}});
    S.turmas = await api('/api/turmas'); buildTurmaSelect();
    toast('✅ Turma adicionada'); await renderGestao('turmas');
  } catch(e){ toast('❌ '+e.message,true); }
}
async function deleteTurma(id) {
  if (!confirm('Apagar turma? Todas as aulas serão apagadas.')) return;
  await api('/api/turmas/'+id,{method:'DELETE'});
  S.turmas = await api('/api/turmas'); buildTurmaSelect();
  toast('🗑 Turma apagada'); await renderGestao('turmas');
}
async function addProf() {
  try {
    await api('/api/professores',{method:'POST',body:{nome:v('gPNome'),email:v('gPEmail')}});
    S.profs = await api('/api/professores');
    toast('✅ Professor adicionado'); await renderGestao('professores');
  } catch(e){ toast('❌ '+e.message,true); }
}
async function deleteProf(id) {
  await api('/api/professores/'+id,{method:'DELETE'});
  S.profs = await api('/api/professores');
  toast('🗑 Professor apagado'); await renderGestao('professores');
}
async function addDisc() {
  try {
    await api('/api/disciplinas',{method:'POST',body:{nome:v('gDNome'),icone:v('gDIcone')||'📚'}});
    S.discs = await api('/api/disciplinas');
    toast('✅ Disciplina adicionada'); await renderGestao('disciplinas');
  } catch(e){ toast('❌ '+e.message,true); }
}
async function deleteDisc(id) {
  try {
    await api('/api/disciplinas/'+id,{method:'DELETE'});
    S.discs = await api('/api/disciplinas');
    toast('🗑 Disciplina apagada'); await renderGestao('disciplinas');
  } catch(e){ toast('❌ '+e.message,true); }
}

async function changeRole(id, role) {
  try {
    await api(`/api/utilizadores/${id}/role`, { method: 'PUT', body: { role } });
    toast('✅ Perfil atualizado');
  } catch(e) { toast('❌ ' + e.message, true); }
}
async function deleteUser(id) {
  if (!confirm('Apagar este utilizador?')) return;
  try {
    await api(`/api/utilizadores/${id}`, { method: 'DELETE' });
    toast('🗑 Utilizador apagado');
    await renderGestao('utilizadores');
  } catch(e) { toast('❌ ' + e.message, true); }
}

// ── Helpers ────────────────────────────────────────
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function v(id){ return document.getElementById(id)?.value||''; }
function currentTurmaNome(){ return S.turmas.find(t=>t.id==S.turmaId)?.nome||''; }

function toast(msg, err=false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = err ? '#c94040' : '#1a1814';
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 2800);
}

// ── Init ──
boot();