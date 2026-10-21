"use client";
// Vida em condomínio › Assembleias (design "Vida em condomínio", tela 6; AC-02): a lista, a
// assembleia nova com a pauta (cada item com o seu quórum), as regras da convenção (antecedência e
// peso do voto) e a fração ideal de cada unidade, que o voto pela fração pede antes de convocar.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ESTADOS_ASSEMBLEIA, FORMAS_ASSEMBLEIA, formatarDataHora, PESOS_ASSEMBLEIA, QUORUNS, TIPOS_ASSEMBLEIA, TIPOS_ITEM,
  type EstadoAssembleia, type FormaAssembleia, type PesoAssembleia, type Quorum, type TipoAssembleia, type TipoItem,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio,
  type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { AssembleiaTela, Fracoes, ListaAssembleias } from "../tipos.ts";

const TOM_ESTADO: Record<EstadoAssembleia, Tom> = { RASCUNHO: "neutro", CONVOCADA: "info", EM_ANDAMENTO: "andamento", ENCERRADA: "ok", CANCELADA: "neutro" };

export function SeloAssembleia({ estado }: { estado: EstadoAssembleia }) {
  return <Selo tom={TOM_ESTADO[estado]}>{ESTADOS_ASSEMBLEIA[estado]}</Selo>;
}

/** "Ordinária · híbrida". */
export function tipoEForma(a: { tipo: TipoAssembleia; forma: FormaAssembleia }): string {
  return `${TIPOS_ASSEMBLEIA[a.tipo]} · ${FORMAS_ASSEMBLEIA[a.forma].toLowerCase()}`;
}

type Dialogos = "regras" | "fracoes" | null;

export function AbaAssembleias({ aoMudar }: { aoMudar: (texto: string) => void }) {
  const carga = useCarregar<ListaAssembleias>("/v1/condominio/assembleias");
  const [dialogo, setDialogo] = useState<Dialogos>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as assembleias…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const fechar = (texto?: string) => { setDialogo(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid gap-4">
      <section aria-labelledby="as-regras" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1">
        <h2 id="as-regras" className="font-medium">Regras da convenção</h2>
        <p>
          Convocação com {l.regras.antecedencia} dias de antecedência · {PESOS_ASSEMBLEIA[l.regras.peso].toLowerCase()} · votam o proprietário
          ou o procurador com procuração aceita.
        </p>
        {l.regras.peso === "FRACAO" && l.semFracao ? (
          <Aviso tom="atencao">
            {l.semFracao === 1 ? "1 unidade está" : `${l.semFracao} unidades estão`} sem fração ideal: preencha antes de convocar.
          </Aviso>
        ) : null}
        <span className="flex flex-wrap gap-2">
          {l.pode.configurar ? <Botao tamanho="m" variante="contorno" onClick={() => setDialogo("regras")}>Mudar as regras</Botao> : null}
          {l.pode.fracoes ? <Botao tamanho="m" variante="contorno" onClick={() => setDialogo("fracoes")}>Frações ideais</Botao> : null}
        </span>
      </section>
      {l.assembleias.length === 0 ? (
        <Vazio titulo="Nenhuma assembleia ainda">
          Monte a pauta e convoque: o edital vai como comunicado e cada unidade recebe um link para indicar procurador, registrar presença e votar.
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {l.assembleias.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/vida/assembleia?id=${a.id}`} className="font-medium hover:text-violeta-600 hover:underline">{a.titulo}</Link>
                  <SeloAssembleia estado={a.estado} />
                </span>
                <span className="text-sm text-tinta-suave">
                  {tipoEForma(a)} · 1ª chamada em {formatarDataHora(a.primeiraChamada)} · {a.itens === 1 ? "1 item" : `${a.itens} itens`} na pauta
                  {a.estado === "EM_ANDAMENTO" || a.estado === "ENCERRADA" ? ` · ${a.presentes} de ${a.unidades} unidades presentes` : ""}
                  {a.procuracoesPendentes ? ` · ${a.procuracoesPendentes === 1 ? "1 procuração" : `${a.procuracoesPendentes} procurações`} a conferir` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-tinta-suave">
        O quórum de cada item segue a convenção do prédio: confira antes de convocar. A videochamada é de um serviço de fora (Meet, Zoom ou Jitsi);
        o sistema cuida da presença, das procurações e dos votos.
      </p>
      {dialogo === "regras" ? <Regras regras={l.regras} aoFechar={fechar} /> : null}
      {dialogo === "fracoes" ? <FracoesIdeais aoFechar={fechar} /> : null}
    </div>
  );
}

function Regras({ regras, aoFechar }: { regras: ListaAssembleias["regras"]; aoFechar: (texto?: string) => void }) {
  const [antecedencia, setAntecedencia] = useState(String(regras.antecedencia));
  const [peso, setPeso] = useState<PesoAssembleia>(regras.peso);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/assembleias/regras", { metodo: "PUT", corpo: { versao: regras.versao, antecedencia: Number(antecedencia), peso } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar("Regras da convenção salvas. Valem para as próximas convocações.");
  }

  return (
    <Dialogo aberto titulo="Regras da convenção" aoFechar={() => aoFechar()}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="as-antecedencia" rotulo="Antecedência da convocação, em dias" type="number" min={1} max={60} inputMode="numeric"
          value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)}
          erro={comErro.includes("antecedencia") ? "De 1 a 60 dias" : null} ajuda="Quantos dias antes da 1ª chamada o edital precisa sair" />
        <CampoSelecao id="as-peso" rotulo="Peso do voto" value={peso} onChange={(e) => setPeso(e.target.value as PesoAssembleia)}
          opcoes={(Object.keys(PESOS_ASSEMBLEIA) as PesoAssembleia[]).map((v) => ({ valor: v, texto: PESOS_ASSEMBLEIA[v] }))}
          ajuda={peso === "FRACAO" ? "Cada unidade pesa a sua fração ideal: todas precisam da fração" : "Cada unidade vale um voto, qualquer que seja o tamanho"} />
        <p className="text-[13px] text-tinta-suave">Confira na convenção do prédio. A assembleia já convocada guarda as regras da época.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>Salvar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** "40" ou "2,5" para o campo; vazio quando a unidade não tem fração. */
const fracaoTexto = (f?: number) => (f === undefined || f === null ? "" : String(f).replace(".", ","));

function FracoesIdeais({ aoFechar }: { aoFechar: (texto?: string) => void }) {
  const carga = useCarregar<Fracoes>("/v1/condominio/fracoes");
  return (
    <Dialogo aberto titulo="Frações ideais" aoFechar={() => aoFechar()}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando as unidades…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <FormFracoes f={carga.dados} aoFechar={aoFechar} /> : null}
    </Dialogo>
  );
}

function FormFracoes({ f, aoFechar }: { f: Fracoes; aoFechar: (texto?: string) => void }) {
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(f.unidades.map((u) => [u.id, fracaoTexto(u.fracao)])));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const numero = (t: string) => (t.trim() === "" ? null : Number(t.trim().replace(",", ".")));
  const soma = f.unidades.reduce((s, u) => s + (numero(valores[u.id] ?? "") ?? 0), 0);
  const invalidas = f.unidades.filter((u) => { const n = numero(valores[u.id] ?? ""); return n !== null && (Number.isNaN(n) || n <= 0 || n > 100); });

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (invalidas.length) return;
    setErro(null);
    setEnviando(true);
    const mudadas = f.unidades.filter((u) => numero(valores[u.id] ?? "") !== (u.fracao ?? null))
      .map((u) => ({ unidadeId: u.id, fracao: numero(valores[u.id] ?? ""), versao: u.versao }));
    const r = await chamarApi<{ alteradas: number }>("/v1/condominio/fracoes", { metodo: "PUT", corpo: { fracoes: mudadas } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar(r.dados.alteradas ? `Frações salvas: ${r.dados.alteradas === 1 ? "1 unidade" : `${r.dados.alteradas} unidades`}.` : "Nenhuma fração mudou.");
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-3 text-sm">
      <p className="text-tinta-suave">Em porcentagem, como na convenção ou na matrícula. A soma de todas fica perto de 100%.</p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {f.unidades.length === 0 ? <p>Nenhuma unidade ativa.</p> : (
        <ul className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {f.unidades.map((u) => (
            <li key={u.id}>
              <CampoTexto id={`fr-${u.id}`} rotulo={u.nome} inputMode="decimal" value={valores[u.id] ?? ""} disabled={!f.pode.editar}
                onChange={(e) => setValores((v) => ({ ...v, [u.id]: e.target.value }))}
                erro={invalidas.some((x) => x.id === u.id) ? "Entre 0 e 100" : null} />
            </li>
          ))}
        </ul>
      )}
      <p className={Math.abs(soma - 100) > 0.01 ? "text-atencao" : "text-tinta-suave"}>Soma: {String(Math.round(soma * 1e6) / 1e6).replace(".", ",")}%</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
        {f.pode.editar ? <Botao type="submit" disabled={enviando}>Salvar as frações</Botao> : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------
// A assembleia nova (ou o rascunho).

interface ItemForm { titulo: string; descricao: string; tipo: TipoItem; opcoes: string[]; quorum: Quorum }
const itemVazio = (): ItemForm => ({ titulo: "", descricao: "", tipo: "APROVACAO", opcoes: ["", ""], quorum: "MAIORIA_PRESENTES" });

/** ISO para o campo "AAAA-MM-DDTHH:MM", no relógio de quem usa a tela. */
function paraCampo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const paraIso = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toISOString(); };

export function FormAssembleia({ a, aoFechar, aoSalvar }: { a?: AssembleiaTela; aoFechar: () => void; aoSalvar: (id: string, texto: string) => void }) {
  const [titulo, setTitulo] = useState(a?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoAssembleia>(a?.tipo ?? "ORDINARIA");
  const [forma, setForma] = useState<FormaAssembleia>(a?.forma ?? "PRESENCIAL");
  const [primeira, setPrimeira] = useState(paraCampo(a?.primeiraChamada));
  const [segunda, setSegunda] = useState(paraCampo(a?.segundaChamada));
  const [local, setLocal] = useState(a?.local ?? "");
  const [video, setVideo] = useState(a?.linkVideo ?? "");
  const [itens, setItens] = useState<ItemForm[]>(a?.itens.length
    ? a.itens.map((i) => ({ titulo: i.titulo, descricao: i.descricao ?? "", tipo: i.tipo, quorum: i.quorum,
                          opcoes: i.tipo === "ESCOLHA" ? i.opcoes.slice(0, -1) : ["", ""] }))
    : [itemVazio()]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const detalhe = (erro?.detalhes?.campos as string[] | undefined) ?? [];

  const mudarItem = (n: number, x: Partial<ItemForm>) => setItens((xs) => xs.map((i, j) => (j === n ? { ...i, ...x } : i)));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = {
      ...(a ? { versao: a.versao } : {}), titulo, tipo, forma, primeiraChamada: paraIso(primeira), segundaChamada: paraIso(segunda || primeira),
      local: forma === "ONLINE" ? "" : local, linkVideo: forma === "PRESENCIAL" ? "" : video,
      itens: itens.map((i) => ({ titulo: i.titulo, descricao: i.descricao, tipo: i.tipo, quorum: i.quorum, ...(i.tipo === "ESCOLHA" ? { opcoes: i.opcoes } : {}) })),
    };
    const r = await chamarApi<{ id: string }>(a ? `/v1/condominio/assembleias/${a.id}` : "/v1/condominio/assembleias", { metodo: a ? "PUT" : "POST", corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(r.dados.id, "Rascunho salvo. Confira a convocação e convoque quando estiver pronto.");
  }

  const erroItem = (n: number, campo: string) => detalhe.includes(`itens.${n + 1}.${campo}`);

  return (
    <Dialogo aberto titulo={a ? "Editar a assembleia" : "Nova assembleia"} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {comErro.some((c) => c.startsWith("itens")) ? <Aviso tom="erro" papel="alert">Confira a pauta: cada item precisa de título e, na escolha, de 2 a 10 opções diferentes.</Aviso> : null}
        <CampoTexto id="as-titulo" rotulo="Nome" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={comErro.includes("titulo") ? "Escreva o nome, com 5 a 120 letras" : null} ajuda="Por exemplo: Assembleia geral ordinária 2026" />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao id="as-tipo" rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoAssembleia)}
            opcoes={(Object.keys(TIPOS_ASSEMBLEIA) as TipoAssembleia[]).map((v) => ({ valor: v, texto: TIPOS_ASSEMBLEIA[v] }))}
            ajuda="Ordinária: contas, orçamento e eleição. Extraordinária: o resto" />
          <CampoSelecao id="as-forma" rotulo="Forma" value={forma} onChange={(e) => setForma(e.target.value as FormaAssembleia)}
            opcoes={(Object.keys(FORMAS_ASSEMBLEIA) as FormaAssembleia[]).map((v) => ({ valor: v, texto: FORMAS_ASSEMBLEIA[v] }))}
            ajuda="Online pede que a convenção não proíba" />
          <CampoTexto id="as-primeira" rotulo="1ª chamada" type="datetime-local" value={primeira} onChange={(e) => setPrimeira(e.target.value)}
            erro={comErro.includes("primeiraChamada") ? "Escolha uma data no futuro" : null} />
          <CampoTexto id="as-segunda" rotulo="2ª chamada" type="datetime-local" value={segunda} onChange={(e) => setSegunda(e.target.value)}
            erro={comErro.includes("segundaChamada") ? "Na hora da 1ª chamada ou depois" : null} />
          {forma !== "ONLINE" ? (
            <CampoTexto id="as-local" rotulo="Local" maxLength={200} value={local} onChange={(e) => setLocal(e.target.value)}
              erro={comErro.includes("local") ? "Escreva onde vai ser" : null} />
          ) : null}
          {forma !== "PRESENCIAL" ? (
            <CampoTexto id="as-video" rotulo="Link da videochamada" type="url" maxLength={300} value={video} onChange={(e) => setVideo(e.target.value)}
              erro={comErro.includes("linkVideo") ? "Cole o endereço que começa com https://" : null} ajuda="Vai só nos links pessoais, não no edital do mural" />
          ) : null}
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-[13px] font-medium">Pauta</legend>
          {itens.map((i, n) => (
            <div key={n} className="grid gap-2 rounded-xl border border-linha p-3">
              <CampoTexto id={`as-item-${n}`} rotulo={`Item ${n + 1}`} maxLength={200} value={i.titulo} onChange={(e) => mudarItem(n, { titulo: e.target.value })}
                erro={erroItem(n, "titulo") ? "Escreva o item, com 3 a 200 letras" : null} />
              <CampoTexto id={`as-item-${n}-desc`} rotulo="Detalhe" opcional maxLength={1000} value={i.descricao} onChange={(e) => mudarItem(n, { descricao: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CampoSelecao id={`as-item-${n}-tipo`} rotulo="Votação" value={i.tipo} onChange={(e) => mudarItem(n, { tipo: e.target.value as TipoItem })}
                  opcoes={(Object.keys(TIPOS_ITEM) as TipoItem[]).map((v) => ({ valor: v, texto: TIPOS_ITEM[v] }))} />
                <CampoSelecao id={`as-item-${n}-quorum`} rotulo="Quórum" value={i.quorum} onChange={(e) => mudarItem(n, { quorum: e.target.value as Quorum })}
                  opcoes={(Object.keys(QUORUNS) as Quorum[]).map((v) => ({ valor: v, texto: QUORUNS[v] }))} ajuda="Confira na convenção" />
              </div>
              {i.tipo === "ESCOLHA" ? (
                <div className="grid gap-2">
                  {i.opcoes.map((o, k) => (
                    <CampoTexto key={k} id={`as-item-${n}-op-${k}`} rotulo={`Opção ${k + 1} do item ${n + 1}`} maxLength={80} value={o}
                      onChange={(e) => mudarItem(n, { opcoes: i.opcoes.map((x, j) => (j === k ? e.target.value : x)) })} />
                  ))}
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-tinta-suave">
                    {i.opcoes.length < 10 ? <Botao variante="discreto" tamanho="p" onClick={() => mudarItem(n, { opcoes: [...i.opcoes, ""] })}>Mais uma opção</Botao> : null}
                    Em branco entra sozinho no fim.
                  </span>
                  {erroItem(n, "opcoes") ? <span className="text-[13px] text-erro" role="alert">Escreva de 2 a 10 opções, diferentes entre si</span> : null}
                </div>
              ) : null}
              {itens.length > 1 ? (
                <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setItens((xs) => xs.filter((_, j) => j !== n))}
                  aria-label={`Tirar o item ${n + 1}`}>Tirar o item</Botao>
              ) : null}
            </div>
          ))}
          {itens.length < 30 ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => setItens((xs) => [...xs, itemVazio()])}>Item da pauta</Botao> : null}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>Salvar o rascunho</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
