// Núcleo compartilhado: cliente Supabase, utilitários e componentes básicos.
import { h, render } from 'https://esm.sh/preact@10';
import { useState, useEffect, useMemo, useCallback, useRef } from 'https://esm.sh/preact@10/hooks';
import { html } from 'https://esm.sh/htm@3/preact';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

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
  pendente:  { l: 'Pendente',            i: '🕐', bg: '#FEF3C7', t: '#92400E', b: '#F59E0B' },
  residente: { l: 'Reside no endereço',  i: '✅', bg: '#D1FAE5', t: '#065F46', b: '#059669' },
  saiu:      { l: 'Não reside na área',  i: '🚫', bg: '#FEE2E2', t: '#991B1B', b: '#DC2626' },
};

// ─── Componentes básicos ─────────────────────────────────────────────────
export const Spinner = () => html`<div style=${{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>Carregando…</div>`;

export const Chip = ({ bg, t, b, children }) => html`
  <span class="chip" style=${{ background: bg, color: t, border: `1px solid ${b || t}` }}>${children}</span>`;

export const Modal = ({ onClose, children }) => html`
  <div class="modal-bg" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal">${children}</div>
  </div>`;

export const Empty = ({ msg }) => html`
  <div style=${{ textAlign: 'center', padding: '38px 20px', color: '#94A3B8', fontSize: 13 }}>${msg}</div>`;

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }, []);
  const el = toast && html`
    <div style=${{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      background: toast.ok ? '#065F46' : '#991B1B', color: '#FFF', padding: '10px 18px',
      borderRadius: 99, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,.25)', maxWidth: '92vw' }}>
      ${toast.msg}
    </div>`;
  return [el, show];
}

// Carrega dados de várias tabelas em paralelo; retorna {data, err}
export async function loadAll(queries) {
  const results = await Promise.all(queries.map(q => q));
  const err = results.find(r => r.error);
  if (err) return { data: null, err: err.error.message };
  return { data: results.map(r => r.data), err: null };
}
