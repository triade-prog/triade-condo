"use client";
// Pessoas e acesso (DC15, telas-modelo pessoas-lista-*; V-09, CF-02, CF-03, CF-04, CF-05): quem
// entra na Plataforma deste condomínio, numa lista só (decisão A.1 de 23/10/2026). Cada linha diz
// numa frase o que a pessoa pode fazer e como atende os pedidos, e a linha inteira abre a ficha,
// onde ficam o acesso e o atendimento. No alto, para quem vão os pedidos novos, com Trocar. No
// celular, cartões, e Autorizar pessoa flutua. Só o síndico mexe aqui.
// R5 (V-14; quadro 410): para quem vê o conselho, as abas Pessoas e acesso e Conselho.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { formatarData, FUNCOES_PLATAFORMA } from "@triade/domain";
import { Abas, Aviso, Botao, Carregando, ErroCarregar, Icone, Iniciais, Selo } from "@triade/ui";
import { Cartao } from "../Ficha.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { PessoaDoCondominio, Pessoas as DadosPessoas, Recado } from "../tipos.ts";
import { fraseDoAcesso } from "./acesso.ts";
import { Autorizar, TrocarPadrao } from "./janelas.tsx";
import { AbaConselho } from "./Conselho.tsx";

/** Como a pessoa atende os pedidos, num selo. */
export function SeloAtendimento({ p, padrao }: { p: PessoaDoCondominio; padrao: string | null }) {
  if (p.vinculoId === padrao && p.responsavel) return <Selo tom="andamento">Padrão da fila</Selo>;
  if (p.responsavel && p.disponivel) return <Selo tom="ok">Atende os pedidos</Selo>;
  if (p.responsavel) return <Selo tom="neutro">Indisponível</Selo>;
  return <span className="t-apoio">Não atende</span>;
}

export const papelDe = (p: PessoaDoCondominio) => (p.funcao === "SINDICO" ? `${FUNCOES_PLATAFORMA.SINDICO} · vem do contrato com a TRÍADE` : p.cargo ?? FUNCOES_PLATAFORMA.AUTORIZADO);
export const acessoDe = (p: PessoaDoCondominio) => (p.funcao === "SINDICO" ? "Todas as permissões" : fraseDoAcesso(p.permissoes));

/** Para quem vão os pedidos novos: o padrão da fila, quem mais atende e o Trocar. */
function Fila({ dados, aoTrocar }: { dados: DadosPessoas; aoTrocar: () => void }) {
  const padrao = dados.pessoas.find((p) => p.vinculoId === dados.responsavelPadrao && p.responsavel && p.disponivel);
  const outros = dados.pessoas.filter((p) => p.responsavel && p.disponivel && p !== padrao).map((p) => p.nome);
  const ninguem = !dados.pessoas.some((p) => p.responsavel);
  return (
    <Cartao id="t-fila" titulo="Para quem vão os pedidos novos" icone="pedido">
      <div className="flex flex-wrap items-center gap-3">
        {padrao ? <Iniciais nome={padrao.nome} className="h-10 w-10" /> : <span className="ladrilho" data-tom="atencao" aria-hidden="true"><Icone nome="alerta" /></span>}
        <span className="grid min-w-48 flex-1 gap-0.5">
          <span className="font-semibold">{padrao ? padrao.nome : ninguem ? "Ninguém atende os pedidos ainda" : "Falta escolher o padrão da fila"}</span>
          <span className="t-apoio">
            {padrao ? `Padrão da fila: todo pedido novo cai para esta pessoa, até alguém assumir.${outros.length ? ` Também atende: ${outros.join(", ")}.` : ""}`
              : ninguem ? "Abra a ficha de quem vai atender e ligue Atende os pedidos." : "Escolha quem recebe os pedidos novos entre quem atende e está disponível."}
          </span>
        </span>
        {ninguem ? null : <Botao variante="contorno" tamanho="m" onClick={aoTrocar}><Icone nome="trocar" />{padrao ? "Trocar" : "Escolher"}</Botao>}
      </div>
      <p className="t-apoio">Quem sai de férias fica indisponível na própria ficha. O padrão da fila precisa estar disponível.</p>
    </Cartao>
  );
}

const COLUNAS = "md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.5fr)_11rem_20px]";

type AbaPessoas = "pessoas" | "conselho";
export type Moldura = (corpo: ReactNode) => ReactNode;

/** Com o conselho (R5): as duas abas; sem a permissão de ver o conselho, só a lista, como antes. */
export function Pessoas() {
  const { pode } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const [nConselho, setNConselho] = useState<number | undefined>(undefined);
  if (!pode("conselho.ver")) return <ListaDePessoas />;
  const aba: AbaPessoas = busca.get("aba") === "conselho" ? "conselho" : "pessoas";
  const moldura: Moldura = (corpo) => (
    <Abas abas={[{ id: "pessoas", texto: "Pessoas e acesso" }, { id: "conselho", texto: "Conselho", contagem: nConselho }]} atual={aba} rotulo="Partes de Pessoas"
      aoMudar={(id) => router.replace(id === "conselho" ? "/pessoas?aba=conselho" : "/pessoas", { scroll: false })}>
      <div className="grid gap-5 pt-4">{corpo}</div>
    </Abas>
  );
  return aba === "conselho" ? <AbaConselho moldura={moldura} contar={setNConselho} /> : <ListaDePessoas moldura={moldura} />;
}

function ListaDePessoas({ moldura = (c) => c }: { moldura?: Moldura }) {
  const { pode, atualizar } = usePlataforma();
  const carga = useCarregar<DadosPessoas>("/v1/condominio/pessoas");
  const revogada = useSearchParams().get("revogada");
  const [janela, setJanela] = useState<"autorizar" | "padrao" | null>(null);
  const [recado, setRecado] = useState<Recado>(revogada
    ? { tom: "ok", texto: `Acesso de ${revogada} revogado. O que foi feito com este acesso continua no histórico, com o nome de quem fez.` } : null);
  const fechar = () => setJanela(null);
  const salvo = (r: Recado) => { setRecado(r); carga.recarregar(); atualizar(); };

  const titulo = (
    <div>
      <h1 className="t-titulo-tela">Pessoas e acesso</h1>
      <p className="t-apoio mt-1">Quem entra na Plataforma deste condomínio e o que cada um pode fazer. Cada pessoa tem o seu acesso; nada de conta compartilhada.</p>
    </div>
  );
  if (carga.estado === "carregando") return <div className="grid gap-5">{titulo}{moldura(<Carregando rotulo="Carregando as pessoas…" />)}</div>;
  if (carga.estado === "erro") return <div className="grid gap-5">{titulo}{moldura(<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />)}</div>;
  const dados = carga.dados;
  const autorizar = pode("pessoas.autorizar") ? <Botao onClick={() => setJanela("autorizar")}><Icone nome="pessoa-mais" />Autorizar pessoa</Botao> : null;

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {titulo}
        {autorizar ? <div className="max-md:hidden">{autorizar}</div> : null}
      </div>
      {moldura(<>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {pode("atendimento.responsaveis") ? <Fila dados={dados} aoTrocar={() => setJanela("padrao")} /> : null}

      <section aria-labelledby="t-pessoas" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-pessoas" className="sr-only">Pessoas com acesso</h2>
        <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
          <span /><span className="t-rotulo">Pessoa</span><span className="t-rotulo">O que pode fazer</span><span className="t-rotulo">Atendimento</span><span />
        </div>
        <ul className="grid max-md:gap-3">
          {dados.pessoas.map((p) => (
            <li key={p.vinculoId} className={`relative grid grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:border-linha md:last:border-b-0 ${COLUNAS}`}>
              <Iniciais nome={p.nome} className="h-9 w-9 self-start md:self-center" />
              <span className="grid min-w-0 gap-0.5">
                <Link href={`/pessoas/pessoa?id=${p.vinculoId}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{p.nome}</Link>
                <span className="t-apoio">{papelDe(p)} · desde {formatarData(p.desde)}</span>
                <span className="t-texto md:hidden">{acessoDe(p)}</span>
                <span className="flex flex-wrap items-center gap-2 pt-1 md:hidden"><SeloAtendimento p={p} padrao={dados.responsavelPadrao} /></span>
              </span>
              <span className="t-texto max-md:hidden">{acessoDe(p)}</span>
              <span className="max-md:hidden"><SeloAtendimento p={p} padrao={dados.responsavelPadrao} /></span>
              <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
          <span className="t-apoio">{dados.pessoas.length === 1 ? "1 pessoa com acesso" : `${dados.pessoas.length} pessoas com acesso`}</span>
          <span className="t-apoio">Quem é revogado sai da lista e continua no histórico, com o nome.</span>
        </div>
      </section>
      </>)}

      {autorizar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{autorizar}</div> : null}
      {janela === "autorizar" ? <Autorizar dados={dados} aoFechar={fechar} salvo={salvo} /> : null}
      {janela === "padrao" ? <TrocarPadrao dados={dados} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} /> : null}
    </div>
  );
}
