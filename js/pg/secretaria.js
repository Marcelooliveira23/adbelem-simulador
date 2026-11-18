/* 5 · Secretaria: documentos automáticos, carteirinhas, contratos e verificação de autenticidade */
const main = document.getElementById('main');
let MEMBROS = [];

const IGREJA = 'Assembleia de Deus Ministério do Belém em São José dos Campos';
const tratamento = m => (m?.funcao && m.funcao !== 'Membro') ? `${m.funcao.toLowerCase()} ` : 'irmão(ã) ';

/* Modelos padrão das cartas. A Secretaria pode revisar cada texto em "Modelos de cartas".
   Campos automáticos: {tratamento}{nome} {funcao} {congregacao} {destino} {batizado} {data_batismo} {data_admissao}
   {cpf} {cpf_txt} {observacoes} {igreja} {situacao} */
const MODELOS_PADRAO = {
  'Carta de recomendação': 'Recomendamos à {destino} o(a) {tratamento}{nome}{batizado}, membro em plena comunhão desta igreja ({congregacao}), para que o(a) recebais no Senhor, como convém aos santos.',
  'Carta de mudança': 'Declaramos que o(a) {tratamento}{nome}{batizado}, membro desta igreja ({congregacao}), está mudando de domicílio para {destino}, e o(a) recomendamos à igreja daquela localidade, estando em plena comunhão conosco.',
  'Carta de transferência': 'Transferimos o(a) {tratamento}{nome}{batizado}, membro desta igreja ({congregacao}), para o rol de membros da {destino}, por estar em plena comunhão e nada havendo que o(a) desabone.',
  'Carta de visita': 'Apresentamos o(a) {tratamento}{nome}, membro desta igreja ({congregacao}), que visitará {destino}, e o(a) recomendamos à vossa acolhida cristã.',
  'Declaração de membro': 'Declaramos, para os devidos fins, que {nome}{batizado}{cpf_txt} é membro da {igreja}, congregando na {congregacao}, encontrando-se em situação {situacao} perante esta igreja.',
  'Carta de doação': 'Declaramos ter recebido de {nome} a doação descrita a seguir, que passa a integrar o patrimônio desta igreja: {observacoes}. Agradecemos a generosidade e oramos para que o Senhor recompense.',
};
let _MODELOS = {};
async function carregarModelos() { try { _MODELOS = (await api('/documentos/modelos')).modelos || {}; } catch (e) { _MODELOS = {}; } }

/** Corpo do documento: modelo da Secretaria (ou o padrão) com os campos preenchidos pelo cadastro. */
function textoDocumento(doc, m) {
  const vars = {
    nome: `<b>${esc(doc.membro_nome)}</b>`, tratamento: esc(tratamento(m)), funcao: esc(m?.funcao || 'Membro'),
    congregacao: esc(m?.congregacao_nome || 'Sede'), destino: esc(doc.destino || '________________________'),
    data_batismo: formatDate(m?.data_batismo), data_admissao: formatDate(m?.data_admissao),
    batizado: m?.data_batismo ? `, batizado(a) em ${formatDate(m.data_batismo)}` : '',
    cpf: esc(m?.cpf || ''), cpf_txt: m?.cpf ? `, CPF ${esc(m.cpf)},` : '',
    observacoes: esc(doc.observacoes || '________________________'), igreja: esc(IGREJA),
    situacao: esc(rotulo(m?.status || 'ativo')).toLowerCase(),
  };
  const modelo = _MODELOS[doc.tipo]?.texto || MODELOS_PADRAO[doc.tipo] || '';
  return esc(modelo).replace(/\{(\w+)\}/g, (_, k) => k in vars ? vars[k] : `{${k}}`);
}

async function imprimirDocumento(id) {
  try {
    await carregarModelos();
    const { documento: d, membro: m } = await api(`/documentos/${id}`);
    const num = `${String(d.numero).padStart(4, '0')}/${d.ano}`;
    const urlVerif = `${location.origin}/frontend/verificar.html?c=${d.codigo}`;
    abrirModal(`<div class="paper">
        <div class="topo"><img src="img/logo.png" alt="Logo da igreja"></div>
        <h4>${esc(d.tipo.toUpperCase())}</h4>
        <p style="text-align:right;font-size:13px">Nº ${num} · São José dos Campos, ${hojeExtenso()}</p>
        <p style="text-indent:2em;text-align:justify">${textoDocumento(d, m)}</p>
        ${d.observacoes && d.tipo !== 'Carta de doação' ? `<p style="font-size:13px"><i>Obs.: ${esc(d.observacoes)}</i></p>` : ''}
        <p>Sem mais, subscrevemo-nos em Cristo.</p>
        <div style="text-align:center;margin-top:46px">__________________________________<br>Pastor Presidente</div>
        <p style="font-size:11px;color:#555;margin-top:26px;border-top:1px solid #ddd;padding-top:6px">
          Código de autenticidade: <b>${esc(d.codigo)}</b> · confira em ${esc(urlVerif)}</p>
      </div>
      <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">Imprimir / salvar PDF</button>
      <button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  } catch (e) { showToast('❌ ' + e.message); }
}

function abaDocumentos(el) {
  const podeEmitir = pode(PERMS, 'secretaria', 'criar');
  el.innerHTML = `${podeEmitir ? `<div class="card"><h3>Emitir documento</h3>
      <p style="margin:0 0 6px;font-size:13px;color:var(--mut)">Os dados vêm do cadastro do membro. Cada documento recebe número sequencial e código de autenticidade.</p>
      <button class="btn pri" id="btEmitir">+ Emitir carta ou declaração</button></div>`
      : '<div class="note">Seu perfil consulta os documentos. A emissão é feita pela Secretaria da sede.</div>'}
    <div class="card"><h3>Documentos emitidos</h3><div id="tDocs"></div></div>`;
  document.getElementById('btEmitir')?.addEventListener('click', async () => {
    const r = await api('/documentos');
    abrirFormulario({
      titulo: 'Emitir documento', textoBotao: 'Emitir e imprimir',
      campos: [
        { k: 'tipo', label: 'Documento', tipo: 'select', opcoes: r.tipos.map(t => [t, t]), obrig: true, full: true },
        { k: 'membro_id', label: 'Membro', tipo: 'select', vazio: 'Selecione...', opcoes: MEMBROS.map(m => [m.id, m.nome]), obrig: true, full: true },
        { k: 'destino', label: 'Igreja / local de destino', full: true, placeholder: 'Ex.: AD Ministério do Belém em Campinas' },
        { k: 'observacoes', label: 'Observações (na carta de doação: descrição do bem doado)', tipo: 'textarea' },
      ],
      aoSalvar: async dados => {
        const novo = await api('/documentos', { method: 'POST', body: dados });
        tabDocs.carregar();
        setTimeout(() => imprimirDocumento(novo.id), 50);
      },
    });
  });
  const tabDocs = new Tabela({
    el: '#tDocs', rota: 'documentos', modulo: 'secretaria', busca: ['membro_nome', 'tipo', 'codigo'],
    perms: { permissoes: [] },
    colunas: [
      { k: 'numero', label: 'Nº', fmt: (v, r) => `${String(v).padStart(4, '0')}/${r.ano}` },
      { k: 'tipo', label: 'Documento' }, { k: 'membro_nome', label: 'Membro' },
      { k: 'criado_em', label: 'Emissão', fmt: v => formatDate(v) }, { k: 'codigo', label: 'Código' },
    ],
    acoesExtras: r => `<button class="btn sm" onclick="imprimirDocumento(${r.id})">Ver / imprimir</button>`,
  });
  tabDocs.carregar();
}

function abaCarteirinha(el) {
  el.innerHTML = `<div class="card"><h3>Carteirinha de membro</h3>
    <div class="row noprint"><select id="selMembro" style="min-width:240px"><option value="">Selecione o membro...</option>
    ${MEMBROS.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select>
    <button class="btn pri" onclick="window.print()">Imprimir</button></div><div id="cart"></div></div>`;
  document.getElementById('selMembro').addEventListener('change', async e => {
    const m = MEMBROS.find(x => x.id === Number(e.target.value));
    let foto = null;
    if (m) { try { foto = (await api(`/membros/${m.id}/foto`)).foto; } catch (err) { foto = null; } }
    const validade = new Date(); validade.setFullYear(validade.getFullYear() + 2);
    document.getElementById('cart').innerHTML = !m ? '' : `<div class="cart">
      <div class="cc"><div class="h"><img src="img/brasao.png" alt=""><div><b>AD Belém SJC</b><br>Carteira de membro</div></div>
        <div class="b"><div class="foto">${foto ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover">` : 'FOTO'}</div><div><b style="font-size:13px">${esc(m.nome)}</b><br>Matrícula ${String(m.id).padStart(5, '0')}<br>
        ${esc(m.funcao || 'Membro')}<br>${esc(m.congregacao_nome || 'Sede')}</div></div></div>
      <div class="cc"><div class="h"><div><b>Verso</b></div></div>
        <div class="b" style="flex-direction:column;gap:4px"><div>Nascimento: ${formatDate(m.data_nascimento)}</div>
        <div>Batismo: ${formatDate(m.data_batismo)}</div><div>Validade: ${validade.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</div>
        <div style="margin-top:auto;text-align:center">_______________________<br>Pastor Presidente</div></div></div></div>`;
  });
}

function abaContratos(el) {
  const hoje = hojeISO(), em30 = hojeISO(30);
  el.innerHTML = '<div class="note">Contratos e aluguéis que vencem em até 30 dias aparecem destacados e entram nas pendências do Painel.</div><div id="tCont"></div>';
  new Tabela({
    el: '#tCont', rota: 'contratos', modulo: 'secretaria', rotulo: 'contrato', novoLabel: 'Contrato',
    busca: ['descricao', 'parte'],
    filtros: [{ k: 'tipo', label: 'Todos os tipos', opcoes: () => ops(['contrato', 'aluguel', 'seguro', 'servico', 'outro']) }],
    campos: [
      { k: 'descricao', label: 'Descrição', obrig: true, full: true },
      { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ops(['contrato', 'aluguel', 'seguro', 'servico', 'outro']) },
      { k: 'parte', label: 'Fornecedor / locador' },
      { k: 'valor', label: 'Valor mensal (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'inicio', label: 'Início', tipo: 'date' },
      { k: 'vencimento', label: 'Vencimento', tipo: 'date' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ],
    colunas: [
      { k: 'descricao', label: 'Contrato' }, { k: 'tipo', label: 'Tipo', fmt: v => rotulo(v) },
      { k: 'congregacao_id', label: 'Unidade', fmt: v => esc(nomeUnidade(v)) },
      { k: 'valor', label: 'Valor', fmt: v => formatMoney(v) },
      { k: 'vencimento', label: 'Vencimento', fmt: v => !v ? '-' : `${formatDate(v)} ${v < hoje ? '<span class="badge b-dev">Vencido</span>'
        : v <= em30 ? '<span class="badge b-pend">Vence em breve</span>' : '<span class="badge b-ok">Vigente</span>'}` },
    ],
  }).carregar();
}

function abaCongregacoes(el) {
  el.innerHTML = '<div class="note">Sede e congregações do campo. Elas aparecem como "Unidade" nos cadastros de membros, bens e lançamentos.</div><div id="tCong"></div>';
  new Tabela({
    el: '#tCong', rota: 'congregacoes', modulo: 'congregacoes', rotulo: 'congregação', novoLabel: 'Congregação',
    busca: ['nome', 'dirigente', 'bairro'],
    campos: [
      { k: 'nome', label: 'Nome', obrig: true, full: true }, { k: 'dirigente', label: 'Pastor dirigente' },
      { k: 'periodicidade_acerto', label: 'Acerto de contas com a sede', tipo: 'select', opcoes: [['mensal', 'Mensal'], ['semanal', 'Semanal']] },
      { k: 'telefone', label: 'Telefone' }, { k: 'endereco', label: 'Endereço', full: true }, { k: 'bairro', label: 'Bairro' },
      { k: 'cidade', label: 'Cidade', padrao: 'São José dos Campos' }, { k: 'estado', label: 'UF', padrao: 'SP' },
      { k: 'cep', label: 'CEP' }, { k: 'data_fundacao', label: 'Data de fundação', tipo: 'date' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa']], padrao: '1' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ],
    colunas: [
      { k: 'nome', label: 'Congregação', fmt: (v, r) => `<strong>${esc(v)}</strong>${r.ativo ? '' : ' <span class="badge">Inativa</span>'}` },
      { k: 'dirigente', label: 'Dirigente' }, { k: 'periodicidade_acerto', label: 'Acerto', fmt: v => rotulo(v || 'mensal') }, { k: 'telefone', label: 'Telefone' },
      { k: 'bairro', label: 'Bairro / cidade', fmt: (v, r) => esc([v, r.cidade].filter(Boolean).join(' · ') || '-') },
    ],
  }).carregar();
}

async function abaModelos(el) {
  await carregarModelos();
  const podeAlterar = pode(PERMS, 'secretaria', 'deletar');
  el.innerHTML = `<div class="note">Revise os textos das cartas. Os campos entre chaves são preenchidos automaticamente pelo cadastro do membro:
      <code>{tratamento}{nome}</code> <code>{funcao}</code> <code>{congregacao}</code> <code>{destino}</code> <code>{batizado}</code>
      <code>{data_batismo}</code> <code>{data_admissao}</code> <code>{cpf_txt}</code> <code>{situacao}</code> <code>{observacoes}</code> <code>{igreja}</code>.
      ${podeAlterar ? 'Para voltar ao texto original, use "Restaurar padrão".' : 'Somente o chefe da Secretaria altera os modelos.'}</div>
    ${Object.keys(MODELOS_PADRAO).map(t => `<div class="card"><h3>${esc(t)} ${_MODELOS[t] ? `<span class="badge b-info">Revisado por ${esc(_MODELOS[t].atualizado_por || '')}</span>` : '<span class="badge">Modelo padrão</span>'}</h3>
      <textarea data-tipo="${esc(t)}" style="width:100%;min-height:110px"${podeAlterar ? '' : ' disabled'}>${esc(_MODELOS[t]?.texto || MODELOS_PADRAO[t])}</textarea>
      ${podeAlterar ? `<div class="row" style="margin:8px 0 0"><button class="btn pri" onclick="salvarModelo(this)">Salvar</button>
        ${_MODELOS[t] ? '<button class="btn" onclick="salvarModelo(this, true)">Restaurar padrão</button>' : ''}</div>` : ''}</div>`).join('')}`;
}
async function salvarModelo(btn, restaurar = false) {
  const ta = btn.closest('.card').querySelector('textarea');
  const v = ta.value.trim();
  const textoNovo = restaurar || v === MODELOS_PADRAO[ta.dataset.tipo] ? '' : v;
  try { const r = await api('/documentos/modelos', { method: 'PUT', body: { tipo: ta.dataset.tipo, texto: textoNovo } }); showToast('✓ ' + r.msg); abaModelos(document.getElementById('conteudo')); }
  catch (e) { showToast('❌ ' + e.message); }
}

async function abaAlertas(el) {
  let al = [];
  try { al = (await api('/alertas')).alertas; } catch (e) { showToast('❌ ' + e.message); }
  el.innerHTML = `<div class="note">Contratos e documentos com validade nos próximos 90 dias (ou já vencidos), e aniversários (nascimento e casamento) dos próximos 7 dias.</div>
    ${tabelaAlertas(al)}`;
}

function abaVerificar(el) {
  el.innerHTML = `<div class="card"><h3>Conferir autenticidade de um documento</h3>
    <div class="row"><input id="cod" type="text" placeholder="Código (ex.: 7F3A9C21)" style="text-transform:uppercase">
    <button class="btn pri" id="btVer">Conferir</button></div><div id="res"></div>
    <p style="font-size:12.5px;color:var(--mut)">Qualquer pessoa pode conferir pelo endereço impresso no rodapé do documento, sem login.</p></div>`;
  document.getElementById('btVer').onclick = async () => {
    const c = document.getElementById('cod').value.trim();
    const res = document.getElementById('res');
    try {
      const r = await fetch(`${API_URL}/verificar/${encodeURIComponent(c)}`).then(x => x.json());
      res.innerHTML = r.valido
        ? `<div class="note" style="background:#e6f6ea;border-color:#b5e2c0">✓ Documento autêntico: <b>${esc(r.tipo)}</b> nº ${String(r.numero).padStart(4, '0')}/${r.ano}, de ${esc(r.membro_nome)}, emitido em ${formatDate(r.criado_em)}.</div>`
        : '<div class="note" style="background:#fbe8e8;border-color:#efc7c7">✗ Código não encontrado. O documento não foi emitido por este sistema.</div>';
    } catch (e) { showToast('❌ ' + e.message); }
  };
}

(async () => {
  window.PERMS = await iniciarLayout('secretaria');
  if (!PERMS) return;
  await carregarUnidades();
  try { MEMBROS = (await api('/membros')).membros.filter(m => (m.aprovacao || 'aprovado') === 'aprovado'); } catch (e) { MEMBROS = []; }
  main.innerHTML = '<div class="ph"><h1>Secretaria</h1></div><div class="tabs" id="abas"></div><div id="conteudo"></div>';
  const el = document.getElementById('conteudo');
  montarAbas(document.getElementById('abas'), [
    { k: 'docs', n: 'Cartas e declarações' }, { k: 'cart', n: 'Carteirinhas' }, { k: 'agenda', n: '📅 Agenda' }, { k: 'escalas', n: 'Escalas' }, { k: 'vis', n: 'Visitantes' }, { k: 'ebd', n: 'Escola Dominical' }, { k: 'freq', n: 'Frequência dos cultos' },
    { k: 'dep', n: 'Departamentos e ministérios' }, { k: 'reg', n: 'Livro de registros' }, { k: 'atas', n: 'Atas' },
    { k: 'alertas', n: '🔔 Alertas' }, { k: 'arq', n: 'Arquivo digital' }, { k: 'cont', n: 'Contratos e aluguéis' },
    { k: 'compras', n: 'Compras (revistas EBD)' }, { k: 'modelos', n: 'Modelos de cartas' }, { k: 'cong', n: 'Congregações' },
    { k: 'ver', n: 'Conferir autenticidade' },
  ], aba => ({ docs: abaDocumentos, cart: abaCarteirinha, vis: abaVisitantes, dep: abaDepartamentos, agenda: abaAgenda, escalas: abaEscalas, ebd: abaEBD, freq: abaFrequencia, reg: abaRegistros, atas: abaAtas, alertas: abaAlertas, arq: abaArquivos, cont: abaContratos,
    compras: e => abaCompras(e, 'pedir'), modelos: abaModelos, cong: abaCongregacoes, ver: abaVerificar })[aba](el));
})();
