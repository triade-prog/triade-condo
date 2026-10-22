"use client";
// Documento aberto (design "Telas dos Comunicados", tela 5; DC15, telas-modelo documento-ficha-*;
// CD-04, CD-07, MP-12): a versão em vigor num cartão com Abrir e Baixar, as outras embaixo com o
// que mudou, quem vê e quem abriu ou baixou. Nova versão é o único botão principal (Enviar o
// arquivo, quando ainda não há); Editar e Arquivar ficam em Mais ações. Nova versão pede o arquivo, o
// que mudou e a data em que passa a valer; até lá, a anterior continua em vigor. Enviar por
// e-mail (design "Mural online e e-mail", tela 7; CD-14): a versão em vigor, por link de 7 dias
// que pode ser cancelado. O trilho de Documentos e memória fica no topo, e o cartão No prontuário
// diz a qual item do prontuário o documento está ligado e abre o item (canvas do novo frontend,
// quadro 84).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { descreverEventoDocumento, descreverValidade, mostrarDataCurta, mostrarTamanho, TAMANHO_MAXIMO_DOCUMENTO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { TrilhoDocumentos } from "../documentos/DocumentosEMemoria.tsx";
import { seloProntuario } from "../memoria/Prontuario.tsx";
import { CartaoFicha, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { DocumentoDetalhe, EnvioDocumento, Prontuario, Recado, VersaoDocumento } from "../tipos.ts";
import { abrirLink, conferirArquivo, enviarUm, nomeTipoDocumento, SeloQuemVe } from "./comum.tsx";
import { camposDocumento, chaveDoItem, documentoParaApi, lerProntuario } from "./Documentos.tsx";

export function Documento() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<DocumentoDetalhe>(id ? `/v1/condominio/documentos/${id}` : null);
  const [acao, setAcao] = useState<"versao" | "editar" | "arquivar" | "email" | null>(busca.get("novo") ? "versao" : null);
  const [cancelar, setCancelar] = useState<EnvioDocumento | null>(null);
  const [recado, setRecado] = useState<Recado>(busca.get("novo") ? { tom: "ok", texto: "Documento guardado. Agora envie o arquivo da versão 1." } : null);
  const prontuario = useCarregar<Prontuario>(id ? "/v1/condominio/memoria/prontuario" : null);
  const voltar = <Link href="/documentos" className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Documentos</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Documento</h1><Vazio titulo="Documento não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o documento…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Documento</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
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

  const mais: ItemMenu[] = d.pode.editar ? [
    { texto: "Editar", icone: "editar", acao: () => setAcao("editar") },
    { texto: "Arquivar…", icone: "sair", perigo: true, acao: () => setAcao("arquivar") },
  ] : [];
  const principal = d.pode.enviar ? <Botao onClick={() => setAcao("versao")}><Icone nome="enviar" />{temVersao ? "Nova versão" : "Enviar o arquivo"}</Botao> : null;
  const emVigor = d.versoes.find((x) => x.emVigor);
  const outras = d.versoes.filter((x) => x !== emVigor);

  return (
    <div className="grid gap-5 max-md:pb-20">
      <TrilhoDocumentos atual="documentos" />
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="t-titulo-tela">{doc.titulo}</h1>
          {doc.descricao ? <p className="t-apoio">{doc.descricao}</p> : null}
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Selo tom="neutro">{nomeTipoDocumento(doc.tipo)}</Selo>
            {doc.emVigor ? <Selo tom="andamento">Versão {doc.emVigor.numero} em vigor</Selo> : <Selo tom="neutro">Sem arquivo</Selo>}
            <SeloQuemVe d={doc} />
            {doc.arquivadoEm ? <Selo tom="neutro">Arquivado</Selo> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {d.pode.enviarEmail ? <Botao variante="contorno" className="max-md:w-11 max-md:px-0" aria-label="Enviar por e-mail" onClick={() => setAcao("email")}><Icone nome="email" /><span className="max-md:hidden">Enviar por e-mail</span></Botao> : null}
          {principal ? <span className="max-md:hidden">{principal}</span> : null}
        </div>
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {doc.arquivamento ? <Aviso tom="info" titulo="Documento arquivado">{doc.arquivamento.por ?? "Alguém"} em {diaHora(doc.arquivamento.em)}. Motivo: {doc.arquivamento.motivo}</Aviso> : null}
      {doc.vencido || doc.vencendo ? <Aviso tom={doc.vencido ? "erro" : "atencao"} titulo={`Validade: ${validade}`}>Guarde a versão renovada quando ela chegar.</Aviso> : null}
      {doc.proxima ? <Aviso tom="info" titulo={`A versão ${doc.proxima.numero} passa a valer em ${mostrarDataCurta(doc.proxima.vigenteDesde)}`}>Até lá, a versão {doc.emVigor?.numero ?? "anterior"} continua em vigor.</Aviso> : null}

      <dl className="grid gap-x-5 gap-y-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1 sm:grid-cols-4 md:px-5">
        <div><dt className="t-apoio">Em vigor desde</dt><dd className="text-[15px]">{doc.emVigor ? mostrarDataCurta(doc.emVigor.vigenteDesde) : "Sem arquivo"}</dd></div>
        <div><dt className="t-apoio">Aprovado em</dt><dd className="text-[15px]">{doc.emVigor?.aprovadoEm ?? "Não informado"}</dd></div>
        <div><dt className="t-apoio">Validade</dt><dd className="text-[15px]">{validade ?? "Sem validade"}</dd></div>
        <div><dt className="t-apoio">Guardado</dt><dd className="text-[15px]">{diaHora(doc.criadoEm)}{doc.criadoPor ? ` por ${doc.criadoPor}` : ""}</dd></div>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <CartaoFicha id="versoes" titulo="Versão em vigor" icone="documento">
          {emVigor ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-linha bg-fundo p-3.5">
              <span className="ladrilho h-11 w-11 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="documento" /></span>
              <span className="grid min-w-0 flex-1">
                <span className="font-semibold [overflow-wrap:anywhere]">Versão {emVigor.numero} · {emVigor.nome}</span>
                <span className="t-apoio">{emVigor.tipo.startsWith("image/") ? "Foto" : "PDF"} {mostrarTamanho(emVigor.tamanho)} · guardado em {diaHora(emVigor.enviadoEm)}{emVigor.enviadoPor ? ` por ${emVigor.enviadoPor}` : ""}</span>
                {emVigor.mudanca ? <span className="text-sm">{emVigor.mudanca}</span> : null}
              </span>
              <span className="flex gap-2 max-md:w-full">
                <Botao variante="contorno" tamanho="m" className="max-md:flex-1" aria-label={`Abrir a versão ${emVigor.numero}`} onClick={() => abrir(emVigor, false)}><Icone nome="olho" />Abrir</Botao>
                <Botao variante="contorno" tamanho="m" className="max-md:flex-1" aria-label={`Baixar a versão ${emVigor.numero}`} onClick={() => abrir(emVigor, true)}><Icone nome="baixar" />Baixar</Botao>
              </span>
            </div>
          ) : (
            <div className="grid justify-items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-violeta-300 bg-violeta-50 px-4 py-5 text-center">
              <span className="ladrilho h-11 w-11 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="enviar" /></span>
              <span className="font-semibold">Ainda não há arquivo em vigor</span>
              <span className="t-apoio">{temVersao ? "A versão guardada passa a valer na data marcada." : "Envie o arquivo. Ele vira a versão 1 e passa a valer na data que você marcar."}</span>
            </div>
          )}
          {outras.length ? (
            <ol aria-label="Outras versões" className="grid border-t border-linha pt-1">
              {outras.map((x) => (
                <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-linha py-3 text-sm first:border-t-0">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{x.numero ? `Versão ${x.numero}` : x.nome}</span>
                      {x.situacao === "LIBERADO" && x.vigenteDesde > d.hoje ? <Selo tom="info">A partir de {mostrarDataCurta(x.vigenteDesde)}</Selo> : null}
                      {x.situacao === "ENVIANDO" ? <Selo tom="info">Verificando</Selo> : null}
                      {x.situacao === "NAO_LIBERADO" ? <Selo tom="atencao">Não liberado</Selo> : null}
                    </span>
                    {x.mudanca ? <span>{x.mudanca}</span> : null}
                    {x.situacao === "NAO_LIBERADO" ? <span className="text-atencao">{x.motivoRecusa}</span> : null}
                    <span className="t-apoio">
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
          ) : emVigor ? <p className="t-apoio border-t border-linha pt-3">Nenhuma versão anterior. Quando chegar a versão {(emVigor.numero ?? 1) + 1}, esta fica guardada aqui embaixo.</p> : null}
          <p className="t-apoio">Abrir e baixar ficam registrados no histórico.</p>
        </CartaoFicha>

        <div className="grid gap-5">
          {prontuario.estado === "pronto" ? <NoProntuario p={prontuario.dados} doc={doc} /> : null}
          <CartaoFicha id="quem-ve" titulo="Quem vê" icone="olho">
            <span className="justify-self-start"><SeloQuemVe d={doc} sempre /></span>
            <p className="text-sm">{doc.restrito ? "Não vai ao mural nem por e-mail. Só quem cuida dos documentos vê."
              : doc.aoMorador ? "Aparece no mural online e o morador pode pedir por e-mail. Quem pede recebe um link que vale 7 dias."
                : "Fica com a gestão. Não aparece no mural e não vai ao morador."}</p>
          </CartaoFicha>
          {d.envios?.length ? (
            <CartaoFicha id="envios" titulo="Enviado por e-mail" icone="email">
              <ul className="grid">
                {d.envios.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-linha py-2.5 text-sm first:border-t-0 first:pt-0">
                    <span className="grid min-w-0 gap-0.5 [overflow-wrap:anywhere]">
                      <span className="font-medium">{e.contato ?? e.para}</span>
                      <span className="t-apoio">
                        {e.pedido ? "Pedido pelo mural · " : ""}{e.numero ? `versão ${e.numero} · ` : ""}{diaHora(e.criadoEm)}
                        {e.cancelado ? " · link cancelado" : e.abertoEm ? ` · aberto ${diaHora(e.abertoEm)}` : e.estado === "NA_FILA" || e.estado === "ENVIANDO" ? " · saindo" : ""}
                      </span>
                    </span>
                    {!e.cancelado && d.pode.editar && (!e.vence || e.vence > new Date().toISOString()) && e.estado !== "FALHOU" ? (
                      <Botao variante="discreto" tamanho="p" aria-label={`Cancelar o link enviado a ${e.contato ?? e.para}`} onClick={() => setCancelar(e)}>Cancelar link</Botao>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CartaoFicha>
          ) : null}
          <CartaoFicha id="historico" titulo="Histórico" icone="relogio">
            {d.historico.length === 0 ? (
              <div className="grid justify-items-center gap-1 py-3 text-center">
                <span className="font-medium">Nada aconteceu com este documento ainda</span>
                <span className="t-apoio">Aberturas, downloads, envios por e-mail e versões novas aparecem aqui.</span>
              </div>
            ) : (
              <ol className="grid">
                {d.historico.map((h, i) => (
                  <li key={i} className="grid gap-0.5 border-t border-linha py-2.5 text-sm first:border-t-0 first:pt-0">
                    <span>{descreverEventoDocumento(h.acao, h.dados)}</span>
                    <span className="t-apoio">{h.autor ?? "Sistema"} · {diaHora(h.em)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CartaoFicha>
        </div>
      </div>

      {principal ? <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 border-t border-linha bg-superficie px-4 py-3 md:hidden [&_button]:w-full">{principal}</div> : null}

      <Dialogo aberto={acao === "email"} titulo={`Enviar por e-mail · ${doc.titulo}`} aoFechar={() => setAcao(null)}>
        {acao === "email" ? (
          <EnviarPorEmail d={d} aoFechar={() => setAcao(null)}
            enviado={(n) => { setAcao(null); setRecado({ tom: "ok", texto: n === 1 ? "Documento enviado por e-mail. O link vale 7 dias." : `Documento enviado a ${n} pessoas. O link vale 7 dias.` }); carga.recarregar(); }} />
        ) : null}
      </Dialogo>
      <Janela aberto={cancelar !== null} titulo="Cancelar o link" textoBotao="Cancelar o link" aoFechar={() => setCancelar(null)}
        explicacao={`O link enviado a ${cancelar?.contato ?? cancelar?.para ?? ""} para de abrir na hora. Quem já baixou o arquivo continua com ele.`}
        campos={[]} iniciais={{}}
        aoSalvar={async () => {
          const r = await chamarApi(`/v1/condominio/documentos/${doc.id}/envios/${cancelar?.id}/cancelar`, { corpo: {} });
          if (r.ok) { setCancelar(null); setRecado({ tom: "ok", texto: "Link cancelado." }); carga.recarregar(); }
          return r;
        }} />

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

/** A qual item do prontuário o documento está ligado; ou o item que falta e parece ser dele. */
function NoProntuario({ p, doc }: { p: Prontuario; doc: DocumentoDetalhe["documento"] }) {
  const itens = p.itens.filter((i) => i.documento?.id === doc.id);
  const sugestao = itens.length ? undefined : lerProntuario(p)(doc)?.sugestao;
  if (!itens.length && !sugestao) return null;
  return (
    <CartaoFicha id="prontuario" titulo="No prontuário" icone="lista">
      <ul className="grid gap-2">
        {itens.map((i) => (
          <li key={chaveDoItem(i)} className="relative flex items-center gap-3 rounded-[14px] border border-linha p-3 hover:bg-violeta-50/50">
            <span className="grid min-w-0 flex-1">
              <Link href={`/documentos/prontuario?item=${encodeURIComponent(chaveDoItem(i))}`} className="font-medium after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{i.nome}</Link>
              <span className="t-apoio">Avisa {i.avisarDias} {i.avisarDias === 1 ? "dia" : "dias"} antes de vencer</span>
            </span>
            {seloProntuario(i)}
            <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
          </li>
        ))}
      </ul>
      {itens.length ? <p className="t-apoio">Este documento vale por {itens.length === 1 ? "este item" : "estes itens"}. A troca da ligação fica no item.</p> : null}
      {sugestao ? (
        <p className="text-sm">
          Parece ser o documento do item {sugestao.nome}, que falta.{" "}
          <Link href={`/documentos/prontuario?item=${encodeURIComponent(chaveDoItem(sugestao))}&ligar=${doc.id}`} className="font-medium text-violeta-600 hover:underline">Ligar ao item</Link>
        </p>
      ) : null}
    </CartaoFicha>
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

function EnviarPorEmail({ d, aoFechar, enviado }: { d: DocumentoDetalhe; aoFechar: () => void; enviado: (n: number) => void }) {
  const [contatos, setContatos] = useState<string[]>([]);
  const [emails, setEmails] = useState("");
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const lista = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ enviados: number }>(`/v1/condominio/documentos/${d.documento.id}/email`, { corpo: { contatos, emails: lista, recado: recado.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    enviado(r.dados.enviados);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {d.contatosComEmail?.length ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">Contatos com e-mail confirmado</legend>
          <div className="grid max-h-52 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
            {d.contatosComEmail.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={contatos.includes(c.id)}
                  onChange={() => setContatos((xs) => (xs.includes(c.id) ? xs.filter((x) => x !== c.id) : [...xs, c.id]))} />
                <span>{c.nome}{c.unidades ? <span className="text-xs text-tinta-suave"> · {c.unidades}</span> : null}</span>
              </label>
            ))}
          </div>
          {comErro.includes("contatos") ? <span className="text-xs text-erro">Escolha de 1 a 20 destinatários.</span> : null}
        </fieldset>
      ) : null}
      <CampoTexto id="de-emails" rotulo="Outros e-mails" opcional value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="advogado@exemplo.com.br"
        ajuda="Separe por vírgula. Para quem não é contato do prédio, como comprador, imobiliária ou advogado."
        erro={comErro.includes("emails") ? "Confira os e-mails." : !d.contatosComEmail?.length && comErro.includes("contatos") ? "Escolha de 1 a 20 destinatários." : null} />
      <label className="grid gap-1 text-sm">
        <span className="text-[13px] font-medium">Recado <span className="font-normal text-tinta-suave">(opcional)</span></span>
        <textarea className="campo min-h-20" maxLength={500} value={recado} onChange={(e) => setRecado(e.target.value)} />
      </label>
      <Aviso tom="info" titulo={d.documento.emVigor ? `Vai a versão ${d.documento.emVigor.numero}, em vigor desde ${mostrarDataCurta(d.documento.emVigor.vigenteDesde)}` : "Vai a versão em vigor"}>
        Por link que vale 7 dias e pode ser cancelado. Depois de baixado, o arquivo não tem mais controle.
      </Aviso>
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
        <Botao type="submit" disabled={enviando || contatos.length + lista.length === 0}>{enviando ? "Enviando…" : "Enviar"}</Botao>
      </div>
    </form>
  );
}
