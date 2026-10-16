"use client";
// Unidades por bloco (F3.1, MU-08): blocos opcionais, ordem natural (2 antes de 10), o contato
// principal de cada unidade e se há contato a confirmar. Bloco e unidade não se apagam: são
// desativados, e só quando não têm nada ativo dentro.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { chaveUnidade, gerarUnidades } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import type { Bloco, Recado, UnidadeResumo, Unidades } from "../tipos.ts";
import { Escolha } from "./comum.tsx";

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

export function AbaUnidades({ dados, filtroInicial, aoMudarBloco, aoIncluir, salvo, recarregar }: {
  dados: Unidades;
  filtroInicial: Filtro;
  aoMudarBloco: (id: string | null) => void;
  aoIncluir: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  const ativos = dados.blocos.filter((b) => b.ativo);
  const inativos = dados.blocos.filter((b) => !b.ativo);
  const temSemBloco = dados.unidades.some((u) => !u.blocoId);
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [janela, setJanela] = useState<{ tipo: "renomear" | "desativar" | "reativar"; bloco: Bloco } | null>(null);
  const bloco = ativos.find((b) => b.id === filtro) ?? null;
  useEffect(() => aoMudarBloco(bloco?.id ?? null), [bloco, aoMudarBloco]);

  if (dados.unidades.length === 0 && dados.blocos.length === 0) {
    return (
      <Vazio titulo="Nenhuma unidade ainda"
        acao={dados.podeEditar ? <Botao onClick={aoIncluir}>+ Unidades</Botao> : undefined}>
        Cadastre as unidades (dá para gerar pela numeração do prédio) ou importe a planilha da administradora. Blocos são opcionais.
      </Vazio>
    );
  }

  const lista = dados.unidades.filter((u) =>
    filtro === "todos" ? true
      : filtro === "sem-bloco" ? !u.blocoId
        : filtro === "sem-contato" ? u.ativa && u.confirmados === 0
          : u.blocoId === filtro);
  const nomeBloco = (id: string | null) => dados.blocos.find((b) => b.id === id)?.nome ?? null;
  const opcoes = [
    { valor: "todos", texto: "Todas" },
    ...ativos.map((b) => ({ valor: b.id, texto: b.nome })),
    ...(temSemBloco && ativos.length ? [{ valor: "sem-bloco", texto: "Sem bloco" }] : []),
    { valor: "sem-contato", texto: "Sem contato confirmado" },
  ];

  return (
    <div className="grid gap-4">
      <Escolha rotulo="Mostrar unidades" opcoes={opcoes} atual={filtro} aoMudar={setFiltro} />
      {bloco && dados.podeEditar ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          {bloco.nome} · {plural(lista.filter((u) => u.ativa).length, "unidade ativa", "unidades ativas")} ·
          <Botao variante="texto" onClick={() => setJanela({ tipo: "renomear", bloco })}>Renomear bloco</Botao>·
          <Botao variante="texto" onClick={() => setJanela({ tipo: "desativar", bloco })}>Desativar bloco</Botao>
        </p>
      ) : null}
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "sem-contato" ? "Todas as unidades têm contato confirmado" : "Nenhuma unidade aqui"}>
          {filtro === "sem-contato" ? "Nada a fazer por enquanto." : "Inclua unidades neste bloco pelo botão + Unidades."}
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/moradores/unidade?id=${u.id}`} className="font-medium text-acao hover:underline">
                      {[filtro === u.blocoId ? null : nomeBloco(u.blocoId), u.identificacao].filter(Boolean).join(" · ")}
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
          Blocos desativados:
          {inativos.map((b) => (
            <Botao key={b.id} variante="texto" onClick={() => setJanela({ tipo: "reativar", bloco: b })} aria-label={`Reativar ${b.nome}`}>{b.nome}</Botao>
          ))}
        </p>
      ) : null}
      <JanelaBloco aberto={janela?.tipo === "renomear"} bloco={janela?.bloco ?? null} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={recarregar} />
      <Janela aberto={janela?.tipo === "desativar" || janela?.tipo === "reativar"}
        titulo={janela ? `${janela.tipo === "desativar" ? "Desativar" : "Reativar"} ${janela.bloco.nome}` : "Bloco"}
        campos={[]} iniciais={{}} textoBotao={janela?.tipo === "reativar" ? "Reativar bloco" : "Desativar bloco"}
        explicacao={janela?.tipo === "reativar" ? "O bloco volta a aparecer na lista." : "Só dá para desativar um bloco sem unidades ativas. Nada é apagado; dá para reativar depois."}
        aoFechar={() => setJanela(null)} recarregar={recarregar}
        aoSalvar={async () => {
          const b = janela!.bloco;
          const r = await chamarApi(`/v1/condominio/blocos/${b.id}`, { metodo: "PUT", corpo: { versao: b.versao, nome: b.nome, ativo: janela!.tipo === "reativar" } });
          if (r.ok) {
            setJanela(null);
            setFiltro("todos");
            salvo({ tom: "ok", texto: `${b.nome} ${janela!.tipo === "reativar" ? "reativado" : "desativado"}.` });
          }
          return r;
        }} />
    </div>
  );
}

/** Criar ou renomear um bloco. */
export function JanelaBloco({ aberto, bloco, aoFechar, salvo, recarregar }: {
  aberto: boolean;
  bloco: Bloco | null;
  aoFechar: () => void;
  salvo: (r: Recado) => void;
  recarregar: () => void;
}) {
  return (
    <Janela aberto={aberto} titulo={bloco ? `Renomear ${bloco.nome}` : "Novo bloco"} textoBotao={bloco ? "Salvar" : "Criar bloco"}
      explicacao={bloco ? undefined : "Torre, bloco, quadra ou prédio. Prédio sem blocos não precisa criar nenhum."}
      campos={[{ id: "nome", rotulo: "Nome do bloco", tipo: "texto", obrigatorio: true, max: 40, erro: "Escreva um nome de até 40 caracteres." }]}
      iniciais={{ nome: bloco?.nome ?? "" }} aoFechar={aoFechar} recarregar={recarregar}
      aoSalvar={async (v) => {
        const nome = String(v.nome);
        const r = bloco
          ? await chamarApi(`/v1/condominio/blocos/${bloco.id}`, { metodo: "PUT", corpo: { versao: bloco.versao, nome } })
          : await chamarApi("/v1/condominio/blocos", { corpo: { nome } });
        if (r.ok) {
          aoFechar();
          salvo({ tom: "ok", texto: bloco ? "Bloco renomeado." : `Bloco ${nome.trim()} criado. Agora inclua as unidades dele.` });
        }
        return r;
      }} />
  );
}

/** Incluir unidades: escrever a lista ou gerar pela numeração do prédio. */
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
  const ativos = dados.blocos.filter((b) => b.ativo);
  const [blocoId, setBlocoId] = useState(blocoInicial ?? "");
  const [modo, setModo] = useState<"escrever" | "gerar">("escrever");
  const [texto, setTexto] = useState("");
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState("4");
  const [porAndar, setPorAndar] = useState("4");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const lista = modo === "escrever"
    ? [...new Map(texto.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean).map((x) => [x.toLowerCase(), x])).values()]
    : gerarUnidades({ de: Number(de), ate: Number(ate), porAndar: Number(porAndar) });
  const existentes = new Set(dados.unidades.filter((u) => u.ativa && (u.blocoId ?? "") === blocoId).map((u) => u.identificacao.toLowerCase()));
  const repetidas = lista.filter((x) => existentes.has(x.toLowerCase()));
  const novas = lista.length - repetidas.length;
  const longas = lista.filter((x) => x.length > 20);
  const previa = [...lista].sort((a, b) => chaveUnidade(a).localeCompare(chaveUnidade(b)));

  async function incluir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ criadas: number; jaExistiam: string[] }>("/v1/condominio/unidades", { corpo: { blocoId: blocoId || null, identificacoes: lista } });
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
      <CampoSelecao id="u-bloco" rotulo="Bloco" value={blocoId} onChange={(e) => setBlocoId(e.target.value)}
        opcoes={[{ valor: "", texto: "Sem bloco" }, ...ativos.map((b) => ({ valor: b.id, texto: b.nome }))]} />
      <Escolha rotulo="Como incluir" atual={modo} aoMudar={setModo}
        opcoes={[{ valor: "escrever", texto: "Escrever" }, { valor: "gerar", texto: "Gerar pela numeração" }]} />
      {modo === "escrever" ? (
        <CampoAreaTexto id="u-lista" rotulo="Unidades" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)}
          ajuda="Uma por linha ou separadas por vírgula: 101, 102, Casa 3, Loja 1."
          erro={comErro.includes("identificacoes") || longas.length ? "Cada unidade com até 20 caracteres." : null} />
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
          : <>Prévia: {previa.slice(0, 6).join(", ")}{previa.length > 6 ? ` … ${previa.at(-1)}` : ""} · <strong>{plural(lista.length, "unidade", "unidades")}</strong>.{modo === "gerar" ? " Andar 0 é o térreo: 1, 2, 3." : ""}</>}
      </p>
      {repetidas.length ? (
        <p className="rounded-lg border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm text-atencao">
          {repetidas.slice(0, 5).join(", ")}{repetidas.length > 5 ? "…" : ""} {repetidas.length === 1 ? "já existe e fica como está" : "já existem e ficam como estão"}.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando || novas < 1 || longas.length > 0}>
          {enviando ? "Incluindo…" : `Incluir ${plural(Math.max(novas, 0), "unidade", "unidades")}`}
        </Botao>
      </div>
    </form>
  );
}
