"use client";
// O número oficial do WhatsApp pela Meta (F5.12; W-01, W-15, DC4), no alto de Configurações ›
// WhatsApp: quadros 460 (ainda não ligado), 461 (os estados) e 462 (no celular). Quem faz o
// cadastro é o síndico, na página da Meta (cadastro hospedado), no Facebook dele; a TRÍADE, como
// parceira, recebe a conta e liga ao condomínio pelo Console. O "Já terminei" ajuda a equipe a
// reconhecer a conta que chegou. Os ids da Meta ficam só no Console.

import { useState, type ReactNode } from "react";
import {
  ESTADOS_NUMERO_OFICIAL, estadoNumeroOficial, formatarDataHora, LINK_CADASTRO_META, LINK_GERENCIADOR_META, LINK_PAGAMENTO_META,
  mostrarTelefone, QUALIDADES_META, type EstadoNumeroOficial, type QualidadeMeta,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, chamarApi, classeBotao, Icone, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { naBase } from "./contexto.tsx";
import type { Conexao } from "./conexao.tsx";

const TOM_ESTADO: Record<EstadoNumeroOficial, Tom> = {
  NAO_LIGADO: "neutro", ESPERANDO: "atencao", EM_ANALISE: "atencao", FALTA_CARTAO: "erro", RECUSADO: "erro", SUSPENSO: "erro", LIGADO: "ok",
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

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="t-apoio text-tinta-suave">{rotulo}</dt>
      <dd className="t-texto">{children}</dd>
    </div>
  );
}

function Cabecalho({ estado }: { estado: EstadoNumeroOficial }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span aria-hidden="true" className="ladrilho h-10 w-10" data-tom={estado === "LIGADO" ? "ok" : TOM_ESTADO[estado] === "erro" ? "erro" : "violeta"}><Icone nome="whats" /></span>
      <h2 id="t-numero-oficial" className="flex-1 t-titulo-secao font-medium">Número oficial do WhatsApp</h2>
      <Selo tom={TOM_ESTADO[estado]}>{ESTADOS_NUMERO_OFICIAL[estado]}</Selo>
    </div>
  );
}

const CARTAO = "grid content-start gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1";

/** Quadro 460: ainda não ligado, com o que ter à mão e o botão para a página da Meta. */
function AindaNaoLigado({ podeCadastrar, aoTerminar }: { podeCadastrar: boolean; aoTerminar: () => Promise<ErroApi | null> }) {
  const [abriu, setAbriu] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="t-numero-oficial" className={CARTAO}>
        <Cabecalho estado="NAO_LIGADO" />
        <p className="t-texto">
          Os moradores falam com o condomínio por um número próprio, pela API oficial da Meta. Sem risco de bloqueio por uso de aparelho conectado,
          com o nome do condomínio e o selo da conta comercial.
        </p>
        <h3 className="t-apoio font-semibold uppercase tracking-[0.08em] text-tinta-suave">Antes de começar, tenha à mão</h3>
        <Passos itens={[
          ["Um número só do condomínio", "Celular ou fixo que receba SMS ou ligação. Se ele já tem WhatsApp no aparelho, apague a conta do aplicativo antes."],
          ["O CNPJ e um e-mail do condomínio", "A conta fica no nome do condomínio, no Facebook do síndico. A TRÍADE só recebe permissão para enviar e receber por ela."],
          ["Um cartão para pagar a Meta", "A Meta cobra direto do condomínio as mensagens que o condomínio inicia, cerca de R$ 0,04 cada. Respostas ao morador são grátis até 1.000 por mês."],
        ]} />
        <Aviso tom="info" titulo="O nome que aparece precisa ser o do condomínio">
          Por exemplo, Residencial Ipê. A Meta revisa o nome antes de liberar o número e recusa nomes genéricos, como Portaria ou Síndico.
        </Aviso>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {podeCadastrar ? (
          <div className="grid gap-3 border-t border-linha pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <LinkMeta href={LINK_CADASTRO_META} aoAbrir={() => setAbriu(true)}>Conectar pelo WhatsApp oficial</LinkMeta>
              <span className="t-apoio text-tinta-suave max-md:hidden">Abre a página da Meta numa aba nova. Leva uns 10 minutos.</span>
              <span className="t-apoio text-tinta-suave md:hidden">Melhor fazer no computador: a página da Meta é longa.</span>
            </div>
            {abriu ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-superficie-2 px-4 py-3">
                <span className="flex-1 t-apoio">Terminou na Meta? Avise a TRÍADE para ela ligar o número.</span>
                <Botao variante="contorno" tamanho="m" onClick={() => void aoTerminar().then(setErro)}>Já terminei</Botao>
              </div>
            ) : null}
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
            ["A TRÍADE liga o número", "No mesmo dia útil: registra o número e manda os modelos de mensagem para a Meta aprovar."],
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

/** Quadro 461, estado 1: o síndico voltou da Meta e tocou em Já terminei. */
function Esperando({ c }: { c: Conexao }) {
  const [ajuda, setAjuda] = useState(false);
  return (
    <section aria-labelledby="t-numero-oficial" className={CARTAO}>
      <Cabecalho estado="ESPERANDO" />
      <p className="t-texto">
        Você terminou o cadastro na Meta em {formatarDataHora(c.cadastroMetaEm ?? "")}. A TRÍADE liga o número em até um dia útil e avisa no sino.
      </p>
      <div className="flex flex-wrap gap-3">
        <LinkMeta href={LINK_CADASTRO_META} variante="contorno">Voltar à página da Meta</LinkMeta>
        <Botao variante="discreto" tamanho="m" aria-expanded={ajuda} onClick={() => setAjuda(!ajuda)}>Não consegui terminar</Botao>
      </div>
      {ajuda ? (
        <Aviso tom="info">
          Abra a página da Meta de novo e continue de onde parou: a Meta guarda o que já foi feito. Se travar no número ou no nome, chame a TRÍADE
          pelo Suporte e diga em qual passo parou.
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

/** O cartão do número oficial no estado em que ele está. */
export function NumeroOficial({ numero, conexao, podeCadastrar, aoMudar }: {
  numero: string | null; conexao: Conexao; podeCadastrar: boolean; aoMudar: () => void;
}) {
  const estado = estadoNumeroOficial(conexao);
  async function terminei(): Promise<ErroApi | null> {
    const r = await chamarApi(naBase("/whatsapp/meta/terminei"), { corpo: {} });
    if (!r.ok) return r.erro;
    aoMudar();
    return null;
  }
  if (estado === "NAO_LIGADO") return <AindaNaoLigado podeCadastrar={podeCadastrar} aoTerminar={terminei} />;
  if (estado === "ESPERANDO") return <Esperando c={conexao} />;
  return <Ligado numero={numero} c={conexao} estado={estado} />;
}
