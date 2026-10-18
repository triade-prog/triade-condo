"use client";
// Documento aberto (design "Telas dos Comunicados", tela 5; CD-04, CD-07, MP-12): a versão em
// vigor, as anteriores com o que mudou e quem abriu ou baixou. Nova versão pede o arquivo, o
// que mudou e a data em que passa a valer; até lá, a anterior continua em vigor.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { descreverEventoDocumento, descreverValidade, mostrarDataCurta, mostrarTamanho, TAMANHO_MAXIMO_DOCUMENTO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { DocumentoDetalhe, Recado, VersaoDocumento } from "../tipos.ts";
import { abrirLink, conferirArquivo, enviarUm, nomeTipoDocumento, PartesComunicados } from "./comum.tsx";
import { camposDocumento, documentoParaApi } from "./Documentos.tsx";

export function Documento() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<DocumentoDetalhe>(id ? `/v1/condominio/documentos/${id}` : null);
  const [acao, setAcao] = useState<"versao" | "editar" | "arquivar" | null>(busca.get("novo") ? "versao" : null);
  const [recado, setRecado] = useState<Recado>(busca.get("novo") ? { tom: "ok", texto: "Documento guardado. Agora envie o arquivo da versão 1." } : null);
  const voltar = <Link href="/comunicados/documentos" className="text-sm font-medium text-violeta-600 hover:underline">Voltar aos documentos</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Documento</h1><Vazio titulo="Documento não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o documento…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Documento</h1><ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }
  const d = carga.dados;
  const doc = d.documento;
  const validade = descreverValidade(doc.valeAte, d.hoje);
  const temVersao = d.versoes.some((x) => x.situacao === "LIBERADO");
  const abrir = (x: VersaoDocumento, baixar: boolean) =>
    void abrirLink(`/v1/condominio/documentos/${doc.id}/versoes/${x.id}/link${baixar ? "?baixar=1" : ""}`).then((e) => {
      if (e) setRecado({ tom: "atencao", texto: e });
      carga.recarregar();
    });

  return (
    <div className="grid gap-5">
      <PartesComunicados />
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-[28px] font-normal tracking-tight">{doc.titulo}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Selo tom="info">{nomeTipoDocumento(doc.tipo)}</Selo>
            {doc.emVigor ? <Selo tom="andamento">Versão {doc.emVigor.numero} em vigor</Selo> : <Selo tom="neutro">Sem arquivo</Selo>}
            {doc.restrito ? <Selo tom="atencao">Só quem cuida dos documentos</Selo> : doc.aoMorador ? <Selo tom="ok">Pode ir ao morador</Selo> : null}
            {doc.arquivadoEm ? <Selo tom="neutro">Arquivado</Selo> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.emVigor ? <Botao variante="contorno" onClick={() => abrir({ id: doc.emVigor!.id } as VersaoDocumento, false)}>Abrir</Botao> : null}
          {doc.emVigor ? <Botao variante="contorno" onClick={() => abrir({ id: doc.emVigor!.id } as VersaoDocumento, true)}>Baixar</Botao> : null}
          {d.pode.enviar ? <Botao onClick={() => setAcao("versao")}>{temVersao ? "Nova versão" : "Enviar o arquivo"}</Botao> : null}
          {d.pode.editar ? <Botao variante="discreto" onClick={() => setAcao("editar")}>Editar</Botao> : null}
          {d.pode.editar ? <Botao variante="discreto" onClick={() => setAcao("arquivar")}>Arquivar</Botao> : null}
        </div>
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {doc.arquivamento ? <Aviso tom="info" titulo="Documento arquivado">{doc.arquivamento.por ?? "Alguém"} em {diaHora(doc.arquivamento.em)}. Motivo: {doc.arquivamento.motivo}</Aviso> : null}
      {doc.vencido || doc.vencendo ? <Aviso tom={doc.vencido ? "erro" : "atencao"} titulo={`Validade: ${validade}`}>Guarde a versão renovada quando ela chegar.</Aviso> : null}
      {doc.proxima ? <Aviso tom="info" titulo={`A versão ${doc.proxima.numero} passa a valer em ${mostrarDataCurta(doc.proxima.vigenteDesde)}`}>Até lá, a versão {doc.emVigor?.numero ?? "anterior"} continua em vigor.</Aviso> : null}

      <dl className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1 sm:grid-cols-4">
        <div><dt className="text-xs text-tinta-suave">Em vigor desde</dt><dd>{doc.emVigor ? mostrarDataCurta(doc.emVigor.vigenteDesde) : "Sem arquivo"}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Aprovado em</dt><dd>{doc.emVigor?.aprovadoEm ?? "Não informado"}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Validade</dt><dd>{validade ?? "Sem validade"}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Guardado</dt><dd>{diaHora(doc.criadoEm)}{doc.criadoPor ? ` por ${doc.criadoPor}` : ""}</dd></div>
        {doc.descricao ? <div className="sm:col-span-4"><dt className="text-xs text-tinta-suave">Descrição</dt><dd>{doc.descricao}</dd></div> : null}
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="t-versoes" className="grid gap-2">
          <h2 id="t-versoes" className="text-lg font-medium">Versões</h2>
          {d.versoes.length === 0 ? <Vazio titulo="Nenhum arquivo ainda">Envie o arquivo do documento. Cada arquivo novo vira uma versão.</Vazio> : (
            <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {d.versoes.map((x) => (
                <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{x.numero ? `Versão ${x.numero}` : x.nome}</span>
                      {x.emVigor ? <Selo tom="ok">Em vigor</Selo> : null}
                      {x.situacao === "LIBERADO" && !x.emVigor && x.vigenteDesde > d.hoje ? <Selo tom="info">A partir de {mostrarDataCurta(x.vigenteDesde)}</Selo> : null}
                      {x.situacao === "ENVIANDO" ? <Selo tom="info">Verificando</Selo> : null}
                      {x.situacao === "NAO_LIBERADO" ? <Selo tom="atencao">Não liberado</Selo> : null}
                    </span>
                    {x.mudanca ? <span>{x.mudanca}</span> : null}
                    {x.situacao === "NAO_LIBERADO" ? <span className="text-atencao">{x.motivoRecusa}</span> : null}
                    <span className="text-xs text-tinta-suave">
                      Vale desde {mostrarDataCurta(x.vigenteDesde)}{x.aprovadoEm ? ` · ${x.aprovadoEm}` : ""} · {x.tipo.startsWith("image/") ? "Foto" : "PDF"} {mostrarTamanho(x.tamanho)}
                      {x.enviadoPor ? ` · ${x.enviadoPor}` : ""} · {diaHora(x.enviadoEm)}
                    </span>
                  </span>
                  {x.situacao === "LIBERADO" ? (
                    <span className="flex gap-1">
                      <Botao variante="discreto" tamanho="p" aria-label={`Abrir a versão ${x.numero}`} onClick={() => abrir(x, false)}>Abrir</Botao>
                      <Botao variante="discreto" tamanho="p" aria-label={`Baixar a versão ${x.numero}`} onClick={() => abrir(x, true)}>Baixar</Botao>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-tinta-suave">O arquivo fica guardado sem acesso público. Abrir e baixar usam link de 5 minutos, e cada abertura fica no histórico. Depois de baixada, a cópia não tem mais controle.</p>
        </section>

        <section aria-labelledby="t-hist" className="grid gap-2">
          <h2 id="t-hist" className="text-lg font-medium">Histórico</h2>
          <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
            {d.historico.map((h, i) => (
              <li key={i} className="grid gap-0.5 px-4 py-2.5 text-sm">
                <span>{descreverEventoDocumento(h.acao, h.dados)}</span>
                <span className="text-xs text-tinta-suave">{h.autor ?? "Sistema"} · {diaHora(h.em)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Dialogo aberto={acao === "versao"} titulo={temVersao ? `Nova versão de ${doc.titulo}` : `Arquivo de ${doc.titulo}`} aoFechar={() => setAcao(null)}>
        {acao === "versao" ? (
          <NovaVersao documentoId={doc.id} primeira={!temVersao} emVigor={doc.emVigor?.numero} hoje={d.hoje} aoFechar={() => setAcao(null)}
            enviado={(texto, tom) => { setAcao(null); setRecado({ tom, texto }); carga.recarregar(); }} />
        ) : null}
      </Dialogo>
      <Janela aberto={acao === "editar"} titulo="Editar documento" textoBotao="Salvar" aoFechar={() => setAcao(null)} recarregar={carga.recarregar}
        campos={camposDocumento(d.pode.restritos)}
        iniciais={{ tipo: doc.tipo, titulo: doc.titulo, descricao: doc.descricao ?? "", valeAte: doc.valeAte ?? "", aoMorador: doc.aoMorador, restrito: doc.restrito }}
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/documentos/${doc.id}`, { metodo: "PUT", corpo: { ...documentoParaApi(v), versao: doc.versao } });
          if (r.ok) { setAcao(null); setRecado({ tom: "ok", texto: "Documento salvo." }); carga.recarregar(); }
          return r;
        }} />
      <Janela aberto={acao === "arquivar"} titulo="Arquivar documento" textoBotao="Arquivar" aoFechar={() => setAcao(null)} recarregar={carga.recarregar}
        explicacao="Sai da lista em vigor e não muda mais. As versões ficam guardadas."
        campos={[{ id: "motivo", rotulo: "Por que arquivar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }]}
        iniciais={{ motivo: "" }}
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/documentos/${doc.id}/arquivar`, { corpo: { versao: doc.versao, motivo: v.motivo } });
          if (r.ok) { setAcao(null); setRecado({ tom: "ok", texto: "Documento arquivado." }); carga.recarregar(); }
          return r;
        }} />
    </div>
  );
}

function NovaVersao({ documentoId, primeira, emVigor, hoje, aoFechar, enviado }: {
  documentoId: string;
  primeira: boolean;
  emVigor?: number;
  hoje: string;
  aoFechar: () => void;
  enviado: (texto: string, tom: "ok" | "atencao") => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [v, setV] = useState({ mudanca: "", vigenteDesde: hoje, aprovadoEm: "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const problema = arquivo ? conferirArquivo(arquivo, TAMANHO_MAXIMO_DOCUMENTO) : null;
  const comErro = camposComErro(erro);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!arquivo || problema) return;
    setErro(null);
    setProgresso(0);
    const corpo = { mudanca: v.mudanca.trim() || null, vigenteDesde: v.vigenteDesde, aprovadoEm: v.aprovadoEm.trim() || null };
    const r = await enviarUm(`/v1/condominio/documentos/${documentoId}/versoes`, corpo, arquivo, (x) => x.versaoId!, setProgresso);
    setProgresso(null);
    if (r.liberado) return enviado(v.vigenteDesde > hoje ? `Versão guardada. Passa a valer em ${mostrarDataCurta(v.vigenteDesde)}.` : "Versão guardada e em vigor.", "ok");
    if (r.erro && camposComErro(r.erro).length) return setErro(r.erro);
    enviado(`${r.nome}: ${r.motivo ?? "não foi liberado."}`, "atencao");
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <label className="grid gap-1 text-sm">
        <span className="text-[13px] font-medium">Arquivo <span className="text-erro">*</span></span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" disabled={progresso !== null}
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        {arquivo ? <span className={`text-xs ${problema ? "text-atencao" : "text-tinta-suave"}`}>{problema ?? `${arquivo.name} · ${mostrarTamanho(arquivo.size)}`}</span>
          : <span className="text-xs text-tinta-suave">PDF ou foto, até 20 MB.</span>}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[13px] font-medium">O que mudou {primeira ? <span className="font-normal text-tinta-suave">(opcional)</span> : <span className="text-erro">*</span>}</span>
        <textarea className="campo min-h-20" maxLength={500} value={v.mudanca} onChange={(e) => setV({ ...v, mudanca: e.target.value })} />
        {comErro.includes("mudanca") ? <span className="text-xs text-erro">Diga o que mudou, de 3 a 500 caracteres.</span> : null}
      </label>
      <CampoTexto id="dv-desde" rotulo="Em vigor desde" type="date" required value={v.vigenteDesde} onChange={(e) => setV({ ...v, vigenteDesde: e.target.value })}
        erro={comErro.includes("vigenteDesde") ? "Diga desde quando vale." : null} />
      <CampoTexto id="dv-aprovado" rotulo="Aprovado em" opcional maxLength={120} placeholder="AGE de 18/10/2026" value={v.aprovadoEm}
        onChange={(e) => setV({ ...v, aprovadoEm: e.target.value })} />
      {!primeira && v.vigenteDesde > hoje ? <Aviso tom="info">A versão {emVigor ?? "atual"} continua valendo até {mostrarDataCurta(v.vigenteDesde)}. Na data, a nova passa a ser a em vigor.</Aviso> : null}
      {progresso !== null ? <progress className="h-1.5 w-full accent-violeta-600" max={100} value={progresso} aria-label="Envio do arquivo" /> : null}
      <p className="text-xs text-tinta-suave">Antes de liberar, o sistema confere o conteúdo e tira a localização das fotos.</p>
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" disabled={progresso !== null} onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={!arquivo || Boolean(problema) || progresso !== null}>{progresso !== null ? "Enviando…" : "Guardar versão"}</Botao>
      </div>
    </form>
  );
}
