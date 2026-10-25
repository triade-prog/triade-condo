"use client";
// As janelas do contrato pelo gov.br (0308, R17.4; quadros 440 e 442, aprovados em 25/10/2026;
// CM-13): gerar (e gerar de novo, com o motivo), o documento que chegou por outro canal, o PDF
// assinado pela TRÍADE (ou o do condomínio que chegou por outro canal) e a conferência no
// validador do governo, com as três marcas obrigatórias e o recusar com motivo. Toda gravação
// passa pela api-console; a ordem das assinaturas e quem pode são do banco.

import { useState, type FormEvent, type ReactNode } from "react";
import { DOCUMENTOS_ACEITE, formatarCnpj, formatarCpf, type DocumentoAceite, type ParteContrato } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, type ErroApi } from "@triade/ui";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useSessao } from "../sessao.tsx";
import { hojeBrasilia } from "./cliente.ts";
import {
  ASSINADOR_GOVBR, baixarPeloLink, diaHoraCurto, enviarPdf, hashCurto, problemaDoDocumento, problemaDoPdf, ROTAS_CONTRATO, textoDoEnvio, VALIDADOR_GOVBR,
  type ContratoTela, type EnvioTela, type RespostaContrato,
} from "./contrato.ts";

const primeiroNome = (n?: string) => (n ?? "").trim().split(/\s+/)[0] ?? "";

/** Escolher o PDF: um rótulo grande, que no celular é o alvo do toque, sobre o campo de arquivo de verdade. */
export function CampoPdf({ id, rotulo, ajuda, arquivo, aoEscolher, erro }: {
  id: string; rotulo: string; ajuda: string; arquivo: File | null; aoEscolher: (f: File | null) => void; erro?: string;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id}
        className="grid min-h-11 cursor-pointer justify-items-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-tinta-suave bg-fundo px-3 py-4 text-center hover:border-violeta-600 has-focus-visible:border-violeta-600 has-focus-visible:shadow-[var(--anel)]">
        <Icone nome="enviar" className="h-5.5 w-5.5 text-violeta-600" />
        <span className="t-texto font-semibold text-violeta-600">{arquivo ? arquivo.name : rotulo}</span>
        <span className="t-apoio">{arquivo ? `${(arquivo.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB · toque para trocar` : ajuda}</span>
      </label>
      <input id={id} type="file" accept="application/pdf,.pdf" className="sr-only" aria-describedby={erro ? `${id}-erro` : undefined}
        aria-invalid={erro ? true : undefined} onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)} />
      {erro ? <span id={`${id}-erro`} className="t-apoio text-erro">{erro}</span> : null}
    </div>
  );
}

/** Baixar pelo link de 5 minutos, com o erro em texto. */
export function useBaixar() {
  const [baixando, setBaixando] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  async function baixar(caminho: string) {
    setProblema(null);
    setBaixando(caminho);
    const p = await baixarPeloLink(caminho);
    setBaixando(null);
    if (p) setProblema(p);
  }
  return { baixando, problema, baixar };
}

/** Gerar contrato (e gerar de novo): a data de início e, de novo, o motivo (as assinaturas começam do zero). */
export function JanelaGerar({ r, aoFechar, feito }: { r: RespostaContrato; aoFechar: () => void; feito: (texto: string) => void }) {
  const deNovo = !!r.contrato;
  const [inicio, setInicio] = useState(r.contrato?.dataInicio ?? hojeBrasilia());
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(!inicio ? ["dataInicio"] : []), ...(deNovo && motivo.trim().length < 3 ? ["motivo"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const x = await chamarApi(ROTAS_CONTRATO.contrato(r.interessado.id), { corpo: { dataInicio: inicio, motivo: deNovo ? motivo.trim() : null } });
    setEnviando(false);
    if (!x.ok) return setErro(x.erro);
    feito(deNovo ? "Contrato gerado de novo. As duas assinaturas começam do zero; o anterior fica guardado como substituído." : "Contrato gerado. O síndico já pode baixar e assinar pelo link da proposta.");
  }

  return (
    <Dialogo aberto titulo={deNovo ? "Gerar o contrato de novo" : "Gerar contrato"} aoFechar={aoFechar} media
      apoio={r.modeloEmUso ? `Do modelo ${r.modeloEmUso.titulo} v${r.modeloEmUso.numero} e da proposta v${r.aceite?.proposta ?? 1} aceita.` : undefined}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">
          {deNovo
            ? "Gerar de novo (por exemplo, para corrigir um dado) cria um PDF novo e pede as assinaturas outra vez; o anterior fica guardado como substituído."
            : "Contrato e termo de tratamento de dados num arquivo só, com a impressão digital em cada folha. Cada parte assina o mesmo PDF pelo gov.br: primeiro o condomínio, depois a TRÍADE."}
        </p>
        <CampoTexto id="contrato-inicio" rotulo="Data de início" type="date" min={hojeBrasilia()} value={inicio} onChange={(e) => setInicio(e.target.value)}
          ajuda="De hoje a 180 dias. Vai no contrato e na primeira cobrança." erro={campos.includes("dataInicio") ? "A data de início vai de hoje a 180 dias." : undefined} />
        {deNovo ? (
          <CampoAreaTexto id="contrato-motivo" rotulo="Por que gerar de novo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            ajuda="Fica no histórico do contrato." erro={campos.includes("motivo") ? "Diga por que gerar de novo (as assinaturas começam do zero)." : undefined} />
        ) : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={deNovo ? "Gerar de novo" : "Gerar contrato"} icone="documento" perigo={deNovo} />
      </form>
    </Dialogo>
  );
}

/** O documento que o síndico mandou por outro canal (quadro 441, pela equipe). */
export function JanelaDocumento({ interessadoId, inicial, aoFechar, feito }: { interessadoId: string; inicial: DocumentoAceite; aoFechar: () => void; feito: (texto: string) => void }) {
  const [tipo, setTipo] = useState<DocumentoAceite>(inicial);
  const [cnpj, setCnpj] = useState("");
  const [mandato, setMandato] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
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
    const r = await enviarPdf(ROTAS_CONTRATO.documentos(interessadoId), { tipo, cnpj: tipo === "CNPJ" ? cnpj : null, mandatoAte: tipo === "ATA_ELEICAO" ? mandato : null },
      arquivo!, ROTAS_CONTRATO.verificarDocumento, "documentoId");
    setEnviando(false);
    if (!r.ok) return setErro(r.texto);
    if (r.dados.situacao !== "RECEBIDO") return setErro(String(r.dados.motivoTexto ?? r.dados.motivo ?? "O arquivo não serviu. Envie de novo."));
    feito(`${DOCUMENTOS_ACEITE[tipo]} recebido pela equipe.`);
  }

  return (
    <Dialogo aberto titulo="Enviar documento pela equipe" aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-apoio">Quando o síndico mandou por outro canal. Fica registrado que a equipe enviou, com o seu nome.</p>
        <EscolhaBotoes nome="doc-tipo" legenda="Documento" valor={tipo} aoMudar={setTipo}
          opcoes={(Object.entries(DOCUMENTOS_ACEITE) as [DocumentoAceite, string][]).map(([valor, texto]) => ({ valor, texto }))} />
        {tipo === "CNPJ" ? (
          <CampoTexto id="doc-cnpj" rotulo="CNPJ do condomínio" inputMode="numeric" maxLength={18} value={cnpj} onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
            placeholder="00.000.000/0001-00" erro={problemas.cnpj} />
        ) : null}
        {tipo === "ATA_ELEICAO" ? (
          <CampoTexto id="doc-mandato" rotulo="Mandato do síndico até" type="date" min={hojeBrasilia()} value={mandato} onChange={(e) => setMandato(e.target.value)}
            ajuda="Como está na ata." erro={problemas.mandatoAte} />
        ) : null}
        {tipo === "ATA_APROVACAO" ? <p className="t-apoio">Só quando a convenção pede aprovação da contratação em assembleia.</p> : null}
        <CampoPdf id="doc-arquivo" rotulo="Escolher o PDF" ajuda="Só PDF, até 10 MB." arquivo={arquivo} aoEscolher={setArquivo} erro={problemas.arquivo} />
        {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Enviar o documento" icone="enviar" />
      </form>
    </Dialogo>
  );
}

/** O PDF assinado enviado pela equipe: o da TRÍADE (sobre o arquivo já assinado pelo condomínio) ou o do condomínio. */
export function JanelaEnviarAssinado({ contrato, parte, condominioEnvio, nomeCondominio, aoFechar, feito }: {
  contrato: ContratoTela; parte: ParteContrato; condominioEnvio?: string; nomeCondominio: string; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [problema, setProblema] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const b = useBaixar();
  const triade = parte === "TRIADE";

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const p = arquivo ? problemaDoPdf(arquivo) : "Escolha o PDF assinado.";
    setProblema(p ?? undefined);
    if (p) return;
    setEnviando(true);
    const r = await enviarPdf(ROTAS_CONTRATO.envios(contrato.id), { parte }, arquivo!, ROTAS_CONTRATO.verificarEnvio, "envioId");
    setEnviando(false);
    if (!r.ok) return setErro(r.texto);
    const t = textoDoEnvio(r.dados);
    if (!t.ok) return setErro(t.texto);
    feito(triade ? "PDF assinado pela TRÍADE recebido. Falta conferir no validar.iti.gov.br." : "PDF assinado pelo condomínio recebido pela equipe. Falta conferir no validar.iti.gov.br.");
  }

  return (
    <Dialogo aberto titulo={triade ? "Enviar o PDF assinado pela TRÍADE" : "Enviar o PDF que o condomínio assinou"} aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <ol className="grid list-decimal gap-1.5 pl-5 t-texto">
          {triade ? <li>{`Baixe o PDF já assinado pela ${primeiroNome(nomeCondominio)}. Assim o arquivo final leva as duas assinaturas.`}</li> : <li>Use o PDF que o síndico devolveu do gov.br, sem mudar nada.</li>}
          {triade ? <li>Abra o assinador do gov.br, entre com a sua conta (prata ou ouro) e assine esse arquivo.</li> : null}
          <li>Envie aqui o PDF assinado. O sistema confere sozinho se tem assinatura nova e se é o contrato gerado.</li>
        </ol>
        {triade ? (
          <div className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="contorno" disabled={!condominioEnvio || !!b.baixando} onClick={() => condominioEnvio && void b.baixar(ROTAS_CONTRATO.linkContrato(contrato.id, condominioEnvio))}>
              <Icone nome="baixar" />{`Baixar o PDF assinado pela ${primeiroNome(nomeCondominio)}`}
            </Botao>
            <a href={ASSINADOR_GOVBR} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 t-texto font-semibold text-violeta-600 hover:underline">
              <Icone nome="link" className="h-4 w-4" />Abrir o assinador do gov.br
            </a>
          </div>
        ) : null}
        {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
        <CampoPdf id="assinado-arquivo" rotulo="Escolher o PDF assinado" ajuda="Só PDF, até 10 MB. O arquivo que o gov.br devolveu, sem mudar o nome nem juntar páginas."
          arquivo={arquivo} aoEscolher={setArquivo} erro={problema} />
        {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Enviar o PDF assinado" icone="enviar" />
      </form>
    </Dialogo>
  );
}

function Marca({ feito, titulo, texto }: { feito: boolean; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-3 border-t border-linha py-3 first:border-t-0">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${feito ? "bg-ok-fundo text-ok" : "bg-erro-fundo text-erro"}`} aria-hidden="true">
        <Icone nome={feito ? "check" : "fechar"} className="h-3.5 w-3.5" />
      </span>
      <span className="grid gap-0.5"><span className="t-texto font-medium">{titulo}</span><span className="t-apoio">{texto}</span></span>
      <span className="sr-only">{feito ? "Conferido pelo sistema" : "Não passou"}</span>
    </li>
  );
}

function Parte({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="grid gap-1 rounded-[16px] border border-linha px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="t-titulo-cartao">{titulo}</h3>{acao}</div>
      {children}
    </section>
  );
}

/** Conferir a assinatura (quadro 442): o que o sistema já conferiu, as três marcas do validador e o recusar com motivo. */
export function JanelaConferir({ r, envio, aoFechar, feito }: { r: RespostaContrato; envio: EnvioTela; aoFechar: () => void; feito: (texto: string) => void }) {
  const sessao = useSessao();
  const c = r.contrato!;
  const condominio = envio.parte === "CONDOMINIO";
  const quem = condominio ? r.aceite?.nome ?? "quem aceitou" : "TRÍADE";
  const [marcas, setMarcas] = useState({ assinaturaValida: false, pessoaConfere: false, dataConfere: false });
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState(condominio ? "" : sessao.nome);
  const [obs, setObs] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const b = useBaixar();
  const campos = camposComErro(erro);
  const auto = envio.automatica;
  const autoOk = [auto?.temAssinatura, auto?.eOGerado].filter(Boolean).length;
  const conferivel = envio.situacao === "A_CONFERIR";
  const todas = marcas.assinaturaValida && marcas.pessoaConfere && marcas.dataConfere;
  const gerado = diaHoraCurto(c.geradoEm);

  async function conferir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!todas) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: Object.entries(marcas).filter(([, v]) => !v).map(([k]) => k) } });
    if (!condominio && cpf.replace(/\D/g, "").length !== 11) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["cpf"] } });
    setEnviando(true);
    const x = await chamarApi(ROTAS_CONTRATO.conferir(envio.id), {
      corpo: { versao: envio.versao, ...marcas, cpf: cpf || null, assinanteNome: condominio ? null : nome.trim() || null, observacao: obs.trim() || null },
    });
    setEnviando(false);
    if (!x.ok) return setErro(x.erro);
    feito(condominio ? `Assinatura da ${primeiroNome(quem)} conferida. Agora a TRÍADE assina sobre o mesmo arquivo.` : "Assinatura da TRÍADE conferida. Contrato assinado pelos dois.");
  }

  async function recusar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (motivo.trim().length < 3) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["motivo"] } });
    setEnviando(true);
    const x = await chamarApi(ROTAS_CONTRATO.recusar(envio.id), { corpo: { versao: envio.versao, motivo: motivo.trim() } });
    setEnviando(false);
    if (!x.ok) return setErro(x.erro);
    feito(`Envio recusado. ${condominio ? "O síndico vê o motivo no link e envia de novo." : "Assine de novo e envie."}`);
  }

  const titulo = condominio ? `Conferir a assinatura da ${primeiroNome(quem)}` : "Conferir a assinatura da TRÍADE";
  const linhaArquivo = (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-superficie-2 px-3 py-2.5">
      <Icone nome="documento" className="h-5 w-5 shrink-0 text-violeta-600" />
      <span className="min-w-0 flex-1 t-texto [overflow-wrap:anywhere]">
        {`${envio.nome ?? "PDF assinado"} · enviado ${envio.peloLink ? "pelo link" : `pela equipe${envio.enviadoPor ? ` (${envio.enviadoPor.nome})` : ""}`} em ${diaHoraCurto(envio.enviadoEm)}`}
      </span>
      <Botao variante="discreto" disabled={!!b.baixando} onClick={() => void b.baixar(ROTAS_CONTRATO.linkContrato(c.id, envio.id))}><Icone nome="baixar" />Baixar</Botao>
    </div>
  );

  if (recusando) {
    return (
      <Dialogo aberto titulo="Recusar e pedir de novo" aoFechar={aoFechar} media>
        <form onSubmit={recusar} className="grid gap-4" noValidate>
          {linhaArquivo}
          <p className="t-texto">{condominio ? "O síndico vê o motivo no link da proposta e envia o PDF assinado de novo." : "O envio fica guardado como recusado. Assine de novo e envie."}</p>
          <CampoAreaTexto id="recusa-motivo" rotulo={condominio ? "Motivo (o síndico vai ver)" : "Motivo"} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="O CPF no validador não é o de quem aceitou a proposta." erro={campos.includes("motivo") ? "Diga o motivo, que o síndico vai ver." : undefined} />
          {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
          <div className="flex flex-wrap justify-end gap-2 max-md:grid">
            <Botao variante="discreto" onClick={() => { setRecusando(false); setErro(null); }}>Voltar à conferência</Botao>
            <Botao type="submit" variante="perigo" disabled={enviando}><Icone nome="fechar" />{enviando ? "Salvando…" : "Recusar o envio"}</Botao>
          </div>
        </form>
      </Dialogo>
    );
  }

  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar} larga apoio={`${r.interessado.condominio} · contrato nº ${c.numero} · as três marcas de baixo são obrigatórias.`}>
      <form onSubmit={conferir} className="grid gap-4" noValidate>
        {linhaArquivo}
        {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Parte titulo="O sistema já conferiu" acao={<Selo tom={autoOk === 2 ? "ok" : "atencao"}>{`${autoOk} de 2`}</Selo>}>
            <ul className="grid">
              <Marca feito={!!auto?.temAssinatura} titulo="Tem assinatura digital"
                texto={auto?.temAssinatura ? "O arquivo traz uma assinatura nova no padrão do gov.br (PAdES)." : "O arquivo não tem assinatura digital nova."} />
              <Marca feito={!!auto?.eOGerado} titulo="É o contrato gerado"
                texto={auto?.eOGerado ? `O conteúdo assinado é o PDF de ${gerado} (impressão digital ${hashCurto(c.hash)}), sem mudança.` : "O conteúdo assinado é diferente do PDF gerado. O envio não conta."} />
            </ul>
          </Parte>
          <Parte titulo="Você confere no validador do governo"
            acao={<a href={VALIDADOR_GOVBR} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 t-texto font-semibold text-violeta-600 hover:underline"><Icone nome="link" className="h-4 w-4" />Abrir validar.iti.gov.br</a>}>
            <p className="t-apoio md:hidden">As três marcas são obrigatórias.</p>
            <fieldset className="grid" disabled={!conferivel}>
              <legend className="sr-only">As três conferências do validador, obrigatórias</legend>
              {([
                ["assinaturaValida", "A assinatura é válida", "No validar.iti.gov.br, o resultado diz \"assinatura aprovada\"."],
                ["pessoaConfere", `Quem assinou é ${condominio ? `a ${quem}` : "quem assina pela TRÍADE"}`,
                  condominio ? `O nome e o CPF no validador batem com o aceite${r.aceite?.cpfMascarado ? `: ${r.aceite.cpfMascarado}` : ""}.` : "O nome e o CPF no validador são de quem assina pela TRÍADE."],
                ["dataConfere", "Foi assinado depois de gerado", `A data da assinatura no validador é depois de ${gerado}.`],
              ] as const).map(([k, t, s]) => (
                <label key={k} className="flex min-h-11 cursor-pointer items-start gap-3 border-t border-linha py-3 first:border-t-0">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={marcas[k]} onChange={(e) => setMarcas((m) => ({ ...m, [k]: e.target.checked }))} />
                  <span className="grid gap-0.5"><span className="t-texto font-medium">{t}</span><span className="t-apoio">{s}</span></span>
                </label>
              ))}
            </fieldset>
            {campos.some((x) => ["assinaturaValida", "pessoaConfere", "dataConfere"].includes(x)) ? <p className="t-apoio text-erro">Marque as três conferências do validador.</p> : null}
          </Parte>
        </div>
        {!conferivel ? <Aviso tom="atencao">{envio.motivoTexto ?? "Este envio não passou na conferência automática. Recuse e peça de novo."}</Aviso> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="conferir-cpf" rotulo={condominio ? "CPF que o validador mostra" : "CPF de quem assinou pela TRÍADE"} opcional={condominio} inputMode="numeric" maxLength={14}
            value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} disabled={!conferivel}
            ajuda={condominio ? "Se digitar, o sistema confere com o do aceite. Fica guardado só mascarado." : "Como o validador mostra. Fica guardado só mascarado."}
            erro={campos.includes("cpf") ? "Digite o CPF que o validador mostra." : undefined} />
          {!condominio ? (
            <CampoTexto id="conferir-nome" rotulo="Nome de quem assinou" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} disabled={!conferivel}
              erro={campos.includes("assinanteNome") ? "Diga o nome de quem assinou pela TRÍADE." : undefined} />
          ) : null}
        </div>
        <CampoAreaTexto id="conferir-obs" rotulo="Observação" opcional maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} disabled={!conferivel}
          placeholder="Conferido pelo validador; selo gov.br ouro." ajuda="Fica no histórico do contrato com o seu nome e a hora." />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 max-md:grid">
          <Botao variante="discreto" onClick={() => { setRecusando(true); setErro(null); }}><Icone nome="fechar" />Recusar e pedir de novo</Botao>
          <span className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={!conferivel || !todas || enviando} aria-describedby={!todas ? "conferir-falta" : undefined}>
              <Icone nome="escudo" />{enviando ? "Salvando…" : "Marcar como conferida"}
            </Botao>
          </span>
        </div>
        {!todas && conferivel ? <p id="conferir-falta" className="t-apoio text-right max-md:text-left">Liga depois das três marcas do validador.</p> : null}
      </form>
    </Dialogo>
  );
}
