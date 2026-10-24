"use client";
// Console › Sistema › Retenção de dados (F0.11; PT-11, PT-03; quadros 356 a 358, aprovados em
// 24/10/2026): as rodadas da rotina que apaga, toda madrugada às 03:10, o que passou do prazo em
// cada cliente, com o modo (Só contando ou Apagando), a fila de arquivos e os erros; o que se
// guarda (os 32 tipos do inventário, da Plataforma e do Console); e os clientes que saíram, que
// ainda não existem: a exclusão no fim do contrato chega numa próxima entrega. Só a Administração
// vê; ligar e desligar a exclusão pede confirmação e fica no histórico.

import { useState, type FormEvent } from "react";
import { formatarDataHora, MODOS_RETENCAO, SITUACOES_RETENCAO, type ModoRetencao, type RetencaoConsole, type RodadaRetencao, type TipoRetencao } from "@triade/domain";
import { Abas, Aviso, AvisoErro, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, SemPermissao, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { CabecaPagina, plural, useCelular } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";

type Parte = "rodadas" | "catalogo" | "saidas";
const PARTES: { id: Parte; texto: string }[] = [
  { id: "rodadas", texto: "Rodadas" },
  { id: "catalogo", texto: "O que se guarda" },
  { id: "saidas", texto: "Clientes que saíram" },
];

const CELULA = "border-b border-linha px-4 py-3 align-top t-texto";
const CABECA = "border-b border-linha bg-superficie-2 px-4 py-2.5 text-left t-apoio font-semibold text-tinta-suave";

const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** "Hoje, 03:10", "Ontem, 03:10" ou "21/10/2026, 03:10", no horário de Brasília. */
function quandoFoi(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = DIA.format(d);
  const nome = dia === DIA.format(agora) ? "Hoje" : dia === DIA.format(new Date(agora.getTime() - 86_400_000)) ? "Ontem" : dia;
  return `${nome}, ${HORA.format(d)}`;
}

const nomeDoTipo = (tipos: TipoRetencao[], codigo: string) => tipos.find((t) => t.codigo === codigo)?.nome ?? codigo;

/** Os itens de uma rodada somados por tipo, do maior para o menor. */
function itensPorTipo(r: RodadaRetencao, tipos: TipoRetencao[]): { nome: string; n: number }[] {
  const soma = new Map<string, number>();
  for (const c of r.clientes) for (const [k, v] of Object.entries(c.itens ?? {})) soma.set(k, (soma.get(k) ?? 0) + v);
  return [...soma.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ nome: nomeDoTipo(tipos, k), n }));
}

function SeloRodada({ modo, erro }: { modo: ModoRetencao; erro?: string }) {
  if (erro) return <Selo tom="erro">Com erro</Selo>;
  return modo === "APAGANDO" ? <Selo tom="ok">Apagado</Selo> : <Selo tom="neutro">{MODOS_RETENCAO.CONTANDO}</Selo>;
}

/** Ligar a exclusão ou voltar a só contar: diz o que muda na próxima rodada e pede confirmação. */
function JanelaModo({ d, aoFechar, feito }: { d: RetencaoConsole; aoFechar: () => void; feito: (modo: ModoRetencao) => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ligar = d.modo === "CONTANDO";
  const novo: ModoRetencao = ligar ? "APAGANDO" : "CONTANDO";
  const ultima = d.rodadas[0];
  const porTipo = ultima ? itensPorTipo(ultima, d.tipos) : [];
  const clientes = ultima ? ultima.clientes.filter((c) => c.total > 0).length : 0;

  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ modo: ModoRetencao; versao: number }>("/v1/retencao/modo", { metodo: "PUT", corpo: { modo: novo, versao: d.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.modo);
  }

  return (
    <Dialogo aberto media fechar titulo={ligar ? "Ligar a exclusão" : "Voltar a só contar"} aoFechar={aoFechar}
      apoio={ligar ? "Vale para todos os clientes, a partir da próxima rodada." : "A rotina continua contando, sem apagar."}>
      <form onSubmit={confirmar} className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {ligar ? (
          <>
            <p className="t-texto">Na próxima rodada, na madrugada, às 03:10 (horário de Brasília), a rotina passa a apagar de verdade o dado pessoal que passou do prazo, em todos os clientes. A linha fica, com a data em que foi apagado, e o histórico de cada condomínio diz quantos itens de cada tipo.</p>
            {ultima ? (
              <section aria-labelledby="modo-o-que" className="grid gap-1.5">
                <h3 id="modo-o-que" className="t-titulo-cartao">
                  {`Pela última contagem (${quandoFoi(ultima.em)}): ${plural(ultima.total, "item", "itens")} em ${plural(clientes, "cliente", "clientes")}`}
                </h3>
                {porTipo.length ? (
                  <ul className="grid list-disc gap-1 pl-5 t-texto">
                    {porTipo.slice(0, 8).map((x) => <li key={x.nome}>{`${x.nome}: ${x.n}`}</li>)}
                  </ul>
                ) : <p className="t-texto text-tinta-suave">Nada venceu na última contagem.</p>}
                {ultima.arquivos ? <p className="t-apoio">{`E ${plural(ultima.arquivos, "arquivo", "arquivos")} (fotos, áudios, exportações) vão para a fila de apagar do armazenamento.`}</p> : null}
              </section>
            ) : <p className="t-texto text-tinta-suave">Ainda não houve nenhuma contagem. Confira os totais de alguns dias antes de ligar.</p>}
            <Aviso tom="atencao" papel="status" titulo="Não dá para desfazer">O que for apagado não volta, nem pela TRÍADE. Voltar a só contar vale só para as rodadas seguintes. Fica no histórico, com quem ligou.</Aviso>
          </>
        ) : (
          <p className="t-texto">A partir da próxima rodada, a rotina volta a só contar o que apagaria, sem apagar nada. O que já foi apagado não volta. Fica no histórico, com quem mudou.</p>
        )}
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante={ligar ? "perigo" : "primario"} disabled={enviando}>
            <Icone nome={ligar ? "tocar" : "pausa"} />{enviando ? "Mudando…" : ligar ? "Ligar a exclusão" : "Voltar a só contar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function Modo({ d, mudar }: { d: RetencaoConsole; mudar: (() => void) | null }) {
  const contando = d.modo === "CONTANDO";
  const quem = d.mudadoEm ? ` ${contando ? "Voltou a só contar" : "Ligada"}${d.mudadoPor ? ` por ${d.mudadoPor}` : ""} em ${formatarDataHora(d.mudadoEm)}.` : "";
  return (
    <section aria-labelledby="modo-rotina" data-tom={contando ? "atencao" : "ok"}
      className="flex flex-wrap items-center gap-4 rounded-[18px] border border-linha bg-superficie px-5 py-4 shadow-s1">
      <span className="ladrilho h-10 w-10 rounded-xl" data-tom={contando ? "atencao" : "ok"} aria-hidden="true"><Icone nome={contando ? "pausa" : "lixeira"} /></span>
      <span className="grid min-w-0 flex-1 basis-[320px] gap-0.5">
        <h2 id="modo-rotina" className="t-titulo-cartao">{contando ? "Modo só contando" : "Modo apagando"}</h2>
        <span className="t-apoio">
          {contando
            ? "A rotina conta o que apagaria, sem apagar nada. Ligue a exclusão depois de conferir os totais de alguns dias. Só a Administração liga e desliga, e fica no histórico."
            : "A rotina apaga, toda madrugada às 03:10, o dado pessoal que passou do prazo. Só a Administração liga e desliga, e fica no histórico."}
          {quem}
        </span>
      </span>
      {mudar ? (
        contando
          ? <Botao onClick={mudar} className="max-md:w-full"><Icone nome="tocar" />Ligar a exclusão</Botao>
          : <Botao variante="contorno" onClick={mudar} className="max-md:w-full"><Icone nome="pausa" />Voltar a só contar</Botao>
      ) : null}
    </section>
  );
}

function ParteRodadas({ d, mudar }: { d: RetencaoConsole; mudar: (() => void) | null }) {
  const celular = useCelular();
  type Linha = { chave: string; r: RodadaRetencao; c: RodadaRetencao["clientes"][number] | null };
  const linhas = d.rodadas.flatMap((r): Linha[] => (r.clientes.length
    ? r.clientes.map((c) => ({ chave: `${r.id}-${c.condominioId}`, r, c }))
    : [{ chave: `${r.id}-nada`, r, c: null }]));
  const ultima = d.rodadas[0];
  const comErro = ultima ? ultima.clientes.filter((c) => c.erro) : [];
  const fila = `Fila de arquivos para apagar: ${d.arquivos.naFila} · com erro depois de 5 tentativas: ${d.arquivos.comErro}`;

  return (
    <div className="grid gap-4 py-4 md:px-5 md:pb-5">
      <Modo d={d} mudar={mudar} />
      {!d.rodadas.length ? (
        <Vazio titulo="Nenhuma rodada ainda" icone="relogio">A primeira roda nesta madrugada, às 03:10. Até lá, os prazos já valem, mas nada foi contado nem apagado.</Vazio>
      ) : celular ? (
        <ul aria-label="Rodadas por cliente" className="grid gap-3">
          {linhas.map(({ chave, r, c }) => (
            <li key={chave} className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <span className="flex items-center justify-between gap-2"><span className="font-medium">{c ? c.nome ?? "Cliente" : "Nenhum item vencido"}</span><SeloRodada modo={r.modo} erro={c?.erro} /></span>
              <span className="t-apoio">{quandoFoi(r.em)} · {plural(c?.total ?? 0, "item", "itens")} · {plural(c?.arquivos ?? 0, "arquivo", "arquivos")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-linha">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">Rodadas da rotina por cliente, da mais nova para a mais antiga</caption>
            <thead>
              <tr>
                <th scope="col" className={CABECA}>Quando</th>
                <th scope="col" className={CABECA}>Cliente</th>
                <th scope="col" className={`${CABECA} text-right`}>{d.modo === "APAGANDO" ? "Itens apagados" : "Itens que vencem"}</th>
                <th scope="col" className={`${CABECA} text-right`}>Arquivos</th>
                <th scope="col" className={`${CABECA} text-right`}>Erros</th>
                <th scope="col" className={CABECA}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ chave, r, c }) => (
                <tr key={chave} className="last:[&>*]:border-b-0">
                  <td className={`${CELULA} whitespace-nowrap`}>{quandoFoi(r.em)}</td>
                  <th scope="row" className={`${CELULA} text-left font-medium`}>{c ? c.nome ?? "Cliente" : <span className="font-normal text-tinta-suave">Nenhum item vencido</span>}</th>
                  <td className={`${CELULA} text-right tabular-nums`}>{c?.total ?? 0}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c?.arquivos ?? 0}</td>
                  <td className={`${CELULA} text-right tabular-nums ${c?.erro ? "font-semibold text-erro" : ""}`}>{c?.erro ? 1 : 0}</td>
                  <td className={CELULA}><SeloRodada modo={r.modo} erro={c?.erro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="t-apoio">{fila}</p>
      {comErro.map((c) => (
        <Aviso key={c.condominioId} tom="erro" papel="status" titulo={`${c.nome ?? "Cliente"}: 1 erro na última rodada`}>
          {c.erro}. A rotina tenta de novo na próxima madrugada.
        </Aviso>
      ))}
      {d.arquivos.comErro ? (
        <Aviso tom="atencao" papel="status" titulo={`${plural(d.arquivos.comErro, "arquivo não saiu", "arquivos não saíram")} do armazenamento`}>
          Depois de 5 tentativas, a fila para de tentar. Confira o armazenamento e apague à mão.
        </Aviso>
      ) : null}
    </div>
  );
}

function ParteCatalogo({ tipos }: { tipos: TipoRetencao[] }) {
  const celular = useCelular();
  const plataforma = tipos.filter((t) => (t.sistema ?? "PLATAFORMA") === "PLATAFORMA").length;
  const console = tipos.length - plataforma;
  const onde = (t: TipoRetencao) => (t.sistema === "CONSOLE" ? "Console" : "Plataforma");
  const situacao = (t: TipoRetencao) => (t.situacao === "A_FAZER" ? <Selo tom="neutro">{SITUACOES_RETENCAO.A_FAZER}</Selo> : null);
  const ordenados = [...tipos].sort((a, b) => a.numero - b.numero);
  return (
    <div className="grid gap-4 py-4 md:px-5 md:pb-5">
      <p className="t-texto">
        {`${plural(tipos.length, "tipo de dado", "tipos de dado")}: ${plataforma} na Plataforma (o condomínio é o responsável) e ${console} no Console (a TRÍADE é).`}
      </p>
      {celular ? (
        <ul aria-label="O que se guarda" className="grid gap-3">
          {ordenados.map((t) => (
            <li key={t.codigo} className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <span className="flex flex-wrap items-center gap-2"><span className="t-codigo text-tinta-suave">{t.numero}</span><span className="font-medium">{t.nome}</span><Selo tom="neutro">{onde(t)}</Selo></span>
              <span className="t-apoio">{t.oQue} · {t.paraQue}</span>
              <span className="t-texto"><strong className="font-semibold">{t.prazo}.</strong> {t.noFim}.</span>
              {situacao(t)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-linha">
          <table className="w-full min-w-[900px] border-collapse">
            <caption className="sr-only">Os tipos de dado pessoal do sistema, com o prazo de cada um</caption>
            <thead>
              <tr>
                <th scope="col" className={`${CABECA} w-12`}>#</th>
                <th scope="col" className={`${CABECA} w-[26%]`}>Dado</th>
                <th scope="col" className={CABECA}>Onde</th>
                <th scope="col" className={CABECA}>Para quê</th>
                <th scope="col" className={CABECA}>Guarda por</th>
                <th scope="col" className={CABECA}>No fim do prazo</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((t) => (
                <tr key={t.codigo} className="last:[&>*]:border-b-0">
                  <td className={`${CELULA} t-codigo text-tinta-suave`}>{t.numero}</td>
                  <th scope="row" className={`${CELULA} text-left font-normal`}>
                    <span className="grid gap-0.5"><span className="font-medium">{t.nome}</span><span className="t-apoio">{t.oQue}</span></span>
                  </th>
                  <td className={CELULA}>{onde(t)}</td>
                  <td className={CELULA}>{t.paraQue}</td>
                  <td className={CELULA}><span className="grid justify-items-start gap-1"><span>{t.prazo}</span>{situacao(t)}</span></td>
                  <td className={`${CELULA} text-tinta-suave`}>{t.noFim}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="t-apoio">Os prazos são os mesmos para todos os clientes e só mudam por uma nova versão do sistema.</p>
    </div>
  );
}

function ParteSaidas() {
  return (
    <div className="grid gap-4 py-4 md:px-5 md:pb-5">
      <Vazio titulo="Nenhum cliente saiu ainda" icone="predio"
        nota="A exclusão no fim do contrato chega numa próxima entrega, junto com o contrato encerrado no sistema. Até lá, nada de cliente é apagado por aqui.">
        Quando um contrato acabar, o cliente aparece aqui com a exportação entregue, a data em que os dados são apagados e o que fica guardado 5 anos.
      </Vazio>
      <section aria-labelledby="saida-como" className="grid gap-1 rounded-[18px] border border-dashed border-violeta-300 bg-violeta-50 px-5 py-4">
        <h2 id="saida-como" className="t-titulo-cartao">Como vai funcionar</h2>
        <p className="t-apoio">
          Quando o contrato acaba, a TRÍADE entrega a exportação ao condomínio. 90 dias depois, tudo do condomínio é apagado, inclusive o histórico; fica no Console só o registro de quem apagou, quando e quantos itens. Contrato e cobranças ficam 5 anos, por obrigação fiscal. Adiar pede motivo, por exemplo um processo.
        </p>
      </section>
    </div>
  );
}

export function Retencao() {
  const sessao = useSessao();
  const ve = sessao.acoes.includes("console.retencao.ver");
  const carga = useCarregar<RetencaoConsole>(ve ? "/v1/retencao" : null);
  const [parte, setParte] = useState<Parte>("rodadas");
  const [mudando, setMudando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  if (!ve) return <SemPermissao tela="Retenção de dados" texto="Só a Administração da TRÍADE vê a retenção de dados." />;

  const d = carga.estado === "pronto" ? carga.dados : null;
  const podeMudar = !!d?.podeLigar;
  return (
    <div className="grid gap-6">
      <CabecaPagina titulo="Retenção de dados"
        apoio={<span className="block max-w-[70ch]">A rotina apaga, toda madrugada, o que passou do prazo em cada cliente e deixa o registro aqui. Os prazos são os mesmos para todos e só mudam por uma nova versão do sistema.</span>} />
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Abrindo a retenção de dados…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} oQue="a retenção de dados" tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <section aria-label={PARTES.find((p) => p.id === parte)!.texto}
          className="grid max-md:gap-3 md:overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1 md:[&_[role=tablist]]:px-5">
          <Abas rotulo="Partes da retenção de dados" atual={parte} aoMudar={setParte} abas={PARTES}>
            {parte === "rodadas" ? <ParteRodadas d={d} mudar={podeMudar ? () => setMudando(true) : null} /> : null}
            {parte === "catalogo" ? <ParteCatalogo tipos={d.tipos} /> : null}
            {parte === "saidas" ? <ParteSaidas /> : null}
          </Abas>
        </section>
      ) : null}
      {d && mudando ? (
        <JanelaModo d={d} aoFechar={() => setMudando(false)}
          feito={(modo) => {
            setMudando(false);
            setRecado(modo === "APAGANDO"
              ? "Exclusão ligada. A partir da próxima rodada, às 03:10, o que passou do prazo é apagado."
              : "A rotina voltou a só contar, a partir da próxima rodada. A mudança fica no histórico.");
            carga.recarregar();
          }} />
      ) : null}
    </div>
  );
}
