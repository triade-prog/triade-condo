"use client";
// Moldura da Plataforma do síndico (design "Telas do passo 2", aprovado em 16/10/2026):
// barra superior com o condomínio e a pessoa, menu branco flutuante e ação em verde-petróleo.
// O condomínio vem da sessão no servidor; quem atende mais de um escolhe e troca aqui (MU-04).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FUNCOES_PLATAFORMA } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Marca, textoDoErro, type ErroApi } from "@triade/ui";
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
            className="grid w-full gap-0.5 rounded-lg border border-linha px-4 py-3 text-left hover:border-acao aria-[current=true]:border-acao aria-[current=true]:bg-plataforma-bruma"
          >
            <span className="font-semibold">{c.nome}</span>
            <span className="text-sm text-tinta-suave">{nomeFuncoes(c.funcoes)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ItemMenu({ href, children, atual }: { href: string; children: ReactNode; atual: boolean }) {
  return (
    <Link
      href={href}
      aria-current={atual ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-md px-3 text-sm ${atual ? "bg-selecao font-medium text-selecao-tinta" : "text-tinta hover:bg-superficie-2"}`}
    >
      {children}
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-superficie px-4 py-2.5">
        <Marca sistema="Plataforma do síndico" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            {painel.condominio.nome}
            {sessao.condominios.length > 1 ? (
              <Botao variante="texto" onClick={() => setTrocando(true)}>Trocar condomínio</Botao>
            ) : null}
          </span>
          <span className="text-tinta-suave">{painel.pessoa.nome} · {nomeFuncoes(painel.funcoes)}</span>
          <Botao variante="texto" onClick={sair}>Sair</Botao>
          <button
            type="button"
            className="min-h-10 rounded-md border border-contorno px-3 text-sm font-semibold md:hidden"
            aria-expanded={menuAberto}
            aria-controls="menu-plataforma"
            onClick={() => setMenuAberto((v) => !v)}
          >
            Menu
          </button>
        </div>
      </header>
      <div className="min-h-[calc(100dvh-57px)] bg-[linear-gradient(var(--color-plataforma-bruma),var(--color-papel)_220px)] md:grid md:grid-cols-[232px_1fr] md:gap-6 md:p-4">
        <nav
          id="menu-plataforma"
          aria-label="Plataforma"
          className={`${menuAberto ? "grid" : "hidden"} m-3 content-start gap-1 rounded-xl border border-linha bg-superficie p-2 shadow-sm md:sticky md:top-4 md:m-0 md:grid md:self-start`}
        >
          <ItemMenu href="/" atual={caminho === "/"}>Início</ItemMenu>
          {pode("config.ver") ? <ItemMenu href="/configuracoes" atual={caminho.startsWith("/configuracoes")}>Configurações</ItemMenu> : null}
          {pode("pessoas.ver") ? <ItemMenu href="/pessoas" atual={caminho.startsWith("/pessoas")}>Pessoas e acesso</ItemMenu> : null}
          <p className="mt-2 border-t border-linha px-3 pt-2 text-xs text-tinta-suave">Atendimentos, moradores e avisos chegam nos próximos passos.</p>
        </nav>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:px-2 md:py-4">{children}</main>
      </div>
      <Dialogo aberto={trocando} titulo="Trocar condomínio" aoFechar={() => setTrocando(false)}>
        <ListaCondominios condominios={sessao.condominios} atual={painel.condominio.id} aoEscolher={(id) => { setTrocando(false); aoTrocar(id); }} />
        <div className="flex justify-end"><Botao variante="secundario" onClick={() => setTrocando(false)}>Cancelar</Botao></div>
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
      <main id="conteudo" className="grid min-h-dvh place-items-center bg-superficie-2 px-4 py-10">
        <div className="grid w-full max-w-md gap-5 rounded-xl border border-linha bg-superficie p-6 shadow-sm">
          <Marca sistema="Plataforma do síndico" />
          <h1 className="text-2xl font-semibold tracking-tight">Em qual condomínio?</h1>
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
