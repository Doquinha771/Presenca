# Integração de Alunos, Matrículas e Turmas

O item lateral **Alunos** reúne três abas: **Lista de alunos**, **Matrículas e acessos** e **Séries e turmas**. A área de Séries e turmas foi removida do menu principal sem excluir o cadastro de turmas.

A Direção pode adicionar ou editar uma turma na terceira aba. A Secretaria consegue consultar a lista de turmas nessa aba, sem botões de edição. Os alunos não têm acesso à área institucional. O vínculo do aluno à turma continua no cadastro e na edição da matrícula.

As rotas antigas `#/classes` e `#/enrollments` continuam aceitas para os cargos que já podiam acessá-las, abrindo diretamente a aba correspondente de **Alunos**. A rota `#/students` abre a lista de alunos. Nenhuma tabela, política RLS ou função do Supabase foi alterada nesta atualização.

Verificações locais: `npm test` e `npm run check`. O teste de navegador exige Playwright instalado e não pôde ser executado no ambiente em que este pacote foi produzido.
