"use client";
// Vida em condomínio › Assembleias (design "Vida em condomínio", tela 6; DC15, telas-modelo
// vida-assembleia*; AC-02): a lista em abas, com a regra em vigor numa linha e a linha inteira
// abrindo a assembleia; as regras da convenção (antecedência e peso do voto) e a fração ideal de
// cada unidade, que o voto pela fração pede antes de convocar; e a assembleia nova em página.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ESTADOS_ASSEMBLEIA, FORMAS_ASSEMBLEIA, formatarDataHora, PESOS_ASSEMBLEIA, TIPOS_ASSEMBLEIA,
  type EstadoAssembleia, type FormaAssembleia, type PesoAssembleia, type TipoAssembleia,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi, type Tom,
} from "@triade/ui";
import type { ItemMenu } from "../moradores/comum.tsx";
import { diaDe } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Fracoes, ListaAssembleias } from "../tipos.ts";
import { DiaQuadro } from "./comum.tsx";

const TOM_ESTADO: Record<EstadoAssembleia, Tom> = { RASCUNHO: "neutro", CONVOCADA: "info", EM_ANDAMENTO: "andamento", ENCERRADA: "ok", CANCELADA: "neutro" };

export function SeloAssembleia({ estado }: { estado: EstadoAssembleia }) {
  return <Selo tom={TOM_ESTADO[estado]}>{ESTADOS_ASSEMBLEIA[estado]}</Selo>;
}

/** "Ordinária · híbrida". */
export function tipoEForma(a: { tipo: TipoAssembleia; forma: FormaAssembleia }): string {
  return `${TIPOS_ASSEMBLEIA[a.tipo]} · ${FORMAS_ASSEMBLEIA[a.forma].toLowerCase()}`;
}

type Dialogos = "regras" | "fracoes" | null;

/** As abas (DC15): o que vem, o que está correndo e o que já passou. */
const ABAS = { PROXIMAS: "Próximas", EM_ANDAMENTO: "Em andamento", ENCERRADAS: "Encerradas" } as const;
type Aba = keyof typeof ABAS;
const ABA_DO_ESTADO: Record<EstadoAssembleia, Aba> = { RASCUNHO: "PROXIMAS", CONVOCADA: "PROXIMAS", EM_ANDAMENTO: "EM_ANDAMENTO", ENCERRADA: "ENCERRADAS", CANCELADA: "ENCERRADAS" };
const TOM_DIA: Record<EstadoAssembleia, Tom | "violeta"> = { RASCUNHO: "neutro", CONVOCADA: "info", EM_ANDAMENTO: "andamento", ENCERRADA: "neutro", CANCELADA: "neutro" };

/** Regras da convenção e Frações ideais vão para o Mais ações do topo (decisão C.1 de
 * 22/10/2026); na rodada Gestão, passam para Configurações. */
export function AbaAssembleias({ aoMudar, definirMais }: { aoMudar: (texto: string) => void; definirMais: (itens: ItemMenu[]) => void }) {
  const carga = useCarregar<ListaAssembleias>("/v1/condominio/assembleias");
  const [dialogo, setDialogo] = useState<Dialogos>(null);
  const l = carga.estado === "pronto" ? carga.dados : null;
  const [aba, setAba] = useState<Aba | null>(null);
  const configurar = !!l?.pode.configurar;
  const fracoes = !!l?.pode.fracoes;

  useEffect(() => {
    definirMais([
      ...(configurar ? [{ texto: "Regras da convenção", icone: "ajuste" as const, acao: () => setDialogo("regras") }] : []),
      ...(fracoes ? [{ texto: "Frações ideais", icone: "grafico" as const, acao: () => setDialogo("fracoes") }] : []),
    ]);
  }, [configurar, fracoes, definirMais]);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as assembleias…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="as assembleias" />;
  const lista = carga.dados;
  const daAba = (a: Aba) => lista.assembleias.filter((x) => ABA_DO_ESTADO[x.estado] === a);
  // Abre onde há algo acontecendo: em andamento primeiro, se houver.
  const atual: Aba = aba ?? (daAba("EM_ANDAMENTO").length ? "EM_ANDAMENTO" : "PROXIMAS");
  const itens = daAba(atual);
  const fechar = (texto?: string) => { setDialogo(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid gap-4">
      <section aria-labelledby="t-assembleias" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-assembleias" className="sr-only">Assembleias</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {(Object.keys(ABAS) as Aba[]).map((a) => {
            const esta = atual === a;
            const n = daAba(a).length;
            return (
              <button key={a} type="button" aria-pressed={esta} onClick={() => setAba(a)}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${esta ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {ABAS[a]}
                {n ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${esta ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span></> : null}
              </button>
            );
          })}
        </nav>
        <p className="flex items-start gap-2 py-3 t-apoio text-tinta-suave md:border-b md:border-linha md:bg-fundo md:px-5">
          <Icone nome="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Regra em vigor: convocação com {lista.regras.antecedencia} dias de antecedência · {PESOS_ASSEMBLEIA[lista.regras.peso].toLowerCase()} · votam o proprietário ou o procurador com procuração aceita.</span>
        </p>
        {lista.regras.peso === "FRACAO" && lista.semFracao ? (
          <div className="pb-3 md:px-5 md:pt-3">
            <Aviso tom="atencao">{lista.semFracao === 1 ? "1 unidade está" : `${lista.semFracao} unidades estão`} sem fração ideal: preencha em Mais ações › Frações ideais antes de convocar.</Aviso>
          </div>
        ) : null}
        {itens.length === 0 ? (
          <div className="md:p-5">
            <Vazio titulo={atual === "PROXIMAS" ? "Nenhuma assembleia marcada" : atual === "EM_ANDAMENTO" ? "Nenhuma assembleia em andamento" : "Nenhuma assembleia encerrada"} icone="pessoas">
              {atual === "PROXIMAS" ? "Monte a pauta e convoque: o edital vai como comunicado e cada unidade recebe um link para indicar procurador, registrar presença e votar." : null}
            </Vazio>
          </div>
        ) : (
          <ul aria-label="Assembleias" className="grid max-md:gap-3">
            {itens.map((a) => (
              <li key={a.id} className={`relative grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[52px_minmax(0,1.4fr)_minmax(0,1fr)_140px_20px] md:border-t md:border-linha md:first:border-t-0`}>
                <DiaQuadro d={diaDe(a.primeiraChamada)} tom={TOM_DIA[a.estado]} />
                <span className="grid min-w-0 gap-0.5">
                  <Link href={`/vida/assembleia?id=${a.id}`} className="t-texto font-medium after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{a.titulo}</Link>
                  <span className="t-apoio">{tipoEForma(a)} · {a.itens === 1 ? "1 item" : `${a.itens} itens`} na pauta</span>
                  {a.procuracoesPendentes ? <span className="t-apoio md:hidden">{procuracoes(a.procuracoesPendentes)}</span> : null}
                  <span className="pt-1 md:hidden"><SeloAssembleia estado={a.estado} /></span>
                </span>
                <span className="t-apoio text-tinta-suave max-md:hidden">
                  {a.estado === "EM_ANDAMENTO" || a.estado === "ENCERRADA" ? `${a.presentes} de ${a.unidades} unidades presentes` : `1ª chamada às ${formatarDataHora(a.primeiraChamada).slice(11)}`}
                  {a.procuracoesPendentes ? ` · ${procuracoes(a.procuracoesPendentes)}` : ""}
                </span>
                <span className="justify-self-start max-md:hidden"><SeloAssembleia estado={a.estado} /></span>
                <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
          <span className="t-apoio">{itens.length === 1 ? "1 assembleia" : `${itens.length} assembleias`}</span>
          <span className="t-apoio">Ao convocar, o edital vai como comunicado.</span>
        </div>
      </section>
      <p className="t-apoio">
        O quórum de cada item segue a convenção do prédio: confira antes de convocar. A videochamada é de um serviço de fora (Meet, Zoom ou Jitsi);
        o sistema cuida da presença, das procurações e dos votos.
      </p>
      {dialogo === "regras" ? <Regras regras={lista.regras} aoFechar={fechar} /> : null}
      {dialogo === "fracoes" ? <FracoesIdeais aoFechar={fechar} /> : null}
    </div>
  );
}

function Regras({ regras, aoFechar }: { regras: ListaAssembleias["regras"]; aoFechar: (texto?: string) => void }) {
  const [antecedencia, setAntecedencia] = useState(String(regras.antecedencia));
  const [peso, setPeso] = useState<PesoAssembleia>(regras.peso);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/assembleias/regras", { metodo: "PUT", corpo: { versao: regras.versao, antecedencia: Number(antecedencia), peso } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar("Regras da convenção salvas. Valem para as próximas convocações.");
  }

  return (
    <Dialogo aberto titulo="Regras da convenção" aoFechar={() => aoFechar()}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="as-antecedencia" rotulo="Antecedência da convocação, em dias" type="number" min={1} max={60} inputMode="numeric"
          value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)}
          erro={comErro.includes("antecedencia") ? "De 1 a 60 dias" : null} ajuda="Quantos dias antes da 1ª chamada o edital precisa sair" />
        <CampoSelecao id="as-peso" rotulo="Peso do voto" value={peso} onChange={(e) => setPeso(e.target.value as PesoAssembleia)}
          opcoes={(Object.keys(PESOS_ASSEMBLEIA) as PesoAssembleia[]).map((v) => ({ valor: v, texto: PESOS_ASSEMBLEIA[v] }))}
          ajuda={peso === "FRACAO" ? "Cada unidade pesa a sua fração ideal: todas precisam da fração" : "Cada unidade vale um voto, qualquer que seja o tamanho"} />
        <p className="t-apoio text-tinta-suave">Confira na convenção do prédio. A assembleia já convocada guarda as regras da época.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>Salvar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** "40" ou "2,5" para o campo; vazio quando a unidade não tem fração. */
const fracaoTexto = (f?: number) => (f === undefined || f === null ? "" : String(f).replace(".", ","));

function FracoesIdeais({ aoFechar }: { aoFechar: (texto?: string) => void }) {
  const carga = useCarregar<Fracoes>("/v1/condominio/fracoes");
  return (
    <Dialogo aberto titulo="Frações ideais" aoFechar={() => aoFechar()}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando as unidades…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <FormFracoes f={carga.dados} aoFechar={aoFechar} /> : null}
    </Dialogo>
  );
}

function FormFracoes({ f, aoFechar }: { f: Fracoes; aoFechar: (texto?: string) => void }) {
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(f.unidades.map((u) => [u.id, fracaoTexto(u.fracao)])));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const numero = (t: string) => (t.trim() === "" ? null : Number(t.trim().replace(",", ".")));
  const soma = f.unidades.reduce((s, u) => s + (numero(valores[u.id] ?? "") ?? 0), 0);
  const invalidas = f.unidades.filter((u) => { const n = numero(valores[u.id] ?? ""); return n !== null && (Number.isNaN(n) || n <= 0 || n > 100); });

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (invalidas.length) return;
    setErro(null);
    setEnviando(true);
    const mudadas = f.unidades.filter((u) => numero(valores[u.id] ?? "") !== (u.fracao ?? null))
      .map((u) => ({ unidadeId: u.id, fracao: numero(valores[u.id] ?? ""), versao: u.versao }));
    const r = await chamarApi<{ alteradas: number }>("/v1/condominio/fracoes", { metodo: "PUT", corpo: { fracoes: mudadas } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar(r.dados.alteradas ? `Frações salvas: ${r.dados.alteradas === 1 ? "1 unidade" : `${r.dados.alteradas} unidades`}.` : "Nenhuma fração mudou.");
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-3 t-texto">
      <p className="text-tinta-suave">Em porcentagem, como na convenção ou na matrícula. A soma de todas fica perto de 100%.</p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {f.unidades.length === 0 ? <p>Nenhuma unidade ativa.</p> : (
        <ul className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {f.unidades.map((u) => (
            <li key={u.id}>
              <CampoTexto id={`fr-${u.id}`} rotulo={u.nome} inputMode="decimal" value={valores[u.id] ?? ""} disabled={!f.pode.editar}
                onChange={(e) => setValores((v) => ({ ...v, [u.id]: e.target.value }))}
                erro={invalidas.some((x) => x.id === u.id) ? "Entre 0 e 100" : null} />
            </li>
          ))}
        </ul>
      )}
      <p className={Math.abs(soma - 100) > 0.01 ? "text-atencao" : "text-tinta-suave"}>Soma: {String(Math.round(soma * 1e6) / 1e6).replace(".", ",")}%</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
        {f.pode.editar ? <Botao type="submit" disabled={enviando}>Salvar as frações</Botao> : null}
      </div>
    </form>
  );
}

/** "1 procuração a conferir". */
function procuracoes(n: number): string {
  return `${n === 1 ? "1 procuração" : `${n} procurações`} a conferir`;
}
