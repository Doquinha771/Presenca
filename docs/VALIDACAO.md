# Validação e homologação

## Executado nesta entrega

- `node --check assets/app.js`, `assets/utils.js` e `assets/boot.js`: passou.
- `node --test tests/unit.test.js`: **7 testes passaram, 0 falhas**.
- Cobertura unitária: escape de HTML; formato de e-mail; neutralização de fórmulas CSV; mensagens de erro; horário de São Paulo; inspeção estrutural das proteções SQL; ausência de chaves secretas e persistência escolar local no frontend.
- Revisão manual da migração: preservação de tabelas/dados; projeções sem nascimento para a Secretaria; autorização interna de RPCs; locks; idempotência; revogação das RPCs antigas; acesso por UUID.

Os testes estruturais não executam PostgreSQL e não comprovam a correção das funções ou RLS.

## Tentado, mas bloqueado

- `node tests/browser.mjs`: a integração Node/Playwright não está disponível neste ambiente e o navegador de sistema bloqueia a navegação local por política administrativa. Nenhuma aprovação visual em navegador foi produzida para esta atualização.
- PostgreSQL/psql e Supabase CLI indisponíveis no ambiente.
- Acesso conectado ao Supabase retornou lista vazia de projetos. Nenhuma inspeção ou migração do banco real foi executada.
- Rede do ambiente não permitiu obter dependências adicionais. A migração está versionada numericamente em `sql/03_v4.sql`; não foi gerada pelo CLI indisponível.

## Incluído para execução

- `tests/database.sql`: cadastro sem matrícula negado, dados autoritativos do cadastro, metadados não concedem cargo, acesso cruzado negado, escrita direta negada, Secretaria sem poderes da Direção, RPC antiga revogada, quinto atraso, nova chance, idempotência, duplicação, desfazimento e expiração, perdão, preservação de histórico, suspensão e acesso anônimo.
- `tests/concurrency.mjs`: duas conexões disputam o quinto atraso; apenas uma insere. Duas conexões repetem o mesmo pedido; ambas recebem resposta válida sem duplicação.
- `tests/browser.mjs`: telas por função, rotas em subdiretório, atualização, busca por teclado, envio de registro, modal de nova chance, escape de conteúdo, erros de conexão, layout mobile sem transbordamento e cadastro. **A API é simulada**, então isso não valida autenticação real nem RLS.
- `.github/workflows/verify.yml`: executa as suites em um banco descartável, sem chaves ou acesso ao banco de produção. O workflow ainda não foi executado por esta entrega.

## Critérios para liberação

1. Aplicar e testar a migração numa cópia de homologação do esquema real. Comparar contagens antes/depois; conferir alunos arquivados, limites aumentados e períodos encerrados antigos.
2. Rodar a automação incluída e resolver todas as falhas antes de publicar.
3. Usar duas contas de aluno e duas de funcionários reais de homologação para testar login, confirmação de e-mail, recuperação, sessão expirada e suspensão.
4. Tentar chamar `portal_read('history', {student: outro_uuid})` como aluno: deve negar. Tentar `portal_write` administrativo como Secretaria: deve negar. Repetir por HTTP/Data API, não somente pela interface.
5. Registrar o quinto atraso, tentar o sexto, conceder nova chance, registrar novamente e conferir persistência em outro dispositivo.
6. Perdoar um registro do período, desfazer um recente e tentar desfazer após dois minutos. Conferir histórico e auditoria.
7. Testar cliques repetidos, resposta perdida e dois funcionários simultâneos.
8. Conferir o GitHub Pages real em celular/desktop, rotação, teclado, foco de modal, acessibilidade e recarregamento de rota. A existência do CSS responsivo não substitui essa verificação.
9. Configurar privacidade institucional, e-mail, redirecionamentos, limites Auth e agendador opcional.

A migração não está declarada concluída nem aprovada para produção enquanto essas validações estiverem pendentes.
