# Presença+ | Virada do ano letivo

O recurso mantém a conta de autenticação e a senha de cada aluno. A renovação escolar é um estado próprio, registrado no banco. É distinto da abertura de um ano civil ou do reset de contadores bimestrais.

## Preparação e implantação

A instalação da versão 5.3 exige a migração `sql/10_virada_ano_letivo.sql`, após as migrações 01 a 09. Essa migração instala tabelas com RLS e permissões fechadas, funções de gestão e uma rotina `pg_cron` horária, mas **não agenda nem executa a virada**. Ela marca apenas o ano em curso como aberto. Execute-a e verifique o resultado num banco de homologação antes de instalar no banco escolar principal. Faça backup com o responsável pela infraestrutura e instale o SQL antes de publicar o novo frontend no GitHub Pages.

A rotina consulta a data local de São Paulo a cada hora, por isso pode haver até aproximadamente uma hora de diferença entre meia-noite e o processamento automático. Se a instituição precisar da mudança no próprio momento da abertura, a Direção pode escolher **Processar datas já alcançadas**. Repetir o processamento não duplica matrículas anuais.

## Fluxo administrativo

A Direção configura em **Período e regras → Virada de ano letivo** o ano seguinte, a data de encerramento do atual e a abertura do próximo. Não há transferência automática em 1º de janeiro. A migração não agenda 2027 por conta própria.

Na data de encerramento, matrículas operacionais de 2026 deixam de estar ativas, inclusive as de estudantes que ainda não criaram conta; os estudantes que já possuíam perfil e matrícula aprovada ganham uma renovação pendente para 2027. A conta Auth não é excluída. O histórico de ocorrências e os dados da última matrícula ficam preservados.

A Secretaria usa **Alunos → Lista de alunos → Pendentes de renovação**, informa o resultado final e escolhe a turma de destino. O banco confere a etapa de origem e a de destino: aprovado avança uma série, reprovado permanece, conclusão do ensino médio é admitida para a 3ª série do médio e transferências são registradas como saída. O histórico anual guarda os nomes de série e turma anteriores e de destino, mesmo se a escola renomear uma turma depois. Concluídos e transferidos são arquivados sem destruir a auditoria.

O aluno pendente pode acessar a mesma conta e o próprio histórico, mas não consegue usar as funcionalidades que dependem da matrícula ativa. Sua tela informa o ano de renovação e a última matrícula. O portal reconsulta seu estado enquanto a aba está visível, no máximo uma vez por minuto, além do botão Atualizar.

## Limites e conferências indispensáveis

O avanço automático exige uma série identificável, como `2 Ano - Ensino médio`, `3º ano do Ensino Médio` ou `9º ano Fundamental`. Para EJA e nomenclaturas não reconhecidas, a renovação por avanço/reprovação fica bloqueada em vez de adivinhar uma série. A Direção precisa ajustar o fluxo escolar correspondente antes de processar esses alunos.

Apenas a Direção agenda e aciona o calendário; a Secretaria e a Direção podem renovar matrículas. O backend valida permissões, vínculo da conta, série, status e duplicação. O campo de nome/RA na pesquisa usa dados escolares somente para funcionários autorizados. A migração não altera o Supabase Auth nem cria novas credenciais.

**Atenção:** as matrículas de alunos sem conta também são desativadas no encerramento. A escola precisa confirmar sua situação no novo ano antes de eles poderem se cadastrar como matriculados. Durante o intervalo entre fechamento e abertura, novos cadastros oficiais ficam suspensos. Ajuste as datas para respeitar férias e recuperação.

## Validação

`npm test` e `npm run check` cobrem estrutura e sintaxe. `tests/annual-db.sql` foi incluído na rotina de teste SQL em banco descartável. Não tratar esses testes estáticos como homologação de movimentação real: execute a rotina em uma base de teste com contas de aluno, Secretaria e Direção antes de autorizar o calendário oficial. Não acione a rotina usando a data atual como teste no projeto de produção.
