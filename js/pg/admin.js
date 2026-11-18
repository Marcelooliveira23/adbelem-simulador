/* Administração: usuários (TI = tudo; chefe da pasta = só a própria pasta), perfis, log de ações, sistema e senha */
const main = document.getElementById('main');
let PERFIS = [];

const NOME_PASTA = { tesouraria: 'Tesouraria', secretaria: 'Secretaria', patrimonio: 'Patrimônio', presidencia: 'Presidência', ti: 'TI' };
let PASTA_ADM = null;          // '*' = Administrador (TI); 'tesouraria' etc. = chefe daquela pasta
const perfisGerenciaveis = () => PERFIS.filter(p => p.gerenciavel);

async function abaUsuarios(el) {
  const podeCriar = perfisGerenciaveis().length > 0;
  let usuarios = [];
  try { usuarios = (await api('/admin/usuarios')).usuarios; } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const aviso = PASTA_ADM === '*' ? '' : PASTA_ADM
    ? `<div class="note">Você é o responsável pela pasta <b>${esc(NOME_PASTA[PASTA_ADM] || PASTA_ADM)}</b>: pode dar, alterar e remover acessos
        da sua pasta quando o TI não estiver disponível. Toda alteração fica registrada no log.</div>`
    : '<div class="note">Somente o Administrador (TI) e os responsáveis de cada pasta alteram contas.</div>';
  el.innerHTML = `${aviso}${podeCriar ? '<div class="row"><button class="btn pri" id="btNovo">+ Novo usuário</button></div>' : ''}
    <div class="tw"><table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Pasta</th><th>Situação</th><th>Segurança</th><th>Último acesso</th><th></th></tr>
    ${usuarios.map(u => `<tr${u.ativo ? '' : ' style="opacity:.55"'}><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(u.perfil)}</td>
      <td>${esc(NOME_PASTA[u.pasta || (u.perfil_id === 1 ? 'ti' : 'presidencia')] || u.pasta)}</td><td><span class="badge ${u.ativo ? 'b-ok' : ''}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${seloSeguranca(u)}</td>
      <td>${u.ultimo_login ? formatDate(u.ultimo_login) : '<span style="color:var(--mut)">nunca</span>'}</td>
      <td class="acoes">${u.gerenciavel ? `<button class="btn sm" onclick="formUsuario(${u.id})">Editar</button>
        ${bloqueado(u) || u.totp_ativo ? `<button class="btn sm" onclick="desbloquear(${u.id}, ${u.totp_ativo ? 1 : 0})">${bloqueado(u) ? 'Desbloquear' : 'Redefinir 2FA'}</button>` : ''}` : ''}</td></tr>`).join('')}</table></div>`;
  window._USUARIOS = usuarios;
  document.getElementById('btNovo')?.addEventListener('click', () => formUsuario());
}

const bloqueado = u => u.bloqueado_ate && u.bloqueado_ate > new Date().toISOString().slice(0, 19);
function seloSeguranca(u) {
  return [u.totp_ativo ? '<span class="badge b-ok" title="Verificação em duas etapas ativa">🔐 2FA</span>' : '',
    u.trocar_senha ? '<span class="badge b-pend" title="Ainda não trocou a senha provisória">Senha provisória</span>' : '',
    bloqueado(u) ? '<span class="badge b-dev">Bloqueada</span>' : ''].filter(Boolean).join(' ') || '-';
}
async function desbloquear(id, tem2fa) {
  const reset = tem2fa && confirm('Remover também a verificação em duas etapas desta conta? (use se a pessoa perdeu o celular)');
  try { const r = await api(`/admin/usuarios/${id}/desbloquear`, { method: 'POST', body: { reset_2fa: reset } }); showToast('✓ ' + r.msg); abaUsuarios(document.getElementById('conteudo')); }
  catch (e) { showToast('❌ ' + e.message); }
}

function formUsuario(id) {
  const u = id ? window._USUARIOS.find(x => x.id === id) : null;
  const opcoes = perfisGerenciaveis().map(p => [p.id, `${p.nome}${p.pasta && PASTA_ADM === '*' ? ` · ${NOME_PASTA[p.pasta] || p.pasta}` : ''}`]);
  abrirFormulario({
    titulo: u ? `Editar ${u.nome}` : 'Novo usuário',
    antes: '<div class="note">Escolha o nível de acesso: <b>chefe</b> (tudo na pasta e administra os acessos dela), <b>auxiliar</b> (lança e edita, não aprova nem exclui) ou <b>consulta</b> (só visualiza).</div>',
    campos: [
      { k: 'nome', label: 'Nome', obrig: true, full: true },
      { k: 'email', label: 'E-mail (login)', tipo: 'email', obrig: true, full: true },
      { k: 'perfil_id', label: 'Perfil / nível de acesso', tipo: 'select', opcoes, obrig: true, full: true },
      { k: 'senha', label: u ? 'Nova senha provisória (deixe em branco para manter)' : 'Senha provisória', tipo: 'password', obrig: !u,
        ajuda: '8+ caracteres, com letras e números. A pessoa cria a senha dela no primeiro acesso.' },
      { k: 'exigir_troca', label: 'No primeiro acesso', tipo: 'select', opcoes: [['1', 'Exigir que a pessoa troque a senha (recomendado)'], ['0', 'Não exigir']] },
      { k: 'ativo', label: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo (acesso removido)']], padrao: '1' },
    ],
    valores: u ? { ...u, ativo: String(u.ativo) } : {},
    aoSalvar: async d => {
      const r = await api(u ? `/admin/usuarios/${u.id}` : '/admin/usuarios', { method: u ? 'PUT' : 'POST', body: d });
      showToast('✓ ' + r.msg);
      abaUsuarios(document.getElementById('conteudo'));
    },
  });
}

/** Quadro de privilégios: o que cada nível da pasta pode fazer (✓) */
const ACOES_MATRIZ = [['consultar', 'Consultar e imprimir'], ['criar', 'Lançar / cadastrar'], ['editar', 'Alterar'], ['deletar', 'Excluir'],
  ['aprovar', 'Aprovar ("de acordo", compras, fechar o mês)'], ['contribuintes', 'Ver quem contribuiu (sigiloso)'], ['banco', 'Configurar o Banco do Brasil'],
  ['pasta', 'Dar e remover acessos da pasta']];
const MODULO_DA_PASTA = { tesouraria: 'tesouraria', secretaria: 'secretaria', patrimonio: 'patrimonio' };
function temPerm(p, mod, acao) {
  return p.permissoes.some(x => x === '*' || x === `${mod}.*` || x === `${mod}.${acao}` || (acao === 'pasta' && x === 'admin.pasta'));
}
function matrizPrivilegios(pasta, perfis) {
  const mod = MODULO_DA_PASTA[pasta];
  if (!mod) return '';
  const acoes = ACOES_MATRIZ.filter(([a]) => perfis.some(p => temPerm(p, mod, a)));
  return `<div class="card"><h3>Privilégios de cada nível · ${esc(NOME_PASTA[pasta] || pasta)}</h3><div class="tw"><table>
    <tr><th>O que pode fazer</th>${perfis.map(p => `<th style="text-align:center">${esc(p.nome)}</th>`).join('')}</tr>
    ${acoes.map(([a, rot]) => `<tr><td>${esc(rot)}</td>${perfis.map(p => `<td style="text-align:center">${temPerm(p, mod, a) ? '<b style="color:var(--vd)">✓</b>' : '<span style="color:var(--mut)">—</span>'}</td>`).join('')}</tr>`).join('')}
    </table></div><p style="font-size:12.5px;color:var(--mut);margin-bottom:0">Para dar um nível a alguém: aba "Usuários e acessos" › Novo usuário (ou Editar) › Perfil.</p></div>`;
}

async function abaPerfis(el) {
  let m;
  try { m = await api('/admin/perfis/matriz'); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const grupoDe = p => p.pasta || (p.id === 1 ? 'ti' : 'presidencia');
  const grupos = {};
  m.perfis.forEach(p => (grupos[grupoDe(p)] ||= []).push(p));
  const ordem = ['presidencia', 'tesouraria', 'secretaria', 'patrimonio', 'ti'];
  const linhas = m.catalogo.flatMap(c => c.acoes.map(a => ({ chave: `${c.modulo}.${a.acao}`, area: c.nome, acao: a.rotulo })));
  el.innerHTML = `<div class="note">Ligue ✓ ou desligue o que cada nível pode fazer em cada área e clique em <b>Salvar</b>. A mudança vale na hora para todos
      os usuários daquele nível e fica registrada no log. O chefe de cada pasta ajusta os níveis auxiliar e consulta da sua pasta;
      o Administrador (TI) ajusta todos. "Restaurar padrão" volta ao que vem de fábrica.</div>
    ${Object.keys(grupos).sort((x, y) => ordem.indexOf(x) - ordem.indexOf(y)).map(g => {
      const ps = grupos[g];
      return `<div class="card"><h3>${esc(NOME_PASTA[g] || g)}</h3><div class="tw"><table class="mtz">
        <tr><th>Área · ação</th>${ps.map(p => `<th style="text-align:center">${esc(p.nome)}${p.personalizado ? '<br><span class="badge b-info">Personalizado</span>' : ''}</th>`).join('')}</tr>
        ${linhas.map((l, i) => `<tr${i && linhas[i - 1].area !== l.area ? ' class="mtz-grupo"' : ''}><td><small style="color:var(--mut)">${esc(l.area)}</small> · ${esc(l.acao)}</td>
          ${ps.map(p => { const on = p.permissoes.includes(l.chave), lib = p.liberaveis.includes(l.chave), dif = on !== p.padrao.includes(l.chave);
            return `<td style="text-align:center${dif ? ';background:#fff8dc' : ''}"><input type="checkbox" aria-label="${esc(p.nome)}: ${esc(l.area)} ${esc(l.acao)}"
              data-p="${p.id}" value="${l.chave}"${on ? ' checked' : ''}${p.editavel && (on || lib) ? '' : ' disabled'}></td>`; }).join('')}</tr>`).join('')}
        <tr><td></td>${ps.map(p => `<td style="text-align:center">${p.editavel ? `<button class="btn sm pri" onclick="salvarNivel(${p.id})">Salvar</button>
          ${p.personalizado ? `<br><button class="btn sm" style="margin-top:4px" onclick="restaurarNivel(${p.id})">Restaurar padrão</button>` : ''}`
          : `<small style="color:var(--mut)" title="${esc(p.motivo)}">🔒</small>`}</td>`).join('')}</tr>
      </table></div><p style="font-size:12px;color:var(--mut);margin:6px 0 0">Fundo amarelo = diferente do padrão de fábrica.</p></div>`;
    }).join('')}`;
}
async function salvarNivel(pid) {
  const permissoes = [...document.querySelectorAll(`input[data-p="${pid}"]:checked`)].map(i => i.value);
  try { const r = await api(`/admin/perfis/${pid}/permissoes`, { method: 'PUT', body: { permissoes } }); showToast('✓ ' + r.msg); abaPerfis(document.getElementById('conteudo')); }
  catch (e) { showToast('❌ ' + e.message); }
}
async function restaurarNivel(pid) {
  if (!confirm('Voltar este nível aos acessos padrão de fábrica?')) return;
  try { const r = await api(`/admin/perfis/${pid}/permissoes`, { method: 'DELETE' }); showToast('✓ ' + r.msg); abaPerfis(document.getElementById('conteudo')); }
  catch (e) { showToast('❌ ' + e.message); }
}

async function abaLog(el) {
  try {
    const { log } = await api('/admin/auditoria?limite=500');
    el.innerHTML = `<div class="row"><input type="search" id="qLog" placeholder="Filtrar por usuário, ação ou módulo..." style="flex:1"></div>
      <div class="tw"><table id="tLog"><tr><th>Data e hora</th><th>Usuário</th><th>Módulo</th><th>Ação</th><th>Detalhe</th></tr>
      ${log.map(l => `<tr><td style="white-space:nowrap">${new Date(l.data.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${esc(l.usuario_nome || '-')}</td><td>${esc(rotulo(l.modulo))}</td><td>${esc(l.acao)}</td><td>${esc(l.detalhe || '')}</td></tr>`).join('')}</table></div>`;
    document.getElementById('qLog').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#tLog tr:not(:first-child)').forEach(tr => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); });
    });
  } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; }
}

async function abaSistema(el) {
  const cfg = await fetch(`${API_URL}/config`).then(r => r.json());
  const podeEditar = pode(PERMS, 'admin', 'editar');
  el.innerHTML = `<div class="card"><h3>Modo de teste</h3>
    <p style="font-size:13.5px">Ligado, a tela de login mostra os perfis fictícios para qualquer pessoa entrar com um toque.
    <b>Desligue antes do uso real</b>, depois de criar os usuários verdadeiros na aba Usuários.</p>
    <p>Situação atual: <span class="badge ${cfg.modo_teste ? 'b-pend' : 'b-ok'}">${cfg.modo_teste ? 'Ligado (perfis de teste visíveis)' : 'Desligado (uso real)'}</span></p>
    ${podeEditar ? `<button class="btn ${cfg.modo_teste ? 'pri' : ''}" id="btModo">${cfg.modo_teste ? 'Desligar modo de teste' : 'Ligar modo de teste'}</button>` : ''}</div>
    <div class="card"><h3>Backup</h3><p style="font-size:13.5px">Baixa uma cópia completa do banco de dados (todos os módulos).
    Guarde em local seguro; recomenda-se fazer toda semana.</p>
    ${podeEditar ? '<button class="btn pri" id="btBackup">⬇ Baixar cópia do banco</button>' : '<p class="vazio">Somente o Administrador.</p>'}</div>`;
  document.getElementById('btModo')?.addEventListener('click', async () => {
    if (cfg.modo_teste && !confirm('Desligar o modo de teste? Os perfis fictícios somem da tela de login (as contas continuam existindo até você desativá-las).')) return;
    try { await api('/admin/config', { method: 'PUT', body: { modo_teste: !cfg.modo_teste } }); showToast('✓ Configuração salva'); abaSistema(el); }
    catch (e) { showToast('❌ ' + e.message); }
  });
  abaBackupsTryout(el);
  document.getElementById('btBackup')?.addEventListener('click', async () => {
    try {
      const r = await fetch(`${API_URL}/admin/backup`, { headers: { Authorization: `Bearer ${Auth.token()}` } });
      if (!r.ok) throw new Error('Não foi possível gerar o backup');
      const nome = (r.headers.get('Content-Disposition') || '').match(/filename=([^;]+)/)?.[1] || 'intranet-backup.db';
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: nome.replace(/"/g, '') });
      a.click(); URL.revokeObjectURL(a.href);
      showToast('✓ Backup baixado');
    } catch (e) { showToast('❌ ' + e.message); }
  });
}

/* ---------- Painel de segurança ---------- */
async function abaSeguranca(el) {
  let s;
  try { s = await api('/admin/seguranca'); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  const item = (ok, txt) => `<li style="margin:4px 0">${ok ? '✅' : '⚠️'} ${txt}</li>`;
  el.innerHTML = `<div class="kpis">
      <div class="kpi"><b>${s.usuarios_ativos}</b><span>Contas ativas</span></div>
      <div class="kpi"><b>${s.com_2fa}</b><span>Com verificação em duas etapas</span></div>
      <div class="kpi" style="border-left-color:${s.log_integro.integro ? 'var(--vd)' : 'var(--red)'}"><b>${s.log_integro.integro ? 'Íntegro' : 'ALTERADO'}</b><span>Log de auditoria (${s.log_integro.verificados} registros verificados)</span></div>
      <div class="kpi"><b>${s.backups.length ? formatDate(s.backups[0].data) : 'nenhum'}</b><span>Último backup</span></div></div>
    <div class="grid g2"><div class="card"><h3>Checklist de segurança</h3><ul style="list-style:none;padding:0;font-size:14px">
      ${item(!s.modo_teste, s.modo_teste ? 'Modo de teste <b>ligado</b>: desligue antes da produção (aba Sistema).' : 'Modo de teste desligado.')}
      ${item(!s.chefes_sem_2fa.length, s.chefes_sem_2fa.length ? `Administradores e chefes de pasta sem 2FA: ${s.chefes_sem_2fa.map(x => esc(x.nome)).join(', ')}` : 'Todos os administradores usam 2FA.')}
      ${item(!s.senha_provisoria, s.senha_provisoria ? `${s.senha_provisoria} conta(s) ainda com senha provisória.` : 'Ninguém com senha provisória.')}
      ${item(!s.senha_antiga, s.senha_antiga ? `${s.senha_antiga} conta(s) sem trocar a senha há mais de 6 meses.` : 'Senhas atualizadas.')}
      ${item(s.log_integro.integro, s.log_integro.integro ? 'Log de auditoria íntegro e protegido contra alteração.' : `Log com quebra no registro #${s.log_integro.registro}: ${esc(s.log_integro.motivo)}`)}
      ${item(s.backups.length, s.backups.length ? `${s.backups.length}+ backups guardados (automático todo dia, mantém 30).` : 'Nenhum backup ainda.')}
    </ul></div>
    <div class="card"><h3>Proteções ativas</h3><ul style="font-size:13.5px;line-height:1.7;padding-left:18px">
      <li>Senha forte obrigatória (8+ caracteres, letras e números, sem nome/e-mail)</li>
      <li>Senha provisória: troca obrigatória no primeiro acesso</li>
      <li>Bloqueio da conta por 15 min após 5 senhas erradas, e do IP após 8</li>
      <li>Verificação em duas etapas (aplicativo autenticador)</li>
      <li>Saída automática após ${INATIVIDADE_MIN} min sem uso; sessão de no máximo 12 h</li>
      <li>Sessões encerradas ao trocar senha, perfil ou desativar a conta</li>
      <li>Permissões por pasta e nível (chefe, auxiliar, consulta)</li>
      <li>Log de auditoria encadeado (hash) e imutável</li>
      <li>Cabeçalhos de proteção do navegador (CSP, anti-clickjacking)</li>
      <li>Backup diário automático; LGPD: exportar e anonimizar dados do titular</li></ul></div></div>`;
}

async function abaAcessos(el) {
  let r;
  try { r = await api('/admin/acessos'); } catch (e) { el.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
  el.innerHTML = `<div class="kpis"><div class="kpi" style="border-left-color:${r.falhas_24h > 10 ? 'var(--red)' : 'var(--vd)'}"><b>${r.falhas_24h}</b><span>Tentativas erradas nas últimas 24 h</span></div>
      <div class="kpi"><b>${r.bloqueados.length}</b><span>Contas bloqueadas agora</span></div></div>
    <div class="row"><input type="search" id="qAc" placeholder="Filtrar por e-mail, nome ou IP" style="flex:1"></div>
    <div class="tw"><table id="tAc"><tr><th>Quando</th><th>Conta</th><th>Resultado</th><th>IP</th><th>Navegador</th></tr>
    ${r.acessos.map(a => `<tr${a.sucesso ? '' : ' class="dev"'}><td style="white-space:nowrap">${new Date(a.data.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${esc(a.nome || '')}<br><small style="color:var(--mut)">${esc(a.email || '')}</small></td><td>${a.sucesso ? '✓ ' : '✗ '}${esc(a.motivo || '')}</td>
      <td>${esc(a.ip || '')}</td><td><small>${esc((a.agente || '').slice(0, 60))}</small></td></tr>`).join('')}</table></div>`;
  document.getElementById('qAc').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#tAc tr:not(:first-child)').forEach(tr => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); });
  });
}

async function abaBackupsTryout(el) {
  let b = { backups: [] };
  try { b = await api('/admin/backups'); } catch (e) { /* sem permissão */ }
  const cfg = await fetch(`${API_URL}/config`).then(r => r.json());
  el.insertAdjacentHTML('beforeend', `<div class="card"><h3>Backups automáticos</h3>
      <p style="font-size:13.5px">O sistema guarda uma cópia do banco todo dia (mantém as 30 mais recentes) na pasta <code>${esc(b.pasta || '')}</code>.
      Recomendado: copiar um backup por semana para um pendrive ou nuvem da igreja.</p>
      <div class="row"><button class="btn pri" id="btBkNovo">Fazer backup agora</button></div>
      ${b.backups.length ? `<div class="tw"><table><tr><th>Arquivo</th><th>Data</th><th>Tamanho</th><th></th></tr>${b.backups.slice(0, 10).map(x =>
        `<tr><td>${esc(x.nome)}</td><td>${new Date(x.data).toLocaleString('pt-BR')}</td><td>${Math.ceil(x.tamanho / 1024)} KB</td>
         <td><button class="btn sm" onclick="baixarBackup('${esc(x.nome)}')">⬇ Baixar</button></td></tr>`).join('')}</table></div>` : '<p class="vazio">Nenhum backup ainda.</p>'}</div>
    ${cfg.modo_teste ? `<div class="card"><h3>🧪 Tryout (fase de testes)</h3>
      <p style="font-size:13.5px">Para o tryout ficar realista, gere dados de demonstração (membros, 3 meses de lançamentos, agenda, EBD, bens…).
      Os testadores seguem o roteiro na página <a href="tryout.html">Tryout</a> e marcam o que funcionou.</p>
      <button class="btn" id="btDemo">Gerar dados de demonstração</button></div>
    <div class="card" style="border:2px solid var(--red)"><h3>🚀 Preparar para produção</h3>
      <ol style="font-size:13.5px;line-height:1.7;padding-left:18px"><li>Faz um backup completo (para consulta futura do tryout).</li>
        <li>Apaga <b>todos</b> os dados lançados no teste (membros, lançamentos, bens, agenda, arquivos…).</li>
        <li>Mantém: usuários reais, plano de contas, modelos de cartas, configurações e o log de auditoria.</li>
        <li>Desativa as contas fictícias, desliga o modo de teste e exige troca da senha do admin.</li></ol>
      <label style="font-size:14px"><input type="checkbox" id="ckCong"> Manter as congregações cadastradas (marque se já são as reais)</label>
      <div class="row" style="margin-top:8px"><input id="txtProd" placeholder='Digite: INICIAR PRODUCAO' style="flex:1"><button class="btn no" id="btProd">Preparar para produção</button></div></div>`
      : '<div class="card"><h3>✅ Sistema em produção</h3><p style="font-size:13.5px">O modo de teste está desligado.</p></div>'}`);
  document.getElementById('btBkNovo').onclick = async () => {
    try { const r = await api('/admin/backups', { method: 'POST' }); showToast('✓ ' + r.msg); abaSistema(el); } catch (e) { showToast('❌ ' + e.message); }
  };
  document.getElementById('btDemo')?.addEventListener('click', async () => {
    try { const r = await api('/admin/demo', { method: 'POST' }); showToast('✓ ' + r.msg); } catch (e) { showToast('❌ ' + e.message); }
  });
  document.getElementById('btProd')?.addEventListener('click', async () => {
    if (!confirm('ATENÇÃO: todos os dados de teste serão apagados. Um backup será feito antes. Continuar?')) return;
    try {
      const r = await api('/admin/producao', { method: 'POST', body: { confirmacao: document.getElementById('txtProd').value, manter_congregacoes: document.getElementById('ckCong').checked } });
      alert(r.msg + `\n\nBackup: ${r.backup}`);
      Auth.sair('Sistema em produção. Entre com a conta de administrador.');
    } catch (e) { showToast('❌ ' + e.message); }
  });
}
async function baixarBackup(nome) {
  try {
    const r = await fetch(`${API_URL}/admin/backups/${encodeURIComponent(nome)}`, { headers: { Authorization: `Bearer ${Auth.token()}` } });
    if (!r.ok) throw new Error('Não foi possível baixar');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: nome });
    a.click(); URL.revokeObjectURL(a.href);
  } catch (e) { showToast('❌ ' + e.message); }
}

function abaSenha(el) {
  el.innerHTML = '<div class="card" style="max-width:520px"><h3>Minha conta</h3><p>Troca de senha, verificação em duas etapas e seus acessos ficam em <a href="conta.html">Minha conta</a>.</p></div>';
}

(async () => {
  window.PERMS = await iniciarLayout('admin');
  if (!PERMS) return;
  await carregarUnidades();
  const rp = await api('/admin/perfis');
  PERFIS = rp.perfis; PASTA_ADM = rp.pasta_administrada;
  main.innerHTML = '<div class="ph"><h1>Administração</h1></div><div class="tabs" id="abas"></div><div id="conteudo"></div>';
  montarAbas(document.getElementById('abas'), [{ k: 'u', n: 'Usuários e acessos' }, { k: 'p', n: '🔐 Níveis de acesso' },
    ...(pode(PERMS, 'admin', 'auditoria') ? [{ k: 'seg', n: '🛡️ Segurança' }, { k: 'ac', n: 'Acessos' }, { k: 'l', n: 'Log de ações' }] : []),
    ...(pode(PERMS, 'admin', 'editar') ? [{ k: 'sis', n: 'Sistema' }] : []), { k: 's', n: 'Minha senha' }],
    aba => ({ u: abaUsuarios, p: abaPerfis, seg: abaSeguranca, ac: abaAcessos, l: abaLog, sis: abaSistema, s: abaSenha })[aba](document.getElementById('conteudo')));
})();
