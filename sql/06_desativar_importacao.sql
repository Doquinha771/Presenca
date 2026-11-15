-- Desativa a API de importação caso uma versão anterior tenha sido aplicada.
-- Não altera matrículas, contas, ocorrências ou histórico.
BEGIN;
DROP FUNCTION IF EXISTS public.portal_import_batch(text,jsonb);
COMMIT;
