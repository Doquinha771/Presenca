# Presença+ | Revisão do banco em 22/09/2026

Projeto verificado: `svidahhpqozfaletpcbq` (Presença+). O site estático usa Supabase Auth, PostgreSQL, RLS e a Edge Function `provision-student`. Nenhuma chave secreta foi incluída no projeto estático.

## Correções efetuadas no banco ativo

- Foi instalada a função `public.portal_export(text,jsonb)`, antes ausente, que já constava no pacote em `sql/07_exportacoes_institucionais.sql`. Ela restringe os relatórios individualizados à Secretaria/Direção, valida os filtros, limita lotes e registra solicitações na auditoria. Confirmou-se a existência da função e que a função não pode ser executada pelo papel `anon`.
- Foram instalados nove índices de apoio a chaves estrangeiras, versionados em `sql/08_indices_integridade.sql`. Não foi executada limpeza, reinicialização de período, remoção de alunos ou edição dos registros existentes.
- As tabelas consultadas do esquema `public` estavam com RLS habilitada; os alertas de ausência de política nas tabelas `staff_invites` e `portal_migrations` correspondem a tabelas internas sem acesso direto a alunos, cuja utilização se dá por funções autorizadas.

## Verificações de integridade (consulta somente leitura)

Não foram detectadas ocorrências entre os registros existentes nas verificações de: matrícula vinculada a perfil inexistente; divergência de RA ou turma entre matrícula e perfil; RA incompatível com e-mail escolar; aluno aprovado sem matrícula ativa; matrícula ligada a perfil de cargo incorreto; matrícula ativa vinculada a perfil inativo; aluno verificado sem confirmação do e-mail Auth; bloqueio incoerente com o contador; contador negativo. Foram identificados e confirmados os gatilhos de criação e atualização de perfil em `auth.users`, além do agendamento horário de processamento de resets.

## Limites da auditoria e pendências

O canal de SQL disponibilizado não permite assumir os papéis `authenticated`/`anon` para executar os RPCs como um usuário real. Por isso, a verificação de permissões da função de exportação foi feita por metadados de grants, definição SQL e validação de cargo na função, **não** por uma sessão completa no navegador com usuários de cada papel. O teste de navegador local está bloqueado pelo ambiente de execução; a suíte de testes unitários e a checagem de sintaxe JavaScript devem continuar sendo executadas no CI, assim como o teste de navegador com Playwright em ambiente permitido.

O Supabase Advisor ainda informa funções `SECURITY DEFINER` acessíveis a autenticados. Isso é intencional nas funções de operação institucional do projeto, que verificam `auth.uid()` e o cargo no banco; não retirar essas verificações ou conceder execução ao papel `anon` para eliminar o alerta. Ainda existem sugestões de otimização em cinco políticas RLS com avaliação repetida de `auth.uid()`. Não foram modificadas nesta revisão para evitar alterar políticas de produção sem teste completo por papel. Os avisos de índices não utilizados após a criação são esperados em banco pequeno e não justificam excluí-los automaticamente.

A proteção de senhas vazadas está desativada no Supabase Auth. A organização conectada usa o plano **Free**; a proteção nativa é disponibilizada pelo Supabase apenas no **Pro e superiores**. Não foi possível ativá-la no plano atual e nenhum upgrade de cobrança foi realizado. Quando a escola contratar um plano compatível, habilitar essa opção nas configurações de segurança de senha de Authentication e conferir novamente o Advisor. O sistema já exige confirmação do e-mail e não deve expor uma chave de serviço no GitHub Pages.

A atualização do ZIP não publica alterações no GitHub Pages automaticamente. As migrações 07 e 08 **já foram aplicadas ao projeto ativo acima**: não é necessário executá-las novamente nesse banco. Para outro projeto Supabase, consulte os pré-requisitos de esquema antes de aplicar os scripts.
