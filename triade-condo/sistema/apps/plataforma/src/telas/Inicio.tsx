"use client";
// Início do síndico no padrão novo (DC15, telas-modelo inicio-computador e inicio-celular; V-08,
// CF-12): a faixa com a saudação e o Registrar pedido; o Agora, com o que pede atenção e o
// botão de cada linha (passo 7, F7.1; e as decisões que esperam resposta, F7.4, AT-23); Hoje
// na agenda (peça R7) e Vencimentos (documento, contrato e prontuário); e, em "Por área", a
// manutenção (R6), a Vida em condomínio (R12), comunicação e moradores (passo 3), o mês
// fechado, separado do agora, o que está no mural agora (CD-15) e o que falta configurar com o
// que já veio pronto. No celular, os cartões "Por área" fecham numa linha curta e abrem com um
// toque.

import Link from "next/link";
import { CENARIOS, mostrarHoras, mostrarPorcentagem, nomeDoMes, nomeDoMesAnterior, PENDENCIAS_CONFIG } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, Icone, IconeMarca, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { CartaoInicio, LinhasInicio, resumoDasLinhas, type LinhaInicio } from "./CartaoInicio.tsx";
import { diaHora } from "./pedidos/comum.tsx";
import { HojeNaAgenda } from "./agenda/HojeNaAgenda.tsx";
import { linhaContrato, linhasManutencao, vazioManutencao } from "./manutencao/CartaoManutencao.tsx";
import { linhaDocumento, linhasComunicados } from "./comunicados/CartaoComunicados.tsx";
import { CartaoMural } from "./comunicados/CartaoMural.tsx";
import { documentoNoProntuario, itensVencendo, linhaItem, linhasProntuario, MAXIMO_VENCIMENTOS, maisVencimentos } from "./memoria/CartaoMemoria.tsx";
import { useAcessoNoInicio } from "./suporte/AcessoTriade.tsx";
import { linhasVida, temVida } from "./vida/CartaoVida.tsx";
import { useCelular } from "./celular.ts";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { Configuracoes, MesFechado, Prontuario } from "./tipos.ts";

const ONDE: Record<string, { href: string; texto: string; acao: string }> = {
  SEM_HORARIO_ATENDIMENTO: { href: "/configuracoes/horarios", texto: "Definir", acao: "config.editar" },
  SEM_RESPONSAVEL: { href: "/pessoas", texto: "Escolher", acao: "atendimento.responsaveis" },
  SEM_RESPONSAVEL_PADRAO: { href: "/pessoas", texto: "Escolher", acao: "atendimento.responsaveis" },
};

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Moradores (MU-02): cada número leva até onde se resolve. Vão no cartão Comunicação e moradores. */
function linhasMoradores(resumo: NonNullable<ReturnType<typeof usePlataforma>["painel"]["moradores"]>): LinhaInicio[] {
  const unidades = plural(resumo.unidades, "unidade cadastrada", "unidades cadastradas");
  return [
    { icone: "predio", tom: "neutro", titulo: unidades, href: "/moradores", rotuloBotao: `Ver: ${unidades}` },
    ...(resumo.aConfirmar ? [{ icone: "pessoa" as const, tom: "atencao" as const, titulo: plural(resumo.aConfirmar, "contato a confirmar", "contatos a confirmar"),
      detalhe: "Só valem depois de confirmados.", href: "/moradores?aba=confirmar", botao: "Conferir" }] : []),
    ...(resumo.semContato ? [{ icone: "pessoas" as const, tom: "atencao" as const, titulo: plural(resumo.semContato, "unidade sem contato confirmado", "unidades sem contato confirmado"),
      href: "/moradores?filtro=sem-contato", botao: "Ver quais" }] : []),
    ...(resumo.semProprietario ? [{ icone: "chave" as const, tom: "atencao" as const,
      titulo: plural(resumo.semProprietario, "unidade com inquilino e sem proprietário", "unidades com inquilino e sem proprietário"),
      detalhe: "Para controle, o dono do imóvel fica no cadastro.", href: "/moradores?filtro=sem-proprietario", botao: "Ver quais" }] : []),
  ];
}

const HOJE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Agora (F7.1, AT-08, TR-11): o que pede atenção agora, cada linha levando à fila filtrada. O pedido
 * de acesso da TRÍADE e o acesso valendo vêm primeiro, com Decidir e Encerrar (PI-11, decisão D.1). */
function Agora({ resumo, decisoes, paradaDias }: {
  resumo: NonNullable<ReturnType<typeof usePlataforma>["painel"]["pedidos"]>;
  decisoes: ReturnType<typeof usePlataforma>["painel"]["decisoes"];
  paradaDias: number | null;
}) {
  const acesso = useAcessoNoInicio();
  const maisAntigaDias = decisoes?.maisAntigaDias ?? null;
  type Linha = { selo: string | null; tom: Tom; icone: NomeIcone; tomIcone: Tom | "violeta"; texto: string; href: string; botao: string; iconeBotao?: NomeIcone; ajuda: string | null };
  const linhas: Linha[] = [
    ...(resumo.retornoVencido ? [{ selo: "Vencido", tom: "erro" as const, icone: "relogio" as const, tomIcone: "erro" as const,
      texto: plural(resumo.retornoVencido, "retorno vencido", "retornos vencidos"), href: "/pedidos?atencao=RETORNO_VENCIDO", botao: "Ver quais",
      ajuda: resumo.vencidoMaisAntigo
        ? `O mais antigo venceu em ${diaHora(resumo.vencidoMaisAntigo)}${resumo.vencidoMaisAntigoEscalado ? ", já avisado ao síndico" : ""}. O morador está esperando notícia.`
        : null }] : []),
    ...(resumo.vencemHoje ? [{ selo: "Hoje", tom: "atencao" as const, icone: "relogio" as const, tomIcone: "atencao" as const,
      texto: plural(resumo.vencemHoje, "retorno vence hoje", "retornos vencem hoje"), href: "/pedidos?situacao=ATIVOS", botao: "Ver quais",
      ajuda: resumo.proximoHoje ? `O próximo às ${HORA.format(new Date(resumo.proximoHoje))}.` : null }] : []),
    ...(decisoes?.aguardando ? [{ selo: "Para você", tom: "andamento" as const, icone: "decisao" as const, tomIcone: "violeta" as const,
      texto: plural(decisoes.aguardando, "decisão aguardando você", "decisões aguardando você"), href: "/decisoes?filtro=AGUARDANDO", botao: "Decidir", iconeBotao: "check" as const,
      ajuda: [decisoes.vencidas ? `${decisoes.vencidas} com o prazo vencido` : null,
        maisAntigaDias === null ? null : `a mais antiga foi pedida ${maisAntigaDias === 0 ? "hoje" : maisAntigaDias === 1 ? "há 1 dia" : `há ${maisAntigaDias} dias`}`]
        .filter(Boolean).join("; ").replace(/^./, (x) => x.toUpperCase()) + "." }] : []),
    ...(resumo.meusParaAceitar ? [{ selo: null, tom: "info" as const, icone: "pessoa" as const, tomIcone: "violeta" as const,
      texto: plural(resumo.meusParaAceitar, "pedido para você aceitar", "pedidos para você aceitar"), href: "/pedidos?responsavel=EU&atencao=AGUARDANDO_ACEITE", botao: "Ver e aceitar", ajuda: null }] : []),
    ...(resumo.semResponsavel ? [{ selo: "Atenção", tom: "atencao" as const, icone: "pessoa" as const, tomIcone: "atencao" as const,
      texto: plural(resumo.semResponsavel, "sem responsável", "sem responsável"), href: "/pedidos?atencao=SEM_RESPONSAVEL", botao: "Atribuir", ajuda: null }] : []),
    ...(resumo.pendenciasParadas ? [{ selo: null, tom: "info" as const, icone: "alerta" as const, tomIcone: "atencao" as const,
      texto: `${plural(resumo.pendenciasParadas, "pendência parada", "pendências paradas")}${paradaDias ? ` há mais de ${paradaDias} ${paradaDias === 1 ? "dia" : "dias"}` : ""}`,
      href: "/pedidos?atencao=COM_PENDENCIA", botao: "Ver quais", ajuda: null }] : []),
    ...(resumo.emRevisao ? [{ selo: null, tom: "info" as const, icone: "olho" as const, tomIcone: "neutro" as const,
      texto: plural(resumo.emRevisao, "em revisão", "em revisão"), href: "/pedidos?situacao=EM_REVISAO", botao: "Revisar", ajuda: null }] : []),
  ];
  return (
    <CartaoInicio titulo="Agora" icone="sino" href="/pedidos">
      {acesso.erro}
      {linhas.length || acesso.linhas.length ? (
        <LinhasInicio linhas={[...acesso.linhas, ...linhas.map((l) => ({ chave: l.href + l.texto, icone: l.icone, tom: l.tomIcone, titulo: l.texto, detalhe: l.ajuda ?? undefined,
          selo: l.selo ? { texto: l.selo, tom: l.tom } : undefined, href: l.href, botao: l.botao, iconeBotao: l.iconeBotao }))]} />
      ) : (
        <p className="flex items-center gap-2"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada pedindo atenção agora.</p>
      )}
      <p className="t-apoio border-t border-linha pt-3">{plural(resumo.ativos, "pedido ativo", "pedidos ativos")}</p>
      {acesso.janela}
    </CartaoInicio>
  );
}

/** Mês fechado (F7.1, TR-01, TR-03): os números do mês anterior, fixos, separados do agora. */
function MesFechadoCartao({ mes }: { mes: MesFechado }) {
  const r = mes.retornos;
  const semRetorno = r.porcentagem === undefined || r.porcentagem === null;
  return (
    <CartaoInicio titulo={`Mês fechado · ${nomeDoMes(mes.mes)}`} icone="grafico" href="/indicadores" rotulo="Ver indicadores"
      area={{ resumo: semRetorno ? "Nenhum retorno no mês" : `${mostrarPorcentagem(r.porcentagem)} dos retornos no prazo` }}>
      <ul className="divide-y divide-linha">
        <li className="grid gap-0.5 py-3">
          <span><strong className="text-2xl font-semibold tracking-tight">{mostrarPorcentagem(r.porcentagem)}</strong> {semRetorno ? "de retornos no prazo: nenhum retorno no mês" : "dos retornos no prazo"}</span>
          {r.total ? <span className="t-apoio">{r.noPrazo} de {r.total}. {nomeDoMesAnterior(mes.mes).replace(/^./, (x) => x.toUpperCase())}: {mostrarPorcentagem(mes.porcentagemAnterior)}.</span> : null}
        </li>
        <li className="py-3"><strong className="text-2xl font-semibold tracking-tight">{mes.concluidos}</strong> {mes.concluidos === 1 ? "pedido concluído" : "pedidos concluídos"} · <strong>{mes.reabertos}</strong> {mes.reabertos === 1 ? "reaberto" : "reabertos"}</li>
        <li className="py-3">Primeiro retorno em <strong className="text-2xl font-semibold tracking-tight">{mostrarHoras(mes.primeiroRetornoHoras)}</strong>{mes.primeiroRetornoHoras === undefined || mes.primeiroRetornoHoras === null ? "" : ", em média"}</li>
      </ul>
      <p className="t-apoio">Os números do mês fechado não mudam com o dia.</p>
    </CartaoInicio>
  );
}

function excecoes(n: number): string {
  return n === 0 ? "" : n === 1 ? ", com 1 exceção" : `, com ${n} exceções`;
}

/** O que já veio pronto pelo cenário (CF-12), em selos, dentro do cartão O que falta configurar. */
function Pronto({ config }: { config: Configuracoes }) {
  const n = (l: { ativa?: boolean; ativo?: boolean }[]) => l.filter((x) => x.ativa ?? x.ativo).length;
  const geral = config.prazos.find((p) => !p.categoriaId && !p.prioridadeId);
  const linhas = [
    `${n(config.categorias)} categorias · ${n(config.prioridades)} prioridades`,
    `${n(config.etapas)} etapas · ${n(config.modelos)} modelos de resposta`,
    geral ? `Prazo geral: ${geral.horas} h de atendimento${excecoes(config.prazos.length - 1)}` : "Sem prazo geral",
  ];
  return (
    <div role="group" aria-label="Já veio pronto pelo cenário" className="grid gap-2 border-t border-linha pt-3">
      <p className="t-rotulo">Já veio pronto pelo cenário</p>
      <ul className="flex flex-wrap gap-2">
        {linhas.map((l) => <li key={l}><Selo tom="ok">{l} · pronto</Selo></li>)}
      </ul>
    </div>
  );
}

/** Vencimentos (MP-05, MP-12): o documento, o contrato e o prontuário, juntos num cartão só. Até
 * três linhas, das mais urgentes; o resto vira "e mais", que abre o prontuário. */
function Vencimentos({ linhas, mais }: { linhas: LinhaInicio[]; mais: { texto: string; href: string } | null }) {
  return (
    <CartaoInicio titulo="Vencimentos" icone="relogio" href="/agenda"
      area={{ resumo: linhas.length ? resumoDasLinhas(linhas) : "Nada vencendo", quantos: linhas.length }}>
      {linhas.length ? <LinhasInicio linhas={linhas} /> : <p className="t-apoio">Nenhum documento, contrato ou item do prontuário vencendo nos próximos 60 dias.</p>}
      {mais ? (
        <Link href={mais.href} className="inline-flex items-center gap-1 border-t border-linha pt-3 text-sm font-medium text-violeta-600 hover:underline">
          {mais.texto}<Icone nome="dir" className="h-4 w-4" />
        </Link>
      ) : null}
    </CartaoInicio>
  );
}

/** As linhas de Vencimentos: com a lista do prontuário, pelo nome do item; sem ela, as contagens. */
function useVencimentos(): { linhas: LinhaInicio[]; mais: { texto: string; href: string } | null } {
  const { painel } = usePlataforma();
  const carga = useCarregar<Prontuario>(painel.memoria ? "/v1/condominio/memoria/prontuario" : null);
  const p = carga.estado === "pronto" ? carga.dados : null;
  const doc = painel.comunicados?.documentoMaisProximo;
  const documento = painel.comunicados && !(p && documentoNoProntuario(p, doc?.id)) ? linhaDocumento(painel.comunicados) : null;
  const contrato = painel.manutencao ? linhaContrato(painel.manutencao) : null;
  if (!p) {
    return { linhas: [documento, contrato, ...(painel.memoria ? linhasProntuario(painel.memoria.prontuario) : [])].filter((x) => x !== null), mais: null };
  }
  const itens = itensVencendo(p).map(linhaItem);
  const vencidos = itens.filter((l) => l.tom === "erro");
  const todas = [...vencidos, ...[...itens.filter((l) => l.tom !== "erro"), contrato, documento].filter((x) => x !== null)];
  return { linhas: todas.slice(0, MAXIMO_VENCIMENTOS), mais: maisVencimentos(Math.max(0, todas.length - MAXIMO_VENCIMENTOS), p.resumo.falta) };
}

const SAUDACAO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" });
function saudacao(): string {
  const h = Number(SAUDACAO.format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Inicio() {
  const { painel, pode } = usePlataforma();
  const config = useCarregar<Configuracoes>(pode("config.ver") ? "/v1/condominio/configuracoes" : null);
  const c = painel.condominio;
  const primeiroNome = painel.pessoa.nome.split(" ")[0];
  // No celular, Vencimentos desce para "Por área" e fecha numa linha curta, como as outras áreas.
  const celular = useCelular();

  const vencimentos = useVencimentos();
  const temVencimentos = !!(painel.comunicados || painel.manutencao || painel.memoria);
  const manutencao = painel.manutencao ? linhasManutencao(painel.manutencao) : [];
  const vida = painel.vida && temVida(painel.vida) ? linhasVida(painel.vida) : [];
  const comunicacao = [...(painel.comunicados ? linhasComunicados(painel.comunicados) : []), ...(painel.moradores ? linhasMoradores(painel.moradores) : [])];
  const pedemAtencao = (l: LinhaInicio[]) => l.filter((x) => x.tom === "erro" || x.tom === "atencao").length;

  return (
    <div className="grid gap-5">
      <section aria-label="Resumo do dia" className="relative overflow-hidden rounded-[24px] bg-[image:var(--grad-violeta)] px-8 py-8 text-white max-md:rounded-[20px] max-md:p-5">
        <span aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-[340px] w-[340px] rounded-full border border-white/20 max-md:-top-28 max-md:-right-28 max-md:h-60 max-md:w-60" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-52 -right-48 h-[520px] w-[520px] rounded-full border border-white/15 max-md:-top-44 max-md:-right-44 max-md:h-[360px] max-md:w-[360px]" />
        <span aria-hidden="true" className="pointer-events-none absolute top-5 right-16 h-44 w-6 rotate-[26deg] rounded-full bg-[image:var(--grad-trilha)] shadow-[var(--shadow-trilha)] max-md:top-3.5 max-md:right-6 max-md:h-24 max-md:w-4" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 md:pr-52">
          <div className="grid gap-2">
            <p className="text-xs font-medium tracking-[.12em] text-violeta-100 uppercase">{HOJE.format(new Date())}</p>
            <h1 className="t-destaque text-4xl leading-tight max-md:text-[28px]">{saudacao()}, {primeiroNome}</h1>
            <p className="flex items-center gap-1.5 text-sm text-violeta-100">
              <Icone nome="pin" className="h-4 w-4" />
              {[c.nome, c.cenario ? CENARIOS[c.cenario as keyof typeof CENARIOS] ?? c.cenario : null, c.cidade, c.uf].filter(Boolean).join(" · ")}
            </p>
          </div>
          {pode("pedidos.atualizar") && painel.pedidos ? (
            <Link href="/pedidos?registrar=1" className={classeBotao("claro", "max-md:w-full")}><Icone nome="mais" />Registrar pedido</Link>
          ) : null}
        </div>
      </section>
      {painel.pedidos ? <Agora resumo={painel.pedidos} decisoes={painel.decisoes} paradaDias={config.estado === "pronto" ? config.dados.avisos.pendenciaDias : null} /> : null}
      {pode("agenda.ver") || (temVencimentos && !celular) ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {pode("agenda.ver") ? <HojeNaAgenda /> : null}
          {temVencimentos && !celular ? <Vencimentos {...vencimentos} /> : null}
        </div>
      ) : null}
      <section aria-labelledby="t-por-area" className="grid gap-5 max-md:gap-0 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:px-4 max-md:pt-4 max-md:pb-1 max-md:shadow-s1">
        <h2 id="t-por-area" className="t-rotulo flex items-center gap-3 after:h-px after:flex-1 after:bg-linha max-md:pb-2 max-md:text-[15px] max-md:font-semibold max-md:tracking-normal max-md:text-tinta max-md:normal-case max-md:after:hidden">
          <span className="ladrilho h-8 w-8 rounded-[10px] md:hidden" data-tom="violeta" aria-hidden="true"><Icone nome="lista" className="h-4 w-4" /></span>Por área
        </h2>
        <div className="grid items-start gap-5 max-md:gap-0 md:grid-cols-2 xl:grid-cols-3">
          {painel.manutencao ? (
            <CartaoInicio titulo="Manutenção" icone="ferramenta" href="/manutencao"
              area={{ resumo: manutencao.length ? resumoDasLinhas(manutencao) : vazioManutencao(painel.manutencao), quantos: pedemAtencao(manutencao), tom: manutencao.some((l) => l.tom === "erro") ? "erro" : "atencao" }}>
              {manutencao.length ? <LinhasInicio linhas={manutencao} /> : <p className="t-apoio">{vazioManutencao(painel.manutencao)}</p>}
            </CartaoInicio>
          ) : null}
          {temVencimentos && celular ? <Vencimentos {...vencimentos} /> : null}
          {vida.length ? (
            <CartaoInicio titulo="Vida em condomínio" icone="convivio" href="/vida" area={{ resumo: resumoDasLinhas(vida), quantos: pedemAtencao(vida) }}>
              <LinhasInicio linhas={vida} />
            </CartaoInicio>
          ) : null}
          {painel.comunicados || painel.moradores ? (
            <CartaoInicio titulo="Comunicação e moradores" icone="megafone" href={painel.comunicados ? (pode("comunicados.ver") ? "/comunicados" : "/documentos") : "/moradores"}
              area={{ resumo: resumoDasLinhas(comunicacao), quantos: pedemAtencao(comunicacao) }}>
              {painel.moradores && painel.moradores.unidades === 0 ? (
                <div className="grid justify-items-start gap-2">
                  <p>Nenhuma unidade ainda. Cadastre as unidades ou importe a planilha da administradora.</p>
                  <Link href="/moradores" className={classeBotao("contorno", "", "m")}>Cadastrar unidades</Link>
                </div>
              ) : null}
              <LinhasInicio linhas={painel.moradores?.unidades === 0 ? comunicacao.filter((l) => l.icone !== "predio") : comunicacao} />
            </CartaoInicio>
          ) : null}
          {pode("comunicados.ver") ? <CartaoMural /> : null}
          {painel.mesFechado ? <MesFechadoCartao mes={painel.mesFechado} /> : null}
          <CartaoInicio titulo="O que falta configurar" icone="ajuste" href={pode("config.ver") ? "/configuracoes" : undefined} rotulo="Configurações"
            area={{ resumo: painel.pendencias.length ? painel.pendencias.map((p) => PENDENCIAS_CONFIG[p as keyof typeof PENDENCIAS_CONFIG] ?? p).join(" · ") : "Nada pendente", quantos: painel.pendencias.length }}>
            {painel.pendencias.length === 0 ? (
              <p className="flex items-center gap-2"><IconeMarca marca="ok" className="h-4 w-4 text-ok" />Nada pendente. O condomínio está pronto para receber pedidos.</p>
            ) : (
              <LinhasInicio linhas={painel.pendencias.map((p) => {
                const onde = ONDE[p];
                return { chave: p, icone: "alerta" as const, tom: "atencao" as const, titulo: PENDENCIAS_CONFIG[p as keyof typeof PENDENCIAS_CONFIG] ?? p,
                  href: onde && pode(onde.acao) ? onde.href : undefined, botao: onde?.texto };
              })} />
            )}
            {config.estado === "pronto" ? <Pronto config={config.dados} /> : null}
            {config.estado === "carregando" && pode("config.ver") ? <Carregando linhas={2} rotulo="Carregando as configurações…" /> : null}
            {config.estado === "erro" ? <ErroCarregar erro={config.erro} texto={config.texto} tentarDeNovo={config.recarregar} /> : null}
            <p className="t-apoio">Nada aqui é obrigatório: o painel só avisa.</p>
          </CartaoInicio>
        </div>
      </section>
    </div>
  );
}
