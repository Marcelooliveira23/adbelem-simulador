/* Componentes de tela reutilizáveis: janela (modal), formulário e tabela CRUD. Requer common.js. */

/* ---------- Unidades (Sede + congregações) ---------- */
let _unidades = null;
async function carregarUnidades() {
  if (!_unidades) {
    try { _unidades = await api('/unidades'); } catch (e) { _unidades = { unidades: [], escopo: null }; }
  }
  return _unidades;
}
function nomeUnidade(id) {
  if (!id) return 'Sede';
  const u = (_unidades?.unidades || []).find(x => x.id === Number(id));
  return u ? u.nome : `Congregação #${id}`;
}

/* ---------- Janela (modal) ---------- */
function abrirModal(html) {
  let m = document.getElementById('modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'modal';
    document.body.appendChild(m);
  }
  m.innerHTML = `<div class="mbox">${html}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m) fecharModal(); };
  document.querySelector('.layout')?.classList.add('modal-aberto');
  const f = m.querySelector('input:not([type=hidden]),select,textarea');
  if (f) setTimeout(() => f.focus(), 30);
  return m.querySelector('.mbox');
}
function fecharModal() {
  const m = document.getElementById('modal');
  if (m) { m.hidden = true; m.innerHTML = ''; }
  document.querySelector('.layout')?.classList.remove('modal-aberto');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

/* ---------- Formulário a partir de uma lista de campos ----------
   Campo: { k, label, tipo: text|email|number|date|time|select|textarea|unidade|password,
            opcoes: [[valor, rótulo]], obrig, full, passo, min, max, ajuda, padrao } */
function campoHTML(c, valor) {
  if (c.tipo === 'secao') {   // título de seção dentro do formulário
    return `<div class="full" style="margin-top:14px;padding-top:8px;border-top:1px solid var(--ln)"><b style="color:var(--bd);font-size:14px">${esc(c.label)}</b></div>`;
  }
  const v = valor ?? c.padrao ?? '';
  const req = c.obrig ? ' required' : '';
  const id = `f_${c.k}`;
  let input;
  if (c.tipo === 'select' || c.tipo === 'unidade') {
    let ops = c.opcoes || [];
    if (c.tipo === 'unidade') ops = [['', 'Sede'], ...(_unidades?.unidades || []).map(u => [u.id, u.nome])];
    if (c.vazio) ops = [['', c.vazio], ...ops];
    input = `<select id="${id}" name="${c.k}"${req}>${ops.map(([ov, ol]) =>
      `<option value="${esc(ov)}"${String(ov) === String(v ?? '') ? ' selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  } else if (c.tipo === 'textarea') {
    input = `<textarea id="${id}" name="${c.k}"${req}>${esc(v)}</textarea>`;
  } else {
    const extra = [c.passo ? `step="${c.passo}"` : '', c.min !== undefined ? `min="${c.min}"` : '',
      c.max !== undefined ? `max="${c.max}"` : '', c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''].join(' ');
    input = `<input id="${id}" name="${c.k}" type="${c.tipo || 'text'}" value="${esc(v)}" ${extra}${req}>`;
  }
  return `<div class="${c.full || c.tipo === 'textarea' ? 'full' : ''}"><label class="l" for="${id}">${esc(c.label)}${c.obrig ? ' *' : ''}</label>${input}${c.ajuda ? `<small style="color:var(--mut)">${esc(c.ajuda)}</small>` : ''}</div>`;
}
function formularioHTML(campos, valores = {}) {
  return `<div class="form-grid">${campos.map(c => campoHTML(c, valores[c.k])).join('')}</div>`;
}
function lerFormulario(raiz, campos) {
  const out = {};
  campos.forEach(c => {
    const el = raiz.querySelector(`[name="${c.k}"]`);
    if (el) out[c.k] = el.value;
  });
  return out;
}

/** Abre um formulário em janela; `aoSalvar(dados)` deve retornar uma Promise. */
function abrirFormulario({ titulo, campos, valores = {}, aoSalvar, textoBotao = 'Salvar', antes = '' }) {
  const box = abrirModal(`<h2>${esc(titulo)}</h2>${antes}<form id="fmodal">${formularioHTML(campos, valores)}
    <div class="acoes-form"><button class="btn pri" type="submit">${esc(textoBotao)}</button>
    <button class="btn" type="button" onclick="fecharModal()">Cancelar</button></div></form>`);
  const form = box.querySelector('#fmodal');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await aoSalvar(lerFormulario(form, campos));
      fecharModal();
    } catch (err) {
      showToast('❌ ' + err.message);
      btn.disabled = false;
    }
  });
  return box;
}

/* ---------- Selo de "de acordo" ---------- */
function seloAprovacao(row) {
  if (row.aprovacao === 'pendente') return ' <span class="badge b-pend">Aguardando de acordo</span>';
  if (row.aprovacao === 'devolvido') return ` <span class="badge b-dev" title="${esc(row.obs_aprovacao || '')}">Devolvido</span>`;
  return '';
}
async function decidirAprovacao(rota, id, status) {
  let obs = '';
  if (status === 'devolvido') {
    obs = prompt('Motivo da devolução (a congregação verá esta observação):') || '';
    if (!obs.trim()) return false;
  }
  const r = await api(`/${rota}/${id}/aprovacao`, { method: 'PATCH', body: { status, obs } });
  showToast('✓ ' + r.msg);
  return true;
}

/* ---------- Tabela CRUD ----------
   new Tabela({ el, rota, chave, modulo, titulo, rotulo, colunas, campos, busca, filtros, aprovacao,
                params, acoesExtras, depoisCarregar, ordenar }) */
class Tabela {
  constructor(cfg) {
    Object.assign(this, { busca: [], filtros: [], colunas: [], campos: [], params: () => ({}) }, cfg);
    this.dados = [];
    this.el = typeof cfg.el === 'string' ? document.querySelector(cfg.el) : cfg.el;
    this.perms = cfg.perms || window.PERMS;
  }
  pode(acao) { return pode(this.perms, this.modulo, acao); }

  async carregar() {
    const qs = new URLSearchParams(Object.entries(this.params()).filter(([, v]) => v !== '' && v != null)).toString();
    try {
      const r = await api(`/${this.rota}${qs ? '?' + qs : ''}`);
      this.dados = r[this.chave || this.rota.split('/').pop()] || [];
      if (this.depoisCarregar) this.depoisCarregar(this.dados, r);
    } catch (e) {
      showToast('❌ ' + e.message);
      this.dados = [];
    }
    this.render();
  }

  filtrados() {
    const q = (this.el.querySelector('.t-busca')?.value || '').trim().toLowerCase();
    const fil = {};
    this.el.querySelectorAll('.t-filtro').forEach(s => { if (s.value !== '') fil[s.dataset.k] = s.value; });
    return this.dados.filter(r =>
      (!q || this.busca.some(k => String(r[k] ?? '').toLowerCase().includes(q))) &&
      Object.entries(fil).every(([k, v]) => String(r[k] ?? '') === v));
  }

  render() {
    if (!this.el.querySelector('.t-corpo')) {
      const filtrosHTML = this.filtros.map(f => `<select class="t-filtro" data-k="${f.k}">
        <option value="">${esc(f.label)}</option>${f.opcoes().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`).join('');
      this.el.innerHTML = `<div class="row">
          ${this.busca.length ? `<input type="search" class="t-busca" placeholder="Buscar..." style="flex:1;min-width:160px">` : '<span style="flex:1"></span>'}
          ${filtrosHTML}
          <button class="btn t-csv" type="button" title="Baixar o que está na tela como planilha (abre no Excel)">⬇ Planilha</button>
          ${this.pode('criar') ? `<button class="btn pri t-novo" type="button">+ ${esc(this.novoLabel || 'Novo')}</button>` : ''}
        </div><div class="t-aviso"></div><div class="tw t-corpo"></div>`;
      this.el.querySelector('.t-busca')?.addEventListener('input', () => this.render());
      this.el.querySelectorAll('.t-filtro').forEach(s => s.addEventListener('change', () => this.render()));
      this.el.querySelector('.t-novo')?.addEventListener('click', () => this.abrir());
      this.el.querySelector('.t-csv').addEventListener('click', () => this.exportar());
    }
    const linhas = this.filtrados();
    const editar = this.pode('editar'), excluir = this.pode('deletar'), aprovar = this.aprovacao && this.pode('aprovar');
    const corpo = this.el.querySelector('.t-corpo');
    if (!linhas.length) {
      corpo.innerHTML = `<p class="vazio">${this.dados.length ? 'Nada encontrado com esses filtros.' : 'Nenhum registro ainda.'}</p>`;
      return;
    }
    corpo.innerHTML = `<table class="resp"><thead><tr>${this.colunas.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>${
      linhas.map(r => {
        const acoes = [
          aprovar && r.aprovacao === 'pendente' ? `<button class="btn sm ok" data-a="aprovado" data-id="${r.id}">De acordo</button> <button class="btn sm no" data-a="devolvido" data-id="${r.id}">Devolver</button>` : '',
          this.acoesExtras ? this.acoesExtras(r) : '',
          editar ? `<button class="btn sm" data-e="${r.id}">Editar</button>` : '',
          excluir ? `<button class="btn sm no" data-x="${r.id}">Excluir</button>` : '',
        ].filter(Boolean).join(' ');
        const cls = r.aprovacao === 'pendente' ? 'pend' : r.aprovacao === 'devolvido' ? 'dev' : '';
        return `<tr class="${cls}">${this.colunas.map((c, i) => `<td data-l="${esc(c.label)}">${c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k] ?? '-')}${i === 0 ? seloAprovacao(r) : ''}</td>`).join('')}<td class="acoes">${acoes}</td></tr>`;
      }).join('')}</tbody></table>`;
    corpo.querySelectorAll('[data-e]').forEach(b => b.onclick = () => this.abrir(this.dados.find(r => r.id === Number(b.dataset.e))));
    corpo.querySelectorAll('[data-x]').forEach(b => b.onclick = () => this.excluir(Number(b.dataset.x)));
    corpo.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      try { if (await decidirAprovacao(this.rota, Number(b.dataset.id), b.dataset.a)) this.carregar(); }
      catch (e) { showToast('❌ ' + e.message); }
    });
    if (this.posRender) this.posRender(corpo, linhas);
  }

  camposVisiveis() {
    // Usuário com escopo de congregação não escolhe a unidade: o servidor usa a dele
    return this.campos.filter(c => !(c.tipo === 'unidade' && _unidades?.escopo));
  }

  abrir(row) {
    const campos = this.camposVisiveis();
    abrirFormulario({
      titulo: row ? `Editar ${this.rotulo || ''}` : `Novo(a) ${this.rotulo || ''}`,
      campos, valores: row || {},
      antes: !row && _unidades?.escopo && this.aprovacao
        ? '<div class="note">O cadastro vai para o "de acordo" da sede antes de valer nos totais.</div>' : '',
      aoSalvar: async dados => {
        const r = await api(row ? `/${this.rota}/${row.id}` : `/${this.rota}`, { method: row ? 'PUT' : 'POST', body: dados });
        showToast('✓ ' + (r.msg || 'Salvo'));
        await this.carregar();
      },
    });
  }

  /** Exporta as linhas filtradas como CSV (separador ';' e BOM, para abrir direto no Excel em português). */
  exportar() {
    const linhas = this.filtrados();
    if (!linhas.length) { showToast('Nada para exportar'); return; }
    const tmp = document.createElement('div');
    const texto = (c, r) => {
      if (!c.fmt) return String(r[c.k] ?? '');
      tmp.innerHTML = c.fmt(r[c.k], r);
      return tmp.textContent.replace(/\s+/g, ' ').trim();
    };
    const celula = v => /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [this.colunas.map(c => c.label), ...linhas.map(r => this.colunas.map(c => texto(c, r)))]
      .map(l => l.map(celula).join(';')).join('\r\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })),
      download: `${this.rota.replace('/', '-')}-${hojeISO()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`✓ ${linhas.length} linha(s) exportada(s)`);
  }

  async excluir(id) {
    const r = this.dados.find(x => x.id === id);
    const nome = r?.nome || r?.titulo || r?.descricao || r?.item || `#${id}`;
    if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/${this.rota}/${id}`, { method: 'DELETE' });
      showToast('✓ Excluído');
      await this.carregar();
    } catch (e) { showToast('❌ ' + e.message); }
  }
}

/* ---------- Abas simples ---------- */
function montarAbas(el, abas, aoTrocar) {
  const pedida = new URLSearchParams(location.hash.slice(1)).get('aba');
  const inicial = (abas.find(a => a.k === pedida) || abas[0]).k;
  el.innerHTML = abas.map(a => `<button type="button" class="${a.k === inicial ? 'on' : ''}" data-aba="${a.k}">${esc(a.n)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    try { history.replaceState(null, '', `#aba=${b.dataset.aba}`); } catch (e) { /* ignore */ }
    aoTrocar(b.dataset.aba);
  }));
  el.querySelector('button.on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  // link para outra aba da mesma página (ex.: da Central de cadastros ou das pendências)
  if (el._aoHash) window.removeEventListener('hashchange', el._aoHash);
  el._aoHash = () => {
    const k = new URLSearchParams(location.hash.slice(1)).get('aba');
    const b = k && el.querySelector(`button[data-aba="${CSS.escape(k)}"]`);
    if (b && !b.classList.contains('on')) b.click();
  };
  window.addEventListener('hashchange', el._aoHash);
  aoTrocar(inicial);
}

/* ---------- Plano de contas: categorias da Tesouraria com código contábil ---------- */
let PLANO = [];
async function carregarPlano() {
  try { PLANO = (await api('/plano-contas')).contas; } catch (e) { PLANO = []; }
  PLANO.forEach(c => { if (!(c.chave in ROTULOS)) ROTULOS[c.chave] = c.nome; });
  return PLANO;
}
/** Opções de categoria [chave, "código · nome"] do tipo (receita/despesa), só contas ativas. */
function opcoesPlano(tipo, incluir) {
  return PLANO.filter(c => c.tipo === tipo && (c.ativo || c.chave === incluir)).map(c => [c.chave, `${c.codigo} · ${c.nome}`]);
}

/** Opções [valor, rótulo] a partir de uma lista simples de valores. */
const ops = lista => lista.map(v => Array.isArray(v) ? v : [v, rotulo(v)]);
