"use client";
// Aniversariantes (F3.10; MU-11): as pessoas e a família de todas as unidades, ou de uma, que
// fazem aniversário no mês. Só dia e mês, sem o ano (decisão B de 23/10/2026); aparece só para
// quem vê os moradores. Abre pela aba Pessoas e pelo menu de cada unidade na lista.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MESES } from "@triade/domain";
import { Carregando, CampoSelecao, ErroCarregar, Icone, Iniciais, Vazio } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { Aniversariantes as Dados } from "../tipos.ts";

export function Aniversariantes() {
  const endereco = useSearchParams();
  const router = useRouter();
  const unidade = endereco.get("unidade") ?? "";
  const mesPedido = Number(endereco.get("mes")) || null;
  const q = new URLSearchParams();
  if (mesPedido) q.set("mes", String(mesPedido));
  if (unidade) q.set("unidade", unidade);
  const carga = useCarregar<Dados>(`/v1/condominio/aniversariantes${q.size ? `?${q}` : ""}`);
  const ir = (mes: number, u: string) => {
    const p = new URLSearchParams({ mes: String(mes) });
    if (u) p.set("unidade", u);
    router.replace(`/moradores/aniversariantes?${p}`);
  };
  const voltar = (
    <Link href="/moradores" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Moradores e unidades
    </Link>
  );

  const d = carga.estado === "pronto" ? carga.dados : null;
  const mes = d?.mes ?? mesPedido ?? 1;
  // O mês que já passou neste ano é o do ano que vem.
  const ano = new Date().getFullYear() + (d && d.mes < d.mesAtual ? 1 : 0);
  const anterior = mes === 1 ? 12 : mes - 1;
  const seguinte = mes === 12 ? 1 : mes + 1;
  const nomeMes = MESES[mes - 1] ?? "";

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="grid gap-1">
        <h1 className="t-titulo-tela">Aniversariantes</h1>
        <p className="t-apoio">Pessoas e família de todas as unidades. Só dia e mês; aparece só para quem vê os moradores.</p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Mês" className="flex items-center gap-2">
          <button type="button" className="emblema" aria-label={`Mês anterior: ${MESES[anterior - 1]}`} onClick={() => ir(anterior, unidade)}><Icone nome="esq" /></button>
          <h2 className="t-titulo-cartao min-w-48 text-center" aria-live="polite">{nomeMes} de {ano}</h2>
          <button type="button" className="emblema" aria-label={`Mês seguinte: ${MESES[seguinte - 1]}`} onClick={() => ir(seguinte, unidade)}><Icone nome="dir" /></button>
        </nav>
        {d ? (
          <CampoSelecao id="a-unidade" rotulo="Unidade" className="min-w-56" value={unidade} onChange={(e) => ir(mes, e.target.value)}
            opcoes={[{ valor: "", texto: "Todas" }, ...d.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]} />
        ) : null}
      </div>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando os aniversariantes…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        d.itens.length === 0 ? (
          <Vazio titulo={`Ninguém faz aniversário em ${nomeMes.toLowerCase()}`} icone="bolo">
            O aniversário é opcional e entra na ficha da unidade, em cada pessoa e em cada familiar.
          </Vazio>
        ) : (
          <ul aria-label={`Aniversariantes de ${nomeMes.toLowerCase()}`} className="grid rounded-[18px] border border-linha bg-superficie px-5 shadow-s1 max-md:px-4">
            {d.itens.map((x) => (
              <li key={`${x.tipo}-${x.id}-${x.unidadeId}`} className="flex items-center gap-3 border-t border-linha py-3 first:border-t-0">
                <span className="t-codigo w-14 shrink-0 text-violeta-600">
                  <span className="max-md:hidden">{String(x.dia).padStart(2, "0")}/{String(d.mes).padStart(2, "0")}</span>
                  <span className="md:hidden">{String(x.dia).padStart(2, "0")}</span>
                </span>
                <Iniciais nome={x.nome} className={`h-10 w-10 ${x.tipo === "FAMILIA" ? "border border-dashed border-contorno !bg-superficie" : ""}`} />
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold">{x.nome}</span>
                  <span className="t-apoio"><span className="md:hidden">{x.unidade} · </span>{x.descricao}</span>
                </span>
                <Link href={`/moradores/unidade?id=${x.unidadeId}`} className="t-texto font-medium text-violeta-600 hover:underline max-md:hidden">{x.unidade}</Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
