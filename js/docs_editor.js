/* Documentos editáveis por pasta (atas, contratos, cartas): enviar Word/PDF, editar, salvar como revisão,
   ver/restaurar revisões, gerar novo a partir de outro e exportar em Word ou PDF.  abaDocsEditaveis(el, 'secretaria') */
const TIPOS_DOC_ED = [['ata', 'Ata'], ['contrato', 'Contrato'], ['contrato_imovel', 'Contrato de imóvel / locação'], ['carta', 'Carta'],
  ['oficio', 'Ofício'], ['declaracao', 'Declaração'], ['regimento', 'Regimento / estatuto'], ['outro', 'Outro']];
const nomeTipoDoc = t => (TIPOS_DOC_ED.find(x => x[0] === t) || [, t])[1];
let _DOCS_PASTA = null, _DOCS_EL = null;

async function abaDocsEditaveis(el, pasta) {
  _DOCS_PASTA = pasta; _DOCS_EL = el;
  let r;
  try { r = await api(`/docs?pasta=${pasta}`); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const podeCriar = r.pode_criar.includes(pasta);
  const modelos = r.documentos.filter(d => d.modelo);
  el.innerHTML = `<div class="note">Envie atas, contratos e cartas em <b>Word ou PDF</b>: o sistema lê o texto e deixa pronto para editar.
      Cada vez que você salva, fica uma <b>revisão</b> (dá para ver e voltar às anteriores). Depois é só imprimir, salvar em PDF ou baixar em Word para compartilhar.
      Para um documento parecido com outro (nova carta, novo contrato de locação), use <b>Gerar novo</b>.</div>
    ${podeCriar ? `<div class="row"><button class="btn pri" id="dcEnviar">⬆ Enviar Word ou PDF</button><button class="btn" id="dcNovo">+ Novo em branco</button>
      ${modelos.length ? '<button class="btn" id="dcModelo">📄 Novo a partir de modelo</button>' : ''}</div>` : ''}
    <div class="row"><input type="search" id="dcBusca" placeholder="Buscar pelo título" style="flex:1;min-width:160px">
      <select id="dcTipo"><option value="">Todos os tipos</option>${TIPOS_DOC_ED.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    <div id="dcLista"></div>`;
  const desenhar = () => {
    const q = (el.querySelector('#dcBusca').value || '').toLowerCase(), t = el.querySelector('#dcTipo').value;
    const lista = r.documentos.filter(d => (!q || d.titulo.toLowerCase().includes(q)) && (!t || d.tipo === t));
    el.querySelector('#dcLista').innerHTML = lista.length ? `<div class="tw"><table class="resp"><thead><tr><th>Documento</th><th>Tipo</th><th>Revisão</th><th>Última alteração</th><th></th></tr></thead><tbody>
      ${lista.map(d => `<tr><td data-l="Documento"><b>${esc(d.titulo)}</b>${d.modelo ? ' <span class="badge b-info">Modelo</span>' : ''}${d.status === 'final' ? ' <span class="badge b-ok">Final</span>' : ''}
          ${d.origem ? `<br><small style="color:var(--mut)">📎 de ${esc(d.origem)}</small>` : ''}</td>
        <td data-l="Tipo">${esc(nomeTipoDoc(d.tipo))}</td><td data-l="Revisão">${d.versao}</td>
        <td data-l="Alterado">${formatDate(d.atualizado_em)}<br><small style="color:var(--mut)">${esc(d.atualizado_por || '')}</small></td>
        <td class="acoes"><button class="btn sm pri" onclick="abrirDocEditor(${d.id})">Abrir</button>
          <button class="btn sm" onclick="baixarDocWord(${d.id})">Word</button><button class="btn sm" onclick="imprimirDoc(${d.id})">PDF</button>
          ${podeCriar ? `<button class="btn sm" onclick="gerarNovoDoc(${d.id})">Gerar novo</button>` : ''}
          ${pode(PERMS, pasta, 'deletar') ? `<button class="btn sm no" onclick="excluirDoc(${d.id})">Excluir</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="vazio">Nenhum documento ainda.</p>';
  };
  el.querySelector('#dcBusca').addEventListener('input', desenhar);
  el.querySelector('#dcTipo').addEventListener('change', desenhar);
  el.querySelector('#dcEnviar')?.addEventListener('click', () => enviarDoc(pasta));
  el.querySelector('#dcNovo')?.addEventListener('click', () => abrirFormulario({
    titulo: 'Novo documento', textoBotao: 'Criar e editar',
    campos: [{ k: 'titulo', label: 'Título', obrig: true, full: true }, { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: TIPOS_DOC_ED }],
    aoSalvar: async d => { const x = await api('/docs', { method: 'POST', body: { ...d, pasta } }); abrirDocEditor(x.id); },
  }));
  el.querySelector('#dcModelo')?.addEventListener('click', () => abrirFormulario({
    titulo: 'Novo a partir de modelo', textoBotao: 'Gerar',
    campos: [{ k: 'modelo', label: 'Modelo', tipo: 'select', obrig: true, full: true, opcoes: modelos.map(m => [m.id, m.titulo]) },
      { k: 'titulo', label: 'Título do novo documento', obrig: true, full: true }],
    aoSalvar: async d => { const x = await api(`/docs/${d.modelo}/duplicar`, { method: 'POST', body: { titulo: d.titulo } }); abrirDocEditor(x.id); },
  }));
  desenhar();
}
const recarregarDocs = () => _DOCS_EL && abaDocsEditaveis(_DOCS_EL, _DOCS_PASTA);

function enviarDoc(pasta) {
  const box = abrirModal(`<h2>Enviar Word ou PDF</h2><form id="fDoc">
    <div class="note">Word (.docx), PDF com texto ou .txt, até 20 MB. PDF escaneado (foto do papel) não tem texto para ler: guarde-o no Arquivo digital.</div>
    <div class="form-grid"><div class="full"><label class="l">Arquivo *</label><input type="file" name="arquivo" required accept=".docx,.pdf,.txt" style="width:100%"></div>
      <div class="full"><label class="l">Título (se vazio, usa o nome do arquivo)</label><input name="titulo" style="width:100%"></div>
      <div><label class="l">Tipo</label><select name="tipo">${TIPOS_DOC_ED.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div></div>
    <div class="acoes-form"><button class="btn pri">Enviar e abrir</button><button type="button" class="btn" onclick="fecharModal()">Cancelar</button></div></form>`);
  box.querySelector('#fDoc').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target); fd.set('pasta', pasta);
    const btn = e.target.querySelector('button.pri'); btn.disabled = true; btn.textContent = 'Lendo o documento...';
    try {
      const r = await fetch(`${API_URL}/docs/importar`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.token()}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || 'Falha ao enviar');
      showToast('✓ ' + j.msg); abrirDocEditor(j.id); recarregarDocs();
    } catch (err) { showToast('❌ ' + err.message); btn.disabled = false; btn.textContent = 'Enviar e abrir'; }
  });
}

/* ---------- Editor ---------- */
const BARRA = [['bold', '<b>N</b>', 'Negrito'], ['italic', '<i>I</i>', 'Itálico'], ['underline', '<u>S</u>', 'Sublinhado'], ['|'],
  ['formatBlock:h2', 'Título', 'Título'], ['formatBlock:h3', 'Subtítulo', 'Subtítulo'], ['formatBlock:p', 'Texto', 'Texto normal'], ['|'],
  ['insertUnorderedList', '• Lista', 'Lista com marcadores'], ['insertOrderedList', '1. Lista', 'Lista numerada'], ['|'],
  ['justifyLeft', '⯇', 'Alinhar à esquerda'], ['justifyCenter', '≡', 'Centralizar'], ['justifyRight', '⯈', 'Alinhar à direita'], ['justifyFull', '☰', 'Justificar'], ['|'],
  ['undo', '↶', 'Desfazer'], ['redo', '↷', 'Refazer']];

async function abrirDocEditor(id) {
  let d;
  try { d = await api(`/docs/${id}`); } catch (e) { showToast('❌ ' + e.message); return; }
  const ed = d.pode_editar;
  const box = abrirModal(`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <input id="edTitulo" value="${esc(d.titulo)}" style="flex:1;min-width:200px;font-size:17px;font-weight:600"${ed ? '' : ' disabled'}>
      <span class="badge">Revisão ${d.versao}</span>${d.origem ? `<button class="btn sm" onclick="baixarOriginal(${id})" title="Arquivo enviado originalmente">📎 Original</button>` : ''}</div>
    ${ed ? `<div class="ed-barra">${BARRA.map(([c, r, t]) => c === '|' ? '<span class="ed-sep"></span>' : `<button type="button" data-c="${c}" title="${t}">${r}</button>`).join('')}</div>` : ''}
    <div class="ed-folha" id="edTexto"${ed ? ' contenteditable="true"' : ''}>${d.conteudo || '<p></p>'}</div>
    ${ed ? `<div class="form-grid" style="margin-top:10px"><div class="full"><label class="l">O que mudou nesta revisão?</label>
        <input id="edComentario" placeholder="Ex.: Corrigida a data; incluída cláusula de reajuste" style="width:100%"></div>
      <div><label class="l">Situação</label><select id="edStatus"><option value="rascunho">Rascunho</option><option value="final"${d.status === 'final' ? ' selected' : ''}>Final (aprovado/assinado)</option></select></div>
      <div><label class="l">Usar como modelo</label><select id="edModelo"><option value="0">Não</option><option value="1"${d.modelo ? ' selected' : ''}>Sim (aparece em "Novo a partir de modelo")</option></select></div></div>` : ''}
    <div class="acoes-form">${ed ? '<button class="btn pri" id="edSalvar">💾 Salvar (nova revisão)</button>' : ''}
      <button class="btn" onclick="baixarDocWord(${id})">⬇ Word</button><button class="btn" onclick="imprimirDoc(${id})">🖨 PDF / imprimir</button>
      <button class="btn" onclick="revisoesDoc(${id})">🕘 Revisões</button><button class="btn" id="edFechar">Fechar</button></div>`);
  box.classList.add('mbox-largo');
  const texto = box.querySelector('#edTexto');
  let alterado = false;
  texto.addEventListener('input', () => { alterado = true; });
  box.querySelectorAll('.ed-barra button').forEach(b => b.addEventListener('mousedown', e => {
    e.preventDefault();
    const [cmd, arg] = b.dataset.c.split(':');
    document.execCommand(cmd, false, arg ? `<${arg}>` : null);
    texto.focus(); alterado = true;
  }));
  box.querySelector('#edFechar').onclick = () => { if (!alterado || confirm('Fechar sem salvar as alterações?')) { fecharModal(); recarregarDocs(); } };
  box.querySelector('#edSalvar')?.addEventListener('click', async ev => {
    ev.target.disabled = true;
    try {
      const r = await api(`/docs/${id}`, { method: 'PUT', body: { titulo: box.querySelector('#edTitulo').value, conteudo: texto.innerHTML,
        comentario: box.querySelector('#edComentario').value, status: box.querySelector('#edStatus').value, modelo: box.querySelector('#edModelo').value === '1' } });
      showToast('✓ ' + r.msg); alterado = false;
      box.querySelector('.badge').textContent = `Revisão ${r.versao}`;
      box.querySelector('#edComentario').value = '';
    } catch (e) { showToast('❌ ' + e.message); }
    ev.target.disabled = false;
  });
}

async function revisoesDoc(id) {
  let r;
  try { r = await api(`/docs/${id}/revisoes`); } catch (e) { showToast('❌ ' + e.message); return; }
  abrirModal(`<h2>Revisões</h2><p style="font-size:13px;color:var(--mut)">Cada salvamento fica guardado. Restaurar cria uma revisão nova com o texto antigo (nada se perde).</p>
    <div class="tw"><table><tr><th>Rev.</th><th>O que mudou</th><th>Quem</th><th>Quando</th><th></th></tr>
    ${r.revisoes.map((v, i) => `<tr><td><b>${v.versao}</b>${i === 0 ? ' <span class="badge b-ok">atual</span>' : ''}</td><td>${esc(v.comentario || '-')}</td><td>${esc(v.autor || '')}</td>
      <td style="white-space:nowrap">${new Date(v.data.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td class="acoes"><button class="btn sm" onclick="verRevisao(${id},${v.versao})">Ver</button>
        ${i ? `<button class="btn sm" onclick="restaurarRevisao(${id},${v.versao})">Restaurar</button>` : ''}</td></tr>`).join('')}</table></div>
    <div class="acoes-form"><button class="btn" onclick="abrirDocEditor(${id})">Voltar ao documento</button></div>`);
}
async function verRevisao(id, versao) {
  try {
    const v = await api(`/docs/${id}/revisoes/${versao}`);
    abrirModal(`<h2>Revisão ${versao}</h2><p style="font-size:13px;color:var(--mut)">${esc(v.comentario || '')} · ${esc(v.autor || '')}</p>
      <div class="ed-folha">${v.conteudo}</div>
      <div class="acoes-form"><button class="btn" onclick="revisoesDoc(${id})">Voltar às revisões</button>
        <a class="btn" href="#" onclick="baixarDocWord(${id}, ${versao});return false">⬇ Word desta revisão</a></div>`).classList.add('mbox-largo');
  } catch (e) { showToast('❌ ' + e.message); }
}
async function restaurarRevisao(id, versao) {
  if (!confirm(`Voltar o documento ao texto da revisão ${versao}? (fica registrado como uma revisão nova)`)) return;
  try { const r = await api(`/docs/${id}/restaurar/${versao}`, { method: 'POST' }); showToast('✓ ' + r.msg); abrirDocEditor(id); }
  catch (e) { showToast('❌ ' + e.message); }
}
async function gerarNovoDoc(id) {
  const titulo = prompt('Título do novo documento (ex.: Contrato de locação 2027 · Salão):');
  if (!titulo) return;
  try { const r = await api(`/docs/${id}/duplicar`, { method: 'POST', body: { titulo } }); showToast('✓ ' + r.msg); recarregarDocs(); abrirDocEditor(r.id); }
  catch (e) { showToast('❌ ' + e.message); }
}
async function excluirDoc(id) {
  if (!confirm('Excluir este documento e todas as revisões?')) return;
  try { await api(`/docs/${id}`, { method: 'DELETE' }); showToast('✓ Documento excluído'); recarregarDocs(); } catch (e) { showToast('❌ ' + e.message); }
}
async function _baixar(url, nomePadrao) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${Auth.token()}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Não foi possível baixar');
    const cd = r.headers.get('Content-Disposition') || '';
    const nome = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || cd.match(/filename="?([^";]+)/) || [, nomePadrao])[1]);
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: nome });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  } catch (e) { showToast('❌ ' + e.message); }
}
const baixarDocWord = (id, versao) => _baixar(`${API_URL}/docs/${id}/word${versao ? '?versao=' + versao : ''}`, 'documento.docx');
const baixarOriginal = id => _baixar(`${API_URL}/docs/${id}/original`, 'original');
async function imprimirDoc(id) {
  try {
    const d = await api(`/docs/${id}`);
    abrirModal(`<div class="paper"><div class="topo"><img src="img/logo.png" alt="Logo da igreja"></div>
        <h4>${esc(d.titulo.toUpperCase())}</h4><div class="ed-impressao">${d.conteudo}</div></div>
      <div class="acoes-form noprint"><button class="btn pri" onclick="window.print()">Imprimir / salvar em PDF</button><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  } catch (e) { showToast('❌ ' + e.message); }
}
