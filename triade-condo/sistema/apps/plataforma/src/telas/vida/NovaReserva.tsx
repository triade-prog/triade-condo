"use client";
// Nova reserva (decisão 1 do desenho "Vida em condomínio"): o síndico registra a reserva pedida
// por telefone. Segue a regra da área: confirma na hora quando é automática e espera aprovação
// quando o síndico aprova. Antes de salvar, a tela confere o dia (prazo, ocupação e limite).

import { useEffect, useState, type FormEvent } from "react";
import { PERIODOS_LIMITE, somarDias, textoLimite } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, textoDoErro,
  type ErroApi,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { AreaComumTela, ConferenciaReserva, OpcoesReserva } from "../tipos.ts";
import { diaCurto } from "./comum.tsx";

export function NovaReserva({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const opcoes = useCarregar<OpcoesReserva>("/v1/condominio/reservas/opcoes");
  return (
    <Dialogo aberto titulo="Nova reserva" aoFechar={aoFechar}>
      {opcoes.estado === "carregando" ? <Carregando rotulo="Carregando as áreas…" /> : null}
      {opcoes.estado === "erro" ? <ErroCarregar texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} /> : null}
      {opcoes.estado === "pronto" ? (
        opcoes.dados.areas.length
          ? <Form o={opcoes.dados} aoFechar={aoFechar} aoSalvar={aoSalvar} />
          : <Aviso tom="info" titulo="Nenhuma área aceita reserva">Ative as áreas do prédio em Configurações › Áreas comuns.</Aviso>
      ) : null}
    </Dialogo>
  );
}

function textoConferencia(c: ConferenciaReserva, a: AreaComumTela, data: string): { tom: "ok" | "atencao"; texto: string } {
  const erro = c.conferencia.erro;
  const proxima = c.proxima ? ` A próxima data possível é ${diaCurto(c.proxima)}.` : "";
  switch (erro) {
    case "FORA_DO_PRAZO":
      return { tom: "atencao", texto: `Fora da antecedência da área: de ${a.antecedenciaMin} a ${a.antecedenciaMax} dias.${proxima}` };
    case "HORARIO":
      return { tom: "atencao", texto: `Nenhum horário livre nesse dia.${proxima}` };
    case "OCUPADA":
      return { tom: "atencao", texto: `A área já está ocupada: ${c.conferencia.ocupacao?.titulo ?? "outro uso"}.${proxima}` };
    case "LIMITE":
      return {
        tom: "atencao",
        texto: `A unidade já tem ${c.noPeriodo ?? a.limiteQuantidade} ${c.noPeriodo === 1 ? "reserva" : "reservas"} ${a.limitePeriodo ? PERIODOS_LIMITE[a.limitePeriodo] : ""}, que é o limite.${proxima}`,
      };
    default: {
      const limite = a.limiteQuantidade && a.limitePeriodo && c.noPeriodo !== undefined
        ? ` ${textoLimite({ n: c.noPeriodo + 1, quantidade: a.limiteQuantidade, periodo: a.limitePeriodo }, data, !!c.conferencia.tolerancia)}.`
        : "";
      return { tom: "ok", texto: `Livre.${limite} ${a.reserva === "AUTOMATICA" ? "Confirma na hora." : "Fica esperando aprovação."}` };
    }
  }
}

function Form({ o, aoFechar, aoSalvar }: { o: OpcoesReserva; aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const [v, setV] = useState({ areaId: o.areas[0]!.id, unidadeId: "", contatoId: "", data: "", horaInicio: "", observacao: "" });
  const [conf, setConf] = useState<ConferenciaReserva | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const area = o.areas.find((a) => a.id === v.areaId)!;
  const unidade = o.unidades.find((u) => u.id === v.unidadeId);
  const mudar = (campo: keyof typeof v, valor: string) => setV((x) => ({ ...x, [campo]: valor }));

  useEffect(() => {
    if (!v.data) return;
    let vivo = true;
    const q = new URLSearchParams({ areaId: v.areaId, data: v.data, ...(v.unidadeId ? { unidadeId: v.unidadeId } : {}) });
    void chamarApi<ConferenciaReserva>(`/v1/condominio/reservas/conferir?${q}`).then((r) => {
      if (!vivo) return;
      setConf(r.ok ? r.dados : null);
      if (r.ok) setV((x) => ({ ...x, horaInicio: r.dados.blocos?.includes(x.horaInicio) ? x.horaInicio : (r.dados.blocos?.[0] ?? "") }));
    });
    return () => { vivo = false; };
  }, [v.areaId, v.unidadeId, v.data]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = {
      areaId: v.areaId, unidadeId: v.unidadeId, contatoId: v.contatoId || null, data: v.data,
      horaInicio: area.modo === "BLOCOS" ? v.horaInicio || null : null, observacao: v.observacao,
    };
    const r = await chamarApi<{ protocolo: string; estado: string }>("/v1/condominio/reservas", { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(r.dados.estado === "CONFIRMADA"
      ? `Reserva ${r.dados.protocolo} confirmada.${v.contatoId ? " O morador recebe a confirmação pelo WhatsApp." : ""}`
      : `Pedido de reserva ${r.dados.protocolo} registrado, esperando aprovação em A aprovar.`);
  }

  const aviso = conf && v.data ? textoConferencia(conf, area, v.data) : null;
  return (
    <form onSubmit={salvar} noValidate className="grid gap-3">
      <p className="text-sm text-tinta-suave">Para a reserva pedida por telefone ou no balcão. Segue a regra da área, como pelo WhatsApp.</p>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoSelecao id="nr-area" rotulo="Área" value={v.areaId} onChange={(e) => setV((x) => ({ ...x, areaId: e.target.value, horaInicio: "" }))}
        opcoes={o.areas.map((a) => ({ valor: a.id, texto: a.nome }))} erro={comErro.includes("areaId") ? "Escolha a área" : null} />
      <CampoSelecao id="nr-unidade" rotulo="Unidade" value={v.unidadeId} onChange={(e) => setV((x) => ({ ...x, unidadeId: e.target.value, contatoId: "" }))}
        opcoes={[{ valor: "", texto: "Escolha a unidade" }, ...o.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]}
        erro={comErro.includes("unidadeId") ? "Escolha a unidade" : null} />
      {unidade ? (
        <CampoSelecao id="nr-contato" rotulo="Quem pediu" opcional value={v.contatoId} onChange={(e) => mudar("contatoId", e.target.value)}
          opcoes={[{ valor: "", texto: "Não informar" }, ...unidade.contatos.map((c) => ({ valor: c.id, texto: c.nome }))]}
          ajuda={unidade.contatos.length ? "Com quem pediu, a confirmação vai pelo WhatsApp." : "A unidade não tem morador com vínculo confirmado."}
          erro={comErro.includes("contatoId") ? "Quem pediu precisa ter vínculo confirmado com a unidade" : null} />
      ) : null}
      <CampoTexto id="nr-data" rotulo="Dia" type="date" value={v.data} onChange={(e) => mudar("data", e.target.value)}
        min={somarDias(o.hoje, area.antecedenciaMin)} max={somarDias(o.hoje, area.antecedenciaMax)}
        ajuda={`De ${diaCurto(somarDias(o.hoje, area.antecedenciaMin))} a ${diaCurto(somarDias(o.hoje, area.antecedenciaMax))}.`}
        erro={comErro.includes("data") ? "Escolha o dia" : null} />
      {area.modo === "BLOCOS" && conf?.blocos?.length ? (
        <CampoSelecao id="nr-hora" rotulo="Horário" value={v.horaInicio} onChange={(e) => mudar("horaInicio", e.target.value)}
          opcoes={conf.blocos.map((b) => ({ valor: b, texto: b }))} ajuda="Só os blocos livres desse dia." />
      ) : null}
      {aviso ? <Aviso tom={aviso.tom}>{aviso.texto}</Aviso> : null}
      <CampoAreaTexto id="nr-obs" rotulo="Observação" opcional maxLength={300} value={v.observacao} onChange={(e) => mudar("observacao", e.target.value)}
        ajuda="Por exemplo: aniversário, 60 pessoas." />
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando || !v.unidadeId || !v.data || aviso?.tom === "atencao"}>Registrar reserva</Botao>
      </div>
    </form>
  );
}
