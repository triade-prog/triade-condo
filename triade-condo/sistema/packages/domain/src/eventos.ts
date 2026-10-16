// Como cada evento do histórico aparece para quem lê (PI-12): frase curta, sem termo técnico.
// Datas sempre no horário de Brasília.

import { CENARIOS, ESTAGIOS, FUNCOES_CONSOLE } from "./console.ts";

export interface EventoHistorico {
  acao: string;
  entidade: string;
  dados: Record<string, unknown>;
}

const CAMPOS_FICHA: Record<string, string> = {
  nome: "nome",
  cidade: "cidade",
  uf: "UF",
  endereco: "endereço",
  numeroWhatsapp: "número institucional",
  contatos: "contatos",
};

function nomeDe<T extends Record<string, string>>(lista: T, codigo: unknown): string {
  return typeof codigo === "string" && codigo in lista ? lista[codigo as keyof T]! : String(codigo ?? "");
}

function listaDeFuncoes(v: unknown): string {
  return Array.isArray(v) ? v.map((f) => nomeDe(FUNCOES_CONSOLE, f)).join(", ") || "nenhuma" : "";
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
    case "estado.mudou": {
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
      return `Pessoa cadastrada na equipe · ${listaDeFuncoes(d.funcoes)}`;
    case "equipe.funcoes_alteradas":
      return `Funções revistas: ${listaDeFuncoes(d.antes)} → ${listaDeFuncoes(d.depois)}`;
    case "equipe.membro_desativado":
      return "Pessoa desativada da equipe";
    default:
      return e.acao;
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
