// API do Console TRÍADE. Só a equipe ativa, sempre com o autenticador (F0.6, PT-08).
// Passo 1: carteira, ficha, cenário, convite do síndico, notas internas, histórico e equipe.
// Quem pode o quê é decidido no banco (funções internas e clientes atribuídos, PI-10); aqui
// só se valida a entrada e se fala com o Auth para os convites.

import type { Context } from "hono";
import {
  atribuirSchema,
  cadastrarMembroSchema,
  cenarioSchema,
  contratoSchema,
  convidarPessoaSchema,
  COOKIES_CONSOLE,
  criarCondominioSchema,
  ErroDominio,
  estagioSchema,
  fichaSchema,
  funcoesSchema,
  notaSchema,
  versaoSchema,
} from "@triade/domain";
import type { AdminAuth } from "../_shared/auth.ts";
import { criarApp } from "../_shared/app.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export interface DepsConsole extends DepsSessao {
  admin: AdminAuth;
  /** Endereço do Console (links de senha e convite da equipe). */
  urlApp: string;
  /** Endereço da Plataforma (convite do síndico). */
  urlPlataforma: string;
}

interface LinhaCarteira {
  condominio_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  estagio: string;
  cenario: string | null;
  funcoes: string[];
  situacoes: string[];
  criado_em: string;
}

interface LinhaHistorico {
  id: number;
  ocorrido_em: string;
  autor_tipo?: string;
  autor_id: string | null;
  autor_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados: Record<string, unknown>;
  interno?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de rota: fora do formato, responde como não encontrado. */
function idDaRota(c: Context, nome: string): string {
  const id = c.req.param(nome);
  if (!id || !UUID.test(id)) throw new ErroDominio("NOT_FOUND");
  return id.toLowerCase();
}

function paginacao(c: Context): { p_antes: number | null; p_limite: number } {
  const antes = Number(c.req.query("antes"));
  const limite = Number(c.req.query("limite"));
  return {
    p_antes: Number.isInteger(antes) && antes > 0 ? antes : null,
    p_limite: Number.isInteger(limite) && limite > 0 ? Math.min(limite, 200) : 50,
  };
}

function historico(l: LinhaHistorico) {
  return {
    id: l.id,
    ocorridoEm: l.ocorrido_em,
    autor: l.autor_id ? { id: l.autor_id, nome: l.autor_nome } : null,
    acao: l.acao,
    entidade: l.entidade,
    entidadeId: l.entidade_id,
    dados: l.dados,
    ...(l.interno === undefined ? {} : { interno: l.interno }),
  };
}

export function criarApiConsole(segredo: string | undefined, deps: DepsConsole) {
  const app = criarApp<VarsSessao>("api-console", segredo);
  const sessao = criarSessao(
    { sistema: "console", cookie: COOKIES_CONSOLE.sessao, autenticadorObrigatorio: true, funcaoAcesso: "acesso_console", urlApp: deps.urlApp },
    deps,
  );
  const rpc = deps.banco.rpc.bind(deps.banco);

  /** Convite pelo Auth, com limite por pessoa da equipe. */
  async function convidar(pessoaId: string, email: string, voltarPara: string) {
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "convite", p_chave: pessoaId }))) throw new ErroDominio("RATE_LIMITED");
    return await deps.admin.convidar(email, `${voltarPara}/convite`);
  }

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-console" }));
  sessao.rotas(app);

  for (const rota of ["/v1/sessao", "/v1/clientes", "/v1/clientes/*", "/v1/equipe", "/v1/equipe/*"]) app.use(rota, sessao.exigirSessao);
  const pessoa = (c: Context<VarsSessao>) => c.get("sessao").pessoaId;

  // Quem está no Console: nome, funções e o que pode fazer fora de um cliente.
  app.get("/v1/sessao", async (c) => c.json(await rpc("console_sessao", { p_pessoa: pessoa(c) })));

  // Carteira (PI-01, V-10): só os clientes atribuídos.
  app.get("/v1/clientes", async (c) => {
    const linhas = await rpc<LinhaCarteira[]>("console_carteira", { p_pessoa: pessoa(c) });
    return c.json({
      clientes: linhas.map((l) => ({
        id: l.condominio_id,
        nome: l.nome,
        cidade: l.cidade,
        uf: l.uf,
        estagio: l.estagio,
        cenario: l.cenario,
        funcoes: l.funcoes,
        situacoes: l.situacoes,
        criadoEm: l.criado_em,
      })),
    });
  });

  app.post("/v1/clientes", async (c) => {
    const d = await lerCorpo(c, criarCondominioSchema);
    const id = await rpc<string>("console_criar_condominio", {
      p_pessoa: pessoa(c), p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf, p_cenario: d.cenario,
    });
    return c.json({ id }, 201);
  });

  // Ficha (PI-02, CF-01).
  app.get("/v1/clientes/:id", async (c) =>
    c.json(await rpc("console_ficha", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.put("/v1/clientes/:id/ficha", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, fichaSchema);
    const versao = await rpc<number>("console_editar_ficha", {
      p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf,
      p_endereco: d.endereco, p_numero_whatsapp: d.numeroWhatsapp, p_contatos: d.contatos,
    });
    return c.json({ versao });
  });

  // Cenário (V-04, V-05, V-06, CF-12).
  app.put("/v1/clientes/:id/cenario", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, cenarioSchema);
    return c.json({ versao: await rpc<number>("console_escolher_cenario", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_cenario: d.cenario }) });
  });

  // Referência do contrato (PI-02): só administração.
  app.put("/v1/clientes/:id/contrato", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, contratoSchema);
    return c.json({
      versao: await rpc<number>("console_alterar_contrato", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_referencia: d.referenciaContrato }),
    });
  });

  // Estágio (PI-01).
  app.put("/v1/clientes/:id/estagio", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, estagioSchema);
    return c.json({
      versao: await rpc<number>("console_mudar_estagio", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_estagio: d.estagio, p_motivo: d.motivo }),
    });
  });

  // Convidar o síndico (CF-02): conta própria, ligada ao condomínio. A permissão é conferida
  // no banco antes do convite sair (console_ficha falha para quem não está atribuído).
  app.post("/v1/clientes/:id/sindicos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, convidarPessoaSchema);
    const ficha = await rpc<{ permissoes: string[] }>("console_ficha", { p_pessoa: pessoa(c), p_condominio: id });
    if (!ficha.permissoes.includes("console.sindicos.convidar")) throw new ErroDominio("FORBIDDEN");
    const conta = await convidar(pessoa(c), d.email, deps.urlPlataforma);
    const vinculoId = await rpc<string>("console_vincular_sindico", {
      p_pessoa: pessoa(c), p_condominio: id, p_convidado: conta.userId, p_nome: d.nome,
    });
    return c.json({ vinculoId, contaNova: conta.contaNova }, 201);
  });

  // Notas internas (PI-06).
  app.get("/v1/clientes/:id/notas", async (c) => {
    const linhas = await rpc<{ id: string; texto: string; criado_em: string; autor_id: string; autor_nome: string | null }[]>(
      "console_notas", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") });
    return c.json({ notas: linhas.map((n) => ({ id: n.id, texto: n.texto, criadoEm: n.criado_em, autor: { id: n.autor_id, nome: n.autor_nome } })) });
  });

  app.post("/v1/clientes/:id/notas", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, notaSchema);
    return c.json({ id: await rpc<string>("console_escrever_nota", { p_pessoa: pessoa(c), p_condominio: id, p_texto: d.texto }) }, 201);
  });

  // Histórico administrativo do cliente (PI-12).
  app.get("/v1/clientes/:id/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historico) });
  });

  // Atribuir e retirar pessoas da equipe no cliente (PI-10).
  app.post("/v1/clientes/:id/equipe", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, atribuirSchema);
    return c.json({ vinculoId: await rpc<string>("console_atribuir", { p_pessoa: pessoa(c), p_condominio: id, p_membro: d.pessoaId, p_funcao: d.funcao }) }, 201);
  });

  app.post("/v1/clientes/:id/equipe/:vinculo/retirar", async (c) => {
    const id = idDaRota(c, "id");
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, versaoSchema);
    return c.json({
      versao: await rpc<number>("console_retirar_atribuicao", { p_pessoa: pessoa(c), p_condominio: id, p_vinculo: vinculo, p_versao: d.versao }),
    });
  });

  // Equipe (PI-10): só administração.
  app.get("/v1/equipe", async (c) => {
    const linhas = await rpc<{ pessoa_id: string; nome: string; ativa: boolean; funcoes: string[]; desde: string }[]>(
      "console_equipe", { p_pessoa: pessoa(c) });
    return c.json({ pessoas: linhas.map((l) => ({ id: l.pessoa_id, nome: l.nome, ativa: l.ativa, funcoes: l.funcoes, desde: l.desde })) });
  });

  app.post("/v1/equipe", async (c) => {
    const d = await lerCorpo(c, cadastrarMembroSchema);
    // Confere a permissão antes de o convite sair.
    await rpc("console_equipe", { p_pessoa: pessoa(c) });
    const conta = await convidar(pessoa(c), d.email, deps.urlApp);
    await rpc("console_cadastrar_membro", { p_pessoa: pessoa(c), p_membro: conta.userId, p_nome: d.nome, p_funcoes: d.funcoes });
    return c.json({ pessoaId: conta.userId, contaNova: conta.contaNova }, 201);
  });

  app.put("/v1/equipe/:pessoa/funcoes", async (c) => {
    const membro = idDaRota(c, "pessoa");
    const d = await lerCorpo(c, funcoesSchema);
    await rpc("console_definir_funcoes", { p_pessoa: pessoa(c), p_membro: membro, p_funcoes: d.funcoes });
    return c.json({ ok: true });
  });

  app.post("/v1/equipe/:pessoa/desativar", async (c) => {
    await rpc("console_desativar_membro", { p_pessoa: pessoa(c), p_membro: idDaRota(c, "pessoa") });
    return c.json({ ok: true });
  });

  app.get("/v1/equipe/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico_equipe", { p_pessoa: pessoa(c), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historico) });
  });

  return app;
}
