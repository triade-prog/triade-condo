"use client";
// Aba Ficha (PI-02, CF-01): dados do condomínio (o síndico vai vê-los) e, ao lado, a área
// interna com a referência do contrato e as situações a tratar (PI-06).

import { useState, type FormEvent } from "react";
import { mostrarTelefone, UFS, type Cenario } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, FaixaInterna, textoDoErro, type ErroApi } from "@triade/ui";
import { EscolhaCenario } from "../NovoCondominio.tsx";
import { SeloSituacao } from "../rotulos.tsx";
import type { Contato, PropsAba } from "./tipos.ts";

type ContatoForm = { nome: string; papel: string; telefone: string; email: string };

function paraForm(c: Contato): ContatoForm {
  return { nome: c.nome, papel: c.papel, telefone: c.telefone ? mostrarTelefone(c.telefone) : "", email: c.email ?? "" };
}

/** Conflito de versão (AT-24): o que a pessoa escreveu fica; ela decide quando carregar a nova. */
function ErroOuConflito({ erro, recarregar }: { erro: ErroApi; recarregar: () => void }) {
  return (
    <Aviso tom="erro">
      {textoDoErro(erro)}
      {erro.codigo === "VERSION_CONFLICT" ? (
        <span className="mt-2 block">
          <Botao variante="contorno" onClick={recarregar}>Carregar a versão nova</Botao>
        </span>
      ) : null}
    </Aviso>
  );
}

function FormFicha({ ficha, pode, recarregar, avisar }: PropsAba) {
  const c = ficha.condominio;
  const [nome, setNome] = useState(c.nome);
  const [cidade, setCidade] = useState(c.cidade ?? "");
  const [uf, setUf] = useState(c.uf ?? "");
  const [endereco, setEndereco] = useState(c.endereco ?? "");
  const [numero, setNumero] = useState(mostrarTelefone(c.numeroWhatsapp));
  const [contatos, setContatos] = useState<ContatoForm[]>(c.contatos.map(paraForm));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const editavel = pode("console.ficha.editar");

  function mudarContato(i: number, campo: keyof ContatoForm, valor: string) {
    setContatos((lista) => lista.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${c.id}/ficha`, {
      metodo: "PUT",
      corpo: {
        versao: c.versao, nome, cidade, uf, endereco, numeroWhatsapp: numero,
        contatos: contatos.map((x) => ({ nome: x.nome, papel: x.papel, telefone: x.telefone || undefined, email: x.email || undefined })),
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Ficha salva." });
    recarregar();
  }

  const campos = camposComErro(erro);
  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
      <fieldset disabled={!editavel} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Dados do condomínio</legend>
        <CampoTexto id="f-nome" rotulo="Nome do condomínio" className="sm:col-span-2" value={nome} onChange={(e) => setNome(e.target.value)}
          erro={campos.includes("nome") ? "Escreva o nome (2 a 120 caracteres)." : null} />
        <CampoTexto id="f-cidade" rotulo="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)}
          erro={campos.includes("cidade") ? "Escreva a cidade." : null} />
        <CampoSelecao id="f-uf" rotulo="UF" value={uf} onChange={(e) => setUf(e.target.value)}
          opcoes={[{ valor: "", texto: "Escolha" }, ...UFS.map((u) => ({ valor: u, texto: u }))]} erro={campos.includes("uf") ? "Escolha a UF." : null} />
        <CampoTexto id="f-endereco" rotulo="Endereço" opcional className="sm:col-span-2" value={endereco} onChange={(e) => setEndereco(e.target.value)}
          erro={campos.includes("endereco") ? "Endereço entre 3 e 200 caracteres." : null} />
        <CampoTexto id="f-numero" rotulo="Número institucional (WhatsApp)" opcional inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)}
          ajuda="O número próprio do condomínio. Cada número é de um condomínio só."
          erro={campos.includes("numeroWhatsapp") ? "Número inválido ou já usado por outro condomínio." : null} />

        <div className="grid gap-2 sm:col-span-2">
          <p className="text-[13px] font-medium">Contatos</p>
          {campos.includes("contatos") ? <p className="text-xs text-erro">Confira os contatos: cada um precisa de nome, papel e telefone ou e-mail.</p> : null}
          {contatos.length === 0 ? <p className="text-sm text-tinta-suave">Nenhum contato ainda.</p> : null}
          {contatos.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-linha p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
              <CampoTexto id={`c-${i}-nome`} rotulo="Nome" value={x.nome} onChange={(e) => mudarContato(i, "nome", e.target.value)} />
              <CampoTexto id={`c-${i}-papel`} rotulo="Papel" placeholder="Síndica, conselho…" value={x.papel} onChange={(e) => mudarContato(i, "papel", e.target.value)} />
              <CampoTexto id={`c-${i}-telefone`} rotulo="Telefone" inputMode="tel" value={x.telefone} onChange={(e) => mudarContato(i, "telefone", e.target.value)} />
              <CampoTexto id={`c-${i}-email`} rotulo="E-mail" type="email" value={x.email} onChange={(e) => mudarContato(i, "email", e.target.value)} />
              {editavel ? (
                <Botao variante="discreto" onClick={() => setContatos((l) => l.filter((_, j) => j !== i))} aria-label={`Tirar o contato ${x.nome || i + 1}`}>Tirar</Botao>
              ) : null}
            </div>
          ))}
          {editavel && contatos.length < 10 ? (
            <Botao variante="contorno" className="justify-self-start" onClick={() => setContatos((l) => [...l, { nome: "", papel: "", telefone: "", email: "" }])}>
              + Adicionar contato
            </Botao>
          ) : null}
        </div>
      </fieldset>
      {editavel ? <Botao type="submit" className="justify-self-start" disabled={enviando}>{enviando ? "Salvando…" : "Salvar ficha"}</Botao> : null}
    </form>
  );
}

function FormCenario({ ficha, pode, recarregar, avisar }: PropsAba) {
  const [cenario, setCenario] = useState<Cenario | "">((ficha.condominio.cenario as Cenario | null) ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const mudou = cenario !== (ficha.condominio.cenario ?? "");

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/cenario`, { metodo: "PUT", corpo: { versao: ficha.condominio.versao, cenario } });
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Cenário salvo. As opções de configuração de cada cenário chegam com as configurações do condomínio." });
    recarregar();
  }

  if (!pode("console.ficha.editar")) return null;
  return (
    <form onSubmit={salvar} className="grid gap-3 border-t border-linha pt-5">
      {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
      <EscolhaCenario valor={cenario} aoMudar={setCenario} nome="cenario-ficha" />
      <Botao type="submit" variante="contorno" className="justify-self-start" disabled={!mudou || !cenario}>
        {ficha.condominio.cenario ? "Trocar cenário" : "Escolher cenário"}
      </Botao>
    </form>
  );
}

function AreaInterna({ ficha, pode, recarregar, avisar }: PropsAba) {
  const [referencia, setReferencia] = useState(ficha.cliente.referenciaContrato ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const podeContrato = pode("console.contrato.editar");

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/contrato`, {
      metodo: "PUT", corpo: { versao: ficha.cliente.versao, referenciaContrato: referencia },
    });
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Referência do contrato salva." });
    recarregar();
  }

  return (
    <aside aria-label="Área interna" className="grid content-start gap-4">
      <FaixaInterna>Interno · o cliente não vê</FaixaInterna>
      <form onSubmit={salvar} className="grid gap-2">
        {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
        <CampoTexto id="f-contrato" rotulo="Referência do contrato" maxLength={120} disabled={!podeContrato} value={referencia}
          onChange={(e) => setReferencia(e.target.value)} ajuda={podeContrato ? undefined : "Só a administração muda."} />
        {podeContrato ? (
          <Botao type="submit" variante="contorno" className="justify-self-start" disabled={referencia === (ficha.cliente.referenciaContrato ?? "")}>
            Salvar referência
          </Botao>
        ) : null}
      </form>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Situações a tratar</h3>
        {ficha.situacoes.length ? (
          <ul className="flex flex-wrap gap-1">{ficha.situacoes.map((s) => <li key={s}><SeloSituacao situacao={s} /></li>)}</ul>
        ) : <p className="text-sm text-tinta-suave">Nada a tratar.</p>}
      </div>
    </aside>
  );
}

export function AbaFicha(props: PropsAba) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <div className="grid content-start gap-6">
        <FormFicha {...props} />
        <FormCenario {...props} />
      </div>
      <AreaInterna {...props} />
    </div>
  );
}
