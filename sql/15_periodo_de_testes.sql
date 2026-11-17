-- Presença+ 5.3 | Período de testes: relatos de problemas e erros registrados automaticamente.
-- Instalar APÓS 14_calendario_escolar.sql, no SQL Editor do Supabase, como proprietário do banco.
--
-- O que faz:
--  * qualquer pessoa logada (aluno ou equipe) envia um relato: erro, algo confuso, lentidão ou sugestão;
--  * o portal também envia sozinho os erros técnicos que acontecerem na tela (iguais são somados, não repetidos);
--  * só a Direção lê os relatos e marca como resolvido (Sistema › Testes);
--  * cada pessoa envia no máximo 40 relatos por dia, para um erro em laço não encher o banco.
-- Pode rodar mais de uma vez: nada é duplicado.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

do $check$
begin
 if to_regprocedure('private.calendar_manage(text,jsonb)') is null then
  raise exception 'Instale antes o arquivo 14_calendario_escolar.sql';
 end if;
end;
$check$;

create table if not exists public.test_reports (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 user_id uuid references public.profiles(id) on delete set null,
 role text not null default '',
 kind text not null check(kind in ('erro','confuso','lento','sugestao','automatico')),
 page text not null default '' check(char_length(page)<=60),
 device text not null default '' check(char_length(device)<=200),
 version text not null default '' check(char_length(version)<=20),
 message text not null check(char_length(message) between 3 and 2000),
 occurrences integer not null default 1 check(occurrences>=1),
 status text not null default 'aberto' check(status in ('aberto','resolvido')),
 resolved_by uuid references public.profiles(id) on delete set null,
 resolved_at timestamptz
);
create index if not exists test_reports_recent on public.test_reports(created_at desc);
create index if not exists test_reports_user_day on public.test_reports(user_id,created_at);
alter table public.test_reports enable row level security;
revoke all on public.test_reports from public, anon, authenticated;

create or replace function private.test_feedback(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $tf$
declare
 me public.profiles; v jsonb:=coalesce(p_args,'{}'::jsonb);
 k text:=coalesce(v->>'kind','erro');
 msg text:=left(trim(coalesce(v->>'message','')),2000);
 pg text:=left(coalesce(v->>'page',''),60);
 dev text:=left(coalesce(v->>'device',''),200);
 ver text:=left(coalesce(v->>'version',''),20);
 today_count integer; existing bigint; rid bigint;
begin
 me:=private.require_portal();

 if p_action='add' then
  if k not in ('erro','confuso','lento','sugestao','automatico') then raise exception 'Tipo de relato inválido' using errcode='22023'; end if;
  if char_length(msg)<3 then raise exception 'Escreva o que aconteceu (pelo menos 3 letras)' using errcode='22023'; end if;
  -- Erro automático igual ao de antes (mesma pessoa, mesma tela, última hora): só soma.
  if k='automatico' then
   select r.id into existing from public.test_reports r
    where r.user_id=me.id and r.kind='automatico' and r.message=msg and r.page=pg and r.last_seen_at>now()-interval '1 hour'
    order by r.id desc limit 1;
   if existing is not null then
    update public.test_reports set occurrences=occurrences+1,last_seen_at=now() where id=existing;
    return jsonb_build_object('id',existing,'merged',true);
   end if;
  end if;
  select count(*) into today_count from public.test_reports r where r.user_id=me.id and r.created_at>now()-interval '1 day';
  if today_count>=40 then raise exception 'Limite de relatos de hoje atingido. Obrigado pela ajuda! Tente amanhã.' using errcode='54000'; end if;
  insert into public.test_reports(user_id,role,kind,page,device,version,message)
   values(me.id,me.role,k,pg,dev,ver,msg) returning id into rid;
  return jsonb_build_object('id',rid);
 end if;

 if me.role<>'admin' then raise exception 'Somente a Direção vê os relatos do período de testes' using errcode='42501'; end if;

 if p_action='list' then
  return jsonb_build_object(
   'open',(select count(*) from public.test_reports where status='aberto'),
   'resolved',(select count(*) from public.test_reports where status='resolvido'),
   'auto',(select coalesce(sum(occurrences),0) from public.test_reports where kind='automatico'),
   'rows',coalesce((select jsonb_agg(x order by x.created_at desc) from (
     select r.id,r.created_at,r.last_seen_at,r.role,r.kind,r.page,r.device,r.version,r.message,r.occurrences,r.status,
      coalesce(p.full_name,'Conta removida') as full_name
     from public.test_reports r left join public.profiles p on p.id=r.user_id
     where (coalesce(v->>'status','')='' or r.status=v->>'status')
     order by r.created_at desc limit 200) x),'[]'::jsonb));
 elsif p_action in ('resolve','reopen') then
  rid:=nullif(v->>'id','')::bigint;
  update public.test_reports set status=case when p_action='resolve' then 'resolvido' else 'aberto' end,
   resolved_by=case when p_action='resolve' then me.id end,resolved_at=case when p_action='resolve' then now() end
   where id=rid;
  if not found then raise exception 'Relato não encontrado' using errcode='P0002'; end if;
  return jsonb_build_object('id',rid);
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end;
$tf$;

create or replace function public.test_feedback(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $wrap$
 select private.test_feedback(p_action,p_args);
$wrap$;
revoke all on function private.test_feedback(text,jsonb), public.test_feedback(text,jsonb) from public, anon, authenticated;
grant execute on function private.test_feedback(text,jsonb), public.test_feedback(text,jsonb) to authenticated;

insert into public.portal_migrations(version) values('5.3.0-periodo-de-testes') on conflict(version) do nothing;
commit;
