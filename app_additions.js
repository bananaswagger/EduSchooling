// Adiciona este bloco dentro da função renderGestao() no app.js,
// após o bloco if (entity === 'disciplinas') { ... }

// ── COLAR DENTRO DE renderGestao() em app.js ──────────────────────────────
//
//  if (entity === 'utilizadores') {
//    const rows = await api('/api/utilizadores');
//    el.innerHTML = `<table class="gestao-table">
//      <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Último login</th><th></th></tr>
//      ${rows.map(r=>`<tr>
//        <td>${r.nome}</td>
//        <td>${r.email}</td>
//        <td>
//          <select onchange="changeRole(${r.id}, this.value)" style="font-size:.78rem;padding:.2rem .4rem;border-radius:5px;border:1px solid var(--border)">
//            ${['admin','professor','aluno'].map(role=>`<option value="${role}" ${r.role===role?'selected':''}>${role}</option>`).join('')}
//          </select>
//        </td>
//        <td style="font-size:.75rem;color:var(--text3)">${r.ultimo_login ? new Date(r.ultimo_login).toLocaleString('pt-PT') : 'Nunca'}</td>
//        <td><button class="btn-sm danger" onclick="deleteUser(${r.id})">Apagar</button></td>
//      </tr>`).join('')}
//    </table>`;
//  }
//
// ── E ADICIONA ESTAS FUNÇÕES NO FINAL DO FICHEIRO app.js ──────────────────

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