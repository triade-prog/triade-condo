"use client";
// Pessoas autorizadas (V-09, CF-03, CF-12): o síndico convida secretária, subsíndico ou
// conselho. O cargo é só um rótulo; as permissões são individuais e só aparecem as dos
// recursos que já existem. Revogar quem é o padrão da fila pede quem assume (CF-05).

import { useState, type FormEvent } from "react";
import { formatarData, FUNCOES_PLATAFORMA, PERMISSOES, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO } from "@triade/domain";
import { AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import type { PessoaDoCondominio } from "../tipos.ts";
import type { PropsPessoas } from "./Pessoas.tsx";

function nomePermissao(p: string): string {
  return PERMISSOES[p as keyof typeof PERMISSOES] ?? p;
}

function Permissoes({ disponiveis, marcadas, aoMudar }: { disponiveis: PropsPessoas["dados"]["permissoesDisponiveis"]; marcadas: string[]; aoMudar: (l: string[]) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[13px] font-medium">Permissões</legend>
      {disponiveis.map((p) => (
        <label key={p.codigo} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-acao)]" checked={marcadas.includes(p.codigo)}
            onChange={(e) => aoMudar(e.target.checked ? [...marcadas, p.codigo] : marcadas.filter((x) => x !== p.codigo))} />
          <span><span className="font-medium">{p.nome}</span><span className="block text-xs text-tinta-suave">{p.descricao}</span></span>
        </label>
      ))}
      <p className="text-xs text-tinta-suave">Sem nenhuma marcada, a pessoa só vê o painel e as configurações. As outras permissões (acompanhar, responder, publicar, aprovar...) aparecem quando os recursos delas chegarem.</p>
    </fieldset>
  );
}

function Autorizar({ dados, salvo, aoFechar }: PropsPessoas & { aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ contaNova: boolean }>("/v1/condominio/pessoas", { corpo: { nome, email, cargo, permissoes } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: r.dados.contaNova ? TEXTO_CONVITE_ENVIADO : TEXTO_CONVITE_CONTA_EXISTENTE });
  }

  const campos = camposComErro(erro);
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoTexto id="p-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={campos.includes("nome") ? "Escreva o nome da pessoa." : null} />
      <CampoTexto id="p-email" rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        erro={campos.includes("email") ? "Confira o e-mail." : null} />
      <CampoTexto id="p-cargo" rotulo="Cargo" opcional maxLength={60} placeholder="Secretária, subsíndico, conselho…" value={cargo} onChange={(e) => setCargo(e.target.value)}
        ajuda="O cargo não dá permissão." erro={campos.includes("cargo") ? "Até 60 caracteres." : null} />
      <Permissoes disponiveis={dados.permissoesDisponiveis} marcadas={permissoes} aoMudar={setPermissoes} />
      <p className="text-sm text-tinta-suave">A pessoa recebe um e-mail para criar a própria senha. O link só pode ser usado uma vez. Se ela já tiver conta, o condomínio aparece no próximo acesso.</p>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar convite"}</Botao>
      </div>
    </form>
  );
}

function Rever({ dados, pessoa, recarregar, salvo, aoFechar }: PropsPessoas & { pessoa: PessoaDoCondominio; aoFechar: () => void }) {
  const [cargo, setCargo] = useState(pessoa.cargo ?? "");
  const [permissoes, setPermissoes] = useState(pessoa.permissoes);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi(`/v1/condominio/pessoas/${pessoa.vinculoId}`, { metodo: "PUT", corpo: { versao: pessoa.versao, cargo, permissoes } });
    if (!r.ok) return setErro(r.erro);
    aoFechar();
    salvo({ tom: "ok", texto: `Acesso de ${pessoa.nome} revisto. Vale a partir de agora.` });
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <CampoTexto id="r-cargo" rotulo="Cargo" opcional maxLength={60} value={cargo} onChange={(e) => setCargo(e.target.value)} ajuda="O cargo não dá permissão." />
      <Permissoes disponiveis={dados.permissoesDisponiveis} marcadas={permissoes} aoMudar={setPermissoes} />
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit">Salvar</Botao>
      </div>
    </form>
  );
}

function Revogar({ dados, pessoa, recarregar, salvo, aoFechar }: PropsPessoas & { pessoa: PessoaDoCondominio; aoFechar: () => void }) {
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
    <form onSubmit={revogar} className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      {ehPadrao ? (
        <CampoSelecao id="v-substituto" rotulo={`${pessoa.nome} é o padrão da fila. Quem assume?`} value={escolha} onChange={(e) => setEscolha(e.target.value)}
          opcoes={[...candidatos.map((c) => ({ valor: c.vinculoId, texto: c.nome })), { valor: "PENDENTE", texto: "Ninguém por enquanto (o início mostra a pendência)" }]} />
      ) : null}
      <p>{pessoa.nome} para de entrar na hora. O que foi feito com este acesso continua no histórico, com o nome de quem fez.</p>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" variante="perigo">Revogar acesso</Botao>
      </div>
    </form>
  );
}

export function AbaPessoas(props: PropsPessoas) {
  const { dados, pode } = props;
  const [janela, setJanela] = useState<{ tipo: "autorizar" } | { tipo: "rever" | "revogar"; pessoa: PessoaDoCondominio } | null>(null);
  const fechar = () => setJanela(null);
  const autoriza = pode("pessoas.autorizar");

  return (
    <div className="grid gap-4">
      {autoriza ? <Botao className="justify-self-start" onClick={() => setJanela({ tipo: "autorizar" })}>+ Autorizar pessoa</Botao> : null}
      <div className="overflow-x-auto rounded-lg border border-linha">
        <table className="w-full text-sm">
          <caption className="sr-only">Pessoas com acesso a este condomínio</caption>
          <thead className="bg-superficie-2 text-left text-tinta-suave">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Pessoa</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Permissões</th>
              {autoriza ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {dados.pessoas.map((p) => (
              <tr key={p.vinculoId} className="border-t border-linha align-top">
                <td className="min-w-40 px-4 py-3">
                  <span className="font-medium">{p.nome}</span>
                  <span className="block text-xs text-tinta-suave">
                    {p.funcao === "SINDICO" ? `${FUNCOES_PLATAFORMA.SINDICO} · vem do contrato com a TRÍADE` : p.cargo ?? FUNCOES_PLATAFORMA.AUTORIZADO}
                    {" · desde "}{formatarData(p.desde)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.funcao === "SINDICO" ? <span className="text-tinta-suave">Todas</span>
                    : p.permissoes.length ? <span className="flex flex-wrap gap-1">{p.permissoes.map((x) => <Selo key={x} tom="info">{nomePermissao(x)}</Selo>)}</span>
                      : <span className="text-tinta-suave">Só vê</span>}
                </td>
                {autoriza ? (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.funcao === "AUTORIZADO" ? (
                      <>
                        <Botao variante="texto" onClick={() => setJanela({ tipo: "rever", pessoa: p })} aria-label={`Rever o acesso de ${p.nome}`}>Rever</Botao>
                        <Botao variante="texto" onClick={() => setJanela({ tipo: "revogar", pessoa: p })} aria-label={`Revogar o acesso de ${p.nome}`}>Revogar</Botao>
                      </>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialogo aberto={janela?.tipo === "autorizar"} titulo="Autorizar pessoa" aoFechar={fechar}>
        <Autorizar {...props} aoFechar={fechar} />
      </Dialogo>
      <Dialogo aberto={janela?.tipo === "rever"} titulo={janela && "pessoa" in janela ? `Rever o acesso de ${janela.pessoa.nome}` : "Rever acesso"} aoFechar={fechar}>
        {janela?.tipo === "rever" ? <Rever {...props} pessoa={janela.pessoa} aoFechar={fechar} /> : null}
      </Dialogo>
      <Dialogo aberto={janela?.tipo === "revogar"} titulo={janela && "pessoa" in janela ? `Revogar o acesso de ${janela.pessoa.nome}` : "Revogar acesso"} aoFechar={fechar}>
        {janela?.tipo === "revogar" ? <Revogar {...props} pessoa={janela.pessoa} aoFechar={fechar} /> : null}
      </Dialogo>
    </div>
  );
}
