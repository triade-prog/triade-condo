"use client";
// Estados da tela (DC15, docs/design/telas-modelo/estados.html): sem permissão, vazio e erro
// falam a mesma língua. Mesmo cartão e mesma ordem: ícone, título, uma frase que explica, uma
// nota e a saída. Nada de piada, nada de tela branca.

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { ErroApi } from "./api.ts";
import { Botao, classeBotao } from "./componentes.tsx";
import { Icone, type NomeIcone } from "./Icone.tsx";

interface PropsLigacao { href: string; className?: string; children: ReactNode }

/** O que cada aplicação diz aos estados: onde fica o Início, o suporte e o link da própria aplicação. */
export interface DestinosEstados {
  inicio?: string;
  suporte?: string;
  /** Quem dá a permissão que falta, dito no estado "sem permissão". */
  quemDaPermissao?: string;
  Ligacao?: ComponentType<PropsLigacao>;
}

const Destinos = createContext<DestinosEstados>({});
export const DestinosDosEstados = Destinos.Provider;

function Ligacao(p: PropsLigacao) {
  const { Ligacao: L } = useContext(Destinos);
  return L ? <L {...p} /> : <a href={p.href} className={p.className}>{p.children}</a>;
}

/** Nível do título: 1 quando o estado é a tela inteira; 0 (parágrafo) quando ele fica dentro de uma tela. */
type Nivel = 0 | 1 | 2;

export function EstadoTela({ icone, tom, titulo, children, nota, acoes, arte, nivel = 0 }: {
  icone: NomeIcone; tom?: "erro" | "ok"; titulo: string; children?: ReactNode; nota?: ReactNode; acoes?: ReactNode; arte?: boolean; nivel?: Nivel;
}) {
  const Titulo = nivel === 1 ? "h1" : nivel === 2 ? "h2" : "p";
  return (
    <div className="estado" data-tom={tom} data-arte={arte ? "" : undefined}>
      <span className="quadro" aria-hidden="true"><Icone nome={icone} /></span>
      <Titulo className="t-titulo-secao">{titulo}</Titulo>
      {children ? <p className="t-texto max-w-prose">{children}</p> : null}
      {nota ? <p className="t-apoio max-w-prose">{nota}</p> : null}
      {acoes ? <div className="acoes">{acoes}</div> : null}
    </div>
  );
}

/** Sem permissão: o título é o nome da tela; diz qual permissão falta e quem pode dar. */
export function SemPermissao({ tela, permissao, texto, nota, nivel = 1 }: { tela?: string; permissao?: string; texto?: string; nota?: string; nivel?: Nivel }) {
  const { inicio = "/", quemDaPermissao } = useContext(Destinos);
  return (
    <EstadoTela icone="cadeado" titulo={tela ?? "Sem acesso a esta parte"} nivel={nivel} nota={nota ?? quemDaPermissao}
      acoes={<Ligacao href={inicio} className={classeBotao("contorno", "", "m")}><Icone nome="casa" />Voltar ao Início</Ligacao>}>
      {texto ?? (permissao ? `Você não tem a permissão ${permissao}.` : "Você não tem permissão para ver isto.")}
    </EstadoTela>
  );
}

/** Vazio, ainda não usado: uma frase do que a tela faz e uma ação. Vazio por filtro diz o filtro. */
export function Vazio({ titulo, children, acao, icone = "info", nota }: { titulo: string; children?: ReactNode; acao?: ReactNode; icone?: NomeIcone; nota?: ReactNode }) {
  return <EstadoTela icone={icone} tom="ok" titulo={titulo} nota={nota} acoes={acao} arte>{children}</EstadoTela>;
}

const CODIGO_CURTO: Partial<Record<ErroApi["codigo"], string>> = {
  UPSTREAM_UNAVAILABLE: "E-REDE",
  INTERNAL_ERROR: "E-SERVIDOR",
  NOT_FOUND: "E-NAO-ACHOU",
  RATE_LIMITED: "E-ESPERA",
};

/** Erro ao carregar: diz o que aconteceu, que nada se perdeu e dá uma saída. Sem permissão vira o estado próprio. */
export function ErroCarregar({ texto, tentarDeNovo, erro, oQue }: { texto: string; tentarDeNovo?: () => void; erro?: ErroApi; oQue?: string }) {
  const { suporte } = useContext(Destinos);
  if (erro?.codigo === "FORBIDDEN") return <SemPermissao nivel={0} />;
  const codigo = erro ? CODIGO_CURTO[erro.codigo] ?? erro.codigo : null;
  return (
    <div role="alert">
      <EstadoTela icone="alerta" tom="erro" titulo={oQue ? `Não deu para carregar ${oQue}` : "Não deu para carregar"}
        nota={codigo && suporte ? `Se continuar, fale com o suporte e informe o código ${codigo}.` : null}
        acoes={tentarDeNovo || suporte ? (
          <>
            {tentarDeNovo ? <Botao variante="contorno" tamanho="m" onClick={tentarDeNovo}><Icone nome="retorno" />Tentar de novo</Botao> : null}
            {suporte ? <Ligacao href={suporte} className={classeBotao("discreto", "", "m")}><Icone nome="balao" />Falar com o suporte</Ligacao> : null}
          </>
        ) : null}>
        {/nada/i.test(texto) ? texto : `${texto} Nada do que você fez foi perdido.`}
      </EstadoTela>
    </div>
  );
}
