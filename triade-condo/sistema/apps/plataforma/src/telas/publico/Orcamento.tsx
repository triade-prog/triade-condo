"use client";
// O link do fornecedor (R8, OC-03; quadros 476 a 478): sem conta e sem senha, só daquele
// fornecedor. Ele vê o pedido, manda a proposta (e versões novas até o prazo), diz que não vai
// participar, confirma o preço quando a validade venceu e aceita quando é escolhido. Nunca vê quem
// mais foi convidado nem o preço dos outros. Aceitar aqui não é contrato nem pagamento.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ESTADOS_LINK_ORCAMENTO, lerReais, LINK_ORCAMENTO_NAO_VALE } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Icone, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { Caixa } from "../moradores/comum.tsx";
import { ddmm, diaHoraCurta, ListaInclui, reais } from "../orcamentos/comum.tsx";
import { subir } from "../pedidos/Arquivos.tsx";
import type { OrcamentoPublico } from "../orcamentos/tipos.ts";
import { Cartao, TelaPublica, useAbrirArquivo } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: OrcamentoPublico };
const RODAPE = "Não precisa de conta nem senha. O link é só seu: não repasse.";
const PASSOS = ["Ver o pedido", "Proposta", "Pronto"] as const;
const somarDias = (data: string, n: number) => new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10)) + n)).toISOString().slice(0, 10);

function Mini({ icone, tom, titulo, children }: { icone: NomeIcone; tom: string; titulo: string; children: ReactNode }) {
  return (
    <Cartao>
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom={tom} aria-hidden="true"><Icone nome={icone} /></span>
        <div className="grid min-w-0 gap-1">
          <h2 className="t-titulo-cartao">{titulo}</h2>
          <div className="grid gap-2 t-texto">{children}</div>
        </div>
      </div>
    </Cartao>
  );
}

function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <div className="grid gap-2 px-1">
      <p className="grid"><span className="t-apoio">Passo {atual} de 3</span><span className="t-titulo-cartao">{PASSOS[atual - 1]}</span></p>
      <div className="passos" role="progressbar" aria-label="Passos da proposta" aria-valuemin={1} aria-valuemax={3} aria-valuenow={atual} aria-valuetext={`Passo ${atual} de 3: ${PASSOS[atual - 1]}`}>
        {[1, 2, 3].map((n) => <span key={n} data-feito={n <= atual ? "" : undefined} />)}
      </div>
      <ol className="flex justify-between t-apoio" aria-hidden="true">{PASSOS.map((p, i) => <li key={p} className={i + 1 === atual ? "font-semibold text-violeta-700" : ""}>{p}</li>)}</ol>
    </div>
  );
}

export function OrcamentoLink() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/orcamento/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [tela, setTela] = useState<"ver" | "proposta" | "recusar" | "confirmar">("ver");
  const [recado, setRecado] = useState<string | null>(null);
  const carregar = useCallback(() => {
    void chamarApi<OrcamentoPublico>(base).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao condomínio." : textoDoErro(r.erro) });
    });
  }, [base]);
  useEffect(carregar, [carregar]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Pedido de orçamento" icone="carrinho" rodape={RODAPE}><Carregando rotulo="Abrindo…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Pedido de orçamento" icone="carrinho" rodape={RODAPE}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const d = carga.dados;
  const p = d.pedido;
  const prazoAberto = p ? Date.parse(p.prazoPropostas) > new Date().getTime() : false;
  const pronto = (dados: OrcamentoPublico, texto: string) => { setCarga({ estado: "pronto", dados }); setTela("ver"); setRecado(texto); window.scrollTo({ top: 0 }); };
  const passo: 1 | 2 | 3 | null = d.estado === "VER" ? (tela === "proposta" ? 2 : 1) : d.estado === "ENVIADA" || d.estado === "CONFIRMAR_PRECO" ? (tela === "proposta" ? 2 : 3) : null;

  return (
    <TelaPublica titulo={d.condominio} subtitulo={`Pedido de orçamento para ${d.fornecedor.nome}`} icone="carrinho" rodape={RODAPE}>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {passo ? <Passos atual={passo} /> : null}
      {d.estado === "NAO_VALE" ? (
        <Mini icone="fechar" tom="erro" titulo={d.motivo === "REVOGADO" ? "Este link foi cancelado pelo condomínio" : ESTADOS_LINK_ORCAMENTO.NAO_VALE}>
          <p>{d.motivo ? `${LINK_ORCAMENTO_NAO_VALE[d.motivo]} ` : ""}Ele não abre mais. Se recebeu um link novo, use o novo.</p>
        </Mini>
      ) : d.estado === "CANCELADO" ? (
        <Mini icone="fechar" tom="neutro" titulo={ESTADOS_LINK_ORCAMENTO.CANCELADO}>
          <p>Obrigado por participar. {d.mensagens.join(" ")}</p>
        </Mini>
      ) : d.estado === "PRAZO_ACABOU" ? (
        <Mini icone="relogio" tom="atencao" titulo={ESTADOS_LINK_ORCAMENTO.PRAZO_ACABOU}>
          <p>Este pedido fechou em {p ? diaHoraCurta(p.prazoPropostas) : "o prazo"}. Fale com o condomínio se ainda quiser participar.</p>
        </Mini>
      ) : d.estado === "RECUSOU" ? (
        <Mini icone="check" tom="neutro" titulo={ESTADOS_LINK_ORCAMENTO.RECUSOU}>
          <p>Obrigado por avisar. O condomínio fica sabendo e não manda lembrete.</p>
        </Mini>
      ) : d.estado === "NAO_ESCOLHIDA" ? (
        <Mini icone="info" tom="neutro" titulo={ESTADOS_LINK_ORCAMENTO.NAO_ESCOLHIDA}>
          <p>Obrigado por participar. Você não vê qual foi a escolhida nem o preço dela.</p>
        </Mini>
      ) : d.estado === "ACEITA" ? (
        <>
          <Mini icone="check" tom="ok" titulo={ESTADOS_LINK_ORCAMENTO.ACEITA}>
            <p>{d.aceite ? `${d.aceite.nome} aceitou em ${ddmm(d.aceite.em.slice(0, 10))}.` : ""} O condomínio registra a compra e combina o resto com você. Aceitar aqui não é contrato nem pagamento.</p>
          </Mini>
          {d.proposta ? <ResumoProposta d={d} /> : null}
        </>
      ) : d.estado === "ESCOLHIDA" ? (
        <>
          <Mini icone="estrela" tom="ok" titulo={ESTADOS_LINK_ORCAMENTO.ESCOLHIDA}>
            <p>Confirme se aceita fazer o serviço nas condições da sua proposta. Aceitar aqui não é contrato nem pagamento.</p>
          </Mini>
          {d.proposta ? <ResumoProposta d={d} /> : null}
          <FormAceite base={base} fornecedor={d.fornecedor.nome} pronto={pronto} />
        </>
      ) : d.estado === "CONFIRMAR_PRECO" && d.proposta ? (
        tela === "proposta" ? <FormProposta d={d} base={base} pronto={pronto} voltar={() => setTela("ver")} />
          : (
            <>
              <Mini icone="relogio" tom="atencao" titulo={ESTADOS_LINK_ORCAMENTO.CONFIRMAR_PRECO}>
                <p>Sua proposta venceu em {ddmm(d.proposta.validaAte)}. Confirme se {reais(d.proposta.total)} continua valendo, ou mande um preço novo.</p>
              </Mini>
              <FormConfirmar d={d} base={base} pronto={pronto} precoNovo={() => setTela("proposta")} />
              <ResumoProposta d={d} />
            </>
          )
      ) : d.estado === "ENVIADA" && d.proposta ? (
        tela === "proposta" ? <FormProposta d={d} base={base} pronto={pronto} voltar={() => setTela("ver")} />
          : (
            <>
              <Mini icone="check" tom="ok" titulo={`${ESTADOS_LINK_ORCAMENTO.ENVIADA} · versão ${d.proposta.numero}`}>
                <p>O síndico do {d.condominio} recebeu sua proposta de {reais(d.proposta.total)}. Você recebe a resposta por aqui e pelo WhatsApp.</p>
                {d.mensagens.map((m) => <p key={m} className="t-apoio">{m}</p>)}
              </Mini>
              {prazoAberto && p ? (
                <Cartao>
                  <h2 className="t-texto font-medium">Mandar uma versão nova</h2>
                  <p className="t-apoio">Até {diaHoraCurta(p.prazoPropostas)}. A versão {d.proposta.numero} continua guardada; o síndico vê as duas.</p>
                  <Botao variante="contorno" className="justify-self-start" onClick={() => setTela("proposta")}><Icone nome="editar" />Mandar uma versão nova</Botao>
                </Cartao>
              ) : null}
              <ResumoProposta d={d} />
              {p ? <Pedido d={d} base={base} /> : null}
            </>
          )
      ) : p ? (
        tela === "proposta" ? <FormProposta d={d} base={base} pronto={pronto} voltar={() => setTela("ver")} />
          : tela === "recusar" ? <FormRecusa base={base} pronto={pronto} voltar={() => setTela("ver")} />
            : (
              <>
                <Pedido d={d} base={base} />
                <p className="flex items-start gap-2 px-1 t-apoio"><Icone nome="cadeado" className="mt-0.5 h-4 w-4 shrink-0 text-violeta-600" />Você vê só a sua proposta. Ninguém mais vê o seu preço, e você não vê o dos outros.</p>
                <div className="grid gap-2">
                  <Botao className="w-full" onClick={() => setTela("proposta")}><Icone nome="enviar" />Fazer minha proposta</Botao>
                  <Botao variante="discreto" className="w-full" onClick={() => setTela("recusar")}>Não vou participar</Botao>
                </div>
              </>
            )
      ) : <Aviso tom="atencao">{ESTADOS_LINK_ORCAMENTO[d.estado]}</Aviso>}
    </TelaPublica>
  );
}

/** O pedido como o fornecedor lê: o que precisa, o local, o prazo e os arquivos. */
function Pedido({ d, base }: { d: OrcamentoPublico; base: string }) {
  const p = d.pedido!;
  const { falha, abrir } = useAbrirArquivo((a) => `${base}/arquivos/${a}`);
  return (
    <Cartao className="gap-3">
      <h2 className="t-titulo-secao font-medium">{p.titulo}</h2>
      {p.editadoEm ? <Aviso tom="info">O condomínio alterou o pedido. Confira o que precisa antes de mandar.</Aviso> : null}
      <div className="t-texto leading-relaxed whitespace-pre-line">{p.descricao}</div>
      <dl className="grid gap-2 sm:grid-cols-3">
        {p.local ? <div className="grid gap-0.5"><dt className="t-apoio">Local</dt><dd className="t-texto font-medium">{p.local}</dd></div> : null}
        <div className="grid gap-0.5"><dt className="t-apoio">Propostas até</dt><dd className="t-texto font-medium">{diaHoraCurta(p.prazoPropostas)}</dd></div>
        <div className="grid gap-0.5"><dt className="t-apoio">Preço válido por</dt><dd className="t-texto font-medium">pelo menos {p.validadeMinimaDias} dias</dd></div>
      </dl>
      {p.arquivos.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos e arquivos do pedido">
          {p.arquivos.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => void abrir(a.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-linha px-3 py-2 t-texto font-medium text-violeta-600 hover:underline">
                <Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} className="h-4 w-4" />{a.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
    </Cartao>
  );
}

/** A proposta que o fornecedor mandou, como ficou. */
function ResumoProposta({ d }: { d: OrcamentoPublico }) {
  const p = d.proposta!;
  return (
    <Cartao className="gap-3">
      <h2 className="t-texto font-medium">Sua proposta · versão {p.numero}</h2>
      <dl className="grid gap-2 sm:grid-cols-2">
        {([["Total", p.freteIncluso ? `${reais(p.total)} · frete incluso` : `${reais(p.total)} (${reais(p.valor)} + frete ${reais(p.frete)})`], ["Marca e modelo", p.marcaModelo ?? "—"],
          ["Prazo para fazer", p.prazoExecucao], ["Garantia", p.garantia ?? "—"], ["Preço vale até", `${ddmm(p.validaAte)}${p.vencida ? " · venceu" : ""}${p.confirmadaEm ? " · confirmado" : ""}`], ["Pagamento", p.pagamento ?? "—"]] as const).map(([n, t]) => (
          <div key={n} className="grid gap-0.5"><dt className="t-apoio">{n}</dt><dd className="t-texto">{t}</dd></div>
        ))}
        <div className="grid gap-0.5"><dt className="t-apoio">Inclui</dt><dd className="t-texto"><ListaInclui texto={p.inclui ?? null} /></dd></div>
        <div className="grid gap-0.5"><dt className="t-apoio">Não inclui</dt><dd className="t-texto">{p.naoInclui ? <ListaInclui texto={p.naoInclui} tom="atencao" /> : <span className="t-apoio">Nada fora do pedido</span>}</dd></div>
        {p.pdf ? <div className="grid gap-0.5 sm:col-span-2"><dt className="t-apoio">Arquivo</dt><dd className="t-texto">{p.pdf.nome}</dd></div> : null}
      </dl>
    </Cartao>
  );
}

const CAMPOS = ["valor", "frete", "marcaModelo", "prazoExecucao", "garantia", "validaAte", "pagamento", "inclui", "naoInclui"];

/** Fazer minha proposta (quadro 477): preço, o que inclui e o PDF opcional. Uma versão nova entra do mesmo jeito. */
function FormProposta({ d, base, pronto, voltar }: { d: OrcamentoPublico; base: string; pronto: (x: OrcamentoPublico, t: string) => void; voltar: () => void }) {
  const p = d.pedido!;
  const antes = d.proposta;
  const noCampo = (c: number) => reais(c).replace(/^R\$\s?/, "");
  const [v, setV] = useState({
    valor: antes ? noCampo(antes.valor) : "", freteIncluso: antes ? antes.freteIncluso : true, frete: antes && !antes.freteIncluso ? noCampo(antes.frete) : "",
    marcaModelo: antes?.marcaModelo ?? "", prazoExecucao: antes?.prazoExecucao ?? "", garantia: antes?.garantia ?? "",
    validaAte: somarDias(d.hoje, p.validadeMinimaDias), pagamento: antes?.pagamento ?? "", inclui: antes?.inclui ?? "", naoInclui: antes?.naoInclui ?? "",
  });
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfRecusado, setPdfRecusado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [faltas, setFaltas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const comErro = [...camposComErro(erro), ...faltas];
  const mudar = (x: Partial<typeof v>) => { setV((y) => ({ ...y, ...x })); setFaltas((f) => f.filter((c) => !(c in x))); };
  const centavos = (t: string): number | null => { try { return t.trim() ? lerReais(t).centavos : null; } catch { return null; } };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const valor = centavos(v.valor);
    const frete = v.freteIncluso ? 0 : centavos(v.frete);
    const f = [valor === null || valor <= 0 ? "valor" : null, !v.freteIncluso && (frete === null || frete < 0) ? "frete" : null, v.prazoExecucao.trim() ? null : "prazoExecucao",
      !v.validaAte || v.validaAte < d.hoje ? "validaAte" : null, v.inclui.trim().length < 3 ? "inclui" : null].filter((x): x is string => !!x);
    setFaltas(f);
    if (f.length) return;
    setEnviando(true);
    let pdfArquivoId: string | null = null;
    if (pdf) {
      const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(`${base}/pdf`, { corpo: { nome: pdf.name, tipo: pdf.type, tamanho: pdf.size } });
      if (!inicio.ok) { setEnviando(false); return setErro(inicio.erro); }
      await subir(inicio.dados.envio.url, pdf, inicio.dados.envio.tipo, () => {});
      const fim = await chamarApi<{ situacao: string }>(`${base}/pdf/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
      if (!fim.ok) { setEnviando(false); return setErro(fim.erro); }
      if (fim.dados.situacao !== "LIBERADO") { setEnviando(false); return setPdfRecusado(true); }
      pdfArquivoId = inicio.dados.arquivoId;
    }
    const r = await chamarApi<OrcamentoPublico & { numero: number }>(`${base}/proposta`, {
      corpo: { valor, frete, freteIncluso: v.freteIncluso, marcaModelo: v.marcaModelo.trim() || null, prazoExecucao: v.prazoExecucao.trim(), garantia: v.garantia.trim() || null,
        validaAte: v.validaAte, pagamento: v.pagamento.trim() || null, inclui: v.inclui.trim(), naoInclui: v.naoInclui.trim() || null, pdfArquivoId },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, r.dados.numero > 1 ? `Versão ${r.dados.numero} enviada. A anterior continua guardada.` : "Proposta enviada. Obrigado.");
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !CAMPOS.some((c) => comErro.includes(c)) ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {pdfRecusado ? <Aviso tom="atencao">O PDF não foi aceito. Mande sem ele ou tente outro arquivo.</Aviso> : null}
      <Cartao className="gap-3">
        <h2 className="t-texto font-medium">{antes ? `Versão nova da proposta para ${p.titulo}` : `Proposta para ${p.titulo}`}</h2>
        <fieldset className="grid gap-3">
          <legend className="t-rotulo pb-1">Preço</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto id="prop-valor" rotulo="Valor do serviço" required inputMode="decimal" maxLength={20} value={v.valor} onChange={(e) => mudar({ valor: e.target.value })} ajuda="Em reais, como 6.480,00." erro={comErro.includes("valor") ? "Escreva o valor em reais, como 6.480,00." : null} />
            <div className="grid content-start gap-1">
              <CampoTexto id="prop-frete" rotulo="Frete" inputMode="decimal" maxLength={20} value={v.freteIncluso ? "" : v.frete} disabled={v.freteIncluso} onChange={(e) => mudar({ frete: e.target.value })} erro={comErro.includes("frete") ? "Escreva o frete em reais, ou marque Incluso." : null} />
              <Caixa id="prop-frete-incluso" rotulo="Incluso" marcada={v.freteIncluso} aoMudar={(x) => mudar({ freteIncluso: x })} />
            </div>
          </div>
          <CampoTexto id="prop-marca" rotulo="Marca e modelo" opcional maxLength={120} value={v.marcaModelo} onChange={(e) => mudar({ marcaModelo: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto id="prop-prazo" rotulo="Prazo para fazer" required maxLength={60} value={v.prazoExecucao} onChange={(e) => mudar({ prazoExecucao: e.target.value })} placeholder="5 dias úteis" erro={comErro.includes("prazoExecucao") ? "Diga o prazo, como 5 dias úteis." : null} />
            <CampoTexto id="prop-garantia" rotulo="Garantia" opcional maxLength={60} value={v.garantia} onChange={(e) => mudar({ garantia: e.target.value })} placeholder="12 meses" />
            <CampoTexto id="prop-vale" rotulo="Preço vale até" required type="date" min={d.hoje} value={v.validaAte} onChange={(e) => mudar({ validaAte: e.target.value })} ajuda={`O condomínio pede pelo menos ${p.validadeMinimaDias} dias.`} erro={comErro.includes("validaAte") ? "Escolha uma data de hoje em diante." : null} />
            <CampoTexto id="prop-pagamento" rotulo="Pagamento" opcional maxLength={120} value={v.pagamento} onChange={(e) => mudar({ pagamento: e.target.value })} placeholder="À vista, na entrega" />
          </div>
        </fieldset>
      </Cartao>
      <Cartao className="gap-3">
        <fieldset className="grid gap-3">
          <legend className="t-rotulo pb-1">O que está incluído</legend>
          <CampoAreaTexto id="prop-inclui" rotulo="Inclui" required rows={4} maxLength={2000} value={v.inclui} onChange={(e) => mudar({ inclui: e.target.value })} ajuda="Um item por linha. É isso que o condomínio compara com o que pediu." erro={comErro.includes("inclui") ? "Diga o que a proposta inclui." : null} />
          <CampoAreaTexto id="prop-nao-inclui" rotulo="Não inclui" opcional rows={3} maxLength={2000} value={v.naoInclui} onChange={(e) => mudar({ naoInclui: e.target.value })} ajuda="O que fica fora ou custa à parte." />
        </fieldset>
        <div className="grid gap-1">
          <label htmlFor="prop-pdf" className="t-apoio font-medium">Sua proposta em PDF (opcional)</label>
          <input id="prop-pdf" type="file" accept="application/pdf" className="t-texto" onChange={(e) => { setPdf(e.target.files?.[0] ?? null); setPdfRecusado(false); }} />
          <span className="t-apoio">Só PDF, até 10 MB. O condomínio vê o arquivo junto com os campos.</span>
        </div>
      </Cartao>
      <div className="grid gap-2">
        <Botao type="submit" className="w-full" disabled={enviando}><Icone nome="enviar" />{enviando ? "Mandando…" : "Mandar proposta"}</Botao>
        <Botao variante="discreto" className="w-full" onClick={voltar} disabled={enviando}><Icone nome="esq" />Voltar</Botao>
      </div>
    </form>
  );
}

/** Não vou participar (quadro 476): o motivo é opcional; a recusa conta como resposta. */
function FormRecusa({ base, pronto, voltar }: { base: string; pronto: (x: OrcamentoPublico, t: string) => void; voltar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi<OrcamentoPublico>(`${base}/recusar`, { corpo: { motivo: motivo.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, "Avisado. O condomínio fica sabendo e não manda lembrete.");
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <Cartao className="gap-3">
        <h2 className="t-texto font-medium">Não vou participar</h2>
        <CampoAreaTexto id="recusa-motivo" rotulo="Motivo" opcional rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} ajuda="Se não for participar, diga o motivo (opcional). O síndico fica sabendo e não manda lembrete." />
      </Cartao>
      <div className="grid gap-2">
        <Botao type="submit" variante="secundario" className="w-full" disabled={enviando}>{enviando ? "Avisando…" : "Confirmar que não vou participar"}</Botao>
        <Botao variante="discreto" className="w-full" onClick={voltar} disabled={enviando}><Icone nome="esq" />Voltar</Botao>
      </div>
    </form>
  );
}

/** Confirmar o preço (quadro 478): a validade nova; ou um preço novo, que entra como versão. */
function FormConfirmar({ d, base, pronto, precoNovo }: { d: OrcamentoPublico; base: string; pronto: (x: OrcamentoPublico, t: string) => void; precoNovo: () => void }) {
  const [validaAte, setValidaAte] = useState(somarDias(d.hoje, d.pedido?.validadeMinimaDias ?? 15));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi<OrcamentoPublico>(`${base}/confirmar-preco`, { corpo: { validaAte } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, `Preço confirmado até ${ddmm(validaAte)}. O condomínio já sabe.`);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <Cartao className="gap-3">
        <CampoTexto id="confirmar-vale" rotulo="O preço vale até" required type="date" min={d.hoje} value={validaAte} onChange={(e) => setValidaAte(e.target.value)} erro={camposComErro(erro).includes("validaAte") ? "Escolha uma data de hoje em diante." : null} />
      </Cartao>
      <div className="grid gap-2">
        <Botao type="submit" className="w-full" disabled={enviando}><Icone nome="check" />{enviando ? "Confirmando…" : `Confirmar ${reais(d.proposta!.total)}`}</Botao>
        <Botao variante="contorno" className="w-full" onClick={precoNovo} disabled={enviando}><Icone nome="editar" />Mandar um preço novo</Botao>
      </div>
    </form>
  );
}

/** Aceitar (quadro 478): o nome de quem aceita. Não é contrato nem pagamento. */
function FormAceite({ base, fornecedor, pronto }: { base: string; fornecedor: string; pronto: (x: OrcamentoPublico, t: string) => void }) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [curto, setCurto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (nome.trim().length < 2) { setCurto(true); return; }
    setCurto(false);
    setEnviando(true);
    const r = await chamarApi<OrcamentoPublico>(`${base}/aceitar`, { corpo: { nome: nome.trim() } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, "Aceite registrado. O condomínio combina o resto com você.");
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      {erro && !camposComErro(erro).includes("nome") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <Cartao className="gap-3">
        <CampoTexto id="aceite-nome" rotulo="Quem aceita" required maxLength={120} value={nome} onChange={(e) => { setNome(e.target.value); setCurto(false); }} ajuda={`Seu nome, pela ${fornecedor}.`} erro={curto || camposComErro(erro).includes("nome") ? "Escreva o seu nome (2 a 120 caracteres)." : null} />
      </Cartao>
      <Botao type="submit" className="w-full" disabled={enviando}><Icone nome="check" />{enviando ? "Confirmando…" : "Aceito fazer o serviço"}</Botao>
    </form>
  );
}
