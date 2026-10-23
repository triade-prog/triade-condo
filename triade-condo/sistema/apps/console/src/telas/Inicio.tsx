"use client";
// Início do Console (DC15, telas-modelo console-inicio-*; rodada Console, decisão B.1 de
// 23/10/2026): o Console abre aqui, e não mais na carteira. A faixa com a saudação e o Cadastrar
// condomínio; o Agora, que junta o que estava espalhado em quatro itens do menu (chamado sem
// responsável, pedido de acesso para verificar, pendência de implantação vencida e número de
// WhatsApp sem credenciais ou caído), cada linha com o próximo passo; e, embaixo, as implantações
// em andamento com a barra de etapas e os clientes com situações a tratar (PI-01, PI-05, PI-09,
// PI-20, W-01).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { mostrarDataSemHora, mostrarTelefone, SITUACOES_CHAMADO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import { AvisoErro, Botao, Carregando, classeBotao, ErroCarregar, Icone, IconeMarca, Selo, textoDoErro, chamarApi, type ErroApi, type NomeIcone } from "@triade/ui";
import { BarraEtapas, LinhasAgora, plural, diaHora, type LinhaAgora } from "./comum.tsx";
import { SeloSituacao } from "./rotulos.tsx";
import { useCarregar, useSessao, type Carga } from "./sessao.tsx";
import { TOM_CHAMADO, type ResumoChamado } from "./suporte/Chamados.tsx";
import { TOM_SUPORTE, type PedidoAcesso } from "./suporte/SuporteAcesso.tsx";
import { atendeClientes, cuidaDoAcesso, type ClienteCarteira, type ItemImplantacao, type NumeroWhatsapp } from "./tipos.ts";

const HOJE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
const HOJE_CURTO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" });

function saudacao(): string {
  const h = Number(HORA.format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** "22/10" a partir de "2026-10-22". */
const diaMes = (data: string) => mostrarDataSemHora(data).slice(0, 5);

function LinkAcao({ href, icone, children }: { href: string; icone: NomeIcone; children: string }) {
  return <Link href={href} className={classeBotao("contorno", "shrink-0 max-md:w-11 max-md:px-0", "m")}><Icone nome={icone} /><span className="max-md:sr-only">{children}</span></Link>;
}

/** Assumir o chamado sem responsável ali mesmo e abrir a conversa. */
function Assumir({ chamado, aoErro }: { chamado: ResumoChamado; aoErro: (e: ErroApi) => void }) {
  const sessao = useSessao();
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  async function assumir() {
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${chamado.condominioId}/chamados/${chamado.id}`, {
      metodo: "PUT", corpo: { versao: chamado.versao, situacao: chamado.situacao, responsavelId: sessao.pessoaId },
    });
    setEnviando(false);
    if (!r.ok) return aoErro(r.erro);
    router.push(`/chamados/${chamado.condominioId}/${chamado.id}`);
  }
  return (
    <Botao variante="contorno" tamanho="m" className="shrink-0 max-md:w-11 max-md:px-0" disabled={enviando} onClick={() => void assumir()} aria-label={`Assumir o chamado ${chamado.titulo}`}>
      <Icone nome="pessoa" /><span className="max-md:sr-only">Assumir</span>
    </Botao>
  );
}

type ComRecarregar<T> = Carga<T> & { recarregar: () => void };

function Agora({ implantacoes }: { implantacoes: ComRecarregar<{ implantacoes: ItemImplantacao[] }> }) {
  const sessao = useSessao();
  const atende = atendeClientes(sessao.funcoes);
  const acesso = cuidaDoAcesso(sessao.funcoes);
  const chamados = useCarregar<{ chamados: ResumoChamado[] }>(atende ? "/v1/chamados?filtro=ABERTOS" : null);
  const pedidos = useCarregar<{ pedidos: PedidoAcesso[] }>(acesso ? "/v1/suporte-acesso" : null);
  const numeros = useCarregar<{ numeros: NumeroWhatsapp[] }>(atende ? "/v1/whatsapp" : null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const cargas = [...(atende ? [chamados, implantacoes, numeros] : []), ...(acesso ? [pedidos] : [])];
  const linhas: LinhaAgora[] = [];

  if (chamados.estado === "pronto") {
    const sem = chamados.dados.chamados.filter((c) => !c.responsavelId);
    const c = sem[0];
    if (c) {
      linhas.push({
        chave: "chamados", icone: "balao", tom: "atencao", titulo: plural(sem.length, "chamado sem responsável", "chamados sem responsável"),
        detalhe: sem.length === 1 ? [c.titulo, c.condominio, `${c.ultima?.autor ?? c.abertoPor}, ${diaHora(c.ultima?.em ?? c.atualizadoEm)}`].filter(Boolean).join(" · ") : undefined,
        selo: sem.length === 1 ? { texto: SITUACOES_CHAMADO[c.situacao], tom: TOM_CHAMADO[c.situacao] ?? "info" } : undefined,
        acao: sem.length === 1 ? <Assumir chamado={c} aoErro={setErro} /> : <LinkAcao href="/chamados" icone="lista">Ver quais</LinkAcao>,
      });
    }
  }
  if (pedidos.estado === "pronto") {
    const abertos = pedidos.dados.pedidos.filter((p) => p.situacao === "ABERTO");
    const p = abertos[0];
    if (p) {
      linhas.push({
        chave: "acesso", icone: "cadeado", tom: "violeta", titulo: plural(abertos.length, "pedido de acesso para verificar", "pedidos de acesso para verificar"),
        detalhe: abertos.length === 1 ? `${p.pessoa} · ${p.condominio} · ${TIPOS_SUPORTE_ACESSO[p.tipo].toLowerCase()} · com ${p.atendidoPor}` : undefined,
        selo: { texto: "Verificando", tom: TOM_SUPORTE.ABERTO! },
        acao: <LinkAcao href={abertos.length === 1 ? `/suporte-acesso/${p.condominioId}/${p.id}` : "/suporte-acesso"} icone="check">Verificar</LinkAcao>,
      });
    }
    const duvidosos = pedidos.dados.pedidos.filter((x) => x.situacao === "DUVIDOSO");
    if (duvidosos.length && sessao.funcoes.includes("ADMINISTRACAO")) {
      const d = duvidosos[0]!;
      linhas.push({
        chave: "duvidosos", icone: "cadeado", tom: "atencao", titulo: plural(duvidosos.length, "caso de acesso com a administração", "casos de acesso com a administração"),
        detalhe: duvidosos.length === 1 ? `${d.pessoa} · ${d.condominio}${d.motivo ? ` · ${d.motivo}` : ""}` : undefined,
        selo: { texto: "Com a administração", tom: "atencao" },
        acao: <LinkAcao href={duvidosos.length === 1 ? `/suporte-acesso/${d.condominioId}/${d.id}` : "/suporte-acesso"} icone="check">Decidir</LinkAcao>,
      });
    }
  }
  if (implantacoes.estado === "pronto") {
    const comVencida = implantacoes.dados.implantacoes.filter((i) => i.vencidas > 0);
    const total = comVencida.reduce((t, i) => t + i.vencidas, 0);
    const i = comVencida[0];
    if (i) {
      linhas.push({
        chave: "pendencias", icone: "relogio", tom: "erro", titulo: plural(total, "pendência de implantação vencida", "pendências de implantação vencidas"),
        detalhe: comVencida.length === 1 ? [i.nome, i.proximoRetorno ? `venceu em ${diaMes(i.proximoRetorno)}` : null].filter(Boolean).join(" · ") : comVencida.map((x) => x.nome).join(", "),
        selo: { texto: "Vencida", tom: "erro" },
        acao: <LinkAcao href={comVencida.length === 1 ? `/clientes/${i.condominioId}?aba=implantacao` : "/clientes?filtro=implantacao"} icone="olho">Ver</LinkAcao>,
      });
    }
  }
  if (numeros.estado === "pronto") {
    for (const [situacao, tom, um, varios] of [
      ["DESCONECTADO", "erro", "número desconectado", "números desconectados"],
      ["SEM_CREDENCIAIS", "atencao", "número sem credenciais", "números sem credenciais"],
    ] as const) {
      const lista = numeros.dados.numeros.filter((x) => x.situacao === situacao);
      const x = lista[0];
      if (!x) continue;
      linhas.push({
        chave: situacao, icone: "whats", tom, titulo: plural(lista.length, um, varios),
        detalhe: lista.length === 1 ? [x.nome, x.numero ? mostrarTelefone(x.numero) : null, x.oficial === false || situacao === "SEM_CREDENCIAIS" ? "piloto" : null].filter(Boolean).join(" · ") : lista.map((y) => y.nome).join(", "),
        selo: { texto: situacao === "DESCONECTADO" ? "Desconectado" : "Sem credenciais", tom },
        acao: <LinkAcao href={lista.length === 1 ? `/clientes/${x.condominioId}?aba=whatsapp` : "/whatsapp"} icone="whats">Abrir</LinkAcao>,
      });
    }
  }

  const carregando = cargas.some((c) => c.estado === "carregando");
  const falhou = cargas.find((c) => c.estado === "erro");
  return (
    <section aria-labelledby="t-agora" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <h2 id="t-agora" className="t-titulo-cartao flex items-center gap-3">
        <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="sino" className="h-4 w-4" /></span>Agora
      </h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {falhou && falhou.estado === "erro" ? <ErroCarregar erro={falhou.erro} texto={falhou.texto} tentarDeNovo={falhou.recarregar} /> : null}
      {linhas.length ? <LinhasAgora linhas={linhas} /> : null}
      {carregando ? <Carregando linhas={2} rotulo="Juntando o que pede atenção…" /> : null}
      {!carregando && !falhou && !linhas.length ? (
        <p className="flex items-center gap-2 py-2"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada pedindo atenção agora.</p>
      ) : null}
    </section>
  );
}

function CartaoLista({ id, titulo, icone, href, children }: { id: string; titulo: string; icone: NomeIcone; href: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="t-titulo-cartao flex items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>{titulo}
        </h2>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 t-texto font-medium text-violeta-600 hover:underline" aria-label={`Ver na carteira: ${titulo}`}>
          <span className="max-md:hidden">Ver na carteira</span><span className="md:hidden">Ver</span><Icone nome="dir" className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Implantacoes({ carga }: { carga: ComRecarregar<{ implantacoes: ItemImplantacao[] }> }) {
  return (
    <CartaoLista id="t-implantacoes" titulo="Implantações em andamento" icone="preparar" href="/clientes?filtro=implantacao">
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && !carga.dados.implantacoes.length ? <p className="t-apoio">Nenhuma implantação em andamento nos seus clientes.</p> : null}
      {carga.estado === "pronto" && carga.dados.implantacoes.length ? (
        <ul className="divide-y divide-linha">
          {carga.dados.implantacoes.map((i) => (
            <li key={i.condominioId} className="grid gap-2 py-3">
              <span className="flex items-center justify-between gap-3">
                <Link href={`/clientes/${i.condominioId}?aba=implantacao`} className="font-medium hover:text-violeta-600 hover:underline">{i.nome}</Link>
                <Selo tom="andamento">{i.feitas} de {i.etapas}</Selo>
              </span>
              <BarraEtapas feitas={i.feitas} total={i.etapas} rotulo={`${i.feitas} de ${i.etapas} etapas feitas`} />
              <span className="t-apoio">
                {i.proxima ? `Próxima: ${i.proxima.numero} · ${i.proxima.titulo}${i.proxima.responsavel ? ` · com ${i.proxima.responsavel}` : ""}` : "Todas as etapas feitas: falta a entrega"}
                {i.vencidas ? ` · ${plural(i.vencidas, "pendência vencida", "pendências vencidas")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </CartaoLista>
  );
}

function ATratar({ carga }: { carga: ComRecarregar<{ clientes: ClienteCarteira[] }> }) {
  const lista = carga.estado === "pronto" ? carga.dados.clientes.filter((c) => c.situacoes.length) : [];
  return (
    <CartaoLista id="t-tratar" titulo="Clientes com situações a tratar" icone="alerta" href="/clientes?filtro=tratar">
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && !lista.length ? <p className="flex items-center gap-2"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada a tratar nos seus clientes.</p> : null}
      {lista.length ? (
        <ul className="divide-y divide-linha">
          {lista.map((c) => (
            <li key={c.id} className="grid gap-2 py-3">
              <Link href={`/clientes/${c.id}`} className="justify-self-start font-medium hover:text-violeta-600 hover:underline">{c.nome}</Link>
              <span className="flex flex-wrap gap-1.5">{c.situacoes.map((s) => <SeloSituacao key={s} situacao={s} />)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </CartaoLista>
  );
}

export function Inicio() {
  const sessao = useSessao();
  const atende = atendeClientes(sessao.funcoes);
  const clientes = useCarregar<{ clientes: ClienteCarteira[] }>("/v1/clientes");
  const implantacoes = useCarregar<{ implantacoes: ItemImplantacao[] }>(atende ? "/v1/implantacoes" : null);
  const agora = new Date();
  const primeiroNome = sessao.nome.split(" ")[0];
  const lista = clientes.estado === "pronto" ? clientes.dados.clientes : null;
  const resumo = lista
    ? [plural(lista.length, "cliente na sua carteira", "clientes na sua carteira"), `${lista.filter((c) => c.estagio === "IMPLANTACAO").length} em implantação`].join(" · ")
    : null;

  return (
    <div className="grid gap-5">
      <section aria-label="Resumo do dia" className="relative overflow-hidden rounded-[24px] bg-[image:var(--grad-violeta)] px-8 py-8 text-white max-md:rounded-[20px] max-md:p-5">
        <span aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-[340px] w-[340px] rounded-full border border-white/20 max-md:-top-28 max-md:-right-28 max-md:h-60 max-md:w-60" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-52 -right-48 h-[520px] w-[520px] rounded-full border border-white/15 max-md:-top-44 max-md:-right-44 max-md:h-[360px] max-md:w-[360px]" />
        <span aria-hidden="true" className="pointer-events-none absolute top-5 right-16 h-44 w-6 rotate-[26deg] rounded-full bg-[image:var(--grad-trilha)] shadow-[var(--shadow-trilha)] max-md:top-3.5 max-md:right-6 max-md:h-24 max-md:w-4" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 md:pr-52">
          <div className="grid gap-2">
            <p className="t-rotulo font-medium tracking-[.12em] text-violeta-100 uppercase">
              <span className="max-md:hidden">{HOJE.format(agora)}</span>
              <span className="md:hidden">Console · {HOJE_CURTO.format(agora).replace(".", "")}</span>
            </p>
            <h1 className="t-destaque text-4xl leading-tight max-md:text-[28px]">{saudacao()}, {primeiroNome}</h1>
            {resumo ? <p className="flex items-center gap-1.5 t-texto text-violeta-100 max-md:hidden"><Icone nome="predio" className="h-4 w-4" />{resumo}</p> : null}
          </div>
          {sessao.acoes.includes("console.condominios.criar") ? (
            <Link href="/clientes/novo" className={classeBotao("claro", "max-md:w-full")}><Icone nome="mais" />Cadastrar condomínio</Link>
          ) : null}
        </div>
      </section>
      <Agora implantacoes={implantacoes} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {atende ? <Implantacoes carga={implantacoes} /> : null}
        <ATratar carga={clientes} />
      </div>
    </div>
  );
}
