"use client";
// O código por SMS ou ligação (quadro 467; no celular, quadro 468): quando a janela da Meta
// devolve o número ainda não confirmado. Seis caixinhas em dois grupos de três, que aceitam colar
// o código inteiro (no celular, o teclado sugere o código do SMS); com os seis números, confere
// sozinho. Reenviar e ligar só depois de 60 segundos, com a contagem à vista. O limite de
// tentativas é da Meta; a tela diz quando dá para tentar de novo.

import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import { formatarDataHora, mostrarTelefone, MOTIVOS_CADASTRO_META } from "@triade/domain";
import { Aviso, Botao, chamarApi, Dialogo, Icone, type ErroApi } from "@triade/ui";
import { naBase } from "./contexto.tsx";
import { Girando, motivoDoErro, textoCadastro, type MetodoCodigo, type RespostaLigado } from "./metaComum.tsx";

type Situacao = "pedir" | "pedindo" | "digitar" | "conferindo" | "errado" | "vencido" | "esperar" | "confirmado";

const VAZIO = ["", "", "", "", "", ""];

function Caixinhas({ digitos: atuais, mudar, desligado, tom, refs, limpar = false }: {
  /** Depois do código errado, o próximo número digitado recomeça as seis caixinhas. */
  limpar?: boolean;
  digitos: string[]; mudar: (d: string[], foco?: number) => void; desligado: boolean; tom?: "erro" | "ok"; refs: RefObject<(HTMLInputElement | null)[]>;
}) {
  const digitos = limpar ? VAZIO : atuais;
  function espalhar(de: number, texto: string) {
    const nums = texto.replace(/\D/g, "").slice(0, 6);
    if (!nums) return;
    const inicio = nums.length === 6 ? 0 : de;
    const novo = [...digitos];
    for (let k = 0; k < nums.length && inicio + k < 6; k++) novo[inicio + k] = nums[k]!;
    mudar(novo, Math.min(inicio + nums.length, 5));
  }
  function aoDigitar(i: number, valor: string) {
    const nums = valor.replace(/\D/g, "");
    if (!nums) {
      const novo = [...digitos];
      novo[i] = "";
      return mudar(novo);
    }
    if (limpar) return espalhar(0, nums.slice(-1));
    if (nums.length === 1) {
      const novo = [...digitos];
      novo[i] = nums;
      return mudar(novo, Math.min(i + 1, 5));
    }
    // Mais de um número numa caixinha: veio do teclado (código do SMS) ou de colar.
    espalhar(i, nums.length === 2 && digitos[i] ? nums.replace(digitos[i]!, "") || nums[1]! : nums);
  }
  function aoTeclar(i: number, ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Backspace" && !digitos[i] && i > 0) {
      ev.preventDefault();
      const novo = [...digitos];
      novo[i - 1] = "";
      mudar(novo, i - 1);
    } else if (ev.key === "ArrowLeft" && i > 0) {
      ev.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (ev.key === "ArrowRight" && i < 5) {
      ev.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }
  function aoColar(i: number, ev: ClipboardEvent<HTMLInputElement>) {
    ev.preventDefault();
    espalhar(i, ev.clipboardData.getData("text"));
  }
  const borda = tom === "erro" ? "border-erro text-erro" : tom === "ok" ? "border-ok bg-ok-fundo text-ok" : "border-linha";
  return (
    <fieldset className="grid gap-2" disabled={desligado}>
      <legend className="sr-only">Código de 6 números</legend>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {atuais.map((d, i) => (
          <Fragment key={i}>
            {i === 3 ? <span aria-hidden="true" className="px-0.5 text-tinta-suave">-</span> : null}
            <input
              ref={(el) => { refs.current[i] = el; }}
              id={`codigo-meta-${i}`}
              aria-label={`Número ${i + 1} de 6`}
              aria-invalid={tom === "erro" || undefined}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              value={d}
              onChange={(e) => aoDigitar(i, e.target.value)}
              onKeyDown={(e) => aoTeclar(i, e)}
              onPaste={(e) => aoColar(i, e)}
              onFocus={(e) => e.target.select()}
              className={`h-12 w-10 rounded-xl border-2 bg-superficie text-center font-mono text-[30px] font-medium focus-visible:border-violeta-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violeta-200 disabled:bg-superficie-2 sm:h-14 sm:w-12 ${borda}`}
            />
          </Fragment>
        ))}
      </div>
    </fieldset>
  );
}

function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ativo]);
  return agora;
}

function tempo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A janela do código por cima de Configurações › WhatsApp. */
export function CodigoMeta({ aberto, numero, pedirAoAbrir, aoPedir, aoFechar, aoLigar, aoRecomecar }: {
  aberto: boolean; numero: string; pedirAoAbrir: boolean; aoPedir: () => void; aoFechar: () => void;
  aoLigar: (r: RespostaLigado) => void; aoRecomecar: (texto: string) => void;
}) {
  const [situacao, setSituacao] = useState<Situacao>("pedir");
  const [metodo, setMetodo] = useState<MetodoCodigo>("SMS");
  const [digitos, setDigitos] = useState<string[]>(VAZIO);
  const [liberaEm, setLiberaEm] = useState(0);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [esperarAte, setEsperarAte] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const agora = useAgora(aberto && liberaEm > 0);
  const falta = liberaEm - agora;

  async function pedir(m: MetodoCodigo) {
    setErro(null);
    setSituacao("pedindo");
    aoPedir();
    const r = await chamarApi<{ pedidoEm: string; reenviarEmSegundos: number }>(naBase("/whatsapp/meta/codigo"), { corpo: { acao: "PEDIR", metodo: m } });
    if (!r.ok) return recusa(r.erro, "pedir");
    setMetodo(m);
    setDigitos(VAZIO);
    setRestantes(null);
    setLiberaEm(Date.now() + (r.dados.reenviarEmSegundos ?? 60) * 1000);
    setSituacao("digitar");
    window.setTimeout(() => refs.current[0]?.focus(), 0);
  }

  async function confirmar(codigo: string) {
    setErro(null);
    setSituacao("conferindo");
    const r = await chamarApi<RespostaLigado>(naBase("/whatsapp/meta/codigo"), { corpo: { acao: "CONFIRMAR", codigo } });
    if (!r.ok) return recusa(r.erro, "digitar");
    setSituacao("confirmado");
    window.setTimeout(() => aoLigar(r.dados), 1500);
  }

  function recusa(e: ErroApi, volta: Situacao) {
    const motivo = motivoDoErro(e);
    if (motivo === "CODIGO_ERRADO") {
      const n = e.detalhes?.restantes;
      setRestantes(typeof n === "number" ? n : null);
      setSituacao("errado");
      window.setTimeout(() => refs.current[0]?.focus(), 0);
      return;
    }
    if (motivo === "CODIGO_VENCIDO") {
      setDigitos(VAZIO);
      return setSituacao("vencido");
    }
    if (motivo === "TENTATIVAS_DEMAIS") {
      const ate = e.detalhes?.liberaEm;
      setEsperarAte(typeof ate === "string" ? ate : null);
      return setSituacao("esperar");
    }
    if (motivo === "SEM_CADASTRO") {
      aoFechar();
      return aoRecomecar(MOTIVOS_CADASTRO_META.SEM_CADASTRO);
    }
    setErro(textoCadastro(e));
    setSituacao(volta);
  }

  // Aberto logo depois da janela: pede o SMS sozinho, uma vez.
  const pediu = useRef(false);
  useEffect(() => {
    if (aberto && pedirAoAbrir && !pediu.current) {
      pediu.current = true;
      void pedir("SMS");
    }
  }, [aberto, pedirAoAbrir]);

  function mudar(d: string[], foco?: number) {
    setDigitos(d);
    if (situacao === "errado") setSituacao("digitar");
    const cheio = d.every((x) => x !== "");
    if (cheio) return void confirmar(d.join(""));
    if (foco !== undefined) refs.current[foco]?.focus();
  }

  const voz = metodo === "VOICE";
  const titulo = situacao === "esperar" ? "A Meta pediu para esperar"
    : situacao === "confirmado" ? "Número confirmado"
    : voz && (situacao === "digitar" || situacao === "conferindo" || situacao === "errado") ? "Atenda a ligação da Meta"
    : "Confirme o número do condomínio";
  const tel = <code className="whitespace-nowrap font-mono font-semibold">{mostrarTelefone(numero)}</code>;
  const digitando = situacao === "digitar" || situacao === "conferindo" || situacao === "errado";
  const completo = digitos.every((x) => x !== "");

  return (
    <Dialogo aberto={aberto} titulo={titulo} apoio="Configurações › WhatsApp" fechar aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

        {situacao === "pedir" || situacao === "pedindo" ? (
          <>
            <p className="t-texto">A Meta precisa confirmar que {tel} é do condomínio. Peça um código de 6 números por SMS ou por ligação.</p>
            {situacao === "pedindo" ? <p role="status" className="flex items-center gap-2 t-apoio text-violeta-700"><Girando className="h-4 w-4" />Pedindo o código à Meta</p> : null}
          </>
        ) : null}

        {digitando ? (
          <>
            <p className="t-texto">
              {voz ? <>A Meta está ligando para {tel}. Uma voz lê os 6 números.</> : <>A Meta mandou um código de 6 números por SMS para {tel}.</>}
            </p>
            <Caixinhas digitos={digitos} mudar={mudar} desligado={situacao === "conferindo"} tom={situacao === "errado" ? "erro" : undefined} limpar={situacao === "errado"} refs={refs} />
            {situacao === "conferindo" ? (
              <p role="status" className="flex items-center gap-2 t-apoio text-violeta-700"><Girando className="h-4 w-4" />Conferindo com a Meta</p>
            ) : null}
            {situacao === "errado" ? (
              <div role="alert" className="flex items-start gap-2 text-erro">
                <Icone nome="alerta" className="mt-0.5 h-4 w-4" />
                <span className="grid gap-0.5">
                  <strong className="t-texto font-semibold">Esse código não confere</strong>
                  <span className="t-apoio text-tinta">
                    Confira o último {voz ? "código da ligação" : "SMS"}: só o mais novo vale.
                    {restantes !== null ? ` Restam ${restantes} ${restantes === 1 ? "tentativa" : "tentativas"}.` : ""}
                  </span>
                </span>
              </div>
            ) : null}
            {situacao !== "conferindo" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 t-apoio text-tinta-suave">
                <span>{voz ? "Não atendeu?" : "Não chegou?"}</span>
                {falta > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1"><Icone nome="relogio" className="h-4 w-4" />{voz ? "Ligar de novo" : "Reenviar"} em <span className="font-mono">{tempo(falta)}</span></span>
                    {voz ? null : <span className="inline-flex items-center gap-1"><Icone nome="relogio" className="h-4 w-4" />Receber por ligação em <span className="font-mono">{tempo(falta)}</span></span>}
                  </>
                ) : (
                  <>
                    <Botao variante="discreto" tamanho="p" onClick={() => void pedir(metodo)}>{voz ? "Ligar de novo" : "Reenviar o código"}</Botao>
                    {voz ? null : <Botao variante="discreto" tamanho="p" onClick={() => void pedir("VOICE")}><Icone nome="telefone" className="h-4 w-4" />Receber por ligação</Botao>}
                  </>
                )}
                {voz ? <Botao variante="discreto" tamanho="p" onClick={() => void pedir("SMS")}><Icone nome="balao" className="h-4 w-4" />Receber por SMS</Botao> : null}
              </div>
            ) : null}
          </>
        ) : null}

        {situacao === "vencido" ? (
          <>
            <Aviso tom="atencao" titulo="O código venceu">Ele vale 10 minutos. Peça outro: o anterior deixa de valer.</Aviso>
            <Caixinhas digitos={VAZIO} mudar={() => undefined} desligado refs={refs} />
          </>
        ) : null}

        {situacao === "esperar" ? (
          <>
            <Aviso tom="erro" titulo="Tentativas demais seguidas">
              {esperarAte ? `Dá para tentar de novo a partir de ${formatarDataHora(esperarAte)}.` : "Dá para tentar de novo mais tarde."} O que você já fez fica guardado.
            </Aviso>
            <p className="t-apoio text-tinta-suave">Se o número não recebe SMS nem ligação, use outro número do condomínio: feche e comece de novo na janela da Meta.</p>
          </>
        ) : null}

        {situacao === "confirmado" ? (
          <>
            <Caixinhas digitos={digitos} mudar={() => undefined} desligado tom="ok" refs={refs} />
            <p role="status" className="flex items-start gap-2">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ok-borda bg-ok-fundo text-ok"><Icone nome="check" className="h-4 w-4" /></span>
              <span className="grid gap-0.5"><span className="t-texto font-semibold">Tudo certo com a Meta</span><span className="t-apoio text-tinta-suave">A janela fecha sozinha e mostra o número ligado.</span></span>
            </p>
          </>
        ) : null}

        {situacao === "confirmado" ? null : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-4">
            {situacao === "esperar" ? (
              <Botao onClick={aoFechar}>Entendi</Botao>
            ) : situacao === "pedir" || situacao === "pedindo" || situacao === "vencido" ? (
              <>
                <Botao variante="contorno" disabled={situacao === "pedindo"} onClick={() => void pedir("VOICE")}><Icone nome="telefone" />Por ligação</Botao>
                <Botao disabled={situacao === "pedindo"} onClick={() => void pedir("SMS")}><Icone nome="balao" />{situacao === "vencido" ? "Mandar outro SMS" : "Mandar SMS"}</Botao>
              </>
            ) : (
              <>
                <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
                <Botao disabled={!completo || situacao === "conferindo"} onClick={() => void confirmar(digitos.join(""))}>
                  <Icone nome="check" />{situacao === "conferindo" ? "Conferindo" : "Confirmar"}
                </Botao>
              </>
            )}
          </div>
        )}
      </div>
    </Dialogo>
  );
}
