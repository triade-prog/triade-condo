// Portaria 1 · Encomendas (PA-01, PA-07 em parte, V-04 a V-06, CF-12, W-20, W-21, PT-01). Quem
// pode o quê, o cenário do prédio e quem recebe o aviso são decididos no banco (0299); aqui só se
// valida a entrada e se cuida das fotos, no bucket privado "portaria". O aviso pelo WhatsApp entra
// na fila do motor de mensagens que já existe, junto com o registro.

import type { Context, Env, Hono } from "hono";
import {
  buscaEncomendasSchema,
  corrigirEncomendaSchema,
  entregarEncomendaSchema,
  enviarFotoEncomendaSchema,
  ErroDominio,
  lugarEncomendaSchema,
  outroMeioSchema,
  portariaSchema,
  registrarEncomendaSchema,
  VALIDADE_LINK_ARQUIVO_S,
  type TipoArquivo,
} from "@triade/domain";
import { verificarArquivo, type Armazenamento } from "../_shared/arquivos.ts";
import type { Banco } from "../_shared/banco.ts";
import { idDaRota, type Quem } from "../_shared/rotas_configuracao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export interface DepsEncomendas {
  banco: Banco;
  /** Fotos da etiqueta e da retirada: só no painel, nunca na mensagem. */
  armazenamento?: Armazenamento;
}

export function rotasEncomendas<E extends Env>(app: Hono<E>, base: string, quem: (c: Context<E>) => Quem, deps: DepsEncomendas) {
  const rpc = deps.banco.rpc.bind(deps.banco);
  const consulta = <T extends typeof buscaEncomendasSchema>(c: Context<E>, schema: T) => {
    const r = schema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return r.data;
  };
  const guarda = () => {
    if (!deps.armazenamento) throw new ErroDominio("INTERNAL_ERROR");
    return deps.armazenamento;
  };
  const id = (c: Context<E>) => ({ ...quem(c), p_id: idDaRota(c, "id") });

  // A lista com as abas, os atalhos e a busca pela unidade.
  app.get(`${base}/encomendas`, async (c) => {
    const q = consulta(c, buscaEncomendasSchema);
    return c.json(await rpc("plataforma_encomendas", {
      ...quem(c), p_aba: q.aba, p_atalho: q.atalho ?? null, p_busca: q.busca ?? null, p_pagina: q.pagina,
    }));
  });
  app.get(`${base}/encomendas/opcoes`, async (c) => c.json(await rpc("plataforma_encomenda_opcoes", quem(c))));
  // Quem fica sabendo e quem pode retirar: nomes, sem telefone.
  app.get(`${base}/encomendas/unidades/:id/quem`, async (c) =>
    c.json(await rpc("plataforma_encomenda_quem", { ...quem(c), p_unidade: idDaRota(c, "id") })));
  app.get(`${base}/encomendas/unidades/:id`, async (c) =>
    c.json(await rpc("plataforma_encomendas_unidade", { ...quem(c), p_unidade: idDaRota(c, "id") })));

  // Registrar já põe o aviso na fila, para todos da unidade ao mesmo tempo.
  app.post(`${base}/encomendas`, async (c) => {
    const d = await lerCorpo(c, registrarEncomendaSchema);
    return c.json(await rpc("plataforma_registrar_encomenda", {
      ...quem(c), p_unidade: d.unidadeId, p_remetente: d.remetente, p_volumes: d.volumes, p_lugar: d.lugarId, p_observacao: d.observacao,
    }), 201);
  });
  app.post(`${base}/encomendas/:id/entregar`, async (c) => {
    const d = await lerCorpo(c, entregarEncomendaSchema);
    return c.json(await rpc("plataforma_entregar_encomenda", { ...id(c), p_contato: d.contatoId, p_nome: d.nome, p_ligacao: d.ligacao }));
  });
  app.post(`${base}/encomendas/:id/avisar`, async (c) => c.json(await rpc("plataforma_avisar_encomenda", id(c))));
  app.post(`${base}/encomendas/:id/outro-meio`, async (c) => {
    const d = await lerCorpo(c, outroMeioSchema);
    return c.json(await rpc("plataforma_avisei_encomenda", { ...id(c), p_meio: d.meio, p_com: d.com }));
  });
  app.put(`${base}/encomendas/:id`, async (c) => {
    const d = await lerCorpo(c, corrigirEncomendaSchema);
    return c.json(await rpc("plataforma_corrigir_encomenda", {
      ...id(c), p_versao: d.versao, p_unidade: d.unidadeId, p_remetente: d.remetente, p_volumes: d.volumes, p_lugar: d.lugarId,
      p_observacao: d.observacao,
    }));
  });

  // Fotos: o navegador manda direto ao armazenamento; aqui se confere o conteúdo antes de liberar.
  const foto = (c: Context<E>) => ({ ...id(c), p_foto: idDaRota(c, "foto") });
  app.post(`${base}/encomendas/:id/fotos`, async (c) => {
    const d = await lerCorpo(c, enviarFotoEncomendaSchema);
    const r = await rpc<{ fotoId: string; caminho: string; tipo: string }>("plataforma_iniciar_foto_encomenda", {
      ...id(c), p_tipo: d.tipoFoto, p_nome: d.nome, p_mime: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ fotoId: r.fotoId, envio: { url: await guarda().linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });
  app.post(`${base}/encomendas/:id/fotos/:foto/verificar`, async (c) => {
    const ids = foto(c);
    const g = guarda();
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_foto_encomenda_a_verificar", ids);
    const bytes = await g.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "A foto não chegou. Envie de novo." };
    if (r.ok) {
      await g.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_foto_encomenda", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await g.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_foto_encomenda", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });
  app.get(`${base}/encomendas/:id/fotos/:foto/link`, async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_foto_encomenda", foto(c));
    return c.json({
      url: await guarda().linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S),
      tipo: a.tipo,
      expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString(),
    });
  });

  // Configurações › Prédio › Portaria (CF-12).
  app.get(`${base}/portaria`, async (c) => c.json(await rpc("plataforma_portaria", quem(c))));
  app.put(`${base}/portaria`, async (c) => {
    const d = await lerCorpo(c, portariaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_portaria", {
        ...quem(c), p_versao: d.versao, p_lembrete_ligado: d.lembreteLigado, p_lembrete_dias: d.lembreteDias, p_sindico: d.sindicoIndicado,
      }),
    });
  });
  app.post(`${base}/portaria/lugares`, async (c) => {
    const d = await lerCorpo(c, lugarEncomendaSchema);
    return c.json(await rpc("plataforma_salvar_lugar_encomenda", { ...quem(c), p_id: null, p_versao: null, p_nome: d.nome, p_ativo: d.ativo }), 201);
  });
  app.put(`${base}/portaria/lugares/:id`, async (c) => {
    const d = await lerCorpo(c, lugarEncomendaSchema);
    if (d.versao === null) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return c.json(await rpc("plataforma_salvar_lugar_encomenda", { ...id(c), p_versao: d.versao, p_nome: d.nome, p_ativo: d.ativo }));
  });
}
