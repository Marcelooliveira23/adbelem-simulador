/* Financeiro > 🏦 Banco do Brasil: contas, PIX e depósitos recebidos automaticamente, simulador e configuração */
const MODO_ROTULO = { simulacao: 'Simulação (testes)', homologacao: 'Homologação BB (testes com o banco)', producao: 'Produção (contas reais)' };
let _timerBanco = null;

async function abaBanco(el) {
  clearInterval(_timerBanco);
  const podeBanco = pode(PERMS, 'tesouraria', 'banco');
  let st, mov, contas;
  try {
    [st, mov, contas] = await Promise.all([api('/banco/status'), api('/banco/movimentos?dias=30'), api('/banco/contas')]);
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  contas = contas.contas;
  window._CONTAS_BB = contas;
  const modo = st.config.bb_modo;
  const origemSelo = o => ({ simulacao: '<span class="badge b-pend">Simulado</span>', webhook: '<span class="badge b-info">Aviso do banco</span>',
    api: '<span class="badge b-ok">Consulta ao banco</span>' })[o] || o;

  el.innerHTML = `
    <div class="card" style="border-left:4px solid ${modo === 'producao' ? 'var(--vd)' : modo === 'homologacao' ? 'var(--az)' : 'var(--go)'}">
      <div class="row" style="margin:0"><div style="flex:1"><b>Conexão com o Banco do Brasil:</b> ${MODO_ROTULO[modo]}
        <br><small style="color:var(--mut)">${modo === 'simulacao' ? 'Use o simulador abaixo para testar. Os recebimentos simulados seguem exatamente o mesmo caminho dos reais.'
          : `Consulta automática a cada ${st.config.bb_intervalo_min || 5} min · última: ${st.ultima_sincronizacao ? new Date(st.ultima_sincronizacao.replace(' ', 'T') + 'Z').toLocaleString('pt-BR') : 'ainda não'}`}</small></div>
        ${podeBanco && modo !== 'simulacao' ? '<button class="btn" onclick="sincronizarBB()">⟳ Consultar agora</button>' : ''}
        ${podeBanco ? '<button class="btn" onclick="configurarBB()">⚙ Configurar</button>' : ''}</div></div>
    <div class="kpis"><div class="kpi" style="border-left-color:var(--vd)"><b>${formatMoney(mov.hoje.total)}</b><span>Recebido hoje (${mov.hoje.quantidade})</span></div>
      ${Object.entries(mov.hoje.por_conta).map(([c, v]) => `<div class="kpi"><b>${formatMoney(v)}</b><span>Hoje · ${esc(c)}</span></div>`).join('')}
      <div class="kpi"><b>${formatMoney(mov.movimentos.reduce((s, m) => s + m.valor, 0))}</b><span>Últimos 30 dias</span></div>
      <div class="kpi" style="border-left-color:${mov.movimentos.some(m => !m.classificado) ? 'var(--red)' : 'var(--vd)'}"><b>${mov.movimentos.filter(m => !m.classificado).length}</b><span>A classificar (sem pagador/mensagem)</span></div></div>
    <div class="grid g2">
      <div class="card"><h3>Contas monitoradas</h3>
        ${contas.length ? contas.map(c => `<div style="padding:8px 0;border-top:1px solid var(--ln)"><b>${esc(c.apelido)}</b> ${c.ativo ? '' : '<span class="badge">Inativa</span>'}
          <br><small>BB · ag. ${esc(c.agencia || '-')} · c/c ${esc(c.conta || '-')} · chave PIX ${esc(c.chave_pix || '-')}</small>
          <br><small>Sem mensagem, classifica como <b>${rotulo(c.categoria_padrao)}</b> · ${esc(nomeUnidade(c.congregacao_id))}</small>
          ${podeBanco ? `<br><button class="btn sm" onclick="formContaBB(${c.id})">Editar</button>
            <button class="btn sm" onclick="mostrarWebhook(${c.id})">Endereço do aviso (webhook)</button>` : ''}</div>`).join('')
          : '<p class="vazio">Nenhuma conta cadastrada.</p>'}
        ${podeBanco ? '<div class="row" style="margin-top:8px"><button class="btn pri" onclick="formContaBB()">+ Conta</button></div>' : ''}</div>
      ${podeBanco && contas.length ? `<div class="card"><h3>🧪 Simulador (teste da integração)</h3><form id="fSim"><div class="form-grid">
          <div><label class="l">Conta</label><select name="conta_id">${contas.filter(c => c.ativo).map(c => `<option value="${c.id}">${esc(c.apelido)}</option>`).join('')}</select></div>
          <div><label class="l">Tipo</label><select name="tipo"><option value="pix">PIX recebido</option><option value="deposito">Depósito</option></select></div>
          <div><label class="l">Valor (R$)</label><input name="valor" type="number" step="0.01" min="0.01" required></div>
          <div><label class="l">Nome do pagador</label><input name="pagador_nome" placeholder="Ex.: nome de um membro"></div>
          <div class="full"><label class="l">Mensagem do PIX</label><input name="mensagem" placeholder='Ex.: "dízimo", "oferta", "missões"'></div></div>
          <div class="acoes-form"><button class="btn pri">Simular recebimento</button></div></form>
          <p style="font-size:12.5px;color:var(--mut)">Dica: se o nome do pagador for igual ao de um membro, o dízimo já fica identificado.</p></div>` : ''}
    </div>
    <div class="card"><h3>Recebimentos (últimos 30 dias)</h3>
      ${mov.movimentos.length ? `<div class="tw"><table><tr><th>Data e hora</th><th>Conta</th><th>Tipo</th><th>Pagador</th><th>Mensagem</th><th>Categoria</th><th>Valor</th><th>Origem</th><th></th></tr>
      ${mov.movimentos.map(m => `<tr><td style="white-space:nowrap">${m.horario ? new Date(m.horario).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
        <td>${esc(m.conta_apelido)}</td><td>${m.tipo === 'pix' ? 'PIX' : 'Depósito'}</td>
        <td>${esc(m.pagador_nome || '-')}${m.pagador_documento ? `<br><small style="color:var(--mut)">${esc(m.pagador_documento)}</small>` : ''}${m.membro_nome ? '<br><small>👤 membro identificado</small>' : ''}</td>
        <td>${esc(m.mensagem || '-')}</td><td>${rotulo(m.categoria)}${m.classificado ? '' : '<br><span class="badge b-dev">A classificar</span>'}${m.acerto_id ? '<br><span class="badge b-info">Acerto de congregação</span>' : ''}</td>
        <td><b style="color:var(--vd)">${formatMoney(m.valor)}</b></td><td>${origemSelo(m.origem)}</td>
        <td class="acoes">${!m.acerto_id && pode(PERMS, 'tesouraria', 'criar') ? `<button class="btn sm${m.classificado ? '' : ' pri'}" onclick="classificarMov(${m.id})">Classificar</button>` : ''}</td></tr>`).join('')}
      </table></div>` : '<p class="vazio">Nenhum recebimento ainda.</p>'}</div>`;

  document.getElementById('fSim')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { const r = await api('/banco/simular', { method: 'POST', body: d }); showToast('✓ ' + r.msg); abaBanco(el); tabela.carregar(); }
    catch (err) { showToast('❌ ' + err.message); }
  });
  window._MOVS_BB = mov.movimentos;
  // Atualiza sozinho enquanto a aba estiver aberta
  _timerBanco = setInterval(() => { if (!document.getElementById('contrib').hidden && document.querySelector('#abas .on')?.dataset.aba === 'banco') abaBanco(el); else clearInterval(_timerBanco); }, 30000);
}

function formContaBB(id) {
  const c = id ? window._CONTAS_BB.find(x => x.id === id) : null;
  abrirFormulario({
    titulo: c ? `Editar ${c.apelido}` : 'Nova conta monitorada', valores: c ? { ...c, ativo: String(c.ativo) } : { banco: '001' },
    campos: [{ k: 'apelido', label: 'Apelido', obrig: true, placeholder: 'Ex.: Conta A (dízimos)' },
      { k: 'categoria_padrao', label: 'Categoria quando o PIX vem sem mensagem', tipo: 'select', opcoes: ops(['dizimo', 'oferta', 'campanha', 'evento', 'outro']) },
      { k: 'agencia', label: 'Agência' }, { k: 'conta', label: 'Conta corrente' },
      { k: 'chave_pix', label: 'Chave PIX desta conta', full: true },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Monitorando'], ['0', 'Inativa']] }],
    aoSalvar: async d => {
      const r = await api(c ? `/banco/contas/${c.id}` : '/banco/contas', { method: c ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg); abaBanco(document.getElementById('contrib'));
    },
  });
}

function mostrarWebhook(id) {
  const c = window._CONTAS_BB.find(x => x.id === id);
  const url = `${location.origin}/api/banco/webhook/${c.token_webhook}`;
  abrirModal(`<h2>Aviso automático (webhook) · ${esc(c.apelido)}</h2>
    <p style="font-size:13.5px">Este é o endereço que o Banco do Brasil chama a cada PIX recebido. Ele é <b>secreto</b>: não compartilhe.</p>
    <input readonly value="${esc(url)}" style="width:100%" onclick="this.select()">
    <div class="note" style="margin-top:10px">Em produção o BB só envia avisos para endereço público HTTPS com certificado (mTLS).
    No servidor local da igreja, o recomendado é a <b>consulta automática</b> (não precisa de endereço público).</div>
    <p style="font-size:12.5px">Teste manual (desenvolvedor):</p>
    <pre style="font-size:11px;white-space:pre-wrap;background:#f6f6f6;padding:8px;border-radius:6px">curl -X POST "${esc(url)}" -H "Content-Type: application/json" -d '{"pix":[{"endToEndId":"E000TESTE${Date.now()}","valor":"10.00","horario":"${new Date().toISOString()}","pagador":{"nome":"Teste"},"infoPagador":"oferta"}]}'</pre>
    <div class="acoes-form"><button class="btn" onclick="fecharModal()">Fechar</button></div>`);
}

async function configurarBB() {
  const st = await api('/banco/status');
  abrirFormulario({
    titulo: 'Configurar conexão com o Banco do Brasil', valores: st.config,
    antes: `<div class="note">Obtenha as credenciais no <b>Portal Developers BB</b> (developers.bb.com.br), com a conta PJ da igreja:
      aplicação com a API Pix, <i>client id</i>, <i>client secret</i>, chave da aplicação e, em produção, o certificado digital da igreja.
      Comece em <b>Homologação</b>; só depois passe para <b>Produção</b>. Endereços em branco usam o padrão do sistema (confira no portal do BB).</div>`,
    campos: [
      { k: 'bb_modo', label: 'Modo', tipo: 'select', opcoes: Object.entries(MODO_ROTULO), full: true },
      { k: 'bb_client_id', label: 'Client ID' }, { k: 'bb_client_secret', label: 'Client Secret', tipo: 'password', ajuda: 'Em branco mantém o atual' },
      { k: 'bb_chave_app', label: 'Chave da aplicação (developer application key)' },
      { k: 'bb_intervalo_min', label: 'Consultar a cada (minutos)', tipo: 'number', min: 1, padrao: 5 },
      { k: 'bb_cert_path', label: 'Certificado (.pem) no servidor', full: true, placeholder: 'C:\\ProgramData\\IntranetADBelem\\cert\\igreja.pem' },
      { k: 'bb_key_path', label: 'Chave do certificado (.key) no servidor', full: true },
      { k: 'bb_oauth_url', label: 'URL OAuth (avançado)', full: true }, { k: 'bb_api_url', label: 'URL da API Pix (avançado)', full: true },
      { k: 'bb_param_chave_app', label: 'Nome do parâmetro da chave (avançado)', placeholder: 'gw-dev-app-key / gw-app-key' },
    ],
    aoSalvar: async d => { const r = await api('/banco/config', { method: 'PUT', body: d }); showToast('✓ ' + r.msg); abaBanco(document.getElementById('contrib')); },
  });
}

async function sincronizarBB() {
  try { const r = await api('/banco/sincronizar', { method: 'POST' }); showToast('✓ ' + r.msg); abaBanco(document.getElementById('contrib')); tabela.carregar(); }
  catch (e) { showToast('❌ ' + e.message); }
}

async function classificarMov(id) {
  const m = window._MOVS_BB.find(x => x.id === id);
  let membros = [];
  try { membros = (await api('/membros')).membros.filter(x => (x.aprovacao || 'aprovado') === 'aprovado'); } catch (e) { membros = []; }
  abrirFormulario({
    titulo: 'Classificar recebimento', textoBotao: 'Salvar classificação',
    antes: `<div class="note">${m.tipo === 'pix' ? 'PIX' : 'Depósito'} de <b>${formatMoney(m.valor)}</b> em ${new Date(m.horario).toLocaleString('pt-BR')}
      · pagador: ${esc(m.pagador_nome || 'não identificado')} · mensagem: ${esc(m.mensagem || '—')}<br>
      Se for o repasse de uma congregação, use <b>Congregações (acertos) › Receber</b> e escolha este PIX.</div>`,
    valores: { categoria: m.categoria, membro_id: m.membro_id || '' },
    campos: [
      { k: 'categoria', label: 'Categoria', tipo: 'select', opcoes: ops(['dizimo', 'oferta', 'oferta_alcada', 'campanha', 'evento', 'outro']) },
      { k: 'membro_id', label: 'Contribuinte (se identificado)', tipo: 'select', vazio: 'Não identificado', opcoes: membros.map(x => [x.id, x.nome]), full: true },
      { k: 'congregacao_id', label: 'Unidade', tipo: 'unidade' },
    ],
    aoSalvar: async d => { const r = await api(`/banco/movimentos/${id}/classificar`, { method: 'PATCH', body: d }); showToast('✓ ' + r.msg); abaBanco(document.getElementById('contrib')); tabela.carregar(); },
  });
}
