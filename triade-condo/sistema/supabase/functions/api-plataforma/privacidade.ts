// Privacidade e dados (F0.11; PT-11, PT-03, EM-08). O inventário, os prazos, a busca de uma
// pessoa, a remoção e a guarda legal são decididos no banco (0301_retencao_dados.sql); aqui só se
// valida a entrada, se monta a planilha de "Baixar tudo" e se apagam do armazenamento os arquivos
// que a rotina de retenção pôs na fila.

import type { Context, Env, Hono } from "hono";
import {
  buscaDadosPessoaSchema,
  csvDadosPessoa,
  ENTIDADES_GUARDA,
  ErroDominio,
  guardarSchema,
  removerDadosPessoaSchema,
  tirarGuardaSchema,
} from "@triade/domain";
import type { Armazenamento } from "../_shared/arquivos.ts";
import type { Banco } from "../_shared/banco.ts";
import { registrar } from "../_shared/registro.ts";
import { idDaRota, type Quem } from "../_shared/rotas_configuracao.ts";
import { lerCorpo } from "../_shared/validar.ts";

/** Os buckets privados de onde a rotina apaga arquivos, com o armazenamento de cada um. */
export type BucketRetencao = "pedidos" | "manutencoes" | "comunicados" | "documentos" | "exportacoes" | "suporte" | "relatorios" | "portaria";

export interface DepsPrivacidade {
  banco: Banco;
  /** Sem o armazenamento de um bucket, o arquivo fica na fila com o erro e é tentado de novo. */
  armazenamentos?: Partial<Record<BucketRetencao, Armazenamento>>;
}

/** Até 5 lotes de 50 arquivos por chamada do banco (pg_cron + pg_net, a cada 15 minutos). */
const LOTE_ARQUIVOS = 50;
const LOTES_POR_CHAMADA = 5;

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Instante do banco em DD/MM/AAAA HH:mm, no horário de Brasília. */
export function dataHoraBrasilia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(DATA_HORA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** AAAA-MM-DD no horário de Brasília, para o nome do arquivo. */
function diaBrasilia(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(Number.isNaN(d.getTime()) ? new Date() : d);
}

export function rotasPrivacidade<E extends Env>(app: Hono<E>, base: string, quem: (c: Context<E>) => Quem, deps: DepsPrivacidade) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const contato = (c: Context<E>) => ({ ...quem(c), p_contato: idDaRota(c, "id") });

  // O inventário dos tipos, o modo da rotina, o que vence e o que está guardado.
  app.get(`${base}/privacidade`, async (c) => c.json(await rpc("plataforma_privacidade", quem(c))));

  // POST de propósito: o telefone e o e-mail não vão no endereço nem no registro de acesso.
  app.post(`${base}/privacidade/dados-pessoa`, async (c) => {
    const d = await lerCorpo(c, buscaDadosPessoaSchema);
    return c.json(await rpc("plataforma_dados_pessoa", { ...quem(c), p_busca: d.busca }));
  });

  // Baixar tudo: a planilha com o que a pessoa tem no condomínio (fica no histórico).
  app.get(`${base}/privacidade/dados-pessoa/:id/planilha`, async (c) => {
    const r = await rpc<{ geradoEm: string; linhas: Array<{ parte: string; quando: string | null; o_que: string | null }> }>(
      "plataforma_dados_pessoa_exportar", contato(c),
    );
    const csv = csvDadosPessoa((r.linhas ?? []).map((l) => ({ parte: l.parte, quando: dataHoraBrasilia(l.quando), o_que: l.o_que })));
    return new Response(`﻿${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="dados-pessoa-${diaBrasilia(r.geradoEm)}.csv"`,
        "cache-control": "no-store",
      },
    });
  });

  app.post(`${base}/privacidade/dados-pessoa/:id/remover`, async (c) => {
    const ids = contato(c);
    const d = await lerCorpo(c, removerDadosPessoaSchema);
    return c.json(await rpc("plataforma_remover_dados_pessoa", { ...ids, p_versao: d.versao, p_motivo: d.motivo }));
  });

  // Guarda por obrigação legal (processo, sinistro, autoridade): o prazo não apaga o item.
  app.post(`${base}/privacidade/guardas`, async (c) => {
    const d = await lerCorpo(c, guardarSchema);
    return c.json(await rpc("plataforma_guardar", {
      ...quem(c), p_entidade: d.entidade, p_alvo: d.alvoId, p_motivo: d.motivo, p_detalhe: d.detalhe,
    }), 201);
  });

  app.post(`${base}/privacidade/guardas/:id/tirar`, async (c) => {
    const guarda = idDaRota(c, "id");
    const d = await lerCorpo(c, tirarGuardaSchema);
    await rpc("plataforma_tirar_guarda", { ...quem(c), p_guarda: guarda, p_versao: d.versao, p_motivo: d.motivo });
    return c.json({ ok: true });
  });

  // O selo "Guardado" na ficha do pedido, da manutenção, da encomenda ou da pessoa.
  app.get(`${base}/privacidade/guardas/:entidade/:id`, async (c) => {
    const entidade = c.req.param("entidade") ?? "";
    if (!Object.hasOwn(ENTIDADES_GUARDA, entidade)) throw new ErroDominio("NOT_FOUND");
    const alvo = idDaRota(c, "id");
    return c.json({ guarda: (await rpc("plataforma_guarda", { ...quem(c), p_entidade: entidade, p_alvo: alvo })) ?? null });
  });

  // O banco chama (pg_cron + pg_net, com o segredo de repasse) quando há arquivo vencido na fila.
  app.post("/v1/interno/retencao-arquivos", async (c) => c.json(await apagarArquivos()));

  /** Apaga os arquivos da fila, bucket por bucket; arquivo que já não existe conta como apagado. */
  async function apagarArquivos(): Promise<{ apagados: number; erros: number }> {
    let apagados = 0;
    let erros = 0;
    const vistos = new Set<number>();
    for (let lote = 0; lote < LOTES_POR_CHAMADA; lote++) {
      const fila = await rpc<Array<{ id: number; bucket: string; caminho: string }>>("retencao_arquivos_pendentes", { p_limite: LOTE_ARQUIVOS });
      // O que falhou volta na fila; nesta chamada cada arquivo é tentado uma vez só.
      const novos = (fila ?? []).filter((a) => !vistos.has(a.id));
      if (novos.length === 0) break;
      for (const a of novos) {
        vistos.add(a.id);
        let erro: string | null = null;
        const guarda = deps.armazenamentos?.[a.bucket as BucketRetencao];
        if (!guarda) {
          erro = "Armazenamento não configurado";
        } else {
          try {
            await guarda.apagar(a.caminho);
          } catch (e) {
            erro = String(e instanceof Error ? e.message : e).slice(0, 200) || "Falha ao apagar";
            registrar("erro", { funcao: "api-plataforma", rota: "retencao-arquivos", bucket: a.bucket, erro: e });
          }
        }
        await rpc("retencao_arquivo_resultado", { p_id: a.id, p_erro: erro });
        if (erro) erros++;
        else apagados++;
      }
      if (fila.length < LOTE_ARQUIVOS) break;
    }
    return { apagados, erros };
  }
}
