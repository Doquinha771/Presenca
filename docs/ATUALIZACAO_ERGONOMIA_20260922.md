# Presença+ | Interface e acesso (22/09/2026)

## Interface entregue

- Retirado o perfil duplicado do canto superior do painel. Nome e cargo do usuário aparecem na barra lateral.
- Menu da esquerda ordenado por uso: tarefas diárias, organização e funções administrativas, com os itens previstos para cada cargo. A rota antiga de Matrículas continua direcionando à área Alunos.
- Sidebar permanece presa à tela em desktop e a navegação ganha rolagem independente, sem empurrar nome de usuário ou botão de sair para fora da tela. A gaveta móvel permanece fixa e fechada fora de uso.
- Rodapé usa `margin-top:auto`, sem sobreposição com o conteúdo, e exibe exatamente: "feito pelos alunos do 3-A e com apoio da direção.".
- Formulários, botões, filtros, tabelas e contraste padronizados na folha `assets/ergonomia.css`, carregada após as folhas existentes.
- Ícones exibidos com Flaticon Uicons Regular Rounded via CDN oficial (sem incluir fontes no projeto), com crédito visível e CSS/CSP ajustados. O carregamento dos ícones **depende de acesso à CDN**; a interface continua textual e funcional caso a CDN esteja indisponível.
- Nenhuma chamada RPC, dado escolar, permissão, senha ou chave do Supabase foi alterada nesta atualização.

## Auditoria de autenticação real

Projeto conectado `svidahhpqozfaletpcbq`: 1 perfil de aluno e 1 perfil de administrador ativos, verificados e com e-mail Auth confirmado; aluno com matrícula ativa vinculada. Não há conta de secretaria cadastrada no momento da auditoria. Essas verificações usam consultas SQL de leitura e não implicam login real, teste de envio de e-mail, recuperação de senha ou teste com credenciais de terceiros.

A organização conectada está no **Supabase Free**. A proteção nativa de senhas vazadas está disponível somente no **Pro e superiores** segundo a documentação Supabase. Logo, não é possível ativar essa função nativa no plano atual por meio de SQL ou das ferramentas disponíveis. Nenhum plano foi alterado, nenhum usuário criado, nenhum segredo acessado e nenhuma cobrança autorizada.

## Validação ainda exigida antes de uso institucional

Com contas de teste próprias e autorizadas, testar separadamente os perfis aluno, secretaria e direção: login com confirmação de e-mail, recuperação de senha, matrícula pendente e aprovada, permissão de acesso direto por API, registro de atraso e auditoria. Para validar Secretaria é preciso cadastrar e autorizar previamente uma conta institucional legítima.

A suite `npm test` e `npm run check` verificam estrutura e sintaxe. A suite de browser com rede de Supabase simulada **não** testa logins reais. A navegação local via Chromium é bloqueada por política do ambiente atual; validar layout visual final no navegador real e no GitHub Pages antes da publicação institucional.
