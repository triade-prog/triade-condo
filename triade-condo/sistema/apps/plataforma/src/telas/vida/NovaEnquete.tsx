"use client";
// Nova enquete (design "Vida em condomínio", tela 4; DC15, tela-modelo vida-nova-enquete; decisão
// D.1 de 22/10/2026; AC-03): uma página. No computador, 2 partes numeradas (a pergunta; quem
// responde e por onde chega) com quem vai receber ao lado e o rodapé fixo; no celular, 2 passos
// com Continuar e Voltar. Enviada, não muda: encerra-se e cria-se outra. Antes de enviar, Quem vai
// receber diz quantos ficam sem o link pelos canais marcados e quais são (D4.11, decisão C.2 de 24/10/2026).

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { CANAIS_ENQUETE, type CanalEnquete, type EscopoEnquete } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoTexto, Carregando, camposComErro, chamarApi, ErroCarregar, Icone, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { CartaoFicha, Escolha } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ListaEnquetes, SemCanalEnquete } from "../tipos.ts";
import { Voltar } from "./comum.tsx";

type Passo = 1 | 2;
const PARTES = ["A pergunta", "Quem responde e por onde chega"] as const;
const PASSO_DO_CAMPO: Record<string, Passo> = { pergunta: 1, opcoes: 1, por: 2, secreta: 2, abertaAte: 2, canais: 2 };
const ICONE_CANAL: Record<CanalEnquete, NomeIcone> = { WHATSAPP: "whats", MURAL: "casa", EMAIL: "email" };

/** Daqui a 7 dias, às 23:59, no relógio de quem usa a tela ("AAAA-MM-DDTHH:MM"). */
function prazoPadrao(): string {
  const d = new Date(Date.now() + 7 * 86400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T23:59`;
}

/** Quem não recebe o link por nenhum dos canais marcados que mandam link (WhatsApp e e-mail). */
export function semLink(lista: SemCanalEnquete[], canais: CanalEnquete[]): SemCanalEnquete[] {
  const whats = canais.includes("WHATSAPP"), email = canais.includes("EMAIL");
  return lista.filter((x) => !(whats && x.whatsapp) && !(email && x.email));
}

/** "Torre A · 102, Torre A · 103 e mais 4". */
function alguns(nomes: string[]): string {
  return nomes.length <= 3 ? nomes.join(", ") : `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
}

function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`t-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h2 id={`t-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h2>
      </div>
      {children}
    </section>
  );
}

export function NovaEnquete() {
  const carga = useCarregar<ListaEnquetes>("/v1/condominio/enquetes");
  const voltar = <Voltar href="/vida?aba=enquetes" texto="Enquetes" />;
  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Nova enquete</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  return <Formulario l={carga.dados} voltar={voltar} />;
}

function Formulario({ l, voltar }: { l: ListaEnquetes; voltar: ReactNode }) {
  const router = useRouter();
  const celular = useCelular();
  const { atualizar } = usePlataforma();
  const [passo, setPasso] = useState<Passo>(1);
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", "", ""]);
  const [por, setPor] = useState<EscopoEnquete>("UNIDADE");
  const [secreta, setSecreta] = useState<"sim" | "nao">("sim");
  const [ate, setAte] = useState(prazoPadrao());
  const disponivel: Record<CanalEnquete, boolean> = { WHATSAPP: l.canais.whatsapp, MURAL: l.canais.mural, EMAIL: l.canais.email };
  const [canais, setCanais] = useState<CanalEnquete[]>((Object.keys(CANAIS_ENQUETE) as CanalEnquete[]).filter((c) => disponivel[c]));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function enviar(ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setEnviando(true);
    const quando = new Date(ate);
    const res = await chamarApi<{ convites: number; envios: number }>("/v1/condominio/enquetes", {
      corpo: { pergunta, opcoes, por, secreta: secreta === "sim", abertaAte: Number.isNaN(quando.getTime()) ? ate : quando.toISOString(), canais },
    });
    setEnviando(false);
    if (!res.ok) {
      setErro(res.erro);
      const volta = camposComErro(res.erro).map((c) => PASSO_DO_CAMPO[c]).filter(Boolean).sort()[0];
      if (volta) setPasso(volta);
      return;
    }
    atualizar();
    router.push(`/vida?aba=enquetes&feito=enquete&n=${res.dados.convites}&por=${por}${canais.includes("MURAL") ? "&mural=1" : ""}`);
  }

  const alternar = (c: CanalEnquete) => setCanais((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const resumo = pergunta.trim() || "Sem pergunta ainda";

  const parte1 = (
    <>
      <CampoTexto id="eq-pergunta" rotulo="Pergunta" maxLength={200} required value={pergunta} onChange={(e) => setPergunta(e.target.value)}
        erro={comErro.includes("pergunta") ? "Escreva a pergunta, com 5 a 200 letras" : null} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 t-apoio font-medium">Opções <span className="font-normal text-tinta-suave">· de 2 a 6</span></legend>
        {opcoes.map((o, i) => (
          <CampoTexto key={i} id={`eq-opcao-${i}`} rotulo={`Opção ${i + 1}`} opcional={i >= 2} maxLength={80} value={o}
            onChange={(e) => setOpcoes((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        {opcoes.length < 6 ? (
          <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setOpcoes((xs) => [...xs, ""])}><Icone nome="mais" className="h-4 w-4" />Mais uma opção</Botao>
        ) : null}
        {comErro.includes("opcoes") ? <span className="t-apoio text-erro" role="alert">Escreva de 2 a 6 opções, diferentes entre si</span> : null}
      </fieldset>
    </>
  );

  const parte2 = (
    <>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="t-apoio font-medium">Quem responde</span>
          <Escolha rotulo="Quem responde" atual={por} aoMudar={setPor} opcoes={[{ valor: "UNIDADE", texto: "Uma por unidade" }, { valor: "PESSOA", texto: "Uma por pessoa" }]} />
          <span className="t-apoio">{por === "UNIDADE" ? "Os contatos da unidade dividem o mesmo link." : "Cada pessoa com vínculo confirmado."}</span>
        </div>
        <div className="grid gap-1.5">
          <span className="t-apoio font-medium">Respostas</span>
          <Escolha rotulo="Respostas" atual={secreta} aoMudar={setSecreta}
            opcoes={[{ valor: "sim", texto: <><Icone nome="cadeado" className="h-4 w-4" />Secretas</> }, { valor: "nao", texto: <><Icone nome="olho" className="h-4 w-4" />Abertas</> }]} />
          <span className="t-apoio">{secreta === "sim" ? "Ninguém vê quem escolheu o quê, nem o síndico." : "O síndico vê o que cada um respondeu."}</span>
        </div>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 t-apoio font-medium">Por onde chega</legend>
        <div className="grid gap-2">
          {(Object.keys(CANAIS_ENQUETE) as CanalEnquete[]).map((c) => (
            <label key={c} className={`flex items-start gap-3 rounded-2xl border border-linha px-4 py-3 ${disponivel[c] ? "cursor-pointer" : "opacity-70"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4 accent-violeta-600" checked={canais.includes(c)} onChange={() => alternar(c)} disabled={!disponivel[c]} />
              <span className="grid">
                <span>{c === "WHATSAPP" ? "WhatsApp do condomínio" : c === "MURAL" ? "Mural online" : "E-mail"}</span>
                <span className="t-apoio">{!disponivel[c] ? (c === "WHATSAPP" ? "WhatsApp não conectado" : c === "EMAIL" ? "E-mail desligado" : "Mural desligado")
                  : c === "WHATSAPP" ? "Com o link de cada unidade (modelo aprovado)" : c === "MURAL" ? "Para quem abre o mural" : "Para quem tem e-mail confirmado"}</span>
              </span>
            </label>
          ))}
        </div>
        {comErro.includes("canais") ? <span className="t-apoio text-erro" role="alert">Escolha pelo menos um canal</span> : null}
      </fieldset>
      <CampoTexto id="eq-ate" rotulo="Aberta até" type="datetime-local" required value={ate} onChange={(e) => setAte(e.target.value)} className="max-w-sm"
        erro={comErro.includes("abertaAte") ? "Escolha um prazo de 1 hora a 90 dias a partir de agora" : null}
        ajuda="Um lembrete vai dois dias antes, só para quem não respondeu." />
    </>
  );

  const lista = (por === "UNIDADE" ? l.semCanal?.unidades : l.semCanal?.pessoas) ?? [];
  const total = por === "UNIDADE" ? l.unidades : l.pessoas ?? 0;
  const uma = por === "UNIDADE" ? "unidade" : "pessoa";
  const varias = por === "UNIDADE" ? "unidades" : "pessoas";
  const n = (k: number) => `${k} ${k === 1 ? uma : varias}`;
  const comLink = canais.filter((c) => c !== "MURAL");
  const sem = l.semCanal ? semLink(lista, canais) : [];
  const porCanal: Partial<Record<CanalEnquete, string>> = l.semCanal ? {
    WHATSAPP: n(total - lista.filter((x) => !x.whatsapp).length),
    EMAIL: n(total - lista.filter((x) => !x.email).length),
    MURAL: "todos",
  } : {};
  const faltam = comLink.length === 2 ? "sem WhatsApp nem e-mail" : comLink[0] === "WHATSAPP" ? "sem WhatsApp" : "sem e-mail";

  const quemRecebe = (
    <CartaoFicha id="quem" titulo="Quem vai receber" icone="pessoas">
      <div className="grid gap-1">
        {por === "UNIDADE" || l.pessoas !== undefined ? (
          <p className="flex items-baseline gap-2.5"><span className="text-[40px] leading-none font-semibold tracking-tight" aria-hidden="true">{total}</span>
            <span className="t-texto">{total === 1 ? `${uma} recebe o link` : `${varias} recebem o link`}<span className="sr-only">: {total}</span></span></p>
        ) : <p className="t-texto">Cada pessoa com vínculo confirmado recebe o seu link.</p>}
        <p className="t-apoio">{por === "UNIDADE" ? "Uma resposta por unidade." : "Uma resposta por pessoa."}{l.semCanal ? "" : " Quem não tem WhatsApp nem e-mail recebe o link copiado na ficha da enquete."}</p>
      </div>
      <ul className="grid t-texto" aria-label="Canais">
        {(Object.keys(CANAIS_ENQUETE) as CanalEnquete[]).map((c) => {
          const vai = canais.includes(c);
          return (
            <li key={c} className="flex items-center justify-between gap-3 border-t border-linha py-2.5">
              <span className="flex items-center gap-2.5"><span className="ladrilho h-7 w-7 rounded-[9px]" data-tom={vai ? "ok" : "neutro"} aria-hidden="true"><Icone nome={ICONE_CANAL[c]} className="h-3.5 w-3.5" /></span>{CANAIS_ENQUETE[c]}</span>
              <span className={`font-semibold ${vai ? "" : "text-tinta-suave"}`}>{!disponivel[c] ? "desligado" : vai ? porCanal[c] ?? "vai" : "não vai"}</span>
            </li>
          );
        })}
      </ul>
      {l.semCanal && total > 0 ? (
        !comLink.length ? (
          <Aviso tom="atencao" titulo="Só pelo mural, ninguém recebe o link próprio">Copie o link de cada {uma} na ficha da enquete.</Aviso>
        ) : sem.length ? (
          <Aviso tom="atencao" titulo={`${n(sem.length)} ${faltam}`}>{alguns(sem.map((x) => x.nome))}. Copie o link {sem.length === 1 ? "dela" : "de cada uma"} na ficha da enquete.</Aviso>
        ) : <p className="t-apoio">Todas as {varias} recebem o link por {comLink.length === 2 ? "WhatsApp ou e-mail" : comLink[0] === "WHATSAPP" ? "WhatsApp" : "e-mail"}.</p>
      ) : null}
    </CartaoFicha>
  );

  return (
    <form onSubmit={(e) => { if (celular && passo < 2) { e.preventDefault(); setPasso(2); return; } void enviar(e); }} noValidate className="grid gap-5">
      {voltar}
      <div>
        <h1 className="t-titulo-tela">Nova enquete</h1>
        <p className="t-apoio mt-1">Enquete consulta, não decide. Cada unidade recebe um link só dela, sem conta.</p>
      </div>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid gap-3 md:hidden">
        <div className="passos" role="progressbar" aria-label="Passos da enquete" aria-valuemin={1} aria-valuemax={2} aria-valuenow={passo}
          aria-valuetext={`Passo ${passo} de 2: ${PARTES[passo - 1]}`}>
          {[1, 2].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
        </div>
        {passo === 2 ? (
          <button type="button" className="resumo-passo" onClick={() => setPasso(1)}>
            <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
            <span className="grid min-w-0 flex-1"><span className="t-apoio">{PARTES[0]}</span><span className="truncate">{resumo}</span></span>
            <span className="alterar">Alterar</span>
          </button>
        ) : null}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Enquete" className="rounded-[18px] border border-linha bg-superficie px-6 shadow-s1 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none">
          <Parte n={1} passo={passo}>{parte1}</Parte>
          <Parte n={2} passo={passo}>{parte2}</Parte>
        </section>
        <div className={`lg:sticky lg:top-6 ${passo === 2 ? "" : "max-md:hidden"}`}>{quemRecebe}</div>
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-2 border-t border-linha bg-superficie px-4 py-3 shadow-s2 max-md:bottom-[calc(61px+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        {passo > 1 ? <Botao variante="contorno" className="md:hidden" onClick={() => setPasso(1)}><Icone nome="esq" />Voltar</Botao> : null}
        <Botao variante="contorno" className={passo > 1 ? "max-md:hidden" : ""} onClick={() => router.push("/vida?aba=enquetes")}>Cancelar</Botao>
        {passo < 2 ? <Botao className="md:hidden max-md:flex-1" onClick={() => setPasso(2)}>Continuar<Icone nome="dir" /></Botao> : null}
        <Botao type="submit" disabled={enviando} className={passo < 2 ? "max-md:hidden" : "max-md:flex-1"}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar a enquete"}</Botao>
      </div>
    </form>
  );
}
