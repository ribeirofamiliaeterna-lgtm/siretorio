// Cria um usuário de acesso para uma ala.
// Uso: node scripts/create-user.mjs email@exemplo.com "Nome" ala-slug [papel] [senha]
//   papel: "ala" (padrão) ou "master"
//   senha: se omitida, gera uma aleatória e imprime no final
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const [email, nome, alaSlug, papel = 'ala', senhaArg] = process.argv.slice(2);
if (!email || !nome || !alaSlug) {
  console.log('Uso: node scripts/create-user.mjs email "Nome Completo" ala-slug [ala|master] [senha]');
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8')
  .split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const senha = senhaArg || `Ala${randomBytes(4).toString('hex')}!`;
const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email, password: senha, email_confirm: true,
    user_metadata: { nome, papel, ala_slug: alaSlug },
  }),
});
const data = await res.json();
if (!res.ok) { console.error('Erro:', data.msg || JSON.stringify(data)); process.exit(1); }
console.log(`✅ Usuário criado: ${email} (papel: ${papel}, ala: ${alaSlug})`);
console.log(`   Senha: ${senha}`);
console.log('   Peça para a pessoa trocar a senha no primeiro acesso (botão 🔑 Senha).');
