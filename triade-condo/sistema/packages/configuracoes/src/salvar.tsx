"use client";
// Um Salvar por página (decisão B.1 da análise de Configurações): cada parte da página diz quantas
// mudanças tem e sabe se gravar; a barra fixa no rodapé aparece quando algo mudou e grava as partes
// uma depois da outra. Se uma falha, as que já foram ficam gravadas, a tela diz qual faltou e o que
// foi digitado continua lá. Desfazer volta tudo ao que está salvo. Partes que gravam a mesma linha
// do banco dividem a versão: cada gravação devolve a nova, e a próxima parte usa essa.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Botao, Dialogo } from "@triade/ui";

export interface Parte {
  /** Nome curto que aparece no recado ("Horário de atendimento"). */
  nome: string;
  mudancas: number;
  /** Grava; devolve o texto de sucesso ou null quando falhou (a parte mostra o erro). */
  salvar: () => Promise<string | null>;
}

interface Contexto {
  registrar: (id: string, parte: Parte | null) => void;
  versao: (chave: string, inicial: number) => number;
  novaVersao: (chave: string, valor: unknown) => void;
}

const Ctx = createContext<Contexto | null>(null);

/** Registra a parte na página. Fora de uma página salvável (não deve acontecer), não faz nada. */
export function useParte(id: string, parte: Parte) {
  const ctx = useContext(Ctx);
  const ref = useRef(parte);
  ref.current = parte;
  const { nome, mudancas } = parte;
  useEffect(() => {
    ctx?.registrar(id, { nome, mudancas, salvar: () => ref.current.salvar() });
  }, [ctx, id, nome, mudancas]);
  useEffect(() => () => ctx?.registrar(id, null), [ctx, id]);
}

/** A versão de uma linha que várias partes gravam ("config"): a última que a API devolveu. */
export function useVersao(chave: string, inicial: number) {
  const ctx = useContext(Ctx);
  return useMemo(() => ({
    atual: () => ctx?.versao(chave, inicial) ?? inicial,
    gravou: (resposta: unknown) => {
      const v = (resposta as { versao?: unknown } | null)?.versao;
      ctx?.novaVersao(chave, v);
    },
  }), [ctx, chave, inicial]);
}

/** Quantas coisas são diferentes entre dois objetos rasos (listas comparadas pelo conteúdo). */
export function contarMudancas<T extends Record<string, unknown>>(antes: T, agora: T): number {
  return Object.keys(agora).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(agora[k])).length;
}

const CONTROLES = "input:not([type=search]):not([type=file]):not([type=hidden]), select, textarea";
const valorDe = (c: Element) =>
  c instanceof HTMLInputElement && (c.type === "checkbox" || c.type === "radio") ? String(c.checked) : (c as HTMLInputElement).value;

/** O destaque no campo que mudou (D4.15): sem mudança pendente, o que está na tela é o salvo; com
 * mudança, o campo diferente do salvo (ou que nasceu agora, como um intervalo novo) ganha data-mudou. */
function useDestaque(caixa: { current: HTMLDivElement | null }, total: number, vez: number) {
  const salvo = useRef(new WeakMap<Element, string>());
  // O controle que a pessoa mexeu antes de a barra contar a mudança não vira valor salvo.
  const tocados = useRef(new WeakSet<Element>());
  const totalAgora = useRef(total);
  totalAgora.current = total;
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    salvo.current = new WeakMap();
    const conferir = () => {
      for (const c of el.querySelectorAll(CONTROLES)) {
        if (!totalAgora.current) {
          if (!tocados.current.has(c)) { salvo.current.set(c, valorDe(c)); c.removeAttribute("data-mudou"); }
          continue;
        }
        const antes = salvo.current.get(c);
        if (antes === undefined || antes !== valorDe(c)) c.setAttribute("data-mudou", "");
        else c.removeAttribute("data-mudou");
      }
    };
    const depois = () => requestAnimationFrame(conferir);
    const mexeu = (e: Event) => {
      const alvo = e.target instanceof HTMLLabelElement ? e.target.control : e.target;
      if (alvo instanceof Element && alvo.matches(CONTROLES) && !totalAgora.current) tocados.current.add(alvo);
      depois();
    };
    conferir();
    el.addEventListener("input", mexeu);
    el.addEventListener("change", mexeu);
    el.addEventListener("click", mexeu);
    const obs = new MutationObserver(depois);
    obs.observe(el, { childList: true, subtree: true });
    return () => { el.removeEventListener("input", mexeu); el.removeEventListener("change", mexeu); el.removeEventListener("click", mexeu); obs.disconnect(); };
  }, [caixa, vez]);
  useEffect(() => {
    if (!total) tocados.current = new WeakSet();
    requestAnimationFrame(() => caixa.current?.dispatchEvent(new Event("change")));
  }, [caixa, total]);
}

/** O aviso ao sair por um link do app com mudanças não salvas (D4.15); fechar ou recarregar a aba
 * continua com o aviso do navegador. */
function useSaidaPorLink(total: number) {
  const [saindo, setSaindo] = useState<string | null>(null);
  useEffect(() => {
    if (!total) return;
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const destino = new URL(a.href, window.location.href);
      if (destino.origin !== window.location.origin || (destino.pathname === window.location.pathname && destino.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setSaindo(destino.pathname + destino.search + destino.hash);
    };
    document.addEventListener("click", clique, true);
    return () => document.removeEventListener("click", clique, true);
  }, [total]);
  return { saindo, ficar: () => setSaindo(null) };
}

/**
 * A página com a barra de salvar. `aoSalvar` recebe o texto do recado quando tudo foi gravado
 * (quem hospeda recarrega e mostra). Os filhos remontam no Desfazer.
 */
export function PaginaSalvavel({ children, aoSalvar }: { children: ReactNode; aoSalvar: (texto: string) => void }) {
  const [partes, setPartes] = useState<Record<string, Parte>>({});
  const [feitas, setFeitas] = useState<string[]>([]);
  const [vez, setVez] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState<string | null>(null);
  const versoes = useRef(new Map<string, number>());

  const registrar = useCallback((id: string, parte: Parte | null) => {
    setPartes((p) => {
      if (!parte) { const { [id]: _fora, ...resto } = p; return resto; }
      const antes = p[id];
      if (antes && antes.mudancas === parte.mudancas && antes.nome === parte.nome) return p;
      return { ...p, [id]: parte };
    });
  }, []);
  const ctx = useMemo<Contexto>(() => ({
    registrar,
    versao: (chave, inicial) => versoes.current.get(chave) ?? inicial,
    novaVersao: (chave, valor) => { if (typeof valor === "number") versoes.current.set(chave, valor); },
  }), [registrar]);

  const pendentes = Object.entries(partes).filter(([id, p]) => p.mudancas > 0 && !feitas.includes(id));
  const total = pendentes.reduce((s, [, p]) => s + p.mudancas, 0);
  const caixa = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useDestaque(caixa, total, vez);
  const saida = useSaidaPorLink(total);

  useEffect(() => {
    if (!total) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [total]);

  function recomecar() {
    versoes.current.clear();
    setFeitas([]);
    setFalhou(null);
    setPartes({});
    setVez((n) => n + 1);
  }

  async function salvar() {
    setEnviando(true);
    setFalhou(null);
    const textos: string[] = [];
    const agora = [...feitas];
    for (const [id, p] of pendentes) {
      const texto = await p.salvar();
      if (texto === null) {
        setFeitas(agora);
        setEnviando(false);
        setFalhou(textos.length
          ? `${textos.join(" ")} Falta: ${p.nome}. Veja o que corrigir nessa parte e salve de novo.`
          : `Nada foi salvo. Veja o que corrigir em ${p.nome}.`);
        return;
      }
      textos.push(texto);
      agora.push(id);
    }
    setEnviando(false);
    recomecar();
    aoSalvar(textos.join(" "));
  }

  return (
    <Ctx.Provider value={ctx}>
      {falhou ? <div className="mb-4"><Aviso tom="atencao" papel="alert">{falhou}</Aviso></div> : null}
      <div key={vez} ref={caixa} className="grid gap-5">{children}</div>
      {total ? <BarraSalvar total={total} enviando={enviando} aoDesfazer={recomecar} aoSalvar={() => void salvar()} /> : null}
      <Dialogo aberto={saida.saindo !== null} titulo="Sair sem salvar?" aoFechar={saida.ficar}>
        <div className="grid gap-4">
          <p>{total === 1 ? "1 mudança desta página ainda não foi salva" : `${total} mudanças desta página ainda não foram salvas`}. Se sair agora, elas se perdem.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => { const destino = saida.saindo!; saida.ficar(); recomecar(); router.push(destino); }}>Sair sem salvar</Botao>
            <Botao onClick={saida.ficar}>Continuar aqui</Botao>
          </div>
        </div>
      </Dialogo>
    </Ctx.Provider>
  );
}

function BarraSalvar({ total, enviando, aoDesfazer, aoSalvar }: { total: number; enviando: boolean; aoDesfazer: () => void; aoSalvar: () => void }) {
  const texto = total === 1 ? "1 mudança ainda não salva" : `${total} mudanças ainda não salvas`;
  return (
    <div role="region" aria-label="Mudanças ainda não salvas"
      className="sticky bottom-0 z-20 -mx-4 mt-5 flex items-center gap-3 border-t border-linha bg-superficie px-4 py-3 shadow-s2 max-md:bottom-[calc(61px+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
      <span className="flex min-w-0 flex-1 items-center gap-2 t-texto font-medium" aria-live="polite">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-acento" />{texto}
      </span>
      <Botao variante="discreto" tamanho="m" onClick={aoDesfazer} disabled={enviando}>Desfazer</Botao>
      <Botao tamanho="m" onClick={aoSalvar} disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao>
    </div>
  );
}
