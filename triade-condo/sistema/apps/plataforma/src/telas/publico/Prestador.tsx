"use client";
// Link do prestador (design "Links e QR", tela 6; V-11, MP-08): o serviço que o condomínio mandou,
// sem conta. O prestador registra a chegada lendo a etiqueta do local, conta se não conseguiu
// fazer e conta o que fez, com fotos. Nada muda sozinho na manutenção: o responsável confere.
// Antes de chegar, confirma que vai fazer ou diz que não pode (MP-09): com reserva no cadastro,
// sem resposta no prazo ou com a recusa, o serviço passa para a reserva e este link para.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { codigoDaEtiquetaLida, conferirAntesDeEnviar, IMPEDIMENTOS_PRESTADOR, TIPOS_MANUTENCAO, type ImpedimentoPrestador } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { subir } from "../pedidos/Arquivos.tsx";
import type { PrestadorPublico } from "../tipos.ts";
import { Cartao, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: PrestadorPublico };
type Modo = "servico" | "chegada" | "impedimento" | "terminei" | "recusar";
const RODAPE = "Link só para este serviço. Não precisa de conta.";
const ENCERRADO: Record<NonNullable<PrestadorPublico["motivo"]>, string> = {
  CANCELADO: "O condomínio cancelou este link. Se o serviço continua, peça um link novo.",
  CONCLUIDA: "Esta manutenção já foi concluída pelo condomínio. Obrigado.",
  MANUTENCAO_CANCELADA: "O condomínio cancelou esta manutenção.",
  VENCIDO: "Este link venceu. Se o serviço continua, peça um link novo ao condomínio.",
  REPASSADO: "O condomínio passou o serviço para outro prestador. Se quiser conversar, fale com o condomínio.",
};

export function Prestador() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/p/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [modo, setModo] = useState<Modo>("servico");
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

  const pronto = (texto: string) => { setRecado(texto); setModo("servico"); carregar(); };
  const voltar = <button type="button" onClick={() => setModo("servico")} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Voltar ao serviço</button>;

  if (modo === "chegada") return tela(<>{voltar}<Chegada base={base} aoRegistrar={pronto} /></>);
  if (modo === "impedimento") return tela(<>{voltar}<Impedimento base={base} aoEnviar={() => pronto("Enviado. O condomínio foi avisado e vai combinar o próximo passo com você.")} /></>);
  if (modo === "recusar") return tela(<>{voltar}<Recusar base={base} aoEnviar={() => pronto("Resposta enviada. O condomínio foi avisado.")} /></>);
  if (modo === "terminei") return tela(<>{voltar}<Terminei base={base} aoEnviar={() => pronto("Enviado. O condomínio confere o que foi feito e conclui a manutenção.")} /></>);

  const chegada = p.registros?.find((r) => r.tipo === "CHEGOU");
  async function confirmar() {
    setFalha(null);
    const r = await chamarApi(`${base}/confirmar`, { corpo: {} });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    pronto("Obrigado. O condomínio sabe que você vai fazer o serviço.");
  }
  return tela(
    <>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      <Cartao>
        {p.tipo ? <span className="justify-self-start rounded-full bg-neutro-fundo px-2.5 py-0.5 text-xs font-medium text-tinta-suave">{TIPOS_MANUTENCAO[p.tipo]}</span> : null}
        <h2 className="text-xl font-medium">{p.titulo}</h2>
        <p className="text-[15px] whitespace-pre-line">{p.oQueFazer}</p>
        <dl className="grid gap-2 text-[15px]">
          <div><dt className="text-[13px] text-tinta-suave">Local</dt><dd>{p.local}</dd></div>
          {p.quando ? <div><dt className="text-[13px] text-tinta-suave">Quando</dt><dd>{p.quando}</dd></div> : null}
          {p.comoEntrar ? <div><dt className="text-[13px] text-tinta-suave">Como entrar</dt><dd className="whitespace-pre-line">{p.comoEntrar}</dd></div> : null}
        </dl>
        <ArquivosDoServico base={base} arquivos={p.arquivos ?? []} />
        {p.expiraEm ? <p className="text-[13px] text-tinta-suave">Este link vale até {diaHora(p.expiraEm)}.</p> : null}
      </Cartao>
      {chegada ? (
        <Aviso tom="ok" titulo={`Chegada registrada ${diaHora(chegada.em)}`}>
          {chegada.confirmado ? `Confirmada pela etiqueta ${chegada.etiqueta ?? "do local"}.` : "Informada por você."}
        </Aviso>
      ) : null}
      {!p.resposta && !chegada ? (
        <div className="grid gap-2">
          {p.responderAte ? (
            <p className="text-[15px]">Confirme até <span className="font-medium">{diaHora(p.responderAte)}</span>. Sem resposta, o condomínio passa o serviço para outro prestador.</p>
          ) : null}
          <Botao onClick={() => void confirmar()}><Icone nome="check" />Confirmo que vou fazer</Botao>
          <Botao variante="contorno" onClick={() => { setRecado(null); setFalha(null); setModo("recusar"); }}><Icone nome="fechar" />Não posso atender</Botao>
          {falha ? <p className="text-sm text-erro" role="alert">{falha}</p> : null}
        </div>
      ) : p.resposta === "CONFIRMOU" && !chegada && !recado ? (
        <Aviso tom="ok">Você confirmou que vai fazer este serviço.</Aviso>
      ) : p.resposta === "RECUSOU" ? (
        <Aviso tom="info">Você disse que não pode atender. O condomínio foi avisado.</Aviso>
      ) : null}
      <div className="grid gap-2">
        <Botao variante={!p.resposta && !chegada ? "contorno" : "primario"} onClick={() => { setRecado(null); setModo("chegada"); }}><Icone nome="pin" />Cheguei</Botao>
        <Botao variante="contorno" onClick={() => { setRecado(null); setModo("impedimento"); }}><Icone nome="alerta" />Não consegui fazer</Botao>
        <Botao variante="contorno" onClick={() => { setRecado(null); setModo("terminei"); }}><Icone nome="check" />Terminei</Botao>
      </div>
    </>,
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
      <h2 className="text-xl font-medium">Não posso atender</h2>
      <p className="text-[15px]">O condomínio é avisado na hora e pode passar o serviço para outro prestador.</p>
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
          className="flex items-center gap-2 justify-self-start rounded-xl border border-linha px-3 py-2 text-sm font-medium text-violeta-600 hover:underline">
          <Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} />{a.nome}
        </button>
      ))}
      {falha ? <p className="text-sm text-erro" role="alert">{falha}</p> : null}
    </div>
  );
}

/** Chegada (MP-08): a câmera lê a etiqueta do local; sem câmera ou sem etiqueta, a chegada fica informada. */
function Chegada({ base, aoRegistrar }: { base: string; aoRegistrar: (texto: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [situacao, setSituacao] = useState<"abrindo" | "lendo" | "sem-camera" | "enviando">("abrindo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const enviando = useRef(false);

  const registrar = useCallback(async (etiqueta: string | null) => {
    if (enviando.current) return;
    enviando.current = true;
    setSituacao("enviando");
    const r = await chamarApi<{ confirmado: boolean; em: string; etiqueta?: { rotulo: string; local: string } }>(`${base}/chegada`, { corpo: { etiqueta } });
    if (!r.ok) { enviando.current = false; setSituacao("lendo"); return setErro(r.erro); }
    const d = r.dados;
    aoRegistrar(d.confirmado
      ? `Chegada registrada, confirmada pela etiqueta ${d.etiqueta?.rotulo ?? ""}, ${d.etiqueta?.local ?? ""}.`
      : d.etiqueta
        ? `Chegada registrada. A etiqueta ${d.etiqueta.rotulo} é de outro local (${d.etiqueta.local}), então a chegada fica informada por você.`
        : "Chegada registrada, informada por você.");
  }, [base, aoRegistrar]);

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
        <h2 className="text-lg font-medium">Registrar a chegada</h2>
        <p className="text-[15px]">Aponte a câmera para a etiqueta do local.</p>
      </Cartao>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {situacao === "sem-camera" ? (
        <Aviso tom="info" titulo="Não deu para abrir a câmera">Libere a câmera para esta página ou registre a chegada sem a etiqueta.</Aviso>
      ) : (
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-violeta-900">
          <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-label="Câmera para ler a etiqueta" />
          <span className="relative h-2/3 w-2/3 rounded-2xl border-[3px] border-laranja-200" aria-hidden="true" />
          <span className="absolute inset-x-0 bottom-3 text-center text-[13px] text-violeta-100" role="status">
            {situacao === "abrindo" ? "Abrindo a câmera…" : situacao === "enviando" ? "Registrando a chegada…" : "Procurando a etiqueta…"}
          </span>
        </div>
      )}
      {aviso ? <Aviso tom="atencao">{aviso}</Aviso> : null}
      <Botao variante="discreto" className="justify-self-start" disabled={situacao === "enviando"} onClick={() => void registrar(null)}>
        Estou no local, mas não achei a etiqueta
      </Botao>
      <p className="text-[13px] text-tinta-suave">A página não usa a localização do celular: a etiqueta é uma prova simples de que você esteve no local.</p>
    </>
  );
}

type Foto = { chave: string; nome: string; id?: string; estado: "enviando" | "pronta" | "recusada"; motivo?: string };

/** Fotos do prestador: cada uma sobe ao armazenamento e passa pela conferência antes de valer. */
function Fotos({ base, fotos, aoMudar }: { base: string; fotos: Foto[]; aoMudar: (f: (atual: Foto[]) => Foto[]) => void }) {
  async function escolher(lista: FileList | null) {
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
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium">
        Fotos <span className="font-normal text-tinta-suave">(opcional)</span>
        <span className="flex items-center gap-2 rounded-xl border border-contorno bg-superficie px-3 py-2.5 text-[15px] font-normal">
          <Icone nome="camera" />{fotos.length ? `${fotos.filter((f) => f.estado === "pronta").length} de ${fotos.length} prontas` : "Tirar ou escolher foto"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={fotos.length >= 10}
            onChange={(e) => { void escolher(e.target.files); e.target.value = ""; }} />
        </span>
      </label>
      {fotos.length ? (
        <ul className="grid gap-1 text-[13px]">
          {fotos.map((f) => (
            <li key={f.chave} className={f.estado === "recusada" ? "text-erro" : "text-tinta-suave"}>
              {f.nome}: {f.estado === "enviando" ? "enviando…" : f.estado === "pronta" ? "pronta" : f.motivo}
            </li>
          ))}
        </ul>
      ) : null}
      <span className="text-xs text-tinta-suave">Até 10. A localização das fotos é apagada.</span>
    </div>
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
        <h2 className="text-lg font-medium">Não consegui fazer</h2>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">O que aconteceu</legend>
          <span className="trilho">
            {(Object.keys(IMPEDIMENTOS_PRESTADOR) as ImpedimentoPrestador[]).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={tipo === k} data-escolhido={tipo === k ? "" : undefined} onClick={() => setTipo(k)}>
                {IMPEDIMENTOS_PRESTADOR[k]}
              </button>
            ))}
          </span>
          {comErro.includes("impedimento") ? <span className="text-xs text-erro">Escolha o que aconteceu.</span> : null}
        </fieldset>
        <CampoAreaTexto id="im-texto" rotulo="Conte em poucas palavras" required rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={comErro.includes("texto") ? "Conte o que aconteceu (de 3 a 2.000 caracteres)." : null} />
        <Fotos base={base} fotos={fotos} aoMudar={setFotos} />
        <Botao type="submit" className="justify-self-start" disabled={enviando || fotos.some((f) => f.estado === "enviando")}>{enviando ? "Enviando…" : "Enviar"}</Botao>
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
      <Cartao>
        <h2 className="text-lg font-medium">Terminei</h2>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="te-texto" rotulo="O que foi feito" required rows={4} maxLength={2000} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })}
          erro={comErro.includes("texto") ? "Conte o que foi feito (de 3 a 2.000 caracteres)." : null} />
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">Ficou algo para depois?</legend>
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
        <Botao type="submit" className="justify-self-start" disabled={enviando || fotos.some((f) => f.estado === "enviando")}>{enviando ? "Enviando…" : "Enviar"}</Botao>
      </Cartao>
    </form>
  );
}
