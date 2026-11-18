/* Tesouraria · Pessoal: funcionários, temporários, autônomos e prestadores; pagamentos, serviços extras e folha do mês. */
const TIPOS_FUNC = [['clt', 'Funcionário (CLT)'], ['temporario', 'Temporário'], ['autonomo', 'Autônomo / diarista'], ['prestador', 'Prestador (empresa/MEI)'],
  ['estagiario', 'Estagiário'], ['pastoral', 'Pastor (prebenda / sustento pastoral)'], ['obreiro', 'Obreiro / dirigente (ajuda de custo)']];
const PERIOD_FUNC = [['mensal', 'Mensal'], ['quinzenal', 'Quinzenal'], ['semanal', 'Semanal'], ['diaria', 'Por diária'], ['por_servico', 'Por serviço']];
const TIPOS_PAG = [['salario', 'Salário / pagamento do período'], ['servico_extra', 'Serviço extra'], ['diaria', 'Diária'], ['adiantamento', 'Adiantamento'],
  ['decimo_terceiro', '13º salário'], ['ferias', 'Férias'], ['encargos', 'Encargos (INSS/FGTS)'],
  ['prebenda', 'Prebenda / sustento pastoral'], ['ajuda_custo', 'Ajuda de custo (obreiro/dirigente)'], ['auxilio', 'Auxílio (moradia, transporte, alimentação)']];
const PAG_PADRAO = { pastoral: 'prebenda', obreiro: 'ajuda_custo' };
const nomeTipoFunc = t => (TIPOS_FUNC.find(x => x[0] === t) || [, t])[1];
let MEMBROS_FUNC = [];

async function abaFuncionarios(el) {
  try { MEMBROS_FUNC = (await api('/membros')).membros.filter(m => m.status !== 'inativo'); } catch (e) { MEMBROS_FUNC = []; }
  if (!CONTAS_FIN.length) await carregarContasFin();
  const podeCriar = pode(PERMS, 'tesouraria', 'criar');
  el.innerHTML = `<div class="note">Pastores (prebenda/sustento pastoral), obreiros e dirigentes (ajuda de custo), funcionários, temporários, autônomos e prestadores de serviço. Se a pessoa é membro, ligue ao cadastro dela:
      a Secretaria passa a ver a indicação <b>👔 Funcionário</b> ao lado do nome (sem ver valores). Pagamentos e serviços extras viram
      despesas ligadas à pessoa; a folha do mês gera as contas a pagar de quem recebe mensalmente.</div>
    <div class="kpis" id="kFunc"></div>
    ${podeCriar ? `<div class="row"><label class="l" style="margin:0">Folha do mês</label><input type="month" id="fMes" value="${hojeISO().slice(0, 7)}">
      <button class="btn pri" id="btFolha">Gerar folha do mês</button><span style="flex:1"></span>
      <button class="btn" onclick="abrirImportador('funcionarios', () => abaFuncionarios(document.getElementById('contrib')))">⬆ Importar de planilha</button></div>` : ''}
    <div id="tFunc"></div>`;
  document.getElementById('btFolha')?.addEventListener('click', async () => {
    try { const r = await api('/funcionarios/folha', { method: 'POST', body: { competencia: document.getElementById('fMes').value } }); showToast('✓ ' + r.msg); }
    catch (e) { showToast('❌ ' + e.message); }
  });
  window._TFUNC = new Tabela({
    el: '#tFunc', rota: 'funcionarios', modulo: 'tesouraria', rotulo: 'funcionário / prestador', novoLabel: 'Funcionário ou prestador',
    busca: ['nome', 'cargo', 'cpf'],
    filtros: [{ k: 'tipo', label: 'Todos os vínculos', opcoes: () => TIPOS_FUNC }, { k: 'ativo', label: 'Ativos e desligados', opcoes: () => [['1', 'Ativos'], ['0', 'Desligados']] }],
    colunas: [
      { k: 'nome', label: 'Nome', fmt: (v, f) => `<b>${esc(v)}</b>${f.ativo ? '' : ' <span class="badge">Desligado</span>'}${f.membro_id ? ' <span class="badge b-info" title="Ligado ao cadastro de membro">👥 Membro</span>' : ''}<br><small style="color:var(--mut)">${esc(f.congregacao_nome || 'Sede')}</small>` },
      { k: 'cargo', label: 'Cargo / posição', fmt: (v, f) => `${esc(v || '-')}<br><small style="color:var(--mut)">${esc(nomeTipoFunc(f.tipo))}</small>` },
      { k: 'remuneracao', label: 'Remuneração', fmt: (v, f) => v ? `${formatMoney(v)}<br><small style="color:var(--mut)">${esc((PERIOD_FUNC.find(p => p[0] === f.periodicidade) || [, ''])[1])}${f.dia_pagamento ? ' · dia ' + f.dia_pagamento : ''}</small>` : '-' },
      { k: 'pix', label: 'Pagamento', fmt: (v, f) => esc([f.forma_pagamento, v].filter(Boolean).join(' · ') || '-') },
    ],
    acoesExtras: f => [podeCriar && f.ativo ? `<button class="btn sm ok" onclick="pagarFuncionario(${f.id})">💸 Pagar</button>` : '',
      `<button class="btn sm" onclick="historicoFuncionario(${f.id})">Pagamentos</button>`].join(' '),
    campos: [
      { k: 'membro_id', label: 'É membro? Ligar ao cadastro', tipo: 'select', vazio: 'Não é membro / não ligar', full: true,
        opcoes: MEMBROS_FUNC.map(m => [m.id, `${m.nome}${m.congregacao_nome ? ' · ' + m.congregacao_nome : ''}`]) },
      { k: 'nome', label: 'Nome', obrig: true, full: true },
      { k: 'cargo', label: 'Cargo / posição', placeholder: 'Zelador, secretária, motorista, técnico de som…' },
      { k: 'tipo', label: 'Vínculo', tipo: 'select', opcoes: TIPOS_FUNC },
      { k: 'cpf', label: 'CPF' }, { k: 'telefone', label: 'Telefone / WhatsApp' }, { k: 'email', label: 'E-mail', tipo: 'email' },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { tipo: 'secao', label: 'Remuneração e pagamento' },
      { k: 'remuneracao', label: 'Valor (R$)', tipo: 'number', passo: '0.01', min: 0 }, { k: 'periodicidade', label: 'Periodicidade', tipo: 'select', opcoes: PERIOD_FUNC },
      { k: 'dia_pagamento', label: 'Dia do pagamento', tipo: 'number', min: 1, max: 31 }, { k: 'forma_pagamento', label: 'Forma', tipo: 'select', opcoes: ops(['pix', 'transferencia', 'dinheiro', 'boleto']) },
      { k: 'pix', label: 'Chave PIX' }, { k: 'banco', label: 'Banco, agência e conta' },
      { k: 'data_admissao', label: 'Início', tipo: 'date' }, { k: 'data_desligamento', label: 'Desligamento', tipo: 'date' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Desligado']], padrao: '1' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ],
    depoisCarregar: d => {
      const ativos = d.filter(f => f.ativo);
      const folha = ativos.filter(f => f.periodicidade === 'mensal').reduce((s, f) => s + (f.remuneracao || 0), 0);
      document.getElementById('kFunc').innerHTML = `<div class="kpi"><b>${ativos.length}</b><span>Ativos</span></div>
        <div class="kpi"><b>${ativos.filter(f => ['pastoral', 'obreiro'].includes(f.tipo)).length}</b><span>Pastores, obreiros e dirigentes</span></div>
        <div class="kpi"><b>${ativos.filter(f => ['clt', 'estagiario'].includes(f.tipo)).length}</b><span>Funcionários (CLT/estágio)</span></div>
        <div class="kpi"><b>${ativos.filter(f => ['temporario', 'autonomo', 'prestador'].includes(f.tipo)).length}</b><span>Temporários e prestadores</span></div>
        <div class="kpi"><b>${formatMoney(folha)}</b><span>Folha mensal prevista</span></div>`;
    },
  });
  // ao escolher o membro, preenche o nome
  const abrirOriginal = _TFUNC.abrir.bind(_TFUNC);
  _TFUNC.abrir = row => {
    abrirOriginal(row);
    const sel = document.querySelector('#fmodal [name=membro_id]'), nome = document.querySelector('#fmodal [name=nome]');
    sel?.addEventListener('change', () => { const m = MEMBROS_FUNC.find(x => String(x.id) === sel.value); if (m && !nome.value) nome.value = m.nome; });
  };
  _TFUNC.carregar();
}

function pagarFuncionario(id) {
  const f = _TFUNC.dados.find(x => x.id === id);
  abrirFormulario({
    titulo: `Pagamento: ${f.nome}`, textoBotao: 'Lançar pagamento',
    antes: `<div class="note">${esc(f.cargo || '')} · ${esc(nomeTipoFunc(f.tipo))}${f.pix ? ` · PIX ${esc(f.pix)}` : ''}. O pagamento entra como despesa ligada a esta pessoa.</div>`,
    valores: { tipo: PAG_PADRAO[f.tipo] || (f.periodicidade === 'por_servico' ? 'servico_extra' : 'salario'), valor: f.remuneracao || '', data: hojeISO(), status: 'pago' },
    campos: [{ k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_PAG, full: true },
      { k: 'descricao', label: 'Descrição', full: true, placeholder: 'Ex.: Limpeza extra do congresso de jovens' },
      { k: 'valor', label: 'Valor (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrig: true }, { k: 'data', label: 'Data', tipo: 'date', obrig: true },
      { k: 'status', label: 'Situação', tipo: 'select', opcoes: [['pago', 'Pago'], ['pendente', 'A pagar']] },
      ...(CONTAS_FIN.filter(c => c.ativo).length ? [{ k: 'conta_id', label: 'Saiu da conta', tipo: 'select', vazio: '—', opcoes: CONTAS_FIN.filter(c => c.ativo).map(c => [c.id, c.nome]) }] : [])],
    aoSalvar: async d => { const r = await api(`/funcionarios/${id}/pagamento`, { method: 'POST', body: d }); showToast('✓ ' + r.msg); },
  });
}

async function historicoFuncionario(id) {
  const f = _TFUNC.dados.find(x => x.id === id);
  try {
    const r = await api(`/funcionarios/${id}/pagamentos`);
    abrirModal(`<h2>Pagamentos: ${esc(f.nome)}</h2><p style="font-size:13.5px">Total pago/lançado no ano: <b>${formatMoney(r.total_ano)}</b></p>
      ${r.pagamentos.length ? `<div class="tw"><table><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Valor</th><th>Situação</th></tr>
        ${r.pagamentos.map(p => `<tr><td>${formatDate(p.data)}</td><td>${esc(p.descricao)}</td><td>${esc(rotulo(p.categoria))}</td><td><b>${formatMoney(p.valor)}</b></td>
          <td><span class="badge ${p.status === 'pago' ? 'b-ok' : 'b-pend'}">${rotulo(p.status)}</span></td></tr>`).join('')}</table></div>` : '<p class="vazio">Nenhum pagamento ainda.</p>'}
      <div class="acoes-form"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  } catch (e) { showToast('❌ ' + e.message); }
}
