"use client";
// Configurações › Links e QR (design "Links e QR", telas 1 e 2; AT-30, V-11): tudo o que abre sem
// conta neste condomínio, num lugar só, e as etiquetas por local. As etiquetas são cuidadas aqui
// por quem pode configurar; os links de prestador, na própria manutenção. Na página por tarefa
// (decisão A.1) são duas páginas: "O que abre sem conta" e "Etiquetas por local".

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { descreverEventoEtiqueta, mensagemEtiqueta, RECADO_DIAS } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, type ErroApi, type NomeIcone,
} from "@triade/ui";
import { diaHora } from "./comum.tsx";
import { QrCode } from "./QrCode.tsx";
import { LinkPagina, useAmbiente, useCarregar, naBase } from "./contexto.tsx";
import type { Etiqueta, EtiquetaDetalhe, LinksQr } from "./tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";
import { enderecoEtiqueta } from "./ImprimirEtiquetas.tsx";
import { esquecerLocais } from "./Locais.tsx";

/** Hoje mais n dias, como "AAAA-MM-DD", no relógio do aparelho. */
function diasDepois(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const vezes = (n: number) => (n === 1 ? "1 vez" : `${n} vezes`);
const numeroBonito = (n: string) => n.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "+55 $1 $2-$3");

export function AbaLinksQr({ salvo, parte }: PropsAba & { parte: "etiquetas" | "abertos" }) {
  // As páginas do app (mural, manutenção, impressão) só abrem no app.
  const noApp = useAmbiente().onde === "app";
  const carga = useCarregar<LinksQr>(naBase("/links-qr"));
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando os links…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const emUso = l.etiquetas.filter((e) => e.ativa);
  const aposSalvar = (texto: string) => { esquecerLocais(); carga.recarregar(); salvo(texto); };

  if (parte === "abertos") return (
      <section aria-labelledby="lq-aberto" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
        <h2 id="lq-aberto" className="t-titulo-secao font-medium">Aberto sem conta</h2>
        <ul className="divide-y divide-linha rounded-xl border border-linha">
          <Linha icone="megafone" titulo="Mural do prédio" sub={`Aberto ${vezes(l.mural.aberturas)} em 7 dias`}
            selo={l.mural.ligado ? <Selo tom="ok">Ligado</Selo> : <Selo tom="neutro">Desligado</Selo>}
            acao={<span className="t-texto"><LinkPagina pagina="mural">Mural e e-mail</LinkPagina></span>} />
          <Linha icone="pin" titulo="Etiquetas por local"
            sub={`${emUso.length} em uso · abertas ${vezes(emUso.reduce((s, e) => s + e.aberturas7, 0))} em 7 dias`}
            selo={<Selo tom={emUso.length ? "ok" : "neutro"}>{emUso.length} em uso</Selo>}
            acao={<span className="t-texto"><LinkPagina pagina="etiquetas">Etiquetas</LinkPagina></span>} />
          <Linha icone="ferramenta" titulo="Links de prestador"
            sub={l.prestador.validos ? `${l.prestador.validos} ${l.prestador.validos === 1 ? "válido" : "válidos"} · o primeiro vence ${diaHora(l.prestador.venceEm ?? "")}` : "Nenhum valendo agora"}
            selo={<Selo tom={l.prestador.validos ? "andamento" : "neutro"}>{l.prestador.validos} {l.prestador.validos === 1 ? "válido" : "válidos"}</Selo>} />
          <Linha icone="documento" titulo="Documentos por e-mail"
            sub={l.documentos.validos ? `Links que vencem em até 7 dias` : "Nenhum valendo agora"}
            selo={<Selo tom={l.documentos.validos ? "andamento" : "neutro"}>{l.documentos.validos} {l.documentos.validos === 1 ? "válido" : "válidos"}</Selo>} />
        </ul>
        {l.prestador.links?.length ? (
          <ul className="grid gap-1 t-texto">
            {l.prestador.links.map((x) => (
              <li key={x.id}>
                {noApp ? <Link href={`/manutencao/manutencao?id=${x.manutencaoId}`} className="text-violeta-600 hover:underline">{x.titulo}</Link> : x.titulo}
                <span className="text-tinta-suave"> · {x.para} · vale até {diaHora(x.expiraEm)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="t-apoio text-tinta-suave">Cada link conta quantas vezes foi aberto, sem saber quem abriu. Desligar ou trocar pede motivo e fica no histórico.</p>
      </section>
  );

  return (
    <div className="grid gap-5">
      <section aria-labelledby="lq-etiquetas" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lq-etiquetas" className="t-titulo-secao font-medium">Etiquetas por local</h2>
          <span className="flex flex-wrap gap-2">
            {emUso.length && noApp ? <Link href="/etiquetas" target="_blank" className={classeBotao("contorno", "", "m")}><Icone nome="imprimir" />Imprimir etiquetas</Link> : null}
            {l.podeEditar && l.numeroWhatsapp ? <Botao tamanho="m" onClick={() => setNova(true)}><Icone nome="mais" />Nova etiqueta</Botao> : null}
          </span>
        </div>
        {l.numeroWhatsapp
          ? <Aviso tom="info" titulo={`As etiquetas abrem o WhatsApp do condomínio: ${numeroBonito(l.numeroWhatsapp)}`}>O número é o que a TRÍADE cadastrou na implantação.</Aviso>
          : <Aviso tom="atencao" titulo="O condomínio ainda não tem número de WhatsApp cadastrado">Sem número, não dá para criar etiquetas. Peça à TRÍADE para cadastrar.</Aviso>}
        {l.etiquetas.length === 0 ? (
          <p className="t-apoio text-tinta-suave">Nenhuma etiqueta ainda. Uma etiqueta no elevador, na garagem ou no hall deixa o morador avisar um problema apontando a câmera, com o local já escrito.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-xl border border-linha">
            {l.etiquetas.map((e) => (
              <li key={e.id} className="grid gap-2 px-3 py-2.5 t-texto sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
                <span className="grid min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <button type="button" className="elo" onClick={() => setAberta(e.id)}>{e.local}</button>
                    <span className="font-mono t-codigo text-tinta-suave">{e.rotulo}</span>
                  </span>
                  <span className="t-apoio text-tinta-suave">{[e.onde, e.recadoAte ? `recado até ${diaHora(`${e.recadoAte}T12:00:00`).slice(0, 5)}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="t-apoio text-tinta-suave">Aberta {vezes(e.aberturas7)} em 7 dias</span>
                <span>{e.ativa ? (e.semUso ? <Selo tom="atencao">Sem uso há 90 dias</Selo> : <Selo tom="ok">Em uso</Selo>) : <Selo tom="neutro">Desativada</Selo>}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="t-apoio text-tinta-suave">A etiqueta desativada continua na lista, com o motivo. Quem apontar a câmera para ela vê só que ela não está mais em uso.</p>
      </section>

      {nova ? <FormEtiqueta aoFechar={() => setNova(false)} aoSalvar={(t) => { setNova(false); aposSalvar(t); }} /> : null}
      {aberta ? <EtiquetaAberta id={aberta} aoFechar={() => setAberta(null)} aoMudar={aposSalvar} /> : null}
    </div>
  );
}

function Linha({ icone, titulo, sub, selo, acao }: { icone: NomeIcone; titulo: string; sub: string; selo: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violeta-50 text-violeta-600"><Icone nome={icone} /></span>
      <span className="grid min-w-0 flex-1"><span className="font-medium">{titulo}</span><span className="t-apoio text-tinta-suave">{sub}</span></span>
      {selo}
      {acao}
    </li>
  );
}

/** Nova etiqueta ou alterar a que existe: local, onde fica e o recado que some sozinho. */
function FormEtiqueta({ etiqueta, aoFechar, aoSalvar }: { etiqueta?: Etiqueta; aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const [v, setV] = useState({
    local: etiqueta?.local ?? "", onde: etiqueta?.onde ?? "", recado: etiqueta?.recado ?? "",
    recadoAte: etiqueta?.recadoAte ?? diasDepois(RECADO_DIAS.padrao),
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = { ...v, recadoAte: v.recado.trim() ? v.recadoAte : null, ...(etiqueta ? { versao: etiqueta.versao } : {}) };
    const r = etiqueta
      ? await chamarApi(naBase(`/etiquetas/${etiqueta.id}`), { metodo: "PUT", corpo })
      : await chamarApi(naBase("/etiquetas"), { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(etiqueta ? "Etiqueta salva." : "Etiqueta criada. Imprima e cole no local.");
  }
  return (
    <Dialogo aberto titulo={etiqueta ? `Etiqueta ${etiqueta.rotulo}` : "Nova etiqueta"} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="et-local" rotulo="Local" required maxLength={120} value={v.local} onChange={(e) => setV({ ...v, local: e.target.value })}
          placeholder="Garagem · subsolo 1" ajuda="Vira também uma opção no campo Local de pedidos, manutenção e agenda."
          erro={comErro.includes("local") ? "Diga o local (de 2 a 120 caracteres)." : null} />
        <CampoTexto id="et-onde" rotulo="Onde a etiqueta fica" opcional maxLength={120} value={v.onde} onChange={(e) => setV({ ...v, onde: e.target.value })}
          placeholder="Pilar perto da rampa" ajuda="Só para a gestão achar a etiqueta. Não aparece para quem abre."
          erro={comErro.includes("onde") ? "De 2 a 120 caracteres." : null} />
        <CampoAreaTexto id="et-recado" rotulo="Recado para quem abrir" opcional rows={2} maxLength={300} value={v.recado}
          onChange={(e) => setV({ ...v, recado: e.target.value })} placeholder="Já sabemos do portão travando. O técnico vem na segunda."
          erro={comErro.includes("recado") ? "De 3 a 300 caracteres." : null} />
        {v.recado.trim() ? (
          <CampoTexto id="et-ate" rotulo="O recado some em" type="date" min={diasDepois(0)} max={diasDepois(RECADO_DIAS.maximo)} value={v.recadoAte}
            onChange={(e) => setV({ ...v, recadoAte: e.target.value })} ajuda={`Some sozinho na data; no máximo ${RECADO_DIAS.maximo} dias.`}
            erro={comErro.includes("recadoAte") ? `Escolha entre hoje e daqui a ${RECADO_DIAS.maximo} dias.` : null} />
        ) : null}
        <div className="grid gap-1 rounded-xl border border-linha p-3">
          <span className="t-texto font-medium">A mensagem que já vem escrita</span>
          <span className="rounded-lg bg-violeta-50 px-3 py-2 t-apoio text-violeta-800">{mensagemEtiqueta(v.local.trim() || "…", etiqueta?.rotulo ?? "E··")}</span>
          <span className="t-apoio text-tinta-suave">A pessoa completa o que viu e envia. Ela pode mudar tudo antes de enviar.</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar etiqueta"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** A etiqueta aberta: QR, link, imprimir, alterar, trocar o código, desativar e o histórico. */
function EtiquetaAberta({ id, aoFechar, aoMudar }: { id: string; aoFechar: () => void; aoMudar: (texto: string) => void }) {
  const noApp = useAmbiente().onde === "app";
  const carga = useCarregar<EtiquetaDetalhe>(naBase(`/etiquetas/${id}`));
  const [modo, setModo] = useState<"ver" | "editar" | "trocar" | "desativar">("ver");
  const [copiado, setCopiado] = useState(false);
  if (carga.estado !== "pronto") {
    return (
      <Dialogo aberto titulo="Etiqueta" aoFechar={aoFechar}>
        {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : <Carregando />}
      </Dialogo>
    );
  }
  const { etiqueta: e, historico, podeEditar } = carga.dados;
  const mudou = (texto: string) => { setModo("ver"); carga.recarregar(); aoMudar(texto); };
  if (modo === "editar") return <FormEtiqueta etiqueta={e} aoFechar={() => setModo("ver")} aoSalvar={mudou} />;
  if (modo === "trocar" || modo === "desativar") {
    return <MotivoEtiqueta e={e} acao={modo} aoFechar={() => setModo("ver")} aoFeito={(t) => (modo === "desativar" ? (aoFechar(), aoMudar(t)) : mudou(t))} />;
  }
  const link = enderecoEtiqueta(e.codigo);
  return (
    <Dialogo aberto titulo={`Etiqueta ${e.rotulo} · ${e.local}`} aoFechar={aoFechar}>
      <div className="grid gap-4">
        {!e.ativa ? <Aviso tom="info" titulo="Etiqueta desativada">{e.motivoDesativacao}</Aviso> : null}
        {e.ativa ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-linha bg-white p-2"><QrCode texto={link} rotulo={`QR da etiqueta ${e.rotulo}`} /></div>
            <div className="grid min-w-0 flex-1 gap-2">
              <code className="rounded-lg border border-violeta-200 bg-violeta-50 px-3 py-2 t-apoio break-all text-violeta-800">{link}</code>
              <span className="flex flex-wrap gap-2">
                {noApp ? <Link href={`/etiquetas?ids=${e.id}&tamanho=1`} target="_blank" className={classeBotao("contorno", "", "m")}><Icone nome="imprimir" />Imprimir</Link> : null}
                <Botao variante="discreto" tamanho="m" onClick={() => { void navigator.clipboard?.writeText(link).catch(() => {}); setCopiado(true); }}>
                  <Icone nome="copiar" />{copiado ? "Link copiado" : "Copiar link"}
                </Botao>
              </span>
              <span className="t-apoio text-tinta-suave">Aberta {vezes(e.aberturas7)} nos últimos 7 dias, {vezes(e.aberturasHoje)} hoje. Não sabemos quem abriu.</span>
            </div>
          </div>
        ) : null}
        {e.recado ? <Aviso tom="info" titulo="Recado para quem abrir">{e.recado} Some em {diaHora(`${e.recadoAte}T12:00:00`).slice(0, 5)}.</Aviso> : null}
        {podeEditar ? (
          <span className="flex flex-wrap gap-2">
            <Botao variante="contorno" tamanho="m" onClick={() => setModo("editar")}><Icone nome="editar" />Alterar e recado</Botao>
            <Botao variante="discreto" tamanho="m" onClick={() => setModo("trocar")}><Icone nome="trocar" />Trocar código</Botao>
            <Botao variante="discreto" tamanho="m" className="text-erro" onClick={() => setModo("desativar")}><Icone nome="fechar" />Desativar</Botao>
          </span>
        ) : null}
        <section aria-labelledby="et-hist" className="grid gap-2">
          <h4 id="et-hist" className="font-medium">Histórico</h4>
          <ol className="divide-y divide-linha rounded-xl border border-linha">
            {historico.map((h, i) => (
              <li key={i} className="grid gap-0.5 px-3 py-2 t-texto">
                <span>{descreverEventoEtiqueta(h.acao, h.dados)}</span>
                <span className="t-apoio text-tinta-suave">{h.autor ?? "Sistema"} · {diaHora(h.em)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Dialogo>
  );
}

function MotivoEtiqueta({ e, acao, aoFechar, aoFeito }: { e: Etiqueta; acao: "trocar" | "desativar"; aoFechar: () => void; aoFeito: (texto: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(naBase(`/etiquetas/${e.id}/${acao === "trocar" ? "trocar-codigo" : "desativar"}`), { corpo: { versao: e.versao, motivo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFeito(acao === "trocar" ? `Código da etiqueta ${e.rotulo} trocado. Imprima e cole a nova no mesmo lugar.` : `Etiqueta ${e.rotulo} desativada.`);
  }
  return (
    <Dialogo aberto titulo={acao === "trocar" ? `Trocar o código da etiqueta ${e.rotulo}` : `Desativar a etiqueta ${e.rotulo}`} aoFechar={aoFechar}>
      <div className="grid gap-3">
        <Aviso tom="atencao" titulo="A etiqueta colada para de funcionar na hora">
          Quem apontar a câmera para ela vê que ela não está mais em uso.{acao === "trocar" ? " Imprima e cole a nova no mesmo lugar." : " A desativação não volta."}
        </Aviso>
        {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="et-motivo" rotulo={acao === "trocar" ? "Por que trocar" : "Por que desativar"} required rows={3} maxLength={500} value={motivo}
          onChange={(x) => setMotivo(x.target.value)} erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (de 3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={() => void enviar()} disabled={enviando}>{enviando ? "Salvando…" : acao === "trocar" ? "Trocar código" : "Desativar"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}
