/* Patrimônio v1.2: espaços/ambientes, manutenção preventiva programada, etiquetas de tombo e depreciação. */

/** Valor atual pela depreciação linear (valor de compra × anos restantes ÷ vida útil). */
function valorAtual(b) {
  if (!b.valor || !b.vida_util_anos || !b.data_aquisicao) return null;
  const anos = (Date.now() - new Date(b.data_aquisicao + 'T12:00').getTime()) / (365.25 * 864e5);
  return Math.max(0, b.valor * (1 - anos / b.vida_util_anos));
}

function abaEspacos(el) {
  el.innerHTML = `<div class="note">Templo, salões, salas de aula, cozinha, estacionamento… Os espaços aparecem na agenda da Secretaria
      para reservar e evitar dois eventos no mesmo lugar e horário.</div><div id="tEsp"></div>`;
  new Tabela({
    el: '#tEsp', rota: 'espacos', modulo: 'patrimonio', rotulo: 'espaço', novoLabel: 'Espaço',
    busca: ['nome', 'recursos'],
    colunas: [{ k: 'nome', label: 'Espaço', fmt: (v, e) => `<b>${esc(v)}</b>${e.ativo ? '' : ' <span class="badge">Inativo</span>'}` },
      { k: 'congregacao_nome', label: 'Unidade', fmt: v => esc(v || 'Sede') }, { k: 'capacidade', label: 'Capacidade', fmt: v => v ? `${v} pessoas` : '-' },
      { k: 'recursos', label: 'Recursos' }],
    campos: [{ k: 'nome', label: 'Nome', obrig: true, full: true, placeholder: 'Ex.: Salão social' }, { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'capacidade', label: 'Capacidade (pessoas)', tipo: 'number', min: 0 }, { k: 'recursos', label: 'Recursos', full: true, placeholder: 'Som, projetor, ar-condicionado…' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo']], padrao: '1' }, { k: 'observacoes', label: 'Observações', tipo: 'textarea' }],
  }).carregar();
}

async function abaPreventivas(el) {
  let bens = [];
  try { bens = (await api('/patrimonio')).patrimonios.filter(b => b.status !== 'descartado'); } catch (e) { /* */ }
  el.innerHTML = `<div class="note">Manutenções que se repetem: filtros de ar-condicionado, extintores, para-raios, limpeza de caixa d'água, revisão do veículo…
      O Painel avisa quando vencem. Ao registrar a realizada, a próxima data é calculada sozinha.</div><div id="tPrev"></div>`;
  const hoje = hojeISO();
  window._TPREV = new Tabela({
    el: '#tPrev', rota: 'patrimonio/preventivas', chave: 'preventivas', modulo: 'patrimonio', rotulo: 'manutenção', novoLabel: 'Manutenção programada',
    busca: ['descricao', 'espaco', 'prestador'],
    colunas: [{ k: 'proxima_data', label: 'Próxima', fmt: v => `${formatDate(v)} ${v < hoje ? '<span class="badge b-dev">Vencida</span>' : v <= hojeISO(15) ? '<span class="badge b-pend">Em breve</span>' : ''}` },
      { k: 'descricao', label: 'Manutenção', fmt: (v, p) => `<b>${esc(v)}</b>${p.ativo ? '' : ' <span class="badge">Inativa</span>'}<br><small style="color:var(--mut)">${esc(bens.find(b => b.id === p.patrimonio_id)?.nome || p.espaco || '')}</small>` },
      { k: 'periodicidade_meses', label: 'Repetir', fmt: v => `a cada ${v} ${v === 1 ? 'mês' : 'meses'}` },
      { k: 'prestador', label: 'Prestador', fmt: (v, p) => esc([v, p.custo_estimado ? formatMoney(p.custo_estimado) : ''].filter(Boolean).join(' · ') || '-') },
      { k: 'ultima_data', label: 'Última', fmt: v => formatDate(v) }],
    acoesExtras: p => pode(PERMS, 'patrimonio', 'editar') && p.ativo ? `<button class="btn sm ok" onclick="preventivaFeita(${p.id})">Registrar realizada</button>` : '',
    campos: [{ k: 'descricao', label: 'O que fazer', obrig: true, full: true }, { k: 'patrimonio_id', label: 'Bem (opcional)', tipo: 'select', vazio: '—', opcoes: bens.map(b => [b.id, `${b.tombo ? b.tombo + ' · ' : ''}${b.nome}`]) },
      { k: 'espaco', label: 'Ou local', placeholder: 'Ex.: Templo principal' }, { k: 'periodicidade_meses', label: 'Repetir a cada (meses)', tipo: 'number', min: 1, obrig: true, padrao: 6 },
      { k: 'proxima_data', label: 'Próxima data', tipo: 'date', obrig: true }, { k: 'prestador', label: 'Prestador' },
      { k: 'custo_estimado', label: 'Custo estimado (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativa'], ['0', 'Inativa']], padrao: '1' }],
  });
  _TPREV.carregar();
}
function preventivaFeita(id) {
  abrirFormulario({
    titulo: 'Manutenção realizada', textoBotao: 'Registrar', valores: { data: hojeISO() },
    campos: [{ k: 'data', label: 'Data em que foi feita', tipo: 'date', obrig: true }, { k: 'custo', label: 'Custo (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'observacao', label: 'Observação', tipo: 'textarea' }],
    aoSalvar: async d => { const r = await api(`/patrimonio/preventivas/${id}/realizada`, { method: 'POST', body: d }); showToast('✓ ' + r.msg); _TPREV.carregar(); },
  });
}

const tomboDe = b => b.tombo || 'PAT-' + String(b.id).padStart(5, '0');
function etiquetaHTML(b, op) {
  const grande = op.tamanho === 'grande';
  return `<div class="etq-item" style="border:1px dashed #999;border-radius:6px;padding:${grande ? '10px 12px' : '6px 8px'};break-inside:avoid;background:#fff;color:#000">
    <div style="display:flex;gap:8px;align-items:center"><img src="img/brasao.png" alt="" style="width:${grande ? 30 : 22}px;height:${grande ? 30 : 22}px">
      <div style="line-height:1.2"><b style="font-size:${grande ? 16 : 13}px;letter-spacing:.04em">${esc(tomboDe(b))}</b><br>
      <small style="font-size:${grande ? 11.5 : 10}px">${esc(b.nome.slice(0, grande ? 46 : 32))}</small></div></div>
    ${op.barras ? `<div style="margin-top:4px">${codigoBarrasSVG(tomboDe(b), { altura: grande ? 42 : 30 })}</div>` : ''}
    ${op.unidade ? `<small style="font-size:${grande ? 10.5 : 9}px;color:#444">AD Belém SJC · ${esc(nomeUnidade(b.congregacao_id))}${b.local ? ' · ' + esc(b.local) : ''}</small>` : ''}</div>`;
}
const OP_ETQ = { tamanho: 'pequena', barras: true, unidade: true };
async function abaEtiquetas(el, apenas) {
  let bens = [];
  try { bens = (await api('/patrimonio')).patrimonios.filter(b => b.status !== 'descartado' && (b.aprovacao || 'aprovado') === 'aprovado'); } catch (e) { /* */ }
  const unidades = [...new Set(bens.map(b => b.congregacao_id || ''))];
  el.innerHTML = `<div class="note noprint">Etiquetas para colar nos bens, com número de tombo e <b>código de barras</b> (lido por leitor USB ou app de celular).
      Use papel adesivo A4 ou etiquetas avulsas; marque os bens e clique em Imprimir. Bens sem tombo recebem o número interno (PAT-00001).</div>
    <div class="row noprint"><select id="etTam"><option value="pequena">Etiqueta pequena (≈ 5 × 2,5 cm)</option><option value="grande">Etiqueta grande (≈ 7 × 4 cm)</option></select>
      <label><input type="checkbox" id="etBar" checked> Código de barras</label><label><input type="checkbox" id="etUni" checked> Unidade e local</label>
      <select id="etFiltro"><option value="">Todas as unidades</option>${unidades.map(u => `<option value="${u}">${esc(nomeUnidade(u || null))}</option>`).join('')}</select>
      <span style="flex:1"></span><button class="btn pri" onclick="window.print()">🖨 Imprimir etiquetas</button></div>
    <div class="noprint" style="margin-bottom:10px"><label><input type="checkbox" id="etTodos"${apenas ? '' : ' checked'}> Marcar todos</label>
      <div style="columns:2;font-size:13px;margin-top:4px">${bens.map(b => `<label style="display:block"><input type="checkbox" class="etq" value="${b.id}" data-u="${b.congregacao_id || ''}"${!apenas || apenas === b.id ? ' checked' : ''}> ${esc(tomboDe(b))} · ${esc(b.nome)}</label>`).join('')}</div></div>
    <div id="etiquetas" style="display:grid;gap:6px"></div>`;
  const desenhar = () => {
    Object.assign(OP_ETQ, { tamanho: el.querySelector('#etTam').value, barras: el.querySelector('#etBar').checked, unidade: el.querySelector('#etUni').checked });
    const sel = new Set([...el.querySelectorAll('.etq:checked')].map(i => Number(i.value)));
    const box = el.querySelector('#etiquetas');
    box.style.gridTemplateColumns = `repeat(auto-fill,minmax(${OP_ETQ.tamanho === 'grande' ? 260 : 190}px,1fr))`;
    box.innerHTML = bens.filter(b => sel.has(b.id)).map(b => etiquetaHTML(b, OP_ETQ)).join('') || '<p class="vazio noprint">Marque os bens.</p>';
  };
  el.querySelector('#etTam').value = OP_ETQ.tamanho;
  ['#etTam', '#etBar', '#etUni'].forEach(id => el.querySelector(id).addEventListener('change', desenhar));
  el.querySelector('#etFiltro').addEventListener('change', e => {
    el.querySelectorAll('.etq').forEach(i => { i.checked = !e.target.value || i.dataset.u === e.target.value; }); desenhar();
  });
  el.querySelectorAll('.etq').forEach(i => i.addEventListener('change', desenhar));
  el.querySelector('#etTodos').addEventListener('change', e => { el.querySelectorAll('.etq').forEach(i => { i.checked = e.target.checked; }); desenhar(); });
  desenhar();
}
/** Etiqueta de um bem só (botão 🏷 na lista de bens). */
function etiquetaDoBem(b) {
  abrirModal(`<h2 class="noprint">Etiqueta: ${esc(b.nome)}</h2><div style="max-width:280px">${etiquetaHTML(b, { tamanho: 'grande', barras: true, unidade: true })}</div>
    <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">🖨 Imprimir</button><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}
