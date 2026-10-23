"use client";
// A equipe TRÍADE na parte Pessoas da ficha (PI-10; DC15, tela-modelo console-ficha-pessoas-computador,
// rodada Console de 23/10/2026): quem da TRÍADE atende este cliente e com qual função. Só a
// administração atribui e retira; o cliente nunca fica sem administração. É interno.

import { useState, type FormEvent } from "react";
import { formatarData } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, chamarApi, Dialogo, ErroCarregar, Icone, Iniciais, textoDoErro, type ErroApi } from "@triade/ui";
import { Cartao } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { nomeFuncao } from "../rotulos.tsx";
import type { PropsAba } from "./tipos.ts";

interface Membro {
  id: string;
  nome: string;
  ativa: boolean;
  funcoes: string[];
}

function FormAtribuir({ ficha, aoConcluir }: { ficha: PropsAba["ficha"]; aoConcluir: (ok: boolean) => void }) {
  const equipe = useCarregar<{ pessoas: Membro[] }>("/v1/equipe");
  const [pessoaId, setPessoaId] = useState("");
  const [funcao, setFuncao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);

  if (equipe.estado === "carregando") return <Carregando linhas={2} />;
  if (equipe.estado === "erro") return <ErroCarregar erro={equipe.erro} texto={equipe.texto} tentarDeNovo={equipe.recarregar} />;
  const ativas = equipe.dados.pessoas.filter((p) => p.ativa);
  const escolhida = ativas.find((p) => p.id === pessoaId);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/equipe`, { corpo: { pessoaId, funcao } });
    if (!r.ok) return setErro(r.erro);
    aoConcluir(true);
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      <CampoSelecao id="a-pessoa" rotulo="Pessoa da equipe" value={pessoaId} onChange={(e) => { setPessoaId(e.target.value); setFuncao(""); }}
        opcoes={[{ valor: "", texto: "Escolha" }, ...ativas.map((p) => ({ valor: p.id, texto: p.nome }))]} />
      <CampoSelecao id="a-funcao" rotulo="Função neste cliente" value={funcao} disabled={!escolhida} onChange={(e) => setFuncao(e.target.value)}
        ajuda="Só as funções que a pessoa tem na equipe."
        opcoes={[{ valor: "", texto: "Escolha" }, ...(escolhida?.funcoes ?? []).map((f) => ({ valor: f, texto: nomeFuncao(f) }))]} />
      <div className="flex justify-end gap-2">
        <Botao variante="contorno" onClick={() => aoConcluir(false)}>Cancelar</Botao>
        <Botao type="submit" disabled={!pessoaId || !funcao}>Atribuir</Botao>
      </div>
    </form>
  );
}

export function CartaoEquipe({ ficha, pode, recarregar, avisar }: PropsAba) {
  const [atribuindo, setAtribuindo] = useState(false);
  const [retirar, setRetirar] = useState<PropsAba["ficha"]["equipe"][number] | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const podeAtribuir = pode("console.equipe.atribuir");

  async function confirmarRetirada() {
    if (!retirar) return;
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/equipe/${retirar.vinculoId}/retirar`, { corpo: { versao: retirar.versao } });
    setRetirar(null);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Atribuição retirada. O histórico continua com tudo o que a pessoa fez." });
    recarregar();
  }

  return (
    <Cartao id="t-equipe" titulo="Equipe TRÍADE neste cliente" icone="pessoas"
      acao={podeAtribuir ? <Botao variante="contorno" tamanho="m" onClick={() => { setErro(null); setAtribuindo(true); }}><Icone nome="mais" />Atribuir pessoa</Botao> : undefined}>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      <ul className="divide-y divide-linha">
        {ficha.equipe.map((m) => (
          <li key={m.vinculoId} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
            <Iniciais nome={m.nome} />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{m.nome}</span>
              <span className="t-apoio">{nomeFuncao(m.funcao)} · desde {formatarData(m.desde)}</span>
            </span>
            {podeAtribuir ? <Botao variante="discreto" tamanho="m" onClick={() => setRetirar(m)} aria-label={`Retirar ${m.nome} (${nomeFuncao(m.funcao)})`}>Retirar</Botao> : null}
          </li>
        ))}
      </ul>
      <span className="selo justify-self-start" data-tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Interno · o cliente não vê como a equipe se organiza</span>

      <Dialogo aberto={atribuindo} titulo="Atribuir pessoa ao cliente" aoFechar={() => setAtribuindo(false)}>
        <FormAtribuir ficha={ficha} aoConcluir={(ok) => {
          setAtribuindo(false);
          if (ok) { avisar({ tom: "ok", texto: "Pessoa atribuída ao cliente." }); recarregar(); }
        }} />
      </Dialogo>
      <Dialogo aberto={retirar !== null} titulo="Retirar atribuição" aoFechar={() => setRetirar(null)}>
        <p>{retirar ? `${retirar.nome} deixa de atender este cliente como ${nomeFuncao(retirar.funcao).toLowerCase()}.` : ""} O que a pessoa já fez continua no histórico.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={() => setRetirar(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={confirmarRetirada}>Retirar</Botao>
        </div>
      </Dialogo>
    </Cartao>
  );
}
