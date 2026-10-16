"use client";
// Início do síndico (V-08, CF-12): o resumo de moradores e unidades (passo 3), o que falta
// configurar, sem obrigar nada, e o que já veio pronto pelo cenário. O dia do síndico
// (pedidos e retornos) chega no passo 7.

import Link from "next/link";
import { CENARIOS, PENDENCIAS_CONFIG } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, IconeMarca, Selo } from "@triade/ui";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { Configuracoes } from "./tipos.ts";

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
  ];
  return (
    <section aria-labelledby="t-moradores" className="grid content-start gap-3 rounded-xl border border-linha bg-superficie p-5 shadow-sm">
      <h2 id="t-moradores" className="font-semibold">Moradores e unidades</h2>
      {resumo.unidades === 0 ? (
        <div className="grid justify-items-start gap-2 text-sm">
          <p>Nenhuma unidade ainda. Cadastre as unidades ou importe a planilha da administradora.</p>
          <Link href="/moradores" className={classeBotao("secundario")}>Cadastrar unidades</Link>
        </div>
      ) : (
        <ul className="divide-y divide-linha">
          {linhas.map((l) => (
            <li key={l.href} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="flex items-start gap-2">
                {l.aviso ? <IconeMarca marca="atencao" className="mt-0.5 h-4 w-4 text-atencao" /> : null}
                <span>{l.texto}{l.ajuda ? <span className="block text-xs text-tinta-suave">{l.ajuda}</span> : null}</span>
              </span>
              <Link href={l.href} className={classeBotao("secundario")}>{l.botao}</Link>
            </li>
          ))}
        </ul>
      )}
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
    <section aria-labelledby="t-pronto" className="grid content-start gap-3 rounded-xl border border-linha bg-superficie p-5 shadow-sm">
      <h2 id="t-pronto" className="font-semibold">Já veio pronto pelo cenário</h2>
      <ul className="divide-y divide-linha">
        {linhas.map((l) => (
          <li key={l} className="flex items-center justify-between gap-3 py-2.5 text-sm">{l}<Selo tom="ok" marca="ok">Pronto</Selo></li>
        ))}
      </ul>
      <p className="text-sm text-tinta-suave">Tudo pode ser ajustado em <Link href="/configuracoes" className="font-medium text-acao hover:underline">Configurações</Link>.</p>
    </section>
  );
}

export function Inicio() {
  const { painel, pode } = usePlataforma();
  const config = useCarregar<Configuracoes>(pode("config.ver") ? "/v1/condominio/configuracoes" : null);
  const c = painel.condominio;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-tinta-suave">Plataforma do síndico</p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.nome}</h1>
        <p className="mt-1 text-tinta-suave">
          {[c.cenario ? CENARIOS[c.cenario as keyof typeof CENARIOS] ?? c.cenario : null, c.cidade, c.uf].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {painel.moradores ? <Moradores resumo={painel.moradores} /> : null}
        <section aria-labelledby="t-falta" className="grid content-start gap-3 rounded-xl border border-linha bg-superficie p-5 shadow-sm">
          <h2 id="t-falta" className="font-semibold">O que falta configurar</h2>
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
                    {onde && pode(onde.acao) ? <Link href={onde.href} className={classeBotao("secundario")}>{onde.texto}</Link> : null}
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
