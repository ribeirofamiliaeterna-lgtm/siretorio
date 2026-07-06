-- ============================================================================
--  SIRETÓRIO v2 — Esquema multi-ala
--  Rodar UMA vez no Supabase SQL Editor (projeto yrnpadospxwiedkphugj)
--  A tabela antiga ala_ac1_status NÃO é alterada — o sistema atual continua
--  funcionando durante a transição.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─── ALAS ───────────────────────────────────────────────────────────────────
create table if not exists alas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,            -- usado no link público: ?ala=slug
  estaca     text not null default '',
  criado_em  timestamptz not null default now()
);

-- ─── PERFIS (1 por usuário autenticado) ─────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  nome       text not null default '',
  ala_id     uuid references alas(id),
  papel      text not null default 'ala' check (papel in ('master','ala')),
  criado_em  timestamptz not null default now()
);

-- ─── FUNÇÕES AUXILIARES (security definer: não sofrem recursão de RLS) ──────
create or replace function my_ala() returns uuid
language sql stable security definer set search_path = public as
$$ select ala_id from profiles where id = auth.uid() $$;

create or replace function is_master() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'master' from profiles where id = auth.uid()), false) $$;

-- ─── DIRETÓRIO ──────────────────────────────────────────────────────────────
create table if not exists familias (
  id            uuid primary key default gen_random_uuid(),
  ala_id        uuid not null references alas(id) on delete cascade,
  sobrenome     text not null,
  chefe         text not null default '',
  telefone      text not null default '',
  endereco      text not null default '',
  setor         text not null default '',
  legacy_id     text,                          -- id do sistema antigo (migração)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists familias_ala_idx on familias(ala_id);

create table if not exists membros (
  id         uuid primary key default gen_random_uuid(),
  ala_id     uuid not null references alas(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete cascade,
  nome       text not null,
  sexo       text not null default '' check (sexo in ('M','F','')),
  idade      int,
  is_membro  boolean not null default true,    -- false = participante não-membro
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists membros_ala_idx on membros(ala_id);
create index if not exists membros_familia_idx on membros(familia_id);

-- ─── QUALIFICAÇÃO (módulo atual, agora por ala) ─────────────────────────────
create table if not exists qualificacao (
  familia_id    uuid primary key references familias(id) on delete cascade,
  ala_id        uuid not null references alas(id) on delete cascade,
  status        text not null default 'pendente'
                check (status in ('pendente','residente','saiu')),
  nota          text not null default '',
  atualizado_em timestamptz not null default now()
);
create index if not exists qualificacao_ala_idx on qualificacao(ala_id);

-- ─── RODÍZIO / FREQUÊNCIA SACRAMENTAL ───────────────────────────────────────
create table if not exists motivos_falta (
  id               uuid primary key default gen_random_uuid(),
  ala_id           uuid not null references alas(id) on delete cascade,
  nome             text not null,
  alerta_lideranca boolean not null default false, -- ex.: doença → repassar ao
                                                   -- pres. do quórum / SocSoc
  padrao           boolean not null default false,
  unique (ala_id, nome)
);

create table if not exists reunioes (
  id        uuid primary key default gen_random_uuid(),
  ala_id    uuid not null references alas(id) on delete cascade,
  data      date not null,
  tipo      text not null default 'sacramental',
  criado_em timestamptz not null default now(),
  unique (ala_id, data, tipo)
);

-- Uma linha por membro registrado na reunião.
-- presente=false + motivo = falta justificada; sem linha = família não registrada.
create table if not exists presencas (
  id              uuid primary key default gen_random_uuid(),
  ala_id          uuid not null references alas(id) on delete cascade,
  reuniao_id      uuid not null references reunioes(id) on delete cascade,
  membro_id       uuid not null references membros(id) on delete cascade,
  presente        boolean not null default false,
  origem          text not null default 'manual'
                  check (origem in ('manual','transmissao')),
  motivo_falta_id uuid references motivos_falta(id),
  alerta_tratado  boolean not null default false,  -- liderança já foi informada
  registrado_em   timestamptz not null default now(),
  unique (reuniao_id, membro_id)
);
create index if not exists presencas_ala_idx on presencas(ala_id);
create index if not exists presencas_reuniao_idx on presencas(reuniao_id);

-- ─── TRANSMISSÃO (link semanal + formulário público) ────────────────────────
create table if not exists transmissoes (
  id        uuid primary key default gen_random_uuid(),
  ala_id    uuid not null references alas(id) on delete cascade,
  data      date not null,
  url       text not null,
  criado_em timestamptz not null default now(),
  unique (ala_id, data)
);

create table if not exists transmissao_participantes (
  id             uuid primary key default gen_random_uuid(),
  transmissao_id uuid not null references transmissoes(id) on delete cascade,
  ala_id         uuid not null references alas(id) on delete cascade,
  nome_informado text not null,
  membro_id      uuid references membros(id),   -- preenchido no cruzamento
  processado     boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index if not exists tp_transmissao_idx on transmissao_participantes(transmissao_id);

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────
-- Novo usuário do Auth → cria profile (papel e ala vêm do user_metadata)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nome, papel, ala_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nome', ''),
    case when new.raw_user_meta_data->>'papel' = 'master' then 'master' else 'ala' end,
    (select id from alas where slug = new.raw_user_meta_data->>'ala_slug')
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Nova ala → semeia os 4 motivos de falta padrão
create or replace function seed_motivos_padrao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into motivos_falta (ala_id, nome, alerta_lideranca, padrao) values
    (new.id, 'Em viagem',                    false, true),
    (new.id, 'Doença',                       true,  true),
    (new.id, 'Frequência em outra unidade',  false, true),
    (new.id, 'Sem justificativa',            false, true);
  return new;
end $$;

drop trigger if exists on_ala_created on alas;
create trigger on_ala_created
  after insert on alas
  for each row execute function seed_motivos_padrao();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
alter table alas                      enable row level security;
alter table profiles                  enable row level security;
alter table familias                  enable row level security;
alter table membros                   enable row level security;
alter table qualificacao              enable row level security;
alter table motivos_falta             enable row level security;
alter table reunioes                  enable row level security;
alter table presencas                 enable row level security;
alter table transmissoes              enable row level security;
alter table transmissao_participantes enable row level security;

-- alas: leitura pública (necessário para o link público resolver o slug);
-- gestão apenas pelo master
create policy alas_select on alas for select using (true);
create policy alas_master_write on alas for all
  using (is_master()) with check (is_master());

-- profiles: cada um vê o seu; master vê todos
create policy profiles_own on profiles for select using (id = auth.uid() or is_master());
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Padrão para dados da ala: usuário da ala tem CRUD apenas na própria ala;
-- master tem SOMENTE leitura de todas as alas (painel de visualização)
create policy familias_rw on familias for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy familias_master_ro on familias for select using (is_master());

create policy membros_rw on membros for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy membros_master_ro on membros for select using (is_master());

create policy qualificacao_rw on qualificacao for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy qualificacao_master_ro on qualificacao for select using (is_master());

create policy motivos_rw on motivos_falta for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy motivos_master_ro on motivos_falta for select using (is_master());

create policy reunioes_rw on reunioes for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy reunioes_master_ro on reunioes for select using (is_master());

create policy presencas_rw on presencas for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy presencas_master_ro on presencas for select using (is_master());

-- transmissões: leitura pública (página "assistir"); escrita pela ala
create policy transmissoes_select on transmissoes for select using (true);
create policy transmissoes_write on transmissoes for insert
  with check (ala_id = my_ala());
create policy transmissoes_update on transmissoes for update
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy transmissoes_delete on transmissoes for delete
  using (ala_id = my_ala());

-- participantes da transmissão: qualquer visitante pode se registrar (insert);
-- leitura/gestão apenas pela ala dona (e master lê)
create policy tp_public_insert on transmissao_participantes for insert
  with check (true);
create policy tp_ala_select on transmissao_participantes for select
  using (ala_id = my_ala() or is_master());
create policy tp_ala_update on transmissao_participantes for update
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy tp_ala_delete on transmissao_participantes for delete
  using (ala_id = my_ala());

-- ─── DADOS INICIAIS ─────────────────────────────────────────────────────────
insert into alas (nome, slug, estaca)
values ('Ala Águas Claras 1', 'aguas-claras-1', 'Estaca Taguatinga Brasília')
on conflict (slug) do nothing;
