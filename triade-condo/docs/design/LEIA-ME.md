# Novo frontend TRÍADE: o padrão das telas

Este é o padrão visual em vigor das duas aplicações, a Plataforma do síndico e o Console TRÍADE. Foi aprovado pela Carolina em 21/10/2026 (DC15). Toda tela nova, ou tela redesenhada, parte daqui.

## O que vale e onde está

| O quê | Arquivo |
|---|---|
| Cores, fontes e logo (DC13) | `../identidade/sistema.html` e os PNGs do logo em `../identidade/` |
| Como usar: escala de letra e de espaço, cantos e sombras, regra de cada lugar, botões, ícones, anexar arquivos e arte da marca | `guia-padroes.html` (imagem em `guia-padroes.png`) |
| Moldura nova: menu em 4 grupos, busca no topo e barra de baixo no celular | `telas-modelo/moldura-computador.html` e `telas-modelo/moldura-celular.html` |
| Tela sem permissão, vazia e com erro | `telas-modelo/estados.html` |
| Ficha do pedido, que é o modelo de toda ficha | `telas-modelo/pedido-ficha-computador.html` e `telas-modelo/pedido-ficha-celular.html` |
| Lista de pedidos, que é o modelo de toda lista | `telas-modelo/pedido-lista-computador.html` e `telas-modelo/pedido-lista-celular.html` |
| Registrar pedido, que é o modelo de toda janela de formulário: no computador numa tela só, com quem fica sabendo ao lado; no celular em 3 passos com barra de progresso; e a confirmação depois de registrar | `telas-modelo/pedido-registrar-computador.html`, `telas-modelo/pedido-registrar-celular-1.html` a `-3.html` e `telas-modelo/pedido-registrado.html` |

Cada tela-modelo tem um PNG com o mesmo nome. Os HTML são referência visual exportada do quadro de desenho: não são código do app e não usam o tema do sistema.

## Regras que não mudam

- Não se mudam as fontes (Manrope, Playfair Display itálico e IBM Plex Mono) nem a paleta oficial (DC13).
- Cada tela tem no máximo um botão principal. Cartão e linha de lista nunca levam botão principal.
- Ícones só do conjunto oficial (`sistema/packages/ui/src/Icone.tsx`), sempre com palavra junto. Se faltar algum, ele entra primeiro no conjunto.
- Uma cor por situação: Aberto em petróleo, Em andamento em violeta, Em revisão em âmbar, Encerrado em jade e Cancelado em cinza. A prioridade só aparece quando é Alta ou Urgente. O ícone da categoria fica sempre em cinza.
- Arte da marca (anéis, arco e traço laranja) em três tamanhos: cheia nas telas de entrar, faixa no topo do Início e leve nas telas vazias. No máximo uma arte por tela, e ela nunca encosta no texto.
- Nenhuma tela usa emoji.
- Formulário longo no celular vai em passos: barra de progresso no alto, Continuar e Voltar embaixo, os passos feitos resumidos no topo com "Alterar", e nada do que foi preenchido se perde ao voltar. No computador o mesmo formulário fica numa tela só, em partes numeradas.
- Toda tela nova é desenhada e aprovada antes do código.

## O que saiu

Em 21/10/2026 saíram o `design-frontend.html` (base Lattice, fonte Inter e Plataforma verde-petróleo, superada pela DC13), o `tema-triade.css`, o `navegacao-triade.js`, a revisão visual e as prévias antigas desta pasta. Também saíram, de `docs/identidade`, a proposta, as versões para escolher, as comparações de letras, o plano de aplicação (já executado) e as telas-modelo da DC13, que foram substituídas pelas desta pasta. Tudo continua no histórico do git.

Os desenhos em `docs/telas` ficam onde estão, porque o painel cita cada um como evidência do que foi aprovado. Eles valem para o **conteúdo** de cada peça (o que a tela mostra e faz). O **visual** segue esta pasta.
