import type { Metadata } from "next";
import { ListaHistorico } from "@/telas/ListaHistorico";

export const metadata: Metadata = { title: "Histórico da equipe" };

export default function Pagina() {
  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico da equipe</h1>
        <p className="text-tinta-suave">Quem entrou, quem saiu e as funções revistas. Nada se apaga.</p>
      </div>
      <ListaHistorico caminho="/v1/equipe/historico" />
    </div>
  );
}
