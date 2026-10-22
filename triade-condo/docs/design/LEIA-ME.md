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
| Início completo: faixa, Agora, Hoje na agenda e Vencimentos, e os outros cartões em "Por área" (no celular, uma lista curta com o número do que pede atenção) | `telas-modelo/inicio-computador.html` e `telas-modelo/inicio-celular.html` |
| Agenda: filtros com a cor de cada origem, dia num quadrado, origem em cada item e, no celular, a semana no topo | `telas-modelo/agenda-computador.html` e `telas-modelo/agenda-celular.html` |
| Manutenção, no modelo da lista: abas internas, situação, o que pede atenção, quem executa e retorno | `telas-modelo/manutencao-computador.html` e `telas-modelo/manutencao-celular.html` |
| Decisões, com as alternativas no cartão, e a janela Decidir | `telas-modelo/decisoes-computador.html`, `telas-modelo/decisoes-celular.html` e `telas-modelo/decidir.html` |
| Moradores e unidades: abas Unidades, Pessoas, Garagens e A confirmar; busca, Filtros numa janela, ocupação em botões, o que pede atenção em atalhos e a lista que vira cartões no celular; montar o prédio (planilha, divisões, unidades, vagas e organização) num menu e Cadastrar pessoa como único botão principal | `telas-modelo/moradores-unidades-computador.html`, `telas-modelo/moradores-unidades-celular.html`, `telas-modelo/moradores-pessoas-computador.html`, `telas-modelo/moradores-confirmar-computador.html` e `telas-modelo/moradores-garagens-computador.html` |
| Ficha da unidade, com as pessoas em cartão, as ações de cada uma num menu, a situação da unidade com interruptores que gravam na hora e as garagens | `telas-modelo/unidade-ficha-computador.html` e `telas-modelo/unidade-ficha-celular.html` |
| Cadastrar pessoa (partes numeradas no computador, 3 passos no celular) e Importar planilha (3 passos, área para escolher ou arrastar o arquivo e as colunas ao lado) | `telas-modelo/cadastrar-pessoa-computador.html`, `telas-modelo/cadastrar-pessoa-celular.html` e `telas-modelo/importar-planilha-computador.html` |
| Comunicados: abas Publicados (abre primeiro), Programados, Rascunhos e Arquivados; busca, Filtros (assunto e período), o que pede atenção só quando existe, e a linha inteira abre o comunicado, com um selo de situação e data | `telas-modelo/comunicados-lista-computador.html` e `telas-modelo/comunicados-lista-celular.html` |
| Ficha do comunicado: Corrigir como único principal, Arquivar em Mais ações, o texto sem caixa cinza, Como chegou com uma linha por canal e a ação dela, e Andamento numa linha do tempo só (versões e histórico juntos) | `telas-modelo/comunicado-ficha-computador.html` e `telas-modelo/comunicado-ficha-celular.html` |
| Escrever comunicado: 3 partes (O que avisar, Para quem e como chega, Quando), quem vai receber ao lado com o número grande, rodapé fixo com Salvar rascunho e o principal que diz o que acontece ("Programar para 25/10 às 08:00"); no celular, 3 passos | `telas-modelo/escrever-comunicado-computador.html` e `telas-modelo/escrever-comunicado-celular.html` |
| Documentos: faixa Documentos e Memória do prédio, abas Em vigor, Arquivados e Pedidos por e-mail, o tipo em Filtros, quem vê como selo e a validade em âmbar quando perto e em vermelho só vencida | `telas-modelo/documentos-lista-computador.html` e `telas-modelo/documentos-lista-celular.html` |
| Ficha do documento: Nova versão como principal (Enviar o arquivo quando não há arquivo), Enviar por e-mail ao lado, Editar e Arquivar em Mais ações, a versão em vigor num cartão com Abrir e Baixar, Quem vê e o histórico com texto quando vazio | `telas-modelo/documento-ficha-computador.html` e `telas-modelo/documento-ficha-celular.html` |
| Vida em condomínio: um trilho de ícones com Reservas, Enquetes, Assembleias e Classificados numa tela só (A.1), uma frase sob o título e o principal de cada parte | `telas-modelo/vida-reservas-computador.html` e `telas-modelo/vida-reservas-celular.html` |
| Reservas: os pedidos da mesma área e dia num cartão só, com um Decidir (B.1), a semana da área ao lado, a janela Decidir (qual pedido fica com o dia; os outros recebem a recusa com o motivo), a ficha da reserva com Andamento e Cancelar em Mais ações, e Nova reserva com o horário da área | `telas-modelo/vida-decidir-reserva.html`, `telas-modelo/vida-reserva-ficha.html` e `telas-modelo/vida-nova-reserva.html` |
| Enquetes: abas Abertas e Encerradas, a linha inteira abre a ficha; a ficha com resultado, Andamento, Sem resposta (com Copiar o link) e Responderam, Encerrar em Mais ações e Publicar o resultado como principal depois de fechada; Nova enquete em página com Quem vai receber ao lado (D.1) | `telas-modelo/vida-enquetes-computador.html`, `telas-modelo/vida-enquete-ficha-computador.html`, `telas-modelo/vida-enquete-ficha-celular.html` e `telas-modelo/vida-nova-enquete-computador.html` |
| Assembleias: abas Próximas, Em andamento e Encerradas, a regra em vigor numa linha, Regras e Frações em Mais ações (C.1); Nova assembleia em 3 partes no computador e 3 passos no celular, com a Convocação ao lado; a ficha com um principal por situação, Presença com o número grande, a pauta com o item aberto em destaque e as Unidades com busca, filtros e o menu de cada unidade | `telas-modelo/vida-assembleias-computador.html`, `telas-modelo/vida-nova-assembleia-computador.html`, `telas-modelo/vida-nova-assembleia-celular.html`, `telas-modelo/vida-assembleia-ficha-computador.html` e `telas-modelo/vida-assembleia-ficha-celular.html` |
| Classificados: abas A aprovar, No mural e Encerrados, o texto do morador citado no cartão e a janela Revisar o anúncio, com Publicar no mural como principal e Recusar ao lado | `telas-modelo/vida-classificados-computador.html` e `telas-modelo/vida-revisar-anuncio.html` |

Cada tela-modelo tem um PNG com o mesmo nome. Os HTML são referência visual exportada do quadro de desenho: não são código do app e não usam o tema do sistema.

## Regras que não mudam

- Não se mudam as fontes (Manrope, Playfair Display itálico e IBM Plex Mono) nem a paleta oficial (DC13).
- Cada tela tem no máximo um botão principal. Cartão e linha de lista nunca levam botão principal.
- Ícones só do conjunto oficial (`sistema/packages/ui/src/Icone.tsx`), sempre com palavra junto. Se faltar algum, ele entra primeiro no conjunto.
- O selo é uma pílula de canto redondo, com a cor da situação no fundo, na borda e na letra, sem a faixa lateral da DC13 (decisão da Carolina em 22/10/2026, para ficar igual às telas-modelo). O aviso continua com a faixa.
- Uma cor por situação: Aberto em petróleo, Em andamento em violeta, Em revisão em âmbar, Encerrado em jade e Cancelado em cinza. A prioridade só aparece quando é Alta ou Urgente. O ícone da categoria fica sempre em cinza.
- Arte da marca (anéis, arco e traço laranja) em três tamanhos: cheia nas telas de entrar, faixa no topo do Início e leve nas telas vazias. No máximo uma arte por tela, e ela nunca encosta no texto.
- Nenhuma tela usa emoji.
- Formulário longo no celular vai em passos: barra de progresso no alto, Continuar e Voltar embaixo, os passos feitos resumidos no topo com "Alterar", e nada do que foi preenchido se perde ao voltar. No computador o mesmo formulário fica numa tela só, em partes numeradas.
- Ação que é de uma linha (editar, recusar, encerrar, tirar de uso) fica no menu de três pontos da linha, e o nome dele diz de quem é ("Ações de Joana Lima"). O que monta a tela (importar, incluir divisões, unidades e vagas) fica num menu no topo, ao lado do único botão principal.
- Agenda: cada origem tem sua cor (compromisso violeta, preventiva jade, reserva petróleo, contrato âmbar, documento rubi, assembleia violeta-claro e feriado cinza), a mesma no filtro e no traço de cada item.
- Toda tela nova é desenhada e aprovada antes do código. As telas que faltam passam ao padrão novo por grupo do menu, em rodadas: Dia a dia, Comunicação, Prédio e pessoas, Gestão e, por fim, as páginas por link e o Console.

## O que saiu

Em 21/10/2026 saíram o `design-frontend.html` (base Lattice, fonte Inter e Plataforma verde-petróleo, superada pela DC13), o `tema-triade.css`, o `navegacao-triade.js`, a revisão visual e as prévias antigas desta pasta. Também saíram, de `docs/identidade`, a proposta, as versões para escolher, as comparações de letras, o plano de aplicação (já executado) e as telas-modelo da DC13, que foram substituídas pelas desta pasta. Tudo continua no histórico do git.

Os desenhos em `docs/telas` ficam onde estão, porque o painel cita cada um como evidência do que foi aprovado. Eles valem para o **conteúdo** de cada peça (o que a tela mostra e faz). O **visual** segue esta pasta.
