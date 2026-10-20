"use client";
// Pedidos relacionados (F7.4; design "Reincidência e decisões", tela 1; AT-18, TR-01): os
// parecidos que o sistema sugere (mesma categoria e mesmo local ou unidade, na janela das Regras),
// os já ligados e ligar a outro pedido pelo protocolo. Nada fica ligado sem alguém confirmar;
// cada pedido segue com o seu protocolo, o seu histórico e o seu retorno ao morador.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { rotuloLigacao, TIPOS_LIGACAO, type TipoLigacao } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, classeBotao, Dialogo, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import type { FilaPedidos, LigacaoPedido, PedidoDetalhe, PedidoParecido } from "../tipos.ts";
import { dia, diaHora, SeloEstadoPedido } from "./comum.tsx";

type Pedido = PedidoDetalhe["pedido"];

/** O mais novo de dois pedidos é o que se liga ao outro: pela abertura e, no empate, pelo protocolo. */
const ehMaisNovo = (a: { abertoEm: string; protocolo: string }, b: { abertoEm: string; protocolo: string }) =>
  a.abertoEm > b.abertoEm || (a.abertoEm === b.abertoEm && a.protocolo > b.protocolo);

const ativo = (estado: string) => estado === "ABERTO" || estado === "EM_ANDAMENTO";

function SeloSituacao({ p }: { p: { estado: Pedido["estado"]; encerradoEm?: string | null } }) {
  return p.estado === "ENCERRADO" && p.encerradoEm ? <Selo tom="ok">Concluído em {dia(p.encerradoEm)}</Selo> : <SeloEstadoPedido estado={p.estado} />;
}

function abertoQuando(iso: string, agora: string): string {
  return dia(iso) === dia(agora) ? `aberto hoje às ${diaHora(iso).slice(6)}` : `aberto em ${dia(iso)}`;
}

/** Linha de um pedido relacionado, com as ações ao lado (quebra para baixo no celular). */
function Linha({ titulo, detalhe, children }: { titulo: React.ReactNode; detalhe: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <span className="grid min-w-0 gap-0.5 text-sm">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">{titulo}</span>
        <span className="text-xs text-tinta-suave">{detalhe}</span>
      </span>
      {children ? <span className="flex flex-wrap gap-2">{children}</span> : null}
    </li>
  );
}

interface Props {
  d: PedidoDetalhe;
  podeConcluir: boolean;
  salvo: (texto: string) => void;
  recarregar: () => void;
}

export function PedidosRelacionados({ d, podeConcluir, salvo, recarregar }: Props) {
  const p = d.pedido;
  const rel = d.relacionados;
  const [ligar, setLigar] = useState<{ outro: PedidoParecido; tipo: TipoLigacao; trocarTipo: boolean } | null>(null);
  const [desfazer, setDesfazer] = useState<LigacaoPedido | null>(null);
  const [buscar, setBuscar] = useState(false);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  if (!rel) return null;
  const podeLigar = d.pode.ligar === true;
  if (!podeLigar && !rel.ligados.length) return null;

  async function descartar(o: PedidoParecido) {
    setFalha(null);
    const r = await chamarApi(`/v1/condominio/pedidos/${p.id}/parecidos/descartar`, { corpo: { outroId: o.id } });
    if (!r.ok) return setFalha(r.erro);
    salvo(`Sugestão descartada: o ${o.protocolo} não aparece mais como parecido deste pedido.`);
  }

  return (
    <section aria-labelledby="t-relacionados" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-relacionados" className="text-lg font-medium">Pedidos relacionados</h2>
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={recarregar} /> : null}
      {podeLigar && rel.parecidos.length ? (
        <div className="grid gap-1 rounded-2xl bg-superficie-2 px-3 pt-3">
          <h3 className="text-sm font-medium">Parecidos nos últimos {rel.dias} dias</h3>
          <p className="text-xs text-tinta-suave">Mesma categoria e mesmo local ou unidade. É só uma sugestão: nada fica ligado sem alguém confirmar.</p>
          <ul className="divide-y divide-linha">
            {rel.parecidos.map((o) => (
              <Linha key={o.id}
                titulo={<><span className="font-mono text-tinta-suave">{o.protocolo}</span> {o.assunto} <SeloSituacao p={o} /></>}
                detalhe={[o.categoria, o.onde, abertoQuando(o.abertoEm, d.agora)].filter(Boolean).join(" · ")}>
                {o.podeReincidencia ? (
                  <Botao variante="secundario" tamanho="m" aria-label={`${o.protocolo} é reincidência`}
                    onClick={() => setLigar({ outro: o, tipo: "REINCIDENCIA", trocarTipo: false })}>É reincidência</Botao>
                ) : null}
                <Botao variante={o.podeReincidencia ? "contorno" : "secundario"} tamanho="m" aria-label={`${o.protocolo} é duplicado`}
                  onClick={() => setLigar({ outro: o, tipo: "DUPLICADO", trocarTipo: false })}>É duplicado</Botao>
                <Botao variante="discreto" tamanho="m" aria-label={`${o.protocolo} não é o mesmo problema`} onClick={() => void descartar(o)}>Não é</Botao>
              </Linha>
            ))}
          </ul>
        </div>
      ) : null}
      {rel.ligados.length ? (
        <div className="grid gap-1">
          <h3 className="text-xs font-medium tracking-[.1em] text-tinta-suave uppercase">Ligados</h3>
          <ul className="divide-y divide-linha">
            {rel.ligados.map((l) => (
              <Linha key={l.id}
                titulo={<><Selo tom={l.tipo === "REINCIDENCIA" ? "atencao" : "info"}>{rotuloLigacao(l.tipo, l.papel)}</Selo>
                  <span className="font-mono text-tinta-suave">{l.pedido.protocolo}</span> {l.pedido.assunto}</>}
                detalhe={[
                  l.pedido.estado === "ENCERRADO" && l.pedido.encerradoEm ? `Concluído em ${dia(l.pedido.encerradoEm)}` : null,
                  `ligado${l.por ? ` por ${l.por}` : ""} em ${dia(l.em)}`,
                  `“${l.motivo}”`,
                ].filter(Boolean).join(" · ")}>
                <Link href={`/pedidos/pedido?id=${l.pedido.id}`} className={classeBotao("discreto", "", "m")} aria-label={`Abrir o pedido ${l.pedido.protocolo}`}>Abrir</Link>
                {podeLigar ? (
                  <Botao variante="discreto" tamanho="m" aria-label={`Desfazer a ligação com ${l.pedido.protocolo}`} onClick={() => setDesfazer(l)}>Desfazer</Botao>
                ) : null}
              </Linha>
            ))}
          </ul>
        </div>
      ) : null}
      {podeLigar && !rel.parecidos.length && !rel.ligados.length ? (
        <p className="text-sm text-tinta-suave">Nenhum pedido parecido nos últimos {rel.dias} dias.</p>
      ) : null}
      <p className="text-xs text-tinta-suave">
        Cada pedido continua com o seu protocolo, o seu histórico e o seu retorno ao morador. Reincidência é sinal para investigar a causa, não a causa confirmada.
      </p>
      {podeLigar ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => setBuscar(true)}>Ligar a outro pedido</Botao> : null}

      {/* Ligado à mão, o tipo se escolhe dentro: o título fica com o protocolo. */}
      <Dialogo aberto={ligar !== null} aoFechar={() => setLigar(null)}
        titulo={!ligar ? "Ligar pedidos" : ligar.trocarTipo ? `Ligar ao ${ligar.outro.protocolo}` : `Ligar como ${TIPOS_LIGACAO[ligar.tipo].toLowerCase()}`}>
        {ligar ? (
          <LigarPedido key={`${ligar.outro.id}-${ligar.tipo}`} atual={p} outro={ligar.outro} tipoInicial={ligar.tipo} trocarTipo={ligar.trocarTipo}
            podeConcluir={podeConcluir} aoFechar={() => setLigar(null)} recarregar={recarregar}
            salvo={(t) => { setLigar(null); salvo(t); }} />
        ) : null}
      </Dialogo>

      <Dialogo aberto={buscar} titulo="Ligar a outro pedido" aoFechar={() => setBuscar(false)}>
        {buscar ? (
          <BuscarPedido atual={p} ligados={rel.ligados.map((l) => l.pedido.id)} aoFechar={() => setBuscar(false)}
            aoEscolher={(o) => { setBuscar(false); setLigar({ outro: o, tipo: o.podeReincidencia ? "REINCIDENCIA" : "DUPLICADO", trocarTipo: true }); }} />
        ) : null}
      </Dialogo>

      <Janela aberto={desfazer !== null} titulo={desfazer ? `Desfazer a ligação com ${desfazer.pedido.protocolo}` : "Desfazer a ligação"}
        campos={[{ id: "motivo", rotulo: "Por que desfazer", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Desfazer a ligação" aoFechar={() => setDesfazer(null)} recarregar={recarregar}
        explicacao="Os dois pedidos ficam com a ligação e o desfazer no histórico. A reincidência sai do indicador."
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/pedidos/${p.id}/ligacoes/${desfazer?.id}/desfazer`, { corpo: { versao: p.versao, motivo: String(v.motivo ?? "").trim() } });
          if (r.ok) { setDesfazer(null); salvo("Ligação desfeita."); }
          return r;
        }} />
    </section>
  );
}

/** Ligar como reincidência ou duplicado. O duplicado aberto pode ser encerrado com um retorno pronto ao morador. */
function LigarPedido({ atual, outro, tipoInicial, trocarTipo, podeConcluir, aoFechar, salvo, recarregar }: {
  atual: Pedido; outro: PedidoParecido; tipoInicial: TipoLigacao; trocarTipo: boolean; podeConcluir: boolean;
  aoFechar: () => void; salvo: (texto: string) => void; recarregar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoLigacao>(tipoInicial);
  const atualNovo = ehMaisNovo(atual, outro);
  const novo = atualNovo ? { protocolo: atual.protocolo, estado: atual.estado } : outro;
  const antigo = atualNovo ? outro : { protocolo: atual.protocolo, encerradoEm: atual.encerradoEm };
  const podeEncerrar = podeConcluir && ativo(novo.estado);
  const [motivo, setMotivo] = useState("");
  const [encerrar, setEncerrar] = useState(podeEncerrar);
  const [texto, setTexto] = useState(`Olá. O problema que você relatou já está sendo tratado no protocolo ${antigo.protocolo}. Vamos dar notícias por lá também.`);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const duplicado = tipo === "DUPLICADO";
  const ondeOutro = outro.onde ? ` (${outro.onde})` : "";

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const fechar = duplicado && podeEncerrar && encerrar;
    const r = await chamarApi(`/v1/condominio/pedidos/${atual.id}/ligacoes`, {
      corpo: { versao: atual.versao, outroId: outro.id, tipo, motivo: motivo.trim(), encerrar: fechar, texto: fechar ? texto.trim() : null, versaoOutro: outro.versao },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(duplicado
      ? fechar ? `Ligado como duplicado. O ${novo.protocolo} foi encerrado e o morador recebe o retorno.` : "Ligado como duplicado."
      : "Ligado como reincidência. Conta no indicador do período.");
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      {trocarTipo ? (
        <Escolha rotulo="Como ligar" atual={tipo} aoMudar={setTipo}
          opcoes={(outro.podeReincidencia ? (["REINCIDENCIA", "DUPLICADO"] as const) : (["DUPLICADO"] as const)).map((t) => ({ valor: t, texto: TIPOS_LIGACAO[t] }))} />
      ) : null}
      {duplicado ? (
        <p className="text-sm">
          {atualNovo
            ? <>Este pedido <b className="font-medium">{atual.protocolo}</b> é o mesmo problema que o <b className="font-medium">{outro.protocolo}</b>{ondeOutro}, relatado de novo. O {outro.protocolo} segue como o principal.</>
            : <>O pedido <b className="font-medium">{outro.protocolo}</b>{ondeOutro} é o mesmo problema que este, relatado de novo. O {atual.protocolo} segue como o principal.</>}
        </p>
      ) : (
        <p className="text-sm">
          {atualNovo ? "Este pedido " : "O pedido "}<b className="font-medium">{novo.protocolo}</b> fica marcado como reincidência de{" "}
          <b className="font-medium">{antigo.protocolo}</b>{antigo.encerradoEm ? `, concluído em ${dia(antigo.encerradoEm)}` : ""}. O problema voltou depois de resolvido.
        </p>
      )}
      <CampoAreaTexto id="lig-motivo" rotulo="O que faz pensar que é o mesmo problema" required maxLength={300} rows={3} value={motivo}
        onChange={(e) => setMotivo(e.target.value)} erro={comErro.includes("motivo") ? "Escreva de 3 a 300 caracteres." : null} />
      {duplicado && podeEncerrar ? (
        <div className="grid gap-2 rounded-2xl border border-linha p-3">
          <Caixa id="lig-encerrar" rotulo={`Encerrar o ${novo.protocolo} e avisar o morador`} marcada={encerrar} aoMudar={setEncerrar} />
          {encerrar ? (
            <CampoAreaTexto id="lig-texto" rotulo="Retorno ao morador" required maxLength={2000} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
              erro={comErro.includes("texto") ? "Escreva ao morador (10 a 2000 caracteres)." : null} />
          ) : null}
          <p className="text-xs text-tinta-suave">O texto pode ser mudado. Desligado, o duplicado fica aberto e segue o seu próprio prazo.</p>
        </div>
      ) : null}
      {!duplicado ? <p className="text-xs text-tinta-suave">Fica no histórico dos dois pedidos e conta no indicador de reincidência. Pode ser desfeito, com motivo.</p>
        : <p className="text-xs text-tinta-suave">Fica no histórico dos dois pedidos. Duplicado não conta no indicador de reincidência. Pode ser desfeito, com motivo.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Ligando…" : duplicado ? "Ligar como duplicado" : "Ligar"}</Botao>
      </div>
    </form>
  );
}

/** Ligar à mão: busca pelo protocolo ou pelo assunto, em todos os pedidos que a pessoa vê. */
function BuscarPedido({ atual, ligados, aoFechar, aoEscolher }: {
  atual: Pedido; ligados: string[]; aoFechar: () => void; aoEscolher: (o: PedidoParecido) => void;
}) {
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<FilaPedidos["itens"] | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function procurar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (busca.trim().length < 2) return setAchados([]);
    setBuscando(true);
    const r = await chamarApi<FilaPedidos>(`/v1/condominio/pedidos?situacao=TODOS&busca=${encodeURIComponent(busca.trim())}`);
    setBuscando(false);
    if (!r.ok) return setErro(r.erro);
    setAchados(r.dados.itens.filter((x) => x.id !== atual.id && x.estado !== "CANCELADO" && !ligados.includes(x.id)));
  }

  async function escolher(id: string) {
    setErro(null);
    const r = await chamarApi<PedidoDetalhe>(`/v1/condominio/pedidos/${id}`);
    if (!r.ok) return setErro(r.erro);
    const o = r.dados.pedido;
    const [velho, novo] = ehMaisNovo(atual, o) ? [o, atual] : [atual, o];
    aoEscolher({
      id: o.id, protocolo: o.protocolo, assunto: o.assunto, estado: o.estado, versao: o.versao, categoria: o.categoria.nome,
      onde: o.local ?? o.unidade?.nome ?? null, abertoEm: o.abertoEm, encerradoEm: o.encerradoEm,
      podeReincidencia: velho.estado === "ENCERRADO" && !!velho.encerradoEm && velho.encerradoEm <= novo.abertoEm,
    });
  }

  return (
    <div className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <form onSubmit={procurar} noValidate className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <CampoTexto id="lig-busca" rotulo="Protocolo ou assunto" maxLength={60} value={busca} onChange={(e) => setBusca(e.target.value)}
            ajuda="Por exemplo, 2026-0117." />
        </div>
        <Botao type="submit" variante="secundario" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</Botao>
      </form>
      {achados === null ? null : achados.length === 0 ? (
        <p role="status" className="text-sm text-tinta-suave">Nenhum pedido encontrado para ligar.</p>
      ) : (
        <ul className="grid max-h-[40vh] gap-2 overflow-y-auto">
          {achados.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-linha p-3 text-sm">
              <span className="grid min-w-0 gap-0.5">
                <span><span className="font-mono text-tinta-suave">{x.protocolo}</span> {x.assunto}</span>
                <span className="text-xs text-tinta-suave">{[x.categoria, x.local ?? x.unidade, `aberto em ${dia(x.abertoEm)}`].filter(Boolean).join(" · ")}</span>
              </span>
              <Botao variante="contorno" tamanho="m" aria-label={`Escolher ${x.protocolo}`} onClick={() => void escolher(x.id)}>Escolher</Botao>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao></div>
    </div>
  );
}
