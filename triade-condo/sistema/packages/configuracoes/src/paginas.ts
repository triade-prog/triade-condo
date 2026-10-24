// Configurações por tarefa (decisão A.1 da análise de Configurações, 22/10/2026): no lugar das 11
// abas, uma entrada com 5 grupos e uma página por tarefa. Os endereços antigos (?aba=) continuam
// valendo e levam à página nova.

export const PAGINAS_CONFIGURACAO = {
  horarios: { nome: "Horários", grupo: "atendimento", apoio: "Quando o condomínio atende os moradores e quando o prédio funciona." },
  feriados: { nome: "Feriados", grupo: "atendimento", apoio: "No feriado não há atendimento e o prazo de retorno para." },
  prazos: { nome: "Prazos e avisos", grupo: "atendimento", apoio: "Em quanto tempo o condomínio responde e quem é avisado quando atrasa." },
  categorias: { nome: "Categorias e prioridades", grupo: "pedidos", apoio: "Como os pedidos se organizam. Renomear não quebra o histórico." },
  respostas: { nome: "Respostas prontas", grupo: "pedidos", apoio: "Textos prontos que aparecem na hora de dar retorno a um pedido." },
  etapas: { nome: "Etapas", grupo: "pedidos", apoio: "Onde o pedido está dentro de aberto, em andamento e encerrado." },
  areas: { nome: "Áreas comuns", grupo: "predio", apoio: "As áreas que os moradores reservam e as regras de cada uma." },
  manutencao: { nome: "Etapas da manutenção", grupo: "predio", apoio: "Onde a manutenção está dentro de cada situação." },
  portaria: { nome: "Portaria", grupo: "predio", apoio: "Quem recebe as encomendas no prédio, onde elas ficam e quando lembrar a unidade." },
  comunicados: { nome: "Comunicados", grupo: "comunicacao", apoio: "Os assuntos, o combinado com os moradores e quando nada é enviado." },
  mural: { nome: "Mural e e-mail", grupo: "comunicacao", apoio: "O mural aberto sem conta, o cartaz com QR e o e-mail dos comunicados." },
  whatsapp: { nome: "WhatsApp", grupo: "comunicacao", apoio: "O número do condomínio, as mensagens e quem cuida quando ele cai." },
  etiquetas: { nome: "Etiquetas por local", grupo: "links", apoio: "Etiquetas com QR que abrem o WhatsApp com o local já escrito." },
  abertos: { nome: "O que abre sem conta", grupo: "links", apoio: "Tudo o que abre sem conta neste condomínio, num lugar só." },
} as const;
export type IdPagina = keyof typeof PAGINAS_CONFIGURACAO;

export const GRUPOS_TAREFA = [
  { id: "atendimento", nome: "Atendimento", apoio: "Quando o condomínio atende e em quanto tempo responde.", paginas: ["horarios", "feriados", "prazos"] },
  { id: "pedidos", nome: "Pedidos", apoio: "Como os pedidos se organizam e o que se responde.", paginas: ["categorias", "respostas", "etapas"] },
  { id: "predio", nome: "Prédio", apoio: "As áreas que os moradores reservam, a manutenção e a portaria.", paginas: ["areas", "manutencao", "portaria"] },
  { id: "comunicacao", nome: "Comunicação", apoio: "O que o morador recebe, por onde e quando.", paginas: ["comunicados", "mural", "whatsapp"] },
  { id: "links", nome: "Links e QR", apoio: "O que abre sem conta, pelo celular de quem aponta a câmera.", paginas: ["etiquetas", "abertos"] },
] as const satisfies readonly { id: string; nome: string; apoio: string; paginas: readonly IdPagina[] }[];
export type IdGrupo = (typeof GRUPOS_TAREFA)[number]["id"];

/** As páginas que são inteiras da TRÍADE (CF-09): no app, só leitura. */
export const PAGINAS_DA_TRIADE: readonly IdPagina[] = ["etapas", "manutencao"];

/** As abas antigas: "regras" foi para Prazos e avisos; "links", para Etiquetas por local. */
const DAS_ABAS: Record<string, IdPagina> = {
  horarios: "horarios", feriados: "feriados", areas: "areas", categorias: "categorias", etapas: "etapas", prazos: "prazos", regras: "prazos",
  manutencao: "manutencao", comunicados: "comunicados", links: "etiquetas", whatsapp: "whatsapp",
};

/** A página de um endereço: o id da página, o de uma aba antiga ou nada (a entrada). */
export function paginaDe(id: string | null | undefined): IdPagina | null {
  if (!id) return null;
  if (id in PAGINAS_CONFIGURACAO) return id as IdPagina;
  return DAS_ABAS[id] ?? null;
}

export function grupoDaPagina(id: IdPagina) {
  return GRUPOS_TAREFA.find((g) => (g.paginas as readonly IdPagina[]).includes(id))!;
}
