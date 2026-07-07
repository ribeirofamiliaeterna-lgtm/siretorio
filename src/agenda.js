import { html, useState, useEffect, useMemo, sb, norm, toISO, fmtBR, nextSunday, Spinner, Empty, Modal } from './core.js';
import { Relatorios, Planilha } from './agenda-relatorios.js';
import { IcLivro, IcImprimir, IcVoltar, IcMais, IcFechar, IcOlho } from './icons.js';
import { HINOS } from './hinos.js';

export const SECOES = {
  abertura:     'Abertura',
  assuntos:     'Assuntos da Ala',
  servico:      'Serviço Sacramental',
  discursos:    'Discursos',
  encerramento: 'Encerramento',
};

// Modelo padrão de agenda (baseado nas atas da ala)
const MODELO = [
  ['abertura', 'Presidindo', 'funcao'],
  ['abertura', 'Dirigindo', 'funcao'],
  ['abertura', 'Regente', 'funcao'],
  ['abertura', 'Organista', 'funcao'],
  ['abertura', 'Reconhecimento de autoridades', 'texto'],
  ['abertura', 'Anúncios', 'texto'],
  ['abertura', 'Hino de abertura', 'hino'],
  ['abertura', 'Oração de abertura', 'oracao'],
  ['assuntos', 'Desobrigações', 'texto'],
  ['assuntos', 'Apoios', 'texto'],
  ['servico', 'Hino sacramental', 'hino'],
  ['discursos', '1º Discursante', 'discurso'],
  ['discursos', '2º Discursante', 'discurso'],
  ['discursos', 'Hino intermediário', 'hino'],
  ['encerramento', 'Hino de encerramento', 'hino'],
  ['encerramento', 'Oração de encerramento', 'oracao'],
];

const TIPOS_NOVOS = [
  ['discurso', 'Discursante'],
  ['participacao', 'Participação especial'],
  ['oracao', 'Oração'],
  ['hino', 'Hino'],
  ['texto', 'Texto livre'],
];
const ehPessoa = t => ['funcao', 'oracao', 'discurso', 'participacao'].includes(t);

// ─── Seletor de pessoa com autocompletar do diretório ───────────────────
export function PersonPicker({ membros, membroId, nomeLivre, onPick }) {
  const [q, setQ] = useState(null);          // null = não está editando
  const escolhido = membroId ? membros.find(m => m.id === membroId) : null;
  const display = escolhido ? escolhido.nome : (nomeLivre || '');
  const editando = q !== null;
  const sugestoes = useMemo(() => {
    if (!editando || norm(q).length < 2) return [];
    const n = norm(q);
    return membros.filter(m => norm(m.nome).includes(n)).slice(0, 8);
  }, [q, editando, membros]);

  const confirmarTexto = () => {
    if (q === null) return;   // não estava editando (ex.: blur logo após escolher no autocompletar)
    const t = q.trim();
    if (t !== display) onPick(t ? { membro_id: null, nome_livre: t } : { membro_id: null, nome_livre: '' });
    setQ(null);
  };

  return html`
  <div style=${{ position: 'relative', flex: 1 }}>
    <div style=${{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input class="inp" style=${{ fontSize: 13 }} placeholder="Digite o nome…"
        value=${editando ? q : display}
        onFocus=${() => setQ(display)}
        onInput=${e => setQ(e.target.value)}
        onBlur=${confirmarTexto}
        onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }} />
      ${escolhido && !editando && html`<span class="chip" style=${{ background: 'var(--verde-claro)', color: 'var(--verde)', flexShrink: 0 }} title="Encontrado no diretório">✓</span>`}
      ${!escolhido && display && !editando && html`<span class="chip" style=${{ background: 'var(--ambar-claro)', color: 'var(--ambar)', flexShrink: 0 }} title="Fora do diretório">?</span>`}
    </div>
    ${sugestoes.length > 0 && html`
      <div style=${{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#FFF',
        border: '1px solid var(--linha)', borderRadius: 10, boxShadow: '0 6px 18px rgba(35,40,46,.14)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
        ${sugestoes.map(m => html`
          <div key=${m.id} onMouseDown=${e => { e.preventDefault(); onPick({ membro_id: m.id, nome_livre: '' }); setQ(null); }}
            style=${{ padding: '9px 12px', fontSize: 13, color: 'var(--tinta)', cursor: 'pointer', borderBottom: '1px solid var(--linha2)' }}>
            ${m.nome}
          </div>`)}
      </div>`}
  </div>`;
}

// ─── Seletor de hino com autocompletar do hinário oficial ───────────────
function HinoPicker({ valor, onChange }) {
  const [q, setQ] = useState(null);
  const editando = q !== null;
  const sugestoes = useMemo(() => {
    if (!editando || q.trim().length < 1) return [];
    const nq = norm(q);
    return HINOS.filter(h => String(h.n).startsWith(nq) || norm(h.nome).includes(nq)).slice(0, 8);
  }, [q, editando]);

  const confirmarTexto = () => {
    if (q === null) return;
    const t = q.trim();
    if (t !== valor) onChange(t);
    setQ(null);
  };

  return html`
  <div style=${{ position: 'relative' }}>
    <input class="inp" style=${{ fontSize: 13 }} placeholder="Nº ou nome do hino…"
      value=${editando ? q : valor}
      onFocus=${() => setQ(valor)}
      onInput=${e => setQ(e.target.value)}
      onBlur=${confirmarTexto}
      onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }} />
    ${sugestoes.length > 0 && html`
      <div style=${{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#FFF',
        border: '1px solid var(--linha)', borderRadius: 10, boxShadow: '0 6px 18px rgba(35,40,46,.14)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
        ${sugestoes.map(h => html`
          <div key=${h.n} onMouseDown=${e => { e.preventDefault(); onChange(`${h.n} - ${h.nome}`); setQ(null); }}
            style=${{ padding: '9px 12px', fontSize: 13, color: 'var(--tinta)', cursor: 'pointer', borderBottom: '1px solid var(--linha2)' }}>
            ${h.n} - ${h.nome}
          </div>`)}
      </div>`}
  </div>`;
}

// ─── Editor de uma agenda ────────────────────────────────────────────────
function Editor({ perfil, show, agenda, membros, onVoltar, onLeitura }) {
  const [itens, setItens] = useState(null);
  const [freq, setFreq] = useState(agenda.frequencia ?? '');
  const [presRodizio, setPresRodizio] = useState(null);
  const [novo, setNovo] = useState(null); // secao em que está adicionando

  const carregar = async () => {
    const { data } = await sb.from('agenda_itens').select('*').eq('agenda_id', agenda.id).order('ordem');
    setItens(data || []);
  };
  useEffect(() => { carregar(); }, [agenda.id]);

  useEffect(() => {
    (async () => {
      const { data: r } = await sb.from('reunioes').select('id').eq('ala_id', perfil.ala_id)
        .eq('data', agenda.data).eq('tipo', 'sacramental').maybeSingle();
      if (!r) return;
      const { count } = await sb.from('presencas').select('id', { count: 'exact', head: true })
        .eq('reuniao_id', r.id).eq('presente', true);
      setPresRodizio(count);
    })();
  }, [agenda.id]);

  const salvarItem = async (id, patch) => {
    setItens(a => a.map(i => i.id === id ? { ...i, ...patch } : i));
    const { error } = await sb.from('agenda_itens').update(patch).eq('id', id);
    if (error) show(error.message, false);
  };

  const mover = async (item, dir) => {
    const daSecao = itens.filter(i => i.secao === item.secao);
    const idx = daSecao.findIndex(i => i.id === item.id);
    const alvo = daSecao[idx + dir];
    if (!alvo) return;
    setItens(a => a.map(i => i.id === item.id ? { ...i, ordem: alvo.ordem } : i.id === alvo.id ? { ...i, ordem: item.ordem } : i)
      .sort((x, y) => x.ordem - y.ordem));
    await Promise.all([
      sb.from('agenda_itens').update({ ordem: alvo.ordem }).eq('id', item.id),
      sb.from('agenda_itens').update({ ordem: item.ordem }).eq('id', alvo.id),
    ]);
  };

  const excluirItem = async item => {
    if (!confirm(`Remover "${item.rotulo}" desta agenda?`)) return;
    setItens(a => a.filter(i => i.id !== item.id));
    await sb.from('agenda_itens').delete().eq('id', item.id);
  };

  const addItem = async (secao, tipo, rotulo) => {
    if (!rotulo.trim()) return show('Dê um nome ao item.', false);
    const daSecao = itens.filter(i => i.secao === secao);
    const ordem = (daSecao.length ? Math.max(...daSecao.map(i => i.ordem)) : 0) + 10;
    const { data, error } = await sb.from('agenda_itens').insert({
      agenda_id: agenda.id, ala_id: perfil.ala_id, secao, tipo, rotulo: rotulo.trim(), ordem, padrao: false,
    }).select().single();
    if (error) return show(error.message, false);
    setItens(a => [...a, data].sort((x, y) => x.ordem - y.ordem));
    setNovo(null);
  };

  const salvarFreq = async () => {
    const v = freq === '' ? null : Number(freq);
    const { error } = await sb.from('agendas').update({ frequencia: v }).eq('id', agenda.id);
    if (error) show(error.message, false); else show('Frequência salva.');
  };

  if (!itens) return html`<${Spinner}/>`;

  return html`
  <div class="no-print">
    <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
      <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${onVoltar}><${IcVoltar} size=${14} /> Agendas</button>
      <button class="btn btn-p" style=${{ fontSize: 12 }} onClick=${onLeitura}><${IcLivro} size=${14} /> Modo condução</button>
    </div>
    <div class="hdr" style=${{ fontSize: 17 }}>Agenda de ${fmtBR(agenda.data)}</div>
    <div style=${{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 14px', flexWrap: 'wrap' }}>
      <label style=${{ fontSize: 12, fontWeight: 700, color: 'var(--tinta2)' }}>Frequência:</label>
      <input class="inp" type="number" style=${{ width: 90 }} value=${freq}
        onInput=${e => setFreq(e.target.value)} onBlur=${salvarFreq} />
      ${presRodizio != null && html`
        <span class="chip" style=${{ background: 'var(--azul-claro)', color: 'var(--azul)' }}>A Frequência da Ala registrou ${presRodizio} presentes</span>`}
    </div>

    ${Object.entries(SECOES).map(([sec, nomeSec]) => {
      const daSecao = itens.filter(i => i.secao === sec);
      return html`
      <div key=${sec} class="card" style=${{ padding: 14 }}>
        <div style=${{ fontWeight: 700, fontSize: 12.5, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8, fontFamily: 'var(--serif)' }}>${nomeSec}</div>
        ${daSecao.map((item, idx) => html`
          <div key=${item.id} style=${{ marginBottom: 10 }}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              ${item.padrao
                ? html`<span style=${{ fontSize: 12, fontWeight: 700, color: 'var(--tinta2)' }}>${item.rotulo}</span>`
                : html`<input value=${item.rotulo} style=${{ fontSize: 12, fontWeight: 700, color: 'var(--tinta2)', border: 'none', background: 'transparent', borderBottom: '1px dashed var(--linha)', outline: 'none', flex: 1 }}
                    onBlur=${e => e.target.value.trim() && e.target.value !== item.rotulo && salvarItem(item.id, { rotulo: e.target.value.trim() })} />`}
              <div style=${{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button style=${{ color: 'var(--tinta3)', fontSize: 13, padding: '0 4px' }} disabled=${idx === 0} onClick=${() => mover(item, -1)}>↑</button>
                <button style=${{ color: 'var(--tinta3)', fontSize: 13, padding: '0 4px' }} disabled=${idx === daSecao.length - 1} onClick=${() => mover(item, 1)}>↓</button>
                <button style=${{ color: 'var(--vermelho)', fontSize: 13, padding: '0 4px' }} onClick=${() => excluirItem(item)}>✕</button>
              </div>
            </div>
            ${ehPessoa(item.tipo)
              ? html`<${PersonPicker} membros=${membros} membroId=${item.membro_id} nomeLivre=${item.nome_livre}
                  onPick=${p => salvarItem(item.id, p)} />`
              : item.tipo === 'hino'
                ? html`<${HinoPicker} valor=${item.conteudo}
                    onChange=${v => { setItens(a => a.map(i => i.id === item.id ? { ...i, conteudo: v } : i)); salvarItem(item.id, { conteudo: v }); }} />`
                : html`<textarea class="inp" rows="2" style=${{ fontSize: 13, resize: 'vertical' }} placeholder="Escreva aqui…"
                    value=${item.conteudo} onInput=${e => setItens(a => a.map(i => i.id === item.id ? { ...i, conteudo: e.target.value } : i))}
                    onBlur=${e => salvarItem(item.id, { conteudo: e.target.value })}></textarea>`}
          </div>`)}
        ${novo === sec
          ? html`<${NovoItem} onAdd=${(tipo, rotulo) => addItem(sec, tipo, rotulo)} onCancel=${() => setNovo(null)} />`
          : html`<button class="btn btn-s" style=${{ fontSize: 12, width: '100%' }} onClick=${() => setNovo(sec)}><${IcMais} size=${13} /> Adicionar item</button>`}
      </div>`;
    })}
  </div>`;
}

function NovoItem({ onAdd, onCancel }) {
  const [tipo, setTipo] = useState('discurso');
  const [rotulo, setRotulo] = useState('');
  const sugestao = { discurso: '3º Discursante', participacao: 'Apresentação musical', oracao: 'Oração', hino: 'Hino', texto: 'Observações' };
  return html`
  <div style=${{ background: 'var(--papel)', border: '1px dashed var(--linha)', borderRadius: 10, padding: 10 }}>
    <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      ${TIPOS_NOVOS.map(([t, l]) => html`
        <button key=${t} class="chip" style=${{ background: tipo === t ? 'var(--azul)' : 'var(--linha2)', color: tipo === t ? '#FFF' : 'var(--tinta2)', padding: '6px 10px', fontSize: 12 }}
          onClick=${() => setTipo(t)}>${l}</button>`)}
    </div>
    <input class="inp" style=${{ fontSize: 13, marginTop: 8 }} placeholder=${`Nome do item — ex: ${sugestao[tipo]}`}
      value=${rotulo} onInput=${e => setRotulo(e.target.value)} />
    <div style=${{ display: 'flex', gap: 6, marginTop: 8 }}>
      <button class="btn btn-s" style=${{ flex: 1, fontSize: 12 }} onClick=${onCancel}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, fontSize: 12 }} onClick=${() => onAdd(tipo, rotulo || sugestao[tipo])}>Adicionar</button>
    </div>
  </div>`;
}

// ─── Modo condução (leitura para o púlpito + impressão semanal) ──────────
function Leitura({ perfil, agenda, membros, onVoltar }) {
  const [itens, setItens] = useState(null);
  useEffect(() => {
    sb.from('agenda_itens').select('*').eq('agenda_id', agenda.id).order('ordem')
      .then(({ data }) => setItens(data || []));
  }, [agenda.id]);
  if (!itens) return html`<${Spinner}/>`;
  const nomeDe = i => i.membro_id ? (membros.find(m => m.id === i.membro_id)?.nome || i.nome_livre) : i.nome_livre;

  return html`
  <div>
    <div class="no-print" style=${{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
      <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${onVoltar}><${IcVoltar} size=${14} /> Editar</button>
      <button class="btn btn-p" style=${{ fontSize: 12 }} onClick=${() => window.print()}><${IcImprimir} size=${14} /> Imprimir</button>
    </div>
    <div class="folha-leitura">
      <div style=${{ textAlign: 'center', marginBottom: 26 }}>
        <div class="serif" style=${{ fontSize: 13, fontWeight: 700, color: 'var(--dourado)', textTransform: 'uppercase', letterSpacing: 2.5 }}>Reunião Sacramental</div>
        <div class="serif" style=${{ fontSize: 26, fontWeight: 700, marginTop: 4, color: 'var(--azul)' }}>${perfil.alas?.nome || ''}</div>
        <div style=${{ fontSize: 14, color: 'var(--tinta2)', marginTop: 4 }}>${fmtBR(agenda.data)}</div>
      </div>
      ${Object.entries(SECOES).map(([sec, nomeSec]) => {
        const daSecao = itens.filter(i => i.secao === sec)
          .filter(i => ehPessoa(i.tipo) ? nomeDe(i) : i.conteudo.trim());
        if (daSecao.length === 0) return null;
        return html`
        <div key=${sec} style=${{ marginBottom: 22 }}>
          <div class="serif secao-titulo" style=${{ fontSize: 13, fontWeight: 700, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>${nomeSec}</div>
          ${daSecao.map((i, idx) => html`
            <div key=${i.id} class="item-leitura" style=${idx % 2 === 1 ? { background: 'var(--papel)' } : {}}>
              <div class="rotulo-leitura">${i.rotulo}</div>
              <div class="conteudo-leitura">${ehPessoa(i.tipo) ? nomeDe(i) : i.conteudo}</div>
            </div>`)}
        </div>`;
      })}
    </div>
  </div>`;
}

// ─── Módulo principal ────────────────────────────────────────────────────
export function Agenda({ perfil, show, readOnly }) {
  const [aba, setAba] = useState('agendas');
  const [agendas, setAgendas] = useState(null);
  const [membros, setMembros] = useState([]);
  const [atual, setAtual] = useState(null);     // agenda aberta
  const [modo, setModo] = useState('editor');   // editor | leitura
  const [criando, setCriando] = useState(false);
  const [novaData, setNovaData] = useState(toISO(nextSunday()));

  const carregar = async () => {
    const [{ data: a }, { data: m }] = await Promise.all([
      sb.from('agendas').select('*').eq('ala_id', perfil.ala_id).order('data', { ascending: false }),
      sb.from('membros').select('id, nome, sexo, is_membro, ativo').eq('ala_id', perfil.ala_id).eq('ativo', true).order('nome'),
    ]);
    setAgendas(a || []); setMembros(m || []);
  };
  useEffect(() => { carregar(); }, [perfil.ala_id]);

  const criarAgenda = async () => {
    const { data: ag, error } = await sb.from('agendas')
      .insert({ ala_id: perfil.ala_id, data: novaData }).select().single();
    if (error) return show(error.code === '23505' ? 'Já existe agenda para essa data.' : error.message, false);
    const { error: e2 } = await sb.from('agenda_itens').insert(MODELO.map(([secao, rotulo, tipo], i) => ({
      agenda_id: ag.id, ala_id: perfil.ala_id, secao, rotulo, tipo, ordem: (i + 1) * 10, padrao: true,
    })));
    if (e2) return show(e2.message, false);
    show('Agenda criada com o modelo padrão.');
    setCriando(false); await carregar(); setAtual(ag); setModo('editor');
  };

  const excluirAgenda = async ag => {
    if (!confirm(`Excluir a agenda de ${fmtBR(ag.data)}? Os itens dela saem dos relatórios.`)) return;
    await sb.from('agendas').delete().eq('id', ag.id);
    carregar();
  };

  if (!agendas) return html`<${Spinner}/>`;

  if (atual) {
    // Quem só pode visualizar nunca edita a agenda — vai direto para a leitura.
    return (modo === 'leitura' || readOnly)
      ? html`<${Leitura} perfil=${perfil} agenda=${atual} membros=${membros} onVoltar=${() => { setAtual(null); carregar(); }} />`
      : html`<${Editor} perfil=${perfil} show=${show} agenda=${atual} membros=${membros}
          onVoltar=${() => { setAtual(null); carregar(); }} onLeitura=${() => setModo('leitura')} />`;
  }

  return html`
    <div class="hdr">Agenda Sacramental</div>
    <div class="sub">Programa da reunião, discursantes e relatórios</div>
    <div class="seg" style=${{ marginBottom: 12 }}>
      <button class=${aba === 'agendas' ? 'on' : ''} onClick=${() => setAba('agendas')}>Agendas</button>
      <button class=${aba === 'relatorios' ? 'on' : ''} onClick=${() => setAba('relatorios')}>Relatórios</button>
      <button class=${aba === 'planilha' ? 'on' : ''} onClick=${() => setAba('planilha')}>Planilha</button>
    </div>

    ${aba === 'agendas' && html`
      ${!readOnly && (criando ? html`
        <div class="card" style=${{ padding: 14 }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Data da reunião</label>
          <input class="inp" type="date" value=${novaData} onInput=${e => setNovaData(e.target.value)} />
          <div style=${{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button class="btn btn-s" style=${{ flex: 1 }} onClick=${() => setCriando(false)}>Cancelar</button>
            <button class="btn btn-p" style=${{ flex: 1 }} onClick=${criarAgenda}>Criar com modelo padrão</button>
          </div>
        </div>` : html`
        <button class="btn btn-p" style=${{ width: '100%', marginBottom: 12 }} onClick=${() => setCriando(true)}><${IcMais} size=${14} /> Nova agenda</button>`)}
      ${agendas.length === 0 && html`<${Empty} msg="Nenhuma agenda ainda. Crie a primeira — ela já vem com o modelo da ala." />`}
      ${agendas.map(ag => html`
        <div key=${ag.id} class="card" style=${{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style=${{ cursor: 'pointer', flex: 1 }} onClick=${() => { setAtual(ag); setModo('editor'); }}>
            <div style=${{ fontWeight: 700, fontSize: 14 }}>Domingo ${fmtBR(ag.data)}</div>
            <div style=${{ fontSize: 11, color: 'var(--tinta3)' }}>${ag.frequencia ? `Frequência: ${ag.frequencia}` : 'Frequência não informada'}</div>
          </div>
          <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => { setAtual(ag); setModo('leitura'); }}><${IcOlho} size=${14} /> Ver</button>
          ${!readOnly && html`<button style=${{ color: 'var(--vermelho)', fontSize: 15, padding: 4 }} onClick=${() => excluirAgenda(ag)}><${IcFechar} size=${15} /></button>`}
        </div>`)}`}

    ${aba === 'relatorios' && html`<${Relatorios} perfil=${perfil} membros=${membros} />`}
    ${aba === 'planilha' && html`<${Planilha} perfil=${perfil} show=${show} membros=${membros} onImport=${carregar} readOnly=${readOnly} />`}`;
}
