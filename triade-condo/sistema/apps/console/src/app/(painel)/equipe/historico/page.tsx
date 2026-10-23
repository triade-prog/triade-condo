import type { Metadata } from "next";
import { CabecaPagina } from "@/telas/comum";
import { ListaHistorico } from "@/telas/ListaHistorico";

export const metadata: Metadata = { title: "Histórico da equipe" };

export default function Pagina() {
  return (
    <div className="grid max-w-3xl gap-5">
      <CabecaPagina titulo="Histórico da equipe" apoio="Quem entrou, quem saiu e as funções revistas. Nada se apaga." />
      <ListaHistorico caminho="/v1/equipe/historico" />
    </div>
  );
}
