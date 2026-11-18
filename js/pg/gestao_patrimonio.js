/* Patrimônio · gestão: movimentação de bens (transferência, manutenção, empréstimo, retorno, baixa)
   e inventário com conferência física item a item. */
const TIPOS_MOV = [['transferencia', '🔁 Transferência de unidade/local'], ['manutencao', '🔧 Enviar para manutenção'],
  ['emprestimo', '🤝 Empréstimo'], ['retorno', '↩️ Retorno (de manutenção ou empréstimo)'], ['baixa', '⛔ Baixa (perda, furto, descarte, doação)']];
const corMov = { transferencia: 'b-info', manutencao: 'b-pend', emprestimo: 'b-pend', retorno: 'b-ok', baixa: 'b-dev' };

function formMovimentar(bem, aoTerminar) {
  const tipos = TIPOS_MOV.filter(([t]) => t !== 'retorno' || ['manutencao', 'emprestado'].includes(bem.status));
  const box = abrirFormulario({
    titulo: `Movimentar: ${bem.nome}`, textoBotao: 'Registrar',
    antes: `<div class="note">Hoje: <b>${esc(nomeUnidade(bem.congregacao_id))}</b> · ${esc(bem.local || '-')} · ${esc(rotulo(bem.status))}</div>`,
    valores: { data: hojeISO(), tipo: 'transferencia' },
    campos: [
      { k: 'tipo', label: 'Movimentação', tipo: 'select', opcoes: tipos, obrig: true, full: true },
      { k: 'data', label: 'Data', tipo: 'date', obrig: true },
      { k: 'destino_congregacao_id', label: 'Nova unidade (transferência)', tipo: 'unidade' },
      { k: 'destino_local', label: 'Novo local (sala, templo…)' },
      { k: 'responsavel', label: 'Responsável / com quem ficou' },
      { k: 'prestador', label: 'Prestador do serviço (manutenção)' },
      { k: 'valor', label: 'Custo (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'motivo', label: 'Motivo / descrição', tipo: 'textarea' },
    ],
    aoSalvar: async d => {
      const r = await api(`/patrimonio/${bem.id}/movimentos`, { method: 'POST', body: d });
      showToast('✓ ' + r.msg); aoTerminar?.();
    },
  });
  // mostra só os campos que fazem sentido para o tipo escolhido
  const sel = box.querySelector('[name=tipo]');
  const mostrar = () => {
    const t = sel.value, vis = {
      destino_congregacao_id: t === 'transferencia', destino_local: t === 'transferencia',
      prestador: t === 'manutencao', valor: t === 'manutencao', responsavel: t !== 'baixa',
    };
    Object.entries(vis).forEach(([k, v]) => { box.querySelector(`[name=${k}]`).closest('div').hidden = !v; });
  };
  sel.addEventListener('change', mostrar); mostrar();
}

function tabelaMovimentos(movs, comBem = true) {
  if (!movs.length) return '<p class="vazio">Nenhuma movimentação registrada.</p>';
  return `<div class="tw"><table><tr><th>Data</th>${comBem ? '<th>Bem</th>' : ''}<th>Movimentação</th><th>De</th><th>Para / detalhes</th><th>Registrado por</th></tr>
    ${movs.map(m => `<tr><td>${formatDate(m.data)}</td>${comBem ? `<td><b>${esc(m.bem)}</b>${m.tombo ? `<br><small style="color:var(--mut)">${esc(m.tombo)}</small>` : ''}</td>` : ''}
      <td><span class="badge ${corMov[m.tipo] || ''}">${esc(rotulo(m.tipo))}</span></td><td>${esc(m.origem || '-')}</td>
      <td>${[m.tipo === 'transferencia' ? `${m.destino_nome || 'Sede'}${m.destino_local ? ' · ' + m.destino_local : ''}` : '',
        m.responsavel && `Responsável: ${m.responsavel}`, m.prestador && `Prestador: ${m.prestador}`, m.valor ? `Custo: ${formatMoney(m.valor)}` : '', m.motivo]
        .filter(Boolean).map(esc).join('<br>') || '-'}</td><td>${esc(m.registrado_por || '-')}</td></tr>`).join('')}</table></div>`;
}

async function historicoBem(bem) {
  try {
    const { movimentos } = await api(`/patrimonio/movimentos?patrimonio_id=${bem.id}`);
    abrirModal(`<h2>Histórico: ${esc(bem.nome)}</h2>
      <p style="font-size:13px;color:var(--mut)">Tombo ${esc(bem.tombo || '-')} · aquisição ${formatDate(bem.data_aquisicao)} · ${formatMoney(bem.valor || 0)}</p>
      ${tabelaMovimentos(movimentos, false)}<div class="acoes-form"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  } catch (e) { showToast('❌ ' + e.message); }
}

async function abaMovimentacoes(el) {
  try {
    const { movimentos } = await api('/patrimonio/movimentos');
    el.innerHTML = `<div class="note">Toda transferência entre unidades, ida para manutenção, empréstimo, retorno e baixa fica registrada aqui.
      Para movimentar, use o botão "Movimentar" na lista de bens.</div><div class="card"><h3>Últimas movimentações</h3>${tabelaMovimentos(movimentos)}</div>`;
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; }
}

/* ---------- Inventário ---------- */
async function abaInventario(el) {
  let invs = [];
  try { invs = (await api('/patrimonio/inventarios')).inventarios; } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeAbrir = pode(PERMS, 'patrimonio', 'criar');
  el.innerHTML = `<div class="note">O inventário lista todos os bens ativos para a conferência física (recomendado uma vez por ano e na troca de responsável).
      Marque cada bem como encontrado, não encontrado ou danificado; pode ser feito pelo celular, andando pelo templo.</div>
    ${podeAbrir ? '<div class="row"><button class="btn pri" id="btInv">+ Abrir inventário</button></div>' : ''}
    ${invs.length ? `<div class="tw"><table><tr><th>Inventário</th><th>Abrangência</th><th>Progresso</th><th>Situação</th><th></th></tr>
      ${invs.map(i => `<tr><td><b>${esc(i.titulo)}</b><br><small style="color:var(--mut)">${esc(i.criado_por || '')} · ${formatDate(i.criado_em)}</small></td>
        <td>${i.congregacao_id === null ? 'Todas as unidades' : esc(nomeUnidade(i.congregacao_id || null))}</td>
        <td>${i.conferidos}/${i.itens} conferidos${i.nao_encontrados ? `<br><span class="badge b-dev">${i.nao_encontrados} não encontrado(s)</span>` : ''}</td>
        <td><span class="badge ${i.status === 'concluido' ? 'b-ok' : 'b-pend'}">${rotulo(i.status)}</span></td>
        <td class="acoes"><button class="btn sm pri" onclick="abrirInventario(${i.id})">${i.status === 'aberto' ? 'Conferir' : 'Ver'}</button>
          ${i.status === 'aberto' && pode(PERMS, 'patrimonio', 'deletar') ? `<button class="btn sm no" onclick="excluirInventario(${i.id})">Excluir</button>` : ''}</td></tr>`).join('')}
    </table></div>` : '<p class="vazio">Nenhum inventário ainda.</p>'}<div id="invDet"></div>`;
  document.getElementById('btInv')?.addEventListener('click', () => abrirFormulario({
    titulo: 'Abrir inventário', textoBotao: 'Abrir', valores: { titulo: `Inventário ${new Date().getFullYear()}`, unidade: 'todas' },
    campos: [{ k: 'titulo', label: 'Título', obrig: true, full: true },
      { k: 'unidade', label: 'Bens de', tipo: 'select', opcoes: [['todas', 'Todas as unidades'], ['sede', 'Somente a Sede'], ..._unidades.unidades.map(u => [u.id, u.nome])] },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' }],
    aoSalvar: async d => {
      const r = await api('/patrimonio/inventarios', { method: 'POST', body: d });
      showToast('✓ ' + r.msg); await abaInventario(el); abrirInventario(r.id);
    },
  }));
}
async function excluirInventario(id) {
  if (!confirm('Excluir este inventário em aberto?')) return;
  try { await api(`/patrimonio/inventarios/${id}`, { method: 'DELETE' }); showToast('✓ Excluído'); abaInventario(document.getElementById('conteudo')); }
  catch (e) { showToast('❌ ' + e.message); }
}

async function abrirInventario(id) {
  const det = document.getElementById('invDet');
  let r;
  try { r = await api(`/patrimonio/inventarios/${id}`); } catch (e) { showToast('❌ ' + e.message); return; }
  const { inventario: inv, itens } = r;
  const aberto = inv.status === 'aberto' && pode(PERMS, 'patrimonio', 'editar');
  const cont = s => itens.filter(i => i.situacao === s).length;
  const botoes = it => [['encontrado', '✓', 'ok'], ['danificado', '⚠', ''], ['nao_encontrado', '✗', 'no']].map(([s, ic, cls]) =>
    `<button class="btn sm ${it.situacao === s ? cls || 'pri' : ''}" title="${rotulo(s)}" onclick="conferirItem(${id},${it.id},'${s}')">${ic} ${rotulo(s)}</button>`).join(' ');
  det.innerHTML = `<div class="card" style="margin-top:14px"><h3>${esc(inv.titulo)} <span class="badge ${aberto ? 'b-pend' : 'b-ok'}">${rotulo(inv.status)}</span></h3>
    <div class="kpis"><div class="kpi"><b>${itens.length - cont('pendente')}/${itens.length}</b><span>Conferidos</span></div>
      <div class="kpi"><b>${cont('encontrado')}</b><span>Encontrados</span></div><div class="kpi"><b>${cont('danificado')}</b><span>Danificados</span></div>
      <div class="kpi" style="border-left-color:var(--red)"><b>${cont('nao_encontrado')}</b><span>Não encontrados</span></div></div>
    <div class="row noprint"><input type="search" id="invBusca" placeholder="Buscar bem, tombo ou local" style="flex:1">
      <select id="invFiltro"><option value="">Todos</option><option value="pendente">Só os pendentes</option><option value="nao_encontrado">Não encontrados</option><option value="danificado">Danificados</option></select>
      <button class="btn" onclick="window.print()">🖨 Imprimir</button>
      ${aberto ? `<button class="btn pri" onclick="concluirInventario(${id})">Concluir inventário</button>` : ''}</div>
    <div class="tw"><table id="invTab"><tr><th>Bem</th><th>Unidade / local</th><th>Situação</th>${aberto ? '<th class="noprint">Conferência</th>' : ''}</tr>
      ${itens.map(it => `<tr data-sit="${it.situacao}" class="${it.situacao === 'nao_encontrado' ? 'dev' : it.situacao === 'danificado' ? 'pend' : ''}">
        <td><b>${esc(it.bem)}</b><br><small style="color:var(--mut)">${esc(it.tombo || 'sem tombo')} · ${esc(rotulo(it.categoria))}</small></td>
        <td>${esc(it.unidade)}<br><small style="color:var(--mut)">${esc(it.local || '-')}</small></td>
        <td>${esc(rotulo(it.situacao))}${it.conferido_por ? `<br><small style="color:var(--mut)">${esc(it.conferido_por)}</small>` : ''}${it.observacao ? `<br><small>${esc(it.observacao)}</small>` : ''}</td>
        ${aberto ? `<td class="acoes noprint">${botoes(it)}</td>` : ''}</tr>`).join('')}</table></div></div>`;
  const filtrar = () => {
    const q = document.getElementById('invBusca').value.toLowerCase(), f = document.getElementById('invFiltro').value;
    document.querySelectorAll('#invTab tr[data-sit]').forEach(tr => { tr.hidden = (q && !tr.textContent.toLowerCase().includes(q)) || (f && tr.dataset.sit !== f); });
  };
  document.getElementById('invBusca').addEventListener('input', filtrar);
  document.getElementById('invFiltro').addEventListener('change', filtrar);
  det.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function conferirItem(inv, item, situacao) {
  let observacao = '';
  if (situacao !== 'encontrado') observacao = prompt(situacao === 'danificado' ? 'Descreva o dano:' : 'Observação (onde foi visto por último, quem sabe…):') ?? '';
  try {
    await api(`/patrimonio/inventarios/${inv}/itens/${item}`, { method: 'PATCH', body: { situacao, observacao } });
    const y = window.scrollY; await abrirInventario(inv); window.scrollTo(0, y);
  } catch (e) { showToast('❌ ' + e.message); }
}
async function concluirInventario(id) {
  if (!confirm('Concluir o inventário? Depois disso a conferência não pode mais ser alterada.')) return;
  try {
    const r = await api(`/patrimonio/inventarios/${id}/concluir`, { method: 'POST' });
    showToast('✓ ' + r.msg + '. Bens não encontrados: registre a baixa em "Movimentar".');
    await abaInventario(document.getElementById('conteudo')); abrirInventario(id);
  } catch (e) { showToast('❌ ' + e.message); }
}
