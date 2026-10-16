"use client";
// Janelas da ficha da unidade: incluir contato (novo ou já cadastrado, MU-01, MU-04), editar
// contato e vínculo (MU-08), encerrar (MU-07), registrar mudança (MU-07) e editar a unidade.
// No conflito de versão, o que a pessoa escreveu fica (AT-24).

import { useState, type FormEvent, type ReactNode } from "react";
import { AVISOS_CONTATO, mostrarTelefone, MOTIVOS_ENCERRAMENTO, nomeDaUnidade } from "@triade/domain";
import {
  AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Carregando, Dialogo, ErroCarregar, textoDoErro, type ErroApi, type Resposta,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ContatoDaUnidade, ListaMoradores, Recado, UnidadeDetalhe, Unidades } from "../tipos.ts";
import { Caixa, Escolha, hojeEmBrasilia, nomeRelacao, opcoesRelacao } from "./comum.tsx";

type Salvo = (r: Recado) => void;

/** Formulário com erro da API no topo, Cancelar e o botão de salvar. */
function Form({ aoEnviar, aoFechar, erro, textoBotao, recarregar, children, perigo }: {
  aoEnviar: () => Promise<void>;
  aoFechar: () => void;
  erro: ErroApi | null;
  textoBotao: string;
  recarregar?: () => void;
  children: ReactNode;
  perigo?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    await aoEnviar();
    setEnviando(false);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}
      {children}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" variante={perigo ? "perigo" : "primario"} disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</Botao>
      </div>
    </form>
  );
}

const ERRO_CAMPO: Record<string, string> = {
  nome: "Escreva o nome (até 120 caracteres).",
  telefone: "Telefone com DDD, como (61) 99999-0000.",
  relacao: "Escolha a relação com a unidade.",
};

function aviso(r: Resposta<{ avisos?: string[] }>, texto: string, pendente: boolean): Recado {
  const compartilhado = r.ok && r.dados.avisos?.includes("TELEFONE_COMPARTILHADO");
  const extra = pendente ? " Fica a confirmar pelo síndico." : "";
  return compartilhado ? { tom: "info", texto: `${texto}${extra} ${AVISOS_CONTATO.TELEFONE_COMPARTILHADO}` } : { tom: "ok", texto: `${texto}${extra}` };
}

// ---------------------------------------------------------------------------------------

export function IncluirContato({ aberto, unidade, aoFechar, salvo }: { aberto: boolean; unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo }) {
  const nome = nomeDaUnidade(unidade.unidade.bloco, unidade.unidade.identificacao);
  return (
    <Dialogo aberto={aberto} titulo={`Incluir contato · ${nome}`} aoFechar={aoFechar}>
      {aberto ? <FormIncluir unidade={unidade} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormIncluir({ unidade, aoFechar, salvo }: { unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo }) {
  const [modo, setModo] = useState<"nova" | "cadastrada">("nova");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [relacao, setRelacao] = useState("MORADOR");
  const [principal, setPrincipal] = useState(unidade.contatos.length === 0);
  const [recebe, setRecebe] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscado, setBuscado] = useState<string | null>(null);
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const achados = useCarregar<ListaMoradores>(buscado ? `/v1/condominio/moradores?${new URLSearchParams({ busca: buscado })}` : null);
  const ja = new Set(unidade.contatos.map((c) => c.contatoId));
  const opcoes = achados.estado === "pronto" && buscado
    ? [...new Map(achados.dados.itens.filter((i) => !ja.has(i.contatoId)).map((i) => [i.contatoId, i])).values()]
    : [];

  async function incluir() {
    setErro(null);
    if (modo === "cadastrada" && !contatoId) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["contatoId"] } });
    const corpo = modo === "nova" ? { nome, telefone, relacao, principal, recebeComunicados: recebe } : { contatoId, relacao, principal, recebeComunicados: recebe };
    const r = await chamarApi<{ avisos: string[] }>(`/v1/condominio/unidades/${unidade.unidade.id}/contatos`, { corpo });
    if (!r.ok) return setErro(r.erro);
    const quem = modo === "nova" ? nome.trim() : opcoes.find((o) => o.contatoId === contatoId)?.nome ?? "Contato";
    salvo(aviso(r, `${quem} incluído na unidade.`, !unidade.podeConfirmar));
  }

  const campos = camposComErro(erro);
  return (
    <Form aoEnviar={incluir} aoFechar={aoFechar} erro={erro} textoBotao="Incluir contato">
      <Escolha rotulo="Quem é" atual={modo} aoMudar={(m) => { setModo(m); setErro(null); }}
        opcoes={[{ valor: "nova", texto: "Pessoa nova" }, { valor: "cadastrada", texto: "Já cadastrada em outra unidade" }]} />
      {modo === "nova" ? (
        <>
          <CampoTexto id="c-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
            erro={campos.includes("nome") ? ERRO_CAMPO.nome : null} />
          <CampoTexto id="c-telefone" rotulo="Telefone (WhatsApp)" type="tel" inputMode="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)}
            placeholder="(61) 99999-0000" erro={campos.includes("telefone") ? ERRO_CAMPO.telefone : null} />
        </>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-end gap-2">
            <CampoTexto id="c-busca" rotulo="Buscar pelo nome ou telefone" className="min-w-0 flex-1" value={busca} maxLength={60}
              onChange={(e) => setBusca(e.target.value)} erro={campos.includes("contatoId") ? "Busque e escolha a pessoa." : null}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setBuscado(busca.trim() || null); setContatoId(null); } }} />
            <Botao variante="secundario" onClick={() => { setBuscado(busca.trim() || null); setContatoId(null); }}>Buscar</Botao>
          </div>
          {achados.estado === "carregando" && buscado ? <Carregando linhas={1} rotulo="Buscando…" /> : null}
          {achados.estado === "erro" ? <ErroCarregar texto={achados.texto} tentarDeNovo={achados.recarregar} /> : null}
          {buscado && achados.estado === "pronto" ? (
            opcoes.length ? (
              <fieldset className="grid gap-1.5">
                <legend className="sr-only">Escolha a pessoa</legend>
                {opcoes.map((o) => (
                  <label key={o.contatoId} className="flex items-start gap-2 rounded-md border border-linha px-3 py-2 text-sm">
                    <input type="radio" name="c-contato" className="mt-1 accent-[var(--color-acao)]" checked={contatoId === o.contatoId} onChange={() => setContatoId(o.contatoId)} />
                    <span><span className="font-medium">{o.nome}</span><span className="block text-xs text-tinta-suave">{mostrarTelefone(o.telefone)} · {nomeDaUnidade(o.bloco, o.unidade)}</span></span>
                  </label>
                ))}
              </fieldset>
            ) : <p className="text-sm text-tinta-suave">Ninguém encontrado. Confira a busca ou cadastre como pessoa nova.</p>
          ) : null}
        </div>
      )}
      <CampoSelecao id="c-relacao" rotulo="Relação com a unidade" value={relacao} onChange={(e) => setRelacao(e.target.value)} opcoes={opcoesRelacao}
        erro={campos.includes("relacao") ? ERRO_CAMPO.relacao : null} />
      <Caixa id="c-principal" rotulo="Contato principal da unidade" ajuda="Um por unidade. Marcar este tira o anterior." marcada={principal} aoMudar={setPrincipal} />
      <Caixa id="c-recebe" rotulo="Recebe comunicados do condomínio" marcada={recebe} aoMudar={setRecebe} />
      <p className="text-sm text-tinta-suave">
        {unidade.podeConfirmar ? "Quem você inclui já fica confirmado." : "O contato fica a confirmar até o síndico conferir."} Ter o telefone não dá acesso a nada além do que a unidade pode ver.
      </p>
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

export function EditarContato({ contato, aoFechar, salvo, recarregar }: { contato: ContatoDaUnidade | null; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  return (
    <Dialogo aberto={!!contato} titulo={contato ? `Editar ${contato.nome}` : "Editar contato"} aoFechar={aoFechar}>
      {contato ? <FormEditar contato={contato} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormEditar({ contato, aoFechar, salvo, recarregar }: { contato: ContatoDaUnidade; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const [nome, setNome] = useState(contato.nome);
  const [telefone, setTelefone] = useState(mostrarTelefone(contato.telefone));
  const [relacao, setRelacao] = useState(contato.relacao);
  const [principal, setPrincipal] = useState(contato.principal);
  const [recebe, setRecebe] = useState(contato.recebeComunicados);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const mudouContato = nome.trim() !== contato.nome || telefone !== mostrarTelefone(contato.telefone);
  const mudouVinculo = relacao !== contato.relacao || principal !== contato.principal || recebe !== contato.recebeComunicados;

  async function salvar() {
    setErro(null);
    let avisos: Resposta<{ avisos?: string[] }> | null = null;
    if (mudouContato) {
      const r = await chamarApi<{ avisos: string[] }>(`/v1/condominio/contatos/${contato.contatoId}`, {
        metodo: "PUT", corpo: { versao: contato.contatoVersao, nome, telefone },
      });
      if (!r.ok) return setErro(r.erro);
      avisos = r;
    }
    if (mudouVinculo) {
      const r = await chamarApi(`/v1/condominio/vinculos-unidade/${contato.vinculoId}`, {
        metodo: "PUT", corpo: { versao: contato.versao, relacao, principal, recebeComunicados: recebe },
      });
      if (!r.ok) return setErro(r.erro);
    }
    salvo(avisos ? aviso(avisos, "Contato atualizado.", false) : { tom: "ok", texto: mudouVinculo ? "Contato atualizado." : "Nada mudou." });
  }

  const campos = camposComErro(erro);
  return (
    <Form aoEnviar={salvar} aoFechar={aoFechar} erro={erro} textoBotao="Salvar" recarregar={recarregar}>
      <CampoTexto id="e-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={campos.includes("nome") ? ERRO_CAMPO.nome : null} />
      <CampoTexto id="e-telefone" rotulo="Telefone (WhatsApp)" type="tel" inputMode="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)}
        ajuda={contato.outrasUnidades.length ? `Nome e telefone mudam também em ${contato.outrasUnidades.join(", ")}.` : undefined}
        erro={campos.includes("telefone") ? ERRO_CAMPO.telefone : null} />
      <CampoSelecao id="e-relacao" rotulo="Relação com a unidade" value={relacao} onChange={(e) => setRelacao(e.target.value)} opcoes={opcoesRelacao} />
      <Caixa id="e-principal" rotulo="Contato principal da unidade" ajuda="Um por unidade. Marcar este tira o anterior." marcada={principal} aoMudar={setPrincipal} />
      <Caixa id="e-recebe" rotulo="Recebe comunicados do condomínio" marcada={recebe} aoMudar={setRecebe} />
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

const MOTIVOS_SAIDA = (["MUDANCA", "CORRECAO", "PEDIDO"] as const).map((m) => ({ valor: m, texto: MOTIVOS_ENCERRAMENTO[m] }));

export function Encerrar({ contato, nomeUnidade, aoFechar, salvo, recarregar }: {
  contato: ContatoDaUnidade | null;
  nomeUnidade: string;
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  return (
    <Dialogo aberto={!!contato} titulo={contato ? `Encerrar o vínculo de ${contato.nome}` : "Encerrar vínculo"} aoFechar={aoFechar}>
      {contato ? <FormEncerrar contato={contato} nomeUnidade={nomeUnidade} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormEncerrar({ contato, nomeUnidade, aoFechar, salvo, recarregar }: { contato: ContatoDaUnidade; nomeUnidade: string; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const [motivo, setMotivo] = useState<string>("MUDANCA");
  const [data, setData] = useState(hojeEmBrasilia());
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function encerrar() {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/vinculos-unidade/${contato.vinculoId}/encerrar`, {
      corpo: { versao: contato.versao, motivo, dataSaida: motivo === "MUDANCA" ? data : null },
    });
    if (!r.ok) return setErro(r.erro);
    salvo({ tom: "ok", texto: `${contato.nome} não fala mais por ${nomeUnidade}.` });
  }

  return (
    <Form aoEnviar={encerrar} aoFechar={aoFechar} erro={erro} textoBotao="Encerrar vínculo" recarregar={recarregar} perigo>
      <CampoSelecao id="x-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} opcoes={MOTIVOS_SAIDA} />
      {motivo === "MUDANCA" ? (
        <CampoTexto id="x-data" rotulo="Data da saída" type="date" value={data} onChange={(e) => setData(e.target.value)}
          erro={camposComErro(erro).includes("dataSaida") ? "Confira a data." : null} />
      ) : null}
      <p className="text-sm">{contato.nome} deixa de falar pela unidade agora. O vínculo encerrado não volta; se precisar, inclua de novo.</p>
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

interface Entrada {
  chave: number;
  nome: string;
  telefone: string;
  relacao: string;
}

export function RegistrarMudanca({ aberto, unidade, aoFechar, salvo, recarregar }: { aberto: boolean; unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const nome = nomeDaUnidade(unidade.unidade.bloco, unidade.unidade.identificacao);
  return (
    <Dialogo aberto={aberto} titulo={`Registrar mudança · ${nome}`} aoFechar={aoFechar}>
      {aberto ? <FormMudanca unidade={unidade} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormMudanca({ unidade, aoFechar, salvo, recarregar }: { unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const [data, setData] = useState(hojeEmBrasilia());
  const [saem, setSaem] = useState<string[]>([]);
  const [entram, setEntram] = useState<Entrada[]>([{ chave: 1, nome: "", telefone: "", relacao: "INQUILINO" }]);
  const [principal, setPrincipal] = useState(1);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const preenchidos = entram.filter((e) => e.nome.trim() || e.telefone.trim());
  const ficam = unidade.contatos.filter((c) => !saem.includes(c.vinculoId));
  const mudar = (chave: number, campo: keyof Entrada, v: string) => setEntram((l) => l.map((e) => (e.chave === chave ? { ...e, [campo]: v } : e)));

  async function registrar() {
    setErro(null);
    const corpo = {
      data,
      saem: unidade.contatos.filter((c) => saem.includes(c.vinculoId)).map((c) => ({ id: c.vinculoId, versao: c.versao })),
      entram: preenchidos.map((e) => ({ nome: e.nome, telefone: e.telefone, relacao: e.relacao, principal: e.chave === principal, recebeComunicados: true })),
    };
    const r = await chamarApi<{ saem: number; entram: number }>(`/v1/condominio/unidades/${unidade.unidade.id}/mudanca`, { corpo });
    if (!r.ok) return setErro(r.erro);
    const pend = unidade.podeConfirmar ? "" : " Quem entrou fica a confirmar pelo síndico.";
    salvo({ tom: "ok", texto: `Mudança registrada: ${r.dados.saem} ${r.dados.saem === 1 ? "saiu" : "saíram"}, ${r.dados.entram} ${r.dados.entram === 1 ? "entrou" : "entraram"}.${pend}` });
  }

  const campos = camposComErro(erro);
  return (
    <Form aoEnviar={registrar} aoFechar={aoFechar} erro={erro} textoBotao="Registrar mudança" recarregar={recarregar}>
      <CampoTexto id="m-data" rotulo="Data da mudança" type="date" value={data} onChange={(e) => setData(e.target.value)}
        erro={campos.includes("data") ? "Confira a data." : null} />
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-[13px] font-medium">Quem sai</legend>
        {unidade.contatos.length === 0 ? <p className="text-sm text-tinta-suave">Ninguém na unidade agora.</p> : unidade.contatos.map((c) => (
          <Caixa key={c.vinculoId} id={`m-sai-${c.vinculoId}`} rotulo={`${c.nome} · ${nomeRelacao(c.relacao).toLowerCase()}`} marcada={saem.includes(c.vinculoId)}
            aoMudar={(v) => setSaem(v ? [...saem, c.vinculoId] : saem.filter((x) => x !== c.vinculoId))} />
        ))}
        {saem.length && ficam.length ? <p className="text-xs text-tinta-suave">Ficam: {ficam.map((c) => c.nome).join(", ")}.</p> : null}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[13px] font-medium">Quem entra</legend>
        {entram.map((e, i) => (
          <div key={e.chave} className="grid gap-2 rounded-lg border border-linha p-3">
            <CampoTexto id={`m-nome-${e.chave}`} rotulo={`Nome da pessoa ${i + 1}`} maxLength={120} value={e.nome} onChange={(ev) => mudar(e.chave, "nome", ev.target.value)} />
            <CampoTexto id={`m-tel-${e.chave}`} rotulo={`Telefone da pessoa ${i + 1}`} type="tel" inputMode="tel" placeholder="(61) 99999-0000" value={e.telefone}
              onChange={(ev) => mudar(e.chave, "telefone", ev.target.value)} />
            <CampoSelecao id={`m-rel-${e.chave}`} rotulo={`Relação da pessoa ${i + 1}`} value={e.relacao} onChange={(ev) => mudar(e.chave, "relacao", ev.target.value)} opcoes={opcoesRelacao} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="m-principal" className="accent-[var(--color-acao)]" checked={principal === e.chave} onChange={() => setPrincipal(e.chave)} />
                Contato principal
              </label>
              {entram.length > 1 ? <Botao variante="texto" onClick={() => setEntram(entram.filter((x) => x.chave !== e.chave))}>Tirar pessoa {i + 1}</Botao> : null}
            </div>
          </div>
        ))}
        {entram.length < 20 ? (
          <Botao variante="secundario" className="justify-self-start"
            onClick={() => setEntram([...entram, { chave: Math.max(...entram.map((x) => x.chave)) + 1, nome: "", telefone: "", relacao: "FAMILIAR" }])}>
            + Mais uma pessoa
          </Botao>
        ) : null}
        {campos.includes("entram") ? <p className="text-sm text-erro">Confira nome e telefone (com DDD) de quem entra.</p> : null}
        <p className="text-xs text-tinta-suave">Deixe em branco se ninguém entra agora.</p>
      </fieldset>
      <p className="text-sm">
        {saem.length ? "Quem sai deixa de falar pela unidade agora. Se não estiver em outra unidade, depois você pode remover os dados. " : ""}
        {unidade.podeConfirmar ? "Quem entra já fica confirmado." : "Quem entra fica a confirmar pelo síndico."}
      </p>
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

export function EditarUnidade({ aberto, unidade, aoFechar, salvo, recarregar }: { aberto: boolean; unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  return (
    <Dialogo aberto={aberto} titulo="Editar unidade" aoFechar={aoFechar}>
      {aberto ? <FormUnidade unidade={unidade} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormUnidade({ unidade, aoFechar, salvo, recarregar }: { unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const u = unidade.unidade;
  const blocos = useCarregar<Unidades>("/v1/condominio/unidades");
  const [identificacao, setIdentificacao] = useState(u.identificacao);
  const [blocoId, setBlocoId] = useState(u.blocoId ?? "");
  const [ativa, setAtiva] = useState(u.ativa);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar() {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/unidades/${u.id}`, { metodo: "PUT", corpo: { versao: u.versao, identificacao, blocoId: blocoId || null, ativa } });
    if (!r.ok) return setErro(r.erro);
    salvo({ tom: "ok", texto: ativa === u.ativa ? "Unidade atualizada." : ativa ? "Unidade reativada." : "Unidade desativada. Ela continua no histórico." });
  }

  if (blocos.estado === "carregando") return <Carregando linhas={2} />;
  if (blocos.estado === "erro") return <ErroCarregar texto={blocos.texto} tentarDeNovo={blocos.recarregar} />;
  const opcoes = [{ valor: "", texto: "Sem bloco" }, ...blocos.dados.blocos.filter((b) => b.ativo || b.id === u.blocoId).map((b) => ({ valor: b.id, texto: b.nome }))];
  return (
    <Form aoEnviar={salvar} aoFechar={aoFechar} erro={erro} textoBotao="Salvar" recarregar={recarregar}>
      <CampoTexto id="un-ident" rotulo="Identificação" required maxLength={20} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)}
        ajuda="Como o prédio chama a unidade: 101, Casa 12, Loja 3." erro={camposComErro(erro).includes("identificacao") ? "Até 20 caracteres." : null} />
      <CampoSelecao id="un-bloco" rotulo="Bloco" value={blocoId} onChange={(e) => setBlocoId(e.target.value)} opcoes={opcoes} />
      <Caixa id="un-ativa" rotulo="Unidade ativa" ajuda="Só dá para desativar a unidade sem contatos. Nada é apagado." marcada={ativa} aoMudar={setAtiva} />
    </Form>
  );
}
