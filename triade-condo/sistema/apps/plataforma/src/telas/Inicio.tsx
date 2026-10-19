"use client";
// Início do síndico (V-08, CF-12): o resumo de moradores e unidades (passo 3), o que falta
// configurar, sem obrigar nada, e o que já veio pronto pelo cenário. O dia do condomínio
// (passo 7, F7.1): o que pede atenção agora e o mês fechado, separado do agora. Hoje na
// agenda (peça R7) e o cartão da manutenção (peça R6).

import Link from "next/link";
import { CENARIOS, mostrarHoras, mostrarPorcentagem, nomeDoMes, nomeDoMesAnterior, PENDENCIAS_CONFIG } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, IconeMarca, Selo } from "@triade/ui";
import { diaHora } from "./pedidos/comum.tsx";
import { HojeNaAgenda } from "./agenda/HojeNaAgenda.tsx";
import { CartaoManutencao } from "./manutencao/CartaoManutencao.tsx";
import { CartaoComunicados } from "./comunicados/CartaoComunicados.tsx";
import { CartaoMemoria } from "./memoria/CartaoMemoria.tsx";
import { CartaoAcessoExcepcional } from "./suporte/CartaoAcessoExcepcional.tsx";
import { CartaoVida } from "./vida/CartaoVida.tsx";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { Configuracoes, MesFechado } from "./tipos.ts";

const ONDE: Record<string, { href: string; texto: string; acao: string }> = {
  SEM_HORARIO_ATENDIMENTO: { href: "/configuracoes?aba=horarios", texto: "Definir", acao: "config.editar" },
  SEM_RESPONSAVEL: { href: "/pessoas?aba=atendimento", texto: "Escolher", acao: "atendimento.responsaveis" },
  SEM_RESPONSAVEL_PADRAO: { href: "/pessoas?aba=atendimento", texto: "Escolher", acao: "atendimento.responsaveis" },
};

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Resumo de moradores (MU-02): cada número leva até onde se resolve. */
function Moradores({ resumo }: { resumo: NonNullable<ReturnType<typeof usePlataforma>["painel"]["moradores"]> }) {
  const linhas = [
    { texto: plural(resumo.unidades, "unidade cadastrada", "unidades cadastradas"), href: "/moradores", botao: "Ver unidades", ajuda: null, aviso: false },
    ...(resumo.aConfirmar ? [{ texto: plural(resumo.aConfirmar, "contato a confirmar", "contatos a confirmar"), href: "/moradores?aba=confirmar", botao: "Conferir",
      ajuda: "Só valem depois de confirmados.", aviso: true }] : []),
    ...(resumo.semContato ? [{ texto: plural(resumo.semContato, "unidade sem contato confirmado", "unidades sem contato confirmado"),
      href: "/moradores?filtro=sem-contato", botao: "Ver quais", ajuda: null, aviso: true }] : []),
    ...(resumo.semProprietario ? [{ texto: plural(resumo.semProprietario, "unidade com inquilino e sem proprietário", "unidades com inquilino e sem proprietário"),
      href: "/moradores?filtro=sem-proprietario", botao: "Ver quais", ajuda: "Para controle, o dono do imóvel fica no cadastro.", aviso: true }] : []),
  ];
  return (
    <section aria-labelledby="t-moradores" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-moradores" className="text-lg font-medium">Moradores e unidades</h2>
      {resumo.unidades === 0 ? (
        <div className="grid justify-items-start gap-2 text-sm">
          <p>Nenhuma unidade ainda. Cadastre as unidades ou importe a planilha da administradora.</p>
          <Link href="/moradores" className={classeBotao("contorno")}>Cadastrar unidades</Link>
        </div>
      ) : (
        <ul className="divide-y divide-linha">
          {linhas.map((l) => (
            <li key={l.href} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="flex items-start gap-2">
                {l.aviso ? <IconeMarca marca="atencao" className="mt-0.5 h-4 w-4 text-atencao" /> : null}
                <span>{l.texto}{l.ajuda ? <span className="block text-xs text-tinta-suave">{l.ajuda}</span> : null}</span>
              </span>
              <Link href={l.href} className={classeBotao("discreto", "", "m")}>{l.botao}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HOJE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Agora (F7.1, AT-08, TR-11): o que pede atenção agora, cada linha levando à fila filtrada. */
function Agora({ resumo, registrar, paradaDias }: {
  resumo: NonNullable<ReturnType<typeof usePlataforma>["painel"]["pedidos"]>;
  registrar: boolean;
  paradaDias: number | null;
}) {
  const linhas = [
    ...(resumo.retornoVencido ? [{ selo: "Vencido", tom: "erro" as const, texto: plural(resumo.retornoVencido, "retorno vencido", "retornos vencidos"),
      href: "/pedidos?atencao=RETORNO_VENCIDO", botao: "Ver quais", primario: true,
      ajuda: resumo.vencidoMaisAntigo
        ? `O mais antigo venceu em ${diaHora(resumo.vencidoMaisAntigo)}${resumo.vencidoMaisAntigoEscalado ? ", já avisado ao síndico" : ""}. O morador está esperando notícia.`
        : null }] : []),
    ...(resumo.vencemHoje ? [{ selo: "Hoje", tom: "atencao" as const, texto: plural(resumo.vencemHoje, "retorno vence hoje", "retornos vencem hoje"),
      href: "/pedidos?situacao=ATIVOS", botao: "Ver quais", primario: false,
      ajuda: resumo.proximoHoje ? `O próximo às ${HORA.format(new Date(resumo.proximoHoje))}.` : null }] : []),
    ...(resumo.meusParaAceitar ? [{ selo: null, tom: "info" as const, texto: plural(resumo.meusParaAceitar, "pedido para você aceitar", "pedidos para você aceitar"),
      href: "/pedidos?responsavel=EU&atencao=AGUARDANDO_ACEITE", botao: "Ver e aceitar", ajuda: null as string | null, primario: false }] : []),
    ...(resumo.semResponsavel ? [{ selo: null, tom: "info" as const, texto: plural(resumo.semResponsavel, "sem responsável", "sem responsável"),
      href: "/pedidos?atencao=SEM_RESPONSAVEL", botao: "Atribuir", ajuda: null, primario: false }] : []),
    ...(resumo.pendenciasParadas ? [{ selo: null, tom: "info" as const,
      texto: `${plural(resumo.pendenciasParadas, "pendência parada", "pendências paradas")}${paradaDias ? ` há mais de ${paradaDias} ${paradaDias === 1 ? "dia" : "dias"}` : ""}`,
      href: "/pedidos?atencao=COM_PENDENCIA", botao: "Ver quais", ajuda: null, primario: false }] : []),
    ...(resumo.emRevisao ? [{ selo: null, tom: "info" as const, texto: plural(resumo.emRevisao, "em revisão", "em revisão"), href: "/pedidos?situacao=EM_REVISAO",
      botao: "Revisar", ajuda: null, primario: false }] : []),
  ];
  return (
    <section aria-labelledby="t-agora" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-agora" className="text-lg font-medium">Agora</h2>
      {linhas.length ? (
        <ul className="divide-y divide-linha">
          {linhas.map((l) => (
            <li key={l.href + l.texto} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="flex flex-wrap items-start gap-2">
                {l.selo ? <Selo tom={l.tom}>{l.selo}</Selo>
                  : <IconeMarca marca="atencao" className="mt-0.5 h-4 w-4 text-atencao" />}
                <span>{l.texto}{l.ajuda ? <span className="block text-xs text-tinta-suave">{l.ajuda}</span> : null}</span>
              </span>
              <Link href={l.href} className={classeBotao(l.primario ? "secundario" : "discreto", "", "m")}>{l.botao}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada pedindo atenção agora.</p>
      )}
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-tinta-suave">{plural(resumo.ativos, "pedido ativo", "pedidos ativos")}</span>
        <span className="flex gap-2">
          {registrar ? <Link href="/pedidos" className={classeBotao("contorno")}>Registrar pedido</Link> : null}
          <Link href="/pedidos" className={classeBotao("discreto")}>Ver todos</Link>
        </span>
      </p>
    </section>
  );
}

/** Mês fechado (F7.1, TR-01, TR-03): os números do mês anterior, fixos, separados do agora. */
function MesFechadoCartao({ mes }: { mes: MesFechado }) {
  const r = mes.retornos;
  return (
    <section aria-labelledby="t-mes" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-mes" className="text-lg font-medium">Mês fechado · {nomeDoMes(mes.mes)}</h2>
      <ul className="divide-y divide-linha text-sm">
        <li className="py-2.5">
          <strong className="text-lg">{mostrarPorcentagem(r.porcentagem)}</strong> {r.porcentagem === undefined || r.porcentagem === null ? "de retornos no prazo: nenhum retorno no mês" : "dos retornos no prazo"}
          {r.total ? <span className="block text-xs text-tinta-suave">{r.noPrazo} de {r.total}. {nomeDoMesAnterior(mes.mes).replace(/^./, (x) => x.toUpperCase())}: {mostrarPorcentagem(mes.porcentagemAnterior)}.</span> : null}
        </li>
        <li className="py-2.5"><strong>{mes.concluidos}</strong> {mes.concluidos === 1 ? "pedido concluído" : "pedidos concluídos"} · <strong>{mes.reabertos}</strong> {mes.reabertos === 1 ? "reaberto" : "reabertos"}</li>
        <li className="py-2.5">Primeiro retorno em <strong>{mostrarHoras(mes.primeiroRetornoHoras)}</strong>{mes.primeiroRetornoHoras === undefined || mes.primeiroRetornoHoras === null ? "" : ", em média"}</li>
      </ul>
      <p className="text-xs text-tinta-suave">Os números do mês fechado não mudam com o dia.</p>
      <Link href="/indicadores" className={classeBotao("discreto", "justify-self-start")}>Ver indicadores</Link>
    </section>
  );
}

function excecoes(n: number): string {
  return n === 0 ? "" : n === 1 ? ", com 1 exceção" : `, com ${n} exceções`;
}

function Pronto({ config }: { config: Configuracoes }) {
  const n = (l: { ativa?: boolean; ativo?: boolean }[]) => l.filter((x) => x.ativa ?? x.ativo).length;
  const geral = config.prazos.find((p) => !p.categoriaId && !p.prioridadeId);
  const linhas = [
    `${n(config.categorias)} categorias · ${n(config.prioridades)} prioridades`,
    `${n(config.etapas)} etapas · ${n(config.modelos)} modelos de resposta`,
    geral ? `Prazo geral: ${geral.horas} h de atendimento${excecoes(config.prazos.length - 1)}` : "Sem prazo geral",
  ];
  return (
    <section aria-labelledby="t-pronto" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-pronto" className="text-lg font-medium">Já veio pronto pelo cenário</h2>
      <ul className="divide-y divide-linha">
        {linhas.map((l) => (
          <li key={l} className="flex items-center justify-between gap-3 py-2.5 text-sm">{l}<Selo tom="ok">Pronto</Selo></li>
        ))}
      </ul>
      <p className="text-sm text-tinta-suave">Tudo pode ser ajustado em <Link href="/configuracoes" className="font-medium text-violeta-600 hover:underline">Configurações</Link>.</p>
    </section>
  );
}

export function Inicio() {
  const { painel, pode } = usePlataforma();
  const config = useCarregar<Configuracoes>(pode("config.ver") ? "/v1/condominio/configuracoes" : null);
  const c = painel.condominio;

  return (
    <div className="grid gap-6">
      <header className="relative overflow-hidden rounded-[20px] bg-[image:var(--grad-violeta)] px-6 py-6 text-white md:px-8">
        <span aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-[340px] w-[340px] rounded-full border border-white/20" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-52 -right-48 h-[520px] w-[520px] rounded-full border border-white/15" />
        <span aria-hidden="true" className="pointer-events-none absolute top-8 right-10 hidden h-56 w-8 rotate-[26deg] rounded-full bg-[image:var(--grad-trilha)] opacity-90 sm:block" />
        <div className="relative">
          <p className="text-xs font-medium tracking-[.08em] text-violeta-100 uppercase">{HOJE.format(new Date())}</p>
          <h1 className="mt-1.5 text-[32px] leading-tight font-light tracking-tight">{c.nome}</h1>
          <p className="mt-1 text-violeta-100">
            {[c.cenario ? CENARIOS[c.cenario as keyof typeof CENARIOS] ?? c.cenario : null, c.cidade, c.uf].filter(Boolean).join(" · ")}
          </p>
          {painel.pedidos ? (
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {[
                [painel.pedidos.retornoVencido, painel.pedidos.retornoVencido === 1 ? "retorno vencido" : "retornos vencidos"],
                [painel.pedidos.vencemHoje, painel.pedidos.vencemHoje === 1 ? "vence hoje" : "vencem hoje"],
                [painel.pedidos.meusParaAceitar, "para você aceitar"],
              ].map(([n, t]) => (
                <li key={String(t)} className="min-w-32 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 sm:flex-none">
                  <b className="block text-2xl leading-tight font-light">{n}</b>
                  <span className="text-sm text-violeta-100">{t}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {painel.acessosExcepcionais && (painel.acessosExcepcionais.pedidos.length || painel.acessosExcepcionais.valendo) ? (
          <CartaoAcessoExcepcional pedidos={painel.acessosExcepcionais.pedidos} valendo={painel.acessosExcepcionais.valendo} />
        ) : null}
        {painel.pedidos ? (
          <Agora resumo={painel.pedidos} registrar={pode("pedidos.atualizar")}
            paradaDias={config.estado === "pronto" ? config.dados.avisos.pendenciaDias : null} />
        ) : null}
        {pode("agenda.ver") ? <HojeNaAgenda /> : null}
        {painel.manutencao ? <CartaoManutencao resumo={painel.manutencao} /> : null}
        {painel.vida?.reservasAAprovar ? <CartaoVida resumo={painel.vida} /> : null}
        {painel.comunicados ? <CartaoComunicados resumo={painel.comunicados} verComunicados={pode("comunicados.ver")} /> : null}
        {painel.memoria ? <CartaoMemoria resumo={painel.memoria.prontuario} /> : null}
        {painel.mesFechado ? <MesFechadoCartao mes={painel.mesFechado} /> : null}
        {painel.moradores ? <Moradores resumo={painel.moradores} /> : null}
        <section aria-labelledby="t-falta" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <h2 id="t-falta" className="text-lg font-medium">O que falta configurar</h2>
          {painel.pendencias.length === 0 ? (
            <p className="flex items-center gap-2 text-sm"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada pendente. O condomínio está pronto para receber pedidos.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {painel.pendencias.map((p) => {
                const onde = ONDE[p];
                return (
                  <li key={p} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex items-start gap-2">
                      <IconeMarca marca="atencao" className="mt-0.5 h-4 w-4 text-atencao" />
                      {PENDENCIAS_CONFIG[p as keyof typeof PENDENCIAS_CONFIG] ?? p}
                    </span>
                    {onde && pode(onde.acao) ? <Link href={onde.href} className={classeBotao("contorno")}>{onde.texto}</Link> : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-tinta-suave">Nada aqui é obrigatório: o painel só avisa.</p>
        </section>
        {config.estado === "pronto" ? <Pronto config={config.dados} /> : null}
        {config.estado === "carregando" && pode("config.ver") ? <Carregando linhas={3} rotulo="Carregando as configurações…" /> : null}
        {config.estado === "erro" ? <ErroCarregar texto={config.texto} tentarDeNovo={config.recarregar} /> : null}
      </div>
    </div>
  );
}
