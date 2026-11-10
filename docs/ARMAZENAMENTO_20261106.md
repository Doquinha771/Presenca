# Controle de armazenamento do banco (5.4)

O plano gratuito do Supabase permite **500 MB** de banco de dados. A migração `sql/12_armazenamento.sql` mantém o Presença+ abaixo desse limite.

## Como instalar

1. Abra o Supabase › SQL Editor.
2. Cole e execute o conteúdo de `sql/12_armazenamento.sql` (depois da `11_keepalive_supabase.sql`).
3. Confira em Database › Extensions que o **pg_cron** está ativo (ele já é usado pela virada de ano letivo).

Pronto: a Direção passa a ver a área **Armazenamento** no menu da conta.

## Como funciona

- **Todo dia às 03:30 (Brasília)** o banco mede o próprio tamanho.
- Se o uso passar de **80%** (ajustável), ele remove os dados de quem **não pertence mais à escola**:
  - alunos arquivados (concluíram, foram transferidos ou saíram) **há mais de 180 dias** (ajustável);
  - cadastros que nunca foram confirmados, sem matrícula e sem atrasos, criados há mais de 180 dias;
  - convites da equipe vencidos há mais de 30 dias;
  - matrículas inativas sem aluno vinculado.
- **Todo domingo** roda um `VACUUM` para que o espaço das linhas apagadas seja reaproveitado.
- Cada limpeza fica registrada em `storage_cleanups` e na Auditoria, **sem nomes**.

**Nunca são removidos:** alunos ativos, alunos com renovação de matrícula pendente e contas da Secretaria/Direção.

## Controle pela Direção (menu da conta › Armazenamento)

- Uso atual em MB e %, e as tabelas que mais ocupam espaço.
- Prévia do que pode ser liberado agora.
- **Liberar espaço agora**: limpeza manual, pedindo para digitar `LIBERAR`.
- Regras: limite do plano, porcentagem que dispara a limpeza, dias de espera após a saída e liga/desliga da limpeza automática.
- Histórico das últimas limpezas.

## Observações

- A exclusão é **definitiva**. Se a escola precisar guardar algo por mais tempo, aumente o prazo de espera antes que ele vença.
- Depois de apagar linhas, o PostgreSQL reaproveita o espaço internamente; o número mostrado pode demorar a cair, mas o banco para de crescer.
- Para referência: uma escola com 1.000 alunos e 50 mil registros de atraso ocupa poucos MB. A limpeza é uma garantia para o longo prazo.
