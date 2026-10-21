// Rotas das Configurações do condomínio que o app e o Console usam juntos (CF-01, CF-12, PI-04;
// decisão 7 do desenho "Configuração na implantação"): as mesmas validações e as mesmas funções
// do banco. Quem pode mudar é decidido lá: o síndico e quem tem Configurar, ou a equipe da
// implantação enquanto o cliente está em implantação.

import type { Context, Env, Hono } from "hono";
import {
  areaSchema,
  avisoNovoSchema,
  categoriaSchema,
  configWhatsappSchema,
  ErroDominio,
  etiquetaSchema,
  feriadoSchema,
  horariosSchema,
  modeloRespostaSchema,
  motivoEtiquetaSchema,
  muralEmailSchema,
  planoComunicacaoSchema,
  prazoSchema,
  prioridadeSchema,
  regrasAvisoSchema,
  responsavelQuedasSchema,
  TIPOS_HORARIO,
  versaoSchema,
} from "@triade/domain";
import type { Banco } from "./banco.ts";
import { lerCorpo } from "./validar.ts";

/** Pessoa e condomínio que vão em toda chamada ao banco. */
export type Quem = { p_pessoa: string; p_condominio: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de rota: fora do formato, responde como não encontrado. */
export function idDaRota(c: Context, nome: string): string {
  const id = c.req.param(nome);
  if (!id || !UUID.test(id)) throw new ErroDominio("NOT_FOUND");
  return id.toLowerCase();
}

/**
 * Registra as rotas debaixo de `prefixo` ("/v1/condominio" no app; "/v1/clientes/:id/condominio"
 * no Console). `aoLigarEmail` roda quando o e-mail dos comunicados é ligado (a fila sai na hora).
 */
export function rotasConfiguracao<E extends Env>(
  app: Hono<E>,
  prefixo: string,
  quem: (c: Context<E>) => Quem,
  banco: Banco,
  opcoes: { aoLigarEmail?: () => void } = {},
) {
  const rpc = banco.rpc.bind(banco);

  // Todas de uma vez (CF-06, CF-08, CF-10, AT-10).
  app.get(`${prefixo}/configuracoes`, async (c) => c.json(await rpc("plataforma_configuracoes", quem(c))));

  app.put(`${prefixo}/horarios/:tipo`, async (c) => {
    const tipo = (c.req.param("tipo") ?? "").toUpperCase();
    if (!(tipo in TIPOS_HORARIO)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, horariosSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_horarios", { ...quem(c), p_tipo: tipo, p_versao: d.versao, p_intervalos: d.intervalos }),
    });
  });

  app.post(`${prefixo}/feriados`, async (c) => {
    const d = await lerCorpo(c, feriadoSchema);
    return c.json({ id: await rpc<string>("plataforma_incluir_feriado", { ...quem(c), p_data: d.data, p_descricao: d.descricao }) }, 201);
  });

  app.post(`${prefixo}/feriados/:feriado/remover`, async (c) => {
    await rpc("plataforma_remover_feriado", { ...quem(c), p_feriado: idDaRota(c, "feriado") });
    return c.json({ ok: true });
  });

  // Categorias, prioridades, modelos e prazos (CF-08): POST cria, PUT altera com a versão. As
  // etapas dos pedidos são da TRÍADE e ficam no Console.
  const itens = {
    categorias: { schema: categoriaSchema, funcao: "plataforma_salvar_categoria",
      args: (d: ReturnType<typeof categoriaSchema.parse>) => ({ p_nome: d.nome, p_ativa: d.ativa ?? null }) },
    prioridades: { schema: prioridadeSchema, funcao: "plataforma_salvar_prioridade",
      args: (d: ReturnType<typeof prioridadeSchema.parse>) => ({ p_nome: d.nome, p_significado: d.significado, p_ativa: d.ativa ?? null }) },
    modelos: { schema: modeloRespostaSchema, funcao: "plataforma_salvar_modelo",
      args: (d: ReturnType<typeof modeloRespostaSchema.parse>) => ({ p_titulo: d.titulo, p_texto: d.texto, p_categoria: d.categoriaId ?? null, p_ativo: d.ativo ?? null }) },
    prazos: { schema: prazoSchema, funcao: "plataforma_salvar_prazo",
      args: (d: ReturnType<typeof prazoSchema.parse>) => ({ p_categoria: d.categoriaId ?? null, p_prioridade: d.prioridadeId ?? null, p_horas: d.horas }) },
  } as const;
  for (const [rota, item] of Object.entries(itens)) {
    // deno-lint-ignore no-explicit-any
    const salvar = async (c: Context<E>, id: string | null, d: any) =>
      await rpc<{ id: string; versao: number }>(item.funcao, { ...quem(c), p_id: id, p_versao: id ? d.versao : null, ...item.args(d) });
    app.post(`${prefixo}/${rota}`, async (c) => c.json(await salvar(c, null, await lerCorpo(c, item.schema)), 201));
    app.put(`${prefixo}/${rota}/:item`, async (c) => {
      const id = idDaRota(c, "item");
      const d = await lerCorpo(c, item.schema);
      if (!d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
      return c.json(await salvar(c, id, d));
    });
  }

  app.post(`${prefixo}/prazos/:item/remover`, async (c) => {
    const d = await lerCorpo(c, versaoSchema);
    await rpc("plataforma_remover_prazo", { ...quem(c), p_id: idDaRota(c, "item"), p_versao: d.versao });
    return c.json({ ok: true });
  });

  // Regras de aviso (F6.2) e pedido novo (F6.4).
  app.put(`${prefixo}/regras-aviso`, async (c) => {
    const d = await lerCorpo(c, regrasAvisoSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_avisos", {
        ...quem(c), p_versao: d.versao, p_sindico_horas: d.sindicoHoras, p_substituto_horas: d.substitutoHoras,
        p_substituto: d.substitutoId, p_sem_responsavel_horas: d.semResponsavelHoras, p_pendencia_dias: d.pendenciaDias,
      }),
    });
  });

  app.put(`${prefixo}/regras-aviso-novo`, async (c) => {
    const d = await lerCorpo(c, avisoNovoSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_aviso_novo", { ...quem(c), p_versao: d.versao, p_sindico: d.sindico, p_protocolo: d.protocolo }),
    });
  });

  // Áreas comuns (VC-01).
  app.get(`${prefixo}/areas-comuns`, async (c) => c.json(await rpc("plataforma_areas_comuns", quem(c))));
  app.post(`${prefixo}/areas-comuns`, async (c) => {
    const { versao: _v, ...d } = await lerCorpo(c, areaSchema);
    return c.json(await rpc("plataforma_salvar_area", { ...quem(c), p_id: null, p_versao: null, p_dados: d }), 201);
  });
  app.put(`${prefixo}/areas-comuns/:area`, async (c) => {
    const id = idDaRota(c, "area");
    const { versao, ...d } = await lerCorpo(c, areaSchema);
    if (!versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return c.json(await rpc("plataforma_salvar_area", { ...quem(c), p_id: id, p_versao: versao, p_dados: d }));
  });

  // Etapas da manutenção (MP-02): todos leem; mudar é da TRÍADE, pelo Console.
  app.get(`${prefixo}/etapas-manutencao`, async (c) => c.json(await rpc("plataforma_etapas_manutencao", quem(c))));

  // Etiquetas por local (AT-30, V-11).
  app.get(`${prefixo}/links-qr`, async (c) => c.json(await rpc("plataforma_links_qr", quem(c))));
  app.get(`${prefixo}/locais`, async (c) => c.json(await rpc("plataforma_locais", quem(c))));
  app.get(`${prefixo}/etiquetas/:etiqueta`, async (c) => c.json(await rpc("plataforma_etiqueta", { ...quem(c), p_id: idDaRota(c, "etiqueta") })));
  const salvarEtiqueta = async (c: Context<E>, id: string | null) => {
    const d = await lerCorpo(c, etiquetaSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_etiqueta", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_local: d.local, p_onde: d.onde, p_recado: d.recado, p_recado_ate: d.recadoAte,
    });
  };
  app.post(`${prefixo}/etiquetas`, async (c) => c.json(await salvarEtiqueta(c, null), 201));
  app.put(`${prefixo}/etiquetas/:etiqueta`, async (c) => c.json(await salvarEtiqueta(c, idDaRota(c, "etiqueta"))));
  for (const [rota, funcao] of [["trocar-codigo", "plataforma_trocar_codigo_etiqueta"], ["desativar", "plataforma_desativar_etiqueta"]] as const) {
    app.post(`${prefixo}/etiquetas/:etiqueta/${rota}`, async (c) => {
      const d = await lerCorpo(c, motivoEtiquetaSchema);
      return c.json(await rpc(funcao, { ...quem(c), p_id: idDaRota(c, "etiqueta"), p_versao: d.versao, p_motivo: d.motivo }));
    });
  }

  // Plano de comunicação (CD-11), mural e e-mail (CD-12, CD-13).
  app.get(`${prefixo}/plano-comunicacao`, async (c) => c.json(await rpc("plataforma_plano_comunicacao", quem(c))));
  app.put(`${prefixo}/plano-comunicacao`, async (c) => {
    const d = await lerCorpo(c, planoComunicacaoSchema);
    const versao = await rpc<number>("plataforma_definir_plano_comunicacao", {
      ...quem(c), p_versao: d.versao, p_assuntos: d.assuntos, p_plano: d.plano, p_assinatura: d.assinatura,
      p_silencio_inicio: d.silencioInicio, p_silencio_fim: d.silencioFim,
    });
    return c.json({ versao });
  });
  app.put(`${prefixo}/mural-email`, async (c) => {
    const d = await lerCorpo(c, muralEmailSchema);
    const r = await rpc("plataforma_definir_mural_email", {
      ...quem(c), p_versao: d.versao, p_mural_ligado: d.muralLigado, p_mural_assuntos: d.muralAssuntos, p_email_ligado: d.emailLigado,
      p_responder_para: d.responderPara, p_documentos_no_mural: d.documentosNoMural, p_documentos_automatico: d.documentosAutomatico,
    });
    if (d.emailLigado) opcoes.aoLigarEmail?.();
    return c.json(r);
  });

  // WhatsApp nas Configurações (W-11, W-12): mensagem, categoria e prioridade, e quem cuida das quedas.
  app.get(`${prefixo}/whatsapp/config`, async (c) => c.json(await rpc("plataforma_config_whatsapp", quem(c))));
  app.put(`${prefixo}/whatsapp/config`, async (c) => {
    const d = await lerCorpo(c, configWhatsappSchema);
    return c.json({ versao: await rpc("plataforma_definir_whatsapp", {
      ...quem(c), p_versao: d.versao, p_fora_horario: d.foraHorario, p_categoria: d.categoriaId, p_prioridade: d.prioridadeId,
    }) });
  });
  app.put(`${prefixo}/whatsapp/config/quedas`, async (c) => {
    const d = await lerCorpo(c, responsavelQuedasSchema);
    return c.json(await rpc("plataforma_quedas_responsavel", { ...quem(c), p_versao: d.versao, p_responsavel: d.pessoaId }));
  });
}
