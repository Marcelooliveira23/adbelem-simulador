/* Tesouraria: abas Caixa diário, Campanhas e Conciliação bancária (usadas por financeiro.js) */

/* ---------------- Caixa diário com dupla conferência ---------------- */
const CAMPOS_CAIXA = () => [
  { k: 'data', label: 'Data do culto', tipo: 'date', obrig: true, padrao: hojeISO() },
  { k: 'culto', label: 'Culto', tipo: 'select', obrig: true, opcoes: ['Culto de domingo (manhã)', 'Culto de domingo (noite)', 'Culto de oração',
    'Culto de ensino', 'Culto de jovens', 'Círculo de oração', 'Santa Ceia', 'Culto especial'].map(c => [c, c]) },
  { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
  { k: 'dizimos', label: 'Dízimos (R$)', tipo: 'number', passo: '0.01', min: 0, padrao: 0 },
  { k: 'ofertas', label: 'Ofertas (R$)', tipo: 'number', passo: '0.01', min: 0, padrao: 0 },
  { k: 'alcadas', label: 'Ofertas alçadas (R$)', tipo: 'number', passo: '0.01', min: 0, padrao: 0 },
  { k: 'outras', label: 'Outras contribuições (R$)', tipo: 'number', passo: '0.01', min: 0, padrao: 0 },
  { k: 'pix', label: 'Quanto do total veio por PIX (R$)', tipo: 'number', passo: '0.01', min: 0, padrao: 0 },
  { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
].filter(c => !(c.tipo === 'unidade' && _unidades.escopo));

async function abaCaixa(el) {
  let lista = [];
  try { lista = (await api('/tesouraria/caixa')).caixa; } catch (e) { showToast('❌ ' + e.message); }
  window._CAIXA = lista;
  const podeLancar = pode(PERMS, 'tesouraria', 'criar');
  const total = c => c.dizimos + c.ofertas + (c.alcadas || 0) + c.outras;
  const semana = hojeISO(-7);
  const recentes = lista.filter(c => c.data >= semana && c.status === 'conferido');
  el.innerHTML = `<div class="note">Cada culto gera um registro. Dízimos e ofertas são contados por <b>duas pessoas diferentes</b>;
      ao conferir, o sistema lança as receitas na Tesouraria automaticamente. Depois de conferido, o registro não muda.</div>
    <div class="kpis"><div class="kpi"><b>${formatMoney(recentes.reduce((s, c) => s + total(c), 0))}</b><span>Conferido nos últimos 7 dias</span></div>
      <div class="kpi"><b>${formatMoney(recentes.reduce((s, c) => s + c.pix, 0))}</b><span>Por PIX (7 dias)</span></div>
      <div class="kpi"><b>${lista.filter(c => c.status === 'aberto').length}</b><span>Cultos aguardando conferência</span></div></div>
    ${podeLancar ? '<div class="row"><button class="btn pri" onclick="formCaixa()">+ Registrar culto</button></div>' : ''}
    ${lista.length ? `<div class="tw"><table><tr><th>Data</th><th>Culto</th><th>Unidade</th><th>Dízimos</th><th>Ofertas</th><th>Outras</th><th>Total</th><th>Conferência</th><th></th></tr>
    ${lista.map(c => `<tr class="${c.status === 'aberto' ? 'pend' : ''}"><td>${formatDate(c.data)}</td><td>${esc(c.culto)}</td><td>${esc(c.congregacao_nome || 'Sede')}</td>
      <td>${formatMoney(c.dizimos)}</td><td>${formatMoney(c.ofertas)}</td><td>${formatMoney(c.outras)}</td><td><b>${formatMoney(total(c))}</b>${c.pix ? `<br><small style="color:var(--mut)">PIX ${formatMoney(c.pix)}</small>` : ''}</td>
      <td>${c.status === 'conferido' ? `<span class="badge b-ok">Conferido</span><br><small style="color:var(--mut)">${esc(c.conferente1)} e ${esc(c.conferente2)}</small>` : '<span class="badge b-pend">Aguardando</span>'}</td>
      <td class="acoes">${c.status === 'aberto' && podeLancar ? `<button class="btn sm ok" onclick="conferirCaixa(${c.id})">Conferir</button>
        <button class="btn sm" onclick="formCaixa(${c.id})">Editar</button> <button class="btn sm no" onclick="excluirCaixa(${c.id})">Excluir</button>` : ''}</td></tr>`).join('')}
    </table></div>` : '<p class="vazio">Nenhum culto registrado ainda.</p>'}`;
}
function formCaixa(id) {
  const c = id ? window._CAIXA.find(x => x.id === id) : null;
  abrirFormulario({
    titulo: c ? 'Editar caixa do culto' : 'Registrar caixa do culto', campos: CAMPOS_CAIXA(), valores: c || {},
    aoSalvar: async d => {
      const r = await api(c ? `/tesouraria/caixa/${c.id}` : '/tesouraria/caixa', { method: c ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaCaixa(document.getElementById('contrib'));
    },
  });
}
function conferirCaixa(id) {
  const c = window._CAIXA.find(x => x.id === id);
  abrirFormulario({
    titulo: 'Conferência do caixa', textoBotao: 'Confirmar conferência',
    antes: `<div class="note">${esc(c.culto)} · ${formatDate(c.data)}<br>Total: <b>${formatMoney(c.dizimos + c.ofertas + c.outras)}</b>
      (dízimos ${formatMoney(c.dizimos)}, ofertas ${formatMoney(c.ofertas)}, outras ${formatMoney(c.outras)})<br>
      Duas pessoas diferentes contaram e conferem estes valores.</div>`,
    campos: [{ k: 'conferente1', label: 'Conferente 1', obrig: true }, { k: 'conferente2', label: 'Conferente 2 (outra pessoa)', obrig: true }],
    aoSalvar: async d => {
      const r = await api(`/tesouraria/caixa/${id}/conferir`, { method: 'POST', body: d });
      showToast('✓ ' + r.msg); abaCaixa(document.getElementById('contrib')); tabela.carregar();
    },
  });
}
async function excluirCaixa(id) {
  if (!confirm('Excluir este registro de caixa?')) return;
  try { await api(`/tesouraria/caixa/${id}`, { method: 'DELETE' }); showToast('✓ Excluído'); abaCaixa(document.getElementById('contrib')); }
  catch (e) { showToast('❌ ' + e.message); }
}

/* ---------------- Campanhas (fundos com meta) ---------------- */
const TIPOS_CAMP = [['construcao', 'Construção / reforma'], ['missoes', 'Missões'], ['acao_social', 'Ação social'], ['especial', 'Oferta especial'], ['outro', 'Outro']];
async function abaCampanhas(el) {
  let lista = [];
  try { lista = (await api('/tesouraria/campanhas/resumo')).campanhas; } catch (e) { showToast('❌ ' + e.message); }
  window._CAMP = lista;
  const podeCriar = pode(PERMS, 'tesouraria', 'criar') && !_unidades.escopo;
  el.innerHTML = `<div class="note">Cada campanha é um <b>fundo próprio</b>. Ao lançar uma receita, escolha a campanha; ao pagar uma despesa com o fundo,
      o sistema impede gastar mais do que foi arrecadado quando o fundo é restrito.</div>
    ${podeCriar ? '<div class="row"><button class="btn pri" onclick="formCampanha()">+ Campanha</button></div>' : ''}
    ${lista.length ? `<div class="grid g2">${lista.map(c => {
      const pct = Math.min(100, c.percentual || 0);
      return `<div class="card"${c.ativo ? '' : ' style="opacity:.6"'}><h3>${esc(c.nome)}</h3>
        <small style="color:var(--mut)">${esc((TIPOS_CAMP.find(t => t[0] === c.tipo) || [, c.tipo])[1])}${c.fim ? ' · até ' + formatDate(c.fim) : ''}</small>
        ${c.meta ? `<div class="pbar" style="margin:8px 0"><i style="width:${pct}%"></i></div><b>${formatMoney(c.arrecadado)}</b> de ${formatMoney(c.meta)} (${c.percentual}%)`
          : `<p style="margin:8px 0"><b>${formatMoney(c.arrecadado)}</b> arrecadados</p>`}
        <p style="margin:6px 0 0;font-size:13px">Gasto: ${formatMoney(c.gasto)} · <b>Saldo do fundo: ${formatMoney(c.saldo)}</b></p>
        <p style="margin:6px 0 0">${c.restrito ? '<span class="badge b-P">Fundo restrito</span>' : '<span class="badge">Livre</span>'}
        ${c.ativo ? '' : ' <span class="badge">Encerrada</span>'}</p>
        ${podeCriar ? `<div class="row" style="margin:8px 0 0"><button class="btn sm" onclick="formCampanha(${c.id})">Editar</button></div>` : ''}</div>`;
    }).join('')}</div>` : '<p class="vazio">Nenhuma campanha cadastrada.</p>'}`;
}
function formCampanha(id) {
  const c = id ? window._CAMP.find(x => x.id === id) : null;
  abrirFormulario({
    titulo: c ? 'Editar campanha' : 'Nova campanha', valores: c ? { ...c, restrito: String(c.restrito), ativo: String(c.ativo) } : {},
    campos: [{ k: 'nome', label: 'Nome', obrig: true, full: true, placeholder: 'Ex.: Reforma do templo' },
      { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_CAMP }, { k: 'meta', label: 'Meta (R$)', tipo: 'number', passo: '0.01', min: 0 },
      { k: 'inicio', label: 'Início', tipo: 'date' }, { k: 'fim', label: 'Término', tipo: 'date' },
      { k: 'restrito', label: 'Uso do dinheiro', tipo: 'select', opcoes: [['1', 'Restrito à finalidade (recomendado)'], ['0', 'Livre']] },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Em andamento'], ['0', 'Encerrada']] },
      { k: 'descricao', label: 'Descrição', tipo: 'textarea' }],
    aoSalvar: async d => {
      const r = await api(c ? `/tesouraria/campanhas/${c.id}` : '/tesouraria/campanhas', { method: c ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaCampanhas(document.getElementById('contrib'));
    },
  });
}

/* ---------------- Conciliação bancária ---------------- */
function lerNumeroBR(v) {
  v = String(v || '').trim().replace(/[R$\s]/g, '');
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');   // 1.234,56
  return Number(v);
}
function lerDataBR(v) {
  v = String(v || '').trim();
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v.slice(0, 10);
}
/** Lê um CSV de extrato: colunas data; descrição; valor (aceita cabeçalho e formatos brasileiros). */
function lerExtratoCSV(txt) {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const partes = l => l.split(sep).map(x => x.replace(/^"|"$/g, '').trim());
  let iData = 0, iDesc = 1, iValor = 2, inicio = 0;
  const cab = partes(linhas[0]).map(x => x.toLowerCase());
  if (cab.some(x => /data|hist|descri|valor/.test(x))) {
    inicio = 1;
    iData = Math.max(0, cab.findIndex(x => x.includes('data')));
    const d = cab.findIndex(x => /hist|descri|lan/.test(x)); if (d >= 0) iDesc = d;
    const v = cab.findIndex(x => /valor|quantia|montante/.test(x)); if (v >= 0) iValor = v;
  }
  return linhas.slice(inicio).map(l => {
    const p = partes(l);
    return { data: lerDataBR(p[iData]), descricao: p[iDesc] || '', valor: lerNumeroBR(p[iValor]) };
  }).filter(l => l.data && l.valor);
}

async function abaConciliacao(el) {
  let r = { extrato: [], resumo: {} };
  try { r = await api('/tesouraria/extrato'); } catch (e) { showToast('❌ ' + e.message); }
  window._EXTRATO = r.extrato;
  const pend = r.extrato.filter(m => m.status === 'pendente');
  const outros = r.extrato.filter(m => m.status !== 'pendente');
  el.innerHTML = `<div class="note">Exporte o extrato do banco em planilha (CSV) com as colunas <b>data; descrição; valor</b>
      (saídas com valor negativo) e importe aqui. O sistema sugere o lançamento correspondente (mesmo valor, até 5 dias de diferença).</div>
    <div class="kpis"><div class="kpi"><b>${r.resumo.pendentes || 0}</b><span>Movimentos sem lançamento</span></div>
      <div class="kpi"><b>${r.resumo.conciliados || 0}</b><span>Conciliados</span></div></div>
    <div class="row"><label class="btn pri" style="cursor:pointer">⬆ Importar extrato (CSV)<input type="file" id="arqExtrato" accept=".csv,.txt" hidden></label></div>
    ${pend.length ? `<div class="card"><h3>Pendentes</h3><div class="tw"><table><tr><th>Data</th><th>Movimento no banco</th><th>Valor</th><th>Ação</th></tr>
      ${pend.map(m => `<tr class="pend"><td>${formatDate(m.data)}</td><td>${esc(m.descricao || '-')}</td>
        <td style="color:${m.valor > 0 ? 'var(--vd)' : 'var(--red)'}">${formatMoney(m.valor)}</td><td class="acoes" style="white-space:normal">
        ${m.sugestoes.map(s => `<button class="btn sm ok" onclick="conciliar(${m.id},'vincular',${s.id})" title="Vincular a este lançamento">↔ ${esc(s.descricao)} (${formatDate(s.data)})</button>`).join(' ')}
        <button class="btn sm" onclick="criarDoExtrato(${m.id})">+ Criar lançamento</button>
        <button class="btn sm no" onclick="conciliar(${m.id},'ignorar')">Ignorar</button></td></tr>`).join('')}</table></div></div>`
      : '<p class="vazio">Nenhum movimento pendente. 🙌</p>'}
    ${outros.length ? `<details class="card"><summary style="cursor:pointer"><b>Conciliados e ignorados (${outros.length})</b></summary><div class="tw" style="margin-top:8px"><table>
      <tr><th>Data</th><th>Movimento</th><th>Valor</th><th>Situação</th><th></th></tr>
      ${outros.map(m => `<tr><td>${formatDate(m.data)}</td><td>${esc(m.descricao || '-')}</td><td>${formatMoney(m.valor)}</td>
        <td>${m.status === 'conciliado' ? `<span class="badge b-ok">Conciliado</span><br><small>${esc(m.lancamento_descricao || '')}</small>` : '<span class="badge">Ignorado</span>'}</td>
        <td><button class="btn sm" onclick="conciliar(${m.id},'desfazer')">Desfazer</button></td></tr>`).join('')}</table></div></details>` : ''}`;
  document.getElementById('arqExtrato').addEventListener('change', async e => {
    const arq = e.target.files[0];
    if (!arq) return;
    const linhas = lerExtratoCSV(await arq.text());
    if (!linhas.length) { showToast('❌ Não encontrei linhas válidas (data; descrição; valor)'); return; }
    if (!confirm(`Importar ${linhas.length} movimento(s) do extrato?`)) return;
    try {
      const res = await api('/tesouraria/extrato/importar', { method: 'POST', body: { linhas } });
      showToast('✓ ' + res.msg + (res.erros.length ? ` (${res.erros.length} linha(s) com erro)` : ''));
      abaConciliacao(el);
    } catch (err) { showToast('❌ ' + err.message); }
  });
}
async function conciliar(id, acao, financeiro_id) {
  try {
    const r = await api(`/tesouraria/extrato/${id}`, { method: 'PATCH', body: { acao, financeiro_id } });
    showToast('✓ ' + r.msg); abaConciliacao(document.getElementById('contrib'));
  } catch (e) { showToast('❌ ' + e.message); }
}
function criarDoExtrato(id) {
  const m = window._EXTRATO.find(x => x.id === id);
  const receita = m.valor > 0;
  abrirFormulario({
    titulo: `Criar ${receita ? 'receita' : 'despesa'} a partir do extrato`, textoBotao: 'Criar e conciliar',
    antes: `<div class="note">${formatDate(m.data)} · ${formatMoney(m.valor)}</div>`,
    valores: { descricao: m.descricao },
    campos: [{ k: 'descricao', label: 'Descrição', obrig: true, full: true },
      { k: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ops(receita ? CAT_REC : CAT_DESP) }],
    aoSalvar: async d => {
      const r = await api(`/tesouraria/extrato/${id}`, { method: 'PATCH', body: { acao: 'criar', ...d } });
      showToast('✓ ' + r.msg); abaConciliacao(document.getElementById('contrib')); tabela.carregar();
    },
  });
}
