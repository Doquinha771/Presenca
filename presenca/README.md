<div align="center">

<img src="assets/logo.png" alt="Presença+" width="78" />

# Presença+

**Plataforma web para acompanhamento escolar, gestão de matrículas e histórico de ocorrências.**

[![Versão](https://img.shields.io/badge/vers%C3%A3o-Alpha%201.0-1769e8)](#versão-atual)
[![Status](https://img.shields.io/badge/status-em%20valida%C3%A7%C3%A3o-0b7d67)](#estado-do-projeto)
[![Plataforma](https://img.shields.io/badge/plataforma-Web-163b6d)](#tecnologia)
[![Dados](https://img.shields.io/badge/dados-Supabase-3ecf8e)](#segurança-e-privacidade)

**Projeto de conclusão de curso desenvolvido no contexto escolar, com foco em um problema real de organização e acompanhamento da rotina estudantil.**

</div>

## Visão do produto

O **Presença+** centraliza informações que normalmente ficam espalhadas entre controles manuais, registros administrativos e consultas individuais. A proposta é oferecer uma experiência simples para alunos e equipe escolar, com navegação rápida, histórico preservado e regras claras de acesso.

O sistema foi pensado para ser utilizado por pessoas com diferentes níveis de familiaridade com tecnologia. Por isso, a interface prioriza linguagem direta, poucos passos por tarefa, ações previsíveis e separação clara entre consulta e administração.

## Versão atual

**Alpha 1.0**

A versão Alpha 1.0 representa a primeira consolidação funcional do produto. Ela reúne os principais fluxos de uso, a nova identidade visual do desktop, interface responsiva, autenticação, gestão escolar e integração com banco de dados em nuvem.

Nesta fase, o objetivo é validar o produto em condições próximas do uso real, corrigir inconsistências de experiência e fortalecer estabilidade, acessibilidade, segurança e desempenho antes de uma versão estável.

### Destaques da Alpha 1.0

- nova interface desktop com navegação lateral fixa;
- visão geral com indicadores e atalhos operacionais;
- área de alunos com matrículas, séries e turmas integradas;
- histórico com filtros, ordenação, paginação e ações por registro;
- cadastro e autocadastro de alunos com regras institucionais;
- renovação de matrícula e virada de ano letivo;
- comunicados, relatórios e exportação para Excel;
- autenticação e banco de dados no Supabase;
- controles de acesso por perfil;
- modo escuro, responsividade e suporte a redução de movimento;
- rotina de continuidade para reduzir pausas por inatividade no plano gratuito do banco.

## O problema

Rotinas escolares simples podem exigir várias consultas, conferências e registros repetitivos. Quando essas informações ficam fragmentadas, tarefas como localizar um aluno, consultar histórico, acompanhar limites de atraso ou atualizar uma matrícula passam a depender de mais tempo e mais etapas do que deveriam.

O Presença+ nasceu para reduzir essa fricção. A plataforma organiza os dados em torno das tarefas mais frequentes e mantém o histórico necessário para conferência e auditoria.

## A solução

A aplicação separa a experiência em três contextos principais:

| Perfil | Experiência |
| --- | --- |
| **Aluno** | Consulta do próprio histórico, situação escolar e comunicados. |
| **Secretaria** | Gestão de matrículas, cadastros, turmas e operações escolares autorizadas. |
| **Direção** | Supervisão administrativa, regras, auditoria, privacidade e configurações institucionais. |

As permissões são verificadas no banco de dados e não apenas na interface. Isso evita que a simples manipulação do frontend conceda acesso a funções administrativas.

## Experiência de uso

A interface foi redesenhada com referência em portais institucionais e sistemas administrativos modernos. O foco visual está em legibilidade, consistência e velocidade de operação.

Princípios adotados:

- hierarquia clara de informações;
- navegação lateral persistente no desktop;
- busca contextual nas áreas que realmente precisam dela;
- tabelas legíveis e filtros próximos do conteúdo;
- ações importantes sempre visíveis;
- redução de informações duplicadas;
- feedback visual curto e discreto;
- animações leves, evitando impacto perceptível de desempenho;
- adaptação para telas menores sem replicar a interface desktop de forma forçada.

## Funcionalidades principais

### Gestão de alunos

A área de alunos concentra lista, matrículas, acessos, séries e turmas. A intenção é evitar que a equipe precise alternar entre várias páginas para concluir um cadastro ou atualização escolar.

### Histórico

O histórico preserva ocorrências e alterações relevantes, com filtros por período, aluno, turma e situação. Correções permanecem identificáveis para que uma alteração não apague silenciosamente o contexto anterior.

### Matrículas e contas

Alunos previamente cadastrados pela escola podem criar a própria conta usando os dados institucionais correspondentes. Cadastros iniciados pelo próprio estudante aparecem como fichas pendentes para conferência da equipe escolar.

### Ano letivo

A plataforma possui fluxo de renovação anual. A mudança não precisa ocorrer em 1º de janeiro: a instituição pode definir datas de encerramento e abertura do ano letivo. Alunos aprovados avançam de série, reprovados permanecem na etapa e concluintes deixam a base ativa sem perder o histórico.

### Relatórios

Usuários institucionais autorizados podem gerar relatórios e planilhas com filtros. A exportação foi projetada para evitar a exposição de informações que não são necessárias para a finalidade do relatório.

## Projeto de TCC

O Presença+ é desenvolvido como **Trabalho de Conclusão de Curso**, a partir de uma necessidade observada no ambiente escolar.

O projeto não foi pensado apenas como demonstração visual. Seu desenvolvimento envolve etapas típicas de um produto de software aplicado:

- levantamento de problema e requisitos;
- modelagem de dados;
- definição de perfis e permissões;
- desenvolvimento de interface e fluxos;
- integração com serviços externos;
- testes automatizados;
- revisão de segurança e privacidade;
- validação de usabilidade;
- evolução por versões.

A condição de TCC faz parte do contexto acadêmico do projeto, mas não reduz os critérios técnicos adotados. A Alpha 1.0 busca demonstrar uma solução funcional, coerente e auditável, com espaço explícito para validação e evolução.

## Tecnologia

O Presença+ utiliza uma arquitetura web enxuta:

**Frontend**
- HTML, CSS e JavaScript;
- interface responsiva;
- hospedagem estática via GitHub Pages.

**Backend e dados**
- Supabase Auth;
- PostgreSQL;
- Row Level Security (RLS);
- funções SQL e RPCs para operações institucionais;
- Edge Functions em fluxos específicos.

A aplicação não depende de servidor local para operar em produção.

## Segurança e privacidade

O sistema trata informações escolares e, por isso, segurança e privacidade fazem parte do desenho do produto.

Entre as medidas adotadas estão:

- autenticação individual;
- separação de permissões por função;
- políticas RLS no banco;
- uso de chave publicável no cliente;
- ausência de chave de serviço no frontend;
- histórico de ações administrativas;
- validações no banco para operações sensíveis;
- documentos de Termos de Uso e Política de Privacidade acessíveis antes do login;
- preservação de registros quando há correções ou mudanças de período.

O projeto não deve ser interpretado como substituto automático dos sistemas oficiais da rede de ensino. Seu uso depende da autorização e das regras da instituição responsável pelos dados.

A confirmação de leitura dos Termos de Uso e da Política de Privacidade **não**
representa consentimento genérico para qualquer tratamento de dados pessoais; as operações devem permanecer vinculadas à finalidade escolar e à base legal aplicável.

## Qualidade

O desenvolvimento mantém uma suíte automatizada para reduzir regressões durante as atualizações. Os testes cobrem regras de interface, fluxos principais, documentos legais, relatórios, responsividade, virada de ano, continuidade do banco e comportamentos críticos do frontend.

Além da automação, a evolução da Alpha depende de validação visual e operacional em navegadores reais, especialmente nos fluxos que envolvem autenticação, permissões e diferentes tamanhos de tela.

## Estado do projeto

| Área | Estado |
| --- | --- |
| Interface desktop | Alpha funcional |
| Interface mobile | Funcional e responsiva |
| Autenticação | Integrada ao Supabase |
| Gestão de alunos | Funcional |
| Histórico | Funcional |
| Matrículas e turmas | Funcional |
| Relatórios | Funcional |
| Virada de ano letivo | Implementada para validação |
| Auditoria e privacidade | Implementadas |
| Testes automatizados | Ativos |
| Versão estável | Ainda não lançada |

## Próximos marcos

A evolução após a Alpha 1.0 prioriza:

1. homologação completa dos fluxos com contas reais autorizadas;
2. refinamento visual em diferentes resoluções de desktop;
3. redução de etapas em operações administrativas frequentes;
4. fortalecimento dos testes de navegador;
5. revisão final de acessibilidade;
6. preparação da primeira versão estável.

## Licença e uso

O projeto possui licença de uso institucional restrita. A disponibilidade do código não autoriza acesso, publicação ou reutilização de dados escolares.

---

<div align="center">

**Presença+ · Alpha 1.0**  
Tecnologia aplicada à organização da rotina escolar.

</div>
