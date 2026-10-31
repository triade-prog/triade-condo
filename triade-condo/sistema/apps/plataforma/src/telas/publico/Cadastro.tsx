"use client";
// Página do link de cadastro (F3.10; MU-09; quadros 222-223): sem conta, pelo celular. Três passos
// (quem é você, família e pets, enviar), só com o que o síndico pediu no link. Nada vale antes de o
// condomínio aprovar. Quem envia recebe uma chave que fica guardada neste aparelho: com ela,
// corrige até o condomínio conferir e depois vê se foi aprovado ou recusado (com o motivo). A
// chave vai no corpo do pedido, nunca no endereço.

import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  enviarCadastroSchema, ESPECIES, familiarCadastroSchema, LIGACOES_CADASTRO, MOTIVOS_RECUSA_CADASTRO, mostrarAniversario, mostrarPlaca, mostrarTelefone,
  PARENTESCOS_FAMILIAR, petCadastroSchema, PORTES, TIPOS_VEICULO, veiculoCadastroSchema,
  type Especie, type FamiliarCadastro, type LigacaoCadastro, type ParentescoFamiliar, type PetCadastro, type Porte, type TipoVeiculo, type VeiculoCadastro,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, Icone, Iniciais, Interruptor, textoDoErro, type ErroApi,
} from "@triade/ui";
import { dia } from "../pedidos/comum.tsx";
import { aniversarioDoCampo, aniversarioNoCampo, CampoAniversario, type AniversarioNoCampo } from "../moradores/FamiliaPets.tsx";
import type { CadastroPublico } from "../tipos.ts";
import { Cartao, TelaPublica, useEncerrou } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: CadastroPublico };
const RODAPE = "Link só para o cadastro do condomínio. Não precisa de conta.";
const guardada = (codigo: string) => `triade-cadastro:${codigo}`;

function lerChave(codigo: string): string | null {
  try { return window.localStorage.getItem(guardada(codigo)); } catch { return null; }
}
function guardarChave(codigo: string, chave: string | null) {
  try {
    if (chave) window.localStorage.setItem(guardada(codigo), chave);
    else window.localStorage.removeItem(guardada(codigo));
  } catch { /* sem armazenamento: a pessoa só não consegue corrigir depois */ }
}

interface Rascunho {
  unidadeId: string;
  nome: string;
  telefone: string;
  ligacao: LigacaoCadastro | "";
  email: string;
  aniversario: AniversarioNoCampo;
  familia: FamiliarCadastro[];
  pets: PetCadastro[];
  veiculos: VeiculoCadastro[];
}

function rascunhoDe(d: CadastroPublico): Rascunho {
  const e = d.envio?.estado === "ENVIADO" ? d.envio : undefined;
  return {
    unidadeId: e?.unidadeId ?? d.unidadeId ?? "",
    nome: e?.nome ?? "",
    telefone: e ? mostrarTelefone(e.telefone) : "",
    ligacao: e?.ligacao ?? "",
    email: e?.email ?? "",
    aniversario: aniversarioNoCampo(e?.aniversario),
    familia: e?.familia ?? [],
    pets: e?.pets ?? [],
    veiculos: e?.veiculos ?? [],
  };
}

const descreverFamiliar = (f: FamiliarCadastro) => `${PARENTESCOS_FAMILIAR[f.parentesco]} · ${f.mora ? "mora aqui" : "não mora aqui"}${f.aniversario ? ` · ${mostrarAniversario(f.aniversario)}` : ""}`;
const descreverPet = (p: PetCadastro) => [ESPECIES[p.especie], p.porte ? `porte ${PORTES[p.porte].toLowerCase()}` : null, p.raca].filter(Boolean).join(" · ");
const descreverVeiculo = (v: VeiculoCadastro) => [TIPOS_VEICULO[v.tipo], v.modelo].filter(Boolean).join(" · ");

export function Cadastro() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/cadastro/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [corrigindo, setCorrigindo] = useState(false);
  const encerrou = useEncerrou();

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const chave = lerChave(codigo);
      let r = chave ? await chamarApi<CadastroPublico>(`${base}/ver`, { corpo: { chave } }) : await chamarApi<CadastroPublico>(base);
      // A chave guardada não serve mais: abre como quem chega agora.
      if (!r.ok && chave && r.status === 404) {
        guardarChave(codigo, null);
        r = await chamarApi<CadastroPublico>(base);
      }
      if (!vivo) return;
      if (!r.ok && encerrou(r.erro)) return;
      setCarga(r.ok ? { estado: "pronto", dados: r.dados }
        : { estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao condomínio." : textoDoErro(r.erro) });
    })();
    return () => { vivo = false; };
  }, [base, codigo, encerrou]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Cadastro do condomínio" icone="pessoa" rodape={RODAPE}><Carregando rotulo="Abrindo o cadastro…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Cadastro do condomínio" icone="pessoa" rodape={RODAPE}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const d = carga.dados;
  const titulo = d.condominio;
  const subtitulo = d.unidade ? `Cadastro da ${d.unidade}` : "Cadastro de morador";
  const tela = (children: ReactNode) => <TelaPublica titulo={titulo} subtitulo={subtitulo} icone="pessoa" rodape={RODAPE}>{children}</TelaPublica>;

  if (d.envio && !corrigindo) return tela(<Enviado d={d} aoCorrigir={d.aberto && d.envio.estado === "ENVIADO" ? () => setCorrigindo(true) : undefined} />);
  if (!d.aberto) return tela(<Aviso tom="atencao" titulo="Este link não aceita mais cadastro">Ele venceu ou foi encerrado pelo condomínio. Se precisa se cadastrar, peça um link novo.</Aviso>);
  return tela(
    <Formulario d={d} base={base} chave={corrigindo ? lerChave(codigo) : null}
      enviado={(novo) => {
        if (novo.chave) guardarChave(codigo, novo.chave);
        setCorrigindo(false);
        setCarga({ estado: "pronto", dados: novo });
        window.scrollTo({ top: 0 });
      }} />,
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-t border-linha py-2.5 first:border-t-0">
      <dt className="t-apoio">{rotulo}</dt>
      <dd className="t-texto">{children}</dd>
    </div>
  );
}

/** O que a pessoa mandou, como o condomínio vai ver. */
function Resumo({ r, unidade }: { r: { nome: string; telefone: string; ligacao?: LigacaoCadastro | null; email?: string | null; aniversario?: { dia: number; mes: number } | null; familia: FamiliarCadastro[]; pets: PetCadastro[]; veiculos: VeiculoCadastro[] }; unidade?: string }) {
  return (
    <dl className="grid">
      {unidade ? <Linha rotulo="Unidade">{unidade}</Linha> : null}
      <Linha rotulo="Nome">{r.nome}</Linha>
      <Linha rotulo="Telefone"><span className="t-codigo">{mostrarTelefone(r.telefone)}</span></Linha>
      {r.ligacao ? <Linha rotulo="Ligação">{LIGACOES_CADASTRO[r.ligacao]}</Linha> : null}
      {r.email ? <Linha rotulo="E-mail">{r.email}</Linha> : null}
      {r.aniversario ? <Linha rotulo="Aniversário">{mostrarAniversario(r.aniversario)}</Linha> : null}
      {r.familia.length ? <Linha rotulo="Família">{r.familia.map((f) => `${f.nome}, ${PARENTESCOS_FAMILIAR[f.parentesco].toLowerCase()}`).join("; ")}</Linha> : null}
      {r.pets.length ? <Linha rotulo="Pets">{r.pets.map((p) => `${p.nome} (${ESPECIES[p.especie].toLowerCase()})`).join("; ")}</Linha> : null}
      {r.veiculos.length ? <Linha rotulo="Veículos">{r.veiculos.map((v) => `${mostrarPlaca(v.placa)}${v.modelo ? `, ${v.modelo}` : ""}`).join("; ")}</Linha> : null}
    </dl>
  );
}

function Enviado({ d, aoCorrigir }: { d: CadastroPublico; aoCorrigir?: () => void }) {
  const e = d.envio!;
  if (e.estado === "RECUSADO") {
    return (
      <Aviso tom="atencao" titulo="O condomínio não aprovou este cadastro">
        Motivo: {e.motivo ? MOTIVOS_RECUSA_CADASTRO[e.motivo].toLowerCase() : "não informado"}.{e.explicacao ? ` ${e.explicacao}` : ""} Os dados que você mandou foram apagados.
        {d.aberto ? " Se foi engano, fale com o condomínio." : ""}
      </Aviso>
    );
  }
  return (
    <>
      {e.estado === "APROVADO" ? (
        <Aviso tom="ok" titulo="Cadastro aprovado">Você já está no cadastro do condomínio e passa a receber os avisos do prédio por este número.</Aviso>
      ) : (
        <Aviso tom="ok" titulo="Cadastro enviado">O condomínio confere. Quando aprovar, você passa a receber os avisos do prédio por este número.</Aviso>
      )}
      <Cartao>
        <h2 className="t-titulo-secao font-medium">O que você mandou</h2>
        <Resumo r={e} unidade={d.unidade ? undefined : e.unidade} />
      </Cartao>
      {aoCorrigir ? (
        <div className="grid gap-2 px-1">
          <p className="t-apoio">Até o condomínio conferir, você pode corrigir por este mesmo link, neste aparelho.</p>
          <Botao variante="contorno" className="justify-self-start" onClick={aoCorrigir}><Icone nome="editar" />Corrigir algo</Botao>
        </div>
      ) : null}
    </>
  );
}

const PASSOS = ["Quem é você", "Família e pets", "Enviar"] as const;
const DO_PASSO_1 = ["unidadeId", "nome", "telefone", "ligacao", "email", "aniversario"];

function Passos({ atual, total, nomes }: { atual: number; total: number; nomes: readonly string[] }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-linha bg-superficie px-4 py-3.5">
      <span className="t-apoio font-semibold text-tinta-suave">Passo {atual} de {total}</span>
      <div className="passos" role="progressbar" aria-label={`Passo ${atual} de ${total}`} aria-valuemin={1} aria-valuemax={total} aria-valuenow={atual}
        aria-valuetext={`Passo ${atual} de ${total}: ${nomes[atual - 1]}`}>
        {nomes.map((t, i) => <span key={t} data-feito={i < atual ? "" : undefined} />)}
      </div>
      <ol className="flex gap-1.5 t-apoio" aria-hidden="true">
        {nomes.map((t, i) => (
          <li key={t} className={`flex flex-1 items-center gap-0.5 ${i + 1 === atual ? "font-bold text-tinta" : i + 1 < atual ? "text-violeta-700" : "text-tinta-suave"}`}>
            {i + 1 < atual ? <Icone nome="check" className="h-3 w-3" /> : null}{t}
          </li>
        ))}
      </ol>
    </section>
  );
}

type Item = { tipo: "familia"; i: number | null } | { tipo: "pets"; i: number | null } | { tipo: "veiculos"; i: number | null };

function Formulario({ d, base, chave, enviado }: { d: CadastroPublico; base: string; chave: string | null; enviado: (r: CadastroPublico) => void }) {
  const corrigindo = chave !== null;
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(d));
  const [passo, setPasso] = useState(1);
  const [campos, setCampos] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const pede = new Set(d.pede);
  const temPasso2 = pede.has("FAMILIA") || pede.has("PETS") || pede.has("VEICULOS");
  const nomes = temPasso2 ? PASSOS : ([PASSOS[0], PASSOS[2]] as const);
  const ultimo = nomes.length;
  const muda = (x: Partial<Rascunho>) => setR({ ...r, ...x });
  const encerrou = useEncerrou();

  const corpo = () => ({
    unidadeId: r.unidadeId || null,
    nome: r.nome,
    telefone: r.telefone,
    ligacao: pede.has("LIGACAO") ? r.ligacao || null : null,
    email: pede.has("EMAIL") ? r.email : null,
    aniversario: pede.has("ANIVERSARIO") ? aniversarioDoCampo(r.aniversario) : null,
    familia: pede.has("FAMILIA") ? r.familia : [],
    pets: pede.has("PETS") ? r.pets : [],
    veiculos: pede.has("VEICULOS") ? r.veiculos : [],
  });

  function continuar() {
    const v = enviarCadastroSchema.safeParse(corpo());
    const ruins = v.success ? [] : v.error.issues.map((i) => String(i.path[0])).filter((c) => DO_PASSO_1.includes(c));
    if (!d.unidadeId && !r.unidadeId) ruins.push("unidadeId");
    if (pede.has("LIGACAO") && !r.ligacao) ruins.push("ligacao");
    if (Boolean(r.aniversario.dia) !== Boolean(r.aniversario.mes)) ruins.push("aniversario");
    setCampos(ruins);
    if (ruins.length === 0) { setPasso(2); window.scrollTo({ top: 0 }); }
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<CadastroPublico>(base, { corpo: { ...corpo(), ...(chave ? { chave } : {}) } });
    setEnviando(false);
    if (!res.ok) {
      if (encerrou(res.erro)) return;
      setErro(res.erro);
      const c = camposComErro(res.erro);
      setCampos(c);
      if (c.some((x) => DO_PASSO_1.includes(x))) setPasso(1);
      return;
    }
    enviado(res.dados);
  }

  const comErro = (c: string) => campos.includes(c);
  return (
    <>
      <Passos atual={passo} total={ultimo} nomes={nomes} />
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {corrigindo && passo === 1 ? <Aviso tom="info">Você está corrigindo o cadastro que já mandou. O que mudar substitui o anterior.</Aviso> : null}

      {passo === 1 ? (
        <Cartao className="gap-4">
          <h2 className="t-titulo-secao font-medium">Quem é você</h2>
          {d.unidades ? (
            <CampoSelecao id="cad-unidade" rotulo="Sua unidade" value={r.unidadeId} onChange={(e) => muda({ unidadeId: e.target.value })}
              erro={comErro("unidadeId") ? "Escolha a sua unidade." : null}
              opcoes={[{ valor: "", texto: "Escolha a unidade" }, ...d.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]} />
          ) : null}
          <CampoTexto id="cad-nome" rotulo="Nome" required autoComplete="name" maxLength={120} value={r.nome} onChange={(e) => muda({ nome: e.target.value })}
            erro={comErro("nome") ? "Escreva o seu nome (até 120 caracteres)." : null} />
          <CampoTexto id="cad-telefone" rotulo="Telefone (WhatsApp)" required icone="telefone" inputMode="tel" autoComplete="tel" value={r.telefone}
            onChange={(e) => muda({ telefone: e.target.value })} ajuda="É por ele que o condomínio vai falar com você."
            erro={comErro("telefone") ? "Confira o número, com DDD." : null} />
          {pede.has("LIGACAO") ? (
            <CampoSelecao id="cad-ligacao" rotulo="Sua ligação com a unidade" value={r.ligacao} onChange={(e) => muda({ ligacao: e.target.value as LigacaoCadastro })}
              erro={comErro("ligacao") ? "Escolha a sua ligação com a unidade." : null}
              opcoes={[{ valor: "", texto: "Escolha" }, ...(Object.keys(LIGACOES_CADASTRO) as LigacaoCadastro[]).map((v) => ({ valor: v, texto: LIGACOES_CADASTRO[v] }))]} />
          ) : null}
          {pede.has("EMAIL") ? (
            <CampoTexto id="cad-email" rotulo="E-mail" opcional type="email" autoComplete="email" maxLength={254} value={r.email} onChange={(e) => muda({ email: e.target.value })}
              erro={comErro("email") ? "Confira o e-mail." : null} />
          ) : null}
          {pede.has("ANIVERSARIO") ? <CampoAniversario id="cad-aniversario" valor={r.aniversario} aoMudar={(aniversario) => muda({ aniversario })} erro={comErro("aniversario")} /> : null}
          <Botao className="w-full" onClick={continuar}>Continuar<Icone nome="dir" /></Botao>
          <p className="t-apoio">Os dados vão só para o condomínio, para falar com você sobre o prédio. Ninguém de fora vê. Este link vale até {dia(d.expiraEm)}.</p>
        </Cartao>
      ) : null}

      {passo === 2 && temPasso2 ? (
        <>
          {pede.has("FAMILIA") ? (
            <ListaItens titulo="Família" apoio="Quem mora com você e não vai falar com o condomínio. Sem telefone." vazio="Ninguém da família incluído." textoIncluir="Incluir familiar"
              itens={r.familia.map((f) => ({ nome: f.nome, apoio: descreverFamiliar(f), iniciais: true }))} erro={comErro("familia")}
              aoIncluir={() => setItem({ tipo: "familia", i: null })} aoEditar={(i) => setItem({ tipo: "familia", i })} aoTirar={(i) => muda({ familia: r.familia.filter((_, j) => j !== i) })} max={10} />
          ) : null}
          {pede.has("PETS") ? (
            <ListaItens titulo="Pets" vazio="Nenhum pet incluído." textoIncluir="Incluir pet" icone="pata"
              itens={r.pets.map((p) => ({ nome: p.nome, apoio: descreverPet(p) }))} erro={comErro("pets")}
              aoIncluir={() => setItem({ tipo: "pets", i: null })} aoEditar={(i) => setItem({ tipo: "pets", i })} aoTirar={(i) => muda({ pets: r.pets.filter((_, j) => j !== i) })} max={10} />
          ) : null}
          {pede.has("VEICULOS") ? (
            <ListaItens titulo="Veículos" vazio="Nenhum veículo incluído." textoIncluir="Incluir veículo" icone="pin"
              itens={r.veiculos.map((v) => ({ nome: mostrarPlaca(v.placa), apoio: descreverVeiculo(v) }))} erro={comErro("veiculos")}
              aoIncluir={() => setItem({ tipo: "veiculos", i: null })} aoEditar={(i) => setItem({ tipo: "veiculos", i })} aoTirar={(i) => muda({ veiculos: r.veiculos.filter((_, j) => j !== i) })} max={5} />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="contorno" onClick={() => setPasso(1)}><Icone nome="esq" />Voltar</Botao>
            <Botao onClick={() => { setPasso(3); window.scrollTo({ top: 0 }); }}>Continuar<Icone nome="dir" /></Botao>
          </div>
          {r.familia.length + r.pets.length + r.veiculos.length === 0 ? (
            <Botao variante="discreto" className="justify-self-center" onClick={() => setPasso(3)}>
              Não tenho {[pede.has("FAMILIA") ? "família" : null, pede.has("PETS") ? "pet" : null, pede.has("VEICULOS") ? "veículo" : null].filter(Boolean).join(" nem ")} para incluir
            </Botao>
          ) : null}
        </>
      ) : null}

      {passo === ultimo && passo > 1 ? (
        <>
          <Cartao>
            <h2 className="t-titulo-secao font-medium">Confira e envie</h2>
            <Resumo r={{ ...corpo(), aniversario: aniversarioDoCampo(r.aniversario) }} unidade={d.unidade ?? d.unidades?.find((u) => u.id === r.unidadeId)?.nome} />
            <p className="t-apoio">O condomínio confere antes de valer. Até lá, você pode corrigir por este mesmo link.</p>
          </Cartao>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="contorno" onClick={() => setPasso(ultimo - 1)}><Icone nome="esq" />Voltar</Botao>
            <Botao disabled={enviando} onClick={() => void enviar()}><Icone nome="enviar" />{enviando ? "Enviando…" : corrigindo ? "Enviar correção" : "Enviar"}</Botao>
          </div>
        </>
      ) : null}

      {item?.tipo === "familia" ? (
        <JanelaFamiliar inicial={item.i === null ? null : r.familia[item.i]!} aoFechar={() => setItem(null)}
          aoSalvar={(f) => { muda({ familia: item.i === null ? [...r.familia, f] : r.familia.map((x, j) => (j === item.i ? f : x)) }); setItem(null); }} />
      ) : null}
      {item?.tipo === "pets" ? (
        <JanelaPet inicial={item.i === null ? null : r.pets[item.i]!} aoFechar={() => setItem(null)}
          aoSalvar={(p) => { muda({ pets: item.i === null ? [...r.pets, p] : r.pets.map((x, j) => (j === item.i ? p : x)) }); setItem(null); }} />
      ) : null}
      {item?.tipo === "veiculos" ? (
        <JanelaVeiculo inicial={item.i === null ? null : r.veiculos[item.i]!} aoFechar={() => setItem(null)}
          aoSalvar={(v) => { muda({ veiculos: item.i === null ? [...r.veiculos, v] : r.veiculos.map((x, j) => (j === item.i ? v : x)) }); setItem(null); }} />
      ) : null}
    </>
  );
}

function ListaItens({ titulo, apoio, vazio, textoIncluir, itens, icone, erro, max, aoIncluir, aoEditar, aoTirar }: {
  titulo: string; apoio?: string; vazio: string; textoIncluir: string; itens: { nome: string; apoio: string; iniciais?: boolean }[]; icone?: "pata" | "pin"; erro: boolean; max: number;
  aoIncluir: () => void; aoEditar: (i: number) => void; aoTirar: (i: number) => void;
}) {
  return (
    <Cartao className="gap-3">
      <h2 className="t-titulo-secao font-medium">{titulo}</h2>
      {apoio ? <p className="t-apoio">{apoio}</p> : null}
      {itens.length === 0 ? <p className="t-apoio text-tinta-suave">{vazio}</p> : (
        <ul className="grid gap-2" aria-label={titulo}>
          {itens.map((x, i) => (
            <li key={`${x.nome}-${i}`} className="flex items-center gap-3 rounded-[14px] border border-linha px-3 py-2.5">
              {x.iniciais ? <Iniciais nome={x.nome} className="h-10 w-10 border border-dashed border-contorno !bg-superficie" />
                : <span className="ladrilho h-10 w-10" aria-hidden="true"><Icone nome={icone ?? "pata"} /></span>}
              <span className="grid min-w-0 flex-1"><span className="font-medium">{x.nome}</span><span className="t-apoio">{x.apoio}</span></span>
              <Botao variante="contorno" tamanho="m" soIcone aria-label={`Editar ${x.nome}`} onClick={() => aoEditar(i)}><Icone nome="editar" /></Botao>
              <Botao variante="contorno" tamanho="m" soIcone aria-label={`Tirar ${x.nome}`} onClick={() => aoTirar(i)}><Icone nome="fechar" /></Botao>
            </li>
          ))}
        </ul>
      )}
      {erro ? <p role="alert" className="t-apoio text-erro">Confira os itens da lista.</p> : null}
      {itens.length < max ? <Botao variante="contorno" className="justify-self-start" onClick={aoIncluir}><Icone nome="mais" />{textoIncluir}</Botao> : null}
    </Cartao>
  );
}

function JanelaItem({ titulo, aoFechar, aoOk, children }: { titulo: string; aoFechar: () => void; aoOk: () => void; children: ReactNode }) {
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      <form noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aoOk(); }}>
        {children}
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit">Pronto</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaFamiliar({ inicial, aoFechar, aoSalvar }: { inicial: FamiliarCadastro | null; aoFechar: () => void; aoSalvar: (f: FamiliarCadastro) => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [parentesco, setParentesco] = useState<ParentescoFamiliar>(inicial?.parentesco ?? "FILHO");
  const [mora, setMora] = useState(inicial?.mora ?? true);
  const [aniversario, setAniversario] = useState(aniversarioNoCampo(inicial?.aniversario));
  const [ruins, setRuins] = useState<string[]>([]);
  return (
    <JanelaItem titulo={inicial ? `Editar ${inicial.nome}` : "Incluir familiar"} aoFechar={aoFechar} aoOk={() => {
      const v = familiarCadastroSchema.safeParse({ nome, parentesco, mora, aniversario: aniversarioDoCampo(aniversario) });
      if (!v.success || Boolean(aniversario.dia) !== Boolean(aniversario.mes)) return setRuins(v.success ? ["aniversario"] : v.error.issues.map((i) => String(i.path[0])));
      aoSalvar(v.data);
    }}>
      <CampoTexto id="cf-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} erro={ruins.includes("nome") ? "Escreva o nome." : null} />
      <CampoSelecao id="cf-parentesco" rotulo="Parentesco com você" value={parentesco} onChange={(e) => setParentesco(e.target.value as ParentescoFamiliar)}
        opcoes={Object.entries(PARENTESCOS_FAMILIAR).map(([valor, texto]) => ({ valor, texto }))} />
      <Interruptor id="cf-mora" rotulo="Mora na unidade" marcado={mora} aoMudar={setMora} />
      <CampoAniversario id="cf-aniversario" valor={aniversario} aoMudar={setAniversario} erro={ruins.includes("aniversario")} />
    </JanelaItem>
  );
}

function JanelaPet({ inicial, aoFechar, aoSalvar }: { inicial: PetCadastro | null; aoFechar: () => void; aoSalvar: (p: PetCadastro) => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [especie, setEspecie] = useState<Especie>(inicial?.especie ?? "CAO");
  const [porte, setPorte] = useState<Porte | "">(inicial?.porte ?? "");
  const [raca, setRaca] = useState(inicial?.raca ?? "");
  const [ruins, setRuins] = useState<string[]>([]);
  return (
    <JanelaItem titulo={inicial ? `Editar ${inicial.nome}` : "Incluir pet"} aoFechar={aoFechar} aoOk={() => {
      const v = petCadastroSchema.safeParse({ nome, especie, porte: porte || null, raca });
      if (!v.success) return setRuins(v.error.issues.map((i) => String(i.path[0])));
      aoSalvar(v.data);
    }}>
      <CampoTexto id="cp-nome" rotulo="Nome" required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} erro={ruins.includes("nome") ? "Escreva o nome." : null} />
      <CampoSelecao id="cp-especie" rotulo="Espécie" value={especie} onChange={(e) => setEspecie(e.target.value as Especie)}
        opcoes={Object.entries(ESPECIES).map(([valor, texto]) => ({ valor, texto }))} />
      <CampoSelecao id="cp-porte" rotulo="Porte" opcional value={porte} onChange={(e) => setPorte(e.target.value as Porte | "")}
        opcoes={[{ valor: "", texto: "Não informar" }, ...Object.entries(PORTES).map(([valor, texto]) => ({ valor, texto }))]} />
      <CampoTexto id="cp-raca" rotulo="Raça" opcional maxLength={60} value={raca} onChange={(e) => setRaca(e.target.value)} erro={ruins.includes("raca") ? "De 2 a 60 caracteres." : null} />
    </JanelaItem>
  );
}

function JanelaVeiculo({ inicial, aoFechar, aoSalvar }: { inicial: VeiculoCadastro | null; aoFechar: () => void; aoSalvar: (v: VeiculoCadastro) => void }) {
  const [placa, setPlaca] = useState(inicial ? mostrarPlaca(inicial.placa) : "");
  const [tipo, setTipo] = useState<TipoVeiculo>(inicial?.tipo ?? "CARRO");
  const [modelo, setModelo] = useState(inicial?.modelo ?? "");
  const [ruins, setRuins] = useState<string[]>([]);
  return (
    <JanelaItem titulo={inicial ? `Editar ${mostrarPlaca(inicial.placa)}` : "Incluir veículo"} aoFechar={aoFechar} aoOk={() => {
      const v = veiculoCadastroSchema.safeParse({ placa, tipo, modelo });
      if (!v.success) return setRuins(v.error.issues.map((i) => String(i.path[0])));
      aoSalvar(v.data);
    }}>
      <CampoTexto id="cv-placa" rotulo="Placa" required maxLength={10} autoCapitalize="characters" value={placa} onChange={(e) => setPlaca(e.target.value)}
        erro={ruins.includes("placa") ? "Placa Mercosul (ABC1D23) ou antiga (ABC-1234)." : null} />
      <CampoSelecao id="cv-tipo" rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVeiculo)}
        opcoes={Object.entries(TIPOS_VEICULO).map(([valor, texto]) => ({ valor, texto }))} />
      <CampoTexto id="cv-modelo" rotulo="Modelo e cor" opcional maxLength={60} value={modelo} onChange={(e) => setModelo(e.target.value)}
        ajuda="Por exemplo: Onix prata." erro={ruins.includes("modelo") ? "De 2 a 60 caracteres." : null} />
    </JanelaItem>
  );
}
