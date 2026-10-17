"use client";
// Vínculo detalhado (passo 3b, MU-10): as três marcações (proprietário, responsável pela
// unidade, mora na unidade), a ligação de quem não é proprietário, o parentesco do familiar e
// o período de ocupação. Usado ao incluir, editar e na mudança, e para descrever a pessoa na
// ficha. "principal" é o responsável pela unidade.

import { LIGACOES, mostrarDataSemHora, OCUPACOES, PARENTESCOS, type Ligacao, type Ocupacao, type Parentesco } from "@triade/domain";
import { Aviso, CampoSelecao, CampoTexto } from "@triade/ui";
import { Caixa } from "./comum.tsx";

export interface CamposDoVinculo {
  proprietario: boolean;
  principal: boolean;
  mora: boolean;
  ligacao: Ligacao;
  parentesco: Parentesco | "";
  ocupaDesde: string;
}

interface ComMarcas {
  proprietario: boolean;
  principal?: boolean;
  mora: boolean;
  ligacao: Ligacao | null;
  parentesco: Parentesco | null;
  ocupaDesde: string | null;
}

export const VINCULO_NOVO: CamposDoVinculo = { proprietario: false, principal: false, mora: true, ligacao: "INQUILINO", parentesco: "", ocupaDesde: "" };

export function vinculoDe(c: ComMarcas): CamposDoVinculo {
  return {
    proprietario: c.proprietario, principal: !!c.principal, mora: c.mora, ligacao: c.ligacao ?? "OUTRO",
    parentesco: c.parentesco ?? "", ocupaDesde: c.ocupaDesde ?? "",
  };
}

/** O que vai para a API: proprietário sem ligação; parentesco só de familiar. */
export function marcasDe(v: CamposDoVinculo) {
  const ligacao = v.proprietario ? null : v.ligacao;
  return {
    proprietario: v.proprietario, principal: v.principal, mora: v.mora, ligacao,
    parentesco: ligacao === "FAMILIAR" && v.parentesco ? v.parentesco : null,
  };
}

const opcoesLigacao = Object.entries(LIGACOES).map(([valor, texto]) => ({ valor, texto }));
const opcoesParentesco = [{ valor: "", texto: "Não informar" }, ...Object.entries(PARENTESCOS).map(([valor, texto]) => ({ valor, texto }))];

/**
 * As marcações, a ligação, o parentesco e (com comPeriodo) a data de entrada.
 * responsavelAtual: quem é o responsável hoje, para avisar a troca e dizer de quem é o parentesco.
 */
export function CamposVinculo({ prefixo, valor, aoMudar, responsavelAtual, comPeriodo = true, quem = "Esta pessoa", de = "", erros = [] }: {
  prefixo: string;
  valor: CamposDoVinculo;
  aoMudar: (v: CamposDoVinculo) => void;
  responsavelAtual?: { nome: string; mora: boolean } | null;
  comPeriodo?: boolean;
  /** Quem é marcado, na legenda: "Esta pessoa", "A pessoa 2". */
  quem?: string;
  /** Complemento dos rótulos quando há várias pessoas na janela: " da pessoa 2". */
  de?: string;
  erros?: string[];
}) {
  const mudar = (p: Partial<CamposDoVinculo>) => aoMudar({ ...valor, ...p });
  const trocaResponsavel = valor.principal && responsavelAtual;
  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium">{quem} é</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Caixa id={`${prefixo}-proprietario`} rotulo="Proprietário" marcada={valor.proprietario} aoMudar={(v) => mudar({ proprietario: v })} />
          <Caixa id={`${prefixo}-responsavel`} rotulo="Responsável pela unidade" marcada={valor.principal} aoMudar={(v) => mudar({ principal: v })} />
          <Caixa id={`${prefixo}-mora`} rotulo="Mora na unidade" marcada={valor.mora} aoMudar={(v) => mudar({ mora: v })} />
        </div>
        <p className="text-xs text-tinta-suave">Marque tudo o que vale. A unidade tem um responsável só: é quem o condomínio procura primeiro.</p>
      </fieldset>
      {trocaResponsavel ? (
        <Aviso tom="atencao">
          {responsavelAtual.nome} deixa de ser o responsável pela unidade{responsavelAtual.mora ? " e continua como morador" : ""}.
        </Aviso>
      ) : null}
      {valor.proprietario ? null : (
        <CampoSelecao id={`${prefixo}-ligacao`} rotulo={`Ligação${de} com a unidade`} value={valor.ligacao}
          onChange={(e) => mudar({ ligacao: e.target.value as Ligacao })} opcoes={opcoesLigacao}
          erro={erros.includes("ligacao") ? "Escolha a ligação com a unidade." : null} />
      )}
      {!valor.proprietario && valor.ligacao === "FAMILIAR" ? (
        <CampoSelecao id={`${prefixo}-parentesco`} opcional
          rotulo={responsavelAtual && !valor.principal ? `Parentesco${de} com ${responsavelAtual.nome} (responsável)` : `Parentesco${de} com o responsável`}
          value={valor.parentesco} onChange={(e) => mudar({ parentesco: e.target.value as Parentesco | "" })} opcoes={opcoesParentesco}
          erro={erros.includes("parentesco") ? "Parentesco só para familiar." : null} />
      ) : null}
      {comPeriodo ? (
        <CampoTexto id={`${prefixo}-desde`} rotulo="Ocupa desde" type="date" opcional value={valor.ocupaDesde}
          onChange={(e) => mudar({ ocupaDesde: e.target.value })}
          ajuda="Deixe em branco se esta pessoa sempre ocupou a unidade. Com a data de entrada, ela deixa de ver o histórico de quem ocupava antes."
          erro={erros.includes("ocupaDesde") ? "Confira a data de entrada." : null} />
      ) : null}
    </>
  );
}

/** "Responsável · Mora aqui" e o resto: "inquilino · desde 01/03/2025". */
export function descreverVinculo(c: ComMarcas & { principal?: boolean }): { marcas: string; resto: string[] } {
  const marcas = [c.principal ? "Responsável" : null, c.proprietario ? "Proprietário" : null, c.mora ? "Mora aqui" : null].filter(Boolean).join(" · ");
  const ligacao = c.proprietario ? (c.mora ? null : "não mora aqui")
    : c.ligacao === "FAMILIAR" && c.parentesco ? `familiar: ${PARENTESCOS[c.parentesco].toLowerCase()}`
    : c.ligacao ? LIGACOES[c.ligacao].toLowerCase() : null;
  return { marcas, resto: [ligacao, c.ocupaDesde ? `desde ${mostrarDataSemHora(c.ocupaDesde)}` : null].filter((x): x is string => !!x) };
}

/** "Alugada · 2 moram aqui · o proprietário não mora". */
export function LinhaOcupacao({ ocupacao }: { ocupacao: { situacao: Ocupacao; moram: number; proprietarioNaoMora: boolean } }) {
  if (ocupacao.situacao === "SEM_CADASTRO") return null;
  return (
    <p className="text-sm">
      <strong className="font-semibold">{OCUPACOES[ocupacao.situacao]}</strong>
      {ocupacao.moram ? ` · ${ocupacao.moram === 1 ? "1 mora aqui" : `${ocupacao.moram} moram aqui`}` : ""}
      {ocupacao.proprietarioNaoMora ? " · o proprietário não mora" : ""}
    </p>
  );
}
