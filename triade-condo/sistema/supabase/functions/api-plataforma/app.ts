// API da Plataforma do síndico. Login (F0.6) e escolha do condomínio na sessão (F0.3):
// o navegador nunca manda o condomínio nas chamadas; ele vem da sessão, conferida no banco.
// Passo 2: painel, configurações, pessoas autorizadas e quem atende. Passo 3: blocos,
// unidades e contatos. Passo 4: pedidos no painel. Passo 4b: fotos e documentos dos pedidos. Quem pode o quê é decidido no banco (vínculo e permissões
// individuais, CF-03); aqui só se valida a entrada.

import type { Context, MiddlewareHandler } from "hono";
import {
  alterarContatoSchema,
  alterarPessoaSchema,
  alterarUnidadeSchema,
  alterarVinculoUnidadeSchema,
  blocoSchema,
  buscaMoradoresSchema,
  confirmarContatosSchema,
  encerrarVinculoSchema,
  estruturaSchema,
  importacaoSchema,
  incluirContatoSchema,
  incluirUnidadesSchema,
  mudancaSchema,
  removerDadosSchema,
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
  aceitarPedidoSchema,
  alterarPedidoSchema,
  atribuirPedidoSchema,
  buscaPedidosSchema,
  cancelarPedidoSchema,
  concluirPedidoSchema,
  moverPedidoSchema,
  mudarRetornoSchema,
  notaPedidoSchema,
  pendenciaSchema,
  previsaoSchema,
  reabrirPedidoSchema,
  registrarPedidoSchema,
  regrasPedidosSchema,
  resolverPendenciaSchema,
  retornoSchema,
  revisarPedidoSchema,
  enviarArquivoSchema,
  tirarArquivoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  type TipoArquivo,
} from "@triade/domain";
import { verificarArquivo, type Armazenamento } from "../_shared/arquivos.ts";
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
  /** Armazenamento privado das fotos e documentos (PT-07). */
  armazenamento: Armazenamento;
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

  // Blocos e unidades (F3.1).
  app.get("/v1/condominio/unidades", async (c) => c.json(await rpc("plataforma_unidades", quem(c))));

  app.get("/v1/condominio/unidades/:id", async (c) =>
    c.json(await rpc("plataforma_unidade", { ...quem(c), p_unidade: idDaRota(c, "id") })));

  const salvarBloco = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, blocoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_bloco", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_nome: d.nome, p_ordem: d.ordem ?? null, p_ativo: d.ativo ?? null,
    });
  };
  app.post("/v1/condominio/blocos", async (c) => c.json(await salvarBloco(c, null), 201));
  app.put("/v1/condominio/blocos/:id", async (c) => c.json(await salvarBloco(c, idDaRota(c, "id"))));

  // Como o prédio se organiza: torre, bloco, quadra ou prédio (ou nada), com ou sem andar.
  app.put("/v1/condominio/estrutura", async (c) => {
    const d = await lerCorpo(c, estruturaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_estrutura", { ...quem(c), p_versao: d.versao, p_agrupamento: d.agrupamento, p_usa_andar: d.usaAndar }),
    });
  });

  app.post("/v1/condominio/unidades", async (c) => {
    const d = await lerCorpo(c, incluirUnidadesSchema);
    return c.json(await rpc("plataforma_incluir_unidades", { ...quem(c), p_bloco: d.blocoId, p_unidades: d.unidades }), 201);
  });

  app.put("/v1/condominio/unidades/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarUnidadeSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_unidade", {
        ...quem(c), p_id: id, p_versao: d.versao, p_identificacao: d.identificacao, p_bloco: d.blocoId, p_andar: d.andar, p_ativa: d.ativa ?? null,
      }),
    });
  });

  // Contatos (MU-01, MU-02, MU-03, MU-08).
  app.post("/v1/condominio/unidades/:id/contatos", async (c) => {
    const unidade = idDaRota(c, "id");
    const d = await lerCorpo(c, incluirContatoSchema);
    return c.json(await rpc("plataforma_incluir_contato", {
      ...quem(c), p_unidade: unidade, p_contato: d.contatoId ?? null, p_nome: d.contatoId ? null : d.nome,
      p_telefone: d.contatoId ? null : d.telefone, p_relacao: d.relacao, p_principal: d.principal, p_recebe: d.recebeComunicados,
      p_proprietario: d.proprietario ?? null,
    }), 201);
  });

  app.post("/v1/condominio/unidades/:id/mudanca", async (c) => {
    const unidade = idDaRota(c, "id");
    const d = await lerCorpo(c, mudancaSchema);
    return c.json(await rpc("plataforma_registrar_mudanca", { ...quem(c), p_unidade: unidade, p_data: d.data, p_saem: d.saem, p_entram: d.entram }));
  });

  app.get("/v1/condominio/moradores", async (c) => {
    const r = buscaMoradoresSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("plataforma_moradores", { ...quem(c), p_busca: r.data.busca ?? null, p_estado: r.data.estado ?? null, p_pagina: r.data.pagina }));
  });

  app.put("/v1/condominio/contatos/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarContatoSchema);
    return c.json(await rpc("plataforma_alterar_contato", { ...quem(c), p_contato: id, p_versao: d.versao, p_nome: d.nome, p_telefone: d.telefone }));
  });

  app.post("/v1/condominio/contatos/:id/remover-dados", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, removerDadosSchema);
    await rpc("plataforma_remover_dados_contato", { ...quem(c), p_contato: id, p_versao: d.versao });
    return c.json({ ok: true });
  });

  app.put("/v1/condominio/vinculos-unidade/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarVinculoUnidadeSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_vinculo_unidade", {
        ...quem(c), p_id: id, p_versao: d.versao, p_relacao: d.relacao, p_principal: d.principal, p_recebe: d.recebeComunicados,
      }),
    });
  });

  app.post("/v1/condominio/vinculos-unidade/:id/encerrar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, encerrarVinculoSchema);
    await rpc("plataforma_encerrar_vinculo_unidade", { ...quem(c), p_id: id, p_versao: d.versao, p_motivo: d.motivo, p_data_saida: d.dataSaida ?? null });
    return c.json({ ok: true });
  });

  app.post("/v1/condominio/vinculos-unidade/confirmar", async (c) => {
    const d = await lerCorpo(c, confirmarContatosSchema);
    return c.json({ confirmados: await rpc<number>("plataforma_confirmar_contatos", { ...quem(c), p_itens: d.itens }) });
  });

  // Planilha (F3.3): a tela lê o arquivo e mostra a prévia; aqui chegam as linhas já lidas.
  app.post("/v1/condominio/importacoes", async (c) => {
    const d = await lerCorpo(c, importacaoSchema);
    return c.json(await rpc("plataforma_importar_moradores", { ...quem(c), p_linhas: d.linhas, p_agrupamento: d.agrupamento ?? null }), 201);
  });

  // Pedidos no painel (passo 4; AT-01 a AT-17, AT-31, AT-32). Toda ação leva a versão lida
  // do pedido (AT-24) e devolve a nova.
  app.put("/v1/condominio/regras-pedidos", async (c) => {
    const d = await lerCorpo(c, regrasPedidosSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_regras_pedidos", { ...quem(c), p_versao: d.versao, p_revisao: d.revisao, p_reabertura: d.reabertura }),
    });
  });

  app.get("/v1/condominio/pedidos/opcoes", async (c) => c.json(await rpc("plataforma_pedidos_opcoes", quem(c))));

  app.get("/v1/condominio/pedidos/contatos/:unidade", async (c) =>
    c.json(await rpc("plataforma_pedido_contatos", { ...quem(c), p_unidade: idDaRota(c, "unidade") })));

  app.get("/v1/condominio/pedidos", async (c) => {
    const r = buscaPedidosSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    const f = r.data;
    return c.json(await rpc("plataforma_pedidos", {
      ...quem(c), p_situacao: f.situacao ?? null, p_responsavel: f.responsavel ?? null, p_prioridade: f.prioridade ?? null,
      p_categoria: f.categoria ?? null, p_atencao: f.atencao ?? null, p_busca: f.busca ?? null, p_pagina: f.pagina,
    }));
  });

  app.post("/v1/condominio/pedidos", async (c) => {
    const d = await lerCorpo(c, registrarPedidoSchema);
    return c.json(await rpc("plataforma_registrar_pedido", {
      ...quem(c), p_unidade: d.unidadeId, p_contato: d.contatoId, p_local: d.local, p_categoria: d.categoriaId, p_prioridade: d.prioridadeId,
      p_assunto: d.assunto, p_descricao: d.descricao, p_canal: d.canal, p_privado: d.privado, p_responsavel: d.responsavelId,
    }), 201);
  });

  app.get("/v1/condominio/pedidos/:id", async (c) => c.json(await rpc("plataforma_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Ações sobre um pedido: rota, validação e os parâmetros da função do banco.
  const acoes = [
    { rota: "", metodo: "put", schema: alterarPedidoSchema, funcao: "plataforma_alterar_pedido",
      args: (d: ReturnType<typeof alterarPedidoSchema.parse>) => ({ p_categoria: d.categoriaId, p_prioridade: d.prioridadeId, p_local: d.local, p_privado: d.privado }) },
    { rota: "/etapa", metodo: "post", schema: moverPedidoSchema, funcao: "plataforma_mover_pedido",
      args: (d: ReturnType<typeof moverPedidoSchema.parse>) => ({ p_etapa: d.etapaId }) },
    { rota: "/responsavel", metodo: "post", schema: atribuirPedidoSchema, funcao: "plataforma_atribuir_pedido",
      args: (d: ReturnType<typeof atribuirPedidoSchema.parse>) => ({ p_responsavel: d.responsavelId, p_motivo: d.motivo }) },
    { rota: "/aceitar", metodo: "post", schema: aceitarPedidoSchema, funcao: "plataforma_aceitar_pedido", args: () => ({}) },
    { rota: "/retornos", metodo: "post", schema: retornoSchema, funcao: "plataforma_registrar_retorno",
      args: (d: ReturnType<typeof retornoSchema.parse>) => ({ p_meio: d.meio, p_texto: d.texto }) },
    { rota: "/notas", metodo: "post", schema: notaPedidoSchema, funcao: "plataforma_anotar_pedido",
      args: (d: ReturnType<typeof notaPedidoSchema.parse>) => ({ p_texto: d.texto }) },
    { rota: "/proximo-retorno", metodo: "put", schema: mudarRetornoSchema, funcao: "plataforma_mudar_retorno",
      args: (d: ReturnType<typeof mudarRetornoSchema.parse>) => ({ p_quando: d.quando, p_motivo: d.motivo }) },
    { rota: "/previsao", metodo: "put", schema: previsaoSchema, funcao: "plataforma_definir_previsao",
      args: (d: ReturnType<typeof previsaoSchema.parse>) => ({ p_data: d.data, p_motivo: d.motivo }) },
    { rota: "/pendencias", metodo: "post", schema: pendenciaSchema, funcao: "plataforma_abrir_pendencia",
      args: (d: ReturnType<typeof pendenciaSchema.parse>) => ({ p_tipo: d.tipo, p_motivo: d.motivo, p_responsavel: d.responsavelId }) },
    { rota: "/concluir", metodo: "post", schema: concluirPedidoSchema, funcao: "plataforma_concluir_pedido",
      args: (d: ReturnType<typeof concluirPedidoSchema.parse>) => ({ p_etapa: d.etapaId, p_explicacao: d.explicacao, p_evidencia: d.evidencia }) },
    { rota: "/revisar", metodo: "post", schema: revisarPedidoSchema, funcao: "plataforma_revisar_pedido",
      args: (d: ReturnType<typeof revisarPedidoSchema.parse>) => ({ p_aprovar: d.aprovar, p_motivo: d.motivo }) },
    { rota: "/reabrir", metodo: "post", schema: reabrirPedidoSchema, funcao: "plataforma_reabrir_pedido",
      args: (d: ReturnType<typeof reabrirPedidoSchema.parse>) => ({ p_motivo: d.motivo, p_responsavel: d.responsavelId }) },
    { rota: "/cancelar", metodo: "post", schema: cancelarPedidoSchema, funcao: "plataforma_cancelar_pedido",
      args: (d: ReturnType<typeof cancelarPedidoSchema.parse>) => ({ p_motivo: d.motivo }) },
  ];
  for (const a of acoes) {
    app[a.metodo as "put" | "post"](`/v1/condominio/pedidos/:id${a.rota}`, async (c) => {
      const id = idDaRota(c, "id");
      const d = await lerCorpo(c, a.schema as Parameters<typeof lerCorpo>[1]) as { versao: number };
      // deno-lint-ignore no-explicit-any
      return c.json(await rpc(a.funcao, { ...quem(c), p_id: id, p_versao: d.versao, ...(a.args as (x: any) => object)(d) }));
    });
  }

  app.post("/v1/condominio/pedidos/:id/pendencias/:pendencia/resolver", async (c) => {
    const id = idDaRota(c, "id");
    const pendencia = idDaRota(c, "pendencia");
    const d = await lerCorpo(c, resolverPendenciaSchema);
    return c.json(await rpc("plataforma_resolver_pendencia", { ...quem(c), p_id: id, p_versao: d.versao, p_pendencia: pendencia, p_resolucao: d.resolucao }));
  });

  // Fotos e documentos (passo 4b; PT-07). O banco decide quem envia, vê e tira; aqui ficam o
  // armazenamento e a verificação do conteúdo. Arquivo não muda a versão do pedido.
  const arquivo = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo") });

  app.get("/v1/condominio/pedidos/:id/arquivos", async (c) =>
    c.json(await rpc("plataforma_arquivos_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/pedidos/:id/arquivos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, enviarArquivoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo", {
      ...quem(c), p_id: id, p_parte: d.parte, p_nome: d.nome, p_descricao: d.descricao, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await deps.armazenamento.linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });

  // Depois do envio: confere o conteúdo, tira a localização das fotos e só então libera.
  app.post("/v1/condominio/pedidos/:id/arquivos/:arquivo/verificar", async (c) => {
    const ids = arquivo(c);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_arquivo_a_verificar", ids);
    const bytes = await deps.armazenamento.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await deps.armazenamento.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_arquivo", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await deps.armazenamento.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_arquivo", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });

  // Abrir ou baixar: link de 5 minutos, gerado só depois de o banco conferir quem pede.
  app.get("/v1/condominio/pedidos/:id/arquivos/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_arquivo", arquivo(c));
    const baixar = c.req.query("baixar") === "1";
    const url = await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  app.post("/v1/condominio/pedidos/:id/arquivos/:arquivo/tirar", async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_arquivo", { ...arquivo(c), p_motivo: d.motivo }));
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
