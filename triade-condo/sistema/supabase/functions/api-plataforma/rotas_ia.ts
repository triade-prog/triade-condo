// Ajuda da IA nos pedidos (IA-17, IA-15, IA-11 triagem, W-06), em cima do motor com freio (IA-20).
// O banco decide se pode (chave da TRÍADE, função ligada, limite do mês) e devolve o que vai para
// a IA; aqui o texto perde nome e telefone, o conector chama o provedor e o resultado volta ao
// banco com o que foi gasto. Nada disso muda o pedido: usar a sugestão é sempre um toque de alguém.

import type { Context, Env, Hono } from "hono";
import { decidirSugestaoSchema, duracaoOggOpus, limparTextoParaIa, sugestaoRegistroSchema } from "@triade/domain";
import type { Armazenamento } from "../_shared/arquivos.ts";
import type { Banco } from "../_shared/banco.ts";
import type { ConectorIa, ConectorTranscricao } from "../_shared/ia.ts";
import { registrar } from "../_shared/registro.ts";
import { idDaRota, type Quem } from "../_shared/rotas_configuracao.ts";
import { lerCorpo } from "../_shared/validar.ts";

export interface DepsIa {
  /** Os provedores que a função tem agora (sem a chave, nenhum: a sugestão fica indisponível). */
  sugerir: Record<string, ConectorIa>;
  /** Os serviços de transcrição. Sem nenhum, o áudio aparece só com o som. */
  transcrever: Record<string, ConectorTranscricao>;
}

interface EntradaBanco {
  texto: string;
  nomes: string[];
  categorias: { id: string; nome: string }[];
  prioridades: { id: string; nome: string; significado?: string | null; nivel?: number | null }[];
  provedor: string;
  modelo: string;
}
interface Pedida { sugestao?: { id: string; estado: string } | null; entrada?: EntradaBanco; indisponivel?: boolean }
interface TranscricaoIniciada { transcricao?: unknown; indisponivel?: boolean; id?: string; caminho?: string; tipo?: string; provedor?: string }

const decidirSchema = decidirSugestaoSchema.omit({ usar: true });

export function criarIa(banco: Banco, deps: DepsIa | undefined, armazenamento: Armazenamento, noFundo: (t: () => Promise<unknown>) => void) {
  const rpc = banco.rpc.bind(banco);
  const provedoresSugerir = () => Object.keys(deps?.sugerir ?? {});
  const provedoresTranscrever = () => Object.keys(deps?.transcrever ?? {});

  /** Faz a chamada quando o banco devolve a entrada; sem entrada, devolve o que o banco disse. */
  async function completar(c: Quem, r: Pedida): Promise<Pedida> {
    if (!r.entrada || !r.sugestao) return { sugestao: r.sugestao ?? null, indisponivel: r.indisponivel };
    const e = r.entrada;
    const conector = deps?.sugerir[e.provedor];
    const texto = limparTextoParaIa(e.texto, e.nomes);
    const res = conector
      ? await conector.sugerir(e.modelo, { texto, categorias: e.categorias, prioridades: e.prioridades }).catch(() => null)
      : null;
    const resultado = res
      ? {
        ok: res.ok, provedor: res.provedor, modelo: res.modelo, tokensEntrada: res.tokensEntrada, tokensSaida: res.tokensSaida,
        custoMicros: res.custoMicros, moeda: res.moeda, ...(res.sugestao ?? {}),
      }
      : { ok: false, provedor: e.provedor, modelo: e.modelo };
    if (res && !res.ok) registrar("aviso", { funcao: "api-plataforma", rota: "ia.sugerir", falha: res.falha ?? "PROVEDOR", provedor: res.provedor });
    const fim = await rpc<Pedida>("plataforma_resultado_sugestao", { ...c, p_sugestao: r.sugestao.id, p_resultado: resultado });
    return { sugestao: fim.sugestao ?? null };
  }

  /** Transcreve o áudio guardado; uma nova tentativa automática antes de marcar a falha. */
  async function transcrever(condominio: string, t: TranscricaoIniciada, bytes: Uint8Array | null, segundos: number | null) {
    if (!t.id || !t.provedor) return;
    const conector = deps?.transcrever[t.provedor];
    const audio = bytes ?? (t.caminho ? await armazenamento.ler(t.caminho) : null);
    let res = null;
    for (let tentativa = 0; tentativa < 2 && conector && audio; tentativa++) {
      res = await conector.transcrever(audio, t.tipo ?? "audio/ogg", segundos).catch(() => null);
      if (res?.ok) break;
    }
    if (!res?.ok) registrar("aviso", { funcao: "api-plataforma", rota: "ia.transcrever", falha: audio ? "PROVEDOR" : "AUDIO" });
    await rpc("whatsapp_resultado_transcricao", {
      p_condominio: condominio, p_transcricao: t.id,
      p_resultado: res ? { ok: res.ok, provedor: res.provedor, modelo: res.modelo, segundos: res.segundos, custoMicros: res.custoMicros, moeda: res.moeda, texto: res.texto }
        : { ok: false, provedor: t.provedor, modelo: "?" },
    });
  }

  return {
    /** Depois de guardar um áudio do WhatsApp (W-06): começa a transcrição, se o condomínio usa. */
    async aposGuardarAudio(condominio: string, mensagem: string, tipo: string, bytes: Uint8Array) {
      if (!tipo.startsWith("audio/") || !provedoresTranscrever().length) return;
      const segundos = tipo === "audio/ogg" ? duracaoOggOpus(bytes) : null;
      const t = await rpc<TranscricaoIniciada>("whatsapp_iniciar_transcricao", {
        p_condominio: condominio, p_mensagem: mensagem, p_provedores: provedoresTranscrever(), p_segundos: segundos,
      });
      await transcrever(condominio, t, bytes, segundos);
    },

    rotas<E extends Env>(app: Hono<E>, quem: (c: Context<E>) => Quem) {
      // O que a ficha mostra: a sugestão, as transcrições e se dá para pedir.
      app.get("/v1/condominio/pedidos/:id/ia", async (c) => c.json(await rpc("plataforma_ia_do_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

      // Pedir a sugestão do pedido (uma por pedido; a que já existe volta sem nova chamada).
      app.post("/v1/condominio/pedidos/:id/sugestao", async (c) => {
        const r = await rpc<Pedida>("plataforma_pedir_sugestao_pedido", { ...quem(c), p_id: idDaRota(c, "id"), p_provedores: provedoresSugerir() });
        return c.json(await completar(quem(c), r));
      });

      // No registro, antes de o pedido existir: nada é preenchido; quem registra decide.
      app.post("/v1/condominio/pedidos/sugestao", async (c) => {
        const d = await lerCorpo(c, sugestaoRegistroSchema);
        const r = await rpc<Pedida>("plataforma_pedir_sugestao_registro", {
          ...quem(c), p_assunto: d.assunto, p_relato: d.relato, p_local: d.local, p_unidade: d.unidadeId, p_provedores: provedoresSugerir(),
        });
        return c.json(await completar(quem(c), r));
      });

      for (const [rota, usar] of [["usar", true], ["recusar", false]] as const) {
        app.post(`/v1/condominio/pedidos/:id/sugestao/${rota}`, async (c) => {
          const d = await lerCorpo(c, decidirSchema);
          return c.json(await rpc("plataforma_decidir_sugestao", {
            ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_usar: usar, p_categoria: d.categoriaId, p_prioridade: d.prioridadeId, p_local: d.local,
          }));
        });
      }

      // Tentar de novo o áudio que não deu para transcrever (a falha não contou no limite).
      app.post("/v1/condominio/whatsapp/mensagens/:id/transcrever", async (c) => {
        const q = quem(c);
        const t = await rpc<TranscricaoIniciada>("plataforma_tentar_transcricao", {
          ...q, p_mensagem: idDaRota(c, "id"), p_provedores: provedoresTranscrever(), p_segundos: null,
        });
        if (t.id) noFundo(() => transcrever(q.p_condominio, t, null, null));
        return c.json({ transcricao: t.transcricao ?? null });
      });
    },

    /** Depois de registrar: a sugestão mostrada no formulário fica no histórico do pedido. */
    async noRegistro(q: Quem, sugestao: string | null, pedido: string | undefined) {
      if (!sugestao || !pedido) return;
      await rpc("plataforma_sugestao_no_registro", { ...q, p_sugestao: sugestao, p_pedido: pedido })
        .catch(() => registrar("aviso", { funcao: "api-plataforma", rota: "ia.registro", falha: "SUGESTAO" }));
    },
  };
}
