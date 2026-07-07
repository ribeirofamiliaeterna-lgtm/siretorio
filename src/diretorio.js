import { html, useState, useEffect, useMemo, sb, norm, phone, toISO, Spinner, Empty, Modal, Chip, InfoTip, carregarXLSX, exportarExcel, SITUACAO_MEMBRO } from './core.js';
import { IcMais, IcTelefone, IcWhats, IcEditar, IcFechar, IcPlanilha, IcBaixar, IcSubir } from './icons.js';

const SETORES = ['Areal', 'Arniqueiras', 'Park Way', 'AC Sul', 'AC Norte', 'Águas Claras', 'Taguatinga', 'Outros'];
const SETOR_LEGADO = { AR: 'Areal', SHA: 'Arniqueiras', PW: 'Park Way', ACS: 'AC Sul', ACN: 'AC Norte', AC: 'Águas Claras', TAG: 'Taguatinga', OUT: 'Outros' };
export const setorNome = s => SETOR_LEGADO[s] || s || '—';

// ─── Leitura do PDF "Lista de Membros" exportado pelo sistema da Igreja ──
// O relatório tem duas colunas por família: "Nome" (sobrenome/chefe, telefone,
// endereço) à esquerda e "Membros da Família / Sexo / Idade" à direita. Nomes
// longos quebram em 2+ linhas na coluna da direita, com o sexo aparecendo
// sozinho numa linha própria — por isso a extração separa as colunas pela
// posição X (calibrada pela própria palavra "Membros" do cabeçalho da tabela,
// que se repete em cada página) e reconstrói cada família casando o Y do
// cabeçalho (coluna esquerda) com o Y de início do 1º membro (coluna direita,
// sempre alinhados no topo da linha da tabela).
export const PDFJS_VERSAO = '3.11.174';
let pdfjsPromise = null;
async function carregarPDFJS() {
  if (!pdfjsPromise) pdfjsPromise = (async () => {
    const mod = await import(/* @vite-ignore */ `https://esm.sh/pdfjs-dist@${PDFJS_VERSAO}`);
    const pdfjs = mod.default;
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSAO}/build/pdf.worker.min.js`;
    return pdfjs;
  })();
  return pdfjsPromise;
}

const RE_BOILERPLATE_PDF = [
  /^Lista de Membros$/i,
  /^Ala\s.+\(\d+\)$/,
  /^Nome$/i,
  /^Nome\s+Membros da Família/i,
  /^Membros da Família$/i,
  /^Sexo$/i,
  /^Idade$/i,
  /Somente para Uso da Igreja/i,
  /Intellectual Reserve/i,
  /^Contagem:\s*\d+$/i,
];
// Cabeçalho de família: "Sobrenome[ Sobrenome2], resto" — só letras (sem
// dígitos) e Maiúscula-minúscula (afasta linhas em CAIXA ALTA como "SHA" e
// endereços como "Rua 37, 34", que têm dígito antes da vírgula). Linhas de
// endereço com nomes próprios antes da vírgula (ex.: "Res Bosque Dourado,
// Casa 49", "Mirante San Francisco, Apto 1801") passam nesse filtro, mas o
// texto depois da vírgula sempre tem número — por isso a checagem extra em
// `pareceCabecalho` exige que o "chefe" não tenha dígito.
const RE_CABECALHO_PDF = /^\p{Lu}[\p{Ll}'.-]+(?:\s\p{Lu}[\p{Ll}'.-]+)*,\s*(.*)$/u;
function pareceCabecalho(texto) {
  const m = texto.match(RE_CABECALHO_PDF);
  return !!m && !/\d/.test(m[1]);
}
const RE_SEXO_PDF = /(masculino|feminino)(?:\s+(\d{1,3}))?\s*$/i;
const RE_TELEFONE_PDF = /^[\d()+.\-\s]{6,}$/;

// Agrupa itens do pdf.js em "linhas" (mesma coordenada Y, tolerância p/
// jitter de sub-pixel), ordenadas de cima para baixo; dentro da linha,
// ordena por X e só insere espaço quando há um vão real entre os itens.
function agruparLinhasPorY(itens) {
  const grupos = [];
  itens.forEach(it => {
    const y = it.transform[5];
    let g = grupos.find(g => Math.abs(g.y - y) <= 2.5);
    if (!g) { g = { y, itens: [] }; grupos.push(g); }
    g.itens.push(it);
  });
  grupos.sort((a, b) => b.y - a.y);
  return grupos.map(g => {
    const ordenados = [...g.itens].sort((a, b) => a.transform[4] - b.transform[4]);
    let texto = '', fimAnterior = null;
    ordenados.forEach(it => {
      const x = it.transform[4];
      texto += (fimAnterior !== null && x - fimAnterior > 1 ? ' ' : '') + it.str;
      fimAnterior = x + (it.width || 0);
    });
    return { y: g.y, texto: texto.replace(/\s+/g, ' ').trim() };
  }).filter(l => l.texto && !RE_BOILERPLATE_PDF.some(re => re.test(l.texto)));
}

// Na coluna "Membros da Família", quem tem o mesmo sobrenome da família
// aparece só com o(s) nome(s) próprio(s) (sem repetir o sobrenome); quem tem
// sobrenome diferente (cônjuge, enteado etc.) aparece como "Sobrenome, Nome".
function reconstruirNomeMembroPDF(nomeBruto, sobrenomeFamilia) {
  const iv = nomeBruto.indexOf(',');
  if (iv < 0) return `${nomeBruto} ${sobrenomeFamilia}`.trim();
  const sobrenome = nomeBruto.slice(0, iv).trim();
  const nome = nomeBruto.slice(iv + 1).trim();
  return `${nome} ${sobrenome}`.trim();
}

// Recebe as linhas já separadas por coluna (de uma página) e devolve as
// famílias encontradas nela.
export function extrairFamiliasDaPagina(esquerda, direita) {
  const cabecalhos = [];
  esquerda.forEach((l, idx) => { if (pareceCabecalho(l.texto)) cabecalhos.push({ ...l, idx }); });

  return cabecalhos.map((cab, i) => {
    const proximoY = i + 1 < cabecalhos.length ? cabecalhos[i + 1].y : -Infinity;
    const linhasInfo = esquerda.filter(l => l.y < cab.y - 0.01 && l.y > proximoY + 0.01).map(l => l.texto);
    const linhasMembros = direita.filter(l => l.y <= cab.y + 0.01 && l.y > proximoY + 0.01).map(l => l.texto);

    const iv = cab.texto.indexOf(',');
    const sobrenome = iv >= 0 ? cab.texto.slice(0, iv).trim() : cab.texto.trim();
    const chefe = iv >= 0 ? cab.texto.slice(iv + 1).trim() : '';

    let telefone = '';
    const enderecoLinhas = [];
    linhasInfo.forEach(l => { if (!telefone && RE_TELEFONE_PDF.test(l)) telefone = l; else enderecoLinhas.push(l); });

    // Nomes longos quebram em mais de uma linha na coluna da direita; o sexo
    // (e a idade) só aparece na última linha do membro, então acumula-se o
    // texto até encontrar essa linha final.
    const membros = [];
    let buffer = [];
    linhasMembros.forEach(l => {
      const m = l.match(RE_SEXO_PDF);
      if (!m) { buffer.push(l); return; }
      const prefixo = l.slice(0, m.index).trim();
      const nomeCompleto = [...buffer, prefixo].filter(Boolean).join(' ');
      if (nomeCompleto) membros.push({
        nome: reconstruirNomeMembroPDF(nomeCompleto, sobrenome),
        sexo: m[1].toLowerCase() === 'feminino' ? 'F' : 'M',
        idade: m[2] ? Number(m[2]) : null,
      });
      buffer = [];
    });

    const endereco = enderecoLinhas.map(l => l.replace(/,\s*$/, '')).join(', ');
    return {
      sobrenome, chefe, telefone, endereco,
      setor: SETORES.find(s => norm(endereco).includes(norm(s))) || '',
      membros,
    };
  }).filter(f => f.membros.length > 0);
}

async function lerDiretorioPDF(file) {
  const pdfjs = await carregarPDFJS();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const familias = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const itens = content.items.filter(it => it.str && it.str.trim());
    if (itens.length === 0) continue;

    const itemMembros = itens.find(it => norm(it.str).includes('membros'));
    const xLimite = itemMembros ? itemMembros.transform[4] - 4 : page.getViewport({ scale: 1 }).width * 0.44;

    const esquerda = agruparLinhasPorY(itens.filter(it => it.transform[4] < xLimite));
    const direita = agruparLinhasPorY(itens.filter(it => it.transform[4] >= xLimite));
    familias.push(...extrairFamiliasDaPagina(esquerda, direita));
  }
  return familias;
}

// ─── Formulário de família ───────────────────────────────────────────────
function FormFamilia({ perfil, fam, membros, onClose, onSaved, show }) {
  const [f, setF] = useState(fam || { sobrenome: '', chefe: '', telefone: '', endereco: '', setor: '' });
  const [ms, setMs] = useState(membros ? membros.map(m => ({ ...m })) : []);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const setM = (i, k, v) => setMs(a => a.map((m, j) => j === i ? { ...m, [k]: v } : m));

  const salvar = async () => {
    if (!f.sobrenome.trim()) return show('Informe o sobrenome da família.', false);
    setBusy(true);
    let famId = f.id;
    const base = { sobrenome: f.sobrenome.trim(), chefe: f.chefe.trim(), telefone: f.telefone.trim(), endereco: f.endereco.trim(), setor: f.setor, atualizado_em: new Date().toISOString() };
    if (famId) {
      const { error } = await sb.from('familias').update(base).eq('id', famId);
      if (error) { setBusy(false); return show(error.message, false); }
    } else {
      const { data, error } = await sb.from('familias').insert({ ...base, ala_id: perfil.ala_id }).select().single();
      if (error) { setBusy(false); return show(error.message, false); }
      famId = data.id;
    }
    for (const m of ms) {
      // "excluir" = sai do acompanhamento (ativo=false); o histórico de presenças fica
      if (m._del && m.id) await sb.from('membros').update({ ativo: false }).eq('id', m.id);
      else if (!m._del && m.nome.trim()) {
        const row = { nome: m.nome.trim(), sexo: m.sexo || '', idade: m.idade ? Number(m.idade) : null, is_membro: m.is_membro !== false };
        if (m.id) await sb.from('membros').update(row).eq('id', m.id);
        else await sb.from('membros').insert({ ...row, ala_id: perfil.ala_id, familia_id: famId });
      }
    }
    setBusy(false); show('Família salva.'); onSaved(); onClose();
  };

  const excluir = async () => {
    if (!confirm(`Excluir a família ${f.sobrenome} e todos os seus membros? O histórico de presenças deles também será apagado. Esta ação não pode ser desfeita.`)) return;
    const { error } = await sb.from('familias').delete().eq('id', f.id);
    if (error) return show(error.message, false);
    show('Família excluída.'); onSaved(); onClose();
  };

  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">${f.id ? 'Editar família' : 'Nova família'}</div>
    <label class="lbl">Sobrenome *</label>
    <input class="inp" value=${f.sobrenome} onInput=${e => set('sobrenome', e.target.value)} />
    <label class="lbl">Nome do chefe da família</label>
    <input class="inp" value=${f.chefe} onInput=${e => set('chefe', e.target.value)} />
    <label class="lbl">Telefone</label>
    <input class="inp" value=${f.telefone} onInput=${e => set('telefone', e.target.value)} />
    <label class="lbl">Endereço</label>
    <input class="inp" value=${f.endereco} onInput=${e => set('endereco', e.target.value)} />
    <label class="lbl">Setor</label>
    <select class="inp" value=${f.setor} onChange=${e => set('setor', e.target.value)}>
      <option value="">—</option>
      ${SETORES.map(s => html`<option value=${s} selected=${setorNome(f.setor) === s}>${s}</option>`)}
    </select>
    <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
      <span class="titulo-secao" style=${{ fontSize: 14 }}>Membros</span>
      <button class="btn btn-s" style=${{ padding: '5px 10px', fontSize: 12 }}
        onClick=${() => setMs(a => [...a, { nome: '', sexo: '', idade: '', is_membro: true }])}><${IcMais} size=${13} /> Adicionar</button>
    </div>
    ${ms.map((m, i) => m._del ? null : html`
      <div key=${i} style=${{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <input class="inp" style=${{ flex: 3 }} placeholder="Nome completo" value=${m.nome} onInput=${e => setM(i, 'nome', e.target.value)} />
        <select class="inp" style=${{ flex: 1, minWidth: 54, padding: '10px 6px' }} value=${m.sexo} onChange=${e => setM(i, 'sexo', e.target.value)}>
          <option value="">—</option><option value="F" selected=${m.sexo === 'F'}>F</option><option value="M" selected=${m.sexo === 'M'}>M</option>
        </select>
        <input class="inp" style=${{ flex: 1, minWidth: 52 }} type="number" placeholder="Idade" value=${m.idade ?? ''} onInput=${e => setM(i, 'idade', e.target.value)} />
        <button style=${{ color: 'var(--vermelho)', padding: 4 }} title="Remover do acompanhamento"
          onClick=${() => m.id ? setM(i, '_del', true) : setMs(a => a.filter((_, j) => j !== i))}><${IcFechar} size=${15} /></button>
      </div>`)}
    <div style=${{ display: 'flex', gap: 8, marginTop: 18 }}>
      ${f.id && html`<button class="btn btn-d" onClick=${excluir}>Excluir</button>`}
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Salvar</button>
    </div>
  <//>`;
}

// ─── Substituição do diretório ───────────────────────────────────────────
// Atualiza quem já existe (sem duplicar), insere os novos e marca quem saiu
// com o selo "Fora do diretório" — o histórico e os relatórios são preservados.
function SubstituirDiretorio({ perfil, fams, membros, onClose, onDone, show }) {
  const [plano, setPlano] = useState(null);
  const [busy, setBusy] = useState(false);

  const exportarAtual = () => {
    const famById = new Map(fams.map(f => [f.id, f]));
    const linhas = [['Sobrenome da família', 'Chefe da família', 'Telefone', 'Endereço', 'Setor', 'Nome do membro', 'Sexo (M/F)', 'Idade']];
    membros.filter(m => m.ativo && m.situacao === 'diretorio').forEach(m => {
      const f = famById.get(m.familia_id) || {};
      linhas.push([f.sobrenome || '', f.chefe || '', f.telefone || '', f.endereco || '', setorNome(f.setor) === '—' ? '' : setorNome(f.setor), m.nome, m.sexo || '', m.idade ?? '']);
    });
    exportarExcel(`diretorio-${perfil.alas?.slug || 'ala'}-${toISO(new Date())}.xlsx`, [{ nome: 'Diretório', linhas }]);
  };

  const analisar = async file => {
    setBusy(true);
    try {
      let listaFamilias;   // [{ sobrenome, chefe, telefone, endereco, setor, membros: [{nome,sexo,idade}] }]
      if (file.name.toLowerCase().endsWith('.pdf')) {
        listaFamilias = await lerDiretorioPDF(file);
        if (listaFamilias.length === 0) throw new Error('Nenhuma família reconhecida no PDF — confira se é o modelo "Lista de Membros" exportado pelo sistema da Igreja.');
      } else {
        const X = await carregarXLSX();
        const wb = X.read(await file.arrayBuffer());
        const linhas = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }).slice(1)
          .filter(r => r && String(r[0] || '').trim());
        if (linhas.length === 0) throw new Error('Nenhuma linha encontrada — a planilha deve seguir o modelo exportado.');
        const porChave = new Map();
        for (const r of linhas) {
          const [sobrenome, chefe, telefone, endereco, setor, nomeMembro, sexo, idade] = r.map(v => v == null ? '' : String(v).trim());
          const k = `${norm(sobrenome)}|${norm(chefe)}`;
          if (!porChave.has(k)) porChave.set(k, { sobrenome, chefe, telefone, endereco, setor, membros: [] });
          if (nomeMembro) porChave.get(k).membros.push({ nome: nomeMembro, sexo: ['M', 'F'].includes(sexo.toUpperCase()) ? sexo.toUpperCase() : '', idade: idade ? Number(idade) || null : null });
        }
        listaFamilias = [...porChave.values()];
      }

      const famNovas = new Map(listaFamilias.map(f => [`${norm(f.sobrenome)}|${norm(f.chefe)}`, f]));
      const famAtualPorChave = new Map(fams.map(f => [`${norm(f.sobrenome)}|${norm(f.chefe)}`, f]));
      const membroPorNome = new Map(membros.filter(m => m.ativo).map(m => [norm(m.nome), m]));
      const nomesImportados = new Set();
      const novas = [], mantidas = [];
      let novosMembros = 0, atualizados = 0;
      famNovas.forEach((fn, k) => {
        (famAtualPorChave.has(k) ? mantidas : novas).push(fn);
        fn.membros.forEach(m => {
          nomesImportados.add(norm(m.nome));
          if (membroPorNome.has(norm(m.nome))) atualizados++; else novosMembros++;
        });
      });
      const saem = membros.filter(m => m.ativo && m.situacao === 'diretorio' && !nomesImportados.has(norm(m.nome)));
      const retornam = membros.filter(m => m.ativo && m.situacao === 'fora_diretorio' && nomesImportados.has(norm(m.nome))).length;
      setPlano({ famNovas, novas, mantidas, novosMembros, atualizados, saem, retornam });
    } catch (e) { show(`Erro ao ler o arquivo: ${e.message}`, false); }
    setBusy(false);
  };

  const aplicar = async () => {
    setBusy(true);
    try {
      const famAtualPorChave = new Map(fams.map(f => [`${norm(f.sobrenome)}|${norm(f.chefe)}`, f]));
      const membroPorNome = new Map(membros.filter(m => m.ativo).map(m => [norm(m.nome), m]));
      for (const [k, fn] of plano.famNovas) {
        let fam = famAtualPorChave.get(k);
        const dados = { sobrenome: fn.sobrenome, chefe: fn.chefe, telefone: fn.telefone, endereco: fn.endereco, setor: fn.setor, atualizado_em: new Date().toISOString() };
        if (fam) {
          const { error } = await sb.from('familias').update(dados).eq('id', fam.id);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await sb.from('familias').insert({ ...dados, ala_id: perfil.ala_id }).select().single();
          if (error) throw new Error(error.message);
          fam = data;
        }
        for (const m of fn.membros) {
          const atual = membroPorNome.get(norm(m.nome));
          const dadosM = { familia_id: fam.id, sexo: m.sexo, idade: m.idade, situacao: 'diretorio', ativo: true };
          const { error } = atual
            ? await sb.from('membros').update(dadosM).eq('id', atual.id)
            : await sb.from('membros').insert({ ...dadosM, nome: m.nome, ala_id: perfil.ala_id, is_membro: true });
          if (error) throw new Error(error.message);
        }
      }
      if (plano.saem.length) {
        const { error } = await sb.from('membros').update({ situacao: 'fora_diretorio' })
          .in('id', plano.saem.map(m => m.id));
        if (error) throw new Error(error.message);
      }
      show('Diretório substituído com sucesso.');
      onDone(); onClose();
    } catch (e) { show(`Erro na substituição: ${e.message}`, false); }
    setBusy(false);
  };

  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Substituir diretório</div>
    <div style=${{ fontSize: 12.5, color: 'var(--tinta2)', margin: '6px 0 14px', lineHeight: 1.6 }}>
      Use quando receber a lista atualizada da ala — pode enviar direto o <strong>PDF "Lista de Membros"</strong> exportado
      pelo sistema da Igreja, ou uma planilha no modelo abaixo. Nada é apagado: as famílias <strong>repetidas serão mantidas</strong>,
      as <strong>novas serão incluídas</strong> e as que não constarem mais na lista <strong>ganham o selo "Fora do diretório"</strong> —
      permanecendo nos relatórios e no histórico. Membros adicionados manualmente não são afetados.
    </div>
    <button class="btn btn-s" style=${{ width: '100%', fontSize: 12.5, marginBottom: 8 }} onClick=${exportarAtual}>
      <${IcBaixar} size=${14} /> Baixar diretório atual (modelo em planilha)
    </button>
    <label class="btn btn-p" style=${{ width: '100%', fontSize: 12.5, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
      <${IcSubir} size=${14} /> ${busy ? 'Lendo arquivo…' : 'Enviar PDF ou planilha do novo diretório'}
      <input type="file" accept=".pdf,.xlsx,.xls,.csv" style=${{ display: 'none' }} disabled=${busy}
        onChange=${e => { if (e.target.files[0]) analisar(e.target.files[0]); e.target.value = ''; }} />
    </label>
    ${plano && html`
      <div class="card" style=${{ padding: 14, marginTop: 12, background: 'var(--azul-claro)', border: '1px solid #CFE0EE' }}>
        <div style=${{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Confira antes de aplicar:</div>
        <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginBottom: 10 }}>
          ${plano.novosMembros} membro(s) novo(s) · ${plano.atualizados} atualizado(s)${plano.retornam ? ` · ${plano.retornam} retornam ao diretório` : ''}
        </div>

        <div style=${{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <${Chip} bg="var(--verde-claro)" t="var(--verde)">Novas · ${plano.novas.length}<//>
          <span style=${{ fontSize: 11.5, color: 'var(--tinta3)' }}>famílias incluídas nesta substituição</span>
        </div>
        ${plano.novas.length > 0 && html`
          <div style=${{ background: '#FFF', borderRadius: 8, border: '1px solid var(--linha)', padding: '6px 10px', marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}>
            ${plano.novas.map((fn, i) => html`<div key=${i} style=${{ fontSize: 12, padding: '4px 0', borderBottom: i < plano.novas.length - 1 ? '1px solid var(--linha2)' : 'none' }}>
              Família ${fn.sobrenome}${fn.chefe ? ` — ${fn.chefe}` : ''} <span style=${{ color: 'var(--tinta3)' }}>(${fn.membros.length} pessoa${fn.membros.length !== 1 ? 's' : ''})</span>
            </div>`)}
          </div>`}

        <div style=${{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <${Chip} bg="var(--linha2)" t="var(--tinta2)">Permaneceram · ${plano.mantidas.length}<//>
          <span style=${{ fontSize: 11.5, color: 'var(--tinta3)' }}>famílias já cadastradas, dados atualizados</span>
        </div>
        ${plano.mantidas.length > 0 && html`
          <div style=${{ background: '#FFF', borderRadius: 8, border: '1px solid var(--linha)', padding: '6px 10px', marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}>
            ${plano.mantidas.map((fn, i) => html`<div key=${i} style=${{ fontSize: 12, padding: '4px 0', borderBottom: i < plano.mantidas.length - 1 ? '1px solid var(--linha2)' : 'none' }}>
              Família ${fn.sobrenome}${fn.chefe ? ` — ${fn.chefe}` : ''}
            </div>`)}
          </div>`}

        <div style=${{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <${Chip} bg=${plano.saem.length ? 'var(--vermelho-claro)' : 'var(--verde-claro)'} t=${plano.saem.length ? 'var(--vermelho)' : 'var(--verde)'}>
            Saíram · ${plano.saem.length}<//>
          <span style=${{ fontSize: 11.5, color: 'var(--tinta3)' }}>recebem o selo "Fora do diretório"</span>
        </div>
        ${plano.saem.length > 0 && html`
          <div style=${{ background: '#FFF', borderRadius: 8, border: '1px solid var(--linha)', padding: '6px 10px' }}>
            ${plano.saem.map((m, i) => html`<div key=${m.id} style=${{ fontSize: 12, padding: '4px 0', borderBottom: i < plano.saem.length - 1 ? '1px solid var(--linha2)' : 'none' }}>
              ${m.nome}
            </div>`)}
          </div>`}

        <button class="btn btn-p" style=${{ width: '100%', marginTop: 12, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${aplicar}>
          ${busy ? 'Aplicando…' : 'Concordar com as alterações e aplicar'}
        </button>
      </div>`}
    <button class="btn btn-s" style=${{ width: '100%', marginTop: 10 }} onClick=${onClose}>Fechar</button>
  <//>`;
}

// ─── Diretório ───────────────────────────────────────────────────────────
export function Diretorio({ perfil, show, readOnly }) {
  const [fams, setFams] = useState(null);
  const [membros, setMembros] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');   // todos | fora_diretorio | manual
  const [aberta, setAberta] = useState(null);
  const [edit, setEdit] = useState(null);
  const [substituir, setSubstituir] = useState(false);

  const carregar = async () => {
    const [{ data: f }, { data: m }] = await Promise.all([
      sb.from('familias').select('*').eq('ala_id', perfil.ala_id).order('sobrenome'),
      sb.from('membros').select('*').eq('ala_id', perfil.ala_id).eq('ativo', true).order('nome'),
    ]);
    setFams(f || []); setMembros(m || []);
  };
  useEffect(() => { carregar(); }, [perfil.ala_id]);

  const porFamilia = useMemo(() => {
    const map = new Map();
    membros.forEach(m => { if (!map.has(m.familia_id)) map.set(m.familia_id, []); map.get(m.familia_id).push(m); });
    return map;
  }, [membros]);

  const contagens = useMemo(() => ({
    fora: membros.filter(m => m.situacao === 'fora_diretorio').length,
    manual: membros.filter(m => m.situacao === 'manual').length,
  }), [membros]);

  const visiveis = useMemo(() => {
    if (!fams) return [];
    const q = norm(busca);
    return fams.filter(f => {
      const ms = porFamilia.get(f.id) || [];
      if (filtro !== 'todos' && !ms.some(m => m.situacao === filtro)) return false;
      if (!q) return true;
      return norm(`${f.sobrenome} ${f.chefe}`).includes(q) || ms.some(m => norm(m.nome).includes(q));
    });
  }, [fams, busca, filtro, porFamilia]);

  if (!fams) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">Diretório</div>
    <div class="sub">${fams.length} famílias · ${membros.length} pessoas em acompanhamento</div>
    <div style=${{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <input class="inp" type="search" placeholder="Buscar por nome ou sobrenome…" value=${busca} onInput=${e => setBusca(e.target.value)} />
      ${!readOnly && html`<button class="btn btn-p" style=${{ whiteSpace: 'nowrap' }} onClick=${() => setEdit('nova')}><${IcMais} size=${14} /> Família</button>`}
    </div>
    <div style=${{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <div class="seg" style=${{ flex: 1, minWidth: 260 }}>
        <button class=${filtro === 'todos' ? 'on' : ''} onClick=${() => setFiltro('todos')}>Todos</button>
        <button class=${filtro === 'fora_diretorio' ? 'on' : ''} onClick=${() => setFiltro('fora_diretorio')}>Fora do diretório (${contagens.fora})</button>
        <button class=${filtro === 'manual' ? 'on' : ''} onClick=${() => setFiltro('manual')}>Manuais (${contagens.manual})</button>
      </div>
      ${!readOnly && html`
      <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => setSubstituir(true)}>
        <${IcPlanilha} size=${14} /> Substituir diretório
      </button>`}
    </div>
    ${visiveis.length === 0 && html`<${Empty} msg="Nenhuma família encontrada." />`}
    ${visiveis.map(f => {
      const ms = porFamilia.get(f.id) || [];
      const open = aberta === f.id;
      return html`
      <div key=${f.id} class="card">
        <div style=${{ padding: '12px 14px', cursor: 'pointer' }} onClick=${() => setAberta(open ? null : f.id)}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style=${{ flex: 1, minWidth: 0 }}>
              <span style=${{ fontWeight: 600, fontSize: 15 }}>Família ${f.sobrenome}</span>
              ${f.setor && html` <${Chip} bg="var(--azul-claro)" t="var(--azul)">${setorNome(f.setor)}<//>`}
              <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginTop: 2 }}>${f.chefe}</div>
              <div style=${{ fontSize: 11, color: 'var(--tinta3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${f.endereco || 'sem endereço'}</div>
              <div style=${{ fontSize: 11, color: 'var(--tinta3)', marginTop: 1 }}>${ms.length} membro${ms.length !== 1 ? 's' : ''}</div>
            </div>
            <span style=${{ color: 'var(--tinta3)', fontSize: 11 }}>${open ? '▴' : '▾'}</span>
          </div>
        </div>
        ${open && html`
        <div style=${{ borderTop: '1px solid var(--linha2)', padding: '12px 14px', background: 'var(--papel)' }}>
          ${f.telefone && html`
            <div style=${{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <a class="btn btn-s" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} href=${`tel:${f.telefone}`}><${IcTelefone} size=${14} /> Ligar</a>
              ${phone(f.telefone).length >= 10 && html`
                <a class="btn btn-g" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} target="_blank" href=${`https://wa.me/${phone(f.telefone)}`}><${IcWhats} size=${14} /> WhatsApp</a>`}
            </div>`}
          ${ms.map((m, i) => {
            const selo = SITUACAO_MEMBRO[m.situacao];
            return html`
            <div key=${m.id} style=${{ fontSize: 12.5, color: 'var(--tinta2)', padding: '5px 0', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderBottom: i < ms.length - 1 ? '1px solid var(--linha2)' : 'none' }}>
              <span>${m.nome}</span>
              ${m.idade != null && html`<${Chip} bg="var(--linha2)" t="var(--tinta3)" style=${{ fontSize: 10 }}>${m.idade} anos<//>`}
              ${m.is_membro === false && html`<${Chip} bg="var(--ambar-claro)" t="var(--ambar)" style=${{ fontSize: 10 }}>não-membro<//>`}
              ${selo && html`<${Chip} bg=${selo.bg} t=${selo.t} style=${{ fontSize: 10 }}>${selo.l}<//>`}
            </div>`;
          })}
          ${!readOnly && html`
          <button class="btn btn-s" style=${{ width: '100%', marginTop: 12, fontSize: 12 }}
            onClick=${() => setEdit({ fam: f, membros: ms })}><${IcEditar} size=${14} /> Editar família</button>`}
        </div>`}
      </div>`;
    })}
    ${edit && html`<${FormFamilia} perfil=${perfil} show=${show}
      fam=${edit === 'nova' ? null : edit.fam} membros=${edit === 'nova' ? [] : edit.membros}
      onClose=${() => setEdit(null)} onSaved=${carregar} />`}
    ${substituir && html`<${SubstituirDiretorio} perfil=${perfil} fams=${fams} membros=${membros}
      onClose=${() => setSubstituir(false)} onDone=${carregar} show=${show} />`}`;
}
