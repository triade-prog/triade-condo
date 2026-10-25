"use client";
// O link do síndico depois do aceite (quadro 441, estados do 444; aprovados em 25/10/2026; CM-13):
// pelo mesmo endereço da proposta, sem conta, no celular. Primeiro os documentos do condomínio (o
// cartão do CNPJ e a ata da eleição com o fim do mandato); depois o contrato para assinar pelo
// gov.br, que o síndico baixa, assina em assinador.iti.br e envia de volta; por fim, com as duas
// assinaturas conferidas, o PDF final. Só PDF, até 10 MB. O código fica só no endereço.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DOCUMENTOS_ACEITE, formatarCnpj, type DocumentoAceite } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, Icone, Selo, textoDoErro } from "@triade/ui";
import { EscolhaBotoes } from "../planos/comum.tsx";
import { hojeBrasilia } from "./cliente.ts";
import {
  ASSINADOR_GOVBR, baixarPeloLink, diaHoraCurto, documentosAtuais, enviarPdf, problemaDoDocumento, problemaDoPdf, ROTAS_CONTRATO, textoDoEnvio, textoDocumento,
  type ContratoPublico,
} from "./contrato.ts";
import { CampoPdf } from "./janelasContrato.tsx";
import { Bloco, Duvida, Pagina } from "./LinkProposta.tsx";

type Carga = { estado: "carregando" } | { estado: "fechado" } | { estado: "limite" } | { estado: "falha"; texto: string } | { estado: "pronto"; c: ContratoPublico };

const dataCurta = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const MENSAGEM = "Olá! Tenho uma dúvida sobre o contrato da TRÍADE Condo.";

function Passo({ n, titulo, apoio, feito, children }: { n: number; titulo: string; apoio: string; feito: boolean; children?: ReactNode }) {
  return (
    <Bloco rotulo={titulo}>
      <div className="flex items-start gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full t-texto font-bold ${feito ? "bg-ok-fundo text-ok" : "bg-violeta-50 text-violeta-700"}`} aria-hidden="true">
          {feito ? <Icone nome="check" className="h-4 w-4" /> : n}
        </span>
        <span className="grid gap-0.5">
          <h2 className="t-titulo-cartao">{titulo}{feito ? <span className="sr-only"> (feito)</span> : null}</h2>
          <span className="t-apoio">{apoio}</span>
        </span>
      </div>
      {children}
    </Bloco>
  );
}

function Arquivo({ nome, sub, selo }: { nome: string; sub: string; selo: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-linha bg-fundo px-3 py-2.5">
      <Icone nome="documento" className="h-5 w-5 shrink-0 text-violeta-600" />
      <span className="grid min-w-0 flex-1"><span className="t-texto">{nome}</span><span className="t-apoio [overflow-wrap:anywhere]">{sub}</span></span>
      {selo}
    </div>
  );
}

export function LinkContrato() {
  const { codigo } = useParams<{ codigo: string }>();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  const ler = useCallback(() => chamarApi<ContratoPublico>(ROTAS_CONTRATO.publico(codigo)).then((r) => {
    if (r.ok) return setCarga({ estado: "pronto", c: r.dados });
    if (r.status === 404) return setCarga({ estado: "fechado" });
    if (r.status === 429) return setCarga({ estado: "limite" });
    setCarga({ estado: "falha", texto: textoDoErro(r.erro) });
  }), [codigo]);
  useEffect(() => { void ler(); }, [ler]);

  if (carga.estado === "carregando") return <Pagina rotulo="Contrato"><h1 className="sr-only">Contrato para assinar</h1><Carregando rotulo="Abrindo o contrato…" /></Pagina>;
  if (carga.estado !== "pronto") {
    const t = carga.estado === "limite" ? { titulo: "Muitas tentativas agora", texto: "Tente de novo mais tarde. Se precisar, fale com a TRÍADE pelo WhatsApp comercial." }
      : carga.estado === "falha" ? { titulo: "Não deu para abrir agora", texto: carga.texto }
      : { titulo: "Este link não recebe mais arquivos", texto: "O contrato não está disponível por este link. Fale com a TRÍADE pelo WhatsApp comercial." };
    return (
      <Pagina rotulo="Contrato">
        <h1 className="t-titulo-tela">{t.titulo}</h1>
        <Aviso tom={carga.estado === "falha" ? "erro" : "atencao"}>{t.texto}</Aviso>
        <Duvida texto="Falar com a TRÍADE" mensagem={MENSAGEM} />
      </Pagina>
    );
  }
  return <Contrato codigo={codigo} c={carga.c} recarregar={() => void ler()} />;
}

function Contrato({ codigo, c, recarregar }: { codigo: string; c: ContratoPublico; recarregar: () => void }) {
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro" | "atencao"; texto: string } | null>(null);
  const [baixando, setBaixando] = useState<"contrato" | "final" | null>(null);
  const k = c.contrato;
  const docs = documentosAtuais(c.documentos);
  const docsFeitos = c.faltam.length === 0;
  const meu = k?.assinaturas.condominio;
  const conferida = meu?.situacao === "CONFERIDA";

  async function baixar(final: boolean) {
    setAviso(null);
    setBaixando(final ? "final" : "contrato");
    const p = await baixarPeloLink(ROTAS_CONTRATO.publicoPdf(codigo, final));
    setBaixando(null);
    if (p) setAviso({ tom: "erro", texto: p });
  }
  const feito = (texto: string, tom: "ok" | "atencao" = "ok") => { setAviso({ tom, texto }); recarregar(); };

  return (
    <Pagina rotulo="Contrato">
      <p className="t-apoio">{`${c.condominio} · proposta v${c.proposta} aceita por ${c.aceite.nome} em ${dataCurta(c.aceite.aceitoEm)}`}</p>
      <h1 className="t-titulo-tela">{k?.situacao === "ASSINADO" ? "Contrato assinado" : "Falta pouco para começar"}</h1>
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}

      <Passo n={1} titulo="Documentos do condomínio" feito={docsFeitos}
        apoio={docsFeitos ? "Enviados. A equipe confere e prepara o contrato." : "Envie o cartão do CNPJ e a ata da eleição com o fim do mandato. Só PDF, até 10 MB."}>
        <div className="grid gap-2">
          {(Object.keys(DOCUMENTOS_ACEITE) as DocumentoAceite[]).map((tipo) => {
            const d = docs[tipo];
            if (!d && tipo === "ATA_APROVACAO") return null;
            return (
              <Arquivo key={tipo} nome={tipo === "ATA_ELEICAO" ? "Ata da eleição com o fim do mandato" : DOCUMENTOS_ACEITE[tipo]}
                sub={d ? textoDocumento(d) : "Falta enviar"}
                selo={d?.situacao === "RECEBIDO" ? <Selo tom="ok">{tipo === "CNPJ" ? "Recebido" : "Recebida"}</Selo> : d ? <Selo tom="erro">Recusado</Selo> : <Selo tom="atencao">Falta</Selo>} />
            );
          })}
          <p className="t-apoio">Se a convenção pedir aprovação em assembleia, envie também a ata que aprovou.</p>
        </div>
        {c.podeEnviarDocumentos ? <EnviarDocumento key={c.faltam.join() || "todos"} codigo={codigo} faltam={c.faltam} aberto={!docsFeitos} feito={feito} /> : null}
      </Passo>

      <Passo n={2} titulo="Assine o contrato pelo gov.br" feito={conferida}
        apoio={conferida ? `Sua assinatura foi conferida${meu?.conferidoEm ? ` em ${diaHoraCurto(meu.conferidoEm)}` : ""} no validador do governo.`
          : "Contrato de uso e termo de tratamento de dados, num arquivo só, com a impressão digital em cada folha."}>
        {!k ? <p className="t-texto">A equipe prepara o contrato depois dos documentos. Volte a este link: o contrato aparece aqui para baixar e assinar.</p> : null}
        {k && !conferida ? (
          <>
            {meu?.situacao === "A_CONFERIR" ? (
              <Aviso tom="info">{`PDF assinado recebido${meu.enviadoEm ? ` em ${diaHoraCurto(meu.enviadoEm)}` : ""}. A equipe confere a assinatura no validador do governo e avisa por aqui.`}</Aviso>
            ) : null}
            {meu && ["RECUSADA", "SEM_ASSINATURA", "NAO_E_O_GERADO", "ARQUIVO_INVALIDO"].includes(meu.situacao) ? (
              <Aviso tom="atencao" titulo="Envie de novo">{meu.motivoTexto ?? "O arquivo enviado não serviu."}</Aviso>
            ) : null}
            <ol className="grid list-decimal gap-1.5 pl-5 t-texto">
              <li>Baixe o contrato abaixo. Não precisa imprimir.</li>
              <li>Abra o assinador do gov.br, entre com a sua conta (nível prata ou ouro) e escolha o arquivo.</li>
              <li>Assine e baixe o PDF assinado.</li>
              <li>Volte aqui e envie o PDF assinado.</li>
            </ol>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Botao variante="contorno" className="w-full sm:w-auto" disabled={!!baixando || !k.podeBaixar} onClick={() => void baixar(false)}>
                <Icone nome="baixar" />{baixando === "contrato" ? "Abrindo…" : "Baixar o contrato"}
              </Botao>
              <a href={ASSINADOR_GOVBR} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 t-texto font-semibold text-violeta-600 hover:underline">
                <Icone nome="link" className="h-4 w-4" />Abrir o assinador do gov.br
              </a>
            </div>
            {k.podeEnviar && meu?.situacao !== "A_CONFERIR" ? <EnviarAssinado codigo={codigo} feito={feito} /> : null}
            <details className="rounded-[12px] border border-linha px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center t-texto font-medium">A sua conta gov.br é bronze?</summary>
              <p className="pb-2 t-apoio">O assinador pede conta prata ou ouro. No aplicativo gov.br, em Seu nível, dá para subir com o reconhecimento facial ou pelo banco, sem sair de casa. Depois, volte aqui.</p>
            </details>
          </>
        ) : null}
      </Passo>

      <Passo n={3} titulo="A TRÍADE assina" feito={!!k?.finalDisponivel}
        apoio={k?.finalDisponivel ? "Assinado pelos dois. Baixe o PDF final com as duas assinaturas." : "Depois da sua assinatura conferida, a TRÍADE assina sobre o mesmo arquivo e você recebe o PDF final aqui."}>
        {k?.finalDisponivel ? (
          <Botao className="w-full sm:w-auto sm:justify-self-start" disabled={!!baixando} onClick={() => void baixar(true)}>
            <Icone nome="baixar" />{baixando === "final" ? "Abrindo…" : "Baixar o PDF final"}
          </Botao>
        ) : null}
      </Passo>

      <p className="t-apoio">Guardamos o arquivo enviado, a data e o endereço de internet. A assinatura é conferida no validador oficial do governo (validar.iti.gov.br). Dúvida? Fale pelo WhatsApp comercial.</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Duvida texto="Falar pelo WhatsApp comercial" mensagem={MENSAGEM} />
        <Link href={`/o/${codigo}`} className="inline-flex min-h-11 items-center gap-1.5 t-texto font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Ver a proposta aceita</Link>
      </div>
    </Pagina>
  );
}

function EnviarDocumento({ codigo, faltam, aberto: inicial, feito }: { codigo: string; faltam: DocumentoAceite[]; aberto: boolean; feito: (t: string, tom?: "ok" | "atencao") => void }) {
  const [aberto, setAberto] = useState(inicial);
  const [tipo, setTipo] = useState<DocumentoAceite>(faltam[0] ?? "CNPJ");
  const [cnpj, setCnpj] = useState("");
  const [mandato, setMandato] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!aberto) return <Botao variante="discreto" className="justify-self-start" onClick={() => setAberto(true)}><Icone nome="enviar" />Enviar outro documento</Botao>;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const p: Record<string, string> = {};
    const doc = problemaDoDocumento(tipo, { cnpj, mandatoAte: mandato }, hojeBrasilia());
    if (doc) p[doc.campo] = doc.texto;
    const pdf = arquivo ? problemaDoPdf(arquivo) : "Escolha o PDF.";
    if (pdf) p.arquivo = pdf;
    setProblemas(p);
    if (Object.keys(p).length) return;
    setEnviando(true);
    const r = await enviarPdf(ROTAS_CONTRATO.publicoDocumentos(codigo), { tipo, cnpj: tipo === "CNPJ" ? cnpj : null, mandatoAte: tipo === "ATA_ELEICAO" ? mandato : null },
      arquivo!, (id) => ROTAS_CONTRATO.publicoVerificarDocumento(codigo, id), "documentoId");
    setEnviando(false);
    if (!r.ok) return setErro(r.texto);
    if (r.dados.situacao !== "RECEBIDO") return setErro(String(r.dados.motivoTexto ?? r.dados.motivo ?? "O arquivo não serviu. Envie de novo."));
    setArquivo(null);
    setCnpj("");
    setMandato("");
    feito(`${DOCUMENTOS_ACEITE[tipo]} recebido. Obrigado!`);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-3 border-t border-linha pt-3">
      <EscolhaBotoes nome="link-doc-tipo" legenda="Qual documento" valor={tipo} aoMudar={setTipo}
        opcoes={(Object.entries(DOCUMENTOS_ACEITE) as [DocumentoAceite, string][]).map(([valor, texto]) => ({ valor, texto }))} />
      {tipo === "CNPJ" ? (
        <CampoTexto id="link-doc-cnpj" rotulo="CNPJ do condomínio" inputMode="numeric" maxLength={18} value={cnpj} onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
          placeholder="00.000.000/0001-00" erro={problemas.cnpj} />
      ) : null}
      {tipo === "ATA_ELEICAO" ? (
        <CampoTexto id="link-doc-mandato" rotulo="Mandato do síndico até" type="date" min={hojeBrasilia()} value={mandato} onChange={(e) => setMandato(e.target.value)}
          ajuda="Como está na ata da eleição." erro={problemas.mandatoAte} />
      ) : null}
      <CampoPdf id="link-doc-arquivo" rotulo="Escolher o PDF" ajuda="Só PDF, até 10 MB." arquivo={arquivo} aoEscolher={setArquivo} erro={problemas.arquivo} />
      {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
      <Botao type="submit" className="w-full sm:w-auto sm:justify-self-start" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar o documento"}</Botao>
    </form>
  );
}

function EnviarAssinado({ codigo, feito }: { codigo: string; feito: (t: string, tom?: "ok" | "atencao") => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [problema, setProblema] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const p = arquivo ? problemaDoPdf(arquivo) : "Escolha o PDF assinado.";
    setProblema(p ?? undefined);
    if (p) return;
    setEnviando(true);
    const r = await enviarPdf(ROTAS_CONTRATO.publicoAssinado(codigo), {}, arquivo!, (id) => ROTAS_CONTRATO.publicoVerificarAssinado(codigo, id), "envioId");
    setEnviando(false);
    if (!r.ok) return setErro(r.texto);
    const t = textoDoEnvio(r.dados);
    setArquivo(null);
    feito(t.texto, t.ok ? "ok" : "atencao");
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      <CampoPdf id="link-assinado" rotulo="Enviar o PDF assinado" ajuda="Só PDF, até 10 MB. Envie o arquivo que o gov.br devolveu, sem mudar o nome nem juntar páginas."
        arquivo={arquivo} aoEscolher={setArquivo} erro={problema} />
      {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
      {arquivo ? <Botao type="submit" className="w-full sm:w-auto sm:justify-self-start" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar este PDF"}</Botao> : null}
    </form>
  );
}
