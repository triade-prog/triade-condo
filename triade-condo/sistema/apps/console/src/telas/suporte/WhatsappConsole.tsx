"use client";
// WhatsApp no menu do Console (passo 5; W-01, W-17, W-20; DC15, tela-modelo
// console-whatsapp-computador, rodada Console de 23/10/2026): os números dos clientes e os modelos
// de mensagem, que são da TRÍADE e iguais para todos, em duas vistas num trilho.

import { useState } from "react";
import { CabecaPagina } from "../comum.tsx";
import { TrilhoFiltro } from "../ListaHistorico.tsx";
import { NumerosWhatsapp } from "./NumerosWhatsapp.tsx";
import { ModelosWhatsapp } from "./ModelosWhatsapp.tsx";

const VISTAS = [
  { valor: "numeros", texto: "Números" },
  { valor: "modelos", texto: "Modelos de mensagem" },
] as const;

export function WhatsappConsole() {
  const [vista, setVista] = useState<(typeof VISTAS)[number]["valor"]>("numeros");
  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="WhatsApp" apoio="Os números dos condomínios e os modelos de mensagem aprovados." />
      <span><TrilhoFiltro rotulo="Partes do WhatsApp" opcoes={[...VISTAS]} atual={vista} aoMudar={setVista} /></span>
      {vista === "numeros" ? <NumerosWhatsapp /> : <ModelosWhatsapp />}
    </div>
  );
}
