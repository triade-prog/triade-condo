"use client";
// Pessoas e funções da equipe (PI-10; DC15, telas-modelo console-equipe-*, rodada Console de
// 23/10/2026): só a administração. Convidar com as funções, rever funções e desativar; sempre
// sobra alguém com administração. A tabela larga virou linhas que cabem na tela (no celular, um
// cartão por pessoa), com Rever funções e Desativar sempre visíveis. Convidar flutua no celular.

import { useState, type FormEvent } from "react";
import { formatarData, FUNCOES_CONSOLE, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO, type FuncaoConsole } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Iniciais, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { CabecaPagina, CaixaLista, CLASSE_LINHA, plural } from "./comum.tsx";
import { useCarregar, useSessao } from "./sessao.tsx";

interface Membro {
  id: string;
  nome: string;
  ativa: boolean;
  funcoes: string[];
  desde?: string;
}

const COLUNAS = "md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.2fr)_auto]";

function EscolhaFuncoes({ valor, aoMudar, erro }: { valor: string[]; aoMudar: (f: string[]) => void; erro?: boolean }) {
  return (
    <fieldset className="grid gap-2" aria-describedby={erro ? "funcoes-erro" : undefined}>
      <legend className="mb-1 t-apoio font-medium">Funções</legend>
      {(Object.keys(FUNCOES_CONSOLE) as FuncaoConsole[]).map((f) => (
        <label key={f} className="flex min-h-9 items-center gap-2 t-texto">
          <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={valor.includes(f)}
            onChange={(e) => aoMudar(e.target.checked ? [...valor, f] : valor.filter((x) => x !== f))} />
          {FUNCOES_CONSOLE[f]}
        </label>
      ))}
      {erro ? <span id="funcoes-erro" className="t-apoio text-erro">Escolha ao menos uma função.</span> : null}
      <p className="t-apoio text-tinta-suave">Cada função só age nos clientes atribuídos à pessoa.</p>
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
  const botaoConvidar = <Botao onClick={abrirConvite}><Icone nome="mais" />Convidar pessoa</Botao>;
  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Pessoas e funções" apoio="Cada função só age nos clientes atribuídos." acao={<span className="max-md:hidden">{botaoConvidar}</span>} />
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {erro && !convidando && !revendo ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      {equipe.estado === "carregando" ? <Carregando /> : null}
      {equipe.estado === "erro" ? <ErroCarregar erro={equipe.erro} texto={equipe.texto} tentarDeNovo={equipe.recarregar} /> : null}
      {equipe.estado === "pronto" ? (
        <CaixaLista titulo="Pessoas da equipe TRÍADE" colunas={COLUNAS} cabecalho={["", "Pessoa", "Funções e situação", ""]}
          rodape={(
            <>
              <span className="t-apoio">{plural(equipe.dados.pessoas.filter((m) => m.ativa).length, "pessoa na equipe", "pessoas na equipe")}</span>
              <span className="t-apoio">Quem é desativado deixa de entrar na hora e continua no histórico, com o nome.</span>
            </>
          )}>
          <ul className="grid max-md:gap-3 max-md:pt-3">
            {equipe.dados.pessoas.map((m) => (
              <li key={m.id} className={`${CLASSE_LINHA} ${COLUNAS} max-md:grid-cols-[40px_minmax(0,1fr)]`}>
                <Iniciais nome={m.nome} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-medium">{m.nome}{m.id === sessao.pessoaId ? <span className="font-normal text-tinta-suave"> (você)</span> : null}</span>
                  {m.desde ? <span className="t-apoio">desde {formatarData(m.desde)}</span> : null}
                </span>
                <span className="flex flex-wrap gap-1.5 max-md:col-start-2">
                  {m.funcoes.map((f) => <Selo key={f} tom="info">{FUNCOES_CONSOLE[f as FuncaoConsole] ?? f}</Selo>)}
                  {m.ativa ? <Selo tom="ok">Ativa</Selo> : <Selo tom="neutro">Desativada</Selo>}
                </span>
                {m.ativa ? (
                  <span className="flex flex-wrap gap-2 max-md:col-span-2 md:justify-end">
                    <Botao variante="contorno" tamanho="m" onClick={() => abrirRevisao(m)} aria-label={`Rever funções de ${m.nome}`}>Rever funções</Botao>
                    {m.id !== sessao.pessoaId ? <Botao variante="discreto" tamanho="m" onClick={() => { setErro(null); setDesativando(m); }} aria-label={`Desativar ${m.nome}`}>Desativar</Botao> : null}
                  </span>
                ) : <span aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </CaixaLista>
      ) : null}
      <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{botaoConvidar}</div>

      <Dialogo aberto={convidando} titulo="Convidar pessoa para a equipe" aoFechar={() => setConvidando(false)}>
        <form onSubmit={convidar} noValidate className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <CampoTexto id="m-nome" rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={campos.includes("nome") ? "Escreva o nome." : null} />
          <CampoTexto id="m-email" rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={campos.includes("email") ? "Confira o e-mail." : null} />
          <EscolhaFuncoes valor={funcoes} aoMudar={setFuncoes} erro={campos.includes("funcoes")} />
          <p className="t-apoio text-tinta-suave">A pessoa recebe um e-mail para criar a senha e, no primeiro acesso, cadastra o autenticador.</p>
          <div className="flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setConvidando(false)}>Cancelar</Botao>
            <Botao type="submit">Enviar convite</Botao>
          </div>
        </form>
      </Dialogo>
      <Dialogo aberto={revendo !== null} titulo={`Rever funções${revendo ? ` de ${revendo.nome}` : ""}`} aoFechar={() => setRevendo(null)}>
        <form onSubmit={salvarFuncoes} className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <EscolhaFuncoes valor={funcoes} aoMudar={setFuncoes} erro={campos.includes("funcoes")} />
          <div className="flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setRevendo(null)}>Cancelar</Botao>
            <Botao type="submit" disabled={funcoes.length === 0}>Salvar funções</Botao>
          </div>
        </form>
      </Dialogo>
      <Dialogo aberto={desativando !== null} titulo="Desativar pessoa" aoFechar={() => setDesativando(null)}>
        <p>{desativando?.nome} deixa de entrar no Console na hora. O que a pessoa fez continua no histórico, com o nome dela.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={() => setDesativando(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={desativar}>Desativar</Botao>
        </div>
      </Dialogo>
    </div>
  );
}
