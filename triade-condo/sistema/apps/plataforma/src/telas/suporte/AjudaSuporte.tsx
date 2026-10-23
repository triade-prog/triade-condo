"use client";
// Ajuda e suporte (DC15, telas-modelo suporte-chamados-* e suporte-abrir-chamado; peça R4; PI-17,
// PI-20; decisão C.1 de 23/10/2026): os chamados de suporte técnico da plataforma, em abas Abertos
// e Resolvidos com o número, cada linha inteira abrindo o chamado, e Abrir chamado numa janela,
// com tipo, área, título, o que aconteceu e até 3 imagens (colar com Ctrl+V ou escolher). Não é
// reparo do prédio nem emergência. O chamado aberto mora em Chamado.tsx. O pedido de mudança
// (Mudança de configuração, 0286) nasce do "Pedir mudança" das Configurações, e não daqui.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AREAS_CHAMADO, DIAS_REABRIR_CHAMADO, formatarDataHora, TIPOS_ABRIR_CHAMADO, TIPOS_CHAMADO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, textoDoErro, Vazio,
  type ErroApi,
} from "@triade/ui";
import { Escolha } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { Chamado as FichaChamado } from "./Chamado.tsx";
import { CampoImagens, enviarImagens } from "./imagens.tsx";
import { ICONE_TIPO, PartesSuporte, SeloChamado, TEXTO_SUPORTE, type Chamado } from "./comum.tsx";

type TipoAbrir = (typeof TIPOS_ABRIR_CHAMADO)[number];

function AbrirChamado({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAbrir>("PROBLEMA");
  const [area, setArea] = useState("PEDIDOS");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ id: string }>("/v1/condominio/chamados", { corpo: { tipo, area, titulo, texto } });
    if (!r.ok) {
      setEnviando(false);
      return setErro(r.erro);
    }
    const problemas = imagens.length ? await enviarImagens(r.dados.id, imagens) : [];
    setEnviando(false);
    router.push(`/suporte?id=${r.dados.id}${problemas.length ? "&imagens=falhou" : ""}`);
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto media fechar titulo="Abrir chamado" apoio="A TRÍADE responde em dias úteis, das 9h às 18h. Não é canal de reparo nem de emergência." aoFechar={aoFechar}>
      <form onSubmit={abrir} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Tipo</span>
          <Escolha rotulo="Tipo do chamado" atual={tipo} aoMudar={setTipo}
            opcoes={TIPOS_ABRIR_CHAMADO.map((k) => ({ valor: k, texto: <><Icone nome={ICONE_TIPO[k]} className="h-4 w-4" />{TIPOS_CHAMADO[k]}</> }))} />
        </div>
        <Aviso tom="info" titulo="Quer mudar algo que a TRÍADE configurou?">
          Use Pedir mudança na própria Configuração: a parte e o valor de hoje já vão juntos.{" "}
          <Link href="/configuracoes" className="font-medium text-violeta-600 hover:underline">Ir para Configurações</Link>
        </Aviso>
        <CampoSelecao id="cha-area" rotulo="Onde no sistema" value={area} onChange={(e) => setArea(e.target.value)}
          opcoes={Object.entries(AREAS_CHAMADO).map(([valor, t]) => ({ valor, texto: t }))} />
        <CampoTexto id="cha-titulo" rotulo="Título" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={campos.includes("titulo") ? "Escreva um título (3 a 120 caracteres)." : null} />
        <CampoAreaTexto id="cha-texto" rotulo="O que aconteceu" required maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
          ajuda="Conte o que fez, o que esperava e o que apareceu." erro={campos.includes("texto") ? "Conte o que aconteceu." : null} />
        <CampoImagens id="cha-imagens" imagens={imagens} mudar={setImagens} />
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Abrir chamado"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1fr)_10rem_20px]";

function ultimaResposta(c: Chamado): string {
  if (!c.ultima) return `Aberto ${formatarDataHora(c.criadoEm)}`;
  return `${c.ultima.lado === "TRIADE" ? "TRÍADE respondeu" : `${c.ultima.autor} escreveu`} ${formatarDataHora(c.ultima.em)}`;
}

export function AjudaSuporte() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const [abrindo, setAbrindo] = useState(false);
  const [aba, setAba] = useState<"ABERTOS" | "RESOLVIDOS">("ABERTOS");
  const lista = useCarregar<{ itens: Chamado[]; todos: boolean }>(id ? null : "/v1/condominio/chamados");

  if (id) return <FichaChamado key={id} id={id} falhouImagem={busca.get("imagens") === "falhou"} />;
  const todos = lista.estado === "pronto" ? lista.dados.itens : [];
  const abertos = todos.filter((c) => c.situacao !== "RESOLVIDO");
  const resolvidos = todos.filter((c) => c.situacao === "RESOLVIDO");
  const itens = aba === "ABERTOS" ? abertos : resolvidos;
  const abrir = <Botao onClick={() => setAbrindo(true)}><Icone nome="mais" />Abrir chamado</Botao>;
  const abas = [{ valor: "ABERTOS" as const, texto: "Abertos", n: abertos.length }, { valor: "RESOLVIDOS" as const, texto: "Resolvidos", n: resolvidos.length }];

  return (
    <div className="grid gap-5 max-md:pb-16">
      <PartesSuporte />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Ajuda e suporte</h1>
          <p className="t-apoio mt-1">{TEXTO_SUPORTE}</p>
        </div>
        <div className="max-md:hidden">{abrir}</div>
      </div>

      <section aria-labelledby="t-chamados" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-chamados" className="sr-only">{lista.estado === "pronto" && lista.dados.todos ? "Chamados do condomínio" : "Seus chamados"}</h2>
        <nav aria-label="Abertos ou resolvidos" className="flex gap-1 border-b border-linha md:px-3">
          {abas.map((a) => {
            const atual = aba === a.valor;
            return (
              <button key={a.valor} type="button" aria-pressed={atual} onClick={() => setAba(a.valor)}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {a.texto}
                {lista.estado === "pronto" ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : ""}`}>{a.n}</span> : null}
              </button>
            );
          })}
        </nav>
        {lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando os chamados…" /></div> : null}
        {lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div> : null}
        {lista.estado === "pronto" ? (
          itens.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={aba === "ABERTOS" ? "Nenhum chamado aberto" : "Nenhum chamado resolvido"} icone="balao">
                {aba === "ABERTOS" ? "Quando algo no sistema não funcionar como esperado, abra um chamado." : undefined}
              </Vazio>
            </div>
          ) : (
            <>
              <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
                <span /><span className="t-rotulo">Chamado</span><span className="t-rotulo">Última resposta</span><span className="t-rotulo">Situação</span><span />
              </div>
              <ul className="grid max-md:gap-3 max-md:pt-3">
                {itens.map((c) => (
                  <li key={c.id} className={`relative grid grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:border-linha md:last:border-b-0 ${COLUNAS}`}>
                    <span className="ladrilho self-start md:self-center" aria-hidden="true"><Icone nome={ICONE_TIPO[c.tipo] ?? "balao"} /></span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="md:hidden"><SeloChamado situacao={c.situacao} /></span>
                      <Link href={`/suporte?id=${c.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{c.titulo}</Link>
                      <span className="t-apoio">{TIPOS_CHAMADO[c.tipo]} · {AREAS_CHAMADO[c.area]} · aberto {formatarDataHora(c.criadoEm)}</span>
                      <span className="t-apoio md:hidden">{ultimaResposta(c)}</span>
                    </span>
                    <span className="text-sm max-md:hidden">{ultimaResposta(c)}</span>
                    <span className="max-md:hidden"><SeloChamado situacao={c.situacao} /></span>
                    <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">{itens.length === 1 ? "1 chamado" : `${itens.length} chamados`}{aba === "ABERTOS" ? (itens.length === 1 ? " aberto" : " abertos") : (itens.length === 1 ? " resolvido" : " resolvidos")}</span>
                <span className="t-apoio">Resolvido há até {DIAS_REABRIR_CHAMADO} dias reabre se você responder. O morador não abre chamado: quem tem conta na Plataforma, sim.</span>
              </div>
            </>
          )
        ) : null}
      </section>

      <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{abrir}</div>
      {abrindo ? <AbrirChamado aoFechar={() => setAbrindo(false)} /> : null}
    </div>
  );
}
