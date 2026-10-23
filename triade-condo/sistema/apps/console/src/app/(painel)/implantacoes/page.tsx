import { redirect } from "next/navigation";

// Implantações saiu do menu (decisão C.1 da rodada Console, 23/10/2026): virou o filtro Em
// implantação da carteira, com a barra de etapas. O endereço antigo leva até ele.
export default function Pagina() {
  redirect("/clientes?filtro=implantacao");
}
