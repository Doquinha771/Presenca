# Atualização 6.0 — visual escolar (10/11/2026)

## O que mudou
- **Menos cara de jogo:** saíram o cursor de giz, o pó de giz, o arco-íris, as árvores e os céus animados. Os desenhos que ficaram sem uso foram apagados de `assets/`.
- **Tico:** voltou redesenhado e menor (`assets/tico.js`), no carregamento, no telhado da escola do login e ao lado do recado do aluno. Respira, pisca e mexe o topete devagar; tocar nele faz um pulinho. Com "reduzir movimento", fica parado.
- **Carregamento:** logotipo, nome e barra de progresso, em vez da cena do Tico voando.
- **Login:** painel azul da escola com três tópicos e o prédio da escola em traço.
- **Faixa de título:** o desenho de livros e relógio virou o prédio da escola (`assets/predio-escola.svg`), no mesmo traço azul dos ícones.
- **Início do aluno:** situação (medidor, limite, perdoados, histórico) e sequência sem atraso lado a lado; depois últimos registros, avisos e dicas.
- **Sequência (foguinho):** agora conta **dias letivos** (segunda a sexta) desde o último atraso e sempre mostra o número. Sem nenhum atraso, conta desde 1º de fevereiro; antes mostrava "∞".
- **Equipe:** cada pessoa em um cartão com cargo, situação e ações no mesmo lugar, mais um resumo no topo.
- **Painel lateral:** botão "Administração" (ou "Mais opções") visível no topo, com a quantidade de áreas; cada área da administração tem uma frase explicando para que serve.

## Banco de dados
As atualizações 10, 11, 12 e 13 foram juntadas em `sql/instalar_atualizacoes.sql` (gerado por `node scripts/gerar-instalacao.mjs`).
Basta colar o arquivo inteiro no SQL Editor do Supabase e clicar em **Run**. Enquanto isso não acontece, o site continua funcionando e mostra um único aviso com o passo a passo nas telas que dependem dele (Equipe, Aprovações e Armazenamento).
