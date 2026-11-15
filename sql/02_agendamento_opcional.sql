-- Execute após 01_portal.sql se quiser reset automático sem servidor local.
-- Supabase Dashboard > Database > Extensions: ative pg_cron (se disponível no seu plano).
-- Execute como proprietário do banco, no SQL Editor. Agendamento: a cada hora.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('presenca_period_reset', '0 * * * *', 'select private.process_due_resets();');
-- Para desativar: select cron.unschedule('presenca_period_reset');
