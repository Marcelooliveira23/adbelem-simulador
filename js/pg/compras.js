/* Compras: pedido (Secretaria / Patrimônio) -> aprovação do Financeiro -> entrega (cobrança das congregações).
   abaCompras(el, 'pedir' | 'aprovar') */
const TIPOS_PEDIDO = [['revistas_ebd', 'Revistas da EBD'], ['material', 'Material'], ['servico', 'Serviço'], ['outro', 'Outro']];
const SELO_PEDIDO = { rascunho: 'badge', aguardando_aprovacao: 'badge b-pend', aprovado: 'badge b-info', reprovado: 'badge b-dev', entregue: 'badge b-ok' };
let _PEDIDOS = [];

async function abaCompras(el, modo) {
  await carregarUnidades();
  try { _PEDIDOS = (await api('/compras')).pedidos; } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const lista = modo === 'aprovar' ? _PEDIDOS.filter(p => p.status !== 'rascunho') : _PEDIDOS;
  const podePedir = pode(PERMS, 'compras', 'criar'), podeAprovar = pode(PERMS, 'compras', 'aprovar');
  el.innerHTML = `<div class="note">${modo === 'aprovar'
      ? 'Pedidos enviados pela Secretaria e pelo Patrimônio. Ao aprovar, a despesa entra na Tesouraria como "a pagar".'
      : 'Faça o pedido (ex.: revistas da EBD por congregação). O Financeiro aprova; na entrega, a parte de cada congregação pode ser cobrada no acerto dela.'}</div>
    ${modo === 'pedir' && podePedir ? '<div class="row"><button class="btn pri" onclick="formPedido()">+ Novo pedido</button></div>' : ''}
    ${lista.length ? lista.map(p => `<div class="card"><div class="row" style="margin:0;justify-content:space-between">
        <div><b>#${p.id} · ${esc(p.descricao)}</b> <span class="${SELO_PEDIDO[p.status]}">${rotulo(p.status)}</span><br>
        <small style="color:var(--mut)">${esc(rotulo(p.tipo))}${p.fornecedor ? ' · ' + esc(p.fornecedor) : ''} · pedido por ${esc(p.solicitante || '-')} em ${formatDate(p.criado_em)}
        ${p.decidido_por ? ` · ${p.status === 'reprovado' ? 'reprovado' : 'aprovado'} por ${esc(p.decidido_por)}` : ''}</small>
        ${p.motivo ? `<br><small>Motivo: ${esc(p.motivo)}</small>` : ''}</div><b style="font-size:18px">${formatMoney(p.valor_total)}</b></div>
      <div class="tw" style="margin-top:8px"><table><tr><th>Item</th><th>Destino</th><th>Qtd.</th><th>Valor unit.</th><th>Subtotal</th></tr>
        ${p.itens.map(i => `<tr><td>${esc(i.descricao)}</td><td>${esc(i.destino)}</td><td>${i.quantidade}</td><td>${formatMoney(i.valor_unitario)}</td>
        <td>${formatMoney(i.quantidade * i.valor_unitario)}</td></tr>`).join('')}</table></div>
      <div class="row" style="margin:8px 0 0">
        ${modo === 'pedir' && podePedir && ['rascunho', 'reprovado'].includes(p.status) ? `<button class="btn" onclick="formPedido(${p.id})">Editar</button>
          <button class="btn pri" onclick="acaoPedido(${p.id},'enviar')">Enviar para aprovação</button>
          <button class="btn no" onclick="excluirPedido(${p.id})">Excluir</button>` : ''}
        ${modo === 'pedir' && podePedir && p.status === 'aprovado' ? `<button class="btn ok" onclick="entregarPedido(${p.id})">Registrar entrega</button>` : ''}
        ${modo === 'aprovar' && podeAprovar && p.status === 'aguardando_aprovacao' ? `<button class="btn ok" onclick="decidirPedido(${p.id},'aprovar')">Aprovar</button>
          <button class="btn no" onclick="decidirPedido(${p.id},'reprovar')">Reprovar</button>` : ''}
      </div></div>`).join('') : `<p class="vazio">${modo === 'aprovar' ? 'Nenhum pedido enviado.' : 'Nenhum pedido ainda.'}</p>`}`;
  el.dataset.modo = modo;
}
const recarregarCompras = () => { const el = document.querySelector('[data-modo]'); if (el) abaCompras(el, el.dataset.modo); };

function linhaItem(i = {}) {
  const ops = [['', 'Sede'], ..._unidades.unidades.map(u => [u.id, u.nome])];
  return `<tr><td><input class="it-desc" value="${esc(i.descricao || '')}" placeholder="Ex.: Revista Adultos (aluno)" style="width:100%"></td>
    <td><select class="it-dest">${ops.map(([v, l]) => `<option value="${v}"${String(v) === String(i.congregacao_id ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
    <td><input class="it-qtd" type="number" min="0" step="1" value="${i.quantidade ?? ''}" style="width:70px"></td>
    <td><input class="it-val" type="number" min="0" step="0.01" value="${i.valor_unitario ?? ''}" style="width:90px"></td>
    <td><button type="button" class="btn sm no" onclick="this.closest('tr').remove();totalPedido()">✕</button></td></tr>`;
}
function totalPedido() {
  let t = 0;
  document.querySelectorAll('#itensPedido tr').forEach(tr => { t += (+tr.querySelector('.it-qtd').value || 0) * (+tr.querySelector('.it-val').value || 0); });
  document.getElementById('totPedido').textContent = formatMoney(t);
}
function formPedido(id) {
  const p = id ? _PEDIDOS.find(x => x.id === id) : { tipo: 'revistas_ebd', itens: [{}] };
  const box = abrirModal(`<h2>${id ? 'Editar pedido' : 'Novo pedido de compra'}</h2><form id="fPed">
    <div class="form-grid">
      <div><label class="l">Tipo</label><select name="tipo">${TIPOS_PEDIDO.map(([v, l]) => `<option value="${v}"${p.tipo === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="l">Período / referência</label><input name="periodo" value="${esc(p.periodo || '')}" placeholder="Ex.: 1º trimestre/2027"></div>
      <div class="full"><label class="l">Descrição *</label><input name="descricao" required value="${esc(p.descricao || '')}" placeholder="Ex.: Revistas da EBD 1º trimestre/2027"></div>
      <div class="full"><label class="l">Fornecedor</label><input name="fornecedor" value="${esc(p.fornecedor || '')}" placeholder="Ex.: CPAD"></div>
    </div>
    <label class="l">Itens (um por destino: Sede ou congregação)</label>
    <div class="tw"><table style="min-width:520px"><thead><tr><th>Item</th><th>Destino</th><th>Qtd.</th><th>Valor unit.</th><th></th></tr></thead>
    <tbody id="itensPedido">${(p.itens.length ? p.itens : [{}]).map(linhaItem).join('')}</tbody></table></div>
    <div class="row"><button type="button" class="btn sm" id="maisItem">+ Item</button><span style="flex:1"></span><b>Total: <span id="totPedido"></span></b></div>
    <label class="l">Observações</label><textarea name="observacoes">${esc(p.observacoes || '')}</textarea>
    <div class="acoes-form"><button class="btn" name="salvar">Salvar rascunho</button><button class="btn pri" name="enviar">Salvar e enviar para aprovação</button>
    <button type="button" class="btn" onclick="fecharModal()">Cancelar</button></div></form>`);
  box.querySelector('#maisItem').onclick = () => { box.querySelector('#itensPedido').insertAdjacentHTML('beforeend', linhaItem()); };
  box.querySelector('#itensPedido').addEventListener('input', totalPedido);
  totalPedido();
  box.querySelector('#fPed').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, enviar = e.submitter?.name === 'enviar';
    const itens = [...f.querySelectorAll('#itensPedido tr')].map(tr => ({
      descricao: tr.querySelector('.it-desc').value, congregacao_id: tr.querySelector('.it-dest').value,
      quantidade: tr.querySelector('.it-qtd').value, valor_unitario: tr.querySelector('.it-val').value,
    })).filter(i => i.descricao || i.quantidade);
    const body = { tipo: f.tipo.value, periodo: f.periodo.value, descricao: f.descricao.value, fornecedor: f.fornecedor.value,
      observacoes: f.observacoes.value, itens, enviar };
    try {
      const r = await api(id ? `/compras/${id}` : '/compras', { method: id ? 'PUT' : 'POST', body });
      if (id && enviar) await api(`/compras/${id}/enviar`, { method: 'POST' });
      showToast('✓ ' + (id && enviar ? 'Pedido enviado para aprovação' : r.msg)); fecharModal(); recarregarCompras();
    } catch (err) { showToast('❌ ' + err.message); }
  });
}
async function acaoPedido(id, acao) {
  try { const r = await api(`/compras/${id}/${acao}`, { method: 'POST' }); showToast('✓ ' + r.msg); recarregarCompras(); }
  catch (e) { showToast('❌ ' + e.message); }
}
async function excluirPedido(id) {
  if (!confirm('Excluir este pedido?')) return;
  try { await api(`/compras/${id}`, { method: 'DELETE' }); showToast('✓ Pedido excluído'); recarregarCompras(); } catch (e) { showToast('❌ ' + e.message); }
}
function decidirPedido(id, decisao) {
  const p = _PEDIDOS.find(x => x.id === id);
  abrirFormulario({
    titulo: decisao === 'aprovar' ? `Aprovar pedido #${id}` : `Reprovar pedido #${id}`, textoBotao: decisao === 'aprovar' ? 'Aprovar' : 'Reprovar',
    antes: `<div class="note">${esc(p.descricao)} · <b>${formatMoney(p.valor_total)}</b>${decisao === 'aprovar' ? '<br>A despesa será lançada na Tesouraria como "a pagar".' : ''}</div>`,
    campos: [{ k: 'motivo', label: decisao === 'aprovar' ? 'Observação (opcional)' : 'Motivo da reprovação', tipo: 'textarea', obrig: decisao !== 'aprovar' }],
    aoSalvar: async d => { const r = await api(`/compras/${id}/decidir`, { method: 'POST', body: { decisao, ...d } }); showToast('✓ ' + r.msg); recarregarCompras(); },
  });
}
function entregarPedido(id) {
  const p = _PEDIDOS.find(x => x.id === id);
  const temCong = p.itens.some(i => i.congregacao_id);
  abrirFormulario({
    titulo: `Registrar entrega · pedido #${id}`, textoBotao: 'Confirmar entrega',
    antes: `<div class="note">${esc(p.descricao)}${temCong ? '<br>Itens destinados a congregações podem ser cobrados delas: o valor entra como débito no próximo acerto de contas.' : ''}</div>`,
    campos: temCong ? [{ k: 'cobrar_congregacoes', label: 'Cobrar das congregações a parte de cada uma?', tipo: 'select', opcoes: [['1', 'Sim, lançar débito para cada congregação'], ['', 'Não cobrar']] }] : [],
    aoSalvar: async d => { const r = await api(`/compras/${id}/entregar`, { method: 'POST', body: { cobrar_congregacoes: !!d.cobrar_congregacoes } }); showToast('✓ ' + r.msg); recarregarCompras(); },
  });
}
