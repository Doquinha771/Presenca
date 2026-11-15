-- Presença+ Portal: schema para projeto NOVO, executar no SQL Editor do Supabase.
-- Não executa DROP/CASCADE nem importa o banco SQLite legado.
-- Defina Supabase Auth > Providers > Email: Confirm email = ON.
-- NÃO execute este script num projeto que já tenha tabelas homônimas de outra aplicação.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ra text unique,
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  grade text check (grade is null or char_length(grade) between 2 and 90),
  birth_date date,
  role text not null default 'aluno' check (role in ('aluno','secretaria','admin')),
  verified boolean not null default false,
  active boolean not null default true,
  late_count integer not null default 0 check (late_count >= 0),
  unjustified_count integer not null default 0 check (unjustified_count >= 0),
  late_limit integer not null default 5 check (late_limit >= 1),
  blocked boolean not null default false,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  check (role <> 'aluno' or (ra is not null and grade is not null and birth_date is not null)),
  check (unjustified_count <= late_count)
);

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('secretaria','admin')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create table if not exists public.attendance_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  justified boolean not null default false,
  reason text not null default '' check (char_length(reason) <= 500),
  operator_id uuid references public.profiles(id) on delete set null
);
create index if not exists attendance_student_date_idx on public.attendance_events(student_id, occurred_at desc);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_id uuid,
  detail text check (char_length(detail) <= 500)
);
create index if not exists audit_created_idx on public.audit_events(created_at desc);

create table if not exists public.period_resets (
  id bigint generated always as identity primary key,
  scheduled_for date not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  cancelled_at timestamptz,
  check (not (executed_at is not null and cancelled_at is not null))
);
create index if not exists reset_pending_idx on public.period_resets(scheduled_for) where executed_at is null and cancelled_at is null;

alter table public.profiles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.attendance_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.period_resets enable row level security;

-- Apenas leitura pela Data API. Todas as mutações são RPCs autorizadas e transacionais.
revoke all on public.profiles, public.staff_invites, public.attendance_events, public.audit_events, public.period_resets from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.attendance_events, public.audit_events, public.period_resets to authenticated;
-- Nenhum SELECT direto em staff_invites: os convites só são criados pelo RPC admin.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists (
  select 1 from public.profiles p where p.id = (select auth.uid())
  and p.role in ('secretaria','admin') and p.active and p.verified and p.archived_at is null
); $$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists (
  select 1 from public.profiles p where p.id = (select auth.uid())
  and p.role = 'admin' and p.active and p.verified and p.archived_at is null
); $$;
revoke all on function public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.is_staff(), public.is_admin() to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (verified and (select public.is_staff())));
create policy history_read on public.attendance_events for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy audit_admin_read on public.audit_events for select to authenticated
using ((select public.is_admin()));
create policy resets_admin_read on public.period_resets for select to authenticated
using ((select public.is_admin()));
-- Sem políticas de INSERT/UPDATE/DELETE em tabelas acessíveis: negadas pelo RLS e GRANT.

-- Criação de perfis no servidor. Os metadados de cadastro nunca concedem cargos.
create or replace function private.create_portal_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  invite public.staff_invites%rowtype;
  email_lower text := lower(trim(coalesce(new.email, '')));
  display_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  grade_input text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'grade', '')), '');
  date_input text := nullif(new.raw_user_meta_data ->> 'birth_date', '');
  student_ra text;
begin
  select * into invite from public.staff_invites i
    where i.email = email_lower and i.used_at is null and i.expires_at > now() for update;
  if found then
    if char_length(display_name) < 3 or char_length(display_name) > 120 then
      raise exception 'Informe o nome completo';
    end if;
    insert into public.profiles(id, full_name, role, verified)
    values(new.id, display_name, invite.role, new.email_confirmed_at is not null);
    update public.staff_invites set used_at = now(), used_by = new.id where id = invite.id;
  elsif email_lower ~ '^[0-9]{7,16}(sp)?@al[.]educacao[.]sp[.]gov[.]br$' then
    student_ra := split_part(email_lower, '@', 1);
    if char_length(display_name) < 3 or char_length(display_name) > 120
       or grade_input is null or char_length(grade_input) > 90
       or date_input is null or date_input !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or date_input::date > current_date
       or date_input::date < current_date - interval '110 years' then
      raise exception 'Cadastro escolar incompleto ou inválido';
    end if;
    insert into public.profiles(id, ra, full_name, grade, birth_date, role, verified)
    values(new.id, student_ra, display_name, grade_input, date_input::date, 'aluno', new.email_confirmed_at is not null);
  else
    raise exception 'E-mail escolar inválido ou convite da equipe inexistente';
  end if;
  return new;
end; $$;

create or replace function private.sync_portal_verification()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    -- Alterar o e-mail invalida o acesso até revisão manual da secretaria.
    update public.profiles set verified = false, active = false where id = new.id;
  elsif new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.profiles set verified = (new.email_confirmed_at is not null)
    where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_portal_user_created on auth.users;
create trigger on_portal_user_created after insert on auth.users
for each row execute function private.create_portal_profile();
drop trigger if exists on_portal_user_updated on auth.users;
create trigger on_portal_user_updated after update of email,email_confirmed_at on auth.users
for each row execute function private.sync_portal_verification();

create or replace function public.record_lateness(p_student uuid, p_justified boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare s public.profiles%rowtype; actor uuid := auth.uid();
begin
  if actor is null or not public.is_staff() then raise exception 'Operação não autorizada'; end if;
  if p_student is null or p_justified is null or char_length(coalesce(p_reason,'')) > 500 then
    raise exception 'Dados inválidos'; end if;
  select * into s from public.profiles where id=p_student for update;
  if not found or s.role <> 'aluno' or not s.active or not s.verified or s.archived_at is not null then
    raise exception 'Aluno indisponível'; end if;
  if s.blocked then raise exception 'Aluno bloqueado: procure a coordenação'; end if;
  insert into public.attendance_events(student_id,justified,reason,operator_id)
  values(p_student,p_justified,left(trim(coalesce(p_reason,'')),500),actor);
  update public.profiles set late_count=s.late_count+1,
    unjustified_count=s.unjustified_count+(case when p_justified then 0 else 1 end),
    blocked=(s.unjustified_count+(case when p_justified then 0 else 1 end) >= s.late_limit)
  where id=p_student;
  insert into public.audit_events(actor_id,action,subject_id) values(actor,'REGISTER_LATENESS',p_student);
end; $$;

create or replace function public.student_action(p_student uuid, p_action text, p_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare s public.profiles%rowtype; actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  if p_action not in ('forgive','reset','archive','restore') or char_length(coalesce(p_reason,'')) > 500 then
    raise exception 'Ação inválida'; end if;
  if p_action in ('archive','reset','restore') and char_length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Informe o motivo (mínimo de 5 caracteres)'; end if;
  select * into s from public.profiles where id=p_student and role='aluno' for update;
  if not found then raise exception 'Aluno não encontrado'; end if;
  if p_action = 'archive' then
    if s.archived_at is not null then raise exception 'Aluno já arquivado'; end if;
    update public.profiles set active=false, archived_at=now(), archive_reason=trim(p_reason) where id=p_student;
  elsif p_action = 'restore' then
    if s.archived_at is null then raise exception 'Aluno não está arquivado'; end if;
    update public.profiles set active=true, archived_at=null, archive_reason=null where id=p_student;
  elsif p_action = 'reset' then
    if s.archived_at is not null then raise exception 'Aluno arquivado'; end if;
    update public.profiles set late_count=0, unjustified_count=0,late_limit=5,blocked=false where id=p_student;
  elsif p_action = 'forgive' then
    if s.archived_at is not null then raise exception 'Aluno arquivado'; end if;
    update public.profiles set late_limit=greatest(s.late_limit,s.unjustified_count+1),blocked=false where id=p_student;
  end if;
  insert into public.audit_events(actor_id,action,subject_id,detail) values(actor,upper(p_action),p_student,left(trim(p_reason),500));
end; $$;

create or replace function public.create_staff_invite(p_email text,p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare em text := lower(trim(coalesce(p_email,''))); actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  if em !~ '^[^@[:space:]]{1,90}@[^@[:space:]]{1,90}[.][^@[:space:]]{2,40}$' or p_role not in ('secretaria','admin') then
    raise exception 'Convite inválido'; end if;
  if exists(select 1 from auth.users where lower(email)=em) then raise exception 'Conta já cadastrada'; end if;
  insert into public.staff_invites(email,role,invited_by) values(em,p_role)
  on conflict(email) do update set role=excluded.role,invited_by=excluded.invited_by,
    expires_at=now()+interval '14 days',used_at=null,used_by=null
    where public.staff_invites.used_at is null;
  if not found then raise exception 'Convite já utilizado'; end if;
  insert into public.audit_events(actor_id,action,detail) values(actor,'STAFF_INVITE',p_role);
end; $$;

create or replace function public.change_staff_role(p_user uuid,p_role text,p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid(); p public.profiles%rowtype;
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  if p_user = actor or p_role not in ('secretaria','admin') or p_active is null then
    raise exception 'Alteração inválida'; end if;
  select * into p from public.profiles where id=p_user and role in ('secretaria','admin') for update;
  if not found then raise exception 'Integrante não encontrado'; end if;
  update public.profiles set role=p_role, active=p_active where id=p_user;
  insert into public.audit_events(actor_id,action,subject_id,detail) values(actor,'STAFF_ROLE',p_user,p_role || '/' || p_active::text);
end; $$;

create or replace function public.schedule_period_reset(p_date date)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  if p_date is null or p_date < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe uma data atual ou futura'; end if;
  insert into public.period_resets(scheduled_for,created_by) values(p_date,actor);
  insert into public.audit_events(actor_id,action,detail) values(actor,'RESET_SCHEDULED',p_date::text);
end; $$;

create or replace function public.cancel_period_reset(p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  update public.period_resets set cancelled_at=now() where id=p_id and executed_at is null and cancelled_at is null;
  if not found then raise exception 'Agendamento não encontrado ou já executado'; end if;
  insert into public.audit_events(actor_id,action,detail) values(actor,'RESET_CANCELLED',p_id::text);
end; $$;

create or replace function public.reset_period_now()
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'Operação reservada à administração'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21945, 17);
  update public.profiles set late_count=0,unjustified_count=0,late_limit=5,blocked=false
    where role='aluno' and archived_at is null;
  insert into public.audit_events(actor_id,action) values(actor,'RESET_PERIOD_NOW');
end; $$;

-- Serviço interno do Postgres, executado somente pelo agendador privilegiado.
create or replace function private.process_due_resets()
returns void language plpgsql security definer set search_path = ''
as $$
declare pending_count integer; today_local date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform pg_catalog.pg_advisory_xact_lock(21945, 17);
  select count(*) into pending_count from public.period_resets
    where scheduled_for<=today_local and executed_at is null and cancelled_at is null;
  if pending_count=0 then return; end if;
  update public.profiles set late_count=0,unjustified_count=0,late_limit=5,blocked=false
    where role='aluno' and archived_at is null;
  update public.period_resets set executed_at=now()
    where scheduled_for<=today_local and executed_at is null and cancelled_at is null;
  insert into public.audit_events(action,detail) values('RESET_PERIOD_SCHEDULED',pending_count::text || ' agendamento(s)');
end; $$;

revoke all on function private.create_portal_profile(),private.sync_portal_verification(),
 private.process_due_resets() from public, anon, authenticated;
-- As RPCs públicas abaixo executam com verificação interna de perfil e sessão.
revoke all on function public.record_lateness(uuid,boolean,text),
 public.student_action(uuid,text,text),public.create_staff_invite(text,text),
 public.change_staff_role(uuid,text,boolean),public.schedule_period_reset(date),
 public.cancel_period_reset(bigint),public.reset_period_now() from public,anon;
grant execute on function public.record_lateness(uuid,boolean,text),
 public.student_action(uuid,text,text),public.create_staff_invite(text,text),
 public.change_staff_role(uuid,text,boolean),public.schedule_period_reset(date),
 public.cancel_period_reset(bigint),public.reset_period_now() to authenticated;

-- Admin inicial: faça cadastro, CONFIRME E-MAIL e execute substituindo pelo UUID de Auth > Users:
-- update public.profiles set role='admin' where id='UUID-DO-ADMIN'::uuid and verified=true;
-- Não existe senha administrativa padrão. Não cole service_role no GitHub Pages.
