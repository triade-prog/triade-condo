"use client";
// Moldura da Plataforma do síndico (DC15, docs/design/telas-modelo/moldura-*.html): barra de cima
// com a marca, a busca, o condomínio, o sino e a pessoa; no computador, a lateral com o Início e
// quatro grupos por tarefa (menu.ts); no celular, a barra de baixo com os atalhos e "Mais". A tela
// que a pessoa não pode abrir mostra o estado "sem permissão" no lugar do conteúdo.
// O condomínio vem da sessão no servidor; quem atende mais de um escolhe e troca aqui (MU-04).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FUNCOES_PLATAFORMA } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, DestinosDosEstados, Dialogo, ErroCarregar, Icone, Iniciais, Marca, SemPermissao, textoDoErro, type ErroApi } from "@triade/ui";
import { SinoAvisos } from "./Avisos.tsx";
import { GRUPOS_MENU, itemDoCaminho, ITENS_MENU, type ItemDoMenu } from "./menu.ts";
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
            className="escolha"
          >
            <span className="t-titulo-cartao">{c.nome}</span>
            <span className="t-apoio">{nomeFuncoes(c.funcoes)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Contagem({ item, painel }: { item: ItemDoMenu; painel: Painel }) {
  const c = item.contagem?.(painel);
  return c ? <span className="contagem">{c.n}<span className="sr-only"> {c.nome}</span></span> : null;
}

/** O menu inteiro: na lateral do computador e na folha "Mais" do celular. */
function Menu({ itens, painel, escolhido, aoIr }: { itens: ItemDoMenu[]; painel: Painel; escolhido: ItemDoMenu | null; aoIr?: () => void }) {
  const ligacao = (item: ItemDoMenu) => (
    <Link key={item.href} href={item.href} aria-current={item === escolhido ? "page" : undefined} onClick={aoIr}>
      <Icone nome={item.icone} />
      <span className="flex-1">{item.texto}</span>
      <Contagem item={item} painel={painel} />
    </Link>
  );
  return (
    <>
      {itens.filter((i) => i.grupo === null).map(ligacao)}
      {GRUPOS_MENU.map((g) => {
        const doGrupo = itens.filter((i) => i.grupo === g);
        if (!doGrupo.length) return null;
        const id = `grupo-${g.normalize("NFD").replace(/[^a-zA-Z]+/g, "-").toLowerCase()}`;
        return (
          <div key={g} role="group" aria-labelledby={id} className="grid gap-0.5">
            <span id={id} className="grupo">{g}</span>
            {doGrupo.map(ligacao)}
          </div>
        );
      })}
    </>
  );
}

/** A pessoa no topo: abre o menu com o condomínio, trocar e sair. */
function Conta({ sessao, painel, aoTrocar, aoSair }: { sessao: Sessao; painel: Painel; aoTrocar: () => void; aoSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="conta">
      <button type="button" className="pessoa" aria-expanded={aberto} aria-controls="menu-pessoa" onClick={() => setAberto((v) => !v)}>
        <Iniciais nome={painel.pessoa.nome} />
        <span className="sr-only">{`Conta de ${painel.pessoa.nome}, ${nomeFuncoes(painel.funcoes)}`}</span>
        <span className="nome max-lg:hidden" aria-hidden="true">{painel.pessoa.nome}<small>{nomeFuncoes(painel.funcoes)}</small></span>
      </button>
      {aberto ? (
        <div id="menu-pessoa" className="menu-pessoa">
          <div className="quem">
            <span className="t-titulo-cartao">{painel.pessoa.nome}</span>
            <span className="t-apoio">{nomeFuncoes(painel.funcoes)} · {painel.condominio.nome}</span>
          </div>
          {sessao.condominios.length > 1 ? (
            <Botao variante="discreto" tamanho="m" onClick={() => { setAberto(false); aoTrocar(); }}><Icone nome="trocar" />Trocar condomínio</Botao>
          ) : null}
          <Botao variante="discreto" tamanho="m" onClick={aoSair}><Icone nome="sair" />Sair</Botao>
        </div>
      ) : null}
    </div>
  );
}

/** A busca do topo: no computador, na barra; no celular, numa janela aberta pela lupa. */
function FormBusca({ className = "", chave, aoBuscar }: { className?: string; chave: string; aoBuscar: (q: string) => void }) {
  return (
    <form role="search" action="/busca" className={`busca ${className}`}
      onSubmit={(e) => { e.preventDefault(); aoBuscar(String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}>
      <Icone nome="busca" />
      <input type="search" name="q" maxLength={60} aria-label="Buscar no condomínio" placeholder="Buscar pedido, unidade ou pessoa" key={chave}
        className="campo placeholder:text-tinta-suave" />
    </form>
  );
}

function LigacaoDoApp({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return <Link href={href} className={className}>{children}</Link>;
}

function Moldura({ sessao, painel, aoTrocar, children }: { sessao: Sessao; painel: Painel; aoTrocar: (id: string) => void; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const [mais, setMais] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const pode = (acao: string) => painel.acoes.includes(acao);
  const itens = ITENS_MENU.filter((i) => i.ve(pode, painel));
  const daTela = itemDoCaminho(caminho);
  const escolhido = daTela && itens.includes(daTela) ? daTela : null;
  const semAcesso = daTela && !escolhido && !daTela.semGuarda ? daTela : null;
  const atalhos = itens.filter((i) => i.atalho);
  const buscar = pode("pedidos.ver") || pode("moradores.ver");
  const destinos = {
    inicio: "/", suporte: pode("suporte.chamados") ? "/suporte" : undefined, Ligacao: LigacaoDoApp,
    quemDaPermissao: "Quem dá essa permissão é o síndico, em Pessoas e acesso.",
  };

  async function sair() {
    await chamarApi("/v1/auth/sair", { corpo: {} });
    router.replace("/entrar");
  }

  return (
    <DestinosDosEstados value={destinos}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="topo">
        <span className="marca"><Marca sistema="Plataforma do síndico" /></span>
        {buscar ? <FormBusca className="max-md:hidden" chave={caminho} aoBuscar={(q) => router.push(`/busca?q=${encodeURIComponent(q)}`)} /> : null}
        {buscar ? (
          <button type="button" className="emblema md:hidden" aria-label="Buscar no condomínio" onClick={() => setBuscando(true)}><Icone nome="busca" /></button>
        ) : null}
        {sessao.condominios.length > 1 ? (
          <button type="button" className="condominio max-md:hidden" aria-label={`Trocar condomínio, agora ${painel.condominio.nome}`} onClick={() => setTrocando(true)}>
            <Icone nome="predio" />{painel.condominio.nome}<Icone nome="baixo" />
          </button>
        ) : (
          <span className="condominio max-md:hidden"><Icone nome="predio" />{painel.condominio.nome}</span>
        )}
        {painel.avisosNaoVistos !== undefined ? <SinoAvisos naoVistos={painel.avisosNaoVistos} /> : null}
        <Conta sessao={sessao} painel={painel} aoTrocar={() => setTrocando(true)} aoSair={sair} />
      </header>
      <div className="min-h-[calc(100dvh-63px)] pb-24 md:grid md:grid-cols-[248px_minmax(0,1fr)] md:gap-8 md:p-6 md:pb-6">
        <nav id="menu-plataforma" aria-label="Plataforma" className="lateral max-md:hidden md:sticky md:top-6 md:self-start">
          <Menu itens={itens} painel={painel} escolhido={escolhido} />
        </nav>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:p-0">
          {semAcesso ? (
            semAcesso.permissao
              ? <SemPermissao tela={semAcesso.texto} permissao={semAcesso.permissao} />
              : <SemPermissao tela={semAcesso.texto} texto="Esta parte é só do síndico." nota="Se precisar de algo daqui, fale com o síndico." />
          ) : children}
        </main>
      </div>
      <nav aria-label="Atalhos" className="barra-baixo">
        {atalhos.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item === escolhido ? "page" : undefined}>
            <Icone nome={item.icone} />
            {item.texto}
            <Contagem item={item} painel={painel} />
          </Link>
        ))}
        <button type="button" aria-expanded={mais} aria-controls="menu-mais" onClick={() => setMais(true)}>
          <Icone nome="menu" />Mais
        </button>
      </nav>
      <Dialogo aberto={mais} titulo="Menu" aoFechar={() => setMais(false)}>
        <nav id="menu-mais" aria-label="Plataforma" className="lateral border-0 p-0 shadow-none">
          <Menu itens={itens} painel={painel} escolhido={escolhido} aoIr={() => setMais(false)} />
        </nav>
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setMais(false)}>Fechar</Botao></div>
      </Dialogo>
      <Dialogo aberto={buscando} titulo="Buscar no condomínio" aoFechar={() => setBuscando(false)}>
        <FormBusca chave={caminho} aoBuscar={(q) => { setBuscando(false); router.push(`/busca?q=${encodeURIComponent(q)}`); }} />
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setBuscando(false)}>Fechar</Botao></div>
      </Dialogo>
      <Dialogo aberto={trocando} titulo="Trocar condomínio" aoFechar={() => setTrocando(false)}>
        <ListaCondominios condominios={sessao.condominios} atual={painel.condominio.id} aoEscolher={(id) => { setTrocando(false); aoTrocar(id); }} />
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setTrocando(false)}>Cancelar</Botao></div>
      </Dialogo>
    </DestinosDosEstados>
  );
}

function PainelDoCondominio({ sessao, aoTrocar, children }: { sessao: Sessao; aoTrocar: (id: string) => void; children: ReactNode }) {
  const painel = useCarregar<Painel>("/v1/condominio/painel");
  if (painel.estado !== "pronto") {
    return (
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="sr-only">Plataforma do síndico</h1>
        {painel.estado === "erro" ? <ErroCarregar erro={painel.erro} texto={painel.texto} tentarDeNovo={painel.recarregar} /> : <Carregando rotulo="Abrindo o painel…" />}
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
        {sessao.estado === "erro" ? <ErroCarregar erro={sessao.erro} texto={sessao.texto} tentarDeNovo={sessao.recarregar} /> : <Carregando rotulo="Abrindo o painel…" />}
      </main>
    );
  }

  const s = sessao.dados;
  if (!s.condominioAtual) {
    return (
      <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
        <div className="grid w-full max-w-md gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s3">
          <Marca sistema="Plataforma do síndico" />
          <h1 className="t-titulo-tela">Em qual condomínio?</h1>
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          {s.condominios.length ? (
            <>
              <ListaCondominios condominios={s.condominios} atual={null} aoEscolher={(id) => void escolher(id)} />
              <p className="t-apoio">Dá para trocar depois, no menu da sua conta, no topo da tela.</p>
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
