"use client";
// Meu dia (quadro 336, CM-04 e CM-15): no celular, o Comercial abre no que precisa ser feito hoje.
// Atrasados primeiro, depois hoje e quem está sem próximo passo, só dos interessados da pessoa ou
// sem responsável. Ligar e WhatsApp buscam o número na ficha; nada sai sozinho.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { linkWhatsappComercial, preencherMensagem } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, textoDoErro, Vazio } from "@triade/ui";
import { CabecaPagina, CLASSE_LINK_LINHA, plural } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { urlAgenda } from "./agenda.ts";
import { linhaInteressado, linkComConvite, ROTAS_COMERCIAL, SelosAtencao, textoTarefa } from "./comum.tsx";
import { JanelaConversa, JanelaNovoInteressado } from "./janelas.tsx";
import type { FichaInteressado, Interessado, MeuDia as DadosMeuDia } from "./tipos.ts";

function Item({ i, podeEditar, feito, registrar, avisar }: {
  i: Interessado; podeEditar: boolean; feito: () => void; registrar: (i: Interessado) => void; avisar: (t: string) => void;
}) {
  const [indo, setIndo] = useState(false);

  async function abrir(canal: "tel" | "whats") {
    setIndo(true);
    const r = await chamarApi<FichaInteressado>(ROTAS_COMERCIAL.interessado(i.id));
    setIndo(false);
    if (!r.ok || !r.dados.whatsapp) return avisar(r.ok ? "Este interessado está sem WhatsApp." : textoDoErro(r.erro));
    const f = r.dados;
    const passo = i.tarefa.tarefa === "CADENCIA" ? i.tarefa.texto : undefined;
    if (canal === "tel") return void (window.location.href = `tel:+${f.whatsapp}`);
    // O [link de agendamento] sai com o convite desta ficha (0310, A).
    const l = await linkComConvite(f.id, f.linkAgenda, passo ?? "");
    if (!l.ok) return avisar(textoDoErro(l.erro));
    window.location.href = linkWhatsappComercial(f.whatsapp!, preencherMensagem(passo ?? "", {
      nome: f.pessoa, condominio: f.condominio, linkAgenda: l.link ?? (f.linkAgenda ? urlAgenda(window.location.origin, f.linkAgenda) : null),
    }));
  }

  async function cadenciaFeita() {
    setIndo(true);
    const r = await chamarApi(ROTAS_COMERCIAL.cadencia(i.id), { corpo: { acao: "FEITO", resumo: null } });
    setIndo(false);
    if (!r.ok) return avisar(textoDoErro(r.erro));
    feito();
  }

  return (
    <li className="relative grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <Link href={`/comercial/${i.id}`} className={CLASSE_LINK_LINHA}>{i.condominio}</Link>
      <span className="t-apoio">{linhaInteressado(i) || "Sem contato"}</span>
      <span className="t-texto">{textoTarefa(i)}</span>
      <span className="flex flex-wrap gap-1.5"><SelosAtencao i={i} /></span>
      {podeEditar ? (
        <div className="relative z-10 grid grid-cols-3 gap-2">
          <Botao variante="contorno" disabled={indo || !i.whatsappMascarado} onClick={() => void abrir("tel")}><Icone nome="telefone" />Ligar</Botao>
          <Botao variante="contorno" disabled={indo || !i.temWhatsapp} onClick={() => void abrir("whats")}
            title={i.temWhatsapp ? undefined : "Sem aceite de mensagens pelo WhatsApp"}><Icone nome="whats" />WhatsApp</Botao>
          <Botao disabled={indo} onClick={() => (i.tarefa.tarefa === "CADENCIA" ? void cadenciaFeita() : registrar(i))}><Icone nome="check" />Feito</Botao>
        </div>
      ) : null}
    </li>
  );
}

function Grupo({ titulo, itens, ...resto }: { titulo: string; itens: Interessado[] } & Omit<Parameters<typeof Item>[0], "i">) {
  if (!itens.length) return null;
  return (
    <section className="grid gap-3" aria-label={titulo}>
      <h2 className="flex items-center justify-between t-titulo-cartao">{titulo}<span className="t-codigo">{itens.length}</span></h2>
      <ul className="grid gap-3">{itens.map((i) => <Item key={i.id} i={i} {...resto} />)}</ul>
    </section>
  );
}

export function MeuDia() {
  const carga = useCarregar<DadosMeuDia>(ROTAS_COMERCIAL.meuDia);
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [conversa, setConversa] = useState<Interessado | null>(null);
  const [novo, setNovo] = useState(false);
  const d = carga.estado === "pronto" ? carga.dados : null;
  const total = d ? d.atrasados.length + d.hoje.length + d.semPasso.length : 0;
  const props = { podeEditar: !!d?.podeEditar, feito: carga.recarregar, registrar: setConversa, avisar: setAviso };

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Meu dia" apoio={d ? (total ? plural(total, "interessado pede você hoje", "interessados pedem você hoje") : "Nada para hoje.") : undefined}
        acao={d?.podeEditar ? <Botao onClick={() => setNovo(true)}><Icone nome="mais" />Novo interessado</Botao> : undefined} />
      {aviso ? <Aviso tom="atencao" papel="alert">{aviso}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d && total === 0 ? (
        <Vazio titulo="Tudo em dia" icone="check">Nenhum interessado atrasado, para hoje ou sem próximo passo. A lista completa abre no computador.</Vazio>
      ) : null}
      {d ? (
        <>
          <Grupo titulo="Atrasados" itens={d.atrasados} {...props} />
          <Grupo titulo="Hoje" itens={d.hoje} {...props} />
          <Grupo titulo="Sem próximo passo" itens={d.semPasso} {...props} />
        </>
      ) : null}
      {conversa ? (
        <JanelaConversa i={conversa} aoFechar={() => setConversa(null)} feito={() => { setConversa(null); router.push(`/comercial/${conversa.id}`); }} />
      ) : null}
      {novo ? (
        <JanelaNovoInteressado equipe={d?.equipe ?? []} aoFechar={() => setNovo(false)}
          feito={(id, juntado) => { setNovo(false); router.push(`/comercial/${id}${juntado ? "?juntado=1" : ""}`); }} />
      ) : null}
    </div>
  );
}
