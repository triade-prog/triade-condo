"use client";
// Garagens e veículos (F3.8; MU-06, MU-11): a parte da ficha da unidade com as vagas dela e
// os veículos de quem mora ou responde por ela, e a aba Garagens com todas as vagas do
// condomínio. A placa aparece só aqui, para quem vê os moradores: nunca no mural, no WhatsApp
// nem no histórico. Nada se apaga: a vaga sai de uso e o veículo é retirado.

import { useState } from "react";
import { TIPOS_VEICULO, type TipoVeiculo } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Selo, Vazio } from "@triade/ui";
import { Janela, type Campo } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ContatoDaUnidade, Garagens, Recado, Vaga, Veiculo } from "../tipos.ts";

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

/** A parte Garagens e veículos da ficha da unidade. */
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

  return (
    <section id="garagens" aria-labelledby="t-garagens" className="grid gap-3 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="t-garagens" className="text-lg font-medium">Garagens e veículos</h2>
        {edita ? (
          <span className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={() => setJanela({ tipo: "vaga", vaga: null })}>+ Vaga</Botao>
            <Botao variante="contorno" onClick={() => setJanela({ tipo: "veiculo", veiculo: null })}>+ Veículo</Botao>
          </span>
        ) : null}
      </div>
      {vagas.length === 0 && veiculos.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma vaga nem veículo nesta unidade.</p>
      ) : null}
      {vagas.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full text-sm">
            <caption className="sr-only">Vagas de {nomeUnidade}</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Vaga</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Onde</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Veículo nela</th>
                {edita ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {vagas.map((v) => (
                <tr key={v.id} className="border-t border-linha">
                  <td className="px-4 py-3 font-medium">{v.identificacao}</td>
                  <td className="px-4 py-3">{ondeFica(v) || <span className="text-tinta-suave">Não informado</span>}</td>
                  <td className="px-4 py-3">{v.veiculos.length ? veiculoNaVaga(v) : <span className="text-tinta-suave">Livre</span>}</td>
                  {edita ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Botao variante="discreto" onClick={() => setJanela({ tipo: "vaga", vaga: v })} aria-label={`Editar a vaga ${v.identificacao}`}>Editar</Botao>
                      {v.veiculos.length ? null : (
                        <Botao variante="discreto" onClick={() => setJanela({ tipo: "uso", vaga: v })} aria-label={`Tirar de uso a vaga ${v.identificacao}`}>Tirar de uso</Botao>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {veiculos.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full text-sm">
            <caption className="sr-only">Veículos de {nomeUnidade}</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Placa</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Veículo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">De quem</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Vaga</th>
                {edita ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {veiculos.map((x) => (
                <tr key={x.id} className="border-t border-linha">
                  <td className="px-4 py-3 font-mono font-medium">{x.placa}</td>
                  <td className="px-4 py-3">{[TIPOS_VEICULO[x.tipo], x.modelo].filter(Boolean).join(" · ")}</td>
                  <td className="px-4 py-3">{x.contato ?? <span className="text-tinta-suave">Da unidade</span>}</td>
                  <td className="px-4 py-3">{x.vaga ?? <span className="text-tinta-suave">Sem vaga</span>}</td>
                  {edita ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Botao variante="discreto" onClick={() => setJanela({ tipo: "veiculo", veiculo: x })} aria-label={`Editar o veículo ${x.placa}`}>Editar</Botao>
                      <Botao variante="discreto" onClick={() => setJanela({ tipo: "retirar", veiculo: x })} aria-label={`Retirar o veículo ${x.placa}`}>Retirar</Botao>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-tinta-suave">
        A vaga é da unidade. O veículo pode ser de alguém da unidade ou só da unidade. A placa aparece só para quem vê os moradores, nunca no mural, no WhatsApp ou no histórico.
      </p>

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
    </section>
  );
}

/** A aba Garagens de Moradores e unidades: todas as vagas, de quem é cada uma e o veículo nela. */
export function AbaGaragens({ salvo }: { salvo: Salvo }) {
  const carga = useCarregar<Garagens>("/v1/condominio/garagens");
  const [janela, setJanela] = useState<{ tipo: "vaga"; vaga: Vaga | null } | { tipo: "uso"; vaga: Vaga } | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as garagens…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const fechar = () => setJanela(null);
  const pronto = (r: Recado) => { fechar(); salvo(r); carga.recarregar(); };
  const r = d.resumo;
  const numeros = [
    [r.vagas, r.vagas === 1 ? "vaga" : "vagas"], [r.deUnidades, "de unidades"], [r.doCondominio, "do condomínio"],
    [r.veiculos, r.veiculos === 1 ? "veículo" : "veículos"], [r.semVaga, "veículos sem vaga"],
  ] as const;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Resumo das garagens">
          {numeros.map(([n, t]) => (
            <li key={t} className="rounded-xl border border-linha bg-superficie px-3 py-2 text-sm"><b className="mr-1 text-base">{n}</b>{t}</li>
          ))}
        </ul>
        {d.podeEditar ? <Botao onClick={() => setJanela({ tipo: "vaga", vaga: null })}>+ Vaga</Botao> : null}
      </div>
      {d.vagas.length === 0 ? (
        <Vazio titulo="Nenhuma vaga cadastrada" acao={d.podeEditar ? <Botao onClick={() => setJanela({ tipo: "vaga", vaga: null })}>+ Vaga</Botao> : undefined}>
          Cadastre as vagas de cada unidade e as do condomínio, como as de visitantes. Os veículos entram na ficha de cada unidade.
        </Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full text-sm">
            <caption className="sr-only">Vagas do condomínio</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Vaga</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Onde</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Unidade</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Veículo nela</th>
                {d.podeEditar ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {d.vagas.map((v) => (
                <tr key={v.id} className="border-t border-linha">
                  <td className="px-4 py-3 font-medium">{v.identificacao}{v.ativa ? null : <span className="ml-2"><Selo tom="neutro">Fora de uso</Selo></span>}</td>
                  <td className="px-4 py-3">{ondeFica(v) || <span className="text-tinta-suave">Não informado</span>}</td>
                  <td className="px-4 py-3">{v.unidade ?? <span className="text-tinta-suave">Do condomínio</span>}</td>
                  <td className="px-4 py-3">{v.veiculos.length ? veiculoNaVaga(v) : <span className="text-tinta-suave">Livre</span>}</td>
                  {d.podeEditar ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {v.ativa ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "vaga", vaga: v })} aria-label={`Editar a vaga ${v.identificacao}`}>Editar</Botao> : null}
                      {v.veiculos.length ? null : (
                        <Botao variante="discreto" onClick={() => setJanela({ tipo: "uso", vaga: v })}
                          aria-label={`${v.ativa ? "Tirar de uso" : "Voltar ao uso"} a vaga ${v.identificacao}`}>{v.ativa ? "Tirar de uso" : "Voltar ao uso"}</Botao>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-tinta-suave">
        Vaga do condomínio não é de nenhuma unidade: visitantes, carga e descarga, vaga rotativa. A identificação não se repete entre as vagas em uso.
      </p>
      <JanelaVaga aberto={janela?.tipo === "vaga"} vaga={janela?.tipo === "vaga" ? janela.vaga : null} unidades={d.unidades}
        aoFechar={fechar} salvo={pronto} recarregar={carga.recarregar} />
      <JanelaUsoVaga vaga={janela?.tipo === "uso" ? janela.vaga : null} aoFechar={fechar} salvo={pronto} recarregar={carga.recarregar} />
    </div>
  );
}
