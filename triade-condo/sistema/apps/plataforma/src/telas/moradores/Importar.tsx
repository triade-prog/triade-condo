"use client";
// Importar planilha (F3.3, PI-04, MU-02): o CSV da administradora é lido aqui no navegador e
// a prévia aponta cada linha com erro antes de enviar. A importação é tudo ou nada, cria os
// blocos e unidades que faltam, não duplica o que já existe e deixa os contatos a confirmar.

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { lerPlanilhaMoradores, MODELO_PLANILHA, TEXTOS_CAMPO_PLANILHA, type LeituraPlanilha } from "@triade/domain";
import { Aviso, AvisoErro, Botao, classeBotao, Selo, textoDoErro, chamarApi, type ErroApi } from "@triade/ui";
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

function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {["Escolher arquivo", "Conferir", "Importar"].map((p, i) => (
        <li key={p} aria-current={atual === i + 1 ? "step" : undefined}
          className="rounded-full border border-linha px-3 py-1 aria-[current=step]:border-acao aria-[current=step]:bg-plataforma-bruma aria-[current=step]:font-semibold aria-[current=step]:text-acao-press">
          {i + 1} · {p}
        </li>
      ))}
    </ol>
  );
}

export function Importar() {
  const { pode, atualizar } = usePlataforma();
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraPlanilha | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const voltar = <Link href="/moradores" className="text-sm font-medium text-acao hover:underline">Voltar às unidades</Link>;

  if (!pode("moradores.editar")) {
    return (
      <div className="grid gap-3">{voltar}<h1 className="text-2xl font-semibold tracking-tight">Importar planilha</h1>
        <Aviso tom="atencao">Você não tem acesso a esta ação. Peça ao síndico a permissão Cadastrar moradores.</Aviso></div>
    );
  }

  async function escolher(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
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
      {voltar}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar planilha</h1>
        <p className="mt-1 text-tinta-suave">
          A lista de moradores e proprietários da administradora, salva como CSV no Excel ou no Google Planilhas. Colunas: torre ou bloco (opcional), andar
          (opcional), unidade, nome, telefone e relação (opcional). Também opcionais: mora na unidade e responsável pela unidade (sim ou não), parentesco e
          ocupa desde. Os nomes mais comuns são reconhecidos: torre, bloco, quadra, andar, pavimento, apto, celular, tipo.
        </p>
      </div>
      <Passos atual={passo} />

      {passo === 1 ? (
        <div className="grid justify-items-start gap-3 rounded-xl border border-linha bg-superficie p-5">
          <label htmlFor="i-arquivo" className="text-[13px] font-medium">Arquivo da planilha (CSV)</label>
          <input id="i-arquivo" type="file" accept=".csv,text/csv" onChange={(e) => void escolher(e)} aria-describedby="i-ajuda"
            className="text-sm file:mr-3 file:min-h-10 file:rounded-md file:border file:border-contorno file:bg-superficie file:px-3.5 file:text-sm file:font-semibold" />
          <p id="i-ajuda" className="text-xs text-tinta-suave">No Excel: Arquivo, Salvar como, CSV. Arquivo .xlsx precisa ser salvo como CSV antes.</p>
          {leitura?.faltam.length ? (
            <Aviso tom="erro">
              Não achamos {leitura.faltam.length === 1 ? "a coluna" : "as colunas"} {leitura.faltam.join(", ")} em {arquivo}. A primeira linha precisa ter os nomes das colunas, como no modelo.
            </Aviso>
          ) : null}
          <a href={MODELO} download="modelo-moradores.csv" className={classeBotao("secundario")}>Baixar modelo de planilha</a>
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
            <div className="overflow-x-auto rounded-lg border border-linha">
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
            <Botao variante="secundario" onClick={recomecar}>Escolher outro arquivo</Botao>
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
              <Link href="/moradores?filtro=sem-proprietario" className="font-medium text-acao underline">Ver quais</Link>
            </Aviso>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href="/moradores?aba=confirmar" className={classeBotao("primario")}>Conferir os contatos a confirmar</Link>
            <Botao variante="secundario" onClick={recomecar}>Importar outra planilha</Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}
