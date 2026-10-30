// Orçamentos e compras (peça R8): pedir propostas a fornecedores pelo link sem conta (OC-03),
// comparar (OC-02), decidir com o motivo (OC-06), as regras por faixa (OC-05), a compra e a entrega
// (OC-01) e o prestador que nasce da cotação (OC-10). Quem pode o quê, os estados e as regras são
// decididos no banco (0317); aqui só se valida a entrada, se cuida dos anexos e do PDF da proposta,
// se esvazia a fila do e-mail e se monta a mensagem pronta do WhatsApp (sem modelo aprovado, a tela
// abre o WhatsApp de quem manda com o texto e o link).

import type { Context, Env, Hono } from "hono";
import {
  aceitarPublicoSchema,
  aceiteForaSchema,
  alterarOrcamentoSchema,
  cancelarOrcamentoSchema,
  caminhoLinkOrcamento,
  confirmarPrecoSchema,
  convidarSchema,
  criarOrcamentoSchema,
  enviarAnexoOrcamentoSchema,
  ErroDominio,
  escolherPropostaSchema,
  estenderPrazoSchema,
  filtroOrcamentosSchema,
  mensagemConvite,
  propostaPublicaSchema,
  recusarPublicoSchema,
  regrasOrcamentoSchema,
  registrarCompraSchema,
  registrarEntregaSchema,
  revogarConviteSchema,
  tirarArquivoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  versaoSchema,
  type Convite,
  type TipoArquivo,
} from "@triade/domain";
import { verificarArquivo, type Armazenamento } from "../_shared/arquivos.ts";
import type { Banco } from "../_shared/banco.ts";
import { idDaRota, type Quem } from "../_shared/rotas_configuracao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export interface DepsOrcamentos {
  banco: Banco;
  /** Bucket privado "pedidos": os anexos do orçamento e o PDF da proposta ficam ao lado dos arquivos do pedido. */
  armazenamento: Armazenamento;
  /** O convite pelo e-mail entrou na fila: manda agora. */
  esvaziarFila: () => void;
  /** O código do link sem conta, conferido no formato (fora dele, não encontrado). */
  codigoDaRota: (c: Context) => string;
  /** Limite de uso por aparelho das rotas sem conta. */
  limitar: (c: Context) => Promise<void>;
  /** Endereço da Plataforma, para o link /o/<código> da mensagem pronta. */
  urlApp: string;
}

/** O que o banco devolve para cada convite mandado (mandar_convite). */
export interface LinkConvite {
  conviteId: string;
  nome: string;
  canal: "WHATSAPP" | "EMAIL";
  letra: string;
  envio: "EMAIL" | "COPIAR";
  codigo?: string;
  mensagem: { quem: string; cargo: string; condominio: string; titulo: string; prazo: string };
  /** Só no envio COPIAR: o link do fornecedor e a mensagem pronta para o WhatsApp (quadro 475). */
  link?: string;
  texto?: string;
}

/** Completa o link para copiar com o endereço e a mensagem pronta; o do e-mail só esvazia a fila. */
export function completarLink(l: LinkConvite, urlApp: string): LinkConvite {
  if (l.envio !== "COPIAR" || !l.codigo) return l;
  const link = `${urlApp.replace(/\/$/, "")}${caminhoLinkOrcamento(l.codigo)}`;
  return { ...l, link, texto: mensagemConvite({ ...l.mensagem, link }) };
}

/** Algum convite foi pelo e-mail: a fila sai na hora. */
export function algumConvitePorEmail(links: (LinkConvite | null | undefined)[]): boolean {
  return links.some((l) => l?.envio === "EMAIL");
}

/** O convite como o banco o lê (convite_da_entrada). */
const convites = (lista: Convite[]) => lista.map((x) => ({ prestadorId: x.prestadorId, nome: x.nome, canal: x.canal, celular: x.celular, email: x.email }));

export function rotasOrcamentos<E extends Env>(app: Hono<E>, base: string, quem: (c: Context<E>) => Quem, deps: DepsOrcamentos) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const id = (c: Context<E>) => ({ ...quem(c), p_id: idDaRota(c, "id") });
  const convite = (c: Context<E>) => ({ ...id(c), p_convite: idDaRota(c, "convite") });
  const links = (lista: LinkConvite[] | undefined) => {
    const l = (lista ?? []).map((x) => completarLink(x, deps.urlApp));
    if (algumConvitePorEmail(l)) deps.esvaziarFila();
    return l;
  };
  const umLink = <T extends { link?: LinkConvite }>(r: T): T => (r.link ? { ...r, link: links([r.link])[0] } : r);

  // ---------------------------------------------------------------------------------------
  // Lista, opções, ficha (quadros 470, 471 e 474).

  app.get(`${base}/orcamentos`, async (c) => {
    const r = filtroOrcamentosSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["filtro"] });
    return c.json(await rpc("plataforma_orcamentos", { ...quem(c), p_filtro: r.data.filtro }));
  });
  app.get(`${base}/orcamentos/opcoes`, async (c) => c.json(await rpc("plataforma_orcamento_opcoes", quem(c))));
  app.get(`${base}/orcamentos/:id`, async (c) => c.json(await rpc("plataforma_orcamento", id(c))));
  app.get(`${base}/orcamentos/:id/comparacao`, async (c) => c.json(await rpc("plataforma_comparacao", id(c))));

  // ---------------------------------------------------------------------------------------
  // Pedir (quadros 471, 472 e 475), mudar, convidar, mandar.

  app.post(`${base}/orcamentos`, async (c) => {
    const d = await lerCorpo(c, criarOrcamentoSchema);
    const r = await rpc<{ id: string; versao: number; estado: string; links: LinkConvite[] }>("plataforma_criar_orcamento", {
      ...quem(c), p_titulo: d.titulo, p_descricao: d.descricao, p_local: d.local, p_tipo: d.tipo, p_manutencao: d.manutencaoId, p_pedido: d.pedidoId,
      p_valor_estimado: d.valorEstimado, p_prazo: d.prazoPropostas, p_validade: d.validadeMinimaDias, p_convites: convites(d.convites), p_mandar: d.mandar,
    });
    return c.json({ ...r, links: links(r.links) }, 201);
  });
  app.put(`${base}/orcamentos/:id`, async (c) => {
    const d = await lerCorpo(c, alterarOrcamentoSchema);
    return c.json(await rpc("plataforma_alterar_orcamento", {
      ...id(c), p_versao: d.versao, p_titulo: d.titulo, p_descricao: d.descricao, p_local: d.local, p_valor_estimado: d.valorEstimado,
    }));
  });
  app.post(`${base}/orcamentos/:id/convites`, async (c) => {
    const d = await lerCorpo(c, convidarSchema);
    const r = await rpc<{ links: LinkConvite[]; versao: number }>("plataforma_convidar", { ...id(c), p_convites: convites(d.convites) });
    return c.json({ ...r, links: links(r.links) });
  });
  app.post(`${base}/orcamentos/:id/mandar`, async (c) => {
    const d = await lerCorpo(c, versaoSchema);
    const r = await rpc<{ versao: number; estado: string; links: LinkConvite[] }>("plataforma_mandar_orcamento", { ...id(c), p_versao: d.versao });
    return c.json({ ...r, links: links(r.links) });
  });
  app.post(`${base}/orcamentos/:id/convites/:convite/reenviar`, async (c) =>
    c.json(umLink(await rpc<{ link?: LinkConvite }>("plataforma_reenviar_convite", convite(c)))));
  app.post(`${base}/orcamentos/:id/convites/:convite/revogar`, async (c) => {
    const d = await lerCorpo(c, revogarConviteSchema);
    return c.json(await rpc("plataforma_revogar_convite", { ...convite(c), p_motivo: d.motivo }));
  });
  app.post(`${base}/orcamentos/:id/convites/:convite/pedir-confirmacao`, async (c) =>
    c.json(umLink(await rpc<{ link?: LinkConvite }>("plataforma_pedir_confirmacao_preco", convite(c)))));

  // ---------------------------------------------------------------------------------------
  // O prazo (quadro 473), decidir (quadro 481), aceite, compra e entrega (quadro 482), cancelar.

  app.post(`${base}/orcamentos/:id/estender`, async (c) => {
    const d = await lerCorpo(c, estenderPrazoSchema);
    return c.json(await rpc("plataforma_estender_prazo", { ...id(c), p_versao: d.versao, p_prazo: d.prazoPropostas }));
  });
  app.post(`${base}/orcamentos/:id/fechar`, async (c) => {
    const d = await lerCorpo(c, versaoSchema);
    return c.json(await rpc("plataforma_fechar_propostas", { ...id(c), p_versao: d.versao }));
  });
  app.post(`${base}/orcamentos/:id/escolher`, async (c) => {
    const d = await lerCorpo(c, escolherPropostaSchema);
    const r = await rpc<{ links?: { envio?: string }[] }>("plataforma_escolher_proposta", {
      ...id(c), p_versao: d.versao, p_proposta: d.propostaId, p_motivo: d.motivo, p_quem_aprova: d.quemAprova,
    });
    // Ao conselho: os links dos membros pelo e-mail saem na hora (a fila do WhatsApp roda a cada minuto).
    if ((r.links ?? []).some((l) => l?.envio === "EMAIL")) deps.esvaziarFila();
    return c.json(r);
  });
  app.post(`${base}/orcamentos/:id/desfazer-escolha`, async (c) => {
    const d = await lerCorpo(c, versaoSchema);
    return c.json(await rpc("plataforma_desfazer_escolha", { ...id(c), p_versao: d.versao }));
  });
  app.post(`${base}/orcamentos/:id/aceite-fora`, async (c) => {
    const d = await lerCorpo(c, aceiteForaSchema);
    return c.json(await rpc("plataforma_aceite_fora_do_link", { ...id(c), p_versao: d.versao, p_data: d.data }));
  });
  app.post(`${base}/orcamentos/:id/compra`, async (c) => {
    const d = await lerCorpo(c, registrarCompraSchema);
    return c.json(await rpc("plataforma_registrar_compra", { ...id(c), p_versao: d.versao, p_data: d.data, p_valor: d.valorFechado }));
  });
  app.post(`${base}/orcamentos/:id/entrega`, async (c) => {
    const d = await lerCorpo(c, registrarEntregaSchema);
    return c.json(await rpc("plataforma_registrar_entrega", { ...id(c), p_versao: d.versao, p_data: d.data, p_parcial: d.parcial, p_obs: d.observacao }));
  });
  app.post(`${base}/orcamentos/:id/cancelar`, async (c) => {
    const d = await lerCorpo(c, cancelarOrcamentoSchema);
    return c.json(await rpc("plataforma_cancelar_orcamento", { ...id(c), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // ---------------------------------------------------------------------------------------
  // Regras (quadro 484).

  app.get(`${base}/regras-orcamento`, async (c) => c.json(await rpc("plataforma_regras_orcamento", quem(c))));
  app.put(`${base}/regras-orcamento`, async (c) => {
    const d = await lerCorpo(c, regrasOrcamentoSchema);
    return c.json(await rpc("plataforma_salvar_regras_orcamento", {
      ...quem(c), p_versao: d.versao, p_ligada: d.ligada, p_faixas: d.faixas, p_abaixo_minimo: d.abaixoMinimo, p_prazo_dias: d.prazoDias,
      p_validade_dias: d.validadeDias, p_link_dias: d.linkDias, p_alcada: d.alcadaConselho,
    }));
  });

  // ---------------------------------------------------------------------------------------
  // Anexos do pedido e a nota fiscal: o navegador manda direto ao armazenamento; aqui se confere o
  // conteúdo antes de liberar.

  app.post(`${base}/orcamentos/:id/anexos`, async (c) => {
    const d = await lerCorpo(c, enviarAnexoOrcamentoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_anexo_orcamento", {
      ...id(c), p_parte: d.parte, p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await deps.armazenamento.linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });
  const anexo = (c: Context<E>) => ({ ...quem(c), p_arquivo: idDaRota(c, "arquivo") });
  app.post(`${base}/orcamentos/anexos/:arquivo/verificar`, async (c) => {
    const ids = anexo(c);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_anexo_orcamento_a_verificar", ids);
    return c.json(await verificar(deps.armazenamento, a, (x) => rpc("plataforma_verificar_anexo_orcamento", { ...ids, ...x })));
  });
  app.get(`${base}/orcamentos/anexos/:arquivo/link`, async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_anexo_orcamento", anexo(c));
    const baixar = c.req.query("baixar") === "1";
    return c.json({
      url: await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined),
      tipo: a.tipo,
      expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString(),
    });
  });
  app.post(`${base}/orcamentos/anexos/:arquivo/tirar`, async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_anexo_orcamento", { ...anexo(c), p_motivo: d.motivo }));
  });
}

/** Confere o arquivo que chegou ao armazenamento: liberado, regrava limpo; recusado, apaga. */
async function verificar(
  armazenamento: Armazenamento,
  a: { caminho: string; tipo: string },
  marcar: (x: { p_liberado: boolean; p_tamanho: number | null; p_motivo: string | null }) => Promise<unknown>,
) {
  const bytes = await armazenamento.ler(a.caminho);
  const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
  if (r.ok) {
    await armazenamento.gravar(a.caminho, r.bytes, a.tipo);
    return await marcar({ p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null });
  }
  if (bytes) await armazenamento.apagar(a.caminho);
  const fim = (await marcar({ p_liberado: false, p_tamanho: null, p_motivo: r.motivo })) as Record<string, unknown>;
  return { ...fim, motivo: r.motivo };
}

/** O link do fornecedor, sem conta (/o/<código>, quadros 476 a 478). */
export function rotasOrcamentoPublico<E extends Env>(app: Hono<E>, deps: DepsOrcamentos) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const codigo = async (c: Context<E>) => {
    const v = deps.codigoDaRota(c);
    await deps.limitar(c);
    return v;
  };
  const base = "/v1/publico/orcamento/:codigo";
  app.get(base, async (c) => c.json(await rpc("publico_orcamento", { p_codigo: await codigo(c) })));
  app.post(`${base}/recusar`, async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, recusarPublicoSchema);
    return c.json(await rpc("publico_recusar_orcamento", { p_codigo: k, p_motivo: d.motivo }));
  });
  app.post(`${base}/proposta`, async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, propostaPublicaSchema);
    return c.json(await rpc("publico_enviar_proposta", {
      p_codigo: k, p_valor: d.valor, p_frete_incluso: d.freteIncluso, p_frete: d.frete, p_marca_modelo: d.marcaModelo, p_prazo_execucao: d.prazoExecucao,
      p_garantia: d.garantia, p_valida_ate: d.validaAte, p_pagamento: d.pagamento, p_inclui: d.inclui, p_nao_inclui: d.naoInclui, p_pdf: d.pdfArquivoId,
    }));
  });
  app.post(`${base}/confirmar-preco`, async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, confirmarPrecoSchema);
    return c.json(await rpc("publico_confirmar_preco", { p_codigo: k, p_valida_ate: d.validaAte }));
  });
  app.post(`${base}/aceitar`, async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, aceitarPublicoSchema);
    return c.json(await rpc("publico_aceitar_orcamento", { p_codigo: k, p_nome: d.nome }));
  });
  // O PDF da proposta: iniciar, mandar ao armazenamento e verificar, com os mesmos limites.
  app.post(`${base}/pdf`, async (c) => {
    const k = await codigo(c);
    const d = await lerCorpo(c, enviarAnexoOrcamentoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("publico_iniciar_pdf_orcamento", {
      p_codigo: k, p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await deps.armazenamento.linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });
  app.post(`${base}/pdf/:arquivo/verificar`, async (c) => {
    const k = await codigo(c);
    const ids = { p_codigo: k, p_arquivo: idDaRota(c, "arquivo") };
    const a = await rpc<{ caminho: string; tipo: string }>("publico_pdf_orcamento_a_verificar", ids);
    return c.json(await verificar(deps.armazenamento, a, (x) => rpc("publico_verificar_pdf_orcamento", { ...ids, ...x })));
  });
  app.get(`${base}/arquivos/:arquivo`, async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_arquivo_orcamento", {
      p_codigo: await codigo(c), p_arquivo: idDaRota(c, "arquivo"),
    });
    return c.json({ url: await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S), nome: a.nome, tipo: a.tipo });
  });
}
