"use client";
// Um chamado no Console (PI-20, PI-06): a conversa com o cliente, a nota interna que o cliente
// nunca vê, o responsável e a situação. Do chamado dá para pedir o acesso excepcional (PI-11).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AREAS_CHAMADO, formatarDataHora, SITUACOES_CHAMADO, TIPOS_CHAMADO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, Carregando, chamarApi, ErroCarregar, FaixaInterna, Selo, textoDoErro, type ErroApi,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { TOM_CHAMADO, type ResumoChamado } from "./Chamados.tsx";
import { PedirAcessoExcepcional } from "./AcessoExcepcional.tsx";

interface Mensagem {
  id: string;
  lado: "CLIENTE" | "TRIADE";
  interna: boolean;
  autor: string;
  texto: string;
  criadoEm: string;
}

interface DetalheChamado extends ResumoChamado {
  mensagens: Mensagem[];
  arquivos: { id: string; nome: string; situacao: string }[];
  equipe: { pessoaId: string; nome: string }[];
  pode: { responder: boolean; notaInterna: boolean; atualizar: boolean; pedirAcesso: boolean };
}

function Imagem({ base, id, nome }: { base: string; id: string; nome: string }) {
  async function abrir() {
    const r = await chamarApi<{ url: string }>(`${base}/imagens/${id}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }
  return <Botao variante="contorno" tamanho="p" onClick={abrir}>Abrir {nome}</Botao>;
}

export function ChamadoConsole() {
  const { condominio, chamado } = useParams<{ condominio: string; chamado: string }>();
  const base = `/v1/clientes/${condominio}/chamados/${chamado}`;
  const carga = useCarregar<DetalheChamado>(base);
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo o chamado…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const c = carga.dados;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`${base}/responder`, { corpo: { texto, interna } });
    if (!r.ok) return setErro(r.erro);
    setTexto("");
    setRecado(interna ? "Nota interna guardada. O cliente não vê." : "Resposta enviada. Quem abriu é avisado no sino.");
    carga.recarregar();
  }

  async function atualizar(situacao: string, responsavelId: string | null) {
    setErro(null);
    const r = await chamarApi(base, { metodo: "PUT", corpo: { versao: c.versao, situacao, responsavelId } });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/chamados" className="text-violeta-600 hover:underline">Voltar aos chamados</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">{c.titulo}</h1>
          <p className="mt-1 text-tinta-suave">
            Chamado {c.numero} · {TIPOS_CHAMADO[c.tipo]} · {AREAS_CHAMADO[c.area]} · <Link href={`/clientes/${condominio}`} className="hover:underline">{c.condominio}</Link>
          </p>
        </div>
        <Selo tom={TOM_CHAMADO[c.situacao]}>{SITUACOES_CHAMADO[c.situacao]}</Selo>
      </div>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}

      {c.pode.atualizar ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao id="ch-resp" rotulo="Com quem" value={c.responsavelId ?? ""} onChange={(e) => atualizar(c.situacao, e.target.value || null)}
            opcoes={[{ valor: "", texto: "Sem responsável" }, ...c.equipe.map((p) => ({ valor: p.pessoaId, texto: p.nome }))]} />
          <CampoSelecao id="ch-situacao" rotulo="Situação" value={c.situacao} onChange={(e) => atualizar(e.target.value, c.responsavelId ?? null)}
            opcoes={Object.entries(SITUACOES_CHAMADO).map(([valor, t]) => ({ valor, texto: t }))} />
        </div>
      ) : null}

      <ol className="grid gap-3" aria-label="Conversa">
        {c.mensagens.map((m) => (
          <li key={m.id} className={`grid gap-1 rounded-2xl border p-4 ${m.interna ? "border-dashed border-violeta-300 bg-violeta-50" : m.lado === "TRIADE" ? "border-linha bg-superficie-2" : "border-linha bg-superficie"}`}>
            {m.interna ? <FaixaInterna>Nota interna · o cliente não vê</FaixaInterna> : null}
            <span className="text-sm font-medium">{m.autor}{m.lado === "TRIADE" ? " · TRÍADE" : ` · ${c.condominio}`}</span>
            <p className="whitespace-pre-wrap">{m.texto}</p>
            <span className="text-xs text-tinta-suave">{formatarDataHora(m.criadoEm)}</span>
          </li>
        ))}
      </ol>
      {c.arquivos.filter((a) => a.situacao === "LIBERADO").length ? (
        <div className="flex flex-wrap gap-2">
          {c.arquivos.filter((a) => a.situacao === "LIBERADO").map((a) => <Imagem key={a.id} base={base} id={a.id} nome={a.nome} />)}
        </div>
      ) : null}

      {c.pode.notaInterna ? (
        <form onSubmit={enviar} noValidate className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4">
          <div role="group" aria-label="Tipo de mensagem" className="trilho justify-self-start">
            <button type="button" className="chip" aria-pressed={!interna} disabled={!c.pode.responder} onClick={() => setInterna(false)}>Responder</button>
            <button type="button" className="chip" aria-pressed={interna} onClick={() => setInterna(true)}>Nota interna</button>
          </div>
          <CampoAreaTexto id="ch-texto" rotulo={interna ? "Nota interna (o cliente não vê)" : "Resposta ao cliente"} maxLength={4000} value={texto}
            onChange={(e) => setTexto(e.target.value)} />
          <div className="flex flex-wrap justify-end gap-2">
            {c.pode.pedirAcesso ? <Botao variante="contorno" onClick={() => setPedindo(true)}>Pedir acesso excepcional</Botao> : null}
            {c.situacao !== "RESOLVIDO" && c.pode.atualizar ? <Botao variante="secundario" onClick={() => atualizar("RESOLVIDO", c.responsavelId ?? null)}>Marcar resolvido</Botao> : null}
            <Botao type="submit" disabled={!interna && !c.pode.responder}>{interna ? "Guardar nota" : "Responder"}</Botao>
          </div>
        </form>
      ) : null}
      <p className="text-xs text-tinta-suave">Resposta da TRÍADE chega no sino de quem abriu. Resolvido volta a abrir se o cliente responder em até 7 dias; depois disso, abre-se outro.</p>
      {pedindo ? (
        <PedirAcessoExcepcional condominio={condominio} nome={c.condominio ?? ""} chamadoId={c.id} aoFechar={() => setPedindo(false)}
          aoPedir={() => { setPedindo(false); setRecado("Pedido de acesso excepcional enviado ao síndico."); }} />
      ) : null}
    </div>
  );
}
