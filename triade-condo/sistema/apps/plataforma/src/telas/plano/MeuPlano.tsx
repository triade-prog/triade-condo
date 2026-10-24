"use client";
// Meu plano (NG-21; quadros 253 a 255, decisões E.1 e F.1): o plano e os conjuntos com as telas de
// cada um, sem valores nem pagamentos. O que está fora do plano aparece com o que traz, e o pedido
// de teste ou de contratação vira um chamado para a TRÍADE, já preenchido; nada é liberado sozinho.
// Também aqui: a tela de um conjunto fora do plano e o aviso do conjunto suspenso.

import Link from "next/link";
import { useState } from "react";
import { formatarData, mostrarDataSemHora, type Conjunto, type ModoConjunto } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";

interface ConjuntoDoPlano {
  codigo: Conjunto;
  nome: string;
  base: boolean;
  resumo: string;
  telas: string[];
  modo: ModoConjunto;
  situacao: "BASE" | "LIBERADO" | "TESTE" | "SUSPENSO" | "LIBERANDO" | "FORA";
  testeAte?: string;
  suspensoEm?: string;
}

interface DadosMeuPlano {
  plano?: { nome: string; unidadesDe?: number; unidadesAte?: number; desde: string };
  unidadesAtivas: number;
  conjuntos: ConjuntoDoPlano[];
  podePedir: boolean;
}

export const ICONE_CONJUNTO: Record<Conjunto, NomeIcone> = {
  ATENDIMENTO: "pedido", AGENDA: "calendario", MANUTENCAO: "ferramenta", VIDA: "convivio", COMUNICACAO_AMPLIADA: "megafone",
};

function SeloSituacao({ c }: { c: ConjuntoDoPlano }) {
  switch (c.situacao) {
    case "BASE": return <Selo tom="ok">Base</Selo>;
    case "LIBERADO": return <Selo tom="ok">Liberado</Selo>;
    case "TESTE": return <Selo tom="info">{`Em teste até ${mostrarDataSemHora(c.testeAte!)}`}</Selo>;
    case "SUSPENSO": return <Selo tom="neutro">Só para consultar</Selo>;
    case "LIBERANDO": return <Selo tom="andamento">Contratado · a TRÍADE está liberando</Selo>;
    default: return <Selo tom="neutro">Fora do plano</Selo>;
  }
}

/** Pedir para testar ou contratar: abre um chamado de Ajuda e suporte. */
function usePedir() {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [resposta, setResposta] = useState<{ ok: true; numero: number } | { ok: false; erro: ErroApi } | null>(null);
  async function pedir(conjunto: Conjunto, pedido: "TESTE" | "CONTRATAR") {
    setEnviando(`${conjunto}-${pedido}`);
    const r = await chamarApi<{ id: string; numero: number }>("/v1/condominio/plano/pedidos", { corpo: { conjunto, pedido } });
    setEnviando(null);
    setResposta(r.ok ? { ok: true, numero: r.dados.numero } : { ok: false, erro: r.erro });
  }
  return { enviando, resposta, pedir };
}

function Resposta({ r }: { r: ReturnType<typeof usePedir>["resposta"] }) {
  if (!r) return null;
  return r.ok
    ? <Aviso tom="ok" papel="status">Pedido enviado à TRÍADE: chamado {r.numero}. Acompanhe em <Link href="/suporte" className="font-semibold underline">Ajuda e suporte</Link>.</Aviso>
    : <Aviso tom="erro" papel="alert">{textoDoErro(r.erro)}</Aviso>;
}

function Bloco({ c, pedir, enviando, podePedir }: { c: ConjuntoDoPlano; pedir: (c: Conjunto, p: "TESTE" | "CONTRATAR") => void; enviando: string | null; podePedir: boolean }) {
  const fora = c.situacao === "FORA" || c.situacao === "SUSPENSO";
  return (
    <li className="flex items-start gap-3.5 border-t border-linha py-3.5">
      <span className="ladrilho" data-tom={fora ? undefined : "violeta"} aria-hidden="true"><Icone nome={ICONE_CONJUNTO[c.codigo]} /></span>
      <span className="grid flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2"><span className="t-texto font-semibold">{c.nome}</span><SeloSituacao c={c} /></span>
        <span className="t-apoio text-tinta-suave">{c.telas.join(" · ")}</span>
        {c.situacao === "TESTE" ? <span className="t-apoio">Depois de {mostrarDataSemHora(c.testeAte!)}, o que você criou continua guardado para consultar.</span> : null}
        {c.situacao === "SUSPENSO" ? <span className="t-apoio">Você ainda vê e exporta o que já existe; para criar coisas novas, o conjunto precisa estar no plano.</span> : null}
        {fora && podePedir ? (
          <span className="mt-1 flex flex-wrap gap-2">
            <Botao variante="contorno" tamanho="m" disabled={!!enviando} onClick={() => pedir(c.codigo, "TESTE")}>Pedir para testar</Botao>
            <Botao variante="discreto" tamanho="m" disabled={!!enviando} onClick={() => pedir(c.codigo, "CONTRATAR")}>Quero contratar</Botao>
          </span>
        ) : null}
      </span>
    </li>
  );
}

export function MeuPlano() {
  const { painel } = usePlataforma();
  const carga = useCarregar<DadosMeuPlano>("/v1/condominio/plano");
  const { enviando, resposta, pedir } = usePedir();
  const cab = (
    <div className="grid gap-3">
      <Link href="/configuracoes" className="inline-flex items-center gap-1 t-apoio font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Configurações</Link>
      <div className="grid gap-1">
        <h1 className="t-titulo-tela font-normal tracking-tight">Meu plano</h1>
        <p className="t-apoio text-tinta-suave">O que está no plano do {painel.condominio.nome} e as telas de cada parte.</p>
      </div>
    </div>
  );
  if (carga.estado === "carregando") return <div className="grid gap-5">{cab}<Carregando rotulo="Abrindo o plano…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-5">{cab}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const d = carga.dados;
  const no = d.conjuntos.filter((c) => ["BASE", "LIBERADO", "TESTE"].includes(c.situacao));
  const fora = d.conjuntos.filter((c) => !no.includes(c));
  const faixa = d.plano?.unidadesAte ? `Até ${d.plano.unidadesAte} unidades` : d.plano?.unidadesDe ? `A partir de ${d.plano.unidadesDe} unidades` : null;

  return (
    <div className="grid gap-5">
      {cab}
      <section aria-label="Seu plano" className="flex flex-wrap items-center gap-6 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <span className="ladrilho h-11 w-11 rounded-[14px]" data-tom="violeta" aria-hidden="true"><Icone nome="camadas" /></span>
        <span className="grid flex-1 gap-0.5">
          <span className="t-apoio text-tinta-suave">Seu plano</span>
          <span className="t-titulo-secao font-medium">{d.plano?.nome ?? "Plano em definição"}</span>
          <span className="t-apoio text-tinta-suave">{[faixa, `${d.unidadesAtivas} unidades ativas`, d.plano ? `desde ${formatarData(d.plano.desde)}` : null].filter(Boolean).join(" · ")}</span>
        </span>
        {d.podePedir ? <Link href="/suporte" className="t-apoio font-semibold text-violeta-600 hover:underline">Dúvidas sobre o plano? Fale com a TRÍADE</Link> : null}
      </section>
      <Resposta r={resposta} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section aria-labelledby="no-plano" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <h2 id="no-plano" className="t-titulo-cartao">No seu plano</h2>
          <p className="t-apoio text-tinta-suave">O que você e a sua equipe usam hoje.</p>
          <ul className="mt-1 grid">{no.map((c) => <Bloco key={c.codigo} c={c} pedir={pedir} enviando={enviando} podePedir={d.podePedir} />)}</ul>
        </section>
        {fora.length ? (
          <section aria-labelledby="fora-plano" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="fora-plano" className="t-titulo-cartao">Fora do seu plano</h2>
            <p className="t-apoio text-tinta-suave">Aparece aqui, com o que traz, para você saber que existe.</p>
            <ul className="mt-1 grid">{fora.map((c) => <Bloco key={c.codigo} c={c} pedir={pedir} enviando={enviando} podePedir={d.podePedir} />)}</ul>
          </section>
        ) : null}
      </div>
      <p className="t-apoio text-tinta-suave">Valores e pagamentos ficam entre a TRÍADE e quem assinou o contrato.</p>
    </div>
  );
}

const NOMES: Record<Conjunto, string> = {
  ATENDIMENTO: "Atendimento", AGENDA: "Agenda", MANUTENCAO: "Manutenção", VIDA: "Vida em condomínio", COMUNICACAO_AMPLIADA: "Comunicação ampliada",
};

/** A tela de um conjunto fora do plano (E.1): diz o que ele traz, em vez de dar erro. */
export function ForaDoPlano({ conjunto }: { conjunto: Conjunto }) {
  const { pode } = usePlataforma();
  const carga = useCarregar<DadosMeuPlano>(pode("config.ver") ? "/v1/condominio/plano" : null);
  const { enviando, resposta, pedir } = usePedir();
  const c = carga.estado === "pronto" ? carga.dados.conjuntos.find((x) => x.codigo === conjunto) : undefined;
  const podePedir = carga.estado === "pronto" ? carga.dados.podePedir : false;
  return (
    <div className="grid gap-4">
      <section className="flex items-start gap-4 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-4">
        <span className="ladrilho h-12 w-12 rounded-[14px]" aria-hidden="true"><Icone nome={ICONE_CONJUNTO[conjunto]} /></span>
        <span className="grid flex-1 gap-1.5">
          <span className="flex flex-wrap items-center gap-2"><h1 className="t-titulo-tela">{NOMES[conjunto]}</h1><Selo tom="neutro">Fora do plano</Selo></span>
          <span className="t-texto">{c?.resumo ?? "Esta parte não está no plano do condomínio."}</span>
          {c ? <ul className="mt-1 grid list-disc gap-1 pl-5 t-texto">{c.telas.map((t) => <li key={t}>{t}</li>)}</ul> : null}
          <span className="mt-2 flex flex-wrap gap-2">
            {podePedir ? <Botao disabled={!!enviando} onClick={() => pedir(conjunto, "TESTE")}>Pedir para testar</Botao> : null}
            {pode("config.ver") ? <Link href="/configuracoes/meu-plano" className={classeBotao("discreto")}>Ver Meu plano</Link> : null}
          </span>
        </span>
      </section>
      <Resposta r={resposta} />
    </div>
  );
}

/** No alto da tela de um conjunto suspenso (C.1): dá para ver e exportar, não criar. */
export function AvisoSuspenso({ conjunto }: { conjunto: Conjunto }) {
  const { pode } = usePlataforma();
  return (
    <Aviso tom="neutro" titulo={`${NOMES[conjunto]} está só para consultar`} className="mb-5">
      Você ainda vê e exporta o que já está aqui. Para criar coisas novas, fale com a TRÍADE.
      {pode("config.ver") ? <> <Link href="/configuracoes/meu-plano" className="font-semibold text-violeta-600 underline-offset-2 hover:underline">Ver Meu plano</Link></> : null}
    </Aviso>
  );
}

/** O modo de cada conjunto, para o menu e para a tela; sem resposta, nada é escondido (o banco recusa). */
export type ModosConjunto = Partial<Record<Conjunto, ModoConjunto>>;
