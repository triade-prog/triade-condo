"use client";
// Pessoas e funções da equipe (PI-10): só a administração. Convidar com as funções, rever
// funções e desativar. Sempre sobra alguém com administração.

import { useState, type FormEvent } from "react";
import { FUNCOES_CONSOLE, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO, type FuncaoConsole } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar, useSessao } from "./sessao.tsx";

interface Membro {
  id: string;
  nome: string;
  ativa: boolean;
  funcoes: string[];
}

function EscolhaFuncoes({ valor, aoMudar, erro }: { valor: string[]; aoMudar: (f: string[]) => void; erro?: boolean }) {
  return (
    <fieldset className="grid gap-2" aria-describedby={erro ? "funcoes-erro" : undefined}>
      <legend className="mb-1 text-[13px] font-medium">Funções</legend>
      {(Object.keys(FUNCOES_CONSOLE) as FuncaoConsole[]).map((f) => (
        <label key={f} className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-console" checked={valor.includes(f)}
            onChange={(e) => aoMudar(e.target.checked ? [...valor, f] : valor.filter((x) => x !== f))} />
          {FUNCOES_CONSOLE[f]}
        </label>
      ))}
      {erro ? <span id="funcoes-erro" className="text-xs text-erro">Escolha ao menos uma função.</span> : null}
      <p className="text-xs text-tinta-suave">Cada função só age nos clientes atribuídos à pessoa.</p>
    </fieldset>
  );
}

export function Equipe() {
  const sessao = useSessao();
  const equipe = useCarregar<{ pessoas: Membro[] }>(sessao.acoes.includes("console.equipe.gerenciar") ? "/v1/equipe" : null);
  const [recado, setRecado] = useState<string | null>(null);
  const [convidando, setConvidando] = useState(false);
  const [revendo, setRevendo] = useState<Membro | null>(null);
  const [desativando, setDesativando] = useState<Membro | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);

  if (!sessao.acoes.includes("console.equipe.gerenciar")) {
    return <Aviso tom="atencao" titulo="Só a administração cuida da equipe">Peça a alguém da administração para mudar funções ou convidar pessoas.</Aviso>;
  }

  function abrirConvite() { setNome(""); setEmail(""); setFuncoes([]); setErro(null); setConvidando(true); }
  function abrirRevisao(m: Membro) { setFuncoes(m.funcoes); setErro(null); setRevendo(m); }

  async function convidar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi<{ contaNova: boolean }>("/v1/equipe", { corpo: { nome, email, funcoes } });
    if (!r.ok) return setErro(r.erro);
    setConvidando(false);
    setRecado(r.dados.contaNova ? TEXTO_CONVITE_ENVIADO : TEXTO_CONVITE_CONTA_EXISTENTE);
    equipe.recarregar();
  }

  async function salvarFuncoes(ev: FormEvent) {
    ev.preventDefault();
    if (!revendo) return;
    const r = await chamarApi(`/v1/equipe/${revendo.id}/funcoes`, { metodo: "PUT", corpo: { funcoes } });
    if (!r.ok) return setErro(r.erro);
    setRevendo(null);
    setRecado(`Funções de ${revendo.nome} revistas. Atribuições de função retirada param na hora.`);
    equipe.recarregar();
  }

  async function desativar() {
    if (!desativando) return;
    const r = await chamarApi(`/v1/equipe/${desativando.id}/desativar`, { corpo: {} });
    const quem = desativando.nome;
    setDesativando(null);
    if (!r.ok) return setErro(r.erro);
    setRecado(`${quem} não entra mais no Console. O que fez continua no histórico.`);
    equipe.recarregar();
  }

  const campos = camposComErro(erro);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pessoas e funções</h1>
          <p className="text-tinta-suave">Cada função só age nos clientes atribuídos.</p>
        </div>
        <Botao onClick={abrirConvite}>+ Convidar pessoa</Botao>
      </div>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {erro && !convidando && !revendo ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      {equipe.estado === "carregando" ? <Carregando /> : null}
      {equipe.estado === "erro" ? <ErroCarregar texto={equipe.texto} tentarDeNovo={equipe.recarregar} /> : null}
      {equipe.estado === "pronto" ? (
        <div className="overflow-x-auto rounded-lg border border-linha">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Pessoas da equipe TRÍADE</caption>
            <thead>
              <tr className="text-left text-xs text-tinta-suave">
                <th scope="col" className="px-4 py-3 font-semibold">Pessoa</th>
                <th scope="col" className="px-4 py-3 font-semibold">Funções</th>
                <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {equipe.dados.pessoas.map((m) => (
                <tr key={m.id} className="border-t border-linha align-top">
                  <td className="px-4 py-3 font-medium">{m.nome}{m.id === sessao.pessoaId ? <span className="text-xs font-normal text-tinta-suave"> (você)</span> : null}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">{m.funcoes.map((f) => <Selo key={f} tom="info">{FUNCOES_CONSOLE[f as FuncaoConsole] ?? f}</Selo>)}</span>
                  </td>
                  <td className="px-4 py-3">{m.ativa ? <Selo tom="ok">Ativa</Selo> : <Selo tom="neutro">Desativada</Selo>}</td>
                  <td className="px-4 py-3 text-right">
                    {m.ativa ? (
                      <span className="inline-flex gap-1">
                        <Botao variante="discreto" onClick={() => abrirRevisao(m)} aria-label={`Rever funções de ${m.nome}`}>Rever funções</Botao>
                        {m.id !== sessao.pessoaId ? <Botao variante="discreto" onClick={() => { setErro(null); setDesativando(m); }} aria-label={`Desativar ${m.nome}`}>Desativar</Botao> : null}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialogo aberto={convidando} titulo="Convidar pessoa para a equipe" aoFechar={() => setConvidando(false)}>
        <form onSubmit={convidar} noValidate className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <CampoTexto id="m-nome" rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={campos.includes("nome") ? "Escreva o nome." : null} />
          <CampoTexto id="m-email" rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={campos.includes("email") ? "Confira o e-mail." : null} />
          <EscolhaFuncoes valor={funcoes} aoMudar={setFuncoes} erro={campos.includes("funcoes")} />
          <p className="text-sm text-tinta-suave">A pessoa recebe um e-mail para criar a senha e, no primeiro acesso, cadastra o autenticador.</p>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setConvidando(false)}>Cancelar</Botao>
            <Botao type="submit">Enviar convite</Botao>
          </div>
        </form>
      </Dialogo>
      <Dialogo aberto={revendo !== null} titulo={`Rever funções${revendo ? ` de ${revendo.nome}` : ""}`} aoFechar={() => setRevendo(null)}>
        <form onSubmit={salvarFuncoes} className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <EscolhaFuncoes valor={funcoes} aoMudar={setFuncoes} erro={campos.includes("funcoes")} />
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setRevendo(null)}>Cancelar</Botao>
            <Botao type="submit" disabled={funcoes.length === 0}>Salvar funções</Botao>
          </div>
        </form>
      </Dialogo>
      <Dialogo aberto={desativando !== null} titulo="Desativar pessoa" aoFechar={() => setDesativando(null)}>
        <p>{desativando?.nome} deixa de entrar no Console na hora. O que a pessoa fez continua no histórico, com o nome dela.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setDesativando(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={desativar}>Desativar</Botao>
        </div>
      </Dialogo>
    </div>
  );
}
