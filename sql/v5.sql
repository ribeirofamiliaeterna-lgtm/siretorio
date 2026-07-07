-- ============================================================================
--  PAINEL DE GESTÃO v5 — Registro sistêmico, permissões por módulo e correções
--  Rodar UMA vez no Supabase SQL Editor (depois de schema.sql, agenda.sql, v3.sql e v4.sql)
-- ============================================================================

-- Correção de integridade: excluir um membro com histórico de transmissão
-- travava com erro de chave estrangeira. Agora o vínculo é apenas zerado.
alter table transmissao_participantes drop constraint if exists transmissao_participantes_membro_id_fkey;
alter table transmissao_participantes add constraint transmissao_participantes_membro_id_fkey
  foreign key (membro_id) references membros(id) on delete set null;

-- ─── Alertas de registro sistêmico (apoios e desobrigações lançados na agenda) ──
-- Gerado automaticamente a partir de domingo ao meio-dia (para dar tempo de o
-- lançamento ser feito antes do aviso), lembrando de repassar o apoio/
-- desobrigação ao registro sistêmico oficial da Igreja.
create table if not exists alertas_registro (
  id             uuid primary key default gen_random_uuid(),
  ala_id         uuid not null references alas(id) on delete cascade,
  agenda_item_id uuid not null references agenda_itens(id) on delete cascade,
  tipo           text not null default 'apoio_desobrigacao',
  descricao      text not null default '',
  data           date not null,
  status         text not null default 'aberto' check (status in ('aberto','dispensado')),
  criado_em      timestamptz not null default now(),
  unique (agenda_item_id)
);
create index if not exists alertas_registro_ala_idx on alertas_registro(ala_id, status);

alter table alertas_registro enable row level security;
create policy alertas_registro_rw on alertas_registro for all
  using (ala_id = my_ala()) with check (ala_id = my_ala());
create policy alertas_registro_master_ro on alertas_registro for select using (is_master());

-- ─── Permissões por módulo (o master define visualizar/editar/sem acesso) ───
-- Sem linha para um módulo = acesso total (compatibilidade com contas já
-- existentes). Master nunca é restringido por esta tabela.
create table if not exists permissoes_perfil (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references profiles(id) on delete cascade,
  modulo    text not null check (modulo in ('dashboard','agenda','frequencia','diretorio','qualificacao','transmissao')),
  nivel     text not null default 'editar' check (nivel in ('nenhum','visualizar','editar')),
  unique (perfil_id, modulo)
);

alter table permissoes_perfil enable row level security;
create policy permissoes_own_select on permissoes_perfil for select
  using (perfil_id = auth.uid() or is_master());
create policy permissoes_master_write on permissoes_perfil for all
  using (is_master()) with check (is_master());
