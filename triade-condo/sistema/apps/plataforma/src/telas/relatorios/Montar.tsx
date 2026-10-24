"use client";
// Montar o relatório do mês (TR-02, TR-05, TR-10; canvas do novo frontend, quadros 232 e 233,
// decisões B.1 e C.1 de 23/10/2026). Só mês fechado. As partes vêm marcadas pelo modelo do
// condomínio (ou pelo relatório de onde se gera de novo); a parte que a pessoa não pode ver fica
// trancada, com o porquê. O resumo vem escrito com os números e dá para mudar; a palavra do
// síndico é texto livre. Os anexos são documentos de Documentos ou arquivos enviados aqui, até 10,
// só fotos JPG e PNG e PDF. Ao lado, os números do mês e o "guardar como modelo".

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ANEXOS_POR_RELATORIO, conferirAnexoRelatorio, letraDoAnexo, mostrarHoras, mostrarPorcentagem, nomeDoMes, ORDEM_PARTES, PARTES_RELATORIO, PERMISSOES,
  resumoSugerido, tituloDoMes, TIPOS_ANEXO_RELATORIO, type NumerosRelatorio, type ParteRelatorio, type RelatorioGerado,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, SemPermissao, Selo, textoDoErro, type ErroApi,
} from "@triade/ui";
import { enviarUm } from "../comunicados/comum.tsx";
import { CartaoFicha } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DocumentoResumo, ListaDocumentos } from "../tipos.ts";
import { Voltar, type ListaRelatorios } from "./comum.tsx";

type Previa = NumerosRelatorio & { ultimoNumero: number | null };
type TipoAnexo = (typeof TIPOS_ANEXO_RELATORIO)[number];
interface Anexo { chave: string; titulo: string; tipo: TipoAnexo; arquivoId?: string; documentoId?: string; origem: "ENVIADO" | "DOCUMENTO" }

const TEXTO_TIPO: Record<TipoAnexo, string> = { "image/jpeg": "Foto", "image/png": "Foto", "application/pdf": "PDF" };
const POR_QUE_TRANCADA: Partial<Record<ParteRelatorio, string>> = {
  DECISOES: `Precisa da permissão ${PERMISSOES.APROVAR}. Quem tem pode gerar o relatório com esta parte.`,
};

/** O tipo do documento pela versão em vigor: o PDF do relatório só junta foto JPG ou PNG e PDF. */
function tipoDoDocumento(d: DocumentoResumo): TipoAnexo | null {
  const nome = d.emVigor?.nome.toLowerCase() ?? "";
  if (nome.endsWith(".pdf")) return "application/pdf";
  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function Secao({ n, titulo, apoio, children }: { n: number; titulo: string; apoio?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`t-montar-${n}`} className="grid gap-4 border-t border-linha py-6 first:border-t-0 first:pt-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2.5">
          <span className="numero" aria-hidden="true">{n}</span>
          <h2 id={`t-montar-${n}`} className="t-titulo-cartao">{titulo}</h2>
        </div>
        {apoio ? <p className="t-apoio">{apoio}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Montar() {
  const { pode } = usePlataforma();
  const busca = useSearchParams();
  const lista = useCarregar<ListaRelatorios>(pode("pedidos.ver") ? "/v1/condominio/relatorios" : null);
  const mes = busca.get("mes") ?? (lista.estado === "pronto" ? lista.dados.mesFechado : null);
  const de = busca.get("de");
  const previa = useCarregar<Previa>(mes && pode("pedidos.ver") ? `/v1/condominio/relatorios/previa?mes=${mes}` : null);
  const anterior = useCarregar<RelatorioGerado>(de ? `/v1/condominio/relatorios/${de}` : null);
  const voltar = <Voltar href="/indicadores/relatorios" texto="Relatórios do mês" />;
  const titulo = <h1 className="t-titulo-tela font-normal tracking-tight">Montar o relatório do mês</h1>;

  if (!pode("pedidos.ver")) return <SemPermissao tela="Relatórios do mês" permissao={PERMISSOES.ACOMPANHAR} />;
  const erro = lista.estado === "erro" ? lista : previa.estado === "erro" ? previa : de && anterior.estado === "erro" ? anterior : null;
  if (erro) return <div className="grid gap-3">{voltar}{titulo}<ErroCarregar erro={erro.erro} texto={erro.texto} tentarDeNovo={erro.recarregar} /></div>;
  if (lista.estado !== "pronto" || previa.estado !== "pronto" || (de && anterior.estado !== "pronto")) {
    return <div className="grid gap-3">{voltar}{titulo}<Carregando rotulo="Calculando os números do mês…" /></div>;
  }
  const base = de && anterior.estado === "pronto" && anterior.dados.mes === previa.dados.mes ? anterior.dados : null;
  return <Formulario key={`${previa.dados.mes}-${base?.id ?? ""}`} lista={lista.dados} previa={previa.dados} base={base} voltar={voltar} />;
}

function Formulario({ lista, previa, base, voltar }: { lista: ListaRelatorios; previa: Previa; base: RelatorioGerado | null; voltar: ReactNode }) {
  const router = useRouter();
  const fora = previa.foraPorPermissao;
  const marcadas = (base?.partes ?? lista.modelo.partes).filter((p) => !fora.includes(p));
  const [partes, setPartes] = useState<ParteRelatorio[]>(marcadas);
  const [resumo, setResumo] = useState(base?.resumo ?? resumoSugerido(previa));
  const [palavra, setPalavra] = useState(base?.palavra ?? "");
  const [anexos, setAnexos] = useState<Anexo[]>(() => (base?.anexos ?? []).map((a) => ({
    chave: `${a.ordem}-${a.arquivoId ?? a.documentoId}`, titulo: a.titulo, tipo: a.tipo, origem: a.origem,
    ...(a.origem === "DOCUMENTO" ? { documentoId: a.documentoId } : { arquivoId: a.arquivoId }),
  })));
  const [guardar, setGuardar] = useState(false);
  const [enviando, setEnviando] = useState<{ nome: string; progresso: number } | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [escolherDoc, setEscolherDoc] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const a = previa.atendimento?.atual;
  const cheio = anexos.length >= ANEXOS_POR_RELATORIO;

  const tem = (p: ParteRelatorio) => partes.includes(p);
  const marcar = (p: ParteRelatorio, sim: boolean) => setPartes((x) => ORDEM_PARTES.filter((o) => (o === p ? sim : x.includes(o))));
  const faltaResumo = tem("RESUMO") && !resumo.trim();
  const faltaPalavra = tem("PALAVRA") && !palavra.trim();
  const semPartes = partes.length === 0;

  async function enviar(lista: FileList | null) {
    if (!lista?.length) return;
    const ruins: string[] = [];
    let total = anexos.length;
    for (const f of [...lista]) {
      if (total >= ANEXOS_POR_RELATORIO) { ruins.push(`${f.name}: já há ${ANEXOS_POR_RELATORIO} anexos, o máximo.`); continue; }
      const problema = conferirAnexoRelatorio(f);
      if (problema) { ruins.push(`${f.name} ${problema}`); continue; }
      setEnviando({ nome: f.name, progresso: 0 });
      // O id vem do início do envio; a conferência só diz se liberou.
      let id = "";
      const r = await enviarUm("/v1/condominio/relatorios/anexos", {}, f, (d) => (id = d.arquivoId!), (p) => setEnviando({ nome: f.name, progresso: p }));
      setEnviando(null);
      if (!r.liberado) { ruins.push(`${f.name}: ${r.motivo ?? "não foi liberado."}`); continue; }
      total++;
      setAnexos((x) => [...x, { chave: id, titulo: f.name, tipo: f.type as TipoAnexo, arquivoId: id, origem: "ENVIADO" }]);
    }
    setProblemas(ruins);
    if (arquivo.current) arquivo.current.value = "";
  }

  async function gerar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (semPartes || faltaResumo || faltaPalavra) return;
    setGerando(true);
    setErro(null);
    const r = await chamarApi<{ id: string }>("/v1/condominio/relatorios", {
      corpo: {
        mes: previa.mes, partes, resumo: tem("RESUMO") ? resumo : null, palavra: tem("PALAVRA") ? palavra : null,
        anexos: anexos.map((x) => (x.documentoId ? { documentoId: x.documentoId } : { arquivoId: x.arquivoId })), guardarModelo: guardar,
      },
    });
    setGerando(false);
    if (!r.ok) { setErro(r.erro); return; }
    router.push(`/indicadores/relatorio?id=${r.dados.id}&novo=1`);
  }

  const versao = (previa.ultimoNumero ?? 0) + 1;
  const numeros = (
    <CartaoFicha id="numeros" titulo={`Números de ${nomeDoMes(previa.mes)}`} icone="grafico">
      {a ? (
        <ul className="grid t-texto">
          {[
            ["Registrados", String(a.registrados)], ["Concluídos", String(a.concluidos)], ["Reabertos", String(a.reabertos)],
            ["Retornos no prazo", a.retornos.total ? mostrarPorcentagem(a.retornos.porcentagem) : "sem dados"],
            ["Primeiro retorno, em média", mostrarHoras(a.primeiroRetornoHoras)],
          ].map(([r, v]) => (
            <li key={r} className="flex items-center justify-between gap-3 border-t border-linha py-2.5 first:border-t-0">
              <span>{r}</span><span className={`font-semibold ${v === "sem dados" || v === "Sem dados" ? "text-tinta-suave" : ""}`}>{v}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="t-apoio">Os números ficam como estão na hora de gerar. Se um pedido do mês mudar depois, gere de novo: vira a versão {versao + 1}.</p>
      <label className="flex items-start gap-3 rounded-[14px] border border-linha p-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-violeta-600" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
        <span className="grid gap-0.5"><span className="font-medium">Guardar estas escolhas como o modelo dos próximos meses</span>
          <span className="t-apoio">As partes marcadas já vêm assim no mês que vem. Os textos e os anexos não entram no modelo.</span></span>
      </label>
    </CartaoFicha>
  );

  return (
    <form onSubmit={gerar} noValidate className="grid gap-5">
      {voltar}
      <div className="grid gap-1">
        <h1 className="t-titulo-tela font-normal tracking-tight">Montar o relatório do mês</h1>
        <p className="t-apoio">Escolha o que entra, escreva o que quiser dizer e junte os anexos. Sai um PDF só, para a assembleia ou o conselho.</p>
      </div>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {base ? <Aviso tom="info" titulo={`Gerando de novo a partir da versão ${base.numero}`}>As partes, os textos e os anexos vieram de lá. Os números são os de agora.</Aviso> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[18px] border border-linha bg-superficie px-6 shadow-s1 max-md:px-4">
          <Secao n={1} titulo="Mês">
            <CampoSelecao id="rm-mes" rotulo="Mês fechado" className="max-w-sm" value={previa.mes}
              onChange={(e) => router.replace(`/indicadores/relatorios/montar?mes=${e.target.value}`, { scroll: false })}
              opcoes={lista.meses.map((m) => ({ valor: m, texto: tituloDoMes(m) }))}
              ajuda={`${previa.ultimoNumero ? `Já há ${previa.ultimoNumero === 1 ? "1 versão" : `${previa.ultimoNumero} versões`} deste mês: esta será a versão ${versao}. ` : ""}O mês em andamento não entra: os números ainda mudam.`} />
          </Secao>

          <Secao n={2} titulo="Partes do relatório" apoio="Saem nesta ordem, numeradas, no PDF e na planilha.">
            {fora.length ? <Aviso tom="atencao" titulo={fora.length === 1 ? "Uma parte não entra porque você não tem acesso a ela" : "Algumas partes não entram porque você não tem acesso a elas"}>
              {fora.map((p) => PARTES_RELATORIO[p].titulo).join(", ")}: quem tem acesso pode gerar o relatório com {fora.length === 1 ? "ela" : "elas"}.</Aviso> : null}
            <fieldset className="grid gap-2">
              <legend className="sr-only">Partes do relatório</legend>
              {ORDEM_PARTES.map((p) => {
                const trancada = fora.includes(p);
                return (
                  <label key={p} className={`flex items-start gap-3 rounded-[14px] border p-3 ${trancada ? "border-linha bg-fundo text-tinta-suave" : tem(p) ? "border-violeta-300 bg-violeta-50" : "border-linha"}`}>
                    <input type="checkbox" className="mt-0.5 h-5 w-5 accent-violeta-600" checked={tem(p)} disabled={trancada} onChange={(e) => marcar(p, e.target.checked)}
                      aria-describedby={`rm-apoio-${p}`} />
                    <span className="grid flex-1 gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">{PARTES_RELATORIO[p].titulo}
                        {trancada ? <Selo tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />sem acesso</Selo> : null}</span>
                      <span id={`rm-apoio-${p}`} className="t-apoio">{trancada ? POR_QUE_TRANCADA[p] ?? "Você não tem acesso a esta parte." : PARTES_RELATORIO[p].apoio}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {tentou && semPartes ? <p className="t-apoio text-erro" role="alert">Marque ao menos uma parte.</p> : null}
          </Secao>

          {tem("RESUMO") || tem("PALAVRA") ? (
            <Secao n={3} titulo="Textos">
              {tem("RESUMO") ? (
                <CampoAreaTexto id="rm-resumo" rotulo="Resumo" value={resumo} maxLength={2000} onChange={(e) => setResumo(e.target.value)}
                  ajuda={<>Veio escrito com os números do mês. <button type="button" className="elo" onClick={() => setResumo(resumoSugerido(previa))}>Voltar ao texto pronto</button></>}
                  erro={tentou && faltaResumo ? "Escreva o resumo ou desmarque a parte." : undefined} />
              ) : null}
              {tem("PALAVRA") ? (
                <CampoAreaTexto id="rm-palavra" rotulo="Palavra do síndico" value={palavra} maxLength={3000} onChange={(e) => setPalavra(e.target.value)}
                  placeholder="O que foi feito no mês, o que vem pela frente, um agradecimento."
                  erro={tentou && faltaPalavra ? "Escreva a palavra do síndico ou desmarque a parte." : undefined} />
              ) : null}
            </Secao>
          ) : null}

          <Secao n={tem("RESUMO") || tem("PALAVRA") ? 4 : 3} titulo="Anexos"
            apoio={`Até ${ANEXOS_POR_RELATORIO}. Fotos JPG ou PNG entram na folha; PDF segue depois dela, no mesmo arquivo.`}>
            {anexos.length ? (
              <ol className="grid gap-2" aria-label="Anexos do relatório">
                {anexos.map((x, i) => (
                  <li key={x.chave} className="flex items-center gap-3 rounded-[14px] border border-linha p-3">
                    <span className="ladrilho h-9 w-9 rounded-[10px]" data-tom={x.tipo === "application/pdf" ? "violeta" : "info"} aria-hidden="true">
                      <Icone nome={x.tipo === "application/pdf" ? "documento" : "camera"} className="h-4 w-4" /></span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">Anexo {letraDoAnexo(i)} · {x.titulo}</span>
                      <span className="t-apoio">{TEXTO_TIPO[x.tipo]} · {x.origem === "DOCUMENTO" ? "de Documentos, na versão em vigor" : "enviado aqui"}</span>
                    </span>
                    <Botao variante="discreto" tamanho="p" soIcone aria-label={`Tirar ${x.titulo}`} onClick={() => setAnexos((y) => y.filter((z) => z !== x))}>
                      <Icone nome="fechar" /></Botao>
                  </li>
                ))}
              </ol>
            ) : <p className="t-apoio">Nenhum anexo. Dá para gerar sem.</p>}
            {enviando ? <p className="t-apoio" role="status">Enviando {enviando.nome}… {Math.round(enviando.progresso)}%</p> : null}
            {problemas.length ? <Aviso tom="atencao" titulo="Não entrou">{problemas.join(" ")}</Aviso> : null}
            <div className="flex flex-wrap gap-2">
              <Botao variante="contorno" disabled={cheio || !lista.pode.documentos || !!enviando} onClick={() => setEscolherDoc(true)}>
                <Icone nome="documento" />Dos documentos</Botao>
              <Botao variante="contorno" disabled={cheio || !!enviando} onClick={() => arquivo.current?.click()}><Icone nome="clipe" />Enviar arquivo</Botao>
              <input ref={arquivo} type="file" multiple accept={TIPOS_ANEXO_RELATORIO.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(e) => void enviar(e.target.files)} />
            </div>
            {!lista.pode.documentos ? <p className="t-apoio">Para juntar um documento, é preciso a permissão de ver Documentos.</p> : null}
          </Secao>
        </div>
        <div className="lg:sticky lg:top-6">{numeros}</div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-linha bg-superficie px-4 py-3 shadow-s2 max-md:bottom-[calc(61px+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        <span className="t-apoio flex items-center gap-2 max-md:hidden"><Icone nome="info" className="h-4 w-4" />{tituloDoMes(previa.mes)} · versão {versao} · {partes.length} {partes.length === 1 ? "parte" : "partes"}</span>
        <span className="flex flex-1 justify-end gap-2 md:flex-none">
          <Botao variante="contorno" onClick={() => router.push("/indicadores/relatorios")}>Cancelar</Botao>
          <Botao type="submit" disabled={gerando || !!enviando} className="max-md:flex-1"><Icone nome="documento" />{gerando ? "Gerando…" : "Gerar o relatório"}</Botao>
        </span>
      </div>
      <EscolherDocumento aberto={escolherDoc} aoFechar={() => setEscolherDoc(false)} ja={anexos.flatMap((x) => (x.documentoId ? [x.documentoId] : []))}
        aoEscolher={(d, tipo) => { setAnexos((x) => [...x, { chave: d.id, titulo: d.titulo, tipo, documentoId: d.id, origem: "DOCUMENTO" }]); setEscolherDoc(false); }} />
    </form>
  );
}

function EscolherDocumento({ aberto, aoFechar, ja, aoEscolher }: {
  aberto: boolean; aoFechar: () => void; ja: string[]; aoEscolher: (d: DocumentoResumo, tipo: TipoAnexo) => void;
}) {
  const carga = useCarregar<ListaDocumentos>(aberto ? "/v1/condominio/documentos" : null);
  const itens = carga.estado === "pronto" ? carga.dados.itens.filter((d) => d.emVigor && !d.arquivadoEm) : [];
  return (
    <Dialogo aberto={aberto} titulo="Juntar um documento" aoFechar={aoFechar} media
      apoio="Entra a versão em vigor. Documento restrito só aparece para quem pode ver os restritos.">
      {carga.estado === "carregando" ? <Carregando rotulo="Abrindo os documentos…" /> : carga.estado === "erro"
        ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
        : itens.length ? (
          <ul className="grid gap-2" aria-label="Documentos">
            {itens.map((d) => {
              const tipo = tipoDoDocumento(d);
              const usado = ja.includes(d.id);
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-[14px] border border-linha p-3">
                  <span className="ladrilho h-9 w-9 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="documento" className="h-4 w-4" /></span>
                  <span className="grid min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">{d.titulo}{d.restrito ? <Selo tom="atencao">restrito</Selo> : null}</span>
                    <span className="t-apoio">{tipo ? `${TEXTO_TIPO[tipo]} · versão ${d.emVigor!.numero}` : "Não entra no PDF: só foto JPG ou PNG e PDF."}</span>
                  </span>
                  <Botao variante="contorno" tamanho="p" disabled={!tipo || usado} onClick={() => tipo && aoEscolher(d, tipo)}
                    aria-label={usado ? `${d.titulo} já está nos anexos` : `Juntar ${d.titulo}`}>{usado ? "Já está" : "Juntar"}</Botao>
                </li>
              );
            })}
          </ul>
        ) : <p className="t-apoio">Nenhum documento com versão em vigor.</p>}
    </Dialogo>
  );
}
