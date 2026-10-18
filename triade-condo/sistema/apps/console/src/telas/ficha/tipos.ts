// O que a API do Console devolve na ficha do cliente (console_ficha).

export interface Contato {
  nome: string;
  papel: string;
  telefone?: string;
  email?: string;
}

export interface Ficha {
  condominio: {
    id: string;
    nome: string;
    cidade: string | null;
    uf: string | null;
    endereco: string | null;
    numeroWhatsapp: string | null;
    contatos: Contato[];
    cenario: string | null;
    versao: number;
    criadoEm: string;
  };
  cliente: { estagio: string; referenciaContrato: string | null; versao: number };
  sindicos: { vinculoId: string; pessoaId: string; nome: string; desde: string }[];
  equipe: { vinculoId: string; pessoaId: string; nome: string; funcao: string; desde: string; versao: number }[];
  situacoes: string[];
  /** Exportações que o síndico pediu (peça R10, CT-04): a TRÍADE fica sabendo. */
  exportacoes?: { id: string; situacao: "MONTANDO" | "PRONTA" | "FALHOU"; pedidaEm: string; autor?: string; prontaEm?: string }[];
  permissoes: string[];
}

/** Recado no topo da ficha depois de uma ação (salvo, convite enviado...). */
export type Recado = { tom: "ok" | "info"; texto: string } | null;

export interface PropsAba {
  ficha: Ficha;
  pode: (acao: string) => boolean;
  recarregar: () => void;
  avisar: (r: Recado) => void;
}
