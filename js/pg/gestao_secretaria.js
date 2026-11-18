/* Secretaria · gestão: visitantes (acompanhamento até se tornarem membros) e departamentos/ministérios. */
const SIT_VISITANTE = ['novo', 'contatado', 'acompanhamento', 'integrado', 'membro', 'sem_interesse'];
const COMO_CONHECEU = [['convite', 'Convite de membro'], ['culto_rua', 'Culto ao ar livre / evangelismo'], ['redes', 'Redes sociais / internet'],
  ['passando', 'Passando em frente'], ['evento', 'Evento da igreja'], ['familia', 'Família'], ['outro', 'Outro']];
const corSit = { novo: 'b-pend', contatado: 'b-info', acompanhamento: 'b-info', integrado: 'b-ok', membro: 'b-ok', sem_interesse: '' };
const linkWhats = tel => {
  const n = String(tel || '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n.startsWith('55') ? n : '55' + n}` : '';
};

function abaVisitantes(el) {
  el.innerHTML = `<div class="note">Registre cada visitante no dia da visita. A equipe de acolhimento acompanha pelo status
      (novo → contatado → em acompanhamento → integrado) e, quando a pessoa decidir, "Tornar membro" cria o cadastro no Rol de membros.</div>
    <div class="kpis" id="kVis"></div><div id="tVis"></div>`;
  const podeMembro = pode(PERMS, 'membros', 'criar');
  new Tabela({
    el: '#tVis', rota: 'visitantes', modulo: 'secretaria', rotulo: 'visitante', novoLabel: 'Visitante',
    busca: ['nome', 'telefone', 'convidado_por', 'bairro'],
    filtros: [{ k: 'situacao', label: 'Todas as situações', opcoes: () => ops(SIT_VISITANTE) },
      ...(_unidades.unidades.length ? [{ k: 'congregacao_id', label: 'Todas as unidades', opcoes: () => _unidades.unidades.map(x => [x.id, x.nome]) }] : [])],
    colunas: [
      { k: 'data_visita', label: 'Visita', fmt: v => formatDate(v) },
      { k: 'nome', label: 'Visitante', fmt: (v, r) => `<b>${esc(v)}</b>${r.telefone ? `<br><small style="color:var(--mut)">${esc(r.telefone)}</small>` : ''}` },
      { k: 'congregacao_nome', label: 'Unidade', fmt: v => esc(v || 'Sede') },
      { k: 'convidado_por', label: 'Convidado por / como conheceu', fmt: (v, r) => [v, r.como_conheceu && (COMO_CONHECEU.find(c => c[0] === r.como_conheceu)?.[1] || r.como_conheceu)].filter(Boolean).map(esc).join('<br>') || '-' },
      { k: 'situacao', label: 'Situação', fmt: (v, r) => `<span class="badge ${corSit[v] || ''}">${esc(rotulo(v))}</span>${r.responsavel ? `<br><small style="color:var(--mut)">👤 ${esc(r.responsavel)}</small>` : ''}` },
    ],
    acoesExtras: r => [
      linkWhats(r.telefone) ? `<a class="btn sm" target="_blank" rel="noopener" href="${linkWhats(r.telefone)}" title="Abrir conversa no WhatsApp">WhatsApp</a>` : '',
      podeMembro && !r.membro_id ? `<button class="btn sm ok" onclick="visitanteParaMembro(${r.id})">Tornar membro</button>` : '',
    ].join(' '),
    campos: [
      { k: 'nome', label: 'Nome', obrig: true, full: true },
      { k: 'telefone', label: 'Celular / WhatsApp' }, { k: 'email', label: 'E-mail', tipo: 'email' },
      { k: 'data_visita', label: 'Data da visita', tipo: 'date', padrao: hojeISO() }, { k: 'congregacao_id', label: 'Visitou', tipo: 'unidade' },
      { k: 'bairro', label: 'Bairro' }, { k: 'convidado_por', label: 'Convidado por' },
      { k: 'como_conheceu', label: 'Como conheceu a igreja', tipo: 'select', vazio: '—', opcoes: COMO_CONHECEU },
      { k: 'igreja_atual', label: 'Frequenta alguma igreja?', placeholder: 'Nome da igreja, se houver' },
      { k: 'pedido_oracao', label: 'Pedido de oração', tipo: 'textarea' },
      { tipo: 'secao', label: 'Acompanhamento' },
      { k: 'situacao', label: 'Situação', tipo: 'select', opcoes: ops(SIT_VISITANTE) },
      { k: 'responsavel', label: 'Responsável pelo contato' },
      { k: 'ultimo_contato', label: 'Último contato', tipo: 'date' },
      { k: 'observacoes', label: 'Anotações do acompanhamento', tipo: 'textarea' },
    ],
    depoisCarregar: d => {
      const n = s => d.filter(v => v.situacao === s).length;
      const mes = hojeISO().slice(0, 7);
      document.getElementById('kVis').innerHTML = `
        <div class="kpi"><b>${d.filter(v => (v.data_visita || '').startsWith(mes)).length}</b><span>Visitantes neste mês</span></div>
        <div class="kpi" style="border-left-color:${n('novo') ? 'var(--red)' : 'var(--vd)'}"><b>${n('novo')}</b><span>Ainda sem contato</span></div>
        <div class="kpi"><b>${n('contatado') + n('acompanhamento')}</b><span>Em acompanhamento</span></div>
        <div class="kpi"><b>${n('integrado') + n('membro')}</b><span>Integrados / membros</span></div>`;
    },
  }).carregar();
}
async function visitanteParaMembro(id) {
  if (!confirm('Cadastrar este visitante no Rol de membros? Depois complete os dados (documentos, batismo etc.).')) return;
  try {
    const r = await api(`/visitantes/${id}/tornar-membro`, { method: 'POST' });
    showToast('✓ ' + r.msg);
    abaVisitantes(document.getElementById('conteudo'));
  } catch (e) { showToast('❌ ' + e.message); }
}

function abaDepartamentos(el) {
  el.innerHTML = `<div class="note">Departamentos, ministérios, conjuntos e comissões da igreja, com liderança e dia de reunião.
      No cadastro do membro, o campo "Ministérios" registra onde cada um serve.</div><div id="tDep"></div>`;
  new Tabela({
    el: '#tDep', rota: 'departamentos', modulo: 'secretaria', rotulo: 'departamento', novoLabel: 'Departamento',
    busca: ['nome', 'lider', 'vice_lider'],
    filtros: [{ k: 'tipo', label: 'Todos os tipos', opcoes: () => ops(['departamento', 'ministerio', 'conjunto', 'comissao']) }],
    colunas: [
      { k: 'nome', label: 'Nome', fmt: (v, r) => `<b>${esc(v)}</b>${r.ativo ? '' : ' <span class="badge">Inativo</span>'}<br><small style="color:var(--mut)">${esc(rotulo(r.tipo))}</small>` },
      { k: 'congregacao_nome', label: 'Unidade', fmt: v => esc(v || 'Sede') },
      { k: 'lider', label: 'Liderança', fmt: (v, r) => [v && `Líder: ${v}`, r.vice_lider && `Vice: ${r.vice_lider}`, r.secretario && `Secretário: ${r.secretario}`].filter(Boolean).map(esc).join('<br>') || '-' },
      { k: 'reunioes', label: 'Reuniões' },
      { k: 'participantes', label: 'Participantes', fmt: v => v ?? '-' },
    ],
    campos: [
      { k: 'nome', label: 'Nome', obrig: true, full: true, placeholder: 'Ex.: União de Mocidade, Círculo de Oração, Coral…' },
      { k: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ops(['departamento', 'ministerio', 'conjunto', 'comissao']) },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'lider', label: 'Líder' }, { k: 'vice_lider', label: 'Vice-líder' }, { k: 'secretario', label: 'Secretário(a)' },
      { k: 'reunioes', label: 'Reuniões', placeholder: 'Ex.: sábados, 19h' },
      { k: 'participantes', label: 'Nº de participantes', tipo: 'number', min: 0 },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo']], padrao: '1' },
      { k: 'descricao', label: 'Finalidade / observações', tipo: 'textarea' },
    ],
  }).carregar();
}
