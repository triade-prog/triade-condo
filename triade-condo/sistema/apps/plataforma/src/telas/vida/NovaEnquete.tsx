"use client";
// Nova enquete (design "Vida em condomínio", tela 4; AC-03): pergunta, de 2 a 6 opções, quem
// responde, se é secreta, o prazo e por onde chega. Enviada, não muda: encerra-se e cria-se outra.

import { useState, type FormEvent } from "react";
import { CANAIS_ENQUETE, ESCOPOS_ENQUETE, type CanalEnquete, type EscopoEnquete } from "@triade/domain";
import { AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ListaEnquetes } from "../tipos.ts";

/** Daqui a 7 dias, às 23:59, no relógio de quem usa a tela ("AAAA-MM-DDTHH:MM"). */
function prazoPadrao(): string {
  const d = new Date(Date.now() + 7 * 86400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T23:59`;
}

export function NovaEnquete({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const carga = useCarregar<ListaEnquetes>("/v1/condominio/enquetes");
  return (
    <Dialogo aberto titulo="Nova enquete" aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando rotulo="Abrindo…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <Formulario canais={carga.dados.canais} aoFechar={aoFechar} aoSalvar={aoSalvar} /> : null}
    </Dialogo>
  );
}

function Formulario({ canais: ligados, aoFechar, aoSalvar }: { canais: ListaEnquetes["canais"]; aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", "", ""]);
  const [por, setPor] = useState<EscopoEnquete>("UNIDADE");
  const [secreta, setSecreta] = useState("sim");
  const [ate, setAte] = useState(prazoPadrao());
  const disponivel: Record<CanalEnquete, boolean> = { WHATSAPP: ligados.whatsapp, MURAL: ligados.mural, EMAIL: ligados.email };
  const [canais, setCanais] = useState<CanalEnquete[]>((Object.keys(CANAIS_ENQUETE) as CanalEnquete[]).filter((c) => disponivel[c]));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const quando = new Date(ate);
    const res = await chamarApi<{ convites: number; envios: number }>("/v1/condominio/enquetes", {
      corpo: { pergunta, opcoes, por, secreta: secreta === "sim", abertaAte: Number.isNaN(quando.getTime()) ? ate : quando.toISOString(), canais },
    });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    const n = res.dados.convites;
    const quem = por === "UNIDADE" ? (n === 1 ? "1 unidade" : `${n} unidades`) : (n === 1 ? "1 pessoa" : `${n} pessoas`);
    aoSalvar(`Enquete enviada para ${quem}. Cada uma recebe um link só dela${canais.includes("MURAL") ? ", e a pergunta aparece no mural" : ""}.`);
  }

  const alternar = (c: CanalEnquete) => setCanais((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));

  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoTexto id="eq-pergunta" rotulo="Pergunta" maxLength={200} required value={pergunta} onChange={(e) => setPergunta(e.target.value)}
        erro={comErro.includes("pergunta") ? "Escreva a pergunta, com 5 a 200 letras" : null} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium">Opções</legend>
        {opcoes.map((o, i) => (
          <CampoTexto key={i} id={`eq-opcao-${i}`} rotulo={`Opção ${i + 1}`} opcional={i >= 2} maxLength={80} value={o}
            onChange={(e) => setOpcoes((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        {opcoes.length < 6 ? (
          <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setOpcoes((xs) => [...xs, ""])}>Mais uma opção</Botao>
        ) : null}
        <span className={`text-[13px] ${comErro.includes("opcoes") ? "text-erro" : "text-tinta-suave"}`} role={comErro.includes("opcoes") ? "alert" : undefined}>
          {comErro.includes("opcoes") ? "Escreva de 2 a 6 opções, diferentes entre si" : "De 2 a 6 opções"}
        </span>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelecao id="eq-por" rotulo="Quem responde" value={por} onChange={(e) => setPor(e.target.value as EscopoEnquete)}
          opcoes={(Object.keys(ESCOPOS_ENQUETE) as EscopoEnquete[]).map((v) => ({ valor: v, texto: ESCOPOS_ENQUETE[v] }))}
          ajuda={por === "UNIDADE" ? "Os contatos da unidade dividem o mesmo link" : "Cada pessoa com vínculo confirmado"} />
        <CampoSelecao id="eq-secreta" rotulo="Respostas" value={secreta} onChange={(e) => setSecreta(e.target.value)}
          opcoes={[{ valor: "sim", texto: "Secretas" }, { valor: "nao", texto: "Abertas" }]}
          ajuda={secreta === "sim" ? "Ninguém vê quem escolheu o quê, nem o síndico" : "O síndico vê o que cada um respondeu"} />
      </div>
      <CampoTexto id="eq-ate" rotulo="Aberta até" type="datetime-local" required value={ate} onChange={(e) => setAte(e.target.value)}
        erro={comErro.includes("abertaAte") ? "Escolha um prazo de 1 hora a 90 dias a partir de agora" : null}
        ajuda="Um lembrete vai dois dias antes, só para quem não respondeu" />
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-[13px] font-medium">Por onde chega</legend>
        {(Object.keys(CANAIS_ENQUETE) as CanalEnquete[]).map((c) => (
          <label key={c} className="flex min-h-6 items-center gap-2 text-sm">
            <input type="checkbox" checked={canais.includes(c)} onChange={() => alternar(c)} disabled={!disponivel[c]} />
            {c === "WHATSAPP" ? "WhatsApp (modelo aprovado)" : CANAIS_ENQUETE[c]}
            {!disponivel[c] ? <span className="text-tinta-suave">· {c === "WHATSAPP" ? "WhatsApp não conectado" : c === "EMAIL" ? "e-mail desligado" : "mural desligado"}</span> : null}
          </label>
        ))}
        {comErro.includes("canais") ? <span className="text-[13px] text-erro" role="alert">Escolha pelo menos um canal</span> : null}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
        <Botao type="submit" disabled={enviando}>Enviar enquete</Botao>
      </div>
    </form>
  );
}
