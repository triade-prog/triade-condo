"use client";
// Prontuário do prédio (DC15, telas-modelo documentos-memoria-*; canvas do novo frontend, quadros
// 85 a 90; MP-12): a lista do que o prédio precisa ter guardado, com a situação de cada item. Três
// números no topo filtram (em dia, vencem ou venceram, faltam); a linha inteira abre o item. O item
// que falta tem Enviar documento, que guarda o arquivo em Documentos e já liga ao item (decisão B.1
// de 22/10/2026); o vencido tem Enviar a versão nova. Ligar um documento que já existe fica dentro
// do item, com os do mesmo tipo primeiro. Contratos e preventivas entram só como contagem.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  aoMoradorPadrao, AVISO_PRONTUARIO_DIAS, documentoPareceDoItem, ESPERADO_PRONTUARIO, GRUPOS_PRONTUARIO, mostrarDataCurta, mostrarTamanho,
  ordenarParaLigar, rotuloSituacaoProntuario, TAMANHO_MAXIMO_DOCUMENTO, TIPOS_DOCUMENTO, type GrupoProntuario, type TipoDocumento,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, classeBotao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, type ErroApi, type NomeIcone, type Tom,
} from "@triade/ui";
import type { PropsAbaMemoria } from "../documentos/DocumentosEMemoria.tsx";
import { conferirArquivo, enviarUm } from "../comunicados/comum.tsx";
import { hojeEmBrasilia, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DocumentoDetalhe, DocumentoOpcao, ItemProntuario, Prontuario } from "../tipos.ts";

const TOM: Record<ItemProntuario["situacao"], Tom> = { EM_DIA: "ok", VENCE: "atencao", VENCEU: "erro", FALTA: "info", NAO_SE_APLICA: "neutro" };
const TOM_LADRILHO: Record<ItemProntuario["situacao"], string> = { EM_DIA: "ok", VENCE: "atencao", VENCEU: "erro", FALTA: "violeta", NAO_SE_APLICA: "neutro" };
export const ICONE_GRUPO: Record<GrupoProntuario, NomeIcone> = { CONSTITUICAO: "documento", SEGUROS: "cadeado", LAUDOS: "escudo", PLANTAS: "predio", OUTRO: "documento" };
/** O tipo do documento novo, quando o item não é um dos sugeridos. */
const TIPO_DO_GRUPO: Record<GrupoProntuario, TipoDocumento> = { CONSTITUICAO: "OUTRO", SEGUROS: "OUTRO", LAUDOS: "LAUDO", PLANTAS: "OUTRO", OUTRO: "OUTRO" };

const chaveDo = (i: ItemProntuario) => i.id ?? i.chave!;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export function textoSelo(i: Pick<ItemProntuario, "situacao" | "valeAte">): string {
  if (i.situacao === "VENCEU" && i.valeAte) return `Venceu em ${mostrarDataCurta(i.valeAte).slice(0, 5)}`;
  return rotuloSituacaoProntuario(i.situacao, i.valeAte, hojeEmBrasilia());
}

export function seloProntuario(i: Pick<ItemProntuario, "situacao" | "valeAte">) {
  return <Selo tom={TOM[i.situacao]}>{textoSelo(i)}</Selo>;
}

/** O documento guardado que parece ser o do item que falta e ainda não está ligado a nenhum item. */
function sugestaoDo(i: ItemProntuario, p: Prontuario): DocumentoOpcao | undefined {
  if (i.situacao !== "FALTA") return undefined;
  const ligados = new Set(p.itens.map((x) => x.documento?.id).filter(Boolean));
  return p.documentos.find((d) => !ligados.has(d.id) && documentoPareceDoItem(i.chave, d));
}

function apoioDo(i: ItemProntuario, p: Prontuario, hoje: string): { texto: string; destaque?: boolean } {
  if (i.situacao === "NAO_SE_APLICA") return { texto: i.motivo ?? "Não se aplica ao prédio" };
  if (!i.documento) {
    const s = sugestaoDo(i, p);
    if (s) return { texto: `${s.titulo} está em Documentos e não está ligado`, destaque: true };
    return { texto: (i.chave && ESPERADO_PRONTUARIO[i.chave]?.dica) || "Nenhum documento ligado" };
  }
  if (i.documento.restrito) return { texto: "Documento restrito" };
  const partes = [i.documento.titulo ?? "Documento"];
  if (i.documento.arquivado) partes.push("arquivado");
  else if (!i.documento.emVigor) partes.push("sem arquivo em vigor");
  if (i.situacao === "VENCEU" && i.valeAte) {
    const d = diasEntre(i.valeAte, hoje);
    partes.push(d === 0 ? "venceu hoje" : `venceu há ${d} ${plural(d, "dia", "dias")}`);
  } else if (i.valeAte) partes.push(`até ${mostrarDataCurta(i.valeAte)}`);
  else {
    if (i.documento.emVigor) partes.push(`versão ${i.documento.emVigor.numero}`);
    partes.push("sem validade");
  }
  return { texto: partes.join(" · ") };
}

/** O que o botão da linha faz: enviar o que falta ou a versão nova do que vence. */
type Modo = "ver" | "enviar" | "renovar" | "ligar" | "nao";
function acaoDaLinha(i: ItemProntuario, p: Prontuario): { texto: string; modo: Modo } | null {
  if (!p.podeEditar) return null;
  if (i.situacao === "FALTA") return { texto: "Enviar documento", modo: "enviar" };
  if ((i.situacao === "VENCE" || i.situacao === "VENCEU") && i.documento?.id && !i.documento.restrito) return { texto: "Enviar a versão nova", modo: "renovar" };
  return null;
}

/** Os atalhos do topo; "vencem ou venceram" junta os dois. */
type Ver = "EM_DIA" | "VENCE" | "FALTA";
const NO_VER: Record<Ver, (i: ItemProntuario) => boolean> = {
  EM_DIA: (i) => i.situacao === "EM_DIA",
  VENCE: (i) => i.situacao === "VENCE" || i.situacao === "VENCEU",
  FALTA: (i) => i.situacao === "FALTA",
};
const TITULO_VER: Record<Ver, string> = { EM_DIA: "Em dia", VENCE: "Vencem ou venceram", FALTA: "Faltam" };
const TOM_VER: Record<Ver, { tom: string; icone: NomeIcone; caixa: string; numero: string }> = {
  EM_DIA: { tom: "ok", icone: "check", caixa: "bg-ok-fundo border-ok-borda", numero: "text-ok" },
  VENCE: { tom: "atencao", icone: "relogio", caixa: "bg-atencao-fundo border-atencao-borda", numero: "text-atencao" },
  FALTA: { tom: "info", icone: "alerta", caixa: "bg-info-fundo border-info-borda", numero: "text-info" },
};

function apoioDoAtalho(v: Ver, p: Prontuario): string {
  const itens = p.itens.filter(NO_VER[v]);
  if (v === "FALTA") {
    const nao = p.resumo.naoSeAplica;
    return `Sem documento ligado.${nao ? ` ${nao} não se ${plural(nao, "aplica", "aplicam")} ao prédio.` : ""}`;
  }
  if (!itens.length) return v === "EM_DIA" ? "Nenhum ainda" : "Nada vencendo";
  const nomes = itens.slice(0, 2).map((i) => (v === "EM_DIA" ? i.nome : `${i.nome}: ${textoSelo(i).toLowerCase()}`));
  return `${nomes.join(v === "EM_DIA" ? ", " : " · ")}${itens.length > 2 ? ` e mais ${itens.length - 2}` : ""}`;
}

export function AbaProntuario({ feito, definir }: PropsAbaMemoria) {
  const router = useRouter();
  const busca = useSearchParams();
  const carga = useCarregar<Prontuario>("/v1/condominio/memoria/prontuario");
  const [novo, setNovo] = useState(false);
  const [modo, setModo] = useState<Modo>(busca.get("ligar") ? "ligar" : "ver");
  const ver = (["EM_DIA", "VENCE", "FALTA"] as const).find((v) => v === busca.get("ver"));
  const aberto = busca.get("item");
  const dados = carga.estado === "pronto" ? carga.dados : null;

  const ir = (m: { ver?: Ver | null; item?: string | null; ligar?: string | null }) => {
    const q = new URLSearchParams();
    const v = m.ver === undefined ? ver : m.ver;
    const it = m.item === undefined ? aberto : m.item;
    if (v) q.set("ver", v);
    if (it) q.set("item", it);
    if (m.ligar) q.set("ligar", m.ligar);
    router.replace(q.size ? `/documentos/prontuario?${q}` : "/documentos/prontuario", { scroll: false });
  };
  const abrir = (i: ItemProntuario, m: Modo = "ver") => { setModo(m); ir({ item: chaveDo(i) }); };
  const primeiroQueFalta = dados?.itens.find((i) => i.situacao === "FALTA");
  const editar = dados?.podeEditar ?? false;

  useEffect(() => {
    definir({
      principal: editar && primeiroQueFalta ? { texto: "Enviar o que falta", icone: "enviar", aoClicar: () => abrir(primeiroQueFalta, "enviar") } : null,
      mais: [
        ...(editar ? [{ texto: "Novo item", icone: "mais" as const, apoio: "Um documento que o prédio precisa e não está na lista", acao: () => setNovo(true) }] : []),
        // Histórico do prontuário (D4.18, decisão D.1): o que mudou em cada item, só para ler.
        { texto: "Histórico do prontuário", icone: "relogio", apoio: "O que foi ligado, desligado e o que venceu", href: "/documentos/historico" },
      ],
    });
    // abrir muda a cada render; o que importa é qual item falta primeiro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editar, primeiroQueFalta?.chave, primeiroQueFalta?.id, definir]);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o prontuário…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="o prontuário" />;
  const p = carga.dados;
  const r = p.resumo;
  const hoje = hojeEmBrasilia();
  const item = p.itens.find((i) => chaveDo(i) === aberto);
  const fechar = () => { setModo("ver"); ir({ item: null }); };
  const mudou = (texto: string, tom: "ok" | "atencao" = "ok") => { setNovo(false); fechar(); carga.recarregar(); feito(texto, tom); };
  const visiveis = ver ? p.itens.filter(NO_VER[ver]) : p.itens;
  const grupos = (Object.keys(GRUPOS_PRONTUARIO) as GrupoProntuario[]).filter((g) => visiveis.some((i) => i.grupo === g));
  const atalhos = (["EM_DIA", "VENCE", "FALTA"] as const).filter((v) => v !== "VENCE" || r.vence + r.venceu > 0 || ver === "VENCE");
  const numero: Record<Ver, number> = { EM_DIA: r.emDia, VENCE: r.vence + r.venceu, FALTA: r.falta };
  const vencendo = p.contratos?.vencendo[0];

  return (
    <div className="grid gap-5">
      <div role="group" aria-label="Atalhos do prontuário" className="grid grid-cols-3 gap-3 max-md:gap-2">
        {atalhos.map((v) => {
          const t = TOM_VER[v];
          const atual = ver === v;
          return (
            <button key={v} type="button" aria-pressed={atual} onClick={() => ir({ ver: atual ? null : v })}
              className={`flex items-center gap-3.5 rounded-[18px] border p-4 text-left max-md:flex-col max-md:items-start max-md:gap-0.5 max-md:rounded-[14px] max-md:px-3 max-md:py-2.5 ${t.caixa} ${atual ? "outline-2 outline-violeta-600" : ""}`}>
              <span className="ladrilho h-11 w-11 rounded-xl max-md:hidden" data-tom={t.tom} aria-hidden="true"><Icone nome={t.icone} className="h-5.5 w-5.5" /></span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-baseline gap-2 max-md:flex-col max-md:gap-0">
                  <span className={`t-titulo-ficha leading-tight font-bold max-md:text-2xl ${t.numero}`}>{numero[v]}</span>
                  <span className="t-titulo-cartao font-semibold max-md:text-xs">{TITULO_VER[v]}</span>
                </span>
                <span className="t-apoio line-clamp-2 max-md:hidden">{apoioDoAtalho(v, p)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {p.contratos ? (
        <Link href="/documentos?filtro=CONTRATOS" className="flex items-center gap-3 rounded-[18px] border border-linha bg-superficie px-3.5 py-3 shadow-s1 md:hidden">
          <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="ferramenta" /></span>
          <span className="grid min-w-0 flex-1">
            <span className="t-titulo-cartao font-semibold">{p.contratos.total} {plural(p.contratos.total, "contrato com prestador", "contratos com prestadores")}</span>
            {vencendo ? <span className="t-apoio">{vencendo.prestador} vence em {diasEntre(hoje, vencendo.ate)} dias</span> : null}
          </span>
          <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
        </Link>
      ) : null}

      <section aria-labelledby="pr-titulo" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <div className="flex flex-wrap items-center justify-between gap-2 md:px-5 md:py-3.5 max-md:pb-2">
          <h2 id="pr-titulo" className="t-titulo-cartao font-semibold">
            {p.itens.length} {plural(p.itens.length, "item", "itens")}{r.naoSeAplica ? ` · ${r.total} ${plural(r.total, "vale", "valem")} para o prédio` : ""}
          </h2>
          {ver ? (
            <span className="flex items-center gap-2 t-texto"><span className="t-apoio">Mostrando: {TITULO_VER[ver]}</span>
              <Botao variante="discreto" tamanho="p" onClick={() => ir({ ver: null })}>Limpar</Botao></span>
          ) : <span className="t-apoio max-md:hidden">Mostrando todos. Toque num número acima para filtrar.</span>}
        </div>
        {grupos.length === 0 ? <p className="t-apoio px-5 pb-4 max-md:px-0">Nenhum item {ver ? TITULO_VER[ver].toLowerCase() : ""}.</p> : null}
        {grupos.map((g) => (
          <div key={g}>
            <h3 className="t-rotulo pt-3 pb-2 md:border-t md:border-linha md:bg-fundo md:px-5">{GRUPOS_PRONTUARIO[g]}</h3>
            <ul aria-label={GRUPOS_PRONTUARIO[g]} className="grid max-md:gap-2.5">
              {visiveis.filter((i) => i.grupo === g).map((i) => (
                <LinhaItem key={chaveDo(i)} i={i} p={p} hoje={hoje} abrir={abrir} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {p.contratos || p.preventivas ? (
        <section aria-labelledby="pr-tambem" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:hidden">
          <h2 id="pr-tambem" className="flex items-center gap-2.5 t-titulo-cartao">
            <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="predio" className="h-4 w-4" /></span>Também conta para o prédio
          </h2>
          <ul className="grid divide-y divide-linha">
            {p.contratos ? (
              <li className="flex items-center gap-3 py-3">
                <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="ferramenta" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium">Contratos com prestadores: {p.contratos.total}</span>
                  <span className="t-apoio">
                    {vencendo ? `Contrato da ${vencendo.prestador} vence em ${diasEntre(hoje, vencendo.ate)} dias. ` : ""}Ficam em Documentos, atalho Contratos.
                  </span>
                </span>
                <Link href="/documentos?filtro=CONTRATOS" className="flex items-center gap-1 t-titulo-cartao font-semibold text-violeta-600 hover:underline">Ver contratos<Icone nome="dir" className="h-4 w-4" /></Link>
              </li>
            ) : null}
            {p.preventivas ? (
              <li className="flex items-center gap-3 py-3">
                <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="calendario" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium">Preventivas: {p.preventivas.ativas} {plural(p.preventivas.ativas, "ativa", "ativas")}</span>
                  <span className="t-apoio">
                    {p.preventivas.atrasadas ? `${p.preventivas.atrasadas} ${plural(p.preventivas.atrasadas, "atrasada", "atrasadas")}. ` : ""}O programa fica na Manutenção.
                  </span>
                </span>
                <Link href="/manutencao/preventivas" className="flex items-center gap-1 t-titulo-cartao font-semibold text-violeta-600 hover:underline">Ver preventivas<Icone nome="dir" className="h-4 w-4" /></Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {!p.podeEditar ? <Aviso tom="neutro">Para mexer no prontuário, o síndico precisa dar a você a permissão Cuidar dos documentos.</Aviso> : null}
      <p className="t-apoio">Cada item liga a um documento guardado em Documentos; a validade vem do documento. Vencido e perto de vencer avisam no sino de quem cuida dos documentos.</p>

      {item ? <ItemAberto key={`${chaveDo(item)}-${modo}`} item={item} p={p} modo={modo} setModo={setModo} ligarInicial={busca.get("ligar")}
        aoFechar={fechar} aoMudar={mudou} recarregar={carga.recarregar} /> : null}
      {novo ? <NovoItem aoFechar={() => setNovo(false)} aoCriar={mudou} /> : null}
    </div>
  );
}

function LinhaItem({ i, p, hoje, abrir }: { i: ItemProntuario; p: Prontuario; hoje: string; abrir: (i: ItemProntuario, m?: Modo) => void }) {
  const apoio = apoioDo(i, p, hoje);
  const acao = acaoDaLinha(i, p);
  const botao = acao ? (
    <Botao variante="contorno" tamanho="m" className="relative z-10 max-md:w-full" aria-label={`${acao.texto}: ${i.nome}`} onClick={() => abrir(i, acao.modo)}>
      <Icone nome="enviar" />{acao.texto}
    </Botao>
  ) : null;
  return (
    <li className="relative grid grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-x-3 gap-y-2.5 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[44px_minmax(0,1fr)_180px_200px_20px] md:gap-x-4 md:border-t md:border-linha md:first:border-t-0">
      <span className="ladrilho h-10 w-10 self-start rounded-xl md:h-11 md:w-11 md:self-center" data-tom={TOM_LADRILHO[i.situacao]} aria-hidden="true"><Icone nome={ICONE_GRUPO[i.grupo]} className="h-5 w-5" /></span>
      <span className="grid min-w-0 gap-0.5">
        <button type="button" className="elo-linha" onClick={() => abrir(i)}>{i.nome}</button>
        <span className={`t-apoio ${apoio.destaque ? "font-semibold text-violeta-600" : "text-tinta-suave"}`}>{apoio.texto}</span>
        <span className="pt-1 md:hidden">{seloProntuario(i)}</span>
      </span>
      <span className="max-md:hidden">{seloProntuario(i)}</span>
      <span className="justify-self-end max-md:hidden">{botao}</span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:self-center" />
      {botao ? <span className="col-span-3 md:hidden">{botao}</span> : null}
    </li>
  );
}

function ItemAberto({ item, p, modo, setModo, ligarInicial, aoFechar, aoMudar, recarregar }: {
  item: ItemProntuario; p: Prontuario; modo: Modo; setModo: (m: Modo) => void; ligarInicial: string | null;
  aoFechar: () => void; aoMudar: (t: string, tom?: "ok" | "atencao") => void; recarregar: () => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const grupo = GRUPOS_PRONTUARIO[item.grupo];

  async function acao(corpo: Record<string, unknown>, texto: string) {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}`, { corpo: { ...corpo, versao: item.versao ?? null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(texto);
  }

  if (modo === "enviar") return <EnviarDocumento item={item} aoFechar={aoFechar} aoMudar={aoMudar} recarregar={recarregar} />;
  if (modo === "renovar" && item.documento?.id) return <RenovarDocumento item={item} documentoId={item.documento.id} aoFechar={aoFechar} aoMudar={aoMudar} />;
  if (modo === "ligar") return <LigarExistente item={item} p={p} inicial={ligarInicial} aoFechar={aoFechar} aoMudar={aoMudar} />;
  if (modo === "nao") return <NaoSeAplica item={item} aoVoltar={() => setModo("ver")} aoFechar={aoFechar} aoMudar={aoMudar} />;

  const sugestao = sugestaoDo(item, p);
  const dica = item.chave ? ESPERADO_PRONTUARIO[item.chave]?.dica : undefined;
  const docId = item.documento?.id;
  const principal = acaoDaLinha(item, p);
  const mais: ItemMenu[] = p.podeEditar ? [
    ...(item.situacao !== "NAO_SE_APLICA" ? [{ texto: item.documento ? "Trocar o documento" : "Ligar um que já existe", icone: "link" as const, acao: () => setModo("ligar") }] : []),
    ...(item.documento ? [{ texto: "Desligar o documento", icone: "fechar" as const, acao: () => void acao({ acao: "DESLIGAR" }, `${item.nome}: documento desligado.`) }] : []),
    ...(item.situacao === "NAO_SE_APLICA" ? [] : [{ texto: "Não se aplica a este prédio", icone: "fechar" as const, acao: () => setModo("nao") }]),
    ...(docId && principal ? [{ texto: "Abrir o documento", icone: "documento" as const, href: `/documentos/documento?id=${docId}` }] : []),
  ] : [];
  if (item.id) mais.push({ texto: "Ver o histórico do item", icone: "relogio", href: `/documentos/historico?item=${item.id}` });

  return (
    <Dialogo aberto media titulo={item.nome} apoio={`Item do prontuário · ${grupo}`} fechar aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <span>{seloProntuario(item)}</span>
        {item.situacao === "NAO_SE_APLICA" ? <p className="t-texto">Não se aplica: {item.motivo}</p> : null}
        {item.situacao === "FALTA" ? <p className="t-apoio">{dica ? `${dica}. ` : ""}Envie o PDF ou a foto.</p> : null}
        {item.documento ? (
          <div className="flex items-center gap-3 rounded-[14px] border border-linha p-3">
            <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="documento" /></span>
            <span className="grid min-w-0 flex-1">
              <span className="font-medium">{item.documento.restrito ? "Documento restrito" : item.documento.titulo}</span>
              <span className="t-apoio">{apoioDo(item, p, hojeEmBrasilia()).texto}</span>
            </span>
            {docId && !item.documento.restrito ? <Link href={`/documentos/documento?id=${docId}`} className="t-titulo-cartao font-semibold text-violeta-600 hover:underline">Abrir</Link> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-0.5 rounded-[14px] border border-linha bg-fundo px-3.5 py-3"><span className="t-apoio">Grupo</span><span className="t-texto font-medium">{grupo}</span></div>
          <div className="grid gap-0.5 rounded-[14px] border border-linha bg-fundo px-3.5 py-3"><span className="t-apoio">Avisa antes de vencer</span><span className="t-texto font-medium">{item.avisarDias} {plural(item.avisarDias, "dia", "dias")}</span></div>
        </div>
        {sugestao && p.podeEditar ? (
          <Aviso tom="info" titulo={`Há um documento que parece ser deste item em Documentos`}>
            <span className="grid gap-2">
              <span>{sugestao.titulo}{sugestao.valeAte ? `, vale até ${mostrarDataCurta(sugestao.valeAte)}` : ""}, ainda não ligado a nenhum item.</span>
              <span><Botao variante="contorno" tamanho="m" disabled={enviando}
                onClick={() => void acao({ acao: "LIGAR", documentoId: sugestao.id, avisarDias: item.avisarDias }, `${item.nome}: ${sugestao.titulo} ligado ao item.`)}>
                <Icone nome="link" />Ligar este</Botao></span>
            </span>
          </Aviso>
        ) : null}
        {!p.podeEditar ? <p className="t-apoio">Para mexer no prontuário, o síndico precisa dar a você a permissão Cuidar dos documentos.</p> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {principal ? <Botao onClick={() => setModo(principal.modo)}><Icone nome="enviar" />{principal.texto}</Botao>
            : item.situacao === "NAO_SE_APLICA" && p.podeEditar
              ? <Botao disabled={enviando} onClick={() => void acao({ acao: "VALE" }, `${item.nome} voltou a valer.`)}><Icone nome="check" />Voltar a valer</Botao>
              : docId && !item.documento?.restrito
                ? <Link href={`/documentos/documento?id=${docId}`} className={classeBotao("primario")}><Icone nome="documento" />Abrir o documento</Link>
                : <Botao variante="contorno" onClick={aoFechar}>Fechar</Botao>}
        </div>
      </div>
    </Dialogo>
  );
}

const QUEM_VE = { MORADOR: "Vai ao morador", GESTAO: "Só quem cuida do condomínio", RESTRITO: "Só quem cuida dos documentos" } as const;
type QuemVe = keyof typeof QUEM_VE;

export function CampoArquivo({ arquivo, setArquivo, problema, desligado, rotulo }: {
  arquivo: File | null; setArquivo: (f: File | null) => void; problema: string | null; desligado: boolean; rotulo: string;
}) {
  return (
    <label className="grid cursor-pointer justify-items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-violeta-300 bg-violeta-50/60 px-4 py-5 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violeta-600">
      <span className="ladrilho h-11 w-11 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="enviar" className="h-5.5 w-5.5" /></span>
      <span className="t-titulo-cartao font-semibold">{arquivo ? arquivo.name : rotulo} <span className="text-erro" aria-hidden="true">*</span></span>
      <span className={`t-apoio ${problema ? "font-medium text-atencao" : "text-tinta-suave"}`}>
        {problema ?? (arquivo ? mostrarTamanho(arquivo.size) : `PDF, JPG ou PNG, até ${Math.round(TAMANHO_MAXIMO_DOCUMENTO / (1024 * 1024))} MB`)}
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-linha bg-superficie px-4 t-titulo-cartao font-semibold"><Icone nome="clipe" className="h-4 w-4" />{arquivo ? "Trocar arquivo" : "Escolher arquivo"}</span>
      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={desligado} required aria-label="Arquivo"
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** Enviar documento (B.1): guarda em Documentos, sobe o arquivo como versão 1 e liga ao item. */
function EnviarDocumento({ item, aoFechar, aoMudar, recarregar }: {
  item: ItemProntuario; aoFechar: () => void; aoMudar: (t: string, tom?: "ok" | "atencao") => void; recarregar: () => void;
}) {
  const { pode } = usePlataforma();
  const tipoInicial = (item.chave && ESPERADO_PRONTUARIO[item.chave]?.tipo) || TIPO_DO_GRUPO[item.grupo];
  const [v, setV] = useState({ titulo: item.nome, tipo: tipoInicial as TipoDocumento, valeAte: "", quem: (aoMoradorPadrao(tipoInicial) ? "MORADOR" : "GESTAO") as QuemVe });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  /** Guardou o documento, mas a ligação com o item não deu certo. */
  const [semLigar, setSemLigar] = useState<{ id: string; aviso?: string } | null>(null);
  const problema = arquivo ? conferirArquivo(arquivo, TAMANHO_MAXIMO_DOCUMENTO) : null;
  const comErro = camposComErro(erro);
  const hoje = hojeEmBrasilia();
  const quem = (Object.keys(QUEM_VE) as QuemVe[]).filter((q) => q !== "RESTRITO" || pode("documentos.restritos"));

  async function ligar(id: string, aviso?: string) {
    const r = await chamarApi(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}`, {
      corpo: { acao: "LIGAR", documentoId: id, avisarDias: item.avisarDias, versao: item.versao ?? null },
    });
    if (!r.ok) { setSemLigar({ id, aviso }); recarregar(); return; }
    avisarLigado(aviso);
  }
  function avisarLigado(aviso?: string) {
    if (aviso) aoMudar(`${item.nome}: documento ligado, mas o arquivo não foi liberado (${aviso}). Envie de novo na ficha do documento.`, "atencao");
    else aoMudar(`${item.nome}: documento guardado em Documentos e ligado ao item.`);
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!arquivo || problema) return;
    setErro(null);
    setProgresso(0);
    // Guarda e liga numa chamada só (D4.18); o arquivo sobe depois, como versão 1.
    const doc = await chamarApi<{ id: string; ligado: boolean }>(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}/documento`, {
      corpo: {
        documento: { tipo: v.tipo, titulo: v.titulo, descricao: null, valeAte: v.valeAte || null, restrito: v.quem === "RESTRITO", aoMorador: v.quem === "MORADOR" },
        versao: item.versao ?? null, avisarDias: item.avisarDias,
      },
    });
    if (!doc.ok) { setProgresso(null); return setErro(doc.erro); }
    const envio = await enviarUm(`/v1/condominio/documentos/${doc.dados.id}/versoes`, { mudanca: null, vigenteDesde: hoje, aprovadoEm: null }, arquivo, (x) => x.versaoId!, setProgresso);
    const aviso = envio.liberado ? undefined : envio.motivo ?? "não foi liberado";
    setProgresso(null);
    if (!doc.dados.ligado) { setSemLigar({ id: doc.dados.id, aviso }); recarregar(); return; }
    avisarLigado(aviso);
  }

  if (semLigar) {
    return (
      <Dialogo aberto titulo="O documento ficou guardado" aoFechar={() => aoMudar(`${v.titulo} ficou em Documentos, sem ligar ao item ${item.nome}.`, "atencao")}>
        <div className="grid gap-4">
          <Aviso tom="atencao" titulo="Guardou, mas não ligou">A ligação com o item {item.nome} não deu certo. O arquivo está em Documentos; não precisa enviar de novo.</Aviso>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="discreto" onClick={() => aoMudar(`${v.titulo} ficou em Documentos, sem ligar ao item ${item.nome}.`, "atencao")}>Fechar</Botao>
            <Botao disabled={progresso !== null} onClick={async () => { setProgresso(100); await ligar(semLigar.id, semLigar.aviso); setProgresso(null); }}>
              <Icone nome="link" />{progresso !== null ? "Ligando…" : "Ligar de novo"}
            </Botao>
          </div>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo aberto media titulo="Enviar documento" apoio="Novo documento, já preenchido pelo item do prontuário" fechar aoFechar={aoFechar}>
      <form onSubmit={guardar} noValidate className="grid gap-4">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex items-center gap-3 rounded-[14px] border border-violeta-200 bg-violeta-50 px-3.5 py-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="lista" className="h-4 w-4" /></span>
          <span className="grid">
            <span className="t-titulo-cartao font-semibold">Vai ligar ao item {item.nome}</span>
            <span className="t-apoio">Ao guardar, o item passa a valer e avisa {item.avisarDias} {plural(item.avisarDias, "dia", "dias")} antes de vencer.</span>
          </span>
        </div>
        <CampoArquivo arquivo={arquivo} setArquivo={setArquivo} problema={problema} desligado={progresso !== null} rotulo="Arraste ou escolha o PDF ou a foto" />
        <div className="grid gap-3 md:grid-cols-2">
          <CampoTexto id="ed-titulo" rotulo="Título" required maxLength={120} value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })}
            erro={comErro.includes("titulo") ? "De 3 a 120 caracteres, sem repetir outro documento." : null} />
          <CampoSelecao id="ed-tipo" rotulo="Tipo" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoDocumento })}
            opcoes={Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => ({ valor, texto }))} />
          <CampoTexto id="ed-vale" rotulo="Vale até" type="date" opcional value={v.valeAte} onChange={(e) => setV({ ...v, valeAte: e.target.value })}
            ajuda="Sem data, o item fica em dia sem aviso." erro={comErro.includes("valeAte") ? "Data fora do esperado." : null} />
          <CampoSelecao id="ed-quem" rotulo="Quem vê" value={v.quem} onChange={(e) => setV({ ...v, quem: e.target.value as QuemVe })}
            opcoes={quem.map((q) => ({ valor: q, texto: QUEM_VE[q] }))} />
        </div>
        <p className="t-apoio">Título e tipo vêm do item. Pode mudar.</p>
        {progresso !== null ? <progress className="h-1.5 w-full accent-violeta-600" max={100} value={progresso} aria-label="Envio do arquivo" /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" disabled={progresso !== null} onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={!arquivo || Boolean(problema) || progresso !== null}><Icone nome="check" />{progresso !== null ? "Guardando…" : "Guardar e ligar ao item"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Enviar a versão nova do documento ligado ao item que vence ou venceu, com a validade nova. */
function RenovarDocumento({ item, documentoId, aoFechar, aoMudar }: {
  item: ItemProntuario; documentoId: string; aoFechar: () => void; aoMudar: (t: string, tom?: "ok" | "atencao") => void;
}) {
  const carga = useCarregar<DocumentoDetalhe>(`/v1/condominio/documentos/${documentoId}`);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [v, setV] = useState({ mudanca: "Renovação", valeAte: "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const problema = arquivo ? conferirArquivo(arquivo, TAMANHO_MAXIMO_DOCUMENTO) : null;
  const comErro = camposComErro(erro);
  const hoje = hojeEmBrasilia();
  const d = carga.estado === "pronto" ? carga.dados.documento : null;

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!arquivo || problema || !d) return;
    setErro(null);
    setProgresso(0);
    const envio = await enviarUm(`/v1/condominio/documentos/${d.id}/versoes`, { mudanca: v.mudanca.trim() || null, vigenteDesde: hoje, aprovadoEm: null }, arquivo, (x) => x.versaoId!, setProgresso);
    if (!envio.liberado) {
      setProgresso(null);
      if (envio.erro && camposComErro(envio.erro).length) return setErro(envio.erro);
      return aoMudar(`${envio.nome}: ${envio.motivo ?? "não foi liberado."}`, "atencao");
    }
    if (v.valeAte && v.valeAte !== d.valeAte) {
      const r = await chamarApi(`/v1/condominio/documentos/${d.id}`, {
        metodo: "PUT",
        corpo: { tipo: d.tipo, titulo: d.titulo, descricao: d.descricao ?? null, valeAte: v.valeAte, restrito: d.restrito, aoMorador: d.aoMorador, versao: d.versao },
      });
      setProgresso(null);
      if (!r.ok) return aoMudar(`Versão nova guardada, mas a validade não mudou (${textoDoErro(r.erro)}). Mude em Editar, na ficha do documento.`, "atencao");
      return aoMudar(`${item.nome}: versão nova guardada, vale até ${mostrarDataCurta(v.valeAte)}.`);
    }
    setProgresso(null);
    aoMudar(`${item.nome}: versão nova guardada.`);
  }

  return (
    <Dialogo aberto media titulo="Enviar a versão nova" apoio={`Do documento ligado ao item ${item.nome}`} fechar aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando linhas={2} rotulo="Carregando o documento…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="o documento" /> : null}
      {d ? (
        <form onSubmit={guardar} noValidate className="grid gap-4">
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <div className="flex items-center gap-3 rounded-[14px] border border-violeta-200 bg-violeta-50 px-3.5 py-3">
            <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="documento" className="h-4 w-4" /></span>
            <span className="grid">
              <span className="t-titulo-cartao font-semibold">{d.titulo}{d.emVigor ? `, versão ${d.emVigor.numero + 1}` : ""}</span>
              <span className="t-apoio">A versão anterior fica guardada no documento.{d.valeAte ? ` A de agora vale até ${mostrarDataCurta(d.valeAte)}.` : ""}</span>
            </span>
          </div>
          <CampoArquivo arquivo={arquivo} setArquivo={setArquivo} problema={problema} desligado={progresso !== null} rotulo="Arraste ou escolha o arquivo novo" />
          <div className="grid gap-3 md:grid-cols-2">
            <CampoTexto id="rv-vale" rotulo="Vale até" type="date" value={v.valeAte} onChange={(e) => setV({ ...v, valeAte: e.target.value })}
              ajuda="A data do documento novo. Sem ela, o item continua vencido." />
            <CampoTexto id="rv-mudanca" rotulo="O que mudou" maxLength={500} value={v.mudanca} onChange={(e) => setV({ ...v, mudanca: e.target.value })}
              erro={comErro.includes("mudanca") ? "De 3 a 500 caracteres." : null} />
          </div>
          {progresso !== null ? <progress className="h-1.5 w-full accent-violeta-600" max={100} value={progresso} aria-label="Envio do arquivo" /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="discreto" disabled={progresso !== null} onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={!arquivo || Boolean(problema) || progresso !== null}><Icone nome="check" />{progresso !== null ? "Guardando…" : "Guardar a versão nova"}</Botao>
          </div>
        </form>
      ) : null}
    </Dialogo>
  );
}

/** Ligar um documento que já existe: os do mesmo tipo vêm primeiro. */
function LigarExistente({ item, p, inicial, aoFechar, aoMudar }: {
  item: ItemProntuario; p: Prontuario; inicial: string | null; aoFechar: () => void; aoMudar: (t: string) => void;
}) {
  const { mesmoTipo, outros } = ordenarParaLigar(item.chave, p.documentos);
  const sugestao = sugestaoDo(item, p);
  const [documento, setDocumento] = useState(
    (inicial && p.documentos.some((d) => d.id === inicial) ? inicial : null) ?? item.documento?.id ?? sugestao?.id ?? "",
  );
  const [dias, setDias] = useState(String(item.avisarDias ?? AVISO_PRONTUARIO_DIAS.padrao));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const tipo = item.chave ? ESPERADO_PRONTUARIO[item.chave]?.tipo : undefined;
  const ligadoA = (id: string) => p.itens.filter((i) => i.documento?.id === id && chaveDo(i) !== chaveDo(item)).map((i) => i.nome);

  async function ligar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}`, {
      corpo: { acao: "LIGAR", documentoId: documento || null, avisarDias: Number(dias), versao: item.versao ?? null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const d = p.documentos.find((x) => x.id === documento);
    aoMudar(`${item.nome}: ${d?.titulo ?? "documento"} ligado ao item.`);
  }

  const opcao = (d: DocumentoOpcao) => {
    const ligados = ligadoA(d.id);
    return (
      <label key={d.id} className="flex items-start gap-3 rounded-[14px] border border-linha px-3.5 py-3 has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
        <input type="radio" name="pr-ligar" className="mt-1 h-4.5 w-4.5 accent-violeta-600" checked={documento === d.id} onChange={() => setDocumento(d.id)} />
        <span className="grid min-w-0">
          <span className="font-medium">{d.titulo}</span>
          <span className="t-apoio">{TIPOS_DOCUMENTO[d.tipo as TipoDocumento] ?? d.tipo} · {d.valeAte ? `${d.valeAte < hojeEmBrasilia() ? "venceu em" : "vale até"} ${mostrarDataCurta(d.valeAte)}` : "sem validade"}</span>
          <span className="t-apoio">{ligados.length ? `Ligado a ${ligados.join(", ")}` : "Ainda não ligado a nenhum item"}</span>
        </span>
      </label>
    );
  };

  return (
    <Dialogo aberto media titulo="Ligar um documento que já existe" apoio={`Para o item ${item.nome}. Os do mesmo tipo vêm primeiro.`} fechar aoFechar={aoFechar}>
      <form onSubmit={ligar} noValidate className="grid gap-4">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {p.documentos.length ? (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Documento</legend>
            {mesmoTipo.length ? <><span className="t-rotulo">Do mesmo tipo: {TIPOS_DOCUMENTO[tipo!].toLowerCase()}</span>{mesmoTipo.map(opcao)}</> : null}
            {outros.length ? <><span className={`t-rotulo ${mesmoTipo.length ? "pt-2" : ""}`}>{mesmoTipo.length ? "Outros documentos" : "Documentos guardados"}</span>{outros.map(opcao)}</> : null}
            {comErro.includes("documentoId") ? <span className="t-apoio text-erro">Escolha um documento guardado em Documentos.</span> : null}
          </fieldset>
        ) : (
          <Aviso tom="info" titulo="Nenhum documento guardado ainda">Use Enviar documento, que guarda o arquivo e já liga ao item.</Aviso>
        )}
        <CampoTexto id="pr-dias" rotulo="Avisar quantos dias antes de vencer" type="number" inputMode="numeric" min={0} max={AVISO_PRONTUARIO_DIAS.maximo}
          value={dias} onChange={(e) => setDias(e.target.value)} ajuda={`Até ${AVISO_PRONTUARIO_DIAS.maximo} dias. Seguro e AVCB costumam pedir mais tempo para renovar.`}
          erro={comErro.includes("avisarDias") ? `De 0 a ${AVISO_PRONTUARIO_DIAS.maximo} dias.` : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando || !documento}><Icone nome="link" />{enviando ? "Ligando…" : "Ligar ao item"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function NaoSeAplica({ item, aoVoltar, aoFechar, aoMudar }: { item: ItemProntuario; aoVoltar: () => void; aoFechar: () => void; aoMudar: (t: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/memoria/prontuario/itens/${chaveDo(item)}`, { corpo: { acao: "NAO_SE_APLICA", motivo, versao: item.versao ?? null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(`${item.nome}: não se aplica.`);
  }
  return (
    <Dialogo aberto titulo={`${item.nome}: não se aplica`} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <Aviso tom="info" titulo="O item sai da conta do prontuário">Fica na lista, com o motivo, e pode voltar a valer quando quiser.</Aviso>
        <CampoAreaTexto id="pr-motivo" rotulo="Por que não se aplica" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Prédio sem poço artesiano; a água vem da concessionária." erro={comErro.includes("motivo") ? "Explique o motivo (de 3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoVoltar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </form>
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
    aoCriar(`Item criado: ${nome.trim()}. Envie ou ligue o documento quando tiver.`);
  }
  return (
    <Dialogo aberto titulo="Novo item do prontuário" aoFechar={aoFechar}>
      <form onSubmit={criar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="pr-nome" rotulo="Nome do item" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Licença do gerador" erro={comErro.includes("nome") ? "De 3 a 120 caracteres." : null} />
        <div role="group" aria-labelledby="pr-grupo" className="grid gap-1">
          <span id="pr-grupo" className="t-apoio font-medium">Grupo</span>
          <span className="trilho flex-wrap">
            {(Object.keys(GRUPOS_PRONTUARIO) as GrupoProntuario[]).map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={grupo === g} data-escolhido={grupo === g ? "" : undefined} onClick={() => setGrupo(g)}>
                {GRUPOS_PRONTUARIO[g]}
              </button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar item"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
