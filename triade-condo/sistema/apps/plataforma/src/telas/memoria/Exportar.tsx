"use client";
// Exportar tudo (design "Memória do prédio", tela 6; CT-04): o síndico pede e a exportação é
// montada em segundo plano; quando fica pronta, chega um aviso no sino. Um pacote com os dados
// (planilhas e JSON) e pacotes com os arquivos. Os links valem 7 dias.

import { useEffect, useState } from "react";
import { EXPORTACAO_DIAS, mostrarTamanho, SITUACOES_EXPORTACAO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Exportacao, Exportacoes } from "../tipos.ts";
import type { PropsAbaMemoria } from "./Memoria.tsx";

const TOM: Record<Exportacao["situacao"], Tom> = { MONTANDO: "andamento", PRONTA: "ok", VENCIDA: "neutro", FALHOU: "erro" };

export function AbaExportar({ feito }: PropsAbaMemoria) {
  const carga = useCarregar<Exportacoes>("/v1/condominio/memoria/exportacoes");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const montando = carga.estado === "pronto" && carga.dados.montando;
  const { recarregar } = carga;

  // Enquanto monta, confere de tempos em tempos (abrir a tela também continua a montagem).
  useEffect(() => {
    if (!montando) return;
    const t = setInterval(recarregar, 15_000);
    return () => clearInterval(t);
  }, [montando, recarregar]);

  async function pedir() {
    setErro(null);
    setPedindo(true);
    const r = await chamarApi("/v1/condominio/memoria/exportacoes", { corpo: {} });
    setPedindo(false);
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
    feito("Exportação pedida. Ela é montada em segundo plano; quando ficar pronta, chega um aviso no sino.");
  }
  async function baixar(e: Exportacao, numero: number) {
    setErro(null);
    const r = await chamarApi<{ url: string }>(`/v1/condominio/memoria/exportacoes/${e.id}/pacotes/${numero}/link`);
    if (!r.ok) return setErro(r.erro);
    window.location.assign(r.dados.url);
  }

  return (
    <div className="grid gap-4">
      <section aria-labelledby="ex-titulo" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
        <h2 id="ex-titulo" className="text-lg font-medium">Exportar tudo</h2>
        <p className="text-sm text-tinta-suave">
          Um arquivo ZIP com planilhas (CSV) e os dados completos (JSON) de cada parte: unidades e contatos, pedidos com o histórico, agenda, manutenção,
          prestadores, comunicados, documentos, memória e manual. Os arquivos (fotos, PDFs e documentos) vão em pacotes separados.
        </p>
        <Aviso tom="atencao" titulo="Tem dados pessoais dos moradores">Guarde o arquivo com cuidado. O pedido fica no histórico e a TRÍADE vê no Console que houve exportação.</Aviso>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Botao onClick={() => void pedir()} disabled={pedindo || (carga.estado === "pronto" && !carga.dados.podePedir)}>
            <Icone nome="baixar" />{pedindo ? "Pedindo…" : "Pedir exportação"}
          </Botao>
          {carga.estado === "pronto" && carga.dados.motivo === "MONTANDO" ? <span className="text-sm text-tinta-suave">Uma exportação está sendo montada.</span> : null}
          {carga.estado === "pronto" && carga.dados.motivo === "UMA_POR_DIA" ? <span className="text-sm text-tinta-suave">Só uma exportação por dia. Use a de hoje.</span> : null}
        </div>
        <p className="text-xs text-tinta-suave">Exportar não muda nada nem tira o condomínio da plataforma. Os links valem {EXPORTACAO_DIAS} dias.</p>
      </section>

      <section aria-labelledby="ex-lista" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
        <h2 id="ex-lista" className="text-lg font-medium">Exportações</h2>
        {carga.estado === "carregando" ? <Carregando linhas={2} rotulo="Carregando as exportações…" /> : null}
        {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
        {carga.estado === "pronto" && !carga.dados.exportacoes.length ? <p className="text-sm text-tinta-suave">Nenhuma exportação ainda.</p> : null}
        {carga.estado === "pronto" && carga.dados.exportacoes.length ? (
          <ul className="divide-y divide-linha rounded-xl border border-linha">
            {carga.dados.exportacoes.map((e) => (
              <li key={e.id} className="grid gap-2 px-3 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Pedida em {diaHora(e.pedidaEm)}{e.autor ? ` · ${e.autor}` : ""}</span>
                  <Selo tom={TOM[e.situacao]}>{SITUACOES_EXPORTACAO[e.situacao]}</Selo>
                </span>
                {e.situacao === "MONTANDO" ? (
                  <span className="text-tinta-suave">
                    {e.partes.filter((p) => p.situacao === "PRONTA").length} de {e.partes.length} pacotes prontos. Pode sair desta tela: o aviso chega no sino.
                  </span>
                ) : null}
                {e.situacao === "FALHOU" ? <span className="text-erro">{e.erro} Peça de novo.</span> : null}
                {e.situacao === "PRONTA" ? (
                  <>
                    <span className="flex flex-wrap gap-2">
                      {e.partes.map((p) => (
                        <Botao key={p.numero} variante="contorno" tamanho="m" onClick={() => void baixar(e, p.numero)}>
                          <Icone nome="baixar" />
                          {p.tipo === "DADOS" ? "Dados" : `Arquivos ${p.numero - 1} de ${e.partes.length - 1}`}
                          {p.tamanho ? ` (${mostrarTamanho(p.tamanho)})` : ""}
                        </Botao>
                      ))}
                    </span>
                    {e.expiraEm ? <span className="text-xs text-tinta-suave">Os links valem até {diaHora(e.expiraEm)}.</span> : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
