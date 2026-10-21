"use client";
// Passagem de bastão (design "Memória do prédio", tela 5; CT-02): o síndico gera, a qualquer
// momento, o dossiê com o retrato do condomínio. Cada geração fica guardada como foi gerada e
// abre numa página própria, para imprimir ou salvar em PDF.

import { useState } from "react";
import { AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { PropsAbaMemoria } from "./Memoria.tsx";

type Dossies = { id: string; geradoEm: string; autor?: string }[];

export function AbaPassagem({ feito }: PropsAbaMemoria) {
  const carga = useCarregar<Dossies>("/v1/condominio/memoria/dossies");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setErro(null);
    setGerando(true);
    const r = await chamarApi<{ id: string }>("/v1/condominio/memoria/dossies", { corpo: {} });
    setGerando(false);
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
    feito("Dossiê gerado. Ele abre numa página própria para imprimir ou salvar em PDF.");
    window.open(`/dossie?id=${r.dados.id}`, "_blank", "noopener");
  }

  return (
    <section aria-labelledby="ps-titulo" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="ps-titulo" className="text-lg font-medium">Dossiê de passagem de bastão</h2>
      <p className="text-sm text-tinta-suave">
        Um retrato do condomínio na data em que é gerado: pendências, prestadores e contratos, documentos, programa de manutenção, combinados,
        agenda, quem tem acesso e o manual do prédio. Nunca traz senha nem dados de moradores além do número da unidade.
      </p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div><Botao onClick={() => void gerar()} disabled={gerando}><Icone nome="documento" />{gerando ? "Gerando…" : "Gerar dossiê agora"}</Botao></div>
      {carga.estado === "carregando" ? <Carregando linhas={2} rotulo="Carregando os dossiês…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.length ? (
        <section aria-labelledby="ps-gerados" className="grid gap-2">
          <h3 id="ps-gerados" className="font-medium">Dossiês gerados</h3>
          <ul className="divide-y divide-linha rounded-xl border border-linha">
            {carga.dados.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-violeta-50 text-violeta-700"><Icone nome="documento" className="h-4 w-4" /></span>
                <span className="grid min-w-0 flex-1"><span>Dossiê de {diaHora(d.geradoEm)}</span>{d.autor ? <span className="text-xs text-tinta-suave">Gerado por {d.autor}</span> : null}</span>
                <a href={`/dossie?id=${d.id}`} target="_blank" rel="noopener" className={classeBotao("contorno", "", "m")}>Abrir</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-tinta-suave">
        A troca de síndico em si (conferir a documentação, encerrar acessos e dar acesso ao novo) é feita pela TRÍADE. Cada geração fica no histórico.
      </p>
    </section>
  );
}
