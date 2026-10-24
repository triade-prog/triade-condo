// Parte da Memória do prédio da API falsa da Plataforma (peça R10; MP-12, MP-14, CT-02 a CT-04).
// As regras de verdade estão testadas no banco (pgTAP 019) e na API (Deno); aqui só o bastante
// para a tela: prontuário, linha do tempo, manual, dossiê e exportação.
import type { Route } from "@playwright/test";

interface ItemFalso {
  id?: string; chave?: string; grupo: string; nome: string; documentoId?: string; avisarDias: number; motivo?: string; versao?: number;
}
interface DocumentoFalso { id: string; titulo: string; tipo: string; valeAte?: string }
interface AnotacaoFalsa {
  id: string; tipo: string; titulo: string; texto: string; aconteceuEm: string; documentoId: string | null; versao: number; autor: string;
  criadoEm: string; retirada: boolean; versoes: { numero: number; tipo: string; titulo: string; texto: string; aconteceuEm: string; escritaEm: string; substituidaEm: string }[];
}
interface SecaoFalsa { id: string; titulo: string; resumo?: string; texto: string; ordem: number; noMural: boolean; escritaEm: string; versoes: number; versao: number; retirada: boolean }
export interface EstadoMemoria {
  itens: ItemFalso[];
  documentos: DocumentoFalso[];
  anotacoes: AnotacaoFalsa[];
  secoes: SecaoFalsa[];
  dossies: { id: string; geradoEm: string; autor: string }[];
  exportacoes: { id: string; situacao: string; pedidaEm: string; autor: string; prontaEm?: string; expiraEm?: string; vistas: number }[];
  /** O histórico do prontuário (0294, D.1): cada mudança nos itens, do mais antigo ao mais novo. */
  historico: { id: string; quando: string; acao: string; itemId: string; autor: string; documento?: string; avisarDias?: number; motivo?: string }[];
  /** Os documentos guardados em Documentos (a parte dos comunicados da API falsa), para ligar aos itens. */
  deDocumentos?: () => DocumentoFalso[];
}
/** Os documentos da memória e os de Documentos, numa lista só. */
const docs = (est: EstadoMemoria) => [...est.documentos, ...(est.deDocumentos?.() ?? [])];

let n = 0;
const novoId = () => `7e8f9a0b-1c2d-4e3f-8a4b-${String(++n).padStart(12, "0")}`;
// Data no fuso de Brasília (UTC-3), como a tela conta os dias; em UTC, das 21h à meia-noite a conta erraria por um.
const dia = (d: number) => new Date(Date.now() - 3 * 3600_000 + d * 86400_000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
const SUGERIDOS: [string, string, string][] = [
  ["CONVENCAO", "CONSTITUICAO", "Convenção"], ["REGIMENTO", "CONSTITUICAO", "Regimento interno"], ["ATA_AGO", "CONSTITUICAO", "Ata da última assembleia ordinária"],
  ["SEGURO", "SEGUROS", "Apólice do seguro obrigatório"], ["GARANTIA", "SEGUROS", "Garantia da construtora"],
  ["AVCB", "LAUDOS", "AVCB (Corpo de Bombeiros)"], ["ELEVADORES", "LAUDOS", "Inspeção dos elevadores"], ["SPDA", "LAUDOS", "Para-raios (SPDA)"],
  ["AGUA", "LAUDOS", "Limpeza da caixa d'água e potabilidade"], ["PLANTAS", "PLANTAS", "Plantas aprovadas"],
];

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export function criarMemoria(): EstadoMemoria {
  const documentos = [
    { id: novoId(), titulo: "Convenção", tipo: "CONVENCAO" },
    { id: novoId(), titulo: "AVCB 2025", tipo: "LAUDO", valeAte: dia(-16) },
    { id: novoId(), titulo: "Apólice Porto Seguro", tipo: "OUTRO", valeAte: dia(43) },
    { id: novoId(), titulo: "Laudo SPDA 2026", tipo: "LAUDO", valeAte: dia(290) },
  ];
  return {
    documentos,
    itens: [
      ...SUGERIDOS.map(([chave, grupo, nome]) => ({ chave, grupo, nome, avisarDias: 60 })),
    ].map((i) => (i.chave === "CONVENCAO" ? { ...i, id: novoId(), documentoId: documentos[0]!.id, versao: 1 }
      : i.chave === "AVCB" ? { ...i, id: novoId(), documentoId: documentos[1]!.id, versao: 1 }
        : i.chave === "SEGURO" ? { ...i, id: novoId(), documentoId: documentos[2]!.id, versao: 1 }
          : i.chave === "AGUA" ? { ...i, id: novoId(), motivo: "Prédio sem poço; a água vem da Caesb", versao: 1 } : i)),
    anotacoes: [
      { id: novoId(), tipo: "COMBINADO", titulo: "Vizinho do lote 12 divide o muro", texto: "Cada lado paga metade da pintura e dos reparos do muro divisório.",
        aconteceuEm: dia(-8), documentoId: null, versao: 1, autor: "Ana Souza", criadoEm: "2026-10-10T13:00:00Z", retirada: false, versoes: [] },
    ],
    secoes: [
      { id: novoId(), titulo: "Água e gás", resumo: "Registros e vazamentos", texto: "O registro geral fica na casa de bombas, atrás do portão da garagem.",
        ordem: 1, noMural: true, escritaEm: "2026-10-12T13:00:00Z", versoes: 0, versao: 1, retirada: false },
      { id: novoId(), titulo: "Casa de máquinas", texto: "A chave fica com a zeladoria.", ordem: 2, noMural: false, escritaEm: "2026-10-12T13:00:00Z",
        versoes: 0, versao: 1, retirada: false },
    ],
    dossies: [],
    exportacoes: [],
    historico: [],
  };
}

function situacao(est: EstadoMemoria, i: ItemFalso) {
  if (i.motivo) return { situacao: "NAO_SE_APLICA" };
  const d = docs(est).find((x) => x.id === i.documentoId);
  if (!d) return { situacao: "FALTA" };
  if (!d.valeAte) return { situacao: "EM_DIA" };
  if (d.valeAte < dia(0)) return { situacao: "VENCEU", valeAte: d.valeAte };
  if (d.valeAte <= dia(i.avisarDias)) return { situacao: "VENCE", valeAte: d.valeAte };
  return { situacao: "EM_DIA", valeAte: d.valeAte };
}

export function resumoProntuario(est: EstadoMemoria) {
  const s = est.itens.map((i) => situacao(est, i).situacao);
  const conta = (x: string) => s.filter((y) => y === x).length;
  return { total: s.length - conta("NAO_SE_APLICA"), emDia: conta("EM_DIA"), vence: conta("VENCE"), venceu: conta("VENCEU"), falta: conta("FALTA"),
    naoSeAplica: conta("NAO_SE_APLICA") };
}

/** As seções do manual que vão ao mural, para o mural sem conta. */
export const manualDoMural = (est: EstadoMemoria) => est.secoes.filter((s) => !s.retirada && s.noMural).sort((a, b) => a.ordem - b.ordem)
  .map((s) => ({ id: s.id, titulo: s.titulo, resumo: s.resumo, texto: s.texto, atualizadoEm: s.escritaEm }));

export async function rotasMemoria(route: Route, est: EstadoMemoria, caminho: string, metodo: string, corpo: Record<string, unknown>, url: URL,
  pode: (a: string) => boolean, eu: { nome: string }): Promise<unknown> {
  if (!caminho.startsWith("/v1/condominio/memoria")) return null;
  if (!pode("documentos.ver")) return erro(route, 403, "FORBIDDEN");
  const editar = pode("documentos.editar");
  const itemJson = (i: ItemFalso) => {
    const d = docs(est).find((x) => x.id === i.documentoId);
    return { ...i, ...situacao(est, i), documento: d ? { id: d.id, titulo: d.titulo, tipo: d.tipo, emVigor: { numero: 1, vigenteDesde: "2025-04-12" } } : undefined };
  };

  if (caminho === "/v1/condominio/memoria/prontuario") {
    return route.fulfill({ json: {
      itens: est.itens.map(itemJson), resumo: resumoProntuario(est), documentos: docs(est),
      contratos: { total: 4, vencendo: [{ id: "x", prestador: "Aqualimp", ate: dia(38) }] }, preventivas: { ativas: 12, atrasadas: 1 }, podeEditar: editar,
    } });
  }
  if (caminho === "/v1/condominio/memoria/prontuario/itens" && metodo === "POST") {
    if (!editar) return erro(route, 403, "FORBIDDEN");
    if (est.itens.some((i) => i.nome.toLowerCase() === String(corpo.nome).trim().toLowerCase())) return erro(route, 400, "VALIDATION_ERROR", { motivo: "ITEM_REPETIDO" });
    est.itens.push({ id: novoId(), grupo: String(corpo.grupo), nome: String(corpo.nome).trim(), avisarDias: 60, versao: 1 });
    return route.fulfill({ status: 201, json: { ok: true } });
  }
  const it = /^\/v1\/condominio\/memoria\/prontuario\/itens\/([^/]+)$/.exec(caminho);
  if (it) {
    if (!editar) return erro(route, 403, "FORBIDDEN");
    const i = est.itens.find((x) => x.id === it[1] || x.chave === it[1]);
    if (!i) return erro(route, 404, "NOT_FOUND");
    if (corpo.acao === "NAO_SE_APLICA" && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (corpo.acao === "LIGAR" && !corpo.documentoId) return erro(route, 400, "VALIDATION_ERROR", { campos: ["documentoId"] });
    if (corpo.acao === "LIGAR") { i.documentoId = String(corpo.documentoId); i.avisarDias = Number(corpo.avisarDias); i.motivo = undefined; }
    if (corpo.acao === "DESLIGAR") i.documentoId = undefined;
    if (corpo.acao === "NAO_SE_APLICA") { i.documentoId = undefined; i.motivo = String(corpo.motivo).trim(); }
    if (corpo.acao === "VALE") i.motivo = undefined;
    i.id ??= novoId();
    i.versao = (i.versao ?? 0) + 1;
    est.historico.push({ id: novoId(), quando: agora(), acao: String(corpo.acao), itemId: i.id, autor: eu.nome,
      documento: i.documentoId ? docs(est).find((d) => d.id === i.documentoId)?.titulo : undefined,
      avisarDias: corpo.acao === "LIGAR" ? i.avisarDias : undefined, motivo: i.motivo });
    return route.fulfill({ json: { id: i.id, versao: i.versao } });
  }

  if (caminho === "/v1/condominio/memoria/prontuario/historico") {
    const pedido = url.searchParams.get("item");
    const item = pedido ? est.itens.find((x) => x.id === pedido) : undefined;
    if (pedido && !item) return erro(route, 404, "NOT_FOUND");
    const nomeDe = (id: string) => est.itens.find((x) => x.id === id)!;
    const vencidos = est.itens.filter((i) => i.id && situacao(est, i).situacao === "VENCEU")
      .map((i) => ({ id: `venceu-${i.id}`, quando: `${situacao(est, i).valeAte}T03:00:00Z`, acao: "VENCEU", itemId: i.id!, autor: undefined as string | undefined,
        documento: docs(est).find((d) => d.id === i.documentoId)?.titulo }));
    const eventos = [...est.historico, ...vencidos].filter((e) => !item || e.itemId === item.id)
      .sort((a, b) => b.quando.localeCompare(a.quando))
      .map((e) => ({ ...e, data: e.quando.slice(0, 10), item: nomeDe(e.itemId).nome, grupo: nomeDe(e.itemId).grupo }));
    return route.fulfill({ json: { eventos, item: item ? { id: item.id, nome: item.nome } : undefined,
      itens: est.itens.filter((i) => i.id).map((i) => ({ id: i.id, nome: i.nome })) } });
  }

  if (caminho === "/v1/condominio/memoria/linha-do-tempo") {
    const filtro = url.searchParams.get("filtro") ?? "TUDO";
    const busca = (url.searchParams.get("busca") ?? "").toLowerCase();
    const de = url.searchParams.get("de") ?? "";
    const ate = url.searchParams.get("ate") ?? "";
    if (de && ate && ate < de) return erro(route, 400, "VALIDATION_ERROR", { campos: ["ate"] });
    const eventos = [
      ...est.anotacoes.filter((a) => !a.retirada).map((a) => ({ fonte: "ANOTADO", categoria: "ANOTADO", id: a.id, data: a.aconteceuEm, titulo: a.titulo, tipo: a.tipo,
        texto: a.texto, autor: a.autor, corrigida: a.versoes.length ? true : undefined, versao: a.versao,
        ligacao: a.documentoId ? { tipo: "DOCUMENTO", id: a.documentoId, titulo: est.documentos.find((d) => d.id === a.documentoId)?.titulo } : undefined })),
      { fonte: "MANUTENCAO", categoria: "MANUTENCAO", id: "m1", manutencaoId: "m1", data: dia(-3), titulo: "Manutenção concluída: troca da bomba de recalque", detalhe: "HidroPress Bombas" },
      { fonte: "PRONTUARIO", categoria: "DOCUMENTOS", id: "p1", data: dia(-16), titulo: "AVCB (Corpo de Bombeiros) venceu", detalhe: "Do prontuário" },
      { fonte: "DOCUMENTO", categoria: "DOCUMENTOS", id: "d1", documentoId: est.documentos[0]!.id, data: "2019-03-12", titulo: "Documento guardado: Convenção" },
      { fonte: "PESSOA", categoria: "PESSOAS", id: "v1", data: "2025-03-01", titulo: "Ana Souza assume a sindicatura", detalhe: "Entrada na Plataforma" },
    ].filter((e) => filtro === "TUDO" || e.categoria === filtro)
      .filter((e) => !busca || [e.titulo, e.detalhe, e.texto].some((t) => t?.toLowerCase().includes(busca)))
      .filter((e) => (!de || e.data >= de) && (!ate || e.data <= ate))
      .sort((a, b) => b.data.localeCompare(a.data));
    return route.fulfill({ json: { eventos, podeAnotar: editar } });
  }
  if (caminho === "/v1/condominio/memoria/opcoes") {
    return route.fulfill({ json: { documentos: est.documentos, pedidos: [], manutencoes: [{ id: "m1", titulo: "Troca da bomba de recalque" }] } });
  }
  const an = /^\/v1\/condominio\/memoria\/anotacoes(?:\/([^/]+))?(\/retirar)?$/.exec(caminho);
  if (an) {
    const a = an[1] ? est.anotacoes.find((x) => x.id === an[1]) : undefined;
    if (an[1] && !a) return erro(route, 404, "NOT_FOUND");
    if (metodo === "GET" && a) {
      return route.fulfill({ json: {
        anotacao: { ...a, ligacao: a.documentoId ? { tipo: "DOCUMENTO", id: a.documentoId, titulo: est.documentos.find((d) => d.id === a.documentoId)?.titulo } : undefined },
        versoes: [...a.versoes].reverse().map((v) => ({ ...v, autor: "Ana Souza" })), podeEditar: editar && !a.retirada,
      } });
    }
    if (!editar) return erro(route, 403, "FORBIDDEN");
    if (an[2] && a) {
      if (String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      a.retirada = true;
      return route.fulfill({ json: { versao: ++a.versao } });
    }
    const campos = [String(corpo.titulo ?? "").trim().length < 3 ? "titulo" : null, String(corpo.texto ?? "").trim().length < 3 ? "texto" : null,
      String(corpo.aconteceuEm ?? "") > dia(0) ? "aconteceuEm" : null].filter(Boolean);
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    if (a) {
      a.versoes.push({ numero: a.versoes.length + 1, tipo: a.tipo, titulo: a.titulo, texto: a.texto, aconteceuEm: a.aconteceuEm, escritaEm: a.criadoEm, substituidaEm: agora() });
      Object.assign(a, { tipo: corpo.tipo, titulo: String(corpo.titulo).trim(), texto: String(corpo.texto).trim(), aconteceuEm: corpo.aconteceuEm,
        documentoId: (corpo.documentoId as string) ?? null, versao: a.versao + 1 });
      return route.fulfill({ json: { id: a.id, versao: a.versao } });
    }
    const nova: AnotacaoFalsa = { id: novoId(), tipo: String(corpo.tipo), titulo: String(corpo.titulo).trim(), texto: String(corpo.texto).trim(),
      aconteceuEm: String(corpo.aconteceuEm), documentoId: (corpo.documentoId as string) ?? null, versao: 1, autor: eu.nome, criadoEm: agora(), retirada: false, versoes: [] };
    est.anotacoes.push(nova);
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }

  const ativas = () => est.secoes.filter((s) => !s.retirada).sort((a, b) => a.ordem - b.ordem);
  if (caminho === "/v1/condominio/memoria/manual" && metodo === "GET") {
    return route.fulfill({ json: { secoes: ativas(), muralLigado: true, podeEditar: editar } });
  }
  if (caminho === "/v1/condominio/memoria/manual/ordem") {
    (corpo.ids as string[]).forEach((id, i) => { const s = est.secoes.find((x) => x.id === id); if (s) s.ordem = i + 1; });
    return route.fulfill({ json: { ok: true } });
  }
  const mn = /^\/v1\/condominio\/memoria\/manual(?:\/([^/]+))?(\/retirar)?$/.exec(caminho);
  if (mn) {
    const s = mn[1] ? est.secoes.find((x) => x.id === mn[1]) : undefined;
    if (mn[1] && !s) return erro(route, 404, "NOT_FOUND");
    if (metodo === "GET" && s) return route.fulfill({ json: { secao: s, versoes: [], podeEditar: editar } });
    if (!editar) return erro(route, 403, "FORBIDDEN");
    if (mn[2] && s) { s.retirada = true; return route.fulfill({ json: { versao: ++s.versao } }); }
    if (String(corpo.texto ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["texto"] });
    if (s) {
      if (s.texto !== corpo.texto || s.titulo !== corpo.titulo) s.versoes++;
      Object.assign(s, { titulo: String(corpo.titulo).trim(), resumo: (corpo.resumo as string) || undefined, texto: String(corpo.texto).trim(), noMural: !!corpo.noMural, versao: s.versao + 1 });
      return route.fulfill({ json: { id: s.id, versao: s.versao } });
    }
    const nova: SecaoFalsa = { id: novoId(), titulo: String(corpo.titulo).trim(), resumo: (corpo.resumo as string) || undefined, texto: String(corpo.texto).trim(),
      ordem: ativas().length + 1, noMural: !!corpo.noMural, escritaEm: agora(), versoes: 0, versao: 1, retirada: false };
    est.secoes.push(nova);
    return route.fulfill({ status: 201, json: { id: nova.id, versao: 1 } });
  }

  if (caminho.startsWith("/v1/condominio/memoria/dossies") && !pode("memoria.dossie")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/memoria/dossies" && metodo === "GET") return route.fulfill({ json: est.dossies });
  if (caminho === "/v1/condominio/memoria/dossies" && metodo === "POST") {
    const d = { id: novoId(), geradoEm: agora(), autor: eu.nome };
    est.dossies.unshift(d);
    return route.fulfill({ status: 201, json: { id: d.id, geradoEm: d.geradoEm } });
  }
  const ds = /^\/v1\/condominio\/memoria\/dossies\/([^/]+)$/.exec(caminho);
  if (ds) {
    const d = est.dossies.find((x) => x.id === ds[1]);
    if (!d) return erro(route, 404, "NOT_FOUND");
    return route.fulfill({ json: { ...d, conteudo: {
      condominio: { nome: "Residencial Ipê", cidade: "Brasília", uf: "DF" }, geradoPor: d.autor,
      pendencias: {
        pedidosAbertos: 3,
        pedidos: [{ protocolo: "2026-0034", assunto: "Barulho na casa de bombas", unidade: "Bloco A · 101", estado: "EM_ANDAMENTO", proximoRetorno: "2026-10-15T17:00:00Z", retornoVencido: true, responsavel: "Bruna" },
          { protocolo: "2026-0035", assunto: "Pedido privado", estado: "ABERTO" }],
        manutencoes: [{ titulo: "Infiltração na vaga 14", tipo: "CORRETIVA", local: "Garagem", estado: "PENDENTE", pendencia: "Aguardando fornecedor" }],
        prontuario: [{ item: "AVCB (Corpo de Bombeiros)", situacao: "VENCEU", valeAte: dia(-16) }, { item: "Para-raios (SPDA)", situacao: "FALTA" }],
      },
      prestadores: [{ prestador: "Aqualimp", servico: "Limpeza de reservatórios", acordo: "CONTRATO", contratoAte: dia(38) },
        { prestador: "HidroPress Bombas", servico: "Bombas", acordo: "CHAMADO", contato: "Márcio", telefone: "+5561933441200" }],
      documentos: [{ tipo: "CONVENCAO", titulo: "Convenção", emVigor: 3 }, { tipo: "LAUDO", titulo: "AVCB 2025", valeAte: dia(-16), emVigor: 1 }],
      preventivas: [{ atividade: "Recarga dos extintores", local: "Todos os andares", proxima: dia(7), intervalo: 1, unidadeTempo: "ANO" }],
      anotacoes: est.anotacoes.filter((a) => !a.retirada).map((a) => ({ tipo: a.tipo, titulo: a.titulo, texto: a.texto, aconteceuEm: a.aconteceuEm })),
      agenda: [{ titulo: "AGE", tipo: "REUNIAO", data: dia(21), hora: "19:00", local: "Salão de festas" }],
      comunicados: [{ titulo: "Água desligada na quinta", assunto: "OBRAS", publicadoEm: "2026-10-14T12:00:00Z" }],
      acesso: [{ pessoa: "Ana Souza", funcao: "SINDICO", desde: "2025-03-01T12:00:00Z" },
        { pessoa: "Bruna", funcao: "AUTORIZADO", cargo: "Secretária", desde: "2026-10-16T14:00:00Z", permissoes: ["Configurar", "Cadastrar moradores"] }],
      manual: ativas().map((s) => ({ titulo: s.titulo, texto: s.texto, noMural: s.noMural })),
      resumoProntuario: resumoProntuario(est),
    } } });
  }

  if (caminho.startsWith("/v1/condominio/memoria/exportacoes") && !pode("memoria.exportar")) return erro(route, 403, "FORBIDDEN");
  if (caminho === "/v1/condominio/memoria/exportacoes" && metodo === "GET") {
    // A montagem "termina" na segunda vez que a tela confere.
    for (const e of est.exportacoes) {
      if (e.situacao === "MONTANDO" && ++e.vistas > 1) Object.assign(e, { situacao: "PRONTA", prontaEm: agora(), expiraEm: new Date(Date.now() + 7 * 86400_000).toISOString() });
    }
    const montando = est.exportacoes.some((e) => e.situacao === "MONTANDO");
    const lista = est.exportacoes.map((e) => ({ ...e, partes: [
      { numero: 1, tipo: "DADOS", situacao: e.situacao === "PRONTA" ? "PRONTA" : "MONTANDO", tamanho: e.situacao === "PRONTA" ? 2_516_582 : undefined },
      { numero: 2, tipo: "ARQUIVOS", situacao: e.situacao === "PRONTA" ? "PRONTA" : "ESPERA", tamanho: e.situacao === "PRONTA" ? 47_000_000 : undefined, arquivos: 312 },
    ] }));
    return route.fulfill({ json: { exportacoes: lista, podePedir: !est.exportacoes.length, motivo: montando ? "MONTANDO" : est.exportacoes.length ? "UMA_POR_DIA" : undefined, montando } });
  }
  if (caminho === "/v1/condominio/memoria/exportacoes" && metodo === "POST") {
    if (est.exportacoes.length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "EXPORTACAO_RECENTE" });
    est.exportacoes.unshift({ id: novoId(), situacao: "MONTANDO", pedidaEm: agora(), autor: eu.nome, vistas: 0 });
    return route.fulfill({ status: 201, json: { id: est.exportacoes[0]!.id, pacotes: 2 } });
  }
  return erro(route, 404, "NOT_FOUND");
}
