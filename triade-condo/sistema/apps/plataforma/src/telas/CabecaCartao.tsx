// Cabeça dos cartões do Início (coerência das telas, Entrega 1; V-08, PT-10): o título e, no
// canto, o mesmo link em todo cartão para a tela inteira. O link fica fora do título, para o
// título ser só o nome do cartão; o nome para leitor de tela diz de qual cartão é.

import Link from "next/link";
import { classeBotao } from "@triade/ui";

export function CabecaCartao({ id, titulo, href, rotulo = "Ver tudo" }: { id: string; titulo: string; href: string; rotulo?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className="text-lg font-medium">{titulo}</h2>
      <Link href={href} className={classeBotao("discreto", "", "m")} aria-label={rotulo === "Ver tudo" ? `Ver tudo de ${titulo}` : undefined}>{rotulo}</Link>
    </div>
  );
}
