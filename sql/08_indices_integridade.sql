-- Presença+ 5.2 — índices auxiliares de chaves estrangeiras.
-- Migração aditiva aplicada ao projeto Presença+ em 22/09/2026.
-- Não altera conteúdo dos registros, autenticação ou políticas RLS.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists attendance_events_changed_by_idx on public.attendance_events(changed_by);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists period_resets_created_by_idx on public.period_resets(created_by);
create index if not exists privacy_cases_created_by_idx on public.privacy_cases(created_by);
create index if not exists staff_invites_invited_by_idx on public.staff_invites(invited_by);
create index if not exists staff_invites_used_by_idx on public.staff_invites(used_by);
create index if not exists student_adjustments_actor_id_idx on public.student_adjustments(actor_id);
create index if not exists student_adjustments_event_id_idx on public.student_adjustments(event_id);
commit;
