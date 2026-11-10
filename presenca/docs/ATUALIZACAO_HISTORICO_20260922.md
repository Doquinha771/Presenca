# Presença+ 5.2 — atualização visual da tela Histórico

A atualização é restrita à interface do Histórico institucional (Secretaria e Direção). O Histórico próprio do aluno mantém sua apresentação anterior, e as outras áreas preservam a navegação existente.

## Interface

- Mantida a barra lateral azul, com identificação do usuário apenas nela.
- Cabeçalho com título, descrição e pesquisa global por aluno ou RA. Essa pesquisa continua abrindo a área de Alunos; os filtros do Histórico ficam no cartão abaixo.
- Filtros De, Até, Turma e Situação, com botão Filtrar e Limpar filtros. Validação de intervalo de datas.
- Tabela com Data, Aluno, Turma, Situação, Observação, Responsável e Ações. O menu de três pontos abre uma janela acessível com as ações autorizadas para o cargo, sem esconder opções atrás da rolagem horizontal da tabela.
- Exportar Excel abre o fluxo de Relatórios Excel existente e mantém as validações atuais do Supabase.
- Paginação permanece sob controle do banco, com 25 registros por página. O seletor de ordenação inverte apenas os registros da página atual, como indicado no seu rótulo.
- Busca complementar de RA somente quando autorizado pela RLS da tabela profiles. O histórico não deixa de carregar se essa consulta não estiver disponível.
- Layout adaptado a telas pequenas, intermediárias e grandes, incluindo cartões no celular, sem alterar o menu móvel.
- Rodapé e posição da barra lateral preservados.

## Validação

- 28 testes automatizados de código passaram; verificação de sintaxe passou; verificação de integridade HTML passou.
- Visualização isolada da tela de Histórico verificada em larguras de 320, 390, 780, 900, 1024, 1366, 1660, 1920 e 2560 pixels, sem rolagem horizontal de página.
- O teste completo de navegação do site em navegador foi bloqueado pela política de rede deste ambiente. Não houve teste de login real, gravação de atrasos nem alterações no Supabase.
