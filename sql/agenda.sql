-- ============================================================================
--  SIRETÓRIO v2 — Módulo Agenda Sacramental
--  Rodar UMA vez no Supabase SQL Editor (depois do schema.sql)
-- ============================================================================

-- Uma agenda por reunião
create table if not exists agendas (
  id         uuid primary key default gen_random_uuid(),
  ala_id     uuid not null references alas(id) on delete cascade,
  data       date not null,
  tipo       text not null default 'sacramental',
  frequencia int,                                  -- campo FREQUÊNCIA da ata
  criado_em  timestamptz not null default now(),
  unique (ala_id, data, tipo)
);
create index if not exists agendas_ala_idx on agendas(ala_id, data);

-- Itens da agenda, em ordem, agrupados por seção
create table if not exists agenda_itens (
  id         uuid primary key default gen_random_uuid(),
  agenda_id  uuid not null references agendas(id) on delete cascade,
  ala_id     uuid not null references alas(id) on delete cascade,
  secao      text not null,        -- abertura | assuntos | servico | discursos | encerramento
  rotulo     text not null,        -- "Presidindo", "1º Discursante", "Hino de abertura"…
  tipo       text not null check (tipo in ('funcao','oracao','discurso','participacao','hino','texto')),
  conteudo   text not null default '',   -- hino ou texto livre
  membro_id  uuid references membros(id) on delete set null,
  nome_livre text not null default '',   -- pessoa fora do diretório
  ordem      int  not null default 0,
  padrao     boolean not null default false,  -- item do modelo padrão (rótulo fixo)
  criado_em  timestamptz not null default now()
);
create index if not exists agenda_itens_agenda_idx on agenda_itens(agenda_id, ordem);
create index if not exists agenda_itens_membro_idx on agenda_itens(ala_id, tipo, membro_id);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
alter table agendas      enable row level security;
alter table agenda_itens enable row level security;

create policy agendas_rw on agendas for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy agendas_master_ro on agendas for select using (is_master());

create policy agenda_itens_rw on agenda_itens for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy agenda_itens_master_ro on agenda_itens for select using (is_master());
