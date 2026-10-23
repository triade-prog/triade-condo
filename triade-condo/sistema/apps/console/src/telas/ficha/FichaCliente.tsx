"use client";
// Ficha do cliente no Console (DC15, telas-modelo console-ficha-*; rodada Console, decisões A.1 e
// D.1 de 23/10/2026): o cabeçalho com o estágio, o cenário e quem atende, e as 6 partes Visão
// geral, Implantação, Configuração, Pessoas, WhatsApp e Notas e histórico. Síndico e Equipe
// viraram Pessoas; Notas internas e Histórico viraram uma linha do tempo só. Acesso excepcional e
// Resumo para o síndico ficam em Mais ações. Os endereços antigos (?aba=ficha, sindico, equipe,
// historico) caem na parte nova que os contém.

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { CENARIOS, formatarData } from "@triade/domain";
import { Aviso, Carregando, ErroCarregar, Icone, Selo } from "@triade/ui";
import { MenuAcoes, Voltar } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { SeloEstagio } from "../rotulos.tsx";
import { AbaVisao } from "./AbaVisao.tsx";
import { AbaImplantacao } from "./AbaImplantacao.tsx";
import { AbaConfiguracao } from "./AbaConfiguracao.tsx";
import { AbaPessoas } from "./AbaPessoas.tsx";
import { AbaNotas } from "./AbaNotas.tsx";
import { AbaWhatsapp } from "./AbaWhatsapp.tsx";
import type { Ficha, PropsAba, Recado } from "./tipos.ts";

const PARTES = [
  { id: "visao", texto: "Visão geral" },
  { id: "implantacao", texto: "Implantação" },
  { id: "configuracao", texto: "Configuração" },
  { id: "pessoas", texto: "Pessoas" },
  { id: "whatsapp", texto: "WhatsApp" },
  { id: "notas", texto: "Notas e histórico" },
] as const;
type Parte = (typeof PARTES)[number]["id"];

/** As abas de antes da rodada Console, para os links antigos continuarem valendo. */
const ANTIGAS: Record<string, Parte> = { ficha: "visao", sindico: "pessoas", equipe: "pessoas", historico: "notas" };

function parteDe(aba: string | null): Parte {
  return PARTES.find((p) => p.id === aba)?.id ?? (aba ? ANTIGAS[aba] : undefined) ?? "visao";
}

export function FichaCliente() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<Ficha>(`/v1/clientes/${id}`);
  const busca = useSearchParams();
  const [parte, setParte] = useState<Parte>(parteDe(busca.get("aba")));
  const [pedido, setPedido] = useState<string | undefined>(busca.get("abrir") ?? undefined);
  const [recado, setRecado] = useState<Recado>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  function ir(p: Parte, oQue?: string) {
    setParte(p);
    setPedido(oQue);
    setRecado(null);
  }

  function teclas(ev: KeyboardEvent) {
    const i = PARTES.findIndex((a) => a.id === parte);
    const proxima = ev.key === "ArrowRight" ? (i + 1) % PARTES.length : ev.key === "ArrowLeft" ? (i - 1 + PARTES.length) % PARTES.length
      : ev.key === "Home" ? 0 : ev.key === "End" ? PARTES.length - 1 : -1;
    if (proxima < 0) return;
    ev.preventDefault();
    ir(PARTES[proxima]!.id);
    botoes.current[PARTES[proxima]!.id]?.focus();
  }

  if (ficha.estado === "carregando") return <Carregando rotulo="Abrindo a ficha…" />;
  if (ficha.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href="/clientes" texto="Voltar à carteira" />
        <h1 className="t-titulo-tela">Ficha do cliente</h1>
        {ficha.erro.codigo === "FORBIDDEN" || ficha.erro.codigo === "NOT_FOUND" ? (
          <Aviso tom="atencao" titulo="Cliente fora da sua carteira">Você só abre os clientes atribuídos a você. <Link href="/clientes" className="font-semibold underline">Voltar à carteira</Link></Aviso>
        ) : <ErroCarregar erro={ficha.erro} texto={ficha.texto} tentarDeNovo={ficha.recarregar} />}
      </div>
    );
  }

  const f = ficha.dados;
  const c = f.condominio;
  const props: PropsAba = {
    ficha: f,
    pode: (acao) => f.permissoes.includes(acao),
    recarregar: ficha.recarregar,
    avisar: setRecado,
    irPara: (destino, oQue) => { const p = parteDe(destino); ir(p, oQue); },
    pedido,
  };
  // Remonta as partes a cada versão nova, para os formulários partirem do que está salvo.
  const chave = `${c.versao}-${f.cliente.versao}-${f.sindicos.length}-${f.equipe.length}`;
  const atendidoPor = [...new Set(f.equipe.map((e) => e.nome))].join(", ");
  const mais = [
    { texto: "Acesso excepcional", icone: "escudo" as const, href: `/clientes/${c.id}/acesso-excepcional` },
    { texto: "Resumo para o síndico", icone: "imprimir" as const, href: `/clientes/${c.id}/resumo-configuracao`, novaAba: true },
  ];

  return (
    <div className="grid gap-5">
      <header className="grid gap-4">
        <span className="max-md:hidden"><Voltar href="/clientes" texto="Voltar à carteira" /></span>
        <div className="flex items-start gap-5 max-md:gap-3">
          <Link href="/clientes" className="emblema md:hidden" aria-label="Voltar à carteira"><Icone nome="esq" /></Link>
          <span className="ladrilho h-16 w-16 shrink-0 rounded-[18px] border border-linha bg-superficie max-md:hidden" data-tom="violeta" aria-hidden="true">
            <Icone nome="predio" className="h-7 w-7" />
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <p className="flex flex-wrap items-center gap-2 max-md:order-2">
              <SeloEstagio estagio={f.cliente.estagio} />
              {c.cenario ? <Selo tom="neutro">{CENARIOS[c.cenario as keyof typeof CENARIOS] ?? c.cenario}</Selo> : null}
              <span className="t-apoio md:hidden">{[c.cidade, c.uf].filter(Boolean).join(" · ")}</span>
            </p>
            <h1 className="t-titulo-tela [overflow-wrap:anywhere] max-md:order-1 max-md:text-[22px]">{c.nome}</h1>
            <p className="t-apoio max-md:hidden">
              {[[c.cidade, c.uf].filter(Boolean).join(" · "), `cliente desde ${formatarData(c.criadoEm)}`, atendidoPor ? `atendido por ${atendidoPor}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
        </div>
      </header>
      {recado ? <Aviso tom={recado.tom} papel="status">{recado.texto}</Aviso> : null}

      <div role="tablist" aria-label="Partes da ficha" className="-mx-4 flex gap-6 overflow-x-auto border-b border-linha px-4 md:mx-0 md:px-0" onKeyDown={teclas}>
        {PARTES.map((a) => (
          <button
            key={a.id}
            ref={(el) => { botoes.current[a.id] = el; }}
            id={`aba-${a.id}`}
            role="tab"
            type="button"
            aria-selected={parte === a.id}
            aria-controls={`painel-${a.id}`}
            tabIndex={parte === a.id ? 0 : -1}
            onClick={() => ir(a.id)}
            className="-mb-px min-h-11 shrink-0 border-b-2 border-transparent px-1 text-[15px] whitespace-nowrap text-tinta-suave hover:text-tinta aria-selected:border-violeta-600 aria-selected:font-semibold aria-selected:text-violeta-600"
          >
            {a.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${parte}`} aria-labelledby={`aba-${parte}`} tabIndex={0} key={`${parte}-${chave}`}>
        {parte === "visao" ? <AbaVisao {...props} /> : null}
        {parte === "implantacao" ? <AbaImplantacao {...props} /> : null}
        {parte === "configuracao" ? <AbaConfiguracao {...props} /> : null}
        {parte === "pessoas" ? <AbaPessoas {...props} /> : null}
        {parte === "notas" ? <AbaNotas {...props} /> : null}
        {parte === "whatsapp" ? (props.pode("console.whatsapp.ver") ? <AbaWhatsapp {...props} /> : <p className="t-apoio">Sua função não vê o WhatsApp deste cliente.</p>) : null}
      </div>
    </div>
  );
}
