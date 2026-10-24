"use client";
// Configurações › Ajuda da IA (IA-19, IA-20; telas-modelo/ia-configuracoes-*): o que está ligado,
// o que vai para a IA, quem vê e, no bloco "Feito pela TRÍADE", o uso do mês contra o limite, em
// quantidade (o custo fica no Console). Ligar e desligar cada função é do condomínio e grava pela
// barra do rodapé; com a chave da TRÍADE desligada, as duas ficam travadas, com o motivo.

import Link from "next/link";
import { diaDeRenovar } from "@triade/domain";
import { Aviso, AvisoErro, Carregando, chamarApi, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { useState } from "react";
import { useAmbiente, useCarregar, naBase } from "./contexto.tsx";
import { BlocoTriade, PedirMudanca } from "./tecnica.tsx";
import { contarMudancas, useParte, useVersao } from "./salvar.tsx";

export interface AjudaIa {
  ligadaTriade: boolean;
  motivoTriade?: string;
  sugerir: { ligada: boolean; situacao: string };
  transcrever: { ligada: boolean; situacao: string; servico?: boolean };
  uso: { sugestoes: { usadas: number; limite: number }; transcricao: { minutos: number; limite: number }; renovaEm: string };
  versao: number;
  pode: { editar: boolean };
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** O mês do uso: o anterior ao da renovação. */
function mesDoUso(renovaEm: string): string {
  const m = Number(renovaEm.slice(5, 7));
  return MESES[(m + 10) % 12] ?? "este mês";
}

function Chave({ id, rotulo, ajuda, marcado, travado, aoMudar }: { id: string; rotulo: string; ajuda: string; marcado: boolean; travado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="interruptor px-4 py-3.5">
      <span className="grid flex-1 gap-0.5">
        <span className="font-medium">{rotulo}</span>
        <span id={`${id}-ajuda`} className="t-apoio">{ajuda}</span>
      </span>
      <input id={id} type="checkbox" role="switch" checked={marcado} disabled={travado} aria-describedby={`${id}-ajuda`} onChange={(e) => aoMudar(e.target.checked)} />
    </label>
  );
}

function Numero({ n }: { n: number }) {
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-violeta-50 t-apoio font-semibold text-violeta-600" aria-hidden="true">{n}</span>;
}

function Barra({ rotulo, usado, limite, unidade }: { rotulo: string; usado: number; limite: number; unidade?: string }) {
  const parte = limite > 0 ? Math.min(100, (usado / limite) * 100) : 100;
  return (
    <div className="grid gap-2 py-3">
      <p className="flex justify-between gap-2 t-texto"><span>{rotulo}</span><span><strong className="font-semibold">{usado}</strong> de {limite}{unidade ? ` ${unidade}` : ""}</span></p>
      <div className="h-2 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={limite} aria-valuenow={usado}>
        <div className="h-full rounded-full bg-violeta-600" style={{ width: `${parte}%` }} />
      </div>
    </div>
  );
}

function Funcoes({ d }: { d: AjudaIa }) {
  const [sugerir, setSugerir] = useState(d.sugerir.ligada);
  const [transcrever, setTranscrever] = useState(d.transcrever.ligada);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const versao = useVersao("ia", d.versao);
  const travado = !d.ligadaTriade || !d.pode.editar;

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi<{ versao: number }>(naBase("/ia"), { metodo: "PUT", corpo: { versao: versao.atual(), sugerir, transcrever } });
    if (!r.ok) { setErro(r.erro); return null; }
    versao.gravou(r.dados);
    return "Ajuda da IA salva. Vale para o que chegar daqui em diante.";
  }
  useParte("ia-funcoes", {
    nome: "O que está ligado",
    mudancas: contarMudancas({ sugerir: d.sugerir.ligada, transcrever: d.transcrever.ligada }, { sugerir, transcrever }),
    salvar,
  });

  return (
    <div className="grid gap-3">
      <h2 className="flex items-center gap-2.5 t-titulo-secao font-medium"><Numero n={1} />O que está ligado</h2>
      {!d.ligadaTriade ? (
        <Aviso tom="info" titulo="A TRÍADE desligou a IA deste condomínio">
          {d.motivoTriade ? `${d.motivoTriade}. ` : ""}As duas opções ficam travadas até ela ser ligada de novo. Os pedidos seguem normais.
        </Aviso>
      ) : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid divide-y divide-linha rounded-[14px] border border-linha">
        <Chave id="ia-sugerir" rotulo="Sugerir categoria, prioridade e local" marcado={sugerir} travado={travado} aoMudar={setSugerir}
          ajuda="Nos pedidos novos, do WhatsApp e do painel. Quem atende confirma com um toque; nada muda sozinho." />
        <Chave id="ia-transcrever" rotulo="Transcrever áudios do WhatsApp" marcado={transcrever} travado={travado} aoMudar={setTranscrever}
          ajuda={d.transcrever.servico === false
            ? "O texto aparece ao lado do áudio, marcado como automático. O serviço de transcrição ainda não foi contratado: por enquanto, os áudios ficam só com o som."
            : "O texto aparece ao lado do áudio, marcado como automático. O morador não recebe nada sobre isso."} />
      </div>
      <p className="t-apoio text-tinta-suave">Desligar vale na hora, para o que chegar depois. O que já foi sugerido ou transcrito continua no pedido.</p>
    </div>
  );
}

/** A página. Lê à parte (como o WhatsApp): o resto das Configurações não depende dela. */
export function AbaIa() {
  const { endereco } = useAmbiente();
  const carga = useCarregar<AjudaIa>(naBase("/ia"));
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a Ajuda da IA…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const u = d.uso;
  const vai = ["O relato e o texto das mensagens do pedido", "As categorias, prioridades e locais do condomínio", "O áudio do WhatsApp, só para o serviço de transcrição"];
  const naoVai = ["Nome e telefone, tirados do texto antes de enviar", "Fotos e documentos", "Outros pedidos e outras unidades"];
  const vizinhas = endereco ? [
    { id: "categorias" as const, nome: "Categorias e prioridades", resumo: "A IA só sugere entre as que estão em uso", icone: "pedido" as const },
    { id: "whatsapp" as const, nome: "WhatsApp", resumo: "O número do condomínio e as mensagens", icone: "whats" as const },
  ] : [];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        <p className="rounded-[14px] border border-violeta-200 bg-violeta-50 px-4 py-3 t-apoio text-tinta-suave">
          <strong className="font-semibold text-tinta">A IA só sugere.</strong> Categoria, prioridade e local mudam quando alguém toca em Usar a sugestão ou escolhe outra.
          A transcrição aparece marcada como automática e pode ter erro: na dúvida, vale o áudio. Nada que a IA faz vai para o morador nem conta como retorno; quem atende
          continua responsável pelo pedido. A TRÍADE acompanha o uso e pode desligar a IA do condomínio; aí as duas opções acima ficam travadas, com o motivo.
        </p>
        <section aria-label="Ajuda da IA" className="grid gap-6 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <Funcoes key={d.versao} d={d} />
          <div className="grid gap-3 border-t border-linha pt-5">
            <h2 className="flex items-center gap-2.5 t-titulo-secao font-medium"><Numero n={2} />O que vai para a IA</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid content-start gap-2 rounded-[14px] border border-ok-borda bg-ok-fundo p-4">
                <p className="t-texto font-medium">Vai</p>
                <ul className="grid gap-1.5">{vai.map((x) => <li key={x} className="flex gap-2 t-texto"><Icone nome="check" className="mt-0.5 h-4 w-4 text-ok" />{x}</li>)}</ul>
              </div>
              <div className="grid content-start gap-2 rounded-[14px] border border-erro-borda bg-erro-fundo p-4">
                <p className="t-texto font-medium">Não vai</p>
                <ul className="grid gap-1.5">{naoVai.map((x) => <li key={x} className="flex gap-2 t-texto"><Icone nome="fechar" className="mt-0.5 h-4 w-4 text-erro" />{x}</li>)}</ul>
              </div>
            </div>
            <p className="flex gap-1.5 t-apoio text-tinta-suave"><Icone nome="info" className="mt-0.5 h-3.5 w-3.5" />
              O áudio vai inteiro para a transcrição: se a pessoa disser o próprio nome, ele aparece no texto, que fica só no painel.</p>
          </div>
          <div className="grid gap-3 border-t border-linha pt-5">
            <h2 className="flex items-center gap-2.5 t-titulo-secao font-medium"><Numero n={3} />Quem vê</h2>
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta-suave" aria-hidden="true"><Icone nome="pessoas" className="h-[18px] w-[18px]" /></span>
              <span className="grid gap-0.5">
                <span className="t-texto font-medium">Só quem cuida de pedidos no painel</span>
                <span className="t-apoio text-tinta-suave">Síndico e quem tem Pedidos em Pessoas e acesso. O morador não vê sugestão nem transcrição, e nada disso conta como retorno.</span>
              </span>
            </div>
          </div>
        </section>
        <BlocoTriade>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="grid gap-0.5">
              <span className="t-texto font-medium">Uso de {mesDoUso(u.renovaEm)}</span>
              <span className="t-apoio text-tinta-suave">Limite mensal do condomínio. Renova em {diaDeRenovar(u.renovaEm)}.</span>
            </span>
            <PedirMudanca parte="LIMITE_IA" valor={`${u.sugestoes.limite} sugestões e ${u.transcricao.limite} minutos de transcrição por mês`} />
          </div>
          <Barra rotulo="Sugestões" usado={u.sugestoes.usadas} limite={u.sugestoes.limite} />
          <Barra rotulo="Transcrição" usado={u.transcricao.minutos} limite={u.transcricao.limite} unidade="minutos" />
          <div className="grid gap-0.5 py-3">
            <span className="t-texto font-medium">Ao chegar no limite</span>
            <span className="t-apoio text-tinta-suave">A função para até o mês virar. Os pedidos seguem normais e o áudio continua guardado.</span>
          </div>
        </BlocoTriade>
      </div>
      {vizinhas.length ? (
        <section aria-labelledby="t-mesma-area-ia" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 lg:sticky lg:top-6">
          <h2 id="t-mesma-area-ia" className="t-rotulo pb-1">Na mesma área</h2>
          <ul className="grid">
            {vizinhas.map((x) => (
              <li key={x.id} className="border-t border-linha first:border-t-0">
                <Link href={endereco!(x.id)} className="flex min-h-[52px] items-center gap-3 py-2.5 hover:text-violeta-600">
                  <span className="ladrilho h-9 w-9 rounded-xl" data-tom={x.id === "whatsapp" ? "ok" : "violeta"} aria-hidden="true"><Icone nome={x.icone} className="h-4 w-4" /></span>
                  <span className="grid min-w-0 flex-1"><span className="t-texto font-medium">{x.nome}</span><span className="t-apoio text-tinta-suave">{x.resumo}</span></span>
                  <Icone nome="dir" className="h-[18px] w-[18px] shrink-0 text-tinta-suave" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
