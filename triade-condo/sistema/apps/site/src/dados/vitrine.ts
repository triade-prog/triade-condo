// Conteúdo das telas de exemplo e das páginas Plataforma e Soluções (telas aprovadas em 23/10/2026).
// EM-07: só entra como pronto o que o sistema já faz. Financeiro, portaria, orçamentos, IA,
// relatório do mês e dossiê ficam de fora até ficarem prontos.

/** Protocolo do pedido de exemplo, no formato do sistema. */
export const protocolo = "2026-0412";

export type Etapa = 1 | 2 | 3 | 4;

export const passos: { num: string; titulo: string; texto: string }[] = [
  { num: "01", titulo: "O morador escreve. O pedido ganha número.", texto: "Pelo WhatsApp do condomínio, sem app e sem senha. O sistema reconhece a unidade e responde com o protocolo e a data da próxima notícia." },
  { num: "02", titulo: "Alguém fica responsável. O morador sabe quem.", texto: "O síndico define quem resolve e quando dá notícia. Dar notícia é um compromisso separado de resolver." },
  { num: "03", titulo: "O prestador conta o que fez, por um link.", texto: "Sem cadastro. A pendência real fica à vista: a peça, a visita, a decisão. O morador recebe a atualização." },
  { num: "04", titulo: "Concluído com explicação. O morador avalia.", texto: "O caso fica no histórico do prédio, com autor e data." },
];

type Tom = "cinza" | "violeta" | "verde" | "ambar" | "vermelho";

/** Ficha do pedido no painel, em cada etapa. `mudou` marca com o contorno laranja o que acabou de mudar. */
export const ficha: Record<Etapa, { selo: [Tom, string]; botoes: [string, string]; andamento: { rotulo: string; valor: string; cor?: string; mudou?: boolean }[] }> = {
  1: { selo: ["violeta", "Novo"], botoes: ["Atribuir responsável", "Mudar etapa"], andamento: [{ rotulo: "Responsável", valor: "ninguém ainda", cor: "var(--atencao)", mudou: true }, { rotulo: "Retorno", valor: "sex 23/10, 12:00" }] },
  2: { selo: ["violeta", "Em andamento"], botoes: ["Dar retorno ao morador", "Mudar etapa"], andamento: [{ rotulo: "Responsável", valor: "Carlos, síndico", mudou: true }, { rotulo: "Retorno", valor: "sex 23/10, 12:00", cor: "var(--ok)" }] },
  3: { selo: ["ambar", "Aguardando prestador"], botoes: ["Dar retorno ao morador", "Concluir"], andamento: [{ rotulo: "Prestador", valor: "Hidráulica Souza", mudou: true }, { rotulo: "Pendência", valor: "visita seg", cor: "var(--atencao)", mudou: true }] },
  4: { selo: ["verde", "Concluído"], botoes: ["Ver histórico", "Reabrir"], andamento: [{ rotulo: "Concluído", valor: "seg 26/10", mudou: true }, { rotulo: "Avaliação", valor: "5 de 5", cor: "var(--ok)", mudou: true }] },
};

export const historico = [
  { quando: "22/10 22:41", texto: "Pedido aberto pelo WhatsApp", detalhe: "Ana, apto 302" },
  { quando: "23/10 08:10", texto: "Carlos assumiu o pedido", detalhe: "retorno até sex, 12h" },
  { quando: "23/10 11:40", texto: "Prestador registrou a visita pelo link", detalhe: "Hidráulica Souza" },
  { quando: "26/10 10:05", texto: "Pedido concluído", detalhe: "Ana avaliou com 5" },
];

export const pedidosDoMes: { protocolo: string; titulo: string; selo: [Tom, string] }[] = [
  { protocolo: "2026-0405", titulo: "Portão da garagem", selo: ["vermelho", "Vencido"] },
  { protocolo: "2026-0409", titulo: "Lâmpada do hall, bloco B", selo: ["violeta", "Em andamento"] },
  { protocolo: "2026-0398", titulo: "Barulho no 504", selo: ["cinza", "Aguardando"] },
  { protocolo: "2026-0391", titulo: "Infiltração no 101", selo: ["verde", "Concluído"] },
];

/** WhatsApp da moradora em cada etapa: "eu" é a Ana, "cond" é o WhatsApp do condomínio, "dia" separa os dias. */
export type Mensagem = { lado: "eu" | "cond" | "dia"; texto: string; hora?: string; nova?: boolean };
const registrada = `Pedido ${protocolo} registrado. Você terá notícia até sexta, 12h.`;
const atualizacao = "Atualização: o prestador visitou hoje. Falta trocar o registro da coluna 3; ele volta segunda de manhã.";
export const conversa: Record<Etapa, Mensagem[]> = {
  1: [{ lado: "eu", texto: "O vazamento da garagem voltou, perto da vaga 12.", hora: "22:41" }, { lado: "cond", texto: registrada, hora: "22:41", nova: true }],
  2: [{ lado: "eu", texto: "O vazamento da garagem voltou, perto da vaga 12.", hora: "22:41" }, { lado: "cond", texto: registrada, hora: "22:41" }, { lado: "dia", texto: "Hoje" }, { lado: "cond", texto: "O Carlos, síndico, está cuidando do seu pedido.", hora: "08:10", nova: true }],
  3: [{ lado: "cond", texto: registrada, hora: "22:41" }, { lado: "cond", texto: "O Carlos, síndico, está cuidando do seu pedido.", hora: "08:10" }, { lado: "cond", texto: atualizacao, hora: "11:52", nova: true }],
  4: [{ lado: "cond", texto: atualizacao, hora: "sex 11:52" }, { lado: "dia", texto: "Segunda-feira" }, { lado: "cond", texto: "Concluído: trocado o registro da coluna 3. Como foi o atendimento, de 1 a 5?", hora: "10:05" }, { lado: "eu", texto: "5. Obrigada!", hora: "10:20", nova: true }],
};

/** Página Plataforma: os quatro blocos com o que já está pronto. */
export const plataforma: { id: string; titulo: string; itens: { titulo: string; texto: string }[] }[] = [
  { id: "atendimento", titulo: "Atendimento", itens: [
    { titulo: "Pedidos com protocolo", texto: "Do WhatsApp ao painel, com número e prazo" },
    { titulo: "Responsável e próximo retorno", texto: "O morador sabe quem cuida e quando terá notícia" },
    { titulo: "Escalonamento e reabertura", texto: "Prazo vencido sobe; pedido mal resolvido volta" },
    { titulo: "QR Code por local", texto: "Elevador, garagem e piscina abrem pedido no lugar certo" },
  ] },
  { id: "comunicacao", titulo: "Comunicação", itens: [
    { titulo: "Comunicados com leitura", texto: "Para quem precisa ler, com confirmação" },
    { titulo: "Mural online", texto: "Link e QR Code, sem conta e sem dados pessoais" },
    { titulo: "Documentos com versões", texto: "Regimento, atas e contratos sempre na versão certa" },
    { titulo: "Assembleia e votação", texto: "Pauta, convite e resultado registrados" },
  ] },
  { id: "operacoes", titulo: "Operações", itens: [
    { titulo: "Manutenção preventiva", texto: "Plano e calendário pela NBR 5674" },
    { titulo: "Prontuário do prédio", texto: "Equipamentos, laudos e histórico" },
    { titulo: "Prestadores", texto: "Check-in por QR e relato da visita por link" },
    { titulo: "Reservas e agenda", texto: "Áreas comuns com limite e regras" },
  ] },
  { id: "indicadores", titulo: "Indicadores", itens: [
    { titulo: "Agora", texto: "O que vence hoje e o que está parado" },
    { titulo: "Por período", texto: "Pedidos, prazos e avaliações para a assembleia" },
    { titulo: "Moradores e unidades", texto: "Vínculo verificado com cada unidade" },
  ] },
];

/** Para quem é: cada perfil com a frase, os pontos e quem aparece no Início do painel. */
export const perfis: { id: "morador" | "profissional" | "conselho" | "portaria"; nome: string; frase: string; itens: string[] }[] = [
  { id: "morador", nome: "Síndico morador", frase: "Para de responder o grupo à meia-noite.", itens: ["O pedido chega com protocolo e você responde quando der, com prazo combinado.", "A secretária ou o subsíndico podem atender por você.", "Na troca de mandato, os pedidos e documentos continuam no prédio."] },
  { id: "profissional", nome: "Síndico profissional", frase: "Vários prédios, cada um com a sua história.", itens: ["Um painel por condomínio, com o WhatsApp de cada prédio.", "Prazos vencidos de todos os prédios aparecem primeiro.", "Desconto a partir do segundo condomínio."] },
  { id: "conselho", nome: "Conselho", frase: "Acompanha sem precisar cobrar no grupo.", itens: ["Vê pedidos, prazos e indicadores com o acesso que o síndico liberar.", "Decisões pedidas pelo síndico chegam com o contexto do caso.", "Na assembleia, os números saem do painel, não da memória."] },
  { id: "portaria", nome: "Portaria e zeladoria", frase: "Registra na hora o que vê no prédio.", itens: ["Abre o pedido pelo painel, com foto.", "Entra na mesma fila do síndico, com responsável e prazo.", "Ninguém precisa repassar recado."] },
];

/** Soluções por tamanho de condomínio. O destaque do título é a parte em `destaque`. */
export const tamanhos = [
  { id: "ate-40", nome: "Até 40 unidades", titulo: "Prédio pequeno, síndico", destaque: "sem tempo a perder", itens: ["Pedidos pelo WhatsApp com protocolo e prazo", "Mural online por link e QR Code", "Comunicados com confirmação de leitura", "Manutenção preventiva com lembretes"] },
  { id: "41-100", nome: "41 a 100 unidades", titulo: "Mais moradores,", destaque: "o mesmo síndico", itens: ["Responsável e próximo retorno em cada pedido", "Escalonamento quando o prazo vence", "Reservas de áreas comuns com limite", "Prestadores com check-in por QR Code"] },
  { id: "101-200", nome: "101 a 200 unidades", titulo: "Uma equipe", destaque: "na mesma fila", itens: ["Acesso por papel para subsíndico, conselho e zeladoria", "QR Code por local para abrir pedidos", "Prontuário do prédio com laudos e equipamentos", "Indicadores por período para a assembleia"] },
  { id: "mais-200", nome: "Mais de 200 unidades", titulo: "Muitos blocos,", destaque: "uma história só", itens: ["Assembleia e votação registradas", "Documentos com versões", "Vários responsáveis por tipo de pedido", "Acima de 400 unidades, valor sob consulta"] },
];
