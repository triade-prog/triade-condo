// Log das funções (PT-13): uma linha JSON, já sem senha, token nem dado pessoal.
import { linhaDeLog } from "@triade/domain";

export function registrar(nivel: "info" | "aviso" | "erro", dados: Record<string, unknown>): void {
  const linha = linhaDeLog(nivel, dados);
  if (nivel === "erro") console.error(linha);
  else if (nivel === "aviso") console.warn(linha);
  else console.log(linha);
}
