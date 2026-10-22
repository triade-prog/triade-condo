// Oferta comercial mostrada no site: preços, faixas, franquias e implantação.
// Valores PROVISÓRIOS: seguem a decisão da precificação (NG-02 a NG-07, NG-15 a NG-17).
// Quando a Carolina decidir, troque aqui e ponha `precosProvisorios` em false.

export const precosProvisorios = true;

export type Faixa = {
  id: string;
  rotulo: string;
  /** Rótulo curto, usado no formulário de demonstração. */
  curto: string;
  mensal: number;
  implantacao: number;
  implantacaoInclui: string;
  /** Comunicados por WhatsApp incluídos por mês (cada unidade que recebe conta uma vez). */
  franquiaComunicados: number;
  destaque?: boolean;
};

export const faixas: Faixa[] = [
  { id: "ate-40", rotulo: "Até 40 unidades", curto: "Até 40", mensal: 199, implantacao: 600, implantacaoInclui: "Cadastro de unidades e moradores, 1 treinamento online", franquiaComunicados: 200 },
  { id: "41-100", rotulo: "41 a 100 unidades", curto: "41 a 100", mensal: 349, implantacao: 900, implantacaoInclui: "+ importação de documentos e prestadores", franquiaComunicados: 500, destaque: true },
  { id: "101-200", rotulo: "101 a 200 unidades", curto: "101 a 200", mensal: 549, implantacao: 1400, implantacaoInclui: "+ 2 treinamentos (equipe e conselho)", franquiaComunicados: 1000 },
  { id: "201-400", rotulo: "201 a 400 unidades", curto: "201 a 400", mensal: 849, implantacao: 2000, implantacaoInclui: "+ acompanhamento das 4 primeiras semanas", franquiaComunicados: 2000 },
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

export const descontoSindicoProfissional = 15;
export const armazenamentoGb = 10;
