// Parte de Ajuda e suporte da API falsa da Plataforma (peça R4; PI-11, PI-17, PI-20). As regras de
// verdade estão testadas no banco (pgTAP 020) e na API (Deno); aqui só o bastante para a tela:
// chamados com imagem colada e o pedido de acesso excepcional da TRÍADE.
import type { Route } from "@playwright/test";
import { conferir, conteudoEnviado } from "./api-falsa-arquivos";

interface ChamadoFalso {
  id: string; numero: number; tipo: string; area: string; titulo: string; situacao: string; abertoPor: string; criadoEm: string; resolvidoEm?: string;
  mensagens: { id: string; lado: "CLIENTE" | "TRIADE"; autor: string; texto: string; criadoEm: string }[];
  arquivos: { id: string; nome: string; tipo: string; situacao: string; motivoRecusa?: string }[];
}
interface AcessoFalso {
  id: string; pedidoPor: string; funcoes: string[]; motivo: string; areas: string[]; horas: number; situacao: string; validoAte?: string;
  leituras: number; criadoEm: string; motivoRecusa?: string; decididoEm?: string; decididoPor?: string; encerradoEm?: string; encerradoPor?: string;
}
export interface EstadoSuporte {
  chamados: ChamadoFalso[];
  acessos: AcessoFalso[];
}

let n = 0;
const novoId = () => `8c9d0e1f-2a3b-4c4d-9e5f-${String(++n).padStart(12, "0")}`;
const agora = () => new Date().toISOString();

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarSuporte(): EstadoSuporte {
  return {
    chamados: [{
      id: novoId(), numero: 1, tipo: "DUVIDA", area: "COMUNICADOS", titulo: "Como mudar o horário sem envio?", situacao: "RESOLVIDO",
      abertoPor: "Ana Souza", criadoEm: "2026-10-14T13:00:00Z", resolvidoEm: "2026-10-16T13:00:00Z",
      mensagens: [
        { id: novoId(), lado: "CLIENTE", autor: "Ana Souza", texto: "Quero mudar o horário do comunicado sem mandar de novo.", criadoEm: "2026-10-14T13:00:00Z" },
        { id: novoId(), lado: "TRIADE", autor: "Diego", texto: "Em Configurações, Comunicados, escolha o horário.", criadoEm: "2026-10-14T15:00:00Z" },
      ],
      arquivos: [],
    }],
    acessos: [{
      id: novoId(), pedidoPor: "Diego", funcoes: ["SUPORTE"], motivo: "A síndica relatou que a fila de pedidos some depois de filtrar por categoria.",
      areas: ["PEDIDOS"], horas: 24, situacao: "PEDIDO", leituras: 0, criadoEm: agora(),
    }, {
      id: novoId(), pedidoPor: "Diego", funcoes: ["SUPORTE"], motivo: "Conferir a importação da planilha.", areas: ["MORADORES"], horas: 4, situacao: "ENCERRADO",
      leituras: 2, criadoEm: "2026-10-14T13:00:00Z", decididoEm: "2026-10-14T13:20:00Z", decididoPor: "Ana Souza", encerradoEm: "2026-10-14T14:20:00Z", encerradoPor: "Ana Souza",
    }, {
      id: novoId(), pedidoPor: "Paula", funcoes: ["IMPLANTACAO"], motivo: "Revisar o modelo do mural.", areas: ["COMUNICADOS"], horas: 24, situacao: "RECUSADO",
      leituras: 0, criadoEm: "2026-10-09T13:00:00Z", decididoEm: "2026-10-09T15:00:00Z", decididoPor: "Ana Souza", motivoRecusa: "Pode ver comigo em reunião.",
    }],
  };
}

export function resumoAcessos(est: EstadoSuporte) {
  return {
    pedidos: est.acessos.filter((a) => a.situacao === "PEDIDO"),
    valendo: est.acessos.filter((a) => a.situacao === "APROVADO").length,
  };
}

const resumo = (c: ChamadoFalso) => ({
  id: c.id, numero: c.numero, tipo: c.tipo, area: c.area, titulo: c.titulo, situacao: c.situacao, abertoPor: c.abertoPor, criadoEm: c.criadoEm,
  imagens: c.arquivos.filter((a) => a.situacao === "LIBERADO").length, resolvidoEm: c.resolvidoEm,
  ultima: c.mensagens.length ? { lado: c.mensagens.at(-1)!.lado, autor: c.mensagens.at(-1)!.autor, em: c.mensagens.at(-1)!.criadoEm } : undefined,
});

export async function rotasSuporte(route: Route, est: EstadoSuporte, caminho: string, metodo: string, corpo: Record<string, unknown>,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (caminho === "/v1/condominio/acessos-excepcionais") {
    if (!pode("acesso_excepcional.aprovar")) return erro(route, 403, "FORBIDDEN");
    return route.fulfill({ json: { acessos: est.acessos } });
  }
  const ae = /^\/v1\/condominio\/acessos-excepcionais\/([^/]+)\/(decidir|encerrar)$/.exec(caminho);
  if (ae) {
    const a = est.acessos.find((x) => x.id === ae[1]);
    if (!a) return erro(route, 404, "NOT_FOUND");
    if (ae[2] === "decidir") {
      if (!corpo.aprovar && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      a.situacao = corpo.aprovar ? "APROVADO" : "RECUSADO";
      a.decididoEm = agora(); a.decididoPor = eu.nome;
      if (corpo.aprovar) a.validoAte = new Date(Date.now() + a.horas * 3600_000).toISOString();
      else a.motivoRecusa = String(corpo.motivo);
    } else { a.situacao = "ENCERRADO"; a.encerradoEm = agora(); a.encerradoPor = eu.nome; }
    return route.fulfill({ json: a });
  }

  if (!caminho.startsWith("/v1/condominio/chamados")) return null;
  if (!pode("suporte.chamados")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/chamados" && metodo === "GET") {
    return route.fulfill({ json: { itens: est.chamados.map(resumo).sort((a, b) => Number(a.situacao === "RESOLVIDO") - Number(b.situacao === "RESOLVIDO")), todos: true } });
  }
  if (caminho === "/v1/condominio/chamados" && metodo === "POST") {
    if (String(corpo.titulo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
    if (String(corpo.texto ?? "").trim().length < 2) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
    const c: ChamadoFalso = {
      id: novoId(), numero: est.chamados.length + 1, tipo: String(corpo.tipo), area: String(corpo.area), titulo: String(corpo.titulo).trim(),
      situacao: "NOVO", abertoPor: eu.nome, criadoEm: agora(), arquivos: [],
      mensagens: [{ id: novoId(), lado: "CLIENTE", autor: eu.nome, texto: String(corpo.texto).trim(), criadoEm: agora() }],
    };
    est.chamados.unshift(c);
    return route.fulfill({ status: 201, json: { id: c.id, numero: c.numero } });
  }
  const m = /^\/v1\/condominio\/chamados\/([^/]+)(\/.*)?$/.exec(caminho);
  const c = m ? est.chamados.find((x) => x.id === m[1]) : undefined;
  if (!c) return erro(route, 404, "NOT_FOUND");
  const resto = m![2] ?? "";
  if (resto === "") {
    const fechado = c.situacao === "RESOLVIDO" && Date.now() - Date.parse(c.resolvidoEm!) > 7 * 86400_000;
    return route.fulfill({ json: { ...resumo(c), mensagens: c.mensagens, arquivos: c.arquivos.filter((a) => a.situacao !== "ENVIANDO"),
      pode: { responder: !fechado, resolver: c.situacao !== "RESOLVIDO", enviarImagem: c.situacao !== "RESOLVIDO" && c.abertoPor === eu.nome } } });
  }
  if (resto === "/responder") {
    const reaberto = c.situacao === "RESOLVIDO";
    c.mensagens.push({ id: novoId(), lado: "CLIENTE", autor: eu.nome, texto: String(corpo.texto), criadoEm: agora() });
    if (reaberto || c.situacao === "ESPERANDO_CLIENTE") { c.situacao = "ANDAMENTO"; c.resolvidoEm = undefined; }
    return route.fulfill({ status: 201, json: { reaberto } });
  }
  if (resto === "/resolver") {
    c.situacao = "RESOLVIDO";
    c.resolvidoEm = agora();
    return route.fulfill({ json: { situacao: "RESOLVIDO" } });
  }
  if (resto === "/imagens" && metodo === "POST") {
    if (c.arquivos.filter((a) => a.situacao !== "NAO_LIBERADO").length >= 3) return erro(route, 422, "VALIDATION_ERROR", { motivo: "LIMITE_IMAGENS" });
    const id = novoId();
    c.arquivos.push({ id, nome: String(corpo.nome), tipo: String(corpo.tipo), situacao: "ENVIANDO" });
    return route.fulfill({ status: 201, json: { arquivoId: id, envio: { url: `/api/v1/armazenamento/${id}`, metodo: "PUT", tipo: corpo.tipo } } });
  }
  const im = /^\/imagens\/([^/]+)\/(verificar|link)$/.exec(resto);
  if (im) {
    const a = c.arquivos.find((x) => x.id === im[1]);
    if (!a) return erro(route, 404, "NOT_FOUND");
    if (im[2] === "link") return route.fulfill({ json: { url: `/api/v1/armazenamento/${a.id}`, tipo: a.tipo } });
    const motivo = conferir(conteudoEnviado(a.id), a.tipo);
    a.situacao = motivo ? "NAO_LIBERADO" : "LIBERADO";
    if (motivo) a.motivoRecusa = motivo;
    return route.fulfill({ json: motivo ? { situacao: a.situacao, motivo } : { situacao: a.situacao } });
  }
  return erro(route, 404, "NOT_FOUND");
}
