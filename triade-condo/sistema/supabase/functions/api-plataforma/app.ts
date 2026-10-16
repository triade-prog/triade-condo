// API da Plataforma do síndico. Login (F0.6) e escolha do condomínio na sessão (F0.3):
// o navegador nunca manda o condomínio nas chamadas; ele vem da sessão, conferida no banco.
// Passo 2: painel, configurações, pessoas autorizadas e quem atende. Quem pode o quê é
// decidido no banco (vínculo e permissões individuais, CF-03); aqui só se valida a entrada.

import type { Context, MiddlewareHandler } from "hono";
import {
  alterarPessoaSchema,
  atendimentoSchema,
  autorizarPessoaSchema,
  categoriaSchema,
  COOKIES_PLATAFORMA,
  ErroDominio,
  escolherCondominioSchema,
  etapaSchema,
  feriadoSchema,
  fusoSchema,
  horariosSchema,
  modeloRespostaSchema,
  prazoSchema,
  prioridadeSchema,
  revogarPessoaSchema,
  TIPOS_HORARIO,
  versaoSchema,
} from "@triade/domain";
import type { AdminAuth } from "../_shared/auth.ts";
import { criarApp } from "../_shared/app.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export type VarsPlataforma = { Variables: VarsSessao["Variables"] & { condominioId: string } };

interface CondominioDaPessoa {
  condominio_id: string;
  nome: string;
  funcoes: string[];
}

export interface DepsPlataforma extends DepsSessao {
  /** Convite das pessoas autorizadas (V-09). */
  admin: AdminAuth;
  urlApp: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de rota: fora do formato, responde como não encontrado. */
function idDaRota(c: Context, nome: string): string {
  const id = c.req.param(nome);
  if (!id || !UUID.test(id)) throw new ErroDominio("NOT_FOUND");
  return id.toLowerCase();
}

export function criarApiPlataforma(segredo: string | undefined, deps: DepsPlataforma) {
  const app = criarApp<VarsPlataforma>("api-plataforma", segredo);
  const sessao = criarSessao(
    { sistema: "plataforma", cookie: COOKIES_PLATAFORMA.sessao, autenticadorObrigatorio: false, funcaoAcesso: "acesso_plataforma", urlApp: deps.urlApp },
    deps,
  );

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-plataforma" }));
  sessao.rotas(app);

  for (const rota of ["/v1/sessao", "/v1/sessao/*", "/v1/condominio", "/v1/condominio/*"]) app.use(rota, sessao.exigirSessao);

  // Quem está logado, os condomínios dele e o escolhido nesta sessão.
  app.get("/v1/sessao", async (c) => {
    const s = c.get("sessao");
    const condominios = await deps.banco.rpc<CondominioDaPessoa[]>("meus_condominios", { p_pessoa: s.pessoaId });
    const atual = await deps.banco.rpc<string | null>("condominio_da_sessao", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId });
    return c.json({
      pessoaId: s.pessoaId,
      condominioAtual: atual,
      condominios: condominios.map((x) => ({ id: x.condominio_id, nome: x.nome, funcoes: x.funcoes })),
    });
  });

  app.put("/v1/sessao/condominio", async (c) => {
    const s = c.get("sessao");
    const { condominioId } = await lerCorpo(c, escolherCondominioSchema);
    await deps.banco.rpc("escolher_condominio", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId, p_condominio: condominioId });
    return c.json({ condominioAtual: condominioId });
  });

  // O condomínio em que a pessoa está agora: o escolhido na sessão, ainda com vínculo ativo.
  app.use("/v1/condominio", exigirCondominio(deps));
  app.use("/v1/condominio/*", exigirCondominio(deps));
  const rpc = deps.banco.rpc.bind(deps.banco);
  /** Pessoa e condomínio que a sessão validou: vão em toda chamada ao banco. */
  const quem = (c: Context<VarsPlataforma>) => ({ p_pessoa: c.get("sessao").pessoaId, p_condominio: c.get("condominioId") });
  app.get("/v1/condominio", async (c) => {
    const id = c.get("condominioId");
    const condominios = await deps.banco.rpc<CondominioDaPessoa[]>("meus_condominios", { p_pessoa: c.get("sessao").pessoaId });
    const atual = condominios.find((x) => x.condominio_id === id);
    if (!atual) throw new ErroDominio("CONDOMINIO_REQUIRED");
    return c.json({ id, nome: atual.nome, funcoes: atual.funcoes });
  });

  // Painel (V-08): o condomínio, o que a pessoa pode fazer e o que falta configurar.
  app.get("/v1/condominio/painel", async (c) => c.json(await rpc("plataforma_painel", quem(c))));

  // Configurações (CF-06, CF-08, CF-10, AT-10), todas de uma vez.
  app.get("/v1/condominio/configuracoes", async (c) => c.json(await rpc("plataforma_configuracoes", quem(c))));

  app.put("/v1/condominio/fuso", async (c) => {
    const d = await lerCorpo(c, fusoSchema);
    return c.json({ versao: await rpc<number>("plataforma_definir_fuso", { ...quem(c), p_versao: d.versao, p_fuso: d.fuso }) });
  });

  app.put("/v1/condominio/horarios/:tipo", async (c) => {
    const tipo = c.req.param("tipo").toUpperCase();
    if (!(tipo in TIPOS_HORARIO)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, horariosSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_horarios", { ...quem(c), p_tipo: tipo, p_versao: d.versao, p_intervalos: d.intervalos }),
    });
  });

  app.post("/v1/condominio/feriados", async (c) => {
    const d = await lerCorpo(c, feriadoSchema);
    return c.json({ id: await rpc<string>("plataforma_incluir_feriado", { ...quem(c), p_data: d.data, p_descricao: d.descricao }) }, 201);
  });

  app.post("/v1/condominio/feriados/:id/remover", async (c) => {
    await rpc("plataforma_remover_feriado", { ...quem(c), p_feriado: idDaRota(c, "id") });
    return c.json({ ok: true });
  });

  // Categorias, prioridades, etapas e modelos (CF-08, CF-09): POST cria, PUT altera com a versão.
  const itens = {
    categorias: { schema: categoriaSchema, funcao: "plataforma_salvar_categoria",
      args: (d: ReturnType<typeof categoriaSchema.parse>) => ({ p_nome: d.nome, p_ativa: d.ativa ?? null }) },
    prioridades: { schema: prioridadeSchema, funcao: "plataforma_salvar_prioridade",
      args: (d: ReturnType<typeof prioridadeSchema.parse>) => ({ p_nome: d.nome, p_significado: d.significado, p_ativa: d.ativa ?? null }) },
    etapas: { schema: etapaSchema, funcao: "plataforma_salvar_etapa",
      args: (d: ReturnType<typeof etapaSchema.parse>) => ({
        p_nome: d.nome, p_situacao: d.situacao ?? null, p_categoria: d.categoriaId ?? null, p_pausa_prazo: d.pausaPrazo ?? null, p_ativa: d.ativa ?? null,
      }) },
    modelos: { schema: modeloRespostaSchema, funcao: "plataforma_salvar_modelo",
      args: (d: ReturnType<typeof modeloRespostaSchema.parse>) => ({ p_titulo: d.titulo, p_texto: d.texto, p_categoria: d.categoriaId ?? null, p_ativo: d.ativo ?? null }) },
    prazos: { schema: prazoSchema, funcao: "plataforma_salvar_prazo",
      args: (d: ReturnType<typeof prazoSchema.parse>) => ({ p_categoria: d.categoriaId ?? null, p_prioridade: d.prioridadeId ?? null, p_horas: d.horas }) },
  } as const;
  for (const [rota, item] of Object.entries(itens)) {
    // deno-lint-ignore no-explicit-any
    const salvar = async (c: Context<VarsPlataforma>, id: string | null, d: any) =>
      await rpc<{ id: string; versao: number }>(item.funcao, { ...quem(c), p_id: id, p_versao: id ? d.versao : null, ...item.args(d) });
    app.post(`/v1/condominio/${rota}`, async (c) => c.json(await salvar(c, null, await lerCorpo(c, item.schema)), 201));
    app.put(`/v1/condominio/${rota}/:id`, async (c) => {
      const id = idDaRota(c, "id");
      const d = await lerCorpo(c, item.schema);
      if (!d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
      return c.json(await salvar(c, id, d));
    });
  }

  app.post("/v1/condominio/prazos/:id/remover", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, versaoSchema);
    await rpc("plataforma_remover_prazo", { ...quem(c), p_id: id, p_versao: d.versao });
    return c.json({ ok: true });
  });

  // Pessoas autorizadas (V-09, CF-02, CF-03, CF-04).
  app.get("/v1/condominio/pessoas", async (c) => c.json(await rpc("plataforma_pessoas", quem(c))));

  app.post("/v1/condominio/pessoas", async (c) => {
    const d = await lerCorpo(c, autorizarPessoaSchema);
    // Confere a permissão no banco antes de o convite sair.
    const painel = await rpc<{ acoes: string[] }>("plataforma_painel", quem(c));
    if (!painel.acoes.includes("pessoas.autorizar")) throw new ErroDominio("FORBIDDEN");
    const pessoaId = c.get("sessao").pessoaId;
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "convite", p_chave: pessoaId }))) throw new ErroDominio("RATE_LIMITED");
    const conta = await deps.admin.convidar(d.email, `${deps.urlApp}/convite`);
    const vinculoId = await rpc<string>("plataforma_autorizar_pessoa", {
      ...quem(c), p_convidado: conta.userId, p_nome: d.nome, p_cargo: d.cargo, p_permissoes: d.permissoes,
    });
    return c.json({ vinculoId, contaNova: conta.contaNova }, 201);
  });

  app.put("/v1/condominio/pessoas/:vinculo", async (c) => {
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, alterarPessoaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_pessoa", { ...quem(c), p_vinculo: vinculo, p_versao: d.versao, p_cargo: d.cargo, p_permissoes: d.permissoes }),
    });
  });

  app.post("/v1/condominio/pessoas/:vinculo/revogar", async (c) => {
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, revogarPessoaSchema);
    await rpc("plataforma_revogar_pessoa", {
      ...quem(c), p_vinculo: vinculo, p_versao: d.versao, p_substituto: d.substitutoId ?? null, p_deixar_pendente: d.deixarPendente ?? false,
    });
    return c.json({ ok: true });
  });

  // Quem atende (CF-05).
  app.put("/v1/condominio/atendimento", async (c) => {
    const d = await lerCorpo(c, atendimentoSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_atendimento", { ...quem(c), p_versao: d.versao, p_responsaveis: d.responsaveis, p_padrao: d.padraoId }),
    });
  });

  return app;
}

/** Rotas de dado de condomínio: sessão completa e o condomínio escolhido, ainda com vínculo ativo. */
export function exigirCondominio(deps: DepsSessao): MiddlewareHandler<VarsPlataforma> {
  return async (c, next) => {
    const s = c.get("sessao");
    const condominio = await deps.banco.rpc<string | null>("condominio_da_sessao", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId });
    if (!condominio) throw new ErroDominio("CONDOMINIO_REQUIRED");
    c.set("condominioId", condominio);
    await next();
  };
}
