"use client";
// As assinaturas dos aditivos pelo gov.br (0318; R17.7b e R17.7c, quadro 488; CM-13), no mesmo jeito
// do contrato (0308, quadros 440 e 442): primeiro o condomínio, depois a TRÍADE, sobre o mesmo
// arquivo. Não há link para o síndico: a equipe envia aqui o PDF que ele assinou e mandou pelo
// WhatsApp comercial ou por e-mail, e o da TRÍADE. O sistema confere sozinho se o arquivo tem
// assinatura e se é o PDF gerado; a equipe confere no validar.iti.gov.br as mesmas três marcas.

import { useState, type FormEvent, type ReactNode } from "react";
import { formatarCpf } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, type ErroApi } from "@triade/ui";
import { Cartao } from "../comum.tsx";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useSessao } from "../sessao.tsx";
import { ASSINADOR_GOVBR, diaHoraCurto, enviarPdf, hashCurto, problemaDoPdf, textoDoEnvio, VALIDADOR_GOVBR } from "./contrato.ts";
import { CampoPdf, Marca, Parte, useBaixar } from "./janelasContrato.tsx";
import {
  assinadasAditivo, envioConferido, envioParaConferir, estadoParte, PARTES_ADITIVO, podeEnviarParte, ROTAS_RENOVACOES,
  type AditivoResumo, type EnvioAditivo, type ParteAditivo,
} from "./renovacoes.ts";

export type JanelaAssinatura = { tipo: "enviarAditivo"; parte: ParteAditivo } | { tipo: "conferirAditivo"; envio: EnvioAditivo };

const TOM_PASSO = { ok: "bg-ok-fundo text-ok", atencao: "bg-atencao-fundo text-atencao", neutro: "bg-superficie-2 text-tinta-suave", erro: "bg-erro-fundo text-erro", info: "bg-violeta-50 text-violeta-700", andamento: "bg-violeta-50 text-violeta-700" } as const;

/**
 * O cartão "Assinaturas pelo gov.br" de um aditivo: as duas partes na ordem, o que falta em cada
 * uma e os botões de enviar e conferir. `nota` diz o que a assinatura muda (no reajuste, nada).
 */
export function CartaoAssinaturasAditivo({ id, aditivo, quemCondominio, podeEditar, podeAssinar, abrir, nota, triadeNaCabeca }: {
  id: string; aditivo: AditivoResumo; quemCondominio: string; podeEditar: boolean; podeAssinar: boolean; abrir: (j: JanelaAssinatura) => void; nota?: ReactNode;
  /** O botão de enviar o PDF da TRÍADE já está no alto da página (quadro 488): não repete aqui. */
  triadeNaCabeca?: boolean;
}) {
  const sessao = useSessao();
  const n = assinadasAditivo(aditivo);
  return (
    <Cartao id={id} titulo="Assinaturas pelo gov.br" icone="escudo" acao={<Selo tom={n === 2 ? "ok" : n ? "atencao" : "neutro"}>{`${n} de 2`}</Selo>}>
      <ol className="grid" aria-label="Assinaturas, nesta ordem">
        {PARTES_ADITIVO.map((parte, i) => {
          const s = estadoParte(aditivo, parte);
          const conferir = envioParaConferir(aditivo, parte);
          const feito = !!envioConferido(aditivo, parte);
          const titulo = parte === "CONDOMINIO" ? `${quemCondominio} assina pelo condomínio` : `${podeAssinar ? sessao.nome : "A Administração"} assina pela TRÍADE`;
          return (
            <li key={parte} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-linha py-3 first:border-t-0">
              <span className={`grid h-7 w-7 place-items-center rounded-full t-texto font-bold ${TOM_PASSO[s.tom]}`} aria-hidden="true">
                {feito ? <Icone nome="check" className="h-4 w-4" /> : i + 1}
              </span>
              <span className="grid min-w-0 gap-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="t-texto font-medium">{titulo}</span>
                  <Selo tom={s.tom}>{s.texto}</Selo>
                </span>
                <span className="t-apoio">{s.apoio}</span>
                <span className="flex flex-wrap gap-2">
                  {conferir && podeEditar ? (
                    <Botao variante={conferir.situacao === "A_CONFERIR" ? "primario" : "contorno"} onClick={() => abrir({ tipo: "conferirAditivo", envio: conferir })}>
                      <Icone nome="escudo" />{conferir.situacao === "A_CONFERIR" ? "Conferir a assinatura" : "Ver e recusar o envio"}
                    </Botao>
                  ) : null}
                  {parte === "CONDOMINIO" && podeEditar && podeEnviarParte(aditivo, parte) ? (
                    <Botao variante="secundario" onClick={() => abrir({ tipo: "enviarAditivo", parte })}><Icone nome="enviar" />Enviar o PDF que o condomínio mandou</Botao>
                  ) : null}
                  {parte === "TRIADE" && podeAssinar && !triadeNaCabeca && podeEnviarParte(aditivo, parte) ? (
                    <Botao variante="secundario" onClick={() => abrir({ tipo: "enviarAditivo", parte })}><Icone nome="enviar" />Enviar o PDF assinado pela TRÍADE</Botao>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-1.5 border-t border-linha pt-3 t-apoio">
        {nota ? <p>{nota}</p> : null}
        <p>A equipe envia aqui o PDF que o síndico assinou (pelo WhatsApp comercial ou por e-mail) e confere no validar.iti.gov.br, como no contrato. O sistema confere sozinho se o arquivo tem assinatura e se é o PDF gerado.</p>
      </div>
    </Cartao>
  );
}

/** O PDF assinado enviado pela equipe: o que o condomínio mandou ou o da TRÍADE (sobre o já assinado pelo condomínio). */
export function JanelaEnviarAditivo({ aditivo, parte, aoFechar, feito }: {
  aditivo: AditivoResumo; parte: ParteAditivo; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [problema, setProblema] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const b = useBaixar();
  const triade = parte === "TRIADE";
  const doCondominio = envioConferido(aditivo, "CONDOMINIO");

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const p = arquivo ? problemaDoPdf(arquivo) : "Escolha o PDF assinado.";
    setProblema(p ?? undefined);
    if (p) return;
    setEnviando(true);
    const r = await enviarPdf(ROTAS_RENOVACOES.enviosAditivo(aditivo.id), { parte }, arquivo!, ROTAS_RENOVACOES.verificarEnvioAditivo, "envioId");
    setEnviando(false);
    if (!r.ok) return setErro(r.texto);
    const t = textoDoEnvio(r.dados);
    if (!t.ok) return setErro(String(r.dados.situacao) === "SUBSTITUIDO" ? "Este aditivo foi gerado de novo. Baixe o novo, assine e envie." : t.texto);
    feito(triade ? "PDF assinado pela TRÍADE recebido. Falta conferir no validar.iti.gov.br." : "PDF assinado pelo condomínio recebido. Falta conferir no validar.iti.gov.br.");
  }

  return (
    <Dialogo aberto titulo={triade ? "Enviar o PDF assinado pela TRÍADE" : "Enviar o PDF que o condomínio assinou"} aoFechar={aoFechar} media
      apoio={`Aditivo nº ${aditivo.numero} · impressão digital ${hashCurto(aditivo.hash)}`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <ol className="grid list-decimal gap-1.5 pl-5 t-texto">
          {triade ? <li>Baixe o PDF já assinado pelo condomínio. Assim o arquivo final leva as duas assinaturas.</li>
            : <li>Use o PDF que o síndico devolveu do gov.br (pelo WhatsApp comercial ou por e-mail), sem mudar nada.</li>}
          {triade ? <li>Abra o assinador do gov.br, entre com a sua conta (prata ou ouro) e assine esse arquivo.</li> : null}
          <li>Envie aqui o PDF assinado. O sistema confere sozinho se tem assinatura nova e se é o aditivo gerado.</li>
        </ol>
        {triade ? (
          <div className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="contorno" disabled={!doCondominio || !!b.baixando} onClick={() => doCondominio && void b.baixar(ROTAS_RENOVACOES.linkAditivoPdf(aditivo.id, doCondominio.id))}>
              <Icone nome="baixar" />Baixar o PDF assinado pelo condomínio
            </Botao>
            <a href={ASSINADOR_GOVBR} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 t-texto font-semibold text-violeta-600 hover:underline">
              <Icone nome="link" className="h-4 w-4" />Abrir o assinador do gov.br
            </a>
          </div>
        ) : null}
        {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
        <CampoPdf id="aditivo-assinado-arquivo" rotulo="Escolher o PDF assinado" ajuda="Só PDF, até 10 MB. O arquivo que o gov.br devolveu, sem juntar páginas."
          arquivo={arquivo} aoEscolher={setArquivo} erro={problema} />
        {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Enviar o PDF assinado" icone="enviar" />
      </form>
    </Dialogo>
  );
}

/** Conferir a assinatura do aditivo (como o quadro 442): o que o sistema já conferiu, as três marcas e o recusar com motivo. */
export function JanelaConferirAditivo({ aditivo, envio, condominio, aoFechar, feito }: {
  aditivo: AditivoResumo; envio: EnvioAditivo; condominio: string; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const sessao = useSessao();
  const doCondominio = envio.parte === "CONDOMINIO";
  // O reajuste não tem representante no retrato: o banco pede o CPF e o nome também do condomínio.
  const exigeAssinante = !doCondominio || aditivo.tipo === "REAJUSTE";
  const campos0 = aditivo.dados?.campos ?? {};
  const [marcas, setMarcas] = useState({ assinaturaValida: false, pessoaConfere: false, dataConfere: false });
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState(doCondominio ? campos0.representante ?? "" : sessao.nome);
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
  const gerado = aditivo.geradoEm ? diaHoraCurto(aditivo.geradoEm) : null;

  async function conferir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!todas) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: Object.entries(marcas).filter(([, v]) => !v).map(([k]) => k) } });
    const faltam = [...(exigeAssinante && cpf.replace(/\D/g, "").length !== 11 ? ["cpf"] : []), ...(exigeAssinante && !nome.trim() ? ["assinanteNome"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando(true);
    const x = await chamarApi(ROTAS_RENOVACOES.conferirEnvioAditivo(envio.id), {
      corpo: { versao: envio.versao, ...marcas, cpf: cpf || null, assinanteNome: nome.trim() || null, observacao: obs.trim() || null },
    });
    setEnviando(false);
    if (!x.ok) return setErro(x.erro);
    feito(doCondominio ? "Assinatura do condomínio conferida. Agora a TRÍADE assina sobre o mesmo arquivo." : "Assinatura da TRÍADE conferida. Aditivo assinado pelos dois.");
  }

  async function recusar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (motivo.trim().length < 3) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["motivo"] } });
    setEnviando(true);
    const x = await chamarApi(ROTAS_RENOVACOES.recusarEnvioAditivo(envio.id), { corpo: { versao: envio.versao, motivo: motivo.trim() } });
    setEnviando(false);
    if (!x.ok) return setErro(x.erro);
    feito(doCondominio ? "Envio recusado. Peça ao síndico o PDF assinado de novo e envie aqui." : "Envio recusado. Assine de novo e envie.");
  }

  const linhaArquivo = (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-superficie-2 px-3 py-2.5">
      <Icone nome="documento" className="h-5 w-5 shrink-0 text-violeta-600" />
      <span className="min-w-0 flex-1 t-texto [overflow-wrap:anywhere]">
        {`${envio.nome ?? "PDF assinado"} · enviado pela equipe${envio.enviadoPor ? ` (${envio.enviadoPor.nome})` : ""} em ${diaHoraCurto(envio.enviadoEm)}`}
      </span>
      <Botao variante="discreto" disabled={!!b.baixando} onClick={() => void b.baixar(ROTAS_RENOVACOES.linkAditivoPdf(aditivo.id, envio.id))}><Icone nome="baixar" />Baixar</Botao>
    </div>
  );

  if (recusando) {
    return (
      <Dialogo aberto titulo="Recusar o envio" aoFechar={aoFechar} media>
        <form onSubmit={recusar} className="grid gap-4" noValidate>
          {linhaArquivo}
          <p className="t-texto">O envio fica guardado como recusado. A equipe pede o PDF assinado de novo e envia aqui.</p>
          <CampoAreaTexto id="aditivo-recusa-motivo" rotulo="Motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="O CPF no validador não é o de quem representa o condomínio." erro={campos.includes("motivo") ? "Diga o motivo (de 3 a 300 letras)." : undefined} />
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
    <Dialogo aberto titulo={doCondominio ? "Conferir a assinatura do condomínio" : "Conferir a assinatura da TRÍADE"} aoFechar={aoFechar} larga
      apoio={`${condominio} · aditivo nº ${aditivo.numero} · as três marcas de baixo são obrigatórias.`}>
      <form onSubmit={conferir} className="grid gap-4" noValidate>
        {linhaArquivo}
        {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Parte titulo="O sistema já conferiu" acao={<Selo tom={autoOk === 2 ? "ok" : "atencao"}>{`${autoOk} de 2`}</Selo>}>
            <ul className="grid">
              <Marca feito={!!auto?.temAssinatura} titulo="Tem assinatura digital"
                texto={auto?.temAssinatura ? "O arquivo traz uma assinatura nova no padrão do gov.br (PAdES)." : "O arquivo não tem assinatura digital nova."} />
              <Marca feito={!!auto?.eOGerado} titulo="É o aditivo gerado"
                texto={auto?.eOGerado ? `O conteúdo assinado é o PDF ${gerado ? `de ${gerado} ` : ""}(impressão digital ${hashCurto(aditivo.hash)}), sem mudança.` : "O conteúdo assinado é diferente do PDF gerado. O envio não conta."} />
            </ul>
          </Parte>
          <Parte titulo="Você confere no validador do governo"
            acao={<a href={VALIDADOR_GOVBR} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 t-texto font-semibold text-violeta-600 hover:underline"><Icone nome="link" className="h-4 w-4" />Abrir validar.iti.gov.br</a>}>
            <p className="t-apoio md:hidden">As três marcas são obrigatórias.</p>
            <fieldset className="grid" disabled={!conferivel}>
              <legend className="sr-only">As três conferências do validador, obrigatórias</legend>
              {([
                ["assinaturaValida", "A assinatura é válida", "No validar.iti.gov.br, o resultado diz \"assinatura aprovada\"."],
                ["pessoaConfere", doCondominio ? "Quem assinou representa o condomínio" : "Quem assinou é quem assina pela TRÍADE",
                  doCondominio ? `O nome e o CPF no validador são do síndico ou de quem representa o condomínio${campos0.cpf_representante ? ` (${campos0.cpf_representante})` : ""}.`
                    : "O nome e o CPF no validador são de quem assina pela TRÍADE."],
                ["dataConfere", "Foi assinado depois de gerado", gerado ? `A data da assinatura no validador é depois de ${gerado}.` : "A data da assinatura no validador é depois de o aditivo ser gerado."],
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
          <CampoTexto id="aditivo-conferir-cpf" rotulo={doCondominio ? "CPF que o validador mostra" : "CPF de quem assinou pela TRÍADE"} opcional={!exigeAssinante} inputMode="numeric" maxLength={14}
            value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} disabled={!conferivel}
            ajuda={doCondominio && !exigeAssinante ? "Se digitar, o sistema confere com o do aditivo. Fica guardado só mascarado." : "Como o validador mostra. Fica guardado só mascarado."}
            erro={campos.includes("cpf") ? "Digite o CPF que o validador mostra." : undefined} />
          <CampoTexto id="aditivo-conferir-nome" rotulo="Nome de quem assinou" opcional={!exigeAssinante} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} disabled={!conferivel}
            erro={campos.includes("assinanteNome") ? "Diga o nome de quem assinou." : undefined} />
        </div>
        <CampoAreaTexto id="aditivo-conferir-obs" rotulo="Observação" opcional maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} disabled={!conferivel}
          placeholder="Conferido pelo validador; selo gov.br ouro." ajuda="Fica no histórico do aditivo com o seu nome e a hora." />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 max-md:grid">
          <Botao variante="discreto" onClick={() => { setRecusando(true); setErro(null); }}><Icone nome="fechar" />Recusar e pedir de novo</Botao>
          <span className="flex flex-wrap gap-2 max-md:grid">
            <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={!conferivel || !todas || enviando} aria-describedby={!todas ? "aditivo-conferir-falta" : undefined}>
              <Icone nome="escudo" />{enviando ? "Salvando…" : "Marcar como conferida"}
            </Botao>
          </span>
        </div>
        {!todas && conferivel ? <p id="aditivo-conferir-falta" className="t-apoio text-right max-md:text-left">Liga depois das três marcas do validador.</p> : null}
      </form>
    </Dialogo>
  );
}
