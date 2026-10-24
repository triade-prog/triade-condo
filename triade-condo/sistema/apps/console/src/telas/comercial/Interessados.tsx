"use client";
// Interessados (CM-01 a CM-05, CM-14; quadros 320, 321 e 322, aprovados em 24/10/2026): quem pediu
// demonstração no site ou falou com a TRÍADE e ainda não é cliente. Interno: o síndico nunca vê.
// No computador, a lista (ordem: atrasados, hoje, sem próximo passo, em dia) ou o quadro do funil,
// com a escolha guardada no aparelho; no celular, o Meu dia. Arrastar um cartão no quadro pede o
// mesmo que a ficha: se faltar o que a etapa pede, abre a ficha.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type DragEvent } from "react";
import { COLUNAS_QUADRO, ETAPAS_ABERTAS, type EtapaComercial } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoTexto, chamarApi, ErroCarregar, Icone, textoDoErro, Vazio } from "@triade/ui";
import { AbasLista, CabecaPagina, CaixaLista, CLASSE_LINHA, CLASSE_LINK_LINHA, MenuAcoes, plural, useCelular, type ItemMenu } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { linhaInteressado, nomeEtapa, nomeOrigem, ROTAS_COMERCIAL, SeloEtapa, SelosAtencao, textoTarefa, TOM_SITUACAO } from "./comum.tsx";
import { JanelaImportar, JanelaNovoInteressado, exportarCsv } from "./janelas.tsx";
import { MeuDia } from "./MeuDia.tsx";
import type { Interessado, ListaComercial } from "./tipos.ts";

type Filtro = "atencao" | "abertos" | EtapaComercial | "ganhos" | "perdidos";
type Vista = "lista" | "quadro";
const CHAVE_VISTA = "triade.comercial.vista";

function lerVista(): Vista {
  try { return localStorage.getItem(CHAVE_VISTA) === "quadro" ? "quadro" : "lista"; } catch { return "lista"; }
}

function assinarVista(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_20px]";

function aceita(f: Filtro, i: Interessado): boolean {
  const aberto = ETAPAS_ABERTAS.includes(i.etapa);
  if (f === "atencao") return aberto && i.atencao;
  if (f === "abertos") return aberto;
  if (f === "ganhos") return i.etapa === "GANHO";
  if (f === "perdidos") return i.etapa === "PERDIDO" || i.etapa === "SEM_RESPOSTA";
  if (f === "DEMO_MARCADA") return i.etapa === "DEMO_MARCADA" || i.etapa === "DEMO_FEITA";
  return i.etapa === f;
}

function Linha({ i }: { i: Interessado }) {
  return (
    <li className={`${CLASSE_LINHA} ${COLUNAS}`}>
      <span className="ladrilho self-start md:self-center" data-tom={i.atencao ? "laranja" : "violeta"} aria-hidden="true"><Icone nome="predio" /></span>
      <span className="grid min-w-0 justify-items-start gap-1">
        <Link href={`/comercial/${i.id}`} className={CLASSE_LINK_LINHA}>{i.condominio}</Link>
        <span className="t-apoio">{linhaInteressado(i) || "Sem contato"}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 max-md:col-span-2 max-md:col-start-2 md:grid md:justify-items-start">
        <SeloEtapa etapa={i.etapa} />
        <span className="t-apoio">Origem: {nomeOrigem(i)}</span>
      </span>
      <span className="grid min-w-0 justify-items-start gap-1 max-md:col-span-2 max-md:col-start-2">
        <span className="t-texto" data-tom={TOM_SITUACAO[i.tarefa.situacao]}>{textoTarefa(i)}</span>
        <span className="flex flex-wrap gap-1.5"><SelosAtencao i={i} /></span>
        {i.ultimaConversa ? <span className="t-apoio [overflow-wrap:anywhere]">{i.ultimaConversa.resumo}</span> : null}
      </span>
      <span className="t-apoio max-md:col-span-2 max-md:col-start-2">{i.responsavel?.nome ?? "Sem responsável"}</span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
    </li>
  );
}

function Cartao({ i, aoArrastar }: { i: Interessado; aoArrastar: (id: string) => void }) {
  return (
    <li draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", i.id); aoArrastar(i.id); }}
      className="relative grid gap-1.5 rounded-[14px] border border-linha bg-superficie p-3 shadow-s1 hover:border-violeta-300">
      <Link href={`/comercial/${i.id}`} className={CLASSE_LINK_LINHA}>{i.condominio}</Link>
      <span className="t-apoio">{[i.faixa ? linhaInteressado({ ...i, pessoa: undefined, cidade: undefined, uf: undefined }) : null, nomeOrigem(i)].filter(Boolean).join(" · ")}</span>
      <span className="t-apoio">{textoTarefa(i)}</span>
      <span className="flex flex-wrap gap-1.5"><SelosAtencao i={i} /></span>
      <span className="t-apoio text-tinta-suave">{i.responsavel?.nome ?? "Sem responsável"}</span>
    </li>
  );
}

function Quadro({ d, recarregar }: { d: ListaComercial; recarregar: () => void }) {
  const router = useRouter();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const abertos = d.interessados.filter((i) => ETAPAS_ABERTAS.includes(i.etapa));
  const chance = (e: EtapaComercial) => d.etapas.find((x) => x.etapa === e)?.probabilidade;

  async function soltar(e: DragEvent, etapas: EtapaComercial[]) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || arrastando;
    setArrastando(null);
    const i = abertos.find((x) => x.id === id);
    if (!i || etapas.includes(i.etapa) || !d.podeEditar) return;
    const r = await chamarApi(ROTAS_COMERCIAL.etapa(i.id), { corpo: { versao: i.versao, etapa: etapas[0] } });
    if (r.ok) return recarregar();
    if (r.erro.detalhes?.motivo === "FALTA_PARA_ETAPA") return router.push(`/comercial/${i.id}?etapa=${etapas[0]}`);
    setErro(textoDoErro(r.erro));
  }

  return (
    <div className="grid gap-3">
      {erro ? <Aviso tom="erro" papel="alert">{erro}</Aviso> : null}
      <div className="grid grid-cols-6 gap-3 overflow-x-auto" role="list" aria-label="Funil comercial">
        {COLUNAS_QUADRO.map((col) => {
          const doCol = abertos.filter((i) => col.etapas.includes(i.etapa));
          return (
            <section key={col.titulo} role="listitem" aria-label={col.titulo} onDragOver={(e) => e.preventDefault()} onDrop={(e) => void soltar(e, col.etapas)}
              className="grid min-w-44 content-start gap-2 rounded-[18px] border border-linha bg-violeta-50/40 p-3">
              <h3 className="flex items-center justify-between gap-2 t-titulo-cartao">{col.titulo}<span className="t-codigo">{doCol.length}</span></h3>
              <span className="t-apoio">Chance de fechar: {chance(col.etapas[0]!) ?? 0}%</span>
              <ul className="grid gap-2">{doCol.map((i) => <Cartao key={i.id} i={i} aoArrastar={setArrastando} />)}</ul>
            </section>
          );
        })}
      </div>
      <p className="t-apoio">
        {`Ganho: ${d.contagens.porEtapa.GANHO ?? 0} neste mês · Perdido: ${d.contagens.porEtapa.PERDIDO ?? 0} neste mês · Sem resposta: ${d.contagens.porEtapa.SEM_RESPOSTA ?? 0} neste mês`}
      </p>
    </div>
  );
}

function Computador() {
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const carga = useCarregar<ListaComercial>(`${ROTAS_COMERCIAL.lista}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const guardada = useSyncExternalStore(assinarVista, lerVista, () => "lista" as Vista);
  const [escolhida, setEscolhida] = useState<Vista | null>(null);
  const vista = escolhida ?? guardada;
  const [janela, setJanela] = useState<"novo" | "importar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const mudarVista = (v: Vista) => {
    setEscolhida(v);
    try { localStorage.setItem(CHAVE_VISTA, v); } catch { /* sem armazenamento */ }
  };

  const d = carga.estado === "pronto" ? carga.dados : null;
  const todos = d?.interessados ?? [];
  const abas: { valor: Filtro; texto: string }[] = [
    { valor: "atencao", texto: "Pede atenção" }, { valor: "abertos", texto: "Abertos" },
    ...(["NOVO", "EM_CONTATO", "DEMO_MARCADA", "PROPOSTA_ENVIADA", "NEGOCIACAO", "APROVACAO"] as const).map((e) => ({
      valor: e as Filtro, texto: e === "DEMO_MARCADA" ? "Demonstração" : e === "PROPOSTA_ENVIADA" ? "Proposta" : e === "APROVACAO" ? "Aprovação" : nomeEtapa(e),
    })),
    { valor: "ganhos", texto: "Ganhos" }, { valor: "perdidos", texto: "Perdidos" },
  ];
  const conta = (f: Filtro) => todos.filter((i) => aceita(f, i)).length;
  const naAba = todos.filter((i) => aceita(filtro, i));
  const mais: ItemMenu[] = d?.podeExportar ? [{ texto: "Exportar a lista (CSV)", icone: "baixar", acao: () => void exportarCsv(setAviso) }] : [];

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Interessados" apoio="Quem pediu demonstração no site ou falou com a TRÍADE e ainda não é cliente. Interno: o síndico não vê esta tela."
        acao={d?.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={() => setJanela("importar")}><Icone nome="documento" />Importar planilha</Botao>
            <Botao onClick={() => setJanela("novo")}><Icone nome="mais" />Novo interessado</Botao>
            <MenuAcoes rotulo="Mais ações do Comercial" texto="Mais" itens={mais} />
          </div>
        ) : undefined} />
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Como ver">
        <Botao variante={vista === "lista" ? "secundario" : "discreto"} aria-pressed={vista === "lista"} onClick={() => mudarVista("lista")}><Icone nome="lista" />Lista</Botao>
        <Botao variante={vista === "quadro" ? "secundario" : "discreto"} aria-pressed={vista === "quadro"} onClick={() => mudarVista("quadro")}><Icone nome="camadas" />Quadro</Botao>
      </div>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d && todos.length === 0 && !q ? (
        <Vazio titulo="Nenhum interessado ainda" icone="pessoas"
          acao={d.podeEditar ? <Botao onClick={() => setJanela("novo")}><Icone nome="mais" />Novo interessado</Botao> : undefined}>
          Quem pedir demonstração no site aparece aqui. Também dá para registrar à mão.
        </Vazio>
      ) : null}
      {d && (todos.length > 0 || q) && vista === "quadro" ? <Quadro d={d} recarregar={carga.recarregar} /> : null}
      {d && (todos.length > 0 || q) && vista === "lista" ? (
        <CaixaLista titulo="Interessados do comercial" colunas={COLUNAS} cabecalho={naAba.length ? ["", "Interessado", "Etapa", "Próximo passo", "Responsável", ""] : undefined}
          abas={(
            <>
              <div role="search" className="pb-3 md:p-5 md:pb-2">
                <CampoTexto id="busca-interessados" rotulo="Buscar interessado" className="[&_label]:sr-only" icone="busca" type="search" maxLength={60}
                  placeholder="Buscar pelo condomínio, pela pessoa ou pelo WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <AbasLista rotulo="Filtrar os interessados" atual={filtro} aoMudar={setFiltro} abas={abas.map((a) => ({ ...a, n: conta(a.valor) }))} />
            </>
          )}
          rodape={naAba.length ? (
            <>
              <span className="t-apoio">{`${plural(d.contagens.abertos, "aberto", "abertos")} · ${d.contagens.atencao} pedem atenção (primeiro retorno vencendo, próximo passo atrasado ou negócio parado)`}</span>
              <span className="t-apoio">O mesmo WhatsApp, e-mail ou CNPJ junta no mesmo interessado.</span>
            </>
          ) : undefined}>
          {naAba.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={q ? `Nenhum interessado com "${q}"` : "Nenhum interessado neste filtro"} icone="busca">
                {q ? "Confira o nome, a pessoa ou o número." : filtro === "atencao" ? "Nada pede atenção agora." : undefined}
              </Vazio>
            </div>
          ) : (
            <ul className="grid max-md:gap-3 max-md:pt-3">{naAba.map((i) => <Linha key={i.id} i={i} />)}</ul>
          )}
        </CaixaLista>
      ) : null}
      {janela === "novo" && d ? (
        <JanelaNovoInteressado equipe={d.equipe} aoFechar={() => setJanela(null)}
          feito={(id, juntado) => { setJanela(null); router.push(`/comercial/${id}${juntado ? "?juntado=1" : ""}`); }} />
      ) : null}
      {janela === "importar" ? (
        <JanelaImportar aoFechar={() => setJanela(null)} feito={(texto) => { setJanela(null); setAviso(texto); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}

export function Interessados() {
  const celular = useCelular();
  return celular ? <MeuDia /> : <Computador />;
}
