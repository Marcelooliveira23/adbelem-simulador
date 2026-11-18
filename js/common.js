/* Funções compartilhadas por todas as páginas da Intranet AD Belém */

// Quando servido pelo Flask usa a mesma origem (funciona no celular pela rede local).
// Se o HTML for aberto direto do disco (file://), cai no servidor local.
const API_URL = location.protocol === 'file:'
  ? 'http://localhost:5000/api'
  : `${location.origin}/api`;

const Auth = {
  token() {
    try { return localStorage.getItem('token'); } catch (e) { return null; }
  },
  salvar(token) {
    try { localStorage.setItem('token', token); } catch (e) { /* ignore */ }
  },
  /** Claims do JWT: sub, nome, email, perfil, perfil_id, exp */
  dados() {
    const t = this.token();
    if (!t) return null;
    try {
      const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64).split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  },
  valido() {
    const d = this.dados();
    return !!(d && d.exp && d.exp * 1000 > Date.now());
  },
  sair(motivo) {
    try { localStorage.removeItem('token'); localStorage.removeItem('ult_atividade'); } catch (e) { /* ignore */ }
    window.location.href = 'login.html' + (motivo ? `?m=${encodeURIComponent(motivo)}` : '');
  },
  /** Redireciona ao login se não houver sessão válida. */
  exigir() {
    if (!this.valido()) { this.sair(); return false; }
    return true;
  },
};

/** fetch autenticado: devolve o JSON ou lança Error com a mensagem do servidor. */
async function api(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  const token = Auth.token();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options = Object.assign({}, options, { body: JSON.stringify(options.body) });
  }

  let resp;
  try {
    resp = await fetch(`${API_URL}${path}`, Object.assign({}, options, { headers }));
  } catch (e) {
    throw new Error('Servidor indisponível. Verifique se o sistema está rodando.');
  }

  let data = null;
  try { data = await resp.json(); } catch (e) { /* resposta sem JSON */ }

  if (resp.status === 401 || resp.status === 422) {
    Auth.sair();
    throw new Error((data && data.sessao_encerrada && data.erro) || 'Sessão expirada');
  }
  if (resp.status === 403 && data && data.trocar_senha && !location.pathname.endsWith('conta.html')) {
    window.location.href = 'conta.html?obrigatorio=1';
    throw new Error(data.erro);
  }
  if (!resp.ok) {
    throw new Error((data && (data.erro || data.error || data.msg)) || `Erro ${resp.status}`);
  }
  return data;
}

/** Escapa texto para uso seguro dentro de innerHTML. */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatMoney(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
}

/**
 * Formata datas sem o erro de fuso: 'AAAA-MM-DD' é tratado como data local
 * e 'AAAA-MM-DD HH:MM:SS' (timestamps do SQLite) como UTC.
 */
function formatDate(v) {
  if (!v) return '-';
  const s = String(v);
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [a, m, dia] = s.split('-').map(Number);
    d = new Date(a, m - 1, dia);
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    d = new Date(s.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(s);
  }
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR');
}

/** Data de hoje no formato AAAA-MM-DD (fuso local). */
function hojeISO(offsetDias = 0, inicioMes = false) {
  const d = new Date();
  if (inicioMes) d.setDate(1);
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let _toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/** Nomes amigáveis para valores salvos no banco. */
const ROTULOS = {
  ativo: 'Ativo', inativo: 'Inativo', visitante: 'Visitante',
  dizimo: 'Dízimo', oferta: 'Oferta', evento: 'Evento', outro: 'Outro',
  manutencao: 'Manutenção', salario: 'Salário', agua_luz: 'Água/Luz', aluguel: 'Aluguel',
  pago: 'Pago', pendente: 'Pendente', confirmada: 'Confirmada',
  receita: 'Receita', despesa: 'Despesa',
  bom: 'Bom estado', descartado: 'Descartado',
  contrato: 'Contrato', aluguel: 'Aluguel', seguro: 'Seguro', servico: 'Serviço',
  dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', cartao: 'Cartão',
  campanha: 'Campanha', acao_social: 'Ação social', missoes: 'Missões', instrumento: 'Instrumento',
  aberto: 'Aberto', respondido: 'Respondido', encerrado: 'Encerrado', enviado: 'Enviado',
  rascunho: 'Rascunho', publicada: 'Publicada', indicado: 'Indicado', matriculado: 'Matriculado',
  desistente: 'Desistente', concluido: 'Concluído', aula: 'Aula', prova: 'Prova',
  oficial: 'Oficial', congregacao: 'Congregação', banda: 'Banda', recusado: 'Recusado',
  aprovado: 'Aprovado', devolvido: 'Devolvido',
  oferta_alcada: 'Oferta alçada', material_ebd: 'Revistas / material EBD', revistas_ebd: 'Revistas da EBD',
  aguardando_aprovacao: 'Aguardando aprovação', reprovado: 'Reprovado', entregue: 'Entregue',
  semanal: 'Semanal', mensal: 'Mensal', recebido: 'Recebido', divergente: 'Divergente', repasse: 'Repasse de congregação',
  limpeza: 'Limpeza', escritorio: 'Escritório', ebd: 'Escola Dominical', santa_ceia: 'Santa Ceia', copa: 'Copa / cozinha',
  entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', deposito: 'Depósito', quitado: 'Quitado',
  ata: 'Ata', estatuto: 'Estatuto', escritura: 'Escritura', certidao: 'Certidão', alvara: 'Alvará', avcb: 'AVCB (Bombeiros)',
  nota_fiscal: 'Nota fiscal', documento_membro: 'Documento de membro', carta_recebida: 'Carta recebida', oficio: 'Ofício',
  solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', uniao_estavel: 'União estável',
  aclamacao: 'Aclamação', reconciliacao: 'Reconciliação', transferido: 'Transferido', mudanca: 'Mudança',
  falecimento: 'Falecimento', desligamento: 'Desligamento', a_pedido: 'A pedido',
  imovel: 'Imóvel', movel: 'Móvel', eletronico: 'Eletrônico', veiculo: 'Veículo',
  tesouraria: 'Tesouraria', membros: 'Membros', patrimonio: 'Patrimônio',
  congregacoes: 'Congregações', relatorios: 'Relatórios', usuarios: 'Usuários',
  secretaria: 'Secretaria', conselho: 'Conselho Fiscal', mapa: 'Mapa', agenda: 'Agenda',
  ebd: 'Escola Dominical', depto: 'Departamentos', cfao: 'CFAO', cfo: 'Painel do CFO', admin: 'Administração',
  consultar: 'Consultar', criar: 'Criar', editar: 'Editar', deletar: 'Excluir', listar: 'Listar',
  emprestado: 'Emprestado', boleto: 'Boleto', debito_automatico: 'Débito automático', material: 'Material de consumo',
  novo: 'Novo (sem contato)', contatado: 'Contatado', acompanhamento: 'Em acompanhamento', integrado: 'Integrado',
  membro: 'Tornou-se membro', sem_interesse: 'Sem interesse', departamento: 'Departamento', ministerio: 'Ministério',
  conjunto: 'Conjunto / coral', comissao: 'Comissão', retorno: 'Retorno', emprestimo: 'Empréstimo', baixa: 'Baixa',
  caixa: 'Caixa', banco: 'Conta bancária', aplicacao: 'Aplicação', preventiva: 'Manutenção preventiva',
  encontrado: 'Encontrado', nao_encontrado: 'Não encontrado', danificado: 'Danificado', cadastros: 'Cadastros',
};
function rotulo(v) { return ROTULOS[v] || v || '-'; }
const hojeExtenso = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Módulos da intranet, na ordem e numeração do protótipo aprovado.
 * href: página já implementada; os demais abrem modulo.html (em construção).
 */
const MODULOS = [
  { k: 'painel', n: 'Painel', href: 'dashboard.html' },
  { k: 'cadastros', n: 'Cadastros', href: 'cadastros.html' },
  { k: 'tryout', n: '🧪 Tryout (testes)', href: 'tryout.html' },
  { k: 'tesouraria', n: '1 · Financeiro', href: 'financeiro.html' },
  { k: 'secretaria', n: '2 · Secretaria', href: 'secretaria.html' },
  { k: 'membros', n: '2.1 · Rol de membros', href: 'membros.html' },
  { k: 'patrimonio', n: '3 · Patrimônio', href: 'patrimonio.html' },
  { k: 'relatorios', n: '4 · Relatórios', href: 'relatorios.html' },
  { k: 'admin', n: '5 · Administração', href: 'admin.html' },
];
const NIVEIS = { C: 'Acesso completo', V: 'Somente consulta', E: 'Só a sua congregação' };

function moduloHref(m) {
  return m.href || `modulo.html?m=${m.k}`;
}

/**
 * Monta o cabeçalho (brasão, usuário, ☰, Sair) e o menu lateral com os módulos
 * que o perfil pode acessar. `moduloAtual` é a chave do módulo (ex.: 'membros').
 * Retorna as permissões vindas da API, ou null se não houver acesso.
 */
async function iniciarLayout(moduloAtual) {
  if (!Auth.exigir()) return null;

  const user = Auth.dados();
  const header = document.querySelector('header');
  const nav = document.getElementById('nav');

  if (!document.getElementById('layoutStyle')) {
    const st = document.createElement('style');
    st.id = 'layoutStyle';
    st.textContent = `
      header{gap:10px}
      header img.brasao{height:38px;width:auto}
      header .t{font-weight:600;font-size:14px;line-height:1.15;color:#fff;white-space:nowrap}
      header .t small{display:block;font-weight:400;opacity:.75;font-size:11.5px}
      header .ham{display:none;background:none;border:0;color:#fff;font-size:24px;cursor:pointer;padding:0 4px;line-height:1}
      nav .lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut,#6b7280);padding:8px 11px 4px}
      nav button.on{background:var(--go,#F5C000);font-weight:600}
      @media(max-width:860px){header .ham{display:block}header .t small{display:none}}`;
    document.head.appendChild(st);
  }

  if (header) {
    header.innerHTML = `
      <button class="ham" id="toggleNav" type="button" aria-label="Abrir menu">&#9776;</button>
      <img class="brasao" src="img/brasao.png" alt="Brasão da AD Belém">
      <div class="t">AD Belém SJC<small id="userInfo"></small></div>
      <div class="sp"></div>
      <a class="out" href="conta.html" title="Senha, verificação em duas etapas e acessos" style="text-decoration:none;margin-right:6px">Minha conta</a>
      <button class="out" id="logoutBtn" type="button">Sair</button>`;
    document.getElementById('userInfo').textContent = user ? `${user.nome} · ${user.perfil}` : '';
    document.getElementById('toggleNav').addEventListener('click', () => nav && nav.classList.toggle('open'));
    document.getElementById('logoutBtn').addEventListener('click', () => Auth.sair());
  }

  let perms = null;
  try {
    perms = await api('/dashboard/permissoes');
  } catch (e) {
    console.error(e);
    return null;
  }

  const permitidos = new Set(['painel', 'cadastros', 'tryout', 'conta', ...perms.modulos]);
  if (nav) {
    nav.innerHTML = MODULOS.filter(m => permitidos.has(m.k)).map(m =>
      `<button type="button" class="${m.k === moduloAtual ? 'on' : ''}" data-href="${moduloHref(m)}">${esc(m.n)}</button>`
    ).join('') + `<div class="lab">Perfil: ${esc(user.perfil)}</div>`;
    nav.querySelectorAll('button[data-href]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('on')) { nav.classList.remove('open'); return; }
        window.location.href = btn.dataset.href;
      });
    });
  }

  if (!permitidos.has(moduloAtual)) {
    showToast('Seu perfil não tem acesso a este módulo');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    return null;
  }
  return perms;
}

/** true se o usuário tem a permissão `modulo.acao` (a partir da resposta de iniciarLayout). */
function pode(perms, modulo, acao) {
  if (!perms) return false;
  return perms.permissoes.some(p => p.modulo === modulo && p.acao === acao && p.tem_acesso);
}

/* ---------- Segurança: sai sozinho após 30 minutos sem uso (vale para todas as abas abertas) ---------- */
const INATIVIDADE_MIN = 30;
(function vigiarInatividade() {
  if (/login\.html|verificar\.html/.test(location.pathname)) return;
  const marcar = () => { try { localStorage.setItem('ult_atividade', String(Date.now())); } catch (e) { /* ignore */ } };
  marcar();
  let ultimaMarca = 0;
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, () => {
    if (Date.now() - ultimaMarca > 15000) { ultimaMarca = Date.now(); marcar(); }
  }, { passive: true }));
  setInterval(() => {
    let ult = Date.now();
    try { ult = Number(localStorage.getItem('ult_atividade')) || Date.now(); } catch (e) { /* ignore */ }
    if (Auth.token() && Date.now() - ult > INATIVIDADE_MIN * 60000) Auth.sair('Sessão encerrada por inatividade');
  }, 60000);
})();
