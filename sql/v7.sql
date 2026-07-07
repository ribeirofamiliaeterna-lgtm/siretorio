-- ============================================================================
--  SIRETÓRIO v7 — Apoios e Desobrigações com pessoa + chamado na agenda
--  Rodar UMA vez no Supabase SQL Editor (depois de agenda.sql, v3, v4, v5 e v6.sql)
-- ============================================================================

-- Os itens "Apoios" e "Desobrigações" passam a ter, além do texto livre
-- (agora usado só para o nome do chamado), a pessoa ligada ao diretório via
-- membro_id/nome_livre — por isso os tipos 'apoio' e 'desobrigacao' entram
-- no rol de tipos permitidos em agenda_itens.
alter table agenda_itens drop constraint if exists agenda_itens_tipo_check;
alter table agenda_itens add constraint agenda_itens_tipo_check
  check (tipo in ('funcao','oracao','discurso','participacao','hino','texto','apoio','desobrigacao'));
