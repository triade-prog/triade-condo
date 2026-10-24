// Decisões e aprovações (peça R5): o conselho e o subsíndico (V-14), as regras, a ausência do
// síndico, o voto pelo painel e pelo link sem conta, e a despesa para aprovar (FC-10), com os
// anexos no bucket privado "pedidos", o mesmo dos arquivos do pedido. Quem pode o quê, o quórum
// e quando a votação fecha são decididos no banco (0303); aqui só se valida a entrada, se cuida
// dos anexos e se esvazia a fila quando o link do conselheiro vai pelo e-mail.

import type { Context, Env, Hono } from "hono";
import {
  alterarDespesaSchema,
  alterarMembroSchema,
  ausenciaSchema,
  buscaCandidatosSchema,
  criarDespesaSchema,
  desfazerPagamentoSchema,
  encerrarAusenciaSchema,
  enviarAnexoAprovacaoSchema,
  ErroDominio,
  filtroDespesasSchema,
  incluirMembroSchema,
  pagarDespesaSchema,
  reenviarLinkSchema,
  regrasDecisoesSchema,
  respostaConselhoSchema,
  responderDespesaSchema,
  retirarDespesaSchema,
  retirarMembroSchema,
  tirarArquivoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  votoSchema,
  type TipoArquivo,
} from "@triade/domain";
import { verificarArquivo, type Armazenamento } from "../_shared/arquivos.ts";
import type { Banco } from "../_shared/banco.ts";
import { idDaRota, type Quem } from "../_shared/rotas_configuracao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export interface DepsAprovacoes {
  banco: Banco;
  /** Bucket privado "pedidos": os anexos da decisão e da despesa ficam ao lado dos arquivos do pedido. */
  armazenamento: Armazenamento;
  /** O link pelo e-mail entrou na fila: manda agora. */
  esvaziarFila: () => void;
  /** O código do link sem conta, conferido no formato (fora dele, não encontrado). */
  codigoDaRota: (c: Context) => string;
  /** Limite de uso por aparelho das rotas sem conta. */
  limitar: (c: Context) => Promise<void>;
  /** O e-mail da conta (Auth): quem entra no conselho pela conta e não informa outro recebe nele. */
  emailDaConta: (pessoaId: string) => Promise<string | null>;
}

type Link = { envio?: string };
type ComLinks = { links?: (Link | null)[] } & Link;

/** Algum link do conselho entrou na fila do e-mail (o de voto, o do substituto ou o do aviso). */
export function algumPorEmail(r: unknown): boolean {
  const x = (r ?? {}) as ComLinks;
  return x.envio === "EMAIL" || (Array.isArray(x.links) && x.links.some((l) => l?.envio === "EMAIL"));
}

export function rotasAprovacoes<E extends Env>(app: Hono<E>, base: string, quem: (c: Context<E>) => Quem, deps: DepsAprovacoes) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const consulta = <T extends typeof filtroDespesasSchema | typeof buscaCandidatosSchema>(c: Context<E>, schema: T): ReturnType<T["parse"]> => {
    const r = schema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return r.data as ReturnType<T["parse"]>;
  };
  const id = (c: Context<E>) => ({ ...quem(c), p_id: idDaRota(c, "id") });
  /** Algum link foi pelo e-mail: a fila sai na hora. */
  const mandou = <T extends ComLinks>(r: T): T => {
    if (algumPorEmail(r)) deps.esvaziarFila();
    return r;
  };

  // ---------------------------------------------------------------------------------------
  // Pessoas › Conselho (quadros 410 a 412) e Configurações › Regras (quadro 421).

  app.get(`${base}/conselho`, async (c) => c.json(await rpc("plataforma_conselho", quem(c))));
  app.get(`${base}/conselho/candidatos`, async (c) =>
    c.json(await rpc("plataforma_conselho_candidatos", { ...quem(c), p_busca: consulta(c, buscaCandidatosSchema).busca })));
  app.post(`${base}/conselho`, async (c) => {
    const d = await lerCorpo(c, incluirMembroSchema);
    const email = d.email ?? (d.pessoaId ? await deps.emailDaConta(d.pessoaId) : null);
    return c.json(await rpc("plataforma_incluir_membro", {
      ...quem(c), p_membro_pessoa: d.pessoaId, p_contato: d.contatoId, p_nome: d.nome, p_celular: d.celular, p_email: email,
      p_papel: d.papel, p_inicio: d.mandatoInicio, p_fim: d.mandatoFim, p_canal: d.canal,
    }), 201);
  });
  app.put(`${base}/conselho/:id`, async (c) => {
    const d = await lerCorpo(c, alterarMembroSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_membro", {
        ...id(c), p_versao: d.versao, p_papel: d.papel, p_inicio: d.mandatoInicio, p_fim: d.mandatoFim, p_canal: d.canal,
        p_celular: d.celular, p_email: d.email,
      }),
    });
  });
  app.post(`${base}/conselho/:id/retirar`, async (c) => {
    const d = await lerCorpo(c, retirarMembroSchema);
    return c.json({ versao: await rpc<number>("plataforma_retirar_membro", { ...id(c), p_versao: d.versao, p_motivo: d.motivo }) });
  });

  app.get(`${base}/regras-decisoes`, async (c) => c.json(await rpc("plataforma_regras_decisoes", quem(c))));
  app.put(`${base}/regras-decisoes`, async (c) => {
    const d = await lerCorpo(c, regrasDecisoesSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_regras_decisoes", {
        ...quem(c), p_versao: d.versao, p_quorum: d.quorum, p_minimo: d.minimo, p_empate: d.empate, p_vencida: d.vencidaAvisa, p_alcada: d.alcada,
      }),
    });
  });

  // A ausência do síndico: o subsíndico responde no lugar dele; sem painel, recebe o link.
  app.post(`${base}/ausencia`, async (c) => {
    const d = await lerCorpo(c, ausenciaSchema);
    // Os links do substituto que nasceram: pelo e-mail saem na hora; pelo WhatsApp, para copiar.
    const r = await rpc<ComLinks>("plataforma_marcar_ausencia", { ...quem(c), p_de: d.de, p_ate: d.ate, p_motivo: d.motivo });
    return c.json(mandou(r), 201);
  });
  app.post(`${base}/ausencia/:id/encerrar`, async (c) => {
    const d = await lerCorpo(c, encerrarAusenciaSchema);
    return c.json({ versao: await rpc<number>("plataforma_encerrar_ausencia", { ...id(c), p_versao: d.versao }) });
  });

  // ---------------------------------------------------------------------------------------
  // O voto pelo painel e o Reenviar o link (quadro 414), na decisão e na despesa: o de voto, o do
  // substituto e o do aviso. O código para copiar só volta para quem cuida do conselho.

  app.post(`${base}/decisoes/:id/voto`, async (c) => {
    const d = await lerCorpo(c, votoSchema);
    return c.json(await rpc("plataforma_votar_decisao", { ...quem(c), p_decisao: idDaRota(c, "id"), p_escolha: d.escolha, p_justificativa: d.justificativa }));
  });
  app.post(`${base}/decisoes/:id/reenviar-link`, async (c) => {
    const d = await lerCorpo(c, reenviarLinkSchema);
    return c.json(mandou(await rpc<ComLinks>("plataforma_reenviar_link_conselho", {
      ...quem(c), p_decisao: idDaRota(c, "id"), p_despesa: null, p_membro: d.membroId, p_finalidade: d.finalidade,
    })));
  });

  // ---------------------------------------------------------------------------------------
  // Despesas (quadros 418 a 420 e 423).

  app.get(`${base}/despesas`, async (c) => c.json(await rpc("plataforma_despesas", { ...quem(c), p_filtro: consulta(c, filtroDespesasSchema).filtro })));
  app.get(`${base}/despesas/opcoes`, async (c) => c.json(await rpc("plataforma_despesa_opcoes", quem(c))));
  app.get(`${base}/despesas/:id`, async (c) => c.json(await rpc("plataforma_despesa", id(c))));
  app.post(`${base}/despesas`, async (c) => {
    const d = await lerCorpo(c, criarDespesaSchema);
    return c.json(mandou(await rpc<ComLinks>("plataforma_criar_despesa", {
      ...quem(c), p_descricao: d.descricao, p_valor: d.valor, p_prestador: d.prestadorId, p_fornecedor: d.fornecedor, p_vencimento: d.vencimento,
      p_pedido: d.pedidoId, p_manutencao: d.manutencaoId, p_decisao: d.decisaoId, p_modo: d.modo, p_decisor: d.decisorId, p_prazo: d.prazo,
    })), 201);
  });
  app.put(`${base}/despesas/:id`, async (c) => {
    const d = await lerCorpo(c, alterarDespesaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_despesa", {
        ...id(c), p_versao: d.versao, p_descricao: d.descricao, p_valor: d.valor, p_prestador: d.prestadorId, p_fornecedor: d.fornecedor,
        p_vencimento: d.vencimento, p_pedido: d.pedidoId, p_manutencao: d.manutencaoId, p_decisao: d.decisaoId,
      }),
    });
  });
  app.post(`${base}/despesas/:id/responder`, async (c) => {
    const d = await lerCorpo(c, responderDespesaSchema);
    return c.json(await rpc("plataforma_responder_despesa", { ...id(c), p_versao: d.versao, p_aprovar: d.aprovar, p_justificativa: d.justificativa }));
  });
  app.post(`${base}/despesas/:id/voto`, async (c) => {
    const d = await lerCorpo(c, votoSchema);
    return c.json(await rpc("plataforma_votar_despesa", { ...id(c), p_escolha: d.escolha, p_justificativa: d.justificativa }));
  });
  app.post(`${base}/despesas/:id/retirar`, async (c) => {
    const d = await lerCorpo(c, retirarDespesaSchema);
    return c.json(await rpc("plataforma_retirar_despesa", { ...id(c), p_versao: d.versao, p_motivo: d.motivo }));
  });
  // Paga fora do sistema (regra 7): só o registro; o sistema não paga nem guarda dado bancário.
  app.post(`${base}/despesas/:id/pagar`, async (c) => {
    const d = await lerCorpo(c, pagarDespesaSchema);
    return c.json(await rpc("plataforma_pagar_despesa", { ...id(c), p_versao: d.versao, p_paga_em: d.pagaEm, p_comprovante: d.comprovanteId }));
  });
  app.post(`${base}/despesas/:id/desfazer-pagamento`, async (c) => {
    const d = await lerCorpo(c, desfazerPagamentoSchema);
    return c.json(await rpc("plataforma_desfazer_pagamento", { ...id(c), p_versao: d.versao }));
  });
  app.post(`${base}/despesas/:id/reenviar-link`, async (c) => {
    const d = await lerCorpo(c, reenviarLinkSchema);
    return c.json(mandou(await rpc<ComLinks>("plataforma_reenviar_link_conselho", {
      ...quem(c), p_decisao: null, p_despesa: idDaRota(c, "id"), p_membro: d.membroId, p_finalidade: d.finalidade,
    })));
  });

  // ---------------------------------------------------------------------------------------
  // Anexos: o navegador manda direto ao armazenamento; aqui se confere o conteúdo antes de liberar.

  const iniciarAnexo = async (c: Context<E>, item: { p_decisao: string | null; p_despesa: string | null }) => {
    const d = await lerCorpo(c, enviarAnexoAprovacaoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_anexo_aprovacao", {
      ...quem(c), ...item, p_parte: d.parte, p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await deps.armazenamento.linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  };
  app.post(`${base}/decisoes/:id/anexos`, async (c) => await iniciarAnexo(c, { p_decisao: idDaRota(c, "id"), p_despesa: null }));
  app.post(`${base}/despesas/:id/anexos`, async (c) => await iniciarAnexo(c, { p_decisao: null, p_despesa: idDaRota(c, "id") }));

  const anexo = (c: Context<E>) => ({ ...quem(c), p_arquivo: idDaRota(c, "arquivo") });
  app.post(`${base}/aprovacoes/anexos/:arquivo/verificar`, async (c) => {
    const ids = anexo(c);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_anexo_aprovacao_a_verificar", ids);
    const bytes = await deps.armazenamento.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await deps.armazenamento.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_anexo_aprovacao", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await deps.armazenamento.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_anexo_aprovacao", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });
  app.get(`${base}/aprovacoes/anexos/:arquivo/link`, async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_anexo_aprovacao", anexo(c));
    const baixar = c.req.query("baixar") === "1";
    return c.json({
      url: await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined),
      tipo: a.tipo,
      expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString(),
    });
  });
  app.post(`${base}/aprovacoes/anexos/:arquivo/tirar`, async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_anexo_aprovacao", { ...anexo(c), p_motivo: d.motivo }));
  });
}

/** O link do conselheiro, sem conta (/conselho/<código>, quadros 415 e 416). */
export function rotasConselhoPublico<E extends Env>(app: Hono<E>, deps: DepsAprovacoes) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const codigo = async (c: Context<E>) => {
    const v = deps.codigoDaRota(c);
    await deps.limitar(c);
    return v;
  };
  app.get("/v1/publico/conselho/:codigo", async (c) => c.json(await rpc("publico_conselho", { p_codigo: await codigo(c) })));
  app.post("/v1/publico/conselho/:codigo/voto", async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, votoSchema);
    return c.json(await rpc("publico_votar_conselho", { p_codigo: k, p_escolha: d.escolha, p_justificativa: d.justificativa }));
  });
  // O subsíndico responde no lugar do síndico ausente.
  app.post("/v1/publico/conselho/:codigo/resposta", async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, respostaConselhoSchema);
    return c.json(await rpc("publico_responder_conselho", { p_codigo: k, p_aprovar: d.aprovar, p_alternativa: d.alternativa, p_justificativa: d.justificativa }));
  });
  app.get("/v1/publico/conselho/:codigo/arquivos/:arquivo", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_conselho_anexo", {
      p_codigo: await codigo(c), p_arquivo: idDaRota(c, "arquivo"),
    });
    return c.json({ url: await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S), nome: a.nome, tipo: a.tipo });
  });
}
