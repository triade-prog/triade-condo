"use client";
// Novo orçamento (R8, OC-01 e OC-02; quadros 472 e 473): três partes, na ordem em que se pensa:
// o que o condomínio precisa, como o fornecedor responde e quem convidar e até quando. No
// computador é uma tela só; no celular são três passos com barra de progresso, como a Nova
// manutenção. Pode nascer de uma manutenção (?manutencao=<id>) ou de um pedido. Cada convidado
// recebe um link só dele; ninguém vê o preço do outro.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { faixaDoValor, lerReais, textoRegraMinimo, TIPOS_ORCAMENTO } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { Escolha as EscolhaCartao } from "../decisoes/Despesas.tsx";
import { textoDoEnvio } from "../decisoes/anexos.tsx";
import { deDataHoraLocal, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { EscolherArquivos, subir, type ItemEnvio, type ResultadoEnvio } from "../pedidos/Arquivos.tsx";
import { useCarregar } from "../sessao.tsx";
import { convitesParaApi, EscolherConvidados, faltaNosConvidados, JanelaConvites, SEM_CONVIDADOS, totalConvidados, type Convidados } from "./Convite.tsx";
import type { LinkConvite, OpcoesOrcamento } from "./tipos.ts";

const PARTES = ["O que o condomínio precisa", "Serviço ou lista de itens", "Quem convidar e até quando"] as const;
const PARTES_CELULAR = ["O que precisa", "Como responder", "Quem convidar"] as const;
type Passo = 1 | 2 | 3;
const PASSO_DO_CAMPO: Record<string, Passo> = { titulo: 1, descricao: 1, local: 1, manutencaoId: 1, pedidoId: 1, valorEstimado: 1, tipo: 2, convites: 3, prazoPropostas: 3, validadeMinimaDias: 3 };

function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`oc-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h2 id={`oc-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h2>
      </div>
      {children}
    </section>
  );
}

/** Sobe os arquivos do pedido um a um: pede o lugar, sobe e pede a verificação. */
async function enviarArquivosDoOrcamento(id: string, itens: ItemEnvio[]): Promise<ResultadoEnvio[]> {
  const r: ResultadoEnvio[] = [];
  for (const it of itens.filter((i) => !i.problema)) {
    const nome = it.arquivo.name;
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(`/v1/condominio/orcamentos/${id}/anexos`, { corpo: { nome, tipo: it.arquivo.type, tamanho: it.arquivo.size } });
    if (!inicio.ok) { r.push({ nome, liberado: false, motivo: textoDoErro(inicio.erro) }); continue; }
    await subir(inicio.dados.envio.url, it.arquivo, inicio.dados.envio.tipo, () => {});
    const fim = await chamarApi<{ situacao: string; motivo?: string }>(`/v1/condominio/orcamentos/anexos/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
    if (!fim.ok) { r.push({ nome, liberado: false, motivo: textoDoErro(fim.erro) }); continue; }
    r.push(fim.dados.situacao === "LIBERADO" ? { nome, liberado: true } : { nome, liberado: false, motivo: fim.dados.motivo ?? "O arquivo não foi liberado." });
  }
  return r;
}

/** Daqui a n dias, às 18h, no fuso de quem usa: o prazo que já vem escrito. */
function prazoPadrao(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(18, 0, 0, 0);
  return paraDataHoraLocal(d.toISOString());
}

export function NovoOrcamento() {
  const opcoes = useCarregar<OpcoesOrcamento>("/v1/condominio/orcamentos/opcoes");
  const voltar = <Link href="/orcamentos" className="inline-flex items-center gap-1.5 t-apoio font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Orçamentos</Link>;
  return (
    <div className="grid max-w-[960px] gap-4">
      {voltar}
      <div className="grid gap-1">
        <h1 className="t-titulo-tela">Novo orçamento</h1>
        <p className="t-apoio">Três partes: o que precisa, como o fornecedor responde e quem convidar.</p>
      </div>
      {opcoes.estado === "carregando" ? <Carregando rotulo="Carregando…" />
        : opcoes.estado === "erro" ? <ErroCarregar erro={opcoes.erro} texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} />
          : <Formulario o={opcoes.dados} />}
    </div>
  );
}

function Formulario({ o }: { o: OpcoesOrcamento }) {
  const busca = useSearchParams();
  const router = useRouter();
  const celular = useCelular();
  const daManutencao = o.manutencoes.find((m) => m.id === busca.get("manutencao"));
  const [v, setV] = useState({
    titulo: daManutencao?.titulo ?? "",
    descricao: "",
    origem: daManutencao ? `M:${daManutencao.id}` : busca.get("pedido") && o.pedidos.some((p) => p.id === busca.get("pedido")) ? `P:${busca.get("pedido")}` : "",
    local: daManutencao?.local ?? "",
    valorEstimado: "",
    tipo: "SERVICO" as "SERVICO" | "ITENS",
    prazo: prazoPadrao(o.regras.prazoDias),
    validade: String(o.regras.validadeDias),
  });
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [convidados, setConvidados] = useState<Convidados>(SEM_CONVIDADOS);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [faltaNoPasso, setFaltaNoPasso] = useState<string[]>([]);
  const [faltaConvidados, setFaltaConvidados] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"MANDAR" | "GUARDAR" | null>(null);
  const [passo, setPasso] = useState<Passo>(1);
  const [criado, setCriado] = useState<{ id: string; links: LinkConvite[]; recado: string } | null>(null);
  const mudar = (x: Partial<typeof v>) => { setV((y) => ({ ...y, ...x })); setFaltaNoPasso((f) => f.filter((c) => !(c in x))); };

  let estimado: number | null = null;
  let estimadoErrado = false;
  try { estimado = v.valorEstimado.trim() ? lerReais(v.valorEstimado).centavos : null; } catch { estimadoErrado = true; }
  const faixa = faixaDoValor(o.regras.faixas, estimado);
  const i = faixa ? o.regras.faixas.indexOf(faixa) : -1;
  const regra = textoRegraMinimo({ ligada: o.regras.ligada, faixa, anterior: i > 0 ? o.regras.faixas[i - 1]!.ate : null }, totalConvidados(convidados));
  const quando = (p: string) => deDataHoraLocal(p);
  const comErro = [...camposComErro(erro), ...faltaNoPasso];
  const msg = (campo: string, texto: string) => (comErro.includes(campo) ? texto : null);

  function faltasDoPasso(n: Passo): string[] {
    if (n === 1) return [v.titulo.trim().length < 3 ? "titulo" : null, v.descricao.trim().length < 3 ? "descricao" : null, estimadoErrado ? "valorEstimado" : null].filter((x): x is string => !!x);
    if (n === 3) return [!quando(v.prazo) || Date.parse(quando(v.prazo)!) <= Date.now() ? "prazoPropostas" : null, !/^\d+$/.test(v.validade) || Number(v.validade) < 1 ? "validadeMinimaDias" : null].filter((x): x is string => !!x);
    return [];
  }
  function irPara(n: Passo) {
    for (let p = passo; p < n; p++) {
      const f = faltasDoPasso(p as Passo);
      if (f.length) { setPasso(p as Passo); setFaltaNoPasso(f); return; }
    }
    setFaltaNoPasso([]);
    setPasso(n);
  }

  async function criar(mandar: boolean) {
    setErro(null);
    const faltas = [...faltasDoPasso(1), ...faltasDoPasso(3)];
    const fc = mandar ? (totalConvidados(convidados) === 0 ? "Convide pelo menos um fornecedor, ou guarde sem mandar." : faltaNosConvidados(convidados)) : faltaNosConvidados(convidados);
    setFaltaConvidados(fc);
    if (faltas.length || fc) {
      setFaltaNoPasso(faltas);
      const primeiro = faltas[0];
      setPasso(primeiro ? PASSO_DO_CAMPO[primeiro]! : 3);
      return;
    }
    setEnviando(mandar ? "MANDAR" : "GUARDAR");
    const r = await chamarApi<{ id: string; versao: number; links: LinkConvite[] }>("/v1/condominio/orcamentos", {
      corpo: {
        titulo: v.titulo.trim(), descricao: v.descricao.trim(), local: v.local.trim() || null, tipo: v.tipo,
        manutencaoId: v.origem.startsWith("M:") ? v.origem.slice(2) : null, pedidoId: v.origem.startsWith("P:") ? v.origem.slice(2) : null,
        valorEstimado: estimado, prazoPropostas: quando(v.prazo), validadeMinimaDias: Number(v.validade), convites: convitesParaApi(convidados), mandar,
      },
    });
    if (!r.ok) {
      setEnviando(null);
      setErro(r.erro);
      const primeiro = camposComErro(r.erro)[0];
      if (primeiro && PASSO_DO_CAMPO[primeiro]) setPasso(PASSO_DO_CAMPO[primeiro]!);
      return;
    }
    const anexos = itens.length ? textoDoEnvio(await enviarArquivosDoOrcamento(r.dados.id, itens)) : "";
    setEnviando(null);
    const n = r.dados.links.length;
    const recado = [mandar ? `Orçamento criado e ${n === 1 ? "1 convite mandado" : `${n} convites mandados`}.` : "Orçamento guardado sem mandar os convites.", anexos].filter(Boolean).join(" ");
    const temLink = r.dados.links.some((l) => l.envio === "COPIAR" && l.codigo);
    if (mandar && (temLink || r.dados.links.some((l) => l.envio === "EMAIL"))) setCriado({ id: r.dados.id, links: r.dados.links, recado });
    else router.push(`/orcamentos/${r.dados.id}?recado=${encodeURIComponent(recado)}`);
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (celular && passo < 3) return irPara((passo + 1) as Passo);
    void criar(true);
  }

  const resumo1 = [v.titulo.trim(), v.local.trim()].filter(Boolean).join(" · ");
  const resumo2 = TIPOS_ORCAMENTO[v.tipo];
  const opcoesOrigem = [
    { valor: "", texto: "Sem ligação" },
    ...o.manutencoes.map((m) => ({ valor: `M:${m.id}`, texto: `Manutenção · ${m.titulo}` })),
    ...o.pedidos.map((p) => ({ valor: `P:${p.id}`, texto: `Pedido ${p.numero} · ${p.titulo}` })),
  ];

  return (
    <>
      <form onSubmit={enviar} noValidate className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-4">
        <div className="grid gap-3 md:hidden">
          <p className="grid">
            <span className="t-apoio">Passo {passo} de 3</span>
            <span className="t-titulo-cartao">{PARTES_CELULAR[passo - 1]}</span>
          </p>
          <div className="passos" role="progressbar" aria-label="Passos do orçamento" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo} aria-valuetext={`Passo ${passo} de 3: ${PARTES_CELULAR[passo - 1]}`}>
            {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
          </div>
          {passo > 1 ? (
            <div className="grid gap-2">
              {([[1, resumo1], [2, resumo2]] as const).filter(([n]) => n < passo).map(([n, texto]) => (
                <button key={n} type="button" className="resumo-passo" onClick={() => setPasso(n)}>
                  <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
                  <span className="grid min-w-0 flex-1">
                    <span className="t-apoio">{PARTES_CELULAR[n - 1]}</span>
                    <span className="truncate">{texto || "Nada escolhido"}</span>
                  </span>
                  <span className="alterar">Alterar</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}

        <div className="grid">
          <Parte n={1} passo={passo}>
            <CampoTexto id="oc-titulo" rotulo="O que é" required maxLength={120} value={v.titulo} onChange={(e) => mudar({ titulo: e.target.value })}
              placeholder="Troca da bomba de recalque 2" erro={msg("titulo", "Diga o que é (3 a 120 caracteres).")} />
            <CampoAreaTexto id="oc-descricao" rotulo="O que precisa estar na proposta" required rows={4} maxLength={2000} value={v.descricao} onChange={(e) => mudar({ descricao: e.target.value })}
              ajuda="O fornecedor lê isto no link. Diga o que tem de estar incluído: é por isso que as propostas se comparam." erro={msg("descricao", "Diga o que precisa estar na proposta (3 a 2.000 caracteres).")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoSelecao id="oc-origem" rotulo="Nasceu de" opcional value={v.origem} opcoes={opcoesOrigem}
                onChange={(e) => {
                  const m = o.manutencoes.find((x) => `M:${x.id}` === e.target.value);
                  mudar({ origem: e.target.value, ...(m && !v.local.trim() ? { local: m.local ?? "" } : {}), ...(m && !v.titulo.trim() ? { titulo: m.titulo } : {}) });
                }}
                ajuda="Ou um pedido. Pode ficar sem ligação." erro={msg("manutencaoId", "Esta manutenção não existe mais.") ?? msg("pedidoId", "Este pedido não existe mais.")} />
              <CampoTexto id="oc-local" rotulo="Local" opcional maxLength={120} value={v.local} onChange={(e) => mudar({ local: e.target.value })} list="oc-locais"
                ajuda="Vem da manutenção; o fornecedor vê só o nome do local" />
              <datalist id="oc-locais">{o.locais.map((l) => <option key={l} value={l} />)}</datalist>
            </div>
            <CampoTexto id="oc-estimado" rotulo="Valor estimado" opcional inputMode="decimal" maxLength={20} value={v.valorEstimado} onChange={(e) => mudar({ valorEstimado: e.target.value })}
              ajuda="Em reais, como 6.500,00. Só para a regra do mínimo de propostas; o fornecedor não vê." erro={msg("valorEstimado", "Escreva o valor em reais, como 6.500,00.")} className="sm:max-w-[320px]" />
            <div className="grid gap-1">
              <EscolherArquivos rotulo="Fotos e arquivos para o fornecedor" opcional itens={itens} aoMudar={setItens} enviando={enviando !== null} />
              <p className="t-apoio">Só o que estiver aqui vai para o link. As fotos da manutenção não vão sozinhas.</p>
            </div>
          </Parte>

          <Parte n={2} passo={passo}>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Serviço ou lista de itens</legend>
              <EscolhaCartao nome="oc-tipo" valor="SERVICO" atual={v.tipo} mudar={() => mudar({ tipo: "SERVICO" })} texto={TIPOS_ORCAMENTO.SERVICO} sub="O fornecedor responde com um valor pelo serviço, o que inclui e o que não inclui" />
              <label className="flex items-start gap-3 rounded-[14px] border border-linha bg-superficie-2 p-4 t-texto text-tinta-suave">
                <input type="radio" name="oc-tipo" value="ITENS" disabled className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
                <span className="grid gap-0.5"><span className="font-medium">{TIPOS_ORCAMENTO.ITENS}</span><span className="t-apoio">Preço por item, com quantidades. Vem na próxima rodada.</span></span>
              </label>
            </fieldset>
            <p className="t-apoio">No serviço, cada proposta diz o total, o frete, a marca e o modelo, o prazo para fazer, a garantia, até quando o preço vale, como se paga, o que inclui e o que não inclui. É isso que a comparação põe lado a lado.</p>
          </Parte>

          <Parte n={3} passo={passo}>
            <EscolherConvidados o={o} valor={convidados} mudar={(c) => { setConvidados(c); setFaltaConvidados(null); }} erro={faltaConvidados ?? msg("convites", "Confira os convidados: o nome e o contato de cada um.")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTexto id="oc-prazo" rotulo="Propostas até" required type="datetime-local" value={v.prazo} onChange={(e) => mudar({ prazo: e.target.value })}
                ajuda="Depois disso o link fecha sozinho. Você pode estender." erro={msg("prazoPropostas", "Escolha uma data e hora daqui para a frente.")} />
              <CampoTexto id="oc-validade" rotulo="Validade mínima pedida" required inputMode="numeric" maxLength={3} value={v.validade} onChange={(e) => mudar({ validade: e.target.value })}
                ajuda="Em dias. O fornecedor diz até quando o preço vale" erro={msg("validadeMinimaDias", "Diga quantos dias, de 1 a 365.")} />
            </div>
            {regra ? <p className="t-apoio">{regra}</p> : null}
          </Parte>
        </div>

        <div className="grid gap-2 border-t border-linha pt-4 md:flex md:flex-wrap md:items-center md:justify-end">
          <p className="t-apoio md:mr-auto">Cada convidado recebe um link só dele; ninguém vê o preço do outro.</p>
          <div className="flex flex-wrap gap-2 max-md:hidden">
            <Link href="/orcamentos" className={classeBotao("discreto", enviando ? "pointer-events-none opacity-60" : "")}>Cancelar</Link>
            <Botao variante="contorno" disabled={enviando !== null} onClick={() => void criar(false)}>{enviando === "GUARDAR" ? "Guardando…" : "Guardar sem mandar"}</Botao>
            <Botao type="submit" disabled={enviando !== null}><Icone nome="enviar" />{enviando === "MANDAR" ? "Mandando…" : "Criar e mandar os convites"}</Botao>
          </div>
          <div className="grid gap-2 md:hidden">
            {passo === 1 ? (
              <>
                <Botao type="submit" className="w-full">Continuar<Icone nome="dir" /></Botao>
                <Link href="/orcamentos" className="justify-self-center t-texto font-medium text-violeta-600">Cancelar</Link>
              </>
            ) : (
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Botao variante="contorno" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao>
                {passo === 2 ? <Botao type="submit">Continuar<Icone nome="dir" /></Botao>
                  : <Botao type="submit" disabled={enviando !== null}><Icone nome="enviar" />{enviando === "MANDAR" ? "Mandando…" : "Mandar convites"}</Botao>}
              </div>
            )}
            {passo === 3 ? <Botao variante="discreto" className="w-full" disabled={enviando !== null} onClick={() => void criar(false)}>{enviando === "GUARDAR" ? "Guardando…" : "Guardar sem mandar"}</Botao> : null}
            {passo > 1 ? <p className="t-apoio text-center">O que você já preencheu fica guardado se voltar.</p> : null}
          </div>
        </div>
      </form>
      <JanelaConvites links={criado?.links ?? null} titulo={v.titulo.trim()} prazo={quando(v.prazo) ?? new Date().toISOString()}
        aoFechar={() => { if (criado) router.push(`/orcamentos/${criado.id}?recado=${encodeURIComponent(criado.recado)}`); }} />
    </>
  );
}
