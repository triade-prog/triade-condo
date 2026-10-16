"use client";
// Unidades (F3.1, MU-08), do jeito que o prédio se organiza: por torre, bloco, quadra ou
// prédio (ou sem divisão), com ou sem andar. Ordem natural (2 antes de 10; térreo antes do
// 1º andar), o contato principal de cada unidade e se há contato a confirmar. Divisão e
// unidade não se apagam: são desativadas, e só quando não têm nada ativo dentro.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AGRUPAMENTOS, chaveAndar, chaveUnidade, gerarUnidades, mostrarAndar, nomeDaUnidade, type UnidadeNova } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Selo, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import type { Bloco, Estrutura, Recado, UnidadeResumo, Unidades } from "../tipos.ts";
import { Caixa, Escolha, nomesDivisao } from "./comum.tsx";

type Filtro = "todos" | "sem-bloco" | "sem-contato" | string;

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function Contatos({ u }: { u: UnidadeResumo }) {
  if (!u.ativa) return <Selo tom="neutro" marca="inativo">Desativada</Selo>;
  if (!u.confirmados && !u.pendentes) return <Selo tom="neutro" marca="inativo">Sem contato</Selo>;
  return (
    <span className="flex flex-wrap gap-1">
      {u.confirmados ? <Selo tom="ok" marca="ok">{plural(u.confirmados, "confirmado", "confirmados")}</Selo> : null}
      {u.pendentes ? <Selo tom="atencao" marca="atencao">{u.pendentes} a confirmar</Selo> : null}
    </span>
  );
}

/** Andares que existem nas unidades, em ordem (térreo antes do 1º). */
export function andaresDe(unidades: UnidadeResumo[]): string[] {
  return [...new Set(unidades.filter((u) => u.ativa && u.andar).map((u) => u.andar!))].sort((a, b) => chaveAndar(a).localeCompare(chaveAndar(b)));
}

/** Resumo do jeito que o prédio se organiza: "Torres, com andares". */
export function textoEstrutura(e: Estrutura): string {
  return `${AGRUPAMENTOS[e.agrupamento].nome}, ${e.usaAndar ? "com andares" : "sem andares"}`;
}

export function AbaUnidades({ dados, filtroInicial, aoMudarBloco, aoIncluir, aoOrganizar, salvo, recarregar }: {
  dados: Unidades;
  filtroInicial: Filtro;
  aoMudarBloco: (id: string | null) => void;
  aoIncluir: () => void;
  aoOrganizar: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  const div = nomesDivisao(dados.estrutura);
  const ativos = dados.blocos.filter((b) => b.ativo);
  const inativos = dados.blocos.filter((b) => !b.ativo);
  const temSemBloco = dados.unidades.some((u) => !u.blocoId);
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [andar, setAndar] = useState("");
  const [janela, setJanela] = useState<{ tipo: "renomear" | "desativar" | "reativar"; bloco: Bloco } | null>(null);
  const bloco = ativos.find((b) => b.id === filtro) ?? null;
  useEffect(() => aoMudarBloco(bloco?.id ?? null), [bloco, aoMudarBloco]);

  if (dados.unidades.length === 0 && dados.blocos.length === 0) {
    return (
      <Vazio titulo="Nenhuma unidade ainda"
        acao={dados.podeEditar ? (
          <span className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={aoOrganizar}>Como o prédio se organiza</Botao>
            <Botao onClick={aoIncluir}>+ Unidades</Botao>
          </span>
        ) : undefined}>
        Primeiro diga como o prédio se organiza: por torre, bloco, quadra ou prédio, e se as unidades ficam em andares. Depois cadastre as unidades
        (dá para gerar pela numeração) ou importe a planilha da administradora. Hoje: {textoEstrutura(dados.estrutura).toLowerCase()}.
      </Vazio>
    );
  }

  const doFiltro = dados.unidades.filter((u) =>
    filtro === "todos" ? true
      : filtro === "sem-bloco" ? !u.blocoId
        : filtro === "sem-contato" ? u.ativa && u.confirmados === 0
          : u.blocoId === filtro);
  const andares = dados.estrutura.usaAndar ? andaresDe(doFiltro) : [];
  const lista = andar ? doFiltro.filter((u) => u.andar === andar) : doFiltro;
  const nomeBloco = (id: string | null) => dados.blocos.find((b) => b.id === id)?.nome ?? null;
  const opcoes = [
    { valor: "todos", texto: "Todas" },
    ...(div.usa ? ativos.map((b) => ({ valor: b.id, texto: b.nome })) : []),
    ...(div.usa && temSemBloco && ativos.length ? [{ valor: "sem-bloco", texto: div.sem }] : []),
    { valor: "sem-contato", texto: "Sem contato confirmado" },
  ];

  return (
    <div className="grid gap-4">
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
        Organização do prédio: {textoEstrutura(dados.estrutura).toLowerCase()}
        {dados.podeEditar ? <><span aria-hidden="true">·</span><Botao variante="texto" onClick={aoOrganizar}>Mudar</Botao></> : null}
      </p>
      <Escolha rotulo="Mostrar unidades" opcoes={opcoes} atual={filtro} aoMudar={(f) => { setFiltro(f); setAndar(""); }} />
      {andares.length ? (
        <CampoSelecao id="u-filtro-andar" rotulo="Andar" className="max-w-56" value={andar} onChange={(e) => setAndar(e.target.value)}
          opcoes={[{ valor: "", texto: "Todos os andares" }, ...andares.map((a) => ({ valor: a, texto: mostrarAndar(a) }))]} />
      ) : null}
      {bloco && dados.podeEditar ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          {bloco.nome} · {plural(doFiltro.filter((u) => u.ativa).length, "unidade ativa", "unidades ativas")} ·
          <Botao variante="texto" onClick={() => setJanela({ tipo: "renomear", bloco })}>Renomear</Botao>·
          <Botao variante="texto" onClick={() => setJanela({ tipo: "desativar", bloco })}>Desativar</Botao>
        </p>
      ) : null}
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "sem-contato" ? "Todas as unidades têm contato confirmado" : "Nenhuma unidade aqui"}>
          {filtro === "sem-contato" ? "Nada a fazer por enquanto." : "Inclua unidades pelo botão + Unidades."}
        </Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-linha">
          <table className="w-full text-sm">
            <caption className="sr-only">Unidades do condomínio</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Unidade</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Contato principal</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Contatos</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className="border-t border-linha align-top">
                  <td className="px-4 py-3">
                    <Link href={`/moradores/unidade?id=${u.id}`} className="font-medium text-acao hover:underline">
                      {nomeDaUnidade(filtro === u.blocoId ? null : nomeBloco(u.blocoId), andar ? null : u.andar, u.identificacao)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{u.principal ?? <span className="text-tinta-suave">Nenhum</span>}</td>
                  <td className="px-4 py-3"><Contatos u={u} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inativos.length && dados.podeEditar ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          {div.varios} desativados:
          {inativos.map((b) => (
            <Botao key={b.id} variante="texto" onClick={() => setJanela({ tipo: "reativar", bloco: b })} aria-label={`Reativar ${b.nome}`}>{b.nome}</Botao>
          ))}
        </p>
      ) : null}
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
            setFiltro("todos");
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
          <label key={a} className="flex items-start gap-2 rounded-md border border-linha px-3 py-2 text-sm has-[:checked]:border-acao has-[:checked]:bg-plataforma-bruma">
            <input type="radio" name="e-agrupamento" className="mt-1 accent-[var(--color-acao)]" checked={agrupamento === a} onChange={() => setAgrupamento(a)} />
            <span><span className="font-medium">{a === "NENHUM" ? "Sem divisão" : `Por ${AGRUPAMENTOS[a].um.toLowerCase()}`}</span>
              <span className="block text-xs text-tinta-suave">{EXPLICA[a]}</span></span>
          </label>
        ))}
      </fieldset>
      <Caixa id="e-andar" rotulo="As unidades ficam em andares" marcada={usaAndar} aoMudar={setUsaAndar}
        ajuda="Com andar, a unidade aparece como Torre A · 3º andar · 302, e a lista filtra por andar. Serve também para térreo, subsolo e cobertura." />
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
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
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando || novas < 1 || longas}>
          {enviando ? "Incluindo…" : `Incluir ${plural(Math.max(novas, 0), "unidade", "unidades")}`}
        </Botao>
      </div>
    </form>
  );
}
