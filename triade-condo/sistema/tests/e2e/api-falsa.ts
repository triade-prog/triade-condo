// API do Console falsa, dentro do navegador (page.route): as telas do passo 1 rodam sem
// Supabase. As regras de verdade estão testadas no banco (pgTAP) e na API (Deno); aqui se
// confere a tela: fluxo, textos, permissões que ela respeita e acessibilidade.
import type { Page, Route } from "@playwright/test";
import { criarSuporteConsole, rotasSuporteConsole } from "./api-falsa-console-suporte";
import { criarPlanosConsole, rotasPlanosConsole } from "./api-falsa-console-planos";
import { criarPrecosConsole, rotasPrecosConsole } from "./api-falsa-console-precos";
import { criarRetencaoConsole, rotasRetencaoConsole } from "./api-falsa-console-retencao";
import { criarComercialConsole, rotasComercialConsole, rotasPublicasPropostas } from "./api-falsa-console-comercial";
import { rotasPublicasAgenda } from "./api-falsa-console-parceiros";
import { rotasArquivoComercial, rotasPublicasContrato } from "./api-falsa-console-contrato";
import { andamentoConfiguracao, criarConfiguracaoConsole, rotasConfiguracaoConsole } from "./api-falsa-console-configuracao";

export const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
export const NOVO = "3e0f6c31-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const INES = "1c8d4a1f-6e2b-4d3c-8f9a-2b3c4d5e6f7a";

const TODAS = [
  "console.carteira.ver", "console.ficha.ver", "console.ficha.editar", "console.contrato.editar", "console.estagio.mudar",
  "console.sindicos.convidar", "console.notas.ver", "console.notas.escrever", "console.historico.ver", "console.equipe.atribuir",
  "console.implantacao.ver", "console.implantacao.editar", "console.troca.fazer", "console.suporte.acesso", "console.casos_duvidosos",
  "console.chamados.ver", "console.chamados.responder", "console.acesso_excepcional.pedir", "console.whatsapp.ver", "console.whatsapp.conectar",
  "console.conjuntos.liberar", "console.pagamentos.ver", "console.pagamentos.registrar", "console.pagamentos.conferir", "console.pagamentos.ajustar",
];
const IMPLANTACAO = TODAS.filter((a) => !a.startsWith("console.pagamentos.") && !["console.contrato.editar", "console.equipe.atribuir", "console.suporte.acesso", "console.casos_duvidosos",
  "console.acesso_excepcional.pedir"].includes(a));

export interface Opcoes {
  logado?: boolean;
  /** COMERCIAL: a Bianca, que vê e mexe no Comercial, mas não aprova desconto nem muda modelos. */
  funcao?: "ADMINISTRACAO" | "IMPLANTACAO" | "COMERCIAL";
  /** Etapa que a senha devolve: primeiro acesso (cadastrar autenticador) ou código. */
  etapaSenha?: "CADASTRAR_AUTENTICADOR" | "CODIGO";
  /** Tabela de preços (0295): a Administração edita; "ver" tira a ação de editar; Implantação não vê. */
  precos?: "editar" | "ver";
  /** Comercial (0309): nada pede atenção, e o cartão Comercial some do Início. */
  comercialSemAtencao?: boolean;
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export async function instalarApiFalsa(page: Page, opcoes: Opcoes = {}) {
  const admin = (opcoes.funcao ?? "ADMINISTRACAO") === "ADMINISTRACAO";
  const comercialSo = opcoes.funcao === "COMERCIAL";
  const podeComercial = { ver: admin || comercialSo, editar: admin || comercialSo, desconto: admin, modelos: admin, cliente: admin, assinar: admin, meta: admin, comissao: admin };
  const podePrecos = { ver: admin, editar: admin && (opcoes.precos ?? "editar") === "editar" };
  const acoesPrecos = [...(podePrecos.ver ? ["console.precos.ver"] : []), ...(podePrecos.editar ? ["console.precos.editar"] : [])];
  const estado = {
    logado: opcoes.logado ?? true,
    senhasCriadas: 0,
    clientes: [
      {
        condominio: {
          id: IPE, nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", endereco: "SQS 308 bloco C", numeroWhatsapp: "+5561999990001",
          contatos: [{ nome: "Ana Souza", papel: "Síndica", telefone: "+5561988880000" }], cenario: "SEM_PORTARIA", versao: 3,
          criadoEm: "2026-10-16T13:00:00Z",
        },
        cliente: { estagio: "IMPLANTACAO", referenciaContrato: null as string | null, versao: 1 },
        sindicos: [] as { vinculoId: string; pessoaId: string; nome: string; desde: string; versao?: number }[],
        equipe: [{ vinculoId: "4f1a7d42-9b5e-4a6f-9c2d-5e6f7a8b9c0d", pessoaId: CAROLINA, nome: "Carolina", funcao: "ADMINISTRACAO", desde: "2026-10-16T13:00:00Z", versao: 1 }],
        notas: [] as { id: string; texto: string; criadoEm: string; autor: { id: string; nome: string } }[],
        whatsapp: {
          conexao: { situacao: "SEM_CREDENCIAIS", provedor: "WAFLY", oficial: false, termoAceitoEm: "2026-10-18T16:40:00Z", termoAceitoPor: "Ana Souza" } as Record<string, unknown>,
          historico: [] as { acao: string; em: string; autor: string | null; dados: Record<string, string> }[],
        },
      },
    ],
  };
  const suporte = criarSuporteConsole();
  const configuracao = criarConfiguracaoConsole();
  const planos = criarPlanosConsole(IPE, "Residencial Ipê");
  const precos = criarPrecosConsole();
  const retencao = criarRetencaoConsole();
  const comercial = criarComercialConsole();
  comercial.painel.semAtencao = opcoes.comercialSemAtencao ?? false;
  // Modelos de mensagem (F5.4, W-20): globais, com versão e situação.
  const MODELOS_V1: [string, string, string, string, string[], string, string | null][] = [
    ["noticia_pedido", "Notícia do pedido", "MORADOR", "Retorno escrito no pedido, com a conversa fechada", ["protocolo", "condomínio", "texto do retorno", "quem escreveu"],
     "Notícia do seu pedido {{1}} no {{2}}:\n\n{{3}}\n\n{{4}}, do condomínio\n\nPara responder, é só mandar mensagem aqui.", "Para não receber mais avisos, responda PARAR."],
    ["pedido_concluido", "Pedido concluído", "MORADOR", "Conclusão de pedido que nasceu no WhatsApp", ["protocolo", "condomínio", "o que foi feito", "quem concluiu", "revisar até"],
     "O pedido {{1}} no {{2}} foi concluído.\nO que foi feito: {{3}}\n\n{{4}}, do condomínio\n\nSe não resolveu, responda REVISAR e conte o que continua acontecendo, até {{5}}.",
     "Para não receber mais avisos, responda PARAR."],
    ["revisao_respondida", "Revisão respondida", "MORADOR", "Pedido mantido concluído, com a conversa fechada", ["protocolo", "condomínio", "resposta", "quem respondeu"],
     "Resposta ao seu pedido de revisão do {{1}} no {{2}}:\n\n{{3}}\n\n{{4}}, do condomínio\n\nPara responder, é só mandar mensagem aqui.", "Para não receber mais avisos, responda PARAR."],
    ["aviso_pedido_novo", "Pedido novo", "EQUIPE", "Aviso que a pessoa ligou", ["condomínio", "protocolo", "assunto e unidade", "link do painel"],
     "Pedido novo no {{1}}.\n{{2}} · {{3}}\n\nAbrir no painel: {{4}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.", null],
    ["aviso_retorno_vencido", "Retorno vencido", "EQUIPE", "Aviso que a pessoa ligou", ["condomínio", "protocolo", "assunto e unidade", "quando venceu", "responsável", "link do painel"],
     "Retorno vencido no {{1}}.\n{{2}} · {{3}}\nVenceu {{4}} · responsável: {{5}}\n\nAbrir no painel: {{6}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.", null],
    ["aviso_revisao", "Pedido de revisão", "EQUIPE", "Aviso que a pessoa ligou", ["condomínio", "protocolo", "assunto e unidade", "link do painel"],
     "Pedido de revisão no {{1}}.\n{{2}} · {{3}}\n\nAbrir no painel: {{4}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.", null],
  ];
  type ModeloFalso = { chave: string; numero: number; titulo: string; para: string; uso: string; variaveis: string[]; corpo: string; rodape?: string;
                       situacao: string; motivo?: string; criadoEm: string; versao: number };
  const modelos: ModeloFalso[] = MODELOS_V1.map(([chave, titulo, para, uso, variaveis, corpo, rodape]) => ({
    chave, titulo, para, uso, variaveis, corpo, ...(rodape ? { rodape } : {}), numero: 1, situacao: "APROVADO_PILOTO", criadoEm: "2026-10-19T03:00:00Z", versao: 1,
  }));
  const eventosModelo: { chave: string; numero: number; situacao: string; motivo?: string; em: string; por?: string }[] =
    modelos.map((m) => ({ chave: m.chave, numero: 1, situacao: "APROVADO_PILOTO", motivo: "Aprovado com o desenho dos textos em 19/10/2026", em: "2026-10-19T03:00:00Z" }));
  const PROXIMAS: Record<string, string[]> = { RASCUNHO: ["APROVADO_PILOTO", "ENVIADO"], APROVADO_PILOTO: ["ENVIADO", "DESATIVADO"], ENVIADO: ["APROVADO", "RECUSADO"],
    APROVADO: ["PAUSADO", "DESATIVADO"], PAUSADO: ["APROVADO", "DESATIVADO"], RECUSADO: [], DESATIVADO: [] };
  const emUso = (chave: string) => modelos.filter((m) => m.chave === chave && ["APROVADO", "APROVADO_PILOTO"].includes(m.situacao)).at(-1)?.numero;
  function rotaModelos(route: Route, resto: string, metodo: string, corpo: Record<string, unknown>) {
    if (resto === "") {
      const chaves = [...new Set(modelos.map((m) => m.chave))];
      return route.fulfill({ json: { modelos: chaves.map((ch) => ({ ...modelos.filter((m) => m.chave === ch).at(-1), emUsoPiloto: emUso(ch) })), pode: { editar: admin } } });
    }
    const m = /^\/([a-z_]+)(?:\/versoes(?:\/(\d+))?(\/situacao)?)?$/.exec(resto);
    const versoes = m ? modelos.filter((x) => x.chave === m[1]) : [];
    if (!m || !versoes.length) return erro(route, 404, "NOT_FOUND");
    const ultima = versoes.at(-1)!;
    if (metodo === "GET") {
      return route.fulfill({ json: { versoes: [...versoes].reverse(), eventos: eventosModelo.filter((e) => e.chave === m[1]).reverse(), emUsoPiloto: emUso(m[1]!),
        pode: { editar: admin } } });
    }
    if (!admin) return erro(route, 403, "FORBIDDEN");
    const n = ultima.variaveis.length;
    const valido = (c: string) => c.length >= 20 && !/^\s*\{\{/.test(c) && !/\}\}\s*$/.test(c)
      && new Set([...c.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1]))).size === n;
    if (!m[3]) {
      const c = String(corpo.corpo ?? "").trim();
      if (!valido(c)) return erro(route, 400, "VALIDATION_ERROR", { campos: ["corpo"] });
      if (!m[2]) {
        if (versoes.some((v) => ["RASCUNHO", "ENVIADO"].includes(v.situacao))) return erro(route, 400, "VALIDATION_ERROR", { motivo: "MODELO_PENDENTE" });
        modelos.push({ ...ultima, numero: ultima.numero + 1, corpo: c, situacao: "RASCUNHO", motivo: undefined, versao: 1, criadoEm: new Date().toISOString() });
        eventosModelo.push({ chave: ultima.chave, numero: ultima.numero + 1, situacao: "RASCUNHO", em: new Date().toISOString(), por: "Carolina" });
        return route.fulfill({ status: 201, json: { numero: ultima.numero + 1, versao: 1 } });
      }
      const v = versoes.find((x) => x.numero === Number(m[2]));
      if (!v || v.situacao !== "RASCUNHO") return erro(route, 400, "VALIDATION_ERROR", { motivo: "MODELO_FECHADO" });
      Object.assign(v, { corpo: c, versao: v.versao + 1 });
      return route.fulfill({ json: { numero: v.numero, versao: v.versao } });
    }
    const v = versoes.find((x) => x.numero === Number(m[2]))!;
    const s = String(corpo.situacao);
    if (["RECUSADO", "PAUSADO"].includes(s) && String(corpo.motivo ?? "").trim().length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
    if (!PROXIMAS[v.situacao]!.includes(s)) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SITUACAO_MODELO" });
    Object.assign(v, { situacao: s, versao: v.versao + 1, ...(corpo.motivo ? { motivo: corpo.motivo } : {}) });
    eventosModelo.push({ chave: v.chave, numero: v.numero, situacao: s, ...(corpo.motivo ? { motivo: String(corpo.motivo) } : {}), em: new Date().toISOString(), por: "Carolina" });
    return route.fulfill({ json: { situacao: s, versao: v.versao } });
  }
  // Aba WhatsApp da ficha (passo 5; W-01): credenciais, conectar pelo QR ou código, conferir e desconectar.
  const QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==";
  function rotaWhatsapp(route: Route, c: (typeof estado.clientes)[number], resto: string, corpo: Record<string, unknown>) {
    const w = c.whatsapp;
    const marcar = (acao: string, dados: Record<string, string> = {}) => w.historico.unshift({ acao, em: new Date().toISOString(), autor: "Carolina", dados });
    const contar = () => { suporte.whatsappDesconectados = estado.clientes.filter((x) => x.whatsapp.conexao.situacao === "DESCONECTADO").length; };
    if (resto === "/whatsapp") {
      return route.fulfill({ json: { numeroFicha: c.condominio.numeroWhatsapp ?? null, conexao: w.conexao, historico: w.historico, pode: { conectar: true } } });
    }
    if (resto === "/whatsapp/credenciais") {
      if (!/^[A-Za-z0-9_-]{3,100}$/.test(String(corpo.instancia ?? ""))) return erro(route, 400, "VALIDATION_ERROR", { campos: ["instancia"] });
      if (String(corpo.token ?? "").length < 8) return erro(route, 400, "VALIDATION_ERROR", { campos: ["token"] });
      const versao = Number(w.conexao.versao ?? 0) + 1;
      Object.assign(w.conexao, { situacao: "DESCONECTADO", desconectadoEm: new Date().toISOString(), versao });
      marcar("whatsapp.credenciais");
      contar();
      return route.fulfill({ json: { versao, avisos: true } });
    }
    if (resto === "/whatsapp/conectar") {
      w.conexao.situacao = "CONECTANDO";
      contar();
      return route.fulfill({ json: corpo.modo === "CODIGO" ? { codigo: "ABCD-1234" } : { qr: QR } });
    }
    if (resto === "/whatsapp/verificar") {
      Object.assign(w.conexao, { situacao: "CONECTADO", aparelho: c.condominio.numeroWhatsapp, conectadoEm: new Date().toISOString() });
      marcar("whatsapp.conectado");
      contar();
      return route.fulfill({ json: { situacao: "CONECTADO" } });
    }
    if (resto === "/whatsapp/desconectar") {
      const motivo = String(corpo.motivo ?? "").trim();
      if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(w.conexao, { situacao: "DESCONECTADO", aparelho: undefined, desconectadoEm: new Date().toISOString() });
      marcar("whatsapp.desconectado", { motivo });
      contar();
      return route.fulfill({ json: { situacao: "DESCONECTADO" } });
    }
    return erro(route, 404, "NOT_FOUND");
  }
  const situacoes = (c: (typeof estado.clientes)[number]) => [
    ...(c.sindicos.length ? [] : ["SEM_SINDICO"]),
    ...(c.condominio.cenario ? [] : ["SEM_CENARIO"]),
    ...(c.condominio.numeroWhatsapp ? [] : ["SEM_NUMERO_WHATSAPP"]),
    ...(c.condominio.contatos.length ? [] : ["SEM_CONTATO"]),
    ...(c.cliente.referenciaContrato ? [] : ["SEM_CONTRATO"]),
  ];
  const ficha = (c: (typeof estado.clientes)[number]) => ({
    condominio: c.condominio, cliente: c.cliente, sindicos: c.sindicos, equipe: c.equipe,
    situacoes: situacoes(c), permissoes: admin ? TODAS : IMPLANTACAO,
  });

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace(/^\/api/, "");
    const metodo = req.method();
    // O "armazenamento" do Comercial (0308) recebe o PDF em binário: atende antes de ler o corpo como JSON.
    const arquivo = await rotasArquivoComercial(route, comercial, caminho, metodo);
    if (arquivo !== null) return arquivo;
    const corpo = req.postData() ? JSON.parse(req.postData()!) : {};

    if (caminho === "/v1/auth/entrar") {
      if (corpo.senha !== "senha-certa-da-equipe") return erro(route, 401, "INVALID_CREDENTIALS");
      return route.fulfill({ json: { etapa: opcoes.etapaSenha ?? "CODIGO" } });
    }
    if (caminho === "/v1/auth/autenticador/cadastrar") {
      return route.fulfill({ json: { factorId: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d", qrCode: "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10'/></svg>", segredo: "JBSWY3DPEHPK3PXP" } });
    }
    if (caminho === "/v1/auth/autenticador/verificar") {
      if (corpo.codigo !== "123456") return erro(route, 422, "MFA_INVALID");
      estado.logado = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (caminho === "/v1/auth/sair") {
      estado.logado = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (caminho === "/v1/auth/recuperar") {
      return route.fulfill({ json: { mensagem: "Se este e-mail tiver acesso à TRÍADE Condo, enviamos um link para criar uma senha nova." } });
    }
    if (caminho === "/v1/auth/criar-senha" || caminho === "/v1/auth/redefinir") {
      if (corpo.tokenHash !== "token-de-convite-valido-123" && corpo.accessToken !== "aaa.bbb.ccc") return erro(route, 410, "TOKEN_INVALID");
      estado.senhasCriadas++;
      return route.fulfill({ json: { ok: true } });
    }

    // O link da proposta (0304) abre sem sessão.
    const publico = await rotasPublicasPropostas(route, comercial, caminho, metodo, corpo);
    if (publico !== null) return publico;
    const publicoContrato = await rotasPublicasContrato(route, comercial, caminho, metodo, corpo);
    if (publicoContrato !== null) return publicoContrato;
    // O link de agendamento (0310) também abre sem sessão.
    const publicoAgenda = await rotasPublicasAgenda(route, comercial, caminho, metodo, corpo);
    if (publicoAgenda !== null) return publicoAgenda;

    if (!estado.logado) return erro(route, 401, "UNAUTHORIZED");

    if (caminho === "/v1/sessao") {
      return route.fulfill({
        json: admin
          ? { pessoaId: CAROLINA, nome: "Carolina", funcoes: ["ADMINISTRACAO"], acoes: ["console.condominios.criar", "console.equipe.gerenciar", "console.historico.equipe", "console.pagamentos.ver", "console.pagamentos.registrar", ...acoesPrecos,
              "console.retencao.ver", "console.retencao.ligar", "console.comercial.ver", "console.comercial.editar", "console.comercial.desconto", "console.comercial.modelos",
              "console.comercial.exportar", "console.comercial.excluir", "console.comercial.cliente", "console.comercial.assinar", "console.comercial.meta",
              "console.comercial.comissao"] }
          : comercialSo ? { pessoaId: "2d9e5b20-0000-4000-8000-00000000bb01", nome: "Bianca", funcoes: ["COMERCIAL"], acoes: ["console.comercial.ver", "console.comercial.editar"] }
          : { pessoaId: INES, nome: "Inês", funcoes: ["IMPLANTACAO"], acoes: [] },
      });
    }
    if (caminho === "/v1/clientes" && metodo === "GET") {
      return route.fulfill({
        json: {
          clientes: estado.clientes.map((c) => ({
            id: c.condominio.id, nome: c.condominio.nome, cidade: c.condominio.cidade, uf: c.condominio.uf, estagio: c.cliente.estagio,
            cenario: c.condominio.cenario, funcoes: [admin ? "ADMINISTRACAO" : "IMPLANTACAO"], situacoes: situacoes(c), criadoEm: c.condominio.criadoEm,
          })),
        },
      });
    }
    if (caminho === "/v1/clientes" && metodo === "POST") {
      if (!corpo.uf) return erro(route, 400, "VALIDATION_ERROR", { campos: ["uf"] });
      estado.clientes.push({
        condominio: { id: NOVO, nome: corpo.nome, cidade: corpo.cidade, uf: corpo.uf, endereco: null as unknown as string, numeroWhatsapp: null as unknown as string,
          contatos: [], cenario: corpo.cenario, versao: 1, criadoEm: "2026-10-16T15:00:00Z" },
        cliente: { estagio: "IMPLANTACAO", referenciaContrato: null, versao: 1 },
        sindicos: [], equipe: [{ ...estado.clientes[0]!.equipe[0]! }], notas: [],
        whatsapp: { conexao: { situacao: "SEM_CREDENCIAIS" }, historico: [] },
      });
      return route.fulfill({ status: 201, json: { id: NOVO } });
    }

    const m = /^\/v1\/clientes\/([0-9a-f-]{36})(\/.*)?$/.exec(caminho);
    const c = m ? estado.clientes.find((x) => x.condominio.id === m[1]) : undefined;
    if (m && !c) return erro(route, 403, "FORBIDDEN");
    if (c) {
      const resto = m![2] ?? "";
      if (resto === "") return route.fulfill({ json: ficha(c) });
      if (resto === "/ficha") {
        if (corpo.versao !== c.condominio.versao) {
          return erro(route, 409, "VERSION_CONFLICT", { versao: c.condominio.versao, atual: c.condominio });
        }
        Object.assign(c.condominio, {
          nome: corpo.nome, cidade: corpo.cidade, uf: corpo.uf, endereco: corpo.endereco || null,
          numeroWhatsapp: corpo.numeroWhatsapp ? `+55${String(corpo.numeroWhatsapp).replace(/\D/g, "").replace(/^55/, "")}` : null,
          contatos: corpo.contatos, versao: c.condominio.versao + 1,
        });
        return route.fulfill({ json: { versao: c.condominio.versao } });
      }
      if (resto === "/cenario") {
        c.condominio.cenario = corpo.cenario;
        c.condominio.versao++;
        return route.fulfill({ json: { versao: c.condominio.versao } });
      }
      if (resto === "/contrato") {
        if (!admin) return erro(route, 403, "FORBIDDEN");
        c.cliente.referenciaContrato = corpo.referenciaContrato;
        c.cliente.versao++;
        return route.fulfill({ json: { versao: c.cliente.versao } });
      }
      if (resto === "/estagio") {
        if (!c.sindicos.length) return erro(route, 400, "VALIDATION_ERROR", { motivo: "SEM_SINDICO" });
        c.cliente.estagio = corpo.estagio;
        c.cliente.versao++;
        return route.fulfill({ json: { versao: c.cliente.versao } });
      }
      if (resto === "/sindicos") {
        c.sindicos.push({ vinculoId: "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e", pessoaId: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f", nome: corpo.nome, desde: "2026-10-16T16:00:00Z", versao: 1 });
        return route.fulfill({ status: 201, json: { vinculoId: "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e", contaNova: true } });
      }
      if (resto === "/notas" && metodo === "GET") return route.fulfill({ json: { notas: c.notas } });
      if (resto === "/notas" && metodo === "POST") {
        c.notas.unshift({ id: crypto.randomUUID(), texto: corpo.texto, criadoEm: "2026-10-16T17:05:00Z", autor: { id: CAROLINA, nome: "Carolina" } });
        return route.fulfill({ status: 201, json: { id: c.notas[0]!.id } });
      }
      if (resto === "/historico") {
        return route.fulfill({
          json: {
            eventos: [
              { id: 3, ocorridoEm: "2026-10-16T17:05:00Z", autor: { id: INES, nome: "Inês" }, acao: "ficha.alterada", entidade: "condominio", dados: { campos: ["endereco", "numeroWhatsapp"] }, interno: false },
              { id: 2, ocorridoEm: "2026-10-16T13:12:00Z", autor: { id: CAROLINA, nome: "Carolina" }, acao: "contrato.alterado", entidade: "cliente", dados: {}, interno: true },
              { id: 1, ocorridoEm: "2026-10-16T13:00:00Z", autor: { id: CAROLINA, nome: "Carolina" }, acao: "condominio.cadastrado", entidade: "condominio", dados: { cenario: "SEM_PORTARIA" }, interno: false },
            ],
          },
        });
      }
      if (resto === "/equipe") return route.fulfill({ status: 201, json: { vinculoId: crypto.randomUUID() } });
      if (resto.startsWith("/whatsapp")) return rotaWhatsapp(route, c, resto, corpo);
    }
    if (caminho.startsWith("/v1/whatsapp/modelos")) return rotaModelos(route, caminho.slice("/v1/whatsapp/modelos".length), metodo, corpo);
    if (caminho === "/v1/whatsapp") {
      return route.fulfill({ json: { numeros: estado.clientes.map((x) => ({ condominioId: x.condominio.id, nome: x.condominio.nome,
        numero: x.condominio.numeroWhatsapp ?? undefined, situacao: x.whatsapp.conexao.situacao, oficial: false,
        desde: x.whatsapp.conexao.conectadoEm ?? x.whatsapp.conexao.desconectadoEm, termo: !!x.whatsapp.conexao.termoAceitoEm })) } });
    }
    if (caminho === "/v1/equipe" && metodo === "GET") {
      if (!admin) return erro(route, 403, "FORBIDDEN");
      return route.fulfill({
        json: {
          pessoas: [
            { id: CAROLINA, nome: "Carolina", ativa: true, funcoes: ["ADMINISTRACAO"], desde: "2026-10-16T12:00:00Z" },
            { id: INES, nome: "Inês", ativa: true, funcoes: ["IMPLANTACAO"], desde: "2026-10-16T12:30:00Z" },
          ],
        },
      });
    }
    if (caminho === "/v1/equipe" && metodo === "POST") return route.fulfill({ status: 201, json: { pessoaId: crypto.randomUUID(), contaNova: true } });
    if (caminho === "/v1/equipe/historico") {
      return route.fulfill({ json: { eventos: [{ id: 9, ocorridoEm: "2026-10-16T12:30:00Z", autor: { id: CAROLINA, nome: "Carolina" }, acao: "equipe.membro_cadastrado", entidade: "pessoa", dados: { funcoes: ["IMPLANTACAO"] },
        alvo: { id: INES, nome: "Inês" } }] } });
    }
    const r8 = await rotasComercialConsole(route, comercial, caminho, metodo, corpo, podeComercial, url);
    if (r8 !== null) return r8;
    const r7 = await rotasRetencaoConsole(route, retencao, caminho, metodo, corpo, admin);
    if (r7 !== null) return r7;
    const r6 = await rotasPrecosConsole(route, precos, caminho, metodo, corpo, url, podePrecos);
    if (r6 !== null) return r6;
    const r5 = await rotasPlanosConsole(route, planos, caminho, metodo, corpo, admin);
    if (r5 !== null) return r5;
    if (c && caminho.startsWith(`/v1/clientes/${c.condominio.id}/`)) {
      const naConfiguracao = await rotasConfiguracaoConsole(route, configuracao, caminho.slice(`/v1/clientes/${c.condominio.id}`.length), metodo, corpo,
        { estagio: () => c.cliente.estagio, equipe: admin ? "Carolina" : "Inês" });
      if (naConfiguracao !== null) return naConfiguracao;
    }
    // A lista de implantações (D4.28) também mostra as partes conferidas do Ipê.
    const ci = c ?? (caminho === "/v1/implantacoes" ? estado.clientes.find((x) => x.condominio.id === suporte.suporte.condominioId) : undefined);
    const r4 = await rotasSuporteConsole(route, suporte, caminho, metodo, corpo, ci ? {
      id: ci.condominio.id, nome: ci.condominio.nome, sindicos: ci.sindicos, estagio: () => ci.cliente.estagio,
      ativar: () => { ci.cliente.estagio = "ATIVO"; }, configuracao: () => andamentoConfiguracao(configuracao),
    } : undefined, url);
    if (r4 !== null) return r4;
    return erro(route, 404, "NOT_FOUND");
  });
  return Object.assign(estado, { suporte, modelos, configuracao, planos, precos, retencao, comercial });
}
