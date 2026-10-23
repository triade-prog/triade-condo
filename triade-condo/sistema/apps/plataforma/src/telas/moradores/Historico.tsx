"use client";
// Histórico da unidade (F3.10; MU-11): tudo o que mudou na unidade, do mais novo ao mais antigo,
// agrupado por mês, com filtro por assunto. O banco já manda os textos; telefone e placa não
// aparecem aqui. Abre pela ficha (Ver tudo, Mais ações) e pelo menu da linha na lista.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CATEGORIAS_HISTORICO, formatarData, type CategoriaHistorico } from "@triade/domain";
import { Botao, Carregando, chamarApi, Chip, ErroCarregar, Icone, textoDoErro, Trilho, Vazio } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { HistoricoUnidade, ItemHistoricoUnidade } from "../tipos.ts";

const MES_ANO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" });
const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "22/10/2026", no horário de Brasília. */
export function dataDoHistorico(iso: string): string {
  return formatarData(iso);
}

/** "Outubro de 2026". */
function mesDoHistorico(iso: string): string {
  const t = MES_ANO.format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Os registros por mês, na ordem em que vieram. */
function porMes(itens: ItemHistoricoUnidade[]): { mes: string; itens: ItemHistoricoUnidade[] }[] {
  const grupos: { mes: string; itens: ItemHistoricoUnidade[] }[] = [];
  for (const h of itens) {
    const mes = mesDoHistorico(h.em);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.mes === mes) ultimo.itens.push(h);
    else grupos.push({ mes, itens: [h] });
  }
  return grupos;
}

export function Historico() {
  const endereco = useSearchParams();
  const id = endereco.get("id");
  const [categoria, setCategoria] = useState<CategoriaHistorico | "">("");
  const caminho = id ? `/v1/condominio/unidades/${id}/historico${categoria ? `?categoria=${categoria}` : ""}` : null;
  const carga = useCarregar<HistoricoUnidade>(caminho);
  // As páginas mais antigas, buscadas com Ver mais antigas; zeram quando o filtro muda.
  const [antigas, setAntigas] = useState<{ de: string; itens: ItemHistoricoUnidade[]; mais: boolean } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const voltar = (
    <Link href={id ? `/moradores/unidade?id=${id}` : "/moradores"} className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />{carga.estado === "pronto" ? carga.dados.unidade : "Unidade"}
    </Link>
  );
  const titulo = <h1 className="t-titulo-tela">Histórico da unidade</h1>;
  if (!id) return <div className="grid gap-3">{voltar}{titulo}<Vazio titulo="Unidade não encontrada" /></div>;

  const extra = antigas && antigas.de === caminho ? antigas : null;
  const d = carga.estado === "pronto" ? carga.dados : null;
  const itens = d ? [...d.itens, ...(extra?.itens ?? [])] : [];
  const mais = extra ? extra.mais : d?.mais ?? false;

  async function verMais() {
    const ultimo = itens[itens.length - 1];
    if (!ultimo || !caminho) return;
    setBuscando(true);
    setFalha(null);
    const r = await chamarApi<HistoricoUnidade>(`${caminho}${categoria ? "&" : "?"}antes=${ultimo.id}`, { metodo: "GET" });
    setBuscando(false);
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    setAntigas({ de: caminho, itens: [...(extra?.itens ?? []), ...r.dados.itens], mais: r.dados.mais });
  }

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="grid gap-1">
        {titulo}
        <p className="t-apoio">{d ? `${d.unidade} · ` : ""}tudo o que mudou, do mais novo ao mais antigo. Telefone e placa não aparecem aqui.</p>
      </div>
      <Trilho rotulo="Filtrar o histórico">
        <Chip ativo={categoria === ""} onClick={() => setCategoria("")}>Tudo</Chip>
        {(Object.keys(CATEGORIAS_HISTORICO) as CategoriaHistorico[]).map((c) => (
          <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(c)}>{CATEGORIAS_HISTORICO[c]}</Chip>
        ))}
      </Trilho>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando o histórico…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        itens.length === 0 ? (
          <Vazio titulo={categoria ? "Nada deste assunto" : "Nada registrado ainda"} icone="relogio">
            {categoria ? "Escolha Tudo para ver o resto do histórico." : "Cada mudança na unidade, nas pessoas, na família e nos veículos fica aqui."}
          </Vazio>
        ) : (
          <section aria-label="Registros" className="grid gap-5 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
            {porMes(itens).map((g) => (
              <div key={g.mes} className="grid gap-1">
                <h2 className="t-rotulo">{g.mes}</h2>
                <ol className="grid">
                  {g.itens.map((h) => (
                    <li key={h.id} className="grid gap-x-4 border-t border-linha py-3 first:border-t-0 md:grid-cols-[110px_minmax(0,1fr)]">
                      <span className="t-codigo text-tinta-suave max-md:order-last">{DIA_HORA.format(new Date(h.em))}</span>
                      <span className="grid">
                        <span className="font-medium">{h.titulo}</span>
                        <span className="t-apoio">{[h.detalhe, h.autor].filter(Boolean).join(" · ")}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {falha ? <p role="alert" className="t-apoio text-erro">{falha}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-4">
              <span className="t-apoio">{d.total === 1 ? "1 registro" : `${d.total} registros`}{d.desde ? ` desde ${formatarData(d.desde)}` : ""}</span>
              {mais ? <Botao variante="contorno" disabled={buscando} onClick={() => void verMais()}>{buscando ? "Buscando…" : "Ver mais antigas"}</Botao> : null}
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}
