// Junta as atualizações pendentes do banco em um arquivo só, para colar uma vez no SQL Editor do Supabase.
// Uso: node scripts/gerar-instalacao.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const parts = ['10_virada_ano_letivo', '11_keepalive_supabase', '12_armazenamento', '13_equipe_e_otimizacao', '14_calendario_escolar'];
export function bundle() {
 const head = [
  '-- Presença+ | Instalação das atualizações pendentes do banco (10 a 14), na ordem certa.',
  '-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run, como proprietário do banco.',
  '-- Cada parte roda em bloco: se uma falhar, nada dela é aplicado. Rodar de novo não duplica nada.',
  '-- Arquivo gerado por scripts/gerar-instalacao.mjs a partir de sql/10 a sql/14. Não edite à mão.',
  '',
  '-- As tarefas automáticas (virada do ano e limpeza do banco) usam o agendador pg_cron do Supabase.',
  'create extension if not exists pg_cron with schema pg_catalog;'
 ].join('\n');
 return head + parts.map(p => `\n\n-- ===================== sql/${p}.sql =====================\n` + fs.readFileSync(path.join(root, 'sql', p + '.sql'), 'utf8').replace(/\r\n/g, '\n').trimEnd()).join('') + '\n';
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 fs.writeFileSync(path.join(root, 'sql', 'instalar_atualizacoes.sql'), bundle());
 console.log('sql/instalar_atualizacoes.sql atualizado.');
}
