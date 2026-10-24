"use client";
// Modelos do Comercial (quadro 343, CM-11, CM-25 e CM-26): as mensagens prontas de cada etapa, as
// cadências e a chance de fechar e o limite de dias parado de cada etapa. Quem tem só o ver lê;
// quem edita muda. A cadência em uso continua para quem já está nela.

import { useState, type FormEvent } from "react";
import { CANAIS_CADENCIA, ETAPAS_ABERTAS, ETAPAS_COMERCIAL, ORIGENS_COMERCIAL, type EtapaComercial } from "@triade/domain";
import { Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Interruptor, Selo, Vazio, type ErroApi } from "@triade/ui";
import { AbasLista, CabecaPagina, Cartao, plural, Voltar } from "../comum.tsx";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { nomeCanal, nomeEtapa, ROTAS_COMERCIAL } from "./comum.tsx";
import type { CadenciaModelo, EtapaParametro, MensagemModelo, ModelosComercial, PassoCadencia } from "./tipos.ts";

type Aba = "mensagens" | "cadencias" | "etapas";
const OPCOES_ETAPA = Object.entries(ETAPAS_COMERCIAL).map(([valor, texto]) => ({ valor, texto }));

function JanelaMensagem({ m, aoFechar, feito }: { m: Partial<MensagemModelo>; aoFechar: () => void; feito: () => void }) {
  const [etapa, setEtapa] = useState<string>(m.etapa ?? "NOVO");
  const [titulo, setTitulo] = useState(m.titulo ?? "");
  const [texto, setTexto] = useState(m.texto ?? "");
  const [ativa, setAtiva] = useState(m.ativa ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.mensagem(m.id), { metodo: m.id ? "PUT" : "POST", corpo: { versao: m.versao ?? null, etapa, titulo, texto, ativa } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={m.id ? "Editar mensagem pronta" : "Nova mensagem pronta"} aoFechar={aoFechar} media
      apoio="[nome] vira o primeiro nome da pessoa e [condominio], o nome do condomínio.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="msg-etapa" rotulo="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)} opcoes={OPCOES_ETAPA} />
        <CampoTexto id="msg-titulo" rotulo="Título" maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={campos.includes("titulo") ? "Título com 3 letras ou mais." : undefined} />
        <CampoAreaTexto id="msg-texto" rotulo="Texto" maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)}
          erro={campos.includes("texto") ? "Texto com 10 letras ou mais." : undefined} />
        <Interruptor id="msg-ativa" rotulo="Aparece na ficha" marcado={ativa} aoMudar={setAtiva} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a mensagem" />
      </form>
    </Dialogo>
  );
}

function JanelaCadencia({ c, aoFechar, feito }: { c: Partial<CadenciaModelo>; aoFechar: () => void; feito: () => void }) {
  const [nome, setNome] = useState(c.nome ?? "");
  const [gatilho, setGatilho] = useState<string>(c.gatilho ?? "NOVO");
  const [origem, setOrigem] = useState<string>(c.origem ?? "");
  const [passos, setPassos] = useState<PassoCadencia[]>(c.passos ?? [{ dia: 0, canal: "WHATSAPP", texto: "" }]);
  const [termina, setTermina] = useState(c.terminaSemResposta ?? false);
  const [ativa, setAtiva] = useState(c.ativa ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const mudaPasso = (n: number, p: Partial<PassoCadencia>) => setPassos((v) => v.map((x, k) => (k === n ? { ...x, ...p } : x)));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.cadenciaModelo(c.id), {
      metodo: c.id ? "PUT" : "POST",
      corpo: { versao: c.versao ?? null, nome, gatilho, origem: origem || null, passos, terminaSemResposta: termina, ativa },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={c.id ? `Editar ${c.nome}` : "Nova cadência"} aoFechar={aoFechar} larga
      apoio="Os passos aparecem como tarefa no dia certo. Nada sai sozinho e a cadência para quando a pessoa responde.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-3">
          <CampoTexto id="cad-nome" rotulo="Nome" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} erro={campos.includes("nome") ? "Nome com 3 letras ou mais." : undefined} />
          <CampoSelecao id="cad-gatilho" rotulo="Começa ao entrar em" value={gatilho} onChange={(e) => setGatilho(e.target.value)}
            opcoes={ETAPAS_ABERTAS.map((e) => ({ valor: e, texto: nomeEtapa(e) }))} />
          <CampoSelecao id="cad-origem" rotulo="Só para a origem" opcional value={origem} onChange={(e) => setOrigem(e.target.value)}
            opcoes={[{ valor: "", texto: "Qualquer origem" }, ...Object.entries(ORIGENS_COMERCIAL).map(([valor, texto]) => ({ valor, texto }))]} />
        </div>
        <fieldset className="grid gap-3">
          <legend className="t-titulo-cartao">Passos</legend>
          {passos.map((p, n) => (
            <div key={n} className="grid items-end gap-3 md:grid-cols-[96px_160px_minmax(0,1fr)_auto]">
              <CampoTexto id={`cad-dia-${n}`} rotulo="Dia" inputMode="numeric" maxLength={2} value={String(p.dia)}
                onChange={(e) => mudaPasso(n, { dia: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              <CampoSelecao id={`cad-canal-${n}`} rotulo="Canal" value={p.canal} onChange={(e) => mudaPasso(n, { canal: e.target.value as PassoCadencia["canal"] })}
                opcoes={Object.entries(CANAIS_CADENCIA).map(([valor, texto]) => ({ valor, texto }))} />
              <CampoTexto id={`cad-texto-${n}`} rotulo="O que fazer" maxLength={1000} value={p.texto} onChange={(e) => mudaPasso(n, { texto: e.target.value })} />
              <Botao variante="discreto" disabled={passos.length === 1} onClick={() => setPassos((v) => v.filter((_, k) => k !== n))} aria-label={`Tirar o passo ${n + 1}`}>
                <Icone nome="fechar" />Tirar
              </Botao>
            </div>
          ))}
          {passos.length < 10 ? (
            <Botao variante="contorno" className="justify-self-start"
              onClick={() => setPassos((v) => [...v, { dia: (v.at(-1)?.dia ?? 0) + 2, canal: "WHATSAPP", texto: "" }])}><Icone nome="mais" />Passo</Botao>
          ) : null}
          {campos.includes("passos") ? <span className="t-apoio text-erro">Confira os passos: os dias vão em ordem crescente e cada passo diz o que fazer.</span> : null}
        </fieldset>
        <Interruptor id="cad-termina" rotulo="Sem resposta no fim, vai para Sem resposta" marcado={termina} aoMudar={setTermina} />
        <Interruptor id="cad-ativa" rotulo="Ativa" ajuda="Só uma cadência ativa por etapa e origem." marcado={ativa} aoMudar={setAtiva} />
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a cadência" />
      </form>
    </Dialogo>
  );
}

function JanelaEtapa({ e, aoFechar, feito }: { e: EtapaParametro; aoFechar: () => void; feito: () => void }) {
  const [prob, setProb] = useState(String(e.probabilidade));
  const [limite, setLimite] = useState(e.limiteDias ? String(e.limiteDias) : "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_COMERCIAL.etapaParametros(e.etapa), {
      metodo: "PUT", corpo: { versao: e.versao, probabilidade: Number(prob), limiteDias: limite.trim() ? Number(limite) : null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={nomeEtapa(e.etapa)} aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoTexto id="etapa-prob" rotulo="Chance de fechar (%)" inputMode="numeric" maxLength={3} value={prob} onChange={(ev) => setProb(ev.target.value)}
          erro={campos.includes("probabilidade") ? "De 0 a 100." : undefined} />
        {e.aberta ? (
          <CampoTexto id="etapa-limite" rotulo="Parado há mais de (dias)" opcional inputMode="numeric" maxLength={3} value={limite} onChange={(ev) => setLimite(ev.target.value)}
            ajuda="Passou disso sem conversa, o interessado ganha o selo Parado." erro={campos.includes("limiteDias") ? "De 1 a 365 dias." : undefined} />
        ) : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a etapa" />
      </form>
    </Dialogo>
  );
}

export function ModelosComercial() {
  const carga = useCarregar<ModelosComercial>(ROTAS_COMERCIAL.modelos);
  const [aba, setAba] = useState<Aba>("mensagens");
  const [mensagem, setMensagem] = useState<Partial<MensagemModelo> | null>(null);
  const [cadencia, setCadencia] = useState<Partial<CadenciaModelo> | null>(null);
  const [etapa, setEtapa] = useState<EtapaParametro | null>(null);
  const d = carga.estado === "pronto" ? carga.dados : null;
  const pronto = () => { setMensagem(null); setCadencia(null); setEtapa(null); carga.recarregar(); };

  return (
    <div className="grid gap-5">
      <Voltar href="/comercial" texto="Voltar aos interessados" />
      <CabecaPagina titulo="Modelos do Comercial" apoio="Mensagens prontas, cadências e as etapas do funil. Mudar aqui vale para os próximos interessados." />
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <>
          <AbasLista rotulo="Partes dos modelos" atual={aba} aoMudar={setAba} abas={[
            { valor: "mensagens", texto: "Mensagens", n: d.mensagens.length },
            { valor: "cadencias", texto: "Cadências", n: d.cadencias.length },
            { valor: "etapas", texto: "Etapas", n: d.etapas.length },
          ]} />
          {aba === "mensagens" ? (
            <div className="grid gap-4">
              {d.podeEditar ? <Botao className="justify-self-start" onClick={() => setMensagem({})}><Icone nome="mais" />Nova mensagem</Botao> : null}
              {d.mensagens.length === 0 ? <Vazio titulo="Nenhuma mensagem pronta" icone="whats">Crie a primeira para usar na ficha.</Vazio> : null}
              {(Object.keys(ETAPAS_COMERCIAL) as EtapaComercial[]).filter((e) => d.mensagens.some((m) => m.etapa === e)).map((e) => (
                <Cartao key={e} id={`msg-${e}`} titulo={nomeEtapa(e)} icone="whats">
                  <ul className="grid gap-3">
                    {d.mensagens.filter((m) => m.etapa === e).map((m) => (
                      <li key={m.id} className="grid gap-1.5 rounded-[14px] border border-linha p-3">
                        <span className="flex flex-wrap items-center gap-2 font-medium">{m.titulo}{m.ativa ? null : <Selo tom="neutro">Desligada</Selo>}</span>
                        <span className="t-apoio whitespace-pre-wrap">{m.texto}</span>
                        {d.podeEditar ? <Botao variante="discreto" className="justify-self-start" onClick={() => setMensagem(m)}><Icone nome="editar" />Editar</Botao> : null}
                      </li>
                    ))}
                  </ul>
                </Cartao>
              ))}
            </div>
          ) : null}
          {aba === "cadencias" ? (
            <div className="grid gap-4">
              {d.podeEditar ? <Botao className="justify-self-start" onClick={() => setCadencia({})}><Icone nome="mais" />Nova cadência</Botao> : null}
              {d.cadencias.map((c) => (
                <Cartao key={c.id} id={`cad-${c.id}`} titulo={c.nome} icone="relogio"
                  acao={d.podeEditar ? <Botao variante="discreto" onClick={() => setCadencia(c)}><Icone nome="editar" />Editar</Botao> : undefined}>
                  <p className="flex flex-wrap items-center gap-2 t-apoio">
                    {c.ativa ? <Selo tom="ok">Ativa</Selo> : <Selo tom="neutro">Desligada</Selo>}
                    <span>{`Começa ao entrar em ${nomeEtapa(c.gatilho)}${c.origem ? `, origem ${ORIGENS_COMERCIAL[c.origem]}` : ""}`}</span>
                    {c.emUso ? <span>{`· em uso por ${plural(c.emUso, "interessado", "interessados")}`}</span> : null}
                  </p>
                  <ol className="grid gap-1.5">
                    {c.passos.map((p, n) => (
                      <li key={n} className="flex gap-2 t-texto"><span className="t-codigo">{`dia ${p.dia}`}</span><span>{`${nomeCanal(p.canal)}: ${p.texto}`}</span></li>
                    ))}
                  </ol>
                  {c.terminaSemResposta ? <p className="t-apoio">Sem resposta no fim, vai para Sem resposta.</p> : null}
                </Cartao>
              ))}
            </div>
          ) : null}
          {aba === "etapas" ? (
            <Cartao id="model-1" titulo="Etapas do funil" icone="camadas">
              <ul className="divide-y divide-linha">
                {d.etapas.map((e) => (
                  <li key={e.etapa} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-medium">{nomeEtapa(e.etapa)}</span>
                      <span className="t-apoio">{`Chance de fechar: ${e.probabilidade}%${e.aberta ? ` · parado depois de ${e.limiteDias ? plural(e.limiteDias, "dia", "dias") : "não conta"}` : ""}`}</span>
                    </span>
                    {d.podeEditar ? <Botao variante="discreto" onClick={() => setEtapa(e)} aria-label={`Editar ${nomeEtapa(e.etapa)}`}><Icone nome="editar" />Editar</Botao> : null}
                  </li>
                ))}
              </ul>
              <p className="t-apoio">As etapas são fixas; muda só a chance de fechar e o limite de dias parado.</p>
            </Cartao>
          ) : null}
        </>
      ) : null}
      {mensagem ? <JanelaMensagem m={mensagem} aoFechar={() => setMensagem(null)} feito={pronto} /> : null}
      {cadencia ? <JanelaCadencia c={cadencia} aoFechar={() => setCadencia(null)} feito={pronto} /> : null}
      {etapa ? <JanelaEtapa e={etapa} aoFechar={() => setEtapa(null)} feito={pronto} /> : null}
    </div>
  );
}
