# Base visual TRÍADE Condo

Abra design-frontend.html para ver a biblioteca visual ou painel-execucao.html para acompanhar o planejamento. Os HTMLs têm os estilos e a navegação incorporados e podem ser abertos diretamente no navegador.

## Direção visual
Navegação lateral clara, cabeçalho de busca, destaque lilás, cartões com bordas suaves e tabelas com bastante espaço. A referência de composição é a Lattice; a marca e o conteúdo são da TRÍADE. O logo oficial está em `docs/identidade` (DC13). Plataforma: verde-petróleo; Console e navegação: violeta. Inter é a fonte principal, com alternativas locais caso não haja internet.

## Arquivos reutilizáveis
- tema-triade.css: camada de tema utilizada nos dois HTMLs, para reutilizar com as estruturas e estilos base desses documentos.
- navegacao-triade.js: busca por seção, navegação móvel, destaque da seção e alternância de tema. Depende da estrutura do cabeçalho e da barra lateral presente nos HTMLs.

Os estilos e o script também estão incorporados em cada HTML. Ao editar o tema separado, atualize as cópias incorporadas ou substitua-as por referências aos arquivos externos.

## Escopo
Base visual e documentos de planejamento. Os botões demonstrativos da biblioteca são amostras de componentes, sem operações de negócio. Nenhum backend foi criado. Os dados, status e lógica original do painel foram preservados.

As referências a mapa.html, IDEIAS.md e CONTEXTO.md foram mantidas, mas esses documentos não foram fornecidos. Para funcionar, precisam ser colocados na estrutura original de pastas. A fonte Inter é carregada do Google Fonts quando houver conexão.

## Verificação
Conferência de igualdade dos dados e do script original do painel; filtros, temas e busca testados no navegador. Layout inspecionado em desktop e celular. Não houve auditoria completa de acessibilidade.

## Revisão de fidelidade
Veja REVISAO-VISUAL.md para os valores extraídos dos ZIPs. A revisão mantém os textos, dados e scripts anteriores e ajusta somente a apresentação. Prévias atualizadas em previa-design.png e previa-painel.png.

## Identidade adotada — 16/10/2026
Paleta e tipografia seguem a interface Lattice das referências fornecidas, conforme a seção “Base adotada” de design-frontend.html. Esses dois itens foram definidos por Carolina; não são provisórios. Logo oficial, tom de voz e aprovação dos demais componentes permanecem separados.

## Duas estruturas de frontend
A seção “Dois sistemas, uma família” apresenta exemplos da Plataforma do síndico e do Console TRÍADE Admin. A navegação administrativa segue os prints Admin overview: lateral contínua azul-acinzentada com grupos e identificação persistente Admin. Os exemplos são ilustrações, sem funções de negócio.
