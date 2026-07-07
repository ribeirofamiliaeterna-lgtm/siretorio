import { html, useState, useEffect, useMemo, useRef, sb, toISO, fromISO, fmtBR, Spinner, Empty, Modal, Chip, InfoTip, exportarExcel, exportarPDF, tabelaHTML, sincronizarAlertas, SITUACAO_MEMBRO } from './core.js';
import { IcLupa, IcBaixar, IcImprimir } from './icons.js';

const AZUL = '#16436B', DOURADO = '#9A7B3F';
const pct = v => `${Math.round(v * 100)}%`;
const pp = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)} p.p.`;

// ─── Gráfico de linha com comparação com o ponto anterior ────────────────
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
      Membros ativos (ao menos uma presença nos últimos 3 meses) que não têm frequência regular.
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
          `Últimos 3 meses · ${alternantes.length} membro(s) · gerado em ${fmtBR(toISO(new Date()))}`,
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

  useEffect(() => {
    (async () => {
      await sincronizarAlertas(perfil.ala_id);
      const [{ data: reunioes }, { data: presencas }, { data: membros }, { count: alertas }] = await Promise.all([
        sb.from('reunioes').select('id, data, visitantes').eq('ala_id', perfil.ala_id).eq('tipo', 'sacramental').order('data'),
        sb.from('presencas').select('reuniao_id, membro_id, presente, origem, motivo_falta_id, motivos_falta(nome, excluir_da_metrica)').eq('ala_id', perfil.ala_id).limit(30000),
        sb.from('membros').select('id, nome, is_membro, situacao').eq('ala_id', perfil.ala_id).eq('ativo', true),
        sb.from('alertas').select('id', { count: 'exact', head: true }).eq('ala_id', perfil.ala_id).eq('status', 'aberto'),
      ]);
      setDados({ reunioes: reunioes || [], presencas: presencas || [], membros: membros || [], alertas: alertas || 0 });
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

    // ── Frequência alternada (janela: últimos 3 meses) ──
    const corte = toISO(new Date(Date.now() - 91 * 864e5));
    const janela = comDados.filter(r => r.data >= corte);
    const porMembro = new Map();
    janela.forEach(r => r.pres.forEach(p => {
      if (!porMembro.has(p.membro_id)) porMembro.set(p.membro_id, []);
      porMembro.get(p.membro_id).push({ data: r.data, presente: p.presente, motivo: p.motivos_falta });
    }));
    const membroById = new Map(membros.map(m => [m.id, m]));
    const alternantes = [];
    porMembro.forEach((regs, id) => {
      const m = membroById.get(id);
      if (!m || m.situacao === 'fora_diretorio') return;
      const presencasN = regs.filter(r => r.presente).length;
      if (presencasN === 0) return;                       // inativo — não entra
      // faltas com justificativa "excluir da métrica" não contam
      const faltas = regs.filter(r => !r.presente && !r.motivo?.excluir_da_metrica);
      if (faltas.length === 0) return;                    // frequência regular
      alternantes.push({
        id, nome: m.nome, situacao: m.situacao,
        presencas: presencasN, considerados: presencasN + faltas.length,
        faltas: faltas.sort((a, b) => a.data.localeCompare(b.data))
          .map(f => ({ data: f.data, motivo: f.motivo?.nome || 'Sem justificativa' })),
      });
    });
    alternantes.sort((a, b) => a.presencas - b.presencas || b.faltas.length - a.faltas.length || a.nome.localeCompare(b.nome));

    // ── Presença virtual (transmissão) ──
    const virt = presencas.filter(p => p.presente && p.origem === 'transmissao');
    const dataDe = new Map();
    porReuniao.forEach(r => r.pres.forEach(p => dataDe.set(p, r.data)));
    const d28 = toISO(new Date(Date.now() - 28 * 864e5));
    const d56 = toISO(new Date(Date.now() - 56 * 864e5));
    let v4 = 0, v8 = 0;
    const topVirt = new Map();
    virt.forEach(p => {
      const d = dataDe.get(p);
      if (!d) return;
      if (d >= d28) v4++;
      else if (d >= d56) v8++;
      if (d >= corte) topVirt.set(p.membro_id, (topVirt.get(p.membro_id) || 0) + 1);
    });
    const cresVirt = v8 > 0 ? (v4 - v8) / v8 : null;
    const topVirtList = [...topVirt.entries()]
      .map(([id, n]) => ({ l: membroById.get(id)?.nome || '(removido)', n }))
      .sort((a, b) => b.n - a.n).slice(0, 8);

    // ── Justificativas (últimos 3 meses) ──
    const just = new Map();
    janela.forEach(r => r.pres.filter(p => !p.presente).forEach(p => {
      const nome = p.motivos_falta?.nome || 'Sem justificativa';
      just.set(nome, (just.get(nome) || 0) + 1);
    }));
    const justItens = [...just.entries()].map(([l, n]) => ({ l, n })).sort((a, b) => b.n - a.n);

    const ultima = comDados[comDados.length - 1];
    const penultima = comDados[comDados.length - 2];
    const presUltima = ultima ? ultima.pres.filter(p => p.presente).length : 0;
    const presPenultima = penultima ? penultima.pres.filter(p => p.presente).length : null;

    return {
      pontos, alternantes, justItens, topVirtList, cresVirt, v4,
      presUltima, presPenultima, dataUltima: ultima?.data,
      visitantesUltima: ultima?.visitantes || 0,
      baseMembros, temDados: comDados.length > 0,
      deltaSemana: presPenultima != null && baseMembros ? (presUltima - presPenultima) / baseMembros : null,
    };
  }, [dados, modo]);

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
      </div>

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

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div class="titulo-secao">Frequência alternada
              <${InfoTip} texto="Todos os membros ativos sem regularidade de presença nos últimos 3 meses, do menos frequente ao mais frequente. Membro ativo = ao menos uma presença no período. Faltas com justificativa excluída da métrica não contam." /></div>
            <div style=${{ fontSize: 11.5, color: 'var(--tinta3)', margin: '2px 0 8px' }}>Últimos 3 meses · quem menos compareceu primeiro.</div>
          </div>
          <button class="btn btn-s" style=${{ fontSize: 12, flexShrink: 0 }} onClick=${() => setVerAlternancia(true)} title="Relatório demonstrativo">
            <${IcLupa} size=${15} /> Relatório
          </button>
        </div>
        ${calc.alternantes.length === 0 && html`<${Empty} msg="Nenhum membro com frequência alternada no período." />`}
        ${calc.alternantes.map(r => html`
          <div key=${r.id} style=${{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--linha2)', fontSize: 13, gap: 8 }}>
            <span style=${{ minWidth: 0 }}>${r.nome}</span>
            <span style=${{ color: 'var(--tinta2)', fontSize: 12, flexShrink: 0 }}>${r.presencas} de ${r.considerados} domingos</span>
          </div>`)}
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div class="titulo-secao">Presença virtual
          <${InfoTip} texto="Presenças registradas pela transmissão. Crescimento = comparação entre as últimas 4 semanas e as 4 anteriores. A lista mostra quem mais assistiu de casa nos últimos 3 meses." /></div>
        <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${calc.v4}</div><div class="l">Presenças virtuais (4 semanas)</div></div>
          <div class="kpi" style=${{ padding: 10 }}>
            <div class="v" style=${{ fontSize: 19, color: calc.cresVirt == null ? 'var(--tinta)' : calc.cresVirt >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>
              ${calc.cresVirt == null ? '—' : `${calc.cresVirt > 0 ? '+' : ''}${Math.round(calc.cresVirt * 100)}%`}</div>
            <div class="l">Crescimento vs. 4 semanas anteriores</div>
          </div>
        </div>
        ${calc.topVirtList.length === 0
          ? html`<${Empty} msg="Nenhuma presença via transmissão nos últimos 3 meses." />`
          : html`<${Bars} itens=${calc.topVirtList} />`}
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div class="titulo-secao">Principais justificativas de falta
          <${InfoTip} texto="Contagem das justificativas registradas nas faltas dos últimos 3 meses. Faltas sem justificativa entram como “Sem justificativa”." /></div>
        <div style=${{ height: 6 }}></div>
        ${calc.justItens.length === 0 ? html`<${Empty} msg="Nenhuma falta registrada na janela." />` : html`<${Bars} itens=${calc.justItens} />`}
      </div>`}
    ${verAlternancia && html`<${RelatorioAlternancia} perfil=${perfil} alternantes=${calc.alternantes} onClose=${() => setVerAlternancia(false)} />`}`;
}
