# Exportações institucionais · Presença+ 5.2

## Ativação do servidor

O frontend incluído no ZIP exige `public.portal_export` para listas nominais. No **SQL Editor do Supabase usado por este Presença+**, execute o conteúdo de `sql/07_exportacoes_institucionais.sql`, **após** as migrações já existentes até `05_v4_1_2.sql`. Faça backup e valide primeiro em projeto de homologação. A migração é aditiva: não executa DROP, não elimina histórico e não substitui `portal_read` nem a RLS anterior. Não publique a planilha de alunos no GitHub.

Se o site atualizado for publicado sem essa migração, o resumo agregado continua disponível, mas a exportação nominal apresentará erro de função RPC inexistente. A atualização do arquivo HTML/CSS/JS no GitHub Pages não instala funções no banco automaticamente.

## Uso

Na conta institucional, entre em **Relatórios Excel**, selecione **Lista de alunos**, **Histórico de atrasos** ou **Matrículas**, informe uma série e/ou turma, ajuste os demais filtros e use **Baixar Excel filtrado**. Também há atalhos nas páginas de Alunos, Histórico, Matrículas e Séries e turmas. O resumo anterior permanece separado.

**Lista de alunos:** nome, RA, série, turma, atrasos válidos, limite e situação. Inclui opção de alunos ativos, arquivados ou todos.

**Histórico:** nome, RA, série, turma, data e hora do registro, situação e marcação de justificativa. Filtros por data inicial, final e situação. A turma reflete o **cadastro atual**, não a turma da data histórica do atraso.

**Matrículas:** nome, RA, e-mail escolar, série, turma, situação do cadastro e data de criação. Opção de matrículas ativas, inativas ou todas. Data de nascimento, senha e observações individuais não entram nas planilhas.

O backend confere a conta autenticada e ativa, restringe os dados à Secretaria/Direção e registra o pedido na auditoria. As consultas são paginadas em 200 itens para não buscar o banco inteiro de uma vez; para mais de 10 mil linhas, estreite os filtros. O download é criado no navegador e fica sob a guarda de quem o realizou.
