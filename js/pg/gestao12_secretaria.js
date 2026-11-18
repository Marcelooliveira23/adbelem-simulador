/* Secretaria v1.2: agenda com reserva de espaços, escalas de serviço, livro de registros, atas,
   Escola Dominical (classes e chamada) e frequência dos cultos. */
const TIPOS_EVENTO = [['culto', 'Culto'], ['santa_ceia', 'Santa Ceia'], ['batismo', 'Batismo'], ['casamento', 'Casamento'], ['reuniao', 'Reunião'],
  ['ensaio', 'Ensaio'], ['congresso', 'Congresso / conferência'], ['ebd', 'Escola Dominical'], ['evento', 'Evento'], ['outro', 'Outro']];
const FUNCOES_ESCALA = ['Porteiro', 'Recepção', 'Diácono', 'Diaconisa', 'Som', 'Projeção / mídia', 'Louvor', 'Dirigente do culto', 'Pregador',
  'Santa Ceia', 'Berçário / crianças', 'Limpeza', 'Segurança / estacionamento', 'Intercessão'];
let ESPACOS = [], EVENTOS_CACHE = [];
const nomeTipoEv = t => (TIPOS_EVENTO.find(x => x[0] === t) || [, t])[1];
const nomeEspaco = id => ESPACOS.find(e => e.id === id)?.nome || '';
async function carregarEspacos() { try { ESPACOS = (await api('/espacos/opcoes')).espacos; } catch (e) { ESPACOS = []; } }

/* ---------- Agenda ---------- */
let MES_AGENDA = hojeISO().slice(0, 7);
async function abaAgenda(el) {
  await carregarEspacos();
  let evs = [];
  try { evs = (await api('/eventos')).eventos; } catch (e) { showToast('❌ ' + e.message); }
  EVENTOS_CACHE = evs;
  const doMes = evs.filter(e => e.data.startsWith(MES_AGENDA));
  const porDia = {};
  doMes.forEach(e => (porDia[e.data] ||= []).push(e));
  const podeCriar = pode(PERMS, 'secretaria', 'criar'), podeEditar = pode(PERMS, 'secretaria', 'editar');
  const nomeM = new Date(`${MES_AGENDA}-15T12:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  el.innerHTML = `<div class="row"><button class="btn sm" id="agAnt">‹</button><b>${esc(nomeM.charAt(0).toUpperCase() + nomeM.slice(1))}</b><button class="btn sm" id="agProx">›</button>
      <button class="btn sm" id="agHoje">Hoje</button><span style="flex:1"></span>${podeCriar ? '<button class="btn pri" id="agNovo">+ Evento</button>' : ''}
      <button class="btn noprint" onclick="window.print()">🖨 Imprimir</button></div>
    <div class="note">Ao escolher um espaço (templo, salão, salas), o sistema avisa se já houver outro evento no mesmo horário.
      Os espaços são cadastrados pelo Patrimônio.</div>
    ${Object.keys(porDia).length ? Object.keys(porDia).sort().map(d => `<div class="card"><h3>${(s => s.charAt(0).toUpperCase() + s.slice(1))(new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</h3>
      ${porDia[d].map(e => `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--ln)${e.status === 'cancelado' ? ';opacity:.5;text-decoration:line-through' : ''}">
        <b style="min-width:92px">${esc(e.hora_inicio || '--:--')}${e.hora_fim ? '–' + esc(e.hora_fim) : ''}</b>
        <div style="flex:1"><b>${esc(e.titulo)}</b> <span class="badge">${esc(nomeTipoEv(e.tipo))}</span>${e.status === 'a_confirmar' ? ' <span class="badge b-pend">A confirmar</span>' : ''}
          <br><small style="color:var(--mut)">${[e.congregacao_nome || 'Sede', nomeEspaco(e.espaco_id), e.responsavel && 'Resp.: ' + e.responsavel].filter(Boolean).map(esc).join(' · ')}</small></div>
        <div class="acoes noprint"><button class="btn sm" onclick="verEscalaEvento(${e.id})">Escala</button>${podeEditar ? `<button class="btn sm" onclick="formEvento(${e.id})">Editar</button>` : ''}</div></div>`).join('')}</div>`).join('')
      : '<p class="vazio">Nenhum evento neste mês.</p>'}`;
  const mudar = n => { const d = new Date(`${MES_AGENDA}-15T12:00`); d.setMonth(d.getMonth() + n); MES_AGENDA = d.toISOString().slice(0, 7); abaAgenda(el); };
  document.getElementById('agAnt').onclick = () => mudar(-1);
  document.getElementById('agProx').onclick = () => mudar(1);
  document.getElementById('agHoje').onclick = () => { MES_AGENDA = hojeISO().slice(0, 7); abaAgenda(el); };
  document.getElementById('agNovo')?.addEventListener('click', () => formEvento());
}
function formEvento(id) {
  const ev = id ? EVENTOS_CACHE.find(e => e.id === id) : null;
  const box = abrirFormulario({
    titulo: ev ? 'Editar evento' : 'Novo evento', valores: ev || { data: `${MES_AGENDA}-${hojeISO().slice(8)}`, tipo: 'culto', status: 'confirmado' },
    antes: '<div id="avisoConflito"></div>',
    campos: [{ k: 'titulo', label: 'Título', obrig: true, full: true, placeholder: 'Ex.: Culto de Santa Ceia' },
      { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_EVENTO }, { k: 'status', label: 'Situação', tipo: 'select', opcoes: [['confirmado', 'Confirmado'], ['a_confirmar', 'A confirmar'], ['cancelado', 'Cancelado']] },
      { k: 'data', label: 'Data', tipo: 'date', obrig: true }, { k: 'hora_inicio', label: 'Início', tipo: 'time' }, { k: 'hora_fim', label: 'Término', tipo: 'time' },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'espaco_id', label: 'Espaço (reserva)', tipo: 'select', vazio: '—', opcoes: ESPACOS.map(e => [e.id, `${e.nome}${e.capacidade ? ` (${e.capacidade} pessoas)` : ''}`]) },
      { k: 'responsavel', label: 'Responsável' }, { k: 'publico', label: 'Público', placeholder: 'Todos, jovens, irmãs…' },
      { k: 'descricao', label: 'Descrição / observações', tipo: 'textarea' }],
    aoSalvar: async d => {
      const r = await api(ev ? `/eventos/${ev.id}` : '/eventos', { method: ev ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaAgenda(document.getElementById('conteudo'));
    },
  });
  const checar = async () => {
    const v = n => box.querySelector(`[name=${n}]`).value;
    const aviso = box.querySelector('#avisoConflito');
    if (!v('espaco_id') || !v('data')) { aviso.innerHTML = ''; return; }
    try {
      const q = new URLSearchParams({ espaco_id: v('espaco_id'), data: v('data'), hora_inicio: v('hora_inicio'), hora_fim: v('hora_fim'), ignorar: id || 0 });
      const { conflitos } = await api(`/eventos/conflitos?${q}`);
      aviso.innerHTML = conflitos.length ? `<div class="note" style="background:#fbe8e8;border-color:#efc7c7">⚠ Espaço já reservado neste horário: ${conflitos.map(c =>
        `<b>${esc(c.titulo)}</b> (${esc(c.hora_inicio || '')}${c.hora_fim ? '–' + esc(c.hora_fim) : ''})`).join(', ')}. Você ainda pode salvar, se for intencional.</div>`
        : '<div class="note" style="background:#e6f6ea;border-color:#b5e2c0">✓ Espaço livre neste horário.</div>';
    } catch (e) { aviso.innerHTML = ''; }
  };
  ['espaco_id', 'data', 'hora_inicio', 'hora_fim'].forEach(n => box.querySelector(`[name=${n}]`).addEventListener('change', checar));
  checar();
}
async function verEscalaEvento(eventoId) {
  const ev = EVENTOS_CACHE.find(e => e.id === eventoId);
  let esc_ = [];
  try { esc_ = (await api(`/escalas?evento_id=${eventoId}`)).escalas; } catch (e) { /* */ }
  abrirModal(`<h2>Escala: ${esc(ev.titulo)}</h2><p style="color:var(--mut);font-size:13px">${formatDate(ev.data)} ${esc(ev.hora_inicio || '')}</p>
    ${esc_.length ? `<div class="tw"><table><tr><th>Função</th><th>Pessoa</th><th>Confirmado</th></tr>${esc_.map(s => `<tr><td>${esc(s.funcao)}</td><td>${esc(s.pessoa)}</td>
      <td>${s.confirmado ? '<span class="badge b-ok">Sim</span>' : '<span class="badge b-pend">Aguardando</span>'}</td></tr>`).join('')}</table></div>` : '<p class="vazio">Ninguém escalado ainda.</p>'}
    <div class="acoes-form"><a class="btn pri" href="secretaria.html#aba=escalas" onclick="fecharModal()">Abrir escalas</a><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}

/* ---------- Escalas de serviço ---------- */
async function abaEscalas(el) {
  let evs = [];
  try { evs = (await api('/eventos')).eventos.filter(e => e.data >= hojeISO(-30)); } catch (e) { /* */ }
  EVENTOS_CACHE = evs;
  el.innerHTML = `<div class="note">Escalas de porteiros, recepção, som, louvor, diáconos e demais funções. Marque "confirmado" quando a pessoa
      aceitar; o Painel avisa as escalas da semana ainda sem confirmação.</div><div id="tEsc"></div>`;
  const nomeEv = id => { const e = evs.find(x => x.id === id); return e ? `${e.titulo} (${formatDate(e.data)})` : ''; };
  new Tabela({
    el: '#tEsc', rota: 'escalas', modulo: 'secretaria', rotulo: 'escala', novoLabel: 'Escalar pessoa',
    busca: ['pessoa', 'funcao'],
    filtros: [{ k: 'funcao', label: 'Todas as funções', opcoes: () => FUNCOES_ESCALA.map(f => [f, f]) }],
    colunas: [{ k: 'data', label: 'Data', fmt: v => formatDate(v) }, { k: 'evento_id', label: 'Evento', fmt: v => esc(nomeEv(v) || '-') },
      { k: 'funcao', label: 'Função' }, { k: 'pessoa', label: 'Pessoa', fmt: v => `<b>${esc(v)}</b>` },
      { k: 'confirmado', label: 'Confirmado', fmt: v => v ? '<span class="badge b-ok">Sim</span>' : '<span class="badge b-pend">Aguardando</span>' }],
    campos: [{ k: 'data', label: 'Data', tipo: 'date', obrig: true, padrao: hojeISO() },
      { k: 'evento_id', label: 'Evento', tipo: 'select', vazio: '—', opcoes: evs.map(e => [e.id, `${formatDate(e.data)} · ${e.titulo}`]) },
      { k: 'funcao', label: 'Função', tipo: 'select', obrig: true, opcoes: FUNCOES_ESCALA.map(f => [f, f]) },
      { k: 'pessoa', label: 'Pessoa', obrig: true }, { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'confirmado', label: 'Confirmou?', tipo: 'select', opcoes: [['0', 'Aguardando'], ['1', 'Confirmado']] },
      { k: 'observacao', label: 'Observação', full: true }],
  }).carregar();
}

/* ---------- Livro de registros ---------- */
const TIPOS_REG = [['batismo', 'Batismo nas águas'], ['casamento', 'Casamento'], ['apresentacao', 'Apresentação de criança'],
  ['consagracao', 'Consagração ao ministério'], ['profissao_fe', 'Profissão de fé'], ['bencao', 'Bênção / outro']];
function abaRegistros(el) {
  el.innerHTML = `<div class="note">Livro oficial de registros eclesiásticos: batismos, casamentos, apresentações e consagrações, com livro, folha e número.
      Serve de base para certidões e para o histórico do membro.</div><div id="tReg"></div>`;
  new Tabela({
    el: '#tReg', rota: 'registros', modulo: 'secretaria', rotulo: 'registro', novoLabel: 'Registro',
    busca: ['nome', 'segundo_nome', 'oficiante', 'numero'],
    filtros: [{ k: 'tipo', label: 'Todos os tipos', opcoes: () => TIPOS_REG }],
    colunas: [{ k: 'data', label: 'Data', fmt: v => formatDate(v) }, { k: 'tipo', label: 'Tipo', fmt: v => esc((TIPOS_REG.find(t => t[0] === v) || [, v])[1]) },
      { k: 'nome', label: 'Nome(s)', fmt: (v, r) => `<b>${esc(v)}</b>${r.segundo_nome ? ` &amp; <b>${esc(r.segundo_nome)}</b>` : ''}${r.pais ? `<br><small style="color:var(--mut)">Pais: ${esc(r.pais)}</small>` : ''}` },
      { k: 'oficiante', label: 'Oficiante' }, { k: 'livro', label: 'Livro / folha / nº', fmt: (v, r) => esc([v && 'L. ' + v, r.folha && 'fl. ' + r.folha, r.numero && 'nº ' + r.numero].filter(Boolean).join(' · ') || '-') }],
    campos: [{ k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_REG }, { k: 'data', label: 'Data', tipo: 'date', obrig: true },
      { k: 'nome', label: 'Nome (batizando, noivo, criança…)', obrig: true, full: true }, { k: 'segundo_nome', label: 'Segundo nome (noiva, cônjuge…)', full: true },
      { k: 'pais', label: 'Pais (apresentação)', full: true }, { k: 'oficiante', label: 'Oficiante' }, { k: 'local', label: 'Local' },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' }, { k: 'livro', label: 'Livro' }, { k: 'folha', label: 'Folha' }, { k: 'numero', label: 'Número' },
      { k: 'testemunhas', label: 'Testemunhas', full: true }, { k: 'observacoes', label: 'Observações', tipo: 'textarea' }],
  }).carregar();
}

/* ---------- Atas ---------- */
const TIPOS_ATA = [['assembleia_ordinaria', 'Assembleia geral ordinária'], ['assembleia_extraordinaria', 'Assembleia geral extraordinária'],
  ['ministerio', 'Reunião do ministério'], ['diretoria', 'Reunião da diretoria'], ['conselho_fiscal', 'Conselho fiscal'], ['departamento', 'Departamento']];
function abaAtas(el) {
  el.innerHTML = '<div class="note">Atas das assembleias e reuniões. Depois de aprovada e assinada, guarde a via digitalizada no Arquivo digital.</div><div id="tAtas"></div>';
  window._TATAS = new Tabela({
    el: '#tAtas', rota: 'atas', modulo: 'secretaria', rotulo: 'ata', novoLabel: 'Ata',
    busca: ['numero', 'pauta', 'deliberacoes'],
    filtros: [{ k: 'tipo', label: 'Todos os tipos', opcoes: () => TIPOS_ATA }],
    colunas: [{ k: 'data', label: 'Data', fmt: v => formatDate(v) }, { k: 'numero', label: 'Nº' },
      { k: 'tipo', label: 'Reunião', fmt: v => esc((TIPOS_ATA.find(t => t[0] === v) || [, v])[1]) },
      { k: 'pauta', label: 'Pauta', fmt: v => esc((v || '').slice(0, 90)) },
      { k: 'situacao', label: 'Situação', fmt: v => `<span class="badge ${v === 'aprovada' ? 'b-ok' : 'b-pend'}">${v === 'aprovada' ? 'Aprovada' : 'Rascunho'}</span>` }],
    acoesExtras: r => `<button class="btn sm" onclick="imprimirAta(${r.id})">🖨 Imprimir</button>`,
    campos: [{ k: 'numero', label: 'Número', placeholder: 'Ex.: 012/2026' }, { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_ATA },
      { k: 'data', label: 'Data', tipo: 'date', obrig: true, padrao: hojeISO() }, { k: 'local', label: 'Local' },
      { k: 'presidente', label: 'Presidiu' }, { k: 'secretario', label: 'Secretariou' },
      { k: 'presentes', label: 'Presentes', tipo: 'textarea' }, { k: 'pauta', label: 'Pauta', tipo: 'textarea' },
      { k: 'deliberacoes', label: 'Texto da ata / deliberações', tipo: 'textarea' },
      { k: 'situacao', label: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aprovada', 'Aprovada']] }],
  });
  _TATAS.carregar();
}
function imprimirAta(id) {
  const a = _TATAS.dados.find(x => x.id === id);
  abrirModal(`<div class="paper"><div class="topo"><img src="img/logo.png" alt="Logo da igreja"></div>
      <h4>ATA ${a.numero ? 'Nº ' + esc(a.numero) : ''} · ${esc((TIPOS_ATA.find(t => t[0] === a.tipo) || [, ''])[1]).toUpperCase()}</h4>
      <p style="text-align:justify;line-height:1.8;white-space:pre-wrap">Aos ${formatDate(a.data)}, ${a.local ? 'em ' + esc(a.local) + ', ' : ''}reuniram-se sob a presidência de
${esc(a.presidente || '________________')}, secretariada por ${esc(a.secretario || '________________')}.
${a.presentes ? '\nPresentes: ' + esc(a.presentes) + '\n' : ''}${a.pauta ? '\nPauta: ' + esc(a.pauta) + '\n' : ''}
${esc(a.deliberacoes || '')}</p>
      <div class="grid g2" style="margin-top:50px;text-align:center;font-size:13px"><div>______________________________<br>Presidente</div><div>______________________________<br>Secretário(a)</div></div></div>
    <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">Imprimir / salvar PDF</button><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}

/* ---------- Escola Dominical ---------- */
let DATA_EBD = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
async function abaEBD(el) {
  el.innerHTML = `<div class="tabs" id="abasEbd" style="margin-top:0"></div><div id="ebdCont"></div>`;
  montarAbasInternas(document.getElementById('abasEbd'), [['chamada', 'Chamada do domingo'], ['classes', 'Classes'], ['resumo', 'Relatório anual']], k =>
    ({ chamada: ebdChamada, classes: ebdClasses, resumo: ebdResumo })[k](document.getElementById('ebdCont')));
}
function montarAbasInternas(el, abas, aoTrocar) {
  el.innerHTML = abas.map(([k, n], i) => `<button type="button" class="${i ? '' : 'on'}" data-k="${k}">${esc(n)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); aoTrocar(b.dataset.k); });
  aoTrocar(abas[0][0]);
}
async function ebdChamada(el) {
  let r;
  try { r = await api(`/ebd/chamada?data=${DATA_EBD}`); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeLancar = pode(PERMS, 'secretaria', 'criar');
  const num = (c, k) => `<input type="number" min="0" data-k="${k}" value="${c[k] ?? (k === 'matriculados' ? c.matriculados_classe : '') ?? ''}" style="width:70px"${podeLancar ? '' : ' disabled'}>`;
  el.innerHTML = `<div class="row"><label class="l" style="margin:0">Domingo</label><input type="date" id="ebdData" value="${DATA_EBD}">
      <span style="flex:1"></span>${podeLancar && r.classes.length ? '<button class="btn pri" id="ebdSalvar">Salvar chamada</button>' : ''}</div>
    ${r.classes.length ? `<div class="tw"><table id="ebdTab"><tr><th>Classe</th><th>Lição</th><th>Matric.</th><th>Presentes</th><th>Visitantes</th><th>Bíblias</th><th>Revistas</th><th>Oferta (R$)</th></tr>
      ${r.classes.map(c => `<tr data-classe="${c.classe_id}"><td><b>${esc(c.nome)}</b><br><small style="color:var(--mut)">${esc(c.professor || '')}</small></td>
        <td><input data-k="licao" value="${esc(c.licao || '')}" style="width:110px"${podeLancar ? '' : ' disabled'}></td>
        <td>${num(c, 'matriculados')}</td><td>${num(c, 'presentes')}</td><td>${num(c, 'visitantes')}</td><td>${num(c, 'biblias')}</td><td>${num(c, 'revistas')}</td>
        <td><input type="number" min="0" step="0.01" data-k="oferta" value="${c.oferta ?? ''}" style="width:90px"${podeLancar ? '' : ' disabled'}></td></tr>`).join('')}
      <tr id="ebdTot"><td><b>Total</b></td><td></td>${['matriculados', 'presentes', 'visitantes', 'biblias', 'revistas', 'oferta'].map(() => '<td><b>-</b></td>').join('')}</tr></table></div>`
      : '<p class="vazio">Cadastre as classes na aba "Classes".</p>'}`;
  const totalizar = () => {
    const cols = ['matriculados', 'presentes', 'visitantes', 'biblias', 'revistas', 'oferta'];
    const tot = cols.map(k => [...el.querySelectorAll(`#ebdTab tr[data-classe] [data-k=${k}]`)].reduce((s, i) => s + Number(i.value || 0), 0));
    const tds = el.querySelectorAll('#ebdTot td');
    tot.forEach((v, i) => { tds[i + 2].innerHTML = `<b>${cols[i] === 'oferta' ? formatMoney(v) : v}</b>`; });
  };
  if (r.classes.length) { el.querySelectorAll('#ebdTab input').forEach(i => i.addEventListener('input', totalizar)); totalizar(); }
  document.getElementById('ebdData').onchange = e => { DATA_EBD = e.target.value; ebdChamada(el); };
  document.getElementById('ebdSalvar')?.addEventListener('click', async () => {
    const aulas = [...el.querySelectorAll('#ebdTab tr[data-classe]')].map(tr => {
      const o = { classe_id: Number(tr.dataset.classe) };
      tr.querySelectorAll('[data-k]').forEach(i => { o[i.dataset.k] = i.value; });
      return o;
    });
    try { const x = await api('/ebd/chamada', { method: 'PUT', body: { data: DATA_EBD, aulas } }); showToast('✓ ' + x.msg); }
    catch (e) { showToast('❌ ' + e.message); }
  });
}
function ebdClasses(el) {
  el.innerHTML = '<div id="tEbdC"></div>';
  new Tabela({
    el: '#tEbdC', rota: 'ebd/classes', chave: 'classes', modulo: 'secretaria', rotulo: 'classe', novoLabel: 'Classe',
    colunas: [{ k: 'nome', label: 'Classe', fmt: (v, c) => `<b>${esc(v)}</b>${c.ativo ? '' : ' <span class="badge">Inativa</span>'}<br><small style="color:var(--mut)">${esc(c.faixa || '')}</small>` },
      { k: 'professor', label: 'Professor(a)', fmt: (v, c) => esc([v, c.auxiliar].filter(Boolean).join(' / ') || '-') },
      { k: 'sala', label: 'Sala' }, { k: 'matriculados', label: 'Matriculados' }],
    campos: [{ k: 'nome', label: 'Nome da classe', obrig: true }, { k: 'faixa', label: 'Faixa etária', placeholder: 'Ex.: 9 a 12 anos' },
      { k: 'professor', label: 'Professor(a)' }, { k: 'auxiliar', label: 'Auxiliar' }, { k: 'sala', label: 'Sala' },
      { k: 'matriculados', label: 'Matriculados', tipo: 'number', min: 0 }, { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa']], padrao: '1' }],
  }).carregar();
}
async function ebdResumo(el) {
  let r;
  try { r = await api(`/ebd/resumo?ano=${new Date().getFullYear()}`); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>Por domingo (${r.ano})</h3>${r.domingos.length ? `<div class="tw"><table><tr><th>Domingo</th><th>Presentes</th><th>Visitantes</th><th>Frequência</th><th>Oferta</th></tr>
      ${r.domingos.map(d => `<tr><td>${formatDate(d.data)}</td><td>${d.presentes}/${d.matriculados}</td><td>${d.visitantes}</td>
        <td>${d.matriculados ? Math.round(100 * d.presentes / d.matriculados) + '%' : '-'}</td><td>${formatMoney(d.oferta)}</td></tr>`).join('')}</table></div>` : '<p class="vazio">Sem chamadas.</p>'}</div>
    <div class="card"><h3>Por classe</h3><div class="tw"><table><tr><th>Classe</th><th>Aulas</th><th>Média de presentes</th><th>Frequência</th></tr>
      ${r.classes.map(c => `<tr><td>${esc(c.nome)}</td><td>${c.aulas}</td><td>${c.media_presentes ?? '-'}</td><td>${c.frequencia != null ? c.frequencia + '%' : '-'}</td></tr>`).join('')}</table></div></div></div>`;
}

/* ---------- Frequência dos cultos ---------- */
function abaFrequencia(el) {
  el.innerHTML = '<div class="note">Contagem de cada culto (adultos, crianças, visitantes, decisões). Acompanhe o crescimento mês a mês.</div><div class="kpis" id="kFreq"></div><div id="tFreq"></div>';
  new Tabela({
    el: '#tFreq', rota: 'frequencia', chave: 'registros', modulo: 'secretaria', rotulo: 'culto', novoLabel: 'Registrar culto',
    colunas: [{ k: 'data', label: 'Data', fmt: v => formatDate(v) }, { k: 'culto', label: 'Culto', fmt: (v, r) => `${esc(v || '-')}<br><small style="color:var(--mut)">${esc(r.congregacao_nome || 'Sede')}</small>` },
      { k: 'adultos', label: 'Público', fmt: (v, r) => `<b>${v + r.criancas}</b><br><small style="color:var(--mut)">${v} adultos · ${r.criancas} crianças</small>` },
      { k: 'visitantes', label: 'Visitantes' }, { k: 'decisoes', label: 'Decisões / reconciliações', fmt: (v, r) => `${v} / ${r.reconciliacoes}` },
      { k: 'pregador', label: 'Pregação', fmt: (v, r) => esc([v, r.tema].filter(Boolean).join(' — ') || '-') }],
    campos: [{ k: 'data', label: 'Data', tipo: 'date', obrig: true, padrao: hojeISO() }, { k: 'culto', label: 'Culto', placeholder: 'Ex.: Domingo à noite' },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' }, { k: 'adultos', label: 'Adultos', tipo: 'number', min: 0 },
      { k: 'criancas', label: 'Crianças', tipo: 'number', min: 0 }, { k: 'visitantes', label: 'Visitantes', tipo: 'number', min: 0 },
      { k: 'decisoes', label: 'Decisões (aceitaram Jesus)', tipo: 'number', min: 0 }, { k: 'reconciliacoes', label: 'Reconciliações', tipo: 'number', min: 0 },
      { k: 'pregador', label: 'Pregador' }, { k: 'tema', label: 'Tema / texto' }, { k: 'observacao', label: 'Observação', tipo: 'textarea' }],
    depoisCarregar: d => {
      const mes = hojeISO().slice(0, 7), doMes = d.filter(x => x.data.startsWith(mes));
      const media = doMes.length ? Math.round(doMes.reduce((s, x) => s + x.adultos + x.criancas, 0) / doMes.length) : 0;
      document.getElementById('kFreq').innerHTML = `<div class="kpi"><b>${media}</b><span>Média de público no mês</span></div>
        <div class="kpi"><b>${doMes.reduce((s, x) => s + x.visitantes, 0)}</b><span>Visitantes no mês</span></div>
        <div class="kpi"><b>${doMes.reduce((s, x) => s + x.decisoes, 0)}</b><span>Decisões no mês</span></div>`;
    },
  }).carregar();
}
