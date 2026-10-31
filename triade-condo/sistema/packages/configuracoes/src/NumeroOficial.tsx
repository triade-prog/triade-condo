"use client";
// O número oficial do WhatsApp pela Meta (F5.12; W-01, W-15, DC4), no alto de Configurações ›
// WhatsApp: quadros 460 (ainda não ligado), 461 (os estados) e 462 (no celular), com o cadastro
// pela janela da Meta (cadastro incorporado) dos quadros 466 (a janela e o ligar), 467 (o código
// por SMS ou ligação) e 468 (no celular). O síndico faz o cadastro no Facebook dele, numa janela
// da Meta por cima da página; quando ela fecha, a Plataforma recebe a conta e o número e liga
// sozinha ao condomínio da sessão. O "Esperando a TRÍADE" fica só para quem usou o link antigo.
// Os ids da Meta ficam só no Console.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ESTADOS_NUMERO_OFICIAL, estadoNumeroOficial, formatarDataHora, LINK_GERENCIADOR_META, LINK_PAGAMENTO_META, META_APP_ID,
  META_CONFIG_CADASTRO, MOTIVOS_CADASTRO_META, mostrarTelefone, QUALIDADES_META, type EstadoNumeroOficial, type QualidadeMeta,
} from "@triade/domain";
import { Aviso, Botao, chamarApi, classeBotao, Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { naBase } from "./contexto.tsx";
import type { Conexao } from "./conexao.tsx";
import { abrirJanelaMeta, useSdkMeta, type FimJanela, type SdkMeta } from "./janelaMeta.ts";
import { CodigoMeta } from "./CodigoMeta.tsx";
import { Girando, motivoDoErro, textoCadastro, type RespostaCadastro, type RespostaLigado } from "./metaComum.tsx";

const TOM_ESTADO: Record<EstadoNumeroOficial, Tom> = {
  NAO_LIGADO: "neutro", DESLIGADO: "neutro", ESPERANDO: "atencao", EM_ANALISE: "atencao", FALTA_CARTAO: "erro", RECUSADO: "erro", SUSPENSO: "erro", LIGADO: "ok",
};
const TOM_QUALIDADE: Record<QualidadeMeta, Tom> = { VERDE: "ok", AMARELO: "atencao", VERMELHO: "erro", DESCONHECIDA: "neutro" };

function LinkMeta({ href, children, variante = "primario", aoAbrir }: { href: string; children: ReactNode; variante?: "primario" | "contorno"; aoAbrir?: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={aoAbrir} className={classeBotao(variante, "", variante === "primario" ? "g" : "m")}>
      <Icone nome="link" />{children}<span className="sr-only"> (abre numa aba nova)</span>
    </a>
  );
}

function Passos({ itens }: { itens: [string, string][] }) {
  return (
    <ol className="grid gap-3">
      {itens.map(([titulo, texto], i) => (
        <li key={titulo} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-violeta-50 t-apoio font-semibold text-violeta-700">{i + 1}</span>
          <span className="grid gap-0.5"><span className="t-texto font-medium">{titulo}</span><span className="t-apoio text-tinta-suave">{texto}</span></span>
        </li>
      ))}
    </ol>
  );
}

function ComIcone({ itens }: { itens: [NomeIcone, string, string][] }) {
  return (
    <ul className="grid gap-3">
      {itens.map(([icone, titulo, texto]) => (
        <li key={titulo} className="flex items-start gap-3">
          <span aria-hidden="true" className="ladrilho h-8 w-8"><Icone nome={icone} /></span>
          <span className="grid gap-0.5"><span className="t-texto font-medium">{titulo}</span><span className="t-apoio text-tinta-suave">{texto}</span></span>
        </li>
      ))}
    </ul>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="t-apoio text-tinta-suave">{rotulo}</dt>
      <dd className="t-texto">{children}</dd>
    </div>
  );
}

function Cabecalho({ estado, selo }: { estado?: EstadoNumeroOficial; selo?: { tom: Tom; texto: ReactNode } }) {
  const tom = selo?.tom ?? TOM_ESTADO[estado ?? "NAO_LIGADO"];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span aria-hidden="true" className="ladrilho h-10 w-10" data-tom={tom === "ok" ? "ok" : tom === "erro" ? "erro" : "violeta"}><Icone nome="whats" /></span>
      <h2 id="t-numero-oficial" className="flex-1 t-titulo-secao font-medium">Número oficial do WhatsApp</h2>
      <Selo tom={tom}>{selo?.texto ?? ESTADOS_NUMERO_OFICIAL[estado ?? "NAO_LIGADO"]}</Selo>
    </div>
  );
}

const CARTAO = "grid content-start gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1";

/** Quadro 461, estado 1 (só dados antigos): quem usou o link e tocou em Já terminei. */
function Esperando({ c }: { c: Conexao }) {
  const [ajuda, setAjuda] = useState(false);
  return (
    <section aria-labelledby="t-numero-oficial" className={CARTAO}>
      <Cabecalho estado="ESPERANDO" />
      <p className="t-texto">
        Você terminou o cadastro na Meta em {formatarDataHora(c.cadastroMetaEm ?? "")}. A TRÍADE liga o número em até um dia útil e avisa no sino.
      </p>
      <div className="flex flex-wrap gap-3">
        <Botao variante="discreto" tamanho="m" aria-expanded={ajuda} onClick={() => setAjuda(!ajuda)}>Não consegui terminar</Botao>
      </div>
      {ajuda ? (
        <Aviso tom="info">
          Chame a TRÍADE pelo Suporte e diga em qual passo parou. A Meta guarda o que já foi feito.
        </Aviso>
      ) : null}
    </section>
  );
}

function Modelos({ c }: { c: Conexao }) {
  const m = c.modelos;
  if (!m || !m.total) return <>Ainda não enviados</>;
  return <>{m.aprovados} de {m.total} aprovados</>;
}

/** Quadro 461, estados 2 a 6, e o ligado do quadro 462: o número já é oficial. */
function Ligado({ numero, c, estado }: { numero: string | null; c: Conexao; estado: EstadoNumeroOficial }) {
  const m = c.modelos;
  const pct = m && m.total ? Math.round((m.aprovados / m.total) * 100) : 0;
  return (
    <section aria-labelledby="t-numero-oficial" className={CARTAO}>
      <Cabecalho estado={estado} />
      {estado === "SUSPENSO" ? (
        <Aviso tom="erro" papel="status" titulo="O número oficial parou de receber">
          Desde {formatarDataHora(c.suspensoEm ?? "")}. A Meta suspendeu o envio do número. A TRÍADE já foi avisada e está falando com a Meta.
          Atenda por telefone e registre no painel.
        </Aviso>
      ) : null}
      {estado === "FALTA_CARTAO" ? (
        <>
          <Aviso tom="erro" papel="status" titulo="Os avisos pagos estão parados">
            A Meta não aceitou cobrar: a conta do condomínio está sem cartão. Respostas ao morador continuam saindo; os avisos esperam na fila.
          </Aviso>
          <div className="flex flex-wrap items-center gap-3">
            <LinkMeta href={LINK_PAGAMENTO_META}>Pôr o cartão na Meta</LinkMeta>
            <span className="t-apoio text-tinta-suave">Gerenciador do WhatsApp › Pagamentos. Depois disso, a fila sai sozinha.</span>
          </div>
        </>
      ) : null}
      {estado === "RECUSADO" && m ? (
        <Aviso tom="atencao" papel="status" titulo={m.recusados === 1 ? "A Meta recusou 1 modelo" : `A Meta recusou ${m.recusados} modelos`}>
          A TRÍADE ajusta o texto e reenvia. Enquanto isso, o aviso desse modelo sai pelo e-mail e pelo mural. Nada a fazer da sua parte.
        </Aviso>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dado rotulo="Número"><code className="font-mono">{numero ? mostrarTelefone(numero) : "Sem número na ficha"}</code></Dado>
        {c.nomeExibicao ? <Dado rotulo="Nome que aparece">{c.nomeExibicao}</Dado> : null}
        {c.qualidade ? <Dado rotulo="Qualidade na Meta"><Selo tom={TOM_QUALIDADE[c.qualidade]}>{QUALIDADES_META[c.qualidade]}</Selo></Dado> : null}
        {c.limiteDiario ? <Dado rotulo="Avisos por dia">até {c.limiteDiario.toLocaleString("pt-BR")} moradores diferentes</Dado> : null}
        <Dado rotulo="Modelos de mensagem"><Modelos c={c} /></Dado>
        {c.conectadoEm ? <Dado rotulo="Ligado em">{formatarDataHora(c.conectadoEm)}</Dado> : null}
        {c.ultimaRecebida ? <Dado rotulo="Última mensagem recebida">{formatarDataHora(c.ultimaRecebida)}</Dado> : null}
      </dl>
      {estado === "EM_ANALISE" ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-label="Modelos aprovados" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 bg-ok" style={{ width: `${pct}%` }} />
          </div>
          <p className="t-apoio text-tinta-suave">Respostas ao morador já saem pelo número novo. Avisos que dependem de modelo esperam a aprovação; enquanto isso, saem pelo e-mail e pelo mural.</p>
        </>
      ) : null}
      <p className="t-apoio text-tinta-suave">
        Responder livremente ao morador só vale até 24 horas depois da última mensagem dele; depois disso, só com modelo aprovado. O sistema escolhe sozinho.
      </p>
      <div className="flex flex-wrap gap-4 border-t border-linha pt-4">
        <a href={LINK_GERENCIADOR_META} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
          <Icone nome="link" className="h-4 w-4" />Abrir o Gerenciador do WhatsApp<span className="sr-only"> (abre numa aba nova)</span>
        </a>
        {estado === "SUSPENSO" ? (
          <a href="#t-zap-quedas" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">Quando o WhatsApp cair: quem cuida</a>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Cadastro pela janela da Meta (quadros 466 a 468)

const PASSOS_LIGAR: [string, string][] = [
  ["Conta recebida da Meta", "A empresa, a conta e o número que você escolheu na janela."],
  ["Permissão guardada", "Cifrada. Ninguém vê, nem a equipe da TRÍADE."],
  ["Avisos da conta assinados", "As mensagens dos moradores passam a chegar aqui."],
  ["Registrando o número", "Com a Meta, com um PIN que o sistema cria e guarda."],
  ["Modelos enviados", "Os modelos de mensagem vão para a Meta aprovar."],
];

/** A lista de passos: feito (com o visto), o de agora (girando) e os que faltam, sempre com texto. */
function ListaPassos({ atual, parou = false, ate = PASSOS_LIGAR.length }: { atual: number; parou?: boolean; ate?: number }) {
  const itens = PASSOS_LIGAR.slice(0, ate);
  return (
    <ol className="grid">
      {itens.map(([titulo, texto], i) => {
        const feito = i < atual;
        const agora = i === atual;
        return (
          <li key={titulo} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
            <span aria-hidden="true" className="flex flex-col items-center">
              {feito ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok text-white"><Icone nome="check" className="h-4 w-4" /></span>
              ) : agora && !parou ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-violeta-200 bg-violeta-50"><Girando className="h-4 w-4" /></span>
              ) : (
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border t-apoio font-semibold ${agora ? "border-erro-borda bg-erro-fundo text-erro" : "border-linha bg-superficie text-tinta-suave"}`}>{i + 1}</span>
              )}
              {i < itens.length - 1 ? <span className={`my-1 w-0.5 flex-1 ${feito ? "bg-ok" : "bg-linha"}`} /> : null}
            </span>
            <span className="grid content-start gap-0.5 pb-4 pt-1">
              <span className={`flex flex-wrap items-center gap-2 t-texto ${feito ? "font-medium" : agora ? "font-semibold text-violeta-700" : "text-tinta-suave"}`}>
                {titulo}
                <span className="sr-only">{feito ? ", feito" : agora ? (parou ? ", parou aqui" : ", agora") : ", ainda não"}</span>
                {agora && !parou ? <Selo tom="andamento">Agora</Selo> : null}
              </span>
              <span className="t-apoio text-tinta-suave">{agora && parou ? "Parou aqui." : texto}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function tempo(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Quadros 466 (estado 3) e 468: os cinco passos andando enquanto a API liga o número. */
function Ligando() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  // A conta já chegou; o resto anda com o tempo e o último só termina quando a resposta chega.
  const atual = segundos < 2 ? 1 : segundos < 4 ? 2 : segundos < 7 ? 3 : 4;
  return (
    <section aria-labelledby="t-numero-oficial" className={CARTAO} aria-busy="true">
      <Cabecalho selo={{ tom: "andamento", texto: <><Icone nome="relogio" className="h-3.5 w-3.5" />Ligando o número</> }} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid content-start gap-4">
          <div className="grid gap-1">
            <h3 className="t-titulo-secao font-semibold">Ligando o número do condomínio</h3>
            <p className="t-apoio text-tinta-suave">Leva menos de um minuto. Pode ficar nesta página, sem fazer nada.</p>
          </div>
          <div className="grid gap-2">
            <p className="flex items-center justify-between t-apoio text-tinta-suave">
              <span role="status">{atual} de 5 passos</span>
              <span className="font-mono max-md:hidden" aria-hidden="true">{tempo(segundos)}</span>
              <span className="md:hidden">menos de 1 minuto</span>
            </p>
            <div role="progressbar" aria-label="Passos do ligar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={atual} aria-valuetext={`${atual} de 5 passos`} className="grid grid-cols-5 gap-1.5">
              {PASSOS_LIGAR.map(([t], i) => (
                <span key={t} className={`h-1.5 rounded-full ${i < atual ? "bg-ok" : i === atual ? "bg-violeta-500" : "bg-violeta-100"}`} />
              ))}
            </div>
          </div>
          <ListaPassos atual={atual} />
          <p className="rounded-xl bg-superficie-2 px-4 py-3 t-apoio md:hidden">Não feche esta aba. O código da Meta vale 30 segundos.</p>
        </div>
        <div className="max-md:hidden">
          <ComIcone itens={[
            ["relogio", "Por que tão rápido?", "A Meta entrega um código que vale 30 segundos. Por isso o número liga na hora."],
            ["alerta", "Não feche esta página", "Se fechar, o número não liga e você tenta de novo depois."],
          ]} />
        </div>
      </div>
    </section>
  );
}

/** Quadros 466 (estado 4) e 468: a confirmação, com a prévia de como o morador vê e o cartão. */
function Confirmacao({ r, aoFechar }: { r: RespostaLigado; aoFechar: () => void }) {
  const nome = r.conexao.nomeExibicao;
  const numero = r.numero ?? r.conexao.numero ?? r.conexao.aparelho;
  const titulo = `O ${nome ?? "condomínio"} já está no WhatsApp oficial`;
  return (
    <section aria-labelledby="t-ligado" className="grid gap-5 rounded-[22px] border-[1.5px] border-violeta-200 bg-superficie p-5 shadow-s2 md:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-start gap-4 max-md:flex-col max-md:items-center max-md:text-center">
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ok-borda bg-ok-fundo text-ok"><Icone nome="check" className="h-7 w-7" /></span>
            <div className="grid flex-1 gap-2">
              <p className="flex flex-wrap gap-2 max-md:justify-center">
                <Selo tom="ok"><Icone nome="check" className="h-3.5 w-3.5" />Ligado</Selo>
                <Selo tom="atencao"><Icone nome="relogio" className="h-3.5 w-3.5" />Modelos em análise</Selo>
              </p>
              <h2 id="t-ligado" className="t-titulo-tela">{titulo}</h2>
            </div>
          </div>
          <p className="t-texto max-md:text-center">Pronto. As respostas aos moradores já saem pelo número novo, com o nome do condomínio.</p>
          <dl className="grid gap-4 rounded-xl bg-superficie-2 p-4 sm:grid-cols-3">
            {numero ? <Dado rotulo="Número"><code className="font-mono">{mostrarTelefone(numero)}</code></Dado> : null}
            {nome ? <Dado rotulo="Nome que aparece">{nome}</Dado> : null}
            <Dado rotulo="Modelos de mensagem">{r.modelosEnviados} com a Meta, que aprova de minutos a 1 dia</Dado>
          </dl>
        </div>
        <div className="lg:row-span-2"><Previa nome={nome ?? "Condomínio"} /></div>
        {r.faltaCartao ? (
          <div className="grid gap-3 rounded-2xl border border-atencao-borda bg-atencao-fundo p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="ladrilho h-8 w-8"><Icone nome="dinheiro" /></span>
              <div className="grid gap-0.5">
                <h3 className="t-texto font-semibold">Falta um passo: o cartão na Meta</h3>
                <p className="t-apoio">Sem cartão, só as respostas ao morador saem. Os avisos do condomínio esperam na fila e saem sozinhos depois.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-md:[&>*]:w-full">
              <LinkMeta href={LINK_PAGAMENTO_META} aoAbrir={aoFechar}>Pôr o cartão na Meta</LinkMeta>
              <Botao variante="discreto" tamanho="m" onClick={aoFechar}>Fazer depois</Botao>
            </div>
          </div>
        ) : (
          <div><Botao onClick={aoFechar}>Ver o número oficial</Botao></div>
        )}
      </div>
    </section>
  );
}

/** A prévia de como o morador vê o número: ilustração, não é o WhatsApp de verdade. */
function Previa({ nome }: { nome: string }) {
  return (
    <figure className="grid gap-2" aria-labelledby="t-previa">
      <figcaption className="grid gap-0.5">
        <span id="t-previa" className="t-apoio font-semibold uppercase tracking-[0.08em] text-tinta-suave">Assim o morador vê</span>
        <span className="t-apoio text-tinta-suave">Prévia. Cada celular mostra do seu jeito.</span>
      </figcaption>
      <div className="overflow-hidden rounded-[26px] border border-linha bg-superficie shadow-s2">
        <div className="flex items-center gap-3 border-b border-linha px-3 py-3">
          <Icone nome="esq" className="h-4 w-4 text-tinta-suave" />
          <span aria-hidden="true" className="ladrilho h-9 w-9 rounded-full" data-tom="violeta"><Icone nome="predio" /></span>
          <span className="grid">
            <span className="t-texto font-semibold">{nome}</span>
            <span className="flex items-center gap-1 t-apoio text-tinta-suave"><Icone nome="predio" className="h-3.5 w-3.5" />Conta comercial</span>
          </span>
        </div>
        <div className="grid gap-3 bg-superficie-2 px-3 py-4">
          <span className="justify-self-center rounded-md bg-superficie px-2 py-0.5 t-apoio text-tinta-suave">Hoje</span>
          <span className="justify-self-center rounded-md border border-atencao-borda bg-atencao-fundo px-2 py-1 text-center t-apoio">Esta é uma conta comercial do condomínio.</span>
          <span className="grid max-w-[90%] gap-1 rounded-xl bg-superficie px-3 py-2 t-apoio shadow-s1">
            <span>Olá, Marina. Recebemos seu pedido <code className="font-mono font-semibold">2026-0006</code>, vazamento no banheiro. Avisamos por aqui a cada passo.</span>
            <span className="justify-self-end text-tinta-suave">09:12</span>
          </span>
        </div>
        <div className="px-3 py-3" aria-hidden="true">
          <span className="block rounded-full bg-superficie-2 px-4 py-2 t-apoio text-tinta-suave">Mensagem</span>
        </div>
      </div>
    </figure>
  );
}

type Fase =
  | { tipo: "inicio" }
  | { tipo: "janela" }
  | { tipo: "bloqueada" }
  | { tipo: "fechou"; texto?: string }
  | { tipo: "ligando" }
  | { tipo: "naoLigou" }
  | { tipo: "comTriade" }
  | { tipo: "recusado"; texto: string }
  | { tipo: "codigo"; numero: string; pedir: boolean; aberto: boolean };

/** O botão que abre a janela: só aparece com o SDK pronto (quadro 466, estado 1). */
function BotaoConectar({ sdk, aoAbrir, texto = "Conectar pelo WhatsApp oficial", variante = "primario" }: {
  sdk: ReturnType<typeof useSdkMeta>; aoAbrir: (fb: SdkMeta) => void; texto?: string; variante?: "primario" | "contorno";
}) {
  if (sdk.estado === "carregando") {
    return <p role="status" className="flex items-center gap-2 t-apoio text-tinta-suave"><Girando className="h-4 w-4" />Preparando a janela da Meta…</p>;
  }
  if (sdk.estado === "falhou") {
    return (
      <div className="grid gap-3">
        <Aviso tom="atencao" papel="status" titulo="A janela da Meta não abriu nesta página">
          Algum bloqueador do navegador pode estar impedindo. Libere o facebook.com para esta página e recarregue.
        </Aviso>
        <div><Botao variante={variante} onClick={() => window.location.reload()}>Recarregar a página</Botao></div>
      </div>
    );
  }
  const fb = sdk.fb;
  return <Botao variante={variante} onClick={() => aoAbrir(fb)}><Icone nome="whats" />{texto}</Botao>;
}

/** Quadro 466, estado 1, e o 460 com o passo 3 novo: ainda não ligado (ou desligado pela TRÍADE). */
function AindaNaoLigado({ c, estado, conectar }: { c: Conexao; estado: EstadoNumeroOficial; conectar: ReactNode | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho estado={estado} />
        {estado === "DESLIGADO" ? (
          <Aviso tom="neutro" papel="status" titulo="O número oficial foi desligado">
            {c.desligadoEm ? `A TRÍADE desligou o número em ${formatarDataHora(c.desligadoEm)}.` : "A TRÍADE desligou o número."}
            {c.motivoDesligado ? ` Motivo: ${c.motivoDesligado}` : ""} Para voltar a usar, conecte de novo pela janela da Meta.
          </Aviso>
        ) : null}
        <p className="t-texto">Os moradores falam com o condomínio por um número próprio, com o nome do condomínio e o selo de conta comercial.</p>
        <h3 className="t-apoio font-semibold uppercase tracking-[0.08em] text-tinta-suave">Tenha à mão</h3>
        <ComIcone itens={[
          ["whats", "Um número só do condomínio", "Que receba SMS ou ligação, sem WhatsApp no aparelho."],
          ["documento", "O CNPJ e um e-mail do condomínio", "A conta fica no nome do condomínio."],
          ["dinheiro", "Um cartão para a Meta", "Pode pôr depois. Sem ele, só as respostas saem."],
        ]} />
        {conectar ? (
          <div className="grid gap-2 border-t border-linha pt-4">
            {conectar}
            <span className="t-apoio text-tinta-suave max-md:hidden">Abre a janela da Meta por cima desta página. Leva uns 10 minutos.</span>
            <span className="t-apoio text-tinta-suave md:hidden">Abre a Meta numa aba. Leva uns 10 minutos.</span>
          </div>
        ) : (
          <p className="border-t border-linha pt-4 t-apoio text-tinta-suave">Quem faz o cadastro na Meta é o síndico, no app.</p>
        )}
      </section>
      <div className="grid content-start gap-4">
        <section aria-labelledby="t-como-funciona" className={CARTAO}>
          <h3 id="t-como-funciona" className="t-texto font-semibold">Como funciona</h3>
          <Passos itens={[
            ["Você entra com o Facebook", "Escolhe ou cria a empresa do condomínio e a conta do WhatsApp."],
            ["Confirma o número", "A Meta manda um código por SMS ou ligação."],
            ["O número liga na hora", "Quando a janela fecha: a conta, o número e os modelos de mensagem, em menos de um minuto."],
            ["Você põe o cartão", "No Gerenciador do WhatsApp, em Pagamentos. Sem cartão, só as respostas ao morador saem."],
          ]} />
        </section>
        <section aria-labelledby="t-enquanto-isso" className={CARTAO}>
          <h3 id="t-enquanto-isso" className="t-texto font-semibold">Enquanto isso</h3>
          <p className="t-apoio text-tinta-suave">
            O número de teste continua funcionando até o número oficial ficar pronto. Os moradores são avisados da troca por um comunicado.
          </p>
        </section>
      </div>
    </div>
  );
}

/** O cadastro inteiro pela janela: do botão ao número ligado, com o código quando a Meta pede. */
function CadastroMeta({ c, estado, pendente, aoLigar, aoMudar }: {
  c: Conexao; estado: EstadoNumeroOficial; pendente: { numero: string } | null; aoLigar: (r: RespostaLigado) => void; aoMudar: (texto?: string) => void;
}) {
  const [fase, setFase] = useState<Fase>(pendente ? { tipo: "codigo", numero: pendente.numero, pedir: false, aberto: true } : { tipo: "inicio" });
  const falhas = useRef(0);
  const sdk = useSdkMeta(true, META_APP_ID);

  function abrir(fb: SdkMeta) {
    setFase({ tipo: "janela" });
    void abrirJanelaMeta(fb, META_CONFIG_CADASTRO).then(depoisDaJanela);
  }

  function depoisDaJanela(r: FimJanela) {
    if (r.tipo === "fechou") return setFase({ tipo: "fechou" });
    if (r.tipo === "bloqueada") return setFase({ tipo: "bloqueada" });
    void cadastrar(r);
  }

  async function cadastrar(r: Extract<FimJanela, { tipo: "pronto" }>) {
    setFase({ tipo: "ligando" });
    const res = await chamarApi<RespostaCadastro>(naBase("/whatsapp/meta/cadastro"), {
      corpo: { code: r.code, wabaId: r.wabaId, numeroId: r.numeroId, empresaId: r.empresaId },
    });
    if (res.ok) {
      if (res.dados.etapa === "CODIGO") return setFase({ tipo: "codigo", numero: res.dados.numero, pedir: true, aberto: true });
      return aoLigar(res.dados);
    }
    const motivo = motivoDoErro(res.erro);
    if (motivo === "JA_LIGADO") return aoMudar(MOTIVOS_CADASTRO_META.JA_LIGADO);
    if (motivo === "CODIGO_VENCIDO" || res.erro.codigo === "UPSTREAM_UNAVAILABLE") {
      falhas.current += 1;
      return setFase({ tipo: falhas.current >= 2 ? "comTriade" : "naoLigou" });
    }
    setFase({ tipo: "recusado", texto: textoCadastro(res.erro) });
  }

  const conectar = (texto?: string, variante?: "primario" | "contorno") => <BotaoConectar sdk={sdk} aoAbrir={abrir} texto={texto} variante={variante} />;

  if (fase.tipo === "inicio") return <AindaNaoLigado c={c} estado={estado} conectar={conectar()} />;
  if (fase.tipo === "ligando") return <Ligando />;

  if (fase.tipo === "janela" || fase.tipo === "bloqueada") {
    const bloqueada = fase.tipo === "bloqueada";
    const host = typeof window === "undefined" ? "esta página" : window.location.host;
    return (
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho selo={{ tom: "andamento", texto: <><Icone nome="relogio" className="h-3.5 w-3.5" /><span className="max-md:hidden">Na janela da Meta</span><span className="md:hidden">Na Meta, em outra aba</span></> }} />
        {bloqueada ? (
          <Aviso tom="atencao" titulo="O navegador bloqueou a janela da Meta">Libere as janelas para {host} e toque em Abrir de novo.</Aviso>
        ) : (
          <div role="status" className="flex items-start gap-3 rounded-2xl bg-violeta-50 px-4 py-4">
            <Girando />
            <span className="grid gap-0.5">
              <span className="t-texto font-semibold"><span className="max-md:hidden">Termine na janela da Meta</span><span className="md:hidden">Termine na aba da Meta</span></span>
              <span className="t-apoio text-tinta-suave max-md:hidden">Esta página espera e liga o número quando ela fechar.</span>
              <span className="t-apoio text-tinta-suave md:hidden">Depois, volte para esta aba. O número liga aqui.</span>
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-4">
          {bloqueada ? null : <span className="t-apoio text-tinta-suave max-md:hidden">Não está vendo a janela?</span>}
          <div className="max-md:w-full max-md:[&_.bt]:w-full">{conectar("Abrir de novo", bloqueada ? "primario" : "contorno")}</div>
        </div>
      </section>
    );
  }

  if (fase.tipo === "fechou") {
    return (
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho estado={estado === "DESLIGADO" ? "DESLIGADO" : "NAO_LIGADO"} />
        <div className="grid gap-1">
          <h3 className="t-texto font-semibold">{fase.texto ? "Comece de novo pela janela da Meta" : "Você fechou a janela antes de terminar"}</h3>
          <p className="t-apoio text-tinta-suave">
            {fase.texto ?? "Nada foi ligado e nada foi cobrado. A Meta guarda o que você já fez e continua de onde parou."}
          </p>
        </div>
        <div>{conectar("Continuar na Meta")}</div>
      </section>
    );
  }

  if (fase.tipo === "naoLigou") {
    return (
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho selo={{ tom: "erro", texto: <><Icone nome="alerta" className="h-3.5 w-3.5" />Não ligou</> }} />
        <div className="grid gap-1" role="status">
          <h3 className="t-texto font-semibold">A Meta terminou, mas o número não ligou</h3>
          <p className="t-apoio text-tinta-suave">
            A conexão caiu antes de o código da Meta vencer (ele vale 30 segundos). A conta já é do condomínio. É só tentar de novo.
          </p>
        </div>
        <ListaPassos atual={1} parou ate={2} />
        <div className="grid gap-2">
          <div>{conectar("Tentar de novo")}</div>
          <span className="t-apoio text-tinta-suave">Se não der de novo, a TRÍADE assume.</span>
        </div>
      </section>
    );
  }

  if (fase.tipo === "comTriade") {
    return (
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho selo={{ tom: "atencao", texto: <><Icone nome="relogio" className="h-3.5 w-3.5" />Com a TRÍADE</> }} />
        <div className="grid gap-1" role="status">
          <h3 className="t-texto font-semibold">Não ligou de novo. A TRÍADE assume.</h3>
          <p className="t-apoio text-tinta-suave">A conta chegou à TRÍADE, que liga o número pelo Console em até um dia útil. Você não precisa refazer nada.</p>
        </div>
        <ComIcone itens={[
          ["sino", "Você recebe um aviso no sino", "Quando o número estiver ligado."],
          ["escudo", "O número de teste continua", "Os moradores seguem atendidos até lá."],
        ]} />
      </section>
    );
  }

  if (fase.tipo === "recusado") {
    return (
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho selo={{ tom: "erro", texto: <><Icone nome="alerta" className="h-3.5 w-3.5" />Não ligou</> }} />
        <Aviso tom="erro" titulo="A Meta terminou, mas o número não ligou">{fase.texto}</Aviso>
        <div>{conectar("Continuar na Meta", "contorno")}</div>
      </section>
    );
  }

  // O número espera o código por SMS ou ligação (quadro 467).
  const f = fase;
  return (
    <section aria-labelledby="t-numero-oficial" className={CARTAO}>
      <Cabecalho selo={{ tom: "andamento", texto: <><Icone nome="relogio" className="h-3.5 w-3.5" />Confirmando o número</> }} />
      <p className="t-texto">
        A janela da Meta fechou. Falta confirmar que o número <code className="font-mono">{mostrarTelefone(f.numero)}</code> é do condomínio, com um código de 6 números.
      </p>
      <div><Botao onClick={() => setFase({ ...f, aberto: true })}>Digitar o código</Botao></div>
      <CodigoMeta
        aberto={f.aberto}
        numero={f.numero}
        pedirAoAbrir={f.pedir}
        aoPedir={() => setFase((x) => (x.tipo === "codigo" ? { ...x, pedir: false } : x))}
        aoFechar={() => setFase((x) => (x.tipo === "codigo" ? { ...x, aberto: false } : x))}
        aoLigar={aoLigar}
        aoRecomecar={(texto) => setFase({ tipo: "fechou", texto })}
      />
    </section>
  );
}

/** O cartão do número oficial no estado em que ele está. */
export function NumeroOficial({ numero, conexao, podeCadastrar, aoMudar }: {
  numero: string | null; conexao: Conexao; podeCadastrar: boolean; aoMudar: (texto?: string) => void;
}) {
  const [ligou, setLigou] = useState<RespostaLigado | null>(null);
  const estado = estadoNumeroOficial(conexao);
  const pendente = conexao.cadastroPendente ?? null;
  if (ligou) return <Confirmacao r={ligou} aoFechar={() => setLigou(null)} />;
  if (podeCadastrar && (estado === "NAO_LIGADO" || estado === "DESLIGADO" || pendente)) {
    return <CadastroMeta c={conexao} estado={estado} pendente={pendente} aoMudar={aoMudar} aoLigar={(r) => { setLigou(r); aoMudar(); }} />;
  }
  if (estado === "NAO_LIGADO" || estado === "DESLIGADO") return <AindaNaoLigado c={conexao} estado={estado} conectar={null} />;
  if (estado === "ESPERANDO") return <Esperando c={conexao} />;
  return <Ligado numero={numero} c={conexao} estado={estado} />;
}
