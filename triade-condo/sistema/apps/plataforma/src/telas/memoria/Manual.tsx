"use client";
// Manual do prédio (design "Memória do prédio", tela 4; MP-14): seções curtas, em ordem, escritas
// pela gestão. As marcadas "no mural" aparecem numa aba do mural online, sem conta; as outras
// ficam para a gestão e para o próximo síndico. Mudar guarda a versão anterior.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SECOES_SUGERIDAS } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro,
  type ErroApi,
} from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Manual, SecaoManual } from "../tipos.ts";
import type { PropsAbaMemoria } from "./Memoria.tsx";

interface Versoes {
  versoes: { numero: number; titulo: string; texto: string; escritaEm: string; autor?: string; substituidaEm: string }[];
}

export function AbaManual({ feito }: PropsAbaMemoria) {
  const carga = useCarregar<Manual>("/v1/condominio/memoria/manual");
  const [editando, setEditando] = useState<SecaoManual | { titulo: string; resumo?: string } | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o manual…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const m = carga.dados;
  const escritos = new Set(m.secoes.map((s) => s.titulo.trim().toLowerCase()));
  const sugestoes = SECOES_SUGERIDAS.filter((s) => !escritos.has(s.titulo.toLowerCase()));
  const mudou = (texto: string) => { setEditando(null); carga.recarregar(); feito(texto); };

  async function mover(i: number, para: number) {
    const ids = m.secoes.map((s) => s.id);
    [ids[i], ids[para]] = [ids[para]!, ids[i]!];
    setErro(null);
    const r = await chamarApi("/v1/condominio/memoria/manual/ordem", { metodo: "PUT", corpo: { ids } });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }

  return (
    <div className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {!m.muralLigado && m.secoes.some((s) => s.noMural) ? (
        <Aviso tom="atencao" titulo="O mural online está desligado">
          As seções marcadas só aparecem para os moradores quando o mural estiver ligado em <Link href="/configuracoes?aba=comunicados" className="font-medium underline">Configurações › Comunicados</Link>.
        </Aviso>
      ) : null}
      <section aria-labelledby="mn-secoes" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mn-secoes" className="text-lg font-medium">Seções</h2>
          {m.podeEditar ? <Botao tamanho="m" onClick={() => setEditando({ titulo: "" })}>+ Nova seção</Botao> : null}
        </div>
        {m.secoes.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma seção escrita ainda. Comece por uma das sugestões abaixo.</p> : (
          <ol className="divide-y divide-linha">
            {m.secoes.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grid min-w-0 flex-1 text-sm">
                  <span className="font-medium">{s.titulo}</span>
                  <span className="text-[13px] text-tinta-suave">{s.resumo ?? s.texto.slice(0, 90)}</span>
                </span>
                {s.noMural ? <Selo tom="ok">No mural</Selo> : <Selo tom="info">Só a gestão</Selo>}
                {m.podeEditar ? (
                  <span className="flex gap-1">
                    <Botao variante="discreto" tamanho="p" soIcone aria-label={`Subir ${s.titulo}`} disabled={i === 0} onClick={() => void mover(i, i - 1)}><Icone nome="seta" className="h-4 w-4 -rotate-90" /></Botao>
                    <Botao variante="discreto" tamanho="p" soIcone aria-label={`Descer ${s.titulo}`} disabled={i === m.secoes.length - 1} onClick={() => void mover(i, i + 1)}><Icone nome="baixo" className="h-4 w-4" /></Botao>
                    <Botao variante="discreto" tamanho="p" soIcone aria-label={`Editar ${s.titulo}`} onClick={() => setEditando(s)}><Icone nome="editar" className="h-4 w-4" /></Botao>
                  </span>
                ) : <Botao variante="discreto" tamanho="p" onClick={() => setEditando(s)}>Ler</Botao>}
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-tinta-suave">Cada seção escolhe se aparece no mural do prédio. Seção nova começa só para a gestão. O manual entra inteiro no dossiê de passagem.</p>
      </section>
      {m.podeEditar && sugestoes.length ? (
        <section aria-labelledby="mn-sugestoes" className="grid gap-2 rounded-2xl border border-dashed border-linha p-4">
          <h2 id="mn-sugestoes" className="font-medium">Sugestões para escrever</h2>
          <ul className="flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <li key={s.titulo}><Botao variante="contorno" tamanho="m" onClick={() => setEditando({ titulo: s.titulo, resumo: s.resumo })}><Icone nome="mais" />{s.titulo}</Botao></li>
            ))}
          </ul>
        </section>
      ) : null}
      {editando ? <FormSecao secao={editando} podeEditar={m.podeEditar} aoFechar={() => setEditando(null)} aoSalvar={mudou} /> : null}
    </div>
  );
}

function FormSecao({ secao, podeEditar, aoFechar, aoSalvar }: {
  secao: SecaoManual | { titulo: string; resumo?: string }; podeEditar: boolean; aoFechar: () => void; aoSalvar: (t: string) => void;
}) {
  const existente = "id" in secao ? secao : null;
  const [v, setV] = useState({ titulo: secao.titulo, resumo: secao.resumo ?? "", texto: existente?.texto ?? "", noMural: existente?.noMural ?? false });
  const [modo, setModo] = useState<"editar" | "tirar" | "versoes">("editar");
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
        <p className="text-sm whitespace-pre-line">{existente.texto}</p>
        <p className="text-xs text-tinta-suave">Escrita {existente.autor ? `por ${existente.autor} ` : ""}em {diaHora(existente.escritaEm)}.</p>
        <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
      </Dialogo>
    );
  }
  return (
    <Dialogo aberto titulo={existente ? existente.titulo : "Nova seção do manual"} aoFechar={aoFechar}>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {modo === "versoes" ? (
        <div className="grid gap-3">
          {versoes?.length ? (
            <ol className="divide-y divide-linha rounded-xl border border-linha">
              {versoes.map((x) => (
                <li key={x.numero} className="grid gap-0.5 px-3 py-2 text-sm">
                  <span className="font-medium">Versão {x.numero}: {x.titulo}</span>
                  <span className="whitespace-pre-line">{x.texto}</span>
                  <span className="text-xs text-tinta-suave">Escrita {x.autor ? `por ${x.autor} ` : ""}em {diaHora(x.escritaEm)} · trocada em {diaHora(x.substituidaEm)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-tinta-suave">Esta seção ainda não mudou.</p>}
          <div className="flex justify-end"><Botao variante="contorno" onClick={() => setModo("editar")}>Voltar</Botao></div>
        </div>
      ) : modo === "tirar" ? (
        <form onSubmit={tirar} noValidate className="grid gap-3">
          <CampoAreaTexto id="mn-motivo" rotulo="Por que tirar a seção" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={comErro.includes("motivo") ? "Explique o motivo (de 3 a 500 caracteres)." : null} ajuda="Sai do manual e do mural. Fica guardada no histórico." />
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => setModo("editar")}>Voltar</Botao>
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
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-violeta-600" checked={v.noMural} onChange={(e) => setV({ ...v, noMural: e.target.checked })} />
            <span><span className="font-medium">Mostrar no mural do prédio</span><span className="block text-xs text-tinta-suave">Qualquer pessoa com o link do mural lê, sem conta. Deixe desmarcado o que é só da gestão.</span></span>
          </label>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="flex flex-wrap gap-2">
              {existente?.versoes ? <Botao variante="discreto" tamanho="m" onClick={() => void verVersoes()}>Versões anteriores ({existente.versoes})</Botao> : null}
              {existente ? <Botao variante="discreto" tamanho="m" className="text-erro" onClick={() => setModo("tirar")}>Tirar do manual</Botao> : null}
            </span>
            <span className="flex flex-wrap gap-2">
              <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
              <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar seção"}</Botao>
            </span>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
