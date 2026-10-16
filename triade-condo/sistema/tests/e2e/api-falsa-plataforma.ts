// API da Plataforma falsa, dentro do navegador (page.route): as telas dos passos 2, 3 e 4 rodam
// sem Supabase. As regras de verdade estão testadas no banco (pgTAP 008, 009 e 010) e na API
// (Deno); aqui se confere a tela: fluxo, textos, o que cada pessoa vê e acessibilidade.
import type { Page, Route } from "@playwright/test";
import { criarMoradores, resumoMoradores, rotasMoradores } from "./api-falsa-moradores";
import { criarPedidos, resumoPedidos, rotasPedidos } from "./api-falsa-pedidos";

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
  /** A síndica e a secretária já atendem os pedidos (passo 4). */
  comAtendimento?: boolean;
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
  };
  estado.pedidos = criarPedidos(estado.config, V_ANA, V_BRUNA);
  if (opcoes.comAtendimento) {
    for (const p of estado.pessoas) { p.responsavel = true; p.disponivel = true; }
    estado.responsavelPadrao = V_ANA;
  }
  const eu = quem === "SINDICA" ? { vinculo: V_ANA, nome: "Ana Souza" } : quem === "SECRETARIA" ? { vinculo: V_BRUNA, nome: "Bruna" } : { vinculo: "caio", nome: "Caio" };

  const acoes = () => quem === "SINDICA"
    ? ["atendimento.responsaveis", "config.editar", "config.ver", "moradores.confirmar", "moradores.editar", "moradores.ver", "pedidos.atualizar", "pedidos.concluir",
      "pedidos.responder", "pedidos.revisar", "pedidos.ver", "pessoas.autorizar", "pessoas.ver", "plataforma.painel.ver"]
    : quem === "SECRETARIA" ? ["config.editar", "config.ver", "moradores.editar", "moradores.ver", "pedidos.responder", "pedidos.ver", "plataforma.painel.ver"]
      : ["config.ver", "pedidos.ver", "plataforma.painel.ver"];
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

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace(/^\/api/, "");
    const metodo = req.method();
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
    const pode = (a: string) => acoes().includes(a);

    if (caminho === "/v1/condominio/painel") {
      const nome = estado.condominioAtual === JATOBA ? "Edifício Jatobá" : "Residencial Ipê";
      return route.fulfill({ json: {
        condominio: { id: estado.condominioAtual, nome, cidade: "Brasília", uf: "DF", cenario: "PORTARIA_REMOTA" },
        pessoa: { id: ANA, nome: quem === "SINDICA" ? "Ana Souza" : quem === "SECRETARIA" ? "Bruna" : "Caio" },
        funcoes: [quem === "SINDICA" ? "SINDICO" : "AUTORIZADO"], acoes: acoes(), pendencias: pendencias(),
        ...(acoes().includes("moradores.ver") ? { moradores: resumoMoradores(estado.moradores) } : {}),
        ...(acoes().includes("pedidos.ver") ? { pedidos: resumoPedidos(estado.pedidos, estado.config, eu.vinculo) } : {}),
      } });
    }
    if (caminho === "/v1/condominio/configuracoes") return route.fulfill({ json: { ...c, pendencias: pendencias(), podeEditar: pode("config.editar") } });

    const moradores = await rotasMoradores(route, estado.moradores, caminho, metodo, corpo, pode);
    if (moradores !== null) return moradores;
    const pedidos = await rotasPedidos(route, estado.pedidos, c, estado.pessoas, estado.moradores, eu, caminho, metodo, corpo, url, pode);
    if (pedidos !== null) return pedidos;

    // Daqui em diante, mudar configuração.
    const editaConfig = /^\/v1\/condominio\/(fuso|horarios|feriados|categorias|prioridades|etapas|modelos|prazos)/.test(caminho);
    if (editaConfig && !pode("config.editar")) return erro(route, 403, "FORBIDDEN");

    if (caminho === "/v1/condominio/fuso") {
      const conflito = versaoErrada(route, c, corpo); if (conflito) return conflito;
      c.fuso = String(corpo.fuso); c.versao++;
      return route.fulfill({ json: { versao: c.versao } });
    }
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

    const item = /^\/v1\/condominio\/(categorias|prioridades|etapas|modelos|prazos)(?:\/([^/]+))?(\/remover)?$/.exec(caminho);
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
      if ((tipo === "categorias" || tipo === "prioridades" || tipo === "etapas")
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
      if (tipo === "etapas") novo.ordem = 9;
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
        permissoesDisponiveis: [
          { codigo: "CONFIGURAR", nome: "Configurar", descricao: "Mudar horários, feriados, categorias, prioridades, etapas, modelos de resposta e prazos." },
          { codigo: "CADASTRAR", nome: "Cadastrar moradores", descricao: "Incluir e corrigir unidades e contatos. O que a pessoa inclui fica a confirmar pelo síndico." },
        ],
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
  });
  return estado;
}
