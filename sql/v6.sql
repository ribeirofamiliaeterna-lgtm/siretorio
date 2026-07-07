-- ============================================================================
--  SIRETÓRIO v6 — Administrador por ala, master com edição total, rodízio
--  sugerido na agenda
--  Rodar UMA vez no Supabase SQL Editor (depois de schema.sql, agenda.sql, v3,
--  v4 e v5.sql)
-- ============================================================================

-- ─── Administrador de ala ────────────────────────────────────────────────
-- Um usuário da própria ala (papel='ala') pode ser marcado como administrador
-- e passa a gerenciar os acessos/permissões da SUA ala, sem depender do master.
alter table profiles add column if not exists admin_ala boolean not null default false;

create or replace function is_ala_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select admin_ala and papel = 'ala' from profiles where id = auth.uid()), false) $$;

-- profiles: administrador da ala enxerga os perfis vinculados à própria ala
drop policy if exists profiles_select_admin on profiles;
create policy profiles_select_admin on profiles for select
  using (is_ala_admin() and ala_id = my_ala());

-- profiles: administrador da ala pode vincular/editar contas da própria ala
-- (linha ainda sem ala, ou já da mesma ala) — nunca de outra ala, nunca do master.
-- Importante: exige papel='ala' também na linha ATUAL (using), não só na
-- resultante — sem isso, um admin poderia "adotar" a linha do master (que
-- tem ala_id nulo) e rebaixá-la para papel='ala' na própria ala, roubando a
-- conta. Com o papel='ala' também no using, a linha do master nunca é alvo.
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update
  using (is_ala_admin() and papel = 'ala' and (ala_id = my_ala() or ala_id is null))
  with check (is_ala_admin() and ala_id = my_ala() and papel = 'ala');

-- permissoes_perfil: administrador da ala define permissões dos usuários da própria ala
drop policy if exists permissoes_admin_write on permissoes_perfil;
create policy permissoes_admin_write on permissoes_perfil for all
  using (is_ala_admin() and exists (select 1 from profiles p where p.id = permissoes_perfil.perfil_id and p.ala_id = my_ala()))
  with check (is_ala_admin() and exists (select 1 from profiles p where p.id = permissoes_perfil.perfil_id and p.ala_id = my_ala()));

-- ─── Master passa a poder editar os dados de qualquer ala ───────────────
-- (antes só tinha leitura extra — agora entra e mexe como se fosse a própria
-- ala, navegando entre elas pelo painel Alas)
drop policy if exists familias_master_ro on familias;
drop policy if exists familias_rw on familias;
create policy familias_rw on familias for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists membros_master_ro on membros;
drop policy if exists membros_rw on membros;
create policy membros_rw on membros for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists qualificacao_master_ro on qualificacao;
drop policy if exists qualificacao_rw on qualificacao;
create policy qualificacao_rw on qualificacao for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists motivos_master_ro on motivos_falta;
drop policy if exists motivos_rw on motivos_falta;
create policy motivos_rw on motivos_falta for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists reunioes_master_ro on reunioes;
drop policy if exists reunioes_rw on reunioes;
create policy reunioes_rw on reunioes for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists presencas_master_ro on presencas;
drop policy if exists presencas_rw on presencas;
create policy presencas_rw on presencas for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists agendas_master_ro on agendas;
drop policy if exists agendas_rw on agendas;
create policy agendas_rw on agendas for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists agenda_itens_master_ro on agenda_itens;
drop policy if exists agenda_itens_rw on agenda_itens;
create policy agenda_itens_rw on agenda_itens for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists reuniao_visitantes_master_ro on reuniao_visitantes;
drop policy if exists reuniao_visitantes_rw on reuniao_visitantes;
create policy reuniao_visitantes_rw on reuniao_visitantes for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists alertas_master_ro on alertas;
drop policy if exists alertas_rw on alertas;
create policy alertas_rw on alertas for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

drop policy if exists alertas_registro_master_ro on alertas_registro;
drop policy if exists alertas_registro_rw on alertas_registro;
create policy alertas_registro_rw on alertas_registro for all
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());

-- transmissões: master também passa a poder editar/apagar como a própria ala
drop policy if exists transmissoes_write on transmissoes;
create policy transmissoes_write on transmissoes for insert
  with check (ala_id = my_ala() or is_master());
drop policy if exists transmissoes_update on transmissoes;
create policy transmissoes_update on transmissoes for update
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());
drop policy if exists transmissoes_delete on transmissoes;
create policy transmissoes_delete on transmissoes for delete
  using (ala_id = my_ala() or is_master());

drop policy if exists tp_ala_update on transmissao_participantes;
create policy tp_ala_update on transmissao_participantes for update
  using (ala_id = my_ala() or is_master()) with check (ala_id = my_ala() or is_master());
drop policy if exists tp_ala_delete on transmissao_participantes;
create policy tp_ala_delete on transmissao_participantes for delete
  using (ala_id = my_ala() or is_master());

-- ─── Agenda: sugestão de rodízio (recepcionista/regente/organista) ───────
-- Ao criar uma nova agenda, a função que não é fixa (recepcionista, regente,
-- organista) já vem preenchida com quem serviu no domingo anterior, mas como
-- "sugestão" — a pessoa da ala precisa aceitar, deixar em branco ou substituir
-- antes de a marcação contar como confirmada.
alter table agenda_itens add column if not exists sugerido boolean not null default false;
