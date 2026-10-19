// Parte do WhatsApp do condomínio da API falsa da Plataforma (passo 5; W-05, W-10 a W-16). As
// regras de verdade estão testadas no banco (pgTAP 021) e na API (Deno); aqui só o bastante para
// a tela: a identificar, falhas de envio, a conversa no pedido e as configurações.
import type { Route } from "@playwright/test";

let n = 0;
const novoId = () => `5d6e7f80-9a1b-4c2d-8e3f-${String(++n).padStart(12, "0")}`;
const agora = () => new Date().toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export interface MensagemFalsa {
  id: string; lado: "MORADOR" | "CONDOMINIO"; tipo: string; texto?: string; em: string; autor?: string;
  finalidade?: "RESPOSTA" | "RETORNO"; estado?: string; motivo?: string;
  midia?: { tipo: string; situacao: string; arquivoId?: string };
}

export function criarWhatsapp(pedido: { id: string; protocolo: string }, categoriaId: string, prioridadeId: string) {
  return {
    numero: "+5561998124400",
    conexao: { situacao: "CONECTADO", oficial: false, conectadoEm: "2026-10-18T17:02:00Z", ultimaRecebida: "2026-10-18T18:47:00Z",
               termoAceitoEm: null as string | null, termoAceitoPor: null as string | null },
    aIdentificar: [
      { id: novoId(), telefone: "+5561988771234", tipo: "TEXTO", texto: "Oi, sou nova no 504, como faço para reservar o salão?", enviadaEm: "2026-10-18T14:20:00Z",
        triagem: "A_IDENTIFICAR", vinculoPendente: false },
      { id: novoId(), telefone: "+5561966665555", tipo: "TEXTO", texto: "O interfone do 203 não toca", enviadaEm: "2026-10-17T22:02:00Z",
        triagem: "A_IDENTIFICAR", vinculoPendente: true },
      { id: novoId(), telefone: "+5561955554444", tipo: "TEXTO", texto: "Mandei ontem: o portão travou", enviadaEm: "2026-10-16T09:00:00Z",
        triagem: "A_IDENTIFICAR", vinculoPendente: false, atrasada: true },
    ],
    falhas: [
      { id: novoId(), finalidade: "RETORNO", estado: "FALHOU", motivo: "Número sem WhatsApp", tentativas: 1, criadoEm: "2026-10-18T12:30:00Z",
        texto: "Carlos, o técnico vem amanhã de manhã.", responsavel: "Ana Souza", para: "Carlos Lima", unidades: "Torre A · 101",
        pedido: { id: pedido.id, protocolo: pedido.protocolo } },
    ],
    conversas: {
      [pedido.id]: [
        { id: novoId(), lado: "MORADOR", tipo: "TEXTO", texto: "A luz da garagem no subsolo 1 está piscando faz dois dias", em: "2026-10-18T18:41:00Z", autor: "Marta Souza" },
        { id: novoId(), lado: "MORADOR", tipo: "IMAGEM", em: "2026-10-18T18:43:00Z", autor: "Marta Souza", midia: { tipo: "image/jpeg", situacao: "RECUSADA" } },
        { id: novoId(), lado: "CONDOMINIO", tipo: "TEXTO", texto: "Pedido registrado. O condomínio dá notícia por aqui.", em: "2026-10-18T18:42:00Z",
          finalidade: "RESPOSTA", estado: "ENTREGUE" },
      ] as MensagemFalsa[],
    } as Record<string, MensagemFalsa[]>,
    revisoes: { [pedido.id]: [] as { id: string; texto: string; em: string; decisao?: string; resposta?: string }[] } as Record<string, { id: string; texto: string; em: string; decisao?: string; resposta?: string }[]>,
    config: { foraHorario: "Recebemos sua mensagem fora do horário de atendimento. Ela fica registrada e o condomínio confere no próximo horário. Em emergência, ligue 193.",
              categoriaId, prioridadeId, anexarMinutos: 30, versao: 1 },
    meusAvisos: undefined as { telefone: string; tipos: string[]; ligado: boolean; versao: number } | undefined,
    janela: { aberta: true, ate: "2026-10-19T18:41:00Z", limite: 2000, parou: false } as
      { aberta: boolean; ate?: string; limite: number; parou: boolean; modelo?: { titulo: string; previa: string } },
    enviados: [] as string[],
  };
}
export type EstadoWhatsapp = ReturnType<typeof criarWhatsapp>;

export function resumoWhatsapp(w: EstadoWhatsapp) {
  return { situacao: w.conexao.situacao, aIdentificar: new Set(w.aIdentificar.map((m) => m.telefone)).size, falhas: w.falhas.length };
}

const PROMESSA = /(imediat|em at[ée] [0-9]|garant|agora mesmo|j[áa] estamos)/i;

export async function rotasWhatsapp(route: Route, w: EstadoWhatsapp, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean, eu: { nome: string }, opcoes: { categorias: { id: string; nome: string }[]; prioridades: { id: string; nome: string }[]; sindica: boolean },
  pedidoVersao: (id: string) => number | null): Promise<unknown> {
  const pc = /^\/v1\/condominio\/pedidos\/([^/]+)\/whatsapp$/.exec(caminho);
  if (pc) {
    const id = pc[1]!;
    if (metodo === "GET") {
      return route.fulfill({ json: { mensagens: w.conversas[id] ?? [], revisoes: w.revisoes[id] ?? [], janela: w.janela,
        pode: { responder: pode("pedidos.responder") && !!w.conversas[id], decidirRevisao: pode("pedidos.responder") } } });
    }
    if (String(corpo.texto ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
    if (corpo.versao !== pedidoVersao(id)) return erro(route, 409, "VERSION_CONFLICT", {});
    if (!w.janela.aberta && String(corpo.texto).trim().length > 800) return erro(route, 400, "VALIDATION_ERROR", { motivo: "LONGO_FORA_DA_JANELA" });
    const aviso = !w.janela.aberta ? (w.janela.parou ? "PAROU" : w.janela.modelo ? undefined : "SEM_MODELO") : undefined;
    (w.conversas[id] ??= []).push({ id: novoId(), lado: "CONDOMINIO", tipo: "TEXTO", texto: String(corpo.texto).trim(), em: agora(),
      finalidade: "RETORNO", autor: eu.nome, estado: "NA_FILA" });
    w.enviados.push(String(corpo.texto).trim());
    return route.fulfill({ status: 201, json: { versao: (pedidoVersao(id) ?? 1) + 1, envio: novoId(), ...(aviso ? { aviso } : {}) } });
  }
  if (!caminho.startsWith("/v1/condominio/whatsapp")) return null;

  if (caminho === "/v1/condominio/whatsapp/config" && metodo === "GET") {
    return route.fulfill({ json: { numero: w.numero, conexao: w.conexao, config: w.config,
      avisoGolpe: "O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem.",
      categorias: opcoes.categorias, prioridades: opcoes.prioridades, ...(w.meusAvisos ? { meusAvisos: w.meusAvisos } : {}),
      pode: { editar: pode("config.editar"), aceitarTermo: opcoes.sindica && !w.conexao.termoAceitoEm } } });
  }
  if (caminho === "/v1/condominio/whatsapp/config") {
    if (!pode("config.editar")) return erro(route, 403, "FORBIDDEN");
    if (corpo.versao !== w.config.versao) return erro(route, 409, "VERSION_CONFLICT", {});
    if (PROMESSA.test(String(corpo.foraHorario))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PROMESSA_DE_PRAZO" });
    Object.assign(w.config, { foraHorario: corpo.foraHorario, categoriaId: corpo.categoriaId, prioridadeId: corpo.prioridadeId,
      anexarMinutos: corpo.anexarMinutos, versao: w.config.versao + 1 });
    return route.fulfill({ json: { versao: w.config.versao } });
  }
  if (caminho === "/v1/condominio/whatsapp/termo") {
    if (!opcoes.sindica) return erro(route, 403, "FORBIDDEN");
    w.conexao.termoAceitoEm = agora();
    w.conexao.termoAceitoPor = eu.nome;
    return route.fulfill({ json: w.conexao });
  }
  if (caminho === "/v1/condominio/whatsapp/meus-avisos") {
    if (!/^\+[1-9][0-9]{9,14}$/.test(String(corpo.telefone))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["telefone"] });
    w.meusAvisos = { telefone: String(corpo.telefone), tipos: corpo.tipos as string[], ligado: !!corpo.ligado, versao: (w.meusAvisos?.versao ?? 0) + 1 };
    return route.fulfill({ json: { versao: w.meusAvisos.versao } });
  }

  if (!(pode("pedidos.responder") || pode("pedidos.atualizar"))) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/whatsapp") {
    return route.fulfill({ json: { numero: w.numero, conexao: w.conexao, resumo: resumoWhatsapp(w), aIdentificar: w.aIdentificar, falhas: w.falhas,
      pode: { triar: pode("pedidos.atualizar"), ligar: pode("moradores.editar"), reenviar: pode("pedidos.responder") } } });
  }
  const tm = /^\/v1\/condominio\/whatsapp\/mensagens\/([^/]+)\/triar$/.exec(caminho);
  if (tm) {
    const m = w.aIdentificar.find((x) => x.id === tm[1]);
    if (!m) return erro(route, 404, "NOT_FOUND");
    if (corpo.acao === "ARQUIVAR" && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    const antes = w.aIdentificar.length;
    w.aIdentificar = w.aIdentificar.filter((x) => x.telefone !== m.telefone);
    return route.fulfill({ json: { tratadas: antes - w.aIdentificar.length, ...(corpo.acao === "CONTATO" ? { contatoAtivo: true } : {}) } });
  }
  const fe = /^\/v1\/condominio\/whatsapp\/envios\/([^/]+)\/(reenviar|resolver)$/.exec(caminho);
  if (fe) {
    if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    w.falhas = w.falhas.filter((x) => x.id !== fe[1]);
    return route.fulfill({ status: fe[2] === "reenviar" ? 201 : 200, json: { id: novoId() } });
  }
  const mr = /^\/v1\/condominio\/whatsapp\/revisoes\/([^/]+)\/manter$/.exec(caminho);
  if (mr) {
    if (String(corpo.resposta ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["resposta"] });
    for (const lista of Object.values(w.revisoes)) {
      const r = lista.find((x) => x.id === mr[1]);
      if (r) Object.assign(r, { decisao: "MANTIDO", resposta: corpo.resposta });
    }
    return route.fulfill({ json: { decisao: "MANTIDO" } });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** Pedido de revisão do morador esperando quem cuida (W-10). */
export function pedirRevisao(w: EstadoWhatsapp, pedidoId: string, texto: string) {
  (w.revisoes[pedidoId] ??= []).push({ id: novoId(), texto, em: agora() });
}
