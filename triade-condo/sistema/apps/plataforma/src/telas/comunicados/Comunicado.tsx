"use client";
// Comunicado aberto (design "Telas dos Comunicados", tela 3; CD-01, CD-02, CD-08): o texto como o
// morador lê, com a assinatura; autor, data, versão e para quem à vista. Corrigir cria a versão
// seguinte e guarda a anterior. Sem WhatsApp, o comunicado sai copiado para o grupo do prédio ou
// impresso para o mural, e os dois ficam no histórico. "Como chegou" (design "Mural online e
// e-mail", tela 4; CD-12, CD-13): o mural online, os e-mails enviados, entregues e que voltaram,
// e quantos abriram o link pessoal. O WhatsApp do condomínio (design "Comunicado pelo WhatsApp",
// tela 5; CD-08, W-13, W-14, CD-01): quantas saíram, chegaram, foram lidas e falharam, as que não
// chegaram, sem reenvio, e a correção que pode avisar de novo.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { descreverAlcance, descreverEnvioEmail, descreverEnvioWhatsapp, descreverEventoComunicado, mostrarTamanho, textoParaCopiar } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ComunicadoDetalhe, Recado } from "../tipos.ts";
import { abrirLink, nomeAssunto, PartesComunicados, SeloComunicado } from "./comum.tsx";

const FEITO: Record<string, string> = {
  PUBLICAR: "Comunicado publicado.",
  PROGRAMAR: "Comunicado programado. Ele é publicado sozinho na hora marcada.",
  RASCUNHO: "Rascunho salvo.",
  CORRIGIR: "Correção publicada. A versão anterior ficou guardada como substituída.",
};

/** O motivo vem com maiúscula do provedor e entra no meio da frase ("não chegou (número sem WhatsApp)"). */
function minuscula(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Trocar de versão troca o id: a tela recomeça, com o recado da ação que trouxe até aqui. */
export function Comunicado() {
  const busca = useSearchParams();
  return <ComunicadoAberto key={`${busca.get("id")}-${busca.get("feito")}`} />;
}

function ComunicadoAberto() {
  const busca = useSearchParams();
  const router = useRouter();
  const id = busca.get("id");
  const { atualizar } = usePlataforma();
  const carga = useCarregar<ComunicadoDetalhe>(id ? `/v1/condominio/comunicados/${id}` : null);
  const [acao, setAcao] = useState<"corrigir" | "arquivar" | null>(null);
  const [recado, setRecado] = useState<Recado>(FEITO[busca.get("feito") ?? ""] ? { tom: "ok", texto: FEITO[busca.get("feito")!]! } : null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const voltar = <Link href="/comunicados" className="text-sm font-medium text-violeta-600 hover:underline">Voltar aos comunicados</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Comunicado</h1><Vazio titulo="Comunicado não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o comunicado…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Comunicado</h1><ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }

  const d = carga.dados;
  const c = d.comunicado;
  const atualVersao = d.versoes.find((x) => x.estado === "PUBLICADO" && x.id !== c.id);
  const fotos = d.arquivos.filter((a) => a.situacao === "LIBERADO");

  async function copiar() {
    setFalha(null);
    try {
      await navigator.clipboard.writeText(textoParaCopiar(c));
    } catch {
      return setRecado({ tom: "atencao", texto: "O navegador não deixou copiar. Selecione o texto e copie à mão." });
    }
    const r = await chamarApi(`/v1/condominio/comunicados/${c.id}/uso`, { corpo: { uso: "COPIADO" } });
    if (!r.ok) return setFalha(r.erro);
    setRecado({ tom: "ok", texto: "Texto copiado, com o título e a assinatura. Cole no grupo do prédio." });
    carga.recarregar();
  }

  async function mural(noMural: boolean) {
    setFalha(null);
    const r = await chamarApi(`/v1/condominio/comunicados/${c.id}/mural`, { metodo: "PUT", corpo: { versao: c.versao, noMural } });
    if (!r.ok) return setFalha(r.erro);
    setRecado({ tom: "ok", texto: noMural ? "Comunicado posto no mural online." : "Comunicado tirado do mural online." });
    carga.recarregar();
  }
  const canais = d.canais;
  const email = d.email;
  const whatsapp = d.whatsapp;

  return (
    <div className="grid gap-5">
      <PartesComunicados />
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-[28px] font-normal tracking-tight">{c.titulo}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <SeloComunicado estado={c.estado} />
            <Selo tom="info">{nomeAssunto(c.assunto)}</Selo>
            <Selo tom="andamento">Versão {c.numero}</Selo>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.pode.copiar ? <Botao variante="contorno" onClick={() => void copiar()}>Copiar texto</Botao> : null}
          {d.pode.copiar ? <Link href={`/mural?id=${c.id}`} target="_blank" className={classeBotao("contorno")}>Versão para o mural</Link> : null}
          {d.pode.editar ? <Link href={`/comunicados/escrever?id=${c.id}`} className={classeBotao("primario")}>Editar</Link> : null}
          {d.pode.corrigir ? <Botao onClick={() => setAcao("corrigir")}>Corrigir</Botao> : null}
          {d.pode.arquivar ? <Botao variante="discreto" onClick={() => setAcao("arquivar")}>Arquivar</Botao> : null}
        </div>
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}
      {c.estado === "SUBSTITUIDO" ? (
        <Aviso tom="info" titulo="Esta versão foi trocada">
          {atualVersao ? <>A versão em uso é a {atualVersao.numero}. <Link href={`/comunicados/comunicado?id=${atualVersao.id}`} className="font-medium underline">Ver a versão {atualVersao.numero}</Link></> : "Veja as versões abaixo."}
        </Aviso>
      ) : null}
      {c.arquivamento ? <Aviso tom="info" titulo="Comunicado arquivado">{c.arquivamento.por ?? "Alguém"} em {diaHora(c.arquivamento.em)}. Motivo: {c.arquivamento.motivo}</Aviso> : null}
      {c.estado === "PROGRAMADO" && c.programadoPara ? <Aviso tom="info" titulo={`Programado para ${diaHora(c.programadoPara)}`}>É publicado sozinho na hora marcada. Até lá dá para mudar ou voltar a rascunho.</Aviso> : null}

      <dl className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1 sm:grid-cols-3">
        <div><dt className="text-xs text-tinta-suave">{c.publicadoEm ? "Publicado" : "Escrito"}</dt>
          <dd>{c.publicadoEm ? `${diaHora(c.publicadoEm)} por ${c.publicadoPor ?? "alguém"}` : `${diaHora(c.criadoEm)} por ${c.autor ?? "alguém"}`}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Para quem</dt>
          <dd>{c.publicoResumo}{c.destinatarios !== undefined ? ` · ${c.destinatarios === 1 ? "1 contato" : `${c.destinatarios} contatos`} na publicação` : ""}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Ligado a</dt>
          <dd className="grid">
            {c.pedido ? <Link href={`/pedidos/pedido?id=${c.pedido.id}`} className="text-violeta-600 hover:underline">Pedido {c.pedido.protocolo}</Link> : null}
            {c.pedidoOculto ? <span className="text-tinta-suave">Um pedido que você não vê</span> : null}
            {c.manutencao ? <Link href={`/manutencao/manutencao?id=${c.manutencao.id}`} className="text-violeta-600 hover:underline">Manutenção: {c.manutencao.titulo}</Link> : null}
            {!c.pedido && !c.pedidoOculto && !c.manutencao ? <span className="text-tinta-suave">Nada</span> : null}
          </dd></div>
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section aria-labelledby="t-texto" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-texto" className="text-lg font-medium">Texto</h2>
            <div className="rounded-xl border border-linha bg-superficie-2 p-4 text-[15px] whitespace-pre-line">
              {c.texto}
              {c.assinatura ? <span className="mt-4 block">{c.assinatura}</span> : null}
            </div>
            {fotos.length ? (
              <ul className="grid gap-2">
                {fotos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-linha px-3 py-2 text-sm">
                    <button type="button" className="text-left font-medium text-violeta-600 [overflow-wrap:anywhere] hover:underline"
                      onClick={() => void abrirLink(`/v1/condominio/comunicados/${c.id}/arquivos/${a.id}/link`).then((e) => { if (e) setRecado({ tom: "atencao", texto: e }); })}>
                      {a.nome}
                    </button>
                    <span className="text-xs text-tinta-suave">{a.tipo.startsWith("image/") ? "Foto" : "PDF"} · {mostrarTamanho(a.tamanho)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {fotos.length ? <p className="text-xs text-tinta-suave">Abrem por link de 5 minutos.</p> : null}
          </section>

          <section aria-labelledby="t-versoes" className="grid gap-2">
            <h2 id="t-versoes" className="text-lg font-medium">Versões</h2>
            <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {d.versoes.map((x) => (
                <li key={x.id} className="grid gap-0.5 px-4 py-2.5 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    {x.id === c.id ? <span className="font-medium">Versão {x.numero}</span>
                      : <Link href={`/comunicados/comunicado?id=${x.id}`} className="font-medium text-violeta-600 hover:underline">Versão {x.numero}</Link>}
                    <SeloComunicado estado={x.estado} />
                  </span>
                  {x.mudanca ? <span>{x.mudanca}</span> : null}
                  <span className="text-xs text-tinta-suave">{x.publicadoEm ? `Publicada ${diaHora(x.publicadoEm)}${x.publicadoPor ? ` por ${x.publicadoPor}` : ""}` : "Ainda não publicada"}
                    {x.substituidoEm ? ` · trocada ${diaHora(x.substituidoEm)}` : ""}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid gap-4">
          <section aria-labelledby="t-chega" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
            <h2 id="t-chega" className="text-lg font-medium">{c.estado === "PUBLICADO" || c.estado === "SUBSTITUIDO" ? "Como chegou" : "Como vai chegar"}</h2>
            <ul className="grid gap-2 text-sm">
              {canais?.muralLigado ? (
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha px-3 py-2">
                  <span><span className="block font-medium">Mural online</span>
                    <span className="text-xs text-tinta-suave">{c.publico !== "TODOS" ? "Só comunicado para todo o condomínio vai ao mural."
                      : canais.noMural ? (c.estado === "PUBLICADO" ? "Aparece no mural agora." : "Vai aparecer ao publicar.") : "Fora do mural."}</span></span>
                  {d.pode.mural ? <Botao variante="discreto" tamanho="m" onClick={() => void mural(!canais.noMural)}>{canais.noMural ? "Tirar do mural" : "Pôr no mural"}</Botao> : null}
                </li>
              ) : null}
              {email && (email.total > 0 || canais?.emailLigado) ? (
                <li className="rounded-xl border border-linha px-3 py-2">
                  <span className="block font-medium">E-mail{email.enviados ? ` · ${email.enviados === 1 ? "1 enviado" : `${email.enviados} enviados`}` : ""}</span>
                  <span className="text-xs text-tinta-suave">
                    {email.total === 0 ? (canais?.porEmail ? "Sai ao publicar, para quem tem e-mail confirmado." : "Este comunicado não vai por e-mail.")
                      : descreverEnvioEmail(email) || "Saindo agora."}
                    {email.naFila && email.enviarApos ? ` Esperando o fim do horário sem envio (${diaHora(email.enviarApos)}).` : ""}
                  </span>
                  {email.abertos ? <span className="block text-xs text-tinta-suave">Link pessoal aberto por {email.abertos === 1 ? "1 pessoa" : `${email.abertos} pessoas`}. Não usamos rastreio escondido no e-mail.</span> : null}
                </li>
              ) : null}
              <li className="rounded-xl border border-linha px-3 py-2"><span className="block font-medium">Copiar texto</span><span className="text-xs text-tinta-suave">Para colar no grupo do prédio, com título e assinatura.</span></li>
              <li className="rounded-xl border border-linha px-3 py-2"><span className="block font-medium">Versão para o mural</span><span className="text-xs text-tinta-suave">Folha A4 com o nome do condomínio, a data e a versão.</span></li>
              {whatsapp && (whatsapp.total > 0 || canais?.whatsappLigado) ? (
                <li className="rounded-xl border border-linha px-3 py-2">
                  <span className="block font-medium">WhatsApp do condomínio{whatsapp.total ? ` · ${whatsapp.total === 1 ? "1 mensagem" : `${whatsapp.total} mensagens`}` : ""}</span>
                  <span className="text-xs text-tinta-suave">
                    {whatsapp.total === 0 ? (canais?.porWhatsapp ? "Sai ao publicar, para quem aceitou receber comunicados por lá." : "Este comunicado não vai pelo WhatsApp.")
                      : descreverEnvioWhatsapp(whatsapp) || (whatsapp.enviadas ? `${whatsapp.enviadas === 1 ? "1 enviada" : `${whatsapp.enviadas} enviadas`}` : "Saindo agora.")}
                    {whatsapp.naFila && whatsapp.saiAte ? ` Sai até ${diaHora(whatsapp.saiAte)}.` : ""}
                    {whatsapp.parados ? ` ${whatsapp.parados === 1 ? "1 espera" : `${whatsapp.parados} esperam`} o número voltar, por até 24 horas.` : ""}
                  </span>
                  {whatsapp.abertos ? <span className="block text-xs text-tinta-suave">Link pessoal aberto por {whatsapp.abertos === 1 ? "1 pessoa" : `${whatsapp.abertos} pessoas`}.</span> : null}
                </li>
              ) : null}
            </ul>
            {whatsapp?.total ? <p className="text-xs text-tinta-suave">Lida é o que o WhatsApp informa; quem desligou a confirmação de leitura aparece só como entregue.</p> : null}
            <p className="text-xs text-tinta-suave">Quem recebe agora: {descreverAlcance(d.publicoAgora.contatos, d.publicoAgora.unidades)}. A conta é refeita a cada envio.</p>
          </section>

          {d.problemas?.length ? (
            <section aria-labelledby="t-voltaram" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <h2 id="t-voltaram" className="text-lg font-medium">{d.problemas.some((x) => x.canal === "WHATSAPP") ? "Mensagens que não chegaram" : "E-mails que não chegaram"}</h2>
              <ul className="grid gap-2 text-sm">
                {d.problemas.map((x) => (
                  <li key={x.envioId} className="rounded-xl border border-linha px-3 py-2">
                    <span className="block font-medium">{x.nome}{x.unidades ? ` · ${x.unidades}` : ""}</span>
                    <span className="text-xs text-tinta-suave">
                      <span className="font-medium">{x.canal === "WHATSAPP" ? "WhatsApp" : "E-mail"}: </span>
                      {x.canal === "WHATSAPP"
                        ? (x.estado === "DESCONHECIDO" ? "pode ter saído; o WhatsApp não confirmou."
                          : x.estado === "CANCELADA" ? "não saiu (o número ficou desconectado por mais de 24 horas)."
                          : `não chegou (${minuscula(x.motivo ?? "o WhatsApp recusou")}).`)
                        : x.estado === "SPAM" ? "marcou como spam. Não recebe mais por e-mail."
                        : x.estado === "DEVOLVIDO" ? `${minuscula(x.motivo ?? "endereço não existe")}. O e-mail foi desligado: corrija no cadastro.`
                        : `não saiu (${minuscula(x.motivo ?? "o provedor recusou")}).`}
                    </span>
                  </li>
                ))}
              </ul>
              {d.problemas.some((x) => x.canal === "WHATSAPP")
                ? <p className="text-xs text-tinta-suave">Falha de comunicado não toca o sino de ninguém e não tem reenvio: a pessoa lê pelo grupo, pelo mural ou pelo e-mail.</p> : null}
            </section>
          ) : null}

          <section aria-labelledby="t-hist" className="grid gap-2">
            <h2 id="t-hist" className="text-lg font-medium">Histórico</h2>
            <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {d.historico.map((h, i) => (
                <li key={i} className="grid gap-0.5 px-4 py-2.5 text-sm">
                  <span>{descreverEventoComunicado(h.acao, h.dados)}</span>
                  <span className="text-xs text-tinta-suave">{h.autor ?? "Sistema"} · {diaHora(h.em)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <Janela aberto={acao === "corrigir"} titulo="Corrigir comunicado" textoBotao={`Publicar versão ${c.numero + 1}`} aoFechar={() => setAcao(null)} recarregar={carga.recarregar}
        explicacao={`Vira a versão ${c.numero + 1}. A versão ${c.numero} fica marcada como substituída, com o texto guardado. Quem já copiou ou imprimiu a versão ${c.numero} continua com ela: avise de novo pelo mesmo caminho.`}
        campos={[
          { id: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, max: 120, erro: "De 3 a 120 caracteres." },
          { id: "texto", rotulo: "Texto", tipo: "area", obrigatorio: true, max: 4000, erro: "De 3 a 4000 caracteres, diferente do atual." },
          { id: "mudanca", rotulo: "O que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o que mudou, de 3 a 500 caracteres." },
          ...(d.pode.avisarEmail ? [{ id: "avisarEmail", rotulo: `Avisar por e-mail quem recebeu a versão ${c.numero}`, tipo: "caixa" as const,
            ajuda: `O e-mail começa com o que mudou. Desligado, a versão ${c.numero + 1} só aparece no mural e no link pessoal.` }] : []),
          ...(d.pode.avisarWhatsapp ? [{ id: "avisarWhatsapp", rotulo: `Avisar pelo WhatsApp quem recebeu a versão ${c.numero}`, tipo: "caixa" as const,
            ajuda: `A mensagem começa com "Corrigido:". Desligado, a versão ${c.numero + 1} só aparece no mural e no link pessoal, que sempre abre a versão mais nova.` }] : []),
        ]}
        iniciais={{ titulo: c.titulo, texto: c.texto, mudanca: "", avisarEmail: false, avisarWhatsapp: false }}
        aoSalvar={async (v) => {
          const r = await chamarApi<{ id: string }>(`/v1/condominio/comunicados/${c.id}/corrigir`, {
            corpo: { versao: c.versao, titulo: v.titulo, texto: v.texto, mudanca: v.mudanca, avisarEmail: v.avisarEmail === true,
              avisarWhatsapp: v.avisarWhatsapp === true } });
          if (r.ok) { setAcao(null); atualizar(); router.push(`/comunicados/comunicado?id=${r.dados.id}&feito=CORRIGIR`); }
          return r;
        }} />
      <Janela aberto={acao === "arquivar"} titulo="Arquivar comunicado" textoBotao="Arquivar" aoFechar={() => setAcao(null)} recarregar={carga.recarregar}
        explicacao="Sai da lista em uso e não volta. Nada é apagado: o texto e as versões ficam guardados."
        campos={[{ id: "motivo", rotulo: "Por que arquivar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }]}
        iniciais={{ motivo: "" }}
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/comunicados/${c.id}/arquivar`, { corpo: { versao: c.versao, motivo: v.motivo } });
          if (r.ok) { setAcao(null); setRecado({ tom: "ok", texto: "Comunicado arquivado." }); carga.recarregar(); atualizar(); }
          return r;
        }} />
    </div>
  );
}
