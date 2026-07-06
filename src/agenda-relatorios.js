import { html, useState, useEffect, useMemo, sb, norm, toISO, fmtBR, Spinner, Empty } from './core.js';

const carregarXLSX = async () => {
  const m = await import('https://esm.sh/xlsx@0.18.5');
  return m.default?.utils ? m.default : m;
};

// ─── RELATÓRIOS DE DISCURSANTES ──────────────────────────────────────────
export function Relatorios({ perfil, membros }) {
  const [parts, setParts] = useState(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    sb.from('agenda_itens')
      .select('tipo, rotulo, membro_id, nome_livre, agendas!inner(data)')
      .eq('ala_id', perfil.ala_id).in('tipo', ['discurso', 'oracao', 'participacao'])
      .then(({ data }) => setParts(data || []));
  }, [perfil.ala_id]);

  const calc = useMemo(() => {
    if (!parts) return null;
    const discursos = parts.filter(p => p.tipo === 'discurso' && (p.membro_id || p.nome_livre));
    const porMembro = new Map();
    let foraDiretorio = 0;
    discursos.forEach(p => {
      if (!p.membro_id) { foraDiretorio++; return; }
      if (!porMembro.has(p.membro_id)) porMembro.set(p.membro_id, { total: 0, ultimo: null });
      const r = porMembro.get(p.membro_id);
      r.total++;
      if (!r.ultimo || p.agendas.data > r.ultimo) r.ultimo = p.agendas.data;
    });
    const soMembros = membros.filter(m => m.is_membro !== false);
    const linhas = soMembros.map(m => ({
      id: m.id, nome: m.nome,
      total: porMembro.get(m.id)?.total || 0,
      ultimo: porMembro.get(m.id)?.ultimo || null,
    }));
    const prioridade = [...linhas].sort((a, b) =>
      (a.ultimo === null) === (b.ultimo === null)
        ? (a.ultimo === null ? a.nome.localeCompare(b.nome) : a.ultimo.localeCompare(b.ultimo))
        : (a.ultimo === null ? -1 : 1));
    const top = [...linhas].filter(l => l.total > 0).sort((a, b) => b.total - a.total || b.ultimo.localeCompare(a.ultimo));
    return {
      totalDiscursos: discursos.length,
      nuncaDiscursaram: linhas.filter(l => l.total === 0).length,
      foraDiretorio, prioridade, top: top.slice(0, 10),
    };
  }, [parts, membros]);

  if (!calc) return html`<${Spinner}/>`;

  const q = norm(busca);
  const prioridadeVisivel = (q ? calc.prioridade.filter(l => norm(l.nome).includes(q)) : calc.prioridade).slice(0, 30);

  return html`
    <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div class="kpi"><div class="v">${calc.totalDiscursos}</div><div class="l">Discursos registrados</div></div>
      <div class="kpi"><div class="v">${calc.nuncaDiscursaram}</div><div class="l">Membros sem discurso no histórico</div></div>
    </div>
    ${calc.totalDiscursos === 0 && html`
      <div class="card" style=${{ padding: 16, fontSize: 13, color: '#64748B' }}>
        Ainda não há discursos registrados. Preencha as agendas dos domingos ou suba o histórico
        antigo pela aba <strong>Planilha</strong> — os relatórios se montam sozinhos.
      </div>`}

    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ fontWeight: 800, fontSize: 14 }}>🎯 Prioridade de convite</div>
      <div style=${{ fontSize: 11, color: '#94A3B8', margin: '2px 0 10px' }}>
        Quem está há mais tempo sem discursar aparece primeiro (sem registro no histórico = topo da lista).
      </div>
      <input class="inp" type="search" placeholder="Buscar membro…" style=${{ marginBottom: 8, fontSize: 13 }}
        value=${busca} onInput=${e => setBusca(e.target.value)} />
      ${prioridadeVisivel.map((l, i) => html`
        <div key=${l.id} style=${{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
          <span style=${{ color: '#334155' }}><span style=${{ color: '#94A3B8', fontWeight: 700 }}>${i + 1}.</span> ${l.nome}</span>
          <span style=${{ flexShrink: 0 }}>
            ${l.ultimo
              ? html`<span style=${{ color: '#64748B', fontSize: 12 }}>último: ${fmtBR(l.ultimo)} · ${l.total}x</span>`
              : html`<span class="chip" style=${{ background: '#FEF3C7', color: '#92400E' }}>nunca discursou</span>`}
          </span>
        </div>`)}
      ${!q && calc.prioridade.length > 30 && html`
        <div style=${{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Mostrando os 30 primeiros — use a busca para ver os demais.</div>`}
    </div>

    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🎤 Quem mais discursa</div>
      ${calc.top.length === 0 && html`<${Empty} msg="Sem dados ainda." />`}
      ${calc.top.map((l, i) => html`
        <div key=${l.id} style=${{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
          <span style=${{ color: '#334155' }}><span style=${{ color: '#94A3B8', fontWeight: 700 }}>${i + 1}.</span> ${l.nome}</span>
          <span style=${{ color: '#64748B', fontSize: 12, flexShrink: 0 }}>${l.total} discurso${l.total > 1 ? 's' : ''} · último ${fmtBR(l.ultimo)}</span>
        </div>`)}
      ${calc.foraDiretorio > 0 && html`
        <div style=${{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
          + ${calc.foraDiretorio} discurso(s) de pessoas fora do diretório (visitantes, estaca etc.).
        </div>`}
    </div>`;
}

// ─── PLANILHA (modelo, importação e exportação Excel) ────────────────────
function parseData(v) {
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

const tipoDoPapel = p => {
  const n = norm(p || '');
  if (n.includes('ora')) return 'oracao';
  if (n.includes('music') || n.includes('particip') || n.includes('cant') || n.includes('coral')) return 'participacao';
  return 'discurso';
};

export function Planilha({ perfil, show, membros, onImport }) {
  const [busy, setBusy] = useState(false);
  const [resumo, setResumo] = useState(null);

  const baixarModelo = async () => {
    setBusy(true);
    try {
      const X = await carregarXLSX();
      const wb = X.utils.book_new();
      const dados = [
        ['Data', 'Nome', 'Papel'],
        ['21/06/2026', 'Erica Aparecida da Costa Macêdo', '1º Discursante'],
        ['21/06/2026', 'Gabriela Pradera Resende', '2º Discursante'],
        ['28/06/2026', 'Julie Emylly Mendes Ribeiro', 'Discursante'],
      ];
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(dados), 'Historico');
      const inst = [
        ['COMO PREENCHER'],
        [''],
        ['• Uma linha por participação (discurso, oração ou apresentação).'],
        ['• Data: no formato DD/MM/AAAA. Todas as linhas da mesma data viram uma só reunião.'],
        ['• Nome: nome completo, igual ao do diretório da ala sempre que possível —'],
        ['  assim o sistema reconhece a pessoa automaticamente.'],
        ['• Papel: livre. Ex: 1º Discursante, 2º Discursante, Oração de abertura, Apresentação musical.'],
        ['  Se contiver "oração" conta como oração; "musical/participação" conta como participação;'],
        ['  qualquer outro valor conta como discurso.'],
        ['• Apague as linhas de exemplo antes de importar.'],
      ];
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(inst), 'Instruções');
      X.writeFile(wb, 'modelo-historico-siretorio.xlsx');
    } catch (e) { show(`Erro ao gerar modelo: ${e.message}`, false); }
    setBusy(false);
  };

  const importar = async file => {
    setBusy(true); setResumo(null);
    try {
      const X = await carregarXLSX();
      const wb = X.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames.includes('Historico') ? 'Historico' : wb.SheetNames[0]];
      const linhas = X.utils.sheet_to_json(ws, { header: 1, raw: true }).slice(1)
        .filter(r => r && r.length >= 2 && r[0] != null && String(r[1] || '').trim());

      const porData = new Map();
      const invalidas = [];
      for (const r of linhas) {
        const data = parseData(r[0]);
        if (!data) { invalidas.push(String(r[0])); continue; }
        if (!porData.has(data)) porData.set(data, []);
        porData.get(data).push({ nome: String(r[1]).trim(), papel: String(r[2] || 'Discursante').trim() });
      }
      if (porData.size === 0) throw new Error('Nenhuma linha válida encontrada na planilha.');

      const idx = membros.map(m => ({ id: m.id, n: norm(m.nome) }));
      const acha = nome => {
        const n = norm(nome);
        const exato = idx.find(m => m.n === n);
        if (exato) return exato.id;
        const contem = idx.filter(m => m.n.includes(n) || n.includes(m.n));
        return contem.length === 1 ? contem[0].id : null;
      };

      let totalParts = 0, semMatch = [];
      for (const [data, rows] of [...porData.entries()].sort()) {
        const { data: ag, error } = await sb.from('agendas')
          .upsert({ ala_id: perfil.ala_id, data, tipo: 'sacramental' }, { onConflict: 'ala_id,data,tipo' })
          .select().single();
        if (error) throw new Error(error.message);
        const { data: existentes } = await sb.from('agenda_itens').select('ordem').eq('agenda_id', ag.id);
        let ordem = (existentes?.length ? Math.max(...existentes.map(i => i.ordem)) : 0);
        const itens = rows.map(r => {
          ordem += 10;
          const membroId = acha(r.nome);
          if (!membroId) semMatch.push(r.nome);
          return {
            agenda_id: ag.id, ala_id: perfil.ala_id, secao: 'discursos',
            rotulo: r.papel, tipo: tipoDoPapel(r.papel),
            membro_id: membroId, nome_livre: membroId ? '' : r.nome, ordem, padrao: false,
          };
        });
        const { error: e2 } = await sb.from('agenda_itens').insert(itens);
        if (e2) throw new Error(e2.message);
        totalParts += itens.length;
      }
      setResumo({ reunioes: porData.size, parts: totalParts, semMatch: [...new Set(semMatch)], invalidas });
      show('Histórico importado ✅');
      onImport?.();
    } catch (e) { show(`Erro na importação: ${e.message}`, false); }
    setBusy(false);
  };

  const exportar = async () => {
    setBusy(true);
    try {
      const X = await carregarXLSX();
      const { data: itens } = await sb.from('agenda_itens')
        .select('secao, rotulo, tipo, conteudo, nome_livre, membro_id, agendas!inner(data)')
        .eq('ala_id', perfil.ala_id).order('ordem');
      const nomeDe = new Map(membros.map(m => [m.id, m.nome]));
      const pessoas = [['Data', 'Papel', 'Tipo', 'Nome', 'No diretório?']];
      const outros = [['Data', 'Item', 'Conteúdo']];
      (itens || []).sort((a, b) => a.agendas.data.localeCompare(b.agendas.data)).forEach(i => {
        if (['discurso', 'oracao', 'participacao', 'funcao'].includes(i.tipo)) {
          const nome = i.membro_id ? nomeDe.get(i.membro_id) || i.nome_livre : i.nome_livre;
          if (nome) pessoas.push([fmtBR(i.agendas.data), i.rotulo, i.tipo, nome, i.membro_id ? 'Sim' : 'Não']);
        } else if (i.conteudo.trim()) {
          outros.push([fmtBR(i.agendas.data), i.rotulo, i.conteudo]);
        }
      });
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(pessoas), 'Participações');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(outros), 'Hinos e textos');
      X.writeFile(wb, `siretorio-historico-${toISO(new Date())}.xlsx`);
    } catch (e) { show(`Erro ao exportar: ${e.message}`, false); }
    setBusy(false);
  };

  return html`
    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ fontWeight: 800, fontSize: 14 }}>📥 Subir histórico antigo</div>
      <div style=${{ fontSize: 12, color: '#64748B', margin: '4px 0 10px' }}>
        Baixe o modelo, preencha uma linha por participação (data, nome, papel) e importe.
        As reuniões e discursos entram no histórico e alimentam os relatórios.
      </div>
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button class="btn btn-s" style=${{ flex: 1, fontSize: 12, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${baixarModelo}>
          ⬇️ Baixar modelo (Excel)
        </button>
        <label class="btn btn-p" style=${{ flex: 1, fontSize: 12, opacity: busy ? .6 : 1, cursor: 'pointer' }}>
          ⬆️ Importar planilha preenchida
          <input type="file" accept=".xlsx,.xls,.csv" style=${{ display: 'none' }} disabled=${busy}
            onChange=${e => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; }} />
        </label>
      </div>
      ${resumo && html`
        <div style=${{ marginTop: 12, padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, fontSize: 12, color: '#334155' }}>
          ✅ <strong>${resumo.reunioes}</strong> reuniões e <strong>${resumo.parts}</strong> participações importadas.
          ${resumo.semMatch.length > 0 && html`
            <div style=${{ marginTop: 6, color: '#92400E' }}>
              ⚠️ ${resumo.semMatch.length} nome(s) não encontrados no diretório (ficaram registrados como texto):
              ${' ' + resumo.semMatch.slice(0, 8).join('; ')}${resumo.semMatch.length > 8 ? '…' : ''}
            </div>`}
          ${resumo.invalidas.length > 0 && html`
            <div style=${{ marginTop: 6, color: '#991B1B' }}>❌ ${resumo.invalidas.length} linha(s) com data inválida foram ignoradas.</div>`}
        </div>`}
    </div>

    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ fontWeight: 800, fontSize: 14 }}>📤 Exportar histórico completo</div>
      <div style=${{ fontSize: 12, color: '#64748B', margin: '4px 0 10px' }}>
        Gera um Excel com todas as participações (discursos, orações, funções) e outra aba com hinos e textos.
        Serve como backup — guarde uma cópia de tempos em tempos.
      </div>
      <button class="btn btn-g" style=${{ width: '100%', fontSize: 12, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${exportar}>
        ⬇️ Exportar tudo (Excel)
      </button>
    </div>`;
}
