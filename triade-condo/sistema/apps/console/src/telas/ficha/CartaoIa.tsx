"use client";
// IA e custo na Visão geral da ficha (IA-20, NG-13, NG-15; telas-modelo/ia-console-ficha-cliente):
// o uso de cada função no mês contra o limite, o custo estimado em reais, quanto custaria usar todo
// o limite e a chave que desliga a IA do condomínio. O cliente vê só o uso, sem valores. Só a
// Administração muda a chave e o limite; para as outras funções a chave aparece travada.

import { useState, type FormEvent } from "react";
import { diaDeRenovar, dinheiro, formatar, formatarDataHora, FUNCOES_IA } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, FaixaInterna, Icone, Selo, textoDoErro, type ErroApi,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { AcaoCartao, Cartao } from "../comum.tsx";

interface UsoFuncao { ligada: boolean; chamadas: number; falhas: number; limite: number }
interface IaCliente {
  ligada: boolean;
  motivo?: string;
  mudadaEm?: string;
  mudadaPor?: string;
  provedorTranscricao: string;
  sugerir: UsoFuncao & { usadas: number };
  transcrever: UsoFuncao & { minutos: number; audios: number };
  renovaEm: string;
  versao: number;
  pode: { chave: boolean; limite: boolean };
  reais: { sugerirCentavos: number; transcreverCentavos: number; totalCentavos: number; noLimiteCentavos: number; tabelaDe: string; dolarCentavos: number };
}
interface Chamada { id: string; em: string; funcao: "SUGERIR" | "TRANSCREVER"; modelo: string; tokensEntrada: number; tokensSaida: number; segundos: number; resultado: string; protocolo?: string }

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesDoUso = (renovaEm: string) => MESES[(Number(renovaEm.slice(5, 7)) + 10) % 12] ?? "este mês";
const reais = (centavos: number) => formatar(dinheiro(centavos));
const dataBr = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, "$3/$2/$1");
const RESULTADOS: Record<string, string> = { OK: "Pronta", SEM_CONFIANCA: "Sem confiança", FORA_DO_USO: "Fora do catálogo", VAZIA: "Sem texto", FALHA: "Falhou" };

function BarraUso({ usado, limite, rotulo }: { usado: number; limite: number; rotulo: string }) {
  return (
    <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={limite} aria-valuenow={usado}>
      <div className="h-full rounded-full bg-violeta-600" style={{ width: `${limite > 0 ? Math.min(100, (usado / limite) * 100) : 100}%` }} />
    </div>
  );
}

function JanelaChave({ ia, id, aoFechar, salvo }: { ia: IaCliente; id: string; aoFechar: () => void; salvo: (texto: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const desligar = ia.ligada;
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${id}/ia/chave`, { metodo: "PUT", corpo: { versao: ia.versao, ligada: !desligar, motivo: motivo.trim() || undefined } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(desligar ? "IA desligada neste condomínio. O síndico vê o aviso em Ajuda da IA." : "IA ligada neste condomínio.");
  }
  return (
    <Dialogo aberto titulo={desligar ? "Desligar a IA deste condomínio" : "Ligar a IA deste condomínio"} aoFechar={aoFechar}>
      <form onSubmit={(e) => void enviar(e)} className="grid gap-4" noValidate>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-texto">{desligar
          ? "As duas funções param na hora, para o que chegar depois. Os pedidos seguem normais e o que já foi sugerido ou transcrito continua no pedido."
          : "A sugestão e a transcrição voltam para os pedidos que chegarem daqui em diante, como o síndico deixou em Ajuda da IA."}</p>
        {desligar ? (
          <CampoAreaTexto id="ia-motivo" rotulo="Motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            ajuda="O síndico vê o motivo em Configurações › Ajuda da IA. Fica no histórico da equipe."
            erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (3 a 300 caracteres)." : null} />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante={desligar ? "perigo" : "primario"} disabled={enviando}>{desligar ? "Desligar a IA" : "Ligar a IA"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaLimite({ ia, id, aoFechar, salvo }: { ia: IaCliente; id: string; aoFechar: () => void; salvo: (texto: string) => void }) {
  const [sugestoes, setSugestoes] = useState(String(ia.sugerir.limite));
  const [minutos, setMinutos] = useState(String(ia.transcrever.limite));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const campos = camposComErro(erro);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = await chamarApi(`/v1/clientes/${id}/ia/limites`, {
      metodo: "PUT", corpo: { versao: ia.versao, limiteSugestoes: Number(sugestoes), limiteMinutos: Number(minutos) },
    });
    if (!r.ok) return setErro(r.erro);
    salvo("Limite da IA salvo. Vale já para este mês.");
  }
  return (
    <Dialogo aberto titulo="Editar limite do mês" aoFechar={aoFechar}>
      <form onSubmit={(e) => void enviar(e)} className="grid gap-4" noValidate>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto id="ia-lim-sug" rotulo="Sugestões por mês" inputMode="numeric" value={sugestoes} onChange={(e) => setSugestoes(e.target.value.replace(/\D/g, ""))}
            erro={campos.includes("limiteSugestoes") ? "De 0 a 100.000." : null} />
          <CampoTexto id="ia-lim-min" rotulo="Minutos de transcrição por mês" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ""))}
            erro={campos.includes("limiteMinutos") ? "De 0 a 100.000." : null} />
        </div>
        <p className="t-apoio text-tinta-suave">Ao chegar no limite, a função para até o mês virar. O síndico vê o uso, em quantidade, em Ajuda da IA.</p>
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit"><Icone nome="check" />Salvar limite</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaChamadas({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const carga = useCarregar<{ chamadas: Chamada[] }>(`/v1/clientes/${id}/ia/chamadas`);
  return (
    <Dialogo aberto media titulo="Chamadas do mês" aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando as chamadas…" />
        : carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />
        : !carga.dados.chamadas.length ? <p className="t-apoio">Nenhuma chamada neste mês.</p> : (
          <ul className="grid divide-y divide-linha">
            {carga.dados.chamadas.map((c) => (
              <li key={c.id} className="grid gap-0.5 py-2.5 t-texto">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.funcao === "SUGERIR" ? "Sugestão" : "Transcrição"}{c.protocolo ? ` · pedido ${c.protocolo}` : ""}</span>
                  <Selo tom={c.resultado === "FALHA" ? "erro" : c.resultado === "OK" ? "ok" : "neutro"}>{RESULTADOS[c.resultado] ?? c.resultado}</Selo>
                </span>
                <span className="t-apoio text-tinta-suave">
                  {formatarDataHora(c.em)} · {c.modelo} · {c.funcao === "SUGERIR" ? `${c.tokensEntrada} + ${c.tokensSaida} tokens` : `${c.segundos} s de áudio`}
                </span>
              </li>
            ))}
          </ul>
        )}
    </Dialogo>
  );
}

/** O cartão. Quem não tem a permissão de ver o cartão não recebe nada (o banco recusa e o cartão some). */
export function CartaoIa({ condominioId, avisar }: { condominioId: string; avisar: (texto: string) => void }) {
  const carga = useCarregar<IaCliente>(`/v1/clientes/${condominioId}/ia`);
  const [janela, setJanela] = useState<"chave" | "limite" | "chamadas" | null>(null);
  if (carga.estado === "carregando") return null;
  if (carga.estado === "erro") {
    if (carga.erro?.codigo === "FORBIDDEN") return null;
    return <Cartao id="t-ia" titulo="IA e custo" icone="dinheiro"><ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></Cartao>;
  }
  const ia = carga.dados;
  const mes = mesDoUso(ia.renovaEm);
  const salvo = (texto: string) => { setJanela(null); avisar(texto); carga.recarregar(); };
  const chamadas = ia.sugerir.chamadas + ia.transcrever.chamadas;
  return (
    <Cartao id="t-ia" titulo="IA e custo" icone="dinheiro"
      acao={ia.pode.limite ? <AcaoCartao icone="editar" aoClicar={() => setJanela("limite")}>Editar limite</AcaoCartao> : undefined}>
      <span className="justify-self-start"><FaixaInterna>Interno · o cliente vê só o uso, sem valores</FaixaInterna></span>

      <div className="flex items-start gap-4 rounded-[14px] border border-linha p-4">
        <span className="grid flex-1 gap-1">
          <span id="ia-chave-rotulo" className="t-texto font-medium">{ia.ligada ? "IA ligada neste condomínio" : "IA desligada neste condomínio"}</span>
          <span className="t-apoio text-tinta-suave">
            {ia.ligada
              ? "Desligar para as duas funções na hora. O síndico vê o aviso em Configurações › Ajuda da IA e os pedidos seguem normais."
              : `${ia.motivo ? `Motivo: ${ia.motivo}. ` : ""}${ia.mudadaPor && ia.mudadaEm ? `${ia.mudadaPor} em ${formatarDataHora(ia.mudadaEm)}. ` : ""}Ligar volta a sugestão e a transcrição para os pedidos novos.`}
          </span>
          <span className="flex items-center gap-1.5 t-apoio text-tinta-suave"><Icone nome="cadeado" className="h-3.5 w-3.5" />
            Só a Administração muda. Para as outras funções da equipe, a chave aparece travada.</span>
        </span>
        <span className="interruptor !p-0">
          <input type="checkbox" role="switch" aria-labelledby="ia-chave-rotulo" checked={ia.ligada} disabled={!ia.pode.chave}
            onChange={() => setJanela("chave")} />
        </span>
      </div>

      <table className="w-full t-texto">
        <caption className="sr-only">Uso e custo da IA em {mes}</caption>
        <thead>
          <tr className="t-rotulo text-left text-tinta-suave">
            <th scope="col" className="pb-2 font-medium">Função</th>
            <th scope="col" className="pb-2 font-medium max-sm:hidden">Uso de {mes} e limite</th>
            <th scope="col" className="pb-2 text-right font-medium">Custo estimado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          <tr>
            <td className="py-3 pr-3 align-top">
              <span className="block">{FUNCOES_IA.SUGERIR}</span>
              <span className="t-apoio text-tinta-suave">{ia.sugerir.chamadas} chamadas · modelo pequeno</span>
              <span className="mt-2 grid gap-1.5 sm:hidden"><span><strong className="font-semibold">{ia.sugerir.usadas}</strong> de {ia.sugerir.limite} sugestões</span></span>
            </td>
            <td className="py-3 pr-3 align-top max-sm:hidden">
              <span className="grid gap-1.5"><span><strong className="font-semibold">{ia.sugerir.usadas}</strong> de {ia.sugerir.limite} sugestões</span>
                <BarraUso usado={ia.sugerir.usadas} limite={ia.sugerir.limite} rotulo="Sugestões usadas no mês" /></span>
            </td>
            <td className="py-3 text-right align-top t-codigo">{reais(ia.reais.sugerirCentavos)}</td>
          </tr>
          <tr>
            <td className="py-3 pr-3 align-top">
              <span className="block">{FUNCOES_IA.TRANSCREVER}</span>
              <span className="t-apoio text-tinta-suave">{ia.provedorTranscricao === "NENHUM" ? "sem serviço de transcrição contratado" : `${ia.transcrever.audios} áudios · serviço de transcrição`}</span>
              <span className="mt-2 grid sm:hidden"><span><strong className="font-semibold">{ia.transcrever.minutos} min</strong> de {ia.transcrever.limite} min</span></span>
            </td>
            <td className="py-3 pr-3 align-top max-sm:hidden">
              <span className="grid gap-1.5"><span><strong className="font-semibold">{ia.transcrever.minutos} min</strong> de {ia.transcrever.limite} min</span>
                <BarraUso usado={ia.transcrever.minutos} limite={ia.transcrever.limite} rotulo="Minutos de transcrição usados no mês" /></span>
            </td>
            <td className="py-3 text-right align-top t-codigo">{reais(ia.reais.transcreverCentavos)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[14px] border border-linha bg-fundo p-4">
        <span className="grid gap-0.5">
          <span className="t-apoio text-tinta-suave">Total de {mes} até agora</span>
          <span className="t-titulo-ficha">{reais(ia.reais.totalCentavos)}</span>
        </span>
        <span className="grid gap-0.5 text-right t-apoio text-tinta-suave max-sm:text-left">
          <span>Se usar todo o limite: cerca de {reais(ia.reais.noLimiteCentavos)} no mês</span>
          <span>Renova em {diaDeRenovar(ia.renovaEm)} · nada passa do limite</span>
        </span>
      </div>
      <p className="t-apoio text-tinta-suave">
        Estimativa com a tabela de preços do provedor de {dataBr(ia.reais.tabelaDe)} e o dólar a {reais(ia.reais.dolarCentavos)}. Cada chamada fica registrada com função,
        modelo, tamanho e custo; o valor real do mês substitui a estimativa.
      </p>
      {ia.sugerir.falhas + ia.transcrever.falhas ? (
        <Aviso tom="atencao">{ia.sugerir.falhas + ia.transcrever.falhas} chamadas falharam neste mês. Falha não conta no limite.</Aviso>
      ) : null}
      <div className="border-t border-linha pt-3">
        <Botao variante="discreto" tamanho="m" className="!px-0" onClick={() => setJanela("chamadas")}>
          Ver as {chamadas} chamadas do mês<Icone nome="dir" className="h-4 w-4" />
        </Botao>
      </div>

      {janela === "chave" ? <JanelaChave ia={ia} id={condominioId} aoFechar={() => setJanela(null)} salvo={salvo} /> : null}
      {janela === "limite" ? <JanelaLimite ia={ia} id={condominioId} aoFechar={() => setJanela(null)} salvo={salvo} /> : null}
      {janela === "chamadas" ? <JanelaChamadas id={condominioId} aoFechar={() => setJanela(null)} /> : null}
    </Cartao>
  );
}
