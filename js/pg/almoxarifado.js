/* Patrimônio > Almoxarifado: materiais, entrada geral e saída controlada para as congregações */
const CATS_MAT = [['limpeza', 'Limpeza'], ['escritorio', 'Escritório'], ['ebd', 'Escola Dominical'], ['santa_ceia', 'Santa Ceia'],
  ['copa', 'Copa / cozinha'], ['manutencao', 'Manutenção'], ['outro', 'Outro']];
let _MATERIAIS = [];

async function abaAlmoxarifado(el) {
  let movs = [];
  try {
    _MATERIAIS = (await api('/almoxarifado/saldos')).materiais;
    movs = (await api('/almoxarifado/movimentos')).movimentos;
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeMov = pode(PERMS, 'patrimonio', 'criar');
  const baixos = _MATERIAIS.filter(m => m.abaixo_minimo);
  el.innerHTML = `<div class="note">Todo material entra no estoque geral da sede (compra ou doação) e sai com destino registrado
      (congregação ou pessoa que recebeu). O sistema não permite sair mais do que há em estoque.</div>
    <div class="kpis"><div class="kpi"><b>${_MATERIAIS.filter(m => m.ativo).length}</b><span>Materiais cadastrados</span></div>
      <div class="kpi" style="border-left-color:${baixos.length ? 'var(--red)' : 'var(--vd)'}"><b>${baixos.length}</b><span>Abaixo do estoque mínimo</span></div>
      <div class="kpi"><b>${formatMoney(_MATERIAIS.reduce((s, m) => s + Math.max(0, m.saldo) * (m.custo_medio || 0), 0))}</b><span>Valor em estoque (custo médio)</span></div></div>
    ${podeMov ? `<div class="row"><button class="btn pri" onclick="movMaterial('entrada')">⬇ Entrada</button>
      <button class="btn" onclick="movMaterial('saida')">⬆ Saída para congregação</button><span style="flex:1"></span>
      <button class="btn" onclick="formMaterial()">+ Material</button></div>` : ''}
    <div class="card"><h3>Estoque</h3>${_MATERIAIS.length ? `<div class="tw"><table><tr><th>Material</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th><th>Custo médio</th><th></th></tr>
      ${_MATERIAIS.map(m => `<tr class="${m.abaixo_minimo ? 'dev' : ''}"${m.ativo ? '' : ' style="opacity:.55"'}><td><b>${esc(m.nome)}</b></td><td>${esc((CATS_MAT.find(c => c[0] === m.categoria) || [, m.categoria])[1])}</td>
        <td><b>${m.saldo}</b> ${esc(m.unidade_medida)} ${m.abaixo_minimo ? '<span class="badge b-dev">Repor</span>' : ''}</td><td>${m.estoque_minimo || '-'}</td>
        <td>${m.custo_medio ? formatMoney(m.custo_medio) : '-'}</td><td class="acoes">${podeMov ? `<button class="btn sm" onclick="formMaterial(${m.id})">Editar</button>` : ''}</td></tr>`).join('')}
    </table></div>` : '<p class="vazio">Nenhum material cadastrado. Comece em "+ Material".</p>'}</div>
    <div class="card"><h3>Movimentações</h3>${movs.length ? `<div class="tw"><table><tr><th>Data</th><th>Material</th><th>Tipo</th><th>Qtd.</th><th>Origem / destino</th><th>Recebido por</th><th>Registrado por</th></tr>
      ${movs.slice(0, 200).map(v => `<tr><td>${formatDate(v.data)}</td><td>${esc(v.material)}</td>
        <td><span class="badge ${v.tipo === 'entrada' ? 'b-ok' : v.tipo === 'saida' ? 'b-pend' : ''}">${rotulo(v.tipo)}</span></td>
        <td>${v.tipo === 'saida' ? '−' : '+'}${v.quantidade} ${esc(v.unidade_medida)}</td>
        <td>${esc(v.tipo === 'saida' ? (v.destino || 'Sede') : (v.origem || '-'))}</td><td>${esc(v.recebido_por || '-')}</td><td>${esc(v.criado_por || '-')}</td></tr>`).join('')}
    </table></div>` : '<p class="vazio">Nenhuma movimentação.</p>'}</div>`;
}

function formMaterial(id) {
  const m = id ? _MATERIAIS.find(x => x.id === id) : null;
  abrirFormulario({
    titulo: m ? `Editar ${m.nome}` : 'Novo material', valores: m ? { ...m, ativo: String(m.ativo) } : { unidade_medida: 'un' },
    campos: [{ k: 'nome', label: 'Material', obrig: true, full: true, placeholder: 'Ex.: Copo descartável 200 ml (pacote)' },
      { k: 'categoria', label: 'Categoria', tipo: 'select', opcoes: CATS_MAT },
      { k: 'unidade_medida', label: 'Unidade', placeholder: 'un, cx, pct, L, kg' },
      { k: 'estoque_minimo', label: 'Estoque mínimo (alerta)', tipo: 'number', min: 0 },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo']] }],
    aoSalvar: async d => {
      const r = await api(m ? `/almoxarifado/materiais/${m.id}` : '/almoxarifado/materiais', { method: m ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaAlmoxarifado(document.getElementById('conteudo'));
    },
  });
}

function movMaterial(tipo) {
  const ativos = _MATERIAIS.filter(m => m.ativo);
  if (!ativos.length) { showToast('Cadastre um material primeiro'); return; }
  abrirFormulario({
    titulo: tipo === 'entrada' ? 'Entrada no estoque geral' : 'Saída controlada', textoBotao: tipo === 'entrada' ? 'Registrar entrada' : 'Registrar saída',
    valores: { data: hojeISO() },
    campos: [
      { k: 'material_id', label: 'Material', tipo: 'select', obrig: true, full: true, opcoes: ativos.map(m => [m.id, `${m.nome} (saldo ${m.saldo} ${m.unidade_medida})`]) },
      { k: 'quantidade', label: 'Quantidade', tipo: 'number', min: 0, passo: 'any', obrig: true },
      { k: 'data', label: 'Data', tipo: 'date' },
      ...(tipo === 'entrada'
        ? [{ k: 'valor_unitario', label: 'Valor unitário (R$)', tipo: 'number', passo: '0.01', min: 0 },
           { k: 'origem', label: 'Origem', placeholder: 'Compra (nota nº...), doação de...' }]
        : [{ k: 'destino_congregacao_id', label: 'Destino', tipo: 'select', opcoes: [['', 'Uso na Sede'], ..._unidades.unidades.map(u => [u.id, u.nome])] },
           { k: 'recebido_por', label: 'Recebido por', placeholder: 'Nome de quem retirou' }]),
      { k: 'observacao', label: 'Observação', tipo: 'textarea' }],
    aoSalvar: async d => {
      const r = await api('/almoxarifado/movimentos', { method: 'POST', body: { ...d, tipo } });
      showToast('✓ ' + r.msg); abaAlmoxarifado(document.getElementById('conteudo'));
    },
  });
}
