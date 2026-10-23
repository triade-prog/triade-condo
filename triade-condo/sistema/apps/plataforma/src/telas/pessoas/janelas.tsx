"use client";
// As janelas de Pessoas e acesso (DC15, telas-modelo pessoas-mudar-acesso, pessoas-autorizar-* e
// pessoas-revogar; V-09, CF-03, CF-05, CF-12): o acesso escolhido por área (decisão B.1), Autorizar
// pessoa em duas partes (no celular, dois passos), Revogar com quem assume a fila e a troca do
// padrão da fila. O atendimento grava na hora; a lista inteira vai junto, com a versão.

import { useState, type FormEvent, type ReactNode } from "react";
import { TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO } from "@triade/domain";
import {
  AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi, type Resposta,
} from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import { useCelular } from "../celular.ts";
import type { PessoaDoCondominio, Pessoas, Recado } from "../tipos.ts";
import { comCaixa, comNivel, comVerCaixas, fraseDoAcesso, gruposDisponiveis, nivelDe, type Nivel } from "./acesso.ts";

/** Grava quem atende: a lista inteira, com a mudança de uma pessoa e o padrão. */
export function salvarAtendimento(dados: Pessoas, mudar: { vinculoId: string; atende?: boolean; disponivel?: boolean } | null, padraoId: string | null): Promise<Resposta<unknown>> {
  const responsaveis = dados.pessoas.map((p) => {
    const m = mudar?.vinculoId === p.vinculoId ? mudar : null;
    const atende = m?.atende ?? p.responsavel;
    return { vinculoId: p.vinculoId, atende, disponivel: m?.disponivel ?? (m?.atende && !p.responsavel ? true : p.disponivel) };
  }).filter((r) => r.atende).map(({ vinculoId, disponivel }) => ({ vinculoId, disponivel }));
  const valido = (id: string | null) => !!id && responsaveis.some((r) => r.vinculoId === id && r.disponivel);
  // Sem padrão que valha, quem passa a atender vira o padrão (o banco pede um padrão disponível).
  const padrao = valido(padraoId) ? padraoId : responsaveis.find((r) => r.disponivel)?.vinculoId ?? null;
  return chamarApi("/v1/condominio/atendimento", { metodo: "PUT", corpo: { versao: dados.versao, responsaveis, padraoId: responsaveis.length ? padrao : null } });
}

/** O acesso por área: uma escolha por área, na ordem do menu, e a frase do que a pessoa vai poder. */
export function EscolhaAcesso({ dados, marcadas, aoMudar, nome, prefixo }: {
  dados: Pessoas; marcadas: string[]; aoMudar: (l: string[]) => void; nome: string; prefixo: string;
}) {
  const grupos = gruposDisponiveis(dados.permissoesDisponiveis.map((p) => p.codigo));
  const linha = (icone: Parameters<typeof Icone>[0]["nome"], titulo: string, ajuda: string, controle: ReactNode, abaixo?: ReactNode) => (
    <div key={titulo} className="grid gap-3 border-t border-linha py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
        <span className="grid min-w-0 flex-1 basis-48 gap-0.5"><span className="font-medium">{titulo}</span><span className="t-apoio">{ajuda}</span></span>
        {controle ? <span className="max-md:basis-full max-md:pl-11">{controle}</span> : null}
      </div>
      {abaixo ? <div className="grid gap-2 pl-11">{abaixo}</div> : null}
    </div>
  );
  return (
    <div className="grid gap-4">
      {grupos.map((g) => (
        <fieldset key={g.grupo} className="grid">
          <legend className="t-rotulo pb-1">{g.grupo}</legend>
          {g.areas.map((a) => {
            if (a.tipo === "nivel") {
              const opcoes = ([["nao", a.rotulos.nao], ...(a.ver ? [["ver", a.rotulos.ver ?? "Vê"]] : []), ...(a.cuidar ? [["cuidar", a.rotulos.cuidar ?? "Cuida"]] : [])] as [Nivel, string][])
                .map(([valor, texto]) => ({ valor, texto }));
              return linha(a.icone, a.nome, a.ajuda,
                <Escolha rotulo={a.nome} atual={nivelDe(a, marcadas)} opcoes={opcoes} aoMudar={(n) => aoMudar(comNivel(a, marcadas, n))} />);
            }
            const ver = !a.ver || marcadas.includes(a.ver);
            const controle = a.ver ? (
              <Escolha rotulo={a.nome} atual={ver ? "ver" : "nao"} opcoes={[{ valor: "nao", texto: a.rotulos?.nao ?? "Não vê" }, { valor: "ver", texto: a.rotulos?.ver ?? "Vê" }]}
                aoMudar={(n) => aoMudar(comVerCaixas(a, marcadas, n === "ver"))} />
            ) : null;
            return linha(a.icone, a.nome, a.ajuda, controle, ver ? a.caixas.map((c) => (
              <Caixa key={c.codigo} id={`${prefixo}-${c.codigo}`} rotulo={c.texto} marcada={marcadas.includes(c.codigo)} aoMudar={(m) => aoMudar(comCaixa(a, marcadas, c.codigo, m))} />
            )) : null);
          })}
        </fieldset>
      ))}
      <p role="status" className="grid gap-1 rounded-[14px] border border-violeta-200 bg-violeta-50 px-3.5 py-3">
        <span className="t-apoio font-semibold text-violeta-700">Com isso, {nome || "a pessoa"} vai poder</span>
        <span className="t-texto">{fraseDoAcesso(marcadas)}</span>
      </p>
    </div>
  );
}

/** O rodapé fixo das janelas grandes: Cancelar e o botão principal. */
function Rodape({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
      {children}
    </div>
  );
}

export function MudarAcesso({ dados, pessoa, aoFechar, salvo, recarregar }: {
  dados: Pessoas; pessoa: PessoaDoCondominio; aoFechar: () => void; salvo: (r: Recado) => void; recarregar: () => void;
}) {
  const [permissoes, setPermissoes] = useState(pessoa.permissoes);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/pessoas/${pessoa.vinculoId}`, { metodo: "PUT", corpo: { versao: pessoa.versao, cargo: pessoa.cargo ?? "", permissoes } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: `Acesso de ${pessoa.nome} salvo. Vale a partir de agora.` });
  }

  return (
    <Dialogo aberto media fechar titulo={`Mudar o acesso de ${pessoa.nome}`} apoio="Uma escolha por área, na ordem do menu. Cuidar já inclui ver." aoFechar={aoFechar}>
      <form onSubmit={salvar} className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
        <EscolhaAcesso dados={dados} marcadas={permissoes} aoMudar={setPermissoes} nome={pessoa.nome} prefixo="ma" />
        <p className="t-apoio">Vale a partir de agora. O que a pessoa já fez continua no histórico, com o nome dela.</p>
        <Rodape>
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar o acesso"}</Botao>
        </Rodape>
      </form>
    </Dialogo>
  );
}

const PARTES = ["Quem é", "O que pode fazer"] as const;

/** Uma parte numerada: no computador as duas aparecem; no celular, só a do passo. */
function Parte({ n, passo, children }: { n: 1 | 2; passo: 1 | 2; children: ReactNode }) {
  return (
    <section aria-labelledby={`au-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h3 id={`au-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h3>
      </div>
      {children}
    </section>
  );
}

export function Autorizar({ dados, aoFechar, salvo }: { dados: Pessoas; aoFechar: () => void; salvo: (r: Recado) => void }) {
  const celular = useCelular();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [falta, setFalta] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (celular && passo === 1) {
      const f = [nome.trim().length < 2 ? "nome" : null, !/^\S+@\S+\.\S+$/.test(email.trim()) ? "email" : null].filter((x): x is string => !!x);
      setFalta(f);
      if (!f.length) setPasso(2);
      return;
    }
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ contaNova: boolean }>("/v1/condominio/pessoas", { corpo: { nome, email, cargo, permissoes } });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      if (camposComErro(r.erro).some((c) => c === "nome" || c === "email" || c === "cargo")) setPasso(1);
      return;
    }
    aoFechar();
    salvo({ tom: "ok", texto: r.dados.contaNova ? TEXTO_CONVITE_ENVIADO : TEXTO_CONVITE_CONTA_EXISTENTE });
  }

  const campos = [...camposComErro(erro), ...falta];
  return (
    <Dialogo aberto media fechar titulo="Autorizar pessoa" apoio="Duas partes: quem é e o que pode fazer." aoFechar={aoFechar}>
      <form onSubmit={enviar} noValidate className="grid gap-4">
        <div className="grid gap-3 md:hidden">
          <p className="grid"><span className="t-apoio">Passo {passo} de 2</span><span className="t-titulo-cartao">{PARTES[passo - 1]}</span></p>
          <div className="passos" role="progressbar" aria-label="Passos de autorizar pessoa" aria-valuemin={1} aria-valuemax={2} aria-valuenow={passo}
            aria-valuetext={`Passo ${passo} de 2: ${PARTES[passo - 1]}`}>
            {[1, 2].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
          </div>
          {passo === 2 ? (
            <button type="button" className="resumo-passo" onClick={() => setPasso(1)}>
              <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
              <span className="grid min-w-0 flex-1"><span className="t-apoio">{PARTES[0]}</span><span className="truncate">{[nome, email, cargo].filter((x) => x.trim()).join(" · ")}</span></span>
              <span className="alterar">Alterar</span>
            </button>
          ) : null}
        </div>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="grid">
          <Parte n={1} passo={passo}>
            <div className="grid gap-3 md:grid-cols-2">
              <CampoTexto id="p-nome" rotulo="Nome" icone="pessoa" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
                erro={campos.includes("nome") ? "Escreva o nome da pessoa." : null} />
              <CampoTexto id="p-email" rotulo="E-mail" icone="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                ajuda="Ela recebe o convite para criar a própria senha." erro={campos.includes("email") ? "Confira o e-mail." : null} />
            </div>
            <CampoTexto id="p-cargo" rotulo="Cargo" opcional maxLength={60} placeholder="Secretária, subsíndico, conselho…" value={cargo} onChange={(e) => setCargo(e.target.value)}
              ajuda="O cargo é só um nome: não dá permissão." erro={campos.includes("cargo") ? "Até 60 caracteres." : null} />
          </Parte>
          <Parte n={2} passo={passo}>
            <EscolhaAcesso dados={dados} marcadas={permissoes} aoMudar={setPermissoes} nome={nome.trim().split(" ")[0] ?? ""} prefixo="au" />
          </Parte>
        </div>
        <p className="t-apoio">O link do convite vale uma vez. Se a pessoa já tiver conta, o condomínio aparece no próximo acesso.</p>
        <Rodape>
          <div className="flex gap-2 max-md:hidden">
            <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar convite"}</Botao>
          </div>
          <div className="grid gap-2 md:hidden">
            {passo === 1 ? (
              <>
                <Botao type="submit" className="w-full">Continuar<Icone nome="dir" /></Botao>
                <Botao variante="discreto" className="w-full" onClick={aoFechar}>Cancelar</Botao>
              </>
            ) : (
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Botao variante="contorno" onClick={() => setPasso(1)}><Icone nome="esq" />Voltar</Botao>
                <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar convite"}</Botao>
              </div>
            )}
          </div>
        </Rodape>
      </form>
    </Dialogo>
  );
}

export function Revogar({ dados, pessoa, aoFechar, salvo, recarregar }: {
  dados: Pessoas; pessoa: PessoaDoCondominio; aoFechar: () => void; salvo: (r: Recado) => void; recarregar: () => void;
}) {
  const ehPadrao = dados.responsavelPadrao === pessoa.vinculoId;
  const candidatos = dados.pessoas.filter((p) => p.vinculoId !== pessoa.vinculoId && p.responsavel && p.disponivel);
  const [escolha, setEscolha] = useState(candidatos[0]?.vinculoId ?? "PENDENTE");
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function revogar(ev: FormEvent) {
    ev.preventDefault();
    const corpo = { versao: pessoa.versao, ...(ehPadrao ? (escolha === "PENDENTE" ? { deixarPendente: true } : { substitutoId: escolha }) : {}) };
    const r = await chamarApi(`/v1/condominio/pessoas/${pessoa.vinculoId}/revogar`, { corpo });
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: `Acesso de ${pessoa.nome} revogado. O que foi feito com este acesso continua no histórico, com o nome de quem fez.` });
  }

  return (
    <Dialogo aberto fechar titulo={`Revogar o acesso de ${pessoa.nome}`} apoio={pessoa.cargo ?? undefined} aoFechar={aoFechar}>
      <form onSubmit={revogar} className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
        {ehPadrao ? (
          <CampoSelecao id="v-substituto" rotulo={`${pessoa.nome} é o padrão da fila. Quem assume?`} value={escolha} onChange={(e) => setEscolha(e.target.value)}
            ajuda="Os pedidos novos passam a cair para quem você escolher."
            opcoes={[...candidatos.map((c) => ({ valor: c.vinculoId, texto: c.nome })), { valor: "PENDENTE", texto: "Ninguém por enquanto (o Início mostra a pendência)" }]} />
        ) : null}
        <p>{pessoa.nome} para de entrar na hora. O que foi feito com este acesso continua no histórico, com o nome de quem fez. Para voltar, é preciso autorizar de novo.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo"><Icone nome="sair" />Revogar acesso</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Para quem vão os pedidos novos: escolhe o padrão entre quem atende e está disponível. */
export function TrocarPadrao({ dados, aoFechar, salvo, recarregar }: { dados: Pessoas; aoFechar: () => void; salvo: (r: Recado) => void; recarregar: () => void }) {
  const candidatos = dados.pessoas.filter((p) => p.responsavel && p.disponivel);
  const [escolha, setEscolha] = useState(candidatos.find((p) => p.vinculoId === dados.responsavelPadrao)?.vinculoId ?? candidatos[0]?.vinculoId ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await salvarAtendimento(dados, null, escolha);
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: `Os pedidos novos agora vão para ${dados.pessoas.find((p) => p.vinculoId === escolha)?.nome ?? "quem você escolheu"}.` });
  }

  return (
    <Dialogo aberto fechar titulo="Para quem vão os pedidos novos" aoFechar={aoFechar}>
      <form onSubmit={salvar} className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
        {candidatos.length ? (
          <CampoSelecao id="pd-padrao" rotulo="Padrão da fila" value={escolha} onChange={(e) => setEscolha(e.target.value)}
            ajuda="Todo pedido novo cai para o padrão, até alguém assumir. Só aparece quem atende e está disponível."
            opcoes={candidatos.map((c) => ({ valor: c.vinculoId, texto: c.nome }))} />
        ) : <p>Ninguém atende os pedidos agora. Abra a ficha de quem vai atender e ligue Atende os pedidos.</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          {candidatos.length ? <Botao type="submit"><Icone nome="check" />Salvar</Botao> : null}
        </div>
      </form>
    </Dialogo>
  );
}
