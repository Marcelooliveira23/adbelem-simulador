/* SIMULADOR: o servidor da Intranet AD Belém rodando dentro do navegador (Pyodide).
   Toda chamada a /api/... é atendida pelo mesmo código Python do servidor, sem internet para os dados.
   Os dados ficam só neste aparelho (IndexedDB) e continuam ao fechar e abrir de novo. */
(function () {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const RODAS = ["Flask_Cors-4.0.0-py2.py3-none-any.whl", "Flask_JWT_Extended-4.5.3-py2.py3-none-any.whl", "PyJWT-2.9.0-py3-none-any.whl", "blinker-1.8.2-py3-none-any.whl", "click-8.1.7-py3-none-any.whl", "et_xmlfile-1.1.0-py3-none-any.whl", "flask-3.0.0-py3-none-any.whl", "itsdangerous-2.2.0-py3-none-any.whl", "jinja2-3.1.4-py3-none-any.whl", "openpyxl-3.1.5-py2.py3-none-any.whl", "werkzeug-3.0.1-py3-none-any.whl"];
  const fetchOriginal = window.fetch.bind(window);
  let pronto = null, fila = Promise.resolve();

  function aviso(html, fixo) {
    let el = document.getElementById('simAviso');
    if (!el) {
      el = document.createElement('div');
      el.id = 'simAviso';
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(51,51,51,.88);color:#fff;display:flex;align-items:center;' +
        'justify-content:center;text-align:center;padding:24px;font:15px/1.5 system-ui,sans-serif';
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = `<div style="max-width:380px">${html}</div>`;
    el.hidden = false;
    if (!fixo) return el;
  }
  const esconder = () => { const el = document.getElementById('simAviso'); if (el) el.hidden = true; };

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Sem internet para baixar o simulador'));
      document.head.appendChild(s);
    });
  }
  const sincronizar = (py, carregar) => new Promise((ok, erro) => py.FS.syncfs(carregar, e => (e ? erro(e) : ok())));

  function iniciar() {
    if (pronto) return pronto;
    const t = setTimeout(() => aviso('⏳ <b>Preparando o simulador…</b><br><small>Na primeira vez pode levar até 1 minuto. Depois fica mais rápido.</small>'), 400);
    pronto = (async () => {
      await carregarScript(PYODIDE + 'pyodide.js');
      const py = await loadPyodide({ indexURL: PYODIDE });
      await py.loadPackage(['sqlite3', 'markupsafe', 'ssl', 'hashlib']);
      const site = py.runPython('import site; site.getsitepackages()[0]');
      for (const r of RODAS) py.unpackArchive(await (await fetchOriginal('py/' + r)).arrayBuffer(), 'zip', { extractDir: site });
      py.unpackArchive(await (await fetchOriginal('backend.zip')).arrayBuffer(), 'zip', { extractDir: '/app' });
      py.FS.mkdirTree('/dados');
      py.FS.mount(py.FS.filesystems.IDBFS, {}, '/dados');
      await sincronizar(py, true);
      py.runPython(`
import os, sys, json
os.environ['DATA_DIR'] = '/dados'
os.environ['SQLITE_PATH'] = '/dados/intranet.db'
sys.path.insert(0, '/app')
from app.database import inicializar_banco, get_db
from app.seed import garantir_usuarios_teste
import servidor
inicializar_banco()
garantir_usuarios_teste()
_c = get_db()
if not _c.execute('SELECT COUNT(*) FROM membros').fetchone()[0]:
    from app.routes.tryout import _popular_demo
    _popular_demo(_c, 1)
    _c.commit()
_c.close()
_cliente = servidor.app.test_client()

def atender(metodo, caminho, cabecalhos, corpo):
    dados = bytes(corpo.to_py()) if corpo is not None else None
    r = _cliente.open(caminho, method=metodo, headers=json.loads(cabecalhos), data=dados)
    return r.status_code, json.dumps({k: v for k, v in r.headers.items() if k.lower() != 'content-length'}), r.get_data()
`);
      await sincronizar(py, false);
      return py;
    })();
    pronto.then(() => { clearTimeout(t); esconder(); }, e => {
      clearTimeout(t);
      aviso(`⚠️ <b>Não foi possível abrir o simulador.</b><br><small>${String(e.message || e)}<br>Verifique a internet e recarregue a página.</small>`, true);
    });
    return pronto;
  }

  window.fetch = async function (entrada, opcoes) {
    const req = new Request(entrada, opcoes);
    const url = new URL(req.url, location.href);
    const i = url.pathname.indexOf('/api/');
    if (i < 0) return fetchOriginal(entrada, opcoes);
    const py = await iniciar();
    const cab = {};
    req.headers.forEach((v, k) => { cab[k] = v; });
    const corpo = ['GET', 'HEAD'].includes(req.method) ? null : new Uint8Array(await req.arrayBuffer());
    const resp = await (fila = fila.then(async () => {        // uma requisição por vez, como um servidor
      const r = py.globals.get('atender')(req.method, url.pathname.slice(i) + url.search, JSON.stringify(cab), corpo);
      const [status, cabecalhos, conteudo] = r.toJs();
      r.destroy();
      if (req.method !== 'GET') await sincronizar(py, false);   // grava no aparelho
      return { status, cabecalhos: JSON.parse(cabecalhos), conteudo };
    }));
    return new Response([204, 304].includes(resp.status) ? null : resp.conteudo, { status: resp.status, headers: resp.cabecalhos });
  };

  // faixa discreta avisando que é o simulador, com opção de recomeçar do zero
  document.addEventListener('DOMContentLoaded', () => {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9998;background:#F5C000;color:#333;border-radius:20px;padding:4px 12px;' +
      'font:12px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2)';
    f.innerHTML = '🧪 Simulador · dados só neste aparelho · <a href="#" style="color:#943A3F">recomeçar</a>';
    f.querySelector('a').onclick = e => {
      e.preventDefault();
      if (!confirm('Apagar tudo o que você cadastrou neste simulador e começar de novo com os dados de demonstração?')) return;
      try { localStorage.clear(); } catch (x) { /* ignore */ }
      const req = indexedDB.deleteDatabase('/dados');
      req.onsuccess = req.onerror = req.onblocked = () => { location.href = 'login.html'; };
    };
    document.body.appendChild(f);
  });
})();
