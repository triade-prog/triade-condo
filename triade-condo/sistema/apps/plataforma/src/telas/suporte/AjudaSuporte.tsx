"use client";
// Ajuda e suporte (peça R4; PI-17, PI-20): chamados de suporte técnico da plataforma. Quem tem
// conta abre com tipo, área, título, o que aconteceu e até 3 imagens (colar com Ctrl+V ou
// escolher), acompanha as respostas e diz se resolveu. Não é reparo do prédio nem emergência.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ClipboardEvent, type FormEvent } from "react";
import {
  AREAS_CHAMADO, DIAS_REABRIR_CHAMADO, formatarDataHora, IMAGENS_CHAMADO, rotuloSituacaoChamadoCliente, TIPOS_CHAMADO,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, Selo, textoDoErro, Vazio,
  type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { subir } from "../pedidos/Arquivos.tsx";

interface Chamado {
  id: string;
  numero: number;
  tipo: keyof typeof TIPOS_CHAMADO;
  area: keyof typeof AREAS_CHAMADO;
  titulo: string;
  situacao: string;
  abertoPor: string;
  imagens: number;
  ultima?: { lado: "CLIENTE" | "TRIADE"; autor: string; em: string };
  resolvidoEm?: string;
  criadoEm: string;
}

interface DetalheChamado extends Chamado {
  mensagens: { id: string; lado: "CLIENTE" | "TRIADE"; autor: string; texto: string; criadoEm: string }[];
  arquivos: { id: string; nome: string; situacao: string; motivoRecusa?: string }[];
  pode: { responder: boolean; resolver: boolean; enviarImagem: boolean };
}

const TOM: Record<string, Tom> = { NOVO: "andamento", ANDAMENTO: "andamento", ESPERANDO_CLIENTE: "atencao", RESOLVIDO: "ok" };

/** Sobe as imagens uma a uma e pede a verificação (tira a localização). */
async function enviarImagens(chamado: string, imagens: File[]): Promise<string[]> {
  const problemas: string[] = [];
  for (const f of imagens) {
    const base = `/v1/condominio/chamados/${chamado}/imagens`;
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(base, {
      corpo: { nome: f.name || "imagem-colada.png", tipo: f.type, tamanho: f.size },
    });
    if (!inicio.ok) { problemas.push(textoDoErro(inicio.erro)); continue; }
    await subir(inicio.dados.envio.url, f, inicio.dados.envio.tipo, () => {});
    const fim = await chamarApi<{ situacao: string; motivo?: string }>(`${base}/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
    if (!fim.ok) problemas.push(textoDoErro(fim.erro));
    else if (fim.dados.situacao !== "LIBERADO") problemas.push(fim.dados.motivo ?? "A imagem não foi liberada.");
  }
  return problemas;
}

function CampoImagens({ imagens, mudar }: { imagens: File[]; mudar: (f: File[]) => void }) {
  const [problema, setProblema] = useState<string | null>(null);
  function juntar(novas: File[]) {
    const validas = novas.filter((f) => (IMAGENS_CHAMADO.tipos as readonly string[]).includes(f.type) && f.size <= IMAGENS_CHAMADO.tamanho);
    setProblema(validas.length < novas.length ? "Só imagens JPG, PNG ou WEBP de até 10 MB." : null);
    mudar([...imagens, ...validas].slice(0, IMAGENS_CHAMADO.maximo));
  }
  function colar(ev: ClipboardEvent) {
    const arquivos = Array.from(ev.clipboardData.files);
    if (arquivos.length) {
      ev.preventDefault();
      juntar(arquivos);
    }
  }
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Imagens <span className="font-normal text-tinta-suave">(opcional)</span></span>
      <div tabIndex={0} onPaste={colar} role="group" aria-label="Cole a imagem aqui com Ctrl+V"
        className="grid gap-2 rounded-xl border border-dashed border-contorno p-4 text-sm text-tinta-suave focus:outline-2 focus:outline-foco">
        <span>Cole a imagem aqui (Ctrl+V) ou escolha um arquivo · até {IMAGENS_CHAMADO.maximo}</span>
        <input type="file" accept={IMAGENS_CHAMADO.tipos.join(",")} multiple aria-label="Escolher imagens"
          disabled={imagens.length >= IMAGENS_CHAMADO.maximo} onChange={(e) => { juntar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {problema ? <p className="text-xs text-erro">{problema}</p> : null}
      {imagens.length ? (
        <ul className="flex flex-wrap gap-2">
          {imagens.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-linha px-2 py-1 text-xs">
              {f.name || "imagem colada"}
              <button type="button" className="text-violeta-600 underline" onClick={() => mudar(imagens.filter((_, j) => j !== i))}>Tirar<span className="sr-only"> {f.name}</span></button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Chamado já preenchido, como o "Pedir mudança" das Configurações (PI-04, decisão 11). */
interface ChamadoInicial { tipo: string; area: string; titulo: string; texto: string }

function AbrirChamado({ aoVoltar, inicial }: { aoVoltar: () => void; inicial?: ChamadoInicial }) {
  const router = useRouter();
  const [tipo, setTipo] = useState(inicial?.tipo ?? "PROBLEMA");
  const [area, setArea] = useState(inicial?.area ?? "PEDIDOS");
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [texto, setTexto] = useState(inicial?.texto ?? "");
  const [imagens, setImagens] = useState<File[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ id: string }>("/v1/condominio/chamados", { corpo: { tipo, area, titulo, texto } });
    if (!r.ok) {
      setEnviando(false);
      return setErro(r.erro);
    }
    const problemas = imagens.length ? await enviarImagens(r.dados.id, imagens) : [];
    setEnviando(false);
    router.push(`/suporte?id=${r.dados.id}${problemas.length ? "&imagens=falhou" : ""}`);
  }

  const campos = camposComErro(erro);
  return (
    <form onSubmit={abrir} noValidate className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 className="text-lg font-medium">Abrir chamado</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Tipo</legend>
        <div className="trilho flex-wrap">
          {Object.entries(TIPOS_CHAMADO).map(([k, t]) => <button key={k} type="button" className="chip" aria-pressed={tipo === k} onClick={() => setTipo(k)}>{t}</button>)}
        </div>
      </fieldset>
      <CampoSelecao id="cha-area" rotulo="Onde no sistema" value={area} onChange={(e) => setArea(e.target.value)}
        opcoes={Object.entries(AREAS_CHAMADO).map(([valor, t]) => ({ valor, texto: t }))} />
      <CampoTexto id="cha-titulo" rotulo="Título" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
        erro={campos.includes("titulo") ? "Escreva um título (3 a 120 caracteres)." : null} />
      <CampoAreaTexto id="cha-texto" rotulo="O que aconteceu" required maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
        erro={campos.includes("texto") ? "Conte o que aconteceu." : null} />
      <CampoImagens imagens={imagens} mudar={setImagens} />
      <p className="text-xs text-tinta-suave">Imagens passam pelas mesmas regras das fotos dos pedidos (sem localização, até 10 MB).</p>
      <div className="flex justify-end gap-2">
        <Botao variante="contorno" onClick={aoVoltar}>Voltar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</Botao>
      </div>
    </form>
  );
}

function VerChamado({ id, falhouImagem }: { id: string; falhouImagem: boolean }) {
  const carga = useCarregar<DetalheChamado>(`/v1/condominio/chamados/${id}`);
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(falhouImagem ? "O chamado foi aberto, mas alguma imagem não passou na conferência." : null);

  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const c = carga.dados;

  async function responder(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi<{ reaberto: boolean }>(`/v1/condominio/chamados/${id}/responder`, { corpo: { texto } });
    if (!r.ok) return setErro(r.erro);
    const problemas = imagens.length ? await enviarImagens(id, imagens) : [];
    setTexto("");
    setImagens([]);
    setRecado(problemas.length ? `Resposta enviada. ${problemas.join(" ")}` : r.dados.reaberto ? "Resposta enviada. O chamado voltou a abrir." : "Resposta enviada.");
    carga.recarregar();
  }

  async function resolver() {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/chamados/${id}/resolver`, { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    setRecado("Obrigado. O chamado ficou resolvido.");
    carga.recarregar();
  }

  async function abrirImagem(arquivo: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/chamados/${id}/imagens/${arquivo}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm"><Link href="/suporte" className="text-violeta-600 hover:underline">Voltar aos chamados</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">{c.titulo}</h1>
          <p className="text-tinta-suave">Chamado {c.numero} · {TIPOS_CHAMADO[c.tipo]} · {AREAS_CHAMADO[c.area]} · aberto por {c.abertoPor} em {formatarDataHora(c.criadoEm)}</p>
        </div>
        <Selo tom={TOM[c.situacao] ?? "info"}>{rotuloSituacaoChamadoCliente(c.situacao)}</Selo>
      </div>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <ol className="grid gap-3" aria-label="Conversa">
        {c.mensagens.map((m) => (
          <li key={m.id} className={`grid gap-1 rounded-2xl border border-linha p-4 ${m.lado === "TRIADE" ? "bg-violeta-50" : "bg-superficie"}`}>
            <span className="text-sm font-medium">{m.autor}{m.lado === "TRIADE" ? " · TRÍADE" : ""}</span>
            <p className="whitespace-pre-wrap">{m.texto}</p>
            <span className="text-xs text-tinta-suave">{formatarDataHora(m.criadoEm)}</span>
          </li>
        ))}
      </ol>
      {c.arquivos.length ? (
        <ul className="flex flex-wrap gap-2">
          {c.arquivos.map((a) => (
            <li key={a.id}>
              {a.situacao === "LIBERADO"
                ? <Botao variante="contorno" tamanho="p" onClick={() => void abrirImagem(a.id)}>Abrir {a.nome}</Botao>
                : <span className="text-xs text-erro">{a.nome}: {a.motivoRecusa ?? "não liberada"}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {c.pode.responder ? (
        <form onSubmit={responder} noValidate className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4">
          <CampoAreaTexto id="cha-resposta" rotulo="Responder" maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
            erro={camposComErro(erro).includes("texto") ? "Escreva a resposta." : null} />
          {c.pode.enviarImagem ? <CampoImagens imagens={imagens} mudar={setImagens} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {c.pode.resolver ? <Botao variante="secundario" onClick={() => void resolver()}>Resolveu</Botao> : null}
            <Botao type="submit">Enviar resposta</Botao>
          </div>
        </form>
      ) : (
        <Aviso tom="neutro">Este chamado foi resolvido há mais de {DIAS_REABRIR_CHAMADO} dias. Se o problema voltou, abra outro chamado.</Aviso>
      )}
    </div>
  );
}

export function AjudaSuporte() {
  const busca = useSearchParams();
  const router = useRouter();
  const id = busca.get("id");
  // ?mudar=<parte>&valor=<hoje>: pedido de mudança no que é ajustado pela TRÍADE.
  const mudar = busca.get("mudar");
  const inicial: ChamadoInicial | undefined = mudar ? {
    tipo: "SUGESTAO", area: "CONFIGURACOES", titulo: `Mudar: ${mudar}`.slice(0, 120),
    texto: `Parte ajustada pela TRÍADE: ${mudar}.\nHoje: ${busca.get("valor") ?? ""}.\n\nO que precisamos: `,
  } : undefined;
  const [abrindo, setAbrindo] = useState(!!inicial);
  const lista = useCarregar<{ itens: Chamado[]; todos: boolean }>(id ? null : "/v1/condominio/chamados");

  if (id) return <VerChamado key={id} id={id} falhouImagem={busca.get("imagens") === "falhou"} />;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Ajuda e suporte</h1>
        <p className="text-tinta-suave">Problemas com o sistema. Para reparo no prédio ou emergência, fale com quem cuida do prédio.</p>
      </div>
      <Aviso tom="info" titulo="Suporte técnico da plataforma">
        Responde sobre o sistema em dias úteis, das 9h às 18h. Não é reparo nem canal de emergência: vazamento, elevador parado ou segurança vão para o síndico ou para os serviços de emergência.
      </Aviso>
      {abrindo ? <AbrirChamado aoVoltar={() => setAbrindo(false)} inicial={inicial} /> : (
        <section aria-labelledby="t-chamados" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="t-chamados" className="text-lg font-medium">{lista.estado === "pronto" && lista.dados.todos ? "Chamados do condomínio" : "Seus chamados"}</h2>
            <Botao onClick={() => setAbrindo(true)}>Abrir chamado</Botao>
          </div>
          {lista.estado === "carregando" ? <Carregando /> : null}
          {lista.estado === "erro" ? <ErroCarregar texto={lista.texto} tentarDeNovo={lista.recarregar} /> : null}
          {lista.estado === "pronto" && lista.dados.itens.length === 0 ? <Vazio titulo="Nenhum chamado ainda">Quando algo no sistema não funcionar como esperado, abra um chamado.</Vazio> : null}
          {lista.estado === "pronto" && lista.dados.itens.length > 0 ? (
            <ul className="grid gap-2.5">
              {lista.dados.itens.map((c) => (
                <li key={c.id} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <button type="button" className="text-left font-semibold hover:underline" onClick={() => router.push(`/suporte?id=${c.id}`)}>{c.titulo}</button>
                    <span className="block text-sm text-tinta-suave">
                      {TIPOS_CHAMADO[c.tipo]} · {AREAS_CHAMADO[c.area]} · aberto {formatarDataHora(c.criadoEm)}
                      {c.ultima ? ` · última resposta: ${c.ultima.autor}, ${formatarDataHora(c.ultima.em)}` : ""}
                    </span>
                  </span>
                  <Selo tom={TOM[c.situacao] ?? "info"}>{rotuloSituacaoChamadoCliente(c.situacao)}</Selo>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
      <p className="text-xs text-tinta-suave">O morador não abre chamado: quem tem conta na Plataforma, sim.</p>
    </div>
  );
}
