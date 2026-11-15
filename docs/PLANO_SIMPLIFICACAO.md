# Plano de simplificação (versão 5.1)

Coisas que hoje estão "demais" e como deixá-las mais leves, em ordem de prioridade.
Nada disso foi aplicado ainda: cada item muda telas que a equipe já conhece e merece um teste com usuários antes.

## 1. CSS em camadas que se sobrescrevem
`assets/ui.css` tem ~1.400 linhas e várias regras repetidas para o mesmo elemento (ex.: `.auth-art` aparece 4 vezes, `.page-head-inner::after` 2 vezes), cada uma corrigindo a anterior.
- **Plano:** juntar cada componente num bloco só, apagar as versões antigas e mover o conteúdo de `app-extra.css` para dentro do `ui.css` na próxima versão.

## 2. Três caminhos para cadastrar aluno
Hoje dá para chegar ao cadastro por "Alunos › Cadastrar aluno", "Cadastros e acessos" e "Aprovações › Aceitar".
- **Plano:** um único botão "Cadastrar aluno" (já é o primário em Alunos) e a lista de pedidos dos alunos só em Aprovações. A aba "Cadastros e acessos" passa a ser só consulta.

## 3. Menu da Direção com 9 itens administrativos
Armazenamento, Privacidade e Auditoria são usados raramente.
- **Plano:** agrupar os três em uma tela "Sistema", com abas. O menu cai de 9 para 7 itens.

## 4. Textos longos nas telas de login e cadastro
O aviso sob o formulário de login repete o que o rótulo do campo já diz.
- **Plano:** reduzir para uma linha ("Use o e-mail escolar: RA + sp + @al.educacao.sp.gov.br") e mover o resto para "Precisa de ajuda?".

## 5. Página "Período e regras" mistura configuração e ação perigosa
O botão "Encerrar agora" fica ao lado de campos de texto comuns.
- **Plano:** separar em "Regras" (formulário) e "Encerrar período" (cartão vermelho próprio, com confirmação).

## 6. Paginação diferente em cada lista
Alunos e Histórico usam "10/15/20 por página"; as outras listas usam 25 fixos.
- **Plano:** um único componente de paginação, com o mesmo visual em todas as telas.
