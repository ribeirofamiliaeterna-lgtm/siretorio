import { html, useState, useEffect, useMemo, useRef, sb, fmtBR, Spinner, Empty } from './core.js';

const AZUL = '#2563EB';
const pct = v => `${Math.round(v * 100)}%`;

// ─── Gráfico de linha (série única, com tooltip) ─────────────────────────
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
        <line x1=${PL} x2=${W - PR} y1=${y(g)} y2=${y(g)} stroke="#EEF2F7" stroke-width="1"/>
        <text x=${PL - 6} y=${y(g) + 3.5} text-anchor="end" font-size="10" fill="#94A3B8">${Math.round(g * 100)}%</text>`)}
      ${hover != null && html`<line x1=${x(hover)} x2=${x(hover)} y1=${PT} y2=${PT + ih} stroke="#CBD5E1" stroke-width="1"/>`}
      <path d=${path} fill="none" stroke=${AZUL} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pontos.map((p, i) => html`
        <circle cx=${x(i)} cy=${y(p.v)} r=${hover === i ? 5 : 3.5} fill=${AZUL} stroke="#FFF" stroke-width="2"/>`)}
      ${pontos.map((p, i) => (pontos.length <= 8 || i === pontos.length - 1 || hover === i) && html`
        <text x=${x(i)} y=${H - 8} text-anchor="middle" font-size="10" fill="#64748B">${p.l}</text>`)}
      ${hover == null && pontos.length > 0 && html`
        <text x=${x(pontos.length - 1) - 8} y=${y(pontos[pontos.length - 1].v) - 9} text-anchor="end" font-size="11" font-weight="700" fill="#334155">
          ${pct(pontos[pontos.length - 1].v)}</text>`}
    </svg>
    ${hover != null && html`
      <div style=${{ position: 'absolute', top: 0, left: `${x(hover) / W * 100}%`, transform: `translateX(${hover > pontos.length / 2 ? '-105%' : '6px'})`,
        background: '#1E293B', color: '#FFF', borderRadius: 8, padding: '6px 10px', fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style=${{ fontWeight: 700 }}>${pontos[hover].l}</div>
        <div>Presença: ${pct(pontos[hover].v)} (${pontos[hover].n} pessoas)</div>
      </div>`}
  </div>`;
}

// ─── Barras horizontais com rótulo direto ────────────────────────────────
function Bars({ itens }) {
  const max = Math.max(1, ...itens.map(i => i.n));
  return itens.map(i => html`
    <div key=${i.l} style=${{ margin: '7px 0' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 3 }}>
        <span>${i.l}</span><span style=${{ fontWeight: 700 }}>${i.n}</span>
      </div>
      <div style=${{ background: '#EEF2F7', borderRadius: 4, height: 8 }}>
        <div style=${{ width: `${i.n / max * 100}%`, background: AZUL, height: 8, borderRadius: 4 }}></div>
      </div>
    </div>`);
}

export function Dashboard({ perfil }) {
  const [dados, setDados] = useState(null);
  const [modo, setModo] = useState('semanas');

  useEffect(() => {
    (async () => {
      const [{ data: reunioes }, { data: presencas }, { data: membros }, { count: alertas }] = await Promise.all([
        sb.from('reunioes').select('id, data').eq('ala_id', perfil.ala_id).eq('tipo', 'sacramental').order('data'),
        sb.from('presencas').select('reuniao_id, membro_id, presente, motivo_falta_id, motivos_falta(nome)').eq('ala_id', perfil.ala_id).limit(20000),
        sb.from('membros').select('id, nome, is_membro').eq('ala_id', perfil.ala_id).eq('ativo', true),
        sb.from('presencas').select('id, motivos_falta!inner(alerta_lideranca)', { count: 'exact', head: true })
          .eq('ala_id', perfil.ala_id).eq('presente', false).eq('alerta_tratado', false).eq('motivos_falta.alerta_lideranca', true),
      ]);
      setDados({ reunioes: reunioes || [], presencas: presencas || [], membros: membros || [], alertas: alertas || 0 });
    })();
  }, [perfil.ala_id]);

  const calc = useMemo(() => {
    if (!dados) return null;
    const { reunioes, presencas, membros } = dados;
    const baseMembros = membros.filter(m => m.is_membro).length || 1;
    const porReuniao = new Map(reunioes.map(r => [r.id, { ...r, pres: [] }]));
    presencas.forEach(p => porReuniao.get(p.reuniao_id)?.pres.push(p));
    const comDados = [...porReuniao.values()].filter(r => r.pres.length > 0);

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
      return { l: g.l, v: Math.min(1, media / baseMembros), n: Math.round(media) };
    });

    // Janela de análise de rodízio: últimas 8 reuniões com dados
    const janela = comDados.slice(-8);
    const porMembro = new Map();
    janela.forEach(r => r.pres.forEach(p => {
      if (!porMembro.has(p.membro_id)) porMembro.set(p.membro_id, []);
      porMembro.get(p.membro_id).push(p.presente);
    }));
    const nomes = new Map(membros.map(m => [m.id, m.nome]));
    let alternam = 0, comHistorico = 0;
    const ranking = [];
    porMembro.forEach((regs, id) => {
      if (regs.length < 2) return;
      comHistorico++;
      const tem = regs.includes(true) && regs.includes(false);
      if (tem) {
        alternam++;
        let trocas = 0;
        for (let i = 1; i < regs.length; i++) if (regs[i] !== regs[i - 1]) trocas++;
        ranking.push({ id, nome: nomes.get(id) || '—', trocas, presencas: regs.filter(Boolean).length, total: regs.length });
      }
    });
    ranking.sort((a, b) => b.trocas - a.trocas || b.total - a.total);

    // Justificativas na janela
    const just = new Map();
    janela.forEach(r => r.pres.filter(p => !p.presente).forEach(p => {
      const nome = p.motivos_falta?.nome || 'Não preenchida';
      just.set(nome, (just.get(nome) || 0) + 1);
    }));
    const justItens = [...just.entries()].map(([l, n]) => ({ l, n })).sort((a, b) => b.n - a.n);

    const ultima = comDados[comDados.length - 1];
    return {
      pontos,
      taxaRodizio: comHistorico ? alternam / comHistorico : 0,
      comHistorico,
      ranking: ranking.slice(0, 8),
      justItens,
      presUltima: ultima ? ultima.pres.filter(p => p.presente).length : 0,
      dataUltima: ultima?.data,
      baseMembros,
      temDados: comDados.length > 0,
    };
  }, [dados, modo]);

  if (!calc) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">📊 Painel da Ala</div>
    <div class="sub">Indicadores de frequência e rodízio sacramental</div>
    ${!calc.temDados ? html`
      <div class="card" style=${{ padding: 18, fontSize: 13, color: '#64748B' }}>
        Ainda não há registros de presença. Comece pela aba <strong>Rodízio</strong>: escolha o domingo,
        busque a família e marque quem esteve na reunião. Os indicadores aparecem aqui automaticamente.
      </div>` : html`
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div class="kpi"><div class="v">${calc.presUltima}</div><div class="l">Presentes em ${calc.dataUltima ? fmtBR(calc.dataUltima) : '—'}</div></div>
        <div class="kpi"><div class="v">${pct(calc.taxaRodizio)}</div><div class="l">Taxa de rodízio (janela de 8 semanas)</div></div>
        <div class="kpi"><div class="v" style=${{ color: dados.alertas ? '#DC2626' : '#059669' }}>${dados.alertas}</div><div class="l">Alertas de doença pendentes</div></div>
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div style=${{ fontWeight: 800, fontSize: 14 }}>Evolução da taxa de presença</div>
          <div class="seg" style=${{ width: 210 }}>
            ${[['semanas', 'Semanas'], ['meses', 'Meses'], ['anos', 'Anos']].map(([k, l]) => html`
              <button key=${k} class=${modo === k ? 'on' : ''} onClick=${() => setModo(k)}>${l}</button>`)}
          </div>
        </div>
        <${LineChart} pontos=${calc.pontos} />
        <div style=${{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Base: ${calc.baseMembros} membros ativos no diretório.</div>
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Quem mais faz rodízio</div>
        <div style=${{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Membros que alternam presença e falta nas últimas 8 semanas registradas.</div>
        ${calc.ranking.length === 0 && html`<${Empty} msg="Ninguém alternando ainda — poucos domingos registrados." />`}
        ${calc.ranking.map((r, i) => html`
          <div key=${r.id} style=${{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
            <span style=${{ color: '#334155' }}><span style=${{ color: '#94A3B8', fontWeight: 700 }}>${i + 1}.</span> ${r.nome}</span>
            <span style=${{ color: '#64748B', fontSize: 12 }}>${r.presencas}/${r.total} domingos</span>
          </div>`)}
      </div>

      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Principais justificativas de falta</div>
        <div style=${{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Últimas 8 semanas registradas.</div>
        ${calc.justItens.length === 0 ? html`<${Empty} msg="Nenhuma falta registrada na janela." />` : html`<${Bars} itens=${calc.justItens} />`}
      </div>`}`;
}
