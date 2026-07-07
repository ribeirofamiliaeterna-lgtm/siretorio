import { html, useState, useEffect, useMemo, sb, norm, toISO, fromISO, fmtBR, lastSunday, nextSunday, listSundays, Spinner, Empty, Chip, InfoTip, sincronizarAlertas, SITUACAO_MEMBRO } from './core.js';
import { IcCheck, IcFechar, IcMais, IcSino, IcSaude, IcPessoas, IcEditar } from './icons.js';
import { RelatoriosFrequencia } from './frequencia-relatorios.js';

// Domingos disponíveis: próximo + últimos 16
const domingos = () => [toISO(nextSunday(new Date(Date.now() + 864e5))), ...listSundays(16)]
  .filter((v, i, a) => a.indexOf(v) === i).sort().reverse();

// ─── Card de registro por família ────────────────────────────────────────
function CardRegistro({ f, ms, marcas, setMarca, motivos, onSalvar, salvando }) {
  const [open, setOpen] = useState(false);
  const regs = ms.filter(m => marcas[m.id]?.p !== undefined);
  const presentes = ms.filter(m => marcas[m.id]?.p === true).length;
  const registrada = ms.length > 0 && ms.every(m => marcas[m.id]?.p !== undefined);
  return html`
  <div class="card" style=${registrada ? { borderColor: '#CDE2D6', background: '#FDFEFD' } : {}}>
    <div style=${{ padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      onClick=${() => setOpen(o => !o)}>
      <div>
        <span style=${{ fontWeight: 600, fontSize: 14 }}>Família ${f.sobrenome}</span>
        <div style=${{ fontSize: 11, color: 'var(--tinta3)' }}>${f.chefe}</div>
      </div>
      <div style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
        ${regs.length > 0 && html`<${Chip} bg=${presentes > 0 ? 'var(--verde-claro)' : 'var(--vermelho-claro)'} t=${presentes > 0 ? 'var(--verde)' : 'var(--vermelho)'}>
          ${presentes}/${ms.length}<//>`}
        <span style=${{ color: 'var(--tinta3)', fontSize: 11 }}>${open ? '▴' : '▾'}</span>
      </div>
    </div>
    ${open && html`
    <div style=${{ borderTop: '1px solid var(--linha2)', padding: '10px 14px', background: 'var(--papel)' }}>
      ${ms.length === 0 && html`<div style=${{ fontSize: 12, color: 'var(--tinta3)' }}>Sem membros cadastrados.</div>`}
      ${ms.map(m => {
        const v = marcas[m.id] || {};
        const selo = SITUACAO_MEMBRO[m.situacao];
        return html`
        <div key=${m.id} style=${{ padding: '7px 0', borderBottom: '1px solid var(--linha2)' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style=${{ fontSize: 13, minWidth: 0 }}>
              ${m.nome}
              ${selo && html` <${Chip} bg=${selo.bg} t=${selo.t} style=${{ fontSize: 10 }}>${selo.l}<//>`}
            </span>
            <div style=${{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button class="chip" style=${{ background: v.p === true ? 'var(--verde)' : 'var(--linha2)', color: v.p === true ? '#FFF' : 'var(--tinta3)', padding: '5px 12px', fontSize: 12 }}
                onClick=${() => setMarca(m.id, { p: v.p === true ? undefined : true, motivo: null })}>Presente</button>
              <button class="chip" style=${{ background: v.p === false ? 'var(--vermelho)' : 'var(--linha2)', color: v.p === false ? '#FFF' : 'var(--tinta3)', padding: '5px 12px', fontSize: 12 }}
                onClick=${() => setMarca(m.id, { p: v.p === false ? undefined : false, motivo: v.motivo || null })}>Faltou</button>
            </div>
          </div>
          ${v.p === false && html`
            <select class="inp" style=${{ marginTop: 6, padding: '7px 10px', fontSize: 12 }}
              value=${v.motivo || ''} onChange=${e => setMarca(m.id, { p: false, motivo: e.target.value || null })}>
              <option value="">Justificativa da falta…</option>
              ${motivos.map(mo => html`<option value=${mo.id} selected=${mo.id === v.motivo}>${mo.nome}</option>`)}
            </select>`}
        </div>`;
      })}
      ${ms.length > 0 && html`
      <div style=${{ fontSize: 11, color: 'var(--tinta3)', margin: '8px 0 6px' }}>
        Quem não for marcado será registrado como falta.
      </div>
      <button class="btn btn-p" style=${{ width: '100%', opacity: salvando ? .6 : 1 }} disabled=${salvando}
        onClick=${() => onSalvar(f, ms)}>Salvar registro da família</button>`}
    </div>`}
  </div>`;
}

// ─── Visitantes do domingo ────────────────────────────────────────────────
function Visitantes({ perfil, data, show, garantirReuniao, reuniao, aoMudar }) {
  const [nomeados, setNomeados] = useState([]);
  const [qtd, setQtd] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [acompanhar, setAcompanhar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState(false);

  const carregarNomeados = rid => {
    if (!rid) { setNomeados([]); return; }
    sb.from('reuniao_visitantes').select('*').eq('reuniao_id', rid).order('criado_em')
      .then(({ data: v }) => setNomeados(v || []));
  };
  useEffect(() => {
    setQtd(reuniao?.visitantes ?? '');
    carregarNomeados(reuniao?.id);
  }, [reuniao?.id, data]);

  const salvarQtd = async () => {
    setBusy(true);
    try {
      const rid = await garantirReuniao();
      const { error } = await sb.from('reunioes').update({ visitantes: Number(qtd) || 0 }).eq('id', rid);
      if (error) throw new Error(error.message);
      show('Número de visitantes salvo.'); aoMudar();
    } catch (e) { show(e.message, false); }
    setBusy(false);
  };

  const adicionar = async () => {
    const nome = novoNome.trim();
    if (!nome) return show('Escreva o nome do visitante.', false);
    setBusy(true);
    try {
      const rid = await garantirReuniao();
      if (acompanhar) {
        // Vira membro "adicionado manualmente": entra no acompanhamento e nos alertas
        let { data: fam } = await sb.from('familias').select('id').eq('ala_id', perfil.ala_id)
          .eq('sobrenome', 'Visitantes em acompanhamento').maybeSingle();
        if (!fam) {
          const { data: nf, error } = await sb.from('familias')
            .insert({ ala_id: perfil.ala_id, sobrenome: 'Visitantes em acompanhamento', chefe: '', setor: '' }).select().single();
          if (error) throw new Error(error.message);
          fam = nf;
        }
        const { data: novo, error: e2 } = await sb.from('membros')
          .insert({ ala_id: perfil.ala_id, familia_id: fam.id, nome, is_membro: false, situacao: 'manual' }).select().single();
        if (e2) throw new Error(e2.message);
        const { error: e3 } = await sb.from('presencas').upsert(
          { ala_id: perfil.ala_id, reuniao_id: rid, membro_id: novo.id, presente: true, origem: 'manual' },
          { onConflict: 'reuniao_id,membro_id' });
        if (e3) throw new Error(e3.message);
        show(`${nome} entrou no acompanhamento de frequência.`);
      } else {
        const { error } = await sb.from('reuniao_visitantes')
          .insert({ reuniao_id: rid, ala_id: perfil.ala_id, nome });
        if (error) throw new Error(error.message);
        show('Visitante registrado.');
        carregarNomeados(rid);
      }
      setNovoNome(''); setAcompanhar(false); aoMudar();
    } catch (e) { show(e.message, false); }
    setBusy(false);
  };

  const remover = async v => {
    await sb.from('reuniao_visitantes').delete().eq('id', v.id);
    setNomeados(a => a.filter(x => x.id !== v.id));
  };

  const total = (Number(qtd) || 0) + nomeados.length;
  return html`
  <div class="card">
    <div style=${{ padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      onClick=${() => setAberto(o => !o)}>
      <span style=${{ fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <${IcPessoas} size=${16} /> Visitantes deste domingo
      </span>
      <div style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
        ${total > 0 && html`<${Chip} bg="var(--dourado-claro)" t="var(--dourado)">${total}<//>`}
        <span style=${{ color: 'var(--tinta3)', fontSize: 11 }}>${aberto ? '▴' : '▾'}</span>
      </div>
    </div>
    ${aberto && html`
    <div style=${{ borderTop: '1px solid var(--linha2)', padding: '12px 14px', background: 'var(--papel)' }}>
      <label class="lbl" style=${{ marginTop: 0 }}>Visitantes sem registro de nome</label>
      <div style=${{ display: 'flex', gap: 6 }}>
        <input class="inp" type="number" min="0" style=${{ width: 110 }} value=${qtd} onInput=${e => setQtd(e.target.value)} />
        <button class="btn btn-s" style=${{ fontSize: 12 }} disabled=${busy} onClick=${salvarQtd}>Salvar número</button>
      </div>
      <label class="lbl">Visitante com nome (opcional)</label>
      <input class="inp" placeholder="Nome do visitante" value=${novoNome} onInput=${e => setNovoNome(e.target.value)} />
      <label style=${{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tinta2)', margin: '8px 0' }}>
        <input type="checkbox" checked=${acompanhar} onChange=${e => setAcompanhar(e.target.checked)} />
        Incluir irmão(a) no acompanhamento de frequência
        <${InfoTip} texto="Quem entra no acompanhamento passa a aparecer no registro dominical com o selo “Adicionado manualmente”, conta nos relatórios e gera alerta se faltar dois domingos seguidos. Permanece mesmo após a troca do diretório." />
      </label>
      <button class="btn btn-p" style=${{ width: '100%', fontSize: 12.5, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${adicionar}>
        <${IcMais} size=${14} /> Adicionar visitante
      </button>
      ${nomeados.length > 0 && html`
        <div style=${{ marginTop: 10 }}>
          ${nomeados.map(v => html`
            <div key=${v.id} style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--tinta2)', padding: '4px 0', borderBottom: '1px solid var(--linha2)' }}>
              <span>${v.nome}</span>
              <button style=${{ color: 'var(--vermelho)', padding: 2 }} onClick=${() => remover(v)}><${IcFechar} size=${13} /></button>
            </div>`)}
        </div>`}
    </div>`}
  </div>`;
}

// ─── Gestão de justificativas ────────────────────────────────────────────
function Justificativas({ perfil, motivos, show, recarregar }) {
  const [novo, setNovo] = useState('');
  const alterar = async (m, patch) => {
    const { error } = await sb.from('motivos_falta').update(patch).eq('id', m.id);
    if (error) return show(error.message, false);
    recarregar();
  };
  const criar = async () => {
    if (!novo.trim()) return;
    const { error } = await sb.from('motivos_falta').insert({ ala_id: perfil.ala_id, nome: novo.trim() });
    if (error) return show(error.message, false);
    setNovo(''); show('Justificativa criada.'); recarregar();
  };
  const excluir = async m => {
    if (!confirm(`Excluir a justificativa "${m.nome}"?`)) return;
    const { error } = await sb.from('motivos_falta').delete().eq('id', m.id);
    if (error) return show('Não foi possível excluir: já existe falta registrada com esta justificativa.', false);
    show('Justificativa excluída.'); recarregar();
  };
  return html`
    <div class="card" style=${{ padding: 14 }}>
      <div class="titulo-secao">Justificativas de falta</div>
      <div style=${{ fontSize: 12, color: 'var(--tinta2)', margin: '3px 0 10px' }}>
        Estas opções aparecem ao registrar uma falta. Marque as que <em>não devem contar</em> na
        métrica de frequência alternada (ex.: doença) e as que devem ser repassadas à liderança.
      </div>
      ${motivos.map(m => html`
        <div key=${m.id} style=${{ padding: '9px 0', borderBottom: '1px solid var(--linha2)' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style=${{ fontSize: 13.5, fontWeight: 600 }}>${m.nome}</span>
            ${!m.padrao && html`<button style=${{ color: 'var(--vermelho)', padding: 2 }} onClick=${() => excluir(m)}><${IcFechar} size=${13} /></button>`}
          </div>
          <div style=${{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
            <label style=${{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tinta2)' }}>
              <input type="checkbox" checked=${m.excluir_da_metrica} onChange=${e => alterar(m, { excluir_da_metrica: e.target.checked })} />
              Não conta na frequência alternada
              <${InfoTip} texto="Faltas com esta justificativa são desconsideradas no indicador de frequência alternada do Painel. Ex.: membro doente não deve aparecer como frequência irregular." />
            </label>
            <label style=${{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tinta2)' }}>
              <input type="checkbox" checked=${m.alerta_lideranca} onChange=${e => alterar(m, { alerta_lideranca: e.target.checked })} />
              Repassar à liderança
            </label>
          </div>
        </div>`)}
      <div style=${{ display: 'flex', gap: 6, marginTop: 12 }}>
        <input class="inp" placeholder="Nova justificativa — ex: Trabalho" value=${novo}
          onInput=${e => setNovo(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') criar(); }} />
        <button class="btn btn-p" style=${{ whiteSpace: 'nowrap', fontSize: 12.5 }} onClick=${criar}>
          <${IcMais} size=${14} /> Criar
        </button>
      </div>
    </div>`;
}

// ─── Módulo principal ────────────────────────────────────────────────────
export function Frequencia({ perfil, show }) {
  const [aba, setAba] = useState('registrar');
  const [data, setData] = useState(toISO(lastSunday()));
  const [fams, setFams] = useState(null);
  const [membros, setMembros] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [reuniao, setReuniao] = useState(null);
  const [marcas, setMarcas] = useState({});          // membro_id → {p, motivo}
  const [alertas, setAlertas] = useState([]);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarBase = async () => {
    const [{ data: f }, { data: m }, { data: mo }] = await Promise.all([
      sb.from('familias').select('id, sobrenome, chefe').eq('ala_id', perfil.ala_id).order('sobrenome'),
      sb.from('membros').select('id, familia_id, nome, sexo, is_membro, ativo, situacao').eq('ala_id', perfil.ala_id).eq('ativo', true).order('nome'),
      sb.from('motivos_falta').select('*').eq('ala_id', perfil.ala_id).order('nome'),
    ]);
    setFams(f || []); setMembros(m || []); setMotivos(mo || []);
  };
  useEffect(() => { carregarBase(); }, [perfil.ala_id]);

  const carregarDia = async () => {
    const { data: r } = await sb.from('reunioes').select('*').eq('ala_id', perfil.ala_id).eq('data', data).eq('tipo', 'sacramental').maybeSingle();
    setReuniao(r || null);
    if (!r) { setMarcas({}); return; }
    const { data: p } = await sb.from('presencas').select('*').eq('reuniao_id', r.id);
    setMarcas(Object.fromEntries((p || []).map(x => [x.membro_id, { p: x.presente, motivo: x.motivo_falta_id }])));
  };
  useEffect(() => { carregarDia(); }, [data, perfil.ala_id]);

  const carregarAlertas = async () => {
    await sincronizarAlertas(perfil.ala_id);
    const { data: a } = await sb.from('alertas')
      .select('id, referencia, membros(nome, situacao)')
      .eq('ala_id', perfil.ala_id).eq('status', 'aberto').order('referencia', { ascending: false });
    setAlertas(a || []);
  };
  useEffect(() => { carregarAlertas(); }, [perfil.ala_id]);

  const garantirReuniao = async () => {
    if (reuniao) return reuniao.id;
    const { data: r, error } = await sb.from('reunioes')
      .upsert({ ala_id: perfil.ala_id, data, tipo: 'sacramental' }, { onConflict: 'ala_id,data,tipo' })
      .select().single();
    if (error) throw new Error(error.message);
    setReuniao(r);
    return r.id;
  };

  // Membros que aparecem no registro: quem consta no diretório ou está em
  // acompanhamento manual (quem saiu do diretório fica só nos relatórios)
  const registraveis = useMemo(() => membros.filter(m => m.situacao !== 'fora_diretorio'), [membros]);

  const porFamilia = useMemo(() => {
    const map = new Map();
    registraveis.forEach(m => { if (!map.has(m.familia_id)) map.set(m.familia_id, []); map.get(m.familia_id).push(m); });
    return map;
  }, [registraveis]);

  const salvarFamilia = async (f, ms) => {
    setSalvando(true);
    try {
      const rid = await garantirReuniao();
      const rows = ms.map(m => ({
        ala_id: perfil.ala_id, reuniao_id: rid, membro_id: m.id,
        presente: marcas[m.id]?.p === true, origem: 'manual',
        motivo_falta_id: marcas[m.id]?.p === false ? (marcas[m.id]?.motivo || null) : null,
      }));
      const { error } = await sb.from('presencas').upsert(rows, { onConflict: 'reuniao_id,membro_id' });
      if (error) throw new Error(error.message);
      show(`Família ${f.sobrenome} registrada.`);
      carregarDia(); carregarAlertas();
    } catch (e) { show(e.message, false); }
    setSalvando(false);
  };

  const dispensarAlerta = async a => {
    const { error } = await sb.from('alertas').update({ status: 'dispensado' }).eq('id', a.id);
    if (error) return show(error.message, false);
    setAlertas(x => x.filter(y => y.id !== a.id));
  };

  if (!fams) return html`<${Spinner}/>`;

  const q = norm(busca);
  const famComMembros = fams.filter(f => (porFamilia.get(f.id) || []).length > 0);
  const famVisiveis = q ? famComMembros.filter(f => norm(`${f.sobrenome} ${f.chefe}`).includes(q)
    || (porFamilia.get(f.id) || []).some(m => norm(m.nome).includes(q))) : famComMembros;

  const valores = Object.values(marcas);
  const registrados = valores.filter(v => v.p !== undefined).length;
  const presentesTotal = valores.filter(v => v.p === true).length;

  return html`
    <div class="hdr">Frequência da Ala</div>
    <div class="sub">Registro dominical de presença, visitantes e alertas de ausência</div>
    <select class="inp" style=${{ marginBottom: 10 }} value=${data} onChange=${e => setData(e.target.value)}>
      ${domingos().map(d => html`<option value=${d} selected=${d === data}>Domingo ${fmtBR(d)}${d === toISO(lastSunday()) ? ' (último)' : ''}</option>`)}
    </select>
    <div class="seg" style=${{ marginBottom: 12 }}>
      <button class=${aba === 'registrar' ? 'on' : ''} onClick=${() => setAba('registrar')}>Registrar</button>
      <button class=${aba === 'alertas' ? 'on' : ''} onClick=${() => setAba('alertas')}>
        <${IcSino} size=${13} /> Alertas${alertas.length ? ` (${alertas.length})` : ''}</button>
      <button class=${aba === 'justificativas' ? 'on' : ''} onClick=${() => setAba('justificativas')}>Justificativas</button>
      <button class=${aba === 'relatorios' ? 'on' : ''} onClick=${() => setAba('relatorios')}>Relatórios</button>
    </div>

    ${aba === 'registrar' && html`
      <div style=${{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div class="kpi"><div class="v">${presentesTotal}</div><div class="l">Presentes
          <${InfoTip} texto="Membros marcados como presentes neste domingo, no salão ou pela transmissão." /></div></div>
        <div class="kpi"><div class="v">${registrados - presentesTotal}</div><div class="l">Faltas registradas</div></div>
        <div class="kpi"><div class="v">${Math.max(0, registraveis.length - registrados)}</div><div class="l">Sem registro</div></div>
      </div>
      <${Visitantes} perfil=${perfil} data=${data} show=${show} reuniao=${reuniao}
        garantirReuniao=${garantirReuniao} aoMudar=${carregarDia} />
      <input class="inp" type="search" placeholder="Buscar família por nome ou sobrenome…" value=${busca}
        onInput=${e => setBusca(e.target.value)} style=${{ margin: '2px 0 10px' }} />
      ${famVisiveis.map(f => html`<${CardRegistro} key=${f.id} f=${f} ms=${porFamilia.get(f.id) || []}
        marcas=${marcas} motivos=${motivos}
        setMarca=${(id, v) => setMarcas(o => ({ ...o, [id]: v }))}
        onSalvar=${salvarFamilia} salvando=${salvando} />`)}`}

    ${aba === 'alertas' && html`
      <div style=${{ fontSize: 12.5, color: 'var(--tinta2)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span>Membros ativos que faltaram dois domingos seguidos.</span>
        <${InfoTip} texto="Considera-se ativo quem registrou ao menos uma presença nos 3 meses anteriores. Se um membro ativo falta em dois domingos consecutivos, o alerta é criado. Dispensar o alerta não apaga as faltas — apenas o aviso." />
      </div>
      ${alertas.length === 0 && html`<${Empty} msg="Nenhum alerta pendente." />`}
      ${alertas.map(a => html`
        <div key=${a.id} class="card" style=${{ padding: '12px 14px', borderLeft: '3px solid var(--vermelho)' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style=${{ fontWeight: 600, fontSize: 13.5 }}>
                ${a.membros?.nome}
                ${SITUACAO_MEMBRO[a.membros?.situacao] && html` <${Chip} bg=${SITUACAO_MEMBRO[a.membros.situacao].bg} t=${SITUACAO_MEMBRO[a.membros.situacao].t} style=${{ fontSize: 10 }}>${SITUACAO_MEMBRO[a.membros.situacao].l}<//>`}
              </div>
              <div style=${{ fontSize: 11.5, color: 'var(--tinta2)', marginTop: 2 }}>
                Faltou nos domingos ${fmtBR(toISO(new Date(fromISO(a.referencia) - 7 * 864e5)))} e ${fmtBR(a.referencia)}
              </div>
            </div>
            <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => dispensarAlerta(a)}>Dispensar</button>
          </div>
        </div>`)}`}

    ${aba === 'justificativas' && html`
      <${Justificativas} perfil=${perfil} motivos=${motivos} show=${show} recarregar=${carregarBase} />`}

    ${aba === 'relatorios' && html`
      <${RelatoriosFrequencia} perfil=${perfil} membros=${membros} motivos=${motivos} fams=${fams} show=${show} />`}`;
}
