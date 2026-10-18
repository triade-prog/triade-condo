"use client";
// Moldura da Plataforma do síndico (telas-modelo da identidade, aprovadas em 17/10/2026, DC13):
// barra superior branca com a marca, a busca, o condomínio, o sino e a pessoa; lateral clara com
// ícone em cada item, o escolhido em degradê violeta e a contagem de vencidos em laranja.
// O condomínio vem da sessão no servidor; quem atende mais de um escolhe e troca aqui (MU-04).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FUNCOES_PLATAFORMA } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Iniciais, Marca, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { SinoAvisos } from "./Avisos.tsx";
import { Contexto, useCarregar, type CondominioDaPessoa, type Painel } from "./sessao.tsx";

interface Sessao {
  pessoaId: string;
  condominioAtual: string | null;
  condominios: CondominioDaPessoa[];
}

function nomeFuncoes(f: string[]): string {
  return f.map((x) => FUNCOES_PLATAFORMA[x as keyof typeof FUNCOES_PLATAFORMA] ?? x).join(", ");
}

/** Escolher o condomínio (síndico profissional, MU-04). */
function ListaCondominios({ condominios, atual, aoEscolher }: { condominios: CondominioDaPessoa[]; atual: string | null; aoEscolher: (id: string) => void }) {
  return (
    <ul className="grid gap-2">
      {condominios.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => aoEscolher(c.id)}
            aria-current={c.id === atual ? "true" : undefined}
            className="grid w-full gap-0.5 rounded-[18px] border border-linha bg-superficie px-4 py-3 text-left hover:border-violeta-300 aria-[current=true]:border-violeta-600 aria-[current=true]:bg-violeta-50"
          >
            <span className="font-semibold">{c.nome}</span>
            <span className="text-sm text-tinta-suave">{nomeFuncoes(c.funcoes)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ItemMenu({ href, icone, children, atual, contagem }: { href: string; icone: NomeIcone; children: ReactNode; atual: boolean; contagem?: ReactNode }) {
  return (
    <Link href={href} aria-current={atual ? "page" : undefined}>
      <Icone nome={icone} />
      {children}
      {contagem}
    </Link>
  );
}

function Moldura({ sessao, painel, aoTrocar, children }: { sessao: Sessao; painel: Painel; aoTrocar: (id: string) => void; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const pode = (acao: string) => painel.acoes.includes(acao);

  async function sair() {
    await chamarApi("/v1/auth/sair", { corpo: {} });
    router.replace("/entrar");
  }

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="flex flex-wrap items-center gap-3 border-b border-linha bg-superficie px-4 py-2.5">
        <button
          type="button"
          className="emblema md:hidden"
          aria-label="Menu"
          aria-expanded={menuAberto}
          aria-controls="menu-plataforma"
          onClick={() => setMenuAberto((v) => !v)}
        >
          <Icone nome="menu" />
        </button>
        <Marca sistema="Plataforma do síndico" />
        {pode("pedidos.ver") || pode("moradores.ver") ? (
          <form role="search" action="/busca" className="relative order-last w-full md:order-none md:ml-4 md:w-auto md:max-w-md md:flex-1"
            onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q"); router.push(`/busca?q=${encodeURIComponent(String(q ?? "").trim())}`); }}>
            <Icone nome="busca" className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-tinta-suave" />
            <input type="search" name="q" maxLength={60} aria-label="Buscar no condomínio" placeholder="Buscar pedido, unidade ou pessoa" key={caminho}
              className="campo min-h-10 pl-10 text-sm placeholder:text-tinta-suave" />
          </form>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-[18px] border border-linha bg-superficie px-3 font-medium">
            <Icone nome="predio" className="h-4 w-4 text-tinta-suave" />
            {painel.condominio.nome}
            {sessao.condominios.length > 1 ? (
              <Botao variante="discreto" tamanho="p" aria-label="Trocar condomínio" onClick={() => setTrocando(true)}>Trocar</Botao>
            ) : null}
          </span>
          {painel.avisosNaoVistos !== undefined ? <SinoAvisos naoVistos={painel.avisosNaoVistos} /> : null}
          <span className="flex items-center gap-2">
            <Iniciais nome={painel.pessoa.nome} />
            <span className="hidden leading-tight sm:block">
              <span className="block font-medium">{painel.pessoa.nome}</span>
              <span className="block text-xs text-tinta-suave">{nomeFuncoes(painel.funcoes)}</span>
            </span>
            <span className="sr-only sm:hidden">{painel.pessoa.nome} · {nomeFuncoes(painel.funcoes)}</span>
          </span>
          <Botao variante="discreto" tamanho="m" onClick={sair}>Sair</Botao>
        </div>
      </header>
      <div className="min-h-[calc(100dvh-63px)] md:grid md:grid-cols-[248px_1fr] md:gap-6 md:p-5">
        <nav
          id="menu-plataforma"
          aria-label="Plataforma"
          className={`${menuAberto ? "grid" : "hidden"} lateral m-3 md:sticky md:top-5 md:m-0 md:grid md:self-start`}
        >
          <ItemMenu href="/" icone="casa" atual={caminho === "/"}>Início</ItemMenu>
          {pode("pedidos.ver") ? (
            <ItemMenu href="/pedidos" icone="pedido" atual={caminho.startsWith("/pedidos")}
              contagem={painel.pedidos?.retornoVencido ? <span className="contagem">{painel.pedidos.retornoVencido}<span className="sr-only"> com retorno vencido</span></span> : null}>
              Pedidos
            </ItemMenu>
          ) : null}
          {pode("agenda.ver") ? <ItemMenu href="/agenda" icone="calendario" atual={caminho.startsWith("/agenda")}>Agenda</ItemMenu> : null}
          {pode("manutencao.ver") ? (
            <ItemMenu href="/manutencao" icone="ferramenta" atual={caminho.startsWith("/manutencao")}
              contagem={painel.manutencao?.retornoVencido ? <span className="contagem">{painel.manutencao.retornoVencido}<span className="sr-only"> com retorno vencido</span></span> : null}>
              Manutenção
            </ItemMenu>
          ) : null}
          {pode("moradores.ver") ? <ItemMenu href="/moradores" icone="predio" atual={caminho.startsWith("/moradores")}>Moradores e unidades</ItemMenu> : null}
          {pode("pedidos.ver") ? <ItemMenu href="/indicadores" icone="grafico" atual={caminho.startsWith("/indicadores")}>Indicadores</ItemMenu> : null}
          {pode("config.ver") || pode("pessoas.ver") ? <hr /> : null}
          {pode("config.ver") ? <ItemMenu href="/configuracoes" icone="ajuste" atual={caminho.startsWith("/configuracoes")}>Configurações</ItemMenu> : null}
          {pode("pessoas.ver") ? <ItemMenu href="/pessoas" icone="pessoas" atual={caminho.startsWith("/pessoas")}>Pessoas e acesso</ItemMenu> : null}
          <p className="mt-2 border-t border-linha px-3 pt-3 text-xs text-tinta-suave">O WhatsApp do condomínio chega num próximo passo. Até lá, os avisos ficam aqui no painel.</p>
        </nav>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:px-2 md:py-2">{children}</main>
      </div>
      <Dialogo aberto={trocando} titulo="Trocar condomínio" aoFechar={() => setTrocando(false)}>
        <ListaCondominios condominios={sessao.condominios} atual={painel.condominio.id} aoEscolher={(id) => { setTrocando(false); aoTrocar(id); }} />
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setTrocando(false)}>Cancelar</Botao></div>
      </Dialogo>
    </>
  );
}

function PainelDoCondominio({ sessao, aoTrocar, children }: { sessao: Sessao; aoTrocar: (id: string) => void; children: ReactNode }) {
  const painel = useCarregar<Painel>("/v1/condominio/painel");
  if (painel.estado !== "pronto") {
    return (
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="sr-only">Plataforma do síndico</h1>
        {painel.estado === "erro" ? <ErroCarregar texto={painel.texto} tentarDeNovo={painel.recarregar} /> : <Carregando rotulo="Abrindo o painel…" />}
      </main>
    );
  }
  const valor = { painel: painel.dados, condominios: sessao.condominios, pode: (a: string) => painel.dados.acoes.includes(a), atualizar: painel.recarregar };
  return (
    <Contexto.Provider value={valor}>
      <Moldura sessao={sessao} painel={painel.dados} aoTrocar={aoTrocar}>{children}</Moldura>
    </Contexto.Provider>
  );
}

export function PainelPlataforma({ children }: { children: ReactNode }) {
  const sessao = useCarregar<Sessao>("/v1/sessao");
  const router = useRouter();
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [geracao, setGeracao] = useState(0);
  const automatico = useRef(false);

  async function escolher(id: string) {
    setErro(null);
    const r = await chamarApi("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: id } });
    if (!r.ok) return setErro(r.erro);
    setGeracao((g) => g + 1);
    sessao.recarregar();
    router.replace("/");
  }

  // Com um condomínio só, ele já entra escolhido.
  const unico = sessao.estado === "pronto" && !sessao.dados.condominioAtual && sessao.dados.condominios.length === 1 ? sessao.dados.condominios[0]!.id : null;
  useEffect(() => {
    if (unico && !automatico.current) {
      automatico.current = true;
      void escolher(unico);
    }
  });

  if (sessao.estado !== "pronto" || unico) {
    return (
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="sr-only">Plataforma do síndico</h1>
        {sessao.estado === "erro" ? <ErroCarregar texto={sessao.texto} tentarDeNovo={sessao.recarregar} /> : <Carregando rotulo="Abrindo o painel…" />}
      </main>
    );
  }

  const s = sessao.dados;
  if (!s.condominioAtual) {
    return (
      <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
        <div className="grid w-full max-w-md gap-5 rounded-[20px] border border-linha bg-superficie p-6 shadow-s2">
          <Marca sistema="Plataforma do síndico" />
          <h1 className="text-2xl font-light tracking-tight">Em qual condomínio?</h1>
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          {s.condominios.length ? (
            <>
              <ListaCondominios condominios={s.condominios} atual={null} aoEscolher={(id) => void escolher(id)} />
              <p className="text-sm text-tinta-suave">Dá para trocar depois, no topo da tela.</p>
            </>
          ) : (
            <Aviso tom="atencao">Sua conta não tem acesso a nenhum condomínio agora. Fale com o síndico ou com a TRÍADE.</Aviso>
          )}
        </div>
      </main>
    );
  }
  return <PainelDoCondominio key={`${s.condominioAtual}-${geracao}`} sessao={s} aoTrocar={(id) => void escolher(id)}>{children}</PainelDoCondominio>;
}
