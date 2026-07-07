import { html, useState, useEffect, useMemo, useRef, sb, norm, toISO, fromISO, fmtBR, Spinner, Empty, Modal, Chip, InfoTip, exportarExcel, exportarPDF, tabelaHTML, sincronizarAlertas, sincronizarAlertasRegistro, SITUACAO_MEMBRO } from './core.js';
import { IcLupa, IcBaixar, IcImprimir, IcFiltro } from './icons.js';

const AZUL = '#16436B', DOURADO = '#9A7B3F', VERDE = '#2F6B4F', VERMELHO = '#96372F';
const pct = v => `${Math.round(v * 100)}%`;
const pp = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)} p.p.`;
const diasAtras = n => toISO(new Date(Date.now() - n * 864e5));

// ─── Gráfico de linha com comparação com o ponto anterior (Evolução) ─────
function LineChart({ pontos }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  if (pontos.length === 0) return html`<${Empty} msg="Sem dados no período." />`;
  const W = 600, H = 180, PL = 34, PR = 14, PT = 14, PB = 26;
  const iw = W - PL - PR, ih = H - PT - PB;
  const x = i => PL + (pontos.length === 1 ? iw / 2 : i * iw / (pontos.length - 1));
  const y = v => PT + ih - v * ih;
  const path = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * W;
    let best = 0, bd = 1e9;
    pontos.forEach((_, i) => { const d = Math.abs(x(i) - cx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };
  return html`
  <div style=${{ position: 'relative' }}>
    <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', display: 'block', touchAction: 'pan-y' }}
      onMouseMove=${onMove} onTouchStart=${onMove} onTouchMove=${onMove} onMouseLeave=${() => setHover(null)}>
      ${[0, .25, .5, .75, 1].map(g => html`
        <line x1=${PL} x2=${W - PR} y1=${y(g)} y2=${y(g)} stroke="#EFEDE7" stroke-width="1"/>
        <text x=${PL - 6} y=${y(g) + 3.5} text-anchor="end" font-size="10" fill="#8A9099">${Math.round(g * 100)}%</text>`)}
      ${hover != null && html`<line x1=${x(hover)} x2=${x(hover)} y1=${PT} y2=${PT + ih} stroke="#E5E2DB" stroke-width="1"/>`}
      <path d=${path} fill="none" stroke=${AZUL} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pontos.map((p, i) => html`
        <circle cx=${x(i)} cy=${y(p.v)} r=${hover === i ? 5 : 3.5} fill=${AZUL} stroke="#FFF" stroke-width="2"/>`)}
      ${pontos.map((p, i) => (pontos.length <= 8 || i === pontos.length - 1 || hover === i) && html`
        <text x=${x(i)} y=${H - 8} text-anchor="middle" font-size="10" fill="#5A6068">${p.l}</text>`)}
      ${hover == null && pontos.length > 0 && html`
        <text x=${x(pontos.length - 1) - 8} y=${y(pontos[pontos.length - 1].v) - 9} text-anchor="end" font-size="11" font-weight="700" fill="#23282E">
          ${pct(pontos[pontos.length - 1].v)}</text>`}
    </svg>
    ${hover != null && html`
      <div style=${{ position: 'absolute', top: 0, left: `${x(hover) / W * 100}%`, transform: `translateX(${hover > pontos.length / 2 ? '-105%' : '6px'})`,
        background: '#23282E', color: '#FFF', borderRadius: 8, padding: '7px 11px', fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style=${{ fontWeight: 700 }}>${pontos[hover].full || pontos[hover].l}</div>
        <div>Presença: ${pct(pontos[hover].v)} (${pontos[hover].n} pessoas)</div>
        ${hover > 0 && html`<div style=${{ color: pontos[hover].v >= pontos[hover - 1].v ? '#8FD3AE' : '#F2B3AB' }}>
          ${pp(pontos[hover].v - pontos[hover - 1].v)} em relação a ${pontos[hover - 1].l}</div>`}
      </div>`}
  </div>`;
}

function Bars({ itens }) {
  const max = Math.max(1, ...itens.map(i => i.n));
  return itens.map(i => html`
    <div key=${i.l} style=${{ margin: '7px 0' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tinta2)', marginBottom: 3 }}>
        <span>${i.l}</span><span style=${{ fontWeight: 700 }}>${i.n}</span>
      </div>
      <div style=${{ background: 'var(--linha2)', borderRadius: 4, height: 8 }}>
        <div style=${{ width: `${i.n / max * 100}%`, background: AZUL, height: 8, borderRadius: 4 }}></div>
      </div>
    </div>`);
}

// ─── Filtro compacto reaproveitado pelos indicadores não-comparativos ───
// Indicadores de evolução/comparativo (Indicador de frequência, Evolução da
// taxa de presença) não usam este filtro — eles já comparam períodos entre
// si. Este filtro serve para "recortar" indicadores de estado (frequência
// alternada, presença virtual, justificativas) numa janela e critério
// escolhidos pelo usuário, em vez da janela fixa de 3 meses.
function filtroPadrao() { return { de: diasAtras(91), ate: toISO(new Date()), genero: 'todos', idadeMin: '', idadeMax: '', q: '', motivo: '' }; }
function filtroAtivo(f) {
  const p = filtroPadrao();
  return f.de !== p.de || f.ate !== p.ate || f.genero !== 'todos' || !!f.idadeMin || !!f.idadeMax || !!f.q || !!f.motivo;
}
function filtrarPessoas(lista, f) {
  return lista.filter(p => {
    if (f.genero !== 'todos' && p.sexo !== f.genero) return false;
    if (f.idadeMin && (p.idade == null || p.idade < Number(f.idadeMin))) return false;
    if (f.idadeMax && (p.idade == null || p.idade > Number(f.idadeMax))) return false;
    if (f.q && !norm(p.nome).includes(norm(f.q))) return false;
    if (f.motivo && !(p.faltas || []).some(x => x.motivo === f.motivo)) return false;
    return true;
  });
}

function FiltroIndicador({ f, setF, comMotivo, motivos, comMembro }) {
  const [aberto, setAberto] = useState(false);
  const upd = (k, v) => setF(o => ({ ...o, [k]: v }));
  const ativo = filtroAtivo(f);
  return html`
    <div style=${{ marginBottom: 10 }}>
      <button class="btn btn-s" style=${{ fontSize: 11.5, padding: '5px 10px' }} onClick=${() => setAberto(a => !a)}>
        <${IcFiltro} size=${13} /> Filtrar${ativo ? ' •' : ''}
      </button>
      ${aberto && html`
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, padding: 10, background: 'var(--papel)', borderRadius: 8, border: '1px solid var(--linha2)' }}>
        <div style=${{ flex: '1 1 130px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}>De
            <${InfoTip} texto="Este é o filtro principal — ajusta a janela de datas considerada por este indicador." />
          </label>
          <input class="inp" type="date" style=${{ fontSize: 12, padding: 7 }} value=${f.de} onInput=${e => upd('de', e.target.value)} />
        </div>
        <div style=${{ flex: '1 1 130px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Até</label>
          <input class="inp" type="date" style=${{ fontSize: 12, padding: 7 }} value=${f.ate} onInput=${e => upd('ate', e.target.value)} />
        </div>
        ${comMembro && html`
        <div style=${{ flex: '2 1 160px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Membro</label>
          <input class="inp" type="search" style=${{ fontSize: 12, padding: 7 }} placeholder="Buscar por nome…" value=${f.q} onInput=${e => upd('q', e.target.value)} />
        </div>`}
        <div style=${{ flex: '1 1 100px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Gênero</label>
          <select class="inp" style=${{ fontSize: 12, padding: 7 }} value=${f.genero} onChange=${e => upd('genero', e.target.value)}>
            <option value="todos">Todos</option><option value="F">Feminino</option><option value="M">Masculino</option>
          </select>
        </div>
        <div style=${{ flex: '1 1 85px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Idade mín.</label>
          <input class="inp" type="number" min="0" style=${{ fontSize: 12, padding: 7 }} value=${f.idadeMin} onInput=${e => upd('idadeMin', e.target.value)} />
        </div>
        <div style=${{ flex: '1 1 85px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Idade máx.</label>
          <input class="inp" type="number" min="0" style=${{ fontSize: 12, padding: 7 }} value=${f.idadeMax} onInput=${e => upd('idadeMax', e.target.value)} />
        </div>
        ${comMotivo && html`
        <div style=${{ flex: '1 1 140px' }}>
          <label class="lbl" style=${{ marginTop: 0, fontSize: 10.5 }}>Justificativa</label>
          <select class="inp" style=${{ fontSize: 12, padding: 7 }} value=${f.motivo} onChange=${e => upd('motivo', e.target.value)}>
            <option value="">Todas</option>
            ${motivos.map(m => html`<option key=${m} value=${m}>${m}</option>`)}
          </select>
        </div>`}
        ${ativo && html`<button class="btn btn-s" style=${{ fontSize: 11, alignSelf: 'flex-end' }} onClick=${() => setF(filtroPadrao())}>Limpar filtro</button>`}
      </div>`}
    </div>`;
}

// ─── Indicador numérico de frequência (semana/mês/semestre/ano) ─────────
// Comparativo por natureza — não usa o filtro acima; pode alternar entre
// contagem e percentual, com linha mostrando a oscilação entre períodos.
const ROTULOS_INDICADOR = {
  semana:   { l: 'Presentes na última semana', unico: true },
  mes:      { l: 'Média mensal de presentes', unico: false },
  semestre: { l: 'Média semestral de presentes', unico: false },
  ano:      { l: 'Média anual de presentes', unico: false },
};

function IndicadorFrequencia({ comDados, baseMembros }) {
  const [modo, setModo] = useState('semana');
  const [unidade, setUnidade] = useState('contagem');   // contagem | percentual

  const dados = useMemo(() => {
    if (comDados.length === 0) return null;
    let buckets;
    if (modo === 'semana') {
      buckets = comDados.map(r => ({ l: fmtBR(r.data).slice(0, 5), full: `Domingo ${fmtBR(r.data)}`, n: r.pres.filter(p => p.presente).length }));
    } else {
      const key = modo === 'mes' ? d => d.slice(0, 7)
        : modo === 'semestre' ? d => `${d.slice(0, 4)}-S${d.slice(5, 7) <= '06' ? 1 : 2}`
        : d => d.slice(0, 4);
      const map = new Map();
      comDados.forEach(r => { const k = key(r.data); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
      buckets = [...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, rs]) => ({
        l: k, full: k, n: Math.round(rs.reduce((s, r) => s + r.pres.filter(p => p.presente).length, 0) / rs.length),
      }));
    }
    const serie = buckets.slice(-8).map(b => ({ ...b, v: unidade === 'percentual' && baseMembros ? b.n / baseMembros : b.n }));
    const atual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    const delta = anterior && anterior.v > 0 ? (atual.v - anterior.v) / anterior.v : null;
    return { serie, atual, delta };
  }, [comDados, modo, unidade, baseMembros]);

  if (!dados) return null;
  const vals = dados.serie.map(b => b.v);
  const max = Math.max(unidade === 'percentual' ? 0.01 : 1, ...vals);
  const min = Math.min(0, ...vals);
  const dom = (max - min) || 1;
  const W = 600, H = 150, PL = 34, PR = 14, PT = 14, PB = 22;
  const iw = W - PL - PR, ih = H - PT - PB;
  const x = i => PL + (dados.serie.length === 1 ? iw / 2 : i * iw / (dados.serie.length - 1));
  const y = v => PT + ih - (v - min) / dom * ih;
  const path = dados.serie.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  const fmtV = v => unidade === 'percentual' ? pct(v) : `${Math.round(v)}`;

  return html`
    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div class="titulo-secao">Indicador de frequência
          <${InfoTip} texto="Comparativo de presença por período (semana, mês, semestre ou ano), em contagem ou percentual sobre os membros ativos. A linha mostra a oscilação — cada ponto compara com o período anterior." /></div>
        <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div class="seg" style=${{ width: 120 }}>
            ${[['contagem', 'Nº'], ['percentual', '%']].map(([k, l]) => html`
              <button key=${k} class=${unidade === k ? 'on' : ''} onClick=${() => setUnidade(k)}>${l}</button>`)}
          </div>
          <div class="seg" style=${{ width: 280 }}>
            ${[['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']].map(([k, l]) => html`
              <button key=${k} class=${modo === k ? 'on' : ''} onClick=${() => setModo(k)}>${l}</button>`)}
          </div>
        </div>
      </div>
      <div style=${{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div class="serif" style=${{ fontSize: 34, fontWeight: 700, color: 'var(--tinta)' }}>${fmtV(dados.atual.v)}</div>
        <div style=${{ fontSize: 12, color: 'var(--tinta2)' }}>${ROTULOS_INDICADOR[modo].l}</div>
      </div>
      ${dados.delta != null && html`
        <div style=${{ fontSize: 12, fontWeight: 600, color: dados.delta >= 0 ? 'var(--verde)' : 'var(--vermelho)', marginTop: 2 }}>
          ${dados.delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(dados.delta * 100))}% em relação ao período anterior
        </div>`}
      <svg viewBox=${`0 0 ${W} ${H}`} style=${{ width: '100%', display: 'block', marginTop: 10 }}>
        ${[0, .25, .5, .75, 1].map(g => { const val = min + g * dom; return html`
          <line x1=${PL} x2=${W - PR} y1=${y(val)} y2=${y(val)} stroke="#EFEDE7" stroke-width="1"/>
          <text x=${PL - 6} y=${y(val) + 3.5} text-anchor="end" font-size="10" fill="#8A9099">${fmtV(val)}</text>`; })}
        <path d=${path} fill="none" stroke=${AZUL} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dados.serie.map((p, i) => html`<circle key=${i} cx=${x(i)} cy=${y(p.v)} r="3.5" fill=${AZUL} stroke="#FFF" stroke-width="2"/>`)}
        ${dados.serie.map((p, i) => (dados.serie.length <= 8 || i === dados.serie.length - 1) && html`
          <text key=${`l${i}`} x=${x(i)} y=${H - 6} text-anchor="middle" font-size="10" fill="#5A6068">${p.l}</text>`)}
        ${dados.serie.map((p, i) => {
          const prev = dados.serie[i - 1];
          if (!prev || prev.v <= 0) return null;
          const d = (p.v - prev.v) / prev.v;
          return html`<text key=${`d${i}`} x=${x(i)} y=${y(p.v) - 9} text-anchor="middle" font-size="9" font-weight="700" fill=${d >= 0 ? VERDE : VERMELHO}>${d >= 0 ? '+' : ''}${Math.round(d * 100)}%</text>`;
        })}
      </svg>
    </div>`;
}

// ─── Cálculo de "frequência alternada" numa janela [de, ate] qualquer ────
function computarAlternantes(comDados, membros, de, ate) {
  const janela = comDados.filter(r => r.data >= de && r.data <= ate);
  const porMembro = new Map();
  janela.forEach(r => r.pres.forEach(p => {
    if (!porMembro.has(p.membro_id)) porMembro.set(p.membro_id, []);
    porMembro.get(p.membro_id).push({ data: r.data, presente: p.presente, motivo: p.motivos_falta });
  }));
  const membroById = new Map(membros.map(m => [m.id, m]));
  const alternantes = [];
  let ativos = 0;
  porMembro.forEach((regs, id) => {
    const m = membroById.get(id);
    if (!m || m.situacao === 'fora_diretorio') return;
    const presencasN = regs.filter(r => r.presente).length;
    if (presencasN === 0) return;                       // inativo — não entra
    ativos++;
    const faltas = regs.filter(r => !r.presente && !r.motivo?.excluir_da_metrica);
    if (faltas.length === 0) return;                     // frequência regular
    alternantes.push({
      id, nome: m.nome, situacao: m.situacao, sexo: m.sexo, idade: m.idade,
      presencas: presencasN, considerados: presencasN + faltas.length,
      faltas: faltas.sort((a, b) => a.data.localeCompare(b.data))
        .map(f => ({ data: f.data, motivo: f.motivo?.nome || 'Sem justificativa' })),
    });
  });
  alternantes.sort((a, b) => a.presencas - b.presencas || b.faltas.length - a.faltas.length || a.nome.localeCompare(b.nome));
  return { alternantes, ativos };
}

// ─── Série de %/nominal de frequência alternada por período (itens 8 e 9) ─
// Para cada domingo, classifica a alternância usando uma janela móvel de 3
// meses terminando naquele domingo; agrupado, cada coluna é a média do
// período (percentual e nominal).
function serieAlternanciaPct(comDados, membros, agrupamento) {
  const porDomingo = comDados.map(r => {
    const corte = toISO(new Date(fromISO(r.data) - 91 * 864e5));
    const { alternantes, ativos } = computarAlternantes(comDados, membros, corte, r.data);
    return { data: r.data, pct: ativos > 0 ? alternantes.length / ativos : 0, n: alternantes.length };
  });
  if (agrupamento === 'semana') {
    return porDomingo.slice(-8).map(p => ({ l: fmtBR(p.data).slice(0, 5), full: `Domingo ${fmtBR(p.data)}`, v: p.pct, n: p.n }));
  }
  const key = agrupamento === 'mes' ? d => d.slice(0, 7)
    : agrupamento === 'trimestre' ? d => `${d.slice(0, 4)}-T${Math.ceil(Number(d.slice(5, 7)) / 3)}`
    : d => `${d.slice(0, 4)}-S${d.slice(5, 7) <= '06' ? 1 : 2}`;
  const map = new Map();
  porDomingo.forEach(p => { const k = key(p.data); if (!map.has(k)) map.set(k, []); map.get(k).push(p); });
  return [...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-8).map(([k, ps]) => ({
    l: k, full: k,
    v: ps.reduce((s, p) => s + p.pct, 0) / ps.length,
    n: Math.round(ps.reduce((s, p) => s + p.n, 0) / ps.length),
  }));
}

// ─── Indicador de % de frequência alternada + comparativo (itens 8 e 9) ──
function IndicadorPercentualAlternancia({ comDados, membros }) {
  const [agrup, setAgrup] = useState('semana');
  const serie = useMemo(() => comDados.length ? serieAlternanciaPct(comDados, membros, agrup) : [], [comDados, membros, agrup]);
  if (serie.length === 0) return null;
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  const deltaPct = anterior ? atual.v - anterior.v : null;
  const deltaN = anterior ? atual.n - anterior.n : null;
  const max = Math.max(0.01, ...serie.map(s => s.v));

  return html`
    <div class="card" style=${{ padding: 14 }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div class="titulo-secao">Percentual de frequência alternada
          <${InfoTip} texto="Parcela dos membros ativos que, na janela móvel de 3 meses terminando em cada período, têm frequência alternada. Agrupado por mês, trimestre ou semestre, cada coluna é a média do período. Logo abaixo, a comparação com o período anterior, em pontos percentuais e em número de pessoas." /></div>
        <div class="seg" style=${{ width: 300 }}>
          ${[['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre']].map(([k, l]) => html`
            <button key=${k} class=${agrup === k ? 'on' : ''} onClick=${() => setAgrup(k)}>${l}</button>`)}
        </div>
      </div>
      <div style=${{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div class="serif" style=${{ fontSize: 34, fontWeight: 700, color: 'var(--tinta)' }}>${pct(atual.v)}</div>
        <div style=${{ fontSize: 12, color: 'var(--tinta2)' }}>${atual.n} pessoa${atual.n !== 1 ? 's' : ''} com frequência alternada</div>
      </div>
      ${deltaPct != null && html`
        <div style=${{ fontSize: 12, fontWeight: 600, color: deltaPct >= 0 ? 'var(--vermelho)' : 'var(--verde)', marginTop: 2 }}>
          ${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(deltaPct * 100))} p.p. (${deltaN >= 0 ? '+' : ''}${deltaN} pessoa${Math.abs(deltaN) !== 1 ? 's' : ''}) em relação ao período anterior
        </div>`}
      <div style=${{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90, marginTop: 14 }}>
        ${serie.map((b, i) => html`
          <div key=${i} style=${{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title=${b.full}>
            <span style=${{ fontSize: 10, color: 'var(--tinta3)' }}>${pct(b.v)}</span>
            <div style=${{ width: '100%', maxWidth: 26, height: `${Math.max(4, b.v / max * 64)}px`, background: DOURADO, borderRadius: '3px 3px 0 0' }}></div>
            <span style=${{ fontSize: 9.5, color: 'var(--tinta3)', textAlign: 'center' }}>${b.l}</span>
          </div>`)}
      </div>
    </div>`;
}

// ─── Relatório demonstrativo da frequência alternada ─────────────────────
function RelatorioAlternancia({ perfil, alternantes, onClose }) {
  const CAB = ['Membro', 'Presenças', 'Domingos considerados', 'Faltas (dia — justificativa)'];
  const linhas = alternantes.map(a => [
    a.nome, a.presencas, a.considerados,
    a.faltas.map(f => `${fmtBR(f.data)} — ${f.motivo}`).join('; ') || '—',
  ]);
  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Membros com frequência alternada</div>
    <div style=${{ fontSize: 12, color: 'var(--tinta2)', margin: '4px 0 12px', lineHeight: 1.55 }}>
      Membros ativos (ao menos uma presença no período) que não têm frequência regular, conforme o filtro aplicado.
      Quem menos compareceu aparece primeiro. Faltas com justificativa marcada como
      “não conta na métrica” são desconsideradas.
    </div>
    <div style=${{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button class="btn btn-s" style=${{ flex: 1, fontSize: 12.5 }}
        onClick=${() => exportarExcel(`frequencia-alternada-${toISO(new Date())}.xlsx`, [{ nome: 'Frequência alternada', linhas: [CAB, ...linhas] }])}>
        <${IcBaixar} size=${14} /> Excel
      </button>
      <button class="btn btn-s" style=${{ flex: 1, fontSize: 12.5 }}
        onClick=${() => exportarPDF(`Frequência alternada — ${perfil.alas?.nome || ''}`,
          `${alternantes.length} membro(s) · gerado em ${fmtBR(toISO(new Date()))}`,
          tabelaHTML(CAB, linhas))}>
        <${IcImprimir} size=${14} /> PDF
      </button>
    </div>
    ${alternantes.map(a => html`
      <div key=${a.id} style=${{ borderBottom: '1px solid var(--linha2)', padding: '9px 0' }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
          <span>${a.nome}${SITUACAO_MEMBRO[a.situacao] ? html` <${Chip} bg=${SITUACAO_MEMBRO[a.situacao].bg} t=${SITUACAO_MEMBRO[a.situacao].t} style=${{ fontSize: 10 }}>${SITUACAO_MEMBRO[a.situacao].l}<//>` : ''}</span>
          <span style=${{ color: 'var(--tinta2)', fontWeight: 400 }}>${a.presencas}/${a.considerados} domingos</span>
        </div>
        ${a.faltas.map(f => html`
          <div style=${{ fontSize: 11.5, color: 'var(--tinta3)', marginTop: 2 }}>
            Faltou em ${fmtBR(f.data)} · ${f.motivo}
          </div>`)}
      </div>`)}
    <button class="btn btn-p" style=${{ width: '100%', marginTop: 14 }} onClick=${onClose}>Fechar</button>
  <//>`;
}

export function Dashboard({ perfil }) {
  const [dados, setDados] = useState(null);
  const [modo, setModo] = useState('semanas');
  const [verAlternancia, setVerAlternancia] = useState(false);
  const [fAlt, setFAlt] = useState(filtroPadrao());
  const [fVirt, setFVirt] = useState(filtroPadrao());
  const [fJust, setFJust] = useState(filtroPadrao());

  useEffect(() => {
    (async () => {
      await Promise.all([sincronizarAlertas(perfil.ala_id), sincronizarAlertasRegistro(perfil.ala_id)]);
      const [{ data: reunioes }, { data: presencas }, { data: membros }, { count: alertas }, { count: alertasRegistro }] = await Promise.all([
        sb.from('reunioes').select('id, data, visitantes').eq('ala_id', perfil.ala_id).eq('tipo', 'sacramental').order('data'),
        sb.from('presencas').select('reuniao_id, membro_id, presente, origem, motivo_falta_id, motivos_falta(nome, excluir_da_metrica)').eq('ala_id', perfil.ala_id).limit(30000),
        sb.from('membros').select('id, nome, sexo, idade, is_membro, situacao').eq('ala_id', perfil.ala_id).eq('ativo', true),
        sb.from('alertas').select('id', { count: 'exact', head: true }).eq('ala_id', perfil.ala_id).eq('status', 'aberto'),
        sb.from('alertas_registro').select('id', { count: 'exact', head: true }).eq('ala_id', perfil.ala_id).eq('status', 'aberto'),
      ]);
      setDados({ reunioes: reunioes || [], presencas: presencas || [], membros: membros || [], alertas: alertas || 0, alertasRegistro: alertasRegistro || 0 });
    })();
  }, [perfil.ala_id]);

  const calc = useMemo(() => {
    if (!dados) return null;
    const { reunioes, presencas, membros } = dados;
    const baseMembros = membros.filter(m => m.is_membro && m.situacao !== 'fora_diretorio').length || 1;
    const porReuniao = new Map(reunioes.map(r => [r.id, { ...r, pres: [] }]));
    presencas.forEach(p => porReuniao.get(p.reuniao_id)?.pres.push(p));
    const comDados = [...porReuniao.values()].filter(r => r.pres.length > 0).sort((a, b) => a.data.localeCompare(b.data));

    // Evolução por período
    let grupos;
    if (modo === 'semanas') {
      grupos = comDados.slice(-10).map(r => ({ l: fmtBR(r.data).slice(0, 5), full: `Domingo ${fmtBR(r.data)}`, rs: [r] }));
    } else {
      const key = modo === 'meses' ? d => d.slice(0, 7) : d => d.slice(0, 4);
      const map = new Map();
      comDados.forEach(r => { const k = key(r.data); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
      grupos = [...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-12)
        .map(([k, rs]) => ({ l: modo === 'meses' ? `${k.slice(5)}/${k.slice(2, 4)}` : k, full: k, rs }));
    }
    const pontos = grupos.map(g => {
      const media = g.rs.reduce((s, r) => s + r.pres.filter(p => p.presente).length, 0) / g.rs.length;
      return { l: g.l, full: g.full, v: Math.min(1, media / baseMembros), n: Math.round(media) };
    });

    // ── Frequência alternada fixa (últimos 3 meses) — alimenta só o KPI ──
    const { alternantes } = computarAlternantes(comDados, membros, diasAtras(91), toISO(new Date()));

    const ultima = comDados[comDados.length - 1];
    const penultima = comDados[comDados.length - 2];
    const presUltima = ultima ? ultima.pres.filter(p => p.presente).length : 0;
    const presPenultima = penultima ? penultima.pres.filter(p => p.presente).length : null;

    return {
      pontos, alternantes, comDados,
      presUltima, presPenultima, dataUltima: ultima?.data,
      visitantesUltima: ultima?.visitantes || 0,
      baseMembros, temDados: comDados.length > 0,
      deltaSemana: presPenultima != null && baseMembros ? (presUltima - presPenultima) / baseMembros : null,
    };
  }, [dados, modo]);

  const motivosDisponiveis = useMemo(() => dados
    ? [...new Set(dados.presencas.map(p => p.motivos_falta?.nome).filter(Boolean))].sort()
    : [], [dados]);

  const altFiltrado = useMemo(() => {
    if (!calc || !dados) return [];
    const { alternantes } = computarAlternantes(calc.comDados, dados.membros, fAlt.de, fAlt.ate);
    return filtrarPessoas(alternantes, fAlt);
  }, [calc, dados, fAlt]);

  const virtFiltrado = useMemo(() => {
    if (!calc || !dados) return null;
    const membroById = new Map(dados.membros.map(m => [m.id, m]));
    const diasJanela = Math.round((fromISO(fVirt.ate) - fromISO(fVirt.de)) / 864e5) + 1;
    const deAnterior = toISO(new Date(fromISO(fVirt.de).getTime() - diasJanela * 864e5));
    const ateAnterior = toISO(new Date(fromISO(fVirt.de).getTime() - 864e5));
    const passaFiltro = p => {
      const m = membroById.get(p.membro_id);
      if (fVirt.genero !== 'todos' && m?.sexo !== fVirt.genero) return false;
      if (fVirt.idadeMin && (m?.idade == null || m.idade < Number(fVirt.idadeMin))) return false;
      if (fVirt.idadeMax && (m?.idade == null || m.idade > Number(fVirt.idadeMax))) return false;
      if (fVirt.q && !norm(m?.nome || '').includes(norm(fVirt.q))) return false;
      return true;
    };
    let atual = 0, anterior = 0;
    const top = new Map();
    calc.comDados.forEach(r => {
      const dentroAtual = r.data >= fVirt.de && r.data <= fVirt.ate;
      const dentroAnterior = r.data >= deAnterior && r.data <= ateAnterior;
      if (!dentroAtual && !dentroAnterior) return;
      r.pres.forEach(p => {
        if (!p.presente || p.origem !== 'transmissao' || !passaFiltro(p)) return;
        if (dentroAtual) { atual++; top.set(p.membro_id, (top.get(p.membro_id) || 0) + 1); }
        else anterior++;
      });
    });
    const crescimento = anterior > 0 ? (atual - anterior) / anterior : null;
    const lista = [...top.entries()].map(([id, n]) => ({ l: membroById.get(id)?.nome || '(removido)', n }))
      .sort((a, b) => b.n - a.n).slice(0, 8);
    return { atual, anterior, crescimento, lista };
  }, [calc, dados, fVirt]);

  const justFiltrado = useMemo(() => {
    if (!calc || !dados) return [];
    const membroById = new Map(dados.membros.map(m => [m.id, m]));
    const janela = calc.comDados.filter(r => r.data >= fJust.de && r.data <= fJust.ate);
    const just = new Map();
    janela.forEach(r => r.pres.filter(p => !p.presente).forEach(p => {
      const m = membroById.get(p.membro_id);
      if (fJust.genero !== 'todos' && m?.sexo !== fJust.genero) return;
      if (fJust.idadeMin && (m?.idade == null || m.idade < Number(fJust.idadeMin))) return;
      if (fJust.idadeMax && (m?.idade == null || m.idade > Number(fJust.idadeMax))) return;
      if (fJust.q && !norm(m?.nome || '').includes(norm(fJust.q))) return;
      const nome = p.motivos_falta?.nome || 'Sem justificativa';
      just.set(nome, (just.get(nome) || 0) + 1);
    }));
    return [...just.entries()].map(([l, n]) => ({ l, n })).sort((a, b) => b.n - a.n);
  }, [calc, dados, fJust]);

  if (!calc) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">Painel da Ala</div>
    <div class="sub">Indicadores de presença sacramental, transmissão e acompanhamento</div>
    ${!calc.temDados ? html`
      <div class="card" style=${{ padding: 18, fontSize: 13, color: 'var(--tinta2)' }}>
        Ainda não há registros de presença. Comece pela aba <strong>Frequência</strong>: escolha o domingo,
        busque a família e marque quem esteve na reunião. Os indicadores aparecem aqui automaticamente.
      </div>` : html`
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div class="kpi">
          <div class="v">${calc.presUltima}</div>
          <div class="l">Presentes em ${calc.dataUltima ? fmtBR(calc.dataUltima) : '—'}
            <${InfoTip} texto="Membros marcados como presentes no último domingo registrado (no salão ou pela transmissão). Visitantes não entram nesta contagem." /></div>
          ${calc.presPenultima != null && html`
            <div style=${{ fontSize: 11, marginTop: 4, fontWeight: 600, color: calc.presUltima >= calc.presPenultima ? 'var(--verde)' : 'var(--vermelho)' }}>
              ${calc.presUltima >= calc.presPenultima ? '▲' : '▼'} ${Math.abs(calc.presUltima - calc.presPenultima)} vs. domingo anterior
            </div>`}
        </div>
        <div class="kpi">
          <div class="v">${calc.alternantes.length}</div>
          <div class="l">Membros com frequência alternada
            <${InfoTip} texto="Membros ativos (ao menos uma presença nos últimos 3 meses) que tiveram alguma falta no período — quanto menos presenças, mais alto na lista. Faltas com justificativa marcada como “não conta na métrica” (ex.: doença) são desconsideradas." /></div>
        </div>
        <div class="kpi">
          <div class="v" style=${{ color: dados.alertas ? 'var(--vermelho)' : 'var(--verde)' }}>${dados.alertas}</div>
          <div class="l">Alertas de ausência abertos
            <${InfoTip} texto="Membros ativos que faltaram dois domingos seguidos. Veja e dispense os alertas na aba Frequência." /></div>
        </div>
        <div class="kpi">
          <div class="v" style=${{ color: dados.alertasRegistro ? 'var(--ambar)' : 'var(--verde)' }}>${dados.alertasRegistro}</div>
          <div class="l">Registros sistêmicos pendentes
            <${InfoTip} texto="Apoios e desobrigações lançados na agenda que ainda precisam ser repassados ao registro sistêmico oficial da Igreja. Aparece a partir de domingo ao meio-dia." /></div>
        </div>
      </div>

      <${IndicadorFrequencia} comDados=${calc.comDados} baseMembros=${calc.baseMembros} />

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div class="titulo-secao">Evolução da taxa de presença
            <${InfoTip} texto="Presentes ÷ membros ativos do diretório, em cada período. Passe o dedo ou o mouse sobre o gráfico para comparar cada semana com a anterior." /></div>
          <div class="seg" style=${{ width: 210 }}>
            ${[['semanas', 'Semanas'], ['meses', 'Meses'], ['anos', 'Anos']].map(([k, l]) => html`
              <button key=${k} class=${modo === k ? 'on' : ''} onClick=${() => setModo(k)}>${l}</button>`)}
          </div>
        </div>
        <${LineChart} pontos=${calc.pontos} />
        <div style=${{ fontSize: 11, color: 'var(--tinta3)', marginTop: 6 }}>
          Base: ${calc.baseMembros} membros ativos no diretório.
          ${calc.deltaSemana != null && ` Última semana: ${pp(calc.deltaSemana)} em relação à anterior.`}
        </div>
      </div>

      <${IndicadorPercentualAlternancia} comDados=${calc.comDados} membros=${dados.membros} />

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div class="titulo-secao">Membros com frequência alternada
              <${InfoTip} texto="Membros ativos sem regularidade de presença no período filtrado, do menos frequente ao mais frequente. Membro ativo = ao menos uma presença no período. Faltas com justificativa excluída da métrica não contam." /></div>
            <div style=${{ fontSize: 11.5, color: 'var(--tinta3)', margin: '2px 0 8px' }}>Quem menos compareceu primeiro.</div>
          </div>
          <button class="btn btn-s" style=${{ fontSize: 12, flexShrink: 0 }} onClick=${() => setVerAlternancia(true)} title="Relatório demonstrativo">
            <${IcLupa} size=${15} /> Relatório
          </button>
        </div>
        <${FiltroIndicador} f=${fAlt} setF=${setFAlt} comMotivo=${true} motivos=${motivosDisponiveis} comMembro=${true} />
        ${altFiltrado.length === 0 && html`<${Empty} msg="Nenhum membro com frequência alternada no filtro escolhido." />`}
        ${altFiltrado.map(r => html`
          <div key=${r.id} style=${{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--linha2)', fontSize: 13, gap: 8 }}>
            <span style=${{ minWidth: 0 }}>${r.nome}</span>
            <span style=${{ color: 'var(--tinta2)', fontSize: 12, flexShrink: 0 }}>${r.presencas} de ${r.considerados} domingos</span>
          </div>`)}
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div class="titulo-secao">Presença virtual
          <${InfoTip} texto="Presenças registradas pela transmissão no período filtrado. Crescimento = comparação com um período anterior de mesma duração. A lista mostra quem mais assistiu de casa." /></div>
        <${FiltroIndicador} f=${fVirt} setF=${setFVirt} comMembro=${true} />
        <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${virtFiltrado?.atual ?? 0}</div><div class="l">Presenças virtuais no período</div></div>
          <div class="kpi" style=${{ padding: 10 }}>
            <div class="v" style=${{ fontSize: 19, color: virtFiltrado?.crescimento == null ? 'var(--tinta)' : virtFiltrado.crescimento >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>
              ${virtFiltrado?.crescimento == null ? '—' : `${virtFiltrado.crescimento > 0 ? '+' : ''}${Math.round(virtFiltrado.crescimento * 100)}%`}</div>
            <div class="l">Crescimento vs. período anterior</div>
          </div>
        </div>
        ${!virtFiltrado || virtFiltrado.lista.length === 0
          ? html`<${Empty} msg="Nenhuma presença via transmissão no filtro escolhido." />`
          : html`<${Bars} itens=${virtFiltrado.lista} />`}
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div class="titulo-secao">Principais justificativas de falta
          <${InfoTip} texto="Contagem das justificativas registradas nas faltas do período filtrado. Faltas sem justificativa entram como “Sem justificativa”." /></div>
        <${FiltroIndicador} f=${fJust} setF=${setFJust} comMembro=${true} />
        ${justFiltrado.length === 0 ? html`<${Empty} msg="Nenhuma falta registrada no filtro escolhido." />` : html`<${Bars} itens=${justFiltrado} />`}
      </div>`}
    ${verAlternancia && html`<${RelatorioAlternancia} perfil=${perfil} alternantes=${altFiltrado} onClose=${() => setVerAlternancia(false)} />`}`;
}
