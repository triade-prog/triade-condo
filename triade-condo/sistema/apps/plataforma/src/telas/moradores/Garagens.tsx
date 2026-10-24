"use client";
// Garagens e veículos (F3.8; MU-06, MU-11): a parte da ficha da unidade com as vagas dela e
// os veículos de quem mora ou responde por ela, e a aba Garagens com todas as vagas do
// condomínio. A placa aparece só aqui, para quem vê os moradores: nunca no mural, no WhatsApp
// nem no histórico. Nada se apaga: a vaga sai de uso e o veículo é retirado.

import Link from "next/link";
import { useState } from "react";
import { TIPOS_VEICULO, type TipoVeiculo } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, Vazio, type NomeIcone } from "@triade/ui";
import { Janela, type Campo } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ContatoDaUnidade, Garagens, Recado, Vaga, Veiculo } from "../tipos.ts";
import { CartaoFicha, MenuAcoes } from "./comum.tsx";

type Salvo = (r: Recado) => void;

/** "Subsolo 1 · coberta". */
export function ondeFica(v: Pick<Vaga, "onde" | "coberta">): string {
  return [v.onde, v.coberta === true ? "coberta" : v.coberta === false ? "descoberta" : null].filter(Boolean).join(" · ");
}

/** "QMF2A41 · Onix prata", ou "Livre". */
function veiculoNaVaga(v: Vaga): string {
  return v.veiculos.length ? v.veiculos.map((x) => [x.placa, x.modelo].filter(Boolean).join(" · ")).join("; ") : "Livre";
}

const CAMPOS_VAGA = (unidades: { valor: string; texto: string }[] | null): Campo[] => [
  { id: "identificacao", rotulo: "Identificação", tipo: "texto", obrigatorio: true, max: 20, ajuda: "Como a vaga é chamada no prédio, como G-23.",
    erro: "Escreva a identificação (até 20 caracteres), sem repetir a de outra vaga em uso." },
  { id: "onde", rotulo: "Onde fica", tipo: "texto", max: 60, ajuda: "Opcional. Como Subsolo 1 ou Térreo.", erro: "De 2 a 60 caracteres." },
  { id: "coberta", rotulo: "Vaga coberta", tipo: "caixa" },
  ...(unidades ? [{ id: "unidadeId", rotulo: "De quem é", tipo: "selecao" as const, opcoes: [{ valor: "", texto: "Do condomínio" }, ...unidades],
    ajuda: "Vaga do condomínio é para visitantes, carga e descarga ou vaga rotativa.", erro: "Escolha uma unidade ativa." }] : []),
];

/** Incluir ou editar vaga. Na ficha da unidade, a vaga é dela; na aba Garagens, escolhe-se de quem é. */
export function JanelaVaga({ aberto, vaga, unidadeFixa, unidades, aoFechar, salvo, recarregar }: {
  aberto: boolean;
  vaga: Vaga | null;
  unidadeFixa?: string;
  unidades?: { id: string; nome: string }[];
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  const campos = CAMPOS_VAGA(unidadeFixa ? null : (unidades ?? []).map((u) => ({ valor: u.id, texto: u.nome })));
  return (
    <Janela aberto={aberto} titulo={vaga ? `Editar vaga ${vaga.identificacao}` : "Incluir vaga"} campos={campos}
      iniciais={{ identificacao: vaga?.identificacao ?? "", onde: vaga?.onde ?? "", coberta: vaga?.coberta === true, unidadeId: vaga?.unidadeId ?? unidadeFixa ?? "" }}
      textoBotao={vaga ? "Salvar vaga" : "Incluir vaga"} aoFechar={aoFechar} recarregar={recarregar}
      aoSalvar={async (v) => {
        const corpo = { identificacao: String(v.identificacao), onde: String(v.onde), coberta: v.coberta === true, unidadeId: unidadeFixa ?? (v.unidadeId ? String(v.unidadeId) : null) };
        const r = vaga
          ? await chamarApi(`/v1/condominio/vagas/${vaga.id}`, { metodo: "PUT", corpo: { ...corpo, versao: vaga.versao } })
          : await chamarApi("/v1/condominio/vagas", { corpo });
        if (r.ok) salvo({ tom: "ok", texto: vaga ? `Vaga ${corpo.identificacao.trim()} salva.` : `Vaga ${corpo.identificacao.trim()} incluída.` });
        return r;
      }} />
  );
}

/** Tirar a vaga de uso, ou trazer de volta. Vaga com veículo não sai de uso. */
export function JanelaUsoVaga({ vaga, aoFechar, salvo, recarregar }: { vaga: Vaga | null; aoFechar: () => void; salvo: Salvo; recarregar: () => void }) {
  const sair = vaga?.ativa ?? true;
  return (
    <Janela aberto={vaga !== null} titulo={vaga ? `${sair ? "Tirar de uso" : "Voltar ao uso"} a vaga ${vaga.identificacao}` : "Vaga"} campos={[]} iniciais={{}}
      textoBotao={sair ? "Tirar de uso" : "Voltar ao uso"} aoFechar={aoFechar} recarregar={recarregar}
      explicacao={sair ? "Só sai de uso sem veículo nela. Nada é apagado; dá para voltar ao uso depois." : "A vaga volta para a lista em uso."}
      aoSalvar={async () => {
        const v = vaga!;
        const r = await chamarApi(`/v1/condominio/vagas/${v.id}`, { metodo: "PUT", corpo: {
          versao: v.versao, identificacao: v.identificacao, onde: v.onde ?? null, coberta: v.coberta ?? null, unidadeId: v.unidadeId ?? null, ativa: !sair,
        } });
        if (r.ok) salvo({ tom: "ok", texto: sair ? `Vaga ${v.identificacao} fora de uso.` : `Vaga ${v.identificacao} de volta ao uso.` });
        return r;
      }} />
  );
}

/** Incluir ou editar veículo na unidade: placa, tipo, modelo e cor, de quem e a vaga. */
export function JanelaVeiculo({ aberto, veiculo, unidadeId, nomeUnidade, contatos, vagas, aoFechar, salvo, recarregar }: {
  aberto: boolean;
  veiculo: Veiculo | null;
  unidadeId: string;
  nomeUnidade: string;
  contatos: ContatoDaUnidade[];
  vagas: Vaga[];
  aoFechar: () => void;
  salvo: Salvo;
  recarregar: () => void;
}) {
  const campos: Campo[] = [
    { id: "placa", rotulo: "Placa", tipo: "texto", obrigatorio: true, max: 10, ajuda: "Mercosul (ABC1D23) ou antiga (ABC-1234).",
      erro: "Placa Mercosul (ABC1D23) ou antiga (ABC-1234), sem repetir a de outra unidade." },
    { id: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: Object.entries(TIPOS_VEICULO).map(([valor, texto]) => ({ valor, texto })) },
    { id: "modelo", rotulo: "Modelo e cor", tipo: "texto", max: 60, ajuda: "Opcional. Como Onix prata.", erro: "De 2 a 60 caracteres." },
    { id: "contatoId", rotulo: "De quem", tipo: "selecao", ajuda: "Opcional. Só pessoas da unidade.", erro: "Escolha uma pessoa desta unidade.",
      opcoes: [{ valor: "", texto: "Da unidade" }, ...contatos.map((c) => ({ valor: c.contatoId, texto: c.nome }))] },
    { id: "vagaId", rotulo: "Vaga", tipo: "selecao", ajuda: "Opcional. Só vagas desta unidade.", erro: "Escolha uma vaga desta unidade.",
      opcoes: [{ valor: "", texto: "Sem vaga" }, ...vagas.map((v) => ({ valor: v.id, texto: [v.identificacao, v.onde].filter(Boolean).join(" · ") }))] },
  ];
  return (
    <Janela aberto={aberto} titulo={veiculo ? `Editar veículo ${veiculo.placa}` : `Incluir veículo · ${nomeUnidade}`} campos={campos}
      iniciais={{ placa: veiculo?.placa ?? "", tipo: veiculo?.tipo ?? "CARRO", modelo: veiculo?.modelo ?? "", contatoId: veiculo?.contatoId ?? "", vagaId: veiculo?.vagaId ?? "" }}
      textoBotao={veiculo ? "Salvar veículo" : "Incluir veículo"} aoFechar={aoFechar} recarregar={recarregar}
      aoSalvar={async (v) => {
        const corpo = {
          unidadeId, placa: String(v.placa), tipo: String(v.tipo) as TipoVeiculo, modelo: String(v.modelo),
          contatoId: v.contatoId ? String(v.contatoId) : null, vagaId: v.vagaId ? String(v.vagaId) : null,
        };
        const r = veiculo
          ? await chamarApi(`/v1/condominio/veiculos/${veiculo.id}`, { metodo: "PUT", corpo: { ...corpo, versao: veiculo.versao } })
          : await chamarApi("/v1/condominio/veiculos", { corpo });
        if (r.ok) salvo({ tom: "ok", texto: veiculo ? "Veículo salvo." : "Veículo incluído." });
        return r;
      }} />
  );
}

/** A parte Garagens e veículos da ficha da unidade: as vagas e os veículos, cada um com o seu menu. */
export function GaragensDaUnidade({ unidadeId, nomeUnidade, vagas, veiculos, contatos, edita, salvo, recarregar }: {
  unidadeId: string;
  nomeUnidade: string;
  vagas: Vaga[];
  veiculos: Veiculo[];
  contatos: ContatoDaUnidade[];
  edita: boolean;
  salvo: Salvo;
  recarregar: () => void;
}) {
  const [janela, setJanela] = useState<
    { tipo: "vaga"; vaga: Vaga | null } | { tipo: "veiculo"; veiculo: Veiculo | null } | { tipo: "retirar"; veiculo: Veiculo } | { tipo: "uso"; vaga: Vaga } | null
  >(null);
  const fechar = () => setJanela(null);
  const pronto = (r: Recado) => { fechar(); salvo(r); };
  const incluir = edita ? (
    <MenuAcoes rotulo="Incluir vaga ou veículo" texto="Incluir" icone="mais" itens={[
      { texto: "Vaga", icone: "pin", acao: () => setJanela({ tipo: "vaga", vaga: null }) },
      { texto: "Veículo", icone: "chave", acao: () => setJanela({ tipo: "veiculo", veiculo: null }) },
    ]} />
  ) : undefined;

  return (
    <CartaoFicha id="garagens" titulo="Garagens e veículos" icone="pin" acao={incluir}>
      {vagas.length === 0 && veiculos.length === 0 ? <p className="border-t border-linha pt-3 t-apoio text-tinta-suave">Nenhuma vaga nem veículo nesta unidade.</p> : null}
      {vagas.length ? (
        <ul aria-label={`Vagas de ${nomeUnidade}`} className="grid">
          {vagas.map((v) => (
            <li key={v.id} className="flex items-center gap-3 border-t border-linha py-3">
              <span className="ladrilho t-codigo h-10 w-10" aria-hidden="true">{v.identificacao.slice(0, 1)}</span>
              <span className="grid min-w-0 flex-1">
                <span className="font-medium">Vaga <span className="t-codigo">{v.identificacao}</span></span>
                <span className="t-apoio">{[ondeFica(v) || "Não informado", veiculoNaVaga(v)].join(" · ")}</span>
              </span>
              {edita ? (
                <MenuAcoes rotulo={`Ações da vaga ${v.identificacao}`} itens={[
                  { texto: "Editar", icone: "editar", rotulo: `Editar a vaga ${v.identificacao}`, acao: () => setJanela({ tipo: "vaga", vaga: v }) },
                  ...(v.veiculos.length ? [] : [{ texto: "Tirar de uso…", icone: "sair" as const, perigo: true, rotulo: `Tirar de uso a vaga ${v.identificacao}`, acao: () => setJanela({ tipo: "uso", vaga: v }) }]),
                ]} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {veiculos.length ? (
        <ul aria-label={`Veículos de ${nomeUnidade}`} className="grid">
          {veiculos.map((x) => (
            <li key={x.id} className="flex items-center gap-3 border-t border-linha py-3">
              <span className="ladrilho h-10 w-10" aria-hidden="true"><Icone nome="chave" /></span>
              <span className="grid min-w-0 flex-1">
                <span className="t-codigo">{x.placa}</span>
                <span className="t-apoio">{[[TIPOS_VEICULO[x.tipo], x.modelo].filter(Boolean).join(" · "), x.contato ?? "Da unidade", x.vaga ? `vaga ${x.vaga}` : "sem vaga"].join(" · ")}</span>
              </span>
              {edita ? (
                <MenuAcoes rotulo={`Ações do veículo ${x.placa}`} itens={[
                  { texto: "Editar", icone: "editar", rotulo: `Editar o veículo ${x.placa}`, acao: () => setJanela({ tipo: "veiculo", veiculo: x }) },
                  { texto: "Retirar…", icone: "sair", perigo: true, rotulo: `Retirar o veículo ${x.placa}`, acao: () => setJanela({ tipo: "retirar", veiculo: x }) },
                ]} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="t-apoio">A placa aparece só para quem vê os moradores, nunca no mural, no WhatsApp ou no histórico.</p>

      <JanelaVaga aberto={janela?.tipo === "vaga"} vaga={janela?.tipo === "vaga" ? janela.vaga : null} unidadeFixa={unidadeId}
        aoFechar={fechar} salvo={pronto} recarregar={recarregar} />
      <JanelaUsoVaga vaga={janela?.tipo === "uso" ? janela.vaga : null} aoFechar={fechar} salvo={pronto} recarregar={recarregar} />
      <JanelaVeiculo aberto={janela?.tipo === "veiculo"} veiculo={janela?.tipo === "veiculo" ? janela.veiculo : null} unidadeId={unidadeId}
        nomeUnidade={nomeUnidade} contatos={contatos} vagas={vagas} aoFechar={fechar} salvo={pronto} recarregar={recarregar} />
      <Janela aberto={janela?.tipo === "retirar"} titulo={janela?.tipo === "retirar" ? `Retirar o veículo ${janela.veiculo.placa}` : "Retirar veículo"}
        campos={[]} iniciais={{}} textoBotao="Retirar veículo" aoFechar={fechar} recarregar={recarregar}
        explicacao="O veículo sai da unidade e da vaga. A retirada fica no histórico da unidade, sem a placa."
        aoSalvar={async () => {
          const x = (janela as { veiculo: Veiculo }).veiculo;
          const r = await chamarApi(`/v1/condominio/veiculos/${x.id}/retirar`, { corpo: { versao: x.versao } });
          if (r.ok) pronto({ tom: "ok", texto: `Veículo ${x.placa} retirado.` });
          return r;
        }} />
    </CartaoFicha>
  );
}

type DeQuem = "" | "unidades" | "condominio" | "veiculos";
const COLUNAS = "md:grid-cols-[44px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_40px]";

/** A aba Garagens de Moradores e unidades: todas as vagas, de quem é cada uma e o veículo nela.
 * Nova vaga fica em Montar o prédio; Editar e Tirar de uso, no menu de cada vaga. */
export function AbaGaragens({ salvo }: { salvo: Salvo }) {
  const carga = useCarregar<Garagens>("/v1/condominio/garagens");
  const [janela, setJanela] = useState<{ tipo: "vaga"; vaga: Vaga | null } | { tipo: "uso"; vaga: Vaga } | null>(null);
  const [deQuem, setDeQuem] = useState<DeQuem>("");
  const [texto, setTexto] = useState("");
  const [soSemVaga, setSoSemVaga] = useState(false);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as garagens…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const fechar = () => setJanela(null);
  const pronto = (r: Recado) => { fechar(); salvo(r); carga.recarregar(); };
  const r = d.resumo;
  const q = texto.trim().toLowerCase().replace(/[^0-9a-z]/g, "");
  const lista = d.vagas.filter((v) => (deQuem === "" ? true : deQuem === "unidades" ? Boolean(v.unidadeId) : !v.unidadeId)
    && (!q || [v.identificacao, v.unidade ?? "", ...v.veiculos.map((x) => x.placa)].some((t) => t.toLowerCase().replace(/[^0-9a-z]/g, "").includes(q))));
  const abas: { valor: DeQuem; texto: string; n: number }[] = [
    { valor: "", texto: "Todas as vagas", n: r.vagas }, { valor: "unidades", texto: "De unidades", n: r.deUnidades }, { valor: "condominio", texto: "Do condomínio", n: r.doCondominio },
    { valor: "veiculos", texto: "Veículos", n: r.veiculos },
  ];
  // A vista só de veículos (D4.7): todos os veículos em uso, com a vaga e a unidade; os sem vaga
  // ficam na mesma lista, com Sem vaga no lugar da vaga, e o atalho mostra só esses (decisão B.2).
  const naVaga = d.vagas.flatMap((v) => v.veiculos.map((x) => ({ ...x, vaga: v.identificacao as string | undefined, unidade: v.unidade, unidadeId: v.unidadeId })));
  const semVaga = (d.semVaga ?? []).map((x) => ({ id: x.id, placa: x.placa, tipo: x.tipo, modelo: x.modelo, vaga: undefined, unidade: x.unidade as string | undefined, unidadeId: x.unidadeId as string | undefined }));
  const veiculos = [...(soSemVaga ? [] : naVaga), ...semVaga]
    .filter((x) => !q || [x.placa, x.vaga ?? "", x.unidade ?? "", x.modelo ?? ""].some((t) => t.toLowerCase().replace(/[^0-9a-z]/g, "").includes(q)))
    .sort((a, b) => a.placa.localeCompare(b.placa));
  const nova = d.podeEditar ? <Botao variante="contorno" onClick={() => setJanela({ tipo: "vaga", vaga: null })}><Icone nome="mais" />Nova vaga de garagem</Botao> : undefined;

  return (
    <div className="grid gap-4">
      <form role="search" aria-label="Buscar vagas" className="busca min-w-0 md:max-w-[520px]" onSubmit={(e) => e.preventDefault()}>
        <Icone nome="busca" />
        <label htmlFor="g-busca" className="sr-only">Buscar por vaga, unidade ou placa</label>
        <input id="g-busca" className="campo" type="search" placeholder="Buscar por vaga, unidade ou placa" maxLength={40} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </form>
      {d.vagas.length === 0 ? (
        <Vazio titulo="Nenhuma vaga cadastrada" icone="pin" acao={nova}>
          Cadastre as vagas de cada unidade e as do condomínio, como as de visitantes. Os veículos entram na ficha de cada unidade.
        </Vazio>
      ) : (
        <section aria-labelledby="t-garagens-lista" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
          <h2 id="t-garagens-lista" className="sr-only">Vagas do condomínio</h2>
          <nav aria-label="De quem é" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
            {abas.map((a) => {
              const atual = deQuem === a.valor;
              return (
                <button key={a.valor || "todas"} type="button" aria-pressed={atual} onClick={() => setDeQuem(a.valor)}
                  className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                  {a.texto}<span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{a.n}</span>
                </button>
              );
            })}
          </nav>
          {deQuem === "veiculos" && r.semVaga ? (
            <div role="group" aria-label="Mostrar só" className="flex items-center gap-2 py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
              <span className="t-apoio shrink-0 max-md:hidden">Mostrar só</span>
              <button type="button" aria-pressed={soSemVaga} data-tom="neutro" className="chip-atencao" onClick={() => setSoSemVaga((x) => !x)}>
                Sem vaga <b>{r.semVaga}</b>
              </button>
            </div>
          ) : null}
          {deQuem === "veiculos" ? (
            veiculos.length === 0 ? <div className="md:p-5"><Vazio titulo="Nenhum veículo encontrado" icone="busca">{q ? "Confira a busca: placa, vaga, unidade ou modelo." : "Nenhum veículo cadastrado ainda. Os veículos entram na ficha de cada unidade."}</Vazio></div> : (
              <>
                <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
                  <span /><span className="t-rotulo">Veículo</span><span className="t-rotulo">Unidade</span><span className="t-rotulo">Vaga</span><span />
                </div>
                <ul aria-label="Veículos" className="grid max-md:gap-3">
                  {veiculos.map((x) => (
                    <li key={x.id} className={`grid grid-cols-[44px_minmax(0,1fr)_40px] items-center gap-x-4 gap-y-1 px-5 py-3 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
                      <span className="ladrilho h-11 w-11 rounded-xl" aria-hidden="true"><Icone nome="chave" /></span>
                      <span className="grid min-w-0">
                        <span className="t-codigo font-medium">{x.placa}</span>
                        <span className="t-apoio">{[TIPOS_VEICULO[x.tipo], x.modelo].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="t-texto max-md:col-start-2">
                        {x.unidadeId ? <Link href={`/moradores/unidade?id=${x.unidadeId}`} className="hover:text-violeta-600 hover:underline">{x.unidade}</Link> : <span className="text-tinta-suave">Do condomínio</span>}
                      </span>
                      <span className="t-texto max-md:col-start-2">{x.vaga ? <>Vaga <span className="t-codigo">{x.vaga}</span></> : <span className="text-tinta-suave">Sem vaga</span>}</span>
                      <span />
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : lista.length === 0 ? <div className="md:p-5"><Vazio titulo="Nenhuma vaga encontrada" icone="busca">Confira a busca: vaga, unidade ou placa.</Vazio></div> : (
            <>
              <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
                <span /><span className="t-rotulo">Vaga</span><span className="t-rotulo">Unidade</span><span className="t-rotulo">Veículo nela</span><span />
              </div>
              <ul aria-label="Vagas" className="grid max-md:gap-3">
                {lista.map((v) => (
                  <li key={v.id} className={`grid grid-cols-[44px_minmax(0,1fr)_40px] items-center gap-x-4 gap-y-1 px-5 py-3 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
                    <span className="ladrilho t-codigo h-11 w-11 rounded-xl" aria-hidden="true">{v.identificacao.slice(0, 1)}</span>
                    <span className="grid min-w-0">
                      <span className="flex flex-wrap items-center gap-2 font-medium">Vaga <span className="t-codigo">{v.identificacao}</span>{v.ativa ? null : <Selo tom="neutro">Fora de uso</Selo>}</span>
                      <span className="t-apoio">{ondeFica(v) || "Não informado"}</span>
                    </span>
                    <span className="t-texto max-md:col-start-2">{v.unidade ?? <span className="text-tinta-suave">Do condomínio</span>}</span>
                    <span className="t-texto max-md:col-start-2">{v.veiculos.length ? veiculoNaVaga(v) : <span className="text-tinta-suave">Livre</span>}</span>
                    <span className="justify-self-end max-md:col-start-3 max-md:row-start-1">
                      {d.podeEditar ? (
                        <MenuAcoes rotulo={`Ações da vaga ${v.identificacao}`} itens={[
                          ...(v.ativa ? [{ texto: "Editar", icone: "editar" as const, rotulo: `Editar a vaga ${v.identificacao}`, acao: () => setJanela({ tipo: "vaga", vaga: v }) }] : []),
                          ...(v.veiculos.length ? [] : [{ texto: v.ativa ? "Tirar de uso…" : "Voltar ao uso", icone: (v.ativa ? "sair" : "trocar") as NomeIcone, perigo: v.ativa,
                            rotulo: `${v.ativa ? "Tirar de uso" : "Voltar ao uso"} a vaga ${v.identificacao}`, acao: () => setJanela({ tipo: "uso", vaga: v }) }]),
                        ]} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">
            {r.vagas === 1 ? "1 vaga" : `${r.vagas} vagas`} · {r.veiculos === 1 ? "1 veículo" : `${r.veiculos} veículos`}{r.semVaga ? ` · ${r.semVaga === 1 ? "1 veículo sem vaga" : `${r.semVaga} veículos sem vaga`}` : ""}
          </p>
        </section>
      )}
      <p className="t-apoio">Vaga do condomínio não é de nenhuma unidade: visitantes, carga e descarga, vaga rotativa. Nova vaga fica em Montar o prédio.</p>
      <JanelaVaga aberto={janela?.tipo === "vaga"} vaga={janela?.tipo === "vaga" ? janela.vaga : null} unidades={d.unidades}
        aoFechar={fechar} salvo={pronto} recarregar={carga.recarregar} />
      <JanelaUsoVaga vaga={janela?.tipo === "uso" ? janela.vaga : null} aoFechar={fechar} salvo={pronto} recarregar={carga.recarregar} />
    </div>
  );
}
