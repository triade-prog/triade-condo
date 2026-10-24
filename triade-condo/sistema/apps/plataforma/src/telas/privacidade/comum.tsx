"use client";
// Peças de Privacidade e dados (F0.11; quadros 350 a 359, aprovados em 24/10/2026): a guarda por
// obrigação legal, que se marca em Mais ações da ficha do pedido, da manutenção, da encomenda e
// em Dados de uma pessoa (quadro 355), o selo "Guardado" e a janela de tirar a marca, que também
// pede motivo e fica no histórico (PT-03, PT-11).

import { useState, type FormEvent, type ReactNode } from "react";
import { ENTIDADES_GUARDA, formatarData, MOTIVOS_GUARDA, type EntidadeGuarda, type GuardaLegal, type MotivoGuarda } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";

export const BASE_PRIVACIDADE = "/v1/condominio/privacidade";
export const ENDERECO_PRIVACIDADE = "/configuracoes/privacidade";
export const ENDERECO_DADOS_PESSOA = "/configuracoes/privacidade/pessoa";

/** O que a guarda segura, dito com o artigo: "deste pedido", "desta pessoa". */
const DESTE: Record<EntidadeGuarda, string> = {
  PEDIDO: "deste pedido", MANUTENCAO: "desta manutenção", ENCOMENDA: "desta encomenda", CONTATO: "desta pessoa",
};
const O_QUE_FICA: Record<EntidadeGuarda, string> = {
  PEDIDO: "As fotos, os arquivos e os dados das pessoas deste pedido não são apagados pelo prazo.",
  MANUTENCAO: "As fotos, os arquivos e os dados das pessoas desta manutenção não são apagados pelo prazo.",
  ENCOMENDA: "A foto da etiqueta e os nomes desta encomenda não são apagados pelo prazo.",
  CONTATO: "Os dados desta pessoa não são apagados pelo prazo, nem podem ser removidos enquanto a marca estiver aqui.",
};
const APOIO_MOTIVO: Partial<Record<MotivoGuarda, string>> = { AUTORIDADE: "Polícia, Ministério Público, Procon" };

/** Onde abre o item guardado (a encomenda não tem ficha: abre a Portaria). */
export function enderecoDoGuardado(g: Pick<GuardaLegal, "entidade" | "alvoId">): string | null {
  if (g.entidade === "PEDIDO") return `/pedidos/pedido?id=${g.alvoId}`;
  if (g.entidade === "MANUTENCAO") return `/manutencao/manutencao?id=${g.alvoId}`;
  if (g.entidade === "ENCOMENDA") return "/portaria?aba=ENTREGUES";
  return null;
}

export function tituloDoGuardado(g: GuardaLegal): string {
  return g.titulo ?? ENTIDADES_GUARDA[g.entidade];
}

/** "Guardado por Ana Souza em 02/09/2026". */
export function quemGuardou(g: GuardaLegal): string {
  const verbo = g.entidade === "PEDIDO" ? "Guardado" : "Guardada";
  return `${verbo}${g.guardadaPor ? ` por ${g.guardadaPor}` : ""} em ${formatarData(g.guardadaEm)}`;
}

/** O motivo numa linha: "Sinistro com o seguro (aberto na seguradora em 01/09)". */
export function motivoDoGuardado(g: GuardaLegal): string {
  return `${MOTIVOS_GUARDA[g.motivo]}${g.detalhe ? ` (${g.detalhe})` : ""}`;
}

/** O selo "Guardado" da ficha (violeta, com o cadeado). */
export function SeloGuardado({ guarda }: { guarda: GuardaLegal }) {
  return (
    <span title={`${quemGuardou(guarda)} · ${motivoDoGuardado(guarda)}`}>
      <Selo tom="andamento"><Icone nome="cadeado" className="h-3.5 w-3.5" />Guardado</Selo>
    </span>
  );
}

/** Guardar por obrigação legal (quadro 355): o motivo e um detalhe, que aparece para quem abrir a ficha. */
export function JanelaGuardar({ entidade, alvoId, titulo, apoio, aoFechar, aoGuardar }: {
  entidade: EntidadeGuarda; alvoId: string; titulo: string; apoio?: string; aoFechar: () => void; aoGuardar: (g: GuardaLegal) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoGuarda | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const detalheCurto = motivo === "OUTRO" && detalhe.trim().length < 3;

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!motivo) return setFaltaMotivo(true);
    if (detalheCurto) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["detalhe"] } });
    setEnviando(true);
    const r = await chamarApi<GuardaLegal>(`${BASE_PRIVACIDADE}/guardas`, { corpo: { entidade, alvoId, motivo, detalhe: detalhe.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoGuardar(r.dados);
  }

  const soCampos = erro && camposComErro(erro).length && erro.codigo === "VALIDATION_ERROR" && !erro.detalhes?.motivo;
  return (
    <Dialogo aberto media fechar titulo={titulo} apoio={apoio} aoFechar={aoFechar}>
      <form onSubmit={guardar} noValidate className="grid gap-4">
        {erro && !soCampos ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <fieldset className="grid gap-2" aria-describedby={faltaMotivo ? "guardar-motivo-erro" : undefined}>
          <legend className="pb-1.5 t-apoio font-medium">Por que guardar</legend>
          {(Object.keys(MOTIVOS_GUARDA) as MotivoGuarda[]).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-linha px-3.5 py-3 has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
              <input type="radio" name="guardar-motivo" className="mt-1 h-4.5 w-4.5 accent-violeta-600" checked={motivo === m}
                onChange={() => { setMotivo(m); setFaltaMotivo(false); }} />
              <span className="grid">
                <span className="t-texto font-medium">{MOTIVOS_GUARDA[m]}</span>
                {APOIO_MOTIVO[m] ? <span className="t-apoio text-tinta-suave">{APOIO_MOTIVO[m]}</span> : null}
              </span>
            </label>
          ))}
          {faltaMotivo ? <span id="guardar-motivo-erro" className="t-apoio text-erro">Escolha por que guardar.</span> : null}
        </fieldset>
        <CampoAreaTexto id="guardar-detalhe" rotulo="Detalhe" opcional={motivo !== "OUTRO"} maxLength={500} value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          ajuda="Aparece para quem abrir a ficha. Sem dado de saúde ou documento de ninguém."
          erro={campos.includes("detalhe") ? (motivo === "OUTRO" ? "Conte o motivo, com 3 letras ou mais." : "De 3 a 500 letras.") : null} />
        <Aviso tom="info" titulo="Enquanto estiver guardado">
          {O_QUE_FICA[entidade]} Tirar a marca também pede um motivo e fica no histórico.
        </Aviso>
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="cadeado" />{enviando ? "Guardando…" : "Guardar"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Tirar a marca: pede o motivo, que fica no histórico. Depois disso, o prazo volta a valer. */
export function JanelaTirarGuarda({ guarda, aoFechar, aoTirar }: { guarda: GuardaLegal; aoFechar: () => void; aoTirar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const curto = motivo.trim().length < 3;

  async function tirar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (curto) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["motivo"] } });
    setEnviando(true);
    const r = await chamarApi<{ ok: true }>(`${BASE_PRIVACIDADE}/guardas/${guarda.id}/tirar`, { corpo: { versao: guarda.versao, motivo: motivo.trim() } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoTirar();
  }

  const doCampo = erro?.codigo === "VALIDATION_ERROR" && camposComErro(erro).includes("motivo");
  return (
    <Dialogo aberto media fechar titulo={`Tirar a marca de ${tituloDoGuardado(guarda)}`} apoio={`${quemGuardou(guarda)} · ${motivoDoGuardado(guarda)}`} aoFechar={aoFechar}>
      <form onSubmit={tirar} noValidate className="grid gap-4">
        {erro && !doCampo ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-texto">Sem a marca, o prazo volta a valer: o que já venceu {DESTE[guarda.entidade]} é apagado na próxima rodada, de madrugada.</p>
        <CampoAreaTexto id="tirar-motivo" rotulo="Por que tirar" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          ajuda="Por exemplo: o processo terminou. Fica no histórico, com quem tirou."
          erro={doCampo ? "Conte o motivo, com 3 letras ou mais." : null} />
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>{enviando ? "Tirando…" : "Tirar a marca"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * A guarda na ficha (pedido, manutenção): o selo, o item de Mais ações (Guardar por obrigação legal
 * ou Tirar a marca, só para quem cuida da privacidade), a janela e o recado depois de mudar.
 */
export function useGuardaNaFicha(entidade: EntidadeGuarda, alvoId: string | null, rotulo: { titulo: string; apoio?: string }) {
  const { pode } = usePlataforma();
  const ve = pode("privacidade.ver");
  const cuida = pode("privacidade.cuidar");
  const carga = useCarregar<{ guarda: GuardaLegal | null }>(ve && alvoId ? `${BASE_PRIVACIDADE}/guardas/${entidade}/${alvoId}` : null);
  const [janela, setJanela] = useState<"guardar" | "tirar" | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const guarda = carga.estado === "pronto" ? carga.dados.guarda : null;
  const pronto = carga.estado === "pronto";

  const item: { texto: string; icone: NomeIcone; acao: () => void } | null = cuida && pronto && alvoId
    ? guarda
      ? { texto: "Tirar a marca de guardado", icone: "cadeado", acao: () => setJanela("tirar") }
      : { texto: "Guardar por obrigação legal", icone: "cadeado", acao: () => setJanela("guardar") }
    : null;

  const selo: ReactNode = guarda ? <SeloGuardado guarda={guarda} /> : null;
  const aviso: ReactNode = (
    <>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {guarda ? (
        <Aviso tom="info" titulo="Guardado por obrigação legal" papel="status">
          {quemGuardou(guarda)} · {motivoDoGuardado(guarda)}. O prazo não apaga as fotos, os arquivos e os dados das pessoas {DESTE[entidade]}.
        </Aviso>
      ) : null}
    </>
  );
  const janelas: ReactNode = alvoId ? (
    <>
      {janela === "guardar" ? (
        <JanelaGuardar entidade={entidade} alvoId={alvoId} titulo={rotulo.titulo} apoio={rotulo.apoio} aoFechar={() => setJanela(null)}
          aoGuardar={() => { setJanela(null); setRecado("Guardado por obrigação legal. O prazo não apaga nada daqui até alguém tirar a marca."); carga.recarregar(); }} />
      ) : null}
      {janela === "tirar" && guarda ? (
        <JanelaTirarGuarda guarda={guarda} aoFechar={() => setJanela(null)}
          aoTirar={() => { setJanela(null); setRecado("A marca de guardado saiu. O prazo volta a valer."); carga.recarregar(); }} />
      ) : null}
    </>
  ) : null;
  return { guarda, item, selo, aviso, janelas };
}

const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** "Hoje, 03:10", "Ontem, 03:10" ou "21/10/2026, 03:10", no horário de Brasília. */
export function quandoFoi(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = DIA.format(d);
  const nome = dia === DIA.format(agora) ? "Hoje" : dia === DIA.format(new Date(agora.getTime() - 86_400_000)) ? "Ontem" : dia;
  return `${nome}, ${HORA.format(d)}`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
}
