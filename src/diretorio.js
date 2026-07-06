import { html, useState, useEffect, useMemo, sb, norm, phone, Spinner, Empty, Modal } from './core.js';

const SETORES = ['Areal', 'Arniqueiras', 'Park Way', 'AC Sul', 'AC Norte', 'Águas Claras', 'Taguatinga', 'Outros'];
const SETOR_LEGADO = { AR: 'Areal', SHA: 'Arniqueiras', PW: 'Park Way', ACS: 'AC Sul', ACN: 'AC Norte', AC: 'Águas Claras', TAG: 'Taguatinga', OUT: 'Outros' };
export const setorNome = s => SETOR_LEGADO[s] || s || '—';

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
      if (m._del && m.id) await sb.from('membros').delete().eq('id', m.id);
      else if (!m._del && m.nome.trim()) {
        const row = { nome: m.nome.trim(), sexo: m.sexo || '', idade: m.idade ? Number(m.idade) : null, is_membro: m.is_membro !== false };
        if (m.id) await sb.from('membros').update(row).eq('id', m.id);
        else await sb.from('membros').insert({ ...row, ala_id: perfil.ala_id, familia_id: famId });
      }
    }
    setBusy(false); show('Família salva ✅'); onSaved(); onClose();
  };

  const excluir = async () => {
    if (!confirm(`Excluir a família ${f.sobrenome} e todos os seus membros? Esta ação não pode ser desfeita.`)) return;
    const { error } = await sb.from('familias').delete().eq('id', f.id);
    if (error) return show(error.message, false);
    show('Família excluída.'); onSaved(); onClose();
  };

  return html`<${Modal} onClose=${onClose}>
    <div style=${{ fontWeight: 800, fontSize: 17 }}>${f.id ? 'Editar família' : 'Nova família'}</div>
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
      <span style=${{ fontSize: 13, fontWeight: 800 }}>Membros</span>
      <button class="btn btn-s" style=${{ padding: '5px 10px', fontSize: 12 }}
        onClick=${() => setMs(a => [...a, { nome: '', sexo: '', idade: '', is_membro: true }])}>+ Adicionar</button>
    </div>
    ${ms.map((m, i) => m._del ? null : html`
      <div key=${i} style=${{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <input class="inp" style=${{ flex: 3 }} placeholder="Nome completo" value=${m.nome} onInput=${e => setM(i, 'nome', e.target.value)} />
        <select class="inp" style=${{ flex: 1, minWidth: 54, padding: '10px 6px' }} value=${m.sexo} onChange=${e => setM(i, 'sexo', e.target.value)}>
          <option value="">—</option><option value="F" selected=${m.sexo === 'F'}>F</option><option value="M" selected=${m.sexo === 'M'}>M</option>
        </select>
        <input class="inp" style=${{ flex: 1, minWidth: 52 }} type="number" placeholder="Idade" value=${m.idade ?? ''} onInput=${e => setM(i, 'idade', e.target.value)} />
        <button style=${{ color: '#DC2626', fontSize: 17, padding: 4 }} title="Remover"
          onClick=${() => m.id ? setM(i, '_del', true) : setMs(a => a.filter((_, j) => j !== i))}>✕</button>
      </div>`)}
    <div style=${{ display: 'flex', gap: 8, marginTop: 18 }}>
      ${f.id && html`<button class="btn btn-d" onClick=${excluir}>Excluir</button>`}
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Salvar</button>
    </div>
  <//>`;
}

export function Diretorio({ perfil, show }) {
  const [fams, setFams] = useState(null);
  const [membros, setMembros] = useState([]);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(null);
  const [edit, setEdit] = useState(null); // {fam, membros} | 'nova'

  const carregar = async () => {
    const [{ data: f }, { data: m }] = await Promise.all([
      sb.from('familias').select('*').eq('ala_id', perfil.ala_id).order('sobrenome'),
      sb.from('membros').select('*').eq('ala_id', perfil.ala_id).order('nome'),
    ]);
    setFams(f || []); setMembros(m || []);
  };
  useEffect(() => { carregar(); }, [perfil.ala_id]);

  const porFamilia = useMemo(() => {
    const map = new Map();
    membros.forEach(m => { if (!map.has(m.familia_id)) map.set(m.familia_id, []); map.get(m.familia_id).push(m); });
    return map;
  }, [membros]);

  const visiveis = useMemo(() => {
    if (!fams) return [];
    const q = norm(busca);
    if (!q) return fams;
    return fams.filter(f => norm(`${f.sobrenome} ${f.chefe}`).includes(q)
      || (porFamilia.get(f.id) || []).some(m => norm(m.nome).includes(q)));
  }, [fams, busca, porFamilia]);

  if (!fams) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">📖 Diretório</div>
    <div class="sub">${fams.length} famílias · ${membros.length} pessoas</div>
    <div style=${{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <input class="inp" type="search" placeholder="Buscar por nome ou sobrenome…" value=${busca} onInput=${e => setBusca(e.target.value)} />
      <button class="btn btn-p" style=${{ whiteSpace: 'nowrap' }} onClick=${() => setEdit('nova')}>+ Família</button>
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
              <span style=${{ fontWeight: 700, fontSize: 15 }}>Família ${f.sobrenome}</span>
              ${f.setor && html` <span class="chip" style=${{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>${setorNome(f.setor)}</span>`}
              <div style=${{ fontSize: 12, color: '#475569', marginTop: 2 }}>${f.chefe}</div>
              <div style=${{ fontSize: 11, color: '#64748B', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 ${f.endereco || 'sem endereço'}</div>
              <div style=${{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>👥 ${ms.length} membro${ms.length !== 1 ? 's' : ''}</div>
            </div>
            <span style=${{ color: '#94A3B8' }}>${open ? '▲' : '▼'}</span>
          </div>
        </div>
        ${open && html`
        <div style=${{ borderTop: '1px solid #F1F5F9', padding: '12px 14px', background: '#FAFBFF' }}>
          ${f.telefone && html`
            <div style=${{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <a class="btn btn-s" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} href=${`tel:${f.telefone}`}>📞 Ligar</a>
              ${phone(f.telefone).length >= 10 && html`
                <a class="btn btn-g" style=${{ flex: 1, textDecoration: 'none', fontSize: 12 }} target="_blank" href=${`https://wa.me/${phone(f.telefone)}`}>💬 WhatsApp</a>`}
            </div>`}
          ${ms.map((m, i) => html`
            <div key=${m.id} style=${{ fontSize: 12, color: '#475569', padding: '4px 0', display: 'flex', gap: 6, alignItems: 'center', borderBottom: i < ms.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <span>${m.sexo === 'F' ? '👩' : m.sexo === 'M' ? '👨' : '👤'}</span><span>${m.nome}</span>
              ${m.idade != null && html`<span class="chip" style=${{ background: '#F1F5F9', color: '#94A3B8', fontSize: 10 }}>${m.idade} anos</span>`}
              ${m.is_membro === false && html`<span class="chip" style=${{ background: '#FEF3C7', color: '#92400E', fontSize: 10 }}>não-membro</span>`}
            </div>`)}
          <button class="btn btn-s" style=${{ width: '100%', marginTop: 12, fontSize: 12 }}
            onClick=${() => setEdit({ fam: f, membros: ms })}>✏️ Editar família</button>
        </div>`}
      </div>`;
    })}
    ${edit && html`<${FormFamilia} perfil=${perfil} show=${show}
      fam=${edit === 'nova' ? null : edit.fam} membros=${edit === 'nova' ? [] : edit.membros}
      onClose=${() => setEdit(null)} onSaved=${carregar} />`}`;
}
