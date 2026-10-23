"use client";
// Pessoas e a confirmar (MU-02, PT-17; DC15, telas-modelo moradores-pessoas e moradores-confirmar):
// busca por nome, unidade ou telefone, em páginas. O que veio da planilha espera o síndico:
// marcar e confirmar vários de uma vez, ou recusar pelo menu de cada pessoa quem ele não
// reconhece. Contato a confirmar não acessa nada. O atalho "sem e-mail confirmado" mostra quem
// ainda não recebe por e-mail (CD-13); "sem WhatsApp para comunicados", quem não aceitou receber
// pelo WhatsApp do condomínio (F6.6). No celular, cada pessoa é um cartão. O que chegou pelo link de
// cadastro (F3.10; MU-09) entra na mesma aba, com o selo Pelo link e Conferir; Veio de separa o
// link da planilha, e Pendentes, no menu da unidade, abre a aba já com a unidade escolhida.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { mostrarTelefone, nomeDaUnidade, SITUACOES_COMUNICADOS_WHATSAPP, SITUACOES_EMAIL } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Iniciais, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { CadastroLink, FilaCadastros, ListaMoradores, MoradorDaLista, Recado } from "../tipos.ts";
import { MenuAcoes, nomeRelacao, SeloEstado } from "./comum.tsx";
import { ConferirCadastro, RecusarCadastro, resumoCadastro } from "./LinkCadastro.tsx";

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.6fr)_170px_minmax(0,1fr)_120px_20px]";
const COLUNAS_CONFIRMAR = "md:grid-cols-[24px_40px_minmax(0,1.6fr)_170px_minmax(0,1fr)_104px]";
const COLUNAS_LINK = "md:grid-cols-[40px_minmax(0,1.6fr)_170px_minmax(0,1fr)_104px]";

function detalhe(i: MoradorDaLista, whatsappLigado: boolean): string {
  return [nomeRelacao(i.relacao), i.principal ? "responsável" : null, i.origem === "PLANILHA" ? "veio da planilha" : null,
    i.emailSituacao ? SITUACOES_EMAIL[i.emailSituacao].toLowerCase() : null,
    whatsappLigado && i.comunicadosWhatsapp ? `WhatsApp: ${SITUACOES_COMUNICADOS_WHATSAPP[i.comunicadosWhatsapp]}` : null].filter(Boolean).join(" · ");
}

export function ListaContatos({ estado, salvo, buscaInicial = "", unidade }: { estado?: "PENDENTE"; salvo: (r: Recado) => void; buscaInicial?: string; unidade?: string }) {
  const [texto, setTexto] = useState(buscaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const [pagina, setPagina] = useState(1);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [recusar, setRecusar] = useState<MoradorDaLista | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sem, setSem] = useState<"SEM_EMAIL" | "SEM_WHATSAPP" | null>(null);
  const [veio, setVeio] = useState<"LINK" | "PLANILHA" | null>(null);
  const [conferir, setConferir] = useState<{ c: CadastroLink; recusar: boolean } | null>(null);
  const filtro = estado ?? sem ?? undefined;
  const aConfirmar = estado === "PENDENTE";
  const daUnidade = aConfirmar && unidade ? unidade : undefined;
  const qs = new URLSearchParams({ pagina: String(pagina), ...(busca ? { busca } : {}), ...(filtro ? { estado: filtro } : {}), ...(daUnidade ? { unidade: daUnidade } : {}) });
  const carga = useCarregar<ListaMoradores>(`/v1/condominio/moradores?${qs}`);
  const fila = useCarregar<FilaCadastros>(aConfirmar ? `/v1/condominio/cadastros-link${daUnidade ? `?unidade=${daUnidade}` : ""}` : null);

  // A busca vale um instante depois de parar de escrever, ou na hora com Enter.
  useEffect(() => {
    const q = texto.trim();
    if (q === busca) return;
    const t = setTimeout(() => { setBusca(q); setPagina(1); setMarcados([]); }, 350);
    return () => clearTimeout(t);
  }, [texto, busca]);

  function buscar(ev: FormEvent) {
    ev.preventDefault();
    setBusca(texto.trim());
    setPagina(1);
    setMarcados([]);
  }

  async function confirmar(itens: MoradorDaLista[]) {
    setFalha(null);
    setEnviando(true);
    const r = await chamarApi<{ confirmados: number }>("/v1/condominio/vinculos-unidade/confirmar", {
      corpo: { itens: itens.map((i) => ({ id: i.vinculoId, versao: i.versao })) },
    });
    setEnviando(false);
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    setMarcados([]);
    salvo({ tom: "ok", texto: r.dados.confirmados === 1 ? "Contato confirmado. Agora ele fala pela unidade." : `${r.dados.confirmados} contatos confirmados. Agora eles falam pelas unidades.` });
  }

  const formulario = (
    <div className="flex items-center gap-3">
    <form onSubmit={buscar} role="search" aria-label="Buscar pessoas" className="busca min-w-0 flex-1 md:max-w-[520px]">
      <Icone nome="busca" />
      <label htmlFor="m-busca" className="sr-only">Buscar por nome, unidade ou telefone</label>
      <input id="m-busca" className="campo" type="search" placeholder="Buscar por nome, unidade ou telefone" maxLength={60} value={texto}
        onChange={(e) => setTexto(e.target.value)} />
    </form>
    {/* Os aniversariantes do mês (F3.10; MU-11), de todas as unidades. */}
    {aConfirmar ? null : (
      <Link href="/moradores/aniversariantes" className={classeBotao("contorno", "max-md:w-11 max-md:px-0")} aria-label="Aniversariantes do mês">
        <Icone nome="bolo" /><span className="max-md:sr-only">Aniversariantes</span>
      </Link>
    )}
    </div>
  );

  if (carga.estado === "carregando") return <div className="grid gap-4">{formulario}<Carregando rotulo="Carregando as pessoas…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{formulario}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const d = carga.dados;
  const paginas = Math.max(1, Math.ceil(d.total / d.porPagina));
  const podeMarcar = aConfirmar && d.podeConfirmar;
  const daPagina = (veio === "LINK" ? [] : d.itens).map((i) => i.vinculoId);
  const todosMarcados = daPagina.length > 0 && daPagina.every((id) => marcados.includes(id));
  const escolhidos = (veio === "LINK" ? [] : d.itens).filter((i) => marcados.includes(i.vinculoId));
  const whatsapp = d.comunicadosWhatsappLigado === true;
  const atalhos = aConfirmar ? [] : [
    { valor: "SEM_EMAIL" as const, texto: "Sem e-mail confirmado", n: d.semEmail, icone: "email" as const },
    ...(sem === "SEM_WHATSAPP" || whatsapp ? [{ valor: "SEM_WHATSAPP" as const, texto: "Sem WhatsApp para comunicados", n: d.semWhatsapp, icone: "whats" as const }] : []),
  ];
  const unidadeDe = (i: MoradorDaLista) => nomeDaUnidade(i.bloco, i.andar, i.unidade);
  const q = busca.toLocaleLowerCase("pt-BR");
  const doLink = (fila.estado === "pronto" ? fila.dados.itens : [])
    .filter((c) => !q || [c.nome, c.unidade, c.telefone].some((t) => t.toLocaleLowerCase("pt-BR").includes(q)));
  const conferePeloLink = fila.estado === "pronto" && fila.dados.podeConfirmar;
  const mostraLink = aConfirmar && veio !== "PLANILHA" ? doLink : [];
  const itens = veio === "LINK" ? [] : d.itens;
  const pronto = (r: Recado) => { setConferir(null); fila.recarregar(); salvo(r); };

  return (
    <div className="grid gap-4">
      {formulario}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      <section aria-labelledby="t-pessoas" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-pessoas" className="sr-only">{aConfirmar ? "Contatos a confirmar" : "Pessoas do condomínio"}</h2>
        {aConfirmar ? (
          <p role="note" className="flex items-center gap-3 rounded-[14px] border border-atencao-borda bg-atencao-fundo px-4 py-3 t-texto md:rounded-none md:border-0 md:border-b md:border-linha md:px-5">
            <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="atencao" aria-hidden="true"><Icone nome="relogio" className="h-4 w-4" /></span>
            <span>Confira se cada pessoa é mesmo daquela unidade. Quem está a confirmar não recebe nada e não acessa nada.{d.podeConfirmar ? "" : " Só o síndico confirma."}</span>
          </p>
        ) : null}
        {aConfirmar && (doLink.length || d.unidade) ? (
          <div role="group" aria-label="Veio de" className="flex flex-wrap items-center gap-2 py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            {d.unidade ? (
              <Link href="/moradores?aba=confirmar" className="chip-atencao" data-tom="neutro" aria-label={`Só ${d.unidade.nome}: mostrar todas as unidades`}>
                Só {d.unidade.nome}<Icone nome="fechar" className="h-4 w-4" />
              </Link>
            ) : null}
            {doLink.length ? (
              <>
                <span className="t-apoio shrink-0">Veio de</span>
                {([["LINK", "Pelo link", doLink.length], ["PLANILHA", "Da planilha", d.total]] as const).map(([v, texto, n]) => (
                  <button key={v} type="button" aria-pressed={veio === v} data-tom="neutro" className="chip-atencao"
                    onClick={() => { setVeio((x) => (x === v ? null : v)); setMarcados([]); }}>
                    {v === "LINK" ? <Icone nome="link" className="h-4 w-4" /> : null}{texto} <b>{n}</b>
                  </button>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
        {!aConfirmar && atalhos.length ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {atalhos.map((a) => (
              <button key={a.valor} type="button" aria-pressed={sem === a.valor} data-tom="neutro" className="chip-atencao"
                onClick={() => { setSem((x) => (x === a.valor ? null : a.valor)); setPagina(1); }}>
                <Icone nome={a.icone} className="h-4 w-4" />{a.texto}{a.n !== undefined ? <> <b>{a.n}</b></> : null}
              </button>
            ))}
          </div>
        ) : null}

        {itens.length === 0 && mostraLink.length === 0 ? (
          <div className="md:p-5">
            <Vazio titulo={busca ? "Ninguém encontrado" : aConfirmar ? "Nenhum contato esperando confirmação" : "Nenhuma pessoa cadastrada"} icone={busca ? "busca" : aConfirmar ? "check" : "pessoas"}>
              {busca ? "Confira a busca: nome, unidade ou parte do telefone." : aConfirmar ? "O que vier da planilha ou pelo link de cadastro aparece aqui para você conferir." : "Inclua pessoas pela ficha de cada unidade ou importe a planilha."}
            </Vazio>
          </div>
        ) : (
          <>
            {podeMarcar && itens.length ? (
              <div className={`flex flex-wrap items-center justify-between gap-3 px-1 py-2 md:border-b md:px-5 ${escolhidos.length ? "md:border-violeta-200 md:bg-violeta-50" : "md:border-linha"}`}>
                <label className="flex min-h-11 items-center gap-3 t-texto font-medium">
                  <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={todosMarcados} aria-label="Marcar todos desta página"
                    onChange={(e) => setMarcados(e.target.checked ? [...new Set([...marcados, ...daPagina])] : marcados.filter((id) => !daPagina.includes(id)))} />
                  <span aria-live="polite">{escolhidos.length ? `${escolhidos.length} de ${d.itens.length} ${escolhidos.length === 1 ? "marcada" : "marcadas"}` : "Marcar todos desta página"}</span>
                </label>
                {escolhidos.length ? (
                  <span className="flex gap-2">
                    <Botao variante="discreto" tamanho="m" onClick={() => setMarcados([])}>Desmarcar</Botao>
                    <Botao variante="contorno" tamanho="m" disabled={enviando} onClick={() => void confirmar(escolhidos)}>
                      <Icone nome="check" />{escolhidos.length === 1 ? "Confirmar 1 pessoa" : `Confirmar ${escolhidos.length} pessoas`}
                    </Botao>
                  </span>
                ) : null}
              </div>
            ) : null}
            {!podeMarcar ? (
              <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
                <span /><span className="t-rotulo">Pessoa</span><span className="t-rotulo">Telefone</span><span className="t-rotulo">Unidade</span><span className="t-rotulo">Situação</span><span />
              </div>
            ) : null}
            <ul aria-label={aConfirmar ? "Contatos a confirmar" : "Pessoas"} className="grid max-md:gap-3">
              {mostraLink.map((c) => (
                <li key={c.id} className={`relative grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-5 py-3 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-t md:border-linha md:first:border-t-0 ${podeMarcar ? COLUNAS_CONFIRMAR : COLUNAS_LINK}`}>
                  {podeMarcar ? <span className="max-md:hidden" /> : null}
                  <Iniciais nome={c.nome} className="h-10 w-10 self-start md:self-center" />
                  <div className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">{c.nome}<span className="selo" data-tom="info"><Icone nome="link" className="h-3.5 w-3.5" />Pelo link</span></span>
                    <span className="t-apoio">{resumoCadastro(c)}</span>
                  </div>
                  <span className="t-codigo max-md:col-start-2">{mostrarTelefone(c.telefone)}</span>
                  <Link href={`/moradores/unidade?id=${c.unidadeId}`} className="justify-self-start font-medium text-violeta-600 hover:underline max-md:col-start-2">{c.unidade}</Link>
                  {conferePeloLink ? (
                    <span className="justify-self-end max-md:col-start-2 max-md:justify-self-start">
                      <Botao variante="contorno" tamanho="m" aria-label={`Conferir o cadastro de ${c.nome}`} onClick={() => setConferir({ c, recusar: false })}>Conferir</Botao>
                    </span>
                  ) : <span className="max-md:hidden" />}
                </li>
              ))}
              {itens.map((i) => (
                <li key={i.vinculoId}
                  className={`relative grid items-center gap-x-4 gap-y-1 px-5 py-3 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-t md:border-linha md:first:border-t-0 ${podeMarcar ? `grid-cols-[24px_40px_minmax(0,1fr)_40px] ${COLUNAS_CONFIRMAR} ${marcados.includes(i.vinculoId) ? "bg-violeta-50/60" : ""}` : `grid-cols-[40px_minmax(0,1fr)_20px] hover:bg-violeta-50/50 ${COLUNAS}`}`}>
                  {podeMarcar ? (
                    <input type="checkbox" className="h-5 w-5 accent-violeta-600" aria-label={`Selecionar ${i.nome}`} checked={marcados.includes(i.vinculoId)}
                      onChange={(e) => setMarcados(e.target.checked ? [...marcados, i.vinculoId] : marcados.filter((x) => x !== i.vinculoId))} />
                  ) : null}
                  <Iniciais nome={i.nome} className="h-10 w-10 self-start md:self-center" />
                  <div className="grid min-w-0 gap-0.5">
                    <span className="font-medium">{i.nome}</span>
                    <span className="t-apoio">{detalhe(i, whatsapp)}</span>
                  </div>
                  <span className={`t-codigo ${podeMarcar ? "max-md:col-start-3" : "max-md:col-start-2"}`}>{mostrarTelefone(i.telefone)}</span>
                  <Link href={`/moradores/unidade?id=${i.unidadeId}`}
                    className={`justify-self-start font-medium text-violeta-600 ${podeMarcar ? "relative z-[1] hover:underline max-md:col-start-3" : "after:absolute after:inset-0 after:content-[''] max-md:col-start-2"}`}>{unidadeDe(i)}</Link>
                  {podeMarcar ? (
                    <span className="relative z-[2] justify-self-end max-md:col-start-4 max-md:row-start-1">
                      <MenuAcoes rotulo={`Ações de ${i.nome}`} itens={[
                        { texto: "Confirmar", icone: "check", rotulo: `Confirmar ${i.nome}`, acao: () => void confirmar([i]) },
                        { texto: "Recusar…", icone: "fechar", rotulo: `Recusar ${i.nome}`, perigo: true, acao: () => setRecusar(i) },
                      ]} />
                    </span>
                  ) : (
                    <>
                      {aConfirmar ? <span className="max-md:hidden" /> : <span className="max-md:col-start-2"><SeloEstado estado={i.estado} /></span>}
                      <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1 max-md:self-center" />
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
              <span className="t-apoio">{((n) => (n === 1 ? "1 contato" : `${n} contatos`))(itens.length ? d.total + mostraLink.length : mostraLink.length || d.total)}{aConfirmar ? " a confirmar" : ""}</span>
              {aConfirmar ? <span className="t-apoio">Recusar fica no menu de cada pessoa e pede confirmação.</span> : <span className="t-apoio">Quem saiu fica no histórico da unidade.</span>}
              {paginas > 1 ? (
                <nav aria-label="Páginas" className="flex items-center gap-2">
                  <Botao variante="contorno" tamanho="m" disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); setMarcados([]); }}><Icone nome="esq" />Anterior</Botao>
                  <span className="t-apoio">Página {pagina} de {paginas}</span>
                  <Botao variante="contorno" tamanho="m" disabled={pagina >= paginas} onClick={() => { setPagina(pagina + 1); setMarcados([]); }}>Próxima<Icone nome="dir" /></Botao>
                </nav>
              ) : null}
            </div>
          </>
        )}
      </section>
      {conferir && !conferir.recusar ? (
        <ConferirCadastro c={conferir.c} aoFechar={() => setConferir(null)} aoRecusar={() => setConferir({ c: conferir.c, recusar: true })} salvo={pronto} recarregar={fila.recarregar} />
      ) : null}
      {conferir?.recusar ? <RecusarCadastro c={conferir.c} aoFechar={() => setConferir(null)} salvo={pronto} recarregar={fila.recarregar} /> : null}
      <Janela aberto={!!recusar} titulo={recusar ? `Recusar ${recusar.nome}` : "Recusar"} campos={[]} iniciais={{}} textoBotao="Recusar contato"
        explicacao={recusar ? `${recusar.nome} não vai falar por ${unidadeDe(recusar)}. A recusa fica registrada no histórico.` : undefined}
        aoFechar={() => setRecusar(null)} recarregar={carga.recarregar}
        aoSalvar={async () => {
          const alvo = recusar!;
          const r = await chamarApi(`/v1/condominio/vinculos-unidade/${alvo.vinculoId}/encerrar`, { corpo: { versao: alvo.versao, motivo: "RECUSADO" } });
          if (r.ok) {
            setRecusar(null);
            setMarcados(marcados.filter((x) => x !== alvo.vinculoId));
            salvo({ tom: "ok", texto: `${alvo.nome} recusado em ${unidadeDe(alvo)}.` });
          }
          return r;
        }} />
    </div>
  );
}
