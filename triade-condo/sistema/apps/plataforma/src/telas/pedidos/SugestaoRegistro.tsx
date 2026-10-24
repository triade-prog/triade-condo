"use client";
// Sugestão automática no registro (IA-17, IA-15; telas-modelo/ia-registrar-computador): aparece em
// Como tratar depois que o relato tem algumas palavras e muda se o relato mudar. Nada é preenchido
// sozinho: "Usar a sugestão" preenche categoria, prioridade e local de uma vez, e cada um ainda pode
// ser trocado antes de registrar. O registro guarda se a escolha veio da sugestão.

import { useEffect, useState } from "react";
import { diaDeRenovar } from "@triade/domain";
import { Botao, chamarApi, Icone, IconeMarca, Selo } from "@triade/ui";
import { Esqueleto, type SugestaoDoPedido } from "./SugestaoIa.tsx";

/** O relato tem o bastante para sugerir: 15 letras e três palavras. */
const relatoBasta = (t: string) => t.trim().length >= 15 && t.trim().split(/\s+/).length >= 3;

/** Pede a sugestão um pouco depois de a pessoa parar de escrever; o mesmo relato não pede de novo. */
export function useSugestaoRegistro(dados: { assunto: string; relato: string; unidadeId: string | null }) {
  const [s, setS] = useState<{ chave: string; sugestao: SugestaoDoPedido | null; preparando: boolean } | null>(null);
  const chave = JSON.stringify(dados);
  const basta = relatoBasta(dados.relato);
  useEffect(() => {
    if (!basta) return;
    const controle = new AbortController();
    const t = setTimeout(() => {
      setS({ chave, sugestao: null, preparando: true });
      chamarApi<{ sugestao?: SugestaoDoPedido | null }>("/v1/condominio/pedidos/sugestao", {
        corpo: { assunto: dados.assunto, relato: dados.relato, unidadeId: dados.unidadeId }, sinal: controle.signal,
      }).then((r) => {
        if (!controle.signal.aborted) setS({ chave, sugestao: r.ok ? r.dados.sugestao ?? null : null, preparando: false });
      });
    }, 1200);
    return () => { clearTimeout(t); controle.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, basta]);
  if (!basta || !s || s.chave !== chave) return { sugestao: null, preparando: false };
  return { sugestao: s.sugestao, preparando: s.preparando };
}

export function BlocoSugestaoRegistro({ sugestao, preparando, usada, aoUsar }: {
  sugestao: SugestaoDoPedido | null; preparando: boolean; usada: boolean; aoUsar: (s: SugestaoDoPedido) => void;
}) {
  if (!preparando && (!sugestao || !["PRONTA", "LIMITE"].includes(sugestao.estado))) return null;
  const pronta = sugestao?.estado === "PRONTA" && sugestao.categoria && sugestao.prioridade ? sugestao : null;
  return (
    <section aria-labelledby="rp-sugestao" aria-live="polite" className="grid gap-3 rounded-[18px] border border-dashed border-violeta-300 bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex items-start gap-2.5">
          <span className="mt-0.5 text-violeta-600" aria-hidden="true"><Icone nome="etiqueta" /></span>
          <span className="grid gap-0.5">
            <h4 id="rp-sugestao" className="t-texto font-medium">Sugestão automática</h4>
            <span className="t-apoio text-tinta-suave">{sugestao?.estado === "LIMITE" ? `Parada até ${diaDeRenovar(sugestao.renovaEm)}: o condomínio usou as sugestões do mês.`
              : "Apareceu porque o relato foi escrito. Muda se o relato mudar."}</span>
          </span>
        </span>
        {preparando ? <Selo tom="neutro"><Icone nome="relogio" className="h-3.5 w-3.5" />Preparando</Selo>
          : sugestao?.estado === "LIMITE" ? <Selo tom="neutro"><IconeMarca marca="pausa" />Parada</Selo>
          : <Selo tom={usada ? "ok" : "neutro"}>{usada ? "Usada" : "Nada foi preenchido"}</Selo>}
      </div>
      {preparando ? <Esqueleto linhas={2} /> : null}
      {pronta ? (
        <>
          <p className="flex flex-wrap gap-x-5 gap-y-1 t-texto">
            <span><span className="text-tinta-suave">Categoria</span> <strong className="font-semibold">{pronta.categoria!.nome}</strong></span>
            <span><span className="text-tinta-suave">Prioridade</span> <strong className="font-semibold">{pronta.prioridade!.nome}</strong></span>
            {pronta.local ? <span><span className="text-tinta-suave">Onde</span> <strong className="font-semibold">{pronta.local}</strong></span> : null}
          </p>
          {pronta.porque ? <p className="t-apoio text-tinta-suave">Por quê: {pronta.porque}</p> : null}
          <span className="flex flex-wrap items-center gap-3">
            <Botao variante="contorno" tamanho="m" onClick={() => aoUsar(pronta)}><Icone nome="check" className="h-4 w-4" />Usar a sugestão</Botao>
            <span className="t-apoio text-tinta-suave">ou escolha nos campos abaixo</span>
          </span>
        </>
      ) : null}
      <p className="flex items-center gap-1.5 t-apoio text-tinta-suave"><Icone nome="escudo" className="h-3.5 w-3.5" />Vai para a IA só o relato, sem nome e telefone. Quem registra decide.</p>
    </section>
  );
}
