"use client";
// Quem avisar, no registro do pedido (F6.4, AT-26; desenho "Aviso de pedido registrado", telas
// 1, 2 e 6). Já vem marcado pelas regras do condomínio e muda com o que se preenche acima:
// unidade, contato, prioridade, responsável e se é privado. Quem pediu recebe o protocolo; o
// responsável sempre fica sabendo; o síndico pela regra ou se marcarem. Prestador e moradores
// afetados só se quem registra escolher e vir a mensagem. Nada sai antes de Registrar, e nome,
// telefone e e-mail de quem pediu nunca vão para fora (o banco confere o texto).

import { useEffect, useState } from "react";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, chamarApi, Selo } from "@triade/ui";
import type { OpcoesPedidos, PessoaAvisada, QuemAvisar as Previa } from "../tipos.ts";
import { Escolha } from "../moradores/comum.tsx";

/** O que quem registra escolheu. Os textos acompanham o rascunho até alguém mexer neles. */
export interface EscolhaAvisos {
  quemPediu: boolean | null;
  sindico: boolean;
  prestador: { id: string; texto: string; editado: boolean } | null;
  moradores: { publico: "TODOS" | "BLOCOS" | "UNIDADES"; blocos: string[]; unidades: string[]; titulo: string; texto: string; editado: boolean } | null;
}

export const ESCOLHA_INICIAL: EscolhaAvisos = { quemPediu: null, sindico: false, prestador: null, moradores: null };

/** O que já foi preenchido no registro e importa para quem avisar. */
export interface DadosDoRegistro {
  unidadeId: string | null;
  contatoId: string | null;
  prioridadeId: string;
  responsavelId: string | null;
  privado: boolean;
  canal: string;
  local: string | null;
  assunto: string;
  descricao: string;
}

/** A prévia pede o banco a cada mudança, com uma pequena espera para não chamar a cada letra. */
export function usePrevia(d: DadosDoRegistro, e: EscolhaAvisos): Previa | null {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const corpo = JSON.stringify({
    ...d,
    prestadorId: e.prestador?.id ?? null,
    ...(e.prestador?.editado ? { textoPrestador: e.prestador.texto } : {}),
    ...(e.moradores?.editado ? { textoMoradores: `${e.moradores.titulo} ${e.moradores.texto}` } : {}),
  });
  useEffect(() => {
    const controle = new AbortController();
    const espera = setTimeout(() => {
      void chamarApi<Previa>("/v1/condominio/pedidos/quem-avisar", { corpo: JSON.parse(corpo), sinal: controle.signal }).then((r) => {
        if (!controle.signal.aborted && r.ok) setPrevia(r.dados);
      });
    }, 350);
    return () => { clearTimeout(espera); controle.abort(); };
  }, [corpo]);
  return previa;
}

/** O síndico vai? Pela regra, sempre; senão, só se marcarem. */
const sindicoVai = (p: Previa, e: EscolhaAvisos) => p.sindico.pelaRegra || e.sindico;
const protocoloVai = (p: Previa, e: EscolhaAvisos) => Boolean(p.quemPediu.meio) && (e.quemPediu ?? p.quemPediu.marcado);

/** Quem fica sabendo, para o botão ("Registrar e avisar 3") e o resumo do celular. */
export function contarAvisos(p: Previa | null, e: EscolhaAvisos): { n: number; nomes: string[] } {
  if (!p) return { n: 0, nomes: [] };
  const nomes: string[] = [];
  if (protocoloVai(p, e)) nomes.push(`${p.quemPediu.nome} (protocolo)`);
  for (const x of p.responsavel.pessoas) if (!x.voceMesmo) nomes.push(x.nome);
  if (sindicoVai(p, e)) for (const x of p.sindico.pessoas) if (!x.voceMesmo) nomes.push(x.nome);
  const prestador = p.prestador.disponivel && e.prestador ? p.prestadores.find((x) => x.id === e.prestador!.id) : null;
  if (prestador) nomes.push(prestador.nome);
  if (p.moradores.disponivel && e.moradores) nomes.push("moradores afetados");
  return { n: nomes.length, nomes };
}

/** O que vai para a API: só o que quem registra mudou; o resto segue as regras. */
export function paraEnviar(p: Previa | null, e: EscolhaAvisos) {
  if (!p) return null;
  return {
    ...(e.quemPediu !== null && p.quemPediu.meio ? { quemPediu: e.quemPediu } : {}),
    ...(e.sindico && !p.sindico.pelaRegra ? { sindico: true } : {}),
    prestador: p.prestador.disponivel && e.prestador ? { id: e.prestador.id, texto: e.prestador.texto } : null,
    moradores: p.moradores.disponivel && e.moradores
      ? { publico: e.moradores.publico, blocos: e.moradores.publico === "BLOCOS" ? e.moradores.blocos : [],
          unidades: e.moradores.publico === "UNIDADES" ? e.moradores.unidades : [], titulo: e.moradores.titulo, texto: e.moradores.texto }
      : null,
  };
}

/** Os rascunhos acompanham o que se escreve acima enquanto ninguém editar. */
export function acompanharRascunhos(p: Previa | null, e: EscolhaAvisos): EscolhaAvisos {
  if (!p) return e;
  let x = e;
  if (x.prestador && !x.prestador.editado && x.prestador.texto !== p.prestador.rascunho) x = { ...x, prestador: { ...x.prestador, texto: p.prestador.rascunho } };
  if (x.moradores && !x.moradores.editado && (x.moradores.titulo !== p.moradores.rascunho.titulo || x.moradores.texto !== p.moradores.rascunho.texto)) {
    x = { ...x, moradores: { ...x.moradores, titulo: p.moradores.rascunho.titulo, texto: p.moradores.rascunho.texto } };
  }
  return x;
}

function Linha({ marca, titulo, texto, extra, acao, apagada }: {
  marca: React.ReactNode; titulo: React.ReactNode; texto: React.ReactNode; extra?: React.ReactNode; acao?: React.ReactNode; apagada?: boolean;
}) {
  return (
    <li className={`flex items-start gap-3 px-3 py-2.5 text-sm ${apagada ? "text-tinta-suave" : ""}`}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">{marca}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titulo}</span>
        <span className="block text-xs text-tinta-suave">{texto}</span>
        {extra}
      </span>
      {acao ? <span className="shrink-0">{acao}</span> : null}
    </li>
  );
}

const CAIXA = "h-4 w-4 accent-violeta-600";
const meioPessoa = (x: PessoaAvisada) => (x.whatsapp ? "no sino e no WhatsApp da pessoa, que ligou o aviso de pedido novo" : "no sino");
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function BlocoQuemAvisar({ previa, escolha, mudar, opcoes }: {
  previa: Previa | null;
  escolha: EscolhaAvisos;
  mudar: (e: EscolhaAvisos) => void;
  opcoes: OpcoesPedidos;
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState("");
  const [verMensagem, setVerMensagem] = useState(false);
  const [editandoPrestador, setEditandoPrestador] = useState(false);
  const [editandoMoradores, setEditandoMoradores] = useState(false);
  if (!previa) return <p className="text-sm text-tinta-suave">Conferindo quem avisar…</p>;

  const p = previa;
  const resumo = contarAvisos(p, escolha);
  const prestador = p.prestador.disponivel && escolha.prestador ? p.prestadores.find((x) => x.id === escolha.prestador!.id) ?? null : null;
  const moradores = p.moradores.disponivel ? escolha.moradores : null;
  const qp = p.quemPediu;
  const sindicoMarcado = sindicoVai(p, escolha);
  const lista = p.prestadores.filter((x) => `${x.nome} ${x.servico}`.toLowerCase().includes(busca.trim().toLowerCase()));
  const unidadesDoPublico = !moradores ? 0
    : moradores.publico === "TODOS" ? p.totalUnidades
      : moradores.publico === "BLOCOS" ? p.blocos.filter((b) => moradores.blocos.includes(b.id)).reduce((s, b) => s + b.unidades, 0)
        : moradores.unidades.length;
  const nomePublico = !moradores ? "" : moradores.publico === "TODOS" ? "Todos os moradores"
    : moradores.publico === "BLOCOS" ? `Moradores de ${p.blocos.filter((b) => moradores.blocos.includes(b.id)).map((b) => b.nome).join(", ") || "nenhum bloco"}`
      : "Moradores das unidades escolhidas";

  function escolherPrestador(id: string) {
    mudar({ ...escolha, prestador: { id, texto: p.prestador.rascunho, editado: false } });
    setEscolhendo(false);
    setEditandoPrestador(true);
  }

  function avisarMoradores() {
    mudar({ ...escolha, moradores: { publico: p.moradores.publico, blocos: p.moradores.blocos ?? [], unidades: [],
      titulo: p.moradores.rascunho.titulo, texto: p.moradores.rascunho.texto, editado: false } });
    setEditandoMoradores(true);
  }

  const linhas = (
    <ul className="divide-y divide-linha">
      {qp.meio ? (
        <Linha
          marca={<input id="qa-quem-pediu" type="checkbox" className={CAIXA} checked={protocoloVai(p, escolha)}
            onChange={(ev) => mudar({ ...escolha, quemPediu: ev.target.checked })} aria-describedby="qa-quem-pediu-texto" />}
          titulo={<label htmlFor="qa-quem-pediu">{qp.nome}, quem pediu</label>}
          texto={<span id="qa-quem-pediu-texto">
            Protocolo {qp.meio === "WHATSAPP" ? "pelo WhatsApp do condomínio" : "por e-mail"} ·{" "}
            <button type="button" className="text-violeta-600 hover:underline" aria-expanded={verMensagem} onClick={() => setVerMensagem(!verMensagem)}>
              {verMensagem ? "esconder mensagem" : "ver mensagem"}
            </button>
          </span>}
          extra={verMensagem && qp.mensagem ? <span className="mt-2 block rounded-xl bg-superficie-2 p-3 text-xs whitespace-pre-line">{qp.mensagem}</span> : null}
        />
      ) : (
        <Linha apagada marca={<input type="checkbox" className={CAIXA} disabled aria-label="Quem pediu" />} titulo="Quem pediu"
          texto={qp.motivo === "SEM_MEIO" ? `${qp.nome} não tem WhatsApp nem e-mail confirmado para receber: ninguém para avisar` : "Registrado sem contato, ninguém para avisar"} />
      )}
      {p.responsavel.pessoas.length === 0 ? (
        <Linha apagada marca={<input type="checkbox" className={CAIXA} disabled aria-label="Responsável" />} titulo="Responsável"
          texto="Ninguém cuida dos pedidos ainda: o pedido fica à vista na fila." />
      ) : p.responsavel.pessoas.map((x) => (
        <Linha key={x.id}
          marca={<input type="checkbox" className={CAIXA} checked={!x.voceMesmo} disabled aria-label={`${x.nome}, ${p.responsavel.semResponsavel ? "cuida dos pedidos" : "responsável"}`} />}
          titulo={`${x.nome}, ${p.responsavel.semResponsavel ? "cuida dos pedidos" : "responsável"}`}
          texto={x.voceMesmo ? "É você: nada sai" : p.responsavel.semResponsavel ? `Sem responsável, quem cuida dos pedidos fica sabendo · ${meioPessoa(x)}` : maiuscula(meioPessoa(x))}
          acao={x.voceMesmo ? undefined : <Selo tom="neutro">sempre</Selo>} />
      ))}
      {p.sindico.pessoas.filter((x) => !x.voceMesmo).map((x) => (
        <Linha key={x.id}
          marca={<input id={`qa-sindico-${x.id}`} type="checkbox" className={CAIXA} checked={sindicoMarcado} disabled={p.sindico.pelaRegra}
            onChange={(ev) => mudar({ ...escolha, sindico: ev.target.checked })} />}
          titulo={<label htmlFor={`qa-sindico-${x.id}`}>{x.nome}, síndico</label>}
          texto={p.sindico.pelaRegra
            ? `${p.sindico.regra === "TODOS" ? "Todo pedido novo" : p.responsavel.semResponsavel ? "Pedido sem responsável" : "Pedido urgente"} · ${meioPessoa(x)}`
            : p.sindico.regra === "NUNCA" ? "A regra do condomínio é não avisar o síndico. Marque para avisar mesmo assim."
              : "Pela regra do condomínio, só pedido sem responsável ou urgente. Marque para avisar mesmo assim."}
          acao={p.sindico.pelaRegra ? <Selo tom="info">pela regra</Selo> : undefined} />
      ))}
      {p.prestador.disponivel ? (
        prestador ? (
          <Linha marca={<input type="checkbox" className={CAIXA} checked disabled aria-label={`${prestador.nome}, prestador`} />}
            titulo={`${prestador.nome}, prestador`}
            texto={<>
              {prestador.meio === "WHATSAPP" ? `WhatsApp do condomínio para ${prestador.para ?? ""}` : `E-mail para ${prestador.para ?? ""}`} ·{" "}
              <button type="button" className="text-violeta-600 hover:underline" aria-expanded={editandoPrestador} onClick={() => setEditandoPrestador(!editandoPrestador)}>
                {editandoPrestador ? "fechar mensagem" : "ver e editar mensagem"}
              </button>
            </>}
            extra={editandoPrestador ? (
              <span className="mt-2 grid gap-1.5">
                <span className="block text-xs text-tinta-suave">{p.prestador.cabecalho}</span>
                <CampoAreaTexto id="qa-texto-prestador" rotulo="Mensagem ao prestador" rows={6} maxLength={1500} value={escolha.prestador!.texto}
                  onChange={(ev) => mudar({ ...escolha, prestador: { ...escolha.prestador!, texto: ev.target.value, editado: true } })}
                  erro={p.prestador.textoComDadoDeMorador ? "Tire o nome, o telefone ou o e-mail de morador: não vão para o prestador." : null}
                  ajuda="Sem nome, telefone nem unidade de quem pediu." />
                <span className="block text-xs text-tinta-suave">{p.prestador.rodape}</span>
              </span>
            ) : null}
            acao={<span className="flex gap-1">
              <Botao variante="discreto" tamanho="p" onClick={() => setEscolhendo(true)}>Trocar</Botao>
              <Botao variante="discreto" tamanho="p" onClick={() => mudar({ ...escolha, prestador: null })}>Tirar</Botao>
            </span>} />
        ) : (
          <Linha marca={<span aria-hidden="true" className="text-tinta-suave">+</span>} titulo="Prestador"
            texto="Ninguém de fora é avisado sem você escolher e ver a mensagem."
            acao={<Botao variante="contorno" tamanho="p" aria-expanded={escolhendo} onClick={() => setEscolhendo(!escolhendo)}>+ Escolher</Botao>} />
        )
      ) : null}
      {escolhendo && p.prestador.disponivel ? (
        <li className="grid gap-2 bg-superficie-2 px-3 py-3">
          <CampoTexto id="qa-busca-prestador" rotulo="Escolher o prestador" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Nome ou serviço" />
          {lista.length === 0 ? <p className="text-sm text-tinta-suave">{p.prestadores.length ? "Nenhum prestador com esse nome." : "Nenhum prestador no cadastro ainda."}</p> : (
            <ul className="grid max-h-56 gap-1 overflow-y-auto">
              {lista.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 rounded-xl bg-superficie px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{x.nome}</span>
                    <span className="block text-xs text-tinta-suave">
                      {[x.servico, x.contratoAte ? `contrato até ${x.contratoAte.slice(5, 7)}/${x.contratoAte.slice(0, 4)}` : null, x.reserva ? `reserva: ${x.reserva}` : null,
                        x.meio === "WHATSAPP" ? (x.temEmail ? "WhatsApp e e-mail" : "WhatsApp") : x.meio === "EMAIL" ? "só e-mail"
                          : x.temCelular ? "celular, mas o WhatsApp do condomínio não está conectado" : "sem celular nem e-mail no cadastro"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Botao variante="contorno" tamanho="p" disabled={!x.meio} onClick={() => escolherPrestador(x.id)}
                    aria-label={`Escolher ${x.nome}`}>Escolher</Botao>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-tinta-suave">Só prestadores do cadastro, sem arquivar. Sem celular nem e-mail, o prestador não pode ser avisado por aqui.</p>
        </li>
      ) : null}
      {p.moradores.disponivel ? (
        moradores ? (
          <Linha marca={<input type="checkbox" className={CAIXA} checked disabled aria-label="Moradores afetados" />}
            titulo={nomePublico}
            texto={<>
              {unidadesDoPublico} {unidadesDoPublico === 1 ? "unidade" : "unidades"} · comunicado por e-mail{moradores.publico === "TODOS" ? " e no mural" : ""} ·{" "}
              <button type="button" className="text-violeta-600 hover:underline" aria-expanded={editandoMoradores} onClick={() => setEditandoMoradores(!editandoMoradores)}>
                {editandoMoradores ? "fechar comunicado" : "ver e editar comunicado"}
              </button>
            </>}
            extra={editandoMoradores ? (
              <span className="mt-2 grid gap-2">
                <Escolha rotulo="Para quem" atual={moradores.publico} aoMudar={(v) => mudar({ ...escolha, moradores: { ...moradores, publico: v } })}
                  opcoes={[{ valor: "TODOS", texto: "Todos" }, { valor: "BLOCOS", texto: "Blocos" }, { valor: "UNIDADES", texto: "Unidades" }]} />
                {moradores.publico === "BLOCOS" ? (
                  <fieldset className="grid gap-1">
                    <legend className="sr-only">Blocos</legend>
                    {p.blocos.map((b) => (
                      <label key={b.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className={CAIXA} checked={moradores.blocos.includes(b.id)}
                          onChange={(ev) => mudar({ ...escolha, moradores: { ...moradores, blocos: ev.target.checked ? [...moradores.blocos, b.id] : moradores.blocos.filter((y) => y !== b.id) } })} />
                        {b.nome} <span className="text-xs text-tinta-suave">· {b.unidades} {b.unidades === 1 ? "unidade" : "unidades"}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                {moradores.publico === "UNIDADES" ? (
                  <fieldset className="grid max-h-44 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
                    <legend className="sr-only">Unidades</legend>
                    {opcoes.unidades.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className={CAIXA} checked={moradores.unidades.includes(u.id)}
                          onChange={(ev) => mudar({ ...escolha, moradores: { ...moradores, unidades: ev.target.checked ? [...moradores.unidades, u.id] : moradores.unidades.filter((y) => y !== u.id) } })} />
                        {u.nome}
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                <CampoTexto id="qa-titulo-moradores" rotulo="Título do comunicado" maxLength={120} value={moradores.titulo}
                  onChange={(ev) => mudar({ ...escolha, moradores: { ...moradores, titulo: ev.target.value, editado: true } })} />
                <CampoAreaTexto id="qa-texto-moradores" rotulo="Comunicado" rows={4} maxLength={4000} value={moradores.texto}
                  onChange={(ev) => mudar({ ...escolha, moradores: { ...moradores, texto: ev.target.value, editado: true } })}
                  erro={p.moradores.textoComDadoDeMorador ? "Tire o nome, o telefone ou o e-mail de morador: o comunicado vai para os vizinhos." : null}
                  ajuda="Recebe quem tem “recebe comunicados” ligado. Comunicar o prédio não conta como retorno a ninguém." />
              </span>
            ) : null}
            acao={<Botao variante="discreto" tamanho="p" onClick={() => mudar({ ...escolha, moradores: null })}>Tirar</Botao>} />
        ) : (
          <Linha marca={<span aria-hidden="true" className="text-tinta-suave">+</span>} titulo="Moradores afetados"
            texto="Comunicado ligado ao pedido, para um bloco, algumas unidades ou todos."
            acao={<Botao variante="contorno" tamanho="p" onClick={avisarMoradores}>+ Avisar</Botao>} />
        )
      ) : null}
    </ul>
  );

  return (
    <section aria-labelledby="qa-titulo" className="grid gap-2 rounded-2xl border border-linha bg-superficie">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <h3 id="qa-titulo" className="font-medium">Quem avisar</h3>
        <button type="button" className="text-sm text-violeta-600 hover:underline sm:hidden" aria-expanded={aberto} aria-controls="qa-lista"
          onClick={() => setAberto(!aberto)}>{aberto ? "Pronto" : "Ver e mudar"}</button>
      </div>
      <p className="px-3 text-sm sm:hidden" hidden={aberto}>
        <span className="font-medium">Quem avisar: {resumo.n}</span>
        {resumo.n ? <span className="block text-xs text-tinta-suave">{juntar(resumo.nomes)}</span> : null}
      </p>
      <div id="qa-lista" className={aberto ? "grid" : "hidden sm:grid"}>{linhas}</div>
      {p.prestador.motivo === "PRIVADO" ? <p className="px-3 text-xs text-tinta-suave">Pedido privado: prestador e moradores afetados não aparecem.</p> : null}
      <p className="px-3 pb-3 text-xs text-tinta-suave">
        O que estiver marcado sai junto com o registro. Nome e telefone de quem pediu nunca vão para o prestador nem para os outros moradores.
      </p>
      {p.prestador.textoComDadoDeMorador || p.moradores.textoComDadoDeMorador
        ? <div className="px-3 pb-3"><Aviso tom="atencao">Há dado de morador num texto editado. Tire antes de registrar, ou o registro é recusado.</Aviso></div> : null}
    </section>
  );
}

/** "Marta (protocolo), Gil e Ana". */
export function juntar(nomes: string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : (nomes[0] ?? "");
}
