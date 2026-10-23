"use client";
// Parte Pessoas da ficha (CF-02, CT-01, PI-10; DC15, tela-modelo console-ficha-pessoas-computador;
// rodada Console, decisão A.1 de 23/10/2026): o síndico e a equipe TRÍADE neste cliente, cada um
// num cartão. Antes eram as abas Síndico e Equipe.

import { CartaoEquipe } from "./AbaEquipe.tsx";
import { CartaoSindico } from "./AbaSindico.tsx";
import type { PropsAba } from "./tipos.ts";

export function AbaPessoas(props: PropsAba) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <CartaoSindico {...props} />
      <CartaoEquipe {...props} />
    </div>
  );
}
