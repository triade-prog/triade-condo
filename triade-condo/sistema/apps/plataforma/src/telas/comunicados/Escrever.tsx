"use client";
// Escrever comunicado (design "Telas dos Comunicados", tela 2; DC15, telas-modelo escrever-comunicado-*;
// CD-01, CD-02, CD-05, CD-06, CD-09): no computador, 3 partes numeradas (o que avisar, para quem e
// como chega, quando) com quem vai receber ao lado e o rodapé fixo, cujo botão principal diz o que
// acontece; no celular, 3 passos com barra de progresso, Continuar e Voltar e o resumo com Alterar.
// assunto, título e texto; fotos e a ligação com pedido ou manutenção são opcionais. Ao escolher
// para quem, a tela mostra quantos contatos recebem e as unidades que ficam sem ninguém. Fica
// como rascunho até publicar ou programar. O publicado não volta aqui: corrige-se em versão nova.
// "Como vai chegar" (design "Mural online e e-mail", tela 3; CD-12, CD-13): se aparece no mural
// online e se vai por e-mail, com quantos recebem por e-mail antes de publicar.
// O WhatsApp do condomínio (design "Comunicado pelo WhatsApp", tela 1; CD-02, W-20): só para quem
// aceitou, com a conta de quem recebe por cada canal, pelos dois e por nenhum.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ASSUNTOS_COMUNICADO, COMUNICADOS_WHATSAPP_POR_MINUTO, contagemDosCanais, descreverAlcance, minutosDoWhatsapp, mostrarTamanho, noHorarioSemEnvio,
  PUBLICOS_COMUNICADO,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, Icone, textoDoErro, Vazio, type ErroApi, type NomeIcone,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { CartaoFicha, Escolha } from "../moradores/comum.tsx";
import { useCelular } from "../celular.ts";
import { deDataHoraLocal, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ArquivoComunicado, AssuntoComunicado, ComunicadoDetalhe, OpcoesComunicado, PublicoCalculado, PublicoComunicado } from "../tipos.ts";
import { conferirArquivo, enviarUm, ICONE_ASSUNTO } from "./comum.tsx";

const LIMITE_FOTO = 10 * 1024 * 1024;
type Acao = "RASCUNHO" | "PROGRAMAR" | "PUBLICAR";

type Passo = 1 | 2 | 3;
const PARTES = ["O que avisar", "Para quem e como chega", "Quando"] as const;

/** Uma parte do formulário: com número no computador; no celular, só aparece no seu passo. */
function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`t-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h2 id={`t-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h2>
      </div>
      {children}
    </section>
  );
}

/** No celular: em que passo está, a barra de progresso e o que já foi escolhido, com Alterar. */
function TopoPassos({ passo, resumos, irPara }: { passo: Passo; resumos: string[]; irPara: (p: Passo) => void }) {
  return (
    <div className="grid gap-3 md:hidden">
      <div className="passos" role="progressbar" aria-label="Passos do comunicado" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo}
        aria-valuetext={`Passo ${passo} de 3: ${PARTES[passo - 1]}`}>
        {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
      </div>
      {resumos.slice(0, passo - 1).map((texto, i) => (
        <button key={i} type="button" className="resumo-passo" onClick={() => irPara((i + 1) as Passo)}>
          <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
          <span className="grid min-w-0 flex-1">
            <span className="t-apoio">{PARTES[i]}</span>
            <span className="truncate">{texto}</span>
          </span>
          <span className="alterar">Alterar</span>
        </button>
      ))}
    </div>
  );
}

/** Um canal no resumo de quem recebe: o nome e quantos. */
function LinhaCanal({ icone, tom, nome, valor, apagado }: { icone: NomeIcone; tom: "ok" | "info" | "neutro"; nome: string; valor: string; apagado?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-linha py-2.5">
      <span className="flex items-center gap-2.5"><span className="ladrilho h-7 w-7 rounded-[9px]" data-tom={tom} aria-hidden="true"><Icone nome={icone} className="h-3.5 w-3.5" /></span>{nome}</span>
      <span className={`font-semibold ${apagado ? "text-tinta-suave" : ""}`}>{valor}</span>
    </li>
  );
}

/** Em que passo do celular mora cada campo, para voltar a ele quando a API recusa. */
const PASSO_DO_CAMPO: Record<string, Passo> = { assunto: 1, titulo: 1, texto: 1, pedidoId: 1, manutencaoId: 1, blocos: 2, unidades: 2, contatos: 2, programadoPara: 3 };

export function Escrever() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const opcoes = useCarregar<OpcoesComunicado>("/v1/condominio/comunicados/opcoes");
  const atual = useCarregar<ComunicadoDetalhe>(id ? `/v1/condominio/comunicados/${id}` : null);
  const voltar = <Link href={id ? `/comunicados/comunicado?id=${id}` : "/comunicados"} className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline">
    <Icone nome="esq" className="h-4 w-4" />{id ? "Comunicado" : "Comunicados"}</Link>;

  if (opcoes.estado === "carregando" || (id && atual.estado === "carregando")) return <Carregando rotulo="Abrindo o comunicado…" />;
  const erro = opcoes.estado === "erro" ? opcoes : id && atual.estado === "erro" ? atual : null;
  if (erro) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Escrever comunicado</h1><ErroCarregar erro={erro.erro} texto={erro.texto} tentarDeNovo={erro.recarregar} /></div>;
  if (opcoes.estado !== "pronto") return null;
  const detalhe = id && atual.estado === "pronto" ? atual.dados : null;
  if (detalhe && !detalhe.pode.editar) {
    return (
      <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Escrever comunicado</h1>
        <Vazio titulo="Este comunicado não se edita">Publicado não muda: use Corrigir no comunicado, que vira uma versão nova.</Vazio>
      </div>
    );
  }
  return <Formulario key={detalhe?.comunicado.id ?? "novo"} o={opcoes.dados} detalhe={detalhe}
    pedidoInicial={busca.get("pedido")} manutencaoInicial={busca.get("manutencao")} voltar={voltar} recarregar={atual.recarregar}
    escrito={detalhe ? null : { titulo: busca.get("titulo") ?? "", texto: busca.get("texto") ?? "" }} />;
}

function Formulario({ o, detalhe, pedidoInicial, manutencaoInicial, voltar, recarregar, escrito }: {
  o: OpcoesComunicado;
  /** Título e texto já escritos por quem chamou (ex.: a queda do WhatsApp, W-17). Nada se publica sem a pessoa. */
  escrito?: { titulo: string; texto: string } | null;
  detalhe: ComunicadoDetalhe | null;
  pedidoInicial: string | null;
  manutencaoInicial: string | null;
  voltar: React.ReactNode;
  recarregar: () => void;
}) {
  const router = useRouter();
  const { atualizar } = usePlataforma();
  const c = detalhe?.comunicado;
  const manutencaoLigada = manutencaoInicial && o.manutencoes?.some((m) => m.id === manutencaoInicial) ? manutencaoInicial : "";
  const [v, setV] = useState({
    assunto: (c?.assunto ?? (manutencaoLigada && o.assuntos.includes("OBRAS") ? "OBRAS" : o.assuntos[0] ?? "AVISO")) as AssuntoComunicado,
    titulo: c?.titulo ?? escrito?.titulo.slice(0, 120) ?? "",
    texto: c?.texto ?? escrito?.texto.slice(0, 4000) ?? "",
    publico: (c?.publico ?? "TODOS") as PublicoComunicado,
    blocos: c?.blocos ?? [],
    unidades: c?.unidades ?? [],
    contatos: c?.contatos ?? [],
    pedidoId: c?.pedidoId ?? (pedidoInicial && o.pedidos?.some((p) => p.id === pedidoInicial) ? pedidoInicial : ""),
    manutencaoId: c?.manutencaoId ?? manutencaoLigada,
    quando: c?.estado === "PROGRAMADO" && c.programadoPara ? "PROGRAMAR" : "PUBLICAR" as "PUBLICAR" | "PROGRAMAR",
    programadoPara: c?.programadoPara ? paraDataHoraLocal(c.programadoPara) : "",
    // Sem escolha, o mural segue os assuntos marcados nas Configurações.
    noMural: (detalhe?.canais?.noMural ?? null) as boolean | null,
    porEmail: detalhe?.canais?.porEmail ?? true,
    porWhatsapp: detalhe?.canais?.porWhatsapp ?? true,
  });
  const [novos, setNovos] = useState<{ arquivo: File; problema: string | null }[]>([]);
  const [tirar, setTirar] = useState<ArquivoComunicado | null>(null);
  const [publico, setPublico] = useState<PublicoCalculado | null>(c ? detalhe!.publicoAgora : null);
  const [verQuem, setVerQuem] = useState(false);
  const [verNenhum, setVerNenhum] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [passo, setPasso] = useState<Passo>(1);
  const [ligar, setLigar] = useState(false);
  const celular = useCelular();
  const mudar = (x: Partial<typeof v>) => setV((y) => ({ ...y, ...x }));
  const existentes = (detalhe?.arquivos ?? []).filter((a) => a.situacao !== "NAO_LIBERADO");
  const vagas = 4 - existentes.length;

  // A conta de quem recebe é do banco, refeita a cada mudança do público ou do assunto.
  const chave = JSON.stringify([v.assunto, v.publico, v.blocos, v.unidades, v.contatos]);
  const escolha = { BLOCOS: v.blocos, UNIDADES: v.unidades, CONTATOS: v.contatos, TODOS: null }[v.publico];
  const incompleto = escolha !== null && escolha.length === 0;
  useEffect(() => {
    if (incompleto) return;
    const t = setTimeout(() => {
      void chamarApi<PublicoCalculado>("/v1/condominio/comunicados/publico", { corpo: {
        assunto: v.assunto, publico: v.publico, blocos: v.blocos, unidades: v.unidades, contatos: v.contatos,
      } }).then((r) => { if (r.ok) setPublico(r.dados); });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const unidadesVisiveis = useMemo(() => {
    const f = filtroUnidade.trim().toLowerCase();
    return f ? o.unidades.filter((u) => u.nome.toLowerCase().includes(f)) : o.unidades;
  }, [o.unidades, filtroUnidade]);
  const horaProgramada = v.programadoPara.slice(11, 16);
  const silencio = v.quando === "PROGRAMAR" && /^\d\d:\d\d$/.test(horaProgramada) && noHorarioSemEnvio(horaProgramada, o.silencio.inicio, o.silencio.fim);

  const alternar = (lista: string[], x: string) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);
  const canais = o.canais ?? { muralLigado: false, muralAssuntos: [], emailLigado: false };
  const noMural = v.publico === "TODOS" && (v.noMural ?? canais.muralAssuntos.includes(v.assunto));
  const whatsappLigado = canais.whatsappLigado === true;
  const conta = publico && !incompleto
    ? contagemDosCanais({ contatos: publico.contatos, comEmail: publico.comEmail ?? 0, comWhatsapp: publico.comWhatsapp, pelosDois: publico.pelosDois },
      { email: canais.emailLigado && v.porEmail, whatsapp: whatsappLigado && v.porWhatsapp })
    : null;
  const ninguemNoWhatsapp = whatsappLigado && publico !== null && !incompleto && !publico.comWhatsapp;
  const nenhum = (publico?.quem ?? []).filter((p) => !(canais.emailLigado && v.porEmail && p.email) && !(whatsappLigado && v.porWhatsapp && p.whatsapp));

  async function salvar(acao: Acao, ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(acao);
    const corpo = {
      assunto: v.assunto, titulo: v.titulo, texto: v.texto, publico: v.publico, blocos: v.blocos, unidades: v.unidades, contatos: v.contatos,
      pedidoId: v.pedidoId || null, manutencaoId: v.manutencaoId || null,
      programadoPara: acao === "PROGRAMAR" ? deDataHoraLocal(v.programadoPara) : null,
      noMural, porEmail: v.porEmail, porWhatsapp: whatsappLigado ? v.porWhatsapp && !ninguemNoWhatsapp : undefined,
    };
    const validos = novos.filter((n) => !n.problema);
    // Com fotos novas, guarda primeiro como rascunho, envia as fotos e só então publica ou programa.
    const primeira = validos.length && acao !== "RASCUNHO" ? "RASCUNHO" : acao;
    let r = c
      ? await chamarApi<{ id: string; versao: number }>(`/v1/condominio/comunicados/${c.id}`, { metodo: "PUT", corpo: { ...corpo, versao: c.versao, acao: primeira } })
      : await chamarApi<{ id: string; versao: number }>("/v1/condominio/comunicados", { corpo: { ...corpo, acao: primeira } });
    if (!r.ok) {
      setEnviando(null);
      const campo = camposComErro(r.erro).find((x) => PASSO_DO_CAMPO[x]);
      if (campo) setPasso(PASSO_DO_CAMPO[campo]!);
      return setErro(r.erro);
    }
    const idSalvo = r.dados.id;
    const falhas: string[] = [];
    for (const n of validos) {
      const x = await enviarUm(`/v1/condominio/comunicados/${idSalvo}/arquivos`, {}, n.arquivo, (d) => d.arquivoId!);
      if (!x.liberado) falhas.push(`${x.nome}: ${x.motivo ?? "não foi liberado."}`);
    }
    if (falhas.length) {
      setEnviando(null);
      setNovos([]);
      setAviso(`Guardado como rascunho. ${falhas.join(" ")} Confira as fotos antes de publicar.`);
      router.replace(`/comunicados/escrever?id=${idSalvo}`);
      recarregar();
      return;
    }
    if (primeira !== acao) {
      r = await chamarApi<{ id: string; versao: number }>(`/v1/condominio/comunicados/${idSalvo}`, { metodo: "PUT", corpo: { ...corpo, versao: r.dados.versao, acao } });
      if (!r.ok) {
        setEnviando(null);
        setNovos([]);
        setErro(r.erro);
        router.replace(`/comunicados/escrever?id=${idSalvo}`);
        return;
      }
    }
    setEnviando(null);
    atualizar();
    router.push(`/comunicados/comunicado?id=${idSalvo}&feito=${acao}`);
  }

  const comErro = camposComErro(erro);
  const msg = (campo: string, texto = "") => (comErro.includes(campo) ? texto || "Confira este campo." : null);
  const assuntos = o.assuntos.includes(v.assunto) ? o.assuntos : [...o.assuntos, v.assunto];
  const ligado = Boolean(v.pedidoId || v.manutencaoId) || ligar;
  const textoPrincipal = v.quando === "PROGRAMAR"
    ? (/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v.programadoPara) ? `Programar para ${v.programadoPara.slice(8, 10)}/${v.programadoPara.slice(5, 7)} às ${horaProgramada}` : "Programar")
    : "Publicar agora";
  const resumos = [
    `${ASSUNTOS_COMUNICADO[v.assunto]} · ${v.titulo.trim() || "sem título"}`,
    `${PUBLICOS_COMUNICADO[v.publico]}${publico && !incompleto ? ` · ${descreverAlcance(publico.contatos, publico.unidades)}` : ""}`,
  ];

  const parte1 = (
    <>
      <div role="group" aria-label="Assunto" className="grid gap-1.5">
        <span className="text-[13px] font-medium" aria-hidden="true">Assunto</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {assuntos.map((a) => {
            const atual = v.assunto === a;
            return (
              <button key={a} type="button" aria-pressed={atual} onClick={() => mudar({ assunto: a })}
                className={`flex items-center gap-2 rounded-[14px] border p-3 text-left text-[13px] font-medium xl:flex-col xl:items-start ${atual ? "border-violeta-600 bg-violeta-50 ring-1 ring-violeta-600" : "border-linha bg-superficie hover:border-violeta-300"}`}>
                <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom={atual ? "violeta" : undefined} aria-hidden="true"><Icone nome={ICONE_ASSUNTO[a] ?? "megafone"} className="h-4 w-4" /></span>
                {ASSUNTOS_COMUNICADO[a]}
              </button>
            );
          })}
        </div>
        {msg("assunto") ? <span className="text-xs text-erro">Escolha um assunto em uso.</span> : null}
      </div>
      <CampoTexto id="cm-titulo" rotulo="Título" required maxLength={120} value={v.titulo} onChange={(e) => mudar({ titulo: e.target.value })}
        erro={msg("titulo", "De 3 a 120 caracteres.")} />
      <CampoAreaTexto id="cm-texto" rotulo="Texto" required maxLength={4000} rows={6} value={v.texto} onChange={(e) => mudar({ texto: e.target.value })}
        erro={msg("texto", "De 3 a 4000 caracteres.")}
        ajuda={o.assinatura ? `Sai assinado como "${o.assinatura}". A assinatura fica em Configurações › Comunicados.` : "Sem assinatura padrão: defina em Configurações › Comunicados."} />

      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Fotos ou PDF <span className="font-normal text-tinta-suave">(opcional)</span></span>
        {vagas - novos.length > 0 ? (
          <label className="flex items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-violeta-300 bg-violeta-50 px-5 py-4 max-md:flex-col max-md:text-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-superficie text-violeta-600 shadow-s1" aria-hidden="true"><Icone nome="enviar" /></span>
            <span className="grid flex-1 gap-0.5">
              <span className="text-sm font-semibold">Escolher foto ou PDF</span>
              <span className="t-apoio">JPG, PNG, WEBP ou PDF · até 10 MB · até 4 arquivos, sem a localização das fotos</span>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="text-sm max-md:w-full"
              onChange={(e) => {
                const lista = [...(e.target.files ?? [])].slice(0, vagas - novos.length).map((arquivo) => ({ arquivo, problema: conferirArquivo(arquivo, LIMITE_FOTO) }));
                setNovos((xs) => [...xs, ...lista]);
                e.target.value = "";
              }} />
          </label>
        ) : null}
        {existentes.length ? (
          <ul className="grid gap-2">
            {existentes.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[14px] border border-linha bg-superficie px-3 py-2.5 text-sm">
                <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom="ok" aria-hidden="true"><Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} className="h-4.5 w-4.5" /></span>
                <span className="grid min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="font-medium">{a.nome}</span>
                  <span className="t-apoio">{mostrarTamanho(a.tamanho)}{a.situacao === "ENVIANDO" ? " · verificando" : ""}</span></span>
                {a.podeTirar ? <Botao variante="discreto" aria-label={`Tirar ${a.nome}`} onClick={() => setTirar(a)}>Tirar</Botao> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {novos.length ? (
          <ul className="grid gap-2" aria-label="Arquivos para enviar">
            {novos.map((n, i) => (
              <li key={`${n.arquivo.name}-${i}`} className={`flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm ${n.problema ? "border-atencao-borda bg-atencao-fundo" : "border-linha bg-superficie"}`}>
                <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom={n.problema ? "atencao" : "violeta"} aria-hidden="true"><Icone nome={n.problema ? "alerta" : "clipe"} className="h-4.5 w-4.5" /></span>
                <span className="grid min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="font-medium">{n.arquivo.name}</span>
                  {n.problema ? <span className="text-atencao">{n.problema}</span> : <span className="t-apoio">{mostrarTamanho(n.arquivo.size)} · vai ao salvar</span>}</span>
                <Botao variante="discreto" aria-label={`Tirar ${n.arquivo.name} da lista`} onClick={() => setNovos((xs) => xs.filter((_, j) => j !== i))}>Tirar</Botao>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {o.pedidos || o.manutencoes ? (
        ligado ? (
          <div className="grid gap-3 rounded-[14px] border border-linha p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {o.pedidos ? (
                <CampoSelecao id="cm-pedido" rotulo="Pedido" value={v.pedidoId} onChange={(e) => mudar({ pedidoId: e.target.value })} erro={msg("pedidoId", "Pedido não encontrado.")}
                  opcoes={[{ valor: "", texto: "Nenhum" }, ...(v.pedidoId && !o.pedidos.some((p) => p.id === v.pedidoId) ? [{ valor: v.pedidoId, texto: "Pedido já ligado" }] : []),
                    ...o.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.assunto}` }))]} />
              ) : null}
              {o.manutencoes ? (
                <CampoSelecao id="cm-manutencao" rotulo="Manutenção" value={v.manutencaoId} onChange={(e) => mudar({ manutencaoId: e.target.value })}
                  erro={msg("manutencaoId", "Manutenção não encontrada.")}
                  opcoes={[{ valor: "", texto: "Nenhuma" }, ...(v.manutencaoId && !o.manutencoes.some((m) => m.id === v.manutencaoId) ? [{ valor: v.manutencaoId, texto: "Manutenção já ligada" }] : []),
                    ...o.manutencoes.map((m) => ({ valor: m.id, texto: `${m.titulo} · ${m.local}` }))]} />
              ) : null}
            </div>
            <p className="t-apoio">O pedido ou a manutenção passam a mostrar este comunicado. Comunicar o prédio não conta como retorno ao morador do pedido.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-violeta-300 px-4 py-3">
            <Icone nome="link" className="h-5 w-5 shrink-0 text-tinta-suave" />
            <span className="grid flex-1"><span className="text-sm font-medium">Ligar a um pedido ou manutenção</span>
              <span className="t-apoio">Opcional. O pedido passa a mostrar este comunicado. Não conta como retorno ao morador.</span></span>
            <Botao variante="discreto" tamanho="m" onClick={() => setLigar(true)}>Escolher</Botao>
          </div>
        )
      ) : null}
    </>
  );

  const canalCaixa = (rotulo: string, ajuda: ReactNode, marcada: boolean, aoMudar?: (x: boolean) => void, desligada = false) => (
    <label className={`flex items-start gap-3 rounded-[14px] border border-linha px-3.5 py-3 text-sm ${desligada ? "bg-fundo" : "bg-superficie"}`}>
      <input type="checkbox" role="switch" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={marcada} disabled={desligada || !aoMudar}
        onChange={(e) => aoMudar?.(e.target.checked)} />
      <span className="grid gap-0.5"><span className={`font-medium ${desligada ? "text-tinta-suave" : ""}`}>{rotulo}</span><span className="t-apoio">{ajuda}</span></span>
    </label>
  );

  const parte2 = (
    <>
      <div className="grid gap-1.5">
        <span className="text-[13px] font-medium" aria-hidden="true">Para quem</span>
        <Escolha rotulo="Para quem" atual={v.publico} aoMudar={(x) => mudar({ publico: x })}
          opcoes={(Object.keys(PUBLICOS_COMUNICADO) as PublicoComunicado[])
            .filter((p) => (p !== "BLOCOS" || o.blocos.length > 0) && (p !== "CONTATOS" || o.pode.verMoradores))
            .map((p) => ({ valor: p, texto: PUBLICOS_COMUNICADO[p] }))} />
      </div>
      {v.publico === "BLOCOS" ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">Blocos</legend>
          {o.blocos.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.blocos.includes(b.id)} onChange={() => mudar({ blocos: alternar(v.blocos, b.id) })} />{b.nome}
            </label>
          ))}
          {msg("blocos") ? <span className="text-xs text-erro">Escolha os blocos.</span> : null}
        </fieldset>
      ) : null}
      {v.publico === "UNIDADES" ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">Unidades {v.unidades.length ? `(${v.unidades.length} escolhidas)` : ""}</legend>
          <input className="campo" aria-label="Filtrar unidades" placeholder="Filtrar" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} />
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
            {unidadesVisiveis.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.unidades.includes(u.id)} onChange={() => mudar({ unidades: alternar(v.unidades, u.id) })} />{u.nome}
              </label>
            ))}
          </div>
          {msg("unidades") ? <span className="text-xs text-erro">Escolha as unidades.</span> : null}
        </fieldset>
      ) : null}
      {v.publico === "CONTATOS" && o.contatos ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">Contatos {v.contatos.length ? `(${v.contatos.length} escolhidos)` : ""}</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
            {o.contatos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.contatos.includes(p.id)} onChange={() => mudar({ contatos: alternar(v.contatos, p.id) })} />
                <span>{p.nome}<span className="text-xs text-tinta-suave"> · {p.unidades.join(", ")}</span></span>
              </label>
            ))}
          </div>
          {msg("contatos") ? <span className="text-xs text-erro">Escolha os contatos.</span> : null}
        </fieldset>
      ) : null}
      {canais.muralLigado || canais.emailLigado || whatsappLigado ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">Como chega</legend>
          <div className="grid gap-2 lg:grid-cols-3">
            {canais.muralLigado ? canalCaixa("Aparece no mural online",
              v.publico === "TODOS" ? "Só para comunicados de todo o condomínio." : "Este comunicado não é para todo o condomínio: não vai ao mural do prédio.",
              noMural, v.publico === "TODOS" ? (x) => mudar({ noMural: x }) : undefined, v.publico !== "TODOS") : null}
            {canais.emailLigado ? canalCaixa("Vai por e-mail",
              publico && !incompleto ? (publico.comEmail === 1 ? "1 contato com e-mail confirmado." : `${publico.comEmail ?? 0} contatos com e-mail confirmado.`) : "Para quem tem e-mail confirmado.",
              v.porEmail, (x) => mudar({ porEmail: x })) : null}
            {whatsappLigado ? canalCaixa("Vai pelo WhatsApp do condomínio",
              ninguemNoWhatsapp ? <>Ninguém do público aceitou receber comunicados pelo WhatsApp. <Link href="/configuracoes/comunicados" className="font-medium text-violeta-600 hover:underline">Como convidar</Link></>
                : <>{publico && !incompleto ? (publico.comWhatsapp === 1 ? "1 contato aceitou" : `${publico.comWhatsapp ?? 0} contatos aceitaram`) : "Para quem aceitou"} receber
                  comunicados por lá. Vai o título e o link pessoal; o texto inteiro fica no link.</>,
              v.porWhatsapp && !ninguemNoWhatsapp, ninguemNoWhatsapp ? undefined : (x) => mudar({ porWhatsapp: x }), ninguemNoWhatsapp)
              : canalCaixa("WhatsApp", "Desligado para comunicados. Liga em Configurações › Comunicados.", false, undefined, true)}
          </div>
        </fieldset>
      ) : null}
      {whatsappLigado && v.porWhatsapp && canais.whatsappConectado === false ? (
        <Aviso tom="atencao">O número está desconectado. As mensagens esperam a volta por até 24 horas; depois são canceladas e aparecem no comunicado.</Aviso>
      ) : null}
    </>
  );

  const parte3 = (
    <>
      <Escolha rotulo="Quando" atual={v.quando} aoMudar={(x) => mudar({ quando: x })}
        opcoes={[{ valor: "PUBLICAR", texto: "Publicar agora" }, { valor: "PROGRAMAR", texto: "Programar" }]} />
      {v.quando === "PROGRAMAR" ? (
        <CampoTexto id="cm-programado" rotulo="Dia e hora" type="datetime-local" value={v.programadoPara} onChange={(e) => mudar({ programadoPara: e.target.value })}
          erro={msg("programadoPara", "Daqui a pelo menos 2 minutos e até um ano.")} ajuda="Até a hora marcada dá para mudar ou voltar a rascunho." className="max-w-sm" />
      ) : null}
      {silencio ? <Aviso tom="atencao">Essa hora cai no horário sem envio ({o.silencio.inicio} às {o.silencio.fim}). O e-mail e o WhatsApp esperam até as {o.silencio.fim}.</Aviso> : null}
      {canais.emailLigado || whatsappLigado ? (
        <p className="t-apoio">
          {whatsappLigado
            ? <>Entre {o.silencio.inicio} e {o.silencio.fim} nada sai: o e-mail e o WhatsApp esperam até as {o.silencio.fim}.
              {conta && conta.whatsapp ? ` No WhatsApp, as mensagens saem aos poucos, ${COMUNICADOS_WHATSAPP_POR_MINUTO} por minuto: ${conta.whatsapp === 1 ? "esta sai" : `estas ${conta.whatsapp} saem`} em ${minutosDoWhatsapp(conta.whatsapp) === 1 ? "cerca de 1 minuto" : `uns ${minutosDoWhatsapp(conta.whatsapp)} minutos`}.` : ""}</>
            : <>Entre {o.silencio.inicio} e {o.silencio.fim}, o e-mail espera até as {o.silencio.fim}.</>}
        </p>
      ) : null}
    </>
  );

  /** Quem vai receber, ao lado no computador; no celular, embaixo do passo 2. */
  const quemRecebe = (
    <CartaoFicha id="quem" titulo="Quem vai receber" icone="pessoas">
      {incompleto ? <p className="t-apoio">Escolha {v.publico === "BLOCOS" ? "os blocos" : v.publico === "UNIDADES" ? "as unidades" : "os contatos"} para ver quem recebe.</p>
        : publico ? (
          <div className="grid gap-3" aria-live="polite">
            <div className="grid gap-1">
              <p className="flex items-baseline gap-2.5">
                <span className={`text-[40px] leading-none font-semibold tracking-tight ${publico.contatos ? "" : "text-atencao"}`} aria-hidden="true">{publico.contatos}</span>
                <span className="text-[15px]">{descreverAlcance(publico.contatos, publico.unidades)}</span>
              </p>
              <p className="t-apoio">
                Quem tem vínculo confirmado e recebe comunicados{v.assunto === "ASSEMBLEIA" ? ", mais os proprietários" : ""}.
                {publico.quem ? <> <button type="button" className="font-medium text-violeta-600 hover:underline" onClick={() => setVerQuem((x) => !x)}>{verQuem ? "Esconder" : "Ver quem"}</button></> : null}
              </p>
            </div>
            {verQuem && publico.quem ? (
              <ul className="max-h-48 overflow-y-auto rounded-xl border border-linha p-2 text-sm">
                {publico.quem.map((p) => <li key={p.contatoId}>{p.nome} <span className="text-xs text-tinta-suave">· {p.unidades.join(", ")}</span></li>)}
              </ul>
            ) : null}
            <ul className="grid text-sm" aria-label="Canais">
              {canais.muralLigado ? <LinhaCanal icone="casa" tom="ok" nome="Mural online" valor={noMural ? "todos" : "fora"} apagado={!noMural} /> : null}
              {canais.emailLigado ? <LinhaCanal icone="email" tom="info" nome="E-mail" valor={v.porEmail ? (publico.comEmail === 1 ? "1 contato" : `${publico.comEmail ?? 0} contatos`) : "não vai"} apagado={!v.porEmail} /> : null}
              {whatsappLigado ? <LinhaCanal icone="whats" tom="ok" nome="WhatsApp" valor={v.porWhatsapp && !ninguemNoWhatsapp ? (publico.comWhatsapp === 1 ? "1 contato" : `${publico.comWhatsapp ?? 0} contatos`) : "não vai"} apagado={!v.porWhatsapp || ninguemNoWhatsapp} />
                : <LinhaCanal icone="whats" tom="neutro" nome="WhatsApp" valor="desligado" apagado />}
            </ul>
            {whatsappLigado && conta ? (
              <ul className="flex flex-wrap gap-2 text-[13px]" aria-label="Por onde chega">
                {[[conta.whatsapp, "pelo WhatsApp"], [conta.email, "por e-mail"], [conta.pelosDois, "pelos dois"], [conta.nenhum, "por nenhum"]].map(([n, t]) => (
                  <li key={t} className="rounded-full border border-linha px-3 py-1"><span className="font-medium">{n}</span> {t}</li>
                ))}
              </ul>
            ) : null}
            {publico.semNinguem.length ? (
              <Aviso tom="atencao" titulo={publico.semNinguem.length === 1 ? "1 unidade sem ninguém que recebe" : `${publico.semNinguem.length} unidades sem ninguém que recebe`}>
                {publico.semNinguem.slice(0, 12).map((u) => u.nome).join(", ")}{publico.semNinguem.length > 12 ? " e outras." : "."}
              </Aviso>
            ) : null}
            {!whatsappLigado && canais.emailLigado && v.porEmail && publico.contatos - (publico.comEmail ?? 0) > 0 ? (
              <Aviso tom="atencao" titulo={publico.contatos - (publico.comEmail ?? 0) === 1 ? "1 contato sem e-mail confirmado" : `${publico.contatos - (publico.comEmail ?? 0)} contatos sem e-mail confirmado`}>
                Ficam com o grupo do prédio{canais.muralLigado ? " e o mural" : ""}.
              </Aviso>
            ) : null}
            {whatsappLigado && conta && conta.nenhum > 0 ? (
              <Aviso tom="atencao" titulo={conta.nenhum === 1 ? "1 contato não recebe por nenhum dos dois" : `${conta.nenhum} contatos não recebem por nenhum dos dois`}>
                Não aceitaram o WhatsApp nem confirmaram o e-mail. Ficam com o grupo do prédio{noMural ? " e o mural" : ""}.
                {publico.quem ? <> <button type="button" className="font-medium underline" onClick={() => setVerNenhum((x) => !x)}>{verNenhum ? "Esconder quem fica de fora" : "Ver quem fica de fora"}</button></> : null}
                {" · "}<Link href="/configuracoes/comunicados" className="font-medium underline">Como convidar</Link>
              </Aviso>
            ) : null}
            {verNenhum && nenhum.length ? (
              <ul className="max-h-48 overflow-y-auto rounded-xl border border-linha p-2 text-sm">
                {nenhum.map((p) => <li key={p.contatoId}>{p.nome} <span className="text-xs text-tinta-suave">· {p.unidades.join(", ")}</span></li>)}
              </ul>
            ) : null}
          </div>
        ) : <Carregando rotulo="Contando quem recebe…" />}
    </CartaoFicha>
  );

  return (
    <form onSubmit={(e) => { if (celular && passo < 3) { e.preventDefault(); setPasso((passo + 1) as Passo); return; } void salvar(v.quando, e); }} noValidate className="grid gap-5">
      {voltar}
      <div>
        <h1 className="t-titulo-tela">{c ? "Editar comunicado" : "Escrever comunicado"}</h1>
        <p className="t-apoio mt-1">Fica como rascunho até você publicar ou programar. Publicado não se edita: corrigir vira uma versão nova.</p>
      </div>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {aviso ? <Aviso tom="atencao">{aviso}</Aviso> : null}
      {o.plano ? <Aviso tom="info" titulo="O combinado com os moradores">{o.plano}</Aviso> : null}
      <TopoPassos passo={passo} resumos={resumos} irPara={setPasso} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Comunicado" className="rounded-[18px] border border-linha bg-superficie px-6 shadow-s1 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none">
          <Parte n={1} passo={passo}>{parte1}</Parte>
          <Parte n={2} passo={passo}>{parte2}</Parte>
          <Parte n={3} passo={passo}>{parte3}</Parte>
        </section>
        <div className={`lg:sticky lg:top-6 ${passo === 2 ? "" : "max-md:hidden"}`}>{quemRecebe}</div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-linha bg-superficie px-4 py-3 shadow-s2 max-md:bottom-[calc(61px+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        <span className="t-apoio flex items-center gap-2 max-md:hidden"><Icone nome="info" className="h-4 w-4" />Fica como rascunho até você publicar ou programar.</span>
        <span className="flex flex-1 justify-end gap-2 md:flex-none">
          {passo > 1 ? <Botao variante="contorno" className="md:hidden" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao> : null}
          <Botao variante="contorno" disabled={enviando !== null} className={passo < 3 ? "max-md:hidden" : ""} onClick={() => void salvar("RASCUNHO")}>
            {enviando === "RASCUNHO" ? "Salvando…" : "Salvar rascunho"}
          </Botao>
          {passo < 3 ? <Botao className="md:hidden max-md:flex-1" onClick={() => setPasso((passo + 1) as Passo)}>Continuar<Icone nome="dir" /></Botao> : null}
          <Botao type="submit" disabled={enviando !== null} className={passo < 3 ? "max-md:hidden" : ""}>
            <Icone nome={v.quando === "PROGRAMAR" ? "relogio" : "megafone"} />{enviando && enviando !== "RASCUNHO" ? "Salvando…" : textoPrincipal}
          </Botao>
        </span>
      </div>
      <Janela aberto={tirar !== null} titulo={tirar ? `Tirar ${tirar.nome}` : "Tirar arquivo"} aoFechar={() => setTirar(null)}
        campos={[{ id: "motivo", rotulo: "Por que tirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Tirar do comunicado" explicacao="A retirada fica no histórico do comunicado, com o motivo."
        aoSalvar={async (x) => {
          const r = await chamarApi(`/v1/condominio/comunicados/${c?.id}/arquivos/${tirar?.id}/tirar`, { corpo: { motivo: String(x.motivo ?? "").trim() } });
          if (r.ok) { setTirar(null); recarregar(); }
          return r;
        }} />
    </form>
  );
}
