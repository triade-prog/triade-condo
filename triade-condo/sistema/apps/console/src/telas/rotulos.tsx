// Selos e nomes usados em mais de uma tela do Console.

import { ESTAGIOS, FUNCOES_CONSOLE, SITUACOES } from "@triade/domain";
import { Selo } from "@triade/ui";

export function SeloEstagio({ estagio }: { estagio: string }) {
  return estagio === "ATIVO"
    ? <Selo tom="ok" marca="ok">{ESTAGIOS.ATIVO}</Selo>
    : <Selo tom="info" marca="andamento">{ESTAGIOS[estagio as keyof typeof ESTAGIOS] ?? estagio}</Selo>;
}

export function SeloSituacao({ situacao }: { situacao: string }) {
  return <Selo tom="atencao" marca="atencao">{SITUACOES[situacao as keyof typeof SITUACOES] ?? situacao}</Selo>;
}

export function nomeFuncao(f: string): string {
  return FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f;
}
