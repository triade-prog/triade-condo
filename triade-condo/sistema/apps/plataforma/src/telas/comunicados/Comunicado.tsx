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
import { useState, type ReactNode } from "react";
import { descreverAlcance, descreverEnvioEmail, descreverEnvioWhatsapp, descreverEventoComunicado, mostrarTamanho, textoParaCopiar } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi, type NomeIcone, type Tom } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { CartaoFicha, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ComunicadoDetalhe, Recado } from "../tipos.ts";
import { abrirLink, nomeAssunto, SeloComunicado } from "./comum.tsx";

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

/** Uma linha de "Como chegou": o canal, como foi e, à direita, a ação dele. */
function Canal({ icone, tom, titulo, apoio, acao }: { icone: NomeIcone; tom: Tom; titulo: string; apoio: ReactNode; acao?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-linha py-3 first:border-t-0 first:pt-0">
      <span className="ladrilho h-9 w-9 shrink-0 rounded-[11px]" data-tom={tom} aria-hidden="true"><Icone nome={icone} className="h-4.5 w-4.5" /></span>
      <span className="grid min-w-0 flex-1"><span className="font-medium">{titulo}</span><span className="t-apoio">{apoio}</span></span>
      {acao}
    </li>
  );
}

/** O ícone e a cor de cada passo do andamento. */
function marcaDoEvento(acao: string, dados: Record<string, unknown>): { icone: NomeIcone; tom: Tom } {
  if (acao === "comunicado.publicado" || acao === "comunicado.corrigido") return { icone: "megafone", tom: "ok" };
  if (acao === "comunicado.programado") return { icone: "relogio", tom: "info" };
  if (acao === "comunicado.email_na_fila") return { icone: "email", tom: "info" };
  if (acao === "comunicado.whatsapp_na_fila") return { icone: "whats", tom: "ok" };
  if (acao === "comunicado.copiado") return { icone: "copiar", tom: "andamento" };
  if (acao === "comunicado.mural") return { icone: "imprimir", tom: "andamento" };
  if (acao === "comunicado.mural_ligado" || acao === "comunicado.mural_tirado") return { icone: "casa", tom: "neutro" };
  if (acao.startsWith("comunicado.arquivo")) return { icone: "clipe", tom: "neutro" };
  if (acao === "estado.mudou" && dados.para === "ARQUIVADO") return { icone: "sair", tom: "neutro" };
  return { icone: "editar", tom: "neutro" };
}

/** Andamento (decisão A.1 de 21/10/2026): as versões e o histórico numa linha do tempo só. Cada
 * publicação e correção leva à sua versão; o mais novo fica no fim. */
function Andamento({ d }: { d: ComunicadoDetalhe }) {
  const c = d.comunicado;
  const itens = [...d.historico].sort((a, b) => a.em.localeCompare(b.em));
  const versaoDe = (dados: Record<string, unknown>) => d.versoes.find((x) => x.numero === Number(dados.numero));
  return (
    <CartaoFicha id="andamento" titulo="Andamento" icone="relogio">
      {itens.length === 0 ? <p className="t-apoio">Nada aconteceu com este comunicado ainda.</p> : (
        <ol className="grid">
          {itens.map((h, i) => {
            const m = marcaDoEvento(h.acao, h.dados);
            const versao = h.acao === "comunicado.publicado" || h.acao === "comunicado.corrigido" ? versaoDe(h.dados) : undefined;
            const ultimo = i === itens.length - 1;
            return (
              <li key={i} className={`relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 ${ultimo ? "" : "pb-4 before:absolute before:top-10 before:bottom-0 before:left-[18px] before:w-px before:bg-linha"}`}>
                <span className="ladrilho h-9 w-9 rounded-full" data-tom={m.tom} aria-hidden="true"><Icone nome={m.icone} className="h-4.5 w-4.5" /></span>
                <div className="grid gap-0.5 pt-1">
                  <p className="font-medium">{descreverEventoComunicado(h.acao, h.dados)}</p>
                  <p className="t-apoio">{diaHora(h.em)} · {h.autor ?? "Sistema"}</p>
                  {versao && versao.id !== c.id ? (
                    <Link href={`/comunicados/comunicado?id=${versao.id}`} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Ver a versão {versao.numero}</Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {d.versoes.length > 1 || c.estado === "PUBLICADO" ? (
        <p className="t-apoio">{c.estado === "PUBLICADO" ? `Corrigir cria a versão ${c.numero + 1} aqui mesmo. A versão ${c.numero} continua guardada.` : `${d.versoes.length} versões guardadas, nenhuma apagada.`}</p>
      ) : null}
    </CartaoFicha>
  );
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
  const voltar = <Link href="/comunicados" className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Comunicados</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Comunicado</h1><Vazio titulo="Comunicado não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o comunicado…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Comunicado</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
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
  const publicado = c.estado === "PUBLICADO" || c.estado === "SUBSTITUIDO";
  const mais: ItemMenu[] = d.pode.arquivar ? [{ texto: "Arquivar…", icone: "sair", perigo: true, rotulo: "Arquivar…", acao: () => setAcao("arquivar") }] : [];

  return (
    <div className="grid gap-5 max-md:pb-20">
      <Link href="/comunicados" className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Comunicados</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="t-titulo-tela">{c.titulo}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <SeloComunicado estado={c.estado} />
            <Selo tom="neutro">{nomeAssunto(c.assunto)}</Selo>
            <Selo tom="andamento">Versão {c.numero}</Selo>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {d.pode.editar ? <Link href={`/comunicados/escrever?id=${c.id}`} className={`${classeBotao("primario")} max-md:hidden`}><Icone nome="editar" />Editar</Link> : null}
          {d.pode.corrigir ? <Botao className="max-md:hidden" onClick={() => setAcao("corrigir")}><Icone nome="editar" />Corrigir</Botao> : null}
        </div>
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}
      {c.estado === "SUBSTITUIDO" ? (
        <Aviso tom="info" titulo="Esta versão foi trocada">
          {atualVersao ? <>A versão em uso é a {atualVersao.numero}. <Link href={`/comunicados/comunicado?id=${atualVersao.id}`} className="font-medium underline">Ver a versão {atualVersao.numero}</Link></> : "Veja as versões no andamento."}
        </Aviso>
      ) : null}
      {c.arquivamento ? <Aviso tom="info" titulo="Comunicado arquivado">{c.arquivamento.por ?? "Alguém"} em {diaHora(c.arquivamento.em)}. Motivo: {c.arquivamento.motivo}</Aviso> : null}
      {c.estado === "PROGRAMADO" && c.programadoPara ? <Aviso tom="info" titulo={`Programado para ${diaHora(c.programadoPara)}`}>É publicado sozinho na hora marcada. Até lá dá para mudar ou voltar a rascunho.</Aviso> : null}

      <dl className="grid gap-x-5 gap-y-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1 sm:grid-cols-3 md:px-5">
        <div><dt className="t-apoio">{c.publicadoEm ? "Publicado" : "Escrito"}</dt>
          <dd className="text-[15px]">{c.publicadoEm ? `${diaHora(c.publicadoEm)} por ${c.publicadoPor ?? "alguém"}` : `${diaHora(c.criadoEm)} por ${c.autor ?? "alguém"}`}</dd></div>
        <div><dt className="t-apoio">Para quem</dt>
          <dd className="text-[15px]">{c.publicoResumo}{c.destinatarios !== undefined ? ` · ${c.destinatarios === 1 ? "1 contato" : `${c.destinatarios} contatos`} na publicação` : ""}</dd></div>
        <div><dt className="t-apoio">Ligado a</dt>
          <dd className="grid text-[15px]">
            {c.pedido ? <Link href={`/pedidos/pedido?id=${c.pedido.id}`} className="text-violeta-600 hover:underline">Pedido {c.pedido.protocolo}</Link> : null}
            {c.pedidoOculto ? <span className="text-tinta-suave">Um pedido que você não vê</span> : null}
            {c.manutencao ? <Link href={`/manutencao/manutencao?id=${c.manutencao.id}`} className="text-violeta-600 hover:underline">Manutenção: {c.manutencao.titulo}</Link> : null}
            {!c.pedido && !c.pedidoOculto && !c.manutencao ? <span className="text-tinta-suave">Nada</span> : null}
          </dd></div>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <CartaoFicha id="texto" titulo="Texto" icone="documento">
            <div className="text-base leading-relaxed whitespace-pre-line">{c.texto}</div>
            {c.assinatura ? <p className="t-apoio text-[15px]">{c.assinatura}</p> : null}
            {fotos.length ? (
              <ul className="grid gap-2">
                {fotos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-[14px] border border-linha px-3 py-2 text-sm">
                    <button type="button" className="flex items-center gap-2 text-left font-medium text-violeta-600 [overflow-wrap:anywhere] hover:underline"
                      onClick={() => void abrirLink(`/v1/condominio/comunicados/${c.id}/arquivos/${a.id}/link`).then((e) => { if (e) setRecado({ tom: "atencao", texto: e }); })}>
                      <Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} className="h-4 w-4 shrink-0" />{a.nome}
                    </button>
                    <span className="t-apoio">{a.tipo.startsWith("image/") ? "Foto" : "PDF"} · {mostrarTamanho(a.tamanho)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {fotos.length ? <p className="t-apoio">Abrem por link de 5 minutos.</p> : null}
          </CartaoFicha>
          <div className="max-lg:order-last"><Andamento d={d} /></div>
        </div>

        <div className="grid gap-5">
          <CartaoFicha id="chega" titulo={publicado ? "Como chegou" : "Como vai chegar"} icone="enviar">
            <ul className="grid">
              {canais?.muralLigado ? (
                <Canal icone="casa" tom="ok" titulo="Mural online"
                  apoio={c.publico !== "TODOS" ? "Só comunicado para todo o condomínio vai ao mural."
                    : canais.noMural ? (c.estado === "PUBLICADO" ? "Aparece no mural agora." : "Vai aparecer ao publicar.") : "Fora do mural."}
                  acao={d.pode.mural ? <Botao variante="discreto" tamanho="m" onClick={() => void mural(!canais.noMural)}>{canais.noMural ? "Tirar do mural" : "Pôr no mural"}</Botao> : null} />
              ) : null}
              {email && (email.total > 0 || canais?.emailLigado) ? (
                <Canal icone="email" tom="info" titulo={`E-mail${email.enviados ? ` · ${email.enviados === 1 ? "1 enviado" : `${email.enviados} enviados`}` : ""}`}
                  apoio={<>
                    {email.total === 0 ? (canais?.porEmail ? "Sai ao publicar, para quem tem e-mail confirmado." : "Este comunicado não vai por e-mail.")
                      : descreverEnvioEmail(email) || "Saindo agora."}
                    {email.naFila && email.enviarApos ? ` Esperando o fim do horário sem envio (${diaHora(email.enviarApos)}).` : ""}
                    {email.abertos ? <span className="block">Link pessoal aberto por {email.abertos === 1 ? "1 pessoa" : `${email.abertos} pessoas`}. Não usamos rastreio escondido no e-mail.</span> : null}
                  </>} />
              ) : null}
              {whatsapp && (whatsapp.total > 0 || canais?.whatsappLigado) ? (
                <Canal icone="whats" tom="ok" titulo={`WhatsApp do condomínio${whatsapp.total ? ` · ${whatsapp.total === 1 ? "1 mensagem" : `${whatsapp.total} mensagens`}` : ""}`}
                  apoio={<>
                    {whatsapp.total === 0 ? (canais?.porWhatsapp ? "Sai ao publicar, para quem aceitou receber comunicados por lá." : "Este comunicado não vai pelo WhatsApp.")
                      : descreverEnvioWhatsapp(whatsapp) || (whatsapp.enviadas ? `${whatsapp.enviadas === 1 ? "1 enviada" : `${whatsapp.enviadas} enviadas`}` : "Saindo agora.")}
                    {whatsapp.naFila && whatsapp.saiAte ? ` Sai até ${diaHora(whatsapp.saiAte)}.` : ""}
                    {whatsapp.parados ? ` ${whatsapp.parados === 1 ? "1 espera" : `${whatsapp.parados} esperam`} o número voltar, por até 24 horas.` : ""}
                    {whatsapp.abertos ? <span className="block">Link pessoal aberto por {whatsapp.abertos === 1 ? "1 pessoa" : `${whatsapp.abertos} pessoas`}.</span> : null}
                  </>} />
              ) : canais ? (
                <Canal icone="whats" tom="neutro" titulo="WhatsApp" apoio="Desligado para comunicados. Liga em Configurações › WhatsApp." />
              ) : null}
              {d.pode.copiar ? (
                <Canal icone="copiar" tom="andamento" titulo="Copiar texto" apoio="Para colar no grupo do prédio, com título e assinatura."
                  acao={<Botao variante="contorno" tamanho="m" onClick={() => void copiar()}><Icone nome="copiar" />Copiar texto</Botao>} />
              ) : null}
              {d.pode.copiar ? (
                <Canal icone="imprimir" tom="andamento" titulo="Folha para o mural" apoio="A4 com o nome do condomínio, a data e a versão."
                  acao={<Link href={`/mural?id=${c.id}`} target="_blank" className={classeBotao("contorno", "h-9 px-3.5 text-[13px]")}><Icone nome="imprimir" />Abrir a folha</Link>} />
              ) : null}
            </ul>
            {whatsapp?.total ? <p className="t-apoio">Lida é o que o WhatsApp informa; quem desligou a confirmação de leitura aparece só como entregue.</p> : null}
            <p className="t-apoio">Quem recebe agora: {descreverAlcance(d.publicoAgora.contatos, d.publicoAgora.unidades)}. A conta é refeita a cada envio.</p>
          </CartaoFicha>

          {d.problemas?.length ? (
            <CartaoFicha id="voltaram" titulo={d.problemas.some((x) => x.canal === "WHATSAPP") ? "Mensagens que não chegaram" : "E-mails que não chegaram"} icone="alerta">
              <ul className="grid gap-2 text-sm">
                {d.problemas.map((x) => (
                  <li key={x.envioId} className="rounded-[14px] border border-linha px-3 py-2">
                    <span className="block font-medium">{x.nome}{x.unidades ? ` · ${x.unidades}` : ""}</span>
                    <span className="t-apoio">
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
                ? <p className="t-apoio">Falha de comunicado não toca o sino de ninguém e não tem reenvio: a pessoa lê pelo grupo, pelo mural ou pelo e-mail.</p> : null}
            </CartaoFicha>
          ) : null}
        </div>
      </div>

      {d.pode.editar || d.pode.corrigir ? (
        <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 border-t border-linha bg-superficie px-4 py-3 md:hidden">
          {d.pode.editar ? <Link href={`/comunicados/escrever?id=${c.id}`} className={classeBotao("primario", "w-full")}><Icone nome="editar" />Editar</Link>
            : <Botao className="w-full" onClick={() => setAcao("corrigir")}><Icone nome="editar" />Corrigir</Botao>}
        </div>
      ) : null}

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
