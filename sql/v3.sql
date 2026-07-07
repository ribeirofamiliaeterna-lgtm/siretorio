-- ============================================================================
--  SIRETÓRIO v3 — Frequência da ala, alertas, visitantes e selos de diretório
--  Rodar UMA vez no Supabase SQL Editor (depois de schema.sql e agenda.sql)
-- ============================================================================

-- Justificativas: flag para excluir as faltas da métrica de frequência alternada
alter table motivos_falta add column if not exists excluir_da_metrica boolean not null default false;
update motivos_falta set excluir_da_metrica = true where nome = 'Doença';

-- Membros: situação em relação ao diretório oficial
--   diretorio      → consta no diretório da ala
--   fora_diretorio → constava, mas saiu na última substituição (selo "Fora do diretório")
--   manual         → adicionado manualmente (ex.: visitante em acompanhamento)
alter table membros add column if not exists situacao text not null default 'diretorio';
alter table membros drop constraint if exists membros_situacao_check;
alter table membros add constraint membros_situacao_check
  check (situacao in ('diretorio','fora_diretorio','manual'));

-- Reuniões: contagem de visitantes sem nome
alter table reunioes add column if not exists visitantes int not null default 0;

-- Visitantes nomeados de uma reunião (sem acompanhamento de frequência)
create table if not exists reuniao_visitantes (
  id         uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references reunioes(id) on delete cascade,
  ala_id     uuid not null references alas(id) on delete cascade,
  nome       text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists reuniao_visitantes_idx on reuniao_visitantes(reuniao_id);

-- Alertas de frequência (2 domingos seguidos de falta de um membro ativo)
create table if not exists alertas (
  id         uuid primary key default gen_random_uuid(),
  ala_id     uuid not null references alas(id) on delete cascade,
  membro_id  uuid not null references membros(id) on delete cascade,
  tipo       text not null default 'faltas_consecutivas',
  referencia date not null,          -- domingo da segunda falta consecutiva
  status     text not null default 'aberto' check (status in ('aberto','dispensado')),
  criado_em  timestamptz not null default now(),
  unique (ala_id, membro_id, tipo, referencia)
);
create index if not exists alertas_ala_idx on alertas(ala_id, status);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
alter table reuniao_visitantes enable row level security;
alter table alertas            enable row level security;

create policy reuniao_visitantes_rw on reuniao_visitantes for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy reuniao_visitantes_master_ro on reuniao_visitantes for select using (is_master());

create policy alertas_rw on alertas for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy alertas_master_ro on alertas for select using (is_master());
