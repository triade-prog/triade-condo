"use client";
// No mural agora, no Início (CD-15; canvas do novo frontend, quadros 75 e 76): as três primeiras
// coisas do mural, na ordem em que o morador vê (enquetes abertas e depois os avisos, do mais novo
// ao mais antigo), com a hora da última conferida e as aberturas do link. "Ver o mural" abre a aba
// No mural. Com o mural desligado, o cartão diz isso e leva às Configurações.

import Link from "next/link";
import { ASSUNTOS_COMUNICADO, textoConferido } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar } from "@triade/ui";
import { CartaoInicio, LinhasInicio, type LinhaInicio } from "../CartaoInicio.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { prazoCurto } from "../vida/Enquetes.tsx";
import { ICONE_ASSUNTO } from "./comum.tsx";
import { useAgora, useMuralAoVivo } from "./muralAoVivo.ts";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function CartaoMural() {
  const vivo = useMuralAoVivo();
  const agora = useAgora();
  const d = vivo.estado === "pronto" ? vivo.dados : null;
  const m = d?.ligado ? d.mural : undefined;
  const ligado = !!m && !m.foraDoAr && !m.trocado;
  const enquetes = m?.enquetes ?? [];
  const avisos = m?.comunicados ?? [];
  const linhas: LinhaInicio[] = [
    ...enquetes.map((e) => ({ chave: e.id, icone: "grafico" as const, tom: "violeta" as const, titulo: `Enquete: ${e.pergunta}`, detalhe: `Aberta até ${prazoCurto(e.abertaAte)}` })),
    ...avisos.map((c) => ({ chave: c.id, icone: ICONE_ASSUNTO[c.assunto] ?? ("megafone" as const), tom: "neutro" as const, titulo: c.titulo,
      detalhe: `${ASSUNTOS_COMUNICADO[c.assunto]} · ${diaHora(c.publicadoEm)}` })),
  ].slice(0, 3);
  const conferido = vivo.estado === "pronto" ? (vivo.falhou ? "sem conexão agora" : textoConferido(vivo.conferidoEm, agora).replace(/^Conferido/, "conferido")) : "";
  const oQue = [enquetes.length ? plural(enquetes.length, "enquete", "enquetes") : "", avisos.length ? plural(avisos.length, "aviso", "avisos") : ""].filter(Boolean).join(" e ");
  const resumo = !d ? "Abrindo o mural…" : !ligado ? "Mural desligado" : `${oQue || "Nada no mural"} · ${conferido}`;

  return (
    <CartaoInicio titulo="No mural agora" icone="casa" href="/comunicados/no-mural" rotulo="Ver o mural" area={{ resumo, quantos: 0 }}>
      {vivo.estado === "carregando" ? <Carregando linhas={2} rotulo="Abrindo o mural…" /> : null}
      {vivo.estado === "erro" ? <ErroCarregar erro={vivo.erro} texto={vivo.texto} tentarDeNovo={vivo.conferir} oQue="o mural" /> : null}
      {d && !ligado ? (
        <div className="grid justify-items-start gap-2">
          <p>O mural está desligado. Quem abre o link vê que está fora do ar.</p>
          {d.pode.configurar ? <Link href="/configuracoes/mural" className={classeBotao("contorno", "", "m")}>Ligar o mural</Link> : null}
        </div>
      ) : null}
      {d && ligado ? (
        <>
          {linhas.length ? <LinhasInicio linhas={linhas} /> : <p className="t-apoio">Nenhum aviso no mural agora.</p>}
          <p className="t-apoio flex items-center gap-2">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${vivo.estado === "pronto" && vivo.falhou ? "bg-erro" : "bg-ok"}`} />
            {conferido.replace(/^./, (x) => x.toUpperCase())} · {plural(d.aberturas, "abertura", "aberturas")} em 7 dias
          </p>
        </>
      ) : null}
    </CartaoInicio>
  );
}
