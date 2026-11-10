# Presença+ | Alunos, matrículas e turmas

A navegação lateral mantém um único item, **Alunos**. Dentro dele há duas abas: **Lista de alunos** e **Matrículas e turmas**. A segunda reúne no mesmo painel a lista de séries e turmas, a criação/edição de turmas, a busca de matrículas e o cadastro de alunos. A terceira aba independente foi removida.

Ao cadastrar um aluno, a Direção pode usar **+ Criar turma** ao lado da seleção de turma. A criação ocorre dentro da mesma janela e preserva os dados já informados sobre o aluno. Depois de salvar a turma, ela é selecionada automaticamente. Matrículas só usam turmas ativas. A Secretaria consulta e seleciona turmas, enquanto seu cadastro e edição permanecem restritos à Direção e validados no Supabase.

Os links antigos `#/enrollments` e `#/classes` abrem a área **Alunos → Matrículas e turmas**. Não há mudanças de esquema do banco nesta atualização.

A atualização inclui testes unitários de estrutura e verificações de sintaxe. A execução dos testes de navegador no ambiente de montagem foi bloqueada pela configuração local de rede; o fluxo com contas reais deve ser homologado no site publicado.
