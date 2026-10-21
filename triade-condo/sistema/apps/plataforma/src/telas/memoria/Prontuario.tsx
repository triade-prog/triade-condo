"use client";
// Prontuário do prédio (design "Memória do prédio", telas 1 e 2; MP-12): a lista do que o prédio
// precisa ter guardado, com a situação de cada item. O item aponta para um documento de
// Documentos; a validade vem de lá. Contratos e preventivas entram só como contagem.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AVISO_PRONTUARIO_DIAS, GRUPOS_PRONTUARIO, mostrarDataCurta, rotuloSituacaoProntuario, type GrupoProntuario } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, type ErroApi, type Tom,
} from "@triade/ui";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ItemProntuario, Prontuario } from "../tipos.ts";
import type { PropsAbaMemoria } from "./Memoria.tsx";

const TOM: Record<ItemProntuario["situacao"], Tom> = { EM_DIA: "ok", VENCE: "atencao", VENCEU: "erro", FALTA: "neutro", NAO_SE_APLICA: "info" };

export function seloProntuario(i: Pick<ItemProntuario, "situacao" | "valeAte">) {
  return <Selo tom={TOM[i.situacao]}>{rotuloSituacaoProntuario(i.situacao, i.valeAte, hojeEmBrasilia())}</Selo>;
}

function subtitulo(i: ItemProntuario): string {
  if (i.situacao === "NAO_SE_APLICA") return `Não se aplica: ${i.motivo ?? ""}`;
  if (!i.documento) return "Nenhum documento ligado";
  if (i.documento.restrito) return "Documento restrito";
  const partes = [i.documento.titulo];
  if (i.documento.arquivado) partes.push("arquivado");
  else if (!i.documento.emVigor) partes.push("sem arquivo em vigor");
  else partes.push(`versão ${i.documento.emVigor.numero}`);
  if (i.valeAte) partes.push(`${i.situacao === "VENCEU" ? "venceu em" : "vale até"} ${mostrarDataCurta(i.valeAte)}`);
  return partes.join(" · ");
}

const chaveDo = (i: ItemProntuario) => i.id ?? i.chave!;

export function AbaProntuario({ feito }: PropsAbaMemoria) {
  const carga = useCarregar<Prontuario>("/v1/condominio/memoria/prontuario");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o prontuário…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const p = carga.dados;
  const r = p.resumo;
  const item = p.itens.find((i) => chaveDo(i) === aberto);
  const mudou = (texto: string) => { setAberto(null); setNovo(false); carga.recarregar(); feito(texto); };
  const grupos = (Object.keys(GRUPOS_PRONTUARIO) as GrupoProntuario[]).filter((g) => p.itens.some((i) => i.grupo === g));

  return (
    <section aria-labelledby="pr-titulo" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="pr-titulo" className="text-lg font-medium">Prontuário</h2>
          <p className="text-sm text-tinta-suave">
            {r.emDia} de {r.total} itens em dia.{r.vence ? ` ${r.vence} ${r.vence === 1 ? "vence logo" : "vencem logo"}.` : ""}
            {r.venceu ? ` ${r.venceu} ${r.venceu === 1 ? "venceu" : "venceram"}.` : ""}{r.falta ? ` ${r.falta} ${r.falta === 1 ? "falta" : "faltam"}.` : ""}
          </p>
        </div>
        {p.podeEditar ? <Botao variante="contorno" tamanho="m" onClick={() => setNovo(true)}>+ Novo item</Botao> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-superficie-2" role="img" aria-label={`${r.emDia} de ${r.total} itens em dia`}>
        <span className="block h-full rounded-full bg-linear-to-r from-laranja-300 to-laranja-500" style={{ width: `${r.total ? Math.round((r.emDia / r.total) * 100) : 0}%` }} />
      </div>
      {grupos.map((g) => (
        <div key={g} className="grid gap-1">
          <h3 className="mt-2 text-xs font-semibold tracking-wider text-violeta-700 uppercase">{GRUPOS_PRONTUARIO[g]}</h3>
          <ul className="divide-y divide-linha">
            {p.itens.filter((i) => i.grupo === g).map((i) => (
              <li key={chaveDo(i)} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grid min-w-0 flex-1 text-sm">
                  <button type="button" className="text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => setAberto(chaveDo(i))}>{i.nome}</button>
                  <span className="text-[13px] text-tinta-suave">{subtitulo(i)}</span>
                </span>
                {seloProntuario(i)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {p.contratos || p.preventivas ? (
        <div className="grid gap-1">
          <h3 className="mt-2 text-xs font-semibold tracking-wider text-violeta-700 uppercase">Contratos e programa de manutenção</h3>
          <ul className="divide-y divide-linha">
            {p.contratos ? (
              <li className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grid min-w-0 flex-1 text-sm">
                  <span className="font-medium">Contratos com prestadores</span>
                  <span className="text-[13px] text-tinta-suave">
                    {p.contratos.total === 1 ? "1 com contrato" : `${p.contratos.total} com contrato`}
                    {p.contratos.vencendo.length ? ` · ${p.contratos.vencendo.map((c) => `${c.prestador} até ${mostrarDataCurta(c.ate)}`).join(", ")}` : ""}
                  </span>
                </span>
                {p.contratos.vencendo.length ? <Selo tom="atencao">Contrato vencendo</Selo> : null}
                <Link href="/manutencao/prestadores" className="text-sm font-medium text-violeta-600 hover:underline">Ver prestadores</Link>
              </li>
            ) : null}
            {p.preventivas ? (
              <li className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grid min-w-0 flex-1 text-sm">
                  <span className="font-medium">Programa de manutenção (NBR 5674)</span>
                  <span className="text-[13px] text-tinta-suave">
                    {p.preventivas.ativas === 1 ? "1 preventiva" : `${p.preventivas.ativas} preventivas`}
                    {p.preventivas.atrasadas ? ` · ${p.preventivas.atrasadas} ${p.preventivas.atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}
                  </span>
                </span>
                <Link href="/manutencao/preventivas" className="text-sm font-medium text-violeta-600 hover:underline">Ver preventivas</Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-tinta-suave">
        Começa com a lista sugerida. Cada item liga a um documento já guardado em Documentos; a validade vem do documento. Vencido e perto de vencer avisam no sino de quem cuida dos documentos.
      </p>
      {item ? <ItemAberto item={item} p={p} aoFechar={() => setAberto(null)} aoMudar={mudou} /> : null}
      {novo ? <NovoItem aoFechar={() => setNovo(false)} aoCriar={mudou} /> : null}
    </section>
  );
}

function ItemAberto({ item, p, aoFechar, aoMudar }: { item: ItemProntuario; p: Prontuario; aoFechar: () => void; aoMudar: (t: string) => void }) {
  const [modo, setModo] = useState<"ver" | "ligar" | "nao">("ver");
  const [documento, setDocumento] = useState(item.documento?.id ?? "");
  const [dias, setDias] = useState(String(item.avisarDias ?? AVISO_PRONTUARIO_DIAS.padrao));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function enviar(corpo: Record<string, unknown>, texto: string) {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}`, { corpo: { ...corpo, versao: item.versao ?? null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(texto);
  }
  const ligar = (ev: FormEvent) => { ev.preventDefault(); void enviar({ acao: "LIGAR", documentoId: documento || null, avisarDias: Number(dias) }, `${item.nome}: documento ligado.`); };
  const naoSeAplica = (ev: FormEvent) => { ev.preventDefault(); void enviar({ acao: "NAO_SE_APLICA", motivo }, `${item.nome}: não se aplica.`); };

  return (
    <Dialogo aberto titulo={item.nome} aoFechar={aoFechar}>
      <div className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm">{seloProntuario(item)}<span className="text-tinta-suave">{subtitulo(item)}</span></div>
        {modo === "ver" ? (
          <>
            {item.documento?.id ? (
              <Link href={`/comunicados/documento?id=${item.documento.id}`} className="text-sm font-medium text-violeta-600 hover:underline">Abrir o documento</Link>
            ) : null}
            {p.podeEditar ? (
              <span className="flex flex-wrap gap-2">
                {item.situacao !== "NAO_SE_APLICA" ? (
                  <Botao tamanho="m" onClick={() => setModo("ligar")}><Icone nome="clipe" />{item.documento ? "Trocar documento" : "Ligar documento"}</Botao>
                ) : null}
                {item.documento ? <Botao variante="discreto" tamanho="m" disabled={enviando} onClick={() => void enviar({ acao: "DESLIGAR" }, `${item.nome}: documento desligado.`)}>Desligar documento</Botao> : null}
                {item.situacao === "NAO_SE_APLICA"
                  ? <Botao variante="contorno" tamanho="m" disabled={enviando} onClick={() => void enviar({ acao: "VALE" }, `${item.nome} voltou a valer.`)}>Voltar a valer</Botao>
                  : <Botao variante="discreto" tamanho="m" onClick={() => setModo("nao")}>Não se aplica</Botao>}
              </span>
            ) : <p className="text-sm text-tinta-suave">Para mexer no prontuário, o síndico precisa dar a você a permissão Cuidar dos documentos.</p>}
            <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
          </>
        ) : null}
        {modo === "ligar" ? (
          <form onSubmit={ligar} noValidate className="grid gap-3">
            {p.documentos.length ? (
              <CampoSelecao id="pr-doc" rotulo="Documento" value={documento} onChange={(e) => setDocumento(e.target.value)}
                opcoes={[{ valor: "", texto: "Escolha um documento" }, ...p.documentos.map((d) => ({ valor: d.id, texto: `${d.titulo}${d.valeAte ? ` · vale até ${mostrarDataCurta(d.valeAte)}` : ""}` }))]}
                ajuda="Só documentos do condomínio em Documentos. Para guardar um novo, envie primeiro em Documentos."
                erro={comErro.includes("documentoId") ? "Escolha um documento guardado em Documentos." : null} />
            ) : <Aviso tom="info" titulo="Nenhum documento guardado ainda"><Link href="/comunicados/documentos" className="font-medium underline">Guarde em Documentos</Link> e volte para ligar.</Aviso>}
            <CampoTexto id="pr-dias" rotulo="Avisar quantos dias antes de vencer" type="number" inputMode="numeric" min={0} max={AVISO_PRONTUARIO_DIAS.maximo}
              value={dias} onChange={(e) => setDias(e.target.value)} ajuda="O padrão é 60 dias. Seguro e AVCB costumam pedir mais tempo para renovar."
              erro={comErro.includes("avisarDias") ? `De 0 a ${AVISO_PRONTUARIO_DIAS.maximo} dias.` : null} />
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="contorno" onClick={() => { setModo("ver"); setErro(null); }}>Voltar</Botao>
              <Botao type="submit" disabled={enviando || !p.documentos.length}>{enviando ? "Ligando…" : "Ligar"}</Botao>
            </div>
          </form>
        ) : null}
        {modo === "nao" ? (
          <form onSubmit={naoSeAplica} noValidate className="grid gap-3">
            <Aviso tom="info" titulo="O item sai da conta do prontuário">Fica na lista, com o motivo, e pode voltar a valer quando quiser.</Aviso>
            <CampoAreaTexto id="pr-motivo" rotulo="Por que não se aplica" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Prédio sem poço artesiano; a água vem da concessionária." erro={comErro.includes("motivo") ? "Explique o motivo (de 3 a 500 caracteres)." : null} />
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="contorno" onClick={() => { setModo("ver"); setErro(null); }}>Voltar</Botao>
              <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao>
            </div>
          </form>
        ) : null}
      </div>
    </Dialogo>
  );
}

function NovoItem({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (t: string) => void }) {
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState<GrupoProntuario>("LAUDOS");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function criar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/memoria/prontuario/itens", { corpo: { nome, grupo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoCriar(`Item criado: ${nome.trim()}. Ligue o documento quando tiver.`);
  }
  return (
    <Dialogo aberto titulo="Novo item do prontuário" aoFechar={aoFechar}>
      <form onSubmit={criar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="pr-nome" rotulo="Nome do item" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Licença do gerador" erro={comErro.includes("nome") ? "De 3 a 120 caracteres." : null} />
        <div role="group" aria-labelledby="pr-grupo" className="grid gap-1">
          <span id="pr-grupo" className="text-[13px] font-medium">Grupo</span>
          <span className="trilho flex-wrap">
            {(Object.keys(GRUPOS_PRONTUARIO) as GrupoProntuario[]).map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={grupo === g} data-escolhido={grupo === g ? "" : undefined} onClick={() => setGrupo(g)}>
                {GRUPOS_PRONTUARIO[g]}
              </button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar item"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
