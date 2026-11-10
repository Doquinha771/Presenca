# Atualização da interface desktop

A interface institucional foi adaptada à estrutura visual do painel administrativo fornecido como referência. Mantém a aplicação estática com autenticação, permissões e operações no Supabase; não utiliza as rotas Flask e Socket.IO do HTML de referência.

- Barra lateral azul, cabeçalho claro, navegação consistente em todas as áreas da equipe.
- Grade fluida em todas as páginas; barra lateral com rolagem própria; tabelas extensas rolam dentro do cartão, não na página inteira.
- Ponto de reorganização aos 1100 px e transição para a navegação móvel existente abaixo dos 780 px.
- Matrículas reunidas na área **Alunos**, com duas abas internas: **Lista de alunos** e **Matrículas e acessos**. Endereços antigos de `#/enrollments` ainda levam à segunda aba.
- Cadastro de aluno em uma só janela; e-mail escolar sugerido pelo RA (permanece editável para conferência). Situação inicial ativa por padrão.
- Sem alteração de esquema SQL, credenciais, RPCs, regras de autorização, histórico, geração de relatórios ou identidade de QR.

## Verificação

Executar `npm test && npm run check && npm run test:browser` em um ambiente com Playwright e Chromium instalados. Os testes de navegador verificam a navegação integrada e o transbordamento horizontal nas larguras 320 a 2560 px. O funcionamento conectado ao Supabase real exige testes no ambiente autorizado da escola.

## Banco ativo e relatórios

Em 22/09/2026, a função de exportação prevista no ZIP e nove índices auxiliares foram aplicados ao projeto Supabase conectado. Os scripts versionados estão em `sql/07_exportacoes_institucionais.sql` e `sql/08_indices_integridade.sql`. Ver `docs/AUDITORIA_BANCO_20260922.md` para detalhes e verificações pendentes.
