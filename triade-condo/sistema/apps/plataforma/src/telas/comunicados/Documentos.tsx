"use client";
// Documentos (design "Telas dos Comunicados", tela 4; CD-04, CD-07, MP-12): o arquivo do prédio
// por tipo, com a versão em vigor, quem vê e a validade, que aparece 60 dias antes do fim. O
// documento restrito só aparece a quem cuida dos documentos.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { aoMoradorPadrao, descreverValidade, FILTROS_DOCUMENTO, mostrarDataCurta, TIPOS_DOCUMENTO, type TipoDocumento } from "@triade/domain";
import { Aviso, Botao, Carregando, Chip, chamarApi, ErroCarregar, Selo, Vazio } from "@triade/ui";
import { Janela, type Campo } from "../Janela.tsx";
import { Escolha, hojeEmBrasilia } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { DocumentoResumo, ListaDocumentos } from "../tipos.ts";
import { nomeTipoDocumento, PartesComunicados } from "./comum.tsx";

export const camposDocumento = (restritos: boolean): Campo[] => [
  { id: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => ({ valor, texto })), erro: "Escolha o tipo." },
  { id: "titulo", rotulo: "Nome", tipo: "texto", obrigatorio: true, max: 120, erro: "De 3 a 120 caracteres, sem repetir outro documento." },
  { id: "descricao", rotulo: "Descrição", tipo: "area", max: 500, ajuda: "Opcional.", erro: "De 2 a 500 caracteres." },
  { id: "valeAte", rotulo: "Vale até", tipo: "data", ajuda: "Para laudo, certificado, seguro e contrato. Avisa 60 dias antes.", erro: "Data fora do esperado." },
  { id: "aoMorador", rotulo: "Pode ir ao morador", tipo: "caixa", ajuda: "Consulta pelo WhatsApp quando o canal chegar. Já ligado para convenção, regimento, atas e orçamento." },
  ...(restritos ? [{ id: "restrito", rotulo: "Só quem cuida dos documentos vê", tipo: "caixa", ajuda: "Para contratos e laudos sensíveis. Documento restrito não vai ao morador." } as Campo] : []),
];

/** Do formulário para a API. */
export const documentoParaApi = (v: Record<string, string | boolean>) => ({
  tipo: v.tipo, titulo: v.titulo, descricao: v.descricao || null, valeAte: v.valeAte || null,
  restrito: v.restrito === true, aoMorador: v.restrito === true ? false : v.aoMorador === true,
});

export function LinhaDocumento({ d, hoje }: { d: DocumentoResumo; hoje: string }) {
  const validade = descreverValidade(d.valeAte, hoje);
  return (
    <li className="grid gap-1.5 border-b border-linha px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-4">
      <span className="grid min-w-0 gap-0.5">
        <Link href={`/comunicados/documento?id=${d.id}`} className="font-medium hover:text-violeta-600 hover:underline">{d.titulo}</Link>
        <span className="text-[13px] text-tinta-suave">
          {d.emVigor ? `versão ${d.emVigor.numero} · em vigor desde ${mostrarDataCurta(d.emVigor.vigenteDesde)}` : "sem arquivo ainda"}
          {d.proxima ? ` · versão ${d.proxima.numero} a partir de ${mostrarDataCurta(d.proxima.vigenteDesde)}` : ""}
        </span>
      </span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Tipo: </span>{nomeTipoDocumento(d.tipo)}</span>
      <span className="text-sm">{d.restrito ? <Selo tom="atencao">Só quem cuida</Selo> : d.aoMorador ? "Pode ir ao morador" : "Só a gestão"}</span>
      <span className={`text-sm ${d.vencido || d.vencendo ? "font-medium text-erro" : ""}`}>{validade ?? <span className="text-tinta-suave">Sem validade</span>}</span>
    </li>
  );
}

export function Documentos() {
  const router = useRouter();
  const busca = useSearchParams();
  const filtro = busca.get("filtro") && (busca.get("filtro")! in FILTROS_DOCUMENTO || busca.get("filtro") === "VENCENDO") ? busca.get("filtro")! : "VIGOR";
  const q = new URLSearchParams();
  if (filtro !== "VIGOR") q.set("filtro", filtro);
  if (busca.get("busca")) q.set("busca", busca.get("busca")!);
  const lista = useCarregar<ListaDocumentos>(`/v1/condominio/documentos${q.size ? `?${q}` : ""}`);
  const [texto, setTexto] = useState(busca.get("busca") ?? "");
  const [novo, setNovo] = useState(false);
  const hoje = hojeEmBrasilia();

  const ir = (f: string, b = texto.trim()) => {
    const x = new URLSearchParams();
    if (f !== "VIGOR") x.set("filtro", f);
    if (b) x.set("busca", b);
    router.replace(x.size ? `/comunicados/documentos?${x}` : "/comunicados/documentos", { scroll: false });
  };
  const dados = lista.estado === "pronto" ? lista.dados : null;

  return (
    <div className="grid gap-5">
      <PartesComunicados />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Documentos</h1>
          <p className="mt-1 text-tinta-suave">Convenção, regimento, atas, contratos e laudos, com as versões anteriores.</p>
        </div>
        {dados?.pode.editar ? <Botao onClick={() => setNovo(true)}>+ Novo documento</Botao> : null}
      </div>
      <div className="grid gap-3">
        <Escolha rotulo="Tipo" atual={filtro === "VENCENDO" ? "VIGOR" : filtro} aoMudar={(x) => ir(x)}
          opcoes={Object.entries(FILTROS_DOCUMENTO).map(([valor, t]) => ({ valor, texto: t }))} />
        <form role="search" onSubmit={(e) => { e.preventDefault(); ir(filtro); }} className="grid max-w-md gap-1">
          <label htmlFor="doc-busca" className="text-[13px] font-medium">Buscar</label>
          <input id="doc-busca" className="campo" placeholder="Nome ou descrição" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </form>
        <div role="group" aria-label="O que pede atenção" className="flex flex-wrap gap-2">
          <Chip ativo={filtro === "VENCENDO"} icone="relogio" acento={Boolean(dados?.vencendo) && filtro !== "VENCENDO"} onClick={() => ir(filtro === "VENCENDO" ? "VIGOR" : "VENCENDO")}>
            Vencem em até 60 dias{dados ? ` · ${dados.vencendo}` : ""}
          </Chip>
        </div>
      </div>

      {lista.estado === "carregando" ? <Carregando rotulo="Carregando os documentos…" /> : null}
      {lista.estado === "erro" ? <ErroCarregar texto={lista.texto} tentarDeNovo={lista.recarregar} /> : null}
      {dados ? (
        dados.itens.length === 0 ? (
          <Vazio titulo={filtro === "VIGOR" && !busca.get("busca") ? "Nenhum documento guardado" : "Nenhum documento com estes filtros"}
            acao={dados.pode.editar && filtro === "VIGOR" ? <Botao onClick={() => setNovo(true)}>+ Novo documento</Botao> : undefined}>
            {filtro === "VIGOR" ? "Comece pela convenção e pelo regimento interno. Cada arquivo novo vira uma versão; as anteriores ficam guardadas." : null}
          </Vazio>
        ) : (
          <section aria-labelledby="t-docs" className="grid gap-2">
            <h2 id="t-docs" className="sr-only">Documentos encontrados</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-superficie shadow-s1">
              <div aria-hidden="true" className="hidden border-b border-linha bg-violeta-50/60 px-4 py-2.5 text-[13px] font-medium text-tinta-suave md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
                <span>Documento</span><span>Tipo</span><span>Quem vê</span><span>Validade</span>
              </div>
              <ul>{dados.itens.map((d) => <LinhaDocumento key={d.id} d={d} hoje={hoje} />)}</ul>
            </div>
            <p className="text-sm text-tinta-suave">{dados.total === 1 ? "1 documento" : `${dados.total} documentos`}. As versões anteriores ficam dentro de cada documento.</p>
          </section>
        )
      ) : null}
      {!dados?.pode.editar && dados ? <Aviso tom="neutro">Para guardar documentos, o síndico precisa dar a você a permissão Cuidar dos documentos.</Aviso> : null}

      {novo && dados ? (
        <Janela aberto titulo="Novo documento" textoBotao="Guardar documento" aoFechar={() => setNovo(false)}
          explicacao="Primeiro os dados; o arquivo entra em seguida, como a versão 1."
          campos={camposDocumento(dados.pode.restritos)}
          iniciais={{ tipo: "REGIMENTO", titulo: "", descricao: "", valeAte: "", aoMorador: aoMoradorPadrao("REGIMENTO" as TipoDocumento), restrito: false }}
          aoSalvar={async (v) => {
            const r = await chamarApi<{ id: string }>("/v1/condominio/documentos", { corpo: documentoParaApi(v) });
            if (r.ok) router.push(`/comunicados/documento?id=${r.dados.id}&novo=1`);
            return r;
          }} />
      ) : null}
    </div>
  );
}
