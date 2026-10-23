"use client";
// Janelas da ficha da unidade: incluir pessoa (nova ou já cadastrada, MU-01, MU-04), cadastrar
// morador ou proprietário escolhendo a torre ou bloco, o andar e a unidade, editar a pessoa e
// o vínculo (MU-08, MU-10), encerrar (MU-07), registrar mudança (MU-07) e editar a unidade.
// O vínculo tem as três marcações, a ligação, o parentesco e o período de ocupação (MU-10).
// Inquilino em unidade sem proprietário entra junto com o proprietário do imóvel (MU-01).
// No conflito de versão, o que a pessoa escreveu fica (AT-24).

import { useState, type FormEvent, type ReactNode } from "react";
import { AVISOS_CONTATO, chaveUnidade, mostrarAndar, mostrarTelefone, MOTIVOS_ENCERRAMENTO, nomeDaUnidade, relacaoDasMarcas, SITUACOES_EMAIL } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Carregando, Dialogo, ErroCarregar, Icone, textoDoErro, type ErroApi, type Resposta,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ContatoDaUnidade, ListaMoradores, Recado, UnidadeDetalhe, Unidades } from "../tipos.ts";
import { andaresDe } from "./AbaUnidades.tsx";
import { Caixa, Escolha, hojeEmBrasilia, nomeRelacao, nomesDivisao } from "./comum.tsx";
import { CamposVinculo, marcasDe, VINCULO_NOVO, vinculoDe, type CamposDoVinculo } from "./Vinculo.tsx";

type Salvo = (r: Recado) => void;

/** Formulário com erro da API no topo, Cancelar e o botão de salvar. */
function Form({ aoEnviar, aoFechar, erro, textoBotao, recarregar, children, perigo, rodape }: {
  aoEnviar: () => Promise<void>;
  aoFechar: () => void;
  erro: ErroApi | null;
  textoBotao: string;
  recarregar?: () => void;
  children: ReactNode;
  perigo?: boolean;
  /** Rodapé próprio (os passos do celular); recebe se está enviando. */
  rodape?: (enviando: boolean) => ReactNode;
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
      {rodape ? rodape(enviando) : (
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante={perigo ? "perigo" : "primario"} disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</Botao>
        </div>
      )}
    </form>
  );
}

const ERRO_CAMPO: Record<string, string> = {
  nome: "Escreva o nome (até 120 caracteres).",
  telefone: "Telefone com DDD, como (61) 99999-0000.",
};

/** Campos do vínculo com erro: o banco aponta cada um; a validação da API diz só "marcas". */
const errosDoVinculo = (campos: string[]) => (campos.includes("marcas") ? ["ligacao", "parentesco", "ocupaDesde"] : campos);

function aviso(r: Resposta<{ avisos?: string[] }>, texto: string, pendente: boolean): Recado {
  const compartilhado = r.ok && r.dados.avisos?.includes("TELEFONE_COMPARTILHADO");
  const extra = pendente ? " Fica a confirmar pelo síndico." : "";
  return compartilhado ? { tom: "info", texto: `${texto}${extra} ${AVISOS_CONTATO.TELEFONE_COMPARTILHADO}` } : { tom: "ok", texto: `${texto}${extra}` };
}

// ---------------------------------------------------------------------------------------

/** A unidade que recebe o contato. */
interface Alvo {
  id: string;
  temContatos: boolean;
  /** Já tem proprietário no cadastro; sem ele, o inquilino entra junto com o proprietário (MU-01). */
  temProprietario: boolean;
  contatoIds: string[];
  /** Quem é o responsável hoje (para avisar a troca e dizer de quem é o parentesco). */
  responsavel: { nome: string; mora: boolean } | null;
}

export function IncluirContato({ aberto, unidade, relacaoInicial, aoFechar, salvo }: {
  aberto: boolean;
  unidade: UnidadeDetalhe;
  relacaoInicial?: string;
  aoFechar: () => void;
  salvo: Salvo;
}) {
  const nome = nomeDaUnidade(unidade.unidade.bloco, unidade.unidade.andar, unidade.unidade.identificacao);
  const alvo = {
    id: unidade.unidade.id,
    temContatos: unidade.contatos.length > 0,
    temProprietario: unidade.contatos.some((c) => c.relacao === "PROPRIETARIO"),
    contatoIds: unidade.contatos.map((c) => c.contatoId),
    responsavel: ((r) => (r ? { nome: r.nome, mora: r.mora } : null))(unidade.contatos.find((c) => c.principal)),
  };
  return (
    <Dialogo aberto={aberto} titulo={`${relacaoInicial === "PROPRIETARIO" ? "Incluir proprietário" : "Incluir pessoa"} · ${nome}`} aoFechar={aoFechar}>
      {aberto ? <FormIncluir alvo={alvo} podeConfirmar={unidade.podeConfirmar} relacaoInicial={relacaoInicial} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

/**
 * Cadastrar morador ou proprietário (condômino) a partir da lista: escolher a torre ou bloco,
 * o andar e a unidade, do jeito que o prédio se organiza, e depois a pessoa.
 */
export function CadastrarMorador({ aberto, dados, aoFechar, salvo }: { aberto: boolean; dados: Unidades; aoFechar: () => void; salvo: Salvo }) {
  return (
    <Dialogo aberto={aberto} titulo="Cadastrar pessoa" aoFechar={aoFechar} media fechar
      apoio={`Morador ou proprietário. ${dados.podeConfirmar ? "Quem você inclui já fica confirmado." : "A pessoa fica a confirmar até o síndico conferir."}`}>
      {aberto ? <FormCadastrar dados={dados} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormCadastrar({ dados, aoFechar, salvo }: { dados: Unidades; aoFechar: () => void; salvo: Salvo }) {
  const div = nomesDivisao(dados.estrutura);
  const ativas = dados.unidades.filter((u) => u.ativa);
  const blocos = dados.blocos.filter((b) => b.ativo && ativas.some((u) => u.blocoId === b.id));
  const temSemBloco = ativas.some((u) => !u.blocoId);
  const pedeBloco = div.usa && blocos.length > 0;
  const [blocoId, setBlocoId] = useState(pedeBloco ? (blocos.length === 1 && !temSemBloco ? blocos[0]!.id : "") : "-");
  const noBloco = ativas.filter((u) => (blocoId === "-" ? true : blocoId === "-sem" ? !u.blocoId : u.blocoId === blocoId));
  const andares = dados.estrutura.usaAndar ? andaresDe(noBloco) : [];
  const pedeAndar = andares.length > 0;
  const [andar, setAndar] = useState("");
  const noAndar = pedeAndar ? noBloco.filter((u) => (u.andar ?? "") === andar) : noBloco;
  const [unidadeId, setUnidadeId] = useState("");
  const unidade = noAndar.find((u) => u.id === unidadeId) ?? null;
  const prontoBloco = !pedeBloco || blocoId !== "";
  const prontoAndar = !pedeAndar || andar !== "" || noBloco.some((u) => !u.andar);

  const [passo, setPasso] = useState<Passo>(1);
  const nomeUnidade = unidade ? nomeDaUnidade(dados.blocos.find((b) => b.id === unidade.blocoId)?.nome, unidade.andar, unidade.identificacao) : null;
  const escolhaUnidade = (
    <>
      {pedeBloco ? (
        <CampoSelecao id="cm-bloco" rotulo={div.um} value={blocoId} onChange={(e) => { setBlocoId(e.target.value); setAndar(""); setUnidadeId(""); }}
          opcoes={[{ valor: "", texto: `Escolha ${div.um === "Torre" || div.um === "Quadra" ? "a" : "o"} ${div.um.toLowerCase()}` },
            ...blocos.map((b) => ({ valor: b.id, texto: b.nome })), ...(temSemBloco ? [{ valor: "-sem", texto: div.sem }] : [])]} />
      ) : null}
      {prontoBloco && pedeAndar ? (
        <CampoSelecao id="cm-andar" rotulo="Andar" value={andar} onChange={(e) => { setAndar(e.target.value); setUnidadeId(""); }}
          opcoes={[{ valor: "", texto: noBloco.some((u) => !u.andar) ? "Sem andar" : "Escolha o andar" }, ...andares.map((a) => ({ valor: a, texto: mostrarAndar(a) }))]} />
      ) : null}
      {prontoBloco && prontoAndar ? (
        <CampoSelecao id="cm-unidade" rotulo="Unidade" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}
          opcoes={[{ valor: "", texto: noAndar.length ? "Escolha a unidade" : "Nenhuma unidade aqui" },
            ...[...noAndar].sort((a, b) => chaveUnidade(a.identificacao).localeCompare(chaveUnidade(b.identificacao)))
              .map((u) => ({ valor: u.id, texto: `${u.identificacao}${u.principal ? ` · ${u.principal}` : ""}` }))]} />
      ) : null}
    </>
  );
  const parte1 = (
    <Parte n={1} passo={passo}>
      <div className="grid gap-4 sm:grid-cols-2">{escolhaUnidade}</div>
    </Parte>
  );

  if (!unidade || !nomeUnidade) {
    return (
      <div className="grid gap-4">
        <TopoPassos passo={1} resumos={[]} irPara={setPasso} />
        {parte1}
        <p className="t-apoio max-md:hidden">Escolha a unidade para dizer quem é a pessoa e a ligação dela com a unidade.</p>
        <div className="flex justify-end gap-2 max-md:grid max-md:grid-cols-[1fr_2fr]">
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao className="md:hidden" disabled><Icone nome="dir" />Continuar</Botao>
        </div>
      </div>
    );
  }
  return (
    <FormIncluir key={unidade.id} alvo={{ id: unidade.id, temContatos: unidade.confirmados + unidade.pendentes > 0, temProprietario: unidade.temProprietario, contatoIds: [],
      responsavel: unidade.principal ? { nome: unidade.principal, mora: false } : null }}
      podeConfirmar={dados.podeConfirmar} aoFechar={aoFechar} salvo={salvo} nomeUnidade={nomeUnidade}
      partes={{ parte1, passo, setPasso, nomeUnidade }} />
  );
}

const PARTES_CADASTRAR = ["Unidade", "Quem é", "Ligação com a unidade"] as const;
type Passo = 1 | 2 | 3;

/** Uma parte do Cadastrar pessoa: com número no computador; no celular, só aparece no seu passo. */
function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <div className={`parte ${n === 1 ? "border-t-0 pt-2" : ""} ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h3 className="t-titulo-cartao">{PARTES_CADASTRAR[n - 1]}</h3>
      </div>
      {children}
    </div>
  );
}

/** No celular: em que passo está, a barra de progresso e o que já foi escolhido, com Alterar. */
function TopoPassos({ passo, resumos, irPara }: { passo: Passo; resumos: string[]; irPara: (p: Passo) => void }) {
  return (
    <div className="grid gap-3 md:hidden">
      <p className="grid">
        <span className="t-apoio">Passo {passo} de 3</span>
        <span className="t-titulo-cartao">{PARTES_CADASTRAR[passo - 1]}</span>
      </p>
      <div className="passos" role="progressbar" aria-label="Passos do cadastro" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo}
        aria-valuetext={`Passo ${passo} de 3: ${PARTES_CADASTRAR[passo - 1]}`}>
        {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
      </div>
      {resumos.slice(0, passo - 1).map((texto, i) => (
        <button key={i} type="button" className="resumo-passo" onClick={() => irPara((i + 1) as Passo)}>
          <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
          <span className="grid min-w-0 flex-1">
            <span className="t-apoio">{PARTES_CADASTRAR[i]}</span>
            <span className="truncate">{texto}</span>
          </span>
          <span className="alterar">Alterar</span>
        </button>
      ))}
    </div>
  );
}

/** A pessoa escolhida: nova (nome e telefone) ou já cadastrada no condomínio (pela busca). */
interface Pessoa {
  modo: "nova" | "cadastrada";
  nome: string;
  telefone: string;
  contatoId: string | null;
  nomeEscolhido: string | null;
}

const PESSOA_VAZIA: Pessoa = { modo: "nova", nome: "", telefone: "", contatoId: null, nomeEscolhido: null };

function nomeDaPessoa(p: Pessoa): string {
  return p.modo === "nova" ? p.nome.trim() : p.nomeEscolhido ?? "Contato";
}

function corpoDaPessoa(p: Pessoa): { contatoId: string } | { nome: string; telefone: string } {
  return p.modo === "nova" ? { nome: p.nome, telefone: p.telefone } : { contatoId: p.contatoId ?? "" };
}

/** Pessoa nova ou já cadastrada, com a busca por nome ou telefone. */
function EscolherPessoa({ prefixo, rotulo, textoCadastrada, de = "", pessoa, aoMudar, excluir, erros }: {
  prefixo: string;
  rotulo: string;
  /** Complemento dos rótulos quando há duas pessoas na janela: " do proprietário". */
  de?: string;
  textoCadastrada: string;
  pessoa: Pessoa;
  aoMudar: (p: Pessoa) => void;
  excluir: string[];
  erros: { nome?: string | null; telefone?: string | null; contato?: string | null };
}) {
  const [busca, setBusca] = useState("");
  const [buscado, setBuscado] = useState<string | null>(null);
  const achados = useCarregar<ListaMoradores>(buscado ? `/v1/condominio/moradores?${new URLSearchParams({ busca: buscado })}` : null);
  const fora = new Set(excluir);
  const opcoes = achados.estado === "pronto" && buscado
    ? [...new Map(achados.dados.itens.filter((i) => !fora.has(i.contatoId)).map((i) => [i.contatoId, i])).values()]
    : [];
  const buscar = () => { setBuscado(busca.trim() || null); aoMudar({ ...pessoa, contatoId: null, nomeEscolhido: null }); };

  return (
    <>
      <Escolha rotulo={rotulo} atual={pessoa.modo} aoMudar={(m) => aoMudar({ ...pessoa, modo: m })}
        opcoes={[{ valor: "nova", texto: "Pessoa nova" }, { valor: "cadastrada", texto: textoCadastrada }]} />
      {pessoa.modo === "nova" ? (
        <>
          <CampoTexto id={`${prefixo}-nome`} rotulo={`Nome${de}`} required maxLength={120} value={pessoa.nome} onChange={(e) => aoMudar({ ...pessoa, nome: e.target.value })}
            erro={erros.nome} />
          <CampoTexto id={`${prefixo}-telefone`} rotulo={`Telefone${de} (WhatsApp)`} type="tel" inputMode="tel" required value={pessoa.telefone}
            onChange={(e) => aoMudar({ ...pessoa, telefone: e.target.value })} placeholder="(61) 99999-0000" erro={erros.telefone} />
        </>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-end gap-2">
            <CampoTexto id={`${prefixo}-busca`} rotulo={de ? `Buscar${de} pelo nome ou telefone` : "Buscar pelo nome ou telefone"} className="min-w-0 flex-1" value={busca} maxLength={60}
              onChange={(e) => setBusca(e.target.value)} erro={erros.contato}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} />
            <Botao variante="contorno" onClick={buscar}>Buscar</Botao>
          </div>
          {achados.estado === "carregando" && buscado ? <Carregando linhas={1} rotulo="Buscando…" /> : null}
          {achados.estado === "erro" ? <ErroCarregar erro={achados.erro} texto={achados.texto} tentarDeNovo={achados.recarregar} /> : null}
          {buscado && achados.estado === "pronto" ? (
            opcoes.length ? (
              <fieldset className="grid gap-1.5">
                <legend className="sr-only">Escolha a pessoa</legend>
                {opcoes.map((o) => (
                  <label key={o.contatoId} className="flex items-start gap-2 rounded-md border border-linha px-3 py-2 t-texto">
                    <input type="radio" name={`${prefixo}-contato`} className="mt-1 accent-violeta-600" checked={pessoa.contatoId === o.contatoId}
                      onChange={() => aoMudar({ ...pessoa, contatoId: o.contatoId, nomeEscolhido: o.nome })} />
                    <span><span className="font-medium">{o.nome}</span><span className="block t-apoio text-tinta-suave">{mostrarTelefone(o.telefone)} · {nomeDaUnidade(o.bloco, o.andar, o.unidade)}</span></span>
                  </label>
                ))}
              </fieldset>
            ) : <p className="t-apoio text-tinta-suave">Ninguém encontrado. Confira a busca ou cadastre como pessoa nova.</p>
          ) : null}
        </div>
      )}
    </>
  );
}

function FormIncluir({ alvo, podeConfirmar, relacaoInicial, aoFechar, salvo, nomeUnidade, partes }: {
  alvo: Alvo;
  podeConfirmar: boolean;
  relacaoInicial?: string;
  aoFechar: () => void;
  salvo: Salvo;
  nomeUnidade?: string;
  /** No Cadastrar pessoa: a parte 1 (a unidade) e o passo do celular. */
  partes?: { parte1: ReactNode; passo: Passo; setPasso: (p: Passo) => void; nomeUnidade: string };
}) {
  const [pessoa, setPessoa] = useState<Pessoa>(PESSOA_VAZIA);
  const [dono, setDono] = useState<Pessoa>(PESSOA_VAZIA);
  // Unidade vazia: a primeira pessoa costuma ser o proprietário que mora e responde por ela.
  const [vinculo, setVinculo] = useState<CamposDoVinculo>(
    relacaoInicial === "PROPRIETARIO" ? { ...VINCULO_NOVO, proprietario: true, mora: false }
      : !alvo.temContatos ? { ...VINCULO_NOVO, proprietario: true, principal: true }
      : { ...VINCULO_NOVO, ligacao: "FAMILIAR" });
  const [recebe, setRecebe] = useState(relacaoInicial === "PROPRIETARIO" ? false : true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const pedeDono = !vinculo.proprietario && vinculo.ligacao === "INQUILINO" && !alvo.temProprietario;

  async function incluir() {
    setErro(null);
    if (pessoa.modo === "cadastrada" && !pessoa.contatoId) {
      partes?.setPasso(2);
      return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["contatoId"] } });
    }
    if (pedeDono && dono.modo === "cadastrada" && !dono.contatoId) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["proprietario"] } });
    const marcas = { ...marcasDe(vinculo), ocupaDesde: vinculo.ocupaDesde || null };
    const corpo = { ...corpoDaPessoa(pessoa), marcas, recebeComunicados: recebe, ...(pedeDono ? { proprietario: corpoDaPessoa(dono) } : {}) };
    const r = await chamarApi<{ avisos: string[] }>(`/v1/condominio/unidades/${alvo.id}/contatos`, { corpo });
    if (!r.ok) {
      // No celular, volta para o passo do campo com erro.
      const comErro = camposComErro(r.erro);
      if (partes && ["nome", "telefone", "contatoId"].some((c) => comErro.includes(c))) partes.setPasso(2);
      return setErro(r.erro);
    }
    const onde = nomeUnidade ? `em ${nomeUnidade}` : "na unidade";
    const texto = pedeDono ? `${nomeDaPessoa(pessoa)} incluído ${onde}, com ${nomeDaPessoa(dono)} como proprietário.` : `${nomeDaPessoa(pessoa)} incluído ${onde}.`;
    aoFechar();
    salvo(aviso(r, texto, !podeConfirmar));
  }

  const campos = camposComErro(erro);
  const erroDono = campos.includes("proprietario") ? (dono.modo === "nova" ? "Confira o nome e o telefone (com DDD) do proprietário." : "Busque e escolha o proprietário.") : null;
  const textoBotao = pedeDono ? "Incluir inquilino e proprietário" : "Incluir pessoa";
  const quem = (
    <EscolherPessoa prefixo="c" rotulo={partes ? "Pessoa nova ou já cadastrada" : "Quem é"} textoCadastrada="Já cadastrada em outra unidade" pessoa={pessoa} excluir={alvo.contatoIds}
      aoMudar={(p) => { setPessoa(p); setErro(null); }}
      erros={{ nome: campos.includes("nome") ? ERRO_CAMPO.nome : null, telefone: campos.includes("telefone") ? ERRO_CAMPO.telefone : null,
        contato: campos.includes("contatoId") ? "Busque e escolha a pessoa." : null }} />
  );
  const ligacao = (
    <>
      <CamposVinculo prefixo="c" valor={vinculo} aoMudar={(v) => { setVinculo(v); setErro(null); }} responsavelAtual={alvo.responsavel}
        erros={errosDoVinculo(campos)} />
      {pedeDono ? (
        <fieldset className="grid gap-3 rounded-2xl border border-linha bg-superficie-2 p-3">
          <legend className="px-1 t-apoio font-semibold">Proprietário do imóvel</legend>
          <p className="t-apoio text-tinta-suave">
            A unidade ainda não tem proprietário no cadastro. Para controle, o inquilino entra junto com o dono do imóvel. O proprietário fica registrado
            sem morar aqui, não é o responsável e não recebe os comunicados do dia a dia (dá para mudar depois).
          </p>
          <EscolherPessoa prefixo="p" rotulo="O proprietário é" textoCadastrada="Já cadastrado no condomínio" de=" do proprietário" pessoa={dono} excluir={[]}
            aoMudar={(p) => { setDono(p); setErro(null); }}
            erros={{ nome: dono.modo === "nova" ? erroDono : null, telefone: null, contato: dono.modo === "cadastrada" ? erroDono : null }} />
        </fieldset>
      ) : null}
      <Caixa id="c-recebe" rotulo="Recebe comunicados do condomínio" marcada={recebe} aoMudar={setRecebe} />
      <p className="t-apoio text-tinta-suave">
        {podeConfirmar ? "Quem você inclui já fica confirmado." : "A pessoa fica a confirmar até o síndico conferir."} Ter o telefone não dá acesso a nada além do que a unidade pode ver.
      </p>
    </>
  );

  if (!partes) {
    return <Form aoEnviar={incluir} aoFechar={aoFechar} erro={erro} textoBotao={textoBotao}>{quem}{ligacao}</Form>;
  }
  const { passo, setPasso } = partes;
  const nomeQuem = pessoa.modo === "nova" ? pessoa.nome.trim() : pessoa.nomeEscolhido ?? "";
  // O celular só segue do passo 2 com a pessoa escrita ou escolhida.
  const podeSeguir = passo === 1 || (pessoa.modo === "nova" ? !!pessoa.nome.trim() && !!pessoa.telefone.trim() : !!pessoa.contatoId);
  return (
    <Form aoEnviar={incluir} aoFechar={aoFechar} erro={erro} textoBotao={textoBotao}
      rodape={(enviando) => (
        <div className="flex justify-end gap-2 max-md:grid max-md:grid-cols-[1fr_2fr]">
          <Botao variante="contorno" onClick={aoFechar} className={passo > 1 ? "max-md:hidden" : ""}>Cancelar</Botao>
          {passo > 1 ? <Botao variante="contorno" className="md:hidden" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao> : null}
          {passo < 3 ? (
            <Botao className="md:hidden" disabled={!podeSeguir} onClick={() => setPasso((passo + 1) as Passo)}>Continuar<Icone nome="dir" /></Botao>
          ) : null}
          <Botao type="submit" disabled={enviando} className={passo < 3 ? "max-md:hidden" : ""}>{enviando ? "Salvando…" : textoBotao}</Botao>
        </div>
      )}>
      <TopoPassos passo={passo} resumos={[partes.nomeUnidade, nomeQuem || "Pessoa"]} irPara={setPasso} />
      {partes.parte1}
      <Parte n={2} passo={passo}><div className="grid gap-4">{quem}</div></Parte>
      <Parte n={3} passo={passo}><div className="grid gap-4">{ligacao}</div></Parte>
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

export function EditarContato({ contato, responsavel, emailLigado, aoFechar, salvo, recarregar }: {
  contato: ContatoDaUnidade | null;
  /** O envio por e-mail está ligado no condomínio (CD-13). */
  emailLigado?: boolean;
  /** O responsável de hoje, se for outra pessoa. */
  responsavel: { nome: string; mora: boolean } | null;
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  return (
    <Dialogo aberto={!!contato} titulo={contato ? `Editar ${contato.nome}` : "Editar pessoa"} aoFechar={aoFechar}>
      {contato ? <FormEditar contato={contato} responsavel={responsavel} emailLigado={emailLigado ?? false} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormEditar({ contato, responsavel, emailLigado, aoFechar, salvo, recarregar }: {
  contato: ContatoDaUnidade;
  responsavel: { nome: string; mora: boolean } | null;
  emailLigado: boolean;
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  const [nome, setNome] = useState(contato.nome);
  const [telefone, setTelefone] = useState(mostrarTelefone(contato.telefone));
  const [vinculo, setVinculo] = useState<CamposDoVinculo>(vinculoDe(contato));
  const [recebe, setRecebe] = useState(contato.recebeComunicados);
  const [email, setEmail] = useState(contato.email ?? "");
  const [recebeEmail, setRecebeEmail] = useState(contato.emailComunicados ?? true);
  const [reenvio, setReenvio] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const mudouEmail = email.trim().toLowerCase() !== (contato.email ?? "").toLowerCase() || recebeEmail !== (contato.emailComunicados ?? true);
  const marcas = { ...marcasDe(vinculo), ocupaDesde: vinculo.ocupaDesde || null };
  const mudouContato = nome.trim() !== contato.nome || telefone !== mostrarTelefone(contato.telefone);
  const mudouVinculo = JSON.stringify(marcas) !== JSON.stringify({ ...marcasDe(vinculoDe(contato)), ocupaDesde: contato.ocupaDesde })
    || recebe !== contato.recebeComunicados;

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
    if (mudouEmail) {
      const r = await chamarApi(`/v1/condominio/contatos/${contato.contatoId}/email`, {
        metodo: "PUT", corpo: { versao: contato.contatoVersao + (mudouContato ? 1 : 0), email: email.trim(), recebe: recebeEmail },
      });
      if (!r.ok) return setErro(r.erro);
    }
    if (mudouVinculo) {
      const r = await chamarApi(`/v1/condominio/vinculos-unidade/${contato.vinculoId}`, {
        metodo: "PUT", corpo: { versao: contato.versao, marcas, recebeComunicados: recebe },
      });
      if (!r.ok) return setErro(r.erro);
    }
    const novoEmail = mudouEmail && email.trim() && email.trim().toLowerCase() !== (contato.email ?? "").toLowerCase();
    const texto = novoEmail ? `${nome.trim()} atualizado. ${emailLigado ? "Mandamos um e-mail para a pessoa confirmar o endereço." : "O e-mail fica esperando confirmação até o envio por e-mail ser ligado."}`
      : `${nome.trim()} atualizado.`;
    salvo(avisos ? aviso(avisos, texto, false) : { tom: "ok", texto: mudouVinculo || mudouEmail ? texto : "Nada mudou." });
  }

  async function reenviar() {
    setReenvio(null);
    const r = await chamarApi(`/v1/condominio/contatos/${contato.contatoId}/email/reenviar`, { corpo: {} });
    setReenvio(r.ok ? "Pedido de confirmação enviado de novo." : textoDoErro(r.erro));
  }

  const campos = camposComErro(erro);
  return (
    <Form aoEnviar={salvar} aoFechar={aoFechar} erro={erro} textoBotao="Salvar" recarregar={recarregar}>
      <CampoTexto id="e-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={campos.includes("nome") ? ERRO_CAMPO.nome : null} />
      <CampoTexto id="e-telefone" rotulo="Telefone (WhatsApp)" type="tel" inputMode="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)}
        ajuda={contato.outrasUnidades.length ? `Nome e telefone mudam também em ${contato.outrasUnidades.join(", ")}.` : undefined}
        erro={campos.includes("telefone") ? ERRO_CAMPO.telefone : null} />
      <CamposVinculo prefixo="e" valor={vinculo} aoMudar={(v) => { setVinculo(v); setErro(null); }}
        responsavelAtual={contato.principal ? null : responsavel} erros={errosDoVinculo(campos)} />
      <p className="t-apoio text-tinta-suave">O &quot;ocupou até&quot; é preenchido quando o vínculo é encerrado ou numa mudança.</p>
      <Caixa id="e-recebe" rotulo="Recebe comunicados do condomínio" marcada={recebe} aoMudar={setRecebe} />
      <CampoTexto id="e-email" rotulo="E-mail" opcional type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)}
        erro={campos.includes("email") ? "Confira o e-mail: precisa do @ e do domínio." : null}
        ajuda={contato.emailSituacao && email.trim().toLowerCase() === (contato.email ?? "").toLowerCase()
          ? `${SITUACOES_EMAIL[contato.emailSituacao]}${contato.emailSituacao === "PAROU" ? (contato.emailParouMotivo === "SPAM" ? ": marcou como spam" : ": pediu pelo próprio e-mail") : ""}.`
          : "Só a própria pessoa confirma, pelo link que chega no e-mail. Vazio tira o e-mail."} />
      {contato.emailSituacao === "PENDENTE" && emailLigado && email.trim().toLowerCase() === (contato.email ?? "").toLowerCase() ? (
        <span className="flex flex-wrap items-center gap-2 t-texto">
          <Botao variante="discreto" tamanho="p" onClick={() => void reenviar()}>Mandar a confirmação de novo</Botao>
          {reenvio ? <span className="t-apoio text-tinta-suave" role="status">{reenvio}</span> : null}
        </span>
      ) : null}
      {email.trim() ? (
        <Caixa id="e-recebe-email" rotulo="Recebe comunicados por e-mail" marcada={recebeEmail} aoMudar={setRecebeEmail}
          ajuda={contato.emailSituacao === "PAROU" ? "A pessoa parou de receber; só ela volta, pelo link do e-mail." : "Começa a valer quando a pessoa confirmar o e-mail."} />
      ) : null}
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
      corpo: { versao: contato.versao, motivo, dataSaida: data },
    });
    if (!r.ok) return setErro(r.erro);
    salvo({ tom: "ok", texto: `${contato.nome} não fala mais por ${nomeUnidade}.` });
  }

  return (
    <Form aoEnviar={encerrar} aoFechar={aoFechar} erro={erro} textoBotao="Encerrar vínculo" recarregar={recarregar} perigo>
      <CampoSelecao id="x-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} opcoes={MOTIVOS_SAIDA} />
      <CampoTexto id="x-data" rotulo="Ocupou até" type="date" value={data} onChange={(e) => setData(e.target.value)}
        ajuda="A data de saída fica no período de ocupação da pessoa."
        erro={camposComErro(erro).includes("dataSaida") ? (contato.ocupaDesde ? "A saída não pode ser antes da entrada. Confira a data." : "Confira a data.") : null} />
      <p className="t-texto">{contato.nome} deixa de falar pela unidade agora. O vínculo encerrado não volta; se precisar, inclua de novo.</p>
    </Form>
  );
}

// ---------------------------------------------------------------------------------------

interface Entrada {
  chave: number;
  nome: string;
  telefone: string;
  vinculo: CamposDoVinculo;
}

export function RegistrarMudanca({ aberto, unidade, aoFechar, salvo, recarregar }: { aberto: boolean; unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const nome = nomeDaUnidade(unidade.unidade.bloco, unidade.unidade.andar, unidade.unidade.identificacao);
  return (
    <Dialogo aberto={aberto} titulo={`Registrar mudança · ${nome}`} aoFechar={aoFechar}>
      {aberto ? <FormMudanca unidade={unidade} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormMudanca({ unidade, aoFechar, salvo, recarregar }: { unidade: UnidadeDetalhe; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const [data, setData] = useState(hojeEmBrasilia());
  const [saem, setSaem] = useState<string[]>([]);
  const [entram, setEntram] = useState<Entrada[]>([{ chave: 1, nome: "", telefone: "", vinculo: { ...VINCULO_NOVO, principal: true } }]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const preenchidos = entram.filter((e) => e.nome.trim() || e.telefone.trim());
  const ficam = unidade.contatos.filter((c) => !saem.includes(c.vinculoId));
  const relacao = (e: Entrada) => relacaoDasMarcas(marcasDe(e.vinculo));
  const mudar = (chave: number, p: Partial<Omit<Entrada, "chave">>) => setEntram((l) => l.map((e) => (e.chave === chave ? { ...e, ...p } : e)));
  // Um responsável só entre quem entra: marcar um tira dos outros.
  const mudarVinculo = (chave: number, v: CamposDoVinculo) =>
    setEntram((l) => l.map((e) => (e.chave === chave ? { ...e, vinculo: v } : v.principal ? { ...e, vinculo: { ...e.vinculo, principal: false } } : e)));
  const incluirPessoa = (vinculo: CamposDoVinculo) => setEntram([...entram, { chave: Math.max(...entram.map((x) => x.chave)) + 1, nome: "", telefone: "", vinculo }]);
  // Inquilino fica ou entra, e o proprietário sai ou não existe: o novo proprietário entra junto (MU-01).
  const temInquilino = ficam.some((c) => c.relacao === "INQUILINO") || preenchidos.some((e) => relacao(e) === "INQUILINO");
  const saiDono = unidade.contatos.some((c) => saem.includes(c.vinculoId) && c.proprietario);
  const faltaDono = temInquilino && (saiDono || preenchidos.some((e) => relacao(e) === "INQUILINO"))
    && !ficam.some((c) => c.proprietario) && !preenchidos.some((e) => e.vinculo.proprietario);

  async function registrar() {
    setErro(null);
    const corpo = {
      data,
      saem: unidade.contatos.filter((c) => saem.includes(c.vinculoId)).map((c) => ({ id: c.vinculoId, versao: c.versao })),
      // Quem entra ocupa desde a data da mudança; o dono que não mora fica sem os comunicados do dia a dia.
      entram: preenchidos.map((e) => ({
        nome: e.nome, telefone: e.telefone, ...marcasDe(e.vinculo), recebeComunicados: !(e.vinculo.proprietario && !e.vinculo.mora),
      })),
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
        <legend className="mb-1 t-apoio font-medium">Quem sai</legend>
        {unidade.contatos.length === 0 ? <p className="t-apoio text-tinta-suave">Ninguém na unidade agora.</p> : unidade.contatos.map((c) => (
          <Caixa key={c.vinculoId} id={`m-sai-${c.vinculoId}`} rotulo={`${c.nome} · ${nomeRelacao(c.relacao).toLowerCase()}${c.principal ? " · responsável" : ""}`} marcada={saem.includes(c.vinculoId)}
            aoMudar={(v) => setSaem(v ? [...saem, c.vinculoId] : saem.filter((x) => x !== c.vinculoId))} />
        ))}
        {saem.length && ficam.length ? <p className="t-apoio text-tinta-suave">Ficam: {ficam.map((c) => c.nome).join(", ")}.</p> : null}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-1 t-apoio font-medium">Quem entra</legend>
        {entram.map((e, i) => (
          <div key={e.chave} className="grid gap-2 rounded-2xl border border-linha bg-superficie p-3">
            <CampoTexto id={`m-nome-${e.chave}`} rotulo={`Nome da pessoa ${i + 1}`} maxLength={120} value={e.nome} onChange={(ev) => mudar(e.chave, { nome: ev.target.value })} />
            <CampoTexto id={`m-tel-${e.chave}`} rotulo={`Telefone da pessoa ${i + 1}`} type="tel" inputMode="tel" placeholder="(61) 99999-0000" value={e.telefone}
              onChange={(ev) => mudar(e.chave, { telefone: ev.target.value })} />
            <CamposVinculo prefixo={`m-${e.chave}`} quem={`A pessoa ${i + 1}`} de={` da pessoa ${i + 1}`} valor={e.vinculo} comPeriodo={false} aoMudar={(v) => mudarVinculo(e.chave, v)}
              responsavelAtual={((r) => (r && !saem.includes(r.vinculoId) ? { nome: r.nome, mora: r.mora } : null))(unidade.contatos.find((c) => c.principal))} />
            {entram.length > 1 ? (
              <div className="flex justify-end"><Botao variante="discreto" onClick={() => setEntram(entram.filter((x) => x.chave !== e.chave))}>Tirar pessoa {i + 1}</Botao></div>
            ) : null}
          </div>
        ))}
        {faltaDono ? (
          <Aviso tom="atencao">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>A unidade vai ficar com inquilino e sem proprietário. Para controle, inclua o proprietário do imóvel entre quem entra.</span>
              {entram.length < 20 ? <Botao variante="contorno" onClick={() => incluirPessoa({ ...VINCULO_NOVO, proprietario: true, mora: false })}>+ Proprietário</Botao> : null}
            </span>
          </Aviso>
        ) : null}
        {entram.length < 20 ? (
          <Botao variante="contorno" className="justify-self-start" onClick={() => incluirPessoa({ ...VINCULO_NOVO, ligacao: "FAMILIAR" })}>+ Mais uma pessoa</Botao>
        ) : null}
        {campos.includes("entram") || campos.includes("ligacao") ? <p className="t-texto text-erro">Confira nome, telefone (com DDD) e a ligação de quem entra.</p> : null}
        <p className="t-apoio text-tinta-suave">Deixe em branco se ninguém entra agora. Quem entra ocupa desde a data da mudança.</p>
      </fieldset>
      <p className="t-texto">
        {saem.length ? "Quem sai deixa de falar pela unidade agora e fica com o \"ocupou até\" nesta data. Se não estiver em outra unidade, depois você pode remover os dados. " : ""}
        {unidade.podeConfirmar ? "Quem entra já fica confirmado." : "Quem entra fica a confirmar pelo síndico."}
        {preenchidos.some((e) => e.vinculo.proprietario && !e.vinculo.mora) ? " O proprietário que não mora na unidade fica no cadastro sem os comunicados do dia a dia." : ""}
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
  const [andar, setAndar] = useState(u.andar ?? "");
  const [ativa, setAtiva] = useState(u.ativa);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function salvar() {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/unidades/${u.id}`, { metodo: "PUT", corpo: { versao: u.versao, identificacao, blocoId: blocoId || null, andar: andar.trim() || null, ativa } });
    if (!r.ok) return setErro(r.erro);
    salvo({ tom: "ok", texto: ativa === u.ativa ? "Unidade atualizada." : ativa ? "Unidade reativada." : "Unidade desativada. Ela continua no histórico." });
  }

  if (blocos.estado === "carregando") return <Carregando linhas={2} />;
  if (blocos.estado === "erro") return <ErroCarregar erro={blocos.erro} texto={blocos.texto} tentarDeNovo={blocos.recarregar} />;
  const div = nomesDivisao(blocos.dados.estrutura);
  const opcoes = [{ valor: "", texto: div.sem }, ...blocos.dados.blocos.filter((b) => b.ativo || b.id === u.blocoId).map((b) => ({ valor: b.id, texto: b.nome }))];
  const mostraBloco = div.usa || !!u.blocoId;
  const mostraAndar = blocos.dados.estrutura.usaAndar || !!u.andar;
  return (
    <Form aoEnviar={salvar} aoFechar={aoFechar} erro={erro} textoBotao="Salvar" recarregar={recarregar}>
      <CampoTexto id="un-ident" rotulo="Identificação" required maxLength={20} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)}
        ajuda="Como o prédio chama a unidade: 101, Casa 12, Loja 3." erro={camposComErro(erro).includes("identificacao") ? "Até 20 caracteres." : null} />
      {mostraBloco ? <CampoSelecao id="un-bloco" rotulo={div.um} value={blocoId} onChange={(e) => setBlocoId(e.target.value)} opcoes={opcoes} /> : null}
      {mostraAndar ? (
        <CampoTexto id="un-andar" rotulo="Andar" opcional maxLength={20} value={andar} onChange={(e) => setAndar(e.target.value)}
          ajuda="3, Térreo, Subsolo 1, Cobertura." erro={camposComErro(erro).includes("andar") ? "Até 20 caracteres." : null} />
      ) : null}
      <Caixa id="un-ativa" rotulo="Unidade ativa" ajuda="Só dá para desativar a unidade sem contatos. Nada é apagado." marcada={ativa} aoMudar={setAtiva} />
    </Form>
  );
}
