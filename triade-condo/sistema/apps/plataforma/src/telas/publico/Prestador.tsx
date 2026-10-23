"use client";
// Link do prestador (design "Links e QR", tela 6; V-11, MP-08): o serviço que o condomínio mandou,
// sem conta. O prestador registra a chegada lendo a etiqueta do local, conta se não conseguiu
// fazer e conta o que fez, com fotos. Nada muda sozinho na manutenção: o responsável confere.
// Antes de chegar, confirma que vai fazer ou diz que não pode (MP-09): com reserva no cadastro,
// sem resposta no prazo ou com a recusa, o serviço passa para a reserva e este link para. Mandado
// no registro do pedido (F6.7), mostra o número do pedido para o prestador citar se ligar.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { codigoDaEtiquetaLida, conferirAntesDeEnviar, IMPEDIMENTOS_PRESTADOR, TIPOS_MANUTENCAO, type ImpedimentoPrestador } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { subir } from "../pedidos/Arquivos.tsx";
import type { PrestadorPublico } from "../tipos.ts";
import { Cartao, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: PrestadorPublico };
type Modo = "chegada" | "impedimento" | "terminei" | "recusar";
const RODAPE = "Link só para este serviço. Não precisa de conta.";
const ENCERRADO: Record<NonNullable<PrestadorPublico["motivo"]>, string> = {
  CANCELADO: "O condomínio cancelou este link. Se o serviço continua, peça um link novo.",
  CONCLUIDA: "Esta manutenção já foi concluída pelo condomínio. Obrigado.",
  MANUTENCAO_CANCELADA: "O condomínio cancelou esta manutenção.",
  VENCIDO: "Este link venceu. Se o serviço continua, peça um link novo ao condomínio.",
  REPASSADO: "O condomínio passou o serviço para outro prestador. Se quiser conversar, fale com o condomínio.",
};

const PASSOS = ["Confirmar", "Chegar", "Contar", "Pronto"] as const;

export function Prestador() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/p/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [modo, setModo] = useState<Modo | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const carregar = useCallback(() => {
    void chamarApi<PrestadorPublico>(base).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao condomínio." : textoDoErro(r.erro) });
    });
  }, [base]);
  useEffect(carregar, [carregar]);

  const titulo = carga.estado === "pronto" ? carga.dados.condominio : "Serviço no condomínio";
  const subtitulo = carga.estado === "pronto" && carga.dados.para ? `Serviço para ${carga.dados.para}` : undefined;
  const tela = (conteudo: React.ReactNode) => <TelaPublica titulo={titulo} subtitulo={subtitulo} icone="ferramenta" rodape={RODAPE}>{conteudo}</TelaPublica>;

  if (carga.estado === "carregando") return tela(<Carregando rotulo="Abrindo o serviço…" />);
  if (carga.estado === "erro") return tela(<Aviso tom="atencao">{carga.texto}</Aviso>);
  const p = carga.dados;
  if (p.encerrado) return tela(<Aviso tom="info" titulo="Este link não vale mais">{ENCERRADO[p.motivo ?? "VENCIDO"]}</Aviso>);

  // Um passo por vez: o que já foi mandado diz em qual o prestador está.
  const registros = p.registros ?? [];
  const chegada = registros.find((r) => r.tipo === "CHEGOU");
  const terminou = registros.some((r) => r.tipo === "TERMINOU");
  const passo = modo === "recusar" ? 1 : modo === "chegada" ? 2 : modo === "terminei" ? 3
    : terminou ? 4 : chegada ? 3 : p.resposta && p.resposta !== "RECUSOU" ? 2 : 1;
  const pronto = (texto: string | null) => { setRecado(texto); setModo(null); carregar(); };
  const confirmouSemHora = p.resposta === "CONFIRMOU" && !registros.some((r) => r.tipo === "CONFIRMOU");
  const abrir = (m: Modo) => { setRecado(null); setFalha(null); setModo(m); };
  const voltar = <button type="button" onClick={() => setModo(null)} className="justify-self-start t-texto font-medium text-violeta-600 hover:underline">Voltar ao serviço</button>;
  const barra = <BarraDosPassos atual={passo} />;

  if (modo === "chegada") return tela(<>{barra}{voltar}<Chegada base={base} aoRegistrar={() => pronto(null)} /></>);
  if (modo === "impedimento") return tela(<>{barra}{voltar}<Impedimento base={base} aoEnviar={() => pronto("Enviado. O condomínio foi avisado e vai combinar o próximo passo com você.")} /></>);
  if (modo === "recusar") return tela(<>{barra}{voltar}<Recusar base={base} aoEnviar={() => pronto("Resposta enviada. O condomínio foi avisado.")} /></>);

  async function confirmar() {
    setFalha(null);
    const r = await chamarApi(`${base}/confirmar`, { corpo: {} });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    pronto(null);
  }
  const recadoOk = recado ? <Aviso tom="ok">{recado}</Aviso> : null;

  if (passo === 1) {
    return tela(
      <>
        {barra}
        {p.resposta !== "RECUSOU" ? recadoOk : null}
        <Servico base={base} p={p} />
        {p.resposta === "RECUSOU" ? (
          <Aviso tom="info">Você disse que não pode atender. O condomínio foi avisado.</Aviso>
        ) : (
          <Cartao className="gap-3">
            {p.responderAte ? (
              <>
                <p className="flex items-center gap-2 t-titulo-cartao font-semibold"><Icone nome="relogio" />Confirme até {diaHora(p.responderAte)}</p>
                <p className="t-texto text-tinta-suave">Sem resposta até lá, o condomínio passa o serviço para outro prestador.</p>
              </>
            ) : null}
            <Botao className="w-full" onClick={() => void confirmar()}><Icone nome="check" />Confirmo que vou fazer</Botao>
            {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
            <Botao variante="discreto" className="justify-self-center" onClick={() => abrir("recusar")}><Icone nome="fechar" />Não posso atender</Botao>
          </Cartao>
        )}
      </>,
    );
  }

  if (passo === 2) {
    return tela(
      <>
        {barra}
        {recadoOk ?? (p.resposta === "CONFIRMOU" ? (
          <Aviso tom="ok" titulo="Você confirmou que vai fazer">Obrigado. O condomínio sabe que você vai fazer o serviço.</Aviso>
        ) : null)}
        <Servico base={base} p={p} resumido />
        <Cartao className="gap-3">
          <p className="t-texto text-tinta-suave">Ao chegar, aponte a câmera para a etiqueta do local. Ela prova que você esteve lá, sem usar a localização do celular.</p>
          <Botao className="w-full" onClick={() => abrir("chegada")}><Icone nome="pin" />Cheguei</Botao>
          <span className="flex flex-wrap justify-between gap-2">
            <Botao variante="discreto" onClick={() => abrir("impedimento")}><Icone nome="alerta" />Não consegui fazer</Botao>
            <Botao variante="discreto" onClick={() => abrir("terminei")}><Icone nome="check" />Já terminei</Botao>
          </span>
        </Cartao>
      </>,
    );
  }

  if (passo === 3) {
    return tela(
      <>
        {barra}
        {modo === "terminei" ? voltar : null}
        {recadoOk}
        {chegada ? (
          <Aviso tom="ok" titulo={`Chegada registrada ${diaHora(chegada.em)}`}>
            {chegada.confirmado ? `Confirmada pela etiqueta ${chegada.etiqueta ?? "do local"}.`
              : chegada.etiqueta ? `A etiqueta ${chegada.etiqueta} é de outro local, então a chegada fica informada por você.` : "Informada por você."}
          </Aviso>
        ) : null}
        <Terminei base={base} aoEnviar={() => pronto(null)} />
        {!terminou ? <Botao variante="discreto" className="justify-self-center" onClick={() => abrir("impedimento")}><Icone nome="alerta" />Não consegui fazer</Botao> : null}
      </>,
    );
  }

  return tela(
    <>
      {barra}
      <Aviso tom="ok" titulo="Enviado. Obrigado!">O condomínio confere o que foi feito e conclui a manutenção. Se precisar, ele fala com você.</Aviso>
      <Servico base={base} p={p} resumido />
      <Cartao>
        <h2 className="t-titulo-cartao flex items-center gap-2"><Icone nome="lista" />O que você mandou</h2>
        <ul className="grid">
          {/* A confirmação não tem registro com hora: entra como a primeira linha, sem hora. */}
          {confirmouSemHora ? (
            <li className="flex gap-3 py-2.5">
              <span className="ladrilho h-8 w-8" data-tom="ok" aria-hidden="true"><Icone nome="check" /></span>
              <span className="self-center t-titulo-cartao font-semibold">Confirmou que vai fazer</span>
            </li>
          ) : null}
          {[...registros].reverse().map((r, i) => <LinhaDoRegistro key={`${r.tipo}-${r.em}-${i}`} r={r} primeira={i === 0 && !confirmouSemHora} />)}
        </ul>
      </Cartao>
      {registros.length < 20 ? (
        <Cartao className="gap-3">
          <p className="t-texto text-tinta-suave">Esqueceu alguma coisa ou apareceu um problema depois?</p>
          <Botao variante="contorno" className="w-full" onClick={() => abrir("terminei")}><Icone nome="mais" />Mandar mais uma coisa</Botao>
        </Cartao>
      ) : null}
    </>,
  );
}

/** A barra dos quatro passos, com o nome de cada um embaixo. */
function BarraDosPassos({ atual }: { atual: number }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-linha bg-superficie px-4 py-3.5">
      <span className="t-apoio font-semibold text-tinta-suave">Passo {atual} de 4</span>
      <div className="passos" role="progressbar" aria-label="Passos do serviço" aria-valuemin={1} aria-valuemax={4} aria-valuenow={atual}
        aria-valuetext={`Passo ${atual} de 4: ${PASSOS[atual - 1]}`}>
        {PASSOS.map((t, i) => <span key={t} data-feito={i < atual ? "" : undefined} />)}
      </div>
      <ol className="flex gap-1.5 t-apoio" aria-hidden="true">
        {PASSOS.map((t, i) => (
          <li key={t} className={`flex flex-1 items-center gap-0.5 ${i + 1 === atual ? "font-bold text-tinta" : i + 1 < atual ? "text-violeta-700" : "text-tinta-suave"}`}>
            {i + 1 < atual ? <Icone nome="check" className="h-3 w-3" /> : null}{t}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** O serviço: inteiro no primeiro passo; depois, resumido numa linha que abre o resto. */
function Servico({ base, p, resumido = false }: { base: string; p: PrestadorPublico; resumido?: boolean }) {
  const detalhes = (
    <>
      <p className="t-texto whitespace-pre-line">{p.oQueFazer}</p>
      <dl className="grid grid-cols-2 gap-3 t-texto">
        <div><dt className="t-apoio text-tinta-suave">Local</dt><dd>{p.local}</dd></div>
        {p.quando ? <div><dt className="t-apoio text-tinta-suave">Quando</dt><dd>{p.quando}</dd></div> : null}
        {p.comoEntrar ? <div className="col-span-2"><dt className="t-apoio text-tinta-suave">Como entrar</dt><dd className="whitespace-pre-line">{p.comoEntrar}</dd></div> : null}
      </dl>
      <ArquivosDoServico base={base} arquivos={p.arquivos ?? []} />
      {p.expiraEm ? <p className="t-apoio text-tinta-suave">Este link vale até {diaHora(p.expiraEm)}.</p> : null}
    </>
  );
  const tipo = p.tipo ? (
    <span className="justify-self-start">
      <Selo tom="neutro">{TIPOS_MANUTENCAO[p.tipo]}{p.pedido ? <> · pedido <span className="font-mono">{p.pedido}</span></> : null}</Selo>
    </span>
  ) : null;
  if (!resumido) {
    return <Cartao>{tipo}<h2 className="t-titulo-secao font-medium">{p.titulo}</h2>{detalhes}</Cartao>;
  }
  return (
    <details className="group rounded-2xl border border-linha bg-superficie p-3.5 shadow-s1">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="ladrilho h-10 w-10" data-tom="violeta" aria-hidden="true"><Icone nome="ferramenta" /></span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="t-titulo-cartao font-semibold">{p.titulo}</span>
          <span className="t-apoio">{[p.local, p.quando].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-tinta-suave transition-transform group-open:rotate-180"><Icone nome="baixo" /></span>
        <span className="sr-only">Ver o serviço inteiro</span>
      </summary>
      <div className="mt-3 grid gap-2">{tipo}{detalhes}</div>
    </details>
  );
}

const REGISTRO: Record<NonNullable<PrestadorPublico["registros"]>[number]["tipo"], { icone: NomeIcone; tom: string; texto: string }> = {
  CONFIRMOU: { icone: "check", tom: "ok", texto: "Confirmou" },
  RECUSOU: { icone: "fechar", tom: "neutro", texto: "Disse que não pode atender" },
  CHEGOU: { icone: "pin", tom: "ok", texto: "Chegou" },
  IMPEDIMENTO: { icone: "alerta", tom: "atencao", texto: "Contou que não conseguiu fazer" },
  TERMINOU: { icone: "ferramenta", tom: "violeta", texto: "Terminou" },
};

/** Uma linha do que o prestador mandou, do mais antigo ao mais novo. */
function LinhaDoRegistro({ r, primeira }: { r: NonNullable<PrestadorPublico["registros"]>[number]; primeira: boolean }) {
  const d = REGISTRO[r.tipo];
  const apoio = r.tipo === "CHEGOU" ? (r.confirmado ? `confirmado pela etiqueta ${r.etiqueta ?? "do local"}` : "informado por você") : null;
  return (
    <li className={`flex gap-3 py-2.5 ${primeira ? "" : "border-t border-linha"}`}>
      <span className="ladrilho h-8 w-8" data-tom={d.tom} aria-hidden="true"><Icone nome={d.icone} /></span>
      <span className="grid flex-1 gap-0.5">
        <span className="t-titulo-cartao font-semibold">{d.texto} {diaHora(r.em)}</span>
        {apoio ? <span className="t-apoio">{apoio}</span> : null}
      </span>
    </li>
  );
}

/** "Não posso atender" (MP-09): o motivo é opcional. */
function Recusar({ base, aoEnviar }: { base: string; aoEnviar: () => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`${base}/recusar`, { corpo: { texto: texto.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoEnviar();
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      <h2 className="t-titulo-secao font-medium">Não posso atender</h2>
      <p className="t-texto">O condomínio é avisado na hora e pode passar o serviço para outro prestador.</p>
      {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoAreaTexto id="pr-motivo" rotulo="Por quê" opcional rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)}
        erro={camposComErro(erro).includes("texto") ? "De 3 a 500 caracteres." : null} />
      <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar resposta"}</Botao>
    </form>
  );
}

function ArquivosDoServico({ base, arquivos }: { base: string; arquivos: { id: string; nome: string; tipo: string }[] }) {
  const [falha, setFalha] = useState<string | null>(null);
  if (!arquivos.length) return null;
  async function abrir(id: string) {
    setFalha(null);
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(`${base}/arquivos/${id}`);
    if (!r.ok) { aba?.close(); return setFalha("Não deu para abrir o arquivo agora. Tente de novo."); }
    if (aba) aba.location.href = r.dados.url;
  }
  return (
    <div className="grid gap-2">
      {arquivos.map((a) => (
        <button key={a.id} type="button" onClick={() => void abrir(a.id)}
          className="flex items-center gap-2 justify-self-start rounded-xl border border-linha px-3 py-2 t-texto font-medium text-violeta-600 hover:underline">
          <Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} />{a.nome}
        </button>
      ))}
      {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
    </div>
  );
}

/** Chegada (MP-08): a câmera lê a etiqueta do local; sem câmera ou sem etiqueta, a chegada fica informada. */
function Chegada({ base, aoRegistrar }: { base: string; aoRegistrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [situacao, setSituacao] = useState<"abrindo" | "lendo" | "sem-camera" | "enviando">("abrindo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const enviando = useRef(false);
  const depois = useRef(aoRegistrar);
  useEffect(() => { depois.current = aoRegistrar; });

  const registrar = useCallback(async (etiqueta: string | null) => {
    if (enviando.current) return;
    enviando.current = true;
    setSituacao("enviando");
    const r = await chamarApi(`${base}/chegada`, { corpo: { etiqueta } });
    if (!r.ok) { enviando.current = false; setSituacao("lendo"); return setErro(r.erro); }
    depois.current();
  }, [base]);

  useEffect(() => {
    let vivo = true;
    let fluxo: MediaStream | null = null;
    let quadro = 0;
    const tela = document.createElement("canvas");
    async function comecar() {
      if (!navigator.mediaDevices?.getUserMedia) { setSituacao("sem-camera"); return; }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (vivo) setSituacao("sem-camera");
        return;
      }
      if (!vivo || !video.current) { fluxo.getTracks().forEach((t) => t.stop()); return; }
      video.current.srcObject = fluxo;
      await video.current.play().catch(() => {});
      setSituacao("lendo");
      const { default: jsQR } = await import("jsqr");
      const ler = () => {
        if (!vivo || enviando.current) return;
        const v = video.current;
        if (v && v.videoWidth) {
          tela.width = v.videoWidth;
          tela.height = v.videoHeight;
          const ctx = tela.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, tela.width, tela.height);
            const lido = jsQR(ctx.getImageData(0, 0, tela.width, tela.height).data, tela.width, tela.height);
            if (lido?.data) {
              const codigo = codigoDaEtiquetaLida(lido.data);
              if (codigo) { void registrar(codigo); return; }
              setAviso("Este QR não é uma etiqueta do condomínio. Procure a etiqueta com o símbolo da TRÍADE Condo.");
            }
          }
        }
        quadro = window.setTimeout(ler, 300);
      };
      ler();
    }
    void comecar();
    return () => {
      vivo = false;
      window.clearTimeout(quadro);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, [registrar]);

  return (
    <>
      <Cartao>
        <h2 className="t-titulo-secao font-medium">Registrar a chegada</h2>
        <p className="t-texto">Aponte a câmera para a etiqueta do local.</p>
      </Cartao>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {situacao === "sem-camera" ? (
        <Aviso tom="info" titulo="Não deu para abrir a câmera">Libere a câmera para esta página ou registre a chegada sem a etiqueta.</Aviso>
      ) : (
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-violeta-900">
          <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-label="Câmera para ler a etiqueta" />
          <span className="relative h-2/3 w-2/3 rounded-2xl border-[3px] border-laranja-200" aria-hidden="true" />
          <span className="absolute inset-x-0 bottom-3 text-center t-apoio text-violeta-100" role="status">
            {situacao === "abrindo" ? "Abrindo a câmera…" : situacao === "enviando" ? "Registrando a chegada…" : "Procurando a etiqueta…"}
          </span>
        </div>
      )}
      {aviso ? <Aviso tom="atencao">{aviso}</Aviso> : null}
      <Botao variante="discreto" className="justify-self-start" disabled={situacao === "enviando"} onClick={() => void registrar(null)}>
        Estou no local, mas não achei a etiqueta
      </Botao>
      <p className="t-apoio text-tinta-suave">A página não usa a localização do celular: a etiqueta é uma prova simples de que você esteve no local.</p>
    </>
  );
}

type Foto = { chave: string; nome: string; id?: string; estado: "enviando" | "pronta" | "recusada"; motivo?: string };

/** Fotos do prestador, no modelo de anexar: cada uma sobe ao armazenamento e passa pela conferência antes de valer. */
function Fotos({ base, fotos, aoMudar }: { base: string; fotos: Foto[]; aoMudar: (f: (atual: Foto[]) => Foto[]) => void }) {
  const escolher = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  async function incluir(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []).slice(0, Math.max(0, 10 - fotos.length));
    for (const [i, arquivo] of arquivos.entries()) {
      const chave = `${Date.now()}-${i}`;
      const problema = arquivo.type.startsWith("image/") ? conferirAntesDeEnviar(arquivo) : "não foi aceito: só fotos (JPG, PNG, WEBP).";
      if (problema) { aoMudar((a) => [...a, { chave, nome: arquivo.name, estado: "recusada", motivo: problema }]); continue; }
      aoMudar((a) => [...a, { chave, nome: arquivo.name, estado: "enviando" }]);
      const fim = (f: Partial<Foto>) => aoMudar((a) => a.map((x) => (x.chave === chave ? { ...x, ...f } : x)));
      const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(`${base}/fotos`, {
        corpo: { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size },
      });
      if (!inicio.ok) { fim({ estado: "recusada", motivo: textoDoErro(inicio.erro) }); continue; }
      const subiu = await subir(inicio.dados.envio.url, arquivo, inicio.dados.envio.tipo, () => {});
      const conferida = subiu
        ? await chamarApi<{ situacao: string; motivo?: string }>(`${base}/fotos/${inicio.dados.arquivoId}/verificar`, { corpo: {} })
        : null;
      if (conferida?.ok && conferida.dados.situacao === "LIBERADO") fim({ estado: "pronta", id: inicio.dados.arquivoId });
      else fim({ estado: "recusada", motivo: conferida?.ok ? conferida.dados.motivo : "A foto não chegou. Tente de novo." });
    }
  }
  const cheio = fotos.length >= 10;
  const mudou = (e: React.ChangeEvent<HTMLInputElement>) => { void incluir(e.target.files); e.target.value = ""; };
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 t-apoio font-medium">Fotos <span className="font-normal text-tinta-suave">(opcional)</span></legend>
      <div className="anexar">
        <span className="quadro" aria-hidden="true"><Icone nome="camera" /></span>
        <span className="grid flex-1 gap-0.5">
          <span className="t-titulo-cartao font-semibold">Fotos do serviço</span>
          <span className="t-apoio">JPG, PNG ou WEBP · até 10 fotos · a localização da foto é apagada</span>
        </span>
        <span className="acoes">
          <Botao variante="contorno" tamanho="m" className="md:hidden" disabled={cheio} onClick={() => camera.current?.click()}><Icone nome="camera" />Tirar foto</Botao>
          <Botao variante="contorno" tamanho="m" disabled={cheio} onClick={() => escolher.current?.click()}><Icone nome="clipe" />Escolher fotos</Botao>
        </span>
        <input ref={escolher} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={mudou} />
        <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={mudou} />
      </div>
      {fotos.length ? (
        <ul className="grid gap-2" aria-label="Fotos escolhidas">
          {fotos.map((f) => (
            <li key={f.chave} className="arquivo" data-problema={f.estado === "recusada" ? "" : undefined}>
              <span className="flex items-center gap-3">
                <span className="ladrilho" data-tom={f.estado === "pronta" ? "ok" : undefined} aria-hidden="true"><Icone nome="camera" /></span>
                <span className="grid min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="t-texto font-medium">{f.nome}</span>
                  {f.estado === "recusada" ? <span className="t-apoio text-atencao">{f.motivo}</span>
                    : f.estado === "pronta" ? <span className="flex items-center gap-1 t-apoio text-ok"><Icone nome="check" className="h-3.5 w-3.5" />Pronta</span>
                      : <span className="t-apoio">Enviando…</span>}
                </span>
                {f.estado !== "enviando" ? (
                  <Botao variante="discreto" tamanho="m" soIcone aria-label={`Tirar ${f.nome} da lista`} onClick={() => aoMudar((a) => a.filter((x) => x.chave !== f.chave))}>
                    <Icone nome="fechar" />
                  </Botao>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

function Impedimento({ base, aoEnviar }: { base: string; aoEnviar: () => void }) {
  const [tipo, setTipo] = useState<ImpedimentoPrestador | null>(null);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`${base}/impedimento`, { corpo: { impedimento: tipo, texto, fotos: fotos.flatMap((f) => (f.id ? [f.id] : [])) } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoEnviar();
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      <Cartao>
        <h2 className="t-titulo-secao font-medium">Não consegui fazer</h2>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <fieldset className="grid gap-1">
          <legend className="mb-1 t-texto font-medium">O que aconteceu</legend>
          <span className="trilho">
            {(Object.keys(IMPEDIMENTOS_PRESTADOR) as ImpedimentoPrestador[]).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={tipo === k} data-escolhido={tipo === k ? "" : undefined} onClick={() => setTipo(k)}>
                {IMPEDIMENTOS_PRESTADOR[k]}
              </button>
            ))}
          </span>
          {comErro.includes("impedimento") ? <span className="t-apoio text-erro">Escolha o que aconteceu.</span> : null}
        </fieldset>
        <CampoAreaTexto id="im-texto" rotulo="Conte em poucas palavras" required rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={comErro.includes("texto") ? "Conte o que aconteceu (de 3 a 2.000 caracteres)." : null} />
        <Fotos base={base} fotos={fotos} aoMudar={setFotos} />
        <Botao type="submit" className="w-full" disabled={enviando || fotos.some((f) => f.estado === "enviando")}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar"}</Botao>
      </Cartao>
    </form>
  );
}

function Terminei({ base, aoEnviar }: { base: string; aoEnviar: () => void }) {
  const [v, setV] = useState({ texto: "", ficouPendente: false, pendenteTexto: "", quemFez: "" });
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`${base}/terminei`, { corpo: { ...v, pendenteTexto: v.ficouPendente ? v.pendenteTexto : null, fotos: fotos.flatMap((f) => (f.id ? [f.id] : [])) } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoEnviar();
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      <Cartao className="gap-4">
        <h2 className="t-titulo-secao font-medium">Conte o que foi feito</h2>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="te-texto" rotulo="O que foi feito" required rows={4} maxLength={2000} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })}
          erro={comErro.includes("texto") ? "Conte o que foi feito (de 3 a 2.000 caracteres)." : null} />
        <fieldset className="grid gap-1">
          <legend className="mb-1 t-texto font-medium">Ficou algo para depois?</legend>
          <span className="trilho">
            <button type="button" className="chip" aria-pressed={!v.ficouPendente} data-escolhido={!v.ficouPendente ? "" : undefined} onClick={() => setV({ ...v, ficouPendente: false })}>Não</button>
            <button type="button" className="chip" aria-pressed={v.ficouPendente} data-escolhido={v.ficouPendente ? "" : undefined} onClick={() => setV({ ...v, ficouPendente: true })}>Sim</button>
          </span>
        </fieldset>
        {v.ficouPendente ? (
          <CampoAreaTexto id="te-pendente" rotulo="O que ficou para depois" required rows={2} maxLength={500} value={v.pendenteTexto}
            onChange={(e) => setV({ ...v, pendenteTexto: e.target.value })}
            erro={comErro.includes("pendenteTexto") ? "Diga o que ficou para depois (de 3 a 500 caracteres)." : null} />
        ) : null}
        <Fotos base={base} fotos={fotos} aoMudar={setFotos} />
        <CampoTexto id="te-quem" rotulo="Quem fez" required maxLength={120} value={v.quemFez} onChange={(e) => setV({ ...v, quemFez: e.target.value })}
          erro={comErro.includes("quemFez") ? "Diga quem fez o serviço." : null} />
        <Botao type="submit" className="w-full" disabled={enviando || fotos.some((f) => f.estado === "enviando")}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar"}</Botao>
      </Cartao>
    </form>
  );
}
