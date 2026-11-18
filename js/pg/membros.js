/* 2 · Membros: rol da sede e das congregações, com "de acordo" da Secretaria para cadastros das congregações */
const main = document.getElementById('main');
const FUNC_VINC = {};   // membro_id -> {cargo, tipo} de quem também é funcionário/prestador da igreja
const seloFunc = id => FUNC_VINC[id] ? `<span class="badge b-info" title="Também é ${esc(FUNC_VINC[id].cargo || 'funcionário')} da igreja (cadastro da Tesouraria)">👔 Funcionário${FUNC_VINC[id].cargo ? ' · ' + esc(FUNC_VINC[id].cargo) : ''}</span> ` : '';
const FUNCOES = ['Membro', 'Cooperador(a)', 'Obreiro', 'Diácono', 'Diaconisa', 'Presbítero', 'Evangelista', 'Missionário(a)', 'Pastor'];

(async () => {
  window.PERMS = await iniciarLayout('membros');
  if (!PERMS) return;
  const u = await carregarUnidades();
  try { (await api('/funcionarios/vinculos')).vinculos.forEach(v => { FUNC_VINC[v.membro_id] = v; }); } catch (e) { /* sem vínculos */ }
  main.innerHTML = `<div class="ph"><h1>2.1 · Rol de membros</h1>${pode(PERMS, 'membros', 'criar') ? `<button class="btn" onclick="abrirImportador('membros', () => location.reload())">⬆ Importar de Excel ou banco antigo</button>` : ''}</div>
    ${u.escopo ? `<div class="note">Você vê e cadastra só os membros da ${esc(nomeUnidade(u.escopo))}. Cadastros novos aguardam o "de acordo" da Secretaria.</div>` : ''}
    <div class="kpis" id="kpis"></div><div id="t"></div>`;
  new Tabela({
    el: '#t', rota: 'membros', modulo: 'membros', rotulo: 'membro', novoLabel: 'Membro', aprovacao: true,
    busca: ['nome', 'email', 'telefone', 'celular', 'cpf'],
    filtros: [
      { k: 'status', label: 'Todas as situações', opcoes: () => ops(['ativo', 'inativo', 'visitante']) },
      { k: 'funcao', label: 'Todas as funções', opcoes: () => FUNCOES.map(f => [f, f]) },
      ...(u.escopo ? [] : [{ k: 'congregacao_id', label: 'Sede e todas as congregações', opcoes: () => u.unidades.map(x => [x.id, x.nome]) }]),
      { k: '_func', label: 'Funcionários e membros', opcoes: () => [['1', 'Só quem é funcionário']] },
      { k: 'aprovacao', label: 'Todos', opcoes: () => [['pendente', 'Aguardando de acordo'], ['devolvido', 'Devolvidos'], ['aprovado', 'Aprovados']] },
    ],
    campos: [
      { k: 'nome', label: 'Nome completo', obrig: true, full: true },
      { k: 'congregacao_id', label: 'Pertence a (Sede ou congregação)', tipo: 'unidade' },
      { k: 'status', label: 'Situação', tipo: 'select', opcoes: ops(['ativo', 'inativo', 'visitante']) },
      { tipo: 'secao', label: 'Dados pessoais' },
      { k: 'sexo', label: 'Sexo', tipo: 'select', opcoes: [['', '—'], ['F', 'Feminino'], ['M', 'Masculino']] },
      { k: 'data_nascimento', label: 'Nascimento', tipo: 'date' },
      { k: 'estado_civil', label: 'Estado civil', tipo: 'select', opcoes: [['', '—'], ...ops(['solteiro', 'casado', 'uniao_estavel', 'divorciado', 'viuvo'])] },
      { k: 'data_casamento', label: 'Data de casamento', tipo: 'date' },
      { k: 'conjuge', label: 'Cônjuge', full: true },
      { k: 'nome_pai', label: 'Nome do pai' }, { k: 'nome_mae', label: 'Nome da mãe' },
      { k: 'naturalidade', label: 'Naturalidade (cidade/UF)' }, { k: 'nacionalidade', label: 'Nacionalidade', padrao: 'Brasileira' },
      { k: 'cpf', label: 'CPF', placeholder: '000.000.000-00' }, { k: 'rg', label: 'RG' },
      { k: 'profissao', label: 'Profissão' },
      { k: 'escolaridade', label: 'Escolaridade', tipo: 'select', opcoes: [['', '—'], ...['Fundamental incompleto', 'Fundamental', 'Médio', 'Técnico', 'Superior', 'Pós-graduação'].map(x => [x, x])] },
      { tipo: 'secao', label: 'Contato e endereço' },
      { k: 'celular', label: 'Celular / WhatsApp' }, { k: 'telefone', label: 'Telefone fixo' },
      { k: 'email', label: 'E-mail', tipo: 'email', full: true },
      { k: 'cep', label: 'CEP' }, { k: 'endereco', label: 'Endereço (rua, número, complemento)', full: true },
      { k: 'bairro', label: 'Bairro' }, { k: 'cidade', label: 'Cidade', padrao: 'São José dos Campos' }, { k: 'estado', label: 'UF', padrao: 'SP' },
      { tipo: 'secao', label: 'Vida eclesiástica' },
      { k: 'funcao', label: 'Função / cargo', tipo: 'select', opcoes: FUNCOES.map(f => [f, f]) },
      { k: 'data_consagracao', label: 'Data de consagração', tipo: 'date' },
      { k: 'data_conversao', label: 'Data de conversão', tipo: 'date' },
      { k: 'data_batismo', label: 'Batismo nas águas', tipo: 'date' },
      { k: 'batismo_espirito', label: 'Batizado no Espírito Santo', tipo: 'select', opcoes: [['', '—'], ['sim', 'Sim'], ['nao', 'Não']] },
      { k: 'forma_admissao', label: 'Forma de admissão', tipo: 'select', opcoes: [['', '—'], ['batismo', 'Batismo'], ['transferencia', 'Carta de transferência'], ['aclamacao', 'Aclamação'], ['reconciliacao', 'Reconciliação']] },
      { k: 'data_admissao', label: 'Data de admissão', tipo: 'date' },
      { k: 'igreja_origem', label: 'Igreja de origem (se veio transferido)' },
      { k: 'ministerios', label: 'Ministérios / departamentos', full: true, placeholder: 'Ex.: Coral, Escola Dominical (professor), Mocidade' },
      { tipo: 'secao', label: 'Desligamento (se houver)' },
      { k: 'motivo_saida', label: 'Motivo', tipo: 'select', opcoes: [['', '—'], ...ops(['transferido', 'mudanca', 'falecimento', 'desligamento', 'a_pedido'])] },
      { k: 'data_saida', label: 'Data', tipo: 'date' },
      { tipo: 'secao', label: 'Observações e LGPD' },
      { k: 'observacoes', label: 'Observações', tipo: 'textarea' },
      { k: 'consentimento_lgpd', label: 'Consentimento para uso dos dados (LGPD)', tipo: 'select', full: true,
        opcoes: [['0', 'Ainda não assinado'], ['1', 'Assinado (guarde o termo em 📎 Documentos)']] },
    ],
    colunas: [
      { k: 'nome', label: 'Nome', fmt: (v, r) => `${seloFunc(r.id)}<strong>${esc(v)}</strong>` },
      { k: 'funcao', label: 'Função' },
      { k: 'congregacao_id', label: 'Pertence a', fmt: v => esc(nomeUnidade(v)) },
      { k: 'telefone', label: 'Telefone' },
      { k: 'status', label: 'Situação', fmt: v => `<span class="badge ${v === 'ativo' ? 'b-ok' : v === 'visitante' ? 'b-info' : ''}">${rotulo(v)}</span>` },
    ],
    acoesExtras: r => lgpdBotoes(r) + [
      pode(PERMS, 'membros', 'criar') ? `<button class="btn sm" title="Foto da carteirinha" onclick="fotoMembro(${r.id}, '${esc(r.nome).replace(/'/g, '&#39;')}')">📷</button>` : '',
      pode(PERMS, 'secretaria', 'consultar') ? `<button class="btn sm" title="Documentos digitalizados" onclick="modalArquivosMembro(${r.id}, '${esc(r.nome).replace(/'/g, '&#39;')}')">📎</button>` : '',
    ].join(' '),
    depoisCarregar: d => {
      d.forEach(m => { m._func = FUNC_VINC[m.id] ? '1' : '0'; });
      const ok = d.filter(m => (m.aprovacao || 'aprovado') === 'aprovado');
      document.getElementById('kpis').innerHTML = `
        <div class="kpi"><b>${ok.filter(m => m.status === 'ativo').length}</b><span>Membros ativos</span></div>
        <div class="kpi"><b>${ok.filter(m => (m.funcao || 'Membro') !== 'Membro').length}</b><span>Obreiros e ministério</span></div>
        <div class="kpi"><b>${ok.filter(m => m.status === 'visitante').length}</b><span>Visitantes</span></div>
        <div class="kpi"><b>${d.filter(m => m.aprovacao === 'pendente').length}</b><span>Aguardando de acordo</span></div>`;
    },
  }).carregar();
})();

/* ---------- Foto do membro (reduzida no aparelho antes de enviar) ---------- */
function reduzirImagem(arquivo, lado = 360) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, lado / Math.max(img.width, img.height));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * esc), height: Math.round(img.height * esc) });
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      ok(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => falha(new Error('Não foi possível ler a imagem'));
    img.src = URL.createObjectURL(arquivo);
  });
}
async function fotoMembro(id, nome) {
  let atual = null;
  try { atual = (await api(`/membros/${id}/foto`)).foto; } catch (e) { /* sem foto */ }
  const box = abrirModal(`<h2>Foto de ${nome}</h2>
    <div style="text-align:center"><img id="prev" alt="" style="max-width:180px;max-height:220px;border-radius:8px;border:1px solid var(--ln);${atual ? '' : 'display:none'}" src="${atual || ''}">
    ${atual ? '' : '<p class="vazio" id="semFoto">Sem foto.</p>'}</div>
    <p style="font-size:13px;color:var(--mut)">No celular, dá para tirar a foto na hora ou escolher da galeria. Use fundo claro e rosto centralizado.</p>
    <input type="file" id="arqFoto" accept="image/*">
    <div class="acoes-form"><button class="btn pri" id="btFoto" disabled>Salvar foto</button><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
  let dados = null;
  box.querySelector('#arqFoto').addEventListener('change', async e => {
    try {
      dados = await reduzirImagem(e.target.files[0]);
      const p = box.querySelector('#prev'); p.src = dados; p.style.display = '';
      box.querySelector('#semFoto')?.remove();
      box.querySelector('#btFoto').disabled = false;
    } catch (err) { showToast('❌ ' + err.message); }
  });
  box.querySelector('#btFoto').addEventListener('click', async () => {
    try { await api(`/membros/${id}/foto`, { method: 'PUT', body: { foto: dados } }); showToast('✓ Foto salva'); fecharModal(); }
    catch (err) { showToast('❌ ' + err.message); }
  });
}

/* ---------- LGPD: direito de acesso (exportar) e eliminação (anonimizar quem saiu) ---------- */
function lgpdBotoes(r) {
  const b = [];
  if (pode(PERMS, 'membros', 'editar')) b.push(`<button class="btn sm" title="Relatório dos dados pessoais (LGPD)" onclick="exportarTitular(${r.id})">LGPD</button>`);
  if (pode(PERMS, 'membros', 'deletar') && r.status === 'inativo' && !String(r.nome).startsWith('Titular anonimizado'))
    b.push(`<button class="btn sm no" onclick="anonimizarTitular(${r.id})">Anonimizar</button>`);
  return b.join(' ') + (b.length ? ' ' : '');
}
async function exportarTitular(id) {
  try {
    const r = await fetch(`${API_URL}/membros/${id}/dados-pessoais`, { headers: { Authorization: `Bearer ${Auth.token()}` } });
    if (!r.ok) throw new Error('Não foi possível gerar o relatório');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: `dados-membro-${id}.json` });
    a.click(); URL.revokeObjectURL(a.href); showToast('✓ Relatório do titular baixado (fica registrado no log)');
  } catch (e) { showToast('❌ ' + e.message); }
}
async function anonimizarTitular(id) {
  if (!confirm('Eliminar os dados pessoais deste ex-membro (nome, documentos, contatos, foto)? Os números históricos continuam. Não pode ser desfeito.')) return;
  try { const r = await api(`/membros/${id}/anonimizar`, { method: 'POST' }); showToast('✓ ' + r.msg); setTimeout(() => location.reload(), 900); }
  catch (e) { showToast('❌ ' + e.message); }
}
