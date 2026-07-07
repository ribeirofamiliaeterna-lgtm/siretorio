import { html, useState, useEffect, useMemo, sb, norm, toISO, fmtBR, Spinner, Empty, Chip, InfoTip, exportarExcel, exportarPDF, tabelaHTML, SITUACAO_MEMBRO } from './core.js';
import { IcBaixar, IcImprimir } from './icons.js';

const diasAtrasISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d); };

// Relatório da frequência sacramental com filtro completo:
// membro, período, domingo, justificativa, presentes/ausentes, origem.
export function RelatoriosFrequencia({ perfil, membros, motivos, fams, show }) {
  const [linhas, setLinhas] = useState(null);
  const [fMembro, setFMembro] = useState('');
  const [fDe, setFDe] = useState(diasAtrasISO(120));
  const [fAte, setFAte] = useState(toISO(new Date()));
  const [fSituacao, setFSituacao] = useState('todos');   // todos | presentes | ausentes
  const [fOrigem, setFOrigem] = useState('todas');       // todas | manual | transmissao
  const [fMotivo, setFMotivo] = useState('');            // '' | 'sem' | uuid

  useEffect(() => {
    sb.from('presencas')
      .select('membro_id, presente, origem, motivo_falta_id, reunioes!inner(data, tipo)')
      .eq('ala_id', perfil.ala_id).eq('reunioes.tipo', 'sacramental').limit(30000)
      .then(({ data }) => setLinhas(data || []));
  }, [perfil.ala_id]);

  const nomeMembro = useMemo(() => new Map(membros.map(m => [m.id, m])), [membros]);
  const nomeMotivo = useMemo(() => new Map(motivos.map(m => [m.id, m.nome])), [motivos]);
  const famDe = useMemo(() => {
    const fmap = new Map(fams.map(f => [f.id, f.sobrenome]));
    return m => fmap.get(m?.familia_id) || '—';
  }, [fams]);

  const filtradas = useMemo(() => {
    if (!linhas) return [];
    const q = norm(fMembro);
    return linhas.filter(p => {
      const d = p.reunioes.data;
      if (fDe && d < fDe) return false;
      if (fAte && d > fAte) return false;
      if (fSituacao === 'presentes' && !p.presente) return false;
      if (fSituacao === 'ausentes' && p.presente) return false;
      if (fOrigem !== 'todas' && p.origem !== fOrigem) return false;
      if (fMotivo === 'sem' && (p.presente || p.motivo_falta_id)) return false;
      if (fMotivo && fMotivo !== 'sem' && p.motivo_falta_id !== fMotivo) return false;
      if (q && !norm(nomeMembro.get(p.membro_id)?.nome || '').includes(q)) return false;
      return true;
    }).sort((a, b) => b.reunioes.data.localeCompare(a.reunioes.data)
      || (nomeMembro.get(a.membro_id)?.nome || '').localeCompare(nomeMembro.get(b.membro_id)?.nome || ''));
  }, [linhas, fMembro, fDe, fAte, fSituacao, fOrigem, fMotivo, nomeMembro]);

  const resumo = useMemo(() => {
    const presentes = filtradas.filter(p => p.presente).length;
    const domingos = new Set(filtradas.map(p => p.reunioes.data)).size;
    return { presentes, faltas: filtradas.length - presentes, domingos };
  }, [filtradas]);

  const linhaExport = p => [
    fmtBR(p.reunioes.data),
    nomeMembro.get(p.membro_id)?.nome || '(removido)',
    famDe(nomeMembro.get(p.membro_id)),
    p.presente ? 'Presente' : 'Falta',
    p.presente ? (p.origem === 'transmissao' ? 'Transmissão' : 'Presencial') : '',
    !p.presente ? (nomeMotivo.get(p.motivo_falta_id) || 'Sem justificativa') : '',
  ];
  const CABECALHO = ['Domingo', 'Membro', 'Família', 'Situação', 'Modo', 'Justificativa'];

  const excel = () => exportarExcel(`frequencia-${perfil.alas?.slug || 'ala'}-${toISO(new Date())}.xlsx`,
    [{ nome: 'Frequência', linhas: [CABECALHO, ...filtradas.map(linhaExport)] }]);

  const pdf = () => exportarPDF(
    `Frequência sacramental — ${perfil.alas?.nome || ''}`,
    `Período ${fmtBR(fDe)} a ${fmtBR(fAte)} · ${resumo.presentes} presenças, ${resumo.faltas} faltas em ${resumo.domingos} domingo(s)`,
    tabelaHTML(CABECALHO, filtradas.map(linhaExport)));

  if (!linhas) return html`<${Spinner}/>`;

  return html`
    <div class="card" style=${{ padding: 14 }}>
      <div class="titulo-secao" style=${{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Histórico de presenças e faltas
        <${InfoTip} texto="Cada linha é o registro de um membro em um domingo. Combine os filtros para ver, por exemplo, todas as faltas por doença de um membro, ou quem assistiu pela transmissão em um período." />
      </div>
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <div style=${{ flex: '2 1 200px' }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Membro</label>
          <input class="inp" type="search" placeholder="Todos — digite para filtrar" value=${fMembro} onInput=${e => setFMembro(e.target.value)} />
        </div>
        <div style=${{ flex: '1 1 130px' }}>
          <label class="lbl" style=${{ marginTop: 0 }}>De</label>
          <input class="inp" type="date" value=${fDe} onInput=${e => setFDe(e.target.value)} />
        </div>
        <div style=${{ flex: '1 1 130px' }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Até</label>
          <input class="inp" type="date" value=${fAte} onInput=${e => setFAte(e.target.value)} />
        </div>
      </div>
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <div style=${{ flex: 1, minWidth: 140 }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Situação</label>
          <select class="inp" value=${fSituacao} onChange=${e => setFSituacao(e.target.value)}>
            <option value="todos">Presentes e ausentes</option>
            <option value="presentes">Somente presentes</option>
            <option value="ausentes">Somente ausentes</option>
          </select>
        </div>
        <div style=${{ flex: 1, minWidth: 140 }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Modo</label>
          <select class="inp" value=${fOrigem} onChange=${e => setFOrigem(e.target.value)}>
            <option value="todas">Presencial e transmissão</option>
            <option value="manual">Somente presencial</option>
            <option value="transmissao">Somente transmissão</option>
          </select>
        </div>
        <div style=${{ flex: 1, minWidth: 150 }}>
          <label class="lbl" style=${{ marginTop: 0 }}>Justificativa</label>
          <select class="inp" value=${fMotivo} onChange=${e => setFMotivo(e.target.value)}>
            <option value="">Todas</option>
            <option value="sem">Falta sem justificativa</option>
            ${motivos.map(m => html`<option value=${m.id}>${m.nome}</option>`)}
          </select>
        </div>
      </div>
      <div style=${{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button class="btn btn-s" style=${{ flex: 1, fontSize: 12.5 }} onClick=${excel} disabled=${filtradas.length === 0}>
          <${IcBaixar} size=${14} /> Excel
        </button>
        <button class="btn btn-s" style=${{ flex: 1, fontSize: 12.5 }} onClick=${pdf} disabled=${filtradas.length === 0}>
          <${IcImprimir} size=${14} /> PDF
        </button>
      </div>
    </div>

    <div style=${{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <div class="kpi"><div class="v">${resumo.presentes}</div><div class="l">Presenças no filtro</div></div>
      <div class="kpi"><div class="v">${resumo.faltas}</div><div class="l">Faltas no filtro</div></div>
      <div class="kpi"><div class="v">${resumo.domingos}</div><div class="l">Domingos abrangidos</div></div>
    </div>

    ${filtradas.length === 0 && html`<${Empty} msg="Nenhum registro com esses filtros." />`}
    ${filtradas.slice(0, 200).map((p, i) => {
      const m = nomeMembro.get(p.membro_id);
      const selo = SITUACAO_MEMBRO[m?.situacao];
      return html`
      <div key=${i} class="card" style=${{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style=${{ minWidth: 0 }}>
          <div style=${{ fontWeight: 600, fontSize: 13 }}>
            ${m?.nome || '(removido)'}
            ${selo && html` <${Chip} bg=${selo.bg} t=${selo.t} style=${{ fontSize: 10 }}>${selo.l}<//>`}
          </div>
          <div style=${{ fontSize: 11, color: 'var(--tinta3)' }}>Família ${famDe(m)} · ${fmtBR(p.reunioes.data)}</div>
        </div>
        <div style=${{ textAlign: 'right', flexShrink: 0 }}>
          ${p.presente
            ? html`<${Chip} bg="var(--verde-claro)" t="var(--verde)">${p.origem === 'transmissao' ? 'Transmissão' : 'Presente'}<//>`
            : html`<${Chip} bg="var(--vermelho-claro)" t="var(--vermelho)">Falta<//>`}
          ${!p.presente && html`<div style=${{ fontSize: 10.5, color: 'var(--tinta3)', marginTop: 3 }}>
            ${nomeMotivo.get(p.motivo_falta_id) || 'Sem justificativa'}</div>`}
        </div>
      </div>`;
    })}
    ${filtradas.length > 200 && html`
      <div style=${{ fontSize: 11.5, color: 'var(--tinta3)', textAlign: 'center', margin: '8px 0' }}>
        Mostrando 200 de ${filtradas.length} registros — refine o filtro ou exporte para ver tudo.
      </div>`}`;
}
