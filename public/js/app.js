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
  if (S.turmas.length) {
    await App.changeTurma(S.turmas[0].id, false);
  }
  render(); // garante que renderiza sempre, independentemente de haver turmas
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
    ['week','list','gantt','discs','profs','stats'].forEach(x => {
      const el = document.getElementById('view'+cap(x));
      if (el) el.style.display = x===v?'':'none';
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
  if (S.view==='discs') renderDiscs();
  if (S.view==='profs') renderProfs();
}

function filteredAulas() {
  return S.aulas;
}

// Week
function renderWeek() {
  const el = document.getElementById('viewWeek');
  const todayIdx = new Date().getDay()-1;
  const canEdit = window.currentUser?.role !== 'aluno';

  el.innerHTML = `
    <div class="page-head"><div>
      <div class="page-title">Horário Semanal</div>
      <div class="page-sub">${currentTurmaNome()}${canEdit ? ' — clica num slot vazio para adicionar aula' : ''}</div>
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
            ${HORAS.map((_,hi)=>`<div class="day-slot ${canEdit?'slot-clickable':''}" id="s${di}_${hi}" ${canEdit?`onclick="slotClick(${di},${hi},this)"`:''} data-dia="${di}" data-hora="${hi}"></div>`).join('')}
          </div>`).join('')}
      </div>
    </div>

    <div style="margin-top:1.5rem">
      <div class="page-title" style="font-size:1rem;margin-bottom:.8rem">📋 Tabela de Atribuição — ${currentTurmaNome()}</div>
      <div id="atribuicaoTable"></div>
    </div>`;

  // Preenche aulas no horário
  const ocupados = new Set();
  (filteredAulas()).forEach(a => {
    const slot = document.getElementById(`s${a.dia_semana}_${a.hora_inicio}`);
    if (!slot) return;
    // Marca slots cobertos como ocupados
    for (let s = a.hora_inicio; s < a.hora_inicio + a.duracao; s++) {
      ocupados.add(`${a.dia_semana}_${s}`);
      const sEl = document.getElementById(`s${a.dia_semana}_${s}`);
      if (sEl) sEl.classList.remove('slot-clickable');
    }
    const h = 76*a.duracao - 6;
    const block = document.createElement('div');
    block.className = 'aula-block';
    block.style.cssText = `top:3px;height:${h}px;background:var(--accent-light);border-left-color:var(--accent);color:#1a1814`;
    block.innerHTML = `
      <div class="ab-disc">${a.icone||'📚'} ${a.disciplina}</div>
      <div class="ab-prof">${a.professor}</div>
      <div class="ab-sala">🚪 ${a.sala}</div>`;
    block.onclick = (e) => { e.stopPropagation(); openDetail(a); };
    slot.appendChild(block);
  });

  // Tabela de atribuição
  renderAtribuicao();
}

function slotClick(dia, hora, slotEl) {
  // Só abre se o slot estiver vazio
  if (slotEl.querySelector('.aula-block')) return;
  Modal.openAdd(null, dia, hora);
}

function renderAtribuicao() {
  const el = document.getElementById('atribuicaoTable');
  if (!el) return;
  const aulas = filteredAulas();
  if (!aulas.length) {
    el.innerHTML = `<p style="color:var(--text3);font-size:.83rem">Sem aulas atribuídas para esta turma.</p>`;
    return;
  }

  // Agrupa por professor -> disciplinas únicas
  const porProf = {};
  aulas.forEach(a => {
    if (!porProf[a.professor]) porProf[a.professor] = { email: a.professor_email, discs: new Set(), horas: 0 };
    porProf[a.professor].discs.add(`${a.icone||'📚'} ${a.disciplina}`);
    porProf[a.professor].horas += a.duracao;
  });

  const border = '1px solid var(--border)';
  const tdStyle = `padding:.55rem .8rem;border-bottom:${border};font-size:.83rem;vertical-align:top`;
  const thStyle = `padding:.45rem .8rem;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);border-bottom:2px solid var(--border);text-align:left;background:var(--surface2)`;

  el.innerHTML = `
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;background:var(--surface);border:${border};border-radius:10px;overflow:hidden">
    <thead>
      <tr>
        <th style="${thStyle}">Professor</th>
        <th style="${thStyle}">Disciplinas nesta turma</th>
        <th style="${thStyle}">Total semanal</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(porProf).map(([nome, info], i) => {
        const initials = nome.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0].toUpperCase()).join('');
        const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)';
        return `<tr style="background:${bg}">
          <td style="${tdStyle}">
            <div style="display:flex;align-items:center;gap:.6rem">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-light);color:var(--accent);
                display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.72rem;flex-shrink:0">${initials}</div>
              <div>
                <div style="font-weight:600">${nome}</div>
                <div style="font-size:.72rem;color:var(--text2)">${info.email||'—'}</div>
              </div>
            </div>
          </td>
          <td style="${tdStyle}">
            <div style="display:flex;flex-wrap:wrap;gap:.3rem">
              ${[...info.discs].map(d=>`<span style="background:var(--accent-light);color:var(--accent);
                padding:.2rem .55rem;border-radius:999px;font-size:.75rem;font-weight:600">${d}</span>`).join('')}
            </div>
          </td>
          <td style="${tdStyle}">
            <span style="font-weight:700;color:var(--accent)">${info.horas}</span>
            <span style="color:var(--text2);font-size:.78rem"> bloco${info.horas!==1?'s':''} / sem</span>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  </div>`;
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
    <div class="page-sub">${S.profs.length} professores — clica para ver disponibilidade</div>
  </div></div>
  <div class="profs-grid">${S.profs.map(p=>{
    const initials = p.nome.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    const horas = aulasPorProf[p.nome]||0;
    return `<div class="prof-card" onclick='openProfDisp(${p.id})' style="cursor:pointer;transition:transform .1s,box-shadow .1s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div class="prof-av">${initials}</div>
      <div class="prof-name">${p.nome}</div>
      <div class="prof-email">${p.email||'—'}</div>
      ${horas?`<div class="prof-aulas">${horas*50} min/sem nesta turma</div>`:''}
      <div style="margin-top:.5rem;font-size:.7rem;color:var(--accent)">👁 Ver disponibilidade</div>
    </div>`;
  }).join('')}</div>`;
}

async function openProfDisp(profId) {
  const prof = S.profs.find(p => p.id === profId);
  if (!prof) return;

  document.getElementById('profDispNome').textContent = `Disponibilidade — ${prof.nome}`;
  document.getElementById('profDispContent').innerHTML = '<div class="loading">A carregar...</div>';
  document.getElementById('overlayProfDisp').classList.add('open');

  await renderDispTable(profId);
}

async function renderDispTable(profId) {
  const prof = S.profs.find(p => p.id === profId);
  const [todasAulas, dispData] = await Promise.all([
    api(`/api/aulas?professor_id=${profId}`),
    api(`/api/disponibilidade/${profId}`)
  ]);

  const DIAS  = ['Segunda','Terça','Quarta','Quinta','Sexta'];
  const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
  const isAdmin  = window.currentUser?.role === 'admin';
  const isProf   = window.currentUser?.role === 'professor';
  const canEdit  = isAdmin || isProf;

  // Mapa de aulas: "dia_hora" -> aula
  const aulaMap = {};
  todasAulas.forEach(a => {
    for (let s = a.hora_inicio; s < a.hora_inicio + a.duracao; s++) {
      aulaMap[`${a.dia_semana}_${s}`] = a;
    }
  });

  // Mapa de indisponibilidades
  const indispMap = new Set();
  dispData.forEach(d => indispMap.add(`${d.dia_semana}_${d.hora_inicio}`));

  const initials = prof.nome.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0].toUpperCase()).join('');

  let legenda = `
  <div style="display:flex;flex-wrap:wrap;gap:.8rem;margin-bottom:1rem;font-size:.75rem">
    <span style="display:flex;align-items:center;gap:.3rem"><span style="width:14px;height:14px;border-radius:3px;background:#e8fdf0;border:1.5px solid #1a9a5a;display:inline-block"></span> Disponível</span>
    <span style="display:flex;align-items:center;gap:.3rem"><span style="width:14px;height:14px;border-radius:3px;background:#fde8e8;border:1.5px solid #d63a3a;display:inline-block"></span> Ocupado com aula</span>
    <span style="display:flex;align-items:center;gap:.3rem"><span style="width:14px;height:14px;border-radius:3px;background:#fef3e2;border:1.5px solid #e07c1a;display:inline-block"></span> Indisponível (motivo pessoal)</span>
    ${canEdit ? '<span style="color:var(--text3);font-style:italic">Clica num slot para marcar/desmarcar indisponibilidade</span>' : ''}
  </div>`;

  let html = `
  <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:1rem">
    <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-light);color:var(--accent);
      display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${initials}</div>
    <div>
      <div style="font-weight:700">${prof.nome}</div>
      <div style="font-size:.75rem;color:var(--text2)">${prof.email||'Sem email'}</div>
    </div>
  </div>
  ${legenda}
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:.75rem;min-width:460px">
    <thead>
      <tr>
        <th style="padding:.4rem .5rem;text-align:left;font-size:.65rem;color:var(--text3);
          text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border);min-width:55px">Hora</th>
        ${DIAS.map(d=>`<th style="padding:.4rem .3rem;text-align:center;font-size:.65rem;color:var(--text3);
          text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border)">${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  // Para controlar rowspan das aulas
  const skipCell = new Set();

  HORAS.forEach((hora, hi) => {
    html += `<tr>
      <td style="padding:.3rem .5rem;font-size:.7rem;font-weight:600;color:var(--text2);
        white-space:nowrap;border-bottom:1px solid var(--border)">${hora}</td>`;

    DIAS.forEach((_, di) => {
      const key = `${di}_${hi}`;
      if (skipCell.has(key)) return; // coberto por rowspan

      const aula = aulaMap[key];
      const indisp = indispMap.has(key);

      if (aula && hi === aula.hora_inicio) {
        // Marca células seguintes para skip
        for (let s = hi+1; s < aula.hora_inicio + aula.duracao; s++) {
          skipCell.add(`${di}_${s}`);
        }
        html += `<td rowspan="${aula.duracao}" style="padding:.3rem .4rem;text-align:center;
          background:#fde8e8;border:1.5px solid #f5b8b8;border-radius:5px;vertical-align:middle">
          <div style="font-size:.68rem;font-weight:700;color:#c94040">🔴 Aula</div>
          <div style="font-size:.62rem;color:#c94040;margin-top:.1rem">${aula.disciplina}</div>
          <div style="font-size:.58rem;color:#e07070">${aula.turma}</div>
        </td>`;
      } else if (!aula) {
        if (indisp) {
          html += `<td style="padding:.2rem;text-align:center;background:#fef3e2;
            border:1.5px solid #f5d0a0;border-radius:5px;${canEdit?'cursor:pointer':''}
            " ${canEdit ? `onclick="toggleDisp(${prof.id},${di},${hi},this)"` : ''}>
            <div style="font-size:.68rem;font-weight:700;color:#e07c1a">🟡 Indisponível</div>
          </td>`;
        } else {
          html += `<td style="padding:.2rem;text-align:center;background:#e8fdf0;
            border:1px solid #b8e8cc;border-radius:5px;${canEdit?'cursor:pointer':''}
            " ${canEdit ? `onclick="toggleDisp(${prof.id},${di},${hi},this)"` : ''}>
            <div style="font-size:.68rem;color:#1a9a5a">🟢 Livre</div>
          </td>`;
        }
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('profDispContent').innerHTML = html;
}

async function toggleDisp(profId, dia, hora, tdEl) {
  try {
    const data = await api('/api/disponibilidade', {
      method: 'POST',
      body: { professor_id: profId, dia_semana: dia, hora_inicio: hora }
    });
    // Atualiza a célula visualmente sem re-renderizar tudo
    const canEdit = true;
    if (data.estado === 'indisponivel') {
      tdEl.style.background = '#fef3e2';
      tdEl.style.border = '1.5px solid #f5d0a0';
      tdEl.innerHTML = `<div style="font-size:.68rem;font-weight:700;color:#e07c1a">🟡 Indisponível</div>`;
    } else {
      tdEl.style.background = '#e8fdf0';
      tdEl.style.border = '1px solid #b8e8cc';
      tdEl.innerHTML = `<div style="font-size:.68rem;color:#1a9a5a">🟢 Livre</div>`;
    }
  } catch(e) { toast('❌ ' + e.message, true); }
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
  openAdd(aula=null, diaPreenchido=null, horaPreenchida=null) {
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
      // Pré-preenche dia e hora se vieram do clique na célula
      if (diaPreenchido !== null) document.getElementById('fDia').value = diaPreenchido;
      if (horaPreenchida !== null) document.getElementById('fHora').value = horaPreenchida;
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

// Gantt
function renderGantt() {
  const el = document.getElementById('viewGantt');
  const aulas = filteredAulas();

  // Cores por disciplina (geradas de forma consistente)
  const CORES = [
    '#4f86f7','#e07c1a','#2d7a3a','#8b44c2','#c24020',
    '#1a8ab0','#d63a3a','#1a9a5a','#c2a020','#5a9a20',
    '#8b1a9a','#206ac2','#9a5a1a','#1a6a9a','#c2201a',
  ];
  const discCores = {};
  [...new Set(aulas.map(a=>a.disciplina))].forEach((d,i) => {
    discCores[d] = CORES[i % CORES.length];
  });

  // Slots: 08:00 a 18:00 = 10 horas = 600 min
  const SLOT_W = 60; // px por hora
  const ROW_H  = 44;
  const LABEL_W = 160;
  const HORAS_GANTT = ['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h'];
  const TOTAL_W = SLOT_W * HORAS_GANTT.length;

  let html = `
  <div class="page-head"><div>
    <div class="page-title">Diagrama de Gantt</div>
    <div class="page-sub">${currentTurmaNome()} — distribuição semanal por disciplina</div>
  </div></div>
  <div style="overflow-x:auto;padding-bottom:1rem">
  <div style="min-width:${LABEL_W + TOTAL_W + 40}px">

  <!-- Cabeçalho dos dias -->
  <div style="display:flex;margin-left:${LABEL_W}px;margin-bottom:2px">
    ${DIAS.map(d=>`
      <div style="width:${TOTAL_W}px;text-align:center;font-size:.7rem;font-weight:700;
        text-transform:uppercase;letter-spacing:.06em;color:var(--text2);
        border-left:1px solid var(--border);padding:.3rem 0">${d}</div>
    `).join('')}
  </div>

  <!-- Cabeçalho das horas (repetido por dia) -->
  <div style="display:flex;margin-left:${LABEL_W}px;margin-bottom:4px">
    ${DIAS.map(()=>HORAS_GANTT.map(h=>`
      <div style="width:${SLOT_W}px;font-size:.65rem;color:var(--text3);
        border-left:1px dashed var(--border);padding-left:3px">${h}</div>
    `).join('')).join('')}
  </div>`;

  // Uma linha por disciplina
  const disciplinas = [...new Set(aulas.map(a=>a.disciplina))].sort();

  disciplinas.forEach(disc => {
    const cor = discCores[disc];
    const aulaDisc = aulas.filter(a=>a.disciplina===disc);
    const icone = aulaDisc[0]?.icone || '📚';

    html += `
    <div style="display:flex;align-items:center;margin-bottom:3px;height:${ROW_H}px">
      <!-- Label da disciplina -->
      <div style="width:${LABEL_W}px;flex-shrink:0;font-size:.78rem;font-weight:600;
        color:var(--text);padding-right:.8rem;text-align:right;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis" title="${disc}">
        ${icone} ${disc}
      </div>
      <!-- Grelha dos 5 dias -->
      <div style="display:flex;position:relative">
        ${DIAS.map((_,di) => {
          const aulaDia = aulaDisc.filter(a=>a.dia_semana===di);
          let barras = '';
          aulaDia.forEach(a => {
            const left  = a.hora_inicio * SLOT_W;
            const width = a.duracao * SLOT_W - 4;
            barras += `
              <div onclick='openDetail(${JSON.stringify(a)})'
                title="${disc} — ${HORAS[a.hora_inicio]} · ${a.professor} · ${a.sala}"
                style="position:absolute;left:${left}px;top:6px;
                  width:${width}px;height:${ROW_H-16}px;
                  background:${cor};border-radius:5px;cursor:pointer;
                  display:flex;align-items:center;padding:0 8px;
                  font-size:.7rem;font-weight:600;color:#fff;
                  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
                  box-shadow:0 1px 4px rgba(0,0,0,.15);
                  transition:opacity .15s;opacity:.9"
                onmouseover="this.style.opacity='1'"
                onmouseout="this.style.opacity='.9'">
                ${HORAS[a.hora_inicio]}
              </div>`;
          });
          return `
            <div style="width:${TOTAL_W}px;height:${ROW_H}px;position:relative;
              border-left:1px solid var(--border);border-bottom:1px solid var(--border);
              background:${di%2===0?'var(--surface)':'var(--surface2)'}">
              ${HORAS_GANTT.map((_,hi)=>`
                <div style="position:absolute;left:${hi*SLOT_W}px;top:0;
                  width:1px;height:100%;background:var(--border);opacity:.4"></div>
              `).join('')}
              ${barras}
            </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  // Legenda
  html += `
  <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.2rem;margin-left:${LABEL_W}px;padding-top:.8rem;border-top:1px solid var(--border)">
    ${disciplinas.map(d=>`
      <div style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:600;color:var(--text2)">
        <div style="width:12px;height:12px;border-radius:3px;background:${discCores[d]};flex-shrink:0"></div>
        ${d}
      </div>`).join('')}
  </div>
  </div></div>`;

  if (!aulas.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>Nenhuma aula para mostrar no Gantt.</p></div>`;
    return;
  }
  el.innerHTML = html;
}


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