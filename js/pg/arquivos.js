/* Arquivo digital: scanners e fotos de documentos, guardados com título, categoria e validade.
   abaArquivos(el, filtro?)  · modalArquivosMembro(id, nome) */
const CATS_ARQ = ['ata', 'estatuto', 'contrato', 'escritura', 'certidao', 'alvara', 'avcb', 'seguro', 'nota_fiscal',
  'documento_membro', 'carta_recebida', 'oficio', 'outro'];

async function verArquivo(id, baixar = false) {
  try {
    const r = await fetch(`${API_URL}/arquivos/${id}/conteudo${baixar ? '?baixar=1' : ''}`, { headers: { Authorization: `Bearer ${Auth.token()}` } });
    if (!r.ok) throw new Error('Não foi possível abrir o arquivo');
    const url = URL.createObjectURL(await r.blob());
    if (baixar) {
      const nome = decodeURIComponent((r.headers.get('Content-Disposition') || '').match(/filename\*?=(?:UTF-8'')?"?([^";]+)/)?.[1] || 'arquivo');
      Object.assign(document.createElement('a'), { href: url, download: nome }).click();
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { showToast('❌ ' + e.message); }
}

function formEnviarArquivo(fixos = {}, aoTerminar) {
  const box = abrirModal(`<h2>Guardar documento</h2><form id="fArq">
    <div class="note">PDF, foto (JPG, PNG, HEIC) ou documento do Office, até 15 MB. No celular, dá para fotografar o documento na hora.</div>
    <div class="form-grid">
      <div class="full"><label class="l" for="arqTit">Título *</label><input id="arqTit" name="titulo" required placeholder="Ex.: Ata da assembleia de 10/03/2026" style="width:100%"></div>
      <div><label class="l" for="arqCat">Categoria</label><select id="arqCat" name="categoria">${CATS_ARQ.map(c => `<option value="${c}"${fixos.categoria === c ? ' selected' : ''}>${rotulo(c)}</option>`).join('')}</select></div>
      <div><label class="l" for="arqVenc">Validade / vencimento</label><input id="arqVenc" type="date" name="vencimento"></div>
      <div class="full"><label class="l" for="arqDesc">Descrição</label><textarea id="arqDesc" name="descricao"></textarea></div>
      <div class="full"><label class="l" for="arqFile">Arquivo *</label><input id="arqFile" type="file" name="arquivo" required accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.odt,.txt"></div>
    </div>
    <div class="acoes-form"><button class="btn pri">Guardar</button><button type="button" class="btn" onclick="fecharModal()">Cancelar</button></div></form>`);
  box.querySelector('#fArq').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.entries(fixos).forEach(([k, v]) => { if (v != null && k !== 'categoria') fd.set(k, v); });
    const btn = e.target.querySelector('button.pri'); btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const r = await fetch(`${API_URL}/arquivos`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.token()}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || 'Falha ao enviar');
      showToast('✓ ' + j.msg); fecharModal(); aoTerminar?.();
    } catch (err) { showToast('❌ ' + err.message); btn.disabled = false; btn.textContent = 'Guardar'; }
  });
}

function tabelaArquivos(lista, recarregar) {
  const podeEditar = pode(PERMS, 'secretaria', 'editar'), podeExcluir = pode(PERMS, 'secretaria', 'deletar');
  const hoje = hojeISO(), em60 = hojeISO(60);
  if (!lista.length) return '<p class="vazio">Nenhum documento guardado.</p>';
  window._ARQ_RECARREGAR = recarregar;
  window._ARQS = lista;
  return `<div class="tw"><table><tr><th>Documento</th><th>Categoria</th><th>Vínculo</th><th>Validade</th><th>Enviado</th><th></th></tr>
    ${lista.map(a => `<tr><td><b>${esc(a.titulo)}</b><br><small style="color:var(--mut)">${esc(a.nome_original || '')} · ${Math.ceil((a.tamanho || 0) / 1024)} KB</small></td>
      <td>${rotulo(a.categoria)}</td><td>${esc(a.membro_nome || a.contrato_descricao || a.congregacao_nome || '-')}</td>
      <td>${a.vencimento ? `${formatDate(a.vencimento)} ${a.vencimento < hoje ? '<span class="badge b-dev">Vencido</span>' : a.vencimento <= em60 ? '<span class="badge b-pend">Vence logo</span>' : ''}` : '-'}</td>
      <td>${formatDate(a.criado_em)}<br><small style="color:var(--mut)">${esc(a.enviado_por || '')}</small></td>
      <td class="acoes"><button class="btn sm pri" onclick="verArquivo(${a.id})">Abrir</button> <button class="btn sm" onclick="verArquivo(${a.id}, true)">⬇</button>
        ${podeEditar ? `<button class="btn sm" onclick="editarArquivo(${a.id})">Editar</button>` : ''}
        ${podeExcluir ? `<button class="btn sm no" onclick="excluirArquivo(${a.id})">Excluir</button>` : ''}</td></tr>`).join('')}</table></div>`;
}
function editarArquivo(id) {
  const a = window._ARQS.find(x => x.id === id);
  abrirFormulario({
    titulo: 'Dados do documento', valores: a,
    campos: [{ k: 'titulo', label: 'Título', obrig: true, full: true }, { k: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ops(CATS_ARQ) },
      { k: 'vencimento', label: 'Validade', tipo: 'date' }, { k: 'descricao', label: 'Descrição', tipo: 'textarea' }],
    aoSalvar: async d => { const r = await api(`/arquivos/${id}`, { method: 'PUT', body: { ...a, ...d } }); showToast('✓ ' + r.msg); window._ARQ_RECARREGAR(); },
  });
}
async function excluirArquivo(id) {
  if (!confirm('Excluir este documento? O arquivo será apagado.')) return;
  try { await api(`/arquivos/${id}`, { method: 'DELETE' }); showToast('✓ Documento excluído'); window._ARQ_RECARREGAR(); } catch (e) { showToast('❌ ' + e.message); }
}

async function abaArquivos(el) {
  const carregar = async () => {
    const q = el.querySelector('#arqBusca')?.value || '', cat = el.querySelector('#arqFiltro')?.value || '';
    let lista = [];
    try { lista = (await api(`/arquivos?${new URLSearchParams({ busca: q, categoria: cat })}`)).arquivos; } catch (e) { showToast('❌ ' + e.message); }
    el.querySelector('#arqLista').innerHTML = tabelaArquivos(lista, carregar);
  };
  el.innerHTML = `<div class="note">Guarde aqui a versão digital de atas, estatuto, escrituras, certidões, alvarás, AVCB, seguros, notas fiscais e documentos
      recebidos. Documentos com validade entram na central de alertas.</div>
    <div class="row"><input type="search" id="arqBusca" placeholder="Buscar por título ou descrição" style="flex:1;min-width:160px">
      <select id="arqFiltro"><option value="">Todas as categorias</option>${CATS_ARQ.map(c => `<option value="${c}">${rotulo(c)}</option>`).join('')}</select>
      ${pode(PERMS, 'secretaria', 'criar') ? '<button class="btn pri" id="arqNovo">+ Guardar documento</button>' : ''}</div><div id="arqLista"></div>`;
  el.querySelector('#arqBusca').addEventListener('input', () => { clearTimeout(el._t); el._t = setTimeout(carregar, 300); });
  el.querySelector('#arqFiltro').addEventListener('change', carregar);
  el.querySelector('#arqNovo')?.addEventListener('click', () => formEnviarArquivo({}, carregar));
  carregar();
}

async function modalArquivosMembro(id, nome) {
  const carregar = async () => {
    let lista = [];
    try { lista = (await api(`/arquivos?membro_id=${id}`)).arquivos; } catch (e) { showToast('❌ ' + e.message); return; }
    abrirModal(`<h2>Documentos de ${esc(nome)}</h2>
      <p style="font-size:13px;color:var(--mut)">RG, CPF, certidões, carta de transferência recebida, ficha assinada, termo de consentimento etc.</p>
      ${pode(PERMS, 'secretaria', 'criar') ? '<div class="row"><button class="btn pri" id="arqMembroNovo">+ Guardar documento</button></div>' : ''}
      ${tabelaArquivos(lista, carregar)}
      <div class="acoes-form"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
    document.getElementById('arqMembroNovo')?.addEventListener('click', () =>
      formEnviarArquivo({ membro_id: id, categoria: 'documento_membro' }, carregar));
  };
  carregar();
}

/** Tabela da central de alertas (/api/alertas). Usada na Secretaria e no Painel. */
function tabelaAlertas(al) {
  if (!al.length) return '<p class="vazio">Nenhum alerta no momento. 🙌</p>';
  const cor = { critico: 'b-dev', alto: 'b-pend', medio: 'b-pend', baixo: '', info: 'b-info' };
  const quando = a => a.tipo === 'aniversario' ? (a.dias === 0 ? 'Hoje' : a.dias === 1 ? 'Amanhã' : `em ${a.dias} dias`)
    : a.dias < 0 ? `vencido há ${-a.dias} dia(s)` : a.dias === 0 ? 'vence hoje' : `vence em ${a.dias} dia(s)`;
  const tipo = a => a.tipo === 'contrato' ? 'Contrato' : a.tipo === 'documento' ? `Documento · ${rotulo(a.categoria)}` : '🎂 Aniversário';
  return `<div class="tw"><table><tr><th>Alerta</th><th>Tipo</th><th>Data</th><th>Situação</th></tr>
    ${al.map(a => `<tr class="${a.nivel === 'critico' ? 'dev' : a.nivel === 'alto' ? 'pend' : ''}"><td>${a.link ? `<a href="${esc(a.link)}">${esc(a.titulo)}</a>` : esc(a.titulo)}</td>
      <td>${tipo(a)}</td><td>${formatDate(a.data)}</td><td><span class="badge ${cor[a.nivel] || ''}">${quando(a)}</span></td></tr>`).join('')}</table></div>`;
}
