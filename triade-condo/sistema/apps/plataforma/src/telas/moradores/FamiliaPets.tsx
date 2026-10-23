"use client";
// Família e pets da unidade (F3.9; MU-06): quem é da família não tem telefone nem acesso, e o
// pet aparece só para quem vê os moradores, nunca no mural nem no WhatsApp. O aniversário é só
// dia e mês, sem o ano (decisão B de 23/10/2026), também para as pessoas da unidade. Retirar
// pergunta o que aconteceu: saiu (fica no histórico) ou cadastrado por engano (os dados saem).

import { useState, type FormEvent, type ReactNode } from "react";
import {
  diasDoMes, ESPECIES, MESES, MOTIVOS_RETIRAR, mostrarAniversario, PARENTESCOS_FAMILIAR, PORTES,
  type Aniversario, type Especie, type ParentescoFamiliar, type Porte,
} from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Iniciais, Interruptor, textoDoErro,
  type ErroApi, type Resposta,
} from "@triade/ui";
import type { Familiar, Pet, Recado } from "../tipos.ts";
import { CartaoFicha, Escolha, MenuAcoes } from "./comum.tsx";

type Salvo = (r: Recado) => void;

/** Aniversário como está nos campos: texto vazio quando não tem. */
export interface AniversarioNoCampo { dia: string; mes: string }

export function aniversarioNoCampo(a?: Aniversario | null): AniversarioNoCampo {
  return a ? { dia: String(a.dia), mes: String(a.mes) } : { dia: "", mes: "" };
}

/** Do campo para a API: null quando falta o dia ou o mês. */
export function aniversarioDoCampo(a: AniversarioNoCampo): Aniversario | null {
  return a.dia && a.mes ? { dia: Number(a.dia), mes: Number(a.mes) } : null;
}

/** Dia e mês, sem o ano. Só um dos dois preenchido pede o outro. */
export function CampoAniversario({ id, valor, aoMudar, erro }: { id: string; valor: AniversarioNoCampo; aoMudar: (v: AniversarioNoCampo) => void; erro?: boolean }) {
  const dias = valor.mes ? diasDoMes(Number(valor.mes)) : 31;
  const faltaUm = Boolean(valor.dia) !== Boolean(valor.mes);
  const msg = erro ? "Esse dia não existe nesse mês." : faltaUm ? "Escolha o dia e o mês." : null;
  return (
    <fieldset className="grid gap-1" aria-describedby={`${id}-ajuda`}>
      <legend className="mb-1 t-apoio font-medium">Aniversário<span className="font-normal text-tinta-suave"> (opcional)</span></legend>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
        <CampoSelecao id={`${id}-dia`} rotulo="Dia" value={valor.dia} onChange={(e) => aoMudar({ ...valor, dia: e.target.value })}
          opcoes={[{ valor: "", texto: "Dia" }, ...Array.from({ length: dias }, (_, i) => ({ valor: String(i + 1), texto: String(i + 1).padStart(2, "0") }))]} />
        <CampoSelecao id={`${id}-mes`} rotulo="Mês" value={valor.mes}
          onChange={(e) => {
            const mes = e.target.value;
            const dia = mes && Number(valor.dia) > diasDoMes(Number(mes)) ? "" : valor.dia;
            aoMudar({ dia, mes });
          }}
          opcoes={[{ valor: "", texto: "Mês" }, ...MESES.map((m, i) => ({ valor: String(i + 1), texto: m }))]} />
      </div>
      {msg ? <p role="alert" className="t-apoio text-erro">{msg}</p> : null}
      <p id={`${id}-ajuda`} className="t-apoio text-tinta-suave">Só dia e mês, sem o ano: ninguém fica sabendo a idade, e isso protege as crianças.</p>
    </fieldset>
  );
}

/** "03/11" com o bolo, ou "Sem aniversário". */
export function DiaDoAniversario({ a }: { a?: Aniversario | null }) {
  return a
    ? <span className="inline-flex items-center gap-1 t-apoio"><Icone nome="bolo" className="h-4 w-4" /><span className="sr-only">Aniversário </span>{mostrarAniversario(a)}</span>
    : <span className="t-apoio text-tinta-suave">Sem aniversário</span>;
}

/** Janela de formulário com o erro da API em cima e Cancelar e o botão principal embaixo; à esquerda, uma ação a mais (Recusar…). */
export function JanelaForm({ aberto, titulo, explicacao, textoBotao, aoFechar, aoSalvar, children, recarregar, erro, setErro, media, esquerda }: {
  aberto: boolean;
  titulo: string;
  explicacao?: string;
  textoBotao: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<Resposta<unknown>>;
  children: ReactNode;
  recarregar: () => void;
  erro: ErroApi | null;
  setErro: (e: ErroApi | null) => void;
  media?: boolean;
  esquerda?: ReactNode;
}) {
  const [enviando, setEnviando] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await aoSalvar();
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  }
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={aoFechar} media={media}>
      {aberto ? (
        <form onSubmit={salvar} noValidate className="grid gap-4">
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
          {explicacao ? <p className="t-apoio text-tinta-suave">{explicacao}</p> : null}
          {children}
          <div className={`flex flex-wrap gap-2 ${esquerda ? "justify-between" : "justify-end"}`}>
            {esquerda}
            <span className="flex gap-2">
              <Botao variante={esquerda ? "contorno" : "discreto"} onClick={aoFechar}>Cancelar</Botao>
              <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</Botao>
            </span>
          </div>
        </form>
      ) : null}
    </Dialogo>
  );
}

/** "Filho ou filha de Joana Lima"; sem responsável, só o parentesco. */
export function parentescoDe(p: ParentescoFamiliar, responsavel: string | null): string {
  if (p === "TRABALHA_NA_CASA" || !responsavel) return PARENTESCOS_FAMILIAR[p];
  return `${PARENTESCOS_FAMILIAR[p]} de ${responsavel}`;
}

function FormFamiliar({ familiar, unidadeId, nomeUnidade, responsavel, aoFechar, salvo, recarregar, incluirPessoa }: {
  familiar: Familiar | null;
  unidadeId: string;
  nomeUnidade: string;
  responsavel: string | null;
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
  incluirPessoa?: () => void;
}) {
  const [nome, setNome] = useState(familiar?.nome ?? "");
  const [parentesco, setParentesco] = useState<ParentescoFamiliar>(familiar?.parentesco ?? "FILHO");
  const [mora, setMora] = useState(familiar?.mora ?? true);
  const [aniversario, setAniversario] = useState(aniversarioNoCampo(familiar?.aniversario));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comErro = camposComErro(erro);
  return (
    <JanelaForm aberto titulo={familiar ? `Editar ${familiar.nome}` : "Incluir familiar"} textoBotao={familiar ? "Salvar" : "Incluir familiar"}
      explicacao={`${nomeUnidade}. Fica na ficha da unidade e no histórico.`} aoFechar={aoFechar} recarregar={recarregar} erro={erro} setErro={setErro}
      aoSalvar={async () => {
        const corpo = { nome, parentesco, mora, aniversario: aniversarioDoCampo(aniversario) };
        const r = familiar
          ? await chamarApi(`/v1/condominio/familiares/${familiar.id}`, { metodo: "PUT", corpo: { ...corpo, versao: familiar.versao } })
          : await chamarApi("/v1/condominio/familiares", { corpo: { ...corpo, unidadeId } });
        if (r.ok) salvo({ tom: "ok", texto: familiar ? `${nome.trim()} salvo.` : `${nome.trim()} incluído na família.` });
        return r;
      }}>
      <CampoTexto id="f-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={comErro.includes("nome") ? "Escreva o nome (até 120 caracteres)." : null} />
      <CampoSelecao id="f-parentesco" rotulo={responsavel ? `Parentesco com ${responsavel} (responsável)` : "Parentesco"} value={parentesco}
        onChange={(e) => setParentesco(e.target.value as ParentescoFamiliar)}
        ajuda="Cônjuge, filho ou filha, pai ou mãe, outro parente, quem trabalha na casa."
        opcoes={Object.entries(PARENTESCOS_FAMILIAR).map(([valor, texto]) => ({ valor, texto }))} />
      <Interruptor id="f-mora" rotulo="Mora na unidade" ajuda="Conta em quantos moram aqui" marcado={mora} aoMudar={setMora} />
      <CampoAniversario id="f-aniversario" valor={aniversario} aoMudar={setAniversario} erro={comErro.includes("aniversario")} />
      {familiar ? null : (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-linha bg-superficie-2 p-3">
          <Icone nome="info" className="mt-0.5 h-5 w-5 text-info" />
          <span className="grid flex-1 gap-0.5">
            <strong className="t-texto font-semibold">Familiar não tem telefone</strong>
            <span className="t-apoio">Não recebe mensagens e não fala com o condomínio. Se a pessoa vai falar, use Incluir pessoa.</span>
          </span>
          {incluirPessoa ? <Botao variante="contorno" tamanho="m" onClick={incluirPessoa}>Incluir pessoa</Botao> : null}
        </div>
      )}
    </JanelaForm>
  );
}

function FormPet({ pet, unidadeId, nomeUnidade, aoFechar, salvo, recarregar }: {
  pet: Pet | null;
  unidadeId: string;
  nomeUnidade: string;
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  const [nome, setNome] = useState(pet?.nome ?? "");
  const [especie, setEspecie] = useState<Especie>(pet?.especie ?? "CAO");
  const [porte, setPorte] = useState<Porte | "">(pet?.porte ?? "");
  const [raca, setRaca] = useState(pet?.raca ?? "");
  const [observacao, setObservacao] = useState(pet?.observacao ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comErro = camposComErro(erro);
  return (
    <JanelaForm aberto titulo={pet ? `Editar ${pet.nome}` : "Incluir pet"} textoBotao={pet ? "Salvar" : "Incluir pet"}
      explicacao={`${nomeUnidade}. Sem foto por enquanto.`} aoFechar={aoFechar} recarregar={recarregar} erro={erro} setErro={setErro}
      aoSalvar={async () => {
        const corpo = { nome, especie, porte: porte || null, raca, observacao };
        const r = pet
          ? await chamarApi(`/v1/condominio/pets/${pet.id}`, { metodo: "PUT", corpo: { ...corpo, versao: pet.versao } })
          : await chamarApi("/v1/condominio/pets", { corpo: { ...corpo, unidadeId } });
        if (r.ok) salvo({ tom: "ok", texto: pet ? `${nome.trim()} salvo.` : `${nome.trim()} incluído nos pets.` });
        return r;
      }}>
      <CampoTexto id="p-nome" rotulo="Nome" required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={comErro.includes("nome") ? "Escreva o nome (até 60 caracteres)." : null} />
      <div className="grid gap-1">
        <span className="t-apoio font-medium" id="p-especie">Espécie</span>
        <Escolha rotulo="Espécie" atual={especie} aoMudar={setEspecie} opcoes={(Object.keys(ESPECIES) as Especie[]).map((valor) => ({ valor, texto: ESPECIES[valor] }))} />
      </div>
      <div className="grid gap-1">
        <span className="t-apoio font-medium">Porte<span className="font-normal text-tinta-suave"> (opcional)</span></span>
        <Escolha<Porte | ""> rotulo="Porte" atual={porte} aoMudar={(v) => setPorte(v === porte ? "" : v)}
          opcoes={(Object.keys(PORTES) as Porte[]).map((valor) => ({ valor, texto: PORTES[valor] }))} />
      </div>
      <CampoTexto id="p-raca" rotulo="Raça" opcional maxLength={60} value={raca} onChange={(e) => setRaca(e.target.value)}
        erro={comErro.includes("raca") ? "De 2 a 60 caracteres." : null} />
      <CampoAreaTexto id="p-observacao" rotulo="Observação" opcional maxLength={280} value={observacao} onChange={(e) => setObservacao(e.target.value)}
        ajuda="Ajuda a portaria e quem precisar entrar na unidade numa emergência." erro={comErro.includes("observacao") ? "De 2 a 280 caracteres." : null} />
    </JanelaForm>
  );
}

type Retirada = { tipo: "familiar"; item: Familiar } | { tipo: "pet"; item: Pet };

function FormRetirar({ r, aoFechar, salvo, recarregar }: { r: Retirada; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const [motivo, setMotivo] = useState<keyof typeof MOTIVOS_RETIRAR>("SAIU");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const nome = r.item.nome;
  const explica = {
    SAIU: "Fica no histórico da unidade com a data de hoje.",
    ENGANO: `Os dados são apagados. No histórico fica só que ${r.tipo === "pet" ? "um pet foi retirado" : "um familiar foi retirado"}.`,
  };
  return (
    <JanelaForm aberto titulo={`Retirar ${nome} da unidade`} textoBotao={`Retirar ${nome}`} explicacao="Escolha o que aconteceu. Vale igual para quem é da família."
      aoFechar={aoFechar} recarregar={recarregar} erro={erro} setErro={setErro}
      aoSalvar={async () => {
        const res = await chamarApi(`/v1/condominio/${r.tipo === "pet" ? "pets" : "familiares"}/${r.item.id}/retirar`, { corpo: { versao: r.item.versao, motivo } });
        if (res.ok) salvo({ tom: "ok", texto: motivo === "SAIU" ? `${nome} saiu da unidade.` : `${nome} retirado e os dados apagados.` });
        return res;
      }}>
      <fieldset className="grid gap-2">
        <legend className="sr-only">O que aconteceu</legend>
        {(Object.keys(MOTIVOS_RETIRAR) as (keyof typeof MOTIVOS_RETIRAR)[]).map((m) => (
          <label key={m} className="flex items-start gap-2 rounded-xl border border-linha px-3 py-2.5 t-texto has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
            <input type="radio" name="r-motivo" className="mt-1 accent-violeta-600" checked={motivo === m} onChange={() => setMotivo(m)} />
            <span><span className="font-medium">{MOTIVOS_RETIRAR[m]}</span><span className="block t-apoio text-tinta-suave">{explica[m]}</span></span>
          </label>
        ))}
      </fieldset>
    </JanelaForm>
  );
}

type JanelaFP = { tipo: "familiar"; item: Familiar | null } | { tipo: "pet"; item: Pet | null } | { tipo: "retirar"; r: Retirada } | null;

/** Os cartões Família e Pets da ficha da unidade, cada item com o seu menu. */
export function FamiliaPetsDaUnidade({ unidadeId, nomeUnidade, familia, pets, responsavel, edita, salvo, recarregar, incluirPessoa }: {
  unidadeId: string;
  nomeUnidade: string;
  familia: Familiar[];
  pets: Pet[];
  responsavel: string | null;
  edita: boolean;
  salvo: Salvo;
  recarregar: () => void;
  incluirPessoa?: () => void;
}) {
  const [janela, setJanela] = useState<JanelaFP>(null);
  const fechar = () => setJanela(null);
  const pronto = (r: Recado) => { fechar(); salvo(r); };
  const botao = (texto: string, acao: () => void): ReactNode => (edita ? <Botao variante="contorno" tamanho="m" onClick={acao} className="max-md:w-11 max-md:px-0" aria-label={texto}><Icone nome="mais" /><span className="max-md:sr-only">{texto}</span></Botao> : undefined);

  return (
    <>
      <CartaoFicha id="familia" titulo="Família" icone="pessoas" acao={botao("Incluir familiar", () => setJanela({ tipo: "familiar", item: null }))}>
        {familia.length === 0 ? <p className="border-t border-linha pt-3 t-apoio text-tinta-suave">Ninguém da família cadastrado.</p> : (
          <ul aria-label={`Família de ${nomeUnidade}`} className="grid">
            {familia.map((f) => (
              <li key={f.id} className="flex items-center gap-3 border-t border-linha py-3">
                <Iniciais nome={f.nome} className="h-10 w-10 border border-dashed border-contorno !bg-superficie" />
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold">{f.nome}</span>
                  <span className="t-apoio">{parentescoDe(f.parentesco, responsavel)} · {f.mora ? "mora aqui" : "não mora aqui"}</span>
                </span>
                <DiaDoAniversario a={f.aniversario} />
                {edita ? (
                  <MenuAcoes rotulo={`Ações de ${f.nome}`} itens={[
                    { texto: "Editar", icone: "editar", rotulo: `Editar ${f.nome}`, acao: () => setJanela({ tipo: "familiar", item: f }) },
                    { texto: "Retirar…", icone: "sair", perigo: true, rotulo: `Retirar ${f.nome}`, acao: () => setJanela({ tipo: "retirar", r: { tipo: "familiar", item: f } }) },
                  ]} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="t-apoio">Sem telefone e sem acesso. Quem vai falar com o condomínio entra em Pessoas da unidade.</p>
      </CartaoFicha>

      <CartaoFicha id="pets" titulo="Pets" icone="pata" acao={botao("Incluir pet", () => setJanela({ tipo: "pet", item: null }))}>
        {pets.length === 0 ? <p className="border-t border-linha pt-3 t-apoio text-tinta-suave">Nenhum pet cadastrado.</p> : (
          <ul aria-label={`Pets de ${nomeUnidade}`} className="grid">
            {pets.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-t border-linha py-3">
                <span className="ladrilho h-10 w-10" aria-hidden="true"><Icone nome="pata" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold">{p.nome}</span>
                  <span className="t-apoio">{[ESPECIES[p.especie], p.porte ? `porte ${PORTES[p.porte].toLowerCase()}` : null, p.raca?.toLowerCase()].filter(Boolean).join(" · ")}</span>
                  {p.observacao ? <span className="t-apoio text-tinta-suave">{p.observacao}</span> : null}
                </span>
                {edita ? (
                  <MenuAcoes rotulo={`Ações de ${p.nome}`} itens={[
                    { texto: "Editar", icone: "editar", rotulo: `Editar ${p.nome}`, acao: () => setJanela({ tipo: "pet", item: p }) },
                    { texto: "Retirar…", icone: "sair", perigo: true, rotulo: `Retirar ${p.nome}`, acao: () => setJanela({ tipo: "retirar", r: { tipo: "pet", item: p } }) },
                  ]} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="t-apoio">Aparece só para quem vê os moradores, nunca no mural nem no WhatsApp.</p>
      </CartaoFicha>

      {janela?.tipo === "familiar" ? (
        <FormFamiliar familiar={janela.item} unidadeId={unidadeId} nomeUnidade={nomeUnidade} responsavel={responsavel} aoFechar={fechar} salvo={pronto} recarregar={recarregar}
          incluirPessoa={incluirPessoa ? () => { fechar(); incluirPessoa(); } : undefined} />
      ) : null}
      {janela?.tipo === "pet" ? <FormPet pet={janela.item} unidadeId={unidadeId} nomeUnidade={nomeUnidade} aoFechar={fechar} salvo={pronto} recarregar={recarregar} /> : null}
      {janela?.tipo === "retirar" ? <FormRetirar r={janela.r} aoFechar={fechar} salvo={pronto} recarregar={recarregar} /> : null}
    </>
  );
}
