"use client";
// Kit para o conselho e a assembleia (quadro 337, CM-20, CM-19, CM-27 e CM-28): sai da versão
// enviada, da ficha do prédio, dos concorrentes da ficha e das respostas prontas. A equipe escolhe
// as peças e baixa um PDF só; o síndico baixa o kit inteiro pelo link da proposta. O comparativo
// (0307) tem uma linha por critério que o síndico marcou: a TRÍADE com texto fixo (EM-07) e, nas
// outras colunas, o fato que a equipe confirmou; o resto fica "a confirmar com eles". "Escolher
// critérios" grava na ficha do prédio, com o problema do prédio que abre a apresentação.
// Com piloto (CM-21, 0308), a apresentação curta e o PDF trazem o prazo, a meta e o resultado.
// Mandar pelo WhatsApp gera um link novo da proposta (o código só aparece uma vez) e registra a
// conversa. "Custo na apresentação" (R17.3c, quadro 447): o destaque "menos de R$ 5" só quando é
// verdade e a taxa média de condomínio, que se corrige aqui: grava na ficha e vale para o kit e para
// a próxima versão, nunca para a versão enviada.

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  fraseDoDestaque, lerTaxaCondominio, mostrarValor, taxaParaCampo, TEXTO_A_CONFIRMAR, TEXTO_AJUDA_TAXA, TEXTO_COMPARATIVO, TEXTO_MENOS_DE_CINCO, type CriterioSindico,
} from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { Cartao, Voltar } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { textoMeta, textoPrazo } from "./cliente.ts";
import { ROTAS_COMERCIAL } from "./comum.tsx";
import { JanelaCriterios, JanelaFato } from "./janelasKit.tsx";
import { JanelaMandarWhatsapp } from "./janelasPropostas.tsx";
import { DestaqueCusto } from "./LinkProposta.tsx";
import {
  custoDoKit, documentoKit, enderecoDoLink, fatoDaCelula, textoTriade, mensagemDoLink, ORDEM_PECAS, PECAS_KIT, pecasDisponiveis, ROTAS_PROPOSTAS, subtituloReferencias, TELAS_PROPOSTAS,
  type FichaProposta, type Kit, type PecaKit,
} from "./propostas.ts";
import type { FichaInteressado } from "./tipos.ts";

/** De onde veio a taxa do kit (r5): a ficha manda; tirada na ficha é sem taxa. */
const ORIGEM_TAXA = {
  FICHA: "Esta é a taxa da ficha.",
  VERSAO: "A ficha nunca teve taxa: esta é a da versão enviada.",
  SEM: "Sem taxa na ficha: o kit mostra só o valor por apartamento.",
} as const;

/** "Custo na apresentação" (quadro 447): o destaque, a taxa que se corrige e as unidades da versão. */
function CustoNaApresentacao({ k, edita, versaoFicha, feito }: { k: Kit; edita: boolean; versaoFicha?: number; feito: (texto: string) => void }) {
  const custo = custoDoKit(k);
  const [taxa, setTaxa] = useState(taxaParaCampo(k.taxaCondominio));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!custo) return null;
  const d = custo.menosDeCinco ? { titulo: TEXTO_MENOS_DE_CINCO, frase: fraseDoDestaque(custo, `do ${k.predio.condominio}`) } : null;
  const unidades = k.proposta.unidades ?? k.predio.unidades;

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const lida = lerTaxaCondominio(taxa);
    if (lida.erro) return setErro(lida.erro);
    if (!k.interessado || versaoFicha === undefined) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(ROTAS_PROPOSTAS.taxa(k.interessado.id), { metodo: "PUT", corpo: { versao: versaoFicha, taxaCondominio: lida.taxa } });
    setEnviando(false);
    if (!r.ok) return setErro(textoDoErro(r.erro));
    feito(lida.taxa === null ? "Taxa tirada da ficha. O kit mostra só o valor por apartamento." : "Taxa salva na ficha. Vale para o kit e para a próxima versão.");
  }

  return (
    <Cartao id="kit-custo" titulo="Custo na apresentação" icone="dinheiro" acao={custo.taxa !== null ? <Selo tom="ok">Taxa informada</Selo> : undefined}>
      {d ? <DestaqueCusto d={d} /> : <p className="t-texto">{fraseDoDestaque(custo)}</p>}
      <form onSubmit={salvar} noValidate className="grid gap-4 md:grid-cols-2">
        <CampoTexto id="kit-taxa" rotulo="Taxa média de condomínio (R$ por mês)" opcional inputMode="decimal" value={taxa} readOnly={!edita}
          onChange={(e) => setTaxa(e.target.value)} ajuda={`${TEXTO_AJUDA_TAXA} ${ORIGEM_TAXA[k.taxaDe ?? "SEM"]}`} erro={erro ?? undefined} placeholder="650,00" />
        <CampoTexto id="kit-unidades" rotulo="Unidades" value={unidades ? String(unidades) : ""} readOnly ajuda={`Da proposta v${k.proposta.numero} enviada.`} />
        {edita ? (
          <Botao type="submit" variante="contorno" className="md:justify-self-start" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar a taxa"}</Botao>
        ) : null}
      </form>
      <p className="t-apoio">
        {`Estimativa: a mensalidade de ${mostrarValor(k.proposta.mensal ?? null)} dividida por ${unidades ?? "—"} unidades, com a implantação à parte. Não é economia prometida. Sem a taxa, o kit mostra só o valor por apartamento.`}
      </p>
    </Cartao>
  );
}

export function KitConselho() {
  const { id } = useParams<{ id: string }>();
  const kit = useCarregar<Kit>(ROTAS_PROPOSTAS.kit(id));
  const ficha = useCarregar<FichaProposta>(ROTAS_PROPOSTAS.proposta(id));
  const f = ficha.estado === "pronto" ? ficha.dados : null;
  const interessado = useCarregar<FichaInteressado>(f ? ROTAS_COMERCIAL.interessado(f.interessado.id) : null);
  const [fora, setFora] = useState<PecaKit[]>([]);
  const [fazendo, setFazendo] = useState<"pdf" | "link" | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [janela, setJanela] = useState<{ tipo: "criterios" } | { tipo: "fato"; criterio: CriterioSindico; titulo: string; sistema: string; coluna: string } | null>(null);

  const voltar = <Voltar href={TELAS_PROPOSTAS.lista(id)} texto={f?.interessado.condominio ?? "Voltar à proposta"} />;
  if (kit.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Montando o kit…" /></div>;
  if (kit.estado === "erro") {
    const semEnvio = kit.erro.detalhes?.motivo === "SEM_VERSAO_ENVIADA";
    return (
      <div className="grid gap-4">
        {voltar}
        <h1 className="t-titulo-tela">Kit para o conselho</h1>
        {semEnvio ? <Vazio titulo="Ainda não há versão enviada" icone="documento">{textoDoErro(kit.erro)}</Vazio>
          : <ErroCarregar erro={kit.erro} texto={kit.texto} tentarDeNovo={kit.recarregar} />}
      </div>
    );
  }
  const k = kit.dados;
  const falta = pecasDisponiveis(k);
  const escolhidas = ORDEM_PECAS.filter((p) => !fora.includes(p) && falta[p] === null);
  const colunas = k.comparativo.colunas ?? [];
  const linhas = k.comparativo.linhas ?? [];
  const edita = !!(k.podeEditar ?? f?.podeEditar) && !!k.interessado;
  const pronto = (texto: string) => { setJanela(null); setAviso({ tom: "ok", texto }); kit.recarregar(); interessado.recarregar(); };

  async function pdf() {
    setAviso(null);
    setFazendo("pdf");
    try {
      const { baixarPdf } = await import("./pdf.ts");
      await baixarPdf(documentoKit(k, escolhidas));
    } catch {
      setAviso({ tom: "erro", texto: "Não deu para montar o PDF. Tente de novo." });
    } finally {
      setFazendo(null);
    }
  }

  async function prepararMensagem() {
    if (!k.versaoId) return;
    setAviso(null);
    setFazendo("link");
    const r = await chamarApi<{ link: { codigo: string } }>(ROTAS_PROPOSTAS.acao(id, k.versaoId, "link"), { corpo: {} });
    setFazendo(null);
    if (!r.ok) return setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    setMensagem(mensagemDoLink(f?.interessado.pessoa, k.predio.condominio, enderecoDoLink(window.location.origin, r.dados.link.codigo), true,
      (k.comparativo.linhas?.length ?? 0) > 0));
  }

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">Kit para o conselho</h1>
          <p className="t-apoio">Sai dos dados do prédio e da proposta enviada. O síndico baixa pelo link da proposta ou recebe pelo WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full">
          <Botao variante="contorno" disabled={fazendo === "pdf" || !escolhidas.length} onClick={() => void pdf()}>
            <Icone nome="baixar" />{fazendo === "pdf" ? "Montando o PDF…" : "Baixar o kit em PDF"}
          </Botao>
          {f?.podeEditar ? (
            <Botao disabled={fazendo === "link"} onClick={() => void prepararMensagem()}><Icone nome="whats" />{fazendo === "link" ? "Gerando o link…" : "Mandar pelo WhatsApp comercial"}</Botao>
          ) : null}
        </div>
      </div>
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {f?.podeEditar ? <p className="t-apoio">Mandar pelo WhatsApp gera um link novo da proposta: o link anterior para de abrir.</p> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Cartao id="kit-pecas" titulo="O que vai no kit" icone="clipe">
          <fieldset className="grid">
            <legend className="sr-only">Peças do kit</legend>
            {ORDEM_PECAS.map((p) => {
              const motivo = falta[p];
              const apoio = p === "PROPOSTA" ? `A versão enviada (v${k.proposta.numero}), com a impressão digital`
                : p === "REFERENCIAS" && k.referencias.length ? subtituloReferencias(k.referencias.length)
                : p === "APRESENTACAO" ? [k.predio.problema ? `Abre com o problema do prédio: ${k.predio.problema}` : `${PECAS_KIT[p].apoio}. Sem o problema do prédio: escreva em Escolher critérios.`,
                  k.piloto ? `Com o piloto: ${textoPrazo(k.piloto)}, meta de ${textoMeta(k.piloto.meta, k.piloto.metaPercentual)}.` : null].filter(Boolean).join(" ")
                : PECAS_KIT[p].apoio;
              return (
                <label key={p} className={`flex gap-3 border-t border-linha py-3 first:border-t-0 ${motivo ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={!fora.includes(p) && !motivo} disabled={!!motivo}
                    onChange={(e) => setFora((x) => (e.target.checked ? x.filter((y) => y !== p) : [...x, p]))} />
                  <span className="grid gap-0.5">
                    <span className="t-texto">{PECAS_KIT[p].titulo}</span>
                    <span className="t-apoio">{motivo ?? apoio}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Cartao>

        <Cartao id="kit-comparativo" titulo="Comparativo" icone="grafico"
          acao={edita ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "criterios" })}><Icone nome="editar" />Escolher critérios</Botao> : undefined}>
          {linhas.length ? (
            <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Comparativo, role para o lado">
              <table className="w-full min-w-[560px] border-collapse">
                <caption className="sr-only">Comparativo para o conselho</caption>
                <thead>
                  <tr>
                    {["Critério do síndico", "TRÍADE", ...colunas.map((c) => c.nome)].map((c) => (
                      <th key={c} scope="col" className="border-b border-linha bg-superficie-2 px-3 py-2.5 text-left t-rotulo font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.criterio}>
                      <th scope="row" className="border-b border-linha px-3 py-2.5 text-left align-top t-texto font-medium">{l.titulo}</th>
                      <td className="border-b border-linha px-3 py-2.5 align-top t-texto">{textoTriade(k, l)}</td>
                      {colunas.map((c, n) => {
                        const v = l.valores[n];
                        const fato = fatoDaCelula(k, l.criterio, c.nome);
                        return (
                          <td key={c.nome} className="border-b border-linha px-3 py-2.5 align-top t-texto">
                            <span className={v?.confirmado ? "" : "text-tinta-suave"}>{v?.confirmado && v.texto ? v.texto : TEXTO_A_CONFIRMAR}</span>
                            {edita ? (
                              <Botao variante="discreto" tamanho="m" className="mt-1"
                                aria-label={`${fato ? "Mudar" : "Registrar"} o fato: ${c.nome}, ${l.titulo}`}
                                onClick={() => setJanela({ tipo: "fato", criterio: l.criterio, titulo: l.titulo, sistema: c.nome, coluna: c.tipo })}>
                                <Icone nome={fato ? "editar" : "mais"} className="h-4 w-4" />{fato ? "Mudar" : "Registrar"}
                              </Botao>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio titulo="Sem critérios do síndico" icone="lista">
              {edita ? "Marque o que o síndico quer comparar em Escolher critérios: cada critério vira uma linha." : "A equipe do Comercial marca os critérios que o síndico escolheu na visita."}
            </Vazio>
          )}
          {linhas.length && !colunas.length ? <p className="t-apoio">Sem sistema atual nem concorrentes na ficha: o comparativo mostra só a TRÍADE.</p> : null}
          <p className="t-apoio">{TEXTO_COMPARATIVO}</p>
        </Cartao>
      </div>

      <CustoNaApresentacao key={`${k.taxaCondominio ?? ""}`} k={k} edita={edita}
        versaoFicha={interessado.estado === "pronto" ? interessado.dados.versao : k.interessado?.versao}
        feito={(texto) => pronto(texto)} />

      {k.predio.sistemaAtual || k.predio.decisaoEm || k.predio.assembleiaOrdinaria ? (
        <p className="t-apoio">
          {[k.predio.sistemaAtual ? `Hoje usa ${k.predio.sistemaAtual}` : null, k.predio.administradora ? `administradora ${k.predio.administradora}` : null,
            k.predio.decisaoEm ? `decisão em ${k.predio.decisaoEm.split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {janela?.tipo === "criterios" && k.interessado ? (
        <JanelaCriterios interessado={interessado.estado === "pronto" ? { id: interessado.dados.id, versao: interessado.dados.versao } : k.interessado}
          inicial={{ criterios: k.predio.criterios ?? [], criterioOutro: k.predio.criterioOutro ?? "", problema: k.predio.problema ?? "" }}
          aoFechar={() => setJanela(null)} feito={() => pronto("Critérios salvos na ficha do prédio.")} />
      ) : null}
      {janela?.tipo === "fato" && k.interessado ? (
        <JanelaFato sistema={janela.sistema} sistemaAtual={janela.coluna === "SISTEMA_ATUAL"} criterio={janela.criterio} nomeCriterio={janela.titulo} interessadoId={k.interessado.id}
          fato={fatoDaCelula(k, janela.criterio, janela.sistema)} aoFechar={() => setJanela(null)} feito={pronto} />
      ) : null}
      {mensagem ? (
        <JanelaMandarWhatsapp interessado={interessado.estado === "pronto" ? interessado.dados : null} texto={mensagem} aoFechar={() => setMensagem(null)}
          feito={() => { setMensagem(null); setAviso({ tom: "ok", texto: "Conversa registrada na ficha." }); }} />
      ) : null}
    </div>
  );
}
