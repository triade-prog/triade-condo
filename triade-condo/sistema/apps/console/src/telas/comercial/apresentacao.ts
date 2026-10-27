// A proposta como apresentação (R17.8, CM-34; quadros 450 a 457, versão 2, aprovados pela Carolina
// em 26/10/2026 a partir do PDF de redesign dela): quatro partes, iguais no link e no PDF. Capa (o
// problema, o exemplo de um pedido e o preço), investimento (a Tabela de preços inteira, guardada na
// versão), escopo e equipe, condições e aceite (com o QR code do link no PDF). Aqui só se monta o
// texto a partir do que a versão guardou (0312); a tela (ApresentacaoProposta.tsx) e a folha
// (pdfApresentacao.ts) desenham a mesma coisa. Nada é cobrado à parte: os itens à parte só entram
// depois das decisões de preço S1 a S5, e sempre com preço.

import { ESCOPO_INCLUIDO, ESCOPO_NAO_INCLUIDO, custoNaTaxa, mostrarDataSemHora, mostrarValor, taxaTexto } from "@triade/domain";
import { percentual, textoImpressao, type ConteudoSindico } from "./propostas.ts";

// ---------------------------------------------------------------------------------------------
// O que a versão guarda (0312): campo ausente é nulo (o banco tira os nulos).

export interface FaixaGuardada {
  codigo: string; nome: string; de: number; ate?: number; sobConsulta: boolean; fundador?: number; cheia?: number; implantacao?: number;
}
export interface ApresentacaoGuardada {
  tabela?: { em: string; mesesPagos?: number; parcelas?: number; vagasFundador?: number; faixas: FaixaGuardada[] };
  equipe?: { comercial?: { nome: string; email?: string }; implantacao?: { nome: string } };
  escopo?: { incluido: { titulo: string; texto: string }[]; naoIncluido: string[] };
  condicoes?: { cancelamentoDias?: number; avisoReajusteDias?: number; indice?: string };
}

// ---------------------------------------------------------------------------------------------
// Textos fixos do desenho aprovado.

export const TITULO_CAPA = "Menos pedidos sem retorno. Cada pedido com dono e prazo.";
export const SUB_CAPA = "Pedidos, comunicados e manutenção em um só lugar, com responsável, prazo e retorno visíveis.";
export const ACOMPANHAMENTO = [
  { titulo: "Pedido registrado", texto: "Solicitação recebida, com protocolo" },
  { titulo: "Responsável definido", texto: "Quem cuida da demanda" },
  { titulo: "Próximo retorno", texto: "Data marcada para a próxima notícia" },
  { titulo: "Conclusão registrada", texto: "Explicada e guardada no histórico" },
] as const;
export const PASSOS = [
  { titulo: "Aceite on-line", texto: "Nome, CPF e cargo pelo link. O aceite ainda não é o contrato." },
  { titulo: "CNPJ e ata", texto: "Envie o CNPJ e a ata da eleição, com o período do mandato." },
  { titulo: "Contrato digital", texto: "Assinatura gratuita com a conta gov.br, no mesmo arquivo da TRÍADE." },
  { titulo: "Implantação", texto: "Reunião no condomínio e configuração inicial, em data combinada." },
] as const;
export const PARTES = [
  { id: "investimento", olho: "Investimento", titulo: "Investimento transparente." },
  { id: "escopo", olho: "Escopo da solução", titulo: "O que está incluído." },
  { id: "condicoes", olho: "Condições e próximos passos", titulo: "Condições simples. Próximos passos claros." },
] as const;
export const SUB_ESCOPO = "Tudo o que faz parte da mensalidade fica claro desde o início. E o que não está incluído também.";
export const NADA_A_PARTE = ["Nada é cobrado à parte nesta proposta.", "O que não está aqui não é cobrado."] as const;
export const TEXTO_ETAPAS = "Aceite da proposta e assinatura do contrato são etapas distintas.";
export const EQUIPE_COMERCIAL = "Equipe comercial da TRÍADE";
export const EQUIPE_IMPLANTACAO = "Equipe de implantação da TRÍADE";

// ---------------------------------------------------------------------------------------------
// A apresentação montada.

export type IconeContato = "whats" | "email" | "predio" | "agenda";
export interface Contato { iniciais: string; nome: string; papel: string; linhas: { icone: IconeContato; texto: string }[] }
export interface LinhaTabela { faixa: string; valores: string[]; seu: boolean }

export interface Apresentacao {
  numero: number;
  condominio: string;
  /** "Residencial Cerrado / Brasília (DF)". */
  olhoCapa: string;
  /** "Aos cuidados de Lúcia Prado · Brasília (DF) · 72 unidades". */
  para: string;
  rotuloCondicao: string;
  preco: { rotulo: string; valor: string; porAp?: string; taxa?: string; implantacao?: string };
  garantia: { titulo: string; validade: string };
  investimento: {
    sub: string;
    seu: { rotulo: string; valor: string; texto?: string; lado?: { olho: string; titulo: string; sub: string; depois?: string } };
    tabela?: { data: string; cabecalho: string[]; linhas: LinhaTabela[] };
    considerado: string;
    nota?: string;
  };
  escopo: { incluido: { titulo: string; texto?: string }[]; naoIncluido: string[]; planejado: string };
  contatos: [Contato, Contato];
  condicoes: { titulo: string; texto: string }[];
  /** O endereço do link, para o QR code e o "Acesse a proposta"; sem ele, o PDF diz para usar o link recebido. */
  endereco?: string;
  impressao: string;
}

const brl = (c?: number) => mostrarValor(c ?? null);
const dataCurta = (d?: string) => (d ? mostrarDataSemHora(d.slice(0, 10)) : "");
const lugar = (c: { cidade?: string; uf?: string }) => (c.cidade && c.uf ? `${c.cidade} (${c.uf})` : c.cidade ?? c.uf ?? "");

/** "Bianca Rocha" → "BR"; "Carolina" → "CA"; a equipe sem nome → "TR". */
export function iniciais(nome: string): string {
  if (nome.startsWith("Equipe ")) return "TR";
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p[0]![0]! + p[p.length - 1]![0]! : (p[0] ?? "").slice(0, 2)).toUpperCase();
}

/** 5561999990410 → "(61) 9 9999-0410". */
export function whatsTexto(d: string): string {
  const n = d.replace(/\D/g, "").replace(/^55/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n[2]} ${n.slice(3, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d;
}

/** "41 a 100 unidades" → "41 a 100", como na tabela do desenho. */
const nomeCurto = (f: FaixaGuardada) => f.nome.replace(/ unidades$/, "");

/** A conta do anual: o valor do mês vezes os meses pagos (12 por 11). */
const anualDe = (c: ConteudoSindico) => c.anual ?? (c.mensal !== undefined ? c.mensal * (c.mesesPagos ?? 11) : undefined);

function tabelaDe(c: ConteudoSindico, a: ApresentacaoGuardada): Apresentacao["investimento"]["tabela"] {
  const t = a.tabela;
  if (!t?.faixas.length) return undefined;
  const fundador = c.tabela === "FUNDADOR";
  const cabecalho = ["Unidades", ...(fundador ? ["Fundador"] : []), "Tabela cheia", "Implantação"];
  const linhas = t.faixas.map((f) => {
    const seu = f.codigo === c.faixa;
    const sob = "Sob consulta";
    let implantacao = f.sobConsulta ? sob : brl(f.implantacao);
    if (seu && !f.sobConsulta && c.implantacaoSemCusto) implantacao = c.ciclo === "ANUAL" ? "Isenta no anual" : "Sem custo no fundador";
    return { faixa: nomeCurto(f), seu, valores: [...(fundador ? [f.sobConsulta ? sob : brl(f.fundador)] : []), f.sobConsulta ? sob : brl(f.cheia), implantacao] };
  });
  return { data: `Valores mensais em R$ · tabela de ${dataCurta(t.em)}`, cabecalho, linhas };
}

/** O texto de "O que está considerado neste valor", pela tabela e pelo ciclo da versão. */
function consideradoDe(c: ConteudoSindico, a: ApresentacaoGuardada): string {
  const meses = c.mesesPagos ?? a.tabela?.mesesPagos ?? 11;
  const parcelas = c.implantacaoParcelas ?? a.tabela?.parcelas;
  const desconto = c.desconto ? ` Com desconto de ${percentual(c.desconto)} na mensalidade, aprovado.` : "";
  if (c.tabela === "MANUAL") {
    const impl = c.implantacao ? ` A implantação é de ${brl(c.implantacao)}${parcelas && parcelas > 1 && c.ciclo === "MENSAL" ? `, em até ${parcelas} vezes` : ""}.`
      : c.implantacaoSemCusto ? " A implantação é sem custo." : "";
    return `Acima de 400 unidades, o valor é combinado com a equipe da TRÍADE e aprovado pela Administração.${impl}${desconto}`;
  }
  if (c.tabela === "FUNDADOR") {
    const vagas = a.tabela?.vagasFundador ? `, para os ${a.tabela.vagasFundador} primeiros condomínios` : "";
    return `Implantação sem custo no preço de fundador, que vale só no pagamento mensal${vagas}, garantido por ${c.fundadorMeses ?? 12} meses. `
      + `Depois, vale a tabela cheia de ${brl(c.depoisFundador)}, com o reajuste do contrato. `
      + `No anual, a tabela cheia sai por 12 meses pelo preço de ${meses} e a implantação é isenta.${desconto}`;
  }
  if (c.ciclo === "ANUAL") {
    return `Tabela cheia no pagamento anual: 12 meses pelo preço de ${meses}, ${brl(anualDe(c))} por ano, e a implantação é isenta.${desconto}`;
  }
  const impl = c.implantacao ? `A implantação é de ${brl(c.implantacao)}${parcelas && parcelas > 1 ? `, em até ${parcelas} vezes` : ""}. ` : "";
  return `Tabela cheia no pagamento mensal. ${impl}No anual, são 12 meses pelo preço de ${meses} e a implantação é isenta.${desconto}`;
}

/**
 * A proposta (o que o síndico pode ver, ConteudoSindico) → a apresentação. `whatsapp` é o WhatsApp
 * comercial da TRÍADE (o mesmo do site); `endereco`, o link desta versão, quando se sabe.
 */
export function montarApresentacao(c: ConteudoSindico, opcoes: { whatsapp?: string; endereco?: string } = {}): Apresentacao {
  const a: ApresentacaoGuardada = c.apresentacao ?? {};
  const unidades = c.unidades ? `${c.unidades} unidades` : null;
  const onde = lugar(c);
  const fundador = c.tabela === "FUNDADOR";
  const anual = c.ciclo === "ANUAL";
  const custo = c.porApartamento !== undefined ? custoNaTaxa(c.porApartamento, c.taxaCondominio ?? null) : null;
  const taxa = custo?.cerca && custo.taxa !== null ? `${custo.cerca} da taxa média de ${taxaTexto(custo.taxa)}` : undefined;
  const porAp = c.porApartamento !== undefined ? brl(c.porApartamento) : undefined;
  const parcelas = c.implantacaoParcelas ?? a.tabela?.parcelas;
  const implantacao = c.implantacaoSemCusto ? (anual ? "Implantação isenta no anual" : "Implantação sem custo")
    : c.implantacao ? `Implantação de ${brl(c.implantacao)}${parcelas && parcelas > 1 && !anual ? ` em até ${parcelas} vezes` : ""}` : undefined;
  const rotulo = c.tabela === "MANUAL" ? "Valor mensal combinado" : fundador ? "Valor mensal de fundador" : anual ? "Valor mensal, pago no anual" : "Valor mensal";
  const meses = c.mesesPagos ?? a.tabela?.mesesPagos ?? 11;
  const validade = c.validoAte ? `Válida até ${dataCurta(c.validoAte)}` : `Validade de ${c.validadeDias ?? 15} dias, contada do envio`;
  const garantia = fundador ? `${c.fundadorMeses ?? 12} meses de preço garantido` : anual ? `12 meses pelo preço de ${meses}`
    : c.tabela === "MANUAL" ? "Valor combinado para o seu prédio" : "Mensalidade fixa, sem prazo mínimo";

  const lado = fundador
    ? { olho: "Condição especial", titulo: `${c.fundadorMeses ?? 12} meses`, sub: "com preço garantido", depois: c.depoisFundador ? `Depois: ${brl(c.depoisFundador)} por mês` : undefined }
    : anual && anualDe(c) !== undefined ? { olho: "Pagamento anual", titulo: `12 por ${meses}`, sub: `${brl(anualDe(c))} por ano`, depois: "Implantação isenta" }
    : c.implantacao ? { olho: "Implantação", titulo: brl(c.implantacao), sub: parcelas && parcelas > 1 ? `em até ${parcelas} vezes` : "uma vez" } : undefined;
  const textoSeu = porAp ? (taxa ? `${porAp} por apartamento, ${taxa} que o prédio informou.` : `Cerca de ${porAp} por apartamento.`) : undefined;

  const reajuste = `Reajuste anual pelo ${a.condicoes?.indice ?? "índice do contrato"}, com aviso de ${a.condicoes?.avisoReajusteDias ?? 30} dias antes.`;
  const nomeComercial = a.equipe?.comercial?.nome ?? EQUIPE_COMERCIAL;
  const nomeImplantacao = a.equipe?.implantacao?.nome ?? EQUIPE_IMPLANTACAO;
  const comercial: Contato = {
    iniciais: iniciais(nomeComercial), nome: nomeComercial, papel: "Proposta e atendimento comercial",
    linhas: [
      ...(opcoes.whatsapp ? [{ icone: "whats" as const, texto: `${whatsTexto(opcoes.whatsapp)} · WhatsApp` }] : []),
      ...(a.equipe?.comercial?.email ? [{ icone: "email" as const, texto: a.equipe.comercial.email }] : []),
    ],
  };
  const implantador: Contato = {
    iniciais: iniciais(nomeImplantacao), nome: nomeImplantacao, papel: "Implantação e configuração",
    linhas: [{ icone: "predio", texto: "Reunião presencial no prédio" }, { icone: "agenda", texto: "Data combinada após a assinatura" }],
  };

  return {
    numero: c.numero,
    condominio: c.condominio,
    olhoCapa: [c.condominio, onde].filter(Boolean).join(" / "),
    para: [c.aosCuidados ? `Aos cuidados de ${c.aosCuidados}` : null, onde || null, unidades].filter(Boolean).join(" · "),
    rotuloCondicao: unidades ? `Uma condição pensada para ${unidades}` : "Uma condição pensada para o seu prédio",
    preco: { rotulo, valor: brl(c.mensal), porAp, taxa: anual && !fundador && anualDe(c) !== undefined ? `12 meses pelo preço de ${meses}: ${brl(anualDe(c))} por ano` : taxa, implantacao },
    garantia: { titulo: garantia, validade },
    investimento: {
      sub: fundador ? "Uma mensalidade fixa pelo tamanho do condomínio, sem cobrança pela implantação no preço de fundador."
        : anual ? "Uma mensalidade fixa pelo tamanho do condomínio, com a implantação isenta no pagamento anual."
        : "Uma mensalidade fixa pelo tamanho do condomínio.",
      seu: { rotulo: unidades ? `Seu condomínio / ${unidades}` : "Seu condomínio", valor: brl(c.mensal), texto: textoSeu, lado },
      tabela: tabelaDe(c, a),
      considerado: consideradoDe(c, a),
      nota: porAp && c.unidades ? `Estimativa por apartamento: ${brl(c.mensal)} ÷ ${c.unidades} unidades. Não representa economia prometida.` : undefined,
    },
    escopo: {
      incluido: a.escopo?.incluido ?? (c.incluido.length ? c.incluido.map((titulo) => ({ titulo })) : ESCOPO_INCLUIDO.map((i) => ({ ...i }))),
      naoIncluido: a.escopo?.naoIncluido ?? (c.apresentacao ? [...ESCOPO_NAO_INCLUIDO] : []),
      planejado: `Em planejamento: ${juntar(c.planejado.map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p)))}. Sem data de lançamento prometida.`,
    },
    contatos: [comercial, implantador],
    condicoes: [
      { titulo: "Prazo e cancelamento", texto: `Sem prazo mínimo. Cancelamento com ${a.condicoes?.cancelamentoDias ?? 30} dias de aviso, sem multa.` },
      { titulo: "Preço e reajuste", texto: fundador
        ? `Preço de fundador por ${c.fundadorMeses ?? 12} meses.${c.depoisFundador ? ` Depois, ${brl(c.depoisFundador)} por mês.` : ""} ${reajuste}` : reajuste },
      { titulo: "Seus dados", texto: "O condomínio é o dono dos dados. Na saída, a TRÍADE entrega tudo exportado." },
      { titulo: "Validade da proposta", texto: c.validoAte
        ? `Aceite até ${dataCurta(c.validoAte)} (versão v${c.numero}). Depois dessa data, os valores são confirmados de novo.`
        : `Aceite em até ${c.validadeDias ?? 15} dias depois do envio (versão v${c.numero}). Depois disso, os valores são confirmados de novo.` },
    ],
    endereco: opcoes.endereco,
    impressao: textoImpressao(c.numero, c.hash),
  };
}

/** ["WhatsApp oficial", "inteligência artificial"] → "WhatsApp oficial e inteligência artificial". */
function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** O endereço sem "https://", como no desenho: "t3condo.trihub.com.br/o/7K2Q-PX9M". */
export const enderecoCurto = (e: string) => e.replace(/^https?:\/\//, "");

