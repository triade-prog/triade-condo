"use client";
// Acesso excepcional da TRÍADE no Início (peça R4; PI-11): o síndico aprova ou recusa o pedido
// de ver dados do condomínio e encerra o que está valendo quando quiser. Sem aprovação, a
// TRÍADE não vê nada fora da ficha.

import { useState } from "react";
import { descreverAcessoExcepcional, formatarDataHora, FUNCOES_CONSOLE, type AreaExcepcional } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoTexto, chamarApi, Dialogo, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";

export interface PedidoAcessoExcepcional {
  id: string;
  pedidoPor: string;
  funcoes?: string[];
  motivo: string;
  areas: AreaExcepcional[];
  horas: number;
  situacao: string;
  validoAte?: string;
  leituras: number;
  criadoEm: string;
}

function Valendo({ aoMudar }: { aoMudar: () => void }) {
  const carga = useCarregar<{ acessos: PedidoAcessoExcepcional[] }>("/v1/condominio/acessos-excepcionais");
  const [erro, setErro] = useState<ErroApi | null>(null);
  if (carga.estado !== "pronto") return null;
  const valendo = carga.dados.acessos.filter((a) => a.situacao === "APROVADO");
  async function encerrar(id: string) {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/acessos-excepcionais/${id}/encerrar`, { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
    aoMudar();
  }
  return (
    <ul className="grid gap-2">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {valendo.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha p-3 text-sm">
          <span>
            <b className="font-semibold">{a.pedidoPor}</b> vê {descreverAcessoExcepcional(a.areas, a.horas).replace(/ por .*/, "")} até {formatarDataHora(a.validoAte ?? "")}
            <span className="block text-xs text-tinta-suave">{a.leituras === 1 ? "1 abertura registrada" : `${a.leituras} aberturas registradas`}</span>
          </span>
          <Botao variante="contorno" tamanho="m" onClick={() => void encerrar(a.id)}>Encerrar agora</Botao>
        </li>
      ))}
    </ul>
  );
}

export function CartaoAcessoExcepcional({ pedidos, valendo }: { pedidos: PedidoAcessoExcepcional[]; valendo: number }) {
  const { atualizar } = usePlataforma();
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recusando, setRecusando] = useState<PedidoAcessoExcepcional | null>(null);
  const [motivo, setMotivo] = useState("");

  async function decidir(id: string, aprovar: boolean) {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/acessos-excepcionais/${id}/decidir`, { corpo: { aprovar, motivo: aprovar ? null : motivo } });
    if (!r.ok) return setErro(r.erro);
    setRecusando(null);
    setMotivo("");
    atualizar();
  }

  return (
    <section aria-labelledby="t-excepcional" className="grid content-start gap-3 rounded-[18px] border border-atencao-borda bg-superficie p-5 shadow-s1 lg:col-span-2">
      <h2 id="t-excepcional" className="text-lg font-medium">{pedidos.length ? "A TRÍADE pediu para ver dados do condomínio" : "Acesso da TRÍADE valendo"}</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {pedidos.map((p) => (
        <div key={p.id} className="grid gap-2 rounded-xl border border-linha p-4">
          <p>
            <b className="font-semibold">{p.pedidoPor}</b>
            {p.funcoes?.length ? ` (${p.funcoes.map((f) => FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE]?.toLowerCase() ?? f).join(", ")} TRÍADE)` : ""} quer ver {descreverAcessoExcepcional(p.areas, p.horas)}
          </p>
          <p className="text-sm">&ldquo;{p.motivo}&rdquo;</p>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => void decidir(p.id, true)} aria-label={`Aprovar o pedido de ${p.pedidoPor}`}>Aprovar</Botao>
            <Botao variante="contorno" onClick={() => setRecusando(p)} aria-label={`Recusar o pedido de ${p.pedidoPor}`}>Recusar</Botao>
          </div>
        </div>
      ))}
      {valendo ? <Valendo aoMudar={atualizar} /> : null}
      <p className="text-xs text-tinta-suave">Só leitura. Tudo o que for aberto fica no histórico. Dá para encerrar antes do prazo. A aprovação vale só para a pessoa que pediu e acaba sozinha no prazo.</p>
      <Dialogo aberto={!!recusando} titulo="Recusar o acesso" aoFechar={() => setRecusando(null)}>
        <div className="grid gap-4">
          <Aviso tom="info">A TRÍADE fica sabendo do motivo.</Aviso>
          <CampoTexto id="ae-recusa" rotulo="Motivo" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setRecusando(null)}>Voltar</Botao>
            <Botao disabled={motivo.trim().length < 3} onClick={() => recusando && void decidir(recusando.id, false)}>Recusar</Botao>
          </div>
        </div>
      </Dialogo>
    </section>
  );
}
