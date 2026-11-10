# Presença+ 5.5: Direção, banco e novo visual

## Como instalar no banco

Rode `sql/13_equipe_e_otimizacao.sql` no SQL Editor do Supabase, depois da `12_armazenamento.sql`. Sem esta migração, o site continua funcionando, mas mostra um aviso nas áreas Aprovações e Equipe, e os pedidos e a remoção ficam desligados.

## Direção

- **Aprovações** (menu da conta): lista alunos que criaram conta e funcionários que pediram acesso, com Aceitar e Recusar. O Início da Direção avisa quando há pedidos.
- **Equipe** (menu da conta): botão **Adicionar funcionário**, convites pendentes com Cancelar, e **Remover** em cada membro.
- Quem é adicionado cria a própria senha no portal: a Direção nunca vê nem define senhas.
- **Remover** tira o acesso na hora e preserva a autoria dos registros. Adicionar o mesmo e-mail depois reativa a pessoa.
- Sem convite, a pessoa cria a conta em "Sou da escola"; ela fica sem acesso até a Direção aceitar.

## Banco abaixo de 500 MB

| Uso | O que acontece |
| --- | --- |
| Sempre, a cada hora | Limpa registros técnicos (Auth, pg_cron), sessões paradas e cadastros nunca confirmados. |
| A partir de 60% | Remove auditoria com mais de 2 anos. |
| A partir de 80% | Remove dados de quem saiu da escola há mais de 180 dias. |
| A partir de 90% | O prazo de espera cai para 30 dias e a auditoria guarda só 1 ano. |
| A partir de 95% | A auditoria guarda só 90 dias. |

Alunos ativos, renovações pendentes e a equipe nunca são removidos. O VACUUM agora é diário, e índices parciais, fillfactor e autovacuum reduzem o espaço por registro.

## Desenhos

Os arquivos em `assets/` foram redesenhados a partir das referências de `F:\Desenhos Presenca`: traço de giz feito com filtros SVG e animação em poucos quadros, que fica com cara de desenho à mão. Todas as animações param quando "reduzir movimento" está ligado no sistema.
