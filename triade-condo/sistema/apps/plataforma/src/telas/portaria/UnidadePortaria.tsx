"use client";
// A unidade vista pela portaria (PA-01, PT-01; telas-modelo encomendas-unidade-*): o cartão
// Encomendas (as guardadas agora, com Entregar, e as últimas entregues, com quem retirou e quem
// entregou) e "Quem pode retirar", só com o nome. O cartão também entra na ficha completa da
// unidade, para quem vê a portaria. Telefone e outros dados ficam com quem cuida dos moradores.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Aviso, Botao, Carregando, ErroCarregar, Icone, Selo, Vazio } from "@triade/ui";
import { CartaoFicha } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import {
  abrirEtiqueta, avisarDeNovo, JanelasEncomenda, MenuEncomenda, PessoasDaUnidade, quando, quemGuardou, resumoEncomenda, SeloAviso,
  type AcaoEncomenda, type Encomenda, type OpcoesEncomenda, type PessoaEncomenda,
} from "./comum.tsx";

interface EncomendasDaUnidade {
  unidade: { id: string; rotulo: string };
  guardadas: Encomenda[];
  entregues: Encomenda[];
  totalEntregues: number;
  pessoas: PessoaEncomenda[];
  pode: { cuidar: boolean };
}

/** O cartão Encomendas: o que está guardado e as últimas entregues. */
export function CartaoEncomendas({ unidadeId, comPessoas }: { unidadeId: string; comPessoas?: boolean }) {
  const { painel, atualizar } = usePlataforma();
  const carga = useCarregar<EncomendasDaUnidade>(`/v1/condominio/encomendas/unidades/${unidadeId}`);
  const precisaOpcoes = carga.estado === "pronto" && carga.dados.pode.cuidar && carga.dados.guardadas.length > 0;
  const opcoes = useCarregar<OpcoesEncomenda>(precisaOpcoes ? "/v1/condominio/encomendas/opcoes" : null);
  const [aberta, setAberta] = useState<{ e: Encomenda; acao: AcaoEncomenda } | null>(null);
  const [recado, setRecado] = useState<Recado>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as encomendas…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="as encomendas" />;
  const d = carga.dados;
  const depois = (texto: string, tom: "ok" | "atencao" = "ok") => { setAberta(null); setRecado({ tom, texto }); carga.recarregar(); atualizar(); };
  const parou = d.pessoas.filter((p) => p.motivo === "PAROU").map((p) => p.nome);
  const abrir = (e: Encomenda) => (a: AcaoEncomenda) => {
    if (a === "etiqueta") void abrirEtiqueta(e);
    else setAberta({ e, acao: a });
  };

  return (
    <>
      <CartaoFicha id="encomendas" titulo="Encomendas" icone="caixa"
        acao={d.guardadas.length ? <Selo tom="info">{d.guardadas.length === 1 ? "1 guardada" : `${d.guardadas.length} guardadas`}</Selo> : undefined}>
        {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
        <div className="grid gap-1">
          <h3 className="t-rotulo">Guardadas agora · {d.guardadas.length}</h3>
          {d.guardadas.length === 0 ? <p className="t-apoio">Nada guardado para esta unidade.</p> : (
            <ul className="grid">
              {d.guardadas.map((e) => (
                <li key={e.id} className="grid gap-2 border-t border-linha py-3 first:border-t-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid">
                      <span className="font-semibold">{resumoEncomenda(e)}</span>
                      <span className="t-apoio">{e.lugar?.nome} · {quemGuardou(e)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {d.pode.cuidar ? <Botao variante="contorno" tamanho="m" aria-label={`Entregar a encomenda de ${d.unidade.rotulo}`} onClick={() => setAberta({ e, acao: "entregar" })}><Icone nome="check" />Entregar</Botao> : null}
                      <MenuEncomenda e={e} podeCuidar={d.pode.cuidar} aoEscolher={abrir(e)} aoAvisar={() => void avisarDeNovo(e).then((r) => depois(r.texto, r.tom))} />
                    </span>
                  </div>
                  <SeloAviso e={e} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-1">
          <h3 className="t-rotulo">Últimas entregues</h3>
          {d.entregues.length === 0 ? <p className="t-apoio">Nenhuma entregue ainda.</p> : (
            <ul className="grid">
              {d.entregues.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha py-2.5 first:border-t-0">
                  <span className="grid">
                    <span className="font-medium">{e.remetente}</span>
                    <span className="t-apoio">Retirou: {e.retirou?.nome}{e.retirou?.ligacao ? ` (${e.retirou.ligacao})` : ""} · entregue por {e.entreguePor?.eu ? "você" : e.entreguePor?.nome}</span>
                  </span>
                  <span className="t-apoio">{e.entregueEm ? quando(e.entregueEm) : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/portaria?aba=ENTREGUES&busca=${encodeURIComponent(d.unidade.rotulo)}`} className="t-texto font-medium text-violeta-600 hover:underline">Ver todas na Portaria</Link>
        </div>
        <p className="t-apoio">Aparece para quem vê a portaria.{parou.length ? ` ${parou.join(" e ")} não ${parou.length === 1 ? "recebe" : "recebem"} os avisos porque pediu PARAR.` : ""}</p>
      </CartaoFicha>
      {comPessoas ? (
        <CartaoFicha id="quem-retira" titulo="Quem pode retirar" icone="pessoas">
          <PessoasDaUnidade pessoas={d.pessoas} />
          <p className="t-apoio">Quem cuida da portaria vê só o nome de quem pode retirar. Telefone e outros dados ficam com quem cuida dos moradores.</p>
        </CartaoFicha>
      ) : null}
      <JanelasEncomenda aberta={aberta} opcoes={opcoes.estado === "pronto" ? opcoes.dados : null} eu={painel.pessoa.nome}
        aoFechar={() => setAberta(null)} salvo={(t) => depois(t)} />
    </>
  );
}

/** /portaria/unidade?id=: a unidade como a portaria vê. */
export function UnidadePortaria() {
  const id = useSearchParams().get("id");
  const { pode } = usePlataforma();
  const voltar = <Link href="/portaria" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Portaria</Link>;
  const carga = useCarregar<{ unidade: { rotulo: string } }>(id ? `/v1/condominio/encomendas/unidades/${id}` : null);
  if (!id) return <div className="grid gap-3">{voltar}<Vazio titulo="Unidade não encontrada" /></div>;
  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="t-titulo-tela">{carga.estado === "pronto" ? carga.dados.unidade.rotulo : "Unidade"}</h1>
        {pode("moradores.ver") ? <Link href={`/moradores/unidade?id=${id}`} className="t-texto font-medium text-violeta-600 hover:underline">Abrir a ficha completa</Link> : null}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CartaoEncomendas unidadeId={id} comPessoas />
      </div>
    </div>
  );
}
