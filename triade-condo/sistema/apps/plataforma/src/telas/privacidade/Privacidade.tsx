"use client";
// Configurações › Gestão › Privacidade e dados (F0.11; PT-11, PT-03; quadros 350 e 351, aprovados
// em 24/10/2026): o que o sistema guarda das pessoas, para quê e por quanto tempo, a última
// rodada da rotina, o que vence nos próximos 30 dias, o que está guardado por obrigação legal (com
// Tirar a marca) e a entrada para Dados de uma pessoa. Os prazos são da TRÍADE, iguais para todos:
// aqui só se lê. O modo da rotina (Só contando ou Apagando) quem muda é a Administração da TRÍADE.

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MODOS_RETENCAO, SITUACOES_RETENCAO, type GuardaLegal, type Privacidade as DadosPrivacidade, type TipoRetencao } from "@triade/domain";
import { Aviso, Botao, Carregando, classeBotao, Dialogo, ErroCarregar, Icone, SemPermissao, Selo, type NomeIcone } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import {
  BASE_PRIVACIDADE, ENDERECO_DADOS_PESSOA, enderecoDoGuardado, JanelaTirarGuarda, motivoDoGuardado, plural, quandoFoi, quemGuardou, SeloGuardado, tituloDoGuardado,
} from "./comum.tsx";

const ICONE_GRUPO: Record<string, NomeIcone> = {
  "Pessoas": "pessoas", "Pedidos e manutenção": "ferramenta", "Comunicação": "balao", "Portaria e vida em condomínio": "caixa", "Documentos e memória": "documento",
};

/** Os tipos por grupo, na ordem em que o grupo aparece no catálogo. */
export function porGrupo(tipos: TipoRetencao[]): { grupo: string; tipos: TipoRetencao[] }[] {
  const grupos: { grupo: string; tipos: TipoRetencao[] }[] = [];
  for (const t of [...tipos].sort((a, b) => a.numero - b.numero)) {
    const g = grupos.find((x) => x.grupo === t.grupo);
    if (g) g.tipos.push(t); else grupos.push({ grupo: t.grupo, tipos: [t] });
  }
  const ordem = Object.keys(ICONE_GRUPO);
  return grupos.sort((a, b) => (ordem.indexOf(a.grupo) + 1 || 99) - (ordem.indexOf(b.grupo) + 1 || 99));
}

/** Prazo definido, mas a rotina deste tipo ainda não roda: o selo diz isso, sem fingir que apaga. */
function SeloSituacao({ t }: { t: TipoRetencao }) {
  return t.situacao === "A_FAZER" ? <Selo tom="neutro">{SITUACOES_RETENCAO.A_FAZER}</Selo> : null;
}

function Cabeca({ acoes }: { acoes?: ReactNode }) {
  return (
    <div className="grid gap-3">
      <Link href="/configuracoes" className="inline-flex items-center gap-1 justify-self-start t-apoio font-medium text-violeta-600 hover:underline">
        <Icone nome="esq" className="h-4 w-4" />Configurações · Gestão
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[70ch] gap-1">
          <h1 className="t-titulo-tela font-normal tracking-tight">Privacidade e dados</h1>
          <p className="t-apoio text-tinta-suave">
            <span className="max-md:hidden">O que o sistema guarda das pessoas, para quê e por quanto tempo. O condomínio responde pelos dados; a TRÍADE cuida deles por ele e apaga o que passou do prazo, toda madrugada.</span>
            <span className="md:hidden">O que o sistema guarda das pessoas, para quê e por quanto tempo. O que passa do prazo é apagado toda madrugada.</span>
          </p>
        </div>
        {acoes}
      </div>
    </div>
  );
}

function Numero({ icone, tom, rotulo, valor, apoio, className = "" }: { icone: NomeIcone; tom?: "atencao"; rotulo: string; valor: string; apoio: ReactNode; className?: string }) {
  return (
    <section aria-label={rotulo} className={`flex min-w-0 flex-1 basis-[220px] items-start gap-3 rounded-[18px] border border-linha bg-superficie px-4.5 py-4 shadow-s1 max-md:basis-[140px] max-md:flex-col max-md:gap-2 max-md:p-4 ${className}`}>
      <span className="ladrilho h-10 w-10 rounded-xl" data-tom={tom ?? "violeta"} aria-hidden="true"><Icone nome={icone} className="h-[18px] w-[18px]" /></span>
      <span className="grid min-w-0 gap-0.5">
        <span className="t-apoio text-tinta-suave">{rotulo}</span>
        <span className="t-titulo-secao leading-tight">{valor}</span>
        <span className="t-apoio text-tinta-suave">{apoio}</span>
      </span>
    </section>
  );
}

function UltimaRodada({ d }: { d: DadosPrivacidade }) {
  const r = d.ultimaRodada;
  if (!r) return <Numero icone="relogio" rotulo="Última rodada" valor="Nenhuma ainda" apoio="A primeira roda nesta madrugada, às 03:10." />;
  const apoio = r.modo === "APAGANDO"
    ? <>{plural(r.total, "item apagado", "itens apagados")}<span className="max-md:hidden"> · fica no histórico</span></>
    : <>{MODOS_RETENCAO.CONTANDO}: {plural(r.total, "item contado", "itens contados")}, nada apagado</>;
  return <Numero icone="relogio" rotulo="Última rodada" valor={quandoFoi(r.em)} apoio={apoio} />;
}

/** No computador, uma tabela por grupo (quadro 350). */
function TabelaGrupo({ grupo, tipos }: { grupo: string; tipos: TipoRetencao[] }) {
  const id = `grupo-${grupo.replace(/\W+/g, "-").toLowerCase()}`;
  const cabeca = "border-b border-linha px-4 py-2.5 text-left t-apoio font-semibold text-tinta-suave";
  const celula = "border-b border-linha px-4 py-3 align-top t-texto";
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-[18px] border border-linha bg-superficie shadow-s1">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_GRUPO[grupo] ?? "lista"} className="h-[18px] w-[18px]" /></span>
        <span className="grid">
          <h2 id={id} className="t-titulo-cartao">{grupo}</h2>
          <span className="t-apoio text-tinta-suave">{plural(tipos.length, "tipo de dado", "tipos de dado")}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">{`${grupo}: o que se guarda, para quê e por quanto tempo`}</caption>
          <thead>
            <tr className="bg-superficie-2">
              <th scope="col" className={`${cabeca} w-[30%]`}>Dado</th>
              <th scope="col" className={cabeca}>Para quê</th>
              <th scope="col" className={cabeca}>Guarda por</th>
              <th scope="col" className={cabeca}>No fim do prazo</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.codigo} className="last:[&>*]:border-b-0">
                <th scope="row" className={`${celula} text-left font-normal`}>
                  <span className="grid gap-0.5"><span className="font-medium">{t.nome}</span><span className="t-apoio text-tinta-suave">{t.oQue}</span></span>
                </th>
                <td className={celula}>{t.paraQue}</td>
                <td className={celula}><span className="grid justify-items-start gap-1"><span>{t.prazo}</span><SeloSituacao t={t} /></span></td>
                <td className={`${celula} text-tinta-suave`}>{t.noFim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** No celular, os grupos abrem e fecham (quadro 351); o primeiro já vem aberto. */
function GrupoQueAbre({ grupo, tipos, inicial }: { grupo: string; tipos: TipoRetencao[]; inicial: boolean }) {
  const [aberto, setAberto] = useState(inicial);
  const id = `celular-${grupo.replace(/\W+/g, "-").toLowerCase()}`;
  const pontuar = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
  return (
    <section aria-labelledby={`${id}-titulo`} className="grid rounded-[18px] border border-linha bg-superficie px-4 py-3 shadow-s1">
      <h2 id={`${id}-titulo`} className="t-titulo-secao relative">
        <button type="button" className="elo-linha flex min-h-11 w-full items-center gap-3" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}>
          <span className="ladrilho h-10 w-10 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_GRUPO[grupo] ?? "lista"} className="h-[18px] w-[18px]" /></span>
          <span className="grid flex-1 text-left">
            <span>{grupo}</span>
            <span className="t-apoio font-normal text-tinta-suave">{plural(tipos.length, "tipo de dado", "tipos de dado")}</span>
          </span>
          <Icone nome="baixo" className={`h-5 w-5 text-tinta-suave transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <ul id={id} hidden={!aberto} className="mt-2 grid">
        {tipos.map((t) => (
          <li key={t.codigo} className="grid gap-1 border-t border-linha py-3">
            <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.nome}</span><SeloSituacao t={t} /></span>
            <span className="t-apoio text-tinta-suave">{t.oQue} · {t.paraQue}</span>
            <span className="flex items-start gap-1.5 t-texto">
              <Icone nome="relogio" className="mt-0.5 h-4 w-4 text-tinta-suave" />
              <span><strong className="font-semibold">{pontuar(t.prazo)}</strong> {pontuar(t.noFim)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Guardados({ guardados, podeCuidar, tirar }: { guardados: GuardaLegal[]; podeCuidar: boolean; tirar: (g: GuardaLegal) => void }) {
  return (
    <section aria-labelledby="guardados" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <div className="flex items-center gap-3">
        <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom="violeta" aria-hidden="true"><Icone nome="cadeado" className="h-[18px] w-[18px]" /></span>
        <h2 id="guardados" className="t-titulo-cartao">Guardados por obrigação legal</h2>
      </div>
      <p className="t-apoio text-tinta-suave">O prazo não apaga o que está aqui. Marque pela ficha do pedido, da manutenção, da encomenda ou da pessoa, em Mais ações.</p>
      {guardados.length ? (
        <ul className="mt-2 grid">
          {guardados.map((g) => {
            const href = enderecoDoGuardado(g);
            const titulo = tituloDoGuardado(g);
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 border-t border-linha py-3">
                <span className="grid min-w-0 flex-1 basis-[260px] gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {href ? <Link href={href} className="font-medium text-violeta-600 hover:underline">{titulo}</Link> : <span className="font-medium">{titulo}</span>}
                    <SeloGuardado guarda={g} />
                  </span>
                  <span className="t-texto">{[g.detalheAlvo, motivoDoGuardado(g)].filter(Boolean).join(" · ")}</span>
                  <span className="t-apoio text-tinta-suave">{quemGuardou(g)}</span>
                </span>
                {podeCuidar ? <Botao variante="contorno" aria-label={`Tirar a marca de ${titulo}`} onClick={() => tirar(g)}>Tirar a marca</Botao> : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 border-t border-linha pt-3 t-texto text-tinta-suave">Nada guardado agora.</p>}
    </section>
  );
}

function ComoFunciona({ modo, aoFechar }: { modo: DadosPrivacidade["modo"]; aoFechar: () => void }) {
  return (
    <Dialogo aberto media fechar titulo="Como funciona" aoFechar={aoFechar}>
      <ul className="grid list-disc gap-2 pl-5 t-texto">
        <li>Cada tipo de dado tem um prazo, o mesmo para todos os condomínios atendidos pela TRÍADE.</li>
        <li>Toda madrugada, às 03:10, a rotina procura o que passou do prazo e apaga o dado pessoal. A linha fica, com a data em que foi apagado, e o histórico diz quantos itens de cada tipo.</li>
        <li>O que está guardado por obrigação legal não é apagado, até alguém tirar a marca, com o motivo.</li>
        <li>Quando um morador pede, use Dados de uma pessoa para mostrar, baixar ou remover os dados dele.</li>
      </ul>
      <p className="t-apoio text-tinta-suave">
        {modo === "CONTANDO"
          ? "Agora a rotina está em Só contando: ela conta o que apagaria, sem apagar. A TRÍADE liga a exclusão depois de conferir os totais."
          : "Agora a rotina está em Apagando: o que passa do prazo é apagado de verdade."}
      </p>
      <div className="flex justify-end"><Botao variante="contorno" onClick={aoFechar}>Entendi</Botao></div>
    </Dialogo>
  );
}

export function Privacidade() {
  const { pode } = usePlataforma();
  const ve = pode("privacidade.ver");
  const carga = useCarregar<DadosPrivacidade>(ve ? BASE_PRIVACIDADE : null);
  const [tirando, setTirando] = useState<GuardaLegal | null>(null);
  const [como, setComo] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  if (!ve) {
    return <div className="grid gap-5"><Cabeca /><SemPermissao nivel={0} tela="Privacidade e dados" texto="Só o síndico vê o que o sistema guarda das pessoas e por quanto tempo." /></div>;
  }
  if (carga.estado === "carregando") return <div className="grid gap-5"><Cabeca /><Carregando rotulo="Abrindo Privacidade e dados…" /></div>;
  if (carga.estado === "erro") {
    return <div className="grid gap-5"><Cabeca /><ErroCarregar erro={carga.erro} texto={carga.texto} oQue="Privacidade e dados" tentarDeNovo={carga.recarregar} /></div>;
  }
  const d = carga.dados;
  const grupos = porGrupo(d.tipos);
  const acoes = (
    <div className="flex flex-wrap gap-2 max-md:w-full">
      {d.podeCuidar ? <Link href={ENDERECO_DADOS_PESSOA} className={classeBotao("contorno", "max-md:w-full")}><Icone nome="busca" />Dados de uma pessoa</Link> : null}
      <Botao variante="discreto" className="max-md:hidden" onClick={() => setComo(true)}><Icone nome="info" />Como funciona</Botao>
    </div>
  );

  return (
    <div className="grid gap-5">
      <Cabeca acoes={acoes} />
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      <div className="flex flex-wrap gap-4 max-md:gap-3">
        <UltimaRodada d={d} />
        <Numero icone="lixeira" tom="atencao" rotulo="Nos próximos 30 dias" valor={plural(d.proximos30, "item", "itens")}
          apoio={<>vencem o prazo<span className="max-md:hidden">; nada a fazer</span></>} />
        <Numero icone="cadeado" rotulo="Guardados por obrigação legal" valor={String(d.guardados.length)} apoio="o prazo não apaga" className="max-md:hidden" />
      </div>
      {d.modo === "CONTANDO" ? (
        <Aviso tom="info" titulo={`Rotina em ${MODOS_RETENCAO.CONTANDO.toLowerCase()}`}>
          A rotina conta o que apagaria, sem apagar nada, até a TRÍADE conferir os totais e ligar a exclusão.
          {d.vencidos ? ` Hoje, ${plural(d.vencidos, "item já passou", "itens já passaram")} do prazo e ${d.vencidos === 1 ? "será apagado" : "serão apagados"} quando a exclusão for ligada.` : " Hoje, nada passou do prazo."}
        </Aviso>
      ) : null}
      <Guardados guardados={d.guardados} podeCuidar={d.podeCuidar} tirar={setTirando} />
      <div className="grid gap-4 max-md:hidden">{grupos.map((g) => <TabelaGrupo key={g.grupo} grupo={g.grupo} tipos={g.tipos} />)}</div>
      <div className="grid gap-3 md:hidden">{grupos.map((g, i) => <GrupoQueAbre key={g.grupo} grupo={g.grupo} tipos={g.tipos} inicial={i === 0} />)}</div>
      <section aria-labelledby="outro-prazo" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-dashed border-violeta-300 bg-violeta-50 px-5 py-4 max-md:hidden">
        <span className="grid max-w-[70ch] gap-0.5">
          <h2 id="outro-prazo" className="t-titulo-cartao">Quer outro prazo?</h2>
          <span className="t-apoio">Os prazos são os mesmos para todos os condomínios atendidos pela TRÍADE. Para mudar um, peça à TRÍADE: a mudança fica registrada.</span>
        </span>
        <Link href="/suporte" className={classeBotao("contorno")}><Icone nome="trocar" />Pedir mudança</Link>
      </section>
      <Link href="/suporte" className="justify-self-center t-texto font-medium text-violeta-600 hover:underline md:hidden">Quer outro prazo? Pedir mudança à TRÍADE</Link>
      {tirando ? (
        <JanelaTirarGuarda guarda={tirando} aoFechar={() => setTirando(null)}
          aoTirar={() => { setRecado(`A marca de ${tituloDoGuardado(tirando)} saiu. O prazo volta a valer.`); setTirando(null); carga.recarregar(); }} />
      ) : null}
      {como ? <ComoFunciona modo={d.modo} aoFechar={() => setComo(false)} /> : null}
    </div>
  );
}
