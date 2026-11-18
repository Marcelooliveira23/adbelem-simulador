/* Tesouraria v1.2: contas financeiras (caixa/bancos) com saldo e transferências, orçamento anual
   (previsto x realizado) e exportação para o contador. */
let CONTAS_FIN = [];
async function carregarContasFin() {
  try { CONTAS_FIN = (await api('/tesouraria/contas')).contas; } catch (e) { CONTAS_FIN = []; }
  return CONTAS_FIN;
}

async function abaContasSaldos(el) {
  let r;
  try { r = await api('/tesouraria/saldos'); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  CONTAS_FIN = r.contas;
  const ativas = r.contas.filter(c => c.ativo);
  const podeCriar = pode(PERMS, 'tesouraria', 'criar'), podeExcluir = pode(PERMS, 'tesouraria', 'deletar');
  el.innerHTML = `<div class="note">Cada lançamento pode indicar em qual conta o dinheiro entrou ou saiu (caixa da sede, conta A, conta B…).
      Depósitos do caixa no banco e movimentos entre contas são <b>transferências</b>: não contam como receita nem despesa.
      ${r.lancamentos_sem_conta ? `<br>⚠ ${r.lancamentos_sem_conta} lançamento(s) sem conta definida não entram nos saldos abaixo.` : ''}</div>
    <div class="kpis"><div class="kpi"><b>${formatMoney(r.total)}</b><span>Saldo total das contas</span></div>
      ${ativas.map(c => `<div class="kpi" style="border-left-color:${c.saldo < 0 ? 'var(--red)' : 'var(--vd)'}"><b>${formatMoney(c.saldo)}</b><span>${c.tipo === 'caixa' ? '💵' : '🏦'} ${esc(c.nome)}</span></div>`).join('')}</div>
    ${podeCriar && ativas.length > 1 ? '<div class="row"><button class="btn pri" id="btTransf">🔁 Transferir entre contas</button></div>' : ''}
    <div class="card"><h3>Contas</h3><div id="tContas"></div></div>
    <div class="card"><h3>Transferências</h3>${r.transferencias.length ? `<div class="tw"><table><tr><th>Data</th><th>De</th><th>Para</th><th>Valor</th><th>Descrição</th><th></th></tr>
      ${r.transferencias.map(t => `<tr><td>${formatDate(t.data)}</td><td>${esc(t.origem)}</td><td>${esc(t.destino)}</td><td><b>${formatMoney(t.valor)}</b></td>
        <td>${esc(t.descricao || '')}<br><small style="color:var(--mut)">${esc(t.registrado_por || '')}</small></td>
        <td class="acoes">${podeExcluir ? `<button class="btn sm no" onclick="desfazerTransf(${t.id})">Desfazer</button>` : ''}</td></tr>`).join('')}</table></div>`
      : '<p class="vazio">Nenhuma transferência.</p>'}</div>`;
  document.getElementById('btTransf')?.addEventListener('click', () => abrirFormulario({
    titulo: 'Transferência entre contas', textoBotao: 'Transferir', valores: { data: hojeISO() },
    campos: [{ k: 'origem_id', label: 'De', tipo: 'select', obrig: true, opcoes: ativas.map(c => [c.id, `${c.nome} (${formatMoney(c.saldo)})`]) },
      { k: 'destino_id', label: 'Para', tipo: 'select', obrig: true, opcoes: ativas.map(c => [c.id, c.nome]) },
      { k: 'valor', label: 'Valor (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrig: true }, { k: 'data', label: 'Data', tipo: 'date' },
      { k: 'descricao', label: 'Descrição', full: true, placeholder: 'Ex.: Depósito das ofertas de domingo' }],
    aoSalvar: async d => { const x = await api('/tesouraria/transferencias', { method: 'POST', body: d }); showToast('✓ ' + x.msg); abaContasSaldos(el); },
  }));
  new Tabela({
    el: '#tContas', rota: 'tesouraria/contas', chave: 'contas', modulo: 'tesouraria', rotulo: 'conta', novoLabel: 'Conta',
    colunas: [
      { k: 'nome', label: 'Conta', fmt: (v, c) => `<b>${esc(v)}</b>${c.ativo ? '' : ' <span class="badge">Inativa</span>'}<br><small style="color:var(--mut)">${esc(rotulo(c.tipo))} ${esc([c.banco, c.agencia, c.numero].filter(Boolean).join(' · '))}</small>` },
      { k: 'saldo_inicial', label: 'Saldo inicial', fmt: (v, c) => `${formatMoney(v || 0)}${c.data_saldo_inicial ? `<br><small style="color:var(--mut)">em ${formatDate(c.data_saldo_inicial)}</small>` : ''}` },
      { k: 'id', label: 'Saldo atual', fmt: v => `<b>${formatMoney(r.contas.find(c => c.id === v)?.saldo ?? 0)}</b>` },
    ],
    campos: [{ k: 'nome', label: 'Nome da conta', obrig: true, full: true, placeholder: 'Ex.: Banco do Brasil – Conta A (dízimos)' },
      { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: [['banco', 'Conta bancária'], ['caixa', 'Caixa (dinheiro)'], ['aplicacao', 'Aplicação / poupança']] },
      { k: 'banco', label: 'Banco' }, { k: 'agencia', label: 'Agência' }, { k: 'numero', label: 'Número da conta' },
      { k: 'saldo_inicial', label: 'Saldo inicial (R$)', tipo: 'number', passo: '0.01' }, { k: 'data_saldo_inicial', label: 'Data do saldo inicial', tipo: 'date' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa']], padrao: '1' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' }],
    depoisCarregar: () => {},
  }).carregar();
}
async function desfazerTransf(id) {
  if (!confirm('Desfazer esta transferência?')) return;
  try { await api(`/tesouraria/transferencias/${id}`, { method: 'DELETE' }); showToast('✓ Transferência desfeita'); abaContasSaldos(document.getElementById('contrib')); }
  catch (e) { showToast('❌ ' + e.message); }
}

/* ---------- Orçamento anual ---------- */
let ANO_ORC = new Date().getFullYear();
async function abaOrcamento(el) {
  let o;
  try { o = await api(`/tesouraria/orcamento?ano=${ANO_ORC}`); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeEditar = pode(PERMS, 'tesouraria', 'aprovar');
  const barra = (l, tipo) => {
    if (!l.previsto) return '<small style="color:var(--mut)">sem previsão</small>';
    const pct = Math.min(l.percentual, 150), ruim = tipo === 'despesa' ? l.realizado > l.previsto_ate_hoje * 1.1 : l.realizado < l.previsto_ate_hoje * 0.9;
    return `<div style="background:var(--ln);border-radius:4px;height:8px;width:140px;overflow:hidden"><i style="display:block;height:100%;width:${pct / 1.5}%;background:${ruim ? 'var(--red)' : 'var(--vd)'}"></i></div><small>${l.percentual}% do ano</small>`;
  };
  const bloco = tipo => `<div class="card"><h3>${tipo === 'receita' ? 'Receitas' : 'Despesas'}</h3><div class="tw"><table>
      <tr><th>Conta</th><th style="text-align:right">Previsto no ano</th><th style="text-align:right">Previsto até hoje</th><th style="text-align:right">Realizado</th><th>Execução</th></tr>
      ${o.linhas.filter(l => l.tipo === tipo).map(l => `<tr><td>${esc(l.codigo)} · ${esc(l.nome)}</td>
        <td style="text-align:right">${podeEditar ? `<input type="number" step="0.01" min="0" class="orc" data-tipo="${l.tipo}" data-cat="${esc(l.categoria)}" value="${l.previsto || ''}" style="width:120px;text-align:right">` : formatMoney(l.previsto)}</td>
        <td style="text-align:right">${formatMoney(l.previsto_ate_hoje)}</td><td style="text-align:right"><b>${formatMoney(l.realizado)}</b></td><td>${barra(l, tipo)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td style="text-align:right"><b>${formatMoney(o.totais[tipo].previsto)}</b></td><td style="text-align:right">${formatMoney(o.totais[tipo].previsto_ate_hoje)}</td>
        <td style="text-align:right"><b>${formatMoney(o.totais[tipo].realizado)}</b></td><td></td></tr></table></div></div>`;
  el.innerHTML = `<div class="row"><button class="btn sm" id="orcAnt">‹</button><b>Orçamento ${ANO_ORC}</b><button class="btn sm" id="orcProx">›</button>
      <span style="flex:1"></span>${podeEditar ? `<button class="btn" id="orcCopiar">Gerar a partir de ${ANO_ORC - 1}</button><button class="btn pri" id="orcSalvar">Salvar orçamento</button>` : ''}
      <button class="btn noprint" onclick="window.print()">🖨 Imprimir</button></div>
    <div class="note">Previsto até hoje = previsão anual proporcional aos ${o.meses_decorridos} mês(es) já decorridos. Vermelho: despesa acima ou receita abaixo do previsto.</div>
    <div class="kpis"><div class="kpi"><b>${formatMoney(o.totais.receita.previsto - o.totais.despesa.previsto)}</b><span>Resultado previsto no ano</span></div>
      <div class="kpi"><b>${formatMoney(o.totais.receita.realizado - o.totais.despesa.realizado)}</b><span>Resultado realizado</span></div></div>
    ${bloco('receita')}${bloco('despesa')}`;
  document.getElementById('orcAnt').onclick = () => { ANO_ORC--; abaOrcamento(el); };
  document.getElementById('orcProx').onclick = () => { ANO_ORC++; abaOrcamento(el); };
  document.getElementById('orcSalvar')?.addEventListener('click', async () => {
    const itens = [...el.querySelectorAll('input.orc')].map(i => ({ tipo: i.dataset.tipo, categoria: i.dataset.cat, valor_anual: Number(i.value || 0) }));
    try { const r = await api('/tesouraria/orcamento', { method: 'PUT', body: { ano: ANO_ORC, itens } }); showToast('✓ ' + r.msg); abaOrcamento(el); }
    catch (e) { showToast('❌ ' + e.message); }
  });
  document.getElementById('orcCopiar')?.addEventListener('click', () => abrirFormulario({
    titulo: `Gerar orçamento ${ANO_ORC}`, textoBotao: 'Gerar', valores: { base: 'realizado', reajuste: 5 },
    campos: [{ k: 'base', label: 'Partir de', tipo: 'select', opcoes: [['realizado', `O que foi realizado em ${ANO_ORC - 1}`], ['previsto', `O previsto em ${ANO_ORC - 1}`]] },
      { k: 'reajuste', label: 'Reajuste (%)', tipo: 'number', passo: '0.1' }],
    aoSalvar: async d => { const r = await api('/tesouraria/orcamento/copiar', { method: 'POST', body: { ...d, ano: ANO_ORC } }); showToast('✓ ' + r.msg); abaOrcamento(el); },
  }));
}

/* ---------- Exportação para o contador ---------- */
function exportarContador() {
  const ini = new Date(); ini.setDate(1); ini.setMonth(ini.getMonth() - 1);
  const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
  abrirFormulario({
    titulo: 'Exportar lançamentos para o contador', textoBotao: '⬇ Baixar planilha',
    antes: '<div class="note">Gera uma planilha (abre no Excel) com cada lançamento, código contábil, conta, unidade, fornecedor e conta financeira. Não inclui o nome dos dizimistas.</div>',
    valores: { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) },
    campos: [{ k: 'inicio', label: 'De', tipo: 'date', obrig: true }, { k: 'fim', label: 'Até', tipo: 'date', obrig: true }],
    aoSalvar: async d => {
      const r = await fetch(`${API_URL}/tesouraria/exportar?inicio=${d.inicio}&fim=${d.fim}`, { headers: { Authorization: `Bearer ${Auth.token()}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Falha ao exportar');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: `lancamentos-${d.inicio}-a-${d.fim}.csv` });
      a.click(); URL.revokeObjectURL(a.href); showToast('✓ Planilha baixada');
    },
  });
}
