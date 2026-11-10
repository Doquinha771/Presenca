# Cargos e permissões

| Recurso | Aluno | Secretaria | Direção |
|---|---|---|---|
| Identificação e histórico | Próprios | Alunos da escola | Alunos da escola |
| Dashboard | Própria situação | Indicadores escolares | Indicadores escolares |
| Registro de atraso | Não | Sim, com matrícula validada | Sim, com matrícula validada |
| Desfazer em 2 minutos | Não | Somente registro próprio | Somente registro próprio |
| Correção/anulação após 2 minutos | Não | Não | Sim, com justificativa |
| Perdão de ocorrência | Não | Não | Sim, com justificativa |
| Nova chance (+1) | Não | Não | Sim, com justificativa |
| RA, nascimento e matrícula completa | Não pela API comum | Não | Formulário administrativo |
| Gestão de matrículas e turmas | Não | Não | Sim |
| Gestão de equipe | Não | Não | Sim, exceto a própria conta |
| Regras, encerramento e auditoria | Não | Não | Sim |
| Privacidade e incidentes | Não | Não | Sim |
| Comunicados | Público autorizado | Público autorizado | Criar, editar e arquivar |

As abas são apenas apresentação. `private.require_portal` consulta o perfil ativo e confirmado; `private.portal_read` projeta dados conforme a função; `private.portal_write` autoriza cada operação no servidor. A UI nunca fornece a autorização real.

Tabelas possuem RLS, políticas de leitura e grants diretos revogados para os clientes. Os endpoints públicos novos são `SECURITY INVOKER`; as implementações privilegiadas ficam no schema `private`, com `search_path` vazio e grants explícitos. Não exponha esse schema na Data API. Sem políticas/grants de escrita direta, histórico e cargos não podem ser alterados com `update` do navegador.

A conta de aluno nasce de uma matrícula autorizada; o trigger ignora cargos enviados em `user_metadata`. Os cargos de funcionários vêm exclusivamente dos convites criados pela Direção. Usuário suspenso perde acesso aos RPCs mesmo que o token anterior ainda não tenha expirado. As mudanças na equipe são serializadas e o administrador não pode alterar o próprio acesso.

A Secretaria vê nome, RA, turma, situação e histórico necessários ao trabalho. E-mails não aparecem em dashboards nem em listagens da equipe; data de nascimento fica limitada aos formulários administrativos. Justificativas escolares também são dados pessoais: registre somente o necessário, evitando detalhes médicos.

O produto não aplica exclusão automática de alunos, atrasos ou auditorias. Política de retenção, responsável e contato devem ser preenchidos pela escola. O módulo de privacidade registra solicitações/incidentes e providências; não substitui análise institucional ou jurídica.
