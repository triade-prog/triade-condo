"use client";
// Importar planilha (F3.3, PI-04, MU-02): o CSV da administradora é lido aqui no navegador e
// a prévia aponta cada linha com erro antes de enviar. A importação é tudo ou nada, cria os
// blocos e unidades que faltam, não duplica o que já existe e deixa os contatos a confirmar.
// DC15 (telas-modelo moradores-importar): barra dos três passos, área para escolher ou arrastar
// o arquivo e, ao lado, as colunas que a planilha pode ter.

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { lerPlanilhaMoradores, MODELO_PLANILHA, TEXTOS_CAMPO_PLANILHA, type LeituraPlanilha } from "@triade/domain";
import { Aviso, AvisoErro, Botao, classeBotao, Icone, Selo, textoDoErro, chamarApi, type ErroApi } from "@triade/ui";
import { CartaoFicha } from "./comum.tsx";
import { usePlataforma } from "../sessao.tsx";

interface Resultado {
  linhas: number;
  blocos: number;
  unidades: number;
  contatos: number;
  vinculos: number;
  ignoradas: number;
  semProprietario: number;
}

const LIMITE = 2000;
const MODELO = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${MODELO_PLANILHA}`)}`;

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

const PASSOS = ["Escolher arquivo", "Conferir", "Importar"];

const COLUNAS: [string, string][] = [
  ["Torre ou bloco", "opcional"], ["Andar", "opcional"], ["Unidade", "obrigatória"], ["Nome", "obrigatória"], ["Telefone", "obrigatória"],
  ["Relação", "opcional"], ["Mora na unidade", "opcional, sim ou não"], ["Responsável pela unidade", "opcional, sim ou não"],
  ["Parentesco e ocupa desde", "opcional"], ["E-mail", "opcional, a própria pessoa confirma"],
];

/** A barra dos três passos, com o nome de cada um embaixo. */
function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <div className="grid gap-2">
      <div className="passos" role="progressbar" aria-label="Passos da importação" aria-valuemin={1} aria-valuemax={3} aria-valuenow={atual}
        aria-valuetext={`Passo ${atual} de 3: ${PASSOS[atual - 1]}`}>
        {PASSOS.map((p, i) => <span key={p} data-feito={i < atual ? "" : undefined} />)}
      </div>
      <ol className="flex gap-1.5 text-xs" aria-hidden="true">
        {PASSOS.map((p, i) => (
          <li key={p} className={`flex-1 ${i + 1 === atual ? "font-semibold text-tinta" : i + 1 < atual ? "text-violeta-700" : "text-tinta-suave"}`}>{p}</li>
        ))}
      </ol>
    </div>
  );
}

export function Importar() {
  const { pode, atualizar } = usePlataforma();
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraPlanilha | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const voltar = (
    <Link href="/moradores" className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Moradores e unidades
    </Link>
  );

  if (!pode("moradores.editar")) {
    return (
      <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Importar planilha</h1>
        <Aviso tom="atencao">Você não tem acesso a esta ação. Peça ao síndico a permissão Cadastrar moradores.</Aviso></div>
    );
  }

  async function escolher(f: File | undefined) {
    setErro(null);
    setResultado(null);
    if (!f) return;
    setArquivo(f.name);
    setLeitura(lerPlanilhaMoradores(await f.text()));
  }

  async function importar() {
    if (!leitura) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<Resultado>("/v1/condominio/importacoes", { corpo: { linhas: leitura.linhas, agrupamento: leitura.agrupamento } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setResultado(r.dados);
    atualizar();
  }

  function soltar(ev: DragEvent<HTMLLabelElement>) {
    ev.preventDefault();
    setArrastando(false);
    void escolher(ev.dataTransfer.files[0]);
  }

  function recomecar() {
    setArquivo(null);
    setLeitura(null);
    setResultado(null);
    setErro(null);
  }

  const passo = resultado ? 3 : leitura && !leitura.faltam.length ? 2 : 1;
  const linhaDoErro = erro?.detalhes?.linha;
  const linhaNaPlanilha = typeof linhaDoErro === "number" && leitura ? leitura.origens[linhaDoErro - 1] : null;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        {voltar}
        <div>
          <h1 className="t-titulo-tela">Importar planilha</h1>
          <p className="t-apoio mt-1">A lista de moradores e proprietários da administradora, salva como CSV. Nada é gravado antes de você confirmar a importação.</p>
        </div>
      </div>

      <div className={`grid items-start gap-5 ${passo === 1 ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}>
      <section aria-label="Importação" className="grid gap-5 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-4">
      <Passos atual={passo} />

      {passo === 1 ? (
        <div className="grid gap-4">
          <label htmlFor="i-arquivo" onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
            data-arrastando={arrastando ? "" : undefined}
            className="grid cursor-pointer justify-items-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-violeta-300 bg-violeta-50 px-6 py-9 text-center hover:border-violeta-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violeta-600 data-[arrastando]:border-violeta-600">
            <span className="ladrilho h-12 w-12" data-tom="violeta" aria-hidden="true"><Icone nome="baixar" /></span>
            <span className="text-base font-semibold">Escolher planilha</span>
            <span className="t-apoio">ou arraste o arquivo CSV para cá</span>
            <span id="i-ajuda" className="text-[13px] text-tinta-suave">No Excel: Arquivo, Salvar como, CSV. Arquivo .xlsx precisa ser salvo como CSV antes.</span>
            <input id="i-arquivo" type="file" accept=".csv,text/csv" className="sr-only" aria-label="Arquivo da planilha (CSV)" aria-describedby="i-ajuda"
              onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {leitura?.faltam.length ? (
            <Aviso tom="erro">
              Não achamos {leitura.faltam.length === 1 ? "a coluna" : "as colunas"} {leitura.faltam.join(", ")} em {arquivo}. A primeira linha precisa ter os nomes das colunas, como no modelo.
            </Aviso>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={MODELO} download="modelo-moradores.csv" className={classeBotao("discreto")}><Icone nome="baixar" />Baixar modelo de planilha</a>
            <Link href="/moradores" className={classeBotao("contorno")}>Cancelar</Link>
          </div>
        </div>
      ) : null}

      {passo === 2 && leitura ? (
        <div className="grid gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {arquivo} · {plural(leitura.linhas.length + leitura.erros.length, "linha", "linhas")}
            <Selo tom="ok">{plural(leitura.linhas.length, "pronta", "prontas")}</Selo>
            {leitura.erros.length ? <Selo tom="atencao">{plural(leitura.erros.length, "com erro", "com erro")}</Selo> : null}
          </p>
          {erro ? (
            <AvisoErro erro={erro} texto={`${textoDoErro(erro)}${linhaNaPlanilha ? ` Linha ${linhaNaPlanilha} da planilha.` : ""}`} />
          ) : null}
          {leitura.erros.length ? (
            <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
              <table className="w-full text-sm">
                <caption className="sr-only">Linhas da planilha com erro</caption>
                <thead className="bg-superficie-2 text-left text-tinta-suave">
                  <tr><th scope="col" className="px-4 py-2.5 font-semibold">Linha</th><th scope="col" className="px-4 py-2.5 font-semibold">O que corrigir</th></tr>
                </thead>
                <tbody>
                  {leitura.erros.slice(0, 50).map((e) => (
                    <tr key={e.linha} className="border-t border-linha align-top">
                      <td className="px-4 py-2.5 tabular-nums">{e.linha}</td>
                      <td className="px-4 py-2.5">{e.campos.map((c) => TEXTOS_CAMPO_PLANILHA[c] ?? c).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {leitura.erros.length > 50 ? <p className="text-sm text-tinta-suave">Mais {leitura.erros.length - 50} linhas com erro não aparecem aqui.</p> : null}
          {leitura.linhas.length > LIMITE ? (
            <Aviso tom="atencao">São mais de {LIMITE} linhas prontas. Divida a planilha em partes de até {LIMITE} e importe uma de cada vez.</Aviso>
          ) : null}
          <p className="text-sm text-tinta-suave">
            {leitura.erros.length ? `Corrija na planilha e escolha o arquivo de novo, ou importe só as ${leitura.linhas.length} prontas. ` : ""}
            O que já existe não se repete. Todo contato importado fica a confirmar: só vale depois que o síndico conferir. Inclua o proprietário na planilha também quando a unidade tem inquilino.
            {leitura.agrupamento || leitura.linhas.some((l) => l.andar) ? " Se o condomínio ainda não usa torre, bloco ou andar, passa a usar, como na planilha." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={recomecar}>Escolher outro arquivo</Botao>
            <Botao disabled={enviando || leitura.linhas.length === 0 || leitura.linhas.length > LIMITE} onClick={() => void importar()}>
              {enviando ? "Importando…" : `Importar ${plural(leitura.linhas.length, "contato", "contatos")}`}
            </Botao>
          </div>
        </div>
      ) : null}

      {resultado ? (
        <div className="grid justify-items-start gap-3">
          <Aviso tom="ok">
            Importados: {plural(resultado.blocos, "torre ou bloco novo", "torres ou blocos novos")}, {plural(resultado.unidades, "unidade nova", "unidades novas")},{" "}
            {plural(resultado.vinculos, "contato a confirmar", "contatos a confirmar")}.
            {resultado.ignoradas ? ` ${plural(resultado.ignoradas, "linha já existia e ficou como estava", "linhas já existiam e ficaram como estavam")}.` : ""}
          </Aviso>
          {resultado.semProprietario ? (
            <Aviso tom="atencao">
              {plural(resultado.semProprietario, "unidade ficou", "unidades ficaram")} com inquilino e sem proprietário. Para controle, inclua o proprietário do
              imóvel em cada uma.{" "}
              <Link href="/moradores?filtro=sem-proprietario" className="font-medium text-violeta-600 underline">Ver quais</Link>
            </Aviso>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href="/moradores?aba=confirmar" className={classeBotao("primario")}>Conferir os contatos a confirmar</Link>
            <Botao variante="contorno" onClick={recomecar}>Importar outra planilha</Botao>
          </div>
        </div>
      ) : null}
      </section>

      {passo === 1 ? (
        <CartaoFicha id="colunas" titulo="Colunas que a planilha pode ter" icone="lista">
          <dl className="grid">
            {COLUNAS.map(([nome, como]) => (
              <div key={nome} className="flex justify-between gap-3 border-t border-linha py-2 text-sm">
                <dt>{nome}</dt>
                <dd className={`text-[13px] ${como === "obrigatória" ? "font-medium text-atencao" : "text-tinta-suave"}`}>{como}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2.5 text-[13px] text-tinta-suave">Reconhece os nomes mais comuns: torre, bloco, quadra, andar, pavimento, apto, celular, tipo.</p>
        </CartaoFicha>
      ) : null}
      </div>
    </div>
  );
}
