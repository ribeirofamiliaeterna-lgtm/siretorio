import { html, useState, useEffect, sb, fmtBR, Spinner, Modal, Chip } from './core.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { IcMais, IcPessoa, IcChave, IcLixeira, IcEscudo, IcOlho, IcEstrela } from './icons.js';

// Cliente auxiliar só para criar contas — não toca na sessão do master.
const sbAux = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'painel-gestao-aux' },
});

const MODULOS = [
  ['dashboard', 'Painel'], ['agenda', 'Agenda'], ['frequencia', 'Frequência'],
  ['diretorio', 'Diretório'], ['qualificacao', 'Qualificação'], ['transmissao', 'Transmissão'],
];

function NovaAla({ onClose, onSaved, show }) {
  const [nome, setNome] = useState('');
  const [estaca, setEstaca] = useState('');
  const [busy, setBusy] = useState(false);
  const slug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^ala\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const salvar = async () => {
    if (!nome.trim() || !slug) return show('Informe o nome da ala.', false);
    setBusy(true);
    const { error } = await sb.from('alas').insert({ nome: nome.trim(), slug, estaca: estaca.trim() });
    setBusy(false);
    if (error) return show(error.message, false);
    show('Ala criada. As justificativas de falta padrão já foram geradas para ela.');
    onSaved(); onClose();
  };
  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Nova ala</div>
    <label class="lbl">Nome da ala</label>
    <input class="inp" placeholder="Ex: Ala Águas Claras 2" value=${nome} onInput=${e => setNome(e.target.value)} />
    <label class="lbl">Estaca</label>
    <input class="inp" placeholder="Ex: Estaca Taguatinga Brasília" value=${estaca} onInput=${e => setEstaca(e.target.value)} />
    ${slug && html`<div style=${{ fontSize: 11, color: 'var(--tinta3)', marginTop: 6 }}>Link público: assistir.html?ala=<strong>${slug}</strong></div>`}
    <div style=${{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Criar ala</button>
    </div>
  <//>`;
}

// ─── Criação de acesso (login) para uma ala, direto pelo painel ──────────
function NovoAcesso({ ala, onClose, onSaved, show }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(null);

  const gerarSenha = () => {
    const a = new Uint8Array(6); crypto.getRandomValues(a);
    setSenha('Ala' + [...a].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') + '!');
  };

  const criar = async () => {
    if (!nome.trim()) return show('Informe o nome de quem vai usar o acesso.', false);
    if (!/.+@.+\..+/.test(email.trim())) return show('Informe um e-mail válido.', false);
    if (senha.length < 8) return show('A senha precisa de pelo menos 8 caracteres.', false);
    setBusy(true);
    // 1) cria a conta (cliente auxiliar — a sessão do master continua ativa)
    const { data, error } = await sbAux.auth.signUp({
      email: email.trim(), password: senha,
      options: { data: { nome: nome.trim() } },
    });
    if (error) {
      setBusy(false);
      return show(error.message.includes('already registered')
        ? 'Já existe uma conta com este e-mail.'
        : `Não foi possível criar a conta: ${error.message}`, false);
    }
    // 2) vincula o perfil à ala (permitido ao master pelo v4.sql)
    const { error: e2 } = await sb.from('profiles')
      .update({ nome: nome.trim(), ala_id: ala.id, papel: 'ala' })
      .eq('id', data.user.id);
    setBusy(false);
    if (e2) return show(`Conta criada, mas falhou o vínculo com a ala: ${e2.message}. Rode o sql/v4.sql no Supabase.`, false);
    setFeito({ email: email.trim(), senha, confirmar: !data.user.confirmed_at && !data.session });
    onSaved();
  };

  if (feito) return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Acesso criado — ${ala.nome}</div>
    <div class="card" style=${{ padding: 14, marginTop: 12, background: 'var(--azul-claro)', border: '1px solid #CFE0EE' }}>
      <div style=${{ fontSize: 13 }}><strong>E-mail:</strong> ${feito.email}</div>
      <div style=${{ fontSize: 13, marginTop: 4 }}><strong>Senha provisória:</strong> <span style=${{ fontFamily: 'monospace' }}>${feito.senha}</span></div>
    </div>
    <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginTop: 10, lineHeight: 1.6 }}>
      Anote e repasse com cuidado — a senha não poderá ser consultada depois.
      Oriente a pessoa a trocá-la no primeiro acesso (botão Senha).
      ${feito.confirmar && html`<div style=${{ marginTop: 6, color: 'var(--ambar)' }}>
        Este projeto exige confirmação de e-mail: a pessoa precisa clicar no link enviado para ${feito.email} antes de entrar.</div>`}
    </div>
    <button class="btn btn-s" style=${{ width: '100%', marginTop: 14 }}
      onClick=${() => { navigator.clipboard?.writeText(`Acesso ao Painel de Gestão — ${ala.nome}\nEndereço: ${location.origin}${location.pathname}\nE-mail: ${feito.email}\nSenha provisória: ${feito.senha}`); show('Dados copiados.'); }}>
      Copiar dados de acesso
    </button>
    <button class="btn btn-p" style=${{ width: '100%', marginTop: 8 }} onClick=${onClose}>Concluir</button>
  <//>`;

  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Criar acesso — ${ala.nome}</div>
    <div style=${{ fontSize: 12, color: 'var(--tinta2)', marginTop: 4 }}>
      A pessoa entrará com este e-mail e verá somente os dados desta ala.
    </div>
    <label class="lbl">Nome de quem vai usar</label>
    <input class="inp" placeholder="Ex: Secretário da ala" value=${nome} onInput=${e => setNome(e.target.value)} />
    <label class="lbl">E-mail de acesso</label>
    <input class="inp" type="email" placeholder="email@exemplo.com" value=${email} onInput=${e => setEmail(e.target.value)} />
    <label class="lbl">Senha provisória (mínimo 8 caracteres)</label>
    <div style=${{ display: 'flex', gap: 6 }}>
      <input class="inp" value=${senha} onInput=${e => setSenha(e.target.value)} />
      <button class="btn btn-s" style=${{ whiteSpace: 'nowrap', fontSize: 12 }} onClick=${gerarSenha}>Gerar</button>
    </div>
    <div style=${{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${criar}>
        ${busy ? 'Criando…' : 'Criar acesso'}
      </button>
    </div>
  <//>`;
}

// ─── Permissões por módulo de um usuário da ala ──────────────────────────
function PermissoesUsuario({ perfil, onClose, show }) {
  const [perms, setPerms] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from('permissoes_perfil').select('modulo, nivel').eq('perfil_id', perfil.id)
      .then(({ data }) => {
        const porModulo = Object.fromEntries((data || []).map(p => [p.modulo, p.nivel]));
        setPerms(Object.fromEntries(MODULOS.map(([m]) => [m, porModulo[m] || 'editar'])));
      });
  }, [perfil.id]);

  const salvar = async () => {
    setBusy(true);
    const linhas = MODULOS.map(([m]) => ({ perfil_id: perfil.id, modulo: m, nivel: perms[m] }));
    const { error } = await sb.from('permissoes_perfil').upsert(linhas, { onConflict: 'perfil_id,modulo' });
    setBusy(false);
    if (error) return show(error.message, false);
    show('Permissões salvas.'); onClose();
  };

  if (!perms) return html`<${Modal} onClose=${onClose}><${Spinner}/><//>`;

  return html`<${Modal} onClose=${onClose}>
    <div class="titulo-secao">Permissões — ${perfil.nome || perfil.email}</div>
    <div style=${{ fontSize: 12, color: 'var(--tinta2)', margin: '4px 0 12px' }}>
      Defina o que esta pessoa pode acessar em cada módulo. Sem restrição definida, o acesso é completo.
    </div>
    ${MODULOS.map(([m, l]) => html`
      <div key=${m} style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--linha2)' }}>
        <span style=${{ fontSize: 13, fontWeight: 600 }}>${l}</span>
        <select class="inp" style=${{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
          value=${perms[m]} onChange=${e => setPerms(o => ({ ...o, [m]: e.target.value }))}>
          <option value="nenhum">Sem acesso</option>
          <option value="visualizar">Somente visualizar</option>
          <option value="editar">Visualizar e editar</option>
        </select>
      </div>`)}
    <div style=${{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button class="btn btn-s" style=${{ flex: 1 }} onClick=${onClose}>Cancelar</button>
      <button class="btn btn-p" style=${{ flex: 1, opacity: busy ? .6 : 1 }} disabled=${busy} onClick=${salvar}>Salvar permissões</button>
    </div>
  <//>`;
}

export function Master({ perfil, show, onEntrar }) {
  const [linhas, setLinhas] = useState(null);
  const [perfis, setPerfis] = useState([]);
  const [nova, setNova] = useState(false);
  const [acessoPara, setAcessoPara] = useState(null);
  const [permPara, setPermPara] = useState(null);

  const carregar = async () => {
    const [{ data: alas }, { data: fams }, { data: membros }, { data: reunioes }, { data: presencas }, { data: pf }] = await Promise.all([
      sb.from('alas').select('*').order('nome'),
      sb.from('familias').select('id, ala_id'),
      sb.from('membros').select('id, ala_id').eq('ativo', true),
      sb.from('reunioes').select('id, ala_id, data').eq('tipo', 'sacramental').order('data'),
      sb.from('presencas').select('reuniao_id, presente, ala_id').eq('presente', true).limit(50000),
      sb.from('profiles').select('id, nome, email, papel, ala_id, admin_ala'),
    ]);
    setPerfis(pf || []);
    const presPorReuniao = new Map();
    (presencas || []).forEach(p => presPorReuniao.set(p.reuniao_id, (presPorReuniao.get(p.reuniao_id) || 0) + 1));
    setLinhas((alas || []).map(a => {
      const rs = (reunioes || []).filter(r => r.ala_id === a.id);
      const ultima = [...rs].reverse().find(r => presPorReuniao.has(r.id));
      return {
        ...a,
        familias: (fams || []).filter(f => f.ala_id === a.id).length,
        membros: (membros || []).filter(m => m.ala_id === a.id).length,
        ultimaData: ultima?.data,
        ultimaPresenca: ultima ? presPorReuniao.get(ultima.id) : null,
      };
    }));
  };
  useEffect(() => { carregar(); }, []);

  const resetarSenha = async u => {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${u.email}?`)) return;
    const { error } = await sbAux.auth.resetPasswordForEmail(u.email);
    if (error) return show(error.message, false);
    show('E-mail de redefinição enviado.');
  };

  const revogarAcesso = async u => {
    if (!confirm(`Revogar o acesso de ${u.nome || u.email} a esta ala? A pessoa deixará de conseguir ver os dados até ser vinculada novamente a uma ala.`)) return;
    const { error } = await sb.from('profiles').update({ ala_id: null }).eq('id', u.id);
    if (error) return show(error.message, false);
    show('Acesso revogado.'); carregar();
  };

  const alternarAdmin = async u => {
    const { error } = await sb.from('profiles').update({ admin_ala: !u.admin_ala }).eq('id', u.id);
    if (error) return show(error.message, false);
    show(u.admin_ala ? 'Deixou de ser administrador da ala.' : 'Agora é administrador da ala — pode gerenciar os acessos por conta própria.');
    carregar();
  };

  if (!linhas) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">Painel geral</div>
    <div class="sub">Todas as alas do sistema e seus acessos</div>
    <button class="btn btn-p" style=${{ width: '100%', marginBottom: 12 }} onClick=${() => setNova(true)}>
      <${IcMais} size=${15} /> Cadastrar nova ala
    </button>
    ${linhas.map(a => {
      const usuarios = perfis.filter(p => p.ala_id === a.id && p.papel !== 'master');
      return html`
      <div key=${a.id} class="card" style=${{ padding: 14 }}>
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div class="serif" style=${{ fontWeight: 700, fontSize: 16, color: 'var(--azul)' }}>${a.nome}</div>
            <div style=${{ fontSize: 11, color: 'var(--tinta3)' }}>${a.estaca || '—'} · link público: ?ala=${a.slug}</div>
          </div>
          <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button class="btn btn-p" style=${{ fontSize: 12 }} onClick=${() => onEntrar?.(a)}>
              <${IcOlho} size=${13} /> Entrar no painel
            </button>
            <button class="btn btn-s" style=${{ fontSize: 12 }} onClick=${() => setAcessoPara(a)}>
              <${IcChave} size=${13} /> Criar acesso
            </button>
          </div>
        </div>
        <div style=${{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${a.familias}</div><div class="l">Famílias</div></div>
          <div class="kpi" style=${{ padding: 10 }}><div class="v" style=${{ fontSize: 19 }}>${a.membros}</div><div class="l">Pessoas</div></div>
          <div class="kpi" style=${{ padding: 10 }}>
            <div class="v" style=${{ fontSize: 19 }}>${a.ultimaPresenca ?? '—'}</div>
            <div class="l">${a.ultimaData ? `Presentes em ${fmtBR(a.ultimaData)}` : 'Sem registros'}</div>
          </div>
        </div>
        <div style=${{ marginTop: 10, borderTop: '1px solid var(--linha2)', paddingTop: 8 }}>
          <div style=${{ fontSize: 11, fontWeight: 600, color: 'var(--tinta3)', marginBottom: 4, letterSpacing: '.3px', textTransform: 'uppercase' }}>Acessos desta ala</div>
          ${usuarios.length === 0 && html`<div style=${{ fontSize: 12, color: 'var(--tinta3)' }}>Nenhum usuário vinculado ainda.</div>`}
          ${usuarios.map(u => html`
            <div key=${u.id} style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: 'var(--tinta2)', padding: '6px 0', borderBottom: '1px solid var(--linha2)', flexWrap: 'wrap' }}>
              <span style=${{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <${IcPessoa} size=${13} /> ${u.nome || '(sem nome)'} · ${u.email}
                ${u.admin_ala && html`<${Chip} bg="var(--dourado-claro)" t="var(--dourado)">Administrador da ala<//>`}
              </span>
              <div style=${{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Torna esta pessoa administradora da ala, podendo gerenciar os acessos por conta própria" onClick=${() => alternarAdmin(u)}>
                  <${IcEstrela} size=${12} /> ${u.admin_ala ? 'Remover administrador' : 'Tornar administrador'}
                </button>
                <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Permissões por módulo" onClick=${() => setPermPara(u)}>
                  <${IcEscudo} size=${12} /> Permissões
                </button>
                <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Enviar redefinição de senha" onClick=${() => resetarSenha(u)}>
                  <${IcChave} size=${12} /> Redefinir senha
                </button>
                <button class="btn btn-d" style=${{ padding: '4px 8px', fontSize: 11 }} title="Revogar acesso" onClick=${() => revogarAcesso(u)}>
                  <${IcLixeira} size=${12} /> Revogar
                </button>
              </div>
            </div>`)}
        </div>
      </div>`;
    })}
    ${perfis.some(p => !p.ala_id && p.papel !== 'master') && html`
      <div class="card" style=${{ padding: 14 }}>
        <div style=${{ fontSize: 12, fontWeight: 600, color: 'var(--ambar)', marginBottom: 6 }}>Contas sem ala vinculada</div>
        ${perfis.filter(p => !p.ala_id && p.papel !== 'master').map(u => html`
          <div key=${u.id} style=${{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0', flexWrap: 'wrap' }}>
            <span style=${{ color: 'var(--tinta2)' }}>${u.email}</span>
            <select class="inp" style=${{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
              onChange=${async e => {
                if (!e.target.value) return;
                const { error } = await sb.from('profiles').update({ ala_id: e.target.value }).eq('id', u.id);
                if (error) return show(error.message, false);
                show('Conta vinculada.'); carregar();
              }}>
              <option value="">Vincular à ala…</option>
              ${linhas.map(a => html`<option value=${a.id}>${a.nome}</option>`)}
            </select>
          </div>`)}
      </div>`}
    ${nova && html`<${NovaAla} onClose=${() => setNova(false)} onSaved=${carregar} show=${show} />`}
    ${acessoPara && html`<${NovoAcesso} ala=${acessoPara} onClose=${() => setAcessoPara(null)} onSaved=${carregar} show=${show} />`}
    ${permPara && html`<${PermissoesUsuario} perfil=${permPara} onClose=${() => setPermPara(null)} show=${show} />`}`;
}

// ─── Painel do administrador da ala (gestão de usuários só da própria ala) ──
// Mesma caixa de ferramentas do master (criar acesso, permissões, redefinir
// senha, revogar, promover outro administrador), mas restrita à própria ala
// pela RLS (is_ala_admin() só enxerga/edita perfis com ala_id = my_ala()).
export function AdminAla({ perfil, show }) {
  const [usuarios, setUsuarios] = useState(null);
  const [acesso, setAcesso] = useState(false);
  const [permPara, setPermPara] = useState(null);

  const carregar = async () => {
    const { data } = await sb.from('profiles').select('id, nome, email, papel, ala_id, admin_ala')
      .eq('ala_id', perfil.ala_id).order('nome');
    setUsuarios(data || []);
  };
  useEffect(() => { carregar(); }, [perfil.ala_id]);

  const resetarSenha = async u => {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${u.email}?`)) return;
    const { error } = await sbAux.auth.resetPasswordForEmail(u.email);
    if (error) return show(error.message, false);
    show('E-mail de redefinição enviado.');
  };

  const revogarAcesso = async u => {
    if (u.id === perfil.id) return show('Você não pode revogar o próprio acesso.', false);
    if (!confirm(`Revogar o acesso de ${u.nome || u.email}? A pessoa deixará de conseguir ver os dados da ala.`)) return;
    const { error } = await sb.from('profiles').update({ ala_id: null }).eq('id', u.id);
    if (error) return show(error.message, false);
    show('Acesso revogado.'); carregar();
  };

  const alternarAdmin = async u => {
    if (u.id === perfil.id) return show('Peça a outro administrador ou ao master para alterar seu próprio acesso.', false);
    const { error } = await sb.from('profiles').update({ admin_ala: !u.admin_ala }).eq('id', u.id);
    if (error) return show(error.message, false);
    show(u.admin_ala ? 'Deixou de ser administrador.' : 'Agora também é administrador da ala.');
    carregar();
  };

  if (!usuarios) return html`<${Spinner}/>`;

  return html`
    <div class="hdr">Usuários da ala</div>
    <div class="sub">Gerencie os acessos de ${perfil.alas?.nome || 'sua ala'}</div>
    <button class="btn btn-p" style=${{ width: '100%', marginBottom: 12 }} onClick=${() => setAcesso(true)}>
      <${IcMais} size=${15} /> Criar acesso
    </button>
    ${usuarios.length === 0 && html`<div style=${{ fontSize: 12.5, color: 'var(--tinta3)' }}>Nenhum usuário vinculado ainda.</div>`}
    ${usuarios.map(u => html`
      <div key=${u.id} class="card" style=${{ padding: '10px 14px' }}>
        <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style=${{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, flexWrap: 'wrap' }}>
            <${IcPessoa} size=${14} /> ${u.nome || '(sem nome)'} · ${u.email}
            ${u.admin_ala && html`<${Chip} bg="var(--dourado-claro)" t="var(--dourado)">Administrador<//>`}
            ${u.id === perfil.id && html`<${Chip} bg="var(--azul-claro)" t="var(--azul)">Você<//>`}
          </span>
        </div>
        <div style=${{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Torna esta pessoa administradora da ala" onClick=${() => alternarAdmin(u)}>
            <${IcEstrela} size=${12} /> ${u.admin_ala ? 'Remover administrador' : 'Tornar administrador'}
          </button>
          <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Permissões por módulo" onClick=${() => setPermPara(u)}>
            <${IcEscudo} size=${12} /> Permissões
          </button>
          <button class="btn btn-s" style=${{ padding: '4px 8px', fontSize: 11 }} title="Enviar redefinição de senha" onClick=${() => resetarSenha(u)}>
            <${IcChave} size=${12} /> Redefinir senha
          </button>
          <button class="btn btn-d" style=${{ padding: '4px 8px', fontSize: 11 }} title="Revogar acesso" onClick=${() => revogarAcesso(u)}>
            <${IcLixeira} size=${12} /> Revogar
          </button>
        </div>
      </div>`)}
    ${acesso && html`<${NovoAcesso} ala=${{ id: perfil.ala_id, nome: perfil.alas?.nome || 'sua ala' }} onClose=${() => setAcesso(false)} onSaved=${carregar} show=${show} />`}
    ${permPara && html`<${PermissoesUsuario} perfil=${permPara} onClose=${() => setPermPara(null)} show=${show} />`}`;
}
