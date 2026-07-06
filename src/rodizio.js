import { html, useState, useEffect, useMemo, sb, norm, toISO, fmtBR, lastSunday, nextSunday, listSundays, Spinner, Empty } from './core.js';

// Domingos disponíveis: próximos 1 + últimos 16
const domingos = () => [toISO(nextSunday(new Date(Date.now() + 864e5))), ...listSundays(16)]
  .filter((v, i, a) => a.indexOf(v) === i).sort().reverse();

function CardRegistro({ f, ms, marcas, setMarca, onSalvar, salvando }) {
  const [open, setOpen] = useState(false);
  const regs = ms.filter(m => marcas[m.id] !== undefined);
  const presentes = ms.filter(m => marcas[m.id] === true).length;
  const registrada = ms.length > 0 && ms.every(m => marcas[m.id] !== undefined && marcas[m.id] !== 'local');
  return html`
  <div class="card" style=${{ border: registrada ? '2px solid #059669' : '1px solid #E2E8F0' }}>
    <div style=${{ padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      onClick=${() => setOpen(o => !o)}>
      <div>
        <span style=${{ fontWeight: 700, fontSize: 14 }}>Família ${f.sobrenome}</span>
        <div style=${{ fontSize: 11, color: '#64748B' }}>${f.chefe}</div>
      </div>
      <div style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
        ${regs.length > 0 && html`<span class="chip" style=${{ background: presentes > 0 ? '#D1FAE5' : '#FEE2E2', color: presentes > 0 ? '#065F46' : '#991B1B' }}>
          ${presentes}/${ms.length} ✅</span>`}
        <span style=${{ color: '#94A3B8' }}>${open ? '▲' : '▼'}</span>
      </div>
    </div>
    ${open && html`
    <div style=${{ borderTop: '1px solid #F1F5F9', padding: '10px 14px', background: '#FAFBFF' }}>
      ${ms.length === 0 && html`<div style=${{ fontSize: 12, color: '#94A3B8' }}>Sem membros cadastrados.</div>`}
      ${ms.map(m => {
        const v = marcas[m.id];
        return html`
        <div key=${m.id} style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
          <span style=${{ fontSize: 13, color: '#334155' }}>${m.sexo === 'F' ? '👩' : m.sexo === 'M' ? '👨' : '👤'} ${m.nome}</span>
          <div style=${{ display: 'flex', gap: 4 }}>
            <button class="chip" style=${{ background: v === true ? '#059669' : '#F1F5F9', color: v === true ? '#FFF' : '#94A3B8', padding: '5px 12px', fontSize: 12 }}
              onClick=${() => setMarca(m.id, v === true ? undefined : true)}>✓ Presente</button>
            <button class="chip" style=${{ background: v === false ? '#DC2626' : '#F1F5F9', color: v === false ? '#FFF' : '#94A3B8', padding: '5px 12px', fontSize: 12 }}
              onClick=${() => setMarca(m.id, v === false ? undefined : false)}>✕ Faltou</button>
          </div>
        </div>`;
      })}
      ${ms.length > 0 && html`
      <div style=${{ fontSize: 11, color: '#94A3B8', margin: '8px 0 6px' }}>
        Quem não for marcado será registrado como falta.
      </div>
      <button class="btn btn-p" style=${{ width: '100%', opacity: salvando ? .6 : 1 }} disabled=${salvando}
        onClick=${() => onSalvar(f, ms)}>💾 Salvar registro da família</button>`}
    </div>`}
  </div>`;
}

export function Rodizio({ perfil, show }) {
  const [aba, setAba] = useState('registrar');
  const [data, setData] = useState(toISO(lastSunday()));
  const [fams, setFams] = useState(null);
  const [membros, setMembros] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [presencas, setPresencas] = useState({});   // membro_id → linha de presença
  const [reuniaoId, setReuniaoId] = useState(null);
  const [marcas, setMarcas] = useState({});          // membro_id → true/false (não salvo)
  const [alertas, setAlertas] = useState([]);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: m }, { data: mo }] = await Promise.all([
        sb.from('familias').select('id, sobrenome, chefe').eq('ala_id', perfil.ala_id).order('sobrenome'),
        sb.from('membros').select('id, familia_id, nome, sexo, is_membro, ativo').eq('ala_id', perfil.ala_id).eq('ativo', true).order('nome'),
        sb.from('motivos_falta').select('*').eq('ala_id', perfil.ala_id).order('nome'),
      ]);
      setFams(f || []); setMembros(m || []); setMotivos(mo || []);
    })();
  }, [perfil.ala_id]);

  const carregarDia = async () => {
    const { data: r } = await sb.from('reunioes').select('id').eq('ala_id', perfil.ala_id).eq('data', data).eq('tipo', 'sacramental').maybeSingle();
    setReuniaoId(r?.id || null);
    if (!r) { setPresencas({}); setMarcas({}); return; }
    const { data: p } = await sb.from('presencas').select('*').eq('reuniao_id', r.id);
    setPresencas(Object.fromEntries((p || []).map(x => [x.membro_id, x])));
    setMarcas(Object.fromEntries((p || []).map(x => [x.membro_id, x.presente])));
  };
  useEffect(() => { carregarDia(); }, [data, perfil.ala_id]);

  const carregarAlertas = async () => {
    const { data: a } = await sb.from('presencas')
      .select('id, presente, alerta_tratado, registrado_em, membros(nome), reunioes(data), motivos_falta!inner(nome, alerta_lideranca)')
      .eq('ala_id', perfil.ala_id).eq('presente', false)
      .eq('alerta_tratado', false).eq('motivos_falta.alerta_lideranca', true);
    setAlertas(a || []);
  };
  useEffect(() => { carregarAlertas(); }, [perfil.ala_id]);

  const porFamilia = useMemo(() => {
    const map = new Map();
    membros.forEach(m => { if (!map.has(m.familia_id)) map.set(m.familia_id, []); map.get(m.familia_id).push(m); });
    return map;
  }, [membros]);

  const salvarFamilia = async (f, ms) => {
    setSalvando(true);
    let rid = reuniaoId;
    if (!rid) {
      const { data: r, error } = await sb.from('reunioes')
        .upsert({ ala_id: perfil.ala_id, data, tipo: 'sacramental' }, { onConflict: 'ala_id,data,tipo' })
        .select().single();
      if (error) { setSalvando(false); return show(error.message, false); }
      rid = r.id; setReuniaoId(rid);
    }
    const rows = ms.map(m => ({
      ala_id: perfil.ala_id, reuniao_id: rid, membro_id: m.id,
      presente: marcas[m.id] === true, origem: 'manual',
      motivo_falta_id: presencas[m.id]?.motivo_falta_id || null,
    }));
    const { error } = await sb.from('presencas').upsert(rows, { onConflict: 'reuniao_id,membro_id' });
    setSalvando(false);
    if (error) return show(error.message, false);
    show(`Família ${f.sobrenome} registrada ✅`);
    setMarcas(o => { const n = { ...o }; ms.forEach(m => { n[m.id] = marcas[m.id] === true; }); return n; });
    carregarDia(); carregarAlertas();
  };

  const setMotivo = async (p, motivoId) => {
    const { error } = await sb.from('presencas').update({ motivo_falta_id: motivoId || null }).eq('id', p.id);
    if (error) return show(error.message, false);
    setPresencas(o => ({ ...o, [p.membro_id]: { ...p, motivo_falta_id: motivoId || null } }));
    carregarAlertas();
  };

  const tratarAlerta = async id => {
    const { error } = await sb.from('presencas').update({ alerta_tratado: true }).eq('id', id);
    if (error) return show(error.message, false);
    show('Alerta marcado como repassado ✅'); carregarAlertas();
  };

  if (!fams) return html`<${Spinner}/>`;

  const q = norm(busca);
  const famVisiveis = q ? fams.filter(f => norm(`${f.sobrenome} ${f.chefe}`).includes(q)
    || (porFamilia.get(f.id) || []).some(m => norm(m.nome).includes(q))) : fams;

  const faltas = Object.values(presencas).filter(p => !p.presente);
  const membroById = new Map(membros.map(m => [m.id, m]));
  const famById = new Map(fams.map(f => [f.id, f]));
  const registrados = Object.values(presencas).length;
  const presentesTotal = Object.values(presencas).filter(p => p.presente).length;

  return html`
    <div class="hdr">🗓️ Rodízio Sacramental</div>
    <div class="sub">Registro de presença por membro a cada domingo</div>
    <select class="inp" style=${{ marginBottom: 10 }} value=${data} onChange=${e => setData(e.target.value)}>
      ${domingos().map(d => html`<option value=${d} selected=${d === data}>Domingo ${fmtBR(d)}${d === toISO(lastSunday()) ? ' (último)' : ''}</option>`)}
    </select>
    <div class="seg" style=${{ marginBottom: 12 }}>
      <button class=${aba === 'registrar' ? 'on' : ''} onClick=${() => setAba('registrar')}>Registrar</button>
      <button class=${aba === 'faltas' ? 'on' : ''} onClick=${() => setAba('faltas')}>Faltas (${faltas.length})</button>
      <button class=${aba === 'alertas' ? 'on' : ''} onClick=${() => setAba('alertas')}>🩺 Alertas${alertas.length ? ` (${alertas.length})` : ''}</button>
    </div>

    ${aba === 'registrar' && html`
      <div style=${{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div class="kpi"><div class="v">${presentesTotal}</div><div class="l">Presentes</div></div>
        <div class="kpi"><div class="v">${registrados - presentesTotal}</div><div class="l">Faltas registradas</div></div>
        <div class="kpi"><div class="v">${membros.length - registrados}</div><div class="l">Sem registro</div></div>
      </div>
      <input class="inp" type="search" placeholder="Buscar família por nome ou sobrenome…" value=${busca}
        onInput=${e => setBusca(e.target.value)} style=${{ marginBottom: 10 }} />
      ${famVisiveis.map(f => html`<${CardRegistro} key=${f.id} f=${f} ms=${porFamilia.get(f.id) || []}
        marcas=${marcas} setMarca=${(id, v) => setMarcas(o => ({ ...o, [id]: v }))}
        onSalvar=${salvarFamilia} salvando=${salvando} />`)}`}

    ${aba === 'faltas' && html`
      ${faltas.length === 0 && html`<${Empty} msg="Nenhuma falta registrada neste domingo (ainda)." />`}
      ${faltas.map(p => {
        const m = membroById.get(p.membro_id); if (!m) return null;
        const f = famById.get(m.familia_id);
        return html`
        <div key=${p.id} class="card" style=${{ padding: '11px 14px' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style=${{ fontWeight: 700, fontSize: 13 }}>${m.nome}</div>
              <div style=${{ fontSize: 11, color: '#64748B' }}>Família ${f?.sobrenome || '—'}</div>
            </div>
            <select class="inp" style=${{ width: 'auto', minWidth: 190, padding: '7px 10px', fontSize: 12 }}
              value=${p.motivo_falta_id || ''} onChange=${e => setMotivo(p, e.target.value)}>
              <option value="">Justificativa…</option>
              ${motivos.map(mo => html`<option value=${mo.id} selected=${mo.id === p.motivo_falta_id}>${mo.alerta_lideranca ? '🩺 ' : ''}${mo.nome}</option>`)}
            </select>
          </div>
        </div>`;
      })}`}

    ${aba === 'alertas' && html`
      <div style=${{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
        Faltas por motivo de saúde para repassar ao presidente do quórum de élderes e à presidente da Sociedade de Socorro.
      </div>
      ${alertas.length === 0 && html`<${Empty} msg="Nenhum alerta pendente 🎉" />`}
      ${alertas.map(a => html`
        <div key=${a.id} class="card" style=${{ padding: '11px 14px', borderLeft: '4px solid #DC2626' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style=${{ fontWeight: 700, fontSize: 13 }}>🩺 ${a.membros?.nome}</div>
              <div style=${{ fontSize: 11, color: '#64748B' }}>${a.motivos_falta?.nome} · falta em ${fmtBR(a.reunioes?.data || '')}</div>
            </div>
            <button class="btn btn-g" style=${{ fontSize: 12 }} onClick=${() => tratarAlerta(a.id)}>✓ Repassado à liderança</button>
          </div>
        </div>`)}`}`;
}
