# Mural do morador: conceito "Janela acesa"

Proposta de 26/10/2026 para a página pública do mural (CD-12, CD-15, AC-03, AC-05, MP-14): a que o morador abre pelo link ou pelo QR do elevador, sem conta nem senha. Substituiu o feed anterior de `sistema/apps/plataforma/src/telas/publico/Mural.tsx`, `MuralConteudo.tsx` e `comum.tsx`.

Telas-modelo: `telas-modelo/mural-morador-celular.html` (390 px, página inteira) e `telas-modelo/mural-morador-computador.html` (1280 px), com os PNGs ao lado.

**Aprovado pela Carolina em 26/10/2026**, com a frase "o que o prédio precisa saber" e as ideias novas 1 a 3 (CD-16, CD-17 e CD-18 no `IDEIAS.md`); as ideias 4 e 5 ficaram para depois. Construído no D4.40. O que ficou diferente do desenho: as enquetes ficam na coluna principal também no computador; o feed mostra uma foto por aviso (as outras ao abrir); o selo do assunto é a pílula do padrão (DC15), sem a faixa lateral; o destaque que não tem PDF mostra "Ler o aviso" no lugar de "Ler o edital (PDF)".

## 1. O que a identidade já tem, e o que o mural não usava

**Forte.** O violeta profundo (`#180567` a `#5808CC`) com a foto dos prédios ao entardecer e as janelas acesas em laranja: é a imagem que a Carolina aprovou para a tela de entrar e para a faixa do Início, e ela diz exatamente o que o produto é (um prédio à noite, gente em casa, luz acesa). O Manrope leve (peso 300) em tamanho grande, o selo com faixa lateral em degradê, o botão com brilho, os neutros lavanda, os ícones de traço fino sempre com palavra. A voz: frases curtas, segunda pessoa, o que acontece e o que fazer ("Encha as caixas na segunda à noite"), sem jargão e sem exclamação; e a frase de segurança que fecha toda página sem conta.

**Subaproveitado.** A arte da marca só aparece para quem tem senha (entrar e Início). O morador, que é quem mais vê a TRÍADE, nunca vê a foto. O IBM Plex Mono, que na agenda dá relevo à hora, não entra no mural. A faixa lateral do selo, que já carrega significado na Plataforma, não é usada para o único dado que diferencia um aviso do outro: o assunto. O Playfair itálico de uma palavra ("aqui"), que dá calor à tela de entrar, não chega ao morador.

**Gesto visual próprio da TRÍADE.** Um fundo violeta de entardecer com um único acento quente (a janela acesa, o traço laranja, a palavra em Playfair), e, sobre o fundo claro, cartões de canto 18 com uma faixa lateral que diz de que se trata. Não é cortiça, não é rede social: é um prédio com luz acesa.

## 2. Três conceitos

### A. Janela acesa (escolhido)
*O mural é a janela iluminada do prédio: quem passa olha e sabe o que está acontecendo lá dentro.*
A foto dos prédios abre a página, com o nome do condomínio em Manrope leve e uma linha em Playfair itálico quente. Abaixo, uma única camada "O que importa agora" com o dia em relevo, depois o feed em cartões onde o assunto, e não o remetente, ocupa o lugar nobre, com faixa lateral colorida, ícone e palavra. A data fala a língua da pessoa ("hoje, 09:10"; "sex 24/10"), em mono. O que é novo desde a última visita ganha um ponto laranja. Classificados e manual continuam na página, como vitrine e lista, sem virar filtro.

### B. Diário do prédio
*O mural é uma crônica datada, como o changelog de um produto.*
Linha do tempo vertical, data em mono na margem esquerda, quase sem cartões: título forte, texto, e a etiqueta de assunto no fim. "Esta semana" e "Antes" separados por uma régua. Muito legível, muito sóbrio, ótimo para quem lê tudo em sequência. Fraco em calor: não há arte da marca, foto fica pequena, e um aviso com evento (assembleia) não ganha o destaque que merece. Fica parecido com um blog de empresa.

### C. Folha de portaria
*O mural é a folha A4 do elevador, só que no celular.*
Um aviso por tela, letra grande, setas para passar de um para o outro, nada de lista. Forte para quem tem pouca familiaridade com celular e para ler no elevador em 20 segundos. Fraco para ver o conjunto (não se sabe quantos avisos há, nem o que é novo), e deixa enquetes, classificados e manual sem lugar natural. Vale como ideia para o modo "tela da portaria" (TV no hall), não como a página principal.

## 3. Por que A

**Para o morador.** Abre e reconhece o prédio e a TRÍADE em um segundo; a primeira tela responde "o que eu preciso saber hoje" (a assembleia, com dia, hora e lugar legíveis) em vez de mostrar duas enquetes que ele não consegue responder ali. Cada cartão diz do que se trata antes do título (Obras, Segurança, Lembrete), e a data diz "hoje" ou "ontem" em vez de "24/10 10:00". O que mudou desde a última vez fica marcado sem precisar de conta. O cartão inteiro é tocável e o rodapé diz o que acontece ("Ler o aviso").

**Para o síndico.** Nada novo para preencher: assunto, título, texto, arquivos, versão e correção já existem; o mural só passa a mostrar o que ele já escreve. O mural fica com cara de produto sério, o que ajuda a fazer o morador confiar na frase de segurança e a aceitar "Receber os avisos no WhatsApp". A prévia dentro do painel (CD-15) continua sendo a mesma peça, só com a faixa "Só no painel" embaixo de cada item.

**Diferente de rede social e de app genérico.** Sem avatar de remetente repetido, sem curtidas ou comentários, sem "fixado" duplicado, sem cartão branco igual ao outro. O que organiza a página é o tempo (agora, esta semana, antes) e o assunto, que é como um quadro de avisos de verdade se lê.

## 4. Anatomia

### Celular (390 px)

1. **Faixa com a foto** (328 px de altura): `entrada-predios.webp` em cobertura, degradê violeta-900 crescendo de cima para baixo até ficar sólido onde há texto (o texto nunca fica direto sobre a foto, como na tela de entrar). Dentro: rótulo "MURAL DO CONDOMÍNIO", o nome do condomínio em Manrope 300 a 34 px, uma linha em Playfair itálico `#ffd9a8` ("o que o prédio precisa saber"), "Atualizado hoje às 09:10 · 9 avisos, 2 enquetes" e o botão claro "Receber os avisos no WhatsApp" na largura toda (some quando o condomínio não tem o canal ligado). É a única arte da marca da tela.
2. **Abas que grudam no topo** ao rolar, no padrão de abas com sublinhado (não chips): Avisos 9 · Classificados 4 · Manual 4. Contagem no selo redondo. No celular, "Manual" sem "do prédio", para caber.
3. **O que importa agora**: um só cartão de destaque, com borda violeta-200 e sombra 2, nunca dois. O bloco de data em degradê violeta (mês, dia a 30 px em peso 300, dia da semana em laranja-200), o selo "Assembleia e convocação", "publicado sex 24/10" em mono, o título, a hora da 1ª e da 2ª chamada com o ícone de relógio e o lugar com o ícone de pino, a pauta em uma frase e dois botões: "Ler o edital (PDF)" em contorno e "Pôr na agenda" em discreto. Se não houver assembleia convocada, o destaque é o aviso mais recente com evento futuro; se não houver nenhum, a camada some e o feed sobe.
4. **Enquetes abertas** em um cartão compacto: cada enquete numa linha numerada, com a pergunta, "Aberta até qui 30/10 · uma por unidade", e uma nota única no fim dizendo que se responde pelo link pessoal. Não ocupa mais a primeira tela e não finge ter ação.
5. **Novos desde a última visita**: uma linha tracejada com o ponto laranja: "3 avisos novos desde a sua última visita, quinta 23/10", e a explicação "A marca fica só neste aparelho; ninguém sabe que você abriu". Some na primeira visita e quando não há nada novo.
6. **Esta semana** e **Antes**: título de seção a 18 px com a contagem à direita. Dentro, um cartão por aviso:
   - linha de cima: selo do assunto à esquerda (faixa lateral, ícone, palavra) e, à direita, "Novo" com o ponto laranja quando for o caso, e a data em mono ("hoje, 09:10", "ontem, 18:40", "sex 24/10, 16:20");
   - título a 17 px forte, que é o link do cartão inteiro;
   - foto, quando há, em 16:9 com canto 12 (ou o lugar da foto em degradê violeta com o ícone e a palavra "Foto" na tela-modelo);
   - texto em até três linhas, e a assinatura em cinza embaixo quando existe;
   - "Corrigido · versão 2: a data certa é 3/11, não 30/10" num selo claro com o ícone de informação, explicando a correção em vez de só dizer "Corrigido";
   - para aviso com evento, um bloco pequeno com o dia em relevo ("28 OUT | ter · 8h às 14h");
   - rodapé: "Ler o aviso ›" e "1 PDF" à esquerda, "Compartilhar" com ícone e palavra à direita.
7. **Classificados** como vitrine de dois anúncios com foto, tipo no canto, preço forte, título e "Bloco B · há 2 dias", o botão "Ver os 4 anúncios" e o aviso de que o condomínio não vende nem garante nada. Sem nome de morador.
8. **Manual do prédio**: as seções marcadas "no mural" em lista de linhas de 44 px com seta.
9. **Documentos do prédio**: os títulos em chips, a frase do link de 7 dias e "Pedir por e-mail" em contorno.
10. **Rodapé**: o cadeado com a frase obrigatória, o logo violeta com "CONDOMÍNIO" e, à direita, "Esta página não entra em buscadores. Os arquivos abrem por links que expiram".

### Computador (1280 px)

Miolo de 1180 px centrado. A faixa vira o formato largo (`faixa-predios.webp` à direita, violeta sólido à esquerda, como a faixa do Início), com o nome, a linha em Playfair, a linha de atualização e o botão claro do WhatsApp centrado na altura, entre o texto e os prédios. Abaixo, uma barra branca com as três abas (âncoras na mesma página) e, à direita, "Página pública do condomínio · sem nomes, telefones ou unidades". Depois, duas colunas: a principal (destaque, novos, Esta semana, Antes; o aviso com foto põe a foto à direita, 236 × 150) e a lateral de 360 px, grudada ao rolar, com Enquetes, Classificados em grade 2 × 2, Manual e Documentos. Rodapé igual ao do celular, em uma linha.

### Cores dos assuntos

Sempre ícone + palavra + faixa lateral, para não depender só da cor:

| Assunto | Ícone | Cor |
|---|---|---|
| Aviso geral | megafone | violeta (selo "andamento") |
| Obras e manutenção | ferramenta | âmbar |
| Segurança | escudo | petróleo |
| Assembleia e convocação | decisao | violeta escuro |
| Lembrete | relogio | jade |

## 5. Textos de interface

- Rótulo da faixa: "MURAL DO CONDOMÍNIO"; linha em Playfair: "o que o prédio precisa saber" (a Carolina pode trocar por outra frase curta; é a única palavra em Playfair da tela).
- "Atualizado hoje às 09:10 · 9 avisos, 2 enquetes".
- Botão: "Receber os avisos no WhatsApp".
- Abas: "Avisos", "Classificados", "Manual do prédio" ("Manual" no celular).
- Destaque: "O que importa agora" · "faltam 11 dias" · "publicado sex 24/10" · "19:00 primeira chamada · 19:30 segunda" · "Ler o edital (PDF)" · "Pôr na agenda".
- Enquetes: "Enquetes abertas" · "2 abertas" · "Aberta até qui 30/10 · uma por unidade" · "Responda pelo link pessoal que chegou pelo WhatsApp ou pelo e-mail. Não recebeu? Peça na portaria ou ao condomínio."
- Novos: "3 avisos novos desde a sua última visita, quinta 23/10." · "A marca fica só neste aparelho; ninguém sabe que você abriu."
- Seções: "Esta semana" · "Antes" · "5 avisos".
- Cartão: "Novo" · "hoje, 09:10" / "ontem, 18:40" / "sex 24/10, 16:20" · "Corrigido · versão 2: a data certa é 3/11, não 30/10" · "Ler o aviso" · "1 PDF" · "Compartilhar".
- Classificados: "Classificados entre moradores" · "4 anúncios" · "Ver os 4 anúncios" · "Anúncios de moradores, aprovados pelo condomínio. O condomínio não vende nem garante nada daqui."
- Documentos: "Documentos do prédio" · "Peça e receba no seu e-mail, por um link que vale 7 dias. Vai a versão em vigor." · "Pedir por e-mail".
- Rodapé: "Não precisa de conta nem senha. O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem." · "Esta página não entra em buscadores. Os arquivos abrem por links que expiram."

## 6. Estados

Todos usam a mesma faixa com a foto e o rodapé, para a página nunca parecer "quebrada":

- **Carregando**: a faixa com "Mural do condomínio" sem nome, e três cartões esqueleto no lugar do destaque e dos dois primeiros avisos. Texto: "Abrindo o mural…".
- **Sem avisos**: a faixa normal e um cartão com os anéis leves da marca: "Nenhum aviso agora. Quando o condomínio publicar um aviso para todos, ele aparece aqui." Enquetes, classificados e manual continuam, se existirem.
- **Sem destaque**: a camada "O que importa agora" some; o feed começa em "Esta semana".
- **Primeira visita ou nada novo**: a linha tracejada de novos some.
- **Erro ao carregar**: cartão de atenção "Não deu para abrir o mural agora. Tente de novo em instantes." com o botão "Tentar de novo".
- **Mural inexistente**: "Este mural não existe. Confira o endereço ou peça o link ao condomínio."
- **Link trocado**: "Este endereço mudou. Peça o link novo ao condomínio." (a faixa sem o nome do condomínio, para o link antigo não entregar nada).
- **Fora do ar**: "Este mural está fora do ar. Os avisos continuam chegando pelo condomínio."
- **WhatsApp do condomínio fora do ar**: a faixa âmbar de hoje ("O WhatsApp do condomínio está fora do ar. Enquanto isso: …") entra logo abaixo das abas, e o botão da faixa some.
- **Foto que não carregou**: o lugar da foto em degradê violeta com "Foto" e, ao tocar, "Não deu para abrir a foto agora."

Acessibilidade: contraste AA em todos os textos (o cinza mais claro é `#5e5475` sobre branco; o mono em `#5e5475`; os selos usam os pares aprovados da paleta); alvos de 44 px nos botões grandes, nas linhas do manual e no cartão inteiro; 36 px nos botões médios e 32 px nos links de rodapé do cartão, com área de toque do cartão em volta; ordem de leitura igual à visual; nada que dependa só de cor (assunto tem ícone e palavra; "Novo" tem palavra).

## 7. O que é ideia nova (precisa entrar no `IDEIAS.md` antes de virar código)

1. **Novo desde a última visita**: guardar no aparelho (sem conta) a data da última abertura e marcar os avisos publicados depois dela, com a contagem no alto. Nada sobe para o servidor.
2. **Dia, hora e local estruturados no aviso com evento**: hoje só existem no texto. Com os campos, o mural mostra o bloco de data ("28 OUT | ter · 8h às 14h"), escolhe o destaque "O que importa agora" (o próximo evento futuro, com a assembleia na frente) e gera "Pôr na agenda" (arquivo de calendário). A assembleia já tem data, chamadas e lugar na peça de assembleias; o aviso comum não.
3. **"Pôr na agenda"**: baixar o evento para o calendário do celular (depende da ideia 2).
4. **Foto do próprio prédio no topo**: o síndico sobe uma foto do condomínio nas Configurações › Comunicados e ela substitui a arte da marca na faixa (com o mesmo degradê). Sem foto, fica a arte da TRÍADE. Opcional; não aparece nas telas-modelo.
5. **Frase do mural**: o síndico pode trocar a linha em Playfair ("o que o prédio precisa saber") por outra curta. Opcional.

O resto é só apresentação de dados que já existem: assunto com cor e ícone, data humanizada com dia da semana, "Esta semana / Antes", a explicação da correção (já vem em `mudanca`), contagem por aba, enquetes em resumo, vitrine e manual.

## 8. O que ficou de fora, de propósito

- Curtidas, comentários, seguidores, nome de quem escreveu, foto de quem anunciou, telefone ou unidade de morador (CD-12, CD-15).
- Dois itens fixados ao mesmo tempo; enquetes como cartões grandes no alto.
- Busca e filtro por assunto: com dez avisos não compensa; se o mural crescer, as abas podem ganhar um filtro por assunto depois.
- Metáfora de cortiça, papel ou tachinha: briga com a identidade.
- Tema escuro (DC13: sempre claro).
- Modo "tela da portaria" (TV no hall, conceito C): fica como ideia para outra rodada.

## 9. Decisões para a Carolina

1. Aprovar o conceito "Janela acesa" (ou pedir o B ou o C).
2. A frase em Playfair da faixa: "o que o prédio precisa saber" ou outra.
3. As ideias novas 1 a 3 entram no `IDEIAS.md` agora (o desenho depende delas para o destaque e o bloco de data) ou o mural nasce sem elas, com o destaque sendo só a assembleia convocada (que já tem data e lugar)?
4. As ideias 4 e 5 (foto do prédio e frase, escolhidas pelo síndico) entram ou ficam para depois?
5. A cor de cada assunto, como na tabela acima.
