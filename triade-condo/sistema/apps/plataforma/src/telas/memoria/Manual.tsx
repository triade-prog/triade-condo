"use client";
// Manual do prédio (DC15, telas-modelo documentos-memoria-*; canvas do novo frontend, quadros 95 e
// 96; MP-14): seções curtas, em ordem, escritas pela gestão. As marcadas "no mural" aparecem numa
// aba do mural online, sem conta; as outras ficam para a gestão e para o próximo síndico. A linha
// inteira abre a seção; Ver no mural, Subir, Descer e Tirar do manual ficam em Mais ações. As
// sugestões para escrever ficam fechadas numa linha só. Mudar guarda a versão anterior.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { mostrarDataCurta, SECOES_SUGERIDAS } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro,
  type ErroApi,
} from "@triade/ui";
import type { PropsAbaMemoria } from "../documentos/DocumentosEMemoria.tsx";
import { diaDe, diaHora } from "../pedidos/comum.tsx";
import { MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Manual, SecaoManual } from "../tipos.ts";

interface Versoes {
  versoes: { numero: number; titulo: string; texto: string; escritaEm: string; autor?: string; substituidaEm: string }[];
}
type Editando = { secao: SecaoManual | { titulo: string; resumo?: string }; tirar?: boolean };

export function AbaManual({ feito, definir }: PropsAbaMemoria) {
  const carga = useCarregar<Manual>("/v1/condominio/memoria/manual");
  const [editando, setEditando] = useState<Editando | null>(null);
  const [verSugestoes, setVerSugestoes] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const podeEditar = carga.estado === "pronto" && carga.dados.podeEditar;
  useEffect(() => {
    definir({ principal: podeEditar ? { texto: "Nova seção", icone: "mais", aoClicar: () => setEditando({ secao: { titulo: "" } }) } : null });
  }, [podeEditar, definir]);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o manual…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="o manual" />;
  const m = carga.dados;
  const escritos = new Set(m.secoes.map((s) => s.titulo.trim().toLowerCase()));
  const sugestoes = SECOES_SUGERIDAS.filter((s) => !escritos.has(s.titulo.toLowerCase()));
  const noMural = m.secoes.filter((s) => s.noMural).length;
  const mudou = (texto: string) => { setEditando(null); carga.recarregar(); feito(texto); };

  async function mover(i: number, para: number) {
    const ids = m.secoes.map((s) => s.id);
    [ids[i], ids[para]] = [ids[para]!, ids[i]!];
    setErro(null);
    const r = await chamarApi("/v1/condominio/memoria/manual/ordem", { metodo: "PUT", corpo: { ids } });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }
  const acoes = (s: SecaoManual, i: number): ItemMenu[] => [
    ...(s.noMural ? [{ texto: "Ver no mural", icone: "olho" as const, apoio: "Como o morador vê", href: "/comunicados/no-mural?aba=manual" }] : []),
    ...(m.podeEditar && i > 0 ? [{ texto: "Subir", icone: "seta" as const, rotulo: `Subir ${s.titulo}`, acao: () => void mover(i, i - 1) }] : []),
    ...(m.podeEditar && i < m.secoes.length - 1 ? [{ texto: "Descer", icone: "baixo" as const, rotulo: `Descer ${s.titulo}`, acao: () => void mover(i, i + 1) }] : []),
    ...(m.podeEditar ? [{ texto: "Tirar do manual", icone: "sair" as const, perigo: true, rotulo: `Tirar do manual ${s.titulo}`, acao: () => setEditando({ secao: s, tirar: true }) }] : []),
  ];

  return (
    <div className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {!m.muralLigado && noMural ? (
        <Aviso tom="atencao" titulo="O mural online está desligado">
          As seções marcadas só aparecem para os moradores quando o mural estiver ligado em <Link href="/configuracoes/mural" className="font-medium underline">Configurações › Mural e e-mail</Link>.
        </Aviso>
      ) : null}
      <section aria-labelledby="mn-secoes" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 md:border-b md:border-linha md:px-5 md:py-3.5">
          <h2 id="mn-secoes" className="t-titulo-cartao font-semibold">{m.secoes.length === 1 ? "1 seção" : `${m.secoes.length} seções`}</h2>
          {m.secoes.length ? <span className="t-apoio">{noMural ? `${noMural} no mural dos moradores` : "Nenhuma no mural dos moradores"}</span> : null}
        </div>
        {m.secoes.length === 0 ? <p className="t-apoio px-5 py-4 max-md:px-0">Nenhuma seção escrita ainda. Comece por uma das sugestões abaixo.</p> : (
          <ol className="grid max-md:gap-2.5">
            {m.secoes.map((s, i) => {
              const mais = acoes(s, i);
              return (
                <li key={s.id} className="relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[44px_minmax(0,1fr)_140px_170px_44px_20px] md:border-t md:border-linha md:first:border-t-0">
                  <span className="ladrilho h-11 w-11 rounded-xl font-mono t-titulo-cartao font-semibold" data-tom="violeta" aria-hidden="true">{i + 1}</span>
                  <span className="grid min-w-0 gap-0.5">
                    <button type="button" className="elo-linha" onClick={() => setEditando({ secao: s })}>{s.titulo}</button>
                    <span className="t-apoio line-clamp-1">{s.resumo ?? s.texto.slice(0, 90)}</span>
                    <span className="pt-1 md:hidden">{s.noMural ? <Selo tom="ok">No mural</Selo> : <Selo tom="neutro">Só a gestão</Selo>}</span>
                  </span>
                  <span className="max-md:hidden">{s.noMural ? <Selo tom="ok">No mural</Selo> : <Selo tom="neutro">Só a gestão</Selo>}</span>
                  <span className="t-apoio max-md:hidden">Mudou em {mostrarDataCurta(diaDe(s.escritaEm))}</span>
                  <span className="relative z-10">{mais.length ? <MenuAcoes rotulo={`Mais ações: ${s.titulo}`} itens={mais} /> : null}</span>
                  <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:hidden" />
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {m.podeEditar && sugestoes.length ? (
        <section aria-label="Sugestões para escrever" className="grid gap-3 rounded-[18px] border-[1.5px] border-dashed border-violeta-300 bg-violeta-50/60 px-5 py-3.5 max-md:px-4">
          <button type="button" aria-expanded={verSugestoes} onClick={() => setVerSugestoes(!verSugestoes)} className="flex w-full items-center gap-3 text-left">
            <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="lista" /></span>
            <span className="grid min-w-0 flex-1">
              <span className="t-titulo-cartao font-semibold">{sugestoes.length === 1 ? "1 sugestão para escrever" : `${sugestoes.length} sugestões para escrever`}</span>
              <span className="t-apoio">{sugestoes.slice(0, 3).map((s) => s.titulo).join(", ")}{sugestoes.length > 3 ? ` e mais ${sugestoes.length - 3}` : ""}</span>
            </span>
            <Icone nome="baixo" className={`h-5 w-5 text-tinta-suave ${verSugestoes ? "rotate-180" : ""}`} />
          </button>
          {verSugestoes ? (
            <ul className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <li key={s.titulo}><Botao variante="contorno" tamanho="m" onClick={() => setEditando({ secao: { titulo: s.titulo, resumo: s.resumo } })}><Icone nome="mais" />{s.titulo}</Botao></li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <p className="t-apoio">Cada seção escolhe se aparece no mural do prédio. Seção nova começa só para a gestão. O manual entra inteiro no dossiê de passagem.</p>
      {editando ? <FormSecao secao={editando.secao} tirarLogo={editando.tirar} podeEditar={m.podeEditar} aoFechar={() => setEditando(null)} aoSalvar={mudou} /> : null}
    </div>
  );
}

function FormSecao({ secao, tirarLogo, podeEditar, aoFechar, aoSalvar }: {
  secao: SecaoManual | { titulo: string; resumo?: string }; tirarLogo?: boolean; podeEditar: boolean; aoFechar: () => void; aoSalvar: (t: string) => void;
}) {
  const existente = "id" in secao ? secao : null;
  const [v, setV] = useState({ titulo: secao.titulo, resumo: secao.resumo ?? "", texto: existente?.texto ?? "", noMural: existente?.noMural ?? false });
  const [modo, setModo] = useState<"editar" | "tirar" | "versoes">(tirarLogo ? "tirar" : "editar");
  const [motivo, setMotivo] = useState("");
  const [versoes, setVersoes] = useState<Versoes["versoes"] | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = { ...v, ...(existente ? { versao: existente.versao } : {}) };
    const r = existente
      ? await chamarApi(`/v1/condominio/memoria/manual/${existente.id}`, { metodo: "PUT", corpo })
      : await chamarApi("/v1/condominio/memoria/manual", { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(existente ? "Seção salva. A versão anterior ficou guardada." : `Seção escrita: ${v.titulo.trim()}.`);
  }
  async function tirar(ev: FormEvent) {
    ev.preventDefault();
    if (!existente) return;
    setErro(null);
    const r = await chamarApi(`/v1/condominio/memoria/manual/${existente.id}/retirar`, { corpo: { versao: existente.versao, motivo } });
    if (!r.ok) return setErro(r.erro);
    aoSalvar("A seção saiu do manual e do mural. Ela continua guardada no histórico.");
  }
  async function verVersoes() {
    if (!existente) return;
    const r = await chamarApi<Versoes>(`/v1/condominio/memoria/manual/${existente.id}`);
    if (r.ok) { setVersoes(r.dados.versoes); setModo("versoes"); }
  }

  if (!podeEditar && existente) {
    return (
      <Dialogo aberto titulo={existente.titulo} aoFechar={aoFechar}>
        <p className="t-texto whitespace-pre-line">{existente.texto}</p>
        <p className="t-apoio text-tinta-suave">Escrita {existente.autor ? `por ${existente.autor} ` : ""}em {diaHora(existente.escritaEm)}.</p>
        <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
      </Dialogo>
    );
  }
  return (
    <Dialogo aberto media titulo={existente ? existente.titulo : "Nova seção do manual"} aoFechar={aoFechar}>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {modo === "versoes" ? (
        <div className="grid gap-3">
          {versoes?.length ? (
            <ol className="divide-y divide-linha rounded-xl border border-linha">
              {versoes.map((x) => (
                <li key={x.numero} className="grid gap-0.5 px-3 py-2 t-texto">
                  <span className="font-medium">Versão {x.numero}: {x.titulo}</span>
                  <span className="whitespace-pre-line">{x.texto}</span>
                  <span className="t-apoio text-tinta-suave">Escrita {x.autor ? `por ${x.autor} ` : ""}em {diaHora(x.escritaEm)} · trocada em {diaHora(x.substituidaEm)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="t-apoio text-tinta-suave">Esta seção ainda não mudou.</p>}
          <div className="flex justify-end"><Botao variante="contorno" onClick={() => setModo("editar")}>Voltar</Botao></div>
        </div>
      ) : modo === "tirar" ? (
        <form onSubmit={tirar} noValidate className="grid gap-3">
          <CampoAreaTexto id="mn-motivo" rotulo="Por que tirar a seção" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={comErro.includes("motivo") ? "Explique o motivo (de 3 a 500 caracteres)." : null} ajuda="Sai do manual e do mural. Fica guardada no histórico." />
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="discreto" onClick={() => (tirarLogo ? aoFechar() : setModo("editar"))}>{tirarLogo ? "Cancelar" : "Voltar"}</Botao>
            <Botao type="submit" variante="perigo">Tirar do manual</Botao>
          </div>
        </form>
      ) : (
        <form onSubmit={salvar} noValidate className="grid gap-3">
          <CampoTexto id="mn-titulo" rotulo="Título" required maxLength={80} value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })}
            erro={comErro.includes("titulo") ? "De 3 a 80 caracteres." : null} />
          <CampoTexto id="mn-resumo" rotulo="Resumo" opcional maxLength={160} value={v.resumo} onChange={(e) => setV({ ...v, resumo: e.target.value })}
            erro={comErro.includes("resumo") ? "De 3 a 160 caracteres." : null} />
          <CampoAreaTexto id="mn-texto" rotulo="Texto" rows={8} maxLength={8000} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })}
            placeholder="O registro geral de água fica na casa de bombas, atrás do portão da garagem." erro={comErro.includes("texto") ? "De 3 a 8.000 caracteres." : null} />
          <label className="flex items-start gap-2 t-texto">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-violeta-600" checked={v.noMural} onChange={(e) => setV({ ...v, noMural: e.target.checked })} />
            <span><span className="font-medium">Mostrar no mural do prédio</span><span className="block t-apoio text-tinta-suave">Qualquer pessoa com o link do mural lê, sem conta. Deixe desmarcado o que é só da gestão.</span></span>
          </label>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="flex flex-wrap gap-2">
              {existente?.versoes ? <Botao variante="discreto" tamanho="m" onClick={() => void verVersoes()}>Versões anteriores ({existente.versoes})</Botao> : null}
              {existente ? <Botao variante="discreto" tamanho="m" className="text-erro" onClick={() => setModo("tirar")}>Tirar do manual</Botao> : null}
            </span>
            <span className="flex flex-wrap gap-2">
              <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
              <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar seção"}</Botao>
            </span>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
