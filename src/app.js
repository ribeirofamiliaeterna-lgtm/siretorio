import { html, render, useState, useEffect, sb, Spinner, useToast } from './core.js';
import { IcPainel, IcAgenda, IcFrequencia, IcDiretorio, IcCasa, IcTv, IcGlobo, IcChave, IcSair, IcEscudo } from './icons.js';
import { Login } from './login.js';
import { Dashboard } from './dashboard.js';
import { Frequencia } from './frequencia.js';
import { Diretorio } from './diretorio.js';
import { Qualificacao } from './qualificacao.js';
import { Transmissao } from './transmissao.js';
import { Master, AdminAla } from './master.js';
import { Agenda } from './agenda.js';

const ROTAS = [
  { id: 'dashboard',    Ic: IcPainel,     l: 'Painel',       c: Dashboard },
  { id: 'agenda',       Ic: IcAgenda,     l: 'Agenda',       c: Agenda },
  { id: 'frequencia',   Ic: IcFrequencia, l: 'Frequência',   c: Frequencia },
  { id: 'diretorio',    Ic: IcDiretorio,  l: 'Diretório',    c: Diretorio },
  { id: 'qualificacao', Ic: IcCasa,       l: 'Qualificação', c: Qualificacao },
  { id: 'transmissao',  Ic: IcTv,         l: 'Transmissão',  c: Transmissao },
];

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(2) || 'dashboard');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(2) || 'dashboard');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  // rota antiga
  return hash === 'rodizio' ? 'frequencia' : hash;
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
    show('Senha alterada com sucesso.'); onClose();
  };
  return html`
    <div class="modal-bg" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div class="titulo-secao">Alterar senha</div>
        <label class="lbl">Nova senha</label>
        <input class="inp" type="password" value=${s1} onInput=${e => setS1(e.target.value)} />
        <label class="lbl">Repetir nova senha</label>
        <input class="inp" type="password" value=${s2} onInput=${e => setS2(e.target.value)} />
        <div style=${{ display: 'flex', gap: 8, marginTop: 18 }}>
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
  const [permMap, setPermMap] = useState(null);
  const [alas, setAlas] = useState([]);       // lista completa, só para o master trocar de ala
  const [verAla, setVerAla] = useState(null); // ala que o master está visualizando/editando agora
  const [toastEl, show] = useToast();
  const rota = useHash();

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('profiles')
        .select('id, nome, email, papel, ala_id, admin_ala, alas(id, nome, slug)')
        .eq('id', session.user.id).single();
      if (error) return setErro(error.message);
      if (!data.ala_id && data.papel !== 'master') return setErro('Seu usuário ainda não está vinculado a uma ala. Fale com o administrador.');
      setPerfil(data);
    })();
  }, [session.user.id]);

  useEffect(() => {
    if (!perfil) return;
    if (perfil.papel === 'master') {
      setPermMap({});
      sb.from('alas').select('id, nome, slug').order('nome').then(({ data }) => setAlas(data || []));
      return;
    }
    sb.from('permissoes_perfil').select('modulo, nivel').eq('perfil_id', perfil.id)
      .then(({ data }) => setPermMap(Object.fromEntries((data || []).map(p => [p.modulo, p.nivel]))));
  }, [perfil?.id]);

  if (erro) return html`
    <div class="page"><div class="card" style=${{ padding: 20, color: 'var(--vermelho)' }}>
      ${erro}
      <div style=${{ marginTop: 12 }}><button class="btn btn-s" onClick=${() => sb.auth.signOut()}>Sair</button></div>
    </div></div>`;
  if (!perfil || permMap === null) return html`<${Spinner}/>`;

  // Sem linha de permissão para o módulo = acesso total (compatibilidade).
  const nivelDe = m => perfil.papel === 'master' ? 'editar' : (permMap[m] ?? 'editar');
  const ehMaster = perfil.papel === 'master';

  // O master só enxerga os módulos normais (Painel, Agenda…) depois de
  // "entrar" numa ala pelo painel Alas — antes disso, navega apenas entre as alas.
  const todasRotas = ehMaster
    ? (verAla ? [...ROTAS, { id: 'master', Ic: IcGlobo, l: 'Alas', c: Master }] : [{ id: 'master', Ic: IcGlobo, l: 'Alas', c: Master }])
    : (perfil.admin_ala ? [...ROTAS, { id: 'usuarios', Ic: IcEscudo, l: 'Usuários', c: AdminAla }] : ROTAS);
  const rotas = todasRotas.filter(r => r.id === 'master' || r.id === 'usuarios' || nivelDe(r.id) !== 'nenhum');

  if (rotas.length === 0) return html`
    <div class="page"><div class="card" style=${{ padding: 20, color: 'var(--tinta2)' }}>
      Nenhum módulo liberado para o seu usuário. Fale com o administrador.
      <div style=${{ marginTop: 12 }}><button class="btn btn-s" onClick=${() => sb.auth.signOut()}>Sair</button></div>
    </div></div>`;

  const atual = rotas.find(r => r.id === rota) || rotas[0];
  // Perfil "efetivo": quando o master está dentro de uma ala, os módulos
  // enxergam aquela ala como se fosse a própria — a RLS já libera a escrita.
  const perfilEfetivo = ehMaster && verAla ? { ...perfil, ala_id: verAla.id, alas: verAla } : perfil;

  return html`
    ${toastEl}
    <nav class="nav no-print">
      ${rotas.map(r => html`
        <button key=${r.id} class=${atual.id === r.id ? 'on' : ''} onClick=${() => { location.hash = `#/${r.id}`; }}>
          <${r.Ic} size=${19} /><span>${r.l}</span>
        </button>`)}
    </nav>
    <main class="page">
      <div class="no-print" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style=${{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div class="serif" style=${{ fontSize: 13, color: 'var(--tinta2)', fontStyle: 'italic' }}>
            ${ehMaster && verAla ? verAla.nome : (perfil.alas?.nome || 'Painel geral')}${ehMaster ? ' · administrador' : ''}
          </div>
          ${ehMaster && verAla && html`
            <select class="inp" style=${{ width: 'auto', padding: '4px 8px', fontSize: 11.5 }}
              value=${verAla.id} onChange=${e => setVerAla(alas.find(a => a.id === e.target.value) || null)}>
              ${alas.map(a => html`<option value=${a.id}>${a.nome}</option>`)}
            </select>
            <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11.5 }} onClick=${() => { setVerAla(null); location.hash = '#/master'; }}>
              <${IcGlobo} size=${12} /> Ver todas as alas
            </button>`}
        </div>
        <div style=${{ display: 'flex', gap: 6 }}>
          <button class="btn btn-s" style=${{ padding: '6px 10px', fontSize: 12 }} onClick=${() => setMenuSenha(true)}>
            <${IcChave} size=${14} /> Senha
          </button>
          <button class="btn btn-s" style=${{ padding: '6px 10px', fontSize: 12 }} onClick=${() => sb.auth.signOut()}>
            <${IcSair} size=${14} /> Sair
          </button>
        </div>
      </div>
      ${atual.id === 'master'
        ? html`<${atual.c} perfil=${perfil} show=${show} onEntrar=${a => { setVerAla(a); location.hash = '#/dashboard'; }} />`
        : atual.id === 'usuarios'
          ? html`<${atual.c} perfil=${perfil} show=${show} />`
          : html`<${atual.c} perfil=${perfilEfetivo} show=${show} readOnly=${nivelDe(atual.id) === 'visualizar'} />`}
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
