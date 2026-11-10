# 5.3.5 — Interface refinada (29/09/2026)

- Retirada da identidade visual de TCC/protótipo e retorno à casca limpa do portal.
- Visão geral simplificada e focada em informações e atalhos reais.
- Área Alunos refinada com ações contextuais, filtros compactos e melhor hierarquia.
- Formulários, tabelas, modais e breakpoints receberam ajustes de ergonomia.
- Nenhuma mudança de banco de dados nesta versão.

# Atualização 4.1.2 — solicitação de acesso de aluno

- Conta do aluno sem matrícula previamente aprovada recebe perfil **pendente**, sem acesso aos registros escolares.
- RA do perfil pendente é derivado do e-mail escolar; série e nascimento oficiais são preenchidos apenas pela secretaria.
- Cadastro de alunos previamente matriculados mantém a autorização institucional, sem aceitar promoção de cargo por metadados.
- Correção do tratamento de falha de cadastro no frontend e validação de correspondência entre RA e e-mail.
- O README descreve o projeto sem instruções de download, instalação ou publicação.

## Atualização documental — 20/09/2026

Adicionados `README.md` profissional, `LICENSE` de uso institucional restrito,
`termos.html` e `privacidade.html` com estilo próprio e acesso público antes
do login. O formulário de cadastro solicita confirmação de leitura, sem
confundi-la com a base legal para o tratamento de dados escolares. O acesso aos
documentos permanece disponível no painel. A minuta e o checklist institucional
(`docs/AVALIACAO_INSTITUCIONAL.md`) dependem de revisão e aprovação da autoridade
educacional competente antes da utilização de dados reais. Nenhuma migração do
banco ou modificação de registros escolares foi realizada nesta atualização.

---

# Relatório de alterações — 4.0.0

## Auditoria do arquivo recebido

A base enviada continha HTML/CSS/JavaScript, logo, configuração publicável do Supabase, dois scripts SQL, README e metadados Git. Não havia Flask, FastAPI, SQLite, instaladores ou serviços LAN no código entregue. Por isso, não foi necessário remover backend local existente; a nova versão mantém a arquitetura exclusivamente web. Metadados `.git` não entram no ZIP de distribuição.

Foram identificados: listagem limitada a 1.000 perfis e 200 ocorrências; contadores calculados no frontend para o dashboard; leitura desnecessária de nascimento; cadastro por domínio de e-mail sem matrícula autorizada; falta de idempotência; perdão confundido com nova chance; ausência de desfazimento e correção por ocorrência; dependência de módulo externo sem tratamento de falha inicial.

O esquema efetivo do Supabase não foi acessado: a conexão disponível listou zero projetos. A migração toma como referência o `01_portal.sql` recebido. Não houve alteração nem exclusão de dados remotos.

## Interface

Reconstrução institucional com fundo claro, verde discreto, tipografia do sistema, navegação lateral, acesso de aluno separado visualmente do institucional, cartões, tabelas responsivas, modais, indicadores de conexão e tema escuro. Logo original preservado. Busca da Secretaria tem suporte a setas, Enter e seleção por toque.

A identidade de julho foi interpretada a partir dos requisitos fornecidos. Nenhum código ou captura da versão de julho estava anexado; não é possível afirmar que o resultado reproduz fielmente aquela interface.

## Regras e dados

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

## Preservações

Confirmação e recuperação de e-mail, convite de funcionário, suspensão/reativação, arquivo/restauração, encerramento individual/coletivo e agendamentos foram preservados ou reconstruídos. A opção antiga de registrar diretamente um atraso como justificado foi substituída pelo registro normal seguido de decisão da Direção sobre perdão; isso evita que a Secretaria contorne a regra de limite.

Não há exclusão automática de dados, credenciais administrativas embutidas, autorização via armazenamento local ou fila offline. O único armazenamento próprio do navegador é a preferência de tema; a sessão é gerenciada pelo Supabase Auth.

## Limitações conhecidas

1. Migração e testes completos de banco/navegador não executados neste ambiente; veja VALIDACAO.md.
2. Matrícula autorizada ainda não vinculada a conta Auth não recebe atraso. O aluno precisa completar o cadastro e confirmar o e-mail antes de entrar no fluxo atual, pois a base original vincula estudantes a `auth.users`.
3. Históricos anteriores ao saldo consolidado não têm sua participação no período inferida automaticamente. Correções nesses registros não alteram o saldo sem revisão institucional.
4. Pesquisa por início de nome ou RA, sem busca aproximada ou por palavras no meio do nome.
5. A exportação histórica individual em CSV foi descontinuada na versão 5.1 por questão de privacidade.
6. Invites autorizam o cadastro; não enviam mensagem de convite automaticamente. O Supabase envia confirmação e recuperação de senha conforme configuração do projeto.
7. Política institucional de privacidade e limites de autenticação dependem da configuração pela escola/Supabase. A UI não declara conformidade jurídica automática.
8. Nenhum arquivo é enviado ao Storage; esse recurso não era necessário às funções implementadas.
9. Sem restauração automática do frontend antigo: RPCs antigas de registro são revogadas. Reverter exige revisão do SQL, não apenas trocar o HTML.


## Presença+ 4.1.0 — Cadastro institucional e economia de espaço

- A tela de entrada diferencia explicitamente aluno e instituição; o cadastro autônomo exibe os passos de validação escolar.
- O registro de alunos pela equipe agora devolve o identificador da matrícula. A criação de contas já confirmadas exige uma Edge Function autorizada, que gera senha temporária forte e mostra o segredo somente ao funcionário autenticado.
- Cadastros autônomos passam a aguardar a vinculação com matrícula feita pela escola. Nenhum dado autodeclarado concede cargo institucional ou autoriza acesso escolar.
- A migração `sql/04_v4_1.sql` mantém os registros anteriores, protege tabelas pela RLS e evita armazenar textos redundantes em novas auditorias de rotina. O tamanho real depende da quantidade de alunos, uso, índices e Auth.
- **Implantação parcial:** banco remoto atualizado. O deploy automático da Edge Function foi bloqueado pela integração; precisa ser feito antes de publicar a nova interface do GitHub Pages.

## 5.1.0 — Relatórios Excel e simplificação

- Interface móvel dedicada preservada, com navegação inferior e menu de funções.
- Removidos leitor Excel/CSV, interface de upload, opção de importação e testes relacionados.
- Nova área de relatórios de uso interno, exportando somente dados agregados, sem identificadores pessoais, em Excel (.xlsx) pronto para impressão.
- Exportação baseada no resumo mensal já disponibilizado pela RPC `dashboard`, sem varrer histórico individual.
- Módulo XLSX pequeno, sem dependência externa e carregado sob demanda.
- Script SQL preventivo desativa a função de importação antiga caso tenha sido instalada, sem afetar registros escolares.


## 5.2 — Interface compartilhada e Excel institucional

- Cabeçalho, perfil, botões, navegação móvel e visual dos cartões da Visão geral aplicados às demais telas e adaptados ao desktop; login preservado.
- Filtros de série, turma, situação, datas e categoria de exportação. Listas de alunos, histórico e matrículas em XLSX, além do resumo agregado.
- Novo RPC institucional com autorização no PostgreSQL, auditoria de solicitação, paginação de 200 registros, limites e índices para as pesquisas.
- A migração `sql/07_exportacoes_institucionais.sql` deve estar no Supabase para ativar as três novas exportações.
- Exportação não inclui senha, data de nascimento nem texto das observações individuais. Histórico por turma utiliza matrícula atual.
