"use client";
// Comunicados, aba "No mural" (CD-15; CD-12, AC-05; canvas do novo frontend, quadros 72 a 79):
// o mural como o morador vê pelo link, ao vivo, sem sair do painel. A prévia confere sozinha a
// cada 30 segundos e logo depois de pôr ou tirar um aviso; ver por aqui não conta abertura. Embaixo
// de cada aviso, só no painel, ficam abrir a ficha e tirar do mural. Ao lado, os publicados que
// não aparecem no link, cada um com o motivo, e as aberturas do link nos últimos 7 dias; na
// vitrine dos Classificados, os anúncios esperando aprovação.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ASSUNTOS_COMUNICADO, MOTIVOS_FORA_DO_MURAL, MURAL_CONFERIR_S, textoConferido } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { CabecaPublica } from "../publico/comum.tsx";
import { enderecoDaVista } from "../publico/Mural.tsx";
import { FaixaPainel, MuralConteudo, type FaixasDoPainel, type LinksDoMural, type VistaMural } from "../publico/MuralConteudo.tsx";
import { Tirar } from "../vida/Classificados.tsx";
import type { AnuncioTela, ListaAnuncios, MuralNoPainel } from "../tipos.ts";
import { useAgora, useMuralAoVivo } from "./muralAoVivo.ts";

const ABAS = [["", "Publicados"], ["PROGRAMADO", "Programados"], ["RASCUNHO", "Rascunhos"], ["ARQUIVADO", "Arquivados"]] as const;

/** As abas de Comunicados vistas daqui: as quatro situações levam de volta à lista. */
function AbasComunicados() {
  return (
    <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
      {ABAS.map(([filtro, texto]) => (
        <Link key={texto} href={filtro ? `/comunicados?filtro=${filtro}` : "/comunicados"}
          className="-mb-px flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-tinta-suave hover:text-tinta">{texto}</Link>
      ))}
      <AbaNoMural atual />
    </nav>
  );
}

/** A aba "No mural", com o ponto verde de ao vivo. Também entra na lista de Comunicados. */
export function AbaNoMural({ atual = false }: { atual?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="mx-2 my-auto h-5 w-px shrink-0 bg-linha" />
      <Link href="/comunicados/no-mural" aria-current={atual ? "page" : undefined}
        className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
        <Icone nome="casa" className="h-4 w-4" />No mural<span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok ring-4 ring-ok/15" />
      </Link>
    </>
  );
}

function BarraAoVivo({ conferidoEm, falhou, codigo, conferir }: { conferidoEm: number; falhou: boolean; codigo: string; conferir: () => void }) {
  const agora = useAgora();
  const [copiado, setCopiado] = useState<string | null>(null);
  const caminho = `/m/${codigo}`;
  async function copiar() {
    const url = new URL(caminho, window.location.origin).toString();
    try { await navigator.clipboard.writeText(url); setCopiado("Link do mural copiado."); } catch { setCopiado(`Copie o link: ${url}`); }
  }
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(conferidoEm));
  return (
    <div className="grid gap-2 rounded-[18px] border border-linha bg-superficie px-4 py-3 shadow-s1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2.5">
          {falhou ? <Selo tom="erro">Sem conexão</Selo> : <Selo tom="ok">Ao vivo</Selo>}
          <span className="t-apoio" role="status">
            {falhou ? `Não deu para conferir agora. A prévia mostra o que estava no mural às ${hora}. Tentamos de novo em ${MURAL_CONFERIR_S} s.`
              : `${textoConferido(conferidoEm, agora)} · confere de novo a cada ${MURAL_CONFERIR_S} s`}
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          <Botao variante="discreto" tamanho="m" onClick={conferir}><Icone nome="trocar" />{falhou ? "Tentar agora" : "Atualizar agora"}</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => void copiar()}><Icone nome="copiar" />Copiar link</Botao>
          <a href={caminho} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "max-md:hidden", "m")}><Icone nome="link" />Abrir como morador</a>
        </span>
      </div>
      {copiado ? <p className="t-apoio" role="status">{copiado}</p> : null}
    </div>
  );
}

function ForaDoMural({ fora, podeMural, aoPor }: { fora: MuralNoPainel["fora"]; podeMural: boolean; aoPor: (f: MuralNoPainel["fora"][number]) => void }) {
  return (
    <section aria-labelledby="t-fora" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-fora" className="t-titulo-cartao flex items-center gap-3"><span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="info" /></span>Publicados fora do mural</h2>
      <p className="t-apoio">Estão publicados, mas o morador não vê no link. Cada um diz por quê.</p>
      {fora.length ? (
        <ul className="divide-y divide-linha">
          {fora.map((f) => (
            <li key={f.id} className="grid gap-0.5 py-3">
              <Link href={`/comunicados/comunicado?id=${f.id}`} className="font-medium hover:text-violeta-600">{f.titulo}</Link>
              <span className="t-apoio">{ASSUNTOS_COMUNICADO[f.assunto]} · publicado {diaHora(f.publicadoEm)}</span>
              <span className="text-sm">{MOTIVOS_FORA_DO_MURAL[f.motivo]}</span>
              {podeMural && f.motivo !== "SO_PARA_ALGUNS" ? (
                <span className="pt-1.5"><Botao variante="contorno" tamanho="m" onClick={() => aoPor(f)} aria-label={`Pôr no mural: ${f.titulo}`}>Pôr no mural</Botao></span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="py-3 text-sm">Todo comunicado publicado para o condomínio inteiro está no mural.</p>}
    </section>
  );
}

function OLinkDoMural({ aberturas, configurar }: { aberturas: number; configurar: boolean }) {
  return (
    <section aria-labelledby="t-link" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-link" className="t-titulo-cartao flex items-center gap-3"><span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="link" /></span>O link do mural</h2>
      <p className="flex items-baseline gap-2"><span className="text-[26px] font-semibold">{aberturas}</span><span>{aberturas === 1 ? "abertura" : "aberturas"} nos últimos 7 dias</span></p>
      <p className="t-apoio">Conta quantas vezes o link abriu, sem saber quem abriu. Ver por aqui não conta.</p>
      {configurar ? (
        <span className="flex flex-wrap gap-x-4 gap-y-1 border-t border-linha pt-3 text-[13px]">
          <Link href="/mural/cartaz" target="_blank" className="flex items-center gap-1.5 font-medium text-violeta-600 hover:underline"><Icone nome="imprimir" className="h-4 w-4" />Cartaz com o QR</Link>
          <Link href="/configuracoes/mural" className="flex items-center gap-1.5 font-medium text-violeta-600 hover:underline"><Icone nome="ajuste" className="h-4 w-4" />Mural e e-mail nas Configurações</Link>
        </span>
      ) : null}
    </section>
  );
}

function EsperandoAprovacao({ anuncios }: { anuncios: AnuncioTela[] }) {
  return (
    <section aria-labelledby="t-esperando" className="grid gap-1 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-esperando" className="t-titulo-cartao flex items-center gap-3"><span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="relogio" /></span>Esperando aprovação</h2>
      <p className="t-apoio">Ainda não estão no mural. Só aparecem depois que alguém aprova.</p>
      {anuncios.length ? (
        <ul className="divide-y divide-linha">
          {anuncios.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <span className="grid min-w-0 flex-1"><span className="font-medium">{a.titulo ?? a.tituloSugerido}</span><span className="t-apoio">{a.unidade.nome}</span></span>
              <Link href="/vida?aba=classificados" className={classeBotao("contorno", "shrink-0", "m")} aria-label={`Revisar: ${a.titulo ?? a.tituloSugerido}`}>Revisar</Link>
            </li>
          ))}
        </ul>
      ) : <p className="py-3 text-sm">Nenhum anúncio esperando.</p>}
    </section>
  );
}

export function NoMural() {
  const vivo = useMuralAoVivo();
  // Ver no mural, do Manual do prédio, abre na aba Manual.
  const abaInicial = useSearchParams().get("aba") === "manual" ? "manual" : "avisos";
  const [vista, setVista] = useState<VistaMural>({ aba: abaInicial });
  const [recado, setRecado] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [tirando, setTirando] = useState<AnuncioTela | null>(null);
  const dados = vivo.estado === "pronto" ? vivo.dados : null;
  const classificados = useCarregar<ListaAnuncios>(dados?.pode.classificados ? "/v1/condominio/classificados" : null);

  async function noMural(id: string, versao: number | undefined, sim: boolean, titulo: string) {
    setRecado(null);
    if (versao === undefined) return vivo.conferir();
    const r = await chamarApi(`/v1/condominio/comunicados/${id}/mural`, { metodo: "PUT", corpo: { versao, noMural: sim } });
    setRecado(r.ok ? { tom: "ok", texto: sim ? `"${titulo}" foi posto no mural.` : `"${titulo}" saiu do mural.` } : { tom: "erro", texto: textoDoErro(r.erro) });
    vivo.conferir();
  }

  const cabeca = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="t-titulo-tela">Comunicados</h1>
        <p className="t-apoio mt-1">O que o condomínio avisa a todos. Publicado não se edita: corrigir vira uma versão nova.</p>
      </div>
      {dados?.pode.mural ? <Link href="/comunicados/escrever" className={classeBotao("primario", "max-md:hidden")}><Icone nome="mais" />Escrever comunicado</Link> : null}
    </div>
  );
  const abas = <div className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1"><AbasComunicados /></div>;

  if (vivo.estado === "carregando") return <div className="grid gap-5">{cabeca}{abas}<Carregando rotulo="Abrindo o mural…" /></div>;
  if (vivo.estado === "erro") return <div className="grid gap-5">{cabeca}{abas}<ErroCarregar erro={vivo.erro} texto={vivo.texto} tentarDeNovo={vivo.conferir} oQue="o mural" /></div>;
  const d = vivo.dados;
  const m = d.mural;
  if (!d.ligado || !d.codigo || !m || m.foraDoAr || m.trocado) {
    return (
      <div className="grid gap-5">
        {cabeca}{abas}
        <Aviso tom="atencao" titulo="O mural está desligado">
          Quem abre o link vê &quot;Este mural está fora do ar&quot;. Os avisos continuam saindo pelos outros canais.
          {d.pode.configurar ? <span className="mt-2 block"><Link href="/configuracoes/mural" className={classeBotao("contorno", "", "m")}><Icone nome="ajuste" />Ligar o mural</Link></span> : null}
        </Aviso>
        <OLinkDoMural aberturas={d.aberturas} configurar={d.pode.configurar} />
      </div>
    );
  }
  const codigo = d.codigo;
  const anunciosTela = classificados.estado === "pronto" ? classificados.dados.classificados : [];
  const podeTirarAnuncio = classificados.estado === "pronto" && classificados.dados.pode.editar;
  const links: LinksDoMural = {
    arquivo: (comunicado, arquivo) => `/v1/condominio/comunicados/${comunicado}/arquivos/${arquivo}/link`,
    // Quem não cuida dos classificados vê a foto pelo mesmo caminho do morador.
    fotoAnuncio: (id) => (d.pode.classificados ? `/v1/condominio/classificados/${id}/foto` : `/v1/publico/mural/${encodeURIComponent(codigo)}/classificados/${id}/foto`),
    publico: (v) => enderecoDaVista(codigo, v),
  };
  const faixas: FaixasDoPainel = {
    aviso: (c) => (
      <FaixaPainel>
        <Link href={`/comunicados/comunicado?id=${c.id}`} className="flex items-center gap-1 text-[13px] font-medium text-violeta-600 hover:underline" aria-label={`Abrir a ficha: ${c.titulo}`}>
          Abrir a ficha<Icone nome="dir" className="h-4 w-4" />
        </Link>
        {d.pode.mural ? (
          <Botao variante="discreto" tamanho="p" onClick={() => void noMural(c.id, d.versoes[c.id], false, c.titulo)} aria-label={`Tirar do mural: ${c.titulo}`}>
            <Icone nome="fechar" />Tirar do mural
          </Botao>
        ) : null}
      </FaixaPainel>
    ),
    enquete: (e) => (
      <FaixaPainel>
        <Link href={`/vida/enquete?id=${e.id}`} className="flex items-center gap-1 text-[13px] font-medium text-violeta-600 hover:underline" aria-label={`Abrir a enquete: ${e.pergunta}`}>
          Abrir a enquete<Icone nome="dir" className="h-4 w-4" />
        </Link>
      </FaixaPainel>
    ),
    anuncio: (a) => {
      const tela = anunciosTela.find((x) => x.id === a.id);
      return (
        <FaixaPainel>
          <Link href="/vida?aba=classificados" className="flex items-center gap-1 text-[13px] font-medium text-violeta-600 hover:underline" aria-label={`Abrir nos classificados: ${a.titulo}`}>
            Abrir<Icone nome="dir" className="h-4 w-4" />
          </Link>
          {tela && podeTirarAnuncio ? (
            <Botao variante="discreto" tamanho="p" onClick={() => setTirando(tela)} aria-label={`Tirar do mural: ${a.titulo}`}><Icone nome="fechar" />Tirar</Botao>
          ) : null}
        </FaixaPainel>
      );
    },
    documentos: (
      <FaixaPainel>
        <span className="text-xs text-tinta-suave">o botão do morador não funciona aqui</span>
        <Link href="/documentos?filtro=PEDIDOS" className="flex items-center gap-1 text-[13px] font-medium text-violeta-600 hover:underline">
          Pedidos por e-mail<Icone nome="dir" className="h-4 w-4" />
        </Link>
      </FaixaPainel>
    ),
  };
  const subtitulo = vista.aba === "classificados" ? "Classificados entre moradores" : vista.aba === "manual" ? "Manual do prédio"
    : `Avisos para todo o condomínio${m.atualizadoEm ? ` · atualizado ${diaHora(m.atualizadoEm)}` : ""}`;
  const aAprovar = anunciosTela.filter((a) => a.estado === "A_APROVAR");

  return (
    <div className="grid gap-5 max-md:pb-16">
      {cabeca}{abas}
      {recado ? <Aviso tom={recado.tom} papel={recado.tom === "erro" ? "alert" : "status"}>{recado.texto}</Aviso> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <BarraAoVivo conferidoEm={vivo.conferidoEm} falhou={vivo.falhou} codigo={codigo} conferir={vivo.conferir} />
          <section aria-label="O que o morador vê" className="overflow-hidden rounded-[20px] border border-linha bg-fundo shadow-s1">
            <div className="flex items-center justify-between gap-3 border-b border-linha bg-superficie px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap"><Icone nome="olho" className="h-4 w-4" />O que o morador vê</span>
              <code className="truncate font-mono text-xs text-tinta-suave max-sm:hidden">{`/m/${codigo}`}</code>
            </div>
            <div className="mx-auto grid w-full max-w-[640px] gap-3 p-3 sm:p-6">
              <CabecaPublica titulo={`Mural do ${m.condominio}`} subtitulo={subtitulo} nivel={2} className="rounded-2xl" />
              <MuralConteudo m={m} codigo={codigo} vista={vista} ir={setVista} links={links} painel={faixas} />
            </div>
          </section>
        </div>
        <div className="grid gap-4">
          {vista.aba === "classificados" && d.pode.classificados ? <EsperandoAprovacao anuncios={aAprovar} />
            : <ForaDoMural fora={d.fora} podeMural={d.pode.mural} aoPor={(f) => void noMural(f.id, f.versao, true, f.titulo)} />}
          <OLinkDoMural aberturas={d.aberturas} configurar={d.pode.configurar} />
        </div>
      </div>
      {tirando ? <Tirar a={tirando} aoFechar={(texto) => { setTirando(null); if (texto) { setRecado({ tom: "ok", texto }); classificados.recarregar(); vivo.conferir(); } }} /> : null}
    </div>
  );
}
