"use client";
// Acesso excepcional da TRÍADE (PI-11): quem é do suporte pede para ver uma área do condomínio,
// com motivo e prazo (até 72 horas); o síndico aprova ou recusa na Plataforma. Enquanto vale, a
// pessoa só lê, e cada abertura fica no histórico que o síndico vê.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AREAS_EXCEPCIONAIS, descreverAcessoExcepcional, formatarDataHora, PRAZOS_ACESSO_EXCEPCIONAL, SITUACOES_ACESSO_EXCEPCIONAL, type AreaExcepcional,
} from "@triade/domain";
import {
  Aviso, Botao, CampoAreaTexto, CampoSelecao, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

interface Acesso {
  id: string;
  pedidoPor: string;
  motivo: string;
  areas: AreaExcepcional[];
  horas: number;
  situacao: keyof typeof SITUACOES_ACESSO_EXCEPCIONAL;
  decididoPor?: string;
  motivoRecusa?: string;
  validoAte?: string;
  leituras: number;
  criadoEm: string;
  meu: boolean;
}

const TOM: Record<string, Tom> = { PEDIDO: "atencao", APROVADO: "ok", RECUSADO: "erro", ENCERRADO: "neutro", EXPIRADO: "neutro" };
const ROTA_AREA: Record<AreaExcepcional, string> = { PEDIDOS: "pedidos", MORADORES: "moradores", COMUNICADOS: "comunicados", MANUTENCAO: "manutencao" };

export function PedirAcessoExcepcional({ condominio, nome, chamadoId, aoFechar, aoPedir }: {
  condominio: string; nome: string; chamadoId?: string; aoFechar: () => void; aoPedir: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [areas, setAreas] = useState<AreaExcepcional[]>(["PEDIDOS"]);
  const [horas, setHoras] = useState("24");
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function pedir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`/v1/clientes/${condominio}/acessos-excepcionais`, { corpo: { motivo, areas, horas: Number(horas), chamadoId: chamadoId ?? null } });
    if (!r.ok) return setErro(r.erro);
    aoPedir();
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo={`Pedir acesso excepcional · ${nome}`} aoFechar={aoFechar}>
      <form onSubmit={pedir} noValidate className="grid gap-4">
        {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
        <CampoAreaTexto id="ae-motivo" rotulo="Por que precisa ver os dados" required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={campos.includes("motivo") ? "Explique o motivo (10 a 1.000 caracteres)." : null} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">O que vai ver</legend>
          <div className="trilho flex-wrap">
            {Object.entries(AREAS_EXCEPCIONAIS).map(([k, texto]) => (
              <button key={k} type="button" className="chip" aria-pressed={areas.includes(k as AreaExcepcional)}
                onClick={() => setAreas(areas.includes(k as AreaExcepcional) ? areas.filter((a) => a !== k) : [...areas, k as AreaExcepcional])}>{texto}</button>
            ))}
          </div>
          {campos.includes("areas") ? <p className="text-xs text-erro">Escolha ao menos uma área.</p> : null}
        </fieldset>
        <CampoSelecao id="ae-horas" rotulo="Por quanto tempo" value={horas} onChange={(e) => setHoras(e.target.value)}
          opcoes={PRAZOS_ACESSO_EXCEPCIONAL.map((h) => ({ valor: String(h), texto: `${h} horas` }))} />
        <p className="text-sm text-tinta-suave">Só para cliente atribuído a você. Só leitura. O síndico aprova na Plataforma.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={areas.length === 0}>Pedir ao síndico</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

type Item = Record<string, unknown>;

function linha(i: Item): { titulo: string; detalhe: string } {
  const titulo = i.protocolo ? `${String(i.protocolo)} · ${String(i.assunto ?? "")}` : String(i.titulo ?? i.nome ?? i.assunto ?? i.identificacao ?? "Sem título");
  const detalhe = [i.estado, i.situacao, i.categoria, i.unidade, i.tipo].filter((x) => typeof x === "string").join(" · ");
  return { titulo, detalhe };
}

function Area({ condominio, area }: { condominio: string; area: AreaExcepcional }) {
  const carga = useCarregar<{ validoAte: string; dados: { itens?: Item[]; comunicados?: { itens?: Item[] }; documentos?: { itens?: Item[] } } }>(
    `/v1/clientes/${condominio}/excepcional/${ROTA_AREA[area]}`);
  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados.dados;
  const grupos: [string, Item[]][] = area === "COMUNICADOS"
    ? [["Comunicados", d.comunicados?.itens ?? []], ["Documentos", d.documentos?.itens ?? []]]
    : [[AREAS_EXCEPCIONAIS[area], d.itens ?? []]];
  return (
    <div className="grid gap-4">
      <Aviso tom="info">Só leitura, até {formatarDataHora(carga.dados.validoAte)}. Esta abertura ficou no histórico que o síndico vê.</Aviso>
      {grupos.map(([titulo, itens]) => (
        <section key={titulo} className="grid gap-2">
          <h3 className="font-medium">{titulo}</h3>
          {itens.length === 0 ? <p className="text-sm text-tinta-suave">Nada aqui.</p> : (
            <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie text-sm">
              {itens.map((i, n) => {
                const l = linha(i);
                return <li key={String(i.id ?? n)} className="px-4 py-2.5"><span className="font-medium">{l.titulo}</span>{l.detalhe ? <span className="block text-xs text-tinta-suave">{l.detalhe}</span> : null}</li>;
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function AcessoExcepcional() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<{ condominio: { nome: string } }>(`/v1/clientes/${id}`);
  const carga = useCarregar<{ itens: Acesso[]; podePedir: boolean }>(`/v1/clientes/${id}/acessos-excepcionais`);
  const [pedindo, setPedindo] = useState(false);
  const [area, setArea] = useState<AreaExcepcional | null>(null);
  const nome = ficha.estado === "pronto" ? ficha.dados.condominio.nome : "";

  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const valendo = carga.dados.itens.find((a) => a.meu && a.situacao === "APROVADO");

  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href={`/clientes/${id}`} className="text-violeta-600 hover:underline">Voltar à ficha</Link></p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Acesso excepcional</h1>
          <p className="text-tinta-suave">{nome}. Sem aprovação do síndico, a TRÍADE não vê dados do condomínio fora da ficha.</p>
        </div>
        {carga.dados.podePedir && !valendo ? <Botao onClick={() => setPedindo(true)}>Pedir acesso</Botao> : null}
      </div>

      {valendo ? (
        <section className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4">
          <h2 className="font-medium">Ver como o cliente · só leitura</h2>
          <div role="group" aria-label="Áreas aprovadas" className="trilho flex-wrap justify-self-start">
            {valendo.areas.map((a) => <button key={a} type="button" className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>{AREAS_EXCEPCIONAIS[a]}</button>)}
          </div>
          {area ? <Area key={area} condominio={id} area={area} /> : <p className="text-sm text-tinta-suave">Escolha a área. Cada abertura fica registrada.</p>}
        </section>
      ) : null}

      {carga.dados.itens.length === 0 ? <Vazio titulo="Nenhum pedido de acesso">Peça só quando precisar investigar um problema do cliente.</Vazio> : (
        <ul className="grid gap-2.5">
          {carga.dados.itens.map((a) => (
            <li key={a.id} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-4">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.pedidoPor} · {descreverAcessoExcepcional(a.areas, a.horas)}</span>
                <Selo tom={TOM[a.situacao]}>{SITUACOES_ACESSO_EXCEPCIONAL[a.situacao]}</Selo>
              </span>
              <span className="text-sm">&ldquo;{a.motivo}&rdquo;</span>
              <span className="text-xs text-tinta-suave">
                Pedido em {formatarDataHora(a.criadoEm)}
                {a.decididoPor ? ` · decidido por ${a.decididoPor}` : ""}
                {a.validoAte && a.situacao === "APROVADO" ? ` · vale até ${formatarDataHora(a.validoAte)}` : ""}
                {a.motivoRecusa ? ` · motivo: ${a.motivoRecusa}` : ""}
                {a.leituras ? ` · ${a.leituras} ${a.leituras === 1 ? "abertura" : "aberturas"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pedindo ? <PedirAcessoExcepcional condominio={id} nome={nome} aoFechar={() => setPedindo(false)} aoPedir={() => { setPedindo(false); carga.recarregar(); }} /> : null}
    </div>
  );
}
