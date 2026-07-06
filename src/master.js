import { html, useState, useEffect, sb, fmtBR, Spinner, Modal } from './core.js';

function NovaAla({ onClose, onSaved, show }) {
  const [nome, setNome] = useState('');
  const [estaca, setEstaca] = useState('');
  const [busy, setBusy] = useState(false);
  const slug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^ala\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const salvar = async () => {
    if (!nome.trim() || !slug) return show('Informe o nome da ala.', false);
    setBusy(true);
    const { error } = await sb.from('alas').insert({ nome: nome.trim(), slug, estaca: estaca.trim() });
    setBusy(false);
    if (error) return show(error.message, false);
    show('Ala criada ✅ (os 4 motivos de falta padrão já foram criados para ela)');
    onSaved(); onClose();
  };
  return html`<${Modal} onClose=${onClose}>
    <div style=${{ fontWeight: 800, fontSize: 17 }}>Nova ala</div>
    <label class="lbl">Nome da ala</label>
    <input class="inp" placeholder="Ex: Ala Águas Claras 2" value=${nome} onInput=${e => setNome(e.target.value)} />
    <label class="lbl">Estaca</label>
    <input class="inp" placeholder="Ex: Estaca Taguatinga Brasília" value=${estaca} onInput=${e => setEstaca(e.target.value)} />
    ${slug && html`<div style=${{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Link público: assistir.html?ala=<strong>${slug}</strong></div>`}
    <div style=${{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Criar ala</button>
    </div>
  <//>`;
}

export function Master({ perfil, show }) {
  const [linhas, setLinhas] = useState(null);
  const [nova, setNova] = useState(false);

  const carregar = async () => {
    const [{ data: alas }, { data: fams }, { data: membros }, { data: reunioes }, { data: presencas }] = await Promise.all([
      sb.from('alas').select('*').order('nome'),
      sb.from('familias').select('id, ala_id'),
      sb.from('membros').select('id, ala_id').eq('ativo', true),
      sb.from('reunioes').select('id, ala_id, data').eq('tipo', 'sacramental').order('data'),
      sb.from('presencas').select('reuniao_id, presente, ala_id').eq('presente', true).limit(50000),
    ]);
    const presPorReuniao = new Map();
    (presencas || []).forEach(p => presPorReuniao.set(p.reuniao_id, (presPorReuniao.get(p.reuniao_id) || 0) + 1));
    setLinhas((alas || []).map(a => {
      const rs = (reunioes || []).filter(r => r.ala_id === a.id);
      const ultima = [...rs].reverse().find(r => presPorReuniao.has(r.id));
      return {
        ...a,
        familias: (fams || []).filter(f => f.ala_id === a.id).length,
        membros: (membros || []).filter(m => m.ala_id === a.id).length,
        ultimaData: ultima?.data,
        ultimaPresenca: ultima ? presPorReuniao.get(ultima.id) : null,
      };
    }));
  };
  useEffect(() => { carregar(); }, []);

  if (!linhas) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">🌐 Painel Master</div>
    <div class="sub">Visão geral de todas as alas do sistema</div>
    <button class="btn btn-p" style=${{ width: '100%', marginBottom: 12 }} onClick=${() => setNova(true)}>+ Cadastrar nova ala</button>
    ${linhas.map(a => html`
      <div key=${a.id} class="card" style=${{ padding: 14 }}>
        <div style=${{ fontWeight: 800, fontSize: 15 }}>${a.nome}</div>
        <div style=${{ fontSize: 11, color: '#94A3B8' }}>${a.estaca || '—'} · slug: ${a.slug}</div>
        <div style=${{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${a.familias}</div><div class="l">Famílias</div></div>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${a.membros}</div><div class="l">Pessoas</div></div>
          <div class="kpi" style=${{ padding: 10 }}>
            <div class="v" style=${{ fontSize: 19 }}>${a.ultimaPresenca ?? '—'}</div>
            <div class="l">${a.ultimaData ? `Presentes em ${fmtBR(a.ultimaData)}` : 'Sem registros'}</div>
          </div>
        </div>
      </div>`)}
    <div class="card" style=${{ padding: 14, fontSize: 12, color: '#64748B' }}>
      💡 Para criar o usuário de acesso de uma nova ala, peça ao administrador do sistema —
      o cadastro de logins é feito com a chave administrativa, fora do aplicativo.
    </div>
    ${nova && html`<${NovaAla} onClose=${() => setNova(false)} onSaved=${carregar} show=${show} />`}`;
}
