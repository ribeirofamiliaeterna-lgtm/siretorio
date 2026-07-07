import { html, useState, useEffect, useMemo, sb, norm, toISO, fmtBR, nextSunday, lastSunday, listSundays, Spinner, Empty } from './core.js';
import { IcLink, IcCheck, IcMais } from './icons.js';

const datasDisponiveis = () => {
  const prox = toISO(nextSunday());
  return [...new Set([prox, ...listSundays(10)])].sort().reverse();
};

export function Transmissao({ perfil, show }) {
  const [data, setData] = useState(toISO(nextSunday()));
  const [trans, setTrans] = useState(null);       // linha da transmissão da data
  const [url, setUrl] = useState('');
  const [parts, setParts] = useState([]);
  const [membros, setMembros] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);

  const linkPublico = `${location.origin}${location.pathname.replace(/index\.html$/, '').replace(/\/$/, '')}/assistir.html?ala=${perfil.alas?.slug}`;

  useEffect(() => {
    sb.from('membros').select('id, nome, familia_id').eq('ala_id', perfil.ala_id).eq('ativo', true)
      .then(({ data: m }) => setMembros(m || []));
  }, [perfil.ala_id]);

  const carregar = async () => {
    setCarregado(false);
    const { data: t } = await sb.from('transmissoes').select('*').eq('ala_id', perfil.ala_id).eq('data', data).maybeSingle();
    setTrans(t || null); setUrl(t?.url || '');
    if (t) {
      const { data: p } = await sb.from('transmissao_participantes').select('*').eq('transmissao_id', t.id).order('criado_em');
      setParts(p || []);
    } else setParts([]);
    setCarregado(true);
  };
  useEffect(() => { carregar(); }, [data, perfil.ala_id]);

  const salvarLink = async () => {
    if (!/^https?:\/\//.test(url.trim())) return show('Cole um link válido (começando com http).', false);
    setBusy(true);
    const { error } = await sb.from('transmissoes')
      .upsert({ ala_id: perfil.ala_id, data, url: url.trim() }, { onConflict: 'ala_id,data' });
    setBusy(false);
    if (error) return show(error.message, false);
    show('Link da transmissão salvo.'); carregar();
  };

  // Melhor correspondência no diretório para um nome informado
  const sugestao = useMemo(() => {
    const idx = membros.map(m => ({ ...m, n: norm(m.nome) }));
    return nome => {
      const q = norm(nome);
      if (!q) return null;
      return idx.find(m => m.n === q) || idx.find(m => m.n.includes(q) || q.includes(m.n)) || null;
    };
  }, [membros]);

  const garantirReuniao = async () => {
    const { data: r, error } = await sb.from('reunioes')
      .upsert({ ala_id: perfil.ala_id, data, tipo: 'sacramental' }, { onConflict: 'ala_id,data,tipo' })
      .select().single();
    if (error) throw new Error(error.message);
    return r.id;
  };

  const confirmar = async (p, membroId) => {
    setBusy(true);
    try {
      const rid = await garantirReuniao();
      const { error: e1 } = await sb.from('presencas').upsert(
        { ala_id: perfil.ala_id, reuniao_id: rid, membro_id: membroId, presente: true, origem: 'transmissao' },
        { onConflict: 'reuniao_id,membro_id' });
      if (e1) throw new Error(e1.message);
      await sb.from('transmissao_participantes').update({ membro_id: membroId, processado: true }).eq('id', p.id);
      show('Presença registrada via transmissão.'); carregar();
    } catch (e) { show(e.message, false); }
    setBusy(false);
  };

  const cadastrarNaoMembro = async p => {
    setBusy(true);
    try {
      let { data: fam } = await sb.from('familias').select('id').eq('ala_id', perfil.ala_id)
        .eq('sobrenome', 'Participantes não-membros').maybeSingle();
      if (!fam) {
        const { data: nf, error } = await sb.from('familias')
          .insert({ ala_id: perfil.ala_id, sobrenome: 'Participantes não-membros', chefe: '', setor: '' }).select().single();
        if (error) throw new Error(error.message);
        fam = nf;
      }
      const { data: novo, error: e2 } = await sb.from('membros')
        .insert({ ala_id: perfil.ala_id, familia_id: fam.id, nome: p.nome_informado.trim(), is_membro: false }).select().single();
      if (e2) throw new Error(e2.message);
      await confirmar(p, novo.id);
    } catch (e) { show(e.message, false); setBusy(false); }
  };

  const descartar = async p => {
    await sb.from('transmissao_participantes').update({ processado: true }).eq('id', p.id);
    carregar();
  };

  const pendentes = parts.filter(p => !p.processado);
  const processados = parts.filter(p => p.processado);
  const membroById = new Map(membros.map(m => [m.id, m]));

  return html`
    <div class="hdr">Transmissão</div>
    <div class="sub">Link semanal da reunião e presença de quem assistiu de casa</div>
    <select class="inp" style=${{ marginBottom: 10 }} value=${data} onChange=${e => setData(e.target.value)}>
      ${datasDisponiveis().map(d => html`<option value=${d} selected=${d === data}>
        Domingo ${fmtBR(d)}${d === toISO(nextSunday()) ? ' (próximo)' : d === toISO(lastSunday()) ? ' (último)' : ''}</option>`)}
    </select>
    <div class="card" style=${{ padding: 14 }}>
      <label class="lbl" style=${{ marginTop: 0 }}>Link da live no YouTube</label>
      <input class="inp" placeholder="https://youtube.com/live/…" value=${url} onInput=${e => setUrl(e.target.value)} />
      <button class="btn btn-p" style=${{ width: '100%', marginTop: 10, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvarLink}>
        Salvar link deste domingo
      </button>
      <div style=${{ marginTop: 14, padding: 12, background: 'var(--verde-claro)', borderRadius: 10, border: '1px solid #CDE2D6' }}>
        <div style=${{ fontSize: 11, fontWeight: 700, color: 'var(--verde)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><${IcLink} size=${13} /> Link público para enviar aos membros (não muda de semana):</div>
        <div style=${{ fontSize: 12, color: 'var(--tinta)', wordBreak: 'break-all' }}>${linkPublico}</div>
        <button class="btn btn-g" style=${{ width: '100%', marginTop: 8, fontSize: 12 }}
          onClick=${() => { navigator.clipboard?.writeText(linkPublico); show('Link copiado.'); }}>Copiar link</button>
      </div>
    </div>

    <div class="titulo-secao" style=${{ margin: '16px 0 8px' }}>
      Participantes informados ${carregado ? `(${parts.length})` : ''}
    </div>
    ${!carregado ? html`<${Spinner}/>` : parts.length === 0
      ? html`<${Empty} msg=${trans ? 'Ninguém se registrou nesta transmissão ainda.' : 'Salve o link para abrir o registro de participantes.'} />`
      : html`
      ${pendentes.map(p => {
        const sug = sugestao(p.nome_informado);
        return html`
        <div key=${p.id} class="card" style=${{ padding: '11px 14px' }}>
          <div style=${{ fontWeight: 600, fontSize: 13 }}>${p.nome_informado}</div>
          ${sug ? html`
            <div style=${{ fontSize: 11, color: 'var(--verde)', margin: '3px 0 8px' }}>Diretório: <strong>${sug.nome}</strong></div>
            <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button class="btn btn-g" style=${{ fontSize: 12, flex: 1 }} disabled=${busy} onClick=${() => confirmar(p, sug.id)}><${IcCheck} size=${13} /> Confirmar presença</button>
              <button class="btn btn-s" style=${{ fontSize: 12 }} disabled=${busy} onClick=${() => cadastrarNaoMembro(p)}>Não é essa pessoa</button>
              <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => descartar(p)}>Ignorar</button>
            </div>` : html`
            <div style=${{ fontSize: 11, color: 'var(--ambar)', margin: '3px 0 8px' }}>Não encontrado no diretório.</div>
            <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button class="btn btn-g" style=${{ fontSize: 12, flex: 1 }} disabled=${busy} onClick=${() => cadastrarNaoMembro(p)}><${IcMais} size=${13} /> Cadastrar como não-membro e registrar presença</button>
              <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => descartar(p)}>Ignorar</button>
            </div>`}
        </div>`;
      })}
      ${processados.length > 0 && html`
        <div style=${{ fontSize: 12, fontWeight: 700, color: 'var(--tinta3)', margin: '10px 0 6px' }}>Processados</div>
        ${processados.map(p => html`
          <div key=${p.id} style=${{ fontSize: 12, color: 'var(--tinta3)', padding: '6px 2px', borderBottom: '1px solid var(--linha2)' }}>
            ${p.membro_id ? '✓' : '—'} ${p.nome_informado}
            ${p.membro_id && membroById.get(p.membro_id) ? ` → ${membroById.get(p.membro_id).nome}` : ''}
          </div>`)}`}`}`;
}
