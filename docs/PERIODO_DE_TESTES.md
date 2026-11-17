# Período de testes · 17/11 a 01/12/2026 (15 dias)

Durante esses dias a escola usa o Presença+ de verdade e conta o que der errado. Depois de 01/12, o botão de relato e o envio automático somem sozinhos.

## Antes de começar (uma vez)
1. No Supabase, abra o **SQL Editor** com a conta da escola.
2. Cole o arquivo `sql/instalar_atualizacoes.sql` inteiro e clique em **Run** (ele já inclui a atualização 15, dos relatos). Pode rodar de novo sem problema.
3. Publique o site e peça para todos recarregarem a página (Ctrl+F5 no computador).

Sem a atualização 15, o portal continua funcionando: os relatos ficam guardados no aparelho de quem relatou e são enviados quando ela for instalada.

## O que cada pessoa vê
No rodapé do portal (logado), um botão com bandeira escrito **Report bugs**. Ele abre a janela de relato. Aparece até 01/12; os erros técnicos são enviados sozinhos de 17/11 a 01/12.

## O que testar (roteiro sugerido)
| Quem | O que fazer |
|---|---|
| Secretaria | Registrar atrasos na entrada, desfazer um registro, cadastrar uma turma inteira com "Salvar e cadastrar o próximo", aceitar pedidos em Aprovações, baixar relatórios. |
| Direção | Tudo da Secretaria + Equipe, Turmas, Calendário, Período e regras, Sistema. Ler os relatos todo dia em **Sistema › Testes**. |
| Alunos | Criar a conta, entrar pelo celular, conferir atrasos, histórico, avisos e conquistas. |
| Todos | Usar no celular e no computador, no modo claro e no escuro, com internet fraca. |

## Como a Direção acompanha
**Sistema › Testes** mostra cada relato com quem enviou, a tela, o aparelho e a versão. Erros técnicos chegam sozinhos (marcados como *Erro automático*); se o mesmo erro se repetir, aparece "N× seguidas" em vez de vários relatos. Marque como resolvido quando corrigir.

Limites para proteger o banco: até 40 relatos por pessoa por dia e até 10 erros automáticos por visita.

## Mudar as datas
As datas ficam em `config.js` (`TEST_PERIOD`). Para estender o período, mude só o `end`.
