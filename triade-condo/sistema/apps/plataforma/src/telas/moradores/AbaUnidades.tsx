"use client";
// Unidades (F3.1, MU-08; DC15, telas-modelo moradores-unidades-*), do jeito que o prédio se
// organiza: por torre, bloco, quadra ou prédio (ou sem divisão), com ou sem andar. Ordem natural
// (2 antes de 10; térreo antes do 1º andar), o responsável de cada unidade, a ocupação (MU-10,
// MU-11), as marcas à venda e para alugar (MU-11) e os contatos. A busca acha a unidade pela
// identificação, pelo nome ou telefone de quem está nela e pela placa (MU-11, MU-06). A ocupação
// fica em abas, o que pede atenção em atalhos, e a torre, o andar e as marcas em Filtros. No
// celular, cada unidade é um cartão. Divisão e unidade não se apagam: são desativadas, e só
// quando não têm nada ativo dentro.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AGRUPAMENTOS, chaveAndar, chaveUnidade, gerarUnidades, mostrarAndar, nomeDaUnidade, OCUPACOES, type UnidadeNova } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Chip, Dialogo, Icone, Selo, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import type { AchadoUnidade, Bloco, Estrutura, Recado, UnidadeResumo, Unidades } from "../tipos.ts";
import { Caixa, Escolha, LadrilhoUnidade, nomeRelacao, nomesDivisao } from "./comum.tsx";

type Situacao = "" | "com-morador" | "alugadas" | "sem-cadastro";
type Atencao = "" | "sem-contato" | "sem-proprietario" | "sem-responsavel";
type Marca = "" | "nao-mora" | "a-venda" | "para-alugar";
interface Filtros { bloco: string; andar: string; marca: Marca }
const SEM_FILTROS: Filtros = { bloco: "", andar: "", marca: "" };

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

const NOME_MARCA: Record<Exclude<Marca, "">, string> = { "nao-mora": "Proprietário não mora", "a-venda": "À venda", "para-alugar": "Para alugar" };

/** Um selo para os contatos da unidade: o que mais pede atenção primeiro. */
function seloContatos(u: UnidadeResumo): { texto: string; tom: Tom } {
  if (!u.ativa) return { texto: "Desativada", tom: "neutro" };
  if (u.semProprietario) return { texto: "Falta o proprietário", tom: "atencao" };
  if (!u.confirmados && !u.pendentes) return { texto: "Sem contato", tom: "atencao" };
  if (!u.confirmados) return { texto: `${u.pendentes} a confirmar`, tom: "atencao" };
  return { texto: plural(u.confirmados, "confirmado", "confirmados"), tom: "ok" };
}

function contagemContatos(u: UnidadeResumo): string {
  return [u.confirmados ? plural(u.confirmados, "confirmado", "confirmados") : null, u.pendentes ? `${u.pendentes} a confirmar` : null].filter(Boolean).join(" · ");
}

/** Busca na API (MU-11): o que achou em cada unidade, ou null enquanto a busca é curta. */
function useBuscaUnidades(texto: string): { achados: Map<string, AchadoUnidade> | null; buscando: boolean; falha: string | null } {
  const [r, setR] = useState<{ q: string; achados: Map<string, AchadoUnidade> | null; falha: string | null }>({ q: "", achados: null, falha: null });
  const q = texto.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let vale = true;
    const t = setTimeout(async () => {
      const resp = await chamarApi<AchadoUnidade[]>(`/v1/condominio/busca-unidades?busca=${encodeURIComponent(q)}`);
      if (!vale) return;
      setR(resp.ok ? { q, achados: new Map(resp.dados.map((a) => [a.unidadeId, a])), falha: null } : { q, achados: null, falha: textoDoErro(resp.erro) });
    }, 250);
    return () => { vale = false; clearTimeout(t); };
  }, [q]);
  if (q.length < 2) return { achados: null, buscando: false, falha: null };
  return { achados: r.q === q ? r.achados : null, buscando: r.q !== q, falha: r.q === q ? r.falha : null };
}

/** Andares que existem nas unidades, em ordem (térreo antes do 1º). */
export function andaresDe(unidades: UnidadeResumo[]): string[] {
  return [...new Set(unidades.filter((u) => u.ativa && u.andar).map((u) => u.andar!))].sort((a, b) => chaveAndar(a).localeCompare(chaveAndar(b)));
}

/** Resumo do jeito que o prédio se organiza: "Torres, com andares". */
export function textoEstrutura(e: Estrutura): string {
  return `${AGRUPAMENTOS[e.agrupamento].nome}, ${e.usaAndar ? "com andares" : "sem andares"}`;
}

/** A torre (ou bloco), o andar e as marcas, numa janela. */
function JanelaFiltros({ aberto, dados, f, aoFechar, aplicar }: { aberto: boolean; dados: Unidades; f: Filtros; aoFechar: () => void; aplicar: (f: Filtros) => void }) {
  const [v, setV] = useState(f);
  const div = nomesDivisao(dados.estrutura);
  const ativos = dados.blocos.filter((b) => b.ativo);
  const temSemBloco = dados.unidades.some((u) => !u.blocoId);
  const doBloco = dados.unidades.filter((u) => (v.bloco === "" ? true : v.bloco === "sem-bloco" ? !u.blocoId : u.blocoId === v.bloco));
  const andares = dados.estrutura.usaAndar ? andaresDe(doBloco) : [];
  const o = dados.ocupacao;
  const n: Record<Exclude<Marca, "">, number> = { "nao-mora": o.proprietarioNaoMora, "a-venda": o.aVenda, "para-alugar": o.paraAlugar };
  return (
    <Dialogo aberto={aberto} titulo="Filtrar unidades" aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aplicar(v); }}>
        {div.usa && ativos.length ? (
          <CampoSelecao id="u-f-bloco" rotulo={div.um} value={v.bloco} onChange={(e) => setV({ ...v, bloco: e.target.value, andar: "" })}
            opcoes={[{ valor: "", texto: `${div.varios}: todos` }, ...ativos.map((b) => ({ valor: b.id, texto: b.nome })), ...(temSemBloco ? [{ valor: "sem-bloco", texto: div.sem }] : [])]} />
        ) : null}
        {andares.length ? (
          <CampoSelecao id="u-f-andar" rotulo="Andar" value={v.andar} onChange={(e) => setV({ ...v, andar: e.target.value })}
            opcoes={[{ valor: "", texto: "Todos os andares" }, ...andares.map((a) => ({ valor: a, texto: mostrarAndar(a) }))]} />
        ) : null}
        <CampoSelecao id="u-f-marca" rotulo="Marca" value={v.marca} onChange={(e) => setV({ ...v, marca: e.target.value as Marca })}
          opcoes={[{ valor: "", texto: "Qualquer uma" }, ...(Object.keys(NOME_MARCA) as Exclude<Marca, "">[]).map((m) => ({ valor: m, texto: `${NOME_MARCA[m]} (${n[m]})` }))]} />
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={() => aplicar(SEM_FILTROS)}>Tirar filtros</Botao>
          <Botao type="submit">Mostrar unidades</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

const COLUNAS = "md:grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_20px]";

function LinhaUnidade({ u, nome, achado }: { u: UnidadeResumo; nome: string; achado?: AchadoUnidade }) {
  const selo = seloContatos(u);
  const contagem = contagemContatos(u);
  const ocupacao = (
    <>
      <span className={u.ocupacao === "SEM_CADASTRO" ? "text-tinta-suave" : ""}>{OCUPACOES[u.ocupacao]}</span>
      {u.proprietarioNaoMora && u.proprietario ? <span className="t-apoio block">{u.proprietario}, proprietário, não mora</span> : null}
      {u.aVenda || u.paraAlugar ? (
        <span className="mt-1 flex flex-wrap gap-1">
          {u.aVenda ? <Selo tom="info">À venda</Selo> : null}
          {u.paraAlugar ? <Selo tom="info">Para alugar</Selo> : null}
        </span>
      ) : null}
    </>
  );
  return (
    <li className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <span className="self-start md:self-center"><LadrilhoUnidade texto={u.identificacao} /></span>
      <div className="grid min-w-0 gap-0.5">
        <Link href={`/moradores/unidade?id=${u.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{nome}</Link>
        <span className="t-apoio">
          {u.principal ? `${u.principal}${u.principalRelacao ? ` · ${nomeRelacao(u.principalRelacao).toLowerCase()}` : ""}`
            : <span className="font-medium text-atencao">{u.ocupacao === "SEM_CADASTRO" ? "Ninguém cadastrado" : "Sem responsável"}</span>}
        </span>
        {achado && achado.tipo !== "UNIDADE" ? <span className="t-apoio">{achado.tipo === "TELEFONE" ? `telefone de ${achado.texto}` : achado.texto}</span> : null}
        <span className="grid gap-1 pt-1 text-sm md:hidden">
          <span>{ocupacao}</span>
          <span className="flex flex-wrap items-center gap-2"><Selo tom={selo.tom}>{selo.texto}</Selo>{contagem && contagem !== selo.texto ? <span className="t-apoio">{contagem}</span> : null}</span>
        </span>
      </div>
      <span className="text-sm max-md:hidden">{ocupacao}</span>
      <span className="grid justify-items-start gap-1 max-md:hidden">
        <Selo tom={selo.tom}>{selo.texto}</Selo>
        {contagem && contagem !== selo.texto ? <span className="t-apoio">{contagem}</span> : null}
      </span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

export function AbaUnidades({ dados, filtroInicial, aoMudarBloco, aoIncluir, aoOrganizar, salvo, recarregar }: {
  dados: Unidades;
  filtroInicial: Atencao;
  aoMudarBloco: (id: string | null) => void;
  aoIncluir: () => void;
  aoOrganizar: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  const div = nomesDivisao(dados.estrutura);
  const inativos = dados.blocos.filter((b) => !b.ativo);
  const [situacao, setSituacao] = useState<Situacao>("");
  const [atencao, setAtencao] = useState<Atencao>(filtroInicial);
  const [f, setF] = useState<Filtros>(SEM_FILTROS);
  const [filtrando, setFiltrando] = useState(false);
  const [texto, setTexto] = useState("");
  const busca = useBuscaUnidades(texto);
  const [janela, setJanela] = useState<{ tipo: "renomear" | "desativar" | "reativar"; bloco: Bloco } | null>(null);
  const bloco = dados.blocos.find((b) => b.ativo && b.id === f.bloco) ?? null;
  useEffect(() => aoMudarBloco(bloco?.id ?? null), [bloco, aoMudarBloco]);

  if (dados.unidades.length === 0 && dados.blocos.length === 0) {
    return (
      <Vazio titulo="Nenhuma unidade ainda" icone="predio"
        acao={dados.podeEditar ? (
          <span className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={aoOrganizar}>Como o prédio se organiza</Botao>
            <Botao onClick={aoIncluir}>Novas unidades</Botao>
          </span>
        ) : undefined}>
        Primeiro diga como o prédio se organiza: por torre, bloco, quadra ou prédio, e se as unidades ficam em andares. Depois cadastre as unidades
        (dá para gerar pela numeração) ou importe a planilha da administradora. Hoje: {textoEstrutura(dados.estrutura).toLowerCase()}.
      </Vazio>
    );
  }

  const ativas = dados.unidades.filter((u) => u.ativa);
  const naSituacao = (s: Situacao) => dados.unidades.filter((u) =>
    s === "" ? true
      : s === "com-morador" ? u.ativa && ["PROPRIETARIO_MORA", "ALUGADA", "CEDIDA"].includes(u.ocupacao)
        : s === "alugadas" ? u.ativa && u.ocupacao === "ALUGADA"
          : u.ativa && u.ocupacao === "SEM_CADASTRO");
  const naAtencao = (u: UnidadeResumo) =>
    atencao === "" ? true : atencao === "sem-contato" ? u.ativa && u.confirmados === 0 : atencao === "sem-proprietario" ? u.semProprietario : u.semResponsavel;
  const nosFiltros = (u: UnidadeResumo) =>
    (f.bloco === "" ? true : f.bloco === "sem-bloco" ? !u.blocoId : u.blocoId === f.bloco)
    && (f.andar === "" || u.andar === f.andar)
    && (f.marca === "" ? true : f.marca === "nao-mora" ? u.ativa && u.proprietarioNaoMora : f.marca === "a-venda" ? u.ativa && u.aVenda : u.ativa && u.paraAlugar);
  const filtradas = naSituacao(situacao).filter((u) => naAtencao(u) && nosFiltros(u));
  const lista = busca.achados ? filtradas.filter((u) => busca.achados!.has(u.id)) : filtradas;
  const buscou = busca.achados !== null;
  const nomeBloco = (id: string | null) => dados.blocos.find((b) => b.id === id)?.nome ?? null;
  const o = dados.ocupacao;
  const situacoes: { valor: Situacao; texto: string; n: number }[] = [
    { valor: "", texto: "Todas", n: dados.unidades.length },
    { valor: "com-morador", texto: "Com morador", n: o.comMorador },
    { valor: "alugadas", texto: "Alugadas", n: o.alugadas },
    { valor: "sem-cadastro", texto: "Sem cadastro", n: ativas.filter((u) => u.ocupacao === "SEM_CADASTRO").length },
  ];
  const atalhos: { valor: Exclude<Atencao, "">; texto: string; n: number }[] = ([
    { valor: "sem-contato", texto: "Sem contato confirmado", n: dados.resumo.semContato },
    { valor: "sem-proprietario", texto: "Inquilino sem proprietário", n: dados.resumo.semProprietario },
    { valor: "sem-responsavel", texto: "Sem responsável", n: o.semResponsavel },
  ] as const).filter((a) => a.n > 0 || a.valor === atencao);
  const escolhidos = [
    ...(f.bloco ? [{ texto: f.bloco === "sem-bloco" ? div.sem : nomeBloco(f.bloco) ?? div.um, tirar: () => setF({ ...f, bloco: "", andar: "" }) }] : []),
    ...(f.andar ? [{ texto: mostrarAndar(f.andar), tirar: () => setF({ ...f, andar: "" }) }] : []),
    ...(f.marca ? [{ texto: NOME_MARCA[f.marca], tirar: () => setF({ ...f, marca: "" }) }] : []),
  ];
  const resolvido = atencao === "sem-contato" ? "Todas as unidades têm contato confirmado"
    : atencao === "sem-proprietario" ? "Toda unidade com inquilino tem o proprietário no cadastro"
      : atencao === "sem-responsavel" ? "Toda unidade com gente cadastrada tem um responsável"
        : situacao || f.marca ? "Nenhuma unidade nesta situação" : null;
  const limpar = () => { setSituacao(""); setAtencao(""); setF(SEM_FILTROS); setTexto(""); };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <form role="search" aria-label="Buscar unidades" className="busca min-w-0 flex-1 md:max-w-[520px]" onSubmit={(e) => e.preventDefault()}>
          <Icone nome="busca" />
          <label htmlFor="u-busca" className="sr-only">Buscar unidade</label>
          <input id="u-busca" className="campo" type="search" placeholder="Buscar por unidade, nome, telefone ou placa" maxLength={60} value={texto}
            onChange={(e) => setTexto(e.target.value)} aria-describedby="u-busca-ajuda" />
        </form>
        <Botao variante="contorno" className="max-md:w-11 max-md:px-0" onClick={() => setFiltrando(true)}>
          <Icone nome="filtro" /><span className="max-md:sr-only">Filtros{escolhidos.length ? ` · ${escolhidos.length}` : ""}</span>
        </Botao>
      </div>
      <p id="u-busca-ajuda" className="sr-only">A placa acha com ou sem hífen, em maiúsculas ou minúsculas.</p>
      {escolhidos.length || buscou || busca.buscando || busca.falha ? (
        <div className="flex flex-wrap items-center gap-2">
          {escolhidos.map((e) => <Chip key={e.texto} aoTirar={e.tirar} rotuloTirar={`Tirar o filtro ${e.texto}`}>{e.texto}</Chip>)}
          <span className="t-apoio" aria-live="polite">
            {busca.buscando ? "Buscando…" : busca.falha ? busca.falha : buscou ? plural(lista.length, "unidade encontrada", "unidades encontradas") : ""}
          </span>
        </div>
      ) : null}

      <section aria-labelledby="t-unidades" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-unidades" className="sr-only">Unidades do condomínio</h2>
        <nav aria-label="Ocupação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {situacoes.map((s) => {
            const atual = situacao === s.valor;
            return (
              <button key={s.valor || "todas"} type="button" aria-pressed={atual} onClick={() => setSituacao(s.valor)}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {s.texto}
                <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{s.n}</span>
              </button>
            );
          })}
        </nav>
        {atalhos.length ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {atalhos.map((a) => (
              <button key={a.valor} type="button" aria-pressed={atencao === a.valor} data-tom="atencao" className="chip-atencao"
                onClick={() => setAtencao(atencao === a.valor ? "" : a.valor)}>
                {a.texto} <b>{a.n}</b>
              </button>
            ))}
          </div>
        ) : null}

        {lista.length === 0 ? (
          <div className="md:p-5">
            {buscou ? <Vazio titulo="Nenhuma unidade encontrada" icone="busca">Confira o que foi escrito ou busque por outra coisa: unidade, nome, telefone ou placa.</Vazio>
              : <Vazio titulo={resolvido ?? "Nenhuma unidade aqui"} icone={resolvido ? "check" : "predio"}
                  acao={situacao || atencao || escolhidos.length ? <Botao variante="contorno" onClick={limpar}>Limpar filtros</Botao> : undefined}>
                  {resolvido ? "Nada a fazer por enquanto." : "Inclua unidades em Montar o prédio, Novas unidades."}
                </Vazio>}
          </div>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
              <span /><span className="t-rotulo">Unidade</span><span className="t-rotulo">Ocupação</span><span className="t-rotulo">Contatos</span><span />
            </div>
            <ul aria-label="Unidades" className="grid max-md:gap-3">
              {lista.map((u) => (
                <LinhaUnidade key={u.id} u={u} achado={busca.achados?.get(u.id)}
                  nome={nomeDaUnidade(f.bloco === u.blocoId ? null : nomeBloco(u.blocoId), f.andar ? null : u.andar, u.identificacao)} />
              ))}
            </ul>
            <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">{plural(lista.length, "unidade", "unidades")}</p>
          </>
        )}
      </section>

      {bloco && dados.podeEditar ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          {bloco.nome} · {plural(dados.unidades.filter((u) => u.ativa && u.blocoId === bloco.id).length, "unidade ativa", "unidades ativas")} ·
          <Botao variante="discreto" onClick={() => setJanela({ tipo: "renomear", bloco })}>Renomear</Botao>·
          <Botao variante="discreto" onClick={() => setJanela({ tipo: "desativar", bloco })}>Desativar</Botao>
        </p>
      ) : null}
      {inativos.length && dados.podeEditar ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          {div.varios} desativados:
          {inativos.map((b) => (
            <Botao key={b.id} variante="discreto" onClick={() => setJanela({ tipo: "reativar", bloco: b })} aria-label={`Reativar ${b.nome}`}>{b.nome}</Botao>
          ))}
        </p>
      ) : null}
      <JanelaFiltros key={`${filtrando}`} aberto={filtrando} dados={dados} f={f} aoFechar={() => setFiltrando(false)} aplicar={(v) => { setFiltrando(false); setF(v); }} />
      <JanelaBloco aberto={janela?.tipo === "renomear"} bloco={janela?.bloco ?? null} estrutura={dados.estrutura} aoFechar={() => setJanela(null)}
        salvo={salvo} recarregar={recarregar} />
      <Janela aberto={janela?.tipo === "desativar" || janela?.tipo === "reativar"}
        titulo={janela ? `${janela.tipo === "desativar" ? "Desativar" : "Reativar"} ${janela.bloco.nome}` : div.um}
        campos={[]} iniciais={{}} textoBotao={janela?.tipo === "reativar" ? "Reativar" : "Desativar"}
        explicacao={janela?.tipo === "reativar" ? "Volta a aparecer na lista." : "Só dá para desativar sem unidades ativas dentro. Nada é apagado; dá para reativar depois."}
        aoFechar={() => setJanela(null)} recarregar={recarregar}
        aoSalvar={async () => {
          const b = janela!.bloco;
          const r = await chamarApi(`/v1/condominio/blocos/${b.id}`, { metodo: "PUT", corpo: { versao: b.versao, nome: b.nome, ativo: janela!.tipo === "reativar" } });
          if (r.ok) {
            setJanela(null);
            setF(SEM_FILTROS);
            salvo({ tom: "ok", texto: `${b.nome}: ${janela!.tipo === "reativar" ? "reativado" : "desativado"}.` });
          }
          return r;
        }} />
    </div>
  );
}

/** Como o prédio se organiza: o nome da divisão maior e se as unidades ficam em andares. */
export function JanelaEstrutura({ aberto, estrutura, aoFechar, salvo, recarregar }: {
  aberto: boolean;
  estrutura: Estrutura;
  aoFechar: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  return (
    <Dialogo aberto={aberto} titulo="Como o prédio se organiza" aoFechar={aoFechar}>
      {aberto ? <FormEstrutura estrutura={estrutura} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

const EXPLICA: Record<Estrutura["agrupamento"], string> = {
  NENHUM: "Um prédio só, sem divisão: as unidades ficam direto no condomínio.",
  TORRE: "Torre A, Torre B, Torre 1...",
  BLOCO: "Bloco A, Bloco 2...",
  QUADRA: "Condomínio de casas: Quadra 1, Quadra 2...",
  PREDIO: "Vários prédios no mesmo condomínio: Prédio 1, Edifício Ipê...",
};

function FormEstrutura({ estrutura, aoFechar, salvo, recarregar }: { estrutura: Estrutura; aoFechar: () => void; salvo: (r: Recado) => void; recarregar: () => void }) {
  const [agrupamento, setAgrupamento] = useState(estrutura.agrupamento);
  const [usaAndar, setUsaAndar] = useState(estrutura.usaAndar);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/estrutura", { metodo: "PUT", corpo: { versao: estrutura.versao, agrupamento, usaAndar } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: `Organização do prédio: ${textoEstrutura({ agrupamento, usaAndar, versao: 0 }).toLowerCase()}.` });
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium">Divisão do condomínio</legend>
        {(Object.keys(AGRUPAMENTOS) as Estrutura["agrupamento"][]).map((a) => (
          <label key={a} className="flex items-start gap-2 rounded-md border border-linha px-3 py-2 text-sm has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
            <input type="radio" name="e-agrupamento" className="mt-1 accent-violeta-600" checked={agrupamento === a} onChange={() => setAgrupamento(a)} />
            <span><span className="font-medium">{a === "NENHUM" ? "Sem divisão" : `Por ${AGRUPAMENTOS[a].um.toLowerCase()}`}</span>
              <span className="block text-xs text-tinta-suave">{EXPLICA[a]}</span></span>
          </label>
        ))}
      </fieldset>
      <Caixa id="e-andar" rotulo="As unidades ficam em andares" marcada={usaAndar} aoMudar={setUsaAndar}
        ajuda="Com andar, a unidade aparece como Torre A · 3º andar · 302, e a lista filtra por andar. Serve também para térreo, subsolo e cobertura." />
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao>
      </div>
    </form>
  );
}

/** Incluir ou renomear uma torre, bloco, quadra ou prédio. */
export function JanelaBloco({ aberto, bloco, estrutura, aoFechar, salvo, recarregar }: {
  aberto: boolean;
  bloco: Bloco | null;
  estrutura: Estrutura;
  aoFechar: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  const div = nomesDivisao(estrutura);
  return (
    <Janela aberto={aberto} titulo={bloco ? `Renomear ${bloco.nome}` : `Incluir ${div.um.toLowerCase()}`} textoBotao={bloco ? "Salvar" : "Incluir"}
      campos={[{ id: "nome", rotulo: `Nome (${div.um.toLowerCase()})`, tipo: "texto", obrigatorio: true, max: 40, ajuda: `Por exemplo: ${div.um} A, ${div.um} 2.`,
        erro: "Escreva um nome de até 40 caracteres." }]}
      iniciais={{ nome: bloco?.nome ?? "" }} aoFechar={aoFechar} recarregar={recarregar}
      aoSalvar={async (v) => {
        const nome = String(v.nome);
        const r = bloco
          ? await chamarApi(`/v1/condominio/blocos/${bloco.id}`, { metodo: "PUT", corpo: { versao: bloco.versao, nome } })
          : await chamarApi("/v1/condominio/blocos", { corpo: { nome } });
        if (r.ok) {
          aoFechar();
          salvo({ tom: "ok", texto: bloco ? `Nome trocado para ${nome.trim()}.` : `${nome.trim()} incluído. Agora inclua as unidades.` });
        }
        return r;
      }} />
  );
}

/** Incluir unidades: escrever a lista ou gerar pela numeração do prédio (com o andar de cada uma). */
export function IncluirUnidades({ aberto, dados, blocoInicial, aoFechar, salvo }: {
  aberto: boolean;
  dados: Unidades;
  blocoInicial: string | null;
  aoFechar: () => void;
  salvo: (r: Recado) => void;
}) {
  return (
    <Dialogo aberto={aberto} titulo="Incluir unidades" aoFechar={aoFechar}>
      {aberto ? <FormUnidades dados={dados} blocoInicial={blocoInicial} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormUnidades({ dados, blocoInicial, aoFechar, salvo }: { dados: Unidades; blocoInicial: string | null; aoFechar: () => void; salvo: (r: Recado) => void }) {
  const div = nomesDivisao(dados.estrutura);
  const usaAndar = dados.estrutura.usaAndar;
  const ativos = dados.blocos.filter((b) => b.ativo);
  const [blocoId, setBlocoId] = useState(blocoInicial ?? (div.usa && ativos.length === 1 ? ativos[0]!.id : ""));
  const [modo, setModo] = useState<"escrever" | "gerar">("escrever");
  const [texto, setTexto] = useState("");
  const [andarEscrito, setAndarEscrito] = useState("");
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState("4");
  const [porAndar, setPorAndar] = useState("4");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const andarDaLista = andarEscrito.trim() || null;
  const lista: UnidadeNova[] = modo === "escrever"
    ? [...new Map(texto.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean).map((x) => [x.toLowerCase(), { identificacao: x, andar: andarDaLista }])).values()]
    : gerarUnidades({ de: Number(de), ate: Number(ate), porAndar: Number(porAndar), comAndar: usaAndar });
  const chave = (u: { identificacao: string; andar: string | null }) => `${(u.andar ?? "").toLowerCase()}|${u.identificacao.toLowerCase()}`;
  const existentes = new Set(dados.unidades.filter((u) => u.ativa && (u.blocoId ?? "") === blocoId).map(chave));
  const repetidas = lista.filter((x) => existentes.has(chave(x)));
  const novas = lista.length - repetidas.length;
  const longas = lista.filter((x) => x.identificacao.length > 20).length > 0 || (andarDaLista?.length ?? 0) > 20;
  const previa = [...lista].sort((a, b) => chaveAndar(a.andar).localeCompare(chaveAndar(b.andar)) || chaveUnidade(a.identificacao).localeCompare(chaveUnidade(b.identificacao)))
    .map((u) => nomeDaUnidade(null, u.andar, u.identificacao));

  async function incluir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ criadas: number; jaExistiam: string[] }>("/v1/condominio/unidades", { corpo: { blocoId: blocoId || null, unidades: lista } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    const ja = r.dados.jaExistiam.length ? ` ${plural(r.dados.jaExistiam.length, "já existia e ficou como estava", "já existiam e ficaram como estavam")}.` : "";
    salvo({ tom: "ok", texto: `${plural(r.dados.criadas, "unidade incluída", "unidades incluídas")}.${ja}` });
  }

  const comErro = camposComErro(erro);
  return (
    <form onSubmit={incluir} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {div.usa ? (
        <CampoSelecao id="u-bloco" rotulo={div.um} value={blocoId} onChange={(e) => setBlocoId(e.target.value)}
          opcoes={[{ valor: "", texto: div.sem }, ...ativos.map((b) => ({ valor: b.id, texto: b.nome }))]} />
      ) : null}
      <Escolha rotulo="Como incluir" atual={modo} aoMudar={setModo}
        opcoes={[{ valor: "escrever", texto: "Escrever" }, { valor: "gerar", texto: "Gerar pela numeração" }]} />
      {modo === "escrever" ? (
        <>
          {usaAndar ? (
            <CampoTexto id="u-andar" rotulo="Andar" opcional maxLength={20} value={andarEscrito} onChange={(e) => setAndarEscrito(e.target.value)}
              ajuda="Vale para todas as unidades escritas abaixo: 3, Térreo, Cobertura." />
          ) : null}
          <CampoAreaTexto id="u-lista" rotulo="Unidades" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)}
            ajuda="Uma por linha ou separadas por vírgula: 101, 102, Casa 3, Loja 1."
            erro={comErro.includes("unidades") || longas ? "Cada unidade e o andar com até 20 caracteres." : null} />
        </>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <CampoTexto id="u-de" rotulo="Do andar" inputMode="numeric" value={de} onChange={(e) => setDe(e.target.value)} />
          <CampoTexto id="u-ate" rotulo="Até o andar" inputMode="numeric" value={ate} onChange={(e) => setAte(e.target.value)} />
          <CampoTexto id="u-por" rotulo="Por andar" inputMode="numeric" value={porAndar} onChange={(e) => setPorAndar(e.target.value)} />
        </div>
      )}
      <p className="text-sm text-tinta-suave" aria-live="polite">
        {lista.length === 0
          ? modo === "gerar" ? "Confira os andares: até o andar 200, até 99 por andar e no máximo 1000 unidades." : "Escreva as unidades para ver a prévia."
          : <>Prévia: {previa.slice(0, 6).join(", ")}{previa.length > 6 ? ` … ${previa.at(-1)}` : ""} · <strong>{plural(lista.length, "unidade", "unidades")}</strong>.
            {modo === "gerar" ? " Andar 0 é o térreo: 1, 2, 3." : ""}{modo === "gerar" && usaAndar ? " Cada unidade já fica no andar dela." : ""}</>}
      </p>
      {repetidas.length ? (
        <p className="rounded-lg border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao">
          {repetidas.slice(0, 5).map((u) => nomeDaUnidade(null, u.andar, u.identificacao)).join(", ")}{repetidas.length > 5 ? "…" : ""}{" "}
          {repetidas.length === 1 ? "já existe e fica como está" : "já existem e ficam como estão"}.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando || novas < 1 || longas}>
          {enviando ? "Incluindo…" : `Incluir ${plural(Math.max(novas, 0), "unidade", "unidades")}`}
        </Botao>
      </div>
    </form>
  );
}
