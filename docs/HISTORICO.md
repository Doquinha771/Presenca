# Histórico do Presença+

Todas as mudanças em um só lugar, das mais novas para as mais antigas. Documentos de referência que continuam valendo: [Permissões](PERMISSOES.md), [E-mails do Supabase](EMAILS_SUPABASE.md), [Armazenamento](ARMAZENAMENTO_20261106.md), [Virada do ano letivo](VIRADA_ANO_LETIVO_20260923.md), [Exportações](EXPORTACOES.md), [Validação](VALIDACAO.md), [Avaliação institucional](AVALIACAO_INSTITUCIONAL.md) e [Limites jurídicos](LIMITES_JURIDICOS_E_OPERACIONAIS.md).

## Digital 5.0 — revisão de acabamento e acessibilidade (10/11/2026, noite)
- **Calendário escolar refeito:** o ano inteiro em meses, com feriado, recesso e férias em cores diferentes, fins de semana e o dia de hoje marcados. Tocar num dia preenche o cadastro (dois toques marcam um período). Mostra os dias letivos previstos no ano.
- **Acabamento:** o botão "Registrar atraso" não some mais na própria página; Relatórios sem espaço vazio (dias letivos entram no resumo); textos não grudam nos formulários; meses do histórico do aluno em faixa clara; escola mais suave no modo escuro.
- **Acessibilidade:** verificação automática (axe-core) em 10 telas, no modo claro e no escuro, dentro de `npm run test:browser`. Corrigidos contraste, ordem de títulos, atributo das abas de Alunos e regiões do login.

## Digital 5.0 — calendário, fila sem internet e organização (10/11/2026)
- **Calendário escolar** (`sql/14_calendario_escolar.sql`): a Direção cadastra feriados, recessos e férias. A sequência sem atraso pula esses dias, o gráfico de 14 dias marca os dias sem aula e os Relatórios mostram os dias letivos do mês.
- **Fila sem internet:** sem conexão, o atraso fica guardado no aparelho como "pendente de envio" e é enviado sozinho quando a internet volta, sem duplicar (o identificador do registro é o mesmo). A observação ganha o horário em que foi feito.
- **Login:** a escola ocupa a lateral esquerda, com o Tico na torre.
- **Organização:** pasta antiga `presenca/` apagada, documentos juntados neste histórico, Playwright no `package.json` e versão 5.0 em todos os arquivos.
- **Testes:** atualizações 13 e 14 entram no teste automático do GitHub; testes que liam o texto do código foram trocados por testes que usam o site no navegador.
- **Teste com usuários:** roteiro em [ROTEIRO_TESTE_USUARIOS.md](ROTEIRO_TESTE_USUARIOS.md).

## Digital 5.0 — visual escolar (10/11/2026)

### O que mudou
- **Menos cara de jogo:** saíram o cursor de giz, o pó de giz, o arco-íris, as árvores e os céus animados. Os desenhos que ficaram sem uso foram apagados de `assets/`.
- **Tico:** voltou redesenhado e menor (`assets/tico.js`), no carregamento, no telhado da escola do login e ao lado do recado do aluno. Respira, pisca e mexe o topete devagar; tocar nele faz um pulinho. Com "reduzir movimento", fica parado.
- **Carregamento:** logotipo, nome e barra de progresso, em vez da cena do Tico voando.
- **Login:** painel azul da escola com três tópicos e o prédio da escola em traço.
- **Faixa de título:** o desenho de livros e relógio virou o prédio da escola (`assets/predio-escola.svg`), no mesmo traço azul dos ícones.
- **Início do aluno:** situação (medidor, limite, perdoados, histórico) e sequência sem atraso lado a lado; depois últimos registros, avisos e dicas.
- **Sequência (foguinho):** agora conta **dias letivos** (segunda a sexta) desde o último atraso e sempre mostra o número. Sem nenhum atraso, conta desde 1º de fevereiro; antes mostrava "∞".
- **Equipe:** cada pessoa em um cartão com cargo, situação e ações no mesmo lugar, mais um resumo no topo.
- **Painel lateral:** botão "Administração" (ou "Mais opções") visível no topo, com a quantidade de áreas; cada área da administração tem uma frase explicando para que serve.

### Banco de dados
As atualizações 10, 11, 12 e 13 foram juntadas em `sql/instalar_atualizacoes.sql` (gerado por `node scripts/gerar-instalacao.mjs`).
Basta colar o arquivo inteiro no SQL Editor do Supabase e clicar em **Run**. Enquanto isso não acontece, o site continua funcionando e mostra um único aviso com o passo a passo nas telas que dependem dele (Equipe, Aprovações e Armazenamento).

## Presença+ 5.5: Direção, banco e novo visual

### Como instalar no banco

Rode `sql/13_equipe_e_otimizacao.sql` no SQL Editor do Supabase, depois da `12_armazenamento.sql`. Sem esta migração, o site continua funcionando, mas mostra um aviso nas áreas Aprovações e Equipe, e os pedidos e a remoção ficam desligados.

### Direção

- **Aprovações** (menu da conta): lista alunos que criaram conta e funcionários que pediram acesso, com Aceitar e Recusar. O Início da Direção avisa quando há pedidos.
- **Equipe** (menu da conta): botão **Adicionar funcionário**, convites pendentes com Cancelar, e **Remover** em cada membro.
- Quem é adicionado cria a própria senha no portal: a Direção nunca vê nem define senhas.
- **Remover** tira o acesso na hora e preserva a autoria dos registros. Adicionar o mesmo e-mail depois reativa a pessoa.
- Sem convite, a pessoa cria a conta em "Sou da escola"; ela fica sem acesso até a Direção aceitar.

### Banco abaixo de 500 MB

| Uso | O que acontece |
| --- | --- |
| Sempre, a cada hora | Limpa registros técnicos (Auth, pg_cron), sessões paradas e cadastros nunca confirmados. |
| A partir de 60% | Remove auditoria com mais de 2 anos. |
| A partir de 80% | Remove dados de quem saiu da escola há mais de 180 dias. |
| A partir de 90% | O prazo de espera cai para 30 dias e a auditoria guarda só 1 ano. |
| A partir de 95% | A auditoria guarda só 90 dias. |

Alunos ativos, renovações pendentes e a equipe nunca são removidos. O VACUUM agora é diário, e índices parciais, fillfactor e autovacuum reduzem o espaço por registro.

### Desenhos

Os arquivos em `assets/` foram redesenhados a partir das referências de `F:\Desenhos Presenca`: traço de giz feito com filtros SVG e animação em poucos quadros, que fica com cara de desenho à mão. Todas as animações param quando "reduzir movimento" está ligado no sistema.

## Presença+ Alpha 1.0

Marco visual e funcional do portal.

### Interface de Alunos

- casca desktop alinhada à referência visual aprovada;
- três abas internas: Lista de alunos, Matrículas e acessos, Séries e turmas;
- Nova matrícula como ação primária;
- busca local, turma, situação, filtros avançados e exportação;
- ordenação e paginação de 10, 15 ou 20 registros;
- tabela com seleção, situação, contagem/limite e ações;
- barra global de busca no cabeçalho com atalho Ctrl + K;
- adaptação mobile sem perder os fluxos existentes.

A versão do pacote passa a ser `1.0.0-alpha.1`, apresentada no projeto como **Alpha 1.0**.

## Presença+ 5.3.6 — revisão visual desktop

A visão geral da equipe foi reorganizada a partir da referência visual fornecida em 01/10/2026, preservando os fluxos e permissões existentes.

### Estrutura
- navegação lateral azul escura e fixa;
- atalhos Turmas e Cadastros continuam abrindo, respectivamente, as abas Séries e turmas e Matrículas dentro de Alunos;
- pesquisa no topo apenas na Visão geral, para não duplicar campos de pesquisa nas demais páginas;
- cinco indicadores: Alunos, Hoje, Na semana, No mês e Em atenção;
- gráfico de 14 dias em SVG leve, sem biblioteca de gráficos;
- resumo por turma;
- comunicados da escola;
- ações rápidas.

### Responsividade e desempenho
A camada `assets/dashboard-reference.css` é carregada por último e usa somente CSS. A animação já existente continua respeitando `prefers-reduced-motion` e economia de dados. O mobile preserva a navegação inferior já existente.

### Validação
- `npm test`: 55/55 testes aprovados;
- `npm run check`: aprovado;
- `check_integrity.py`: aprovado;
- `npm run test:browser`: não executado neste ambiente por ausência do módulo Playwright.

## Presença+ 5.3.5 — revisão de interface

Esta revisão retoma a identidade visual limpa anterior às experiências de marca d’água e identificação de TCC, preservando as funções adicionadas nas versões recentes.

### Objetivo

Reduzir ruído visual, tornar ações previsíveis e facilitar o uso por pessoas que não utilizam sistemas administrativos com frequência.

### Principais ajustes

- remoção de marcas d’água, selos e chamadas visuais de TCC/protótipo;
- visão geral com resumo do dia e atalhos realmente funcionais;
- área **Alunos** reorganizada com três abas: lista, matrículas e acessos, séries e turmas;
- ações contextuais: cada aba exibe apenas os botões necessários;
- filtros compactos e uma única pesquisa por contexto;
- linguagem mais direta em botões e mensagens;
- tabelas com leitura mais limpa e contraste menos agressivo;
- formulários e modais com espaçamento consistente;
- comportamento responsivo revisto para desktop intermediário e celular;
- animações leves existentes preservadas, respeitando `prefers-reduced-motion`.

### Compatibilidade

Nenhuma alteração de esquema ou dados do Supabase é necessária. Permanecem os fluxos de virada do ano letivo, autocadastro, fichas de pré-cadastro, histórico, exportações e keepalive.

## 5.3.5 — Interface refinada (29/09/2026)

- Retirada da identidade visual de TCC/protótipo e retorno à casca limpa do portal.
- Visão geral simplificada e focada em informações e atalhos reais.
- Área Alunos refinada com ações contextuais, filtros compactos e melhor hierarquia.
- Formulários, tabelas, modais e breakpoints receberam ajustes de ergonomia.
- Nenhuma mudança de banco de dados nesta versão.

## Atualização 4.1.2 — solicitação de acesso de aluno

- Conta do aluno sem matrícula previamente aprovada recebe perfil **pendente**, sem acesso aos registros escolares.
- RA do perfil pendente é derivado do e-mail escolar; série e nascimento oficiais são preenchidos apenas pela secretaria.
- Cadastro de alunos previamente matriculados mantém a autorização institucional, sem aceitar promoção de cargo por metadados.
- Correção do tratamento de falha de cadastro no frontend e validação de correspondência entre RA e e-mail.
- O README descreve o projeto sem instruções de download, instalação ou publicação.

### Atualização documental — 20/09/2026

Adicionados `README.md` profissional, `LICENSE` de uso institucional restrito,
`termos.html` e `privacidade.html` com estilo próprio e acesso público antes
do login. O formulário de cadastro solicita confirmação de leitura, sem
confundi-la com a base legal para o tratamento de dados escolares. O acesso aos
documentos permanece disponível no painel. A minuta e o checklist institucional
(`docs/AVALIACAO_INSTITUCIONAL.md`) dependem de revisão e aprovação da autoridade
educacional competente antes da utilização de dados reais. Nenhuma migração do
banco ou modificação de registros escolares foi realizada nesta atualização.

---

## Relatório de alterações — 4.0.0

### Auditoria do arquivo recebido

A base enviada continha HTML/CSS/JavaScript, logo, configuração publicável do Supabase, dois scripts SQL, README e metadados Git. Não havia Flask, FastAPI, SQLite, instaladores ou serviços LAN no código entregue. Por isso, não foi necessário remover backend local existente; a nova versão mantém a arquitetura exclusivamente web. Metadados `.git` não entram no ZIP de distribuição.

Foram identificados: listagem limitada a 1.000 perfis e 200 ocorrências; contadores calculados no frontend para o dashboard; leitura desnecessária de nascimento; cadastro por domínio de e-mail sem matrícula autorizada; falta de idempotência; perdão confundido com nova chance; ausência de desfazimento e correção por ocorrência; dependência de módulo externo sem tratamento de falha inicial.

O esquema efetivo do Supabase não foi acessado: a conexão disponível listou zero projetos. A migração toma como referência o `01_portal.sql` recebido. Não houve alteração nem exclusão de dados remotos.

### Interface

Reconstrução institucional com fundo claro, verde discreto, tipografia do sistema, navegação lateral, acesso de aluno separado visualmente do institucional, cartões, tabelas responsivas, modais, indicadores de conexão e tema escuro. Logo original preservado. Busca da Secretaria tem suporte a setas, Enter e seleção por toque.

A identidade de julho foi interpretada a partir dos requisitos fornecidos. Nenhum código ou captura da versão de julho estava anexado; não é possível afirmar que o resultado reproduz fielmente aquela interface.

### Regras e dados

- Matrículas autorizadas com RA, nome, e-mail, nascimento e turma.
- Perfis existentes preservados, com validação institucional pendente para novos registros.
- Quinto atraso bloqueia novos registros comuns; nova chance soma um ao limite.
- Perdão e anulação preservam original, responsável e justificativa.
- Desfazimento de dois minutos somente pelo operador.
- Lock por estudante, chave idempotente e janela de proteção de dois minutos para duplicação.
- Encerramentos usam bloqueio compatível com registros simultâneos.
- Contadores antigos preservados como saldo consolidado; histórico total consultado separadamente.
- Tabelas novas usam UUID. Eventos, auditorias e agendamentos legados conservam chaves bigint e ganham UUID público para não quebrar os vínculos existentes.
- Paginação de 25 registros para histórico, alunos, matrículas, equipe, auditoria e privacidade; exportação percorre as páginas filtradas.
- Cadastro de turmas, correção de dados escolares, arquivo, equipe, comunicados, regras e privacidade.

### Preservações

Confirmação e recuperação de e-mail, convite de funcionário, suspensão/reativação, arquivo/restauração, encerramento individual/coletivo e agendamentos foram preservados ou reconstruídos. A opção antiga de registrar diretamente um atraso como justificado foi substituída pelo registro normal seguido de decisão da Direção sobre perdão; isso evita que a Secretaria contorne a regra de limite.

Não há exclusão automática de dados, credenciais administrativas embutidas, autorização via armazenamento local ou fila offline. O único armazenamento próprio do navegador é a preferência de tema; a sessão é gerenciada pelo Supabase Auth.

### Limitações conhecidas

1. Migração e testes completos de banco/navegador não executados neste ambiente; veja VALIDACAO.md.
2. Matrícula autorizada ainda não vinculada a conta Auth não recebe atraso. O aluno precisa completar o cadastro e confirmar o e-mail antes de entrar no fluxo atual, pois a base original vincula estudantes a `auth.users`.
3. Históricos anteriores ao saldo consolidado não têm sua participação no período inferida automaticamente. Correções nesses registros não alteram o saldo sem revisão institucional.
4. Pesquisa por início de nome ou RA, sem busca aproximada ou por palavras no meio do nome.
5. A exportação histórica individual em CSV foi descontinuada na versão 5.1 por questão de privacidade.
6. Invites autorizam o cadastro; não enviam mensagem de convite automaticamente. O Supabase envia confirmação e recuperação de senha conforme configuração do projeto.
7. Política institucional de privacidade e limites de autenticação dependem da configuração pela escola/Supabase. A UI não declara conformidade jurídica automática.
8. Nenhum arquivo é enviado ao Storage; esse recurso não era necessário às funções implementadas.
9. Sem restauração automática do frontend antigo: RPCs antigas de registro são revogadas. Reverter exige revisão do SQL, não apenas trocar o HTML.


### Presença+ 4.1.0 — Cadastro institucional e economia de espaço

- A tela de entrada diferencia explicitamente aluno e instituição; o cadastro autônomo exibe os passos de validação escolar.
- O registro de alunos pela equipe agora devolve o identificador da matrícula. A criação de contas já confirmadas exige uma Edge Function autorizada, que gera senha temporária forte e mostra o segredo somente ao funcionário autenticado.
- Cadastros autônomos passam a aguardar a vinculação com matrícula feita pela escola. Nenhum dado autodeclarado concede cargo institucional ou autoriza acesso escolar.
- A migração `sql/04_v4_1.sql` mantém os registros anteriores, protege tabelas pela RLS e evita armazenar textos redundantes em novas auditorias de rotina. O tamanho real depende da quantidade de alunos, uso, índices e Auth.
- **Implantação parcial:** banco remoto atualizado. O deploy automático da Edge Function foi bloqueado pela integração; precisa ser feito antes de publicar a nova interface do GitHub Pages.

### 5.1.0 — Relatórios Excel e simplificação

- Interface móvel dedicada preservada, com navegação inferior e menu de funções.
- Removidos leitor Excel/CSV, interface de upload, opção de importação e testes relacionados.
- Nova área de relatórios de uso interno, exportando somente dados agregados, sem identificadores pessoais, em Excel (.xlsx) pronto para impressão.
- Exportação baseada no resumo mensal já disponibilizado pela RPC `dashboard`, sem varrer histórico individual.
- Módulo XLSX pequeno, sem dependência externa e carregado sob demanda.
- Script SQL preventivo desativa a função de importação antiga caso tenha sido instalada, sem afetar registros escolares.


### 5.2 — Interface compartilhada e Excel institucional

- Cabeçalho, perfil, botões, navegação móvel e visual dos cartões da Visão geral aplicados às demais telas e adaptados ao desktop; login preservado.
- Filtros de série, turma, situação, datas e categoria de exportação. Listas de alunos, histórico e matrículas em XLSX, além do resumo agregado.
- Novo RPC institucional com autorização no PostgreSQL, auditoria de solicitação, paginação de 200 registros, limites e índices para as pesquisas.
- A migração `sql/07_exportacoes_institucionais.sql` deve estar no Supabase para ativar as três novas exportações.
- Exportação não inclui senha, data de nascimento nem texto das observações individuais. Histórico por turma utiliza matrícula atual.

## Keepalive do Supabase — 28/09/2026

O Presença+ usa Supabase no plano Free. Projetos com baixa atividade podem ser pausados automaticamente após uma janela de sete dias. Para criar margem de segurança, a versão 5.3.1 adiciona um workflow diário do GitHub Actions.

### Funcionamento

- `.github/workflows/supabase-keepalive.yml` executa diariamente e também aceita execução manual.
- `scripts/supabase-keepalive.mjs` faz três chamadas leves ao RPC `project_keepalive`, com pequenos intervalos.
- `sql/11_keepalive_supabase.sql` cria um RPC `SECURITY INVOKER` que apenas retorna o horário do banco.
- A chave utilizada é publicável; nenhuma `service_role` ou `sb_secret_` é armazenada no workflow.
- O RPC não consulta nem altera dados de alunos, matrículas, histórico ou auditoria.

### Por que não aguardar cinco dias

O Supabase informa que projetos Free são avaliados por baixa atividade em uma janela de sete dias e que algumas consultas de usuário por dia normalmente bastam para evitar a pausa. Por isso, esperar cinco dias deixa pouca margem para atraso ou falha do agendamento. Três chamadas diárias representam cerca de 90 requisições mensais e têm custo operacional desprezível para este projeto.

### Limites

O GitHub pode atrasar execuções agendadas e workflows podem ser desativados por políticas da própria plataforma. O keepalive reduz o risco de pausa por inatividade, mas não é garantia de disponibilidade do plano Free.

## Presença+ | Alunos, matrículas e turmas

- A terceira aba **Séries e turmas** fica dentro de Alunos e não aparece duplicada no menu.
- A Secretaria cadastra a matrícula institucional sem gerar senha provisória.
- O aluno cria sua própria conta com RA/e-mail institucional, escolhe a senha e confirma o e-mail. A matrícula previamente registrada e ativa é vinculada no trigger `private.create_portal_profile` existente, sem aprovação adicional, desde que a turma esteja ativa.
- Se a conta Auth já existe, o aluno usa **Recuperar senha**. `signUp` não redefine uma conta preexistente.
- Se não há matrícula oficial, a conta permanece **sem acesso aos registros**. A equipe vê uma ficha com os dados autodeclarados em **Alunos > Matrículas e acessos**. A Secretaria confirma os dados na fonte oficial e cadastra a matrícula, que vincula o perfil existente quando RA e e-mail coincidirem.
- E-mail ainda não confirmado é indicado na ficha. Dados autodeclarados nunca determinam o cargo, nem concedem autorização escolar.
- A nova migração `sql/09_autocadastro_fichas_e_turmas.sql` adiciona a RPC `portal_applications` à base ativa. A função interna requer papel Secretaria ou Direção e não concede acesso a `anon`. Nenhum registro existente é apagado ou recebe senha alterada.

**Verificação restante:** simular cadastro completo com contas de teste institucionais autorizadas e entrega de e-mail real no GitHub Pages. O navegador de execução local pode estar bloqueado neste ambiente.

## Movimentos leves | Presença+ 5.2

- Navegação entre páginas: entrada curta (170 ms), acionada uma vez por rota.
- Busca, filtros, edição e atualização dos dados: sem reanimar o painel inteiro.
- Campos, abas, botões e menus: transições curtas, sem recalcular layout ou carregar bibliotecas.
- Avisos, autenticação e diálogos: entrada curta, sem efeitos de fundo ou animações contínuas.
- `prefers-reduced-motion: reduce`: desliga todas as animações e transições visuais; `saveData` pula a entrada de páginas.
- Relatórios ou tabelas extensas (>30 mil caracteres de HTML): a entrada animada da página é ignorada.
- O Supabase, os fluxos de matrícula e as permissões não são alterados por esta atualização.

## Presença+ | Interface e acesso (22/09/2026)

### Interface entregue

- Retirado o perfil duplicado do canto superior do painel. Nome e cargo do usuário aparecem na barra lateral.
- Menu da esquerda ordenado por uso: tarefas diárias, organização e funções administrativas, com os itens previstos para cada cargo. A rota antiga de Matrículas continua direcionando à área Alunos.
- Sidebar permanece presa à tela em desktop e a navegação ganha rolagem independente, sem empurrar nome de usuário ou botão de sair para fora da tela. A gaveta móvel permanece fixa e fechada fora de uso.
- Rodapé usa `margin-top:auto`, sem sobreposição com o conteúdo, e exibe exatamente: "feito pelos alunos do 3-A e com apoio da direção.".
- Formulários, botões, filtros, tabelas e contraste padronizados na folha `assets/ergonomia.css`, carregada após as folhas existentes.
- Ícones exibidos com Flaticon Uicons Regular Rounded via CDN oficial (sem incluir fontes no projeto), com crédito visível e CSS/CSP ajustados. O carregamento dos ícones **depende de acesso à CDN**; a interface continua textual e funcional caso a CDN esteja indisponível.
- Nenhuma chamada RPC, dado escolar, permissão, senha ou chave do Supabase foi alterada nesta atualização.

### Auditoria de autenticação real

Projeto conectado `svidahhpqozfaletpcbq`: 1 perfil de aluno e 1 perfil de administrador ativos, verificados e com e-mail Auth confirmado; aluno com matrícula ativa vinculada. Não há conta de secretaria cadastrada no momento da auditoria. Essas verificações usam consultas SQL de leitura e não implicam login real, teste de envio de e-mail, recuperação de senha ou teste com credenciais de terceiros.

A organização conectada está no **Supabase Free**. A proteção nativa de senhas vazadas está disponível somente no **Pro e superiores** segundo a documentação Supabase. Logo, não é possível ativar essa função nativa no plano atual por meio de SQL ou das ferramentas disponíveis. Nenhum plano foi alterado, nenhum usuário criado, nenhum segredo acessado e nenhuma cobrança autorizada.

### Validação ainda exigida antes de uso institucional

Com contas de teste próprias e autorizadas, testar separadamente os perfis aluno, secretaria e direção: login com confirmação de e-mail, recuperação de senha, matrícula pendente e aprovada, permissão de acesso direto por API, registro de atraso e auditoria. Para validar Secretaria é preciso cadastrar e autorizar previamente uma conta institucional legítima.

A suite `npm test` e `npm run check` verificam estrutura e sintaxe. A suite de browser com rede de Supabase simulada **não** testa logins reais. A navegação local via Chromium é bloqueada por política do ambiente atual; validar layout visual final no navegador real e no GitHub Pages antes da publicação institucional.

## Presença+ 5.2 — atualização visual da tela Histórico

A atualização é restrita à interface do Histórico institucional (Secretaria e Direção). O Histórico próprio do aluno mantém sua apresentação anterior, e as outras áreas preservam a navegação existente.

### Interface

- Mantida a barra lateral azul, com identificação do usuário apenas nela.
- Cabeçalho com título, descrição e pesquisa global por aluno ou RA. Essa pesquisa continua abrindo a área de Alunos; os filtros do Histórico ficam no cartão abaixo.
- Filtros De, Até, Turma e Situação, com botão Filtrar e Limpar filtros. Validação de intervalo de datas.
- Tabela com Data, Aluno, Turma, Situação, Observação, Responsável e Ações. O menu de três pontos abre uma janela acessível com as ações autorizadas para o cargo, sem esconder opções atrás da rolagem horizontal da tabela.
- Exportar Excel abre o fluxo de Relatórios Excel existente e mantém as validações atuais do Supabase.
- Paginação permanece sob controle do banco, com 25 registros por página. O seletor de ordenação inverte apenas os registros da página atual, como indicado no seu rótulo.
- Busca complementar de RA somente quando autorizado pela RLS da tabela profiles. O histórico não deixa de carregar se essa consulta não estiver disponível.
- Layout adaptado a telas pequenas, intermediárias e grandes, incluindo cartões no celular, sem alterar o menu móvel.
- Rodapé e posição da barra lateral preservados.

### Validação

- 28 testes automatizados de código passaram; verificação de sintaxe passou; verificação de integridade HTML passou.
- Visualização isolada da tela de Histórico verificada em larguras de 320, 390, 780, 900, 1024, 1366, 1660, 1920 e 2560 pixels, sem rolagem horizontal de página.
- O teste completo de navegação do site em navegador foi bloqueado pela política de rede deste ambiente. Não houve teste de login real, gravação de atrasos nem alterações no Supabase.

## Presença+ | Revisão do banco em 22/09/2026

Projeto verificado: `svidahhpqozfaletpcbq` (Presença+). O site estático usa Supabase Auth, PostgreSQL, RLS e a Edge Function `provision-student`. Nenhuma chave secreta foi incluída no projeto estático.

### Correções efetuadas no banco ativo

- Foi instalada a função `public.portal_export(text,jsonb)`, antes ausente, que já constava no pacote em `sql/07_exportacoes_institucionais.sql`. Ela restringe os relatórios individualizados à Secretaria/Direção, valida os filtros, limita lotes e registra solicitações na auditoria. Confirmou-se a existência da função e que a função não pode ser executada pelo papel `anon`.
- Foram instalados nove índices de apoio a chaves estrangeiras, versionados em `sql/08_indices_integridade.sql`. Não foi executada limpeza, reinicialização de período, remoção de alunos ou edição dos registros existentes.
- As tabelas consultadas do esquema `public` estavam com RLS habilitada; os alertas de ausência de política nas tabelas `staff_invites` e `portal_migrations` correspondem a tabelas internas sem acesso direto a alunos, cuja utilização se dá por funções autorizadas.

### Verificações de integridade (consulta somente leitura)

Não foram detectadas ocorrências entre os registros existentes nas verificações de: matrícula vinculada a perfil inexistente; divergência de RA ou turma entre matrícula e perfil; RA incompatível com e-mail escolar; aluno aprovado sem matrícula ativa; matrícula ligada a perfil de cargo incorreto; matrícula ativa vinculada a perfil inativo; aluno verificado sem confirmação do e-mail Auth; bloqueio incoerente com o contador; contador negativo. Foram identificados e confirmados os gatilhos de criação e atualização de perfil em `auth.users`, além do agendamento horário de processamento de resets.

### Limites da auditoria e pendências

O canal de SQL disponibilizado não permite assumir os papéis `authenticated`/`anon` para executar os RPCs como um usuário real. Por isso, a verificação de permissões da função de exportação foi feita por metadados de grants, definição SQL e validação de cargo na função, **não** por uma sessão completa no navegador com usuários de cada papel. O teste de navegador local está bloqueado pelo ambiente de execução; a suíte de testes unitários e a checagem de sintaxe JavaScript devem continuar sendo executadas no CI, assim como o teste de navegador com Playwright em ambiente permitido.

O Supabase Advisor ainda informa funções `SECURITY DEFINER` acessíveis a autenticados. Isso é intencional nas funções de operação institucional do projeto, que verificam `auth.uid()` e o cargo no banco; não retirar essas verificações ou conceder execução ao papel `anon` para eliminar o alerta. Ainda existem sugestões de otimização em cinco políticas RLS com avaliação repetida de `auth.uid()`. Não foram modificadas nesta revisão para evitar alterar políticas de produção sem teste completo por papel. Os avisos de índices não utilizados após a criação são esperados em banco pequeno e não justificam excluí-los automaticamente.

A proteção de senhas vazadas está desativada no Supabase Auth. A organização conectada usa o plano **Free**; a proteção nativa é disponibilizada pelo Supabase apenas no **Pro e superiores**. Não foi possível ativá-la no plano atual e nenhum upgrade de cobrança foi realizado. Quando a escola contratar um plano compatível, habilitar essa opção nas configurações de segurança de senha de Authentication e conferir novamente o Advisor. O sistema já exige confirmação do e-mail e não deve expor uma chave de serviço no GitHub Pages.

A atualização do ZIP não publica alterações no GitHub Pages automaticamente. As migrações 07 e 08 **já foram aplicadas ao projeto ativo acima**: não é necessário executá-las novamente nesse banco. Para outro projeto Supabase, consulte os pré-requisitos de esquema antes de aplicar os scripts.

## Integração de Alunos, Matrículas e Turmas

O item lateral **Alunos** reúne três abas: **Lista de alunos**, **Matrículas e acessos** e **Séries e turmas**. A área de Séries e turmas foi removida do menu principal sem excluir o cadastro de turmas.

A Direção pode adicionar ou editar uma turma na terceira aba. A Secretaria consegue consultar a lista de turmas nessa aba, sem botões de edição. Os alunos não têm acesso à área institucional. O vínculo do aluno à turma continua no cadastro e na edição da matrícula.

As rotas antigas `#/classes` e `#/enrollments` continuam aceitas para os cargos que já podiam acessá-las, abrindo diretamente a aba correspondente de **Alunos**. A rota `#/students` abre a lista de alunos. Nenhuma tabela, política RLS ou função do Supabase foi alterada nesta atualização.

Verificações locais: `npm test` e `npm run check`. O teste de navegador exige Playwright instalado e não pôde ser executado no ambiente em que este pacote foi produzido.

## Presença+ | Alunos, matrículas e turmas

A navegação lateral mantém um único item, **Alunos**. Dentro dele há duas abas: **Lista de alunos** e **Matrículas e turmas**. A segunda reúne no mesmo painel a lista de séries e turmas, a criação/edição de turmas, a busca de matrículas e o cadastro de alunos. A terceira aba independente foi removida.

Ao cadastrar um aluno, a Direção pode usar **+ Criar turma** ao lado da seleção de turma. A criação ocorre dentro da mesma janela e preserva os dados já informados sobre o aluno. Depois de salvar a turma, ela é selecionada automaticamente. Matrículas só usam turmas ativas. A Secretaria consulta e seleciona turmas, enquanto seu cadastro e edição permanecem restritos à Direção e validados no Supabase.

Os links antigos `#/enrollments` e `#/classes` abrem a área **Alunos → Matrículas e turmas**. Não há mudanças de esquema do banco nesta atualização.

A atualização inclui testes unitários de estrutura e verificações de sintaxe. A execução dos testes de navegador no ambiente de montagem foi bloqueada pela configuração local de rede; o fluxo com contas reais deve ser homologado no site publicado.

## Atualização da interface desktop

A interface institucional foi adaptada à estrutura visual do painel administrativo fornecido como referência. Mantém a aplicação estática com autenticação, permissões e operações no Supabase; não utiliza as rotas Flask e Socket.IO do HTML de referência.

- Barra lateral azul, cabeçalho claro, navegação consistente em todas as áreas da equipe.
- Grade fluida em todas as páginas; barra lateral com rolagem própria; tabelas extensas rolam dentro do cartão, não na página inteira.
- Ponto de reorganização aos 1100 px e transição para a navegação móvel existente abaixo dos 780 px.
- Matrículas reunidas na área **Alunos**, com duas abas internas: **Lista de alunos** e **Matrículas e acessos**. Endereços antigos de `#/enrollments` ainda levam à segunda aba.
- Cadastro de aluno em uma só janela; e-mail escolar sugerido pelo RA (permanece editável para conferência). Situação inicial ativa por padrão.
- Sem alteração de esquema SQL, credenciais, RPCs, regras de autorização, histórico, geração de relatórios ou identidade de QR.

### Verificação

Executar `npm test && npm run check && npm run test:browser` em um ambiente com Playwright e Chromium instalados. Os testes de navegador verificam a navegação integrada e o transbordamento horizontal nas larguras 320 a 2560 px. O funcionamento conectado ao Supabase real exige testes no ambiente autorizado da escola.

### Banco ativo e relatórios

Em 22/09/2026, a função de exportação prevista no ZIP e nove índices auxiliares foram aplicados ao projeto Supabase conectado. Os scripts versionados estão em `sql/07_exportacoes_institucionais.sql` e `sql/08_indices_integridade.sql`. Ver a seção "Revisão do banco em 22/09/2026" neste histórico para detalhes e verificações pendentes.

## Relatório técnico — Presença+ 5.2 · UI e exportação

A estrutura visual da Visão geral passou a ser compartilhada por todas as telas autenticadas: cabeçalho e perfil, botões com ícones, cartões, filtros, navegação inferior no mobile e sidebar no desktop. A folha `assets/portal-layout.css` contém as adaptações gerais. O login e os documentos jurídicos continuam independentes.

O resumo Excel agregado original permanece disponível, com três abas e sem identificadores individuais. Os relatórios de alunos, matrículas e histórico são **outro fluxo**, com acesso restrito a Secretaria e Direção. A consulta nominal passa por `public.portal_export` no PostgreSQL (migração 07), sem fazer consulta irrestrita no navegador. Paginação em lotes de 200 registros, limite de 10 mil antes de exigir mais filtros, nenhuma senha, nascimento ou motivo individual exportado. O arquivo XLSX é gerado localmente no navegador, sem dependência de XLSX externa nem armazenamento em Storage.

O histórico filtrado por turma ou série utiliza a turma **atual** do cadastro do aluno; não reconstrói a turma que ele frequentava na data de uma ocorrência antiga. Para histórico por turma de origem, é necessário registrar a turma do aluno em cada ocorrência, com migração e avaliação institucional próprias.

O pedido de exportação é auditado sem registrar nomes e RA no log. Quem baixa é responsável por preservar os arquivos fora de áreas públicas. A presença de controles técnicos não substitui autorização e procedimentos escolares previstos na legislação de proteção de dados.

`npm test && npm run check` é a verificação automatizada local. A tentativa de teste de interface por navegador foi bloqueada pela política de rede do ambiente (ERR_BLOCKED_BY_ADMINISTRATOR). Não foi feita validação da migração em banco remoto nem medição Lighthouse do site publicado.
