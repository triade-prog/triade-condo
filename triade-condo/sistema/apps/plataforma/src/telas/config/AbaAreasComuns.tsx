"use client";
// Configurações › Áreas comuns (peça R12, design "Vida em condomínio", tela 1; AC-07, AC-06): os
// tipos mais comuns já vêm prontos, com regras sugeridas e inativos. O síndico ajusta, ativa as que
// o prédio tem e cria outras pelo botão Nova área, com os mesmos campos. Área inativa não aparece
// para ninguém. O nome da área também é o "Qual área" da Agenda e o local das etiquetas.

import { useState, type FormEvent } from "react";
import { BLOCOS_MINUTOS, CONFIRMACOES_AREA, descreverArea, duracaoBloco, MODOS_AREA, PERIODOS_LIMITE, reais } from "@triade/domain";
import {
  AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi,
} from "@triade/ui";
import { esquecerLocais } from "../Locais.tsx";
import { useCarregar } from "../sessao.tsx";
import type { AreaComumTela, AreasComuns } from "../tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";

const NOVA: Omit<AreaComumTela, "id" | "versao"> = {
  criadaPeloSindico: true, nome: "", ativa: false, reserva: "SINDICO", antecedenciaMin: 1, antecedenciaMax: 30, horaInicio: "08:00", horaFim: "22:00",
  modo: "PERIODO", cancelarSemAvisoDias: 3, podeProprietarioMorador: true, podeInquilino: true, podeProprietarioAusente: false,
};

export function AbaAreasComuns({ salvo }: PropsAba) {
  const carga = useCarregar<AreasComuns>("/v1/condominio/areas-comuns");
  const [aberta, setAberta] = useState<AreaComumTela | "nova" | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as áreas comuns…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const prontas = l.areas.filter((a) => !a.criadaPeloSindico).length;
  const criadas = l.areas.length - prontas;
  const ativas = l.areas.filter((a) => a.ativa).length;
  const aposSalvar = (texto: string) => { setAberta(null); esquecerLocais(); carga.recarregar(); salvo(texto); };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          {prontas} {prontas === 1 ? "área pronta" : "áreas prontas"}
          {criadas ? ` e ${criadas} ${criadas === 1 ? "criada" : "criadas"} pelo síndico` : ""}, {ativas} {ativas === 1 ? "ativa" : "ativas"}.
          {" "}Crie as que o prédio tem e não estão na lista.
        </p>
        {l.pode.editar ? <Botao onClick={() => setAberta("nova")}><Icone nome="mais" />Nova área</Botao> : null}
      </div>
      {l.areas.length === 0 ? (
        <Vazio titulo="Nenhuma área comum">Crie as áreas do prédio pelo botão Nova área.</Vazio>
      ) : (
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
          {l.areas.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <button type="button" className="min-h-6 text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => setAberta(a)}>{a.nome}</button>
                <span className="text-[13px] text-tinta-suave">{descreverArea(a)}</span>
              </span>
              {a.ativa ? <Selo tom="ok">Ativa</Selo> : <Selo tom="neutro">Inativa</Selo>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">Só pessoas com vínculo confirmado em Moradores e unidades reservam. O valor de uso só aparece; a cobrança entra com o Dinheiro do prédio.</p>
      {aberta ? (
        <FormArea area={aberta === "nova" ? null : aberta} documentos={l.documentos} pode={l.pode.editar}
          aoFechar={() => setAberta(null)} aoSalvar={aposSalvar} />
      ) : null}
    </div>
  );
}

const numero = (s: string) => (s.trim() === "" ? null : Number(s));
const centavos = (s: string) => {
  const t = s.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  return t === "" ? null : Math.round(Number(t) * 100);
};
const texto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function FormArea({ area, documentos, pode, aoFechar, aoSalvar }: {
  area: AreaComumTela | null; documentos: AreasComuns["documentos"]; pode: boolean; aoFechar: () => void; aoSalvar: (texto: string) => void;
}) {
  const a = area ?? NOVA;
  const [v, setV] = useState({
    nome: a.nome, reserva: a.reserva, antecedenciaMin: texto(a.antecedenciaMin), antecedenciaMax: texto(a.antecedenciaMax),
    horaInicio: a.horaInicio, horaFim: a.horaFim, modo: a.modo, blocoMinutos: texto(a.blocoMinutos), capacidade: texto(a.capacidade),
    limiteQuantidade: texto(a.limiteQuantidade), limitePeriodo: a.limitePeriodo ?? "MES", toleranciaDias: texto(a.toleranciaDias),
    cancelarSemAvisoDias: texto(a.cancelarSemAvisoDias), valor: a.valorCentavos ? reais(a.valorCentavos).replace("R$ ", "") : "",
    regrasDocumentoId: a.regras?.id ?? "", podeProprietarioMorador: a.podeProprietarioMorador, podeInquilino: a.podeInquilino,
    podeProprietarioAusente: a.podeProprietarioAusente,
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const err = (campo: string, msg: string) => (comErro.includes(campo) ? msg : null);
  const mudar = <K extends keyof typeof v>(campo: K, valor: (typeof v)[K]) => setV((x) => ({ ...x, [campo]: valor }));
  const semReserva = v.reserva === "SEM_RESERVA";

  async function salvar(ativa: boolean, ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setEnviando(true);
    const limite = numero(v.limiteQuantidade);
    const corpo = {
      ...(area ? { versao: area.versao } : {}),
      nome: v.nome, ativa, reserva: v.reserva,
      antecedenciaMin: numero(v.antecedenciaMin) ?? 0, antecedenciaMax: numero(v.antecedenciaMax) ?? 30,
      horaInicio: v.horaInicio, horaFim: v.horaFim, modo: v.modo,
      blocoMinutos: v.modo === "BLOCOS" ? numero(v.blocoMinutos) : null,
      capacidade: numero(v.capacidade), limiteQuantidade: limite, limitePeriodo: limite ? v.limitePeriodo : null,
      toleranciaDias: limite ? numero(v.toleranciaDias) : null, cancelarSemAvisoDias: numero(v.cancelarSemAvisoDias) ?? 3,
      valorCentavos: centavos(v.valor), regrasDocumentoId: v.regrasDocumentoId || null,
      podeProprietarioMorador: v.podeProprietarioMorador, podeInquilino: v.podeInquilino, podeProprietarioAusente: v.podeProprietarioAusente,
    };
    const r = area
      ? await chamarApi(`/v1/condominio/areas-comuns/${area.id}`, { metodo: "PUT", corpo })
      : await chamarApi("/v1/condominio/areas-comuns", { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const nome = v.nome.trim();
    aoSalvar(ativa ? `${nome} salva e ativa.` : area?.ativa ? `${nome} desativada. Ela não aparece mais para reservar.` : `${nome} salva, sem ativar.`);
  }

  const titulo = area ? area.nome : "Nova área";
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      <form onSubmit={(e) => void salvar(true, e)} noValidate className="grid gap-3">
        <p className="text-sm text-tinta-suave">
          {area && !area.criadaPeloSindico
            ? "Veio pronta com as regras sugeridas. Ajuste o que a convenção e o regimento do prédio dizem e ative."
            : "Uma área nova tem os mesmos campos das que vieram prontas."}
        </p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <fieldset disabled={!pode} className="grid gap-3 sm:grid-cols-2">
          <CampoTexto id="ar-nome" rotulo="Nome" className="sm:col-span-2" maxLength={60} required value={v.nome} onChange={(e) => mudar("nome", e.target.value)}
            erro={err("nome", "Escreva o nome, com 2 a 60 letras, diferente das outras áreas")} />
          <CampoSelecao id="ar-reserva" rotulo="Como a reserva é confirmada" className="sm:col-span-2" value={v.reserva}
            onChange={(e) => mudar("reserva", e.target.value as typeof v.reserva)}
            opcoes={Object.entries(CONFIRMACOES_AREA).map(([valor, t]) => ({ valor, texto: t }))}
            ajuda={v.reserva === "AUTOMATICA" ? "Confirma na hora se a data estiver livre." : v.reserva === "SINDICO" ? "Fica esperando você aprovar." : "Não se reserva: aparece só o horário de uso."} />
          <CampoTexto id="ar-hi" rotulo="Abre às" inputMode="numeric" maxLength={5} placeholder="10:00" value={v.horaInicio} onChange={(e) => mudar("horaInicio", e.target.value)}
            erro={err("horaInicio", "Use o formato 10:00")} />
          <CampoTexto id="ar-hf" rotulo="Fecha às" inputMode="numeric" maxLength={5} placeholder="23:00" value={v.horaFim} onChange={(e) => mudar("horaFim", e.target.value)}
            ajuda="Use 24:00 para meia-noite." erro={err("horaFim", "O fim vem depois do início, no formato 23:00")} />
          {semReserva ? null : (
            <>
              <CampoTexto id="ar-amin" rotulo="Antecedência mínima (dias)" type="number" min={0} max={365} value={v.antecedenciaMin}
                onChange={(e) => mudar("antecedenciaMin", e.target.value)} ajuda="Nem em cima da hora." erro={err("antecedenciaMin", "De 0 a 365 dias")} />
              <CampoTexto id="ar-amax" rotulo="Antecedência máxima (dias)" type="number" min={1} max={730} value={v.antecedenciaMax}
                onChange={(e) => mudar("antecedenciaMax", e.target.value)} ajuda="Nem para o ano que vem." erro={err("antecedenciaMax", "Maior que a mínima, até 730 dias")} />
              <CampoSelecao id="ar-modo" rotulo="Como se reserva" value={v.modo} onChange={(e) => mudar("modo", e.target.value as typeof v.modo)}
                opcoes={Object.entries(MODOS_AREA).map(([valor, t]) => ({ valor, texto: t }))} />
              {v.modo === "BLOCOS" ? (
                <CampoSelecao id="ar-bloco" rotulo="Tamanho do bloco" value={v.blocoMinutos} onChange={(e) => mudar("blocoMinutos", e.target.value)}
                  opcoes={[{ valor: "", texto: "Escolha" }, ...BLOCOS_MINUTOS.map((b) => ({ valor: String(b), texto: duracaoBloco(b) }))]}
                  erro={err("blocoMinutos", "Escolha o tamanho do bloco")} />
              ) : <span className="hidden sm:block" />}
              <CampoTexto id="ar-lim" rotulo="Limite por unidade" opcional type="number" min={1} max={31} value={v.limiteQuantidade}
                onChange={(e) => mudar("limiteQuantidade", e.target.value)} ajuda="Conta as reservas confirmadas e as que esperam aprovação."
                erro={err("limiteQuantidade", "De 1 a 31")} />
              <CampoSelecao id="ar-per" rotulo="Por" value={v.limitePeriodo} onChange={(e) => mudar("limitePeriodo", e.target.value as typeof v.limitePeriodo)}
                opcoes={Object.entries(PERIODOS_LIMITE).map(([valor, t]) => ({ valor, texto: t.replace("por ", "") }))} disabled={!v.limiteQuantidade} />
              <CampoTexto id="ar-tol" rotulo="Tolerância (dias antes)" opcional type="number" min={1} max={60} value={v.toleranciaDias}
                onChange={(e) => mudar("toleranciaDias", e.target.value)} disabled={!v.limiteQuantidade}
                ajuda="Mais uma reserva, se a data ainda estiver livre tantos dias antes." erro={err("toleranciaDias", "A tolerância vale com limite, de 1 a 60 dias")} />
              <CampoTexto id="ar-canc" rotulo="Cancelar sem aviso ao síndico até (dias antes)" type="number" min={0} max={60} value={v.cancelarSemAvisoDias}
                onChange={(e) => mudar("cancelarSemAvisoDias", e.target.value)} ajuda="Depois disso o cancelamento chega para quem cuida." />
            </>
          )}
          <CampoTexto id="ar-cap" rotulo="Capacidade (pessoas)" opcional type="number" min={1} max={2000} value={v.capacidade}
            onChange={(e) => mudar("capacidade", e.target.value)} erro={err("capacidade", "De 1 a 2000")} />
          {semReserva ? null : (
            <CampoTexto id="ar-valor" rotulo="Valor de uso (R$)" opcional inputMode="decimal" placeholder="150,00" value={v.valor}
              onChange={(e) => mudar("valor", e.target.value)} ajuda="Só aparece na reserva." erro={err("valorCentavos", "Valor inválido")} />
          )}
          <CampoSelecao id="ar-regras" rotulo="Regras de uso" opcional className="sm:col-span-2" value={v.regrasDocumentoId}
            onChange={(e) => mudar("regrasDocumentoId", e.target.value)}
            opcoes={[{ valor: "", texto: "Nenhum documento" }, ...(area?.regras && !documentos.some((d) => d.id === area.regras!.id) ? [{ valor: area.regras.id, texto: area.regras.titulo }] : []),
              ...documentos.map((d) => ({ valor: d.id, texto: d.titulo }))]}
            ajuda="Documento de Comunicados e documentos; o link vai junto na confirmação." />
          {semReserva ? null : (
            <fieldset className="grid gap-1.5 sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Quem pode reservar</legend>
              {([["podeProprietarioMorador", "Proprietário que mora"], ["podeInquilino", "Inquilino"], ["podeProprietarioAusente", "Proprietário que não mora"]] as const).map(([k, t]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={v[k]} onChange={(e) => mudar(k, e.target.checked)} />{t}
                </label>
              ))}
              {comErro.includes("podeProprietarioMorador") ? <span className="text-sm text-erro">Escolha quem pode reservar.</span> : null}
              <span className="text-xs text-tinta-suave">Só pessoas com vínculo confirmado em Moradores e unidades.</span>
            </fieldset>
          )}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>{pode ? "Cancelar" : "Fechar"}</Botao>
          {pode ? (
            <>
              <Botao variante="contorno" disabled={enviando} onClick={() => void salvar(false)}>{area?.ativa ? "Desativar" : "Salvar sem ativar"}</Botao>
              <Botao type="submit" disabled={enviando}>{area?.ativa ? "Salvar" : "Salvar e ativar"}</Botao>
            </>
          ) : null}
        </div>
      </form>
    </Dialogo>
  );
}
