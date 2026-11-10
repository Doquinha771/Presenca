# Relatório técnico — Presença+ 5.2 · UI e exportação

A estrutura visual da Visão geral passou a ser compartilhada por todas as telas autenticadas: cabeçalho e perfil, botões com ícones, cartões, filtros, navegação inferior no mobile e sidebar no desktop. A folha `assets/portal-layout.css` contém as adaptações gerais. O login e os documentos jurídicos continuam independentes.

O resumo Excel agregado original permanece disponível, com três abas e sem identificadores individuais. Os relatórios de alunos, matrículas e histórico são **outro fluxo**, com acesso restrito a Secretaria e Direção. A consulta nominal passa por `public.portal_export` no PostgreSQL (migração 07), sem fazer consulta irrestrita no navegador. Paginação em lotes de 200 registros, limite de 10 mil antes de exigir mais filtros, nenhuma senha, nascimento ou motivo individual exportado. O arquivo XLSX é gerado localmente no navegador, sem dependência de XLSX externa nem armazenamento em Storage.

O histórico filtrado por turma ou série utiliza a turma **atual** do cadastro do aluno; não reconstrói a turma que ele frequentava na data de uma ocorrência antiga. Para histórico por turma de origem, é necessário registrar a turma do aluno em cada ocorrência, com migração e avaliação institucional próprias.

O pedido de exportação é auditado sem registrar nomes e RA no log. Quem baixa é responsável por preservar os arquivos fora de áreas públicas. A presença de controles técnicos não substitui autorização e procedimentos escolares previstos na legislação de proteção de dados.

`npm test && npm run check` é a verificação automatizada local. A tentativa de teste de interface por navegador foi bloqueada pela política de rede do ambiente (ERR_BLOCKED_BY_ADMINISTRATOR). Não foi feita validação da migração em banco remoto nem medição Lighthouse do site publicado.
