/* Financeiro > Congregações (acertos): pendências, acertos de contas, recebimentos e débitos */
const SELO_ACERTO = { enviado: ['b-pend', 'A receber'], recebido: ['b-ok', 'Recebido'], divergente: ['b-dev', 'Divergente'] };
let _PEND = [], _ACERTOS = [], _DEBITOS = [];

async function abaAcertos(el) {
  try {
    const [p, a, d] = await Promise.all([api('/acertos/pendentes'), api('/acertos'), api('/congregacoes/debitos?status=aberto')]);
    _PEND = p.congregacoes; _ACERTOS = a.acertos; _DEBITOS = d.debitos;
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeLancar = pode(PERMS, 'tesouraria', 'criar'), podeReceber = pode(PERMS, 'tesouraria', 'aprovar');
  const pendentes = _PEND.filter(c => c.pendente), aReceber = _ACERTOS.filter(a => a.status === 'enviado');
  el.innerHTML = `<div class="note">Cada congregação presta contas do período (semanal ou mensal): arrecadado − despesas locais + débitos com a sede
      (ex.: revistas) = valor a repassar. Ao receber, a Tesouraria lança tudo com a congregação identificada.</div>
    <div class="kpis"><div class="kpi" style="border-left-color:${pendentes.length ? 'var(--red)' : 'var(--vd)'}"><b>${pendentes.length}</b><span>Congregações com acerto pendente</span></div>
      <div class="kpi"><b>${aReceber.length}</b><span>Acertos a receber · ${formatMoney(aReceber.reduce((s, a) => s + a.valor_repasse, 0))}</span></div>
      <div class="kpi"><b>${formatMoney(_DEBITOS.reduce((s, x) => s + x.valor, 0))}</b><span>Débitos em aberto das congregações</span></div></div>
    <div class="card"><h3>Situação das congregações</h3><div class="tw"><table>
      <tr><th>Congregação</th><th>Acerto</th><th>Último período</th><th>Situação</th><th>Débitos</th><th></th></tr>
      ${_PEND.map(c => `<tr class="${c.pendente ? 'pend' : ''}"><td><b>${esc(c.nome)}</b><br><small style="color:var(--mut)">${esc(c.dirigente || '')}</small></td>
        <td>${rotulo(c.periodicidade)}</td><td>${c.ultimo_fim ? 'até ' + formatDate(c.ultimo_fim) : 'nenhum'}</td>
        <td>${c.pendente ? `<span class="badge b-dev">Pendente · ${c.dias_atraso} dia(s)</span><br><small>esperado até ${formatDate(c.periodo_esperado_ate)}</small>` : '<span class="badge b-ok">Em dia</span>'}
          ${c.a_receber ? '<br><span class="badge b-pend">acerto a receber</span>' : ''}</td>
        <td>${c.debitos_abertos ? formatMoney(c.debitos_abertos) : '-'}</td>
        <td class="acoes">${podeLancar ? `<button class="btn sm pri" onclick="formAcerto(${c.id})">Registrar acerto</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="6" class="vazio">Nenhuma congregação ativa. Cadastre em 2 · Secretaria › Congregações.</td></tr>'}
    </table></div></div>
    <div class="card"><h3>Acertos registrados</h3>${_ACERTOS.length ? `<div class="tw"><table>
      <tr><th>Congregação</th><th>Período</th><th>Arrecadado</th><th>Despesas locais</th><th>Débitos</th><th>A repassar</th><th>Recebido</th><th>Situação</th><th></th></tr>
      ${_ACERTOS.map(a => { const arr = a.dizimos + a.ofertas + a.ofertas_alcadas + a.missoes + a.outras; const [cls, txt] = SELO_ACERTO[a.status];
        return `<tr><td>${esc(a.congregacao_nome)}</td><td>${formatDate(a.periodo_inicio)} a ${formatDate(a.periodo_fim)}</td><td>${formatMoney(arr)}</td>
        <td>${formatMoney(a.despesas_locais)}</td><td>${formatMoney(a.debitos)}</td><td><b>${formatMoney(a.valor_repasse)}</b></td>
        <td>${a.valor_recebido != null ? `${formatMoney(a.valor_recebido)}<br><small>${rotulo(a.forma)} · ${formatDate(a.data_recebimento)}</small>` : '-'}</td>
        <td><span class="badge ${cls}">${txt}</span></td>
        <td class="acoes">${a.status === 'enviado' && podeReceber ? `<button class="btn sm ok" onclick="receberAcerto(${a.id})">Receber</button>` : ''}
          ${a.status === 'enviado' && podeLancar ? `<button class="btn sm no" onclick="excluirAcerto(${a.id})">Excluir</button>` : ''}</td></tr>`; }).join('')}
    </table></div>` : '<p class="vazio">Nenhum acerto registrado.</p>'}</div>
    <div class="card"><h3>Débitos das congregações com a sede</h3>
      ${podeLancar ? '<div class="row"><button class="btn" onclick="formDebito()">+ Débito</button></div>' : ''}
      ${_DEBITOS.length ? `<div class="tw"><table><tr><th>Congregação</th><th>Descrição</th><th>Valor</th><th>Lançado em</th></tr>
        ${_DEBITOS.map(x => `<tr><td>${esc(x.congregacao_nome)}</td><td>${esc(x.descricao)}</td><td>${formatMoney(x.valor)}</td><td>${formatDate(x.criado_em)}</td></tr>`).join('')}
      </table></div>` : '<p class="vazio">Nenhum débito em aberto.</p>'}</div>`;
}

function formAcerto(congId) {
  const c = _PEND.find(x => x.id === congId);
  const debs = _DEBITOS.filter(d => d.congregacao_id === congId);
  const ini = c.ultimo_fim ? (() => { const d = new Date(c.ultimo_fim + 'T12:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() : '';
  const box = abrirModal(`<h2>Acerto de contas · ${esc(c.nome)}</h2><form id="fAc"><div class="form-grid">
    <div><label class="l">Período: início *</label><input type="date" name="periodo_inicio" required value="${ini}"></div>
    <div><label class="l">Período: fim *</label><input type="date" name="periodo_fim" required value="${c.periodo_esperado_ate}"></div>
    ${[['dizimos', 'Dízimos'], ['ofertas', 'Ofertas'], ['ofertas_alcadas', 'Ofertas alçadas'], ['missoes', 'Missões / campanhas'], ['outras', 'Outras entradas'],
      ['despesas_locais', 'Despesas locais autorizadas (−)']].map(([k, l]) =>
      `<div><label class="l">${l} (R$)</label><input type="number" step="0.01" min="0" name="${k}" value="0"></div>`).join('')}
    <div class="full"><label class="l">Observações</label><textarea name="observacoes" placeholder="Ex.: comprovantes das despesas entregues"></textarea></div></div>
    ${debs.length ? `<label class="l">Débitos a cobrar neste acerto (+)</label>${debs.map(d => `<label style="display:block;margin:4px 0">
      <input type="checkbox" name="deb" value="${d.id}" data-v="${d.valor}" checked> ${esc(d.descricao)} · ${formatMoney(d.valor)}</label>`).join('')}` : ''}
    <div class="note" style="margin-top:10px">Valor a repassar à sede: <b id="vRep">R$ 0,00</b></div>
    <div class="acoes-form"><button class="btn pri">Registrar acerto</button><button type="button" class="btn" onclick="fecharModal()">Cancelar</button></div></form>`);
  const f = box.querySelector('#fAc');
  const calc = () => {
    const n = k => +f[k].value || 0;
    const deb = [...f.querySelectorAll('[name=deb]:checked')].reduce((s, x) => s + +x.dataset.v, 0);
    box.querySelector('#vRep').textContent = formatMoney(n('dizimos') + n('ofertas') + n('ofertas_alcadas') + n('missoes') + n('outras') - n('despesas_locais') + deb);
  };
  f.addEventListener('input', calc); calc();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f)); delete body.deb;
    body.congregacao_id = congId;
    body.debitos = [...f.querySelectorAll('[name=deb]:checked')].map(x => x.value);
    try { const r = await api('/acertos', { method: 'POST', body }); showToast('✓ ' + r.msg); fecharModal(); abaAcertos(document.getElementById('contrib')); }
    catch (err) { showToast('❌ ' + err.message); }
  });
}

async function receberAcerto(id) {
  const a = _ACERTOS.find(x => x.id === id);
  let movs = [];
  try { movs = (await api('/banco/movimentos?dias=60')).movimentos.filter(m => !m.acerto_id); } catch (e) { movs = []; }
  const sugeridos = movs.filter(m => Math.abs(m.valor - a.valor_repasse) < 0.01);
  abrirFormulario({
    titulo: `Receber acerto · ${a.congregacao_nome}`, textoBotao: 'Confirmar recebimento',
    antes: `<div class="note">Valor a repassar: <b>${formatMoney(a.valor_repasse)}</b>. Se o dinheiro chegou por PIX ou depósito já registrado pelo banco,
      escolha-o abaixo: ele é vinculado ao acerto e não é lançado em dobro.</div>`,
    valores: { valor_recebido: a.valor_repasse, data: hojeISO(), banco_movimento_id: sugeridos[0]?.id || '' },
    campos: [
      { k: 'banco_movimento_id', label: 'Veio por PIX/depósito já registrado?', tipo: 'select', full: true,
        opcoes: [['', 'Não: recebido em mãos, depósito ou transferência'], ...movs.slice(0, 40).map(m => [m.id,
          `${formatDate((m.horario || '').slice(0, 10))} · ${formatMoney(m.valor)} · ${m.pagador_nome || 'pagador não identificado'} (${m.conta_apelido})${Math.abs(m.valor - a.valor_repasse) < 0.01 ? ' ✓ mesmo valor' : ''}`])] },
      { k: 'valor_recebido', label: 'Valor recebido (R$)', tipo: 'number', passo: '0.01', min: 0, ajuda: 'Ignorado se escolher um PIX acima' },
      { k: 'forma', label: 'Forma', tipo: 'select', opcoes: [['dinheiro', 'Dinheiro'], ['deposito', 'Depósito'], ['transferencia', 'Transferência'], ['pix', 'PIX']] },
      { k: 'data', label: 'Data do recebimento', tipo: 'date' },
    ],
    aoSalvar: async d => { const r = await api(`/acertos/${id}/receber`, { method: 'POST', body: d }); showToast((r.status === 'recebido' ? '✓ ' : '⚠ ') + r.msg); abaAcertos(document.getElementById('contrib')); tabela.carregar(); },
  });
}
async function excluirAcerto(id) {
  if (!confirm('Excluir este acerto (ainda não recebido)?')) return;
  try { await api(`/acertos/${id}`, { method: 'DELETE' }); showToast('✓ Acerto excluído'); abaAcertos(document.getElementById('contrib')); }
  catch (e) { showToast('❌ ' + e.message); }
}
function formDebito() {
  abrirFormulario({
    titulo: 'Débito de congregação com a sede',
    campos: [{ k: 'congregacao_id', label: 'Congregação', tipo: 'select', obrig: true, opcoes: _PEND.map(c => [c.id, c.nome]) },
      { k: 'valor', label: 'Valor (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrig: true },
      { k: 'descricao', label: 'Descrição', obrig: true, full: true, placeholder: 'Ex.: Revistas EBD 1º trim. / material de limpeza' }],
    aoSalvar: async d => { const r = await api('/congregacoes/debitos', { method: 'POST', body: d }); showToast('✓ ' + r.msg); abaAcertos(document.getElementById('contrib')); },
  });
}
