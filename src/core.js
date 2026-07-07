// Núcleo compartilhado: cliente Supabase, utilitários e componentes básicos.
import { h, render } from 'https://esm.sh/preact@10';
import { useState, useEffect, useMemo, useCallback, useRef } from 'https://esm.sh/preact@10/hooks';
import { createPortal } from 'https://esm.sh/preact@10/compat';
import { html } from 'https://esm.sh/htm@3/preact';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { IcInfo } from './icons.js';

export { h, render, html, useState, useEffect, useMemo, useCallback, useRef };
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Datas ───────────────────────────────────────────────────────────────
export const toISO = d => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtBR = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
export const lastSunday = (base = new Date()) => {
  const d = new Date(base); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
  return d;
};
export const nextSunday = (base = new Date()) => {
  const d = new Date(base); d.setHours(0, 0, 0, 0);
  if (d.getDay() !== 0) d.setDate(d.getDate() + (7 - d.getDay()));
  return d;
};
export const listSundays = (n, from = lastSunday()) => {
  const out = [];
  for (let i = 0; i < n; i++) { const d = new Date(from); d.setDate(d.getDate() - 7 * i); out.push(toISO(d)); }
  return out;
};
export const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d); };

// ─── Texto / busca ───────────────────────────────────────────────────────
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const phone = t => {
  if (!t) return '';
  const d = t.replace(/\D/g, '');
  if (d.length <= 9) return `5561${d}`;
  if (d.length <= 11) return `55${d}`;
  return `55${d}`.slice(0, 13);
};

// ─── Constantes de domínio ───────────────────────────────────────────────
export const STATUS_QUAL = {
  pendente:  { l: 'Pendente',           bg: 'var(--ambar-claro)',    t: 'var(--ambar)',    b: '#E3D3AC' },
  residente: { l: 'Reside no endereço', bg: 'var(--verde-claro)',    t: 'var(--verde)',    b: '#CDE2D6' },
  saiu:      { l: 'Não reside na área', bg: 'var(--vermelho-claro)', t: 'var(--vermelho)', b: '#E9CFCB' },
};
export const SITUACAO_MEMBRO = {
  diretorio:      null,
  fora_diretorio: { l: 'Fora do diretório',      bg: 'var(--vermelho-claro)', t: 'var(--vermelho)' },
  manual:         { l: 'Adicionado manualmente', bg: 'var(--dourado-claro)',  t: 'var(--dourado)' },
};

// ─── Componentes básicos ─────────────────────────────────────────────────
export const Spinner = () => html`<div style=${{ textAlign: 'center', padding: 40, color: 'var(--tinta3)', fontSize: 13 }}>Carregando…</div>`;

export const Chip = ({ bg, t, b, children, style = {} }) => html`
  <span class="chip" style=${{ background: bg, color: t, borderColor: b || 'transparent', ...style }}>${children}</span>`;

export const Modal = ({ onClose, children }) => html`
  <div class="modal-bg" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal">${children}</div>
  </div>`;

export const Empty = ({ msg }) => html`
  <div style=${{ textAlign: 'center', padding: '36px 20px', color: 'var(--tinta3)', fontSize: 13 }}>${msg}</div>`;

// ─── Aviso institucional ─────────────────────────────────────────────────
export const AVISO_NAO_OFICIAL = 'Este sistema não é um aplicativo oficial de A Igreja de Jesus Cristo dos Santos dos Últimos Dias. É uma ferramenta independente, mantida pela liderança local e desenvolvida seguindo estritamente as diretrizes estabelecidas pela Igreja.';

export const Rodape = () => html`
  <div style=${{ textAlign: 'center', fontSize: 10.5, color: 'var(--tinta3)', lineHeight: 1.6, padding: '18px 24px 14px', maxWidth: 480, margin: '0 auto' }}>
    ${AVISO_NAO_OFICIAL}
  </div>`;

// Selo "i" com explicação do cálculo (hover no computador, toque no celular).
// O texto é renderizado num portal para <body>: assim ele nunca fica
// escondido atrás de outro card/modal por causa do overflow:hidden do
// ancestral — sempre aparece na camada mais alta da tela.
export function InfoTip({ texto }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const mostrar = () => {
    const r = ref.current.getBoundingClientRect();
    setPos({ bottom: window.innerHeight - r.top + 8, left: r.left + r.width / 2 });
  };
  const esconder = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    addEventListener('scroll', esconder, true);
    addEventListener('resize', esconder);
    return () => { removeEventListener('scroll', esconder, true); removeEventListener('resize', esconder); };
  }, [pos]);

  return html`
    <span ref=${ref} class=${`infotip${pos ? ' aberto' : ''}`} tabindex="0"
      onClick=${e => { e.stopPropagation(); pos ? esconder() : mostrar(); }}
      onMouseEnter=${mostrar} onMouseLeave=${esconder}
      onFocus=${mostrar} onBlur=${esconder}>
      <${IcInfo} size=${14} />
      ${pos && createPortal(html`
        <div class="infotip-pop" style=${{ bottom: `${pos.bottom}px`, left: `${pos.left}px` }}>${texto}</div>`,
        document.body)}
    </span>`;
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);
  const el = toast && html`
    <div style=${{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      background: toast.ok ? 'var(--verde)' : 'var(--vermelho)', color: '#FFF', padding: '10px 18px',
      borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.25)', maxWidth: '92vw' }}>
      ${toast.msg}
    </div>`;
  return [el, show];
}

// ─── Alertas de frequência ───────────────────────────────────────────────
// Regra: membro ATIVO (ao menos uma presença nos 3 meses anteriores) que
// faltou em dois domingos seguidos gera um alerta. Alertas dispensados não
// voltam (chave única ala+membro+referência).
export async function sincronizarAlertas(alaId) {
  const { data: pres } = await sb.from('presencas')
    .select('membro_id, presente, reunioes!inner(data, tipo)')
    .eq('ala_id', alaId).eq('reunioes.tipo', 'sacramental').limit(30000);
  if (!pres || pres.length === 0) return;

  const porData = new Map();                       // data → Map(membro → presente)
  pres.forEach(p => {
    const d = p.reunioes.data;
    if (!porData.has(d)) porData.set(d, new Map());
    porData.get(d).set(p.membro_id, p.presente);
  });
  const datas = [...porData.keys()].sort();
  const novos = [];
  // Só os pares mais recentes interessam (evita reabrir história antiga)
  for (let i = Math.max(1, datas.length - 4); i < datas.length; i++) {
    const d0 = datas[i - 1], d1 = datas[i];
    if ((fromISO(d1) - fromISO(d0)) !== 7 * 864e5) continue;   // precisa ser domingo seguido
    const corte = toISO(new Date(fromISO(d1) - 91 * 864e5));
    porData.get(d1).forEach((pres1, membroId) => {
      if (pres1 !== false || porData.get(d0).get(membroId) !== false) return;
      const ativo = datas.some(d => d >= corte && d < d0 && porData.get(d).get(membroId) === true);
      if (ativo) novos.push({ ala_id: alaId, membro_id: membroId, tipo: 'faltas_consecutivas', referencia: d1 });
    });
  }
  if (novos.length) await sb.from('alertas')
    .upsert(novos, { onConflict: 'ala_id,membro_id,tipo,referencia', ignoreDuplicates: true });
}

// ─── Alertas de registro sistêmico (apoios e desobrigações) ──────────────
// Regra: quando um Apoio ou uma Desobrigação é lançado na agenda, gera-se um
// alerta lembrando de repassar ao registro sistêmico oficial da Igreja — mas
// só a partir de domingo ao meio-dia (dá tempo de o lançamento ser feito
// antes do aviso aparecer).
const HORA_LIMITE_REGISTRO = 12;
export async function sincronizarAlertasRegistro(alaId) {
  const { data: itens } = await sb.from('agenda_itens')
    .select('id, rotulo, conteudo, membro_id, nome_livre, agendas!inner(data), membros(nome)')
    .eq('ala_id', alaId).in('rotulo', ['Apoios', 'Desobrigações']);
  if (!itens || itens.length === 0) return;

  const agora = new Date();
  const prontos = itens.filter(i => {
    const pessoa = i.membros?.nome || i.nome_livre;
    if (!pessoa?.trim() && !i.conteudo?.trim()) return false;
    const limite = fromISO(i.agendas.data); limite.setHours(HORA_LIMITE_REGISTRO, 0, 0, 0);
    return agora >= limite;
  });
  if (prontos.length === 0) return;

  await sb.from('alertas_registro').upsert(
    prontos.map(i => {
      const pessoa = i.membros?.nome || i.nome_livre;
      const chamado = i.conteudo?.trim();
      const descricao = [pessoa, chamado].filter(Boolean).join(' — ');
      return {
        ala_id: alaId, agenda_item_id: i.id, tipo: 'apoio_desobrigacao',
        descricao: `${i.rotulo}: ${descricao}`, data: i.agendas.data,
      };
    }),
    { onConflict: 'agenda_item_id' });
}

// ─── Exportações (Excel via SheetJS oficial; PDF via impressão) ──────────
export const carregarXLSX = async () => {
  const m = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
  return m.default?.utils ? m.default : m;
};

export async function exportarExcel(nomeArquivo, abas) {
  // abas: [{ nome, linhas: [[...cabeçalho], [...]] }]
  const X = await carregarXLSX();
  const wb = X.utils.book_new();
  abas.forEach(a => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(a.linhas), a.nome.slice(0, 31)));
  X.writeFile(wb, nomeArquivo);
}

// Abre uma janela de impressão com relatório formatado (o usuário salva em PDF)
export function exportarPDF(titulo, subtitulo, html_) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    body{font-family:'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:#23282E;margin:36px;font-size:13px}
    h1{font-size:21px;color:#16436B;margin-bottom:2px}
    .sub{font-size:12px;color:#5A6068;margin-bottom:20px;font-family:-apple-system,'Segoe UI',sans-serif}
    table{width:100%;border-collapse:collapse;font-family:-apple-system,'Segoe UI',sans-serif;font-size:11.5px}
    th{text-align:left;padding:7px 8px;border-bottom:2px solid #16436B;color:#16436B;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px}
    td{padding:6px 8px;border-bottom:1px solid #E5E2DB;vertical-align:top}
    tr:nth-child(even) td{background:#FAF9F6}
    .rodape{margin-top:24px;font-size:10px;color:#8A9099;font-family:-apple-system,'Segoe UI',sans-serif;border-top:1px solid #E5E2DB;padding-top:8px}
    @page{margin:18mm}
  </style></head><body>
  <h1>${titulo}</h1><div class="sub">${subtitulo}</div>${html_}
  <div class="rodape">Gerado pelo Painel de Gestão em ${new Date().toLocaleDateString('pt-BR')} — uso interno da ala.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</` + `script></body></html>`);
  w.document.close();
}

export const tabelaHTML = (cab, linhas) =>
  `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
  linhas.map(l => `<tr>${l.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
