# Checklist de avaliação institucional — Presença+

**Natureza:** minuta técnica e jurídica de apoio à decisão. Não substitui
parecer da assessoria jurídica, autorização da direção competente ou orientações
da Secretaria da Educação do Estado de São Paulo.

## Antes do uso com dados reais

- [ ] Identificar, por escrito, a unidade responsável, o controlador legal,
      o responsável técnico e qualquer operador contratado. A escola, isoladamente,
      pode não ser a pessoa jurídica controladora.
- [ ] Obter autorização institucional e confirmar se ferramentas externas
      desse tipo são permitidas pelas normas da rede estadual.
- [ ] Documentar finalidade, necessidade, fluxo e base legal de cada dado
      (arts. 6º, 7º, 14 e 23 da LGPD). Não utilizar um checkbox como
      consentimento genérico ou substituto da base legal.
- [ ] Avaliar o melhor interesse dos menores, revisar quem pode visualizar
      RA, nascimento, matrículas, atrasos e auditorias; documentar medidas
      diferenciadas de proteção.
- [ ] Avaliar a hospedagem Supabase na região atual us-west-2 (EUA), os
      contratos aplicáveis e o mecanismo jurídico da transferência internacional
      (LGPD, art. 33; Resolução ANPD 19/2024). Confirmar políticas de TI da rede.
- [ ] Designar e publicar contato oficial do responsável/encarregado,
      identificar o controlador e estabelecer canal de atendimento aos
      titulares e aos responsáveis legais.
- [ ] Definir tabela de temporalidade, prazos de guarda, regras de correção,
      arquivamento e eliminação, evitando apagar histórico obrigatório para
      economizar armazenamento.
- [ ] Testar autenticação, credenciais temporárias, RLS, autorização em RPCs,
      Edge Function, restauração de backup e tratamento de incidentes.
- [ ] Confirmar que nenhum RA, senha, aniversário, token, relatórios Excel agregados ou
      dado pessoal esteja no código, repositório, console público ou páginas
      HTML; nunca publicar chaves secretas.
- [ ] Definir tratamento de incidentes: comunicar internamente de imediato;
      quando houver risco ou dano relevante, o controlador deve avaliar
      notificação à ANPD e aos titulares, em regra em três dias úteis.
- [ ] Revisar os Termos e a Política de Privacidade com a instituição e seu
      assessor jurídico. Publicar as versões finais e seus contatos oficiais;
      manter histórico de revisões e, se exigido, registro verificável de ciência.

## Campos que precisam de validação antes da implantação

1. Identificação jurídica do controlador e relação com a escola.
2. Nome e meio de contato do encarregado/canal institucional de privacidade.
3. Norma/ato de autorização da utilização do portal e base legal documentada.
4. Política de retenção e tabela de temporalidade dos registros.
5. Avaliação dos contratos de nuvem e transferência internacional.
6. Procedimento de recuperação de senha e de atendimento a alunos menores.
7. Evidências de treinamento da equipe e de testes de autorização.

## Fontes normativas e orientativas consultadas

- LGPD, Lei 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- Enunciado CD/ANPD 1/2023 (crianças e adolescentes): https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes
- Guia da ANPD sobre tratamento pelo poder público: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_tratamento_de_dados_pessoais_pelo_poder_publico
- Resolução ANPD 19/2024 (transferência internacional): https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024
- Comunicação de incidentes, ANPD: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- Guia da ANPD sobre agentes de tratamento: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado
