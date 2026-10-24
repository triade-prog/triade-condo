// API da Plataforma falsa, dentro do navegador (page.route): as telas dos passos 2 a 7 e a agenda rodam
// sem Supabase. As regras de verdade estão testadas no banco (pgTAP 008, 009 e 010) e na API
// (Deno); aqui se confere a tela: fluxo, textos, o que cada pessoa vê e acessibilidade.
import type { Page, Route } from "@playwright/test";
import { criarMoradores, resumoMoradores, rotasCadastroPublico, rotasMoradores } from "./api-falsa-moradores";
import { AGORA, criarPedidos, resumoPedidos, rotasPedidos, vencido, vencidoMaisAntigo } from "./api-falsa-pedidos";
import { criarAvisos, escalado, MES_FECHADO, naoVistos, regrasAvisoIniciais, rotasPrazos } from "./api-falsa-prazos";
import { rotasArmazenamento, semearArquivos } from "./api-falsa-arquivos";
import { criarAgenda, rotasAgenda } from "./api-falsa-agenda";
import { criarManutencao, resumoManutencao, rotasManutencao } from "./api-falsa-manutencao";
import { criarComunicados, muralNoPainelFalso, resumoComunicados, rotasComunicados, rotasPublicas } from "./api-falsa-comunicados";
import { criarLinks, rotasLinks, rotasLinksPublicas } from "./api-falsa-links";
import { criarMemoria, manualDoMural, resumoProntuario, rotasMemoria } from "./api-falsa-memoria";
import { criarSuporte, resumoAcessos, rotasSuporte } from "./api-falsa-suporte";
import { criarWhatsapp, resumoWhatsapp, rotasWhatsapp } from "./api-falsa-whatsapp";
import { criarVida, resumoVida, rotasVida } from "./api-falsa-vida";
import { criarEnquetes, resumoEnquetes, rotasEnquetePublica, rotasEnquetes } from "./api-falsa-enquetes";
import { criarAssembleias, resumoAssembleia, rotasAssembleiaPublica, rotasAssembleias } from "./api-falsa-assembleias";
import { classificadosAAprovar, classificadosDoMural, criarClassificados, rotasClassificadoPublico, rotasClassificados } from "./api-falsa-classificados";
import { avisarNoRegistro, avisosDoPedido, criarAvisoRegistro, rotasAvisoRegistro, type ContextoAviso } from "./api-falsa-aviso-registro";
import { criarRelatorios, rotasArquivoRelatorio, rotasRelatorios } from "./api-falsa-relatorios";
import { avisosDecisoes, criarDecisoes, detalheDecisoes, marcarAvisosDecisoes, resumoDecisoes, rotasDecisoes, semearDecisoes } from "./api-falsa-decisoes";

/** As 22 permissões do banco (permissoes), na ordem de @triade/domain. */
const PERMISSOES = {
  ACOMPANHAR: "Acompanhar",
  RESPONDER: "Responder",
  ATUALIZAR: "Atualizar",
  CONCLUIR: "Concluir",
  PUBLICAR: "Publicar",
  CONFIGURAR: "Configurar",
  APROVAR: "Aprovar",
  CADASTRAR: "Cadastrar moradores",
  VER_AGENDA: "Ver a agenda",
  AGENDA: "Cuidar da agenda",
  VER_MANUTENCAO: "Ver a manutenção",
  MANUTENCAO: "Cuidar da manutenção",
  VER_COMUNICADOS: "Ver comunicados e documentos",
  DOCUMENTOS: "Cuidar dos documentos",
  VER_RESERVAS: "Ver as reservas",
  RESERVAS: "Cuidar das reservas",
  VER_ENQUETES: "Ver as enquetes",
  ENQUETES: "Cuidar das enquetes",
  VER_ASSEMBLEIAS: "Ver as assembleias",
  ASSEMBLEIAS: "Cuidar das assembleias",
  VER_CLASSIFICADOS: "Ver os classificados",
  CLASSIFICADOS: "Cuidar dos classificados",
} as const;

export const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
export const JATOBA = "3e0f6c31-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const ANA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
export const V_ANA = "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e";
export const V_BRUNA = "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f";

export interface OpcoesPlataforma {
  logado?: boolean;
  /** Quem entra: a síndica, a secretária com Configurar e Cadastrar moradores ou o subsíndico que só vê. */
  quem?: "SINDICA" | "SECRETARIA" | "SO_VE";
  /** Com dois condomínios, a pessoa escolhe em qual entrar (MU-04). */
  doisCondominios?: boolean;
  /** A TRÍADE pediu acesso excepcional e espera a síndica (peça R4, PI-11). */
  comAcessoPedido?: boolean;
  /** A síndica e a secretária já atendem os pedidos (passo 4). */
  comAtendimento?: boolean;
  /** A Agenda com o vencimento de um contrato e de dois documentos e uma assembleia convocada (AG-09). */
  comDatasDeFora?: boolean;
  /** A secretária também registra pedidos (F6.4): vê o síndico no bloco Quem avisar. */
  secretariaRegistra?: boolean;
  /** Pedidos parecidos com o 2026-0002 (um concluído, outro aberto) e uma decisão vencida esperando a Ana (F7.4). */
  comDecisoes?: boolean;
  /** Comunicados pelo WhatsApp ligados (F6.6): a Marina e o Pedro aceitaram, a Joana disse não; a mensagem ao Pedro falhou. */
  comComunicadosWhatsapp?: boolean;
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

let n = 0;
const novoId = () => `9a0b1c2d-3e4f-4a5b-8c6d-${String(++n).padStart(12, "0")}`;

export async function instalarApiPlataformaFalsa(page: Page, opcoes: OpcoesPlataforma = {}) {
  const quem = opcoes.quem ?? "SINDICA";
  const cats = ["Manutenção", "Limpeza", "Barulho e convivência", "Segurança", "Áreas comuns e reservas", "Boletos e cobrança", "Portaria e acesso", "Outros assuntos"]
    .map((nome) => ({ id: novoId(), nome, ativa: true, versao: 1 }));
  const pris = [
    ["Baixa", "Pode esperar a rotina: não afeta a segurança nem o uso do prédio."],
    ["Normal", "Precisa de retorno no prazo de costume: incomoda, mas não impede o uso."],
    ["Alta", "Afeta várias unidades ou uma área comum importante: vem antes das normais."],
    ["Urgente", "Risco à segurança ou à saúde, ou dano acontecendo agora."],
  ].map(([nome, significado], i) => ({ id: novoId(), nome: nome!, significado: significado!, nivel: i + 1, ativa: true, versao: 1 }));
  const etapa = (nome: string, situacao: string, ordem: number, pausaPrazo = false) =>
    ({ id: novoId(), nome, situacao, categoriaId: null as string | null, pausaPrazo, ordem, ativa: true, versao: 1 });
  const estado = {
    logado: opcoes.logado ?? true,
    condominioAtual: opcoes.doisCondominios ? null as string | null : IPE,
    config: {
      fuso: "America/Sao_Paulo",
      versao: 1,
      horarios: {
        FUNCIONAMENTO: { intervalos: [] as { dia: number; inicio: string; fim: string }[], versao: 1 },
        ATENDIMENTO: { intervalos: [] as { dia: number; inicio: string; fim: string }[], versao: 1 },
      },
      feriados: [] as { id: string; data: string; descricao: string }[],
      categorias: cats,
      prioridades: pris,
      etapas: [etapa("Recebido", "ABERTO", 1), etapa("Em análise", "EM_ANDAMENTO", 1), etapa("Aguardando o morador", "EM_ANDAMENTO", 2, true),
        etapa("Aguardando prestador", "EM_ANDAMENTO", 3), etapa("Concluído", "ENCERRADO", 1), etapa("Não procede", "ENCERRADO", 2)],
      modelos: [
        { id: novoId(), titulo: "Recebemos seu pedido", texto: "Olá! Recebemos seu pedido e vamos dar retorno dentro do prazo informado.", categoriaId: null as string | null, ativo: true, versao: 1 },
        { id: novoId(), titulo: "Pedido concluído", texto: "Seu pedido foi concluído. Se algo não ficou certo, responda esta mensagem.", categoriaId: null as string | null, ativo: true, versao: 1 },
      ],
      prazos: [
        { id: novoId(), categoriaId: null as string | null, prioridadeId: null as string | null, horas: 24, versao: 1 },
        { id: novoId(), categoriaId: null as string | null, prioridadeId: pris[3]!.id as string | null, horas: 4, versao: 1 },
      ],
      regrasPedidos: { revisao: false, reabertura: true },
    },
    pessoas: [
      { vinculoId: V_ANA, pessoaId: ANA, nome: "Ana Souza", funcao: "SINDICO", cargo: null as string | null, permissoes: [] as string[], desde: "2026-10-16T13:00:00Z", versao: 1, responsavel: false, disponivel: false },
      { vinculoId: V_BRUNA, pessoaId: novoId(), nome: "Bruna", funcao: "AUTORIZADO", cargo: "Secretária" as string | null, permissoes: ["CONFIGURAR", "CADASTRAR"], desde: "2026-10-16T14:00:00Z", versao: 1, responsavel: false, disponivel: false },
    ],
    responsavelPadrao: null as string | null,
    convites: [] as string[],
    moradores: criarMoradores(),
    pedidos: [] as ReturnType<typeof criarPedidos>,
    avisos: [] as ReturnType<typeof criarAvisos>,
    regras: regrasAvisoIniciais(),
  };
  estado.pedidos = criarPedidos(estado.config, V_ANA, V_BRUNA);
  estado.avisos = criarAvisos(estado.pedidos, V_ANA, V_BRUNA);
  semearArquivos(estado.pedidos[0]!.id, AGORA);
  const agenda = criarAgenda(V_ANA, V_BRUNA, estado.pedidos[0]!);
  const manutencao = criarManutencao(V_ANA, V_BRUNA, estado.pedidos[0]!, pris[2]!.id);
  const comunicados = criarComunicados(estado.pedidos[0]!.id);
  if (opcoes.comComunicadosWhatsapp) {
    estado.moradores.zap.ligado = true;
    const pedro = estado.moradores.contatos.find((x) => x.nome === "Pedro Souza")!;
    comunicados.comunicados[0]!.whatsappFalhas = [{ contatoId: pedro.id, motivo: "Número sem WhatsApp" }];
  }
  const links = criarLinks();
  const vida = criarVida();
  const enquetes = criarEnquetes();
  const assembleias = criarAssembleias();
  const classificados = criarClassificados();
  const memoria = criarMemoria();
  memoria.deDocumentos = () => comunicados.documentos.filter((d) => !d.arquivado)
    .map((d) => ({ id: d.id, titulo: d.titulo, tipo: d.tipo, ...(d.valeAte ? { valeAte: d.valeAte } : {}) }));
  const suporte = criarSuporte();
  const relatorios = criarRelatorios();
  const whatsapp = criarWhatsapp(estado.pedidos[0]!, cats[0]!.id, pris[1]!.id);
  const avisoRegistro = criarAvisoRegistro(V_ANA);
  const decisoes = criarDecisoes();
  if (opcoes.comDecisoes) semearDecisoes(decisoes, estado.pedidos, V_ANA, estado.config.etapas.find((e) => e.nome === "Concluído")!.id);
  if (!opcoes.comAcessoPedido) suporte.acessos = [];
  if (opcoes.comAtendimento) {
    for (const p of estado.pessoas) { p.responsavel = true; p.disponivel = true; }
    estado.responsavelPadrao = V_ANA;
  }
  const eu = quem === "SINDICA" ? { vinculo: V_ANA, nome: "Ana Souza" } : quem === "SECRETARIA" ? { vinculo: V_BRUNA, nome: "Bruna" } : { vinculo: "caio", nome: "Caio" };

  const acoes = () => quem === "SINDICA"
    ? ["agenda.editar", "agenda.ver", "atendimento.responsaveis", "comunicados.publicar", "comunicados.ver", "config.editar", "config.ver",
      "documentos.editar", "documentos.restritos", "documentos.ver", "manutencao.editar", "manutencao.ver", "moradores.confirmar", "moradores.editar", "moradores.ver", "pedidos.atualizar", "pedidos.concluir",
      "memoria.dossie", "memoria.exportar", "pedidos.responder", "pedidos.revisar", "pedidos.ver", "pessoas.autorizar", "pessoas.ver", "plataforma.painel.ver",
      "suporte.chamados", "acesso_excepcional.aprovar", "reservas.editar", "reservas.ver",
      "enquetes.editar", "enquetes.ver", "assembleias.editar", "assembleias.ver", "classificados.editar", "classificados.ver", "decisoes.aprovar"]
    : quem === "SECRETARIA" ? ["config.editar", "config.ver", "moradores.editar", "moradores.ver", "pedidos.responder", "pedidos.ver", "plataforma.painel.ver", "suporte.chamados",
      ...(opcoes.secretariaRegistra ? ["pedidos.atualizar"] : [])]
      : ["agenda.ver", "comunicados.ver", "config.ver", "documentos.ver", "pedidos.ver", "plataforma.painel.ver", "suporte.chamados"];
  const pendencias = () => {
    const p: string[] = [];
    if (estado.config.horarios.ATENDIMENTO.intervalos.length === 0) p.push("SEM_HORARIO_ATENDIMENTO");
    const resp = estado.pessoas.filter((x) => x.responsavel);
    if (resp.length === 0) p.push("SEM_RESPONSAVEL");
    else if (!resp.some((x) => x.vinculoId === estado.responsavelPadrao && x.disponivel)) p.push("SEM_RESPONSAVEL_PADRAO");
    return p;
  };
  const versaoErrada = (route: Route, item: { versao: number }, corpo: Record<string, unknown>) =>
    corpo.versao !== item.versao ? erro(route, 409, "VERSION_CONFLICT", { versao: item.versao, atual: item }) : null;
  const nomeRepetido = (lista: { nome: string; ativa: boolean; id: string }[], nome: string, id?: string) =>
    lista.some((x) => x.ativa && x.id !== id && x.nome.toLowerCase() === nome.trim().toLowerCase());

  // As contagens das abas (D4.2): como a api-plataforma, pedem a própria lista uma vez por aba.
  const CONTADAS: Record<string, { caminho: string; chave: string; abas: string[]; itens?: string; somas?: Record<string, number> }> = {
    pedidos: { caminho: "/v1/condominio/pedidos", chave: "situacao", abas: ["ABERTO", "EM_ANDAMENTO", "EM_REVISAO", "ENCERRADO", "CANCELADO"], somas: { ATIVOS: 3, TODOS: 5 } },
    manutencao: { caminho: "/v1/condominio/manutencao", chave: "situacao", abas: ["PLANEJADA", "EM_ANDAMENTO", "PENDENTE", "CONCLUIDA", "CANCELADA"], somas: { ABERTAS: 3, TODAS: 5 } },
    comunicados: { caminho: "/v1/condominio/comunicados", chave: "filtro", abas: ["PUBLICADO", "PROGRAMADO", "RASCUNHO", "ARQUIVADO"] },
    decisoes: { caminho: "/v1/condominio/decisoes", chave: "filtro", abas: ["DECIDIDAS", "TODAS"], itens: "decisoes" },
    reservas: { caminho: "/v1/condominio/reservas", chave: "filtro", abas: ["A_APROVAR", "PROXIMAS", "TODAS"], itens: "reservas" },
  };
  /** Uma chamada feita por dentro, como a api-plataforma chama o banco. */
  async function porDentro(u: URL, corpo?: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
    let resposta = { status: 500, json: {} as Record<string, unknown> };
    const interna = {
      request: () => ({ url: () => u.toString(), method: () => (corpo ? "POST" : "GET"), postDataJSON: () => corpo ?? null, headers: () => ({}) }),
      fulfill: async (o: { json?: unknown; status?: number }) => { resposta = { status: o.status ?? 200, json: (o.json ?? {}) as Record<string, unknown> }; },
    } as unknown as Route;
    await atender(interna);
    return resposta;
  }
  /** A resposta recusada volta null. */
  const lerPorDentro = async (u: URL, corpo?: Record<string, unknown>) => {
    const r = await porDentro(u, corpo);
    return r.status < 300 ? r.json : null;
  };
  async function contar(route: Route, lista: string, url: URL) {
    const def = CONTADAS[lista];
    if (!def) return erro(route, 404, "NOT_FOUND");
    const n: Record<string, number> = {};
    for (const aba of def.abas) {
      const u = new URL(url.toString());
      u.pathname = `/api${def.caminho}`;
      u.searchParams.delete("pagina");
      u.searchParams.set(def.chave, aba);
      const dados = (await lerPorDentro(u)) ?? {};
      n[aba] = def.itens ? ((dados[def.itens] as unknown[] | undefined) ?? []).length : Number(dados.total ?? 0);
    }
    for (const [nome, quantas] of Object.entries(def.somas ?? {})) n[nome] = def.abas.slice(0, quantas).reduce((t, a) => t + n[a]!, 0);
    return route.fulfill({ json: n });
  }

  async function atender(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace(/^\/api/, "");
    const metodo = req.method();
    // O "armazenamento" recebe o arquivo em binário: atende antes de ler o corpo como JSON.
    const armazenamento = await rotasArmazenamento(route, caminho, metodo);
    if (armazenamento !== null) return armazenamento;
    const arquivoRelatorio = await rotasArquivoRelatorio(route, caminho);
    if (arquivoRelatorio !== null) return arquivoRelatorio;
    const corpo = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    const c = estado.config;

    if (caminho === "/v1/auth/entrar") {
      if (corpo.senha !== "senha-da-sindica") return erro(route, 401, "INVALID_CREDENTIALS");
      estado.logado = true;
      return route.fulfill({ json: { etapa: "PRONTO" } });
    }
    if (caminho === "/v1/auth/sair") { estado.logado = false; return route.fulfill({ json: { ok: true } }); }
    if (caminho === "/v1/auth/recuperar") {
      return route.fulfill({ json: { mensagem: "Se este e-mail tiver acesso à TRÍADE Condo, enviamos um link para criar uma senha nova." } });
    }
    // Sem conta (CD-12 a CD-14): o mural e os links do e-mail não pedem login.
    const linkDaEnquete = await rotasEnquetePublica(route, enquetes, caminho, metodo, corpo);
    if (linkDaEnquete !== null) return linkDaEnquete;
    const linkDaAssembleia = await rotasAssembleiaPublica(route, assembleias, caminho, metodo, corpo);
    if (linkDaAssembleia !== null) return linkDaAssembleia;
    links.canalAlternativo = whatsapp.queda?.canalAlternativo;
    const etiquetaOuPrestador = await rotasLinksPublicas(route, links, manutencao, caminho, metodo, corpo);
    if (etiquetaOuPrestador !== null) return etiquetaOuPrestador;
    const fotoDoAnuncio = await rotasClassificadoPublico(route, caminho);
    if (fotoDoAnuncio !== null) return fotoDoAnuncio;
    const manualMural = () => manualDoMural(memoria);
    const extraMural = () => ({ classificados: classificadosDoMural(classificados) });
    const cadastroPeloLink = await rotasCadastroPublico(route, estado.moradores, caminho, metodo, corpo);
    if (cadastroPeloLink !== null) return cadastroPeloLink;
    const publicas = await rotasPublicas(route, comunicados, caminho, metodo, corpo, manualMural, extraMural, estado.moradores.zap);
    if (publicas !== null) return publicas;
    if (!estado.logado) return erro(route, 401, "UNAUTHORIZED");

    if (caminho === "/v1/sessao") {
      const condominios = [{ id: IPE, nome: "Residencial Ipê", funcoes: [quem === "SINDICA" ? "SINDICO" : "AUTORIZADO"] }];
      if (opcoes.doisCondominios) condominios.push({ id: JATOBA, nome: "Edifício Jatobá", funcoes: ["AUTORIZADO"] });
      return route.fulfill({ json: { pessoaId: ANA, condominioAtual: estado.condominioAtual, condominios } });
    }
    if (caminho === "/v1/sessao/condominio") {
      estado.condominioAtual = String(corpo.condominioId);
      return route.fulfill({ json: { condominioAtual: estado.condominioAtual } });
    }
    if (caminho.startsWith("/v1/condominio") && !estado.condominioAtual) return erro(route, 403, "CONDOMINIO_REQUIRED");
    const contagens = /^\/v1\/condominio\/contagens\/([a-z]+)$/.exec(caminho);
    if (contagens) return contar(route, contagens[1]!, url);
    // A entrada das Configurações numa chamada só (D4.15).
    if (caminho === "/v1/condominio/configuracoes/entrada") {
      const PARTES = { configuracoes: "configuracoes", areas: "areas-comuns", manutencao: "etapas-manutencao", plano: "plano-comunicacao", whatsapp: "whatsapp/config", links: "links-qr" };
      const e: Record<string, unknown> = {};
      for (const [k, p] of Object.entries(PARTES)) e[k] = await lerPorDentro(new URL(`/api/v1/condominio/${p}`, url));
      if (!e.configuracoes) return erro(route, 403, "FORBIDDEN");
      return route.fulfill({ json: e });
    }
    // Registrar com as mensagens do WhatsApp (D4.20): a conversa é juntada na mesma chamada.
    if (caminho === "/v1/condominio/pedidos" && metodo === "POST" && corpo.mensagemId) {
      const { mensagemId, ...resto } = corpo;
      const r = await porDentro(new URL("/api/v1/condominio/pedidos", url), resto);
      if (r.status >= 300) return route.fulfill(r);
      const juntou = await lerPorDentro(new URL(`/api/v1/condominio/whatsapp/mensagens/${mensagemId}/triar`, url),
        { acao: "PEDIDO", pedidoId: r.json.id, motivo: null, contatoId: null });
      return route.fulfill({ status: r.status, json: { ...r.json, juntou: Boolean(juntou) } });
    }
    // Concluir com a foto do depois (D4.22): a conclusão já abre o envio de cada foto.
    const concluir = /^\/v1\/condominio\/manutencao\/([^/]+)\/concluir$/.exec(caminho);
    if (concluir && metodo === "POST" && Array.isArray(corpo.fotos) && corpo.fotos.length) {
      const { fotos, ...resto } = corpo;
      const r = await porDentro(new URL(caminho.replace(/^/, "/api"), url), resto);
      if (r.status >= 300) return route.fulfill(r);
      const envios = [];
      for (const f of fotos as Record<string, unknown>[]) {
        const a = await lerPorDentro(new URL(`/api/v1/condominio/manutencao/${concluir[1]}/arquivos`, url), { itemId: null, ...f });
        envios.push(a ? { nome: f.nome, ...a } : { nome: f.nome });
      }
      return route.fulfill({ status: r.status, json: { ...r.json, envios } });
    }
    // Guardar e ligar numa chamada só (D4.18): o documento primeiro, depois a ligação.
    const guardarELigar = /^\/v1\/condominio\/memoria\/prontuario\/itens\/([^/]+)\/documento$/.exec(caminho);
    if (guardarELigar && metodo === "POST") {
      const doc = await lerPorDentro(new URL("/api/v1/condominio/documentos", url), corpo.documento as Record<string, unknown>);
      if (!doc) return erro(route, 400, "VALIDATION_ERROR", { campos: ["titulo"] });
      const ligou = await lerPorDentro(new URL(`/api/v1/condominio/memoria/prontuario/itens/${guardarELigar[1]}`, url),
        { acao: "LIGAR", documentoId: doc.id, avisarDias: corpo.avisarDias, versao: corpo.versao });
      return route.fulfill({ status: 201, json: { id: doc.id, ligado: Boolean(ligou) } });
    }
    // O que vai no dossiê hoje (D4.18), com as leituras das telas, como a api-plataforma.
    if (caminho === "/v1/condominio/memoria/dossie-hoje") {
      const de = url.searchParams.get("de") ?? "";
      const ate = new Date(Date.parse(`${de}T12:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10);
      const linha = await lerPorDentro(new URL("/api/v1/condominio/memoria/linha-do-tempo?filtro=ANOTADO", url));
      const gente = await lerPorDentro(new URL("/api/v1/condominio/pessoas", url));
      const agenda = await lerPorDentro(new URL(`/api/v1/condominio/agenda?de=${de}&ate=${ate}`, url));
      return route.fulfill({ json: {
        anotacoes: linha ? Math.min((linha.eventos as unknown[]).length, 40) : null,
        acesso: gente ? (gente.pessoas as unknown[]).length : null,
        compromissos: agenda ? (agenda.compromissos as { estado: string }[]).filter((x) => !["CANCELADO", "REALIZADO"].includes(x.estado)).length : null,
      } });
    }
    // O nome do condomínio em uso, para os cartazes.
    if (caminho === "/v1/condominio" && metodo === "GET") {
      return route.fulfill({ json: { id: estado.condominioAtual, nome: estado.condominioAtual === JATOBA ? "Edifício Jatobá" : "Residencial Ipê",
        funcoes: [quem === "SINDICA" ? "SINDICO" : "AUTORIZADO"] } });
    }
    const pode = (a: string) => acoes().includes(a);
    // O mural no painel (CD-15): sem contar abertura.
    if (caminho === "/v1/condominio/mural" && metodo === "GET") {
      if (!pode("comunicados.ver")) return erro(route, 403, "FORBIDDEN");
      return route.fulfill({ json: muralNoPainelFalso(comunicados, pode, manualMural, extraMural, estado.moradores.zap) });
    }
    const nomeUnidade = (id: string | null) => {
      const u = estado.moradores.unidades.find((x) => x.id === id);
      return u ? [estado.moradores.blocos.find((b) => b.id === u.blocoId)?.nome, u.identificacao].filter(Boolean).join(" · ") : null;
    };
    const naDecisao = { pedidos: estado.pedidos, pessoas: estado.pessoas, etapas: c.etapas, unidade: nomeUnidade, eu, pode,
      categoria: (id: string) => c.categorias.find((x) => x.id === id)!.nome };

    if (caminho === "/v1/condominio/painel") {
      const nome = estado.condominioAtual === JATOBA ? "Edifício Jatobá" : "Residencial Ipê";
      return route.fulfill({ json: {
        condominio: { id: estado.condominioAtual, nome, cidade: "Brasília", uf: "DF", cenario: "PORTARIA_REMOTA" },
        pessoa: { id: ANA, nome: quem === "SINDICA" ? "Ana Souza" : quem === "SECRETARIA" ? "Bruna" : "Caio" },
        funcoes: [quem === "SINDICA" ? "SINDICO" : "AUTORIZADO"], acoes: acoes(), pendencias: pendencias(),
        ...(acoes().includes("moradores.ver") ? { moradores: resumoMoradores(estado.moradores) } : {}),
        ...(acoes().includes("pedidos.ver") ? {
          pedidos: { ...resumoPedidos(estado.pedidos, estado.config, eu.vinculo),
            vencidoMaisAntigoEscalado: escalado(estado.avisos, vencidoMaisAntigo(estado.pedidos, estado.config)?.id) },
          mesFechado: MES_FECHADO,
        } : {}),
        ...(acoes().includes("manutencao.ver") ? { manutencao: resumoManutencao(manutencao) } : {}),
        ...(acoes().includes("comunicados.ver") || acoes().includes("documentos.ver") ? { comunicados: resumoComunicados(comunicados, pode) } : {}),
        ...(acoes().includes("documentos.ver") ? { memoria: { prontuario: resumoProntuario(memoria) } } : {}),
        ...(acoes().includes("acesso_excepcional.aprovar") ? { acessosExcepcionais: resumoAcessos(suporte) } : {}),
        ...(acoes().includes("pedidos.responder") || acoes().includes("pedidos.atualizar") ? { whatsapp: resumoWhatsapp(whatsapp) } : {}),
        ...(acoes().includes("reservas.ver") || acoes().includes("enquetes.ver") || acoes().includes("assembleias.ver") || acoes().includes("classificados.ver") ? { vida: {
          ...(acoes().includes("reservas.ver") ? resumoVida(vida) : { reservasAAprovar: 0, proximasAAprovar: [] }),
          ...(acoes().includes("enquetes.ver") ? { enquetesAbertas: resumoEnquetes(enquetes) } : {}),
          ...(acoes().includes("assembleias.ver") && resumoAssembleia(assembleias) ? { assembleia: resumoAssembleia(assembleias) } : {}),
          ...(acoes().includes("classificados.ver") && classificadosAAprovar(classificados) ? { classificadosAAprovar: classificadosAAprovar(classificados) } : {}),
        } } : {}),
        ...(acoes().includes("decisoes.aprovar") ? { decisoes: resumoDecisoes(decisoes, eu.vinculo) } : {}),
        avisosNaoVistos: naoVistos(estado.avisos, eu.vinculo) + avisosDecisoes(decisoes, naDecisao).filter((a) => !a.vistoEm).length,
      } });
    }
    if (caminho === "/v1/condominio/configuracoes") {
      const substitutosPossiveis = estado.pessoas.filter((p) => p.funcao === "AUTORIZADO").map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, cargo: p.cargo }));
      return route.fulfill({ json: { ...c, avisos: { ...estado.regras, substitutosPossiveis }, parecidosDias: decisoes.dias, pendencias: pendencias(),
        podeEditar: pode("config.editar"), avisoNovo: { ...avisoRegistro.regra, podeMudar: quem === "SINDICA" },
        tecnica: { pode: false, motivo: false } } });
    }
    const ctxAviso: ContextoAviso = { eu, pessoas: estado.pessoas, responsavelPadrao: estado.responsavelPadrao, moradores: estado.moradores, manutencao,
      prioridades: c.prioridades, conectado: whatsapp.conexao.situacao === "CONECTADO", podePublicar: pode("comunicados.publicar"),
      podeManutencao: pode("manutencao.editar"), links, condominio: "Residencial Ipê", config: estado.config };
    const noAviso = await rotasAvisoRegistro(route, avisoRegistro, ctxAviso, caminho, metodo, corpo, pode, quem === "SINDICA");
    if (noAviso !== null) return noAviso;
    const prazos = await rotasPrazos(route, estado, eu, caminho, metodo, corpo, url, pode,
      (id) => vencido(estado.pedidos.find((p) => p.id === id)!, estado.config),
      { avisos: () => avisosDecisoes(decisoes, naDecisao), marcar: (ids) => marcarAvisosDecisoes(decisoes, eu.vinculo, ids) });
    if (prazos !== null) return prazos;

    const naAgenda = await rotasAgenda(route, agenda, { pessoas: estado.pessoas, pedidos: estado.pedidos, moradores: estado.moradores,
      feriados: c.feriados, eu, datasDeFora: opcoes.comDatasDeFora ?? false }, caminho, metodo, corpo, url, pode);
    if (naAgenda !== null) return naAgenda;
    const nosComunicados = await rotasComunicados(route, comunicados, { moradores: estado.moradores, pedidos: estado.pedidos, eu }, caminho, metodo, corpo, url, pode);
    if (nosComunicados !== null) return nosComunicados;
    const noSuporte = await rotasSuporte(route, suporte, caminho, metodo, corpo, pode, eu);
    if (noSuporte !== null) return noSuporte;
    const naMemoria = await rotasMemoria(route, memoria, caminho, metodo, corpo, url, pode, eu);
    if (naMemoria !== null) return naMemoria;
    const nosRelatorios = await rotasRelatorios(route, relatorios, caminho, metodo, corpo, url, pode, eu,
      () => comunicados.documentos.filter((d) => !d.restrito || pode("documentos.restritos")));
    if (nosRelatorios !== null) return nosRelatorios;
    const nasEnquetes = await rotasEnquetes(route, enquetes, caminho, metodo, corpo, pode, eu);
    if (nasEnquetes !== null) return nasEnquetes;
    const nasAssembleias = await rotasAssembleias(route, assembleias, caminho, metodo, corpo, pode, eu);
    if (nasAssembleias !== null) return nasAssembleias;
    const nosClassificados = await rotasClassificados(route, classificados, caminho, metodo, corpo, pode);
    if (nosClassificados !== null) return nosClassificados;
    const naVida = await rotasVida(route, vida, caminho, metodo, corpo, url, pode, eu);
    if (naVida !== null) return naVida;
    const nosLinks = await rotasLinks(route, links, manutencao, caminho, metodo, corpo, pode, eu);
    if (nosLinks !== null) return nosLinks;
    const naManutencao = await rotasManutencao(route, manutencao, { pessoas: estado.pessoas, pedidos: estado.pedidos, prioridades: c.prioridades, eu },
      caminho, metodo, corpo, url, pode);
    if (naManutencao !== null) return naManutencao;
    const moradores = await rotasMoradores(route, estado.moradores, caminho, metodo, corpo, pode);
    if (moradores !== null) return moradores;
    const noWhatsapp = await rotasWhatsapp(route, whatsapp, caminho, metodo, corpo, pode, eu,
      { categorias: c.categorias, prioridades: c.prioridades, sindica: quem === "SINDICA" },
      (id) => estado.pedidos.find((p) => p.id === id)?.versao ?? null);
    if (noWhatsapp !== null) return noWhatsapp;
    // Antes dos pedidos: as rotas da F7.4 dividem o prefixo /pedidos/:id.
    const nasDecisoes = await rotasDecisoes(route, decisoes, naDecisao, caminho, metodo, corpo, url);
    if (nasDecisoes !== null) return nasDecisoes;
    const pedidos = await rotasPedidos(route, estado.pedidos, c, estado.pessoas, estado.moradores, eu, caminho, metodo, corpo, url, pode, {
      registrar: (p, d) => avisarNoRegistro(avisoRegistro, ctxAviso, p, d, AGORA),
      doPedido: (id) => avisosDoPedido(avisoRegistro, ctxAviso, id),
    }, (p) => detalheDecisoes(decisoes, naDecisao, p));
    if (pedidos !== null) return pedidos;

    // Daqui em diante, mudar configuração. Fuso e etapas são ajustes da TRÍADE: só pelo Console (0283).
    if (/^\/v1\/condominio\/(fuso|etapas)(\/|$)/.test(caminho)) return erro(route, 404, "NOT_FOUND");
    const editaConfig = /^\/v1\/condominio\/(horarios|feriados|categorias|prioridades|modelos|prazos)/.test(caminho);
    if (editaConfig && !pode("config.editar")) return erro(route, 403, "FORBIDDEN");

    const h = /^\/v1\/condominio\/horarios\/(atendimento|funcionamento)$/.exec(caminho);
    if (h) {
      const alvo = c.horarios[h[1]!.toUpperCase() as "ATENDIMENTO"];
      const conflito = versaoErrada(route, alvo, corpo); if (conflito) return conflito;
      alvo.intervalos = (corpo.intervalos as typeof alvo.intervalos).sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
      alvo.versao++;
      return route.fulfill({ json: { versao: alvo.versao } });
    }
    if (caminho === "/v1/condominio/feriados") {
      if (c.feriados.some((f) => f.data === corpo.data)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "FERIADO_REPETIDO" });
      const f = { id: novoId(), data: String(corpo.data), descricao: String(corpo.descricao) };
      c.feriados = [...c.feriados, f].sort((a, b) => a.data.localeCompare(b.data));
      return route.fulfill({ status: 201, json: { id: f.id } });
    }
    const fr = /^\/v1\/condominio\/feriados\/([^/]+)\/remover$/.exec(caminho);
    if (fr) { c.feriados = c.feriados.filter((f) => f.id !== fr[1]); return route.fulfill({ json: { ok: true } }); }

    const item = /^\/v1\/condominio\/(categorias|prioridades|modelos|prazos)(?:\/([^/]+))?(\/remover)?$/.exec(caminho);
    if (item) {
      const [, tipo, id, remover] = item;
      const lista = c[tipo as "categorias"] as unknown as ({ id: string; versao: number } & Record<string, unknown>)[];
      const atual = id ? lista.find((x) => x.id === id) : undefined;
      if (id && !atual) return erro(route, 404, "NOT_FOUND");
      if (atual) { const conflito = versaoErrada(route, atual, corpo); if (conflito) return conflito; }
      if (remover) {
        c.prazos = c.prazos.filter((p) => p.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
      if ((tipo === "categorias" || tipo === "prioridades")
        && nomeRepetido(lista as never, String(corpo.nome), id)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "NOME_REPETIDO" });
      if (tipo === "prazos" && !id && c.prazos.some((p) => p.categoriaId === (corpo.categoriaId ?? null) && p.prioridadeId === (corpo.prioridadeId ?? null))) {
        return erro(route, 400, "VALIDATION_ERROR", { motivo: "PRAZO_REPETIDO" });
      }
      const dados = Object.fromEntries(Object.entries(corpo).filter(([k, v]) => k !== "versao" && v !== undefined));
      if (atual) {
        Object.assign(atual, dados, { versao: atual.versao + 1 });
        return route.fulfill({ json: { id: atual.id, versao: atual.versao } });
      }
      const novo: Record<string, unknown> = { id: novoId(), versao: 1, ativa: true, ativo: true, ...dados };
      if (tipo === "prioridades") novo.nivel = Math.max(...c.prioridades.map((p) => p.nivel)) + 1;
      lista.push(novo as never);
      return route.fulfill({ status: 201, json: { id: novo.id, versao: 1 } });
    }

    // Pessoas e quem atende: só o síndico.
    if (caminho.startsWith("/v1/condominio/pessoas") || caminho === "/v1/condominio/atendimento") {
      if (!pode("pessoas.ver")) return erro(route, 403, "FORBIDDEN");
    }
    if (caminho === "/v1/condominio/pessoas" && metodo === "GET") {
      return route.fulfill({ json: {
        pessoas: estado.pessoas, responsavelPadrao: estado.responsavelPadrao, versao: c.versao, pendencias: pendencias(),
        // As 22 do banco, como a API devolve (as que têm o que fazer em permissao_acoes).
        permissoesDisponiveis: Object.entries(PERMISSOES).map(([codigo, nome]) => ({ codigo, nome, descricao: nome })),
      } });
    }
    if (caminho === "/v1/condominio/pessoas" && metodo === "POST") {
      if (estado.pessoas.some((p) => p.nome === corpo.nome)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "JA_TEM_ACESSO" });
      estado.convites.push(String(corpo.email));
      estado.pessoas.push({ vinculoId: novoId(), pessoaId: novoId(), nome: String(corpo.nome), funcao: "AUTORIZADO", cargo: (corpo.cargo as string) || null,
        permissoes: corpo.permissoes as string[], desde: "2026-10-16T15:00:00Z", versao: 1, responsavel: false, disponivel: false });
      return route.fulfill({ status: 201, json: { vinculoId: "x", contaNova: true } });
    }
    const pv = /^\/v1\/condominio\/pessoas\/([^/]+)(\/revogar)?$/.exec(caminho);
    if (pv) {
      const p = estado.pessoas.find((x) => x.vinculoId === pv[1]);
      if (!p || p.funcao !== "AUTORIZADO") return erro(route, 404, "NOT_FOUND");
      const conflito = versaoErrada(route, p, corpo); if (conflito) return conflito;
      if (pv[2]) {
        if (estado.responsavelPadrao === p.vinculoId) {
          if (!corpo.substitutoId && !corpo.deixarPendente) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SUBSTITUTO_NECESSARIO" });
          estado.responsavelPadrao = (corpo.substitutoId as string) ?? null;
        }
        estado.pessoas = estado.pessoas.filter((x) => x !== p);
        return route.fulfill({ json: { ok: true } });
      }
      p.cargo = (corpo.cargo as string) || null; p.permissoes = corpo.permissoes as string[]; p.versao++;
      return route.fulfill({ json: { versao: p.versao } });
    }
    if (caminho === "/v1/condominio/atendimento") {
      const conflito = versaoErrada(route, c, corpo); if (conflito) return conflito;
      const lista = corpo.responsaveis as { vinculoId: string; disponivel: boolean }[];
      if (lista.length && !corpo.padraoId) return erro(route, 400, "VALIDATION_ERROR", { motivo: "PADRAO_NECESSARIO" });
      for (const p of estado.pessoas) {
        const r = lista.find((x) => x.vinculoId === p.vinculoId);
        p.responsavel = !!r; p.disponivel = r?.disponivel ?? false;
      }
      estado.responsavelPadrao = (corpo.padraoId as string) ?? null;
      c.versao++;
      return route.fulfill({ json: { versao: c.versao } });
    }
    return erro(route, 404, "NOT_FOUND");
  }
  await page.route("**/api/v1/**", atender);
  return Object.assign(estado, { links, memoria, suporte, vida, whatsapp, avisoRegistro, decisoes, relatorios });
}
