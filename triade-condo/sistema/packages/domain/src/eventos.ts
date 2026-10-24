// Como cada evento do histórico aparece para quem lê (PI-12): frase curta, sem termo técnico.
// Datas sempre no horário de Brasília.

import { CENARIOS, ESTAGIOS, FUNCOES_CONSOLE } from "./console.ts";
import { AGRUPAMENTOS, descreverEventoGaragem, MOTIVOS_ENCERRAMENTO } from "./moradores.ts";
import { FUSOS, mostrarDataSemHora, PERMISSOES, TIPOS_HORARIO } from "./plataforma.ts";
import { descreverEventoRelatorio } from "./relatorio.ts";
import { descreverEventoSuporte } from "./suporte.ts";
import { descreverEventoQueda } from "./whatsapp.ts";

export interface EventoHistorico {
  acao: string;
  entidade: string;
  dados: Record<string, unknown>;
  /** De quem o evento fala, quando é uma pessoa (histórico da equipe); o nome é o atual. */
  alvo?: { id: string; nome: string } | null;
}

const CAMPOS_FICHA: Record<string, string> = {
  nome: "nome",
  cidade: "cidade",
  uf: "UF",
  endereco: "endereço",
  numeroWhatsapp: "número institucional",
  contatos: "contatos",
};

const CAMPOS_VINCULO: Record<string, string> = {
  relacao: "relação",
  principal: "responsável",
  responsavel: "responsável",
  proprietario: "proprietário",
  mora: "mora na unidade",
  ligacao: "ligação",
  parentesco: "parentesco",
  ocupa_desde: "ocupa desde",
  recebe_comunicados: "comunicados",
};

function nomeDe<T extends Record<string, string>>(lista: T, codigo: unknown): string {
  return typeof codigo === "string" && codigo in lista ? lista[codigo as keyof T]! : String(codigo ?? "");
}

function listaDeFuncoes(v: unknown): string {
  return Array.isArray(v) ? v.map((f) => nomeDe(FUNCOES_CONSOLE, f)).join(", ") || "nenhuma" : "";
}

const ITENS: Record<string, string> = {
  "categoria.criada": "Categoria criada",
  "categoria.alterada": "Categoria alterada",
  "prioridade.criada": "Prioridade criada",
  "prioridade.alterada": "Prioridade alterada",
  "etapa.criada": "Etapa criada",
  "etapa.alterada": "Etapa alterada",
  "modelo.criado": "Modelo de resposta criado",
  "modelo.alterado": "Modelo de resposta alterado",
  "prazo.criado": "Exceção de prazo criada",
};

function listaDePermissoes(v: unknown): string {
  return Array.isArray(v) ? v.map((p) => nomeDe(PERMISSOES, p)).join(", ") || "só ver" : "";
}

export function descreverEvento(e: EventoHistorico): string {
  const d = e.dados ?? {};
  switch (e.acao) {
    case "condominio.cadastrado":
      return d.cenario ? `Condomínio cadastrado · ${nomeDe(CENARIOS, d.cenario)}` : "Condomínio cadastrado";
    case "ficha.alterada": {
      const campos = Array.isArray(d.campos) ? d.campos.map((c) => CAMPOS_FICHA[String(c)] ?? String(c)) : [];
      return campos.length ? `Ficha alterada: ${campos.join(", ")}` : "Ficha salva sem mudanças";
    }
    case "cenario.escolhido":
      return d.de ? `Cenário trocado: ${nomeDe(CENARIOS, d.de)} → ${nomeDe(CENARIOS, d.para)}` : `Cenário escolhido: ${nomeDe(CENARIOS, d.para)}`;
    case "contrato.alterado":
      return "Referência do contrato alterada";
    case "ia.chave": {
      const onde = d.cliente ? ` em ${String(d.cliente)}` : "";
      return d.ligada ? `IA ligada${onde}` : `IA desligada${onde}${d.motivo ? `. Motivo: ${String(d.motivo)}` : ""}`;
    }
    case "ia.ajuste": {
      const partes = [typeof d.limiteSugestoes === "number" && `${String(d.limiteSugestoes)} sugestões`, typeof d.limiteMinutos === "number" && `${String(d.limiteMinutos)} minutos de transcrição`,
        d.provedor && `provedor ${String(d.provedor)}`, d.modelo && `modelo ${String(d.modelo)}`].filter(Boolean);
      return partes.length ? `Limite da IA: ${partes.join(" · ")}` : "Limite da IA salvo sem mudanças";
    }
    case "ia.funcoes":
      return `Ajuda da IA: sugestão ${d.sugerir ? "ligada" : "desligada"} · transcrição ${d.transcrever ? "ligada" : "desligada"}`;
    case "estado.mudou": {
      if (e.entidade === "contatos_unidade") {
        if (d.para === "ENCERRADO") return d.motivo ? `Contato saiu da unidade · ${nomeDe(MOTIVOS_ENCERRAMENTO, d.motivo)}` : "Contato saiu da unidade";
        return d.para === "CONFIRMADO" ? "Contato confirmado na unidade" : "Contato incluído na unidade, a confirmar";
      }
      const texto = `Estágio: ${nomeDe(ESTAGIOS, d.de)} → ${nomeDe(ESTAGIOS, d.para)}`;
      if (!d.de) return `Cliente aberto em ${nomeDe(ESTAGIOS, d.para).toLowerCase()}`;
      return d.motivo ? `${texto}. Motivo: ${String(d.motivo)}` : texto;
    }
    case "sindico.convidado":
      return "Síndico convidado";
    case "nota.escrita":
      return "Nota interna escrita";
    case "equipe.atribuida":
      return `Pessoa da equipe atribuída · ${nomeDe(FUNCOES_CONSOLE, d.funcao)}`;
    case "equipe.atribuicao_retirada":
      return "Atribuição retirada";
    case "equipe.membro_cadastrado":
      return e.alvo?.nome
        ? `${e.alvo.nome} entrou na equipe · ${listaDeFuncoes(d.funcoes)}`
        : `Pessoa cadastrada na equipe · ${listaDeFuncoes(d.funcoes)}`;
    case "equipe.funcoes_alteradas":
      return e.alvo?.nome
        ? `Funções de ${e.alvo.nome} revistas · ${listaDeFuncoes(d.antes)} → ${listaDeFuncoes(d.depois)}`
        : `Funções revistas: ${listaDeFuncoes(d.antes)} → ${listaDeFuncoes(d.depois)}`;
    case "equipe.membro_desativado":
      return e.alvo?.nome ? `${e.alvo.nome} saiu da equipe` : "Pessoa desativada da equipe";
    case "fuso.alterado":
      return `Fuso: ${nomeDe(FUSOS, d.de)} → ${nomeDe(FUSOS, d.para)}`;
    case "horarios.alterados":
      return `Horário de ${nomeDe(TIPOS_HORARIO, d.tipo).toLowerCase()} alterado`;
    case "feriado.incluido":
      return `Feriado incluído: ${mostrarDataSemHora(String(d.data))}`;
    case "feriado.removido":
      return `Feriado retirado: ${mostrarDataSemHora(String(d.data))}`;
    case "categoria.criada":
    case "prioridade.criada":
    case "etapa.criada":
    case "modelo.criado":
    case "prazo.criado":
    case "categoria.alterada":
    case "prioridade.alterada":
    case "etapa.alterada":
    case "modelo.alterado":
      return ITENS[e.acao]!;
    case "prazo.alterado":
      return `Prazo alterado: ${String(d.de)} h → ${String(d.para)} h`;
    case "prazo.removido":
      return "Exceção de prazo retirada";
    case "pessoa.autorizada":
      return `Pessoa autorizada · ${listaDePermissoes(d.permissoes)}`;
    case "pessoa.alterada":
      return `Permissões revistas: ${listaDePermissoes(d.antes)} → ${listaDePermissoes(d.depois)}`;
    case "pessoa.revogada":
      return d.pendente ? "Acesso revogado · responsável padrão ficou pendente" : "Acesso revogado";
    case "pessoa.repasse":
      return descreverRepasse(d);
    case "atendimento.alterado":
      return "Responsáveis pelo atendimento alterados";
    case "estrutura.alterada":
      return `Organização do prédio: ${nomeDe(Object.fromEntries(Object.entries(AGRUPAMENTOS).map(([k, v]) => [k, v.nome])), d.agrupamento)}${d.usa_andar ? ", com andares" : ", sem andares"}`;
    case "bloco.criado":
      return "Bloco criado";
    case "bloco.alterado":
      return "Bloco alterado";
    case "unidades.incluidas":
      return d.quantidade === 1 ? "1 unidade incluída" : `${String(d.quantidade)} unidades incluídas`;
    case "unidade.alterada":
      return "Unidade alterada";
    case "unidade.situacao_mudou": {
      const marcas = [d.aVenda ? "à venda" : null, d.paraAlugar ? "para alugar" : null].filter(Boolean);
      return marcas.length ? `Unidade marcada ${marcas.join(" e ")}` : "Unidade sem marca de venda ou aluguel";
    }
    case "contato.criado":
      return "Contato cadastrado";
    case "contato.alterado":
      return "Contato corrigido";
    case "contato.dados_removidos":
      return "Dados pessoais do contato removidos";
    // Família e pets da unidade (F3.9): sem o nome no registro geral.
    case "unidade.familiar_incluido":
      return "Familiar incluído na unidade";
    case "unidade.familiar_alterado":
      return "Familiar alterado";
    case "unidade.familiar_saiu":
      return "Familiar saiu da unidade";
    case "unidade.familiar_apagado":
      return "Familiar retirado (cadastrado por engano)";
    case "unidade.pet_incluido":
      return "Pet incluído na unidade";
    case "unidade.pet_alterado":
      return "Pet alterado";
    case "unidade.pet_saiu":
      return "Pet saiu da unidade";
    case "unidade.pet_apagado":
      return "Pet retirado (cadastrado por engano)";
    case "vinculo_unidade.alterado": {
      const campos = Array.isArray(d.campos) ? d.campos.map((c) => CAMPOS_VINCULO[String(c)] ?? String(c)) : [];
      return campos.length ? `Vínculo alterado: ${campos.join(", ")}` : "Vínculo alterado";
    }
    case "vinculos.convertidos":
      return `Vínculos passaram a ter proprietário, responsável e mora na unidade (${String(d.quantidade)})`;
    case "mudanca.registrada":
      return `Mudança registrada em ${mostrarDataSemHora(String(d.data))}: ${String(d.saem)} saíram, ${String(d.entram)} entraram`;
    case "regras_aviso.alteradas":
      return `Regras de aviso: síndico depois de ${String(d.sindico_horas)} h, ${d.com_substituto ? `substituto depois de ${String(d.substituto_horas)} h` : "sem substituto"}`;
    case "parecidos.alterados":
      return `Pedidos parecidos: procurar nos últimos ${String(d.depois)} dias (antes ${String(d.antes)})`;
    case "moradores.importados":
      return `Planilha importada: ${String(d.vinculos)} contatos a confirmar`;
    default:
      return descreverEventoSuporte(e.acao, d) ?? descreverEventoGaragem(e.acao, d) ?? descreverEventoQueda(e.acao, d) ?? descreverEventoRelatorio(e.acao, d) ?? e.acao;
  }
}

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** 16/10/2026 14:05, no horário de Brasília. */
export function formatarDataHora(iso: string): string {
  return FORMATO_DATA_HORA.format(new Date(iso)).replace(",", "");
}

export function formatarData(iso: string): string {
  return FORMATO_DATA.format(new Date(iso));
}

/** +5561999990001 → +55 61 99999-0001 (só para mostrar). */
export function mostrarTelefone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : e164;
}

/** O que passou para quem assumiu ao revogar o acesso (0297; CF-05, MP-01). Sem nomes: o histórico guarda só ids. */
function descreverRepasse(d: Record<string, unknown>): string {
  const n = (v: unknown) => Number(v ?? 0);
  const plural = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
  const partes: string[] = [];
  const p = d.pedidos as { para?: string | null; quantidade?: number } | undefined;
  if (p && n(p.quantidade) > 0) {
    partes.push(p.para
      ? `${plural(n(p.quantidade), "pedido passou", "pedidos passaram")} para quem assumiu`
      : `${plural(n(p.quantidade), "pedido ficou", "pedidos ficaram")} na fila sem responsável`);
  }
  const m = d.manutencoes as { quantidade?: number; preventivas?: number } | undefined;
  if (m && n(m.quantidade) + n(m.preventivas) > 0) {
    const itens = [n(m.quantidade) ? plural(n(m.quantidade), "manutenção", "manutenções") : null,
      n(m.preventivas) ? plural(n(m.preventivas), "preventiva", "preventivas") : null].filter(Boolean);
    partes.push(`${itens.join(" e ")} com quem assumiu`);
  }
  return partes.length ? `Repasse ao revogar · ${partes.join(" · ")}` : "Repasse ao revogar · nada em aberto";
}
