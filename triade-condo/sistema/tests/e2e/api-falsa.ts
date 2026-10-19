// API do Console falsa, dentro do navegador (page.route): as telas do passo 1 rodam sem
// Supabase. As regras de verdade estão testadas no banco (pgTAP) e na API (Deno); aqui se
// confere a tela: fluxo, textos, permissões que ela respeita e acessibilidade.
import type { Page, Route } from "@playwright/test";
import { criarSuporteConsole, rotasSuporteConsole } from "./api-falsa-console-suporte";

export const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
export const NOVO = "3e0f6c31-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const INES = "1c8d4a1f-6e2b-4d3c-8f9a-2b3c4d5e6f7a";

const TODAS = [
  "console.carteira.ver", "console.ficha.ver", "console.ficha.editar", "console.contrato.editar", "console.estagio.mudar",
  "console.sindicos.convidar", "console.notas.ver", "console.notas.escrever", "console.historico.ver", "console.equipe.atribuir",
  "console.implantacao.ver", "console.implantacao.editar", "console.troca.fazer", "console.suporte.acesso", "console.casos_duvidosos",
  "console.chamados.ver", "console.chamados.responder", "console.acesso_excepcional.pedir", "console.whatsapp.ver", "console.whatsapp.conectar",
];
const IMPLANTACAO = TODAS.filter((a) => !["console.contrato.editar", "console.equipe.atribuir", "console.suporte.acesso", "console.casos_duvidosos",
  "console.acesso_excepcional.pedir"].includes(a));

export interface Opcoes {
  logado?: boolean;
  funcao?: "ADMINISTRACAO" | "IMPLANTACAO";
  /** Etapa que a senha devolve: primeiro acesso (cadastrar autenticador) ou código. */
  etapaSenha?: "CADASTRAR_AUTENTICADOR" | "CODIGO";
}

function erro(route: Route, status: number, codigo: string, detalhes?: Record<string, unknown>) {
  return route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
}

export async function instalarApiFalsa(page: Page, opcoes: Opcoes = {}) {
  const admin = (opcoes.funcao ?? "ADMINISTRACAO") === "ADMINISTRACAO";
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

    if (!estado.logado) return erro(route, 401, "UNAUTHORIZED");

    if (caminho === "/v1/sessao") {
      return route.fulfill({
        json: admin
          ? { pessoaId: CAROLINA, nome: "Carolina", funcoes: ["ADMINISTRACAO"], acoes: ["console.condominios.criar", "console.equipe.gerenciar", "console.historico.equipe"] }
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
      return route.fulfill({ json: { eventos: [{ id: 9, ocorridoEm: "2026-10-16T12:30:00Z", autor: { id: CAROLINA, nome: "Carolina" }, acao: "equipe.membro_cadastrado", entidade: "pessoa", dados: { funcoes: ["IMPLANTACAO"] } }] } });
    }
    const r4 = await rotasSuporteConsole(route, suporte, caminho, metodo, corpo, c ? {
      id: c.condominio.id, nome: c.condominio.nome, sindicos: c.sindicos, estagio: () => c.cliente.estagio,
      ativar: () => { c.cliente.estagio = "ATIVO"; },
    } : undefined, url);
    if (r4 !== null) return r4;
    return erro(route, 404, "NOT_FOUND");
  });
  return Object.assign(estado, { suporte });
}
