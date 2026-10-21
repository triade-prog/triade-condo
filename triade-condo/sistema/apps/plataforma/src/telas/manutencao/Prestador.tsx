"use client";
// Ficha do prestador (design "Telas da Manutenção", tela 6; MP-05, MP-09): o contato, como
// trabalha com o condomínio, a reserva e todas as manutenções que fez no prédio. Arquivar não
// apaga: o prestador sai das escolhas e continua no histórico.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ACORDOS_PRESTADOR, mostrarDataCurta, mostrarTelefone } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ListaPrestadores, PrestadorDetalhe, Recado } from "../tipos.ts";
import { PartesManutencao, SeloManutencao } from "./comum.tsx";
import { camposPrestador, iniciaisPrestador, salvarPrestador } from "./Prestadores.tsx";

export function Prestador() {
  const id = useSearchParams().get("id");
  const carga = useCarregar<PrestadorDetalhe>(id ? `/v1/condominio/manutencao/prestadores/${id}` : null);
  const outros = useCarregar<ListaPrestadores>("/v1/condominio/manutencao/prestadores");
  const [editando, setEditando] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const voltar = <Link href="/manutencao/prestadores" className="text-sm font-medium text-violeta-600 hover:underline">Voltar aos prestadores</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<Vazio titulo="Prestador não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o prestador…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const { prestador: p, manutencoes, reservaDe, pode } = carga.dados;

  async function arquivar(arquivar: boolean) {
    setFalha(null);
    const r = await chamarApi(`/v1/condominio/manutencao/prestadores/${p.id}/arquivar`, { corpo: { versao: p.versao, arquivar } });
    if (!r.ok) return setFalha(r.erro);
    setRecado({ tom: "ok", texto: arquivar ? "Prestador arquivado. Ele continua no histórico das manutenções." : "Prestador de volta ao cadastro." });
    carga.recarregar();
  }

  return (
    <div className="grid gap-5">
      <PartesManutencao />
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-[28px] font-normal tracking-tight">{p.nome}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Selo tom="info">{ACORDOS_PRESTADOR[p.acordo]}</Selo>
            <span className="text-tinta-suave">{p.servico}</span>
            {p.arquivado ? <Selo tom="neutro">Arquivado</Selo> : null}
            {p.contratoVence ? <Selo tom="atencao">Contrato perto do fim</Selo> : null}
            {p.contratoVencido ? <Selo tom="erro">Contrato vencido</Selo> : null}
          </p>
        </div>
        {pode.editar ? (
          <div className="flex flex-wrap gap-2">
            {p.arquivado ? <Botao variante="contorno" onClick={() => void arquivar(false)}>Voltar ao cadastro</Botao> : (
              <>
                <Botao variante="contorno" disabled={outros.estado !== "pronto"} onClick={() => setEditando(true)}>Editar</Botao>
                <Botao variante="discreto" onClick={() => void arquivar(true)}>Arquivar</Botao>
              </>
            )}
          </div>
        ) : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section aria-labelledby="t-contato" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-contato" className="text-lg font-medium">Contato</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-tinta-suave">Pessoa de contato</dt><dd>{p.contato ?? "Não informada"}</dd></div>
              <div><dt className="text-xs text-tinta-suave">Telefone</dt><dd>{p.telefone ? mostrarTelefone(p.telefone) : "Não informado"}</dd></div>
              <div><dt className="text-xs text-tinta-suave">E-mail</dt><dd className="[overflow-wrap:anywhere]">{p.email ?? "Não informado"}</dd></div>
              <div><dt className="text-xs text-tinta-suave">CNPJ ou CPF</dt><dd>{p.documento ?? "Não informado"}</dd></div>
            </dl>
            {p.telefone ? <a href={`tel:${p.telefone}`} className={classeBotao("contorno", "justify-self-start", "m")}>Ligar</a> : null}
          </section>
          <section aria-labelledby="t-acordo" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <h2 id="t-acordo" className="text-lg font-medium">Como trabalha com o condomínio</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-tinta-suave">Acordo</dt><dd>{p.acordo === "CONTRATO" ? (p.contratoAte ? `Contrato até ${mostrarDataCurta(p.contratoAte)}` : "Contrato sem data de fim") : "Avulso, por chamado"}</dd></div>
              <div><dt className="text-xs text-tinta-suave">Desde</dt><dd>{p.desde ? mostrarDataCurta(p.desde) : "Não informado"}</dd></div>
              <div><dt className="text-xs text-tinta-suave">Reserva</dt><dd>{p.reserva ? <Link href={`/manutencao/prestador?id=${p.reserva.id}`} className="text-violeta-600 hover:underline">{p.reserva.nome}</Link> : "Nenhuma"}</dd></div>
              {reservaDe.length ? <div><dt className="text-xs text-tinta-suave">É a reserva de</dt><dd>{reservaDe.map((r) => r.nome).join(", ")}</dd></div> : null}
              {p.observacao ? <div className="sm:col-span-2"><dt className="text-xs text-tinta-suave">Observação</dt><dd className="whitespace-pre-line">{p.observacao}</dd></div> : null}
            </dl>
            <p className="text-xs text-tinta-suave">A ligação com cotações e valores chega com Orçamentos e compras. Registrar um prestador não é contratar.</p>
          </section>
        </div>
        <section aria-labelledby="t-feitas" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <h2 id="t-feitas" className="text-lg font-medium">Manutenções</h2>
          {manutencoes.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma manutenção com este prestador ainda.</p> : (
            <ul className="divide-y divide-linha">
              {manutencoes.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="grid gap-0.5">
                    <Link href={`/manutencao/manutencao?id=${m.id}`} className="font-medium hover:text-violeta-600 hover:underline">{m.titulo}</Link>
                    <span className="text-xs text-tinta-suave">{m.local}{m.realizadaEm ? ` · feita em ${mostrarDataCurta(m.realizadaEm)}` : ""}</span>
                  </span>
                  <SeloManutencao estado={m.estado} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editando && outros.estado === "pronto" ? (
        <Janela aberto titulo="Editar prestador" textoBotao="Salvar alterações" aoFechar={() => setEditando(false)} recarregar={carga.recarregar}
          campos={camposPrestador(outros.dados.itens.filter((x) => x.id !== p.id))} iniciais={iniciaisPrestador(p)}
          aoSalvar={async (v) => {
            const r = await salvarPrestador(p, v);
            if (r.ok) { setEditando(false); setRecado({ tom: "ok", texto: "Prestador salvo." }); carga.recarregar(); }
            return r;
          }} />
      ) : null}
    </div>
  );
}
