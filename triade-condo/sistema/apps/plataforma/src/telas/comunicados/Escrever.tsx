"use client";
// Escrever comunicado (design "Telas dos Comunicados", tela 2; CD-01, CD-02, CD-05, CD-06, CD-09):
// assunto, título e texto; fotos e a ligação com pedido ou manutenção são opcionais. Ao escolher
// para quem, a tela mostra quantos contatos recebem e as unidades que ficam sem ninguém. Fica
// como rascunho até publicar ou programar. O publicado não volta aqui: corrige-se em versão nova.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ASSUNTOS_COMUNICADO, descreverAlcance, mostrarTamanho, noHorarioSemEnvio, PUBLICOS_COMUNICADO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { Escolha } from "../moradores/comum.tsx";
import { deDataHoraLocal, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ArquivoComunicado, AssuntoComunicado, ComunicadoDetalhe, OpcoesComunicado, PublicoCalculado, PublicoComunicado } from "../tipos.ts";
import { conferirArquivo, enviarUm, PartesComunicados } from "./comum.tsx";

const LIMITE_FOTO = 10 * 1024 * 1024;
type Acao = "RASCUNHO" | "PROGRAMAR" | "PUBLICAR";

export function Escrever() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const opcoes = useCarregar<OpcoesComunicado>("/v1/condominio/comunicados/opcoes");
  const atual = useCarregar<ComunicadoDetalhe>(id ? `/v1/condominio/comunicados/${id}` : null);
  const voltar = <Link href={id ? `/comunicados/comunicado?id=${id}` : "/comunicados"} className="text-sm font-medium text-violeta-600 hover:underline">
    {id ? "Voltar ao comunicado" : "Voltar aos comunicados"}</Link>;

  if (opcoes.estado === "carregando" || (id && atual.estado === "carregando")) return <Carregando rotulo="Abrindo o comunicado…" />;
  const erro = opcoes.estado === "erro" ? opcoes : id && atual.estado === "erro" ? atual : null;
  if (erro) return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Escrever comunicado</h1><ErroCarregar texto={erro.texto} tentarDeNovo={erro.recarregar} /></div>;
  if (opcoes.estado !== "pronto") return null;
  const detalhe = id && atual.estado === "pronto" ? atual.dados : null;
  if (detalhe && !detalhe.pode.editar) {
    return (
      <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Escrever comunicado</h1>
        <Vazio titulo="Este comunicado não se edita">Publicado não muda: use Corrigir no comunicado, que vira uma versão nova.</Vazio>
      </div>
    );
  }
  return <Formulario key={detalhe?.comunicado.id ?? "novo"} o={opcoes.dados} detalhe={detalhe}
    pedidoInicial={busca.get("pedido")} manutencaoInicial={busca.get("manutencao")} voltar={voltar} recarregar={atual.recarregar} />;
}

function Formulario({ o, detalhe, pedidoInicial, manutencaoInicial, voltar, recarregar }: {
  o: OpcoesComunicado;
  detalhe: ComunicadoDetalhe | null;
  pedidoInicial: string | null;
  manutencaoInicial: string | null;
  voltar: React.ReactNode;
  recarregar: () => void;
}) {
  const router = useRouter();
  const { atualizar } = usePlataforma();
  const c = detalhe?.comunicado;
  const manutencaoLigada = manutencaoInicial && o.manutencoes?.some((m) => m.id === manutencaoInicial) ? manutencaoInicial : "";
  const [v, setV] = useState({
    assunto: (c?.assunto ?? (manutencaoLigada && o.assuntos.includes("OBRAS") ? "OBRAS" : o.assuntos[0] ?? "AVISO")) as AssuntoComunicado,
    titulo: c?.titulo ?? "",
    texto: c?.texto ?? "",
    publico: (c?.publico ?? "TODOS") as PublicoComunicado,
    blocos: c?.blocos ?? [],
    unidades: c?.unidades ?? [],
    contatos: c?.contatos ?? [],
    pedidoId: c?.pedidoId ?? (pedidoInicial && o.pedidos?.some((p) => p.id === pedidoInicial) ? pedidoInicial : ""),
    manutencaoId: c?.manutencaoId ?? manutencaoLigada,
    quando: c?.estado === "PROGRAMADO" && c.programadoPara ? "PROGRAMAR" : "PUBLICAR" as "PUBLICAR" | "PROGRAMAR",
    programadoPara: c?.programadoPara ? paraDataHoraLocal(c.programadoPara) : "",
  });
  const [novos, setNovos] = useState<{ arquivo: File; problema: string | null }[]>([]);
  const [tirar, setTirar] = useState<ArquivoComunicado | null>(null);
  const [publico, setPublico] = useState<PublicoCalculado | null>(c ? detalhe!.publicoAgora : null);
  const [verQuem, setVerQuem] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const mudar = (x: Partial<typeof v>) => setV((y) => ({ ...y, ...x }));
  const existentes = (detalhe?.arquivos ?? []).filter((a) => a.situacao !== "NAO_LIBERADO");
  const vagas = 4 - existentes.length;

  // A conta de quem recebe é do banco, refeita a cada mudança do público ou do assunto.
  const chave = JSON.stringify([v.assunto, v.publico, v.blocos, v.unidades, v.contatos]);
  const escolha = { BLOCOS: v.blocos, UNIDADES: v.unidades, CONTATOS: v.contatos, TODOS: null }[v.publico];
  const incompleto = escolha !== null && escolha.length === 0;
  useEffect(() => {
    if (incompleto) return;
    const t = setTimeout(() => {
      void chamarApi<PublicoCalculado>("/v1/condominio/comunicados/publico", { corpo: {
        assunto: v.assunto, publico: v.publico, blocos: v.blocos, unidades: v.unidades, contatos: v.contatos,
      } }).then((r) => { if (r.ok) setPublico(r.dados); });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const unidadesVisiveis = useMemo(() => {
    const f = filtroUnidade.trim().toLowerCase();
    return f ? o.unidades.filter((u) => u.nome.toLowerCase().includes(f)) : o.unidades;
  }, [o.unidades, filtroUnidade]);
  const horaProgramada = v.programadoPara.slice(11, 16);
  const silencio = v.quando === "PROGRAMAR" && /^\d\d:\d\d$/.test(horaProgramada) && noHorarioSemEnvio(horaProgramada, o.silencio.inicio, o.silencio.fim);

  const alternar = (lista: string[], x: string) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  async function salvar(acao: Acao, ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(acao);
    const corpo = {
      assunto: v.assunto, titulo: v.titulo, texto: v.texto, publico: v.publico, blocos: v.blocos, unidades: v.unidades, contatos: v.contatos,
      pedidoId: v.pedidoId || null, manutencaoId: v.manutencaoId || null,
      programadoPara: acao === "PROGRAMAR" ? deDataHoraLocal(v.programadoPara) : null,
    };
    const validos = novos.filter((n) => !n.problema);
    // Com fotos novas, guarda primeiro como rascunho, envia as fotos e só então publica ou programa.
    const primeira = validos.length && acao !== "RASCUNHO" ? "RASCUNHO" : acao;
    let r = c
      ? await chamarApi<{ id: string; versao: number }>(`/v1/condominio/comunicados/${c.id}`, { metodo: "PUT", corpo: { ...corpo, versao: c.versao, acao: primeira } })
      : await chamarApi<{ id: string; versao: number }>("/v1/condominio/comunicados", { corpo: { ...corpo, acao: primeira } });
    if (!r.ok) { setEnviando(null); return setErro(r.erro); }
    const idSalvo = r.dados.id;
    const falhas: string[] = [];
    for (const n of validos) {
      const x = await enviarUm(`/v1/condominio/comunicados/${idSalvo}/arquivos`, {}, n.arquivo, (d) => d.arquivoId!);
      if (!x.liberado) falhas.push(`${x.nome}: ${x.motivo ?? "não foi liberado."}`);
    }
    if (falhas.length) {
      setEnviando(null);
      setNovos([]);
      setAviso(`Guardado como rascunho. ${falhas.join(" ")} Confira as fotos antes de publicar.`);
      router.replace(`/comunicados/escrever?id=${idSalvo}`);
      recarregar();
      return;
    }
    if (primeira !== acao) {
      r = await chamarApi<{ id: string; versao: number }>(`/v1/condominio/comunicados/${idSalvo}`, { metodo: "PUT", corpo: { ...corpo, versao: r.dados.versao, acao } });
      if (!r.ok) {
        setEnviando(null);
        setNovos([]);
        setErro(r.erro);
        router.replace(`/comunicados/escrever?id=${idSalvo}`);
        return;
      }
    }
    setEnviando(null);
    atualizar();
    router.push(`/comunicados/comunicado?id=${idSalvo}&feito=${acao}`);
  }

  const comErro = camposComErro(erro);
  const msg = (campo: string, texto = "") => (comErro.includes(campo) ? texto || "Confira este campo." : null);
  const assuntos = o.assuntos.includes(v.assunto) ? o.assuntos : [...o.assuntos, v.assunto];

  return (
    <form onSubmit={(e) => void salvar(v.quando, e)} noValidate className="grid gap-5">
      <PartesComunicados />
      {voltar}
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">{c ? "Editar comunicado" : "Escrever comunicado"}</h1>
        <p className="mt-1 text-tinta-suave">Fica como rascunho até você publicar ou programar.</p>
      </div>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {aviso ? <Aviso tom="atencao">{aviso}</Aviso> : null}
      {o.plano ? <Aviso tom="info" titulo="O combinado com os moradores">{o.plano}</Aviso> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section aria-labelledby="t-texto" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-texto" className="sr-only">Texto do comunicado</h2>
            <div className="grid gap-1">
              <span className="text-[13px] font-medium">Assunto</span>
              <Escolha rotulo="Assunto" atual={v.assunto} aoMudar={(x) => mudar({ assunto: x })}
                opcoes={assuntos.map((a) => ({ valor: a, texto: ASSUNTOS_COMUNICADO[a] }))} />
              {msg("assunto") ? <span className="text-xs text-erro">Escolha um assunto em uso.</span> : null}
            </div>
            <CampoTexto id="cm-titulo" rotulo="Título" required maxLength={120} value={v.titulo} onChange={(e) => mudar({ titulo: e.target.value })}
              erro={msg("titulo", "De 3 a 120 caracteres.")} />
            <CampoAreaTexto id="cm-texto" rotulo="Texto" required maxLength={4000} rows={7} value={v.texto} onChange={(e) => mudar({ texto: e.target.value })}
              erro={msg("texto", "De 3 a 4000 caracteres.")}
              ajuda={o.assinatura ? `Sai assinado como "${o.assinatura}". A assinatura fica em Configurações › Comunicados.` : "Sem assinatura padrão: defina em Configurações › Comunicados."} />
          </section>

          <section aria-labelledby="t-fotos" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-fotos" className="text-lg font-medium">Fotos e PDF</h2>
            {existentes.length ? (
              <ul className="grid gap-2">
                {existentes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-linha px-3 py-2 text-sm">
                    <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-medium">{a.nome}</span>
                      <span className="text-xs text-tinta-suave"> · {mostrarTamanho(a.tamanho)}{a.situacao === "ENVIANDO" ? " · verificando" : ""}</span></span>
                    {a.podeTirar ? <Botao variante="discreto" aria-label={`Tirar ${a.nome}`} onClick={() => setTirar(a)}>Tirar</Botao> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {novos.length ? (
              <ul className="grid gap-2" aria-label="Arquivos para enviar">
                {novos.map((n, i) => (
                  <li key={`${n.arquivo.name}-${i}`} className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm ${n.problema ? "border-atencao-borda bg-atencao-fundo" : "border-linha"}`}>
                    <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-medium">{n.arquivo.name}</span>
                      {n.problema ? <span className="text-atencao"> {n.problema}</span> : <span className="text-xs text-tinta-suave"> · {mostrarTamanho(n.arquivo.size)} · vai ao salvar</span>}</span>
                    <Botao variante="discreto" aria-label={`Tirar ${n.arquivo.name} da lista`} onClick={() => setNovos((xs) => xs.filter((_, j) => j !== i))}>Tirar</Botao>
                  </li>
                ))}
              </ul>
            ) : null}
            {vagas - novos.length > 0 ? (
              <label className="grid gap-1 text-sm">
                <span className="text-[13px] font-medium">Escolher foto ou PDF</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="text-sm"
                  onChange={(e) => {
                    const lista = [...(e.target.files ?? [])].slice(0, vagas - novos.length).map((arquivo) => ({ arquivo, problema: conferirArquivo(arquivo, LIMITE_FOTO) }));
                    setNovos((xs) => [...xs, ...lista]);
                    e.target.value = "";
                  }} />
              </label>
            ) : null}
            <p className="text-xs text-tinta-suave">Até 4, com as regras dos pedidos: fotos (JPG, PNG, WEBP) e PDF até 10 MB, sem a localização das fotos.</p>
          </section>

          <section aria-labelledby="t-ligar" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-ligar" className="text-lg font-medium">Ligar a</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {o.pedidos ? (
                <CampoSelecao id="cm-pedido" rotulo="Pedido" value={v.pedidoId} onChange={(e) => mudar({ pedidoId: e.target.value })} erro={msg("pedidoId", "Pedido não encontrado.")}
                  opcoes={[{ valor: "", texto: "Nenhum" }, ...(v.pedidoId && !o.pedidos.some((p) => p.id === v.pedidoId) ? [{ valor: v.pedidoId, texto: "Pedido já ligado" }] : []),
                    ...o.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.assunto}` }))]} />
              ) : null}
              {o.manutencoes ? (
                <CampoSelecao id="cm-manutencao" rotulo="Manutenção" value={v.manutencaoId} onChange={(e) => mudar({ manutencaoId: e.target.value })}
                  erro={msg("manutencaoId", "Manutenção não encontrada.")}
                  opcoes={[{ valor: "", texto: "Nenhuma" }, ...(v.manutencaoId && !o.manutencoes.some((m) => m.id === v.manutencaoId) ? [{ valor: v.manutencaoId, texto: "Manutenção já ligada" }] : []),
                    ...o.manutencoes.map((m) => ({ valor: m.id, texto: `${m.titulo} · ${m.local}` }))]} />
              ) : null}
            </div>
            <p className="text-xs text-tinta-suave">Opcional. O pedido ou a manutenção passam a mostrar este comunicado. Comunicar o prédio não conta como retorno ao morador do pedido.</p>
          </section>
        </div>

        <div className="grid gap-4">
          <section aria-labelledby="t-quem" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-quem" className="text-lg font-medium">Para quem</h2>
            <Escolha rotulo="Para quem" atual={v.publico} aoMudar={(x) => mudar({ publico: x })}
              opcoes={(Object.keys(PUBLICOS_COMUNICADO) as PublicoComunicado[])
                .filter((p) => (p !== "BLOCOS" || o.blocos.length > 0) && (p !== "CONTATOS" || o.pode.verMoradores))
                .map((p) => ({ valor: p, texto: PUBLICOS_COMUNICADO[p] }))} />
            {v.publico === "BLOCOS" ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-[13px] font-medium">Blocos</legend>
                {o.blocos.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.blocos.includes(b.id)} onChange={() => mudar({ blocos: alternar(v.blocos, b.id) })} />{b.nome}
                  </label>
                ))}
                {msg("blocos") ? <span className="text-xs text-erro">Escolha os blocos.</span> : null}
              </fieldset>
            ) : null}
            {v.publico === "UNIDADES" ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-[13px] font-medium">Unidades {v.unidades.length ? `(${v.unidades.length} escolhidas)` : ""}</legend>
                <input className="campo" aria-label="Filtrar unidades" placeholder="Filtrar" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} />
                <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
                  {unidadesVisiveis.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.unidades.includes(u.id)} onChange={() => mudar({ unidades: alternar(v.unidades, u.id) })} />{u.nome}
                    </label>
                  ))}
                </div>
                {msg("unidades") ? <span className="text-xs text-erro">Escolha as unidades.</span> : null}
              </fieldset>
            ) : null}
            {v.publico === "CONTATOS" && o.contatos ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-[13px] font-medium">Contatos {v.contatos.length ? `(${v.contatos.length} escolhidos)` : ""}</legend>
                <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-linha p-2">
                  {o.contatos.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v.contatos.includes(p.id)} onChange={() => mudar({ contatos: alternar(v.contatos, p.id) })} />
                      <span>{p.nome}<span className="text-xs text-tinta-suave"> · {p.unidades.join(", ")}</span></span>
                    </label>
                  ))}
                </div>
                {msg("contatos") ? <span className="text-xs text-erro">Escolha os contatos.</span> : null}
              </fieldset>
            ) : null}
            {publico && !incompleto ? (
              <div className="grid gap-2" aria-live="polite">
                <Aviso tom={publico.contatos ? "ok" : "atencao"} titulo={descreverAlcance(publico.contatos, publico.unidades)}>
                  Quem tem vínculo confirmado e recebe comunicados{v.assunto === "ASSEMBLEIA" ? ", mais os proprietários" : ""}.
                  {publico.quem ? <> <button type="button" className="font-medium underline" onClick={() => setVerQuem((x) => !x)}>{verQuem ? "Esconder" : "Ver quem"}</button></> : null}
                </Aviso>
                {verQuem && publico.quem ? (
                  <ul className="max-h-48 overflow-y-auto rounded-xl border border-linha p-2 text-sm">
                    {publico.quem.map((p) => <li key={p.contatoId}>{p.nome} <span className="text-xs text-tinta-suave">· {p.unidades.join(", ")}</span></li>)}
                  </ul>
                ) : null}
                {publico.semNinguem.length ? (
                  <Aviso tom="atencao" titulo={publico.semNinguem.length === 1 ? "1 unidade sem ninguém que recebe" : `${publico.semNinguem.length} unidades sem ninguém que recebe`}>
                    {publico.semNinguem.slice(0, 12).map((u) => u.nome).join(", ")}{publico.semNinguem.length > 12 ? " e outras." : "."}
                  </Aviso>
                ) : null}
              </div>
            ) : null}
          </section>

          <section aria-labelledby="t-quando" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-quando" className="text-lg font-medium">Quando</h2>
            <Escolha rotulo="Quando" atual={v.quando} aoMudar={(x) => mudar({ quando: x })}
              opcoes={[{ valor: "PUBLICAR", texto: "Publicar agora" }, { valor: "PROGRAMAR", texto: "Programar" }]} />
            {v.quando === "PROGRAMAR" ? (
              <CampoTexto id="cm-programado" rotulo="Dia e hora" type="datetime-local" value={v.programadoPara} onChange={(e) => mudar({ programadoPara: e.target.value })}
                erro={msg("programadoPara", "Daqui a pelo menos 2 minutos e até um ano.")} ajuda="Até a hora marcada dá para mudar ou voltar a rascunho." />
            ) : null}
            {silencio ? <Aviso tom="atencao">Essa hora cai no horário sem envio ({o.silencio.inicio} às {o.silencio.fim}). Vale para o WhatsApp, quando ele chegar.</Aviso> : null}
          </section>

          <div className="flex flex-wrap gap-2">
            <Botao type="submit" disabled={enviando !== null}>
              {enviando && enviando !== "RASCUNHO" ? "Salvando…" : v.quando === "PROGRAMAR" ? "Programar" : "Publicar"}
            </Botao>
            <Botao variante="contorno" disabled={enviando !== null} onClick={() => void salvar("RASCUNHO")}>
              {enviando === "RASCUNHO" ? "Salvando…" : "Salvar rascunho"}
            </Botao>
          </div>
          <p className="text-xs text-tinta-suave">Publicado não se edita: corrigir vira uma versão nova, e a anterior fica guardada.</p>
        </div>
      </div>
      <Janela aberto={tirar !== null} titulo={tirar ? `Tirar ${tirar.nome}` : "Tirar arquivo"} aoFechar={() => setTirar(null)}
        campos={[{ id: "motivo", rotulo: "Por que tirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Tirar do comunicado" explicacao="A retirada fica no histórico do comunicado, com o motivo."
        aoSalvar={async (x) => {
          const r = await chamarApi(`/v1/condominio/comunicados/${c?.id}/arquivos/${tirar?.id}/tirar`, { corpo: { motivo: String(x.motivo ?? "").trim() } });
          if (r.ok) { setTirar(null); recarregar(); }
          return r;
        }} />
    </form>
  );
}
