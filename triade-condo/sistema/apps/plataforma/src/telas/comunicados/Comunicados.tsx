"use client";
// Comunicados (design "Telas dos Comunicados", tela 1; CD-01, CD-02, CD-05, CD-06): o que está em
// uso, com o assunto, para quem, o autor e a data. Cada correção é uma versão nova; arquivado
// sai daqui e nada é apagado. Os filtros ficam no endereço.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ASSUNTOS_COMUNICADO, ATALHOS_COMUNICADO, FILTROS_COMUNICADO } from "@triade/domain";
import { Botao, Carregando, CampoSelecao, Chip, classeBotao, ErroCarregar, Vazio, type NomeIcone } from "@triade/ui";
import { Escolha } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ListaComunicados } from "../tipos.ts";
import { LinhaComunicado } from "./comum.tsx";

type Filtros = { filtro: string; assunto: string; atencao: string; busca: string; pagina: number };
const ICONE_ATALHO: Record<string, NomeIcone> = { RASCUNHOS_PARADOS: "editar", PROGRAMADOS_HOJE: "relogio" };

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.filtro && f.filtro !== "EM_USO") q.set("filtro", f.filtro);
  if (f.assunto) q.set("assunto", f.assunto);
  if (f.atencao) q.set("atencao", f.atencao);
  if (f.busca) q.set("busca", f.busca);
  if (f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export function Comunicados() {
  const router = useRouter();
  const busca = useSearchParams();
  const f: Filtros = {
    filtro: busca.get("filtro") && busca.get("filtro")! in FILTROS_COMUNICADO ? busca.get("filtro")! : "EM_USO",
    assunto: busca.get("assunto") && busca.get("assunto")! in ASSUNTOS_COMUNICADO ? busca.get("assunto")! : "",
    atencao: busca.get("atencao") && busca.get("atencao")! in ATALHOS_COMUNICADO ? busca.get("atencao")! : "",
    busca: busca.get("busca") ?? "",
    pagina: Math.max(1, Number(busca.get("pagina")) || 1),
  };
  const q = consulta(f);
  const lista = useCarregar<ListaComunicados>(`/v1/condominio/comunicados${q ? `?${q}` : ""}`);
  const [texto, setTexto] = useState(f.busca);

  const ir = (m: Partial<Filtros>) => {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/comunicados?${novo}` : "/comunicados", { scroll: false });
  };
  const dados = lista.estado === "pronto" ? lista.dados : null;
  const podePublicar = Boolean(dados?.pode.publicar);
  const filtrando = q !== "";
  const escrever = <Link href="/comunicados/escrever" className={classeBotao("primario")}>+ Escrever comunicado</Link>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Comunicados</h1>
          <p className="mt-1 text-tinta-suave">O que o condomínio avisa aos moradores, com autor, data e versão.</p>
        </div>
        {podePublicar ? escrever : null}
      </div>

      <div className="grid gap-3">
        <Escolha rotulo="Situação" atual={f.filtro} aoMudar={(x) => ir({ filtro: x })}
          opcoes={Object.entries(FILTROS_COMUNICADO).map(([valor, t]) => ({ valor, texto: t }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <form role="search" onSubmit={(e) => { e.preventDefault(); ir({ busca: texto.trim() }); }} className="grid gap-1">
            <label htmlFor="cm-busca" className="text-[13px] font-medium">Buscar</label>
            <input id="cm-busca" className="campo" placeholder="Título ou texto" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </form>
          <CampoSelecao id="cm-f-assunto" rotulo="Assunto" value={f.assunto} onChange={(e) => ir({ assunto: e.target.value })}
            opcoes={[{ valor: "", texto: "Todos os assuntos" }, ...Object.entries(ASSUNTOS_COMUNICADO).map(([valor, t]) => ({ valor, texto: t }))]} />
        </div>
        <div role="group" aria-label="O que pede atenção" className="flex flex-wrap gap-2">
          {Object.entries(ATALHOS_COMUNICADO).map(([codigo, nome]) => {
            const n = dados ? { RASCUNHOS_PARADOS: dados.atalhos.rascunhosParados, PROGRAMADOS_HOJE: dados.atalhos.programadosHoje }[codigo] : null;
            return (
              <Chip key={codigo} ativo={f.atencao === codigo} icone={ICONE_ATALHO[codigo]} acento={Boolean(n) && f.atencao !== codigo}
                onClick={() => ir({ atencao: f.atencao === codigo ? "" : codigo, filtro: "EM_USO" })}>
                {nome}{n !== null && n !== undefined ? ` · ${n}` : ""}
              </Chip>
            );
          })}
          {filtrando ? <Botao variante="discreto" onClick={() => { setTexto(""); router.replace("/comunicados", { scroll: false }); }}>Limpar filtros</Botao> : null}
        </div>
      </div>

      {lista.estado === "carregando" ? <Carregando rotulo="Carregando os comunicados…" /> : null}
      {lista.estado === "erro" ? <ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /> : null}
      {dados ? (
        dados.itens.length === 0 ? (
          filtrando ? <Vazio titulo="Nenhum comunicado com estes filtros" />
            : <Vazio titulo="Nenhum comunicado em uso" acao={podePublicar ? escrever : undefined}>
                Escreva o primeiro aviso aos moradores. Enquanto o WhatsApp não chega, ele sai copiado para o grupo do prédio ou impresso para o mural.
              </Vazio>
        ) : (
          <section aria-labelledby="t-lista" className="grid gap-2">
            <h2 id="t-lista" className="sr-only">Comunicados encontrados</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-superficie shadow-s1">
              <div aria-hidden="true" className="hidden border-b border-linha bg-violeta-50/60 px-4 py-2.5 text-[13px] font-medium text-tinta-suave md:grid md:grid-cols-[8.5rem_minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] md:gap-4">
                <span>Situação</span><span>Comunicado</span><span>Para quem</span><span>Autor e data</span>
              </div>
              <ul>{dados.itens.map((c) => <LinhaComunicado key={c.id} c={c} />)}</ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-tinta-suave">
              <span>{dados.total === 1 ? "1 comunicado" : `${dados.total} comunicados`}</span>
              <span>Arquivados e versões trocadas não aparecem em uso; nada é apagado.</span>
              {dados.total > 30 ? (
                <span className="flex gap-2">
                  <Botao variante="contorno" disabled={f.pagina <= 1} onClick={() => ir({ pagina: f.pagina - 1 })}>Anteriores</Botao>
                  <Botao variante="contorno" disabled={f.pagina * 30 >= dados.total} onClick={() => ir({ pagina: f.pagina + 1 })}>Próximos</Botao>
                </span>
              ) : null}
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}
