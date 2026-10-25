"use client";
// Contrato pelo gov.br (quadro 440, no lugar do 332; estados do 444; aprovados em 25/10/2026;
// CM-13): o que foi preenchido da proposta aceita e do interessado, o PDF gerado com a impressão
// digital, os documentos do condomínio, as assinaturas na ordem (primeiro o condomínio, depois a
// TRÍADE, sobre o mesmo arquivo) e o Virar cliente, que só liga com as duas conferidas. Sem modelo
// em uso, Gerar contrato fica desligado. O banco decide a ordem e quem pode; a tela mostra.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DOCUMENTOS_ACEITE, linkWhatsappComercial, SITUACOES_CONTRATO, SITUACOES_ENVIO, type DocumentoAceite, type ParteContrato } from "@triade/domain";
import { Aviso, Botao, Carregando, classeBotao, ErroCarregar, Icone, Selo, Vazio } from "@triade/ui";
import { Cartao, Dado, diaHora, Voltar } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import { ROTAS_COMERCIAL } from "./comum.tsx";
import { TELAS_CLIENTE, type ClienteCriado } from "./cliente.ts";
import {
  apoioAssinatura, assinadas, diaHoraCurto, documentosAtuais, estadoDoContrato, hashCurto, linhasCampos, MOTIVOS_SEM_GERAR, ROTAS_CONTRATO, seloAssinatura, textoDocumento,
  type EnvioTela, type RespostaContrato,
} from "./contrato.ts";
import { JanelaConferir, JanelaDocumento, JanelaEnviarAssinado, JanelaGerar, useBaixar } from "./janelasContrato.tsx";
import { JanelaVirarCliente, textoFaltaGanho } from "./janelasCliente.tsx";
import type { FichaInteressado } from "./tipos.ts";

type Janela =
  | { tipo: "gerar" }
  | { tipo: "documento"; inicial: DocumentoAceite }
  | { tipo: "enviar"; parte: ParteContrato }
  | { tipo: "conferir"; envio: EnvioTela }
  | { tipo: "virarCliente" };

const primeiroNome = (n?: string) => (n ?? "").trim().split(/\s+/)[0] ?? "";
const TOM_PASSO = { ok: "bg-ok-fundo text-ok", atencao: "bg-atencao-fundo text-atencao", neutro: "bg-superficie-2 text-tinta-suave", erro: "bg-erro-fundo text-erro", info: "bg-violeta-50 text-violeta-700" } as const;

/** O último envio de cada parte que a equipe pode conferir ou recusar. */
const envioDaParte = (envios: EnvioTela[] | undefined, parte: ParteContrato) =>
  (envios ?? []).find((e) => e.parte === parte && (e.situacao === "A_CONFERIR" || e.situacao === "NAO_E_O_GERADO"));

export function ContratoInteressado() {
  const { id } = useParams<{ id: string }>();
  const sessao = useSessao();
  const ficha = useCarregar<FichaInteressado>(ROTAS_COMERCIAL.interessado(id));
  const carga = useCarregar<RespostaContrato>(ROTAS_CONTRATO.contrato(id));
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro" | "atencao"; texto: string } | null>(null);
  const [criado, setCriado] = useState<ClienteCriado | null>(null);
  const b = useBaixar();

  const nome = carga.estado === "pronto" ? carga.dados.interessado.condominio : ficha.estado === "pronto" ? ficha.dados.condominio : "Voltar à ficha";
  const voltar = <Voltar href={`/comercial/${id}`} texto={nome} />;
  if (carga.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Abrindo o contrato…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const r = carga.dados;
  if (r.restrito) {
    // Virou cliente: o Comercial vê só que o contrato foi assinado (CM-11).
    return (
      <div className="grid gap-5">
        {voltar}
        <h1 className="t-titulo-tela">Contrato</h1>
        <Vazio titulo="O contrato está na ficha do cliente" icone="predio">
          {`${r.contrato ? `Contrato nº ${r.contrato.numero}, ${SITUACOES_CONTRATO[r.contrato.situacao].toLowerCase()}${r.contrato.assinadoEm ? ` em ${diaHora(r.contrato.assinadoEm)}` : ""}. ` : ""}${r.virouClienteEm ? `Virou cliente em ${diaHora(r.virouClienteEm)}. ` : ""}Depois de virar cliente, o Comercial deixa de ver os dados do condomínio; a Implantação e a Administração atendem pela ficha do cliente.`}
        </Vazio>
      </div>
    );
  }
  const c = r.contrato;
  const f = ficha.estado === "pronto" ? ficha.dados : null;
  const pronto = (texto: string, tom: "ok" | "atencao" = "ok") => { setJanela(null); setAviso({ tom, texto }); carga.recarregar(); ficha.recarregar(); };
  const estado = estadoDoContrato(r);
  const quemAceitou = r.aceite?.nome ?? "o síndico";
  const conferidoCondominio = (r.envios ?? []).find((e) => e.parte === "CONDOMINIO" && e.situacao === "CONFERIDO");
  const podeEditar = r.podeConferir && !r.virouClienteEm && r.motivoSemGerar !== "ANONIMIZADO";
  const docs = documentosAtuais(r.documentos);
  const virou = r.virouClienteEm ?? (criado ? new Date().toISOString() : undefined);

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-3xl gap-1">
          <h1 className="t-titulo-tela">Contrato</h1>
          <p className="t-apoio">
            {c?.modelo
              ? `Gerado do modelo revisado por advogado (v${c.modelo.numero}) e da proposta aceita (v${r.aceite?.proposta ?? 1}). Cada parte assina o mesmo PDF pelo gov.br; o cliente só é criado depois das duas assinaturas conferidas.`
              : "Sai do modelo revisado por advogado e da proposta aceita. Cada parte assina o mesmo PDF pelo gov.br; o cliente só é criado depois das duas assinaturas conferidas."}
          </p>
        </div>
        {c ? (
          <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full">
            <Botao variante="contorno" disabled={!conferidoCondominio || !!b.baixando}
              onClick={() => conferidoCondominio && void b.baixar(ROTAS_CONTRATO.linkContrato(c.id, conferidoCondominio.id))}>
              <Icone nome="baixar" />{`Baixar o PDF assinado pela ${primeiroNome(quemAceitou)}`}
            </Botao>
            {r.podeAssinar ? (
              <Botao disabled={c.situacao !== "AGUARDA_TRIADE"} onClick={() => setJanela({ tipo: "enviar", parte: "TRIADE" })}>
                <Icone nome="enviar" />Enviar o PDF assinado pela TRÍADE
              </Botao>
            ) : null}
          </div>
        ) : null}
      </div>
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
      {estado ? (
        <Aviso tom={estado.tom === "ok" ? "ok" : estado.tom === "erro" ? "erro" : estado.tom === "atencao" ? "atencao" : "info"} titulo={estado.titulo} papel="status">
          {estado.texto}
          {estado.chave === "SEM_MODELO" && sessao.acoes.includes("console.comercial.modelos") ? (
            <span className="mt-2 block"><Link href="/comercial/modelos?aba=contrato" className={classeBotao("contorno")}><Icone nome="documento" />Abrir Modelos › Contrato</Link></span>
          ) : null}
          {estado.chave === "FALTA_DOCUMENTO" && f?.temWhatsapp && f.whatsapp ? (
            <span className="mt-2 block">
              <a href={linkWhatsappComercial(f.whatsapp, `Olá, ${primeiroNome(quemAceitou)}! Para preparar o contrato do ${r.interessado.condominio}, falta enviar o cartão do CNPJ e a ata da eleição com o fim do mandato, pelo mesmo link da proposta.`)}
                target="_blank" rel="noopener noreferrer" className={classeBotao("contorno")}><Icone nome="whats" />Lembrar pelo WhatsApp</a>
            </span>
          ) : null}
        </Aviso>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {c ? (
            <Cartao id="contrato-dados" titulo="Preenchido da proposta e do interessado" icone="lista">
              {r.dadosMudaram ? <Aviso tom="atencao">O CNPJ ou a ata mudou depois de gerado. Gere de novo para o contrato levar os dados novos.</Aviso> : null}
              <div>
                {linhasCampos(c.campos).map(([n, v]) => <Dado key={n} icone="check" nome={n}>{v}</Dado>)}
              </div>
              {!linhasCampos(c.campos).length ? <p className="t-apoio">Os campos aparecem aqui quando o PDF fica pronto.</p> : null}
            </Cartao>
          ) : (
            <Cartao id="contrato-gerar" titulo="Gerar contrato" icone="documento">
              <p className="t-texto">
                {r.modeloEmUso ? `Do modelo ${r.modeloEmUso.titulo} v${r.modeloEmUso.numero}, com os dados da proposta aceita e dos documentos do condomínio.` : "O texto sai do modelo cadastrado pela Administração em Modelos › Contrato."}
              </p>
              <Botao className="justify-self-start" disabled={!r.podeGerar} onClick={() => setJanela({ tipo: "gerar" })} aria-describedby={r.podeGerar ? undefined : "contrato-sem-gerar"}>
                <Icone nome="documento" />Gerar contrato
              </Botao>
              {!r.podeGerar ? (
                <p id="contrato-sem-gerar" className="t-apoio">{r.motivoSemGerar ? MOTIVOS_SEM_GERAR[r.motivoSemGerar] : "Só quem edita o Comercial gera o contrato."}</p>
              ) : null}
            </Cartao>
          )}
          {c ? (
            <Cartao id="contrato-pdf" titulo="O PDF gerado" icone="documento" acao={<Selo tom="neutro">Contrato e termo de dados num arquivo só</Selo>}>
              <div>
                {c.modelo ? <Dado icone="camadas" nome="Modelo">{`${c.modelo.titulo} v${c.modelo.numero} · com o termo de tratamento de dados no fim`}</Dado> : null}
                <Dado icone="calendario" nome="Gerado em">{`${diaHora(c.geradoEm)}${c.geradoPor ? ` por ${c.geradoPor.nome}` : ""} · contrato nº ${c.numero}`}</Dado>
                <Dado icone="escudo" nome="Impressão digital">
                  <span className="t-codigo" title={c.hash}>{`sha256 ${hashCurto(c.hash)}`}</span><span className="t-apoio"> · impressa em cada folha</span>
                </Dado>
                <Dado icone="relogio" nome="Situação">{SITUACOES_CONTRATO[c.situacao]}</Dado>
              </div>
              <div className="flex flex-wrap gap-2 max-md:grid">
                <Botao variante="contorno" disabled={!c.podeBaixar || !!b.baixando} onClick={() => void b.baixar(ROTAS_CONTRATO.linkContrato(c.id))}><Icone nome="baixar" />Baixar o PDF gerado</Botao>
                {podeEditar && c.situacao !== "ASSINADO" ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "gerar" })}><Icone nome="trocar" />Gerar de novo</Botao> : null}
              </div>
              <p className="t-apoio">Gerar de novo (por exemplo, para corrigir um dado) cria um PDF novo e pede as assinaturas outra vez; o anterior fica guardado como substituído.</p>
            </Cartao>
          ) : null}
          <Cartao id="contrato-docs" titulo="Documentos do condomínio" icone="clipe"
            acao={podeEditar && c?.situacao !== "ASSINADO" && r.aceite ? (
              <Botao variante="discreto" onClick={() => setJanela({ tipo: "documento", inicial: r.faltam[0] ?? "CNPJ" })}><Icone nome="enviar" />Enviar pela equipe</Botao>
            ) : undefined}>
            <ul className="grid">
              {(Object.keys(DOCUMENTOS_ACEITE) as DocumentoAceite[]).map((tipo) => {
                const d = docs[tipo];
                const falta = r.faltam.includes(tipo);
                return (
                  <li key={tipo} className="flex flex-wrap items-center gap-3 border-t border-linha py-3 first:border-t-0">
                    <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome="documento" className="h-4 w-4" /></span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="t-texto font-medium">{DOCUMENTOS_ACEITE[tipo]}</span>
                      <span className="t-apoio [overflow-wrap:anywhere]">
                        {d ? textoDocumento(d) : tipo === "ATA_APROVACAO" ? "Só se a convenção pedir aprovação em assembleia." : "Ainda não chegou. O síndico envia pelo link da proposta."}
                      </span>
                    </span>
                    {d?.situacao === "RECEBIDO" ? <Selo tom="ok">Recebido</Selo> : d?.situacao === "RECUSADO" ? <Selo tom="erro">Recusado</Selo> : falta ? <Selo tom="atencao">Falta</Selo> : <Selo tom="neutro">Opcional</Selo>}
                    {d?.situacao === "RECEBIDO" ? (
                      <Botao variante="discreto" disabled={!!b.baixando} aria-label={`Baixar ${DOCUMENTOS_ACEITE[tipo]}`} onClick={() => void b.baixar(ROTAS_CONTRATO.linkDocumento(d.id))}>
                        <Icone nome="baixar" />Baixar
                      </Botao>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {r.aceite ? <p className="t-apoio">{`Aceite de ${r.aceite.nome}, ${r.aceite.cargo}, em ${diaHora(r.aceite.aceitoEm)}${r.aceite.linkAte ? `. O link recebe arquivos até ${r.aceite.linkAte.split("-").reverse().join("/")}` : ""}.`}</p> : null}
          </Cartao>
        </div>

        <div className="grid content-start gap-5">
          {c ? (
            <Cartao id="contrato-assinaturas" titulo="Assinaturas pelo gov.br" icone="escudo" acao={<Selo tom={assinadas(c) === 2 ? "ok" : assinadas(c) ? "atencao" : "neutro"}>{`${assinadas(c)} de 2`}</Selo>}>
              <ol className="grid" aria-label="Assinaturas, nesta ordem">
                {(["CONDOMINIO", "TRIADE"] as const).map((parte, n) => {
                  const a = parte === "CONDOMINIO" ? c.assinaturas.condominio : c.assinaturas.triade;
                  const s = seloAssinatura(a, parte, c);
                  const envio = envioDaParte(r.envios, parte);
                  const titulo = parte === "CONDOMINIO" ? `${quemAceitou} assina pelo condomínio` : `${r.podeAssinar ? sessao.nome : "A Administração"} assina pela TRÍADE`;
                  return (
                    <li key={parte} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-linha py-3 first:border-t-0">
                      <span className={`grid h-7 w-7 place-items-center rounded-full t-texto font-bold ${TOM_PASSO[s.tom]}`} aria-hidden="true">
                        {a.situacao === "CONFERIDA" ? <Icone nome="check" className="h-4 w-4" /> : n + 1}
                      </span>
                      <span className="grid min-w-0 gap-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="t-texto font-medium">{titulo}</span>
                          <Selo tom={s.tom}>{s.texto}</Selo>
                        </span>
                        <span className="t-apoio">{apoioAssinatura(a, parte, c)}</span>
                        <span className="flex flex-wrap gap-2">
                          {envio && r.podeConferir ? (
                            <Botao variante={envio.situacao === "A_CONFERIR" ? "primario" : "contorno"} onClick={() => setJanela({ tipo: "conferir", envio })}>
                              <Icone nome="escudo" />{envio.situacao === "A_CONFERIR" ? "Conferir a assinatura" : "Ver e recusar o envio"}
                            </Botao>
                          ) : null}
                          {parte === "CONDOMINIO" && c.situacao === "AGUARDA_CONDOMINIO" && podeEditar && !envio ? (
                            <Botao variante="discreto" onClick={() => setJanela({ tipo: "enviar", parte: "CONDOMINIO" })}><Icone nome="enviar" />Enviar o PDF que o condomínio mandou</Botao>
                          ) : null}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="grid gap-1.5 border-t border-linha pt-3 t-apoio">
                <p>Assinatura eletrônica avançada do gov.br, gratuita, feita pela própria pessoa em assinador.iti.br com a conta gov.br prata ou ouro.</p>
                <p>Cada envio guarda quem enviou, quando, o arquivo e quem conferiu. O sistema confere sozinho se o arquivo tem assinatura e se é o PDF gerado; a validade da assinatura e o CPF a equipe confere no validar.iti.gov.br.</p>
              </div>
            </Cartao>
          ) : null}
          <Cartao id="contrato-depois" titulo={virou ? "Virou cliente" : "Depois de assinado"} icone="predio">
            {virou ? (
              <>
                <p className="t-texto">{`Virou cliente em ${diaHora(virou)}. O PDF com as duas assinaturas fica na ficha do cliente.`}</p>
                {criado ? <Link href={TELAS_CLIENTE.cliente(criado.condominioId)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="predio" />Abrir a implantação</Link> : null}
              </>
            ) : (
              <>
                <p className="t-texto">O PDF com as duas assinaturas vai para a ficha do cliente.</p>
                <p className="t-texto">Mudar plano ou valor depois gera um aditivo; o assinado nunca é editado.</p>
                <Botao variante={r.podeVirarCliente ? "primario" : "contorno"} className="justify-self-start" disabled={!r.podeVirarCliente || !f}
                  onClick={() => setJanela({ tipo: "virarCliente" })} aria-describedby="contrato-virar-aviso">
                  <Icone nome="predio" />Virar cliente
                </Botao>
                <p id="contrato-virar-aviso" className="t-apoio">
                  {c?.situacao !== "ASSINADO" ? "Libera quando as duas assinaturas estiverem conferidas." : r.podeVirarCliente ? "Contrato assinado pelos dois." : "Contrato assinado pelos dois. Só a Administração cria o cliente."}
                </p>
              </>
            )}
          </Cartao>
          {(r.envios?.length ?? 0) || r.anteriores.length ? (
            <Cartao id="contrato-historico" titulo="Histórico dos envios" icone="relogio">
              <ul className="grid">
                {(r.envios ?? []).map((e) => (
                  <li key={e.id} className="grid gap-0.5 border-t border-linha py-2.5 first:border-t-0">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="t-texto font-medium">{`${e.parte === "CONDOMINIO" ? "Condomínio" : "TRÍADE"} · ${diaHoraCurto(e.enviadoEm)}`}</span>
                      <Selo tom={e.situacao === "CONFERIDO" ? "ok" : e.situacao === "A_CONFERIR" ? "atencao" : e.situacao === "SUBSTITUIDO" ? "neutro" : "erro"}>{SITUACOES_ENVIO[e.situacao]}</Selo>
                    </span>
                    <span className="t-apoio [overflow-wrap:anywhere]">
                      {[e.nome, e.peloLink ? "pelo link" : e.enviadoPor ? `pela equipe (${e.enviadoPor.nome})` : "pela equipe",
                        e.conferencia ? `conferido por ${e.conferencia.por?.nome ?? "a equipe"}${e.conferencia.cpfMascarado ? ` · CPF ${e.conferencia.cpfMascarado}` : ""}` : null,
                        e.recusa ? `recusado por ${e.recusa.por?.nome ?? "a equipe"}: ${e.recusa.motivo}` : e.situacao !== "CONFERIDO" && e.motivoTexto ? e.motivoTexto : null].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
                {r.anteriores.map((x) => (
                  <li key={x.id} className="grid gap-0.5 border-t border-linha py-2.5 first:border-t-0">
                    <span className="t-texto font-medium">{`Contrato nº ${x.numero} · substituído`}</span>
                    <span className="t-apoio">{`Gerado em ${diaHora(x.geradoEm)}${x.motivo ? ` · gerado de novo: ${x.motivo}` : ""}`}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </div>
      </div>

      {janela?.tipo === "gerar" ? <JanelaGerar r={r} aoFechar={() => setJanela(null)} feito={(t) => pronto(t)} /> : null}
      {janela?.tipo === "documento" ? <JanelaDocumento interessadoId={id} inicial={janela.inicial} aoFechar={() => setJanela(null)} feito={(t) => pronto(t)} /> : null}
      {janela?.tipo === "enviar" && c ? (
        <JanelaEnviarAssinado contrato={c} parte={janela.parte} condominioEnvio={conferidoCondominio?.id} nomeCondominio={quemAceitou} aoFechar={() => setJanela(null)} feito={(t) => pronto(t)} />
      ) : null}
      {janela?.tipo === "conferir" ? <JanelaConferir r={r} envio={janela.envio} aoFechar={() => setJanela(null)} feito={(t) => pronto(t)} /> : null}
      {janela?.tipo === "virarCliente" && f ? (
        <JanelaVirarCliente f={f} aoFechar={() => setJanela(null)}
          aoFaltar={(campos) => { setJanela(null); setAviso({ tom: "atencao", texto: `${textoFaltaGanho(campos)} Complete na ficha e tente de novo.` }); }}
          feito={(x) => { setCriado(x); pronto(x.doPiloto ? "Cliente criado: o condomínio sai do piloto e segue na implantação." : "Cliente criado na carteira, com o plano e a implantação abertos."); }} />
      ) : null}
    </div>
  );
}
