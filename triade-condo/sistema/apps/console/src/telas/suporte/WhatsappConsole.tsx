"use client";
// WhatsApp no menu do Console (passo 5; W-01, W-17, W-20): os números dos clientes e os modelos
// de mensagem, que são da TRÍADE e iguais para todos.

import { useState } from "react";
import { Abas } from "@triade/ui";
import { NumerosWhatsapp } from "./NumerosWhatsapp.tsx";
import { ModelosWhatsapp } from "./ModelosWhatsapp.tsx";

const ABAS = [
  { id: "numeros", texto: "Números" },
  { id: "modelos", texto: "Modelos de mensagem" },
] as const;

export function WhatsappConsole() {
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("numeros");
  return (
    <div className="grid gap-4">
      <h1 className="text-[28px] font-normal tracking-tight">WhatsApp</h1>
      <Abas abas={ABAS} atual={aba} aoMudar={setAba} rotulo="Partes do WhatsApp">
        {aba === "numeros" ? <NumerosWhatsapp /> : <ModelosWhatsapp />}
      </Abas>
    </div>
  );
}
