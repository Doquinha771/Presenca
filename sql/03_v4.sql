-- Presença+ 4.0. Migração aditiva sobre sql/01_portal.sql; executar uma vez.
-- Não executar 01_portal.sql novamente em uma instalação existente.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
create table public.portal_migrations(version text primary key, applied_at timestamptz not null default now());
alter table public.portal_migrations enable row level security;
revoke all on public.portal_migrations from public,anon,authenticated;

create table public.school_classes (
 id uuid primary key default gen_random_uuid(), grade text not null check(length(trim(grade)) between 1 and 70),
 name text not null check(length(trim(name)) between 1 and 20), active boolean not null default true, unique(grade,name)
);
create table public.school_enrollments (
 id uuid primary key default gen_random_uuid(), ra text not null unique check(ra ~ '^[0-9]{7,16}(sp)?$'),
 email text not null unique check(email ~ '^[0-9]{7,16}(sp)?@al[.]educacao[.]sp[.]gov[.]br$'),
 full_name text not null check(length(trim(full_name)) between 3 and 120), birth_date date not null,
 class_id uuid not null references public.school_classes(id), active boolean not null default true,
 profile_id uuid unique references public.profiles(id), created_at timestamptz not null default now()
);
create table public.school_settings (
 id boolean primary key default true check(id), default_limit integer not null default 5 check(default_limit between 1 and 100),
 privacy_notice text not null default 'Procure a secretaria para informações sobre o tratamento de seus dados escolares.',
 controller text not null default '', privacy_contact text not null default '', retention_policy text not null default 'Nenhuma exclusão automática de dados escolares.',
 updated_at timestamptz not null default now()
);
insert into public.school_settings(id) values(true);
create table public.student_adjustments (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id),
 action text not null, event_id bigint references public.attendance_events(id), reason text not null check(length(trim(reason)) between 5 and 500),
 actor_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.privacy_cases (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('solicitacao','incidente')),
 description text not null check(length(trim(description)) between 5 and 2000),
 status text not null default 'aberto' check(status in ('aberto','em_analise','concluido')),
 resolution text not null default '', created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 3 and 120),
 body text not null check(length(trim(body)) between 3 and 2000), audience text not null check(audience in ('todos','equipe','aluno')),
 active boolean not null default true, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.profiles add column count_from timestamptz not null default now(), add column baseline_count integer not null default 0,
 add column class_id uuid references public.school_classes(id), add column enrollment_approved boolean not null default false;
-- Preserva contadores já afetados por encerramentos antigos. Não inventa o período anterior.
update public.profiles set baseline_count=unjustified_count where role='aluno';
alter table public.attendance_events add column public_id uuid not null default gen_random_uuid() unique,
 add column request_id uuid unique, add column status text not null default 'active' check(status in ('active','forgiven','void')),
 add column changed_at timestamptz, add column changed_by uuid references public.profiles(id), add column change_reason text;
alter table public.audit_events add column public_id uuid not null default gen_random_uuid() unique;
alter table public.period_resets add column public_id uuid not null default gen_random_uuid() unique;
create index attendance_date_idx on public.attendance_events(occurred_at desc,id desc);
create index attendance_operator_idx on public.attendance_events(operator_id);
create index adjustments_student_idx on public.student_adjustments(student_id,created_at desc);
create index profiles_search_name_idx on public.profiles(lower(full_name) text_pattern_ops) where role='aluno';
create index profiles_class_idx on public.profiles(class_id) where role='aluno';
create index enrollments_class_idx on public.school_enrollments(class_id);

-- Revoga a leitura ampla anterior: data de nascimento só sai pelo RPC da Direção.
revoke select on public.profiles from authenticated;
-- Autorização sempre consulta o cargo atual, nunca user_metadata ou localStorage.
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=''
as $$select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('secretaria','admin') and p.active and p.verified and p.archived_at is null);$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=''
as $$select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active and p.verified and p.archived_at is null);$$;
create function private.require_portal() returns public.profiles language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where id=auth.uid();
 if auth.uid() is null or p.id is null or not p.verified or not p.active or p.archived_at is not null then raise exception 'Sessão sem acesso autorizado' using errcode='42501'; end if;
 return p;
end;$$;
-- RLS também protege chamadas diretas aos históricos de contas suspensas.
drop policy history_read on public.attendance_events;
create policy history_read on public.attendance_events for select to authenticated using (
 public.is_staff() or (student_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.verified and p.archived_at is null))
);
-- Leitura passa somente por projeções autorizadas e paginadas.
revoke select on public.attendance_events,public.audit_events,public.period_resets from authenticated;
do $$declare t text;begin
 foreach t in array array['school_classes','school_enrollments','school_settings','student_adjustments','privacy_cases','announcements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end$$;
-- Sem grants de tabela: RPCs privados validam o usuário e projetam campos por perfil.
-- Políticas de leitura como defesa adicional; os grants diretos continuam revogados.
create policy classes_read on public.school_classes for select to authenticated using ((select public.is_staff()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.verified));
create policy enrollment_admin on public.school_enrollments for select to authenticated using ((select public.is_admin()));
create policy settings_read on public.school_settings for select to authenticated using ((select public.is_staff()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.verified));
create policy adjustments_read on public.student_adjustments for select to authenticated using ((select public.is_staff()) or (student_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.verified)));
create policy privacy_admin on public.privacy_cases for select to authenticated using ((select public.is_admin()));
create policy announcements_read on public.announcements for select to authenticated using (
 (select public.is_admin()) or (active and (audience='todos' or (audience='equipe' and (select public.is_staff())) or (audience='aluno' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='aluno' and p.active and p.verified))) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.verified))
);


create or replace function private.create_portal_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare inv public.staff_invites; e public.school_enrollments; c public.school_classes; em text:=lower(trim(coalesce(new.email,''))); nm text:=trim(coalesce(new.raw_user_meta_data->>'full_name','')); lim integer;
begin
 select * into inv from public.staff_invites where email=em and used_at is null and expires_at>now() for update;
 if found then
  if length(nm) not between 3 and 120 then raise exception 'Informe o nome completo'; end if;
  insert into public.profiles(id,full_name,role,verified) values(new.id,nm,inv.role,new.email_confirmed_at is not null);
  update public.staff_invites set used_at=now(),used_by=new.id where id=inv.id;
 else
  select * into e from public.school_enrollments where email=em and active and profile_id is null for update;
  if not found or em !~ '^[0-9]{7,16}(sp)?@al[.]educacao[.]sp[.]gov[.]br$' then raise exception 'Matrícula não autorizada. Procure a secretaria.'; end if;
  if lower(trim(coalesce(new.raw_user_meta_data->>'ra','')))<>e.ra or coalesce(new.raw_user_meta_data->>'birth_date','')<>e.birth_date::text then raise exception 'Dados diferentes da matrícula autorizada'; end if;
  select * into c from public.school_classes where id=e.class_id and active;
  if not found then raise exception 'Turma inativa';end if;
  select default_limit into lim from public.school_settings where id;
  insert into public.profiles(id,ra,full_name,grade,birth_date,role,verified,late_limit,class_id,enrollment_approved)
  values(new.id,e.ra,e.full_name,c.grade||' • '||c.name,e.birth_date,'aluno',new.email_confirmed_at is not null,lim,c.id,true);
  update public.school_enrollments set profile_id=new.id where id=e.id;
 end if;
 return new;
end;$$;

create function private.portal_read(p_kind text,p_args jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me public.profiles; result jsonb; offst integer:=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
 term text:=lower(trim(coalesce(p_args->>'search',''))); sid uuid:=nullif(p_args->>'student','')::uuid; today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 me:=private.require_portal();
 if p_kind='student_admin' then
  if me.role<>'admin' then raise exception 'Somente a Direção' using errcode='42501';end if;
  return (select jsonb_build_object('id',p.id,'full_name',p.full_name,'ra',p.ra,'birth_date',p.birth_date,'class_id',p.class_id) from public.profiles p where p.id=sid and p.role='aluno');
 end if;
 if p_kind='me' then return to_jsonb(me)-'birth_date'-'baseline_count'-'archive_reason'; end if;
 if p_kind='settings' then return (select to_jsonb(s) from public.school_settings s where id);end if;
 if p_kind='announcements' then return coalesce((select jsonb_agg(x) from (select id,title,body,audience,active,created_at from public.announcements where (active or me.role='admin') and (me.role='admin' or audience='todos' or audience=case when me.role='aluno' then 'aluno' else 'equipe' end) order by created_at desc,id limit 25 offset offst)x),'[]');end if;
 if p_kind='classes' then return coalesce((select jsonb_agg(c order by grade,name) from public.school_classes c where active or me.role='admin'),'[]');end if;
 if p_kind in ('team','enrollments','audit','resets','privacy') and me.role<>'admin' then raise exception 'Somente a Direção' using errcode='42501';end if;
 if p_kind='students' then
  if me.role='aluno' then raise exception 'Acesso negado' using errcode='42501';end if;
  select coalesce(jsonb_agg(x),'[]') into result from (
   select p.id,p.full_name,p.ra,p.grade,p.class_id,p.late_count,p.unjustified_count,p.late_limit,p.blocked,p.active,p.verified,p.archived_at,p.enrollment_approved,
   (select count(*) from public.attendance_events e where e.student_id=p.id) as historical_count
   from public.profiles p where p.role='aluno'
   and ((p_args->>'archived'='true' and p.archived_at is not null) or (coalesce(p_args->>'archived','false')<>'true' and p.archived_at is null))
   and (term='' or lower(p.full_name) like replace(replace(replace(term,'\','\\'),'%','\%'),'_','\_')||'%' or lower(p.ra) like replace(replace(replace(term,'\','\\'),'%','\%'),'_','\_')||'%')
   and (nullif(p_args->>'class','') is null or p.class_id=(p_args->>'class')::uuid)
   and (coalesce(p_args->>'situation','')='' or (p_args->>'situation'='blocked' and p.blocked) or (p_args->>'situation'='warning' and not p.blocked and p.unjustified_count>=p.late_limit-1) or (p_args->>'situation'='regular' and not p.blocked and p.unjustified_count<p.late_limit-1))
   order by p.full_name,p.id limit 25 offset offst)x;return result;
 elsif p_kind='history' then
  if me.role='aluno' then
   if sid is not null and sid<>me.id then raise exception 'Acesso negado' using errcode='42501';end if;
   sid:=me.id;
  end if;
  return coalesce((select jsonb_agg(x) from (
   select e.public_id as id,e.student_id,p.full_name,p.grade,e.occurred_at,e.justified,e.reason,e.status,e.operator_id,o.full_name as operator_name,e.change_reason,e.changed_at,
   (e.status='active' and e.operator_id=me.id and now()-e.occurred_at<=interval '2 minutes') as can_undo
   from public.attendance_events e join public.profiles p on p.id=e.student_id left join public.profiles o on o.id=e.operator_id
   where (sid is null or e.student_id=sid)
   and (nullif(p_args->>'class','') is null or p.class_id=(p_args->>'class')::uuid)
   and (nullif(p_args->>'from','') is null or e.occurred_at >= ((p_args->>'from')::date::timestamp at time zone 'America/Sao_Paulo'))
   and (nullif(p_args->>'to','') is null or e.occurred_at < (((p_args->>'to')::date+1)::timestamp at time zone 'America/Sao_Paulo'))
   and (coalesce(p_args->>'status','')='' or e.status=p_args->>'status')
   order by e.occurred_at desc,e.id desc limit 25 offset offst)x),'[]');
 elsif p_kind='adjustments' then
  if me.role='aluno' then sid:=me.id; end if;
  return coalesce((select jsonb_agg(x) from(select a.id,a.student_id,p.full_name,a.action,a.reason,a.created_at from public.student_adjustments a join public.profiles p on p.id=a.student_id where sid is null or a.student_id=sid order by a.created_at desc,a.id limit 25 offset offst)x),'[]');
 elsif p_kind='dashboard' then
  if me.role='aluno' then return jsonb_build_object('historical',(select count(*) from public.attendance_events where student_id=me.id),'forgiven',(select count(*) from public.attendance_events where student_id=me.id and status='forgiven'),'count',me.unjustified_count,'limit',me.late_limit,'blocked',me.blocked);end if;
  return jsonb_build_object('students',(select count(*) from public.profiles where role='aluno' and archived_at is null),
   'today',(select count(*) from public.attendance_events where occurred_at >= (today::timestamp at time zone 'America/Sao_Paulo') and status<>'void'),
   'week',(select count(*) from public.attendance_events where occurred_at >= (date_trunc('week',today::timestamp) at time zone 'America/Sao_Paulo') and status<>'void'),
   'month',(select count(*) from public.attendance_events where occurred_at >= (date_trunc('month',today::timestamp) at time zone 'America/Sao_Paulo') and status<>'void'),
   'warning',(select count(*) from public.profiles where role='aluno' and archived_at is null and not blocked and unjustified_count>=late_limit-1),
   'blocked',(select count(*) from public.profiles where role='aluno' and archived_at is null and blocked),
   'trend',(select coalesce(jsonb_agg(x),'[]') from(select d::date as day,count(e.id) as total from generate_series(today-13,today,interval '1 day')d left join public.attendance_events e on (e.occurred_at at time zone 'America/Sao_Paulo')::date=d::date and e.status<>'void' group by d order by d)x),
   'classes',(select coalesce(jsonb_agg(x),'[]') from(select p.grade,count(distinct p.id) as students,count(e.id) as total from public.profiles p left join public.attendance_events e on e.student_id=p.id and e.status<>'void' and e.occurred_at>=(date_trunc('month',today::timestamp) at time zone 'America/Sao_Paulo') where p.role='aluno' and p.archived_at is null group by p.grade order by p.grade)x));
 elsif p_kind='team' then return coalesce((select jsonb_agg(x) from(select id,full_name,role,active,verified from public.profiles where role in ('admin','secretaria') order by full_name,id limit 25 offset offst)x),'[]');
 elsif p_kind='enrollments' then return coalesce((select jsonb_agg(x) from(select e.*,c.grade,c.name as class_name from public.school_enrollments e join public.school_classes c on c.id=e.class_id where term='' or lower(e.full_name) like term||'%' or e.ra like term||'%' order by e.full_name,e.id limit 25 offset offst)x),'[]');
 elsif p_kind='audit' then return coalesce((select jsonb_agg(x) from(select a.public_id as id,a.created_at,a.action,a.subject_id,a.detail,p.full_name as actor_name from public.audit_events a left join public.profiles p on p.id=a.actor_id order by a.created_at desc,a.id desc limit 25 offset offst)x),'[]');
 elsif p_kind='resets' then return coalesce((select jsonb_agg(x) from(select id,scheduled_for,executed_at,cancelled_at from public.period_resets order by scheduled_for desc,id desc limit 25 offset offst)x),'[]');
 elsif p_kind='privacy' then return coalesce((select jsonb_agg(x) from(select * from public.privacy_cases order by created_at desc,id limit 25 offset offst)x),'[]');
 end if;
 raise exception 'Consulta desconhecida';
end;$$;

create function private.recount(p_student uuid) returns void language plpgsql security definer set search_path='' as $$
declare n integer; s public.profiles;
begin
 select * into s from public.profiles where id=p_student for update;
 select s.baseline_count+count(*)::integer into n from public.attendance_events where student_id=p_student and occurred_at>=s.count_from and status='active' and not justified;
 update public.profiles set unjustified_count=n,late_count=greatest(late_count,n),blocked=(n>=late_limit) where id=p_student;
end;$$;
create function private.portal_write(p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.profiles; s public.profiles; ev public.attendance_events; rid uuid; sid uuid; cl public.school_classes; en public.school_enrollments; v_reason text:=trim(coalesce(p_args->>'reason','')); result jsonb:='{}'; oldrole text;
begin
 me:=private.require_portal();
 if me.role='aluno' then raise exception 'Operação institucional' using errcode='42501';end if;
 if p_action not in ('record','undo') and me.role<>'admin' then raise exception 'Operação reservada à Direção' using errcode='42501';end if;
 if p_action in ('chance','forgive','correct','undo','archive','restore','approve','edit_student','reset_student','role') and length(v_reason) not between 5 and 500 then raise exception 'Informe justificativa de 5 a 500 caracteres';end if;
 -- Mesmo lock compartilhado para eventos e mudanças administrativas; reset usa lock exclusivo.
 perform pg_catalog.pg_advisory_xact_lock_shared(21945,17);
 if p_action in ('record','chance','archive','restore','approve','edit_student','reset_student') then
  sid:=(p_args->>'student')::uuid;
  select * into s from public.profiles where id=sid and role='aluno' for update;
  if not found then raise exception 'Aluno não encontrado';end if;
 end if;
 if p_action='record' then
  rid:=(p_args->>'request')::uuid;
  if rid is null then raise exception 'Identificador obrigatório';end if;
  select * into ev from public.attendance_events where request_id=rid;
  if found then
   if ev.student_id<>sid or ev.operator_id<>me.id then raise exception 'Identificador de operação inválido';end if;
   return jsonb_build_object('id',ev.public_id,'duplicate',true);
  end if;
  if not s.active or not s.verified or s.archived_at is not null then raise exception 'Aluno indisponível';end if;
  if not s.enrollment_approved then raise exception 'Matrícula precisa ser validada pela Direção';end if;
  if s.blocked or s.unjustified_count>=s.late_limit then raise exception 'Limite atingido. Encaminhe à Direção.';end if;
  if exists(select 1 from public.attendance_events where student_id=sid and status<>'void' and occurred_at>clock_timestamp()-interval '2 minutes') then raise exception 'Este aluno já possui um registro nos últimos dois minutos';end if;
  if length(v_reason)>500 then raise exception 'Observação muito longa';end if;
  insert into public.attendance_events(student_id,operator_id,reason,request_id,occurred_at) values(sid,me.id,v_reason,rid,clock_timestamp()) returning * into ev;
  update public.profiles set late_count=late_count+1 where id=sid;
  perform private.recount(sid);
  result:=jsonb_build_object('id',ev.public_id,'occurred_at',ev.occurred_at);
 elsif p_action in ('undo','forgive','correct') then
  select student_id into sid from public.attendance_events where public_id=(p_args->>'event')::uuid;
  select * into s from public.profiles where id=sid for update;
  select * into ev from public.attendance_events where public_id=(p_args->>'event')::uuid for update;
  if not found then raise exception 'Ocorrência não encontrada';end if;
  if p_action='undo' and (ev.operator_id is distinct from me.id or clock_timestamp()-ev.occurred_at>interval '2 minutes' or ev.status<>'active') then raise exception 'Desfazimento expirado ou não autorizado. Solicite correção à Direção.';end if;
  if ev.status='void' or (p_action='forgive' and ev.status='forgiven') then raise exception 'Ocorrência já tratada';end if;
  update public.attendance_events set status=case when p_action='forgive' then 'forgiven' else 'void' end, changed_at=now(),changed_by=me.id,change_reason=v_reason where id=ev.id;
  -- Legados anteriores à migração têm contagem consolidada; não inferir sua participação no período.
  if ev.occurred_at<s.count_from then result:=jsonb_build_object('notice','Histórico atualizado. Contagem consolidada anterior preservada.');end if;
  perform private.recount(sid);
  insert into public.student_adjustments(student_id,action,event_id,reason,actor_id) values(sid,p_action,ev.id,v_reason,me.id);
 elsif p_action='chance' then
  if s.archived_at is not null then raise exception 'Aluno arquivado';end if;
  update public.profiles set late_limit=late_limit+1,blocked=(unjustified_count>=late_limit+1) where id=sid;
  insert into public.student_adjustments(student_id,action,reason,actor_id) values(sid,'chance',v_reason,me.id);
 elsif p_action in ('archive','restore','approve','reset_student') then
  if p_action='archive' then update public.profiles set active=false,archived_at=now(),archive_reason=v_reason where id=sid;
  elsif p_action='restore' then update public.profiles set active=true,archived_at=null,archive_reason=null where id=sid;
  elsif p_action='approve' then update public.profiles set enrollment_approved=true where id=sid;
  else update public.profiles set count_from=clock_timestamp(),baseline_count=0,late_count=0,unjustified_count=0,late_limit=(select default_limit from public.school_settings where id),blocked=false where id=sid;
  end if;
  insert into public.student_adjustments(student_id,action,reason,actor_id) values(sid,p_action,v_reason,me.id);
 elsif p_action='edit_student' then
  select * into cl from public.school_classes where id=(p_args->>'class')::uuid and active;
  if not found or length(trim(p_args->>'name')) not between 3 and 120 or coalesce(p_args->>'ra','') !~ '^[0-9]{7,16}(sp)?$' or nullif(p_args->>'birth','') is null or (p_args->>'birth')::date>current_date or (p_args->>'birth')::date<current_date-interval '110 years' then raise exception 'Dados escolares inválidos';end if;
  update public.profiles set ra=p_args->>'ra',birth_date=(p_args->>'birth')::date,full_name=trim(p_args->>'name'),grade=cl.grade||' • '||cl.name,class_id=cl.id where id=sid;
  update public.school_enrollments set ra=p_args->>'ra',birth_date=(p_args->>'birth')::date,full_name=trim(p_args->>'name'),class_id=cl.id where profile_id=sid;
  insert into public.student_adjustments(student_id,action,reason,actor_id) values(sid,p_action,v_reason,me.id);
 elsif p_action='class' then
  insert into public.school_classes(id,grade,name,active) values(coalesce(nullif(p_args->>'id','')::uuid,gen_random_uuid()),trim(p_args->>'grade'),trim(p_args->>'name'),coalesce((p_args->>'active')::boolean,true))
  on conflict(id) do update set grade=excluded.grade,name=excluded.name,active=excluded.active returning * into cl;
  update public.profiles set grade=cl.grade||' • '||cl.name where class_id=cl.id;
 elsif p_action='enrollment' then
  if (p_args->>'birth')::date>current_date or (p_args->>'birth')::date<current_date-interval '110 years' then raise exception 'Data inválida';end if;
  select * into cl from public.school_classes where id=(p_args->>'class')::uuid and active;
  if not found then raise exception 'Turma inválida';end if;
  insert into public.school_enrollments(id,ra,email,full_name,birth_date,class_id,active)
  values(coalesce(nullif(p_args->>'id','')::uuid,gen_random_uuid()),lower(trim(p_args->>'ra')),lower(trim(p_args->>'email')),trim(p_args->>'name'),(p_args->>'birth')::date,cl.id,coalesce((p_args->>'active')::boolean,true))
  on conflict(id) do update set ra=excluded.ra,email=excluded.email,full_name=excluded.full_name,birth_date=excluded.birth_date,class_id=excluded.class_id,active=excluded.active returning * into en;
  if en.profile_id is not null then
   -- E-mail da identidade Auth não é alterado por este formulário.
   if exists(select 1 from auth.users where id=en.profile_id and lower(email)<>en.email) then raise exception 'Para alterar e-mail, revise a identidade em Supabase Auth';end if;
   update public.profiles set ra=en.ra,full_name=en.full_name,birth_date=en.birth_date,class_id=en.class_id,grade=cl.grade||' • '||cl.name,active=en.active where id=en.profile_id;
  end if;
 elsif p_action='settings' then
  update public.school_settings set default_limit=(p_args->>'limit')::integer,controller=left(trim(p_args->>'controller'),200),privacy_contact=left(trim(p_args->>'contact'),200),privacy_notice=left(trim(p_args->>'notice'),4000),retention_policy=left(trim(p_args->>'retention'),2000),updated_at=now() where id;
 elsif p_action='privacy' then
  insert into public.privacy_cases(id,kind,description,status,resolution,created_by) values(coalesce(nullif(p_args->>'id','')::uuid,gen_random_uuid()),p_args->>'kind',trim(p_args->>'description'),coalesce(p_args->>'status','aberto'),left(coalesce(p_args->>'resolution',''),2000),me.id)
  on conflict(id) do update set status=excluded.status,resolution=excluded.resolution,updated_at=now();
 elsif p_action='announcement' then
  insert into public.announcements(id,title,body,audience,active,created_by) values(coalesce(nullif(p_args->>'id','')::uuid,gen_random_uuid()),trim(p_args->>'title'),trim(p_args->>'body'),p_args->>'audience',coalesce((p_args->>'active')::boolean,true),me.id)
  on conflict(id) do update set title=excluded.title,body=excluded.body,audience=excluded.audience,active=excluded.active;
 elsif p_action='role' then
  -- Serializa mudanças na equipe para impedir que dois administradores removam um ao outro simultaneamente.
  perform pg_catalog.pg_advisory_xact_lock(21945,18);
  if not public.is_admin() then raise exception 'Permissão alterada. Entre novamente.' using errcode='42501';end if;
  perform public.change_staff_role((p_args->>'user')::uuid,p_args->>'role',(p_args->>'active')::boolean);
 else raise exception 'Ação desconhecida';
 end if;
 insert into public.audit_events(actor_id,action,subject_id,detail) values(me.id,'V4_'||upper(p_action),sid,case when p_action in ('privacy','enrollment','settings') then 'Alteração institucional registrada' else left(v_reason,500) end);
 return result;
end;$$;
-- API pública mínima, sem privilégios de proprietário. Definers ficam no schema privado.
create function public.portal_read(p_kind text,p_args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.portal_read(p_kind,p_args);$$;
create function public.portal_write(p_action text,p_args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.portal_write(p_action,p_args);$$;
revoke all on function private.require_portal(),private.recount(uuid),private.portal_read(text,jsonb),private.portal_write(text,jsonb),public.portal_read(text,jsonb),public.portal_write(text,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.portal_read(text,jsonb),private.portal_write(text,jsonb),public.portal_read(text,jsonb),public.portal_write(text,jsonb) to authenticated;
-- Remove os caminhos antigos que ignorariam idempotência, matrícula e novas regras.
revoke all on function public.record_lateness(uuid,boolean,text),public.student_action(uuid,text,text),public.change_staff_role(uuid,text,boolean) from public,anon,authenticated;

create or replace function public.reset_period_now() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Somente Direção' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(21945,17);
 update public.profiles set count_from=clock_timestamp(),baseline_count=0,late_count=0,unjustified_count=0,late_limit=(select default_limit from public.school_settings where id),blocked=false where role='aluno' and archived_at is null;
 insert into public.audit_events(actor_id,action) values(auth.uid(),'RESET_PERIOD_NOW');
end;$$;
create or replace function private.process_due_resets() returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(21945,17);
 select count(*) into n from public.period_resets where scheduled_for<=(now() at time zone 'America/Sao_Paulo')::date and executed_at is null and cancelled_at is null;
 if n=0 then return;end if;
 update public.profiles set count_from=clock_timestamp(),baseline_count=0,late_count=0,unjustified_count=0,late_limit=(select default_limit from public.school_settings where id),blocked=false where role='aluno' and archived_at is null;
 update public.period_resets set executed_at=now() where scheduled_for<=(now() at time zone 'America/Sao_Paulo')::date and executed_at is null and cancelled_at is null;
 insert into public.audit_events(action,detail) values('RESET_PERIOD_SCHEDULED',n::text);
end;$$;
insert into public.portal_migrations(version) values('4.0.0');
notify pgrst,'reload schema';
commit;
