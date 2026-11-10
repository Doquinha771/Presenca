# Keepalive do Supabase — 28/09/2026

O Presença+ usa Supabase no plano Free. Projetos com baixa atividade podem ser pausados automaticamente após uma janela de sete dias. Para criar margem de segurança, a versão 5.3.1 adiciona um workflow diário do GitHub Actions.

## Funcionamento

- `.github/workflows/supabase-keepalive.yml` executa diariamente e também aceita execução manual.
- `scripts/supabase-keepalive.mjs` faz três chamadas leves ao RPC `project_keepalive`, com pequenos intervalos.
- `sql/11_keepalive_supabase.sql` cria um RPC `SECURITY INVOKER` que apenas retorna o horário do banco.
- A chave utilizada é publicável; nenhuma `service_role` ou `sb_secret_` é armazenada no workflow.
- O RPC não consulta nem altera dados de alunos, matrículas, histórico ou auditoria.

## Por que não aguardar cinco dias

O Supabase informa que projetos Free são avaliados por baixa atividade em uma janela de sete dias e que algumas consultas de usuário por dia normalmente bastam para evitar a pausa. Por isso, esperar cinco dias deixa pouca margem para atraso ou falha do agendamento. Três chamadas diárias representam cerca de 90 requisições mensais e têm custo operacional desprezível para este projeto.

## Limites

O GitHub pode atrasar execuções agendadas e workflows podem ser desativados por políticas da própria plataforma. O keepalive reduz o risco de pausa por inatividade, mas não é garantia de disponibilidade do plano Free.
