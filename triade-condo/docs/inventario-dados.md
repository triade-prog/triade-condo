# Inventário de dados pessoais, retenção e exclusão

Entrega F0.11 do painel (ideias PT-11 e PT-03), aprovada pela Carolina em 24/10/2026 (decisões A.1 a E.1 e quadros 350 a 359 do canvas). Este documento é o inventário pedido no checklist de publicação (P7). A fonte é o catálogo `retencao_tipos` da migration `sistema/supabase/migrations/0301_retencao_dados.sql`, com os tipos 33 e 34 acrescentados pela `0303_decisoes_aprovacoes.sql`; as telas Configurações › Privacidade e dados (Plataforma) e Sistema › Retenção de dados (Console) mostram o mesmo catálogo. Se um prazo mudar, muda numa migration nova e neste documento no mesmo commit.

## Papéis

- O condomínio é o **controlador** dos dados dos moradores, da equipe e dos prestadores. A TRÍADE é a **operadora**: guarda e trata em nome do condomínio, só para as finalidades abaixo.
- Para os dados do Console (equipe TRÍADE, clientes, cobrança, comercial), a TRÍADE é a controladora.
- Operadores contratados pela TRÍADE: Supabase (banco e arquivos), Vercel (as telas), Resend (e-mail) e, no piloto, Wafly (WhatsApp). A base legal nunca é só o consentimento: é a execução do contrato do condomínio, o legítimo interesse ou a obrigação legal, conforme a linha.

## Como a retenção funciona

1. **Os prazos são da TRÍADE**, iguais para todos os condomínios (decisão B.1).
2. **Toda madrugada, às 03:10 de Brasília**, a rotina `aplicar_retencao()` passa por cada condomínio e acha o que passou do prazo. Ela **apaga o dado pessoal e mantém a linha**, com a data em que apagou, para que contas, protocolos e o histórico continuem certos.
3. **Nasce só contando.** Na primeira rodada nada é apagado: a rodada conta o que apagaria. A Administração da TRÍADE confere os totais no Console e só então liga a exclusão (Sistema › Retenção de dados › Ligar a exclusão).
4. **Nada some em silêncio (PT-03).** Cada rodada grava no histórico do condomínio quantos itens de cada tipo foram contados ou apagados, sem nenhum dado pessoal, e o Console guarda o resumo de cada rodada.
5. **Arquivos** (fotos, áudios, exportações, imagens de chamado) vão para uma fila; a api-plataforma apaga do armazenamento e marca o resultado. Os arquivos deixam de ser servidos no mesmo momento em que a rotina apaga.
6. **Guardar por obrigação legal.** O síndico pode guardar um pedido, uma manutenção, uma encomenda ou uma pessoa por processo, sinistro, pedido de autoridade ou outro motivo escrito. O que está guardado a rotina pula. Tirar a guarda pede motivo. Tudo vai para o histórico.
7. **Dados de uma pessoa (LGPD, art. 18).** O síndico busca pelo telefone (com ou sem o nono dígito) ou pelo e-mail, vê onde a pessoa aparece, baixa tudo numa planilha e remove os dados quando ela não mora mais em nenhuma unidade, não tem pedido aberto e não está guardada. A busca, a planilha e a remoção ficam no histórico, sem o telefone e sem o e-mail.
8. **Fim do contrato (decisões C.1 e E.1).** 90 dias depois de entregue a exportação, apagam-se todos os dados do condomínio, inclusive o histórico, por uma função só da TRÍADE que deixa registro no Console; o contrato e a cobrança ficam 5 anos. Ainda não há o estado de contrato encerrado no sistema: essa parte é a pendência F0.12 do painel.

## Os 34 tipos de dado


### Plataforma do síndico

| Nº | Dado | O que guarda | Para que | Base legal | Quem trata | Prazo | No fim do prazo | Situação |
|---|---|---|---|---|---|---|---|---|
| 1 | Equipe do condomínio | Nome e e-mail de entrada | Entrar e responder pelo que fez | Execução do contrato | Condomínio; TRÍADE opera | 90 dias depois de perder o acesso | A entrada é apagada; o nome fica no histórico | Prazo definido; rotina na F0.12 |
| 2 | Sessões de entrada | Em que condomínio a pessoa está | Manter a pessoa conectada | Execução do contrato | Condomínio; TRÍADE opera | 30 dias sem uso | Apagadas | Prazo definido; rotina na F0.12 |
| 3 | Contato de morador | Nome, telefone, e-mail, aniversário | Comunicar e atender | Execução do contrato; legítimo interesse | Condomínio; TRÍADE opera | 180 dias depois de sair da última unidade | Os dados são apagados; fica “contato removido” | Na rotina |
| 4 | Família | Nome, parentesco, aniversário | Saber quem mora | Legítimo interesse | Condomínio; TRÍADE opera | 90 dias depois de sair | Nome e aniversário apagados | Na rotina |
| 5 | Pets | Nome, espécie, raça | Saber quem mora | Legítimo interesse | Condomínio; TRÍADE opera | 90 dias depois de sair | Nome, raça e observação apagados | Na rotina |
| 6 | Veículos | Placa e modelo | Garagem e portaria | Legítimo interesse | Condomínio; TRÍADE opera | 90 dias depois de retirado | Placa e modelo apagados | Na rotina |
| 7 | Cadastro por link | O que o morador mandou | Receber o cadastro | Execução do contrato | Condomínio; TRÍADE opera | 30 dias depois de aprovado | A cópia é apagada; o cadastro fica na unidade | Na rotina |
| 8 | Pedidos | Relato, local, unidade, quem pediu | Atender e provar o que foi feito | Execução do contrato; legítimo interesse | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam; quem pediu some quando o contato é removido | Fica enquanto for cliente |
| 9 | Fotos e arquivos | De pedidos, manutenções e prestadores | Prova do serviço | Legítimo interesse | Condomínio; TRÍADE opera | 5 anos depois de encerrado | O arquivo é apagado; fica “apagado pelo prazo” | Prazo definido; rotina na F0.12 |
| 10 | Manutenções e preventivas | O que foi feito, por quem, quando | Memória do prédio | Legítimo interesse; obrigação legal | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam | Fica enquanto for cliente |
| 11 | Mensagens de WhatsApp | Texto, áudio, foto, número | Virar pedido | Execução do contrato | Condomínio; TRÍADE e Wafly operam | 90 dias se não virou pedido; se virou, segue o pedido | Texto, mídia e número apagados | Na rotina |
| 12 | Conversas em andamento | Em que passo a conversa está | Continuar a conversa | Execução do contrato | Condomínio; TRÍADE opera | 30 dias sem mensagem | Apagadas | Na rotina |
| 13 | Transcrição de áudio | O texto do áudio | Ler o áudio | Execução do contrato | Condomínio; TRÍADE opera | Segue a mensagem | Apagada junto | Na rotina |
| 14 | Envios de WhatsApp e e-mail | Número, endereço, texto | Enviar e provar que enviou | Execução do contrato | Condomínio; TRÍADE, Wafly e Resend operam | 12 meses | Ficam só a data e a situação | Na rotina |
| 15 | Avisos do app | Aviso para a equipe | Avisar | Execução do contrato | Condomínio; TRÍADE opera | 12 meses depois de visto | Apagados | Na rotina |
| 16 | Comunicados | Texto e para quem foi | Comunicar | Execução do contrato | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam | Fica enquanto for cliente |
| 17 | Documentos e atas | Arquivos e versões | Memória do prédio | Legítimo interesse; obrigação legal | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam | Fica enquanto for cliente |
| 18 | Pedidos de documento | E-mail de quem pediu | Enviar o documento | Execução do contrato | Condomínio; TRÍADE opera | 12 meses | E-mail apagado | Na rotina |
| 19 | Reservas | Unidade, quem reservou, observação | Usar a área comum | Execução do contrato | Condomínio; TRÍADE opera | 24 meses depois da data | Ficam só a unidade e a data | Na rotina |
| 20 | Enquetes e assembleias | Presença, procurador, votos | Provar a decisão | Obrigação legal | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam; o voto secreto não mostra quem votou | Fica enquanto for cliente |
| 21 | Classificados | Texto, foto, telefone | Anunciar no prédio | Legítimo interesse | Condomínio; TRÍADE opera | 90 dias depois de sair do mural | Texto e foto apagados | Na rotina |
| 22 | Encomendas | Remetente, quem retirou, foto da etiqueta | Provar a entrega | Legítimo interesse | Condomínio; TRÍADE opera | Foto: 90 dias depois de entregue; nomes: 12 meses | Apagados | Na rotina |
| 23 | Prestadores | Nome, telefone, e-mail, CPF ou CNPJ | Contratar e chamar | Execução do contrato | Condomínio; TRÍADE opera | 5 anos depois de arquivado | Contato e documento apagados; o nome fica | Prazo definido; rotina na F0.12 |
| 24 | Chamados de suporte | Mensagens, imagens, dados conferidos | Suporte da TRÍADE | Execução do contrato | Condomínio; TRÍADE opera | Imagens: 24 meses depois de resolvido | Imagens apagadas | Na rotina |
| 25 | Exportações | O arquivo com tudo | Entregar os dados ao condomínio | Execução do contrato | Condomínio; TRÍADE opera | 7 dias | O arquivo é apagado | Na rotina |
| 26 | Links e códigos sem conta | Só o resumo do código | Abrir sem conta | Execução do contrato | Condomínio; TRÍADE opera | 90 dias depois de vencer | Apagados | Na rotina |
| 27 | Histórico | Quem fez o quê e quando, sem dado pessoal | Nada some em silêncio | Legítimo interesse | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Fica | Fica enquanto for cliente |
| 28 | Relatórios do mês e dossiês | Resumo do que aconteceu | Prestar contas | Execução do contrato | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam | Fica enquanto for cliente |
| 33 | Conselho e subsíndico | Nome, papel, mandato, telefone ou e-mail | Decidir e votar pelo condomínio | Legítimo interesse | Condomínio; TRÍADE opera | 90 dias depois de sair do conselho | Contato apagado; nome e votos ficam | Prazo definido; rotina na F0.12 |
| 34 | Decisões e despesas para aprovar | Pergunta, valor, fornecedor, votos, fatura | Provar a decisão | Legítimo interesse; obrigação legal | Condomínio; TRÍADE opera | Enquanto o condomínio for cliente | Ficam | Fica enquanto for cliente |

### Console TRÍADE

| Nº | Dado | O que guarda | Para que | Base legal | Quem trata | Prazo | No fim do prazo | Situação |
|---|---|---|---|---|---|---|---|---|
| 29 | Equipe TRÍADE | Nome, entrada, funções | Trabalhar e responder pelo que fez | Execução do contrato | TRÍADE | 90 dias depois de sair | A entrada é apagada; o nome fica | Prazo definido; rotina na F0.12 |
| 30 | Clientes, contratos e cobrança | Plano, cobranças, recebimentos | Cobrar e cumprir o fisco | Obrigação legal | TRÍADE | 5 anos depois do fim do contrato | Apagados | Prazo definido; rotina na F0.12 |
| 31 | Notas internas e acessos excepcionais | O que a equipe anotou | Atender o cliente | Legítimo interesse | TRÍADE | Até o fim do contrato | Seguem o fim do contrato | Fica enquanto for cliente |
| 32 | Comercial | Interessados e propostas | Vender | Legítimo interesse | TRÍADE | 12 meses sem contato | Apagados | Prazo definido; rotina na F0.12 |

Resumo: 17 tipos com a rotina aplicando o prazo, 9 que ficam enquanto o condomínio for cliente e 8 com o prazo definido e a rotina ainda por fazer. Os tipos 33 e 34 entraram com a 0303 (Decisões e aprovações, R5), em 24/10/2026.

## O que fica para a F0.12

- Fotos e arquivos de pedidos, manutenções e prestadores com 5 anos (tipo 9) e prestadores arquivados com 5 anos (tipo 23).
- O contato de quem saiu do conselho, 90 dias depois (tipo 33, da 0303).
- A entrada da equipe do condomínio que perdeu o acesso (tipo 1), as sessões sem uso (tipo 2) e a equipe TRÍADE que saiu (tipo 29), que mexem na entrada e pedem cuidado com o login.
- Clientes, contratos e cobrança com 5 anos (tipo 30) e o comercial (tipo 32, que ainda não existe no sistema).
- A exclusão do condomínio no fim do contrato (decisões C.1 e E.1), que espera o estado de contrato encerrado.

## Onde está cada parte

| Parte | Onde |
|---|---|
| Catálogo, rotina, fila de arquivos, guardas, dados de uma pessoa e Console | `sistema/supabase/migrations/0301_retencao_dados.sql` |
| Testes do banco | `sistema/supabase/tests/pgtap/044_retencao_dados_test.sql` |
| Rotas | `sistema/supabase/functions/api-plataforma/privacidade.ts` e `sistema/supabase/functions/api-console/app.ts` |
| Nomes e validação | `sistema/packages/domain/src/privacidade.ts` |
| Telas | Configurações › Privacidade e dados e Dados de uma pessoa (Plataforma); Sistema › Retenção de dados (Console); desenho em `docs/design/telas-modelo/privacidade-*` |
