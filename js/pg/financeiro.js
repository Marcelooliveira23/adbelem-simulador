/* 1 · Tesouraria: receitas e despesas da sede e das congregações, com "de acordo" da Tesouraria */
const main = document.getElementById('main');
const CAT_REC = ['dizimo', 'oferta', 'oferta_alcada', 'campanha', 'evento', 'outro'];
const CAT_DESP = ['manutencao', 'salario', 'agua_luz', 'aluguel', 'material_ebd', 'material', 'acao_social', 'missoes', 'evento', 'outro'];
const FORMAS = ['dinheiro', 'pix', 'transferencia', 'cartao'];
let tabela, UNIDADE = '', MEMBROS = [], CAMPANHAS = [];

function camposLanc(tipo) {
  return [
    { k: 'descricao', label: 'Descrição', obrig: true, full: true, placeholder: tipo === 'receita' ? 'Ex.: Dízimos do culto de domingo' : 'Ex.: Conta de energia' },
    { k: 'valor', label: 'Valor (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrig: true },
    { k: 'data', label: 'Data', tipo: 'date', obrig: true, padrao: hojeISO() },
    { k: 'categoria', label: 'Conta (plano de contas)', tipo: 'select', opcoes: PLANO.length ? opcoesPlano(tipo) : ops(tipo === 'receita' ? CAT_REC : CAT_DESP), obrig: true, full: true },
    { k: 'forma', label: 'Forma', tipo: 'select', opcoes: ops(FORMAS) },
    ...(CONTAS_FIN.filter(c => c.ativo).length ? [{ k: 'conta_id', label: tipo === 'receita' ? 'Entrou na conta' : 'Saiu da conta', tipo: 'select',
      vazio: '—', opcoes: CONTAS_FIN.filter(c => c.ativo).map(c => [c.id, c.nome]) }] : []),
    ...(tipo === 'receita' && MEMBROS.length ? [{ k: 'membro_id', label: 'Contribuinte (dízimo identificado)', tipo: 'select',
      vazio: 'Não identificado', opcoes: MEMBROS.map(m => [m.id, m.nome]), full: true,
      ajuda: 'Só a Tesouraria vê quem contribuiu; os demais veem apenas os totais.' }] : []),
    { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
    ...(CAMPANHAS.length ? [{ k: 'campanha_id', label: tipo === 'receita' ? 'Campanha / fundo (opcional)' : 'Pagar com o fundo de uma campanha (opcional)',
      tipo: 'select', vazio: 'Nenhuma (caixa geral)', opcoes: CAMPANHAS.filter(c => c.ativo).map(c => [c.id, `${c.nome} · saldo ${formatMoney(c.saldo)}`]), full: true }] : []),
    ...(tipo === 'despesa' ? [
      { k: 'fornecedor_id', label: 'Fornecedor', tipo: 'select', vazio: '—', opcoes: FORNECEDORES.filter(f => f.ativo).map(f => [f.id, f.nome]) },
      { k: 'documento', label: 'Nº da nota / boleto' },
      { k: 'vencimento', label: 'Vencimento', tipo: 'date' },
      { k: 'status', label: 'Pagamento', tipo: 'select', opcoes: ops(['pendente', 'pago']) }] : []),
  ].filter(c => !(c.tipo === 'unidade' && _unidades.escopo));
}

async function novoLancamento(tipo) {
  try { CAMPANHAS = (await api('/tesouraria/campanhas/resumo')).campanhas; } catch (e) { CAMPANHAS = []; }
  abrirFormulario({
    titulo: tipo === 'receita' ? 'Nova receita (entrada)' : 'Nova despesa (saída)', campos: camposLanc(tipo),
    valores: { congregacao_id: UNIDADE === 'sede' ? '' : UNIDADE },
    antes: _unidades.escopo ? '<div class="note">O lançamento vai para o "de acordo" da Tesouraria da sede antes de entrar nos totais.</div>' : '',
    aoSalvar: async d => {
      const r = await api(`/financeiro/${tipo === 'receita' ? 'receitas' : 'despesas'}`, { method: 'POST', body: d });
      showToast('✓ ' + r.msg);
      tabela.carregar();
    },
  });
}

async function alternarPagamento(id, status) {
  try { await api(`/financeiro/${id}/status`, { method: 'PATCH', body: { status } }); showToast(status === 'pago' ? '✓ Despesa paga' : '✓ Despesa pendente'); tabela.carregar(); }
  catch (e) { showToast('❌ ' + e.message); }
}

(async () => {
  window.PERMS = await iniciarLayout('tesouraria');
  if (!PERMS) return;
  const u = await carregarUnidades();
  try { MEMBROS = (await api('/membros')).membros.filter(m => (m.aprovacao || 'aprovado') === 'aprovado'); } catch (e) { MEMBROS = []; }
  await Promise.all([carregarPlano(), carregarFornecedores(), carregarContasFin()]);
  const podeLancar = pode(PERMS, 'tesouraria', 'criar'), podeEditar = pode(PERMS, 'tesouraria', 'editar');
  main.innerHTML = `<div class="ph"><h1>Financeiro</h1><span class="sp"></span>
      ${podeLancar ? '<button class="btn pri" onclick="novoLancamento(\'receita\')">+ Receita</button> <button class="btn" style="color:var(--red);border-color:var(--red)" onclick="novoLancamento(\'despesa\')">+ Despesa</button>' : ''}</div>
    ${u.escopo ? `<div class="note">Você lança só para a ${esc(nomeUnidade(u.escopo))}. A sede confere e dá o "de acordo"; só então o valor entra nos totais.</div>` : ''}
    ${podeLancar ? '' : '<div class="note">Seu perfil consulta a tesouraria, sem lançar.</div>'}
    ${u.escopo ? '' : `<div class="row"><label style="font-size:13px;color:var(--mut)">Unidade:</label><select id="selUn"><option value="">Todas (sede + congregações)</option>
      <option value="sede">Somente a Sede</option>${u.unidades.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div>`}
    <div class="kpis" id="kpis"></div><div class="tabs" id="abas"></div><div id="t"></div>`;

  // A tabela usa só excluir e "de acordo"; lançar é pelos botões acima (receita/despesa têm campos diferentes)
  const permsTabela = { permissoes: PERMS.permissoes.filter(p => p.modulo === 'tesouraria' && ['deletar', 'aprovar'].includes(p.acao)) };
  let filtroAba = () => true;
  tabela = new Tabela({
    el: '#t', rota: 'financeiro', chave: 'transacoes', modulo: 'tesouraria', perms: permsTabela, aprovacao: true,
    busca: ['descricao', 'congregacao_nome'], params: () => ({ congregacao_id: UNIDADE }),
    filtros: [{ k: 'categoria', label: 'Todas as contas', opcoes: () => PLANO.length ? PLANO.map(c => [c.chave, `${c.codigo} · ${c.nome}`]) : ops([...new Set([...CAT_REC, ...CAT_DESP])]) }],
    colunas: [
      { k: 'data', label: 'Data', fmt: v => formatDate(v) },
      { k: 'descricao', label: 'Descrição', fmt: (v, r) => esc(v) + (r.contribuinte ? `<br><small style="color:var(--mut)">👤 ${esc(r.contribuinte)}</small>` : '')
        + (r.campanha_nome ? `<br><small style="color:var(--mut)">🎯 ${esc(r.campanha_nome)}</small>` : '')
        + (r.fornecedor_nome ? `<br><small style="color:var(--mut)">🏢 ${esc(r.fornecedor_nome)}${r.documento ? ' · doc. ' + esc(r.documento) : ''}</small>` : '') },
      { k: 'congregacao_nome', label: 'Unidade', fmt: v => esc(v || 'Sede') },
      { k: 'categoria', label: 'Categoria', fmt: (v, r) => `${rotulo(v)}<br><small style="color:var(--mut)">${rotulo(r.forma || 'dinheiro')}</small>` },
      { k: 'valor', label: 'Valor', fmt: (v, r) => `<b style="color:${r.tipo === 'receita' ? 'var(--vd)' : 'var(--red)'}">${r.tipo === 'receita' ? '+' : '−'} ${formatMoney(v)}</b>` },
      { k: 'status', label: 'Pagamento', fmt: (v, r) => r.tipo !== 'despesa' ? '-' : `<span class="badge ${v === 'pago' ? 'b-ok' : 'b-pend'}">${rotulo(v)}</span>` },
    ],
    acoesExtras: r => r.tipo === 'despesa' && podeEditar && (r.aprovacao || 'aprovado') === 'aprovado'
      ? `<button class="btn sm" onclick="alternarPagamento(${r.id},'${r.status === 'pago' ? 'pendente' : 'pago'}')">${r.status === 'pago' ? 'Marcar pendente' : 'Marcar pago'}</button>`
      : r.tipo === 'receita' && (r.aprovacao || 'aprovado') === 'aprovado'
        ? `<button class="btn sm" title="Recibo para o contribuinte" onclick="imprimirRecibo(tabela.dados.find(x => x.id === ${r.id}))">🧾 Recibo</button>` : '',
    depoisCarregar: (d, resp) => {
      document.getElementById('kpis').innerHTML = `
        <div class="kpi"><b>${formatMoney(resp.saldo_total)}</b><span>Saldo (com de acordo)</span></div>
        <div class="kpi"><b style="color:var(--vd)">${formatMoney(resp.total_receita)}</b><span>Receitas</span></div>
        <div class="kpi"><b style="color:var(--red)">${formatMoney(resp.total_despesa)}</b><span>Despesas</span></div>
        <div class="kpi"><b>${formatMoney(resp.total_dizimos)}</b><span>Dízimos</span></div>
        <div class="kpi"><b>${resp.pendentes_aprovacao}</b><span>Aguardando de acordo</span></div>`;
      d.splice(0, d.length, ...d.filter(filtroAba));
    },
  });
  document.getElementById('selUn')?.addEventListener('change', e => { UNIDADE = e.target.value; tabela.carregar(); });
  const abas = [{ k: 'todos', n: 'Todos os lançamentos' }, { k: 'receita', n: 'Receitas' }, { k: 'despesa', n: 'Despesas' }];
  if (pode(PERMS, 'tesouraria', 'aprovar') || u.escopo) abas.push({ k: 'fila', n: u.escopo ? 'Pendentes e devolvidos' : 'Fila do de acordo' });
  abas.push({ k: 'banco', n: '🏦 Banco do Brasil' }, { k: 'acertos', n: 'Congregações (acertos)' }, { k: 'caixa', n: 'Caixa diário' }, { k: 'camp', n: 'Campanhas' });
  if (pode(PERMS, 'compras', 'aprovar')) abas.push({ k: 'compras', n: 'Compras a aprovar' });
  if (pode(PERMS, 'tesouraria', 'editar')) abas.push({ k: 'conc', n: 'Conciliação bancária' });
  abas.push({ k: 'pagar', n: 'Contas a pagar' }, { k: 'saldos', n: '💵 Contas e saldos' }, { k: 'orc', n: 'Orçamento' }, { k: 'fech', n: '📊 Fechamento do mês' });
  if (pode(PERMS, 'tesouraria', 'contribuintes')) abas.push({ k: 'contrib', n: 'Contribuintes' });
  abas.push({ k: 'docsed', n: '📝 Documentos (Word/PDF)' }, { k: 'func', n: '👔 Funcionários e prestadores' }, { k: 'forn', n: 'Fornecedores' }, { k: 'plano', n: 'Plano de contas' });
  document.getElementById('t').insertAdjacentHTML('afterend', '<div id="contrib" hidden></div>');
  // Abas com conteúdo próprio (as demais filtram a tabela de lançamentos)
  const ESPECIAIS = { docsed: e => abaDocsEditaveis(e, 'tesouraria'), func: abaFuncionarios, saldos: abaContasSaldos, orc: abaOrcamento, pagar: abaContasPagar, fech: abaFechamento, forn: abaFornecedores, plano: abaPlanoContas, contrib: abaContribuintes, caixa: abaCaixa, camp: abaCampanhas, conc: abaConciliacao, banco: abaBanco, acertos: abaAcertos, compras: el => abaCompras(el, 'aprovar') };
  montarAbas(document.getElementById('abas'), abas, aba => {
    document.getElementById('t').hidden = aba in ESPECIAIS;
    document.getElementById('contrib').hidden = !(aba in ESPECIAIS);
    if (aba in ESPECIAIS) { ESPECIAIS[aba](document.getElementById('contrib')); return; }
    filtroAba = { todos: () => true, receita: t => t.tipo === 'receita', despesa: t => t.tipo === 'despesa',
      fila: t => ['pendente', 'devolvido'].includes(t.aprovacao) }[aba];
    tabela.carregar();
  });
})();

/* ---------- Contribuintes (só Tesouraria): totais por pessoa e informe anual ---------- */
let ANO_CONTRIB = new Date().getFullYear(), CONTRIB = [];
async function abaContribuintes() {
  const el = document.getElementById('contrib');
  try { CONTRIB = (await api(`/financeiro/contribuintes?ano=${ANO_CONTRIB}`)).contribuintes; } catch (e) { showToast('❌ ' + e.message); CONTRIB = []; }
  el.innerHTML = `<div class="note">🔒 Informação sigilosa: somente a Tesouraria vê esta aba. Considera só receitas com "de acordo" e contribuinte identificado.</div>
    <div class="row"><button class="btn sm" onclick="ANO_CONTRIB--;abaContribuintes()">‹</button><b>${ANO_CONTRIB}</b>
    <button class="btn sm" onclick="ANO_CONTRIB++;abaContribuintes()">›</button></div>
    ${CONTRIB.length ? `<div class="tw"><table><tr><th>Contribuinte</th><th>Unidade</th><th>Dízimos</th><th>Outras contribuições</th><th>Último</th><th></th></tr>
    ${CONTRIB.map(c => `<tr><td>${esc(c.nome)}</td><td>${esc(c.congregacao_nome || 'Sede')}</td><td>${formatMoney(c.dizimos)}</td>
      <td>${formatMoney(c.outras)}</td><td>${formatDate(c.ultimo)}</td>
      <td><button class="btn sm" onclick="informe(${c.membro_id})">Informe anual</button></td></tr>`).join('')}</table></div>`
      : '<p class="vazio">Nenhuma contribuição identificada neste ano.</p>'}`;
}
function informe(id) {
  const c = CONTRIB.find(x => x.membro_id === id);
  abrirModal(`<div class="paper"><div class="topo"><img src="img/logo.png" alt=""></div>
    <h4>INFORME DE CONTRIBUIÇÕES · ${ANO_CONTRIB}</h4>
    <p>Declaramos, para os devidos fins, que <b>${esc(c.nome)}</b> contribuiu com esta igreja, no ano de ${ANO_CONTRIB}, os seguintes valores:</p>
    <table><tr><th>Dízimos</th><td>${formatMoney(c.dizimos)}</td></tr><tr><th>Outras contribuições</th><td>${formatMoney(c.outras)}</td></tr>
    <tr><th>Total</th><td><b>${formatMoney(c.dizimos + c.outras)}</b></td></tr></table>
    <p style="margin-top:14px">São José dos Campos, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
    <div style="text-align:center;margin-top:40px">__________________________<br>Tesoureiro(a)</div></div>
    <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">Imprimir / salvar PDF</button><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}
