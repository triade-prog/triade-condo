"use client";
// Visão geral da ficha (PI-02, CF-01, PI-06; DC15, telas-modelo console-ficha-visao-* e
// console-ficha-editar; rodada Console, decisão A.1 de 23/10/2026): no lugar dos campos sempre
// abertos e dos três botões de salvar, cartões para ler, com Editar em cada um. As situações a
// tratar vêm no alto, cada uma com o botão que resolve. Condomínio e contatos o síndico vai ver;
// o contrato é interno. Conflito de versão (AT-24) guarda o que foi escrito.

import { useState, type FormEvent } from "react";
import { CENARIOS, mostrarTelefone, SITUACOES, UFS, type Cenario } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Iniciais, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { AcaoCartao, Cartao, Dado } from "../comum.tsx";
import { CartaoIa } from "./CartaoIa.tsx";
import { DESCRICAO_CENARIO, EscolhaCenario } from "../NovoCondominio.tsx";
import type { Contato, Ficha, PropsAba } from "./tipos.ts";

type ContatoForm = { nome: string; papel: string; telefone: string; email: string };
type Janela = "condominio" | "contatos" | "cenario" | "contrato" | null;

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

function Rodape({ aoFechar, enviando, texto = "Salvar" }: { aoFechar: () => void; enviando: boolean; texto?: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 max-md:grid">
      <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
      <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : texto}</Botao>
    </div>
  );
}

/** O que vai para PUT /ficha: a ficha inteira, com a parte que mudou. */
function corpoFicha(f: Ficha, mudou: Partial<{ nome: string; cidade: string; uf: string; endereco: string; numeroWhatsapp: string; contatos: ContatoForm[] }>) {
  const c = f.condominio;
  const contatos = mudou.contatos ?? c.contatos.map(paraForm);
  return {
    versao: c.versao, nome: mudou.nome ?? c.nome, cidade: mudou.cidade ?? c.cidade ?? "", uf: mudou.uf ?? c.uf ?? "",
    endereco: mudou.endereco ?? c.endereco ?? "", numeroWhatsapp: mudou.numeroWhatsapp ?? mostrarTelefone(c.numeroWhatsapp),
    contatos: contatos.map((x) => ({ nome: x.nome, papel: x.papel, telefone: x.telefone || undefined, email: x.email || undefined })),
  };
}

function EditarCondominio({ ficha, recarregar, avisar, aoFechar }: PropsAba & { aoFechar: () => void }) {
  const c = ficha.condominio;
  const [nome, setNome] = useState(c.nome);
  const [cidade, setCidade] = useState(c.cidade ?? "");
  const [uf, setUf] = useState(c.uf ?? "");
  const [endereco, setEndereco] = useState(c.endereco ?? "");
  const [numero, setNumero] = useState(mostrarTelefone(c.numeroWhatsapp));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${c.id}/ficha`, { metodo: "PUT", corpo: corpoFicha(ficha, { nome, cidade, uf, endereco, numeroWhatsapp: numero }) });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Ficha salva." });
    recarregar();
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto media titulo="Editar condomínio" apoio="O síndico vê estes dados no app." aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
        <CampoTexto id="f-nome" rotulo="Nome do condomínio" value={nome} onChange={(e) => setNome(e.target.value)}
          erro={campos.includes("nome") ? "Escreva o nome (2 a 120 caracteres)." : null} />
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <CampoTexto id="f-cidade" rotulo="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} erro={campos.includes("cidade") ? "Escreva a cidade." : null} />
          <CampoSelecao id="f-uf" rotulo="UF" value={uf} onChange={(e) => setUf(e.target.value)}
            opcoes={[{ valor: "", texto: "Escolha" }, ...UFS.map((u) => ({ valor: u, texto: u }))]} erro={campos.includes("uf") ? "Escolha a UF." : null} />
        </div>
        <CampoTexto id="f-endereco" rotulo="Endereço" opcional value={endereco} onChange={(e) => setEndereco(e.target.value)}
          erro={campos.includes("endereco") ? "Endereço entre 3 e 200 caracteres." : null} />
        <CampoTexto id="f-numero" rotulo="Número institucional (WhatsApp)" opcional inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)}
          ajuda="O número próprio do condomínio. Cada número é de um condomínio só."
          erro={campos.includes("numeroWhatsapp") ? "Número inválido ou já usado por outro condomínio." : null} />
        <Rodape aoFechar={aoFechar} enviando={enviando} />
      </form>
    </Dialogo>
  );
}

function EditarContatos({ ficha, recarregar, avisar, aoFechar }: PropsAba & { aoFechar: () => void }) {
  const [contatos, setContatos] = useState<ContatoForm[]>(ficha.condominio.contatos.length ? ficha.condominio.contatos.map(paraForm)
    : [{ nome: "", papel: "", telefone: "", email: "" }]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (i: number, campo: keyof ContatoForm, valor: string) => setContatos((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const preenchidos = contatos.filter((x) => x.nome || x.papel || x.telefone || x.email);
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/ficha`, { metodo: "PUT", corpo: corpoFicha(ficha, { contatos: preenchidos }) });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Contatos salvos." });
    recarregar();
  }

  return (
    <Dialogo aberto media titulo="Editar contatos" apoio="Com quem a TRÍADE fala no condomínio. Cada um com nome, papel e telefone ou e-mail." aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
        {camposComErro(erro).includes("contatos") ? <p className="t-apoio text-erro">Confira os contatos: cada um precisa de nome, papel e telefone ou e-mail.</p> : null}
        {contatos.map((x, i) => (
          <fieldset key={i} className="grid gap-3 rounded-2xl border border-linha p-4 sm:grid-cols-2">
            <legend className="px-1 t-apoio font-medium">Contato {i + 1}</legend>
            <CampoTexto id={`c-${i}-nome`} rotulo="Nome" value={x.nome} onChange={(e) => mudar(i, "nome", e.target.value)} />
            <CampoTexto id={`c-${i}-papel`} rotulo="Papel" placeholder="Síndica, conselho…" value={x.papel} onChange={(e) => mudar(i, "papel", e.target.value)} />
            <CampoTexto id={`c-${i}-telefone`} rotulo="Telefone" inputMode="tel" value={x.telefone} onChange={(e) => mudar(i, "telefone", e.target.value)} />
            <CampoTexto id={`c-${i}-email`} rotulo="E-mail" type="email" value={x.email} onChange={(e) => mudar(i, "email", e.target.value)} />
            <Botao variante="discreto" tamanho="m" className="justify-self-start sm:col-span-2" onClick={() => setContatos((l) => l.filter((_, j) => j !== i))}
              aria-label={`Tirar o contato ${x.nome || i + 1}`}>Tirar</Botao>
          </fieldset>
        ))}
        {contatos.length < 10 ? (
          <Botao variante="contorno" className="justify-self-start" onClick={() => setContatos((l) => [...l, { nome: "", papel: "", telefone: "", email: "" }])}>
            <Icone nome="mais" />Adicionar contato
          </Botao>
        ) : null}
        <Rodape aoFechar={aoFechar} enviando={enviando} texto="Salvar contatos" />
      </form>
    </Dialogo>
  );
}

function TrocarCenario({ ficha, recarregar, avisar, aoFechar }: PropsAba & { aoFechar: () => void }) {
  const [cenario, setCenario] = useState<Cenario | "">((ficha.condominio.cenario as Cenario | null) ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/cenario`, { metodo: "PUT", corpo: { versao: ficha.condominio.versao, cenario } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Cenário salvo. As opções de configuração de cada cenário chegam com as configurações do condomínio." });
    recarregar();
  }

  return (
    <Dialogo aberto media titulo={ficha.condominio.cenario ? "Trocar o cenário do prédio" : "Escolher o cenário do prédio"} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="grid gap-4">
        {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
        <EscolhaCenario valor={cenario} aoMudar={setCenario} nome="cenario-ficha" legenda={false} />
        <div className="flex flex-wrap justify-end gap-2 max-md:grid">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando || !cenario || cenario === ficha.condominio.cenario}><Icone nome="check" />{ficha.condominio.cenario ? "Trocar cenário" : "Escolher cenário"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function EditarContrato({ ficha, recarregar, avisar, aoFechar }: PropsAba & { aoFechar: () => void }) {
  const [referencia, setReferencia] = useState(ficha.cliente.referenciaContrato ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/contrato`, { metodo: "PUT", corpo: { versao: ficha.cliente.versao, referenciaContrato: referencia } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    avisar({ tom: "ok", texto: "Referência do contrato salva." });
    recarregar();
  }

  return (
    <Dialogo aberto titulo="Referência do contrato" apoio="Interno: o cliente não vê." aoFechar={aoFechar}>
      <form onSubmit={salvar} className="grid gap-4">
        {erro ? <ErroOuConflito erro={erro} recarregar={recarregar} /> : null}
        <CampoTexto id="f-contrato" rotulo="Referência do contrato" maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)}
          ajuda="A referência interna do contrato assinado." />
        <Rodape aoFechar={aoFechar} enviando={enviando} texto="Salvar referência" />
      </form>
    </Dialogo>
  );
}

/** Cada situação a tratar: o que é, uma frase e o botão que resolve. */
const SOLUCAO: Record<string, { icone: NomeIcone; frase: string; botao: string; iconeBotao: NomeIcone }> = {
  SEM_SINDICO: { icone: "pessoa", frase: "A implantação só se conclui depois do convite.", botao: "Convidar síndico", iconeBotao: "mais" },
  SEM_CONTRATO: { icone: "documento", frase: "Informe a referência interna do contrato assinado.", botao: "Informar", iconeBotao: "editar" },
  SEM_CENARIO: { icone: "chave", frase: "O cenário monta a configuração inicial do condomínio.", botao: "Escolher", iconeBotao: "editar" },
  SEM_NUMERO_WHATSAPP: { icone: "whats", frase: "O número próprio do condomínio, para os moradores falarem pelo WhatsApp.", botao: "Informar", iconeBotao: "editar" },
  SEM_CONTATO: { icone: "telefone", frase: "Ninguém na ficha para a TRÍADE falar no condomínio.", botao: "Adicionar", iconeBotao: "mais" },
  PENDENCIA_VENCIDA: { icone: "relogio", frase: "Uma pendência da implantação passou do dia de retorno.", botao: "Ver", iconeBotao: "olho" },
  CONJUNTO_A_LIBERAR: { icone: "camadas", frase: "Um conjunto está no contrato e ainda não foi liberado.", botao: "Ver", iconeBotao: "olho" },
  TESTE_TERMINANDO: { icone: "relogio", frase: "Um teste de conjunto termina nos próximos dias.", botao: "Ver", iconeBotao: "olho" },
  PLANO_SEM_VALOR: { icone: "dinheiro", frase: "Sem valor, as cobranças ficam como Valor a definir.", botao: "Ver", iconeBotao: "olho" },
  PAGAMENTO_EM_ATRASO: { icone: "dinheiro", frase: "Só um aviso: o atraso não bloqueia o condomínio.", botao: "Ver", iconeBotao: "olho" },
};

function Situacoes(props: PropsAba & { abrir: (j: Janela) => void }) {
  const { ficha, pode, irPara, abrir } = props;
  const acao: Record<string, (() => void) | null> = {
    SEM_SINDICO: pode("console.sindicos.convidar") ? () => irPara?.("pessoas", "convidar") : null,
    SEM_CONTRATO: pode("console.contrato.editar") ? () => abrir("contrato") : null,
    SEM_CENARIO: pode("console.ficha.editar") ? () => abrir("cenario") : null,
    SEM_NUMERO_WHATSAPP: pode("console.ficha.editar") ? () => abrir("condominio") : null,
    SEM_CONTATO: pode("console.ficha.editar") ? () => abrir("contatos") : null,
    PENDENCIA_VENCIDA: () => irPara?.("implantacao"),
    CONJUNTO_A_LIBERAR: () => irPara?.("plano"),
    TESTE_TERMINANDO: () => irPara?.("plano"),
    PLANO_SEM_VALOR: () => irPara?.("plano"),
    PAGAMENTO_EM_ATRASO: () => irPara?.("plano"),
  };
  if (!ficha.situacoes.length) return null;
  return (
    <ul aria-label="Situações a tratar" className="grid gap-3">
      {ficha.situacoes.map((s) => {
        const x = SOLUCAO[s] ?? { icone: "alerta" as const, frase: "", botao: "", iconeBotao: "dir" as const };
        const fazer = acao[s];
        return (
          <li key={s} className="flex flex-wrap items-center gap-3 rounded-[16px] border border-atencao-borda bg-atencao-fundo px-4 py-3.5 max-md:items-start">
            <Icone nome={x.icone} className="h-5 w-5 shrink-0 text-atencao" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-semibold text-atencao">{SITUACOES[s as keyof typeof SITUACOES] ?? s}</span>
              {x.frase ? <span className="t-texto">{x.frase}</span> : null}
            </span>
            {fazer ? <Botao variante="contorno" tamanho="m" className="bg-superficie max-md:ml-8" onClick={fazer}><Icone nome={x.iconeBotao} />{x.botao}</Botao> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AbaVisao(props: PropsAba) {
  const { ficha, pode } = props;
  const [janela, setJanela] = useState<Janela>(null);
  const c = ficha.condominio;
  const edita = pode("console.ficha.editar");
  const podeContrato = pode("console.contrato.editar");
  const cenario = c.cenario as Cenario | null;
  const fechar = () => setJanela(null);
  const comFechar = { ...props, aoFechar: fechar, recarregar: () => { fechar(); props.recarregar(); } };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
      <div className="grid min-w-0 gap-6">
        <Situacoes {...props} abrir={setJanela} />
        <CartaoIa condominioId={c.id} avisar={(texto) => props.avisar({ tom: "ok", texto })} />
        <Cartao id="t-condominio" titulo="Condomínio" icone="predio"
          acao={edita ? <AcaoCartao icone="editar" rotulo="Editar condomínio" aoClicar={() => setJanela("condominio")}>Editar</AcaoCartao> : undefined}>
          <div>
            <Dado icone="predio" nome="Nome">{c.nome}</Dado>
            <Dado icone="pin" nome="Cidade">{[c.cidade, c.uf].filter(Boolean).join(" · ") || "Ainda não informada"}</Dado>
            <Dado icone="casa" nome="Endereço">{c.endereco ?? <span className="text-tinta-suave">Ainda não informado</span>}</Dado>
            <Dado icone="whats" nome="Número institucional">
              {c.numeroWhatsapp ? <span className="t-codigo">{mostrarTelefone(c.numeroWhatsapp)}</span> : <span className="text-tinta-suave">Ainda não informado</span>}
            </Dado>
          </div>
        </Cartao>
        <Cartao id="t-contatos" titulo="Contatos" icone="telefone"
          acao={edita ? <AcaoCartao icone="editar" rotulo="Editar contatos" aoClicar={() => setJanela("contatos")}>Editar</AcaoCartao> : undefined}>
          {c.contatos.length ? (
            <ul className="divide-y divide-linha">
              {c.contatos.map((x, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Iniciais nome={x.nome} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium">{x.nome}</span>
                    <span className="t-apoio">{x.papel}</span>
                    {x.telefone ? <span className="t-codigo">{mostrarTelefone(x.telefone)}</span> : null}
                    {x.email ? <span className="t-texto [overflow-wrap:anywhere]">{x.email}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="t-apoio">Nenhum contato ainda.</p>}
        </Cartao>
      </div>
      <div className="grid min-w-0 gap-6">
        <Cartao id="t-cenario" titulo="Cenário do prédio" icone="chave"
          acao={edita ? <AcaoCartao icone="trocar" rotulo={cenario ? "Trocar o cenário" : "Escolher o cenário"} aoClicar={() => setJanela("cenario")}>{cenario ? "Trocar" : "Escolher"}</AcaoCartao> : undefined}>
          {cenario ? (
            <div className="grid gap-1">
              <p className="font-medium">{CENARIOS[cenario]}</p>
              <p className="t-apoio">{DESCRICAO_CENARIO[cenario].join(" ")}</p>
            </div>
          ) : <p className="t-apoio">Ainda não escolhido. Dá para escolher agora ou depois; trocar não apaga nada.</p>}
        </Cartao>
        <Cartao id="t-contrato" titulo="Contrato" icone="documento"
          acao={podeContrato ? <AcaoCartao icone="editar" rotulo="Editar a referência do contrato" aoClicar={() => setJanela("contrato")}>Editar</AcaoCartao> : undefined}>
          <span className="selo justify-self-start" data-tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Interno · o cliente não vê</span>
          <div>
            <Dado icone="documento" nome="Referência do contrato">
              {ficha.cliente.referenciaContrato ?? <span className="text-tinta-suave">Ainda não informada</span>}
            </Dado>
          </div>
          {podeContrato ? null : <p className="t-apoio">Só a administração muda.</p>}
        </Cartao>
        {ficha.exportacoes?.length ? (
          <Cartao id="t-exportacoes" titulo="Exportações pedidas pelo síndico" icone="baixar">
            <ul className="grid gap-1 t-texto">
              {ficha.exportacoes.map((e) => (
                <li key={e.id}>
                  {new Date(e.pedidaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                  {e.autor ? ` · ${e.autor}` : ""} · {e.situacao === "PRONTA" ? "pronta" : e.situacao === "FALHOU" ? "não deu certo" : "montando"}
                </li>
              ))}
            </ul>
            <p className="t-apoio">Exportar não tira o condomínio da plataforma. Vale conversar com o síndico.</p>
          </Cartao>
        ) : null}
      </div>

      {janela === "condominio" ? <EditarCondominio {...comFechar} /> : null}
      {janela === "contatos" ? <EditarContatos {...comFechar} /> : null}
      {janela === "cenario" ? <TrocarCenario {...comFechar} /> : null}
      {janela === "contrato" ? <EditarContrato {...comFechar} /> : null}
    </div>
  );
}
