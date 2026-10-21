"use client";
// Ficha do condomínio no Console: cabeçalho com estágio e as abas Ficha, Implantação, Configuração, Síndico,
// WhatsApp, Equipe, Notas internas e Histórico (design "Telas do passo 1", aprovado em 16/10/2026; a aba
// Implantação, com a entrega no lugar do antigo "Concluir implantação", é da peça R4; a aba WhatsApp, do passo 5;
// a aba Configuração, do desenho "Configuração na implantação", aprovado em 20/10/2026).

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Aviso, Carregando, classeBotao, ErroCarregar } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { SeloEstagio } from "../rotulos.tsx";
import { ListaHistorico } from "../ListaHistorico.tsx";
import { AbaFicha } from "./AbaFicha.tsx";
import { AbaImplantacao } from "./AbaImplantacao.tsx";
import { AbaConfiguracao } from "./AbaConfiguracao.tsx";
import { AbaSindico } from "./AbaSindico.tsx";
import { AbaEquipe } from "./AbaEquipe.tsx";
import { AbaNotas } from "./AbaNotas.tsx";
import { AbaWhatsapp } from "./AbaWhatsapp.tsx";
import type { Ficha, PropsAba, Recado } from "./tipos.ts";

const ABAS = [
  { id: "ficha", texto: "Ficha" },
  { id: "implantacao", texto: "Implantação" },
  { id: "configuracao", texto: "Configuração" },
  { id: "sindico", texto: "Síndico" },
  { id: "whatsapp", texto: "WhatsApp" },
  { id: "equipe", texto: "Equipe" },
  { id: "notas", texto: "Notas internas" },
  { id: "historico", texto: "Histórico" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export function FichaCliente() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<Ficha>(`/v1/clientes/${id}`);
  const busca = useSearchParams();
  const [aba, setAba] = useState<Aba>(ABAS.find((a) => a.id === busca.get("aba"))?.id ?? "ficha");
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
        ) : <ErroCarregar erro={ficha.erro} texto={ficha.texto} tentarDeNovo={ficha.recarregar} />}
      </div>
    );
  }

  const f = ficha.dados;
  const props: PropsAba = {
    ficha: f,
    pode: (acao) => f.permissoes.includes(acao),
    recarregar: ficha.recarregar,
    avisar: setRecado,
    irPara: (destino) => { const a = ABAS.find((x) => x.id === destino); if (a) { setAba(a.id); setRecado(null); } },
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
        <Link href={`/clientes/${f.condominio.id}/acesso-excepcional`} className={classeBotao("contorno", "", "m")}>Acesso excepcional</Link>
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
        {aba === "implantacao" ? <AbaImplantacao {...props} /> : null}
        {aba === "configuracao" ? <AbaConfiguracao {...props} /> : null}
        {aba === "sindico" ? <AbaSindico {...props} /> : null}
        {aba === "equipe" ? <AbaEquipe {...props} /> : null}
        {aba === "notas" ? <AbaNotas {...props} /> : null}
        {aba === "whatsapp" ? (props.pode("console.whatsapp.ver") ? <AbaWhatsapp {...props} /> : <p className="text-sm text-tinta-suave">Sua função não vê o WhatsApp deste cliente.</p>) : null}
        {aba === "historico" ? <ListaHistorico caminho={`/v1/clientes/${f.condominio.id}/historico`} /> : null}
      </div>
    </div>
  );
}
