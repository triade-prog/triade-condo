"use client";
// Mural online e e-mail (design "Mural online e e-mail", tela 2; CD-12 a CD-14): ligar o mural,
// o link e o QR, o cartaz, trocar o link quando vazar, o que aparece por padrão, o e-mail dos
// comunicados e os documentos pedidos pelo mural. Mexe quem pode configurar.

import Link from "next/link";
import { useState } from "react";
import { ASSUNTOS_COMUNICADO, type AssuntoComunicado } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, classeBotao, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { enderecoMural, QrCode } from "./QrCode.tsx";
import type { PlanoComunicacao } from "./tipos.ts";
import { naBase, useAmbiente } from "./contexto.tsx";
import { contarMudancas, useParte } from "./salvar.tsx";

function Chave({ id, rotulo, ajuda, marcado, aoMudar, desligado }: {
  id: string; rotulo: string; ajuda?: string; marcado: boolean; aoMudar: (v: boolean) => void; desligado?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 t-texto">
      <input id={id} type="checkbox" role="switch" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={marcado} disabled={desligado}
        onChange={(e) => aoMudar(e.target.checked)} />
      <span className="grid gap-0.5"><span className="font-medium">{rotulo}</span>{ajuda ? <span className="t-apoio text-tinta-suave">{ajuda}</span> : null}</span>
    </label>
  );
}

export function MuralEmail({ p, recarregar, salvo }: { p: PlanoComunicacao; recarregar: () => void; salvo: (t: string) => void }) {
  const [v, setV] = useState({
    muralLigado: p.mural.ligado, muralAssuntos: p.mural.assuntos, emailLigado: p.email.ligado, responderPara: p.email.responderPara ?? "",
    documentosNoMural: p.documentos.noMural, documentosAutomatico: p.documentos.automatico,
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [trocar, setTrocar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const comErro = camposComErro(erro);
  const link = p.mural.codigo ? enderecoMural(p.mural.codigo) : null;
  // Trocar o link e o cartaz são do condomínio, no app (CF-03).
  const noApp = useAmbiente().onde === "app";

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi(naBase("/mural-email"), { metodo: "PUT", corpo: { ...v, versao: p.versao } });
    if (!r.ok) { setErro(r.erro); return null; }
    return "Mural e e-mail salvos.";
  }
  const iniciais = {
    muralLigado: p.mural.ligado, muralAssuntos: p.mural.assuntos, emailLigado: p.email.ligado, responderPara: p.email.responderPara ?? "",
    documentosNoMural: p.documentos.noMural, documentosAutomatico: p.documentos.automatico,
  };
  useParte("mural-email", { nome: "Mural e e-mail", mudancas: contarMudancas(iniciais, v), salvar });

  async function copiar() {
    if (!link) return;
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopiado(true);
  }

  return (
    <div className="grid content-start gap-4 lg:max-w-3xl">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}

      <section className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1" aria-labelledby="me-mural">
        <h2 id="me-mural" className="t-titulo-secao font-medium">Mural online</h2>
        <Chave id="me-mural-ligado" rotulo="Mural ligado" marcado={v.muralLigado} desligado={!p.podeEditar}
          ajuda="Desligado, o link mostra só: este mural está fora do ar." aoMudar={(x) => setV({ ...v, muralLigado: x })} />
        {link ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-linha bg-white p-2"><QrCode texto={link} rotulo="QR do mural online" /></div>
            <div className="grid min-w-0 flex-1 gap-2">
              <code className="rounded-lg border border-violeta-200 bg-violeta-50 px-3 py-2 t-apoio break-all text-violeta-800">{link}</code>
              <span className="flex flex-wrap gap-2">
                <Botao variante="contorno" tamanho="m" onClick={() => void copiar()}><Icone nome="copiar" />{copiado ? "Link copiado" : "Copiar link"}</Botao>
                {noApp ? <Link href="/mural/cartaz" target="_blank" className={classeBotao("contorno", "", "m")}><Icone nome="imprimir" />Cartaz com QR</Link> : null}
                {p.podeEditar && noApp ? <Botao variante="discreto" tamanho="m" onClick={() => setTrocar(true)}>Trocar link</Botao> : null}
              </span>
              <span className="t-apoio text-tinta-suave">
                Aberto {p.mural.aberturas === 1 ? "1 vez" : `${p.mural.aberturas} vezes`} nos últimos 7 dias. Não sabemos quem abriu.
              </span>
            </div>
          </div>
        ) : <p className="t-apoio text-tinta-suave">O link e o QR aparecem ao ligar o mural e salvar.</p>}
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-texto font-medium">O que aparece no mural por padrão</legend>
          <ul className="divide-y divide-linha rounded-xl border border-linha">
            {(Object.keys(ASSUNTOS_COMUNICADO) as AssuntoComunicado[]).map((a) => (
              <li key={a} className="px-3 py-2 t-texto">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-violeta-600" disabled={!p.podeEditar} checked={v.muralAssuntos.includes(a)}
                    onChange={() => setV({ ...v, muralAssuntos: v.muralAssuntos.includes(a) ? v.muralAssuntos.filter((x) => x !== a) : [...v.muralAssuntos, a] })} />
                  {ASSUNTOS_COMUNICADO[a]}
                </label>
              </li>
            ))}
          </ul>
          <p className="t-apoio text-tinta-suave">Só comunicados para todo o condomínio. Em cada comunicado dá para mudar. Segurança começa desligado: o link pode chegar a quem não mora no prédio.</p>
        </fieldset>
      </section>

      <section className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1" aria-labelledby="me-email">
        <h2 id="me-email" className="t-titulo-secao font-medium">E-mail</h2>
        <Chave id="me-email-ligado" rotulo="Enviar os comunicados também por e-mail" marcado={v.emailLigado} desligado={!p.podeEditar}
          ajuda={`Para quem tem e-mail confirmado e recebe comunicados. ${p.email.comEmail} de ${p.email.contatos} contatos hoje.`}
          aoMudar={(x) => setV({ ...v, emailLigado: x })} />
        <CampoTexto id="me-responder" rotulo="Respostas vão para" opcional type="email" maxLength={254} disabled={!p.podeEditar}
          value={v.responderPara} onChange={(e) => setV({ ...v, responderPara: e.target.value })}
          erro={comErro.includes("responderPara") ? "Confira o e-mail." : null}
          ajuda="Vazio: o e-mail diz para responder pelo WhatsApp do condomínio ou falar com a síndica." />
        <Aviso tom="info" titulo="Sai em nome do condomínio, pela TRÍADE Condo">
          De nao-responda@t3condo.trihub.com.br. O horário sem envio do plano vale também para o e-mail. Ao ligar, quem tem e-mail esperando confirmação recebe o pedido.
        </Aviso>
      </section>

      <section className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1" aria-labelledby="me-docs">
        <h2 id="me-docs" className="t-titulo-secao font-medium">Documentos pedidos pelo mural</h2>
        <Chave id="me-docs-mural" rotulo="Mostrar no mural os documentos que podem ir ao morador" marcado={v.documentosNoMural} desligado={!p.podeEditar}
          ajuda="Só com o e-mail ligado: o documento vai por link que vale 7 dias." aoMudar={(x) => setV({ ...v, documentosNoMural: x })} />
        <fieldset className="grid gap-1">
          <legend className="t-texto font-medium">Quando quem pede é contato confirmado</legend>
          <span className="trilho">
            <button type="button" className="chip" aria-pressed={v.documentosAutomatico} data-escolhido={v.documentosAutomatico ? "" : undefined}
              disabled={!p.podeEditar} onClick={() => setV({ ...v, documentosAutomatico: true })}>Enviar na hora</button>
            <button type="button" className="chip" aria-pressed={!v.documentosAutomatico} data-escolhido={!v.documentosAutomatico ? "" : undefined}
              disabled={!p.podeEditar} onClick={() => setV({ ...v, documentosAutomatico: false })}>Eu aprovo cada um</button>
          </span>
          <span className="t-apoio text-tinta-suave">Pedido de e-mail que não é de contato sempre espera você aprovar.</span>
        </fieldset>
      </section>

      <TrocarLink aberto={trocar} versao={p.versao} aoFechar={() => setTrocar(false)} aoTrocar={() => { setTrocar(false); salvo("Link do mural trocado."); }} />
    </div>
  );
}

function TrocarLink({ aberto, versao, aoFechar, aoTrocar }: { aberto: boolean; versao: number; aoFechar: () => void; aoTrocar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function trocar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(naBase("/mural/trocar-link"), { corpo: { versao, motivo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setMotivo("");
    aoTrocar();
  }
  return (
    <Dialogo aberto={aberto} titulo="Trocar o link do mural" aoFechar={aoFechar}>
      <div className="grid gap-3">
        <Aviso tom="atencao" titulo="O link e o QR atuais param na hora">
          Quem abrir o link antigo vê que o endereço mudou. Troque também o cartaz do elevador e do hall.
        </Aviso>
        {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="tl-motivo" rotulo="Por que trocar" required rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (de 3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={() => void trocar()} disabled={enviando}>{enviando ? "Trocando…" : "Trocar link"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}
