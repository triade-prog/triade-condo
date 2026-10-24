"use client";
// Dados de uma pessoa (F0.11; EM-08, LGPD art. 18; quadros 352 a 354 e 359, aprovados em
// 24/10/2026): para responder quando um morador, um ex-morador ou um prestador pergunta o que o
// condomínio sabe dele, pede para corrigir ou para apagar. O síndico busca pelo telefone com DDD ou
// pelo e-mail (a busca fica no histórico), vê onde a pessoa aparece e quando o prazo apaga sozinho,
// baixa tudo numa planilha, guarda por obrigação legal e remove os dados de quem não mora mais em
// nenhuma unidade, não tem pedido aberto e não está guardado.

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  formatarData, MOTIVOS_REMOCAO, mostrarTelefone, PARTES_DADOS_PESSOA, TEXTOS_MOTIVO,
  type DadosPessoa as Pessoa, type MotivoRemocao, type ParteDadosPessoa,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoTexto, camposComErro, chamarApi, classeBotao, Dialogo, EstadoTela, Icone, Iniciais, SemPermissao, Selo, textoDoErro, type ErroApi,
} from "@triade/ui";
import { usePlataforma } from "../sessao.tsx";
import { baixarArquivo } from "../relatorios/comum.tsx";
import { MenuAcoes, nomeRelacao, type ItemMenu } from "../moradores/comum.tsx";
import { BASE_PRIVACIDADE, ENDERECO_PRIVACIDADE, JanelaGuardar, JanelaTirarGuarda, motivoDoGuardado, plural, quemGuardou, SeloGuardado } from "./comum.tsx";

type Parte = Pessoa["onde"][number];
interface ItemUnidade { unidade: string; estado: string; relacao: string; desde?: string; saiuEm?: string | null }
interface ItemVeiculo { placa: string; modelo?: string | null; retiradoEm?: string | null }

const n = (p: Parte | undefined, k: string) => (p && typeof p[k] === "number" ? (p[k] as number) : 0);
const parte = (d: Pessoa, k: ParteDadosPessoa) => d.onde.find((x) => x.parte === k);

/** O que há em cada parte e o prazo dela, como a tela diz (quadro 352). */
export function linhaDaParte(p: Parte): { oQue: string; prazo: string } {
  switch (p.parte) {
    case "UNIDADES": {
      const itens = (p.itens as ItemUnidade[] | undefined) ?? [];
      const oQue = itens.map((u) => u.estado === "ENCERRADO"
        ? `Saiu da ${u.unidade}${u.saiuEm ? ` em ${formatarData(u.saiuEm)}` : ""} (${nomeRelacao(u.relacao).toLowerCase()})`
        : `${u.estado === "PENDENTE" ? "A confirmar na" : "Está na"} ${u.unidade} (${nomeRelacao(u.relacao).toLowerCase()})`).join("; ");
      return { oQue: oQue || plural(p.quantos, "unidade", "unidades"), prazo: n(p, "ativos") ? "Fica enquanto tiver vínculo com a unidade" : "Sem vínculo ativo" };
    }
    case "PEDIDOS": {
      const abertos = n(p, "abertos");
      return { oQue: `${plural(p.quantos, "pedido", "pedidos")}, ${abertos ? plural(abertos, "aberto", "abertos") : "nenhum aberto"}`,
        prazo: "Ficam; o nome some quando os dados forem removidos" };
    }
    case "MENSAGENS": {
      const sem = n(p, "semPedido");
      return { oQue: `${plural(p.quantos, "mensagem", "mensagens")}${sem ? `, ${sem} não ${sem === 1 ? "virou" : "viraram"} pedido` : ""}`,
        prazo: sem ? "As que não viraram pedido vencem 90 dias depois de cada uma" : "Seguem o pedido em que entraram" };
    }
    case "ENVIOS": return { oQue: plural(p.quantos, "envio", "envios"), prazo: "Vencem aos poucos, 12 meses depois de cada um" };
    case "RESERVAS": return { oQue: plural(p.quantos, "reserva", "reservas"), prazo: "Vencem 24 meses depois de cada data" };
    case "ENCOMENDAS": return { oQue: `${plural(p.quantos, "encomenda retirada", "encomendas retiradas")} por esta pessoa`, prazo: "O nome vence 12 meses depois de cada entrega" };
    case "ENQUETES": return { oQue: plural(p.quantos, "resposta", "respostas"), prazo: "Ficam; o voto secreto não mostra quem votou" };
    case "CLASSIFICADOS": return { oQue: plural(p.quantos, "anúncio", "anúncios"), prazo: "Vencem 90 dias depois de sair do mural" };
    case "VEICULOS": {
      const itens = (p.itens as ItemVeiculo[] | undefined) ?? [];
      const oQue = itens.map((v) => [`placa ${v.placa}`, v.modelo, v.retiradoEm ? `retirado em ${formatarData(v.retiradoEm)}` : null].filter(Boolean).join(", ")).join("; ");
      const retirados = itens.filter((v) => v.retiradoEm);
      return { oQue: `${plural(p.quantos, "veículo", "veículos")}${oQue ? `: ${oQue}` : ""}`,
        prazo: retirados.length === itens.length && itens.length ? "Vence 90 dias depois de retirado" : "Fica enquanto estiver na garagem" };
    }
    default: return { oQue: String(p.quantos), prazo: "" };
  }
}

/** Por que não dá para remover agora, na ordem em que a API confere. */
function bloqueio(d: Pessoa): { titulo: string; texto: string } | null {
  if (d.situacao.mora) return { titulo: "Ainda mora na unidade", texto: "Para remover os dados de quem mora, encerre antes o vínculo na ficha da unidade. Corrigir e baixar continuam liberados." };
  if (d.situacao.pedidoAberto) return { titulo: "Tem pedido aberto", texto: `Os dados só podem ser removidos depois que o pedido ${d.situacao.pedidoAberto} for encerrado.` };
  if (d.situacao.guarda) return { titulo: "Guardada por obrigação legal", texto: TEXTOS_MOTIVO.CONTATO_GUARDADO ?? "Tire a guarda, com o motivo, antes de remover os dados." };
  return null;
}

function aniversario(d: Pessoa["contato"]): string | null {
  return d.aniversarioDia && d.aniversarioMes ? `aniversário ${String(d.aniversarioDia).padStart(2, "0")}/${String(d.aniversarioMes).padStart(2, "0")}` : null;
}

function SeloSituacao({ d }: { d: Pessoa }) {
  const s = d.situacao;
  if (s.guarda) return <SeloGuardado guarda={s.guarda} />;
  if (s.mora) return <Selo tom="info">Mora no prédio</Selo>;
  if (s.pedidoAberto) return <Selo tom="atencao">Pedido aberto</Selo>;
  if (s.apagaEm) return <Selo tom="atencao"><Icone nome="lixeira" className="h-3.5 w-3.5" />{`Apagado sozinho em ${formatarData(s.apagaEm)}`}</Selo>;
  return null;
}

/** A nota da situação, sob o nome (quadros 352 e 359). */
function NotaSituacao({ d, tirar }: { d: Pessoa; tirar?: () => void }) {
  const s = d.situacao;
  if (s.guarda) {
    return (
      <Aviso tom="info" papel="status" titulo="Guardada por obrigação legal">
        {quemGuardou(s.guarda)} · {motivoDoGuardado(s.guarda)}. O prazo não apaga os dados desta pessoa, e eles não podem ser removidos enquanto a marca estiver aqui.
        {tirar ? <span className="mt-2 block"><Botao variante="contorno" tamanho="m" onClick={tirar}>Tirar a marca</Botao></span> : null}
      </Aviso>
    );
  }
  const b = bloqueio(d);
  if (b) {
    return (
      <Aviso tom="info" papel="status" titulo={b.titulo}>
        {b.texto}
        {s.mora ? <> <Link href={`/moradores?aba=pessoas&busca=${encodeURIComponent(d.contato.nome)}`} className="font-medium text-violeta-600 underline-offset-2 hover:underline">Abrir em Moradores e unidades</Link></> : null}
      </Aviso>
    );
  }
  if (s.saiuEm && s.apagaEm) {
    return (
      <Aviso tom="info" papel="status" titulo={`Saiu da última unidade em ${formatarData(s.saiuEm)}`}>
        Os dados serão apagados sozinhos 180 dias depois, em {formatarData(s.apagaEm)}. Se a pessoa pedir antes, use Remover os dados agora.
      </Aviso>
    );
  }
  return null;
}

function OndeAparece({ d }: { d: Pessoa }) {
  const partes = d.onde.filter((p) => p.quantos > 0);
  if (!partes.length) return <p className="t-texto text-tinta-suave">Além do cadastro, esta pessoa não aparece em nenhuma outra parte do sistema.</p>;
  const celula = "border-b border-linha px-3 py-3 align-top t-texto";
  return (
    <>
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full border-collapse">
          <caption className="pb-2 text-left t-titulo-cartao">Onde aparece</caption>
          <thead>
            <tr>
              {["Parte", "O que há", "Prazo"].map((c) => <th key={c} scope="col" className="border-b border-linha px-3 py-2 text-left t-apoio font-semibold text-tinta-suave">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {partes.map((p) => {
              const l = linhaDaParte(p);
              return (
                <tr key={p.parte} className="last:[&>*]:border-b-0">
                  <th scope="row" className={`${celula} w-[24%] text-left font-medium`}>{PARTES_DADOS_PESSOA[p.parte]}</th>
                  <td className={celula}>{l.oQue}</td>
                  <td className={`${celula} text-tinta-suave`}>{l.prazo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section aria-label="Onde aparece" className="grid md:hidden">
        <h3 className="t-titulo-cartao">Onde aparece</h3>
        <ul className="grid">
          {partes.map((p) => {
            const l = linhaDaParte(p);
            return (
              <li key={p.parte} className="grid gap-0.5 border-b border-linha py-3 last:border-b-0">
                <span className="font-medium">{PARTES_DADOS_PESSOA[p.parte]}</span>
                <span className="t-texto">{l.oQue}</span>
                <span className="t-apoio text-tinta-suave">{l.prazo}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** Remover os dados agora (quadro 354): o que some, o que fica e por quê. Não dá para desfazer. */
function JanelaRemover({ d, aoFechar, aoRemover }: { d: Pessoa; aoFechar: () => void; aoRemover: () => void }) {
  const [motivo, setMotivo] = useState<MotivoRemocao | null>(null);
  const [falta, setFalta] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nome = d.contato.nome;
  const b = bloqueio(d);

  if (b) {
    return (
      <Dialogo aberto media fechar titulo={`Remover os dados de ${nome}`} aoFechar={aoFechar}>
        <Aviso tom="atencao" papel="status" titulo={b.titulo}>{b.texto}</Aviso>
        <div className="flex justify-end"><Botao variante="contorno" onClick={aoFechar}>Entendi</Botao></div>
      </Dialogo>
    );
  }

  const mensagens = n(parte(d, "MENSAGENS"), "semPedido");
  const envios = parte(d, "ENVIOS")?.quantos ?? 0;
  const veiculos = parte(d, "VEICULOS")?.quantos ?? 0;
  const encomendas = parte(d, "ENCOMENDAS")?.quantos ?? 0;
  const reservas = parte(d, "RESERVAS")?.quantos ?? 0;
  const classificados = parte(d, "CLASSIFICADOS")?.quantos ?? 0;
  const pedidos = parte(d, "PEDIDOS")?.quantos ?? 0;
  const nomeEm = [encomendas ? plural(encomendas, "encomenda", "encomendas") : null, reservas ? plural(reservas, "reserva", "reservas") : null].filter(Boolean);
  const some = [
    "Nome, telefone, e-mail e aniversário",
    mensagens ? `${mensagens === 1 ? "A mensagem" : `As ${mensagens} mensagens`} de WhatsApp que não ${mensagens === 1 ? "virou" : "viraram"} pedido, com áudios e fotos` : null,
    envios ? `Número e texto ${envios === 1 ? "do envio" : `dos ${envios} envios`}` : null,
    veiculos ? `Placa e modelo ${veiculos === 1 ? "do veículo" : `dos ${veiculos} veículos`}` : null,
    nomeEm.length ? `O nome em ${nomeEm.join(" e em ")}` : null,
    classificados ? `Texto e foto ${classificados === 1 ? "do classificado" : `dos ${classificados} classificados`}` : null,
  ].filter(Boolean) as string[];
  const fica = [
    pedidos ? `${pedidos === 1 ? "O pedido" : `Os ${pedidos} pedidos`}, como “contato removido”` : null,
    nomeEm.length ? "As reservas e encomendas, só com a unidade e a data" : null,
    "O registro de que os dados foram removidos, com quem fez e o motivo",
  ].filter(Boolean) as string[];

  async function remover(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!motivo) return setFalta(true);
    setEnviando(true);
    const r = await chamarApi<{ arquivos: number }>(`${BASE_PRIVACIDADE}/dados-pessoa/${d.contato.id}/remover`, { corpo: { versao: d.contato.versao, motivo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoRemover();
  }

  const lista = (itens: string[]) => <ul className="grid list-disc gap-1 pl-5 t-texto">{itens.map((x) => <li key={x}>{x}</li>)}</ul>;
  return (
    <Dialogo aberto media fechar titulo={`Remover os dados de ${nome}`} apoio="Não está em nenhuma unidade e não tem pedido aberto." aoFechar={aoFechar}>
      <form onSubmit={remover} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <section aria-labelledby="remover-some" className="grid gap-1.5">
          <h3 id="remover-some" className="t-titulo-cartao">O que é apagado agora</h3>
          {lista(some)}
        </section>
        <section aria-labelledby="remover-fica" className="grid gap-1.5">
          <h3 id="remover-fica" className="t-titulo-cartao">O que fica, sem o nome</h3>
          {lista(fica)}
        </section>
        <fieldset className="grid gap-2" aria-describedby={falta ? "remover-motivo-erro" : undefined}>
          <legend className="pb-1.5 t-titulo-cartao">Por quê</legend>
          {(Object.keys(MOTIVOS_REMOCAO) as MotivoRemocao[]).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-linha px-3.5 py-3 has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
              <input type="radio" name="remover-motivo" className="mt-1 h-4.5 w-4.5 accent-violeta-600" checked={motivo === m} onChange={() => { setMotivo(m); setFalta(false); }} />
              <span className="grid">
                <span className="t-texto font-medium">{MOTIVOS_REMOCAO[m]}</span>
                {m === "PEDIDO" ? <span className="t-apoio text-tinta-suave">Pedido do próprio titular dos dados</span> : null}
              </span>
            </label>
          ))}
          {falta ? <span id="remover-motivo-erro" className="t-apoio text-erro">Escolha por que remover.</span> : null}
        </fieldset>
        <Aviso tom="atencao" papel="status" titulo="Não dá para desfazer">Depois de remover, nem a TRÍADE consegue trazer os dados de volta.</Aviso>
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}><Icone nome="lixeira" />{enviando ? "Removendo…" : "Remover os dados"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

type Janela = { tipo: "remover" | "guardar" | "tirar"; pessoa: Pessoa } | null;

/** "dados-paulo-souza.csv": o nome do arquivo, sem acento nem espaço. */
function nomeDoArquivo(nome: string): string {
  return `dados-${nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`;
}

/** Baixar tudo: a planilha vem da API (fica no histórico) e é entregue ao navegador aqui. */
function useBaixar(c: Pessoa["contato"]) {
  const [baixando, setBaixando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  async function baixar() {
    setBaixando(true);
    setFalhou(false);
    try {
      const r = await fetch(`/api${BASE_PRIVACIDADE}/dados-pessoa/${c.id}/planilha`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      baixarArquivo(await r.blob(), nomeDoArquivo(c.nome), "text/csv;charset=utf-8");
    } catch {
      setFalhou(true);
    }
    setBaixando(false);
  }
  return { baixar, baixando, falhou };
}

function CartaoPessoa({ d, abrir }: { d: Pessoa; abrir: (j: NonNullable<Janela>) => void }) {
  const c = d.contato;
  const planilha = useBaixar(c);
  const linha = [mostrarTelefone(c.telefone), c.email, aniversario(c)].filter(Boolean).join(" · ");
  const corrigir = `/moradores?aba=pessoas&busca=${encodeURIComponent(c.nome)}`;
  const guardar = !d.situacao.guarda;
  const maisCelular: ItemMenu[] = [
    { texto: "Corrigir os dados", icone: "editar", href: corrigir },
    ...(guardar ? [{ texto: "Guardar por obrigação legal", icone: "cadeado" as const, acao: () => abrir({ tipo: "guardar", pessoa: d }) }] : []),
  ];
  return (
    <section aria-labelledby={`pessoa-${c.id}`} className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 md:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <Iniciais nome={c.nome} className="h-12 w-12" />
        <span className="grid min-w-0 flex-1 basis-[240px]">
          <h2 id={`pessoa-${c.id}`} className="t-titulo-secao">{c.nome}</h2>
          <span className="t-apoio text-tinta-suave [overflow-wrap:anywhere]">{linha}</span>
        </span>
        <SeloSituacao d={d} />
      </div>
      <NotaSituacao d={d} tirar={d.situacao.guarda ? () => abrir({ tipo: "tirar", pessoa: d }) : undefined} />
      <OndeAparece d={d} />
      {planilha.falhou ? <Aviso tom="erro">Não deu para baixar a planilha agora. Tente de novo; nada foi perdido.</Aviso> : null}
      <div className="flex flex-wrap gap-2 pt-1 max-md:hidden">
        <Botao variante="contorno" disabled={planilha.baixando} onClick={() => void planilha.baixar()}><Icone nome="baixar" />Baixar tudo numa planilha</Botao>
        <Link href={corrigir} className={classeBotao("discreto")}><Icone nome="editar" />Corrigir os dados</Link>
        {guardar ? <Botao variante="discreto" onClick={() => abrir({ tipo: "guardar", pessoa: d })}><Icone nome="cadeado" />Guardar por obrigação legal</Botao> : null}
        <span className="flex-1" />
        <Botao variante="perigo" onClick={() => abrir({ tipo: "remover", pessoa: d })}><Icone nome="lixeira" />Remover os dados agora</Botao>
      </div>
      <div className="grid gap-2 md:hidden">
        <div className="flex gap-2">
          <Botao variante="contorno" className="flex-1" disabled={planilha.baixando} onClick={() => void planilha.baixar()}><Icone nome="baixar" />Baixar planilha</Botao>
          <MenuAcoes rotulo={`Mais ações de ${c.nome}`} texto="Mais ações" itens={maisCelular} />
        </div>
        <Botao variante="perigo" className="w-full" onClick={() => abrir({ tipo: "remover", pessoa: d })}><Icone nome="lixeira" />Remover os dados agora</Botao>
      </div>
    </section>
  );
}

function Cabeca() {
  return (
    <div className="grid gap-3">
      <Link href={ENDERECO_PRIVACIDADE} className="inline-flex items-center gap-1 justify-self-start t-apoio font-medium text-violeta-600 hover:underline">
        <Icone nome="esq" className="h-4 w-4" />Privacidade e dados
      </Link>
      <div className="grid max-w-[70ch] gap-1">
        <h1 className="t-titulo-tela font-normal tracking-tight">Dados de uma pessoa</h1>
        <p className="t-apoio text-tinta-suave max-md:hidden">Para responder quando um morador, um ex-morador ou um prestador pergunta o que o condomínio sabe dele, pede para corrigir ou para apagar (LGPD, art. 18).</p>
      </div>
    </div>
  );
}

export function DadosPessoa() {
  const { pode } = usePlataforma();
  const [busca, setBusca] = useState("");
  const [buscada, setBuscada] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [recado, setRecado] = useState<ReactNode>(null);
  const [removida, setRemovida] = useState<string | null>(null);

  if (!pode("privacidade.cuidar")) {
    return <div className="grid gap-5"><Cabeca /><SemPermissao nivel={0} tela="Dados de uma pessoa" texto="Só o síndico busca e remove os dados de uma pessoa." /></div>;
  }

  async function buscar(texto: string) {
    setErro(null);
    setBuscando(true);
    const r = await chamarApi<{ pessoas: Pessoa[] }>(`${BASE_PRIVACIDADE}/dados-pessoa`, { corpo: { busca: texto } });
    setBuscando(false);
    if (!r.ok) { setPessoas(null); return setErro(r.erro); }
    setBuscada(texto);
    setPessoas(r.dados.pessoas);
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    setRecado(null);
    setRemovida(null);
    if (busca.trim().length < 3) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["busca"] } });
    void buscar(busca.trim());
  }

  const deNovo = () => { setPessoas(null); setBuscada(null); setBusca(""); document.getElementById("busca-pessoa")?.focus(); };
  const doCampo = erro?.codigo === "VALIDATION_ERROR" && camposComErro(erro).includes("busca");
  const porEmail = (buscada ?? "").includes("@");

  return (
    <div className="grid gap-5">
      <Cabeca />
      <form role="search" aria-label="Buscar a pessoa" onSubmit={enviar} noValidate
        className="flex flex-wrap items-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 md:px-6">
        <CampoTexto id="busca-pessoa" rotulo="Telefone ou e-mail da pessoa" icone="busca" className="min-w-0 flex-1 basis-[320px]" type="search"
          autoComplete="off" maxLength={200} value={busca} onChange={(e) => setBusca(e.target.value)}
          ajuda="Só o síndico. A busca fica no histórico, com quem buscou."
          erro={doCampo ? "Escreva o telefone com DDD ou o e-mail." : null} />
        <Botao type="submit" className="md:mt-[26px] max-md:w-full" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</Botao>
      </form>
      {erro && !doCampo ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {removida ? (
        <div role="status">
          <EstadoTela icone="check" tom="ok" titulo="Dados removidos" nivel={2}
            acoes={<Botao variante="contorno" tamanho="m" onClick={() => { setRemovida(null); deNovo(); }}><Icone nome="busca" />Buscar outra pessoa</Botao>}>
            {`Os dados de ${removida} foram removidos agora, por você. O registro fica no histórico.`}
          </EstadoTela>
        </div>
      ) : null}
      {pessoas && !pessoas.length && !removida ? (
        <EstadoTela icone="busca" titulo={porEmail ? "Ninguém com esse e-mail" : "Ninguém com esse telefone"} nivel={2}
          nota="Quem já teve os dados removidos não aparece mais."
          acoes={<Botao variante="contorno" tamanho="m" onClick={deNovo}><Icone nome="retorno" />Buscar de novo</Botao>}>
          {porEmail ? "Confira o e-mail." : "Confira o número com DDD."}
        </EstadoTela>
      ) : null}
      {pessoas && !removida ? pessoas.map((d) => <CartaoPessoa key={d.contato.id} d={d} abrir={setJanela} />) : null}

      {janela?.tipo === "remover" ? (
        <JanelaRemover d={janela.pessoa} aoFechar={() => setJanela(null)}
          aoRemover={() => { setRemovida(janela.pessoa.contato.nome); setJanela(null); setPessoas(null); }} />
      ) : null}
      {janela?.tipo === "guardar" ? (
        <JanelaGuardar entidade="CONTATO" alvoId={janela.pessoa.contato.id} titulo={`Guardar os dados de ${janela.pessoa.contato.nome}`}
          apoio={mostrarTelefone(janela.pessoa.contato.telefone)} aoFechar={() => setJanela(null)}
          aoGuardar={() => { setRecado(`Os dados de ${janela.pessoa.contato.nome} estão guardados por obrigação legal.`); setJanela(null); if (buscada) void buscar(buscada); }} />
      ) : null}
      {janela?.tipo === "tirar" && janela.pessoa.situacao.guarda ? (
        <JanelaTirarGuarda guarda={janela.pessoa.situacao.guarda} aoFechar={() => setJanela(null)}
          aoTirar={() => { setRecado(`A marca de guardado de ${janela.pessoa.contato.nome} saiu. O prazo volta a valer.`); setJanela(null); if (buscada) void buscar(buscada); }} />
      ) : null}
    </div>
  );
}
