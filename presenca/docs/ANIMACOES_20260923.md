# Movimentos leves | Presença+ 5.2

- Navegação entre páginas: entrada curta (170 ms), acionada uma vez por rota.
- Busca, filtros, edição e atualização dos dados: sem reanimar o painel inteiro.
- Campos, abas, botões e menus: transições curtas, sem recalcular layout ou carregar bibliotecas.
- Avisos, autenticação e diálogos: entrada curta, sem efeitos de fundo ou animações contínuas.
- `prefers-reduced-motion: reduce`: desliga todas as animações e transições visuais; `saveData` pula a entrada de páginas.
- Relatórios ou tabelas extensas (>30 mil caracteres de HTML): a entrada animada da página é ignorada.
- O Supabase, os fluxos de matrícula e as permissões não são alterados por esta atualização.
