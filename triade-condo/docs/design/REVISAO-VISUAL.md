# Revisão da referência Lattice

Foram revistos os quatro ZIPs e os seis prints fornecidos. O tour geral (ZIP 2) é a referência principal para a variante clara. Os tours Goals (ZIP 1) e Performance (ZIPs 3 e 4) também contêm variantes com navegação escura e telas administrativas; não foram misturadas na base clara.

Valores confirmados no CSS incorporado à captura c.navattic.com/api/nk_cmrwgz2vr00043b6xgqs0j1la.html do ZIP 2:
- Fonte: Inter; corpo 14–16 px, título principal 32 px e entrelinha ajustada ao conteúdo.
- Texto primário: #1B1F3A; secundário: #495073.
- Borda suave: #DBE2EE; controles: #A4B1CD.
- Fundo neutro: #EFF2F8; destaque suave: #F1F0FF.
- Seleção lilás: #8576F3; acento forte: #6D44EF.
- Cabeçalho: gradiente vertical #D4D4FF a #E4D3FF, marco de 140 px.
- Raios: campos 6 px, controles 8 px, cartões 12 px.
- Sombra de cartão: 0 1px 3px rgba(27,31,58,.2).

Detalhes ajustados: faixa de cabeçalho contínua, fundo branco, largura e altura da navegação, divisores, espessura dos ícones, peso dos títulos, linha de base dos números, densidade de tabelas, bordas dos filtros, foco de teclado e alvos de toque no celular.

A estrutura e o conteúdo são da TRÍADE. A densidade e a altura de blocos variam com o texto; esta é uma adaptação fiel dos componentes, não uma cópia pixel a pixel da aplicação Lattice. A marca TRÍADE e as cores funcionais da Plataforma foram mantidas. O tema escuro é uma adaptação da TRÍADE: os prints com menu escuro não mostram um tema totalmente escuro.

Os arquivos de fonte .woff2 dos ZIPs são respostas vazias, não fontes utilizáveis. Mantida a Inter pelo Google Fonts com alternativas locais. Os dados JSON e a lógica original do painel continuam intactos.

## Ajuste das cores semânticas
Fundos de status: menta #E6FAF3, amarelo #FBF3C9, vermelho suave #FFEDED, azul #E8F3FF e lilás #F1F0FF. Texto, ícone e contorno usam tokens separados. As amostras agora mostram o fundo suave com um pequeno detalhe da cor forte. Barras de progresso usam turquesa e âmbar claros. Texto e dados mantidos.

## Dois frontends definidos
Plataforma: navegação branca flutuante e barra superior. Console: referência Admin overview, lateral contínua #EFF2F8, menus agrupados, selo Admin e conteúdo branco. Exemplos e quadro de aplicação em design-frontend.html. O menu escuro do tour Goals não é a referência escolhida para o Console. A tipografia e as cores dos componentes são compartilhadas.

Console Admin: banners, identificação Admin e ícones usam lilás e azul-acinzentado, em harmonia com a Plataforma. O verde do banner da referência Lattice não foi adotado. Verde permanece reservado a estados de sucesso.
