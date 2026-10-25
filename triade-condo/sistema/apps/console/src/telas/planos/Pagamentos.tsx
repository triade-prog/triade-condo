"use client";
// Pagamentos dos clientes (PI-07, PI-08; quadros 247 e 248, decisão D.1): o que cada cliente deve à
// TRÍADE, por competência. A competência abre por botão; o recebimento entra A conferir e só conta
// depois da conferência; o que entrou sem cliente fica em Não identificados. Atraso só avisa.
// Nada é cobrado nem enviado ao cliente por aqui.

import Link from "next/link";
import { useState } from "react";
import { FORMAS_RECEBIMENTO, mostrarDataSemHora, mostrarValor, nomeCompetencia, proximaCompetencia, type FormaRecebimento } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { AbasLista, CabecaPagina, CaixaLista, CLASSE_LINHA, CLASSE_LINK_LINHA, plural } from "../comum.tsx";
import { nomeCobranca, SeloCobranca } from "../ficha/AbaPlano.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeBrasilia, type Cobranca, type Recebimento } from "./comum.tsx";
import { JanelaConferir, JanelaIdentificar, JanelaRecebimento, type ClienteEscolha } from "./janelas.tsx";

interface Avulso {
  id: string;
  valor: number;
  recebidoEm: string;
  forma: string;
  referencia: string;
  registradoEm: string;
  registradoPor?: string;
}

interface Dados {
  cobrancas: Cobranca[];
  aConferir: (Recebimento & { condominioId: string; cliente: string })[];
  naoIdentificados: Avulso[];
  podeRegistrar: boolean;
}

const FILTROS = [
  { valor: "conferir", texto: "A conferir" },
  { valor: "atraso", texto: "Em atraso" },
  { valor: "aberto", texto: "Em aberto" },
  { valor: "avulsos", texto: "Não identificados" },
  { valor: "quitados", texto: "Quitados" },
  { valor: "todos", texto: "Todos" },
] as const;
type Filtro = (typeof FILTROS)[number]["valor"];

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_120px_120px_minmax(0,190px)_20px]";

const filtrar: Record<Exclude<Filtro, "conferir" | "avulsos">, (c: Cobranca) => boolean> = {
  atraso: (c) => c.emAtraso,
  aberto: (c) => c.situacao !== "QUITADA",
  quitados: (c) => c.situacao === "QUITADA",
  todos: () => true,
};

type Janela = { tipo: "registrar" } | { tipo: "conferir"; r: Dados["aConferir"][number] } | { tipo: "identificar"; a: Avulso } | null;

const soma = (l: { valor?: number; falta?: number }[], k: "valor" | "falta") => l.reduce((n, x) => n + (x[k] ?? 0), 0);

function Resumo({ titulo, numero, apoio }: { titulo: string; numero: string; apoio: string }) {
  return (
    <div className="grid gap-0.5 rounded-[18px] border border-linha bg-superficie p-[18px] shadow-s1">
      <span className="t-apoio text-tinta-suave">{titulo}</span>
      <span className="t-titulo-tela">{numero}</span>
      <span className="t-apoio text-tinta-suave">{apoio}</span>
    </div>
  );
}

export function Pagamentos() {
  const carga = useCarregar<Dados>("/v1/pagamentos");
  const carteira = useCarregar<{ clientes: ClienteEscolha[] }>("/v1/clientes");
  const [filtro, setFiltro] = useState<Filtro>("conferir");
  const [janela, setJanela] = useState<Janela>(null);
  const [recado, setRecado] = useState<{ tom: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const mes = `${hojeBrasilia().slice(0, 7)}-01`;
  const d = carga.estado === "pronto" ? carga.dados : null;
  const mensalidadesDoMes = d?.cobrancas.filter((c) => c.tipo === "MENSALIDADE" && c.competencia === mes) ?? [];
  // Abre o mês de hoje; aberto, o botão passa para o seguinte.
  const aAbrir = mensalidadesDoMes.length ? proximaCompetencia(mes) : mes;
  const clientes = carteira.estado === "pronto" ? carteira.dados.clientes.map((c) => ({ id: c.id, nome: c.nome })) : [];
  const fechar = () => setJanela(null);
  const feito = (texto: string) => { fechar(); setRecado({ tom: "ok", texto }); carga.recarregar(); };

  async function abrirCompetencia() {
    setAbrindo(true);
    const r = await chamarApi<{ criadas: number; jaAbertas: number; semPlano: number }>("/v1/pagamentos/competencias", { corpo: { competencia: aAbrir } });
    setAbrindo(false);
    if (!r.ok) return setRecado({ tom: "erro", texto: textoDoErro(r.erro) });
    const { criadas, jaAbertas, semPlano } = r.dados;
    setRecado({ tom: "ok", texto: [`${nomeCompetencia(aAbrir)}: ${plural(criadas, "cobrança aberta", "cobranças abertas")}`,
      jaAbertas ? `${jaAbertas} já existia${jaAbertas === 1 ? "" : "m"}` : null, semPlano ? `${plural(semPlano, "cliente sem plano ou fora do ciclo", "clientes sem plano ou fora do ciclo")}` : null]
      .filter(Boolean).join(" · ") + "." });
    carga.recarregar();
  }

  const acoes = d?.podeRegistrar ? (
    <span className="flex flex-wrap gap-2">
      <Botao variante="contorno" onClick={() => void abrirCompetencia()} disabled={abrindo}><Icone nome="calendario" />{`Abrir ${nomeCompetencia(aAbrir).split("/")[0]!.toLowerCase()}`}</Botao>
      <Botao onClick={() => setJanela({ tipo: "registrar" })}><Icone nome="mais" />Registrar recebimento</Botao>
    </span>
  ) : undefined;

  const contagem = (f: Filtro) => !d ? 0 : f === "conferir" ? d.aConferir.length : f === "avulsos" ? d.naoIdentificados.length : d.cobrancas.filter(filtrar[f]).length;

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Pagamentos" apoio="O que cada cliente deve à TRÍADE, por competência. Nada é cobrado nem enviado ao cliente pelo sistema." acao={acoes} />
      {recado ? <Aviso tom={recado.tom} papel="status">{recado.texto}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Abrindo os pagamentos…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo titulo={nomeCompetencia(mes)} numero={String(mensalidadesDoMes.length)} apoio={mensalidadesDoMes.length ? `${mensalidadesDoMes.filter((c) => c.situacao !== "QUITADA").length} em aberto` : "competência ainda não aberta"} />
            <Resumo titulo="A conferir" numero={String(d.aConferir.length)} apoio={`${mostrarValor(soma(d.aConferir, "valor"))} recebidos`} />
            <Resumo titulo="Em atraso" numero={String(d.cobrancas.filter((c) => c.emAtraso).length)} apoio={`${mostrarValor(soma(d.cobrancas.filter((c) => c.emAtraso), "falta"))} em aberto`} />
            <Resumo titulo="Não identificados" numero={String(d.naoIdentificados.length)} apoio={`${mostrarValor(soma(d.naoIdentificados, "valor"))} sem cliente`} />
          </div>
          <CaixaLista titulo="Pagamentos" colunas={COLUNAS}
            abas={<AbasLista rotulo="Filtrar os pagamentos" atual={filtro} aoMudar={setFiltro} abas={FILTROS.map((f) => ({ valor: f.valor, texto: f.texto, n: contagem(f.valor) }))} />}
            cabecalho={["", "Cliente", filtro === "conferir" || filtro === "avulsos" ? "Recebido em" : "Competência", filtro === "conferir" || filtro === "avulsos" ? "Forma" : "Devido",
              filtro === "conferir" || filtro === "avulsos" ? "Valor" : "Recebido", "Situação", ""]}
            rodape={filtro === "conferir" ? (
              <>
                <span className="t-apoio">{plural(d.aConferir.length, "recebimento esperando conferência", "recebimentos esperando conferência")}</span>
                <span className="t-apoio">Confirmado só depois da conferência de quem pode conferir.</span>
              </>
            ) : undefined}>
            {filtro === "conferir" ? <ListaAConferir d={d} abrir={(r) => setJanela({ tipo: "conferir", r })} /> : null}
            {filtro === "avulsos" ? <ListaAvulsos d={d} abrir={(a) => setJanela({ tipo: "identificar", a })} /> : null}
            {filtro !== "conferir" && filtro !== "avulsos" ? <ListaCobrancas lista={d.cobrancas.filter(filtrar[filtro])} /> : null}
          </CaixaLista>
          <p className="t-apoio text-tinta-suave">Em atraso é só um aviso: nada bloqueia o condomínio. Combine com o cliente fora do sistema.</p>
        </>
      ) : null}

      {d && janela?.tipo === "registrar" ? <JanelaRecebimento clientes={clientes} cobrancas={d.cobrancas} aoFechar={fechar} feito={feito} /> : null}
      {d && janela?.tipo === "conferir" ? <JanelaConferir r={janela.r} cobranca={d.cobrancas.find((c) => c.id === janela.r.cobrancaId)} aoFechar={fechar} feito={feito} /> : null}
      {d && janela?.tipo === "identificar" ? <JanelaIdentificar avulso={janela.a} clientes={clientes} cobrancas={d.cobrancas} aoFechar={fechar} feito={feito} /> : null}
    </div>
  );
}

function SemNada({ texto }: { texto: string }) {
  return <div className="md:p-5"><Vazio titulo={texto} icone="dinheiro" /></div>;
}

function ListaCobrancas({ lista }: { lista: Cobranca[] }) {
  if (!lista.length) return <SemNada texto="Nenhuma cobrança neste filtro" />;
  return (
    <ul className="grid max-md:gap-3 max-md:pt-3">
      {lista.map((c) => (
        <li key={c.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
          <span className="ladrilho" data-tom="andamento" aria-hidden="true"><Icone nome="predio" /></span>
          <span className="grid min-w-0"><Link href={`/pagamentos/${c.condominioId}/${c.id}`} className={CLASSE_LINK_LINHA}>{c.cliente}</Link></span>
          <span className="t-texto max-md:col-start-2">{c.tipo === "IMPLANTACAO" ? nomeCobranca(c) : `${nomeCobranca(c)} · mensalidade`}</span>
          <span className="t-texto max-md:col-start-2">{mostrarValor(c.devido)}</span>
          <span className="t-texto max-md:col-start-2">{mostrarValor(c.conferido)}{c.aConferir ? <span className="t-apoio block">+ {mostrarValor(c.aConferir)} a conferir</span> : null}</span>
          <span className="flex flex-wrap gap-1.5 max-md:col-start-2"><SeloCobranca c={c} /></span>
          <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
        </li>
      ))}
    </ul>
  );
}

function ListaAConferir({ d, abrir }: { d: Dados; abrir: (r: Dados["aConferir"][number]) => void }) {
  if (!d.aConferir.length) return <SemNada texto="Nada esperando conferência" />;
  return (
    <ul className="grid max-md:gap-3 max-md:pt-3">
      {d.aConferir.map((r) => {
        const c = d.cobrancas.find((x) => x.id === r.cobrancaId);
        return (
          <li key={r.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
            <span className="ladrilho" data-tom="info" aria-hidden="true"><Icone nome="dinheiro" /></span>
            <span className="grid min-w-0 justify-items-start">
              <button type="button" className={`${CLASSE_LINK_LINHA} text-left`} onClick={() => abrir(r)}>{r.cliente}</button>
              <span className="t-apoio">{c ? nomeCobranca(c) : ""} · registrado por {r.registradoPor}</span>
            </span>
            <span className="t-texto max-md:col-start-2">{mostrarDataSemHora(r.recebidoEm)}</span>
            <span className="t-texto max-md:col-start-2">{FORMAS_RECEBIMENTO[r.forma as FormaRecebimento] ?? r.forma}</span>
            <span className="t-texto max-md:col-start-2">{mostrarValor(r.valor)}</span>
            <span className="flex flex-wrap gap-1.5 max-md:col-start-2"><Selo tom="info">A conferir</Selo>{c && c.situacao === "A_DEFINIR" ? <Selo tom="neutro">Valor a definir</Selo> : null}</span>
            <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
          </li>
        );
      })}
    </ul>
  );
}

function ListaAvulsos({ d, abrir }: { d: Dados; abrir: (a: Avulso) => void }) {
  if (!d.naoIdentificados.length) return <SemNada texto="Nenhum recebimento sem cliente" />;
  return (
    <ul className="grid max-md:gap-3 max-md:pt-3">
      {d.naoIdentificados.map((a) => (
        <li key={a.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
          <span className="ladrilho" data-tom="atencao" aria-hidden="true"><Icone nome="alerta" /></span>
          <span className="grid min-w-0 justify-items-start">
            <button type="button" className={`${CLASSE_LINK_LINHA} text-left`} onClick={() => abrir(a)}>Dizer de quem é</button>
            <span className="t-apoio font-mono">{a.referencia}</span>
          </span>
          <span className="t-texto max-md:col-start-2">{mostrarDataSemHora(a.recebidoEm)}</span>
          <span className="t-texto max-md:col-start-2">{FORMAS_RECEBIMENTO[a.forma as FormaRecebimento] ?? a.forma}</span>
          <span className="t-texto max-md:col-start-2">{mostrarValor(a.valor)}</span>
          <span className="flex flex-wrap gap-1.5 max-md:col-start-2"><Selo tom="atencao">Sem cliente</Selo></span>
          <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
        </li>
      ))}
    </ul>
  );
}
