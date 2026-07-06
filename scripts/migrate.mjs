// Migração dos dados do sistema antigo (Ala AC1) para o esquema v2.
// Uso: node scripts/migrate.mjs
// Requer .env na raiz com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP = resolve(root, 'backup/2026-07-06');

async function api(path, opts = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// 1. Ala de destino
const [ala] = await api('alas?slug=eq.aguas-claras-1&select=id,nome');
if (!ala) throw new Error('Ala aguas-claras-1 não encontrada — rode sql/schema.sql primeiro.');
console.log(`Ala de destino: ${ala.nome} (${ala.id})`);

// 2. Idempotência: não duplicar
const existentes = await api(`familias?ala_id=eq.${ala.id}&select=id&limit=1`);
if (existentes.length > 0) {
  console.log('⚠️  Já existem famílias nesta ala — migração abortada para não duplicar.');
  process.exit(1);
}

// 3. Famílias
const diretorio = JSON.parse(readFileSync(resolve(BACKUP, 'diretorio_familias.json'), 'utf8'));
const familias = await api('familias', {
  method: 'POST',
  body: JSON.stringify(diretorio.map(f => ({
    ala_id: ala.id, sobrenome: f.sobrenome, chefe: f.chefe,
    telefone: f.telefone || '', endereco: f.endereco || '',
    setor: f.setor || '', legacy_id: f.legacy_id,
  }))),
});
console.log(`✅ ${familias.length} famílias migradas`);
const porLegacy = new Map(familias.map(f => [f.legacy_id, f.id]));

// 4. Membros
const membros = diretorio.flatMap(f => f.membros.map(m => ({
  ala_id: ala.id, familia_id: porLegacy.get(f.legacy_id),
  nome: m.nome, sexo: m.sexo || '', idade: m.idade ?? null, is_membro: true,
})));
const insMembros = await api('membros', { method: 'POST', body: JSON.stringify(membros) });
console.log(`✅ ${insMembros.length} membros migrados`);

// 5. Qualificação (inclui as famílias que saíram da ala — dado crítico)
const status = JSON.parse(readFileSync(resolve(BACKUP, 'ala_ac1_status_supabase.json'), 'utf8'));
const qual = status.filter(r => porLegacy.has(r.id)).map(r => ({
  familia_id: porLegacy.get(r.id), ala_id: ala.id,
  status: r.status, nota: r.nota || '', atualizado_em: r.atualizado_em,
}));
const insQual = await api('qualificacao', { method: 'POST', body: JSON.stringify(qual) });
const saiu = insQual.filter(q => q.status === 'saiu').length;
console.log(`✅ ${insQual.length} registros de qualificação migrados (${saiu} famílias que saíram da ala)`);
console.log('🎉 Migração concluída.');
