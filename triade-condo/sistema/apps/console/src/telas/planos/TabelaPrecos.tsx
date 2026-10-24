"use client";
// Tabela de preços do Console (0295; quadros 268 a 274, aprovados em 24/10/2026): o que a TRÍADE
// oferece por faixa de unidades ativas, em quatro partes: a Tabela, Quanto custaria para o prédio,
// Faixas e implantação e o Histórico. Interno: o síndico não vê. Mudar a tabela pede motivo e não
// mexe no plano de quem já é cliente; só Administração e Financeiro mudam.

import { useMemo, useState, type ReactNode } from "react";
import { formatarDataHora, FUNCOES_CONSOLE, mostrarValor } from "@triade/domain";
import { Abas, Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, SemPermissao, Selo, textoDoErro, Vazio } from "@triade/ui";
import { CabecaPagina, plural, useCelular } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import {
  lerHistoricoPrecos, lerTabelaPrecos, NOMES_TABELA, nomeFaixa, PAGINA_HISTORICO_PRECOS, porUnidadeNoTeto, ROTAS_PRECOS, type FaixaPreco, type MudancaPreco, type TabelaPrecos as Tabela,
} from "./comum.tsx";
import { JanelaMudarTabela } from "./janelasPrecos.tsx";
import { Simulador } from "./Simulador.tsx";

type Parte = "tabela" | "simular" | "faixas" | "historico";
const PARTES: { id: Parte; texto: string; curto?: string }[] = [
  { id: "tabela", texto: "Tabela" },
  { id: "simular", texto: "Quanto custaria para o prédio", curto: "Quanto custaria" },
  { id: "faixas", texto: "Faixas e implantação", curto: "Faixas" },
  { id: "historico", texto: "Histórico" },
];
const ROTULO_PARTE: Record<Parte, string> = { tabela: "Tabela de preços", simular: "Quanto custaria para o prédio", faixas: "Faixas e implantação", historico: "Histórico da tabela" };

export interface Recado { tom: "ok" | "erro" | "info"; texto: string }

const nomeFuncao = (f?: string) => (f ? FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f : undefined);
export const quemFez = (h: MudancaPreco) => `${h.quem}${nomeFuncao(h.funcao) ? ` (${nomeFuncao(h.funcao)})` : ""}`;
const comFaixa = (d: Tabela) => d.faixas.filter((f) => !f.sobConsulta);

export function TabelaPrecos() {
  const sessao = useSessao();
  const ve = sessao.acoes.includes("console.precos.ver");
  const carga = useCarregar<Record<string, unknown>>(ve ? ROTAS_PRECOS.tabela : null);
  const celular = useCelular();
  const [parte, setParte] = useState<Parte>("tabela");
  const [mudando, setMudando] = useState(false);
  const [recado, setRecado] = useState<Recado | null>(null);
  const [vez, setVez] = useState(0);
  const d = useMemo(() => (carga.estado === "pronto" ? lerTabelaPrecos(carga.dados) : null), [carga]);

  if (!ve) return <SemPermissao tela="Tabela de preços" texto="Só Administração e Financeiro veem a tabela de preços." />;

  const edita = !!d?.podeEditar && sessao.acoes.includes("console.precos.editar");
  const feito = (texto: string) => { setMudando(false); setRecado({ tom: "ok", texto }); setVez((v) => v + 1); carga.recarregar(); };
  const mudar = (classe = "") => <Botao className={classe} onClick={() => setMudando(true)}><Icone nome="editar" />Mudar a tabela</Botao>;

  return (
    <div className="grid gap-6">
      <CabecaPagina titulo="Tabela de preços"
        apoio={<span className="block max-w-[70ch]">O que a TRÍADE oferece por faixa de unidades ativas. Interno: o síndico não vê esta tela. Mudar a tabela não muda o plano de quem já é cliente.</span>}
        acao={d ? (edita ? mudar("max-md:hidden") : <span className="t-apoio">Só Administração e Financeiro mudam a tabela.</span>) : undefined} />
      {recado ? <Aviso tom={recado.tom} papel={recado.tom === "erro" ? "alert" : "status"}>{recado.texto}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Abrindo a tabela de preços…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <>
          <section aria-label={ROTULO_PARTE[parte]}
            className="grid max-md:gap-3 md:overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1 md:[&_[role=tablist]]:px-5">
            <Abas rotulo="Partes da tabela de preços" atual={parte} aoMudar={setParte}
              abas={PARTES.map((p) => ({ id: p.id, texto: celular && p.curto ? p.curto : p.texto }))}>
              {parte === "tabela" ? <ParteTabela d={d} mudar={edita ? mudar("w-full md:hidden") : null} /> : null}
              {parte === "simular" ? <Simulador d={d} edita={edita} avisar={setRecado} feito={feito} recarregar={carga.recarregar} /> : null}
              {parte === "faixas" ? <ParteFaixas d={d} avisar={setRecado} /> : null}
              {parte === "historico" ? <ParteHistorico key={vez} /> : null}
            </Abas>
          </section>
          {parte === "tabela" ? <DepoisDaTabela d={d} key={vez} /> : null}
        </>
      ) : null}
      {d && mudando ? <JanelaMudarTabela d={d} aoFechar={() => setMudando(false)} feito={feito} recarregar={carga.recarregar} /> : null}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="block t-apoio font-normal">{children}</span>;
}

const CELULA = "border-b border-linha px-4 py-3 align-top t-texto";
const NUMERO = `${CELULA} text-right tabular-nums whitespace-nowrap`;
const CABECA = "border-b border-linha bg-superficie-2 px-4 py-2.5 t-rotulo font-semibold";

/** A tabela (quadro 268) e, no celular, a lista de faixas (quadro 273). */
function ParteTabela({ d, mudar }: { d: Tabela; mudar: ReactNode }) {
  const { parametros: p } = d;
  const fundadorEmUso = p.tabelaEmUso === "FUNDADOR";
  const emUso = <Selo tom="ok">Em uso</Selo>;
  const acima = d.faixas.find((f) => f.sobConsulta);
  return (
    <>
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">Preços por faixa de unidades ativas</caption>
          <thead>
            <tr>
              <th scope="col" className={`${CABECA} text-left`}>Faixa</th>
              <th scope="col" className={`${CABECA} text-right`}>Fundador · por mês {fundadorEmUso ? <span className="ml-1.5 normal-case tracking-normal">{emUso}</span> : null}</th>
              <th scope="col" className={`${CABECA} text-right`}>Tabela cheia · por mês {fundadorEmUso ? null : <span className="ml-1.5 normal-case tracking-normal">{emUso}</span>}</th>
              <th scope="col" className={`${CABECA} text-right`}>Implantação na cheia</th>
              <th scope="col" className={`${CABECA} text-right`}>Por unidade na cheia</th>
            </tr>
          </thead>
          <tbody>
            {d.faixas.map((f) => f.sobConsulta ? (
              <tr key={f.codigo}>
                <th scope="row" className={`${CELULA} border-b-0 text-left font-medium`}>{nomeFaixa(f)}</th>
                <td colSpan={3} className={`${CELULA} border-b-0 text-right text-tinta-suave`}>Sob consulta, também para administradoras</td>
                <td className={`${CELULA} border-b-0`} />
              </tr>
            ) : (
              <tr key={f.codigo}>
                <th scope="row" className={`${CELULA} text-left font-medium whitespace-nowrap`}>{nomeFaixa(f)}</th>
                <td className={NUMERO}>{mostrarValor(f.fundador)}<Sub>implantação sem custo</Sub></td>
                <td className={NUMERO}>{mostrarValor(f.cheia)}</td>
                <td className={NUMERO}>{mostrarValor(f.implantacao)}<Sub>{`até ${p.parcelasImplantacao} vezes; isenta no anual`}</Sub></td>
                <td className={`${NUMERO} text-tinta-suave`}>
                  {f.cheia !== undefined && f.unidadesAte ? `${mostrarValor(porUnidadeNoTeto(f.cheia, f.unidadesAte))} no teto (${f.unidadesAte} un.)` : "Valor a definir"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        <section aria-label="Preços por faixa" className="grid rounded-[18px] border border-linha bg-superficie px-4 py-1 shadow-s1">
          <div className="flex items-center justify-between gap-2 pt-2.5">
            <span className="t-apoio">{fundadorEmUso ? "Fundador, por mês" : "Tabela cheia, por mês"}</span>{emUso}
          </div>
          <ul className="grid">
            {comFaixa(d).map((f) => (
              <li key={f.codigo} className="flex justify-between gap-2 border-b border-linha py-3">
                <span className="font-medium">{nomeFaixa(f)}</span>
                <span className="text-right tabular-nums">
                  {mostrarValor(fundadorEmUso ? f.fundador : f.cheia)}
                  <Sub>{fundadorEmUso ? `cheia ${mostrarValor(f.cheia)}` : `fundador ${mostrarValor(f.fundador)}`} · impl. {mostrarValor(f.implantacao)}</Sub>
                </span>
              </li>
            ))}
          </ul>
          {acima ? <p className="py-3 t-apoio">{`${nomeFaixa(acima)} unidades: sob consulta.`}</p> : null}
        </section>
        <p className="t-apoio">{`Anual: 12 por ${p.mesesPagosAnual} e implantação isenta. Vagas de fundador: ${d.vagas.usadas} de ${d.vagas.total} usadas.`}</p>
        {mudar}
      </div>
    </>
  );
}

// As condições da pesquisa para passar à tabela cheia (decisão de preço D2), no estado de 24/10/2026.
// Elas mudam aqui, à mão, quando cada uma entrar no ar.
const CONDICOES: { texto: string; noAr: boolean }[] = [
  { texto: "WhatsApp oficial no ar (W-04)", noAr: false },
  { texto: "Relatório do mês para a assembleia (TR-02)", noAr: true },
  { texto: "Primeira IA (IA-01, IA-03)", noAr: false },
];

/** Embaixo da tabela: o WhatsApp, o que vale para um plano novo, as regras e a última mudança. */
function DepoisDaTabela({ d }: { d: Tabela }) {
  const { parametros: p, vagas } = d;
  const recente = useCarregar<Record<string, unknown>>(ROTAS_PRECOS.historico(1));
  const ultima = recente.estado === "pronto" ? lerHistoricoPrecos(recente.dados)[0] : undefined;
  const caixa = "grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4";
  return (
    <>
      <Aviso tom="atencao">
        <b>WhatsApp:</b> os avisos do atendimento estão incluídos. Os comunicados pelo WhatsApp têm franquia mensal por faixa, que fica <b>a confirmar na proposta</b> enquanto o WhatsApp oficial não estiver no ar. Nada é “ilimitado”.
      </Aviso>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="pr-plano-novo" className={caixa}>
          <h2 id="pr-plano-novo" className="t-titulo-cartao">O que vale para um plano novo</h2>
          <p className="flex flex-wrap items-center gap-2 t-texto">Tabela em uso: <b>{NOMES_TABELA[p.tabelaEmUso]}</b> <Selo tom="ok">Em uso</Selo></p>
          <p className="t-texto">
            Vagas de fundador: <b>{`${vagas.usadas} de ${vagas.total} usadas`}</b>. {`Com as ${vagas.total} usadas, o Usar a tabela passa a sugerir a tabela cheia e avisa.`}
          </p>
          {p.tabelaEmUso === "FUNDADOR" ? (
            <>
              <p className="t-texto">Condições da pesquisa para passar à tabela cheia:</p>
              <ul className="grid list-disc gap-1 pl-5 t-texto">
                {CONDICOES.map((c) => <li key={c.texto}>{c.texto} <Selo tom={c.noAr ? "ok" : "atencao"}>{c.noAr ? "No ar" : "Falta"}</Selo></li>)}
              </ul>
              <p className="t-apoio">A troca é feita em Mudar a tabela, com motivo. Os fundadores seguem com o preço deles até o fim dos 12 meses.</p>
            </>
          ) : null}
        </section>
        <section aria-labelledby="pr-regras" className={caixa}>
          <h2 id="pr-regras" className="t-titulo-cartao">Regras que acompanham o preço</h2>
          <ul className="grid list-disc gap-1.5 pl-5 t-texto">
            <li>Conta só a unidade cadastrada e ativa. Morador, equipe e prestador não mudam o preço.</li>
            <li>A mudança de faixa vale no ciclo seguinte.</li>
            <li>{`Anual: 12 meses pelo preço de ${p.mesesPagosAnual}, com a implantação isenta.`}</li>
            <li>{`Mensal sem fidelidade; implantação em até ${p.parcelasImplantacao} vezes.`}</li>
            <li>{`Fundador: travado por 12 meses, só no mensal e só para os ${p.vagasFundador} primeiros condomínios.`}</li>
            <li><span className="text-atencao">Proposta, ainda não decidida:</span> síndico profissional com 15% de desconto a partir do 2º condomínio. Não entra no Usar a tabela.</li>
            <li>Preço final, com impostos.</li>
          </ul>
        </section>
      </div>
      {ultima ? (
        <p className="t-apoio">{`Última mudança: ${formatarDataHora(ultima.em).replace(" ", " às ")}, por ${quemFez(ultima)}. Motivo: ${ultima.motivo}.`}</p>
      ) : null}
    </>
  );
}

/** O fundador em média abaixo da cheia, em pontos inteiros. */
function descontoFundador(faixas: FaixaPreco[]): number | null {
  const pares = faixas.filter((f) => f.fundador !== undefined && f.cheia);
  if (!pares.length) return null;
  return Math.round((pares.reduce((t, f) => t + (1 - f.fundador! / f.cheia!), 0) / pares.length) * 100);
}

const IMPLANTACAO_INCLUI = [
  "Reunião ou assembleia presencial em Brasília/DF para apresentar o sistema.",
  "Cadastro de unidades e moradores a partir da planilha do condomínio.",
  "Configuração feita pela TRÍADE: categorias, prazos, horários, áreas comuns e regras.",
  "Ligação do WhatsApp do condomínio e treinamento de quem atende.",
  "Avisos do atendimento pelo WhatsApp incluídos; a franquia de comunicados pelo WhatsApp fica a confirmar na proposta.",
];
const NAO_INCLUI = ["Etiquetas e plaquinhas QR, que são serviço à parte.", "Apoio documental, que é serviço à parte."];
const POR_QUE_FAIXA = [
  "O síndico aprova o gasto em assembleia e quer um valor fixo para o ano.",
  "Cabe numa tabela de quatro linhas; não pede conta.",
  "Prédio maior manda mais mensagens e dá mais trabalho na implantação.",
];

/** Os textos da parte Faixas e implantação, montados com os valores da tabela. */
export function textosFaixas(d: Tabela) {
  const { parametros: p } = d;
  const faixas = comFaixa(d);
  const desconto = descontoFundador(faixas);
  const fundador = `${desconto !== null ? `Cerca de ${desconto}% abaixo da tabela cheia, travado` : "Travado"} por 12 meses e só para os ${p.vagasFundador} primeiros condomínios. Só no mensal. Em troca, o condomínio participa das medições do teste assistido e, se quiser, dá um depoimento do síndico para o site, com nome, foto e número de unidades autorizados por escrito. Como o WhatsApp ainda é o piloto, cada condomínio aceita o termo do piloto.`;
  const comTeto = faixas.filter((f) => f.cheia !== undefined && f.unidadesAte);
  const primeira = comTeto[0], ultima = comTeto.at(-1);
  const acima = d.faixas.find((f) => f.sobConsulta);
  const cheia = [
    primeira && ultima && primeira !== ultima
      ? `No teto de cada faixa, o valor por unidade vai de ${mostrarValor(porUnidadeNoTeto(primeira.cheia!, primeira.unidadesAte!))} (${primeira.unidadesAte} un.) a ${mostrarValor(porUnidadeNoTeto(ultima.cheia!, ultima.unidadesAte!))} (${ultima.unidadesAte} un.).`
      : null,
    acima ? `${nomeFaixa(acima)} unidades ou para administradoras, sob consulta.` : null,
    `Anual: 12 meses pelo preço de ${p.mesesPagosAnual} e implantação isenta. No mensal, a implantação pode ser paga em ${p.parcelasImplantacao} vezes.`,
  ].filter(Boolean).join(" ");
  return { faixas, fundador, cheia };
}

/** O texto que vai para a proposta (quadro 271): os valores saem da tabela. */
export function textoProposta(d: Tabela): string {
  const { faixas, fundador, cheia } = textosFaixas(d);
  const item = (t: string) => `- ${t}`;
  return [
    "Tabela de preços TRÍADE Condo",
    "",
    "Condomínio fundador",
    ...faixas.map((f) => item(`${nomeFaixa(f)}: ${mostrarValor(f.fundador)} por mês, implantação sem custo`)),
    fundador,
    "",
    "Tabela cheia",
    ...faixas.map((f) => item(`${nomeFaixa(f)}: ${mostrarValor(f.cheia)} por mês, implantação ${mostrarValor(f.implantacao)}`)),
    cheia,
    "",
    "O que a implantação inclui",
    ...IMPLANTACAO_INCLUI.map(item),
    "",
    "O que não está incluído",
    ...NAO_INCLUI.map(item),
    "",
    "Conta só a unidade cadastrada e ativa. Preço final, com impostos.",
  ].join("\n");
}

function CartoesFaixa({ faixas, tabela }: { faixas: FaixaPreco[]; tabela: "FUNDADOR" | "CHEIA" }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {faixas.map((f) => (
        <li key={f.codigo} className="grid content-start gap-1 rounded-[14px] border border-linha bg-superficie p-4">
          <span className="t-rotulo font-semibold">{nomeFaixa(f)}</span>
          <span className="t-titulo-tela font-bold tabular-nums">{mostrarValor(tabela === "FUNDADOR" ? f.fundador : f.cheia)} <small className="t-apoio font-medium">/mês</small></span>
          <span className="t-apoio">{tabela === "FUNDADOR" ? "Implantação sem custo" : `Implantação ${mostrarValor(f.implantacao)}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Faixas e implantação (quadro 271), com o texto para a proposta. */
function ParteFaixas({ d, avisar }: { d: Tabela; avisar: (r: Recado) => void }) {
  const { faixas, fundador, cheia } = textosFaixas(d);
  const fundadorEmUso = d.parametros.tabelaEmUso === "FUNDADOR";
  const bloco = "grid content-start gap-2 rounded-[14px] border border-linha bg-fundo p-[18px]";
  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoProposta(d));
      avisar({ tom: "ok", texto: "Texto para a proposta copiado." });
    } catch {
      avisar({ tom: "erro", texto: "Não deu para copiar. Tente de novo ou copie o texto da tela." });
    }
  }
  return (
    <div className="grid gap-5 md:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="t-titulo-secao">{fundadorEmUso ? "Agora: condomínio fundador" : "Condomínio fundador"}</h2>{fundadorEmUso ? <Selo tom="ok">Em uso</Selo> : null}
      </div>
      <CartoesFaixa faixas={faixas} tabela="FUNDADOR" />
      <p className="t-apoio">{fundador}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="t-titulo-secao">{fundadorEmUso ? "Depois: tabela cheia" : "Agora: tabela cheia"}</h2>{fundadorEmUso ? null : <Selo tom="ok">Em uso</Selo>}
      </div>
      <CartoesFaixa faixas={faixas} tabela="CHEIA" />
      <p className="t-apoio">{cheia}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="pr-inclui" className={bloco}>
          <h3 id="pr-inclui" className="t-titulo-cartao">O que a implantação inclui</h3>
          <ul className="grid list-disc gap-1.5 pl-5 t-texto">{IMPLANTACAO_INCLUI.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        <section aria-labelledby="pr-nao-inclui" className={bloco}>
          <h3 id="pr-nao-inclui" className="t-titulo-cartao">O que não está incluído</h3>
          <ul className="grid list-disc gap-1.5 pl-5 t-texto">{NAO_INCLUI.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3 className="mt-2 t-titulo-cartao">Por que faixa</h3>
          <ul className="grid list-disc gap-1.5 pl-5 t-texto">{POR_QUE_FAIXA.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao variante="contorno" onClick={() => void copiar()}><Icone nome="copiar" />Copiar o texto para a proposta</Botao>
      </div>
      <p className="t-apoio">Os valores saem da aba Tabela. Quando a tabela muda, esta explicação muda junto.</p>
    </div>
  );
}

/** Histórico (quadro 274): quem, quando, o que mudou e o motivo. Nada se apaga. Pagina pelo
 * evento mais antigo já mostrado (antes=), como as outras listas de histórico do Console. */
function ParteHistorico() {
  const primeira = useCarregar<Record<string, unknown>>(ROTAS_PRECOS.historico(PAGINA_HISTORICO_PRECOS));
  const [mais, setMais] = useState<{ itens: MudancaPreco[]; temMais: boolean } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (primeira.estado === "carregando") return <div className="md:p-5"><Carregando rotulo="Abrindo o histórico…" /></div>;
  if (primeira.estado === "erro") return <div className="md:p-5"><ErroCarregar erro={primeira.erro} texto={primeira.texto} tentarDeNovo={primeira.recarregar} /></div>;
  const p1 = lerHistoricoPrecos(primeira.dados);
  const itens = [...p1, ...(mais?.itens ?? [])];
  const temMais = mais ? mais.temMais : p1.length === PAGINA_HISTORICO_PRECOS;

  async function carregarMais() {
    setBuscando(true);
    const r = await chamarApi<Record<string, unknown>>(ROTAS_PRECOS.historico(PAGINA_HISTORICO_PRECOS, itens.at(-1)?.id));
    setBuscando(false);
    if (!r.ok) return setErro(textoDoErro(r.erro));
    const h = lerHistoricoPrecos(r.dados);
    setErro(null);
    setMais({ itens: [...(mais?.itens ?? []), ...h], temMais: h.length === PAGINA_HISTORICO_PRECOS });
  }
  return (
    <div className="grid gap-3">
      {itens.length ? (
        <ul aria-label="Mudanças na tabela" className="grid max-md:gap-3">
          {itens.map((h) => (
            <li key={h.id} className="grid gap-x-4 gap-y-1 border-b border-linha px-5 py-4 md:grid-cols-[170px_minmax(0,1fr)] max-md:rounded-[18px] max-md:border max-md:bg-superficie max-md:p-4 max-md:shadow-s1">
              <span className="t-codigo text-tinta-suave">{formatarDataHora(h.em)}</span>
              <span className="grid gap-1">
                <span className="t-texto [overflow-wrap:anywhere]">{h.oQue}</span>
                <span className="t-apoio [overflow-wrap:anywhere]">{`${quemFez(h)} · Motivo: ${h.motivo}`}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <div className="md:p-5"><Vazio titulo="Nenhuma mudança ainda" icone="relogio">Cada mudança da tabela aparece aqui, com quem, quando e o motivo.</Vazio></div>}
      {erro ? <div className="md:px-5"><Aviso tom="erro" papel="alert">{erro}</Aviso></div> : null}
      {temMais ? <div className="md:px-5"><Botao variante="contorno" disabled={buscando} onClick={() => void carregarMais()}>{buscando ? "Carregando…" : "Ver mudanças anteriores"}</Botao></div> : null}
      <p className="t-apoio md:px-5 md:pb-5">{`Cada mudança fica aqui para sempre, com quem, quando, o que mudou e o motivo. Nada se apaga.${itens.length ? ` ${plural(itens.length, "mudança mostrada", "mudanças mostradas")}.` : ""}`}</p>
    </div>
  );
}
