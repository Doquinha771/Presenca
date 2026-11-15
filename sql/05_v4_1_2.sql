-- Presença+ 4.1.2: solicitações de acesso não dependem de dados escolares ainda não conferidos.
-- Migração para bases 4.1.1; no banco de produção esta alteração já foi aplicada.
-- Preserva perfis, matrículas e histórico; não executa limpeza nem altera a autenticação do Supabase.
begin;
set local lock_timeout='10s';
set local statement_timeout='45s';

-- Os dados oficiais são obrigatórios somente quando a secretaria autoriza a matrícula.
alter table public.profiles drop constraint profiles_check;
alter table public.profiles add constraint profiles_check check (
 role <> 'aluno' or (
   ra is not null
   and (not enrollment_approved or (grade is not null and birth_date is not null))
 )
);

create or replace function private.create_portal_profile()
returns trigger language plpgsql security definer set search_path=''
as $portal_profile$
declare
  inv public.staff_invites%rowtype;
  en public.school_enrollments%rowtype;
  cl public.school_classes%rowtype;
  email_normalized text:=lower(trim(coalesce(new.email,'')));
  claimed_name text:=trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  student_ra text;
  authorized_limit integer;
begin
  select * into inv from public.staff_invites
    where email=email_normalized and used_at is null and expires_at>now()
    for update;
  if found then
    if length(claimed_name) not between 3 and 120 then
      claimed_name:='Equipe institucional';
    end if;
    insert into public.profiles(id,full_name,role,verified)
      values(new.id,claimed_name,inv.role,new.email_confirmed_at is not null);
    update public.staff_invites set used_at=now(),used_by=new.id where id=inv.id;
    return new;
  end if;

  -- Só endereço escolar válido ou convite institucional anterior geram usuário.
  -- Metadata do aluno jamais pode conceder cargo ou aprovação institucional.
  if email_normalized !~ '^[0-9]{7,16}(sp)?@al[.]educacao[.]sp[.]gov[.]br$' then
    raise exception 'E-mail escolar inválido ou convite institucional inexistente' using errcode='22023';
  end if;

  student_ra:=split_part(email_normalized,'@',1);
  select * into en from public.school_enrollments
   where email=email_normalized and ra=student_ra
     and active and profile_id is null for update;
  if found then
    select * into cl from public.school_classes where id=en.class_id and active;
    if found then
      select default_limit into authorized_limit from public.school_settings where id=true;
      insert into public.profiles
        (id,ra,full_name,grade,birth_date,role,verified,late_limit,class_id,enrollment_approved)
      values
        (new.id,en.ra,en.full_name,cl.grade||' • '||cl.name,en.birth_date,'aluno',
         new.email_confirmed_at is not null,coalesce(authorized_limit,5),cl.id,true);
      update public.school_enrollments set profile_id=new.id where id=en.id;
      return new;
    end if;
  end if;

  -- Pedido espontâneo: conta autenticável, mas sem permissão de consultar dados escolares.
  -- Não depender de RA, turma ou nascimento autodeclarados para salvar o usuário.
  if length(claimed_name) not between 3 and 120 then
    claimed_name:='Aluno aguardando cadastro';
  end if;
  insert into public.profiles
    (id,ra,full_name,grade,birth_date,role,verified,enrollment_approved)
  values
    (new.id,student_ra,claimed_name,null,null,'aluno',
     new.email_confirmed_at is not null,false);
  return new;
end;
$portal_profile$;

insert into public.portal_migrations(version) values('4.1.2')
  on conflict(version) do nothing;
commit;
