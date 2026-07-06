import { html, useState, useEffect, useMemo, sb, norm, phone, Spinner, Empty, STATUS_QUAL, fmtBR } from './core.js';
import { setorNome } from './diretorio.js';

function CardQual({ f, ms, q, onUpd, show }) {
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState(q?.nota || '');
  const [busy, setBusy] = useState(false);
  const s = q?.status || 'pendente';
  const v = STATUS_QUAL[s];

  const marcar = async novo => {
    setBusy(true);
    const { error } = await sb.from('qualificacao').upsert(
      { familia_id: f.id, ala_id: f.ala_id, status: novo, nota, atualizado_em: new Date().toISOString() },
      { onConflict: 'familia_id' });
    setBusy(false);
    if (error) return show(error.message, false);
    onUpd(f.id, { familia_id: f.id, status: novo, nota });
    if (novo !== 'pendente') setOpen(false);
  };

  return html`
  <div class="card" style=${{ border: `2px solid ${s !== 'pendente' ? v.b : '#E2E8F0'}` }}>
    <div style=${{ padding: '12px 14px', cursor: 'pointer' }} onClick=${() => setOpen(o => !o)}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style=${{ flex: 1, minWidth: 0 }}>
          <span style=${{ fontWeight: 700, fontSize: 15 }}>Família ${f.sobrenome}</span>
          ${f.setor && html` <span class="chip" style=${{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>${setorNome(f.setor)}</span>`}
          <div style=${{ fontSize: 12, color: '#475569', marginTop: 2 }}>${f.chefe}</div>
          <div style=${{ fontSize: 11, color: '#64748B', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 ${f.endereco}</div>
        </div>
        <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span class="chip" style=${{ background: v.bg, color: v.t, border: `1px solid ${v.b}` }}>${v.i} ${v.l}</span>
          <span style=${{ color: '#94A3B8', fontSize: 13 }}>${open ? '▲' : '▼'}</span>
        </div>
      </div>
    </div>
    ${open && html`
    <div style=${{ borderTop: '1px solid #F1F5F9', padding: '12px 14px', background: '#FAFBFF' }}>
      ${f.telefone && html`
        <div style=${{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <a class="btn btn-s" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} href=${`tel:${f.telefone}`}>📞 Ligar</a>
          ${phone(f.telefone).length >= 10 && html`
            <a class="btn btn-g" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} target="_blank" href=${`https://wa.me/${phone(f.telefone)}`}>💬 WhatsApp</a>`}
        </div>`}
      <div style=${{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
        ${ms.map(m => m.nome).join(' · ') || 'Sem membros cadastrados'}
      </div>
      ${q?.atualizado_em && html`<div style=${{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>Última atualização: ${fmtBR(q.atualizado_em.slice(0, 10))}</div>`}
      <label class="lbl">Observação</label>
      <textarea class="inp" rows="2" placeholder="Ex: mudou para SP, sem resposta…" value=${nota}
        onInput=${e => setNota(e.target.value)} style=${{ resize: 'none' }}></textarea>
      <div style=${{ display: 'flex', gap: 6, marginTop: 10, opacity: busy ? .6 : 1 }}>
        <button class="btn btn-g" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('residente')}>✅ Reside</button>
        <button class="btn btn-d" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('saiu')}>🚫 Saiu da área</button>
        <button class="btn btn-s" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('pendente')}>🕐 Pendente</button>
      </div>
    </div>`}
  </div>`;
}

export function Qualificacao({ perfil, show }) {
  const [fams, setFams] = useState(null);
  const [membros, setMembros] = useState([]);
  const [quals, setQuals] = useState({});
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: m }, { data: q }] = await Promise.all([
        sb.from('familias').select('*').eq('ala_id', perfil.ala_id).order('sobrenome'),
        sb.from('membros').select('familia_id, nome').eq('ala_id', perfil.ala_id),
        sb.from('qualificacao').select('*').eq('ala_id', perfil.ala_id),
      ]);
      setFams(f || []); setMembros(m || []);
      setQuals(Object.fromEntries((q || []).map(r => [r.familia_id, r])));
    })();
  }, [perfil.ala_id]);

  const porFamilia = useMemo(() => {
    const map = new Map();
    membros.forEach(m => { if (!map.has(m.familia_id)) map.set(m.familia_id, []); map.get(m.familia_id).push(m); });
    return map;
  }, [membros]);

  const contagem = useMemo(() => {
    const c = { pendente: 0, residente: 0, saiu: 0 };
    (fams || []).forEach(f => { c[quals[f.id]?.status || 'pendente']++; });
    return c;
  }, [fams, quals]);

  const visiveis = useMemo(() => {
    if (!fams) return [];
    const q = norm(busca);
    return fams.filter(f => {
      const st = quals[f.id]?.status || 'pendente';
      if (filtro !== 'todos' && st !== filtro) return false;
      if (!q) return true;
      return norm(`${f.sobrenome} ${f.chefe} ${f.endereco}`).includes(q)
        || (porFamilia.get(f.id) || []).some(m => norm(m.nome).includes(q));
    });
  }, [fams, quals, busca, filtro, porFamilia]);

  if (!fams) return html`<${Spinner}/>`;
  const FILTROS = [['todos', `Todas (${fams.length})`], ['pendente', `🕐 ${contagem.pendente}`], ['residente', `✅ ${contagem.residente}`], ['saiu', `🚫 ${contagem.saiu}`]];

  return html`
    <div class="hdr">🏠 Qualificação da Ala</div>
    <div class="sub">Confirmação de residência das famílias do diretório</div>
    <div class="seg" style=${{ marginBottom: 10 }}>
      ${FILTROS.map(([k, l]) => html`<button key=${k} class=${filtro === k ? 'on' : ''} onClick=${() => setFiltro(k)}>${l}</button>`)}
    </div>
    <input class="inp" type="search" placeholder="Buscar família, membro ou endereço…" value=${busca}
      onInput=${e => setBusca(e.target.value)} style=${{ marginBottom: 12 }} />
    ${visiveis.length === 0 && html`<${Empty} msg="Nenhuma família neste filtro." />`}
    ${visiveis.map(f => html`<${CardQual} key=${f.id} f=${f} ms=${porFamilia.get(f.id) || []} q=${quals[f.id]}
      show=${show} onUpd=${(id, novo) => setQuals(o => ({ ...o, [id]: { ...o[id], ...novo } }))} />`)}`;
}
