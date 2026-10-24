"use client";
// As janelas de Pagamentos (quadros 249, 250 e 252): registrar o que entrou, conferir ou devolver,
// dizer de quem é um recebimento sem cliente, ajustar com motivo e definir o valor que estava a
// definir. Nada pede agência, conta nem chave: só a referência do comprovante.

import { useState, type FormEvent } from "react";
import { FORMAS_RECEBIMENTO, mostrarDataSemHora, mostrarValor, TIPOS_AJUSTE, type FormaRecebimento, type TipoAjuste } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, type ErroApi } from "@triade/ui";
import { nomeCobranca } from "../ficha/AbaPlano.tsx";
import { centavosDoCampo, EscolhaBotoes, ErroJanela, hojeBrasilia, RodapeJanela, type Cobranca, type Recebimento } from "./comum.tsx";

export interface ClienteEscolha {
  id: string;
  nome: string;
}

/** Envia e avisa; o erro fica na janela. */
function useEnviar(feito: (texto: string) => void) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(caminho: string, corpo: unknown, texto: string, metodo: "POST" | "PUT" = "POST") {
    setEnviando(true);
    const r = await chamarApi(caminho, { metodo, corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(texto);
  }
  return { erro, setErro, enviando, enviar };
}

const abertas = (lista: Cobranca[], cliente: string) => lista.filter((c) => c.condominioId === cliente && c.situacao !== "QUITADA");

/** Registrar recebimento: parcial, sem dados bancários, ou ainda sem cliente. */
export function JanelaRecebimento({ clientes, cobrancas, inicial, aoFechar, feito }: {
  clientes: ClienteEscolha[]; cobrancas: Cobranca[]; inicial?: { cliente: string; cobranca: string }; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [deQuem, setDeQuem] = useState<"CLIENTE" | "NAO_SEI">("CLIENTE");
  const [cliente, setCliente] = useState(inicial?.cliente ?? clientes[0]?.id ?? "");
  const [cobranca, setCobranca] = useState(inicial?.cobranca ?? abertas(cobrancas, inicial?.cliente ?? clientes[0]?.id ?? "")[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [recebidoEm, setRecebidoEm] = useState(hojeBrasilia());
  const [forma, setForma] = useState<FormaRecebimento>("PIX");
  const [referencia, setReferencia] = useState("");
  const [erroValor, setErroValor] = useState<string | null>(null);
  const { erro, enviando, enviar } = useEnviar(feito);
  const campos = camposComErro(erro);
  const opcoesCobranca = abertas(cobrancas, cliente);

  function salvar(ev: FormEvent) {
    ev.preventDefault();
    const v = centavosDoCampo(valor);
    if ("erro" in v || v.centavos === null) return setErroValor("erro" in v ? v.erro : "Diga o valor recebido.");
    setErroValor(null);
    const comCliente = deQuem === "CLIENTE";
    void enviar("/v1/pagamentos/recebimentos", {
      condominioId: comCliente ? cliente : null, cobrancaId: comCliente ? cobranca || null : null, valor: v.centavos, recebidoEm, forma, referencia,
    }, comCliente ? "Recebimento registrado. Ele entra A conferir." : "Recebimento guardado em Não identificados.");
  }

  return (
    <Dialogo aberto media titulo="Registrar recebimento" apoio="O que entrou na conta da TRÍADE." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={salvar} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <EscolhaBotoes nome="de-quem" legenda="De quem é" valor={deQuem} aoMudar={setDeQuem}
          opcoes={[{ valor: "CLIENTE", texto: "De um cliente" }, { valor: "NAO_SEI", texto: "Ainda não sei" }]}
          ajuda="Ainda não sei: fica em Não identificados, sem cliente." />
        {deQuem === "CLIENTE" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoSelecao id="rec-cliente" rotulo="Cliente" value={cliente} opcoes={clientes.map((c) => ({ valor: c.id, texto: c.nome }))}
              onChange={(e) => { setCliente(e.target.value); setCobranca(abertas(cobrancas, e.target.value)[0]?.id ?? ""); }} />
            <CampoSelecao id="rec-cobranca" rotulo="Cobrança" value={cobranca} onChange={(e) => setCobranca(e.target.value)}
              opcoes={opcoesCobranca.length ? opcoesCobranca.map((c) => ({ valor: c.id, texto: `${nomeCobranca(c)} · falta ${mostrarValor(c.falta)}` })) : [{ valor: "", texto: "Nenhuma cobrança em aberto" }]}
              erro={campos.includes("cobranca") || campos.includes("cobrancaId") ? "Escolha a cobrança." : null} />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto id="rec-valor" rotulo="Valor recebido" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} ajuda="Pode ser parcial."
            erro={erroValor ?? (campos.includes("valor") ? "Diga o valor recebido." : null)} />
          <CampoTexto id="rec-em" type="date" rotulo="Recebido em" value={recebidoEm} max={hojeBrasilia()} onChange={(e) => setRecebidoEm(e.target.value)}
            erro={campos.includes("recebidoEm") ? "Diga quando entrou (até hoje)." : null} />
        </div>
        <EscolhaBotoes nome="forma" legenda="Como chegou" valor={forma} aoMudar={setForma}
          opcoes={(Object.keys(FORMAS_RECEBIMENTO) as FormaRecebimento[]).map((v) => ({ valor: v, texto: FORMAS_RECEBIMENTO[v] }))} />
        <CampoTexto id="rec-ref" rotulo="Referência do comprovante" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} className="[&_input]:font-mono"
          ajuda="O código da transação no extrato. Não guarde agência, conta nem chave."
          erro={campos.includes("referencia") ? "Diga a referência do comprovante." : null} />
        <p className="t-apoio text-tinta-suave">Entra A conferir. Quem confere vê quem registrou e quando.</p>
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar" />
      </form>
    </Dialogo>
  );
}

/** Conferir: só quem pode conferir confirma; devolver pede o motivo. */
export function JanelaConferir({ r, cobranca, aoFechar, feito }: { r: Recebimento & { condominioId: string }; cobranca?: Cobranca; aoFechar: () => void; feito: (texto: string) => void }) {
  const [conferi, setConferi] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const { erro, enviando, enviar } = useEnviar(feito);
  const base = `/v1/clientes/${r.condominioId}/recebimentos/${r.id}`;
  const depois = cobranca?.falta !== undefined ? Math.max(cobranca.falta - r.valor, 0) : undefined;

  function confirmar(ev: FormEvent) {
    ev.preventDefault();
    if (devolvendo) return void enviar(`${base}/devolver`, { versao: r.versao, motivo }, "Recebimento devolvido. A referência pode ser usada de novo.");
    void enviar(`${base}/conferir`, { versao: r.versao }, "Recebimento confirmado.");
  }

  const par = (nome: string, valor: string, apoio?: string, mono?: boolean) => (
    <div className="grid content-start gap-0.5">
      <span className="t-apoio text-tinta-suave">{nome}</span>
      <span className={`t-texto font-medium [overflow-wrap:anywhere] ${mono ? "t-codigo" : ""}`}>{valor}</span>
      {apoio ? <span className="t-apoio text-tinta-suave">{apoio}</span> : null}
    </div>
  );

  return (
    <Dialogo aberto media titulo="Conferir recebimento" apoio="Confirmado só depois da conferência." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={confirmar}>
        {erro ? <ErroJanela erro={erro} /> : null}
        <div className="grid gap-x-5 gap-y-3.5 sm:grid-cols-2">
          {par("Cliente", r.cliente ?? cobranca?.cliente ?? "")}
          {par("Cobrança", cobranca ? `${nomeCobranca(cobranca)} · ${cobranca.tipo === "IMPLANTACAO" ? "implantação" : "mensalidade"}` : "")}
          {par("Valor", mostrarValor(r.valor), depois !== undefined ? `Falta ${mostrarValor(depois)} depois deste` : undefined)}
          {par("Recebido em", `${mostrarDataSemHora(r.recebidoEm)} · ${FORMAS_RECEBIMENTO[r.forma as FormaRecebimento] ?? r.forma}`)}
          {par("Referência", r.referencia, undefined, true)}
          {par("Registrado por", r.registradoPor ?? "", new Date(r.registradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}
        </div>
        {devolvendo ? (
          <CampoAreaTexto id="dev-motivo" rotulo="Por que devolver" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
            ajuda="Por exemplo: não aparece no extrato. O recebimento sai da conta e a referência pode ser usada de novo."
            erro={camposComErro(erro).includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        ) : (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} className="h-5 w-5 accent-violeta-600" />
            <span className="t-texto">Conferi no extrato da TRÍADE: valor, data e referência batem.</span>
          </label>
        )}
        <Aviso tom="neutro">Se a referência já tiver sido confirmada, a segunda confirmação é recusada.</Aviso>
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          {devolvendo ? <Botao variante="discreto" onClick={() => setDevolvendo(false)}>Voltar</Botao> : <Botao variante="discreto" onClick={() => setDevolvendo(true)}><Icone nome="retorno" />Devolver com motivo</Botao>}
          <Botao type="submit" variante={devolvendo ? "perigo" : "primario"} disabled={enviando || (!devolvendo && !conferi)}>
            <Icone nome={devolvendo ? "retorno" : "check"} />{enviando ? "Salvando…" : devolvendo ? "Devolver" : "Confirmar recebimento"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Dizer de quem é um recebimento sem cliente: vira recebimento A conferir da cobrança escolhida. */
export function JanelaIdentificar({ avulso, clientes, cobrancas, aoFechar, feito }: {
  avulso: { id: string; valor: number; recebidoEm: string; referencia: string }; clientes: ClienteEscolha[]; cobrancas: Cobranca[]; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [cliente, setCliente] = useState(clientes[0]?.id ?? "");
  const [cobranca, setCobranca] = useState(abertas(cobrancas, clientes[0]?.id ?? "")[0]?.id ?? "");
  const { erro, enviando, enviar } = useEnviar(feito);
  const opcoes = abertas(cobrancas, cliente);
  return (
    <Dialogo aberto media titulo="De quem é este recebimento" apoio={`${mostrarValor(avulso.valor)} em ${mostrarDataSemHora(avulso.recebidoEm)} · ${avulso.referencia}`} aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void enviar(`/v1/pagamentos/nao-identificados/${avulso.id}/identificar`, { condominioId: cliente, cobrancaId: cobranca }, "Recebimento identificado. Ele entra A conferir."); }}>
        {erro ? <ErroJanela erro={erro} /> : null}
        <CampoSelecao id="id-cliente" rotulo="Cliente" value={cliente} opcoes={clientes.map((c) => ({ valor: c.id, texto: c.nome }))}
          onChange={(e) => { setCliente(e.target.value); setCobranca(abertas(cobrancas, e.target.value)[0]?.id ?? ""); }} />
        <CampoSelecao id="id-cobranca" rotulo="Cobrança" value={cobranca} onChange={(e) => setCobranca(e.target.value)}
          opcoes={opcoes.length ? opcoes.map((c) => ({ valor: c.id, texto: `${nomeCobranca(c)} · falta ${mostrarValor(c.falta)}` })) : [{ valor: "", texto: "Nenhuma cobrança em aberto" }]} />
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Identificar" />
      </form>
    </Dialogo>
  );
}

/** Ajuste com motivo, no lugar de editar o valor (quadro 252). */
export function JanelaAjuste({ c, aoFechar, feito }: { c: Cobranca; aoFechar: () => void; feito: (texto: string) => void }) {
  const [tipo, setTipo] = useState<TipoAjuste>("DESCONTO");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erroValor, setErroValor] = useState<string | null>(null);
  const { erro, enviando, enviar } = useEnviar(feito);
  const campos = camposComErro(erro);

  function salvar(ev: FormEvent) {
    ev.preventDefault();
    const negativo = tipo === "CORRECAO" && valor.trim().startsWith("-");
    const v = centavosDoCampo(valor.replace(/^\s*-/, ""));
    if ("erro" in v || v.centavos === null) return setErroValor("erro" in v ? v.erro : "Diga o valor.");
    setErroValor(null);
    void enviar(`/v1/clientes/${c.condominioId}/cobrancas/${c.id}/ajustes`, { tipo, valor: negativo ? -v.centavos : v.centavos, motivo }, "Ajuste salvo.");
  }

  return (
    <Dialogo aberto media titulo={`Ajustar ${nomeCobranca(c)}`} apoio={`${c.cliente} · devido hoje ${mostrarValor(c.devido)}`} aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={salvar} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <EscolhaBotoes nome="tipo" legenda="Tipo" valor={tipo} aoMudar={setTipo}
          opcoes={(Object.keys(TIPOS_AJUSTE) as TipoAjuste[]).map((v) => ({ valor: v, texto: TIPOS_AJUSTE[v] }))}
          ajuda={tipo === "CORRECAO" ? "Na correção, escreva o sinal de menos para tirar." : undefined} />
        <CampoTexto id="aj-valor" rotulo="Valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          erro={erroValor ?? (campos.includes("valor") ? "Diga o valor." : null)} />
        <CampoAreaTexto id="aj-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        <p className="t-apoio text-tinta-suave">O ajuste entra no histórico com o seu nome. Para desfazer, faça outro ajuste.</p>
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar ajuste" />
      </form>
    </Dialogo>
  );
}

/** O valor que estava a definir passa a existir, uma vez, com motivo. */
export function JanelaValor({ c, aoFechar, feito }: { c: Cobranca; aoFechar: () => void; feito: (texto: string) => void }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erroValor, setErroValor] = useState<string | null>(null);
  const { erro, enviando, enviar } = useEnviar(feito);
  const campos = camposComErro(erro);

  function salvar(ev: FormEvent) {
    ev.preventDefault();
    const v = centavosDoCampo(valor);
    if ("erro" in v || v.centavos === null) return setErroValor("erro" in v ? v.erro : "Diga o valor.");
    setErroValor(null);
    void enviar(`/v1/clientes/${c.condominioId}/cobrancas/${c.id}/valor`, { valor: v.centavos, motivo }, "Valor definido.", "PUT");
  }

  return (
    <Dialogo aberto media titulo={`Definir o valor de ${nomeCobranca(c)}`} apoio="Define uma vez; depois, só por ajuste com motivo." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={salvar} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <CampoTexto id="vl-valor" rotulo="Valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          erro={erroValor ?? (campos.includes("valor") ? "Diga o valor." : null)} />
        <CampoAreaTexto id="vl-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          ajuda="Por exemplo: o preço combinado com o cliente." erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Definir valor" />
      </form>
    </Dialogo>
  );
}
