/* Tesouraria · gestão: contas a pagar e recorrentes, fechamento do mês (demonstrativo), fornecedores,
   plano de contas e recibo. Requer common.js, crud.js e a variável global PERMS. */
const FORMAS_PAG = ['boleto', 'pix', 'transferencia', 'debito_automatico', 'dinheiro', 'cartao'];
let FORNECEDORES = [];
async function carregarFornecedores() {
  try { FORNECEDORES = (await api('/fornecedores')).fornecedores; } catch (e) { FORNECEDORES = []; }
  return FORNECEDORES;
}
const mesAtual = () => hojeISO().slice(0, 7);
const mesAnterior = () => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 7); };
const nomeMes = c => new Date(`${c}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

/* ---------- Valor por extenso (recibos) ---------- */
function valorExtenso(valor) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = n => {
    if (n === 100) return 'cem';
    const p = [];
    if (n >= 100) { p.push(C[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { p.push(D[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) p.push(U[n]);
    return p.join(' e ');
  };
  const inteiro = n => {
    if (n === 0) return 'zero';
    const partes = [];
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    if (mi) partes.push(mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`);
    if (mil) partes.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`);
    if (resto) partes.push(ate999(resto));
    return partes.length > 1 && resto && (resto < 100 || resto % 100 === 0) ? partes.slice(0, -1).join(', ') + ' e ' + partes.at(-1) : partes.join(', ');
  };
  const reais = Math.floor(valor + 1e-9), cent = Math.round((valor - reais) * 100);
  const txt = [];
  if (reais) txt.push(`${inteiro(reais)} ${reais === 1 ? 'real' : 'reais'}`.replace(/(milhão|milhões) reais/, '$1 de reais'));
  if (cent) txt.push(`${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`);
  return txt.join(' e ') || 'zero real';
}

/** Recibo de uma receita (doação, dízimo, oferta, acerto). Número = nº do lançamento. */
function imprimirRecibo(t) {
  const quem = t.contribuinte || '______________________________________';
  abrirModal(`<div class="paper">
      <div class="topo"><img src="img/logo.png" alt="Logo da igreja"></div>
      <h4>RECIBO Nº ${String(t.id).padStart(6, '0')}</h4>
      <p style="text-align:right;font-size:20px;margin:0"><b>${formatMoney(t.valor)}</b></p>
      <p style="text-indent:2em;text-align:justify;line-height:1.8">Recebemos de <b>${esc(quem)}</b> a importância de
        <b>${formatMoney(t.valor)}</b> (${esc(valorExtenso(t.valor))}), referente a <b>${esc(rotulo(t.categoria))}</b>
        — ${esc(t.descricao)}${t.congregacao_nome ? `, ${esc(t.congregacao_nome)}` : ''}, em ${formatDate(t.data)},
        por ${esc(rotulo(t.forma || 'dinheiro'))}.</p>
      <p>Para clareza, firmamos o presente.</p>
      <p style="text-align:right">São José dos Campos, ${hojeExtenso()}.</p>
      <div style="text-align:center;margin-top:46px">__________________________________<br>Tesouraria · AD Belém SJC</div>
    </div>
    <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">Imprimir / salvar PDF</button>
      <button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}

/* ---------- Contas a pagar + contas recorrentes ---------- */
async function abaContasPagar(el) {
  let r;
  try { r = await api('/tesouraria/contas-a-pagar'); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeEditar = pode(PERMS, 'tesouraria', 'editar'), podeCriar = pode(PERMS, 'tesouraria', 'criar');
  const situacao = c => c.dias < 0 ? `<span class="badge b-dev">Vencida há ${-c.dias} dia(s)</span>`
    : c.dias === 0 ? '<span class="badge b-pend">Vence hoje</span>'
    : c.dias <= 7 ? `<span class="badge b-pend">Vence em ${c.dias} dia(s)</span>` : `<span class="badge">Em ${c.dias} dias</span>`;
  el.innerHTML = `<div class="kpis">
      <div class="kpi"><b>${formatMoney(r.total)}</b><span>Total a pagar (${r.contas.length})</span></div>
      <div class="kpi" style="border-left-color:var(--red)"><b style="color:var(--red)">${formatMoney(r.vencidas)}</b><span>Vencidas (${r.qtd_vencidas})</span></div>
      <div class="kpi"><b>${formatMoney(r.proximos_7_dias)}</b><span>Vencem nos próximos 7 dias</span></div></div>
    ${podeCriar ? `<div class="row"><label class="l" style="margin:0">Gerar as contas recorrentes do mês</label>
      <input type="month" id="cpMes" value="${mesAtual()}"><button class="btn pri" id="cpGerar">Gerar contas do mês</button></div>` : ''}
    <div class="card"><h3>Contas a pagar</h3>${r.contas.length ? `<div class="tw"><table>
      <tr><th>Vencimento</th><th>Conta</th><th>Fornecedor</th><th>Categoria</th><th>Valor</th><th>Situação</th><th></th></tr>
      ${r.contas.map(c => `<tr class="${c.dias < 0 ? 'dev' : c.dias <= 7 ? 'pend' : ''}"><td>${formatDate(c.vencimento)}</td>
        <td>${esc(c.descricao)}${c.documento ? `<br><small style="color:var(--mut)">Doc. ${esc(c.documento)}</small>` : ''}</td>
        <td>${esc(c.fornecedor_nome || '-')}</td><td>${esc(rotulo(c.categoria))}</td><td><b>${formatMoney(c.valor)}</b></td><td>${situacao(c)}</td>
        <td class="acoes">${podeEditar ? `<button class="btn sm ok" onclick="pagarConta(${c.id})">Marcar pago</button>` : ''}</td></tr>`).join('')}
      </table></div>` : '<p class="vazio">Nenhuma conta pendente. 🙌</p>'}</div>
    <div class="card"><h3>Contas recorrentes</h3>
      <p style="margin:0 0 8px;font-size:13px;color:var(--mut)">Água, luz, aluguel, internet, prebendas… Cadastre uma vez; todo mês use
      "Gerar contas do mês" para criar as despesas a pagar com o vencimento certo (sem duplicar).</p><div id="tRec"></div></div>`;
  document.getElementById('cpGerar')?.addEventListener('click', async () => {
    try {
      const x = await api('/tesouraria/recorrentes/gerar', { method: 'POST', body: { competencia: document.getElementById('cpMes').value } });
      showToast('✓ ' + x.msg); abaContasPagar(el);
    } catch (e) { showToast('❌ ' + e.message); }
  });
  await Promise.all([carregarFornecedores(), PLANO.length ? null : carregarPlano()]);
  new Tabela({
    el: '#tRec', rota: 'tesouraria/recorrentes', chave: 'recorrentes', modulo: 'tesouraria', rotulo: 'conta recorrente', novoLabel: 'Conta recorrente',
    busca: ['descricao'],
    colunas: [
      { k: 'dia_vencimento', label: 'Dia', fmt: v => `Todo dia ${v}` },
      { k: 'descricao', label: 'Conta', fmt: (v, x) => `<b>${esc(v)}</b>${x.ativo ? '' : ' <span class="badge">Inativa</span>'}` },
      { k: 'fornecedor_id', label: 'Fornecedor', fmt: v => esc(FORNECEDORES.find(f => f.id === v)?.nome || '-') },
      { k: 'categoria', label: 'Categoria', fmt: v => esc(rotulo(v)) },
      { k: 'valor', label: 'Valor', fmt: v => formatMoney(v) },
    ],
    campos: [
      { k: 'descricao', label: 'Descrição', obrig: true, full: true, placeholder: 'Ex.: Conta de luz do templo sede' },
      { k: 'fornecedor_id', label: 'Fornecedor', tipo: 'select', vazio: '—', opcoes: FORNECEDORES.filter(f => f.ativo).map(f => [f.id, f.nome]) },
      { k: 'categoria', label: 'Conta (plano de contas)', tipo: 'select', obrig: true, opcoes: opcoesPlano('despesa') },
      { k: 'valor', label: 'Valor previsto (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrig: true },
      { k: 'dia_vencimento', label: 'Dia do vencimento', tipo: 'number', min: 1, max: 31, obrig: true },
      { k: 'forma', label: 'Forma de pagamento', tipo: 'select', opcoes: ops(FORMAS_PAG) },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa']], padrao: '1' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ],
  }).carregar();
}
async function pagarConta(id) {
  try { await api(`/financeiro/${id}/status`, { method: 'PATCH', body: { status: 'pago' } }); showToast('✓ Conta paga'); abaContasPagar(document.getElementById('contrib')); }
  catch (e) { showToast('❌ ' + e.message); }
}

/* ---------- Fechamento do mês: demonstrativo por conta do plano ---------- */
let COMP_DEM = null;
async function abaFechamento(el) {
  COMP_DEM ||= mesAnterior();
  let d, hist = [];
  try {
    [d, hist] = await Promise.all([api(`/tesouraria/demonstrativo?competencia=${COMP_DEM}`), api('/tesouraria/fechamentos').then(x => x.fechamentos)]);
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const linhas = tipo => d.contas.filter(c => c.tipo === tipo).map(c =>
    `<tr><td>${esc(c.codigo)}</td><td>${esc(c.conta)}<br><small style="color:var(--mut)">${esc(c.grupo)} · ${c.lancamentos} lançamento(s)</small></td><td style="text-align:right">${formatMoney(c.total)}</td></tr>`).join('')
    || '<tr><td colspan="3" style="color:var(--mut)">Nenhum lançamento</td></tr>';
  const podeFechar = pode(PERMS, 'tesouraria', 'aprovar') && !d.fechamento && COMP_DEM < mesAtual();
  const podeReabrir = pode(PERMS, 'tesouraria', 'deletar') && d.fechamento;
  el.innerHTML = `<div class="row noprint"><label class="l" style="margin:0">Mês</label><input type="month" id="demMes" value="${COMP_DEM}" max="${mesAtual()}">
      <span style="flex:1"></span><button class="btn" onclick="exportarContador()">⬇ Exportar para o contador</button><button class="btn" onclick="window.print()">🖨 Imprimir demonstrativo</button>
      ${podeFechar ? '<button class="btn pri" id="btFechar">🔒 Fechar o mês</button>' : ''}
      ${podeReabrir ? '<button class="btn no" id="btReabrir">Reabrir o mês</button>' : ''}</div>
    ${d.fechamento ? `<div class="note">🔒 Mês fechado por ${esc(d.fechamento.fechado_por || '')} em ${formatDate(d.fechamento.fechado_em)}. Lançamentos deste mês não podem ser incluídos, alterados ou excluídos.</div>`
      : d.aguardando_de_acordo ? `<div class="note">⚠ ${d.aguardando_de_acordo} lançamento(s) aguardando "de acordo": resolva antes de fechar.</div>`
      : '<div class="note">Confira o demonstrativo. Depois de fechado, o mês fica bloqueado para alterações (só o chefe da Tesouraria reabre, com motivo registrado).</div>'}
    <div class="card" id="demonstrativo"><h3>Demonstrativo de ${esc(nomeMes(COMP_DEM))} · AD Belém SJC</h3>
      <div class="kpis"><div class="kpi"><b>${formatMoney(d.saldo_anterior)}</b><span>Saldo anterior</span></div>
        <div class="kpi"><b style="color:var(--vd)">${formatMoney(d.receitas)}</b><span>Receitas</span></div>
        <div class="kpi"><b style="color:var(--red)">${formatMoney(d.despesas)}</b><span>Despesas</span></div>
        <div class="kpi"><b>${formatMoney(d.saldo_final)}</b><span>Saldo final</span></div></div>
      <div class="grid g2"><div><h3>Receitas</h3><div class="tw"><table><tr><th>Código</th><th>Conta</th><th style="text-align:right">Valor</th></tr>${linhas('receita')}
          <tr><td></td><td><b>Total das receitas</b></td><td style="text-align:right"><b>${formatMoney(d.receitas)}</b></td></tr></table></div></div>
        <div><h3>Despesas</h3><div class="tw"><table><tr><th>Código</th><th>Conta</th><th style="text-align:right">Valor</th></tr>${linhas('despesa')}
          <tr><td></td><td><b>Total das despesas</b></td><td style="text-align:right"><b>${formatMoney(d.despesas)}</b></td></tr></table></div>
          ${d.despesas_a_pagar ? `<p style="font-size:13px;color:var(--mut)">Inclui ${formatMoney(d.despesas_a_pagar)} ainda a pagar.</p>` : ''}</div></div>
      <h3>Resultado por unidade</h3><div class="tw"><table><tr><th>Unidade</th><th style="text-align:right">Receitas</th><th style="text-align:right">Despesas</th><th style="text-align:right">Resultado</th></tr>
        ${d.unidades.map(u => `<tr><td>${esc(u.unidade)}</td><td style="text-align:right">${formatMoney(u.receitas)}</td><td style="text-align:right">${formatMoney(u.despesas)}</td>
          <td style="text-align:right"><b>${formatMoney(u.receitas - u.despesas)}</b></td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--mut)">Sem movimento</td></tr>'}</table></div>
      <p style="margin-top:14px"><b>Resultado do mês: ${formatMoney(d.resultado)}</b> ${d.resultado >= 0 ? '(superávit)' : '(déficit)'}</p>
      <div class="grid g2" style="margin-top:40px;text-align:center;font-size:13px"><div>______________________________<br>Tesoureiro</div><div>______________________________<br>Pastor Presidente</div></div></div>
    <div class="card noprint"><h3>Meses fechados</h3>${hist.length ? `<div class="tw"><table><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo final</th><th>Fechado por</th></tr>
      ${hist.map(h => `<tr><td><a href="#" onclick="COMP_DEM='${h.competencia}';abaFechamento(document.getElementById('contrib'));return false">${esc(nomeMes(h.competencia))}</a></td>
        <td>${formatMoney(h.receitas)}</td><td>${formatMoney(h.despesas)}</td><td><b>${formatMoney(h.saldo)}</b></td><td>${esc(h.fechado_por || '')} · ${formatDate(h.fechado_em)}</td></tr>`).join('')}</table></div>`
      : '<p class="vazio">Nenhum mês fechado ainda.</p>'}</div>`;
  document.getElementById('demMes').addEventListener('change', e => { COMP_DEM = e.target.value; abaFechamento(el); });
  document.getElementById('btFechar')?.addEventListener('click', async () => {
    if (!confirm(`Fechar ${nomeMes(COMP_DEM)}? Os lançamentos desse mês ficarão bloqueados.`)) return;
    try { const x = await api('/tesouraria/fechamentos', { method: 'POST', body: { competencia: COMP_DEM } }); showToast('✓ ' + x.msg); abaFechamento(el); }
    catch (e) { showToast('❌ ' + e.message); }
  });
  document.getElementById('btReabrir')?.addEventListener('click', async () => {
    const motivo = prompt('Motivo da reabertura (fica registrado no log):');
    if (!motivo?.trim()) return;
    try { const x = await api(`/tesouraria/fechamentos/${COMP_DEM}`, { method: 'DELETE', body: { motivo } }); showToast('✓ ' + x.msg); abaFechamento(el); }
    catch (e) { showToast('❌ ' + e.message); }
  });
}

/* ---------- Fornecedores ---------- */
function abaFornecedores(el) {
  el.innerHTML = `<div class="note">Cadastro de fornecedores e prestadores de serviço: usados nas despesas, contas recorrentes e compras.</div>
    ${pode(PERMS, 'tesouraria', 'criar') ? '<div class="row"><span style="flex:1"></span><button class="btn" onclick="abrirImportador(\'fornecedores\', () => abaFornecedores(document.getElementById(\'contrib\')))">⬆ Importar de planilha ou banco antigo</button></div>' : ''}
    <div id="tForn"></div>`;
  new Tabela({
    el: '#tForn', rota: 'fornecedores', modulo: 'tesouraria', rotulo: 'fornecedor', novoLabel: 'Fornecedor',
    busca: ['nome', 'documento', 'ramo', 'contato'],
    filtros: [{ k: 'ativo', label: 'Ativos e inativos', opcoes: () => [['1', 'Ativos'], ['0', 'Inativos']] }],
    colunas: [
      { k: 'nome', label: 'Fornecedor', fmt: (v, f) => `<b>${esc(v)}</b>${f.ativo ? '' : ' <span class="badge">Inativo</span>'}<br><small style="color:var(--mut)">${esc(f.documento || '')}</small>` },
      { k: 'ramo', label: 'Ramo' },
      { k: 'contato', label: 'Contato', fmt: (v, f) => [v, f.telefone, f.email].filter(Boolean).map(esc).join('<br>') || '-' },
      { k: 'pix', label: 'PIX / banco', fmt: (v, f) => [v, f.banco].filter(Boolean).map(esc).join('<br>') || '-' },
    ],
    campos: [
      { k: 'nome', label: 'Nome / razão social', obrig: true, full: true },
      { k: 'documento', label: 'CNPJ ou CPF' }, { k: 'ramo', label: 'Ramo', placeholder: 'Energia, gráfica, manutenção…' },
      { k: 'contato', label: 'Pessoa de contato' }, { k: 'telefone', label: 'Telefone / WhatsApp' },
      { k: 'email', label: 'E-mail', tipo: 'email' }, { k: 'pix', label: 'Chave PIX' },
      { k: 'banco', label: 'Banco, agência e conta', full: true }, { k: 'endereco', label: 'Endereço', full: true },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo']], padrao: '1' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ],
  }).carregar();
}

/* ---------- Plano de contas ---------- */
async function abaPlanoContas(el) {
  await carregarPlano();
  const podeAlterar = pode(PERMS, 'tesouraria', 'deletar');
  const bloco = tipo => `<div class="card"><h3>${tipo === 'receita' ? '3 · Receitas' : '4 · Despesas'}</h3><div class="tw"><table>
      <tr><th>Código</th><th>Conta</th><th>Grupo</th><th>Lançamentos</th><th></th></tr>
      ${PLANO.filter(c => c.tipo === tipo).map(c => `<tr${c.ativo ? '' : ' style="opacity:.55"'}><td><b>${esc(c.codigo)}</b></td>
        <td>${esc(c.nome)}${c.ativo ? '' : ' <span class="badge">Inativa</span>'}</td><td>${esc(c.grupo || '-')}</td><td>${c.usos}</td>
        <td class="acoes">${podeAlterar ? `<button class="btn sm" onclick="formConta(${c.id})">Editar</button>` : ''}</td></tr>`).join('')}</table></div></div>`;
  el.innerHTML = `<div class="note">Plano de contas da igreja: cada receita e despesa é classificada numa conta com código, o que organiza
      o demonstrativo mensal e facilita o trabalho do contador. ${podeAlterar ? 'Contas com lançamentos não são excluídas: desative-as.' : 'Somente o chefe da Tesouraria altera o plano.'}</div>
    ${podeAlterar ? '<div class="row"><button class="btn pri" onclick="formConta()">+ Nova conta</button></div>' : ''}
    <div class="grid g2">${bloco('receita')}${bloco('despesa')}</div>`;
}
function formConta(id) {
  const c = id ? PLANO.find(x => x.id === id) : null;
  abrirFormulario({
    titulo: c ? `Editar conta ${c.codigo}` : 'Nova conta', valores: c ? { ...c, ativo: String(c.ativo) } : { ativo: '1' },
    campos: [
      ...(c ? [] : [{ k: 'tipo', label: 'Tipo', tipo: 'select', obrig: true, opcoes: [['despesa', 'Despesa (4.x)'], ['receita', 'Receita (3.x)']] }]),
      { k: 'codigo', label: 'Código', obrig: true, placeholder: 'Ex.: 4.2.04' }, { k: 'nome', label: 'Nome da conta', obrig: true },
      { k: 'grupo', label: 'Grupo', placeholder: 'Ex.: Ocupação' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa (não aparece nos lançamentos)']] },
    ],
    aoSalvar: async d => {
      const r = await api(c ? `/plano-contas/${c.id}` : '/plano-contas', { method: c ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaPlanoContas(document.getElementById('contrib'));
    },
  });
}
