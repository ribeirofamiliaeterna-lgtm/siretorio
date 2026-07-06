import { html, useState, sb } from './core.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const entrar = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  };

  return html`
  <div style=${{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <form onSubmit=${entrar} style=${{ width: '100%', maxWidth: 380 }}>
      <div style=${{ textAlign: 'center', marginBottom: 26 }}>
        <div style=${{ fontSize: 44 }}>⛪️</div>
        <div style=${{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>Siretório</div>
        <div style=${{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Gestão de diretório e frequência da ala</div>
      </div>
      <div class="card" style=${{ padding: 20 }}>
        <label class="lbl">E-mail</label>
        <input class="inp" type="email" autocomplete="username" value=${email}
          onInput=${e => setEmail(e.target.value)} placeholder="seu@email.com" required />
        <label class="lbl">Senha</label>
        <input class="inp" type="password" autocomplete="current-password" value=${senha}
          onInput=${e => setSenha(e.target.value)} placeholder="••••••••" required />
        ${err && html`<div style=${{ marginTop: 10, fontSize: 12, color: '#991B1B', background: '#FEE2E2', padding: '8px 10px', borderRadius: 8 }}>${err}</div>`}
        <button class="btn btn-p" type="submit" disabled=${busy}
          style=${{ width: '100%', marginTop: 16, opacity: busy ? .6 : 1 }}>
          ${busy ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
      <div style=${{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 14 }}>
        Acesso restrito. Cada ala visualiza apenas os próprios dados.
      </div>
    </form>
  </div>`;
}
