/* Assistente de importação: Excel/CSV, cópia de banco MySQL (.sql), banco SQLite (.db) ou conexão MySQL.
   abrirImportador('membros' | 'patrimonio' | 'fornecedores' | 'funcionarios' | null, aoTerminar) */
async function abrirImportador(destinoFixo, aoTerminar) {
  let destinos = [];
  try { destinos = (await api('/importar/destinos')).destinos; } catch (e) { showToast('❌ ' + e.message); return; }
  if (!destinos.length) { showToast('Seu perfil não importa cadastros'); return; }
  const st = { destino: destinoFixo && destinos.some(d => d.chave === destinoFixo) ? destinoFixo : destinos[0].chave, token: null, tabelas: [], tabela: null, mapa: {}, mysql: null };
  const camposDe = k => destinos.find(d => d.chave === k).campos;

  /* passo 1: de onde vêm os dados */
  const passo1 = () => {
    const box = abrirModal(`<h2>Importar cadastros</h2>
      <div class="note">Traga cadastros de uma planilha do Excel ou de um sistema antigo. Antes de gravar, o sistema mostra o que é
        novo, o que <b>já existe</b> (não cadastra em dobro) e o que tem problema. Um backup é feito automaticamente.</div>
      <label class="l" for="impDest">Importar para</label>
      <select id="impDest" style="width:100%"${destinoFixo ? ' disabled' : ''}>${destinos.map(d => `<option value="${d.chave}"${d.chave === st.destino ? ' selected' : ''}>${esc(d.rotulo)}</option>`).join('')}</select>
      <div class="tabs" id="impFonte" style="margin-top:12px"><button type="button" class="on" data-f="arq">📄 Arquivo</button><button type="button" data-f="mysql">🗄️ Banco MySQL</button></div>
      <div id="impArq"><label class="l" for="impFile">Planilha ou banco antigo</label>
        <input type="file" id="impFile" accept=".xlsx,.xlsm,.csv,.txt,.sql,.db,.sqlite,.sqlite3" style="width:100%">
        <small style="color:var(--mut)">Aceita: Excel (.xlsx), CSV, cópia do MySQL (.sql exportado pelo phpMyAdmin/mysqldump) e banco SQLite (.db). Até 25 MB.</small></div>
      <div id="impMy" hidden><div class="form-grid">
        <div><label class="l">Servidor</label><input id="myHost" value="localhost"></div><div><label class="l">Porta</label><input id="myPorta" value="3306"></div>
        <div><label class="l">Usuário</label><input id="myUser" value="root" autocomplete="off"></div><div><label class="l">Senha</label><input id="mySenha" type="password" autocomplete="new-password"></div>
        <div class="full"><label class="l">Nome do banco</label><input id="myBanco" placeholder="Ex.: igreja_antiga"></div></div>
        <small style="color:var(--mut)">A senha é usada só nesta leitura e não fica guardada.</small></div>
      <div class="acoes-form"><button class="btn pri" id="impLer">Ler dados</button><button class="btn" onclick="fecharModal()">Cancelar</button></div>`);
    let fonte = 'arq';
    box.querySelectorAll('#impFonte button').forEach(b => b.onclick = () => {
      fonte = b.dataset.f; box.querySelectorAll('#impFonte button').forEach(x => x.classList.toggle('on', x === b));
      box.querySelector('#impArq').hidden = fonte !== 'arq'; box.querySelector('#impMy').hidden = fonte !== 'mysql';
    });
    box.querySelector('#impDest').onchange = e => { st.destino = e.target.value; };
    box.querySelector('#impLer').onclick = async ev => {
      const btn = ev.target; btn.disabled = true; btn.textContent = 'Lendo...';
      try {
        if (fonte === 'arq') {
          const f = box.querySelector('#impFile').files[0];
          if (!f) throw new Error('Escolha o arquivo');
          const fd = new FormData(); fd.append('arquivo', f);
          const r = await fetch(`${API_URL}/importar/ler`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.token()}` }, body: fd });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.erro || 'Falha ao ler o arquivo');
          Object.assign(st, { token: j.token, tabelas: j.tabelas, fonteNome: j.fonte });
          escolherTabela();
        } else {
          st.mysql = { host: box.querySelector('#myHost').value, porta: box.querySelector('#myPorta').value, usuario: box.querySelector('#myUser').value,
            senha: box.querySelector('#mySenha').value, banco: box.querySelector('#myBanco').value };
          const r = await api('/importar/ler', { method: 'POST', body: { mysql: st.mysql } });
          escolherTabelaMysql(r.mysql_tabelas);
        }
      } catch (e) { showToast('❌ ' + e.message); btn.disabled = false; btn.textContent = 'Ler dados'; }
    };
  };

  const escolherTabelaMysql = lista => {
    const box = abrirModal(`<h2>Escolha a tabela</h2><p style="font-size:13.5px">Banco <b>${esc(st.mysql.banco)}</b>: ${lista.length} tabela(s).</p>
      <select id="myTab" style="width:100%" size="${Math.min(10, lista.length + 1)}">${lista.map(t => `<option value="${esc(t.nome)}">${esc(t.nome)} (${t.linhas ?? '?'} linhas)</option>`).join('')}</select>
      <div class="acoes-form"><button class="btn pri" id="myOk">Ler tabela</button><button class="btn" onclick="fecharModal()">Cancelar</button></div>`);
    box.querySelector('#myOk').onclick = async () => {
      const tabela = box.querySelector('#myTab').value;
      if (!tabela) { showToast('Escolha a tabela'); return; }
      try {
        const j = await api('/importar/ler', { method: 'POST', body: { mysql: st.mysql, tabela } });
        st.mysql = null;                                  // não manter a senha na memória
        Object.assign(st, { token: j.token, tabelas: j.tabelas, fonteNome: j.fonte });
        escolherTabela();
      } catch (e) { showToast('❌ ' + e.message); }
    };
  };

  /* passo 2: planilha/tabela e correspondência das colunas */
  const escolherTabela = async () => {
    if (st.tabelas.length === 1) st.tabela = st.tabelas[0].nome;
    if (!st.tabela) {
      const box = abrirModal(`<h2>Qual planilha / tabela?</h2><p style="font-size:13.5px">${esc(st.fonteNome)} tem ${st.tabelas.length} partes:</p>
        ${st.tabelas.map(t => `<label style="display:block;padding:6px 0"><input type="radio" name="tab" value="${esc(t.nome)}"> <b>${esc(t.nome)}</b> · ${t.total} linha(s)
          <br><small style="color:var(--mut)">${esc(t.colunas.slice(0, 8).join(', '))}${t.colunas.length > 8 ? '…' : ''}</small></label>`).join('')}
        <div class="acoes-form"><button class="btn pri" id="tabOk">Continuar</button><button class="btn" onclick="fecharModal()">Cancelar</button></div>`);
      box.querySelector('#tabOk').onclick = () => {
        const v = box.querySelector('input[name=tab]:checked')?.value;
        if (!v) { showToast('Escolha uma'); return; }
        st.tabela = v; escolherTabela();
      };
      return;
    }
    try {
      const r = await api('/importar/analisar', { method: 'POST', body: { token: st.token, tabela: st.tabela, destino: st.destino } });
      st.mapa = r.mapa;
    } catch (e) { st.mapa = {}; }
    mapear();
  };

  const mapear = () => {
    const tab = st.tabelas.find(t => t.nome === st.tabela);
    const box = abrirModal(`<h2>Correspondência das colunas</h2>
      <p style="font-size:13.5px">${esc(st.fonteNome)} › <b>${esc(st.tabela)}</b> · ${tab.total} linha(s). O sistema já ligou as colunas pelo nome;
        confira e ajuste. Deixe "—" no que não quiser importar.</p>
      <div class="form-grid">${camposDe(st.destino).map(c => `<div><label class="l">${esc(c.rotulo)}${c.campo === 'nome' ? ' *' : ''}</label>
        <select data-campo="${c.campo}"><option value="">—</option>${tab.colunas.map(col => `<option value="${esc(col)}"${st.mapa[c.campo] === col ? ' selected' : ''}>${esc(col)}</option>`).join('')}</select></div>`).join('')}</div>
      <details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">Ver as primeiras linhas da origem</summary>
        <div class="tw"><table><tr>${tab.colunas.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${tab.amostra.map(l => `<tr>${tab.colunas.map(c => `<td>${esc(l[c] ?? '')}</td>`).join('')}</tr>`).join('')}</table></div></details>
      <div class="acoes-form"><button class="btn pri" id="mapOk">Analisar</button><button class="btn" onclick="fecharModal()">Cancelar</button></div>`);
    box.querySelector('#mapOk').onclick = async () => {
      st.mapa = {};
      box.querySelectorAll('select[data-campo]').forEach(s => { if (s.value) st.mapa[s.dataset.campo] = s.value; });
      if (!st.mapa.nome) { showToast('Indique a coluna do nome / descrição'); return; }
      try { revisar(await api('/importar/analisar', { method: 'POST', body: { token: st.token, tabela: st.tabela, destino: st.destino, mapa: st.mapa } })); }
      catch (e) { showToast('❌ ' + e.message); }
    };
  };

  /* passo 3: revisão antes de gravar */
  const revisar = r => {
    const lista = (itens, fmt) => itens.length ? `<div class="tw" style="max-height:220px;overflow:auto"><table>${itens.map(fmt).join('')}</table></div>` : '';
    const box = abrirModal(`<h2>Revisão antes de importar</h2>
      <div class="kpis"><div class="kpi" style="border-left-color:var(--vd)"><b>${r.novos}</b><span>Novos cadastros</span></div>
        <div class="kpi"><b>${r.qtd_duplicados}</b><span>Já existem / repetidos</span></div>
        <div class="kpi" style="border-left-color:var(--red)"><b>${r.qtd_invalidos}</b><span>Com problema (não entram)</span></div>
        <div class="kpi"><b>${r.qtd_avisos}</b><span>Avisos</span></div></div>
      ${r.amostra_novos.length ? `<details open><summary style="cursor:pointer"><b>Exemplo do que será cadastrado</b></summary>${lista(r.amostra_novos, n =>
        `<tr><td><b>${esc(n.nome)}</b></td><td><small>${esc(Object.entries(n).filter(([k, v]) => k !== 'nome' && v !== null && v !== '').slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(' · '))}</small></td></tr>`)}</details>` : ''}
      ${r.duplicados.length ? `<details><summary style="cursor:pointer"><b>Já cadastrados ou repetidos (${r.qtd_duplicados})</b></summary>${lista(r.duplicados, d =>
        `<tr><td>Linha ${d.linha}</td><td>${esc(d.nome)}</td><td><small>${esc(d.motivo)}${d.existente && d.existente !== d.nome ? ` · cadastro atual: ${esc(d.existente)}` : ''}</small></td></tr>`)}</details>` : ''}
      ${r.invalidos.length ? `<details><summary style="cursor:pointer"><b>Com problema (${r.qtd_invalidos})</b></summary>${lista(r.invalidos, i => `<tr class="dev"><td>Linha ${i.linha}</td><td>${esc(i.erro)}</td></tr>`)}</details>` : ''}
      ${r.avisos.length ? `<details><summary style="cursor:pointer"><b>Avisos (${r.qtd_avisos})</b></summary>${lista(r.avisos, a => `<tr><td>Linha ${a.linha}</td><td>${esc(a.aviso)}</td></tr>`)}</details>` : ''}
      ${r.qtd_duplicados ? `<label class="l" for="impDup">O que fazer com quem já está cadastrado?</label><select id="impDup" style="width:100%">
        <option value="ignorar">Ignorar (não mexer no cadastro atual)</option>
        <option value="completar">Completar: preencher só os campos que estão vazios no cadastro atual</option></select>` : ''}
      <div class="acoes-form"><button class="btn pri" id="impOk"${r.novos || r.qtd_duplicados ? '' : ' disabled'}>Importar ${r.novos} cadastro(s)</button>
        <button class="btn" id="impVoltar">Voltar</button><button class="btn" onclick="fecharModal()">Cancelar</button></div>`);
    box.querySelector('#impVoltar').onclick = mapear;
    box.querySelector('#impOk').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Importando...';
      try {
        const x = await api('/importar/executar', { method: 'POST', body: { token: st.token, tabela: st.tabela, destino: st.destino, mapa: st.mapa,
          duplicados: box.querySelector('#impDup')?.value || 'ignorar' } });
        abrirModal(`<h2>✓ Importação concluída</h2><ul style="font-size:14.5px;line-height:1.8">
          <li><b>${x.inseridos}</b> cadastro(s) novo(s)</li>${x.completados ? `<li><b>${x.completados}</b> cadastro(s) existente(s) completado(s)</li>` : ''}
          <li>${x.duplicados} já existente(s) ou repetido(s) não foram duplicados</li><li>${x.invalidos} linha(s) com problema ficaram de fora</li></ul>
          <p style="font-size:13px;color:var(--mut)">Backup feito antes: ${esc(x.backup)} · registrado no log de ações.</p>
          <div class="acoes-form"><button class="btn pri" onclick="fecharModal()">Fechar</button></div>`);
        aoTerminar?.();
      } catch (e) { showToast('❌ ' + e.message); ev.target.disabled = false; ev.target.textContent = 'Importar'; }
    };
  };
  passo1();
}
