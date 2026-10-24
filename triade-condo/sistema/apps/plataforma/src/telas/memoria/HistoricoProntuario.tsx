"use client";
// Histórico do prontuário (D4.18, decisão D.1 de 24/10/2026; quadros 264 e 265 do canvas; MP-12):
// cada mudança nos itens, com quem fez e quando, e o que venceu, do mais novo ao mais antigo. Abre
// por Mais ações do prontuário; Ver o histórico do item abre a mesma página com o item escolhido.
// Só para ler: para mudar, abra o item.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { descreverHistoricoProntuario, type AcaoHistoricoProntuario, type EventoHistoricoProntuario } from "@triade/domain";
import { Botao, CampoSelecao, Carregando, chamarApi, ErroCarregar, Icone, Selo, Vazio, type Tom } from "@triade/ui";
import { TrilhoDocumentos, VoltarParte } from "../documentos/DocumentosEMemoria.tsx";
import { useCarregar } from "../sessao.tsx";
import type { HistoricoProntuario as Historico } from "../tipos.ts";
import { DiaQuadro } from "../vida/comum.tsx";

const SELO: Record<AcaoHistoricoProntuario, { texto: string; tom: Tom | "andamento" }> = {
  LIGAR: { texto: "Ligado", tom: "ok" },
  DESLIGAR: { texto: "Desligado", tom: "neutro" },
  NAO_SE_APLICA: { texto: "Não se aplica", tom: "neutro" },
  VALE: { texto: "Voltou a valer", tom: "ok" },
  ITEM_CRIADO: { texto: "Novo item", tom: "andamento" },
  VENCEU: { texto: "Venceu", tom: "atencao" },
};

const mesDe = (d: string) => {
  const t = new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function HistoricoProntuario() {
  const router = useRouter();
  const pedido = useSearchParams().get("item") ?? "";
  const item = UUID.test(pedido) ? pedido : "";
  const base = `/v1/condominio/memoria/prontuario/historico${item ? `?item=${item}` : ""}`;
  const carga = useCarregar<Historico>(base);
  const [pagina, setPagina] = useState<{ de: Historico | null; antigos: EventoHistoricoProntuario[]; proximo: string | null }>({ de: null, antigos: [], proximo: null });
  const [buscando, setBuscando] = useState(false);
  const dados = carga.estado === "pronto" ? carga.dados : null;
  const { antigos, proximo } = pagina.de === dados ? pagina : { antigos: [], proximo: dados?.maisAntigosAntes ?? null };

  async function maisAntigos() {
    if (!proximo) return;
    setBuscando(true);
    const r = await chamarApi<Historico>(`${base}${item ? "&" : "?"}antes=${encodeURIComponent(proximo)}`);
    setBuscando(false);
    if (r.ok) setPagina({ de: dados, antigos: [...antigos, ...r.dados.eventos], proximo: r.dados.maisAntigosAntes ?? null });
  }
  const eventos = dados ? [...dados.eventos, ...antigos] : [];
  const meses: { mes: string; eventos: EventoHistoricoProntuario[] }[] = [];
  for (const e of eventos) {
    const mes = mesDe(e.data);
    if (meses.at(-1)?.mes === mes) meses.at(-1)!.eventos.push(e);
    else meses.push({ mes, eventos: [e] });
  }
  const contagem = eventos.length === 1 ? "1 mudança" : `${eventos.length}${proximo ? " ou mais" : ""} mudanças`;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <TrilhoDocumentos atual="prontuario" />
        <VoltarParte parte="prontuario" />
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">Histórico do prontuário</h1>
          <p className="t-apoio">Cada mudança nos itens: o que foi ligado, desligado, marcado como não se aplica, criado e o que venceu. Nada se apaga.</p>
        </div>
      </div>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando o histórico…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="o histórico do prontuário" /> : null}
      {dados ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full md:w-[360px]">
              <CampoSelecao id="hp-item" rotulo="Item" icone="documento" value={item}
                onChange={(e) => router.replace(e.target.value ? `/documentos/historico?item=${e.target.value}` : "/documentos/historico", { scroll: false })}
                opcoes={[{ valor: "", texto: "Todos os itens" }, ...dados.itens.map((i) => ({ valor: i.id, texto: i.nome }))]} />
            </div>
            <span className="t-apoio md:pb-3" role="status">{contagem}{item ? " neste item" : ""}</span>
          </div>
          <section aria-label="Histórico do prontuário" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
            {eventos.length === 0 ? (
              <div className="md:p-5">
                <Vazio titulo="Nenhuma mudança ainda" icone="relogio">
                  {item ? "Este item ainda não mudou." : "Quando alguém ligar um documento, marcar um item ou criar um novo, fica anotado aqui."}
                </Vazio>
              </div>
            ) : meses.map((m) => (
              <div key={m.mes}>
                <h2 className="t-rotulo pt-3 pb-2 md:border-t md:border-linha md:bg-fundo md:px-5 md:first:border-t-0">{m.mes}</h2>
                <ol className="grid max-md:gap-2.5">
                  {m.eventos.map((e) => <LinhaHistorico key={e.id} e={e} />)}
                </ol>
              </div>
            ))}
            {proximo ? (
              <div className="flex justify-center py-3.5 md:border-t md:border-linha">
                <Botao variante="contorno" tamanho="m" disabled={buscando} onClick={() => void maisAntigos()}><Icone nome="baixo" />{buscando ? "Buscando…" : "Ver mais antigos"}</Botao>
              </div>
            ) : null}
          </section>
          <p className="t-apoio">Só para ler: para mudar um item, abra-o no prontuário. Quem não vê documentos restritos vê “documento restrito” no lugar do título.</p>
        </>
      ) : null}
    </div>
  );
}

function LinhaHistorico({ e }: { e: EventoHistoricoProntuario }) {
  const { titulo, detalhe } = descreverHistoricoProntuario(e);
  const selo = SELO[e.acao];
  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-5 py-3.5 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[52px_minmax(0,1fr)_150px] md:border-t md:border-linha md:first:border-t-0">
      <DiaQuadro d={e.data} tom="neutro" />
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium">{titulo}</span>
        {detalhe ? <span className="t-apoio">{detalhe}</span> : null}
        <span className="pt-1 md:hidden"><Selo tom={selo.tom}>{selo.texto}</Selo></span>
      </span>
      <span className="max-md:hidden"><Selo tom={selo.tom}>{selo.texto}</Selo></span>
    </li>
  );
}
