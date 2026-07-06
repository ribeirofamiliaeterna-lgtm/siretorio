import { html, render, useState, useEffect, sb, Spinner, useToast } from './core.js';
import { Login } from './login.js';
import { Dashboard } from './dashboard.js';
import { Rodizio } from './rodizio.js';
import { Diretorio } from './diretorio.js';
import { Qualificacao } from './qualificacao.js';
import { Transmissao } from './transmissao.js';
import { Master } from './master.js';

const ROTAS = [
  { id: 'dashboard',    ic: '📊', l: 'Painel',      c: Dashboard },
  { id: 'rodizio',      ic: '🗓️', l: 'Rodízio',     c: Rodizio },
  { id: 'diretorio',    ic: '📖', l: 'Diretório',   c: Diretorio },
  { id: 'qualificacao', ic: '🏠', l: 'Qualificação', c: Qualificacao },
  { id: 'transmissao',  ic: '📺', l: 'Transmissão', c: Transmissao },
];

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(2) || 'dashboard');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(2) || 'dashboard');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function TrocarSenha({ onClose, show }) {
  const [s1, setS1] = useState(''); const [s2, setS2] = useState(''); const [busy, setBusy] = useState(false);
  const salvar = async () => {
    if (s1.length < 8) return show('A senha precisa de pelo menos 8 caracteres.', false);
    if (s1 !== s2) return show('As senhas não conferem.', false);
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: s1 });
    setBusy(false);
    if (error) return show(error.message, false);
    show('Senha alterada com sucesso ✅'); onClose();
  };
  return html`
    <div class="modal-bg" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div style=${{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Alterar senha</div>
        <label class="lbl">Nova senha</label>
        <input class="inp" type="password" value=${s1} onInput=${e => setS1(e.target.value)} />
        <label class="lbl">Repetir nova senha</label>
        <input class="inp" type="password" value=${s2} onInput=${e => setS2(e.target.value)} />
        <div style=${{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
          <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Salvar</button>
        </div>
      </div>
    </div>`;
}

function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState('');
  const [menuSenha, setMenuSenha] = useState(false);
  const [toastEl, show] = useToast();
  const rota = useHash();

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('profiles')
        .select('id, nome, email, papel, ala_id, alas(id, nome, slug)')
        .eq('id', session.user.id).single();
      if (error) return setErro(error.message);
      if (!data.ala_id && data.papel !== 'master') return setErro('Seu usuário ainda não está vinculado a uma ala. Fale com o administrador.');
      setPerfil(data);
    })();
  }, [session.user.id]);

  if (erro) return html`
    <div class="page"><div class="card" style=${{ padding: 20, color: '#991B1B' }}>
      ⚠️ ${erro}
      <div style=${{ marginTop: 12 }}><button class="btn btn-s" onClick=${() => sb.auth.signOut()}>Sair</button></div>
    </div></div>`;
  if (!perfil) return html`<${Spinner}/>`;

  const rotas = perfil.papel === 'master'
    ? [...ROTAS, { id: 'master', ic: '🌐', l: 'Alas', c: Master }]
    : ROTAS;
  const atual = rotas.find(r => r.id === rota) || rotas[0];

  return html`
    ${toastEl}
    <nav class="nav">
      ${rotas.map(r => html`
        <button key=${r.id} class=${atual.id === r.id ? 'on' : ''} onClick=${() => { location.hash = `#/${r.id}`; }}>
          <span class="ic">${r.ic}</span><span>${r.l}</span>
        </button>`)}
    </nav>
    <main class="page">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style=${{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            ${perfil.alas?.nome || 'Painel geral'}${perfil.papel === 'master' ? ' · Master' : ''}
          </div>
        </div>
        <div style=${{ display: 'flex', gap: 6 }}>
          <button class="btn btn-s" style=${{ padding: '6px 10px', fontSize: 12 }} onClick=${() => setMenuSenha(true)}>🔑 Senha</button>
          <button class="btn btn-s" style=${{ padding: '6px 10px', fontSize: 12 }} onClick=${() => sb.auth.signOut()}>Sair</button>
        </div>
      </div>
      <${atual.c} perfil=${perfil} show=${show} />
    </main>
    ${menuSenha && html`<${TrocarSenha} onClose=${() => setMenuSenha(false)} show=${show} />`}`;
}

function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return html`<${Spinner}/>`;
  return session ? html`<${Shell} session=${session} />` : html`<${Login}/>`;
}

render(html`<${App}/>`, document.getElementById('app'));
