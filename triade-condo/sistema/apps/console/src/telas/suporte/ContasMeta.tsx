"use client";
// Contas recebidas da Meta (F5.12; W-01, W-17; quadros 463 e 464): a conta do WhatsApp chega
// quando um síndico termina o cadastro hospedado pelo link da TRÍADE (aviso PARTNER_ADDED). O link
// não diz de qual condomínio é; uma pessoa da equipe confere e liga ao cliente certo. Nada é
// ligado sozinho. O cliente provável é quem tocou em Já terminei na Plataforma perto da hora em
// que a conta chegou. Só quem pode conectar o WhatsApp vê o botão.

import Link from "next/link";
import { useState } from "react";
import { formatarDataHora } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Cartao } from "../comum.tsx";
import { useCarregar, type Carga } from "../sessao.tsx";

export interface ContaEsperando { wabaId: string; empresaId?: string; nomeEmpresa?: string; recebidaEm: string }
interface ContaLigada { wabaId: string; condominioId: string; nome: string; ligadaEm: string; ligadaPor?: string }
interface Terminou { condominioId: string; nome: string; em: string }
export interface ContasMetaDados { esperando: ContaEsperando[]; ligadas: ContaLigada[]; terminaram: Terminou[]; pode: { ligar: boolean } }
interface Cliente { condominioId: string; nome: string; situacao: string; oficial?: boolean }

/** Seis horas entre o Já terminei e a chegada da conta ainda contam como o mesmo cadastro. */
const JANELA_PROVAVEL_MS = 6 * 60 * 60 * 1000;

/** O cliente que tocou em Já terminei mais perto da hora em que a conta chegou. */
export function clienteProvavel(conta: ContaEsperando, terminaram: Terminou[]): Terminou | null {
  const chegou = Date.parse(conta.recebidaEm);
  let melhor: Terminou | null = null;
  for (const t of terminaram) {
    const dist = Math.abs(Date.parse(t.em) - chegou);
    if (dist <= JANELA_PROVAVEL_MS && (!melhor || dist < Math.abs(Date.parse(melhor.em) - chegou))) melhor = t;
  }
  return melhor;
}

const PASSOS: [string, string][] = [
  ["Entrar na conta do condomínio", "A Meta põe o usuário do sistema da TRÍADE na conta, com a permissão de gerenciar."],
  ["Assinar os avisos da conta", "Para receber as mensagens e as respostas da Meta no nosso endereço."],
  ["Registrar o número", "Com um PIN de 6 dígitos criado pelo sistema e guardado cifrado."],
  ["Mandar os modelos de mensagem para a Meta aprovar", "Em nome do condomínio. A aprovação leva de minutos a 1 dia."],
];

function JanelaLigar({ conta, provavel, clientes, aoFechar, aoLigar }: {
  conta: ContaEsperando; provavel: Terminou | null; clientes: Cliente[]; aoFechar: () => void; aoLigar: (nome: string, modelos: number) => void;
}) {
  const [cliente, setCliente] = useState(provavel?.condominioId ?? "");
  const [numeroId, setNumeroId] = useState("");
  const [pedirNumero, setPedirNumero] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [ligando, setLigando] = useState(false);
  const escolhido = clientes.find((c) => c.condominioId === cliente);

  async function ligar() {
    setErro(null);
    setLigando(true);
    const r = await chamarApi<{ modelosEnviados: number }>(`/v1/clientes/${cliente}/whatsapp/meta/ligar`, {
      corpo: { wabaId: conta.wabaId, numeroId: numeroId.trim() || null },
    });
    setLigando(false);
    if (!r.ok) {
      if (camposComErro(r.erro).includes("numeroId")) setPedirNumero(true);
      return setErro(r.erro);
    }
    aoLigar(escolhido?.nome ?? "o cliente", r.dados.modelosEnviados);
  }

  return (
    <Dialogo aberto media titulo="Ligar a conta ao cliente" aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={pedirNumero && camposComErro(erro).includes("numeroId") ? "A conta tem mais de um número. Diga qual ligar." : textoDoErro(erro)} /> : null}
        <CampoSelecao id="meta-cliente" rotulo="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}
          ajuda={provavel && provavel.condominioId === cliente ? `O síndico tocou em Já terminei em ${formatarDataHora(provavel.em)}.` : "Confira a empresa na Meta antes de ligar."}
          opcoes={[{ valor: "", texto: "Escolha o cliente" }, ...clientes.map((c) => ({ valor: c.condominioId, texto: c.nome }))]} />
        <dl className="grid gap-3 rounded-2xl bg-violeta-50 p-4 t-texto sm:grid-cols-2">
          <div><dt className="t-apoio text-tinta-suave">Empresa na Meta</dt><dd className="font-medium">{conta.nomeEmpresa ?? "Sem nome informado"}</dd></div>
          <div><dt className="t-apoio text-tinta-suave">Chegou em</dt><dd>{formatarDataHora(conta.recebidaEm)}</dd></div>
          <div><dt className="t-apoio text-tinta-suave">Conta do WhatsApp (WABA)</dt><dd className="t-codigo">{conta.wabaId}</dd></div>
          {conta.empresaId ? <div><dt className="t-apoio text-tinta-suave">Empresa (id)</dt><dd className="t-codigo">{conta.empresaId}</dd></div> : null}
        </dl>
        {pedirNumero ? (
          <CampoTexto id="meta-numero" rotulo="Id do número na Meta" inputMode="numeric" maxLength={30} value={numeroId} onChange={(e) => setNumeroId(e.target.value)}
            ajuda="No Gerenciador do WhatsApp da conta, em Números de telefone: o id do número do condomínio." />
        ) : null}
        <h3 className="t-apoio font-semibold uppercase tracking-[0.08em] text-tinta-suave">Ao ligar, o sistema faz</h3>
        <ol className="grid gap-3">
          {PASSOS.map(([titulo, texto], i) => (
            <li key={titulo} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-violeta-50 t-apoio font-semibold text-violeta-700">{i + 1}</span>
              <span className="grid gap-0.5"><span className="t-texto font-medium">{titulo}</span><span className="t-apoio text-tinta-suave">{texto}</span></span>
            </li>
          ))}
        </ol>
        <Aviso tom="info" titulo="Um número por cliente">
          Se o cliente ainda tem o número de teste conectado, desconecte na ficha antes de ligar o oficial. A troca para os moradores vem com o comunicado e o consentimento (entrega C).
        </Aviso>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao disabled={!cliente || ligando} onClick={() => void ligar()}><Icone nome="link" />{ligando ? "Ligando…" : "Ligar e registrar o número"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

/** A vista "Contas recebidas da Meta" do trilho do WhatsApp (quadro 463). */
export function ContasMeta({ carga }: { carga: Carga<ContasMetaDados> & { recarregar: () => void } }) {
  const clientes = useCarregar<{ numeros: Cliente[] }>("/v1/whatsapp");
  const [ligar, setLigar] = useState<ContaEsperando | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as contas da Meta…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const lista = clientes.estado === "pronto" ? [...clientes.dados.numeros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : [];
  return (
    <div className="grid gap-4">
      {feito ? <Aviso tom="ok" papel="status">{feito}</Aviso> : null}
      <Cartao id="t-contas-meta" titulo="Esperando ligar a um cliente" icone="link">
        <p className="t-apoio">
          Cada conta chega quando alguém termina o cadastro pelo nosso link na Meta. O link não diz de qual condomínio é: confira a empresa e o número e ligue ao cliente certo.
        </p>
        {d.esperando.length === 0 ? <Vazio titulo="Nenhuma conta esperando" icone="whats">Quando um síndico terminar o cadastro na Meta, a conta aparece aqui.</Vazio> : (
          <ul className="divide-y divide-linha">
            {d.esperando.map((c) => {
              const p = clienteProvavel(c, d.terminaram);
              return (
                <li key={c.wabaId} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-0">
                  <span className="ladrilho" data-tom="atencao" aria-hidden="true"><Icone nome="link" /></span>
                  <span className="grid min-w-[220px] flex-1 gap-0.5">
                    <span className="font-semibold">{c.nomeEmpresa ?? "Empresa sem nome"}</span>
                    <span className="t-apoio text-tinta-suave">Conta <span className="t-codigo">{c.wabaId}</span> · chegou {formatarDataHora(c.recebidaEm)}</span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {p ? <Selo tom="info">Provável: {p.nome}</Selo> : <Selo tom="atencao">Sem cliente provável</Selo>}
                    {p ? <Selo tom="neutro">Já terminei em {formatarDataHora(p.em)}</Selo> : null}
                  </span>
                  {d.pode.ligar ? <Botao tamanho="m" variante={p ? "primario" : "contorno"} onClick={() => setLigar(c)}>Ligar ao cliente</Botao> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
      {d.terminaram.length ? (
        <Cartao id="t-terminaram" titulo="Disseram Já terminei nos últimos 7 dias" icone="relogio">
          <ul className="divide-y divide-linha t-texto">
            {d.terminaram.map((t) => (
              <li key={t.condominioId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 font-medium">{t.nome}</span><span className="t-apoio text-tinta-suave">{formatarDataHora(t.em)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
      <Cartao id="t-contas-ligadas" titulo="Ligadas nos últimos 30 dias" icone="whats">
        {d.ligadas.length === 0 ? <p className="t-apoio text-tinta-suave">Nenhuma ainda.</p> : (
          <ul className="divide-y divide-linha">
            {d.ligadas.map((c) => (
              <li key={c.wabaId} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="ladrilho" data-tom="ok" aria-hidden="true"><Icone nome="whats" /></span>
                <span className="grid min-w-[220px] flex-1 gap-0.5">
                  <span className="font-semibold">{c.nome}</span>
                  <span className="t-apoio text-tinta-suave">Ligada{c.ligadaPor ? ` por ${c.ligadaPor}` : ""} em {formatarDataHora(c.ligadaEm)}</span>
                </span>
                <Selo tom="ok">Ligado</Selo>
                <Link href={`/clientes/${c.condominioId}?aba=whatsapp`} className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
                  Abrir a ficha<Icone nome="dir" className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {ligar ? (
        <JanelaLigar conta={ligar} provavel={clienteProvavel(ligar, d.terminaram)} clientes={lista} aoFechar={() => setLigar(null)}
          aoLigar={(nome, modelos) => {
            setLigar(null);
            setFeito(`Conta ligada a ${nome}. Número registrado${modelos ? ` e ${modelos} modelos enviados para a Meta aprovar` : "; os modelos não foram enviados, mande de novo pela ficha"}.`);
            carga.recarregar();
          }} />
      ) : null}
    </div>
  );
}
