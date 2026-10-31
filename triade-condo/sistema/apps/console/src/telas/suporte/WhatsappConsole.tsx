"use client";
// WhatsApp no menu do Console (passo 5; W-01, W-17, W-20; DC15, tela-modelo
// console-whatsapp-computador, rodada Console de 23/10/2026): os números dos clientes e os modelos
// de mensagem, que são da TRÍADE e iguais para todos, em vistas num trilho. As contas que chegam
// da Meta sem condomínio esperam ligar a um cliente (F5.12, quadro 463). É o plano B (quadro 469):
// o síndico liga o número pela janela da Meta, então a vista só aparece no trilho quando há conta
// esperando (e fica enquanto está aberta, para mostrar a que acabou de ser ligada).

import { useState } from "react";
import { CabecaPagina } from "../comum.tsx";
import { TrilhoFiltro } from "../ListaHistorico.tsx";
import { NumerosWhatsapp } from "./NumerosWhatsapp.tsx";
import { ModelosWhatsapp } from "./ModelosWhatsapp.tsx";
import { ContasMeta, type ContasMetaDados } from "./ContasMeta.tsx";
import { useCarregar } from "../sessao.tsx";

type Vista = "numeros" | "contas" | "modelos";

export function WhatsappConsole() {
  const [vista, setVista] = useState<Vista>("numeros");
  const contas = useCarregar<ContasMetaDados>("/v1/whatsapp/meta/contas");
  const esperando = contas.estado === "pronto" ? contas.dados.esperando.length : 0;
  const vistas: { valor: Vista; texto: string }[] = [
    { valor: "numeros", texto: "Números" },
    ...(esperando || vista === "contas"
      ? [{ valor: "contas" as const, texto: esperando ? `Contas recebidas da Meta (${esperando})` : "Contas recebidas da Meta" }] : []),
    { valor: "modelos", texto: "Modelos de mensagem" },
  ];
  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="WhatsApp" apoio={esperando ? "Os números dos condomínios, as contas que chegam da Meta e os modelos de mensagem." : "Os números dos condomínios e os modelos de mensagem."} />
      <span><TrilhoFiltro rotulo="Partes do WhatsApp" opcoes={vistas} atual={vista} aoMudar={setVista} /></span>
      {vista === "numeros" ? <NumerosWhatsapp /> : vista === "contas" ? <ContasMeta carga={contas} /> : <ModelosWhatsapp />}
    </div>
  );
}
