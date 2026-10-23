"use client";
// Parte Implantação da ficha (PI-04, PI-05, SH-01; DC15, telas-modelo console-ficha-implantacao-*,
// rodada Console de 23/10/2026): a barra de etapas no alto e a próxima etapa em destaque, com o
// botão dela; as 8 etapas com responsável, substituto e situação; as pendências ao lado, a
// vencida em vermelho, com quem precisa agir e o próximo retorno; e a entrega, ato explícito que
// passa o cliente a ativo, na etapa 8 quando tudo estiver pronto. Tudo aqui é interno: o cliente
// não vê (PI-06).

import { useState, type FormEvent } from "react";
import {
  COM_QUEM,
  FALTAS_ENTREGA,
  formatarData,
  MODALIDADES_APRESENTACAO,
  mostrarDataSemHora,
  PARTES_CONFIGURACAO,
  RECADO_ENTREGA,
  SITUACOES_ETAPA_IMPLANTACAO,
  textoEtapaConfiguracao,
  type ParteConfiguracao,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar,
  Icone, IconeMarca, Selo, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
import type { AreasComuns, Configuracoes } from "@triade/configuracoes";
import { AcaoCartao, BarraEtapas, Cartao } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { PropsAba } from "./tipos.ts";

interface Etapa {
  numero: number;
  chave: string;
  titulo: string;
  descricao?: string;
  situacao: keyof typeof SITUACOES_ETAPA_IMPLANTACAO;
  responsavelId?: string;
  responsavel?: string;
  substitutoId?: string;
  substituto?: string;
  feito?: string;
  motivo?: string;
  modalidade?: keyof typeof MODALIDADES_APRESENTACAO;
  quando?: string;
  realizadaEm?: string;
  versao: number;
}

interface Pendencia {
  id: string;
  etapa?: number;
  texto: string;
  comQuem: keyof typeof COM_QUEM;
  responsavelId: string;
  responsavel: string;
  proximoRetorno: string;
  vencida: boolean;
  resolvidaEm?: string;
  resolucao?: string;
  versao: number;
}

interface PessoaEquipe {
  pessoaId: string;
  nome: string;
}

export interface Implantacao {
  legado: boolean;
  estagio: string;
  implantacao?: { id: string; roteiroVersao: number; entregueEm?: string; entreguePor?: string; recado?: string; versao: number };
  etapas?: Etapa[];
  pendencias?: Pendencia[];
  equipe?: PessoaEquipe[];
  entrega?: {
    faltando: (keyof typeof FALTAS_ENTREGA)[];
    pedidoTeste?: { id: string; protocolo: string; encerradoEm: string };
    sindicos: number;
    pendenciasClienteVencidas: number;
  };
  pode?: { editar: boolean; entregar: boolean };
  /** Andamento da aba Configuração na etapa 4 (PI-04). */
  configuracao?: { conferidas: number; total: number; faltando: ParteConfiguracao[] };
}

const TOM_ETAPA: Record<string, Tom> = { PREPARADA: "neutro", PENDENTE: "atencao", REALIZADA: "ok", NAO_SE_APLICA: "neutro" };

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function opcoesEquipe(equipe: PessoaEquipe[], vazio: string) {
  return [{ valor: "", texto: vazio }, ...equipe.map((p) => ({ valor: p.pessoaId, texto: p.nome }))];
}

function EditarEtapa({ condominio, etapa, equipe, aoFechar, aoSalvar }: {
  condominio: string; etapa: Etapa; equipe: PessoaEquipe[]; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [situacao, setSituacao] = useState<string>(etapa.situacao);
  const [responsavel, setResponsavel] = useState(etapa.responsavelId ?? "");
  const [substituto, setSubstituto] = useState(etapa.substitutoId ?? "");
  const [feito, setFeito] = useState(etapa.feito ?? "");
  const [motivo, setMotivo] = useState(etapa.motivo ?? "");
  const [modalidade, setModalidade] = useState<string>(etapa.modalidade ?? "");
  const [quando, setQuando] = useState(etapa.quando ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const apresentacao = etapa.chave === "APRESENTACAO";
  const configuracao = etapa.chave === "CONFIGURACAO";
  // A configuração sempre se aplica, e "o que foi feito" vem com o resumo dela (decisão 4).
  const situacoes = Object.entries(SITUACOES_ETAPA_IMPLANTACAO)
    .filter(([k]) => !((etapa.chave === "PEDIDO_TESTE" || configuracao) && k === "NAO_SE_APLICA"));
  const config = useCarregar<Configuracoes>(configuracao ? `/v1/clientes/${condominio}/condominio/configuracoes` : null);
  const areas = useCarregar<AreasComuns>(configuracao ? `/v1/clientes/${condominio}/condominio/areas-comuns` : null);
  const resumo = config.estado === "pronto" && areas.estado === "pronto"
    ? textoEtapaConfiguracao({ nome: "", ...config.dados, areas: areas.dados.areas }) : null;
  const [preenchido, setPreenchido] = useState(false);
  if (resumo && !preenchido) {
    setPreenchido(true);
    if (!feito) setFeito(resumo);
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${condominio}/implantacao/etapas/${etapa.numero}`, {
      metodo: "PUT",
      corpo: {
        versao: etapa.versao, situacao, responsavelId: responsavel || null, substitutoId: substituto || null, feito, motivo,
        modalidade: apresentacao && modalidade ? modalidade : null, quando: apresentacao && quando ? quando : null,
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar();
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo={`Etapa ${etapa.numero} · ${etapa.titulo}`} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={aoSalvar} /> : null}
        {etapa.descricao ? <p className="t-apoio text-tinta-suave">{etapa.descricao}</p> : null}
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-texto font-medium">Situação</legend>
          <div className="trilho flex-wrap">
            {situacoes.map(([k, texto]) => (
              <button key={k} type="button" className="chip" aria-pressed={situacao === k} onClick={() => setSituacao(k)}>{texto}</button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao id="et-resp" rotulo="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
            opcoes={opcoesEquipe(equipe, "Ninguém ainda")} erro={campos.includes("responsavel") ? "Escolha alguém da equipe do cliente." : null} />
          <CampoSelecao id="et-subst" rotulo="Substituto" value={substituto} onChange={(e) => setSubstituto(e.target.value)}
            opcoes={opcoesEquipe(equipe, "Sem substituto")} erro={campos.includes("substituto") || campos.includes("substitutoId") ? "Escolha outra pessoa." : null} />
        </div>
        {apresentacao ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoSelecao id="et-modalidade" rotulo="Modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value)}
              opcoes={[{ valor: "", texto: "A combinar" }, ...Object.entries(MODALIDADES_APRESENTACAO).map(([valor, texto]) => ({ valor, texto }))]}
              erro={campos.includes("modalidade") ? "Diga se foi presencial ou por vídeo." : null} />
            <CampoTexto id="et-quando" rotulo="Data" type="date" opcional value={quando} onChange={(e) => setQuando(e.target.value)} />
          </div>
        ) : null}
        {situacao === "NAO_SE_APLICA" ? (
          <CampoAreaTexto id="et-motivo" rotulo="Por que não se aplica" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={campos.includes("motivo") ? "Diga por que não se aplica." : null} />
        ) : (
          <CampoAreaTexto id="et-feito" rotulo="O que foi feito" required={situacao === "REALIZADA"} opcional={situacao !== "REALIZADA"} maxLength={2000}
            value={feito} onChange={(e) => setFeito(e.target.value)} ajuda="Só fica realizada com o que foi feito de fato."
            erro={campos.includes("feito") ? "Escreva o que foi feito." : null} />
        )}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function EditarPendencia({ condominio, pendencia, etapas, equipe, aoFechar, aoSalvar }: {
  condominio: string; pendencia: Pendencia | null; etapas: Etapa[]; equipe: PessoaEquipe[]; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [texto, setTexto] = useState(pendencia?.texto ?? "");
  const [etapa, setEtapa] = useState(pendencia?.etapa ? String(pendencia.etapa) : "");
  const [comQuem, setComQuem] = useState<string>(pendencia?.comQuem ?? "EQUIPE");
  const [responsavel, setResponsavel] = useState(pendencia?.responsavelId ?? "");
  const [retorno, setRetorno] = useState(pendencia?.proximoRetorno ?? "");
  const [resolucao, setResolucao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const base = `/v1/clientes/${condominio}/implantacao/pendencias`;

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const corpo = { versao: pendencia?.versao ?? null, etapa: etapa ? Number(etapa) : null, texto, comQuem, responsavelId: responsavel, proximoRetorno: retorno };
    const r = pendencia ? await chamarApi(`${base}/${pendencia.id}`, { metodo: "PUT", corpo }) : await chamarApi(base, { corpo });
    if (!r.ok) return setErro(r.erro);
    aoSalvar();
  }

  async function resolver() {
    if (!pendencia) return;
    setErro(null);
    const r = await chamarApi(`${base}/${pendencia.id}/resolver`, { corpo: { versao: pendencia.versao, resolucao } });
    if (!r.ok) return setErro(r.erro);
    aoSalvar();
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo={pendencia ? "Pendência" : "Nova pendência"} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={aoSalvar} /> : null}
        <CampoTexto id="pe-texto" rotulo="Pendência" required maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={campos.includes("texto") ? "Escreva a pendência (3 a 300 caracteres)." : null} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao id="pe-etapa" rotulo="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}
            opcoes={[{ valor: "", texto: "Sem etapa" }, ...etapas.map((x) => ({ valor: String(x.numero), texto: `${x.numero} · ${x.titulo}` }))]} />
          <CampoSelecao id="pe-quem" rotulo="Quem precisa agir" value={comQuem} onChange={(e) => setComQuem(e.target.value)}
            opcoes={Object.entries(COM_QUEM).map(([valor, t]) => ({ valor, texto: t }))} />
          <CampoSelecao id="pe-resp" rotulo="Responsável na equipe" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
            opcoes={opcoesEquipe(equipe, "Escolha")} erro={campos.includes("responsavel") || campos.includes("responsavelId") ? "Escolha alguém da equipe do cliente." : null} />
          <CampoTexto id="pe-retorno" rotulo="Próximo retorno" type="date" required value={retorno} onChange={(e) => setRetorno(e.target.value)}
            erro={campos.includes("proximoRetorno") ? "Diga quando retomar." : null} />
        </div>
        {pendencia ? (
          <div className="grid gap-2 rounded-xl border border-linha p-3">
            <CampoTexto id="pe-resolucao" rotulo="Como resolveu" opcional maxLength={300} value={resolucao} onChange={(e) => setResolucao(e.target.value)}
              erro={campos.includes("resolucao") ? "Diga como resolveu." : null} />
            <Botao variante="secundario" className="justify-self-start" onClick={resolver}>Marcar resolvida</Botao>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit">Salvar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function Entregar({ condominio, nome, dados, aoFechar, aoEntregar }: {
  condominio: string; nome: string; dados: Implantacao; aoFechar: () => void; aoEntregar: () => void;
}) {
  const [recado, setRecado] = useState(RECADO_ENTREGA(nome));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const e = dados.entrega!;

  async function entregar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${condominio}/implantacao/entregar`, { corpo: { versao: dados.implantacao!.versao, recado } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoEntregar();
  }

  const conferir = [
    { ok: !!e.pedidoTeste, texto: e.pedidoTeste ? `Pedido de teste ${e.pedidoTeste.protocolo} registrado, respondido e concluído pelo síndico` : FALTAS_ENTREGA.SEM_PEDIDO_TESTE },
    { ok: e.sindicos > 0, texto: FALTAS_ENTREGA.SEM_SINDICO },
    { ok: !e.faltando.includes("ETAPAS_ABERTAS"), texto: FALTAS_ENTREGA.ETAPAS_ABERTAS },
    { ok: e.pendenciasClienteVencidas === 0, texto: e.pendenciasClienteVencidas ? `${e.pendenciasClienteVencidas} pendência com o cliente vencida` : "Nenhuma pendência com o cliente vencida" },
  ];
  return (
    <Dialogo aberto titulo={`Entregar o ${nome}`} aoFechar={aoFechar}>
      <form onSubmit={entregar} noValidate className="grid gap-4">
        {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
        <Aviso tom="info">O síndico consegue sozinho? Confira antes de entregar. Notas internas, pendências internas e o roteiro não vão para o cliente.</Aviso>
        <ul className="grid gap-2 t-texto">
          {conferir.map((c) => (
            <li key={c.texto} className="flex items-start gap-2">
              <span className={c.ok ? "text-ok" : "text-atencao"}><IconeMarca marca={c.ok ? "ok" : "atencao"} className="mt-1 h-3.5 w-3.5" /></span>
              <span>{c.texto}<span className="sr-only">{c.ok ? " (conferido)" : " (falta)"}</span></span>
            </li>
          ))}
        </ul>
        <CampoAreaTexto id="en-recado" rotulo="Recado de entrega ao síndico" required maxLength={1000} value={recado} onChange={(ev) => setRecado(ev.target.value)}
          erro={camposComErro(erro).includes("recado") ? "Escreva o recado (3 a 1.000 caracteres)." : null} />
        <p className="t-apoio text-tinta-suave">Entregar muda o cliente para ativo e manda o recado ao síndico no sino da Plataforma. Fica no histórico e não volta atrás.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando || e.faltando.length > 0}>{enviando ? "Entregando…" : "Entregar ao cliente"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function NumeroEtapa({ e, atual }: { e: Etapa; atual: boolean }) {
  const feita = e.situacao === "REALIZADA" || e.situacao === "NAO_SE_APLICA";
  if (feita) {
    return <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[image:var(--grad-acao)] text-superficie"><Icone nome="check" className="h-3.5 w-3.5" /></span>;
  }
  return (
    <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full t-apoio font-semibold ${atual ? "border-2 border-violeta-600 text-violeta-600" : "border border-linha text-tinta-suave"}`}>
      {e.numero}
    </span>
  );
}

function textoConfiguracao(c: NonNullable<Implantacao["configuracao"]>): string {
  return `${c.conferidas} de ${c.total} partes conferidas${c.faltando.length ? ` · falta ${c.faltando.map((x) => PARTES_CONFIGURACAO[x].nome).join(", ")}` : ""}`;
}

export function AbaImplantacao({ ficha, recarregar, avisar, irPara }: PropsAba) {
  const carga = useCarregar<Implantacao>(`/v1/clientes/${ficha.condominio.id}/implantacao`);
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [pendencia, setPendencia] = useState<Pendencia | "nova" | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [legenda, setLegenda] = useState(false);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo o roteiro…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  if (d.legado) {
    return <Vazio titulo="Cliente ativo antes do roteiro">Este cliente foi concluído antes do roteiro de implantação existir. Não há etapas a seguir.</Vazio>;
  }
  const etapas = d.etapas ?? [];
  const pendencias = d.pendencias ?? [];
  const equipe = d.equipe ?? [];
  const feitas = etapas.filter((e) => e.situacao === "REALIZADA" || e.situacao === "NAO_SE_APLICA").length;
  const abertas = pendencias.filter((p) => !p.resolvidaEm);
  const entregue = !!d.implantacao?.entregueEm;
  const proxima = entregue ? undefined : etapas.find((e) => e.situacao !== "REALIZADA" && e.situacao !== "NAO_SE_APLICA");
  const podeEntregar = !!d.pode?.entregar && (d.entrega?.faltando.length ?? 1) === 0;
  const salvo = () => {
    setEtapa(null);
    setPendencia(null);
    carga.recarregar();
  };
  const interno = <span className="selo justify-self-start" data-tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Interno · o cliente não vê</span>;
  const abrirConfiguracao = irPara ? <Botao tamanho="m" className="justify-self-start" onClick={() => irPara("configuracao")}><Icone nome="ajuste" />Abrir a configuração</Botao> : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
      <div className="grid min-w-0 gap-6">
        <Cartao id="t-roteiro" titulo="Roteiro de implantação" icone="preparar">
          {interno}
          <div className="grid gap-2">
            <p className="flex justify-between gap-3 t-apoio text-tinta-suave">
              <span>{feitas} de {etapas.length} etapas</span><span>roteiro versão {d.implantacao!.roteiroVersao}</span>
            </p>
            <BarraEtapas feitas={feitas} total={etapas.length} rotulo={`${feitas} de ${etapas.length} etapas feitas`} />
          </div>
          {entregue ? (
            <Aviso tom="ok" titulo="Implantação entregue">
              Entregue em {formatarData(d.implantacao!.entregueEm!)}{d.implantacao!.entreguePor ? ` por ${d.implantacao!.entreguePor}` : ""}. O roteiro não muda mais.
            </Aviso>
          ) : proxima ? (
            <section aria-labelledby="t-proxima" className="grid gap-3 rounded-[16px] border-2 border-violeta-600 p-4">
              <p id="t-proxima" className="t-rotulo text-violeta-600">Próxima etapa</p>
              <div className="flex items-start gap-3">
                <NumeroEtapa e={proxima} atual />
                <span className="grid min-w-0 gap-0.5">
                  <span className="t-titulo-secao font-medium">{proxima.titulo}</span>
                  <span className="t-apoio">
                    {proxima.chave === "CONFIGURACAO" && d.configuracao
                      ? (d.configuracao.faltando.length ? `${d.configuracao.conferidas} de ${d.configuracao.total} partes conferidas. Falta conferir: ${d.configuracao.faltando.map((x) => PARTES_CONFIGURACAO[x].nome).join(", ")}.`
                        : "Tudo conferido: pode marcar como realizada.")
                      : proxima.chave === "ENTREGA" ? (d.entrega?.faltando.length ? `Falta: ${d.entrega.faltando.map((f) => FALTAS_ENTREGA[f]).join("; ")}.` : "Tudo pronto para entregar ao cliente.")
                        : [proxima.descricao, proxima.responsavel ? `com ${proxima.responsavel}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </div>
              {proxima.chave === "CONFIGURACAO" ? abrirConfiguracao
                : proxima.chave === "ENTREGA" ? (podeEntregar ? <Botao tamanho="m" className="justify-self-start" onClick={() => setEntregando(true)}><Icone nome="check" />Entregar ao cliente</Botao> : null)
                  : d.pode?.editar ? <Botao tamanho="m" variante="contorno" className="justify-self-start" onClick={() => setEtapa(proxima)}><Icone nome="editar" />Abrir a etapa</Botao> : null}
            </section>
          ) : null}
        </Cartao>

        <Cartao id="t-etapas" titulo={`As ${etapas.length} etapas`} icone="lista"
          acao={<AcaoCartao icone="info" aoClicar={() => setLegenda(true)}>O que é cada etapa</AcaoCartao>}>
          <ol className="divide-y divide-linha">
            {etapas.map((e) => {
              const detalhe = e.situacao === "REALIZADA"
                ? [e.responsavel, e.realizadaEm ? `realizada em ${formatarData(e.realizadaEm)}` : null].filter(Boolean).join(" · ")
                : e.situacao === "NAO_SE_APLICA" ? `Não se aplica: ${e.motivo ?? ""}`
                  : e.chave === "CONFIGURACAO" && d.configuracao ? textoConfiguracao(d.configuracao)
                    : e.chave === "ENTREGA" ? (podeEntregar ? "Tudo pronto: as etapas 1 a 7, o síndico com conta própria e o pedido de teste concluído."
                      : "O botão Entregar aparece aqui quando as etapas 1 a 7 estiverem realizadas ou não se aplicarem, o síndico tiver conta própria e o pedido de teste estiver concluído.")
                      : [e.descricao, e.responsavel, e.substituto ? `substituto ${e.substituto}` : null,
                        e.modalidade ? MODALIDADES_APRESENTACAO[e.modalidade] : null, e.quando ? `marcada para ${mostrarDataSemHora(e.quando)}` : null]
                        .filter(Boolean).join(" · ");
              const podeAbrir = d.pode?.editar && e.chave !== "ENTREGA";
              return (
                <li key={e.numero} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                  <NumeroEtapa e={e} atual={e === proxima} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    {podeAbrir ? (
                      <button type="button" className="elo justify-self-start text-tinta hover:text-violeta-600" onClick={() => setEtapa(e)}>
                        <span className="sr-only">Etapa {e.numero}: </span>{e.titulo}
                      </button>
                    ) : <span className="font-medium"><span className="sr-only">Etapa {e.numero}: </span>{e.titulo}</span>}
                    <span className="t-apoio">{detalhe || e.descricao}</span>
                    {e.chave === "ENTREGA" && podeEntregar && e !== proxima ? (
                      <Botao tamanho="m" className="mt-1 justify-self-start" onClick={() => setEntregando(true)}><Icone nome="check" />Entregar ao cliente</Botao>
                    ) : null}
                  </span>
                  {e.chave === "ENTREGA" && e.situacao !== "REALIZADA" ? null : <Selo tom={TOM_ETAPA[e.situacao]}>{SITUACOES_ETAPA_IMPLANTACAO[e.situacao]}</Selo>}
                </li>
              );
            })}
          </ol>
        </Cartao>
      </div>

      <Cartao id="t-pendencias" titulo="Pendências" icone="alerta"
        acao={d.pode?.editar ? <Botao variante="contorno" tamanho="m" onClick={() => setPendencia("nova")}><Icone nome="mais" />Nova pendência</Botao> : undefined}>
        {abertas.length === 0 ? <p className="t-apoio">Nenhuma pendência aberta.</p> : (
          <ul className="grid gap-3">
            {abertas.map((p) => (
              <li key={p.id} className={`grid gap-2 rounded-[14px] border p-4 ${p.vencida ? "border-erro-borda bg-erro-fundo" : "border-linha"}`}>
                <span className="flex items-start gap-3">
                  <Icone nome="relogio" className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${p.vencida ? "text-erro" : "text-tinta-suave"}`} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium [overflow-wrap:anywhere]">{p.texto}</span>
                    <span className="t-apoio">
                      {[p.etapa ? `Etapa ${p.etapa}` : null, p.comQuem === "CLIENTE" ? "com o cliente" : "com a equipe TRÍADE", p.responsavel ? `${p.responsavel} acompanha` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 pl-7">
                  {p.vencida ? <Selo tom="erro">Venceu em {mostrarDataSemHora(p.proximoRetorno).slice(0, 5)}</Selo>
                    : <Selo tom={p.proximoRetorno === hojeEmBrasilia() ? "atencao" : "neutro"}>Retorno {mostrarDataSemHora(p.proximoRetorno)}</Selo>}
                  {d.pode?.editar ? (
                    <Botao variante="contorno" tamanho="m" className="bg-superficie" onClick={() => setPendencia(p)} aria-label={`Resolver: ${p.texto}`}><Icone nome="check" />Resolver</Botao>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Dialogo aberto={legenda} titulo="O que é cada etapa" aoFechar={() => setLegenda(false)}>
        <dl className="grid gap-3 t-texto">
          {etapas.map((e) => (
            <div key={e.numero} className="grid gap-0.5">
              <dt className="font-medium">{e.numero} · {e.titulo}</dt>
              {e.descricao ? <dd className="t-apoio">{e.descricao}</dd> : null}
            </div>
          ))}
        </dl>
        <p className="t-apoio">
          Situação da etapa: preparada, pendente, realizada ou não se aplica (com motivo). O roteiro tem versão: mudar o roteiro não muda as implantações em andamento.
        </p>
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setLegenda(false)}>Fechar</Botao></div>
      </Dialogo>
      {etapa ? <EditarEtapa condominio={ficha.condominio.id} etapa={etapa} equipe={equipe} aoFechar={() => setEtapa(null)} aoSalvar={salvo} /> : null}
      {pendencia ? (
        <EditarPendencia condominio={ficha.condominio.id} pendencia={pendencia === "nova" ? null : pendencia} etapas={etapas} equipe={equipe}
          aoFechar={() => setPendencia(null)} aoSalvar={salvo} />
      ) : null}
      {entregando ? (
        <Entregar condominio={ficha.condominio.id} nome={ficha.condominio.nome} dados={d} aoFechar={() => setEntregando(false)}
          aoEntregar={() => {
            setEntregando(false);
            avisar({ tom: "ok", texto: "Implantação entregue. O cliente está ativo e o síndico recebeu o recado." });
            recarregar();
          }} />
      ) : null}
    </div>
  );
}
