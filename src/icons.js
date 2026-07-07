// Ícones em SVG inline (traço 1.5, herdam a cor do texto via currentColor).
import { html } from 'https://esm.sh/htm@3/preact';

const I = (paths, vb = '0 0 24 24') => ({ size = 18, style = {} }) => html`
  <svg width=${size} height=${size} viewBox=${vb} fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    style=${{ flexShrink: 0, verticalAlign: '-3px', ...style }}
    dangerouslySetInnerHTML=${{ __html: paths }}></svg>`;

export const IcPainel = I('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>');
export const IcAgenda = I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>');
export const IcFrequencia = I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/><path d="M9 15l2 2 4-4"/>');
export const IcDiretorio = I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>');
export const IcCasa = I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>');
export const IcTv = I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/>');
export const IcGlobo = I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/>');
export const IcChave = I('<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M17 4l3 3M14 7l2 2"/>');
export const IcSair = I('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>');
export const IcBusca = I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>');
export const IcLupa = I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><path d="M8.5 11h5M11 8.5v5"/>');
export const IcMais = I('<path d="M12 5v14M5 12h14"/>');
export const IcFechar = I('<path d="M6 6l12 12M18 6L6 18"/>');
export const IcCheck = I('<path d="M4 12.5l5 5L20 6.5"/>');
export const IcInfo = I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/>');
export const IcAlerta = I('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>');
export const IcSino = I('<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>');
export const IcSaude = I('<path d="M12 20.5s-8-4.7-8-11A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20 9.5c0 6.3-8 11-8 11z"/><path d="M6 12h3l1.5-3 2.5 5 1.5-2.5H18"/>');
export const IcImprimir = I('<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="9" rx="1.5"/><path d="M7 14h10v7H7z" fill="#fff"/>');
export const IcBaixar = I('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>');
export const IcSubir = I('<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 4h16"/>');
export const IcTelefone = I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>');
export const IcWhats = I('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M9 8.5c0 4 2.5 6.5 6.5 6.5l.5-2-2-1-1 1c-1.2-.6-2-1.4-2.5-2.5l1-1-1-2-1.5.5z" stroke-width="1.2"/>');
export const IcPessoa = I('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>');
export const IcPessoas = I('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M17.5 14a6.5 6.5 0 0 1 4 6"/>');
export const IcEditar = I('<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>');
export const IcSeta = I('<path d="M9 6l6 6-6 6"/>');
export const IcVoltar = I('<path d="M15 6l-6 6 6 6"/>');
export const IcCima = I('<path d="M6 15l6-6 6 6"/>');
export const IcBaixo = I('<path d="M6 9l6 6 6-6"/>');
export const IcLivro = I('<path d="M12 6.5C10.5 5 8.5 4.5 6 4.5c-1.2 0-2.3.2-3 .4V19c.7-.2 1.8-.4 3-.4 2.5 0 4.5.5 6 1.9 1.5-1.4 3.5-1.9 6-1.9 1.2 0 2.3.2 3 .4V4.9c-.7-.2-1.8-.4-3-.4-2.5 0-4.5.5-6 2z"/><path d="M12 6.5v14"/>');
export const IcMicrofone = I('<rect x="9.5" y="3" width="5" height="11" rx="2.5"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>');
export const IcCalendario = I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/>');
export const IcFiltro = I('<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>');
export const IcPlanilha = I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 9v12"/>');
export const IcRelogio = I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>');
export const IcLink = I('<path d="M10 13.5a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.6-5.6l-1.7 1.7"/><path d="M14 10.5a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.6 5.6l1.7-1.7"/>');
export const IcOlho = I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>');
