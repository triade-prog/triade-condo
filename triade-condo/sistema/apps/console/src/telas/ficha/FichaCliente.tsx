"use client";
// Ficha do condomínio no Console: cabeçalho com estágio e as abas Ficha, Síndico, Equipe,
// Notas internas e Histórico (design "Telas do passo 1", aprovado em 16/10/2026).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Aviso, Botao, CampoAreaTexto, Carregando, chamarApi, Dialogo, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { SeloEstagio } from "../rotulos.tsx";
import { ListaHistorico } from "../ListaHistorico.tsx";
import { AbaFicha } from "./AbaFicha.tsx";
import { AbaSindico } from "./AbaSindico.tsx";
import { AbaEquipe } from "./AbaEquipe.tsx";
import { AbaNotas } from "./AbaNotas.tsx";
import type { Ficha, PropsAba, Recado } from "./tipos.ts";

const ABAS = [
  { id: "ficha", texto: "Ficha" },
  { id: "sindico", texto: "Síndico" },
  { id: "equipe", texto: "Equipe" },
  { id: "notas", texto: "Notas internas" },
  { id: "historico", texto: "Histórico" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function ConcluirImplantacao({ ficha, recarregar, avisar }: PropsAba) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function concluir(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/estagio`, {
      metodo: "PUT", corpo: { versao: ficha.cliente.versao, estagio: "ATIVO", motivo },
    });
    if (!r.ok) return setErro(r.erro);
    setAberto(false);
    avisar({ tom: "ok", texto: "Implantação concluída. O cliente está ativo." });
    recarregar();
  }

  return (
    <>
      <Botao variante="contorno" onClick={() => { setErro(null); setAberto(true); }}>Concluir implantação</Botao>
      <Dialogo aberto={aberto} titulo="Concluir implantação" aoFechar={() => setAberto(false)}>
        <form onSubmit={concluir} className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          {ficha.situacoes.includes("SEM_SINDICO") ? (
            <Aviso tom="atencao">Para concluir a implantação, convide o síndico antes.</Aviso>
          ) : (
            <p>O cliente passa de “em implantação” para “ativo”. Essa mudança não volta atrás e fica no histórico.</p>
          )}
          <CampoAreaTexto id="e-motivo" rotulo="O que foi feito" opcional maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            ajuda="Ex.: a síndica registrou o primeiro pedido sozinha." />
          <div className="flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={ficha.situacoes.includes("SEM_SINDICO")}>Concluir implantação</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

export function FichaCliente() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<Ficha>(`/v1/clientes/${id}`);
  const [aba, setAba] = useState<Aba>("ficha");
  const [recado, setRecado] = useState<Recado>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  function teclas(ev: KeyboardEvent) {
    const i = ABAS.findIndex((a) => a.id === aba);
    const proxima = ev.key === "ArrowRight" ? (i + 1) % ABAS.length : ev.key === "ArrowLeft" ? (i - 1 + ABAS.length) % ABAS.length
      : ev.key === "Home" ? 0 : ev.key === "End" ? ABAS.length - 1 : -1;
    if (proxima < 0) return;
    ev.preventDefault();
    setAba(ABAS[proxima]!.id);
    botoes.current[ABAS[proxima]!.id]?.focus();
  }

  if (ficha.estado === "carregando") return <Carregando rotulo="Abrindo a ficha…" />;
  if (ficha.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="text-[28px] font-normal tracking-tight">Ficha do condomínio</h1>
        {ficha.erro.codigo === "FORBIDDEN" || ficha.erro.codigo === "NOT_FOUND" ? (
          <Aviso tom="atencao" titulo="Cliente fora da sua carteira">Você só abre os clientes atribuídos a você. <Link href="/" className="font-semibold underline">Voltar à carteira</Link></Aviso>
        ) : <ErroCarregar texto={ficha.texto} tentarDeNovo={ficha.recarregar} />}
      </div>
    );
  }

  const f = ficha.dados;
  const props: PropsAba = {
    ficha: f,
    pode: (acao) => f.permissoes.includes(acao),
    recarregar: ficha.recarregar,
    avisar: setRecado,
  };
  // Remonta as abas a cada versão nova, para os formulários partirem do que está salvo.
  const chave = `${f.condominio.versao}-${f.cliente.versao}-${f.sindicos.length}-${f.equipe.length}`;

  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/" className="text-violeta-600 hover:underline">Voltar à carteira de clientes</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">{f.condominio.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-tinta-suave">
            {[f.condominio.cidade, f.condominio.uf].filter(Boolean).join(" · ")}
            <SeloEstagio estagio={f.cliente.estagio} />
          </p>
        </div>
        {f.cliente.estagio === "IMPLANTACAO" && props.pode("console.estagio.mudar") ? <ConcluirImplantacao key={chave} {...props} /> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div role="tablist" aria-label="Partes da ficha" className="flex gap-5 overflow-x-auto border-b border-linha" onKeyDown={teclas}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            ref={(el) => { botoes.current[a.id] = el; }}
            id={`aba-${a.id}`}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            aria-controls={`painel-${a.id}`}
            tabIndex={aba === a.id ? 0 : -1}
            onClick={() => { setAba(a.id); setRecado(null); }}
            className="-mb-px min-h-11 border-b-2 border-transparent px-0.5 text-sm whitespace-nowrap text-tinta-suave aria-selected:border-violeta-600 aria-selected:font-semibold aria-selected:text-violeta-700"
          >
            {a.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} tabIndex={0} key={`${aba}-${chave}`}>
        {aba === "ficha" ? <AbaFicha {...props} /> : null}
        {aba === "sindico" ? <AbaSindico {...props} /> : null}
        {aba === "equipe" ? <AbaEquipe {...props} /> : null}
        {aba === "notas" ? <AbaNotas {...props} /> : null}
        {aba === "historico" ? <ListaHistorico caminho={`/v1/clientes/${f.condominio.id}/historico`} /> : null}
      </div>
    </div>
  );
}
