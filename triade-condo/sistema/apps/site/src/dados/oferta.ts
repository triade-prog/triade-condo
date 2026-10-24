// Oferta comercial mostrada no site: preços, faixas, franquias e implantação.
// Valores decididos pela Carolina em 24/10/2026 (DC16; NG-02 a NG-07, NG-15 a NG-17).

export const precosProvisorios = false;

export type Faixa = {
  id: string;
  rotulo: string;
  /** Rótulo curto, usado no formulário de demonstração. */
  curto: string;
  mensal: number;
  implantacao: number;
  implantacaoInclui: string;
  /** Preço de condomínio fundador: só no mensal, sem implantação, por 12 meses. */
  fundador: number;
  destaque?: boolean;
};

export const faixas: Faixa[] = [
  { id: "ate-40", rotulo: "Até 40 unidades", curto: "Até 40", mensal: 199, implantacao: 600, implantacaoInclui: "Cadastro de unidades e moradores, 1 treinamento online", fundador: 129 },
  { id: "41-100", rotulo: "41 a 100 unidades", curto: "41 a 100", mensal: 349, implantacao: 900, implantacaoInclui: "+ importação de documentos e prestadores", fundador: 229, destaque: true },
  { id: "101-200", rotulo: "101 a 200 unidades", curto: "101 a 200", mensal: 549, implantacao: 1400, implantacaoInclui: "+ 2 treinamentos (equipe e conselho)", fundador: 349 },
  { id: "201-400", rotulo: "201 a 400 unidades", curto: "201 a 400", mensal: 849, implantacao: 2000, implantacaoInclui: "+ acompanhamento das 4 primeiras semanas", fundador: 549 },
];

/** Opções do formulário de demonstração: as faixas e a de "sob consulta". */
export const opcoesUnidades = [...faixas.map((f) => f.curto), "Mais de 400 ou vários prédios"];

/** Anual à vista: 12 meses pelo preço de 11. */
export function mensalNoAnual(mensal: number): number {
  return Math.round((mensal * 11) / 12);
}

export function reais(valor: number): string {
  return "R$ " + valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function inteiro(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

/** Pontos ainda sem decisão: aparecem como "a definir" enquanto os preços forem provisórios. */
export const aDefinir = {
  valorAcimaDaFranquia: null as string | null,
  avisoCancelamentoAnual: null as string | null,
};

/** Condomínios fundadores: enquanto houver vagas, o site mostra a linha do preço fundador. */
export const fundadores = { vagasAbertas: true, meses: 12 };

/** A franquia de comunicados por WhatsApp é confirmada na proposta; o site nunca diz "ilimitado". */
export const franquiaComunicados = "a confirmar na proposta";
export const armazenamentoGb = 10;
