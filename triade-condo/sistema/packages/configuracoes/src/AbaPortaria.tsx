"use client";
// Configurações › Prédio › Portaria (Portaria 1, CF-12, V-04 a V-06; desenho EN-config-portaria):
// quem cuida da portaria (a permissão fica em Pessoas e acesso), os lugares onde se guarda, o
// lembrete da encomenda guardada há muito tempo e o cenário do prédio, que é da TRÍADE. Lembrete e
// "eu também recebo" vão na barra de salvar; incluir e tirar de uso um lugar grava na hora, como as
// etapas. Prédio sem portaria e sem ninguém indicado: as entregas vão direto ao morador.

import Link from "next/link";
import { useState } from "react";
import { CENARIOS, SITUACOES_MODELO, type Cenario, type SituacaoModelo } from "@triade/domain";
import { AvisoErro, Botao, CampoTexto, Carregando, chamarApi, ErroCarregar, Icone, Iniciais, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, ParteNumerada } from "./comum.tsx";
import { useAmbiente, useCarregar, naBase } from "./contexto.tsx";
import { Janela, type Campo, type Valores } from "./Janela.tsx";
import { useParte, useVersao } from "./salvar.tsx";
import { PedirMudanca, SeloTriade } from "./tecnica.tsx";
import type { PropsAba } from "./Configuracoes.tsx";

export interface LugarEncomenda { id: string; nome: string; ativo: boolean; versao: number; guardadas: number }
export interface Portaria {
  cenario: Cenario | null;
  lembreteLigado: boolean;
  lembreteDias: number;
  sindicoIndicado: boolean;
  versao: number;
  lugares: LugarEncomenda[];
  quemCuida: { pessoaId: string; nome: string; cargo: string | null; sindico: boolean; cuida: boolean }[];
  modelo: { titulo: string; situacao: SituacaoModelo } | null;
  pode: { editar: boolean };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const cuidam = (p: Portaria) => p.quemCuida.filter((q) => q.cuida).length;

/** O resumo na entrada das Configurações. */
export function resumoPortaria(p: Portaria): string {
  const n = cuidam(p);
  const quem = n ? `${plural(n, "pessoa cuida", "pessoas cuidam")}` : "Entregas direto ao morador";
  return `${quem} · ${plural(p.lugares.filter((l) => l.ativo).length, "lugar", "lugares")} · ${p.lembreteLigado ? `lembrete em ${p.lembreteDias} dias` : "sem lembrete"}`;
}

/** O que cada cenário quer dizer para a portaria (V-04 a V-06). */
const TEXTO_CENARIO: Record<Cenario, string> = {
  SEM_PORTARIA: "As entregas vão direto ao morador. A Portaria só aparece se o condomínio indicar alguém do prédio, como o zelador ou o síndico, com a permissão. A pessoa indicada vê só o que ela mesma registra.",
  PORTARIA_REMOTA: "A empresa de portaria não tem conta. Encomendas só entram se alguém do prédio for indicado para guardar e entregar.",
  PORTARIA_PRESENCIAL: "Cada porteiro tem conta própria e a permissão Cuidar da portaria. Quem guardou e quem entregou ficam registrados.",
};
const ORDEM_CENARIOS: Cenario[] = ["SEM_PORTARIA", "PORTARIA_REMOTA", "PORTARIA_PRESENCIAL"];

export function AbaPortaria({ salvo }: PropsAba) {
  const carga = useCarregar<Portaria>(naBase("/portaria"));
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a portaria…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return <Formulario key={carga.dados.versao} p={carga.dados} recarregar={carga.recarregar} salvo={salvo} />;
}

function Formulario({ p, recarregar, salvo }: { p: Portaria; recarregar: () => void; salvo: (t: string) => void }) {
  const { onde } = useAmbiente();
  const noApp = onde === "app";
  const pode = p.pode.editar;
  const presencial = p.cenario === "PORTARIA_PRESENCIAL";
  const [v, setV] = useState({ lembreteLigado: p.lembreteLigado, lembreteDias: String(p.lembreteDias), sindicoIndicado: p.sindicoIndicado });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [edicao, setEdicao] = useState<{ item: LugarEncomenda | null } | null>(null);
  const versao = useVersao("config", p.versao);
  const dias = Number(v.lembreteDias);
  const diasOk = Number.isInteger(dias) && dias >= 1 && dias <= 60;

  async function salvar(): Promise<string | null> {
    setErro(null);
    if (!diasOk) { setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["lembreteDias"] } }); return null; }
    const r = await chamarApi(naBase("/portaria"), {
      metodo: "PUT", corpo: { versao: versao.atual(), lembreteLigado: v.lembreteLigado, lembreteDias: dias, sindicoIndicado: v.sindicoIndicado },
    });
    if (!r.ok) { setErro(r.erro); return null; }
    versao.gravou(r.dados);
    return "Portaria salva.";
  }
  useParte("portaria", {
    nome: "Portaria",
    mudancas: Number(v.lembreteLigado !== p.lembreteLigado) + Number(v.lembreteDias !== String(p.lembreteDias)) + Number(v.sindicoIndicado !== p.sindicoIndicado),
    salvar,
  });

  const quem = p.quemCuida;
  const n = cuidam(p);
  const camposLugar: Campo[] = [
    { id: "nome", rotulo: "Nome do lugar", tipo: "texto", obrigatorio: true, max: 40, erro: "De 2 a 40 caracteres, sem repetir outro lugar em uso." },
    ...(edicao?.item ? [{ id: "ativo", rotulo: "Em uso", tipo: "caixa", ajuda: "Fora de uso, não aparece para escolher ao registrar. Onde as encomendas antigas ficaram não muda." } as Campo] : []),
  ];
  const iniciaisLugar: Valores = { nome: edicao?.item?.nome ?? "", ativo: edicao?.item?.ativo ?? true };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-5">
        {erro ? <AvisoErro erro={erro} texto={erro.codigo === "VALIDATION_ERROR" && !diasOk ? "Lembrar depois de 1 a 60 dias." : textoDoErro(erro)} recarregar={recarregar} /> : null}

        <ParteNumerada n={1} id="t-quem-cuida" titulo="Quem cuida da portaria">
          {quem.length === 0 ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-linha px-4 py-3">
              <p className="t-texto font-medium">Neste prédio, as entregas vão direto ao morador.</p>
              <p className="t-apoio text-tinta-suave">Se alguém do prédio recebe encomendas, como o zelador ou você, indique a pessoa. A Portaria aparece no menu dela.</p>
              {noApp ? <Link href="/pessoas" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">Indicar quem recebe<Icone nome="dir" className="h-4 w-4" /></Link> : null}
            </div>
          ) : (
            <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {quem.map((q) => (
                <li key={q.pessoaId} className="flex items-center gap-3 px-4 py-2.5">
                  <Iniciais nome={q.nome} />
                  <span className="grid min-w-0 flex-1">
                    <span className="t-texto font-medium">{q.nome}</span>
                    <span className="t-apoio text-tinta-suave">{[q.cargo, q.sindico ? "pode tudo" : "conta própria"].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Selo tom={q.cuida ? "ok" : "neutro"}>{q.cuida ? "Cuida" : "Vê"}</Selo>
                </li>
              ))}
            </ul>
          )}
          {quem.length && noApp ? (
            <Link href="/pessoas" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
              Dar ou tirar a permissão em Pessoas e acesso<Icone nome="dir" className="h-4 w-4" />
            </Link>
          ) : null}
          {!presencial && pode && noApp ? (
            <Caixa id="portaria-sindico" rotulo="Eu também recebo e entrego encomendas" marcada={v.sindicoIndicado}
              aoMudar={(x) => setV({ ...v, sindicoIndicado: x })}
              ajuda="Para o síndico deste prédio, a Portaria aparece no menu. Quem cuida da portaria continua sendo indicado em Pessoas e acesso." />
          ) : null}
          <p className="t-apoio text-tinta-suave">Só registra e entrega quem tem conta própria e a permissão Cuidar da portaria. Cada registro guarda o nome de quem fez. Não há conta do posto nem vizinho de plantão.</p>
        </ParteNumerada>

        <ParteNumerada n={2} id="t-lugares" titulo="Onde se guarda"
          direita={pode ? <Botao variante="contorno" tamanho="m" onClick={() => setEdicao({ item: null })}><Icone nome="mais" />Incluir lugar</Botao> : undefined}>
          {p.lugares.length === 0 ? <p className="rounded-2xl border border-dashed border-linha px-4 py-2.5 t-apoio text-tinta-suave">Nenhum lugar ainda.</p> : (
            <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {p.lugares.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="grid">
                    <span className={`t-texto ${l.ativo ? "font-medium" : "text-tinta-suave"}`}>{l.nome}</span>
                    <span className="t-apoio text-tinta-suave">{l.guardadas ? `${plural(l.guardadas, "guardada", "guardadas")} agora` : "Nada guardado agora"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {l.ativo ? null : <Selo tom="neutro">Fora de uso</Selo>}
                    {pode ? <Botao variante="discreto" onClick={() => setEdicao({ item: l })} aria-label={`Editar o lugar ${l.nome}`}>Editar</Botao> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="t-apoio text-tinta-suave">Aparecem como escolha ao registrar. Tirar de uso um lugar não apaga onde as encomendas antigas ficaram.</p>
        </ParteNumerada>

        <ParteNumerada n={3} id="t-lembrete" titulo="Encomenda guardada há muito tempo">
          {pode ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <CampoTexto id="portaria-dias" rotulo="Lembrar depois de" type="number" inputMode="numeric" min={1} max={60} className="w-32"
                  value={v.lembreteDias} onChange={(e) => setV({ ...v, lembreteDias: e.target.value })}
                  erro={diasOk ? undefined : "De 1 a 60 dias."} />
                <span className="pb-2.5 t-texto">dias guardada</span>
              </div>
              <p className="t-apoio text-tinta-suave">Depois disso a encomenda entra no atalho Guardadas há mais de {diasOk ? dias : p.lembreteDias} dias, na lista da portaria.</p>
              <Caixa id="portaria-lembrete" rotulo="Mandar um lembrete à unidade" marcada={v.lembreteLigado} aoMudar={(x) => setV({ ...v, lembreteLigado: x })}
                ajuda="Uma vez só, pelo mesmo modelo Encomenda guardada, com a data em que chegou. Quem pediu PARAR não recebe." />
            </>
          ) : (
            <ul className="grid gap-2 t-texto">
              <li>Guardada há muito tempo depois de {plural(p.lembreteDias, "dia", "dias")}</li>
              <li>Lembrete à unidade: {p.lembreteLigado ? "ligado" : "desligado"}</li>
            </ul>
          )}
        </ParteNumerada>

        <section aria-labelledby="t-cenario" className="grid gap-3 rounded-[18px] border border-linha bg-superficie-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2"><h2 id="t-cenario" className="t-titulo-secao font-medium">O cenário do prédio</h2><SeloTriade /></span>
            <PedirMudanca parte="CENARIO_PORTARIA" valor={p.cenario ? CENARIOS[p.cenario] : "Sem cenário"} />
          </div>
          <ul className="grid gap-2">
            {ORDEM_CENARIOS.map((c) => (
              <li key={c} className={`grid gap-0.5 rounded-2xl border px-4 py-3 ${c === p.cenario ? "border-violeta-300 bg-superficie" : "border-linha"}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="t-texto font-medium">{CENARIOS[c].replace("Prédio sem portaria", "Sem portaria")}</span>
                  {c === p.cenario ? <Selo tom="info">Este prédio</Selo> : null}
                </span>
                <span className="t-apoio text-tinta-suave">{TEXTO_CENARIO[c]}</span>
              </li>
            ))}
          </ul>
          <p className="t-apoio text-tinta-suave">Definido na implantação. O texto da Portaria, no menu e nas telas vazias, segue o cenário.</p>
        </section>
      </div>

      <section aria-labelledby="t-mesma-area-portaria" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 lg:sticky lg:top-6">
        <h2 id="t-mesma-area-portaria" className="t-rotulo pb-1">Na mesma área</h2>
        <ul className="grid">
          <li className="flex min-h-[52px] items-center gap-3 py-2.5">
            <span className="grid min-w-0 flex-1">
              <span className="t-texto font-medium">Modelo {p.modelo?.titulo ?? "Encomenda guardada"}</span>
              <span className="t-apoio text-tinta-suave">{p.modelo ? (p.modelo.situacao === "APROVADO_PILOTO" ? "Aprovado pela administração para o piloto" : SITUACOES_MODELO[p.modelo.situacao]) : "Ainda sem modelo"}</span>
            </span>
          </li>
          {noApp ? (
            <li className="border-t border-linha">
              <Link href="/pessoas" className="flex min-h-[52px] items-center gap-3 py-2.5 hover:text-violeta-600">
                <span className="grid min-w-0 flex-1">
                  <span className="t-texto font-medium">Pessoas e acesso</span>
                  <span className="t-apoio text-tinta-suave">{n ? plural(n, "pessoa cuida da portaria", "pessoas cuidam da portaria") : "Ninguém cuida da portaria"}</span>
                </span>
                <Icone nome="dir" className="h-[18px] w-[18px] shrink-0 text-tinta-suave" />
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      {edicao ? (
        <Janela aberto titulo={edicao.item ? "Editar lugar" : "Incluir lugar"} textoBotao="Salvar lugar"
          campos={camposLugar} iniciais={iniciaisLugar} aoFechar={() => setEdicao(null)} recarregar={recarregar}
          aoSalvar={async (x) => {
            const l = edicao.item;
            const r = l
              ? await chamarApi(naBase(`/portaria/lugares/${l.id}`), { metodo: "PUT", corpo: { versao: l.versao, nome: x.nome, ativo: x.ativo === true } })
              : await chamarApi(naBase("/portaria/lugares"), { corpo: { nome: x.nome, ativo: true } });
            if (r.ok) { setEdicao(null); recarregar(); salvo(l ? "Lugar salvo." : "Lugar incluído."); }
            return r;
          }} />
      ) : null}
    </div>
  );
}
