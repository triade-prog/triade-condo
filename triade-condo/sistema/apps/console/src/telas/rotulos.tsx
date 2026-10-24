// Selos e nomes usados em mais de uma tela do Console.

import { ESTAGIOS, FUNCOES_CONSOLE, SITUACOES } from "@triade/domain";
import { Selo } from "@triade/ui";

export function SeloEstagio({ estagio }: { estagio: string }) {
  return estagio === "ATIVO"
    ? <Selo tom="ok">{ESTAGIOS.ATIVO}</Selo>
    : <Selo tom="andamento">{ESTAGIOS[estagio as keyof typeof ESTAGIOS] ?? estagio}</Selo>;
}

export function SeloSituacao({ situacao }: { situacao: string }) {
  // O teste perto do fim é aviso de agenda, não problema: vai em petróleo (quadro 242).
  return <Selo tom={situacao === "TESTE_TERMINANDO" ? "info" : "atencao"}>{SITUACOES[situacao as keyof typeof SITUACOES] ?? situacao}</Selo>;
}

export function nomeFuncao(f: string): string {
  return FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f;
}
