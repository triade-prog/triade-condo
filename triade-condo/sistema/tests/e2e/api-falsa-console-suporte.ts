// Parte da peça R4 na API falsa do Console (PI-04, PI-05, CT-01, PI-09, PI-11, PI-20). As regras
// de verdade estão testadas no banco (pgTAP 020) e na API (Deno); aqui só o bastante para a tela.
import type { Route } from "@playwright/test";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const DIEGO = "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b";
const BRUNA = "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d";
export const CHAMADO = "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a";
export const PEDIDO_ACESSO = "6e7f8a9b-0c1d-4e2f-9a3b-4c5d6e7f8a9b";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";

const ETAPAS: [string, string, string][] = [
  ["FICHA", "Ficha do condomínio", "Nome, endereço, contatos, cenário e contrato."],
  ["ORGANIZACAO", "Como o condomínio já se organiza", "Atas, regras, contratos e quem responde hoje. A configuração parte disso."],
  ["DOCUMENTOS", "Documentos", "Convenção, regimento, atas, laudos e contratos guardados em Documentos."],
  ["CONFIGURACAO", "Configuração", "Horários, categorias, prazos, quem atende e o número do condomínio."],
  ["APRESENTACAO", "Apresentação ao síndico e ao conselho", "Presencial em Brasília ou por vídeo."],
  ["MORADORES", "Moradores", "Unidades e contatos importados e conferidos."],
  ["PEDIDO_TESTE", "Pedido de teste com o síndico", "O síndico registra, responde e conclui um pedido sozinho."],
  ["ENTREGA", "Entrega", "Ato explícito: o cliente passa a ativo."],
];

interface Etapa { numero: number; chave: string; titulo: string; descricao: string; situacao: string; responsavelId?: string; responsavel?: string; feito?: string; motivo?: string; modalidade?: string; versao: number }
interface Pendencia { id: string; etapa?: number; texto: string; comQuem: string; responsavelId: string; responsavel: string; proximoRetorno: string; vencida: boolean; resolvidaEm?: string; versao: number }

const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
let n = 0;
const novoId = () => `9a0b1c2d-3e4f-4a5b-8c6d-${String(++n).padStart(12, "0")}`;

export function criarSuporteConsole() {
  return {
    entregue: false,
    etapas: ETAPAS.map(([chave, titulo, descricao], i): Etapa => ({
      numero: i + 1, chave, titulo, descricao, versao: 1,
      situacao: i < 3 ? "REALIZADA" : "PREPARADA", ...(i < 3 ? { responsavelId: CAROLINA, responsavel: "Carolina", feito: "Feito com a síndica." } : {}),
    })),
    pendencias: [
      { id: novoId(), etapa: 6, texto: "Síndica enviar a planilha de moradores", comQuem: "CLIENTE", responsavelId: CAROLINA, responsavel: "Carolina",
        proximoRetorno: dia(-1), vencida: true, versao: 1 },
    ] as Pendencia[],
    pedidoTeste: false,
    trocas: [] as { id: string; feitaEm: string; feitaPor: string; anterior: string; novo: string; pedidoPor: string; canal: string; conferido: string[] }[],
    suporte: {
      id: PEDIDO_ACESSO, condominioId: IPE, condominio: "Residencial Ipê", pessoaId: BRUNA, pessoa: "Bruna Alves", tipo: "SENHA", canal: "WHATSAPP",
      descricao: "Esqueceu a senha e não acha o e-mail.", vinculo: { funcoes: ["AUTORIZADO"], desde: "2026-10-16T13:00:00Z" },
      dadosConferidos: false, canalConhecido: false, situacao: "ABERTO", atendidoPor: "Diego", criadoEm: agora(), versao: 1,
      linksEnviados: 0,
    },
    chamado: {
      id: CHAMADO, condominioId: IPE, condominio: "Residencial Ipê", numero: 1, tipo: "PROBLEMA", area: "PEDIDOS", titulo: "Fila some depois de filtrar por categoria",
      situacao: "NOVO", abertoPor: "Bruna Alves", imagens: 0, atualizadoEm: agora(), versao: 1, responsavelId: undefined as string | undefined,
      responsavel: undefined as string | undefined,
      mensagens: [{ id: novoId(), lado: "CLIENTE", interna: false, autor: "Bruna Alves", texto: "Escolho Limpeza e a lista fica vazia.", criadoEm: agora() }],
    },
    acessos: [] as { id: string; pedidoPor: string; motivo: string; areas: string[]; horas: number; situacao: string; validoAte?: string; leituras: number; criadoEm: string; meu: boolean }[],
  };
}
export type EstadoSuporteConsole = ReturnType<typeof criarSuporteConsole>;

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

const equipe = [{ pessoaId: CAROLINA, nome: "Carolina" }, { pessoaId: DIEGO, nome: "Diego" }];
const nomeDe = (id?: string | null) => equipe.find((p) => p.pessoaId === id)?.nome;

export async function rotasSuporteConsole(route: Route, est: EstadoSuporteConsole, caminho: string, metodo: string, corpo: Record<string, unknown>,
  cliente: { id: string; nome: string; sindicos: { vinculoId: string; nome: string; desde: string; versao?: number; pessoaId: string }[]; estagio: () => string; ativar: () => void } | undefined,
  url: URL): Promise<unknown> {
  const faltando = () => [
    ...(est.etapas.some((e) => e.chave !== "ENTREGA" && e.situacao !== "REALIZADA" && e.situacao !== "NAO_SE_APLICA") ? ["ETAPAS_ABERTAS"] : []),
    ...(cliente && cliente.sindicos.length ? [] : ["SEM_SINDICO"]),
    ...(est.pedidoTeste ? [] : ["SEM_PEDIDO_TESTE"]),
  ];

  if (caminho === "/v1/contagens") {
    return route.fulfill({ json: { carteira: 1, implantacoes: est.entregue ? 0 : 1, chamados: est.chamado.situacao === "RESOLVIDO" ? 0 : 1,
      suporteAcesso: ["ABERTO", "DUVIDOSO"].includes(est.suporte.situacao) ? 1 : 0 } });
  }
  if (caminho === "/v1/implantacoes") {
    return route.fulfill({ json: { implantacoes: est.entregue ? [] : [{
      condominioId: est.suporte.condominioId, nome: "Residencial Ipê", iniciada: true, etapas: 8,
      feitas: est.etapas.filter((e) => e.situacao === "REALIZADA" || e.situacao === "NAO_SE_APLICA").length,
      proxima: est.etapas.find((e) => e.situacao !== "REALIZADA" && e.situacao !== "NAO_SE_APLICA"),
      pendencias: est.pendencias.filter((p) => !p.resolvidaEm).length, vencidas: est.pendencias.filter((p) => !p.resolvidaEm && p.vencida).length,
    }] } });
  }
  if (caminho === "/v1/suporte-acesso") return route.fulfill({ json: { pedidos: [est.suporte] } });
  if (caminho === "/v1/chamados") {
    const f = url.searchParams.get("filtro") ?? "ABERTOS";
    const c = est.chamado;
    const entra = f === "TODOS" || (f === "ABERTOS" ? ["NOVO", "ANDAMENTO"].includes(c.situacao) : f === "RESOLVIDOS" ? c.situacao === "RESOLVIDO" : c.situacao === f);
    return route.fulfill({ json: { chamados: entra ? [{ ...c, ultima: { lado: c.mensagens.at(-1)!.lado, autor: c.mensagens.at(-1)!.autor, em: c.mensagens.at(-1)!.criadoEm } }] : [] } });
  }
  if (!cliente) return null;
  const resto = caminho.slice(`/v1/clientes/${cliente.id}`.length);

  if (resto === "/implantacao") {
    return route.fulfill({ json: {
      legado: false, estagio: cliente.estagio(),
      implantacao: { id: "impl", roteiroVersao: 1, versao: est.entregue ? 2 : 1, ...(est.entregue ? { entregueEm: agora(), entreguePor: "Carolina" } : {}) },
      etapas: est.etapas, pendencias: est.pendencias, equipe,
      entrega: { faltando: faltando(), sindicos: cliente.sindicos.length, pendenciasClienteVencidas: est.pendencias.filter((p) => !p.resolvidaEm && p.vencida && p.comQuem === "CLIENTE").length,
        ...(est.pedidoTeste ? { pedidoTeste: { id: "p", protocolo: "2026-0001", encerradoEm: agora() } } : {}) },
      pode: { editar: !est.entregue, entregar: !est.entregue },
    } });
  }
  const et = /^\/implantacao\/etapas\/(\d+)$/.exec(resto);
  if (et) {
    const e = est.etapas[Number(et[1]) - 1]!;
    if (corpo.situacao === "REALIZADA" && !String(corpo.feito ?? "").trim()) return erro(route, 400, "VALIDATION_ERROR", { campos: ["feito"] });
    if (e.chave === "APRESENTACAO" && corpo.situacao === "REALIZADA" && !corpo.modalidade) return erro(route, 400, "VALIDATION_ERROR", { campos: ["modalidade"] });
    Object.assign(e, { situacao: corpo.situacao, responsavelId: corpo.responsavelId ?? undefined, responsavel: nomeDe(corpo.responsavelId as string),
      feito: corpo.feito || undefined, motivo: corpo.motivo || undefined, modalidade: corpo.modalidade ?? undefined, versao: e.versao + 1 });
    return route.fulfill({ json: { versao: e.versao } });
  }
  if (resto === "/implantacao/pendencias" && metodo === "POST") {
    est.pendencias.push({ id: novoId(), etapa: corpo.etapa as number, texto: String(corpo.texto), comQuem: String(corpo.comQuem), responsavelId: String(corpo.responsavelId),
      responsavel: nomeDe(String(corpo.responsavelId)) ?? "", proximoRetorno: String(corpo.proximoRetorno), vencida: String(corpo.proximoRetorno) < dia(0), versao: 1 });
    return route.fulfill({ status: 201, json: { id: est.pendencias.at(-1)!.id, versao: 1 } });
  }
  const pr = /^\/implantacao\/pendencias\/([^/]+)\/resolver$/.exec(resto);
  if (pr) {
    const p = est.pendencias.find((x) => x.id === pr[1])!;
    p.resolvidaEm = agora();
    return route.fulfill({ json: { versao: 2 } });
  }
  if (resto === "/implantacao/entregar") {
    if (faltando().length) return erro(route, 422, "VALIDATION_ERROR", { motivo: faltando()[0] });
    est.entregue = true;
    est.etapas[7]!.situacao = "REALIZADA";
    cliente.ativar();
    return route.fulfill({ json: { versao: 2 } });
  }
  if (resto === "/trocas") return route.fulfill({ json: { trocas: est.trocas } });
  if (resto === "/troca-sindico") {
    const anterior = cliente.sindicos.find((s) => s.vinculoId === corpo.vinculoId)!;
    cliente.sindicos.splice(cliente.sindicos.indexOf(anterior), 1, { vinculoId: novoId(), pessoaId: novoId(), nome: String(corpo.nome), desde: agora(), versao: 1 });
    est.trocas.push({ id: novoId(), feitaEm: agora(), feitaPor: "Carolina", anterior: anterior.nome, novo: String(corpo.nome), pedidoPor: String(corpo.pedidoPor),
      canal: String(corpo.canal), conferido: corpo.conferido as string[] });
    return route.fulfill({ status: 201, json: { trocaId: novoId(), vinculoId: novoId(), autorizados: [{ vinculoId: novoId(), pessoaId: BRUNA, nome: "Bruna Alves" }], contaNova: true } });
  }
  if (resto === "/pessoas-plataforma") return route.fulfill({ json: { pessoas: [{ pessoaId: BRUNA, nome: "Bruna Alves", funcoes: ["AUTORIZADO"], desde: "2026-10-16T13:00:00Z" }] } });
  if (resto === `/suporte-acesso/${PEDIDO_ACESSO}`) {
    const s = est.suporte;
    const aberto = s.situacao === "ABERTO";
    return route.fulfill({ json: { ...s, emailMascarado: "b••••@exemplo.com.br", pode: { verificar: aberto, decidir: aberto || s.situacao === "DUVIDOSO", tirarAutenticador: true } } });
  }
  if (resto === `/suporte-acesso/${PEDIDO_ACESSO}/verificar`) {
    Object.assign(est.suporte, { tipo: corpo.tipo, dadosConferidos: corpo.dadosConferidos, canalConhecido: corpo.canalConhecido, versao: est.suporte.versao + 1 });
    return route.fulfill({ json: { versao: est.suporte.versao } });
  }
  if (resto === `/suporte-acesso/${PEDIDO_ACESSO}/decidir`) {
    const s = est.suporte;
    if (corpo.decisao === "ENVIAR" && !(s.dadosConferidos && s.canalConhecido)) return erro(route, 422, "VALIDATION_ERROR", { motivo: "VERIFICACAO_INCOMPLETA" });
    if ((corpo.decisao === "DUVIDOSO" || corpo.decisao === "RECUSAR") && !String(corpo.motivo ?? "").trim()) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    s.situacao = { ENVIAR: "ENVIADO", TIRAR_AUTENTICADOR: "AUTENTICADOR_TIRADO", DUVIDOSO: "DUVIDOSO", RECUSAR: "RECUSADO" }[String(corpo.decisao)]!;
    if (s.situacao === "ENVIADO") s.linksEnviados++;
    s.versao++;
    return route.fulfill({ json: { situacao: s.situacao, pessoaId: s.pessoaId, versao: s.versao } });
  }
  if (resto === "/acessos-excepcionais" && metodo === "GET") return route.fulfill({ json: { itens: est.acessos, podePedir: true } });
  if (resto === "/acessos-excepcionais" && metodo === "POST") {
    if (String(corpo.motivo ?? "").trim().length < 10) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    est.acessos.unshift({ id: novoId(), pedidoPor: "Carolina", motivo: String(corpo.motivo), areas: corpo.areas as string[], horas: Number(corpo.horas),
      situacao: "PEDIDO", leituras: 0, criadoEm: agora(), meu: true });
    return route.fulfill({ status: 201, json: { id: est.acessos[0]!.id } });
  }
  const ex = /^\/excepcional\/(pedidos|moradores|comunicados|manutencao)$/.exec(resto);
  if (ex) {
    const a = est.acessos.find((x) => x.situacao === "APROVADO");
    if (!a) return erro(route, 403, "FORBIDDEN");
    a.leituras++;
    return route.fulfill({ json: { area: ex[1]!.toUpperCase(), validoAte: a.validoAte, dados: { itens: [{ id: "1", protocolo: "2026-0007", assunto: "Limpeza do hall", estado: "ABERTO" }] } } });
  }
  if (resto === `/chamados/${CHAMADO}` && metodo === "GET") {
    const c = est.chamado;
    return route.fulfill({ json: { ...c, arquivos: [], equipe, pode: { responder: c.situacao !== "RESOLVIDO", notaInterna: true, atualizar: true, pedirAcesso: true } } });
  }
  if (resto === `/chamados/${CHAMADO}` && metodo === "PUT") {
    Object.assign(est.chamado, { situacao: corpo.situacao, responsavelId: corpo.responsavelId ?? undefined, responsavel: nomeDe(corpo.responsavelId as string), versao: est.chamado.versao + 1 });
    return route.fulfill({ json: { versao: est.chamado.versao } });
  }
  if (resto === `/chamados/${CHAMADO}/responder`) {
    const c = est.chamado;
    c.mensagens.push({ id: novoId(), lado: "TRIADE", interna: Boolean(corpo.interna), autor: "Carolina", texto: String(corpo.texto), criadoEm: agora() });
    if (!corpo.interna && c.situacao === "NOVO") { c.situacao = "ANDAMENTO"; c.responsavelId = CAROLINA; c.responsavel = "Carolina"; }
    return route.fulfill({ status: 201, json: { ok: true } });
  }
  return null;
}
