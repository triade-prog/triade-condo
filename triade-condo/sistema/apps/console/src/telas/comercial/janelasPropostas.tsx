"use client";
// As janelas das propostas (quadros 326, 327 e 337): aprovar ou recusar o desconto (só quem tem a
// ação console.comercial.desconto, a Administração), revogar o link, registrar que o síndico disse
// não, escolher o interessado da nova proposta e mandar o link pelo WhatsApp comercial, que abre o
// WhatsApp com o texto pronto e registra a conversa. Nada sai sozinho: a pessoa aperta enviar.

import { useState, type FormEvent, type ReactNode } from "react";
import { ETAPAS_ABERTAS, linkWhatsappComercial, mostrarValor } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, type ErroApi } from "@triade/ui";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { diaHora } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { ROTAS_COMERCIAL } from "./comum.tsx";
import { JanelaConversa } from "./janelas.tsx";
import { NOMES_CICLO, percentual, ROTAS_PROPOSTAS, textoDesconto, textoNoAno, type FichaProposta, type VersaoProposta } from "./propostas.ts";
import type { FichaInteressado, ListaComercial } from "./tipos.ts";

const NOMES_TABELA: Record<string, string> = { FUNDADOR: "fundador", CHEIA: "tabela cheia", MANUAL: "sob consulta" };

/** Uma linha de dado da janela. */
function Linha({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t border-linha py-2.5 first:border-t-0 md:grid-cols-[130px_minmax(0,1fr)] md:gap-4">
      <dt className="t-apoio text-tinta-suave">{nome}</dt>
      <dd className="t-texto [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Aprovar desconto (quadro 327, F.1): a proposta só sai depois desta resposta. */
export function JanelaAprovarDesconto({ f, v, aoFechar, feito }: { f: FichaProposta; v: VersaoProposta; aoFechar: () => void; feito: (texto: string) => void }) {
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState<"aprovar" | "recusar" | null>(null);
  const campos = camposComErro(erro);
  const pedido = v.descontoPedido;
  const pct = pedido?.percentual ?? v.desconto ?? 0;
  const ano = textoNoAno(v, v.mensal);

  async function responder(acao: "aprovar" | "recusar") {
    setErro(null);
    if (acao === "recusar" && resposta.trim().length < 2) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["resposta"] } });
    setEnviando(acao);
    const r = await chamarApi(ROTAS_PROPOSTAS.acao(f.id, v.id, acao === "aprovar" ? "desconto/aprovar" : "desconto/recusar"),
      { corpo: { versao: v.versaoRegistro, resposta: resposta.trim() || null } });
    setEnviando(null);
    if (!r.ok) return setErro(r.erro);
    feito(acao === "aprovar" ? `Desconto aprovado. A v${v.numero} está pronta para enviar.` : `Desconto recusado. A v${v.numero} voltou para rascunho.`);
  }

  const submeter = (ev: FormEvent) => { ev.preventDefault(); void responder("aprovar"); };

  return (
    <Dialogo aberto titulo="Aprovar desconto" aoFechar={aoFechar} media apoio="A proposta só pode ser enviada depois desta resposta (F.1).">
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        <dl className="grid rounded-[14px] border border-linha px-4 py-1">
          <Linha nome="Proposta">{`${f.interessado.condominio} · v${v.numero} · ${NOMES_CICLO[v.ciclo].toLowerCase()} · ${NOMES_TABELA[v.tabela ?? "CHEIA"]}`}</Linha>
          <Linha nome="Pedido por">{pedido ? `${pedido.pedidoPor?.nome ?? "Comercial"} (Comercial) · ${diaHora(pedido.pedidoEm)}` : "—"}</Linha>
          <Linha nome="Desconto">{textoDesconto(pct, v.mensalTabela, v.mensal)}</Linha>
          <Linha nome="Motivo">{pedido?.motivo ?? "—"}</Linha>
          {ano ? <Linha nome="No ano">{ano}</Linha> : null}
          {v.porApartamento !== undefined ? <Linha nome="Por apartamento">{`${mostrarValor(v.porApartamento)} por mês (estimativa)`}</Linha> : null}
        </dl>
        <CampoAreaTexto id="desconto-resposta" rotulo="Resposta para quem pediu" opcional maxLength={500} value={resposta} onChange={(e) => setResposta(e.target.value)}
          ajuda="Fica no histórico do interessado. Para recusar, ela é obrigatória." erro={campos.includes("resposta") ? "Para recusar, escreva a resposta para quem pediu." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 max-md:grid">
          <span className="t-apoio">Só a Administração aprova.</span>
          <span className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="discreto" disabled={!!enviando} onClick={() => void responder("recusar")}><Icone nome="fechar" />{enviando === "recusar" ? "Recusando…" : "Recusar"}</Botao>
            <Botao type="submit" disabled={!!enviando}><Icone nome="check" />{enviando === "aprovar" ? "Aprovando…" : "Aprovar desconto"}</Botao>
          </span>
        </div>
        <p className="t-apoio">{`Desconto pedido: ${percentual(pct)}.`}</p>
      </form>
    </Dialogo>
  );
}

/** Revogar o link ou registrar que o síndico disse não: os dois pedem o motivo. */
export function JanelaMotivo({ titulo, apoio, botao, rotulo, maximo, aoConfirmar, aoFechar }: {
  titulo: string; apoio: string; botao: string; rotulo: string; maximo: number; aoConfirmar: (motivo: string) => Promise<ErroApi | null>; aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    if (motivo.trim().length < 3) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["motivo"] } });
    setEnviando(true);
    const e = await aoConfirmar(motivo.trim());
    setEnviando(false);
    if (e) setErro(e);
  }
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar} media apoio={apoio}>
      <form onSubmit={confirmar} className="grid gap-4" noValidate>
        <CampoAreaTexto id="proposta-motivo" rotulo={rotulo} maxLength={maximo} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={campos.includes("motivo") ? "Escreva o motivo, com 3 letras ou mais." : undefined} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={botao} icone="alerta" perigo />
      </form>
    </Dialogo>
  );
}

/** Nova proposta pela lista: escolher o interessado (as propostas nascem da ficha). */
export function JanelaEscolherInteressado({ aoFechar, aoEscolher }: { aoFechar: () => void; aoEscolher: (id: string) => void }) {
  const carga = useCarregar<ListaComercial>(ROTAS_COMERCIAL.lista);
  const [id, setId] = useState("");
  const [falta, setFalta] = useState(false);
  const abertos = carga.estado === "pronto" ? carga.dados.interessados.filter((i) => ETAPAS_ABERTAS.includes(i.etapa) && !i.anonimizado) : [];
  return (
    <Dialogo aberto titulo="Nova proposta" aoFechar={aoFechar} media apoio="A proposta nasce do interessado: as unidades e o prédio vêm da ficha.">
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); if (!id) return setFalta(true); aoEscolher(id); }}>
        {carga.estado === "carregando" ? <Carregando /> : null}
        {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
        {carga.estado === "pronto" ? (
          abertos.length ? (
            <CampoSelecao id="np-interessado" rotulo="Interessado" value={id} onChange={(e) => { setId(e.target.value); setFalta(false); }}
              opcoes={[{ valor: "", texto: "Escolha" }, ...abertos.map((i) => ({ valor: i.id, texto: i.condominio }))]} erro={falta ? "Escolha o interessado." : undefined} />
          ) : <Aviso tom="info">Nenhum interessado aberto. A proposta nasce de um interessado do funil.</Aviso>
        ) : null}
        <RodapeJanela aoFechar={aoFechar} enviando={false} texto="Montar a proposta" icone="dir" />
      </form>
    </Dialogo>
  );
}

/**
 * Mandar pelo WhatsApp comercial: mostra o texto com o link, abre o WhatsApp (a pessoa aperta
 * enviar) e depois registra a conversa na ficha, como as mensagens prontas.
 */
export function JanelaMandarWhatsapp({ interessado, texto, aoFechar, feito }: {
  interessado: FichaInteressado | null; texto: string; aoFechar: () => void; feito: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (aberto && interessado) {
    return <JanelaConversa i={interessado} inicial={{ canal: "WHATSAPP", resumo: texto }} aoFechar={aoFechar} feito={feito} />;
  }
  const pode = !!interessado?.temWhatsapp && !!interessado.whatsapp;
  return (
    <Dialogo aberto titulo="Mandar pelo WhatsApp comercial" aoFechar={aoFechar} media apoio="Abre o WhatsApp com o texto pronto; você aperta enviar. Depois, a conversa fica registrada.">
      <div className="grid gap-4">
        <p className="rounded-[14px] border border-violeta-200 bg-violeta-50 px-3 py-2.5 t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">{texto}</p>
        {!pode ? (
          <Aviso tom="atencao">
            {interessado?.naoContatar ? "Este contato pediu para não ser procurado." : !interessado?.whatsapp ? "Sem WhatsApp na ficha. Copie o link e mande por outro canal."
              : "Sem o aceite de mensagens pelo WhatsApp. Registre o aceite na ficha ou copie o link e mande por outro canal."}
          </Aviso>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao disabled={!pode} onClick={() => { window.open(linkWhatsappComercial(interessado!.whatsapp!, texto), "_blank", "noopener"); setAberto(true); }}>
            <Icone nome="whats" />Abrir no WhatsApp
          </Botao>
        </div>
      </div>
    </Dialogo>
  );
}
