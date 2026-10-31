"use client";
// As janelas de Renovações (0311, R17.7; quadros 346 e 347): a regra do reajuste, o aviso ao síndico
// e a renovação sem reajuste (CM-30), marcar e tratar um sinal de risco (CM-31), o pedido de
// cancelamento com a tentativa de retenção (quadro 347) e a expansão (CM-32). O banco confere tudo de
// novo; aqui ficam os textos e o que o banco recusou em cada campo. Da R17.7c (0318; quadros 487 a 491):
// o cancelamento confirmado com o desfazer, o aditivo de retorno, o reativar e o aditivo de reajuste
// com as assinaturas pelo gov.br (R17.7b).

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  CANAIS_AVISO, ETAPAS_EXPANSAO_ABERTAS, MOTIVOS_CANCELAMENTO, TIPOS_EXPANSAO, TIPOS_RISCO, TIPOS_RISCO_A_MAO,
  formatarCpf, type CanalAviso, type EtapaExpansao, type MotivoCancelamento, type TipoExpansao,
} from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, classeBotao, Dialogo, Icone, type ErroApi } from "@triade/ui";
import { centavosDoCampo, EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { somarDias } from "./comum.tsx";
import { hashCurto } from "./contrato.ts";
import { CartaoAssinaturasAditivo, type JanelaAssinatura } from "./janelasAditivo.tsx";
import { useBaixar } from "./janelasContrato.tsx";
import {
  AO_DESFAZER, AO_REATIVAR_VOLTA, avisoSugerido, clientesAtivos, competenciasRetorno, corpoRetorno, nomeEtapaExpansao, nomeExpansao, passouUltimoDia, podeDesfazer, problemasRetorno,
  ROTAS_RENOVACOES, telaReativar, textoComReajuste, textoConfirmado, textoDesfeito, textoExportacao, textoPedidoPor, textoPlanoCancelamento, textoReativado, textoSeConfirmar,
  textoUltimoDia, textoUltimoDiaConfirmado, textoValeDesde, textoValorHoje,
  type AditivoResumo, type Cancelamento, type ClienteRenovacao, type Expansao, type RegraReajusteTela, type Renovacao, type SugestaoExpansao, type TelaRenovacoes,
} from "./renovacoes.ts";
import type { Pessoa } from "./tipos.ts";

const erroDe = (campos: string[], nome: string, texto: string) => (campos.includes(nome) ? texto : undefined);
const opcoesDe = <T extends string>(o: Record<T, string>, so?: readonly T[]) =>
  (Object.keys(o) as T[]).filter((k) => !so || so.includes(k)).map((k) => ({ valor: k, texto: o[k] }));
const CANAIS = opcoesDe(CANAIS_AVISO);
const MOTIVOS = opcoesDe(MOTIVOS_CANCELAMENTO);
const SINAIS = opcoesDe(TIPOS_RISCO, TIPOS_RISCO_A_MAO);

function Linha({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t border-linha py-2.5 first:border-t-0 max-md:grid-cols-1 max-md:gap-0.5">
      <dt className="t-apoio text-tinta-suave">{nome}</dt>
      <dd className="t-texto [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** A regra do reajuste: só quem cuida de Modelos (a Administração). Sem índice, nada é calculado. */
export function JanelaRegraReajuste({ r, aoFechar, feito }: { r: RegraReajusteTela; aoFechar: () => void; feito: () => void }) {
  const [indice, setIndice] = useState(r.indice ?? "");
  const [percentual, setPercentual] = useState(r.percentual !== undefined ? String(r.percentual).replace(".", ",") : "");
  const [referencia, setReferencia] = useState(r.referencia ?? "");
  const [prazo, setPrazo] = useState(String(r.prazoAvisoDias));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const pct = percentual.trim() ? Number(percentual.trim().replace(",", ".")) : null;
    const dias = Number(prazo.trim());
    const faltam = [
      ...((indice.trim() === "") !== (pct === null) ? [indice.trim() ? "percentual" : "indice"] : []),
      ...(pct !== null && (!Number.isFinite(pct) || pct < -20 || pct > 50 || Math.round(pct * 100) !== pct * 100) ? ["percentual"] : []),
      ...(!Number.isInteger(dias) || dias < 30 || dias > 120 ? ["prazoAvisoDias"] : []),
      ...(referencia.trim() && !indice.trim() ? ["referencia"] : []),
    ];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const res = await chamarApi(ROTAS_RENOVACOES.regra, {
      metodo: "PUT", corpo: { versao: r.versao, indice: indice.trim() || null, percentual: pct, referencia: referencia.trim() || null, prazoAvisoDias: dias },
    });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Regra do reajuste" aoFechar={aoFechar} media
      apoio="O índice e o percentual do período vêm do advogado. Sem eles, a tela mostra o índice a definir e não calcula valor nenhum.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="regra-indice" rotulo="Índice" opcional maxLength={60} placeholder="IPCA" value={indice} onChange={(e) => setIndice(e.target.value)}
            erro={erroDe(campos, "indice", "Diga o índice (por exemplo, IPCA), junto com o percentual.")} />
          <CampoTexto id="regra-percentual" rotulo="Percentual do período (%)" opcional inputMode="decimal" maxLength={7} value={percentual}
            onChange={(e) => setPercentual(e.target.value)} erro={erroDe(campos, "percentual", "De -20% a 50%, com até duas casas, junto com o índice.")} />
          <CampoTexto id="regra-referencia" rotulo="Referência" opcional maxLength={120} placeholder="12 meses até setembro de 2026" value={referencia}
            onChange={(e) => setReferencia(e.target.value)} erro={erroDe(campos, "referencia", "A referência vai de 3 a 120 letras, com o índice.")} />
          <CampoTexto id="regra-prazo" rotulo="Dias de aviso antes do aniversário" inputMode="numeric" maxLength={3} value={prazo} onChange={(e) => setPrazo(e.target.value)}
            erro={erroDe(campos, "prazoAvisoDias", "De 30 a 120 dias.")} />
        </div>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a regra" />
      </form>
    </Dialogo>
  );
}

/** O aviso enviado ao síndico (CM-30): nada muda no valor sem ele. Com modelo em uso, gera o aditivo. */
export function JanelaAviso({ r, regra, cliente, hoje, comAditivo, aoFechar, feito }: {
  r: Renovacao; regra: RegraReajusteTela; cliente?: ClienteRenovacao; hoje: string; comAditivo: boolean; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [avisoEm, setAvisoEm] = useState(hoje);
  const [canal, setCanal] = useState<CanalAviso | null>("WHATSAPP");
  const [para, setPara] = useState(cliente?.contato ?? "");
  const [texto, setTexto] = useState(avisoSugerido(r, regra, cliente, hoje) ?? "");
  // O texto sugerido acompanha a data do aviso (o vale desde muda com ela) até a equipe mexer nele (r4).
  const [sugerido, setSugerido] = useState(texto);
  function mudarData(nova: string) {
    setAvisoEm(nova);
    const proximo = avisoSugerido(r, regra, cliente, nova || hoje) ?? "";
    if (texto === sugerido) setTexto(proximo);
    setSugerido(proximo);
  }
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const res = await chamarApi<{ renovacao: Renovacao }>(ROTAS_RENOVACOES.aviso, {
      corpo: { interessadoId: r.interessadoId, aniversario: r.aniversario, valorNovo: r.novo?.valor, avisoEm: avisoEm || null, canal, para, texto },
    });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    const a = res.dados.renovacao.aditivo;
    feito(`Aviso registrado para o ${r.condominio}.${a ? ` Aditivo nº ${a.numero} ${a.situacao === "PRONTO" ? "pronto para baixar" : "sendo montado"}.` : ""}`);
  }

  return (
    <Dialogo aberto titulo="Registrar o aviso ao síndico" aoFechar={aoFechar} larga apoio={`${r.condominio}: o valor novo só vale depois deste aviso (CM-30).`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <dl className="grid rounded-[16px] border border-linha px-4">
          <Linha nome="Aniversário">{`${r.aniversario.slice(8, 10)}/${r.aniversario.slice(5, 7)}/${r.aniversario.slice(0, 4)}`}</Linha>
          <Linha nome="Hoje">{textoValorHoje(r)}</Linha>
          <Linha nome="Com reajuste">{textoComReajuste(r)}</Linha>
          <Linha nome="Vale desde">{textoValeDesde(r, regra, cliente, avisoEm || hoje)}</Linha>
        </dl>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="aviso-em" rotulo="Aviso enviado em" type="date" min={somarDias(hoje, -30)} max={hoje} value={avisoEm} onChange={(e) => mudarData(e.target.value)}
            erro={erroDe(campos, "avisoEm", "Hoje ou nos últimos 30 dias.")} />
          <CampoTexto id="aviso-para" rotulo="Quem recebeu" maxLength={120} value={para} onChange={(e) => setPara(e.target.value)} autoComplete="off"
            erro={erroDe(campos, "para", "Diga quem recebeu o aviso.")} />
        </div>
        <EscolhaBotoes nome="aviso-canal" legenda="Por onde foi" opcoes={CANAIS} valor={canal} aoMudar={setCanal}
          ajuda={campos.includes("canal") ? <span className="text-erro">Diga por onde o aviso foi.</span> : undefined} />
        <CampoAreaTexto id="aviso-texto" rotulo="Texto do aviso" maxLength={2000} rows={7} value={texto} onChange={(e) => setTexto(e.target.value)}
          ajuda="O texto que foi ao síndico. Fica guardado por 5 anos e depois é apagado; ficam os valores e as datas."
          erro={erroDe(campos, "texto", "Cole o texto do aviso (de 10 a 2.000 letras).")} />
        <Aviso tom={comAditivo ? "info" : "atencao"}>
          {comAditivo
            ? "O aviso gera o aditivo do contrato (CM-13), em PDF com a impressão digital. As duas partes podem assinar pelo gov.br depois; o valor novo vale pelo aviso, com ou sem as assinaturas."
            : "Sem modelo de aditivo em uso (Modelos › Aditivo): o valor novo vale só pelo aviso, sem aditivo."}
        </Aviso>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar o aviso" icone="enviar" />
      </form>
    </Dialogo>
  );
}

/** Renovar sem reajuste: o aniversário fica registrado com o motivo; o valor não muda. */
export function JanelaSemReajuste({ r, aoFechar, feito }: { r: Renovacao; aoFechar: () => void; feito: (texto: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const res = await chamarApi(ROTAS_RENOVACOES.dispensar, { corpo: { interessadoId: r.interessadoId, aniversario: r.aniversario, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(`${r.condominio} renovado sem reajuste.`);
  }

  return (
    <Dialogo aberto titulo="Renovar sem reajuste" aoFechar={aoFechar} apoio={`${r.condominio} continua com ${textoValorHoje(r)} depois do aniversário.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoAreaTexto id="sem-reajuste-motivo" rotulo="Por quê" maxLength={300} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          ajuda="Por exemplo: combinado na proposta, ou a Administração decidiu segurar o valor." erro={erroDe(campos, "motivo", "Diga por que renova sem reajuste (de 3 a 300 letras).")} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Renovar sem reajuste" />
      </form>
    </Dialogo>
  );
}

/** Marcar um sinal à mão (CM-31): síndico novo eleito ou troca de sistema na pauta. */
export function JanelaMarcarRisco({ clientes, interessadoId, aoFechar, feito }: {
  clientes: ClienteRenovacao[]; interessadoId?: string; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [cliente, setCliente] = useState(interessadoId ?? "");
  const [tipo, setTipo] = useState<(typeof TIPOS_RISCO_A_MAO)[number] | null>(null);
  const [data, setData] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  // O síndico novo vale também para quem saiu (reconquista); a troca na pauta, só para quem é cliente.
  const lista = clientes.filter((c) => c.situacao !== "ENCERRADO" || c.id === interessadoId || tipo === "SINDICO_NOVO");

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const faltam = [...(!cliente ? ["interessadoId"] : []), ...(!tipo ? ["tipo"] : []), ...(!data ? ["data"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const res = await chamarApi(ROTAS_RENOVACOES.riscos, { corpo: { interessadoId: cliente, tipo, data, detalhe: detalhe.trim() || null } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito("Sinal de risco registrado.");
  }

  return (
    <Dialogo aberto titulo="Marcar sinal de risco" aoFechar={aoFechar} media apoio="O uso caindo vem sozinho dos pedidos; a troca de síndico registrada no Console também.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="risco-cliente" rotulo="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}
          opcoes={[{ valor: "", texto: "Escolha o cliente" }, ...lista.map((c) => ({ valor: c.id, texto: c.condominio }))]}
          erro={erroDe(campos, "interessadoId", "Escolha o cliente.")} />
        <EscolhaBotoes nome="risco-tipo" legenda="Sinal" opcoes={SINAIS} valor={tipo} aoMudar={setTipo}
          ajuda={campos.includes("tipo") ? <span className="text-erro">Escolha o sinal.</span> : undefined} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="risco-data" rotulo={tipo === "TROCA_NA_PAUTA" ? "Data da assembleia" : "Data da eleição"} type="date" value={data} onChange={(e) => setData(e.target.value)}
            erro={erroDe(campos, "data", tipo === "TROCA_NA_PAUTA" ? "De 30 dias atrás a um ano à frente." : "De um ano atrás a 90 dias à frente.")} />
          <CampoTexto id="risco-detalhe" rotulo="Detalhe" opcional maxLength={200} value={detalhe} onChange={(e) => setDetalhe(e.target.value)}
            erro={erroDe(campos, "detalhe", "O detalhe vai de 3 a 200 letras.")} />
        </div>
        {erro?.detalhes?.motivo === "SINAL_REGISTRADO" ? <Aviso tom="atencao">Este sinal já foi registrado para este cliente nesta data.</Aviso> : null}
        {erro && !campos.length && erro.detalhes?.motivo !== "SINAL_REGISTRADO" ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Marcar o sinal" icone="alerta" />
      </form>
    </Dialogo>
  );
}

/** "Já vi": o sinal sai da lista, com a nota de quem tratou. */
export function JanelaTratarRisco({ sinal, condominio, aoFechar, feito }: {
  sinal: { id: string; versao: number; texto: string }; condominio: string; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const res = await chamarApi(ROTAS_RENOVACOES.tratarRisco(sinal.id), { corpo: { versao: sinal.versao, nota: nota.trim() || null } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito("Sinal tratado. Ele saiu da lista.");
  }

  return (
    <Dialogo aberto titulo="Tratar o sinal" aoFechar={aoFechar} apoio={`${condominio}: ${sinal.texto}.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoAreaTexto id="tratar-nota" rotulo="O que foi feito" opcional maxLength={300} rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
          erro={erroDe(campos, "nota", "A nota vai de 3 a 300 letras.")} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Já vi" />
      </form>
    </Dialogo>
  );
}

/** O instante digitado (horário de Brasília) para o banco. */
const instante = (local: string) => (local ? `${local}:00-03:00` : null);

/** Registrar o pedido: quem pediu e quando. O último dia sai da data do pedido mais o aviso (N.1). */
export function JanelaRegistrarPedido({ clientes, avisoDias, hoje, aoFechar, feito }: {
  clientes: ClienteRenovacao[]; avisoDias: number; hoje: string; aoFechar: () => void; feito: (k: { id: string; ultimoDia: string }) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [por, setPor] = useState("");
  const [em, setEm] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const ativos = clientesAtivos(clientes);
  const dia = em ? em.slice(0, 10) : hoje;

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!cliente) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["interessadoId"] } });
    setEnviando(true);
    const res = await chamarApi<{ id: string; ultimoDia: string }>(ROTAS_RENOVACOES.cancelamentos, { corpo: { interessadoId: cliente, pedidoPor: por, pedidoEm: instante(em) } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(res.dados);
  }

  return (
    <Dialogo aberto titulo="Registrar pedido de cancelamento" aoFechar={aoFechar} media
      apoio={`O síndico pediu para cancelar. Com o aviso de ${avisoDias} dias (N.1), sem multa, o último dia é contado da data do pedido.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="pedido-cliente" rotulo="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}
          opcoes={[{ valor: "", texto: "Escolha o cliente" }, ...ativos.map((c) => ({ valor: c.id, texto: c.condominio }))]}
          erro={erroDe(campos, "interessadoId", "Escolha o cliente.")} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="pedido-por" rotulo="Quem pediu" maxLength={120} placeholder="Ana Ribeiro, síndica" value={por} onChange={(e) => setPor(e.target.value)} autoComplete="off"
            erro={erroDe(campos, "pedidoPor", "Diga quem pediu.")} />
          <CampoTexto id="pedido-em" rotulo="Quando pediu" opcional type="datetime-local" value={em} onChange={(e) => setEm(e.target.value)}
            ajuda="Vazio: agora." erro={erroDe(campos, "pedidoEm", "Agora ou nos últimos 30 dias.")} />
        </div>
        <p className="t-apoio">{`Último dia se confirmar: ${textoUltimoDia({ avisoDias, ultimoDia: somarDias(dia, avisoDias) })}.`}</p>
        {erro?.detalhes?.motivo === "CANCELAMENTO_ABERTO" ? <Aviso tom="atencao">Este cliente já tem um pedido de cancelamento aberto.</Aviso> : null}
        {erro && !campos.length && erro.detalhes?.motivo !== "CANCELAMENTO_ABERTO" ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar o pedido" />
      </form>
    </Dialogo>
  );
}

/**
 * Pedido de cancelamento (quadro 347): o motivo obrigatório, uma tentativa de retenção (ela decide) e
 * a confirmação, que é da Administração e não volta. "Decidiu ficar" fecha o pedido sem mudar nada.
 */
export function JanelaCancelamento({ k, hoje, podeEditar, podeConfirmar, aoFechar, feito }: {
  k: Cancelamento; hoje: string; podeEditar: boolean; podeConfirmar: boolean; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(k.motivo ?? null);
  const [motivoTexto, setMotivoTexto] = useState(k.motivoTexto ?? "");
  const [retencao, setRetencao] = useState("");
  const [lembrar, setLembrar] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState<null | "retencao" | "confirmar" | "ficou">(null);
  const campos = camposComErro(erro);
  const tentou = !!k.retencaoEm;
  const passou = k.ultimoDia < hoje;
  // A tentativa digitada não se perde: confirma depois de registrar ou de apagar o texto.
  const tentativaPorRegistrar = !tentou && retencao.trim().length > 0;

  async function enviar(acao: "retencao" | "confirmar" | "ficou") {
    if (acao === "confirmar" && (!podeConfirmar || passou || tentativaPorRegistrar)) return;
    setErro(null);
    const faltam = [
      ...(acao !== "ficou" && !motivo ? ["motivo"] : []),
      ...(acao !== "ficou" && motivo === "OUTRO" && motivoTexto.trim().length < 3 ? ["motivoTexto"] : []),
      ...(acao === "retencao" && retencao.trim().length < 3 ? ["retencao"] : []),
    ];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(acao);
    const corpo = acao === "ficou"
      ? { versao: k.versao, nota: null }
      : acao === "retencao"
      ? { versao: k.versao, motivo, motivoTexto: motivoTexto.trim() || null, retencao: retencao.trim() }
      : { versao: k.versao, motivo, motivoTexto: motivoTexto.trim() || null, lembrarEm: lembrar || null };
    const rota = acao === "ficou" ? ROTAS_RENOVACOES.ficou(k.id) : acao === "retencao" ? ROTAS_RENOVACOES.retencao(k.id) : ROTAS_RENOVACOES.confirmar(k.id);
    const res = await chamarApi<{ semSindico?: boolean; cobrancasDepois?: number }>(rota, { corpo });
    setEnviando(null);
    if (!res.ok) return setErro(res.erro);
    if (acao === "ficou") return feito(`${k.condominio} decidiu ficar. O pedido foi fechado.`);
    if (acao === "retencao") return feito("Tentativa de retenção registrada. Agora a decisão é do síndico.");
    const depois = res.dados.cobrancasDepois ?? 0;
    feito(`Cancelamento confirmado. O acesso continua até ${k.ultimoDia.slice(8, 10)}/${k.ultimoDia.slice(5, 7)}${res.dados.semSindico ? "; sem síndico ativo, a exportação não foi pedida" : " e a exportação está sendo montada"}.${
      depois ? ` Há ${depois === 1 ? "1 cobrança já aberta" : `${depois} cobranças já abertas`} de competência depois do último dia: ajuste em Pagamentos.` : ""}`);
  }

  return (
    <Dialogo aberto titulo="Pedido de cancelamento" aoFechar={aoFechar} larga apoio={`${k.condominio} pediu para cancelar (CM-31).`}>
      <form onSubmit={(ev) => { ev.preventDefault(); void enviar(tentou ? "confirmar" : "retencao"); }} className="grid gap-4" noValidate>
        <dl className="grid rounded-[16px] border border-linha px-4">
          <Linha nome="Cliente">{textoPlanoCancelamento(k)}</Linha>
          <Linha nome="Pedido por">{textoPedidoPor(k)}</Linha>
          <Linha nome="Aviso">{textoUltimoDia(k)}</Linha>
        </dl>
        <EscolhaBotoes nome="cancelamento-motivo" legenda="Motivo do cancelamento (obrigatório)" opcoes={MOTIVOS} valor={motivo} aoMudar={setMotivo}
          ajuda={campos.includes("motivo") ? <span className="text-erro">Escolha o motivo do cancelamento.</span> : undefined} />
        {motivo === "OUTRO" ? (
          <CampoTexto id="cancelamento-outro" rotulo="Qual é o outro motivo" maxLength={300} value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)}
            erro={erroDe(campos, "motivoTexto", "Diga qual é o outro motivo.")} />
        ) : null}
        {tentou ? (
          <div className="grid gap-1 rounded-[16px] border border-linha p-4">
            <span className="t-apoio font-medium">Tentativa de retenção</span>
            <p className="t-texto [overflow-wrap:anywhere]">{k.retencao ?? "Texto apagado (LGPD)."}</p>
            <span className="t-apoio">{`Registrada${k.retencaoPor ? ` por ${k.retencaoPor.nome}` : ""}. Uma tentativa registrada; ela decide.`}</span>
          </div>
        ) : (
          <CampoAreaTexto id="cancelamento-retencao" rotulo="Tentativa de retenção" maxLength={1000} rows={3} value={retencao} onChange={(e) => setRetencao(e.target.value)}
            placeholder="Apresentar à síndica nova; oferecer 2 meses de acompanhamento" ajuda="Uma tentativa registrada; ela decide."
            erro={erroDe(campos, "retencao", "Diga o que foi oferecido ou combinado (de 3 a 1.000 letras).")} />
        )}
        {podeConfirmar ? (
          <CampoTexto id="cancelamento-lembrar" rotulo="Lembrar de reconquistar em" opcional type="date" min={somarDias(k.ultimoDia, 1)} value={lembrar}
            onChange={(e) => setLembrar(e.target.value)} ajuda="A reconquista aparece em Expansão perto desta data, ou quando houver síndico novo."
            erro={erroDe(campos, "lembrarEm", "Do dia seguinte ao último até três anos depois.")} />
        ) : null}
        <p className="rounded-[12px] bg-superficie-2 px-3.5 py-3 t-apoio">{textoSeConfirmar(k)}</p>
        {!podeConfirmar ? <p className="t-apoio">Confirmar o cancelamento é da Administração: ela para a cobrança, a comissão e abre a exportação.</p> : null}
        {podeConfirmar && passou ? <Aviso tom="atencao">O último dia deste pedido já passou sem a confirmação. Se o síndico ainda quer cancelar, feche este pedido em Decidiu ficar, com a nota de que passou do prazo, e registre um pedido novo com a data de hoje.</Aviso> : null}
        {podeConfirmar && !passou && tentativaPorRegistrar ? <p className="t-apoio">Para confirmar, registre a tentativa primeiro ou apague o texto dela.</p> : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 max-md:grid">
          <span className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="discreto" onClick={aoFechar}>Fechar</Botao>
            {podeEditar ? <Botao variante="contorno" disabled={!!enviando} onClick={() => void enviar("ficou")}>{enviando === "ficou" ? "Salvando…" : "Decidiu ficar"}</Botao> : null}
          </span>
          <span className="flex flex-wrap gap-2 max-md:grid">
            {podeEditar && !tentou ? (
              <Botao variante="secundario" disabled={!!enviando} onClick={() => void enviar("retencao")}>{enviando === "retencao" ? "Salvando…" : "Registrar tentativa e esperar"}</Botao>
            ) : null}
            <Botao variante="primario" disabled={!podeConfirmar || passou || tentativaPorRegistrar || !!enviando} onClick={() => void enviar("confirmar")}>
              <Icone nome="check" />{enviando === "confirmar" ? "Confirmando…" : "Confirmar o cancelamento"}
            </Botao>
          </span>
        </div>
      </form>
    </Dialogo>
  );
}

const TIPOS = opcoesDe(TIPOS_EXPANSAO);
const ETAPAS = (ETAPAS_EXPANSAO_ABERTAS as readonly EtapaExpansao[]).map((e) => ({ valor: e, texto: nomeEtapaExpansao(e) }));

/** Abrir (da sugestão ou do zero) ou mudar uma expansão: motivo, quem atende e o próximo passo. */
export function JanelaExpansao({ e, sugestao, clientes, equipe, eu, hoje, aoFechar, feito }: {
  e?: Expansao; sugestao?: SugestaoExpansao; clientes: ClienteRenovacao[]; equipe: Pessoa[]; eu: string; hoje: string;
  aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [cliente, setCliente] = useState(e?.interessadoId ?? sugestao?.interessadoId ?? "");
  const [tipo, setTipo] = useState<TipoExpansao | null>(e?.tipo ?? sugestao?.tipo ?? null);
  const [etapa, setEtapa] = useState<EtapaExpansao>(e?.etapa ?? "ABERTA");
  const [motivo, setMotivo] = useState(e?.motivo ?? sugestao?.motivo ?? "");
  const [resp, setResp] = useState(e?.responsavel.id ?? (equipe.some((p) => p.id === eu) ? eu : ""));
  const [passo, setPasso] = useState(e?.proximoPasso ?? "");
  const [passoData, setPassoData] = useState(e?.proximoPassoData ?? "");
  const [predio, setPredio] = useState({ condominio: "", cidade: "", uf: "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const lista = tipo === "RECONQUISTA" ? clientes.filter((c) => c.situacao === "ENCERRADO") : clientes.filter((c) => c.situacao !== "ENCERRADO");

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const faltam = [...(!e && !cliente ? ["interessadoId"] : []), ...(!e && !tipo ? ["tipo"] : []), ...(!resp ? ["responsavelId"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const base = { etapa, motivo, responsavelId: resp, proximoPasso: passo, proximoPassoData: passoData || null };
    const res = e
      ? await chamarApi(ROTAS_RENOVACOES.expansao(e.id), { metodo: "PUT", corpo: { versao: e.versao, ...base } })
      : await chamarApi(ROTAS_RENOVACOES.expansoes, {
        corpo: { interessadoId: cliente, tipo, ...base, oportunidade: tipo === "MAIS_UM_PREDIO" ? { condominio: predio.condominio, cidade: predio.cidade || null, uf: predio.uf || null } : null },
      });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(e ? "Expansão salva." : tipo === "MAIS_UM_PREDIO" ? "Expansão aberta. O prédio novo entrou no funil como oportunidade do mesmo contato." : "Expansão aberta.");
  }

  return (
    <Dialogo aberto titulo={e ? `${nomeExpansao(e.tipo)}: ${e.condominio}` : "Abrir expansão"} aoFechar={aoFechar} media
      apoio="Mais um prédio da mesma pessoa, mudança de faixa ou reconquista, num funil próprio (CM-32).">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        {!e ? (
          <>
            <EscolhaBotoes nome="expansao-tipo" legenda="Tipo" opcoes={TIPOS} valor={tipo} aoMudar={setTipo}
              ajuda={campos.includes("tipo") ? <span className="text-erro">Escolha o tipo.</span> : undefined} />
            <CampoSelecao id="expansao-cliente" rotulo="Cliente" value={cliente} onChange={(x) => setCliente(x.target.value)}
              opcoes={[{ valor: "", texto: "Escolha o cliente" }, ...lista.map((c) => ({ valor: c.id, texto: c.condominio }))]}
              erro={erroDe(campos, "interessadoId", "Escolha o cliente.")} />
            {tipo === "MAIS_UM_PREDIO" ? (
              <fieldset className="grid gap-3 rounded-[16px] border border-linha p-4">
                <legend className="px-1 t-texto font-semibold">Prédio novo</legend>
                <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_80px]">
                  <CampoTexto id="expansao-predio" rotulo="Condomínio" maxLength={120} value={predio.condominio} onChange={(x) => setPredio((p) => ({ ...p, condominio: x.target.value }))}
                    erro={erroDe(campos, "condominio", "Diga o nome do condomínio novo.") ?? erroDe(campos, "oportunidade", "Diga o nome do condomínio novo.")} />
                  <CampoTexto id="expansao-cidade" rotulo="Cidade" opcional maxLength={80} value={predio.cidade} onChange={(x) => setPredio((p) => ({ ...p, cidade: x.target.value }))} />
                  <CampoTexto id="expansao-uf" rotulo="UF" opcional maxLength={2} value={predio.uf} onChange={(x) => setPredio((p) => ({ ...p, uf: x.target.value }))}
                    erro={erroDe(campos, "uf", "Duas letras.")} />
                </div>
              </fieldset>
            ) : null}
          </>
        ) : null}
        <CampoTexto id="expansao-motivo" rotulo="Motivo" maxLength={300} value={motivo} onChange={(x) => setMotivo(x.target.value)}
          ajuda="O que mostra a chance: por exemplo, passou de 40 unidades ativas." erro={erroDe(campos, "motivo", "Diga o motivo (de 3 a 300 letras).")} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoSelecao id="expansao-resp" rotulo="Quem atende" value={resp} onChange={(x) => setResp(x.target.value)}
            opcoes={[{ valor: "", texto: "Escolha" }, ...equipe.map((p) => ({ valor: p.id, texto: p.nome }))]} erro={erroDe(campos, "responsavelId", "Escolha quem atende.")} />
          <CampoSelecao id="expansao-etapa" rotulo="Etapa" value={etapa} onChange={(x) => setEtapa(x.target.value as EtapaExpansao)} opcoes={ETAPAS} />
          <CampoTexto id="expansao-passo" rotulo="Próximo passo" maxLength={200} value={passo} onChange={(x) => setPasso(x.target.value)}
            erro={erroDe(campos, "proximoPasso", "Diga o próximo passo.")} />
          <CampoTexto id="expansao-passo-data" rotulo="Quando" opcional type="date" min={hoje} value={passoData} onChange={(x) => setPassoData(x.target.value)}
            erro={erroDe(campos, "proximoPassoData", "De hoje em diante.")} />
        </div>
        {erro?.detalhes?.motivo === "EXPANSAO_ABERTA" ? <Aviso tom="atencao">Este cliente já tem uma expansão deste tipo aberta.</Aviso> : null}
        {erro && !campos.length && erro.detalhes?.motivo !== "EXPANSAO_ABERTA" ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={e ? "Salvar" : "Abrir a expansão"} icone={e ? "check" : "mais"} />
      </form>
    </Dialogo>
  );
}

/** Ganhou ou perdeu. Ganhar a mudança de faixa não muda o plano: a Administração muda na ficha do cliente. */
export function JanelaEncerrarExpansao({ e, aoFechar, feito }: { e: Expansao; aoFechar: () => void; feito: (texto: string) => void }) {
  const [etapa, setEtapa] = useState<"GANHA" | "PERDIDA" | null>(null);
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!etapa) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["etapa"] } });
    setEnviando(true);
    const res = await chamarApi(ROTAS_RENOVACOES.encerrarExpansao(e.id), { corpo: { versao: e.versao, etapa, resultado: resultado.trim() || null } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(etapa === "GANHA" ? "Expansão ganha." : "Expansão encerrada como perdida.");
  }

  return (
    <Dialogo aberto titulo="Encerrar a expansão" aoFechar={aoFechar} apoio={`${nomeExpansao(e.tipo)}: ${e.condominio}.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <EscolhaBotoes nome="encerrar-etapa" legenda="Como terminou" opcoes={[{ valor: "GANHA" as const, texto: "Ganhou" }, { valor: "PERDIDA" as const, texto: "Perdeu" }]}
          valor={etapa} aoMudar={setEtapa} ajuda={campos.includes("etapa") ? <span className="text-erro">Diga se ganhou ou perdeu.</span> : undefined} />
        <CampoAreaTexto id="encerrar-resultado" rotulo="O que aconteceu" opcional={etapa !== "PERDIDA"} maxLength={300} rows={3} value={resultado}
          onChange={(x) => setResultado(x.target.value)} erro={erroDe(campos, "resultado", "Diga o que aconteceu (de 3 a 300 letras).")} />
        {e.tipo === "MUDAR_FAIXA" && etapa === "GANHA" ? <p className="t-apoio">O plano não muda sozinho: a Administração muda o plano na ficha do cliente.</p> : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Encerrar" />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------------------------
// R17.7c (0318; quadros 487 a 491): o cancelamento confirmado (desfazer antes do último dia), o
// aditivo de retorno e o reativar depois dele, e o aditivo de reajuste com as assinaturas.

/** Uma lista com marca: o que volta (ok), o que fecha (atencao) e o que não volta (neutro). */
export function ListaMarcada({ itens, tom, rotulo }: { itens: readonly string[]; tom: "ok" | "atencao" | "neutro"; rotulo: string }) {
  const cor = { ok: "text-ok", atencao: "text-atencao", neutro: "text-tinta-suave" }[tom];
  return (
    <ul className="grid" aria-label={rotulo}>
      {itens.map((t) => (
        <li key={t} className="flex items-start gap-2.5 border-t border-linha py-2 t-texto first:border-t-0">
          <Icone nome={tom === "ok" ? "check" : "cadeado"} className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const TITULO_FECHADO: Partial<Record<Cancelamento["situacao"], string>> = {
  CONFIRMADO: "Cancelamento confirmado", ENCERRADO: "Cancelamento encerrado", DESFEITO: "Cancelamento desfeito", REATIVADO: "Cliente reativado",
};

/**
 * O cancelamento confirmado (quadro 487) e os estados do 491: antes do último dia, a Administração
 * desfaz com a nota de quem pediu e como; depois dele, a volta é pela página Reativar.
 */
export function JanelaCancelamentoFechado({ k, hoje, pode, aoFechar, feito }: {
  k: Cancelamento; hoje: string; pode: TelaRenovacoes["pode"]; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const desfaz = podeDesfazer(k, pode, hoje);
  const passou = passouUltimoDia(k, hoje);
  const confirmadoEm = k.decididoEm ? ` · confirmado em ${k.decididoEm.slice(8, 10)}/${k.decididoEm.slice(5, 7)}` : "";

  async function desfazer(ev: FormEvent) {
    ev.preventDefault();
    if (!desfaz) return;
    setErro(null);
    const n = nota.trim();
    if (n.length < 3 || n.length > 300) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["nota"] } });
    setEnviando(true);
    const res = await chamarApi<{ cancelamento: Cancelamento }>(ROTAS_RENOVACOES.desfazer(k.id), { corpo: { versao: k.versao, nota: n } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(`Cancelamento desfeito. O ${k.condominio} segue com tudo, sem nada para religar.`);
  }

  return (
    <Dialogo aberto titulo={TITULO_FECHADO[k.situacao] ?? "Cancelamento"} aoFechar={aoFechar} larga
      apoio={`${k.condominio}${confirmadoEm}, último dia ${k.ultimoDia.slice(8, 10)}/${k.ultimoDia.slice(5, 7)} (CM-31).`}>
      <form onSubmit={desfazer} className="grid gap-4" noValidate>
        <dl className="grid rounded-[16px] border border-linha px-4">
          <Linha nome="Cliente">{textoPlanoCancelamento(k)}</Linha>
          <Linha nome="Confirmado">{textoConfirmado(k)}</Linha>
          <Linha nome="Último dia">{textoUltimoDiaConfirmado(k, hoje)}</Linha>
          <Linha nome="Exportação">{textoExportacao(k)}</Linha>
        </dl>
        {k.situacao === "DESFEITO" ? <Aviso tom="ok" titulo="Desfeito">{textoDesfeito(k)}</Aviso> : null}
        {k.situacao === "REATIVADO" ? <Aviso tom="ok" titulo="Cliente de novo">{textoReativado(k)}</Aviso> : null}
        {k.situacao === "ENCERRADO" || (k.situacao === "CONFIRMADO" && passou) ? (
          <Aviso tom="info" titulo="O último dia passou">
            Desfazer não aparece mais. A volta é por Reativar, com o aditivo de retorno assinado pelos dois.
            <span className="mt-2 block">
              <Link href={telaReativar(k.id)} className={classeBotao("secundario")}><Icone nome="retorno" />Reativar o cliente</Link>
            </span>
          </Aviso>
        ) : null}
        {k.situacao === "CONFIRMADO" && !passou && desfaz ? (
          <>
            <div className="grid gap-1">
              <h3 className="t-titulo-cartao">O síndico desistiu de cancelar?</h3>
              <p className="t-apoio">Até o último dia, a Administração pode desfazer o cancelamento. O contrato de hoje continua.</p>
            </div>
            <CampoAreaTexto id="desfazer-nota" rotulo="Quem pediu para desfazer e como" maxLength={300} rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Ana Ribeiro, síndica, pelo WhatsApp comercial em 30/10" ajuda="Obrigatório. Fica no histórico do cliente."
              erro={erroDe(campos, "nota", "Diga quem pediu para desfazer e como (de 3 a 300 letras).")} />
            <section aria-labelledby="ao-desfazer" className="grid gap-1 rounded-[16px] border border-linha px-4 py-3">
              <h3 id="ao-desfazer" className="t-titulo-cartao">Ao desfazer</h3>
              <ListaMarcada itens={AO_DESFAZER} tom="ok" rotulo="O que acontece ao desfazer" />
            </section>
          </>
        ) : null}
        {k.situacao === "CONFIRMADO" && !passou && !desfaz ? (
          <p className="t-apoio">O Comercial vê o pedido e a volta, mas desfazer, gerar o aditivo e reativar são da Administração.</p>
        ) : null}
        {erro?.detalhes?.motivo === "ULTIMO_DIA_PASSOU" ? (
          <Aviso tom="atencao" papel="alert">O último dia já passou. Desfazer não dá mais: a volta é por Reativar, com o aditivo de retorno.</Aviso>
        ) : erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Fechar</Botao>
          {desfaz ? (
            <Botao type="submit" disabled={enviando}><Icone nome="retorno" />{enviando ? "Desfazendo…" : "Desfazer o cancelamento"}</Botao>
          ) : null}
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Gerar o aditivo de retorno (quadro 488): quem assina pelo condomínio, o CPF, a competência em que a
 * cobrança volta e o ciclo. O valor, só na faixa sob consulta (acima de 400 unidades); o motivo, ao
 * gerar de novo (as assinaturas começam do zero).
 */
export function JanelaGerarRetorno({ k, hoje, sobConsulta, aoFechar, feito }: {
  k: Cancelamento; hoje: string; sobConsulta?: boolean; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const deNovo = !!k.retorno && k.retorno.situacao !== "SUBSTITUIDO";
  const opcoes = competenciasRetorno(hoje);
  const [representante, setRepresentante] = useState("");
  const [cpf, setCpf] = useState("");
  const [competencia, setCompetencia] = useState(opcoes[1]?.valor ?? opcoes[0]!.valor);
  const [ciclo, setCiclo] = useState<"MENSAL" | "ANUAL" | null>("MENSAL");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pedeValor, setPedeValor] = useState(!!sobConsulta);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const v = pedeValor ? centavosDoCampo(valor) : { centavos: null };
    const dados = { representante, cpf, competencia, ciclo, valorCentavos: "centavos" in v ? v.centavos : null, motivo };
    const o = { deNovo, sobConsulta: pedeValor };
    const faltam = problemasRetorno(dados, o);
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const res = await chamarApi<{ aditivo: AditivoResumo }>(ROTAS_RENOVACOES.gerarRetorno(k.id), { corpo: corpoRetorno(dados, o) });
    setEnviando(false);
    if (!res.ok) {
      if (camposComErro(res.erro).includes("valorCentavos")) setPedeValor(true);
      return setErro(res.erro);
    }
    const a = res.dados.aditivo;
    if (a?.situacao === "GERANDO") return feito("O aditivo foi gravado, mas o PDF não ficou pronto. Gere de novo.");
    feito(deNovo ? "Aditivo gerado de novo. As duas assinaturas começam do zero; o anterior fica guardado como substituído."
      : `Aditivo de retorno ${a?.numero ? `nº ${a.numero} ` : ""}gerado. Baixe o PDF e mande ao síndico para assinar pelo gov.br.`);
  }

  return (
    <Dialogo aberto titulo={deNovo ? "Gerar o aditivo de novo" : "Gerar o aditivo de retorno"} aoFechar={aoFechar} media
      apoio={`${k.condominio}: a volta é um aditivo ao contrato antigo, com o plano do dia e a data da volta.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">
          {deNovo
            ? "Gerar de novo (por exemplo, para corrigir um dado) cria um PDF novo e pede as duas assinaturas outra vez; o anterior fica guardado como substituído."
            : "O plano vem da Tabela de preços do dia, pela faixa de unidades, na tabela cheia, sem fundador e sem desconto."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="retorno-representante" rotulo="Quem assina pelo condomínio" maxLength={120} placeholder="Paulo Mendes, síndico" value={representante}
            onChange={(e) => setRepresentante(e.target.value)} autoComplete="off" erro={erroDe(campos, "representante", "Diga o nome de quem assina pelo condomínio.")} />
          <CampoTexto id="retorno-cpf" rotulo="CPF de quem assina" inputMode="numeric" maxLength={14} value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))}
            autoComplete="off" ajuda="Vai no aditivo; nas telas aparece mascarado." erro={erroDe(campos, "cpf", "Confira o CPF: os números não batem.")} />
          <CampoSelecao id="retorno-competencia" rotulo="Cobrança volta na competência" value={competencia} onChange={(e) => setCompetencia(e.target.value)} opcoes={opcoes}
            erro={erroDe(campos, "competencia", "Escolha uma competência de hoje a 6 meses.")} />
          {pedeValor ? (
            <CampoTexto id="retorno-valor" rotulo="Valor combinado por mês (R$)" inputMode="decimal" maxLength={12} placeholder="1.290,00" value={valor}
              onChange={(e) => setValor(e.target.value)} ajuda="Fora da tabela (acima de 400 unidades), o valor é combinado com a Administração."
              erro={erroDe(campos, "valorCentavos", "Diga o valor combinado, em reais.")} />
          ) : null}
        </div>
        <EscolhaBotoes nome="retorno-ciclo" legenda="Ciclo" opcoes={[{ valor: "MENSAL" as const, texto: "Mensal" }, { valor: "ANUAL" as const, texto: "Anual" }]} valor={ciclo} aoMudar={setCiclo}
          ajuda={campos.includes("ciclo") ? <span className="text-erro">Escolha o ciclo.</span> : undefined} />
        {deNovo ? (
          <CampoAreaTexto id="retorno-motivo" rotulo="Por que gerar de novo" maxLength={300} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            ajuda="Fica no histórico do aditivo." erro={erroDe(campos, "motivo", "Diga por que gerar de novo (as assinaturas começam do zero).")} />
        ) : null}
        {erro?.detalhes?.motivo === "SEM_MODELO_RETORNO" ? (
          <Aviso tom="atencao" papel="alert">Nenhuma versão do aditivo de retorno está em uso. Cadastre o texto do advogado em Modelos › Aditivo › Retorno.</Aviso>
        ) : erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={deNovo ? "Gerar de novo" : "Gerar o aditivo"} icone="documento" perigo={deNovo} />
      </form>
    </Dialogo>
  );
}

/** Reativar (quadro 488): só com o aditivo de retorno assinado pelos dois e conferido. */
export function JanelaReativar({ k, aoFechar, feito }: { k: Cancelamento; aoFechar: () => void; feito: (texto: string) => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const vale = k.retorno?.dados?.campos?.vale_desde;

  async function reativar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<{ cancelamento: Cancelamento }>(ROTAS_RENOVACOES.reativar(k.id), { corpo: { versao: k.versao } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito(`${k.condominio} reativado. O acesso volta no modo completo${vale ? ` e a cobrança volta na competência ${vale}` : ""}.`);
  }

  return (
    <Dialogo aberto titulo="Reativar o cliente" aoFechar={aoFechar} media apoio={`${k.condominio} · aditivo de retorno nº ${k.retorno?.numero ?? ""}`}>
      <form onSubmit={reativar} className="grid gap-4" noValidate>
        <p className="t-texto">{`O último dia (${k.ultimoDia.slice(8, 10)}/${k.ultimoDia.slice(5, 7)}/${k.ultimoDia.slice(0, 4)}) é revogado e fica no histórico. A reconquista aberta fica Ganha e o cliente volta para Reajuste e renovação.`}</p>
        <ListaMarcada itens={AO_REATIVAR_VOLTA} tom="ok" rotulo="O que volta" />
        {erro?.detalhes?.motivo === "ADITIVO_SEM_ASSINATURAS" ? (
          <Aviso tom="atencao" papel="alert">O aditivo de retorno ainda não está assinado pelos dois e conferido.</Aviso>
        ) : erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Reativar o cliente" icone="retorno" />
      </form>
    </Dialogo>
  );
}

/**
 * O aditivo de reajuste (R17.7b, parte de software): o PDF e as assinaturas pelo gov.br. O reajuste
 * continua valendo pelo aviso; a assinatura só fica registrada no aditivo.
 */
export function JanelaAditivoReajuste({ r, pode, aoFechar, abrir }: {
  r: Renovacao; pode: TelaRenovacoes["pode"]; aoFechar: () => void; abrir: (j: JanelaAssinatura) => void;
}) {
  const b = useBaixar();
  const a = r.aditivo!;
  return (
    <Dialogo aberto titulo={`Aditivo nº ${a.numero}`} aoFechar={aoFechar} larga apoio={`${r.condominio}: aditivo do reajuste (CM-13, CM-30).`}>
      <div className="grid gap-4">
        <Aviso tom="info" titulo="O reajuste vale pelo aviso">
          {`O valor novo vale pelo aviso${r.aviso ? ` de ${r.aviso.em.slice(8, 10)}/${r.aviso.em.slice(5, 7)}/${r.aviso.em.slice(0, 4)}` : ""}, com ou sem estas assinaturas. Assinar pelo gov.br só fica registrado no aditivo.`}
        </Aviso>
        <dl className="grid rounded-[16px] border border-linha px-4">
          <Linha nome="Com reajuste">{textoComReajuste(r)}</Linha>
          {r.valeDesde ? <Linha nome="Vale desde">{`Competência ${r.valeDesde.slice(5, 7)}/${r.valeDesde.slice(0, 4)}`}</Linha> : null}
          <Linha nome="Impressão digital"><span className="t-codigo" title={a.hash}>{`sha256 ${hashCurto(a.hash)}`}</span></Linha>
        </dl>
        <div className="flex flex-wrap gap-2 max-md:grid">
          <Botao variante="contorno" disabled={a.situacao !== "PRONTO" || !!b.baixando} onClick={() => r.id && void b.baixar(ROTAS_RENOVACOES.linkAditivo(r.id))}>
            <Icone nome="baixar" />Baixar o PDF do aditivo
          </Botao>
        </div>
        {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
        <CartaoAssinaturasAditivo id="reajuste-assinaturas" aditivo={a} quemCondominio="O síndico" podeEditar={pode.editar} podeAssinar={!!(pode.assinar ?? pode.confirmar)}
          abrir={abrir} nota="No aditivo de reajuste, a assinatura só fica registrada: o reajuste continua valendo pelo aviso." />
        <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
      </div>
    </Dialogo>
  );
}
