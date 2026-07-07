import { html, useState, useEffect, useMemo, sb, norm, phone, Spinner, Empty, Chip, InfoTip, STATUS_QUAL, fmtBR } from './core.js';
import { setorNome } from './diretorio.js';
import { IcTelefone, IcWhats } from './icons.js';

const CORES_SETOR = ['#16436B', '#0F5C8C', '#9A7B3F', '#2F6B4F', '#96372F', '#8F6A24', '#5A6068', '#8A9099'];

// ─── Painel de acompanhamento (o "dashboard" da qualificação) ────────────
function PainelQual({ fams, quals }) {
  const calc = useMemo(() => {
    const c = { pendente: 0, residente: 0, saiu: 0 };
    fams.forEach(f => { c[quals[f.id]?.status || 'pendente']++; });
    const total = fams.length || 1;
    const done = c.residente + c.saiu;

    const setores = new Map();
    fams.forEach(f => {
      const k = setorNome(f.setor);
      if (!setores.has(k)) setores.set(k, { t: 0, d: 0 });
      const s = setores.get(k);
      s.t++;
      const v = quals[f.id]?.status;
      if (v === 'residente' || v === 'saiu') s.d++;
    });
    const porSetor = [...setores.entries()]
      .map(([nome, v]) => ({ nome, ...v, pend: v.t - v.d }))
      .sort((a, b) => b.pend - a.pend);
    return { ...c, total, done, pct: Math.round(done / total * 100), porSetor };
  }, [fams, quals]);

  return html`
    <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div class="kpi"><div class="v">${calc.pct}%</div><div class="l">Verificação concluída
        <${InfoTip} texto="Famílias já verificadas (reside ou saiu da área) dividido pelo total de famílias do diretório." /></div>
        <div style=${{ background: 'var(--linha2)', borderRadius: 4, height: 6, marginTop: 8 }}>
          <div style=${{ width: `${calc.pct}%`, background: 'var(--verde)', height: 6, borderRadius: 4 }}></div>
        </div>
      </div>
      <div class="kpi"><div class="v" style=${{ color: 'var(--ambar)' }}>${calc.pendente}</div><div class="l">Pendentes de visita</div></div>
      <div class="kpi"><div class="v" style=${{ color: 'var(--verde)' }}>${calc.residente}</div><div class="l">Residem no endereço</div></div>
      <div class="kpi"><div class="v" style=${{ color: 'var(--vermelho)' }}>${calc.saiu}</div><div class="l">Não residem na área</div></div>
    </div>
    <div class="card" style=${{ padding: 14 }}>
      <div class="titulo-secao">Pendências por setor
        <${InfoTip} texto="Famílias ainda não verificadas em cada setor. Priorize os setores com mais pendências ao organizar as visitas." /></div>
      <div style=${{ height: 8 }}></div>
      ${calc.porSetor.map((s, i) => html`
        <div key=${s.nome} style=${{ margin: '9px 0' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span style=${{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--tinta)' }}>
              <span style=${{ width: 9, height: 9, borderRadius: '50%', background: CORES_SETOR[i % CORES_SETOR.length], display: 'inline-block' }}></span>
              ${s.nome}
            </span>
            <span style=${{ color: 'var(--tinta2)' }}>${s.d}/${s.t} verificadas${s.pend ? ` · ${s.pend} pendente${s.pend > 1 ? 's' : ''}` : ''}</span>
          </div>
          <div style=${{ background: 'var(--linha2)', borderRadius: 99, height: 8 }}>
            <div style=${{ height: '100%', width: `${s.t ? s.d / s.t * 100 : 0}%`, background: CORES_SETOR[i % CORES_SETOR.length], borderRadius: 99 }}></div>
          </div>
        </div>`)}
    </div>`;
}

function CardQual({ f, ms, q, onUpd, show, readOnly }) {
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

  const salvarNota = async () => {
    if (nota === (q?.nota || '')) return;   // nada mudou
    const { error } = await sb.from('qualificacao').upsert(
      { familia_id: f.id, ala_id: f.ala_id, status: s, nota, atualizado_em: new Date().toISOString() },
      { onConflict: 'familia_id' });
    if (error) return show(error.message, false);
    onUpd(f.id, { familia_id: f.id, status: s, nota });
    show('Observação salva.');
  };

  return html`
  <div class="card" style=${s !== 'pendente' ? { borderColor: v.b } : {}}>
    <div style=${{ padding: '12px 14px', cursor: 'pointer' }} onClick=${() => setOpen(o => !o)}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style=${{ flex: 1, minWidth: 0 }}>
          <span style=${{ fontWeight: 600, fontSize: 15 }}>Família ${f.sobrenome}</span>
          ${f.setor && html` <${Chip} bg="var(--azul-claro)" t="var(--azul)">${setorNome(f.setor)}<//>`}
          <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginTop: 2 }}>${f.chefe}</div>
          <div style=${{ fontSize: 11, color: 'var(--tinta3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${f.endereco}</div>
        </div>
        <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <${Chip} bg=${v.bg} t=${v.t} b=${v.b}>${v.l}<//>
          <span style=${{ color: 'var(--tinta3)', fontSize: 11 }}>${open ? '▴' : '▾'}</span>
        </div>
      </div>
    </div>
    ${open && html`
    <div style=${{ borderTop: '1px solid var(--linha2)', padding: '12px 14px', background: 'var(--papel)' }}>
      ${f.telefone && html`
        <div style=${{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <a class="btn btn-s" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} href=${`tel:${f.telefone}`}><${IcTelefone} size=${14} /> Ligar</a>
          ${phone(f.telefone).length >= 10 && html`
            <a class="btn btn-g" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} target="_blank" href=${`https://wa.me/${phone(f.telefone)}`}><${IcWhats} size=${14} /> WhatsApp</a>`}
        </div>`}
      <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginBottom: 6 }}>
        ${ms.map(m => m.nome).join(' · ') || 'Sem membros cadastrados'}
      </div>
      ${q?.atualizado_em && html`<div style=${{ fontSize: 11, color: 'var(--tinta3)', marginBottom: 6 }}>Última atualização: ${fmtBR(q.atualizado_em.slice(0, 10))}</div>`}
      <label class="lbl">Observação</label>
      <textarea class="inp" rows="2" placeholder="Ex: mudou para SP, sem resposta…" value=${nota} disabled=${readOnly}
        onInput=${e => setNota(e.target.value)} onBlur=${salvarNota} style=${{ resize: 'none' }}></textarea>
      ${!readOnly && html`
      <div style=${{ display: 'flex', gap: 6, marginTop: 10, opacity: busy ? .6 : 1 }}>
        <button class="btn btn-g" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('residente')}>Reside</button>
        <button class="btn btn-d" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('saiu')}>Saiu da área</button>
        <button class="btn btn-s" style=${{ flex: 1, fontSize: 12 }} disabled=${busy} onClick=${() => marcar('pendente')}>Pendente</button>
      </div>`}
    </div>`}
  </div>`;
}

export function Qualificacao({ perfil, show, readOnly }) {
  const [aba, setAba] = useState('painel');
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
  const FILTROS = [['todos', `Todas (${fams.length})`], ['pendente', `Pendentes (${contagem.pendente})`], ['residente', `Residem (${contagem.residente})`], ['saiu', `Saíram (${contagem.saiu})`]];

  return html`
    <div class="hdr">Qualificação da Ala</div>
    <div class="sub">Confirmação de residência das famílias do diretório</div>
    <div class="seg" style=${{ marginBottom: 12 }}>
      <button class=${aba === 'painel' ? 'on' : ''} onClick=${() => setAba('painel')}>Painel</button>
      <button class=${aba === 'familias' ? 'on' : ''} onClick=${() => setAba('familias')}>Famílias</button>
    </div>

    ${aba === 'painel' && html`<${PainelQual} fams=${fams} quals=${quals} />`}

    ${aba === 'familias' && html`
      <div class="seg" style=${{ marginBottom: 10 }}>
        ${FILTROS.map(([k, l]) => html`<button key=${k} class=${filtro === k ? 'on' : ''} onClick=${() => setFiltro(k)}>${l}</button>`)}
      </div>
      <input class="inp" type="search" placeholder="Buscar família, membro ou endereço…" value=${busca}
        onInput=${e => setBusca(e.target.value)} style=${{ marginBottom: 12 }} />
      ${visiveis.length === 0 && html`<${Empty} msg="Nenhuma família neste filtro." />`}
      ${visiveis.map(f => html`<${CardQual} key=${f.id} f=${f} ms=${porFamilia.get(f.id) || []} q=${quals[f.id]}
        show=${show} readOnly=${readOnly} onUpd=${(id, novo) => setQuals(o => ({ ...o, [id]: { ...o[id], ...novo } }))} />`)}`}`;
}
