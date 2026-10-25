"use client";
// Decisões › Despesas (R5, FC-10; quadros 418, 419 e 423): a conta, a fatura ou o orçamento que
// precisa do sim do síndico, de quem tem Aprovar ou do conselho. A lista com os filtros, e a
// janela Nova despesa para aprovar, com o fornecedor, os anexos, a ligação a uma coisa só (pedido,
// manutenção ou decisão) e quem aprova; e a janela Alterar a despesa, antes do primeiro voto (R5.3).
// Passar da alçada só avisa. Aprovar não paga nada: o pagamento continua fora do sistema.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { avisoAlcada, dinheiro, FILTROS_DESPESA, formatar, lerReais, lider, mostrarCusto, textoQuemVotaNoConselho, type FiltroDespesa } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi, type Tom } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { Despesa, DespesaDetalhe, FilaPedidos, LigacaoDespesa, LinkMandado, ListaDecisoes, ListaDespesas, ListaManutencoes, OpcoesDespesa, Recado } from "../tipos.ts";
import { EscolherArquivos, type ItemEnvio } from "../pedidos/Arquivos.tsx";
import { diaDoPrazo } from "./comum.tsx";
import { enviarAnexos, textoDoEnvio } from "./anexos.tsx";
import { LinksMandados, recadoDosLinks, temLinkParaCopiar } from "./votacao.tsx";

/** A situação da despesa num selo (quadro 418): "Em votação · 1 de 3", "Aguardando Ana", "Aprovada"… */
export function situacaoDespesa(d: Pick<Despesa, "estado" | "modo" | "conselho" | "decisor" | "voltouAoSindicoEm" | "pagamento">): { texto: string; tom: Tom } {
  if (d.estado === "PAGA" || d.pagamento) return { texto: "Aprovada", tom: "ok" };
  if (d.estado === "APROVADA") return { texto: "Aprovada", tom: "ok" };
  if (d.estado === "RECUSADA") return { texto: "Recusada", tom: "erro" };
  if (d.estado === "RETIRADA") return { texto: "Retirada", tom: "neutro" };
  if (d.modo === "CONSELHO" && d.conselho && !d.voltouAoSindicoEm) {
    const l = lider(d.conselho.contagem);
    return { texto: `Em votação · ${l && l.escolha === "APROVAR" ? l.votos : 0} de ${d.conselho.necessarios}`, tom: "andamento" };
  }
  const nome = d.decisor?.eu ? "você" : d.decisor?.nome.split(" ")[0];
  return { texto: nome ? `Aguardando ${nome}` : "Aguardando", tom: "andamento" };
}

/** A segunda linha da despesa: o fornecedor e o que mais importa agora. */
export function linhaDespesa(d: Despesa): string {
  const quando = d.pagamento ? `paga fora do sistema em ${diaDoPrazo(d.pagamento.pagaEm)}`
    : d.estado === "RECUSADA" && d.respondidaEm ? `recusada em ${diaDoPrazo(d.respondidaEm.slice(0, 10))}`
      : d.estado === "RETIRADA" ? "retirada"
        : d.vencimento ? `vence ${diaDoPrazo(d.vencimento)}` : `${d.modo === "CONSELHO" ? "votar" : "responder"} até ${diaDoPrazo(d.prazo)}`;
  return [d.fornecedor.nome, quando].filter(Boolean).join(" · ");
}

const NOME_FILTRO = FILTROS_DESPESA;

export function AbaDespesas({ recado, contar }: { recado: (r: Recado) => void; contar: (n: number) => void }) {
  const { atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const filtro = (Object.keys(FILTROS_DESPESA) as FiltroDespesa[]).find((f) => f === busca.get("filtro")) ?? "AGUARDANDO";
  const carga = useCarregar<ListaDespesas>(`/v1/condominio/despesas?filtro=${filtro}`);
  const [nova, setNova] = useState(busca.get("nova") === "1");
  const [links, setLinks] = useState<LinkMandado[] | null>(null);
  const pronto = carga.estado === "pronto" ? carga.dados : null;
  useEffect(() => { if (pronto) contar(pronto.contagem.AGUARDANDO); }, [pronto, contar]);

  const filtros = (
    <div role="group" aria-label="Quais despesas" className="flex gap-1 overflow-x-auto border-b border-linha">
      {(Object.keys(FILTROS_DESPESA) as FiltroDespesa[]).map((f) => {
        const atual = f === filtro;
        const n = f === "TODAS" ? 0 : pronto?.contagem[f] ?? 0;
        return (
          <button key={f} type="button" aria-pressed={atual} onClick={() => router.replace(`/decisoes?aba=despesas&filtro=${f}`, { scroll: false })}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
            {NOME_FILTRO[f]}
            {n ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
  const botao = pronto?.pode.registrar ? (
    <Botao className="justify-self-end max-md:justify-self-stretch" onClick={() => setNova(true)}><Icone nome="mais" />Nova despesa para aprovar</Botao>
  ) : null;

  if (carga.estado === "carregando") return <>{filtros}<Carregando rotulo="Carregando as despesas…" /></>;
  if (carga.estado === "erro") return <>{filtros}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></>;
  const dados = carga.dados;
  return (
    <>
      {botao}
      {filtros}
      {dados.despesas.length === 0 ? (
        <Vazio titulo={filtro === "AGUARDANDO" ? "Nenhuma despesa esperando aprovação" : "Nenhuma despesa aqui"} icone="dinheiro">
          A conta, a fatura ou o orçamento que precisa do sim do síndico ou do conselho entra por Nova despesa para aprovar.
        </Vazio>
      ) : (
        <section aria-label="Despesas" className="overflow-hidden rounded-[18px] border border-linha bg-superficie shadow-s1">
          <div aria-hidden="true" className="grid grid-cols-[40px_minmax(0,1.6fr)_8rem_minmax(0,1fr)_18px] gap-4 bg-superficie-2 px-5 py-2.5 t-rotulo max-md:hidden">
            <span /><span>Despesa</span><span>Valor</span><span>Situação</span><span />
          </div>
          <ul>
            {dados.despesas.map((d) => {
              const s = situacaoDespesa(d);
              return (
                <li key={d.id} className="border-t border-linha first:border-t-0 md:first:border-t">
                  <Link href={`/decisoes/despesa?id=${d.id}`}
                    className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-fundo max-md:px-4 md:grid-cols-[40px_minmax(0,1.6fr)_8rem_minmax(0,1fr)_18px]">
                    <span className="ladrilho max-md:hidden" data-tom="violeta" aria-hidden="true"><Icone nome="dinheiro" /></span>
                    <span className="grid min-w-0 gap-0.5 max-md:col-span-2 max-md:col-start-1 max-md:row-start-2">
                      <span className="t-texto font-medium">{d.descricao}</span>
                      <span className="t-apoio">{linhaDespesa(d)}</span>
                    </span>
                    <span className="t-codigo max-md:col-start-3 max-md:row-start-2 max-md:self-start">{mostrarCusto(d.valor)}</span>
                    <span className="flex flex-wrap gap-1.5 max-md:col-span-3 max-md:row-start-1">
                      <Selo tom={s.tom}>{s.texto}</Selo>
                      {d.passaAlcada && d.estado === "AGUARDANDO" ? <Selo tom="atencao">Passa da alçada</Selo> : null}
                      {d.pagamento ? <Selo tom="neutro">Paga fora</Selo> : null}
                      {d.vencida && d.estado === "AGUARDANDO" ? <Selo tom="erro">Prazo vencido</Selo> : null}
                    </span>
                    <Icone nome="dir" className="h-4 w-4 text-tinta-suave max-md:hidden" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="t-apoio">
        {dados.alcada ? `Alçada do conselho: a partir de ${mostrarCusto(dados.alcada)}, escrita em Configurações › Regras. ` : "Sem alçada escrita em Configurações › Regras. "}
        Passar da alçada só avisa; quem decide continua sendo quem você escolher.
      </p>
      <NovaDespesa aberto={nova} aoFechar={() => setNova(false)} criada={(t, l) => {
        setNova(false);
        recado({ tom: "ok", texto: t });
        if (temLinkParaCopiar(l)) setLinks(l);
        carga.recarregar();
        atualizar();
      }} />
      <LinksMandados links={links} aoFechar={() => setLinks(null)} />
    </>
  );
}

function somarDias(data: string, n: number): string {
  const t = Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Nova despesa para aprovar (quadro 419). */
export function NovaDespesa({ aberto, aoFechar, criada }: { aberto: boolean; aoFechar: () => void; criada: (texto: string, links: LinkMandado[]) => void }) {
  const opcoes = useCarregar<OpcoesDespesa>(aberto ? "/v1/condominio/despesas/opcoes" : null);
  return (
    <Dialogo aberto={aberto} titulo="Nova despesa para aprovar" aoFechar={aoFechar} fechar media apoio="Aprovar não paga nada: o pagamento continua fora do sistema">
      {!aberto ? null : opcoes.estado === "carregando" ? <Carregando rotulo="Carregando…" />
        : opcoes.estado === "erro" ? <ErroCarregar erro={opcoes.erro} texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} />
          : <FormDespesa o={opcoes.dados} aoFechar={aoFechar} criada={criada} />}
    </Dialogo>
  );
}

/** Alterar a despesa (R5.3, quadro 420): enquanto espera e antes do primeiro voto, os mesmos dados da
 * Nova despesa, sem quem aprova e sem o prazo. A versão mudada por outra pessoa pede para recarregar. */
export function AlterarDespesa({ d, aberto, aoFechar, alterada, recarregar }: {
  d: DespesaDetalhe; aberto: boolean; aoFechar: () => void; alterada: (texto: string) => void; recarregar: () => void;
}) {
  const opcoes = useCarregar<OpcoesDespesa>(aberto ? "/v1/condominio/despesas/opcoes" : null);
  return (
    <Dialogo aberto={aberto} titulo="Alterar a despesa" aoFechar={aoFechar} fechar media apoio="Quem aprova e o prazo ficam como estão">
      {!aberto ? null : opcoes.estado === "carregando" ? <Carregando rotulo="Carregando…" />
        : opcoes.estado === "erro" ? <ErroCarregar erro={opcoes.erro} texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} />
          : <FormDespesa key={d.versao} o={opcoes.dados} atual={d} aoFechar={aoFechar} alterada={alterada} recarregar={recarregar} />}
    </Dialogo>
  );
}

const OUTRO = "__outro";
const CAMPOS_DESPESA = ["descricao", "valor", "vencimento", "fornecedor", "prestadorId", "decisorId", "prazo", "ligacao", "pedidoId", "manutencaoId", "decisaoId"];
/** 425000 → "4.250,00", como a pessoa escreve no campo. */
const reaisNoCampo = (centavos: number) => formatar(dinheiro(centavos)).replace(/^R\$\s?/, "");

function FormDespesa({ o, atual, aoFechar, criada, alterada, recarregar }: {
  o: OpcoesDespesa; atual?: DespesaDetalhe; aoFechar: () => void;
  criada?: (texto: string, links: LinkMandado[]) => void; alterada?: (texto: string) => void; recarregar?: () => void;
}) {
  const conselho = o.conselho.podePedir;
  const prestadorAtual = atual?.fornecedor.prestadorId && o.prestadores.some((p) => p.id === atual.fornecedor.prestadorId) ? atual.fornecedor.prestadorId : null;
  const [descricao, setDescricao] = useState(atual?.descricao ?? "");
  const [valor, setValor] = useState(atual ? reaisNoCampo(atual.valor) : "");
  const [vencimento, setVencimento] = useState(atual?.vencimento ?? "");
  const [prestador, setPrestador] = useState(prestadorAtual ?? (atual || !o.prestadores.length ? OUTRO : ""));
  const [fornecedor, setFornecedor] = useState(prestadorAtual ? "" : atual?.fornecedor.nome ?? "");
  const [ligacao, setLigacao] = useState<LigacaoDespesa | null>(atual?.ligacao ?? null);
  const [quem, setQuem] = useState(conselho ? "CONSELHO" : o.decisores[0]?.vinculoId ?? "");
  const [prazo, setPrazo] = useState(somarDias(o.hoje, 7));
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [valorErrado, setValorErrado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  let centavos: number | null = null;
  try { centavos = valor.trim() ? lerReais(valor).centavos : null; } catch { centavos = null; }
  const alcada = centavos !== null ? avisoAlcada(centavos, o.conselho.alcada) : null;
  const ninguem = !atual && !conselho && !o.decisores.length;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (centavos === null || centavos <= 0) { setValorErrado(true); return; }
    setValorErrado(false);
    setEnviando(true);
    const dados = {
      descricao: descricao.trim(), valor: centavos, vencimento: vencimento || null,
      prestadorId: prestador && prestador !== OUTRO ? prestador : null, fornecedor: prestador && prestador !== OUTRO ? null : fornecedor.trim() || null,
      ...ligacaoParaApi(ligacao),
    };
    if (atual) {
      const r = await chamarApi<{ versao: number }>(`/v1/condominio/despesas/${atual.id}`, { metodo: "PUT", corpo: { versao: atual.versao, ...dados } });
      setEnviando(false);
      if (!r.ok) return setErro(r.erro);
      return alterada?.("Despesa alterada. A mudança fica no histórico.");
    }
    const deConselho = quem === "CONSELHO";
    const r = await chamarApi<{ id: string; versao: number; links?: LinkMandado[] }>("/v1/condominio/despesas", {
      corpo: { ...dados, modo: deConselho ? "CONSELHO" : "PESSOA", decisorId: deConselho ? null : quem, prazo },
    });
    if (!r.ok) { setEnviando(false); return setErro(r.erro); }
    const anexos = itens.length ? textoDoEnvio(await enviarAnexos({ tipo: "despesas", id: r.dados.id }, "DOCUMENTO", itens)) : "";
    setEnviando(false);
    const links = r.dados.links ?? [];
    const pessoa = o.decisores.find((x) => x.vinculoId === quem);
    const pedido = deConselho ? `Despesa pedida ao conselho, para votar até ${diaDoPrazo(prazo)}. ${recadoDosLinks(links)}`
      : `${pessoa?.eu ? "Despesa registrada para você aprovar." : `Despesa pedida a ${pessoa?.nome ?? "quem aprova"}, com aviso no sino.`}${links.length ? ` O síndico está ausente: ${recadoDosLinks(links)}` : ""}`;
    criada?.([pedido, anexos].filter(Boolean).join(" "), links);
  }

  if (ninguem) {
    return (
      <div className="grid gap-4">
        <Aviso tom="atencao">Ninguém pode aprovar agora: o síndico não tem acesso, ninguém tem a permissão Aprovar e não há conselho com mandato em dia.</Aviso>
        <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !CAMPOS_DESPESA.some((c) => comErro.includes(c))
        ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}
      {!atual && o.ausencia?.ativa ? <Aviso tom="info">{o.ausencia.sindico ?? "O síndico"} está ausente até {diaDoPrazo(o.ausencia.ate)}: o que for pedido a ele vai para {o.ausencia.substituto}.</Aviso> : null}
      <CampoTexto id="desp-descricao" rotulo="O que é" required maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)}
        erro={comErro.includes("descricao") ? "Diga o que é (3 a 200 caracteres)." : null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="desp-valor" rotulo="Valor" required inputMode="decimal" maxLength={20} value={valor} onChange={(e) => setValor(e.target.value)}
          ajuda="Em reais, como 4.250,00." erro={valorErrado || comErro.includes("valor") ? "Escreva o valor em reais, como 4.250,00." : null} />
        <CampoTexto id="desp-vencimento" rotulo="Vencimento" opcional type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)}
          erro={comErro.includes("vencimento") ? "Confira a data." : null} />
      </div>
      {o.prestadores.length ? (
        <CampoSelecao id="desp-prestador" rotulo="Fornecedor" value={prestador} onChange={(e) => setPrestador(e.target.value)}
          opcoes={[{ valor: "", texto: "Escolha o prestador" }, ...o.prestadores.map((p) => ({ valor: p.id, texto: p.servico ? `${p.nome} · ${p.servico}` : p.nome })),
            { valor: OUTRO, texto: "Outro: escrever só o nome" }]}
          erro={comErro.includes("prestadorId") || (comErro.includes("fornecedor") && prestador !== OUTRO) ? "Escolha o prestador ou escreva o nome." : null} />
      ) : null}
      {prestador === OUTRO ? (
        <CampoTexto id="desp-fornecedor" rotulo={o.prestadores.length ? "Nome do fornecedor" : "Fornecedor"} required maxLength={120} value={fornecedor}
          onChange={(e) => setFornecedor(e.target.value)} ajuda={o.prestadores.length ? undefined : "O nome de quem cobra. Os prestadores cadastrados aparecem aqui."}
          erro={comErro.includes("fornecedor") ? "Diga o fornecedor (2 a 120 caracteres)." : null} />
      ) : null}
      {atual ? null : <EscolherArquivos rotulo="Fatura, nota ou orçamento" opcional itens={itens} aoMudar={setItens} enviando={enviando} />}
      <CampoLigacao valor={ligacao} mudar={setLigacao}
        erro={comErro.includes("ligacao") ? "Ligue a uma coisa só: um pedido, uma manutenção ou uma decisão."
          : ["pedidoId", "manutencaoId", "decisaoId"].some((c) => comErro.includes(c)) ? "Não deu para ligar a este item: ele não existe mais ou você não o vê. Escolha outro." : null} />
      {atual ? null : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-apoio font-medium">Quem aprova</legend>
          {conselho ? <Escolha nome="desp-quem" valor="CONSELHO" atual={quem} mudar={setQuem} texto="O conselho" sub={textoQuemVotaNoConselho(o.conselho)} /> : null}
          {o.decisores.map((x) => (
            <Escolha key={x.vinculoId} nome="desp-quem" valor={x.vinculoId} atual={quem} mudar={setQuem}
              texto={x.eu ? `${x.nome} (você)` : x.nome} sub={x.sindico ? "Síndico" : "Tem a permissão Aprovar"} />
          ))}
          {comErro.includes("decisorId") ? <p className="t-texto text-erro">Escolha quem aprova.</p> : null}
        </fieldset>
      )}
      {alcada ? <Aviso tom="atencao">{alcada}</Aviso> : null}
      {atual ? <p className="t-apoio">A mudança fica no histórico da despesa, com o seu nome. Só dá para alterar enquanto ninguém votou.</p> : (
        <>
          <CampoTexto id="desp-prazo" rotulo={quem === "CONSELHO" ? "Votar até" : "Responder até"} required type="date" min={o.hoje} max={somarDias(o.hoje, 90)} value={prazo}
            onChange={(e) => setPrazo(e.target.value)} erro={comErro.includes("prazo") ? "O prazo vai de hoje a 90 dias." : null} />
          <p className="t-apoio">Aprovar não paga nada: depois de aprovada, você marca Paga fora do sistema na ficha, com o comprovante.</p>
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
        {atual ? <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar"}</Botao>
          : <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Pedir aprovação"}</Botao>}
      </div>
    </form>
  );
}

const NOME_LIGACAO: Record<LigacaoDespesa["tipo"], string> = { PEDIDO: "Pedido", MANUTENCAO: "Manutenção", DECISAO: "Decisão" };
const ICONE_LIGACAO = { PEDIDO: "pedido", MANUTENCAO: "ferramenta", DECISAO: "decisao" } as const;

/** "Manutenção · Elevador social parado · 14/10", como no quadro 419. */
export const textoLigacao = (l: LigacaoDespesa) => `${NOME_LIGACAO[l.tipo]} · ${l.rotulo}`;

/** A ligação no corpo da API: só um dos três campos (Ligue a uma coisa só). */
export function ligacaoParaApi(l: LigacaoDespesa | null) {
  return { pedidoId: l?.tipo === "PEDIDO" ? l.id : null, manutencaoId: l?.tipo === "MANUTENCAO" ? l.id : null, decisaoId: l?.tipo === "DECISAO" ? l.id : null };
}

/** O que a busca achou, já como ligação: o pedido pelo protocolo e o assunto, a manutenção e a
 * decisão pelo título e o dia em que nasceram. A decisão não tem busca na API: filtra aqui. */
export function achadosDaLigacao(termo: string, pedidos?: Pick<FilaPedidos, "itens">, manutencoes?: Pick<ListaManutencoes, "itens">,
  decisoes?: Pick<ListaDecisoes, "decisoes">): (LigacaoDespesa & { sub?: string })[] {
  const t = termo.trim().toLocaleLowerCase("pt-BR");
  const dia = (iso: string) => diaDoPrazo(iso.slice(0, 10));
  return [
    ...(pedidos?.itens ?? []).slice(0, 5).map((p) => ({ tipo: "PEDIDO" as const, id: p.id, rotulo: `${p.protocolo} · ${p.assunto}`, sub: p.unidade ?? p.local ?? undefined })),
    ...(manutencoes?.itens ?? []).slice(0, 5).map((m) => ({ tipo: "MANUTENCAO" as const, id: m.id, rotulo: `${m.titulo} · ${dia(m.criadoEm)}`, sub: m.local })),
    ...(decisoes?.decisoes ?? []).filter((d) => d.pergunta.toLocaleLowerCase("pt-BR").includes(t) || (d.pedido?.protocolo ?? "").includes(t)).slice(0, 5)
      .map((d) => ({ tipo: "DECISAO" as const, id: d.id, rotulo: `${d.pergunta} · ${dia(d.pedidaEm)}`, sub: d.pedido ? `${d.pedido.protocolo} · ${d.pedido.assunto}` : undefined })),
  ];
}

/** Ligada a (opcional): busca um pedido, uma manutenção ou uma decisão, nas listas que a pessoa vê. */
function CampoLigacao({ valor, mudar, erro }: { valor: LigacaoDespesa | null; mudar: (l: LigacaoDespesa | null) => void; erro: string | null }) {
  const { pode } = usePlataforma();
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => { const t = setTimeout(() => setTermo(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  const procurar = termo.length >= 2 && !valor;
  const enc = encodeURIComponent(termo);
  const vePedidos = pode("pedidos.ver");
  const veManutencao = pode("manutencao.ver");
  const pedidos = useCarregar<FilaPedidos>(procurar && vePedidos ? `/v1/condominio/pedidos?situacao=TODOS&busca=${enc}` : null);
  const manutencoes = useCarregar<ListaManutencoes>(procurar && veManutencao ? `/v1/condominio/manutencao?situacao=TODAS&busca=${enc}` : null);
  const decisoes = useCarregar<ListaDecisoes>(procurar && vePedidos ? "/v1/condominio/decisoes?filtro=TODAS" : null);
  const carregando = [vePedidos ? pedidos : null, veManutencao ? manutencoes : null, vePedidos ? decisoes : null].some((c) => c?.estado === "carregando");
  const achados = achadosDaLigacao(termo,
    pedidos.estado === "pronto" ? pedidos.dados : undefined, manutencoes.estado === "pronto" ? manutencoes.dados : undefined,
    decisoes.estado === "pronto" ? decisoes.dados : undefined);

  if (valor) {
    return (
      <div className="grid gap-1">
        <span id="desp-ligacao-rotulo" className="t-apoio font-medium">Ligada a <span className="font-normal text-tinta-suave">(opcional)</span></span>
        <div role="group" aria-labelledby="desp-ligacao-rotulo" className="flex items-center gap-2.5 rounded-xl border border-linha bg-fundo px-3 py-2 t-texto">
          <Icone nome={ICONE_LIGACAO[valor.tipo]} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{textoLigacao(valor)}</span>
          <Botao variante="discreto" tamanho="p" onClick={() => { setBusca(""); mudar(null); }} aria-label={`Tirar a ligação: ${textoLigacao(valor)}`}>
            <Icone nome="fechar" className="h-4 w-4" />Tirar
          </Botao>
        </div>
        {erro ? <span className="t-apoio text-erro">{erro}</span> : null}
      </div>
    );
  }
  if (!vePedidos && !veManutencao) return null;
  return (
    <div className="grid gap-2">
      <CampoTexto id="desp-ligacao" rotulo="Ligada a" opcional type="search" icone="busca" maxLength={60} value={busca} onChange={(e) => setBusca(e.target.value)}
        ajuda="Uma coisa só: o pedido, a manutenção ou a decisão. Busque pelo protocolo, o assunto ou o título." erro={erro} />
      {!procurar ? null : carregando ? <Carregando linhas={2} rotulo="Buscando…" /> : achados.length ? (
        <ul aria-label="Para ligar" className="grid max-h-60 gap-2 overflow-y-auto">
          {achados.map((x) => (
            <li key={`${x.tipo}-${x.id}`}>
              <button type="button" onClick={() => mudar({ tipo: x.tipo, id: x.id, rotulo: x.rotulo })}
                className="flex w-full items-start gap-3 rounded-[14px] border border-linha bg-superficie p-3 text-left t-texto hover:border-violeta-300">
                <Icone nome={ICONE_LIGACAO[x.tipo]} className="mt-0.5 h-4 w-4 shrink-0 text-violeta-600" />
                <span className="grid min-w-0 gap-0.5"><span className="font-medium">{textoLigacao(x)}</span>{x.sub ? <span className="t-apoio">{x.sub}</span> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio">Nada encontrado com esse texto.</p>}
    </div>
  );
}

/** Uma escolha em rádio, no cartão (quadros 413 e 419). */
export function Escolha({ nome, valor, atual, mudar, texto, sub }: { nome: string; valor: string; atual: string; mudar: (v: string) => void; texto: string; sub?: string }) {
  const marcada = atual === valor;
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-[14px] p-4 t-texto ${marcada ? "border-2 border-violeta-600 bg-violeta-50 p-[15px]" : "border border-linha bg-superficie hover:border-violeta-300"}`}>
      <input type="radio" name={nome} value={valor} checked={marcada} onChange={() => mudar(valor)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
      <span className="grid gap-0.5"><span className="font-medium">{texto}</span>{sub ? <span className="t-apoio">{sub}</span> : null}</span>
    </label>
  );
}
