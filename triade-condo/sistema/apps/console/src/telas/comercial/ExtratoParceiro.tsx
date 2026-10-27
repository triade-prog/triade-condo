"use client";
// O parceiro e o extrato do mês (quadro 339, CM-22, O.1): cada prédio que virou cliente, desde
// quando, a mensalidade e a comissão; o total, o que foi pago e a diferença. O extrato sai em PDF.
// Marcar como pago e "deixou de ser cliente" são da Administração; indicar é do Comercial. Apagar
// o contato (LGPD) deixa os valores e tira o nome da origem dos interessados.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatarWhatsapp, mesComercialSchema, TEXTO_PAGAMENTO_FORA, type EtapaComercial } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, type ErroApi } from "@triade/ui";
import { CabecaPagina, Cartao, MenuAcoes, plural, Voltar, type ItemMenu } from "../comum.tsx";
import { campoDosCentavos, centavosDoCampo, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import { hojeLocal, SeloEtapa } from "./comum.tsx";
import { reais, textoMes } from "./painel.ts";
import {
  documentoExtrato, linhasRegra, mesCurto, nomeSituacaoComissao, nomeTipo, ROTAS_PARCEIROS, TELAS_PARCEIROS, textoComissaoLinha, textoPagamento, tituloColunaComissao,
  type ExtratoParceiro as Extrato, type LinhaExtrato,
} from "./parceiros.ts";
import { JanelaIndicar, JanelaParceiro, mesesParceiros } from "./Parceiros.tsx";

const dataCurta = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

/** "Marcar como pago": o valor pago fora do sistema, a data e uma observação (um por mês). */
function JanelaPagamento({ e, aoFechar, feito }: { e: Extrato; aoFechar: () => void; feito: () => void }) {
  const hoje = hojeLocal();
  const [valor, setValor] = useState(campoDosCentavos(e.total));
  const [pagoEm, setPagoEm] = useState(hoje);
  const [obs, setObs] = useState("");
  const [falha, setFalha] = useState<string | undefined>();
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const v = valor.trim() === "0" || valor.trim() === "0,00" ? { centavos: 0 } : centavosDoCampo(valor);
    if ("erro" in v || v.centavos === null) return setFalha("erro" in v ? v.erro : "Informe o valor pago.");
    setFalha(undefined);
    setEnviando(true);
    const r = await chamarApi(ROTAS_PARCEIROS.pagamentos(e.parceiro.id), { corpo: { mes: e.mes, valor: v.centavos, pagoEm, observacao: obs.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Pagamento de ${textoMes(e.mes)}`} aoFechar={aoFechar} media apoio={TEXTO_PAGAMENTO_FORA}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">{`Calculado hoje: ${reais(e.total)}.`}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="pagamento-valor" rotulo="Valor pago (R$)" inputMode="decimal" maxLength={14} value={valor} onChange={(x) => setValor(x.target.value)}
            erro={falha ?? (campos.includes("valor") ? "Informe o valor pago." : undefined)} />
          <CampoTexto id="pagamento-data" rotulo="Pago em" type="date" min={`${e.mes}-01`} max={hoje} value={pagoEm} onChange={(x) => setPagoEm(x.target.value)}
            erro={campos.includes("pagoEm") ? "A data do pagamento vai do mês até hoje." : undefined} />
        </div>
        <CampoAreaTexto id="pagamento-obs" rotulo="Observação" opcional maxLength={300} rows={2} value={obs} onChange={(x) => setObs(x.target.value)}
          ajuda="Pix, transferência, comprovante." erro={campos.includes("observacao") ? "Observação de 2 a 300 letras." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Marcar como pago" />
      </form>
    </Dialogo>
  );
}

/** "O prédio deixou de ser cliente": sem comissão desde o mês informado (até a R17.7 ligar isso ao cancelamento). */
function JanelaEncerrar({ l, mes, aoFechar, feito }: { l: LinhaExtrato; mes: string; aoFechar: () => void; feito: () => void }) {
  const [desde, setDesde] = useState(mes < l.desde.slice(0, 7) ? l.desde.slice(0, 7) : mes);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_PARCEIROS.encerrar(l.comissaoId), { corpo: { versao: l.versao, desde, motivo: motivo.trim() } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`${l.condominio} deixou de ser cliente`} aoFechar={aoFechar} media
      apoio="Sem comissão a partir do mês informado. Os meses de antes ficam como estão.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoTexto id="encerrar-desde" rotulo="Sem comissão desde" type="month" min={l.desde.slice(0, 7)} value={desde} onChange={(x) => setDesde(x.target.value)}
          erro={campos.includes("desde") ? "O mês vai do início da comissão em diante." : undefined} />
        <CampoAreaTexto id="encerrar-motivo" rotulo="Por que saiu" maxLength={300} rows={2} value={motivo} onChange={(x) => setMotivo(x.target.value)}
          erro={campos.includes("motivo") ? "Diga por que o prédio saiu." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Encerrar a comissão" perigo />
      </form>
    </Dialogo>
  );
}

function JanelaApagar({ e, aoFechar, feito }: { e: Extrato; aoFechar: () => void; feito: () => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function apagar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_PARCEIROS.apagar(e.parceiro.id), { corpo: {} });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }
  return (
    <Dialogo aberto titulo="Apagar o contato do parceiro" aoFechar={aoFechar} media
      apoio="LGPD: saem o nome, o WhatsApp, o e-mail, o CNPJ e a observação. Ficam o tipo, as comissões, os pagamentos e as indicações, com a origem “Parceiro (dado apagado)”.">
      <form onSubmit={apagar} className="grid gap-4" noValidate>
        <Aviso tom="atencao">Não dá para desfazer. O parceiro fica inativo.</Aviso>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Apagar o contato" icone="lixeira" perigo />
      </form>
    </Dialogo>
  );
}

export function ExtratoParceiro() {
  const { id } = useParams<{ id: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const sessao = useSessao();
  const atual = hojeLocal().slice(0, 7);
  const pedido = busca.get("mes");
  const mes = pedido && mesComercialSchema.safeParse(pedido).success && pedido <= atual ? pedido : null;
  const carga = useCarregar<Extrato>(ROTAS_PARCEIROS.extrato(id, mes));
  const [janela, setJanela] = useState<{ tipo: "editar" | "indicar" | "pagar" | "apagar" } | { tipo: "encerrar"; l: LinhaExtrato } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const e = carga.estado === "pronto" ? carga.dados : null;
  const podeEditar = sessao.acoes.includes("console.comercial.editar");
  const podeApagar = sessao.acoes.includes("console.comercial.excluir");
  const mostrado = e?.mes ?? mes ?? atual;
  const fechar = (texto?: string) => { setJanela(null); if (texto) { setAviso(texto); carga.recarregar(); } };

  async function baixar() {
    if (!e) return;
    setProblema(null);
    setBaixando(true);
    try {
      const { baixarPdf } = await import("./pdf.ts");
      await baixarPdf(documentoExtrato(e));
    } catch {
      setProblema("Não deu para montar o PDF. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  }

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo o extrato…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href={TELAS_PARCEIROS.lista} texto="Parceiros" />
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }
  const x = e!;
  const p = x.parceiro;
  const mais: ItemMenu[] = [
    ...(podeEditar && !p.anonimizado ? [{ texto: "Editar o cadastro", icone: "editar" as const, acao: () => setJanela({ tipo: "editar" }) }] : []),
    ...(podeApagar && !p.anonimizado ? [{ texto: "Apagar o contato (LGPD)", icone: "lixeira" as const, acao: () => setJanela({ tipo: "apagar" }) }] : []),
  ];
  const coluna = tituloColunaComissao(x);
  const mesComecou = x.mes <= atual;

  return (
    <div className="grid gap-5">
      <Voltar href={mes ? `${TELAS_PARCEIROS.lista}?mes=${mes}` : TELAS_PARCEIROS.lista} texto="Parceiros" />
      <CabecaPagina titulo={p.nome}
        apoio={`${nomeTipo(p.tipo)} · ${plural(x.indicacoes.length, "indicação", "indicações")}${p.ativo ? "" : p.anonimizado ? " · contato apagado (LGPD)" : " · inativo"}`}
        acao={(
          <div className="flex flex-wrap items-end gap-2 max-md:w-full">
            <CampoSelecao id="extrato-mes" rotulo="Mês" icone="calendario" className="min-w-[200px] max-md:w-full" value={mostrado} opcoes={mesesParceiros(atual)}
              onChange={(ev) => router.replace(TELAS_PARCEIROS.parceiro(id, ev.target.value === atual ? null : ev.target.value), { scroll: false })} />
            {podeEditar && p.ativo ? <Botao className="max-md:w-full" onClick={() => setJanela({ tipo: "indicar" })}><Icone nome="mais" />Indicar um condomínio</Botao> : null}
            <MenuAcoes rotulo="Mais ações do parceiro" texto="Mais" itens={mais} />
          </div>
        )} />
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {problema ? <Aviso tom="erro" papel="alert">{problema}</Aviso> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Cartao id="extrato-mes-titulo" titulo={`Extrato de ${textoMes(x.mes)}`} icone="documento"
          acao={<Botao variante="contorno" disabled={baixando} onClick={() => void baixar()}><Icone nome="baixar" />{baixando ? "Montando o PDF…" : "Baixar o extrato"}</Botao>}>
          {x.linhas.length ? (
            <ul className="divide-y divide-linha" aria-label={`Prédios do extrato de ${textoMes(x.mes)}`}>
              {x.linhas.map((l) => (
                <li key={l.comissaoId} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_88px_110px_130px] md:items-center md:gap-3">
                  <span className="grid gap-0.5">
                    <Link href={`/comercial/${l.interessadoId}`} className="font-medium hover:text-violeta-600 hover:underline [overflow-wrap:anywhere]">{l.condominio}</Link>
                    {l.situacao !== "ATIVA" ? <span><Selo tom="neutro">{nomeSituacaoComissao(l.situacao)}</Selo></span> : null}
                    {x.podeComissao && (l.situacao === "ATIVA" || l.situacao === "AINDA_NAO") && !l.semComissaoDesde ? (
                      <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setJanela({ tipo: "encerrar", l })}>
                        Deixou de ser cliente
                      </Botao>
                    ) : null}
                  </span>
                  <span className="t-apoio"><span className="md:sr-only">Desde </span>{mesCurto(l.desde)}</span>
                  <span className="tabular-nums md:text-right"><span className="t-apoio md:sr-only">Mensalidade </span>{reais(l.mensalidade)}</span>
                  <span className="font-semibold tabular-nums md:text-right"><span className="t-apoio font-normal md:sr-only">{`${coluna}: `}</span>{textoComissaoLinha(l)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="t-apoio">Nenhum prédio indicado por este parceiro era cliente neste mês.</p>}
          <div className="flex justify-between border-t border-linha pt-3 t-texto">
            <span>Total do mês</span><b className="tabular-nums">{reais(x.total)}</b>
          </div>
          <p className={`t-apoio ${x.diferenca ? "text-atencao" : ""}`}>{textoPagamento(x)}</p>
          {x.podeComissao && !x.pago && mesComecou ? (
            <Botao variante="secundario" className="justify-self-start max-md:w-full" onClick={() => setJanela({ tipo: "pagar" })}><Icone nome="check" />Marcar como pago</Botao>
          ) : null}
          {x.pago?.observacao ? <p className="t-apoio">{`Observação: ${x.pago.observacao}`}</p> : null}
        </Cartao>

        <div className="grid content-start gap-5">
          <Cartao id="extrato-regra" titulo="Regra da comissão" icone="dinheiro">
            <dl className="grid gap-2">
              {linhasRegra(x.regra).map(([k, v]) => (
                <div key={k} className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">{k}</dt><dd className="t-texto">{v}</dd></div>
              ))}
            </dl>
            <p className="t-apoio">Cada prédio fica com o percentual e o prazo do dia em que virou cliente.</p>
          </Cartao>
          <Cartao id="extrato-contato" titulo="Contato" icone="pessoa">
            {p.anonimizado ? <p className="t-apoio">Contato apagado (LGPD). Ficam os valores e as indicações.</p> : (
              <dl className="grid gap-2 t-texto">
                <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">WhatsApp</dt><dd>{p.whatsapp ? formatarWhatsapp(p.whatsapp) : "Não informado"}</dd></div>
                <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">E-mail</dt><dd className="[overflow-wrap:anywhere]">{p.email ?? "Não informado"}</dd></div>
                {p.cnpj ? <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">CNPJ</dt><dd>{p.cnpj}</dd></div> : null}
                {p.observacao ? <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">Observação</dt><dd>{p.observacao}</dd></div> : null}
              </dl>
            )}
          </Cartao>
          <Cartao id="extrato-indicacoes" titulo="Indicações" icone="pessoas">
            {x.indicacoes.length ? (
              <ul className="divide-y divide-linha">
                {x.indicacoes.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="grid">
                      <Link href={`/comercial/${i.id}`} className="font-medium hover:text-violeta-600 hover:underline">{i.condominio}</Link>
                      <span className="t-apoio">{`indicado em ${dataCurta(i.criadoEm)}`}</span>
                    </span>
                    <SeloEtapa etapa={i.etapa as EtapaComercial} />
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhuma indicação ainda.</p>}
          </Cartao>
        </div>
      </div>

      {janela?.tipo === "editar" ? <JanelaParceiro p={p} aoFechar={() => fechar()} feito={() => fechar("Cadastro do parceiro salvo.")} /> : null}
      {janela?.tipo === "indicar" ? (
        <JanelaIndicar p={p} aoFechar={() => fechar()}
          feito={(novo, juntado) => (juntado ? fechar("Este contato já estava no Comercial: juntamos no interessado que existe, sem virar indicação.") : router.push(`/comercial/${novo}`))} />
      ) : null}
      {janela?.tipo === "pagar" ? <JanelaPagamento e={x} aoFechar={() => fechar()} feito={() => fechar(`Pagamento de ${textoMes(x.mes)} registrado.`)} /> : null}
      {janela?.tipo === "encerrar" ? <JanelaEncerrar l={janela.l} mes={x.mes} aoFechar={() => fechar()} feito={() => fechar("Comissão encerrada.")} /> : null}
      {janela?.tipo === "apagar" ? <JanelaApagar e={x} aoFechar={() => fechar()} feito={() => fechar("Contato do parceiro apagado.")} /> : null}
    </div>
  );
}
