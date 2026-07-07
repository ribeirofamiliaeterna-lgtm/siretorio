import { html, useState, sb, Rodape } from './core.js';

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
  <div style=${{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <div style=${{ background: 'linear-gradient(160deg, #1C5380 0%, #16436B 46%, #0E2E4C 100%)', color: '#FFF',
      padding: '52px 24px 44px', textAlign: 'center' }}>
      <div class="serif" style=${{ fontSize: 30, fontWeight: 700, letterSpacing: .5 }}>Painel de Gestão</div>
      <div style=${{ fontSize: 13.5, color: '#B9C8D6', marginTop: 6 }}>Diretório, frequência e agenda da ala</div>
    </div>
    <div style=${{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px' }}>
      <form onSubmit=${entrar} style=${{ width: '100%', maxWidth: 400 }}>
        <div class="card" style=${{ padding: 24 }}>
          <div class="serif" style=${{ fontSize: 18, fontWeight: 700, color: 'var(--azul)', marginBottom: 4 }}>Acesso da liderança</div>
          <div style=${{ fontSize: 12.5, color: 'var(--tinta2)', marginBottom: 8 }}>Cada ala visualiza somente os próprios dados.</div>
          <label class="lbl">E-mail</label>
          <input class="inp" type="email" autocomplete="username" value=${email}
            onInput=${e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          <label class="lbl">Senha</label>
          <input class="inp" type="password" autocomplete="current-password" value=${senha}
            onInput=${e => setSenha(e.target.value)} placeholder="Sua senha" required />
          ${err && html`<div style=${{ marginTop: 12, fontSize: 12.5, color: 'var(--vermelho)', background: 'var(--vermelho-claro)', padding: '9px 12px', borderRadius: 8 }}>${err}</div>`}
          <button class="btn btn-p" type="submit" disabled=${busy}
            style=${{ width: '100%', marginTop: 18, opacity: busy ? .6 : 1, padding: 12 }}>
            ${busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
        <div class="serif" style=${{ textAlign: 'center', fontSize: 13.5, fontStyle: 'italic', color: 'var(--tinta2)', marginTop: 22, lineHeight: 1.6 }}>
          "Apascenta as minhas ovelhas."
          <div style=${{ fontSize: 11, fontStyle: 'normal', color: 'var(--tinta3)', marginTop: 3 }}>João 21:17</div>
        </div>
      </form>
    </div>
    <${Rodape}/>
  </div>`;
}
