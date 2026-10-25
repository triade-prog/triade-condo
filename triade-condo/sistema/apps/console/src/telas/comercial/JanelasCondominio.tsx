"use client";
// Janelas do condomínio na ficha do interessado (CM-18, 0309; quadros 323 e 324): a assembleia
// ordinária (aviso de 60 a 30 dias antes, para entrar no orçamento), o fim do mandato do síndico e
// o fim da fidelidade do sistema atual; no Perdido, também o "voltar a falar em" e o síndico novo.
// "Já vi" tira o aviso daquela data; mudar a data na ficha abre uma janela nova. Registrar o
// síndico novo deixa uma nota nas conversas e, no Perdido ou Sem resposta, faz o interessado voltar
// a aparecer no Início.

import { useState, type FormEvent } from "react";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, camposComErro, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { Cartao, diaHora } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeLocal } from "./comum.tsx";
import { ROTAS_PAINEL, seloJanela, textoJanela, type JanelaCondominio, type JanelasFicha } from "./painel.ts";

function JanelaSindicoNovo({ j, condominio, aoFechar, feito }: { j: JanelasFicha; condominio: string; aoFechar: () => void; feito: (lembrar: boolean) => void }) {
  const [desde, setDesde] = useState(hojeLocal());
  const [mandatoAte, setMandatoAte] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const fechado = j.etapa === "PERDIDO" || j.etapa === "SEM_RESPOSTA";

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi<{ lembrar: boolean }>(ROTAS_PAINEL.sindicoNovo(j.id), { corpo: { versao: j.versao, desde: desde || null, mandatoAte: mandatoAte || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.lembrar);
  }

  return (
    <Dialogo aberto titulo="Síndico novo" aoFechar={aoFechar} media apoio={condominio}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <p className="t-texto">
          {fechado ? "O condomínio volta a aparecer no Início do Comercial até alguém tratar o aviso: é a hora de falar com quem chegou."
            : "Fica uma nota nas conversas e, se informar, o fim do mandato novo muda a janela do mandato."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="sindico-desde" rotulo="Desde quando" type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            erro={campos.includes("desde") ? "Use uma data de até um ano atrás e no máximo 90 dias à frente." : undefined} />
          <CampoTexto id="sindico-mandato" rotulo="Mandato novo até" opcional type="date" value={mandatoAte} onChange={(e) => setMandatoAte(e.target.value)}
            erro={campos.includes("mandatoAte") ? "O mandato acaba depois do começo." : undefined} />
        </div>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar o síndico novo" icone="pessoa" />
      </form>
    </Dialogo>
  );
}

function LinhaJanela({ j, podeTratar, tratar, tratando }: { j: JanelaCondominio; podeTratar: boolean; tratar: () => void; tratando: boolean }) {
  const s = seloJanela(j);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-linha py-3 first:border-t-0">
      <span className="grid min-w-0 gap-0.5">
        <span className="t-texto [overflow-wrap:anywhere]">{textoJanela(j)}</span>
        {j.tratada && j.tratadaEm ? <span className="t-apoio">{`Visto ${diaHora(j.tratadaEm)}${j.tratadaPor ? ` por ${j.tratadaPor.nome}` : ""}`}</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Selo tom={s.tom}>{s.texto}</Selo>
        {podeTratar && j.pedeAtencao ? (
          <Botao variante="contorno" disabled={tratando} onClick={tratar} aria-label={`Já vi: ${textoJanela(j)}`}><Icone nome="check" />Já vi</Botao>
        ) : null}
      </span>
    </li>
  );
}

export function CartaoJanelas({ id, condominio, aoMudar }: { id: string; condominio: string; aoMudar: (texto: string) => void }) {
  const carga = useCarregar<JanelasFicha>(ROTAS_PAINEL.janelas(id));
  const [aberta, setAberta] = useState(false);
  const [tratando, setTratando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const j = carga.estado === "pronto" ? carga.dados : null;

  async function tratar(x: JanelaCondominio) {
    const chave = `${x.tipo}-${x.data}`;
    setErro(null);
    setTratando(chave);
    const r = await chamarApi(ROTAS_PAINEL.tratar(id), { corpo: { tipo: x.tipo, data: x.data } });
    setTratando(null);
    if (!r.ok) return setErro(textoDoErro(r.erro));
    carga.recarregar();
  }

  return (
    <Cartao id="ficha-janelas" titulo="Janelas do condomínio" icone="calendario"
      acao={j?.podeEditar ? <Botao variante="discreto" onClick={() => setAberta(true)}><Icone nome="pessoa" />Síndico novo</Botao> : undefined}>
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
      {j ? (
        <>
          {j.janelas.length ? (
            <ul className="grid">
              {j.janelas.map((x) => (
                <LinhaJanela key={`${x.tipo}-${x.data}`} j={x} podeTratar={j.podeEditar} tratando={tratando === `${x.tipo}-${x.data}`} tratar={() => void tratar(x)} />
              ))}
            </ul>
          ) : (
            <p className="t-apoio">Sem datas para avisar. Informe a assembleia ordinária, o fim do mandato e o fim da fidelidade do sistema atual em Editar a ficha.</p>
          )}
          {j.naoContatar ? <p className="t-apoio">Este contato pediu para não ser procurado: as janelas não pedem atenção.</p> : null}
          {j.sindicoNovo ? <p className="t-apoio">{`Síndico novo desde ${j.sindicoNovo.desde.split("-").reverse().join("/")}${j.sindicoNovo.registradoPor ? `, registrado por ${j.sindicoNovo.registradoPor.nome}` : ""}.`}</p> : null}
          <p className="t-apoio">
            {`O aviso da assembleia vai de ${j.dias.assembleiaDe} a ${j.dias.assembleiaAte} dias antes, para entrar no orçamento; o do mandato e o da fidelidade, ${j.dias.mandato} dias antes do fim.`}
          </p>
        </>
      ) : null}
      {j && aberta ? (
        <JanelaSindicoNovo j={j} condominio={condominio} aoFechar={() => setAberta(false)} feito={(lembrar) => {
          setAberta(false);
          carga.recarregar();
          aoMudar(lembrar ? "Síndico novo registrado. O condomínio volta a aparecer no Início até alguém tratar." : "Síndico novo registrado nas conversas.");
        }} />
      ) : null}
    </Cartao>
  );
}
