/* 3 · Patrimônio: bens da sede e das congregações, com "de acordo" do responsável pelo patrimônio */
const main = document.getElementById('main');
const CATS = ['imovel', 'movel', 'eletronico', 'instrumento', 'veiculo', 'outro'];

function abaBens(el) {
  const u = _unidades;
  el.innerHTML = `
    ${u.escopo ? '<div class="note">Bens lançados pela congregação aguardam o "de acordo" do Patrimônio da sede.</div>' : ''}
    ${pode(PERMS, 'patrimonio', 'criar') ? '<div class="row"><span style="flex:1"></span><button class="btn" onclick="abrirImportador(\'patrimonio\', () => _TBENS.carregar())">⬆ Importar de planilha ou banco antigo</button></div>' : ''}
    <div class="kpis" id="kpis"></div><div id="t"></div>`;
  window._TBENS = new Tabela({
    el: '#t', rota: 'patrimonio', chave: 'patrimonios', modulo: 'patrimonio', rotulo: 'bem', novoLabel: 'Bem', aprovacao: true,
    busca: ['nome', 'tombo', 'local', 'responsavel'],
    filtros: [
      { k: 'categoria', label: 'Todas as categorias', opcoes: () => ops(CATS) },
      { k: 'status', label: 'Todos os estados', opcoes: () => ops(['bom', 'manutencao', 'emprestado', 'descartado']) },
      ...(u.escopo ? [] : [{ k: 'congregacao_id', label: 'Todas as unidades', opcoes: () => u.unidades.map(x => [x.id, x.nome]) }]),
      { k: 'aprovacao', label: 'Todos', opcoes: () => [['pendente', 'Aguardando de acordo'], ['devolvido', 'Devolvidos'], ['aprovado', 'Aprovados']] },
    ],
    campos: [
      { k: 'nome', label: 'Descrição do bem', obrig: true, full: true },
      { k: 'tombo', label: 'Nº de tombo / etiqueta', placeholder: 'Ex.: P-0001' },
      { k: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ops(CATS), obrig: true },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'local', label: 'Local (sala, templo...)', obrig: true },
      { k: 'valor', label: 'Valor estimado (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'status', label: 'Estado', tipo: 'select', opcoes: ops(['bom', 'manutencao', 'emprestado', 'descartado']) },
      { k: 'responsavel', label: 'Responsável' },
      { k: 'data_aquisicao', label: 'Aquisição', tipo: 'date' },
      { k: 'observacoes', label: 'Observações (origem: compra/doação, nota fiscal...)', tipo: 'textarea' },
      { tipo: 'secao', label: 'Ficha técnica, garantia e seguro' },
      { k: 'marca', label: 'Marca' }, { k: 'modelo', label: 'Modelo' }, { k: 'numero_serie', label: 'Nº de série' }, { k: 'nota_fiscal', label: 'Nota fiscal' },
      { k: 'garantia_ate', label: 'Garantia até', tipo: 'date' }, { k: 'vida_util_anos', label: 'Vida útil (anos, p/ depreciação)', tipo: 'number', min: 0 },
      { k: 'seguradora', label: 'Seguradora' }, { k: 'apolice', label: 'Apólice' }, { k: 'seguro_ate', label: 'Seguro válido até', tipo: 'date' },
    ],
    colunas: [
      { k: 'tombo', label: 'Tombo' },
      { k: 'nome', label: 'Bem', fmt: v => `<strong>${esc(v)}</strong>` },
      { k: 'categoria', label: 'Categoria', fmt: v => rotulo(v) },
      { k: 'congregacao_id', label: 'Unidade', fmt: (v, r) => esc(nomeUnidade(v)) + `<br><small style="color:var(--mut)">${esc(r.local || '')}</small>` },
      { k: 'valor', label: 'Valor', fmt: (v, b) => { const a = valorAtual(b); return formatMoney(v) + (a != null ? `<br><small style="color:var(--mut)" title="Depreciação linear pela vida útil">atual ${formatMoney(a)}</small>` : ''); } },
      { k: 'status', label: 'Estado', fmt: v => `<span class="badge ${v === 'bom' ? 'b-ok' : ['manutencao', 'emprestado'].includes(v) ? 'b-pend' : 'b-dev'}">${rotulo(v)}</span>` },
    ],
    acoesExtras: r => (r.aprovacao || 'aprovado') !== 'aprovado' ? '' : [
      r.status !== 'descartado' && pode(PERMS, 'patrimonio', 'editar') ? `<button class="btn sm pri" onclick="formMovimentar(_TBENS.dados.find(x => x.id === ${r.id}), () => _TBENS.carregar())">Movimentar</button>` : '',
      `<button class="btn sm" onclick="historicoBem(_TBENS.dados.find(x => x.id === ${r.id}))">Histórico</button>`,
      `<button class="btn sm" title="Etiqueta com código de barras" onclick="etiquetaDoBem(_TBENS.dados.find(x => x.id === ${r.id}))">🏷</button>`,
    ].join(' '),
    depoisCarregar: d => {
      const ok = d.filter(b => (b.aprovacao || 'aprovado') === 'aprovado' && b.status !== 'descartado');
      document.getElementById('kpis').innerHTML = `
        <div class="kpi"><b>${ok.length}</b><span>Bens ativos</span></div>
        <div class="kpi"><b>${formatMoney(ok.reduce((s, b) => s + (b.valor || 0), 0))}</b><span>Valor estimado</span></div>
        <div class="kpi"><b>${ok.filter(b => b.status === 'manutencao').length}</b><span>Em manutenção</span></div>
        <div class="kpi"><b>${d.filter(b => b.aprovacao === 'pendente').length}</b><span>Aguardando de acordo</span></div>`;
    },
  });
  _TBENS.carregar();
}

(async () => {
  window.PERMS = await iniciarLayout('patrimonio');
  if (!PERMS) return;
  await carregarUnidades();
  main.innerHTML = '<div class="ph"><h1>Patrimônio</h1></div><div class="tabs" id="abas"></div><div id="conteudo"></div>';
  const el = document.getElementById('conteudo');
  const abas = [{ k: 'bens', n: 'Bens' }, { k: 'mov', n: 'Movimentações' }, { k: 'inv', n: 'Inventário (conferência)' }, { k: 'prev', n: 'Manutenção preventiva' },
    { k: 'esp', n: 'Espaços' }, { k: 'etq', n: 'Etiquetas' }, { k: 'almox', n: 'Almoxarifado (materiais)' }];
  if (pode(PERMS, 'compras', 'consultar')) abas.push({ k: 'compras', n: 'Compras' });
  montarAbas(document.getElementById('abas'), abas, aba => {
    el.innerHTML = '';
    ({ bens: abaBens, mov: abaMovimentacoes, inv: abaInventario, prev: abaPreventivas, esp: abaEspacos, etq: abaEtiquetas, almox: abaAlmoxarifado, compras: e => abaCompras(e, 'pedir') })[aba](el);
  });
})();
