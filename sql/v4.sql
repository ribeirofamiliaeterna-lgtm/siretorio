-- ============================================================================
--  SIRETÓRIO v4 — Criação de acesso pelo administrador (painel master)
--  Rodar UMA vez no Supabase SQL Editor (depois de schema.sql, agenda.sql e v3.sql)
-- ============================================================================

-- O master passa a poder editar perfis (vincular usuário à ala, definir nome)
drop policy if exists profiles_master_update on profiles;
create policy profiles_master_update on profiles for update
  using (is_master()) with check (is_master());

-- Endurecimento: o cadastro público (signUp) NÃO vincula mais ala nem papel
-- pelos metadados — sem isso, qualquer pessoa com a chave pública poderia
-- se auto-registrar dentro de uma ala e ler os dados dos membros.
-- O vínculo agora é feito pelo master (painel Alas) ou pelo script com a
-- chave administrativa (scripts/create-user.mjs).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nome, papel, ala_id)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nome', ''), 'ala', null)
  on conflict (id) do nothing;
  return new;
end $$;
