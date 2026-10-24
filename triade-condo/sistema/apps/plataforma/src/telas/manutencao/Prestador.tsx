"use client";
// Ficha do prestador (DC15, telas-modelo manutencao-prestador-*; MP-05, MP-09): o contato, com
// Ligar e Chamar no WhatsApp; como trabalha com o condomínio e a reserva; e as manutenções que fez
// no prédio, com quantas estão abertas e a lista inteira a um toque, já filtrada. O que falta no
// cadastro tem Adicionar. Editar é o botão; Arquivar fica em Mais ações e não apaga: o prestador
// sai das escolhas e continua no histórico. Com contrato, o arquivo fica em Documentos (D.2, 0294).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ACORDOS_PRESTADOR, linkWhatsapp, mostrarDataCurta, mostrarTelefone } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Iniciais, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, Dado, MaisAcoes } from "../Ficha.tsx";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ListaPrestadores, PrestadorDetalhe, Recado } from "../tipos.ts";
import { ICONE_TIPO, SeloManutencao } from "./comum.tsx";
import { LinhaArquivoContrato } from "./ContratoPrestador.tsx";
import { camposPrestador, iniciaisPrestador, salvarPrestador } from "./Prestadores.tsx";

export function Prestador() {
  const id = useSearchParams().get("id");
  const { painel } = usePlataforma();
  const carga = useCarregar<PrestadorDetalhe>(id ? `/v1/condominio/manutencao/prestadores/${id}` : null);
  const outros = useCarregar<ListaPrestadores>("/v1/condominio/manutencao/prestadores");
  const [editando, setEditando] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const voltar = (
    <Link href="/manutencao/prestadores" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Voltar aos prestadores
    </Link>
  );

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

  const podeEditar = pode.editar && !p.arquivado;
  const editar = () => setEditando(true);
  const adicionar = podeEditar ? <Botao variante="discreto" tamanho="m" disabled={outros.estado !== "pronto"} onClick={editar}>Adicionar</Botao> : undefined;
  const falta = (texto = "Não informado") => <span className="text-tinta-suave">{texto}</span>;
  const abertas = manutencoes.filter((m) => m.estado !== "CONCLUIDA" && m.estado !== "CANCELADA").length;
  const msg = `Olá${p.contato ? `, ${p.contato}` : ""}. Aqui é do condomínio ${painel.condominio.nome}.`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="grid gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-5">
        <div className="flex items-center justify-between gap-3">
          {voltar}
          <MaisAcoes itens={podeEditar ? [{ texto: "Arquivar", icone: "sair", acao: () => void arquivar(true), perigo: true }] : []} />
        </div>
        <div className="flex items-center gap-5 max-md:gap-4">
          <Iniciais nome={p.nome} className="h-16 w-16 shrink-0 t-titulo-secao max-md:h-14 max-md:w-14" />
          <div className="grid min-w-0 flex-1 gap-2">
            <h1 className="t-titulo-ficha [overflow-wrap:anywhere]">{p.nome}</h1>
            <p className="flex flex-wrap items-center gap-2">
              <Selo tom="info">{ACORDOS_PRESTADOR[p.acordo]}</Selo>
              <span className="t-apoio">{p.servico}</span>
              {p.arquivado ? <Selo tom="neutro">Arquivado</Selo> : null}
              {p.contratoVence ? <Selo tom="atencao">Contrato perto do fim</Selo> : null}
              {p.contratoVencido ? <Selo tom="erro">Contrato vencido</Selo> : null}
            </p>
          </div>
        </div>
        {pode.editar ? (
          <div className="flex flex-wrap gap-2">
            {p.arquivado ? <Botao variante="contorno" onClick={() => void arquivar(false)}><Icone nome="retorno" />Voltar ao cadastro</Botao>
              : <Botao variante="contorno" disabled={outros.estado !== "pronto"} onClick={editar}><Icone nome="editar" />Editar</Botao>}
          </div>
        ) : null}
      </header>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <div className="contents lg:grid lg:min-w-0 lg:grid-cols-[minmax(0,1fr)] lg:gap-5">
          <Cartao id="t-contato" titulo="Contato" icone="telefone" className="max-lg:order-1">
            {p.telefone ? (
              <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
                <a href={`tel:${p.telefone}`} className={classeBotao("contorno", "", "m")}><Icone nome="telefone" />Ligar</a>
                <a href={linkWhatsapp(p.telefone, msg)} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "", "m")}>
                  <Icone nome="whats" /><span className="md:hidden">WhatsApp</span><span className="max-md:hidden">Chamar no WhatsApp</span>
                </a>
              </div>
            ) : null}
            <div>
              <Dado icone="pessoa" nome="Pessoa de contato" acao={p.contato ? undefined : adicionar}>{p.contato ?? falta("Não informada")}</Dado>
              <Dado icone="telefone" nome="Telefone" acao={p.telefone ? undefined : adicionar}>{p.telefone ? mostrarTelefone(p.telefone) : falta()}</Dado>
              <Dado icone="email" nome="E-mail" acao={p.email ? undefined : adicionar}><span className="[overflow-wrap:anywhere]">{p.email ?? falta()}</span></Dado>
              <Dado icone="documento" nome="CNPJ ou CPF" acao={p.documento ? undefined : adicionar}>{p.documento ?? falta()}</Dado>
            </div>
          </Cartao>
          <Cartao id="t-acordo" titulo="Como trabalha com o condomínio" icone="predio" className="max-lg:order-3">
            <div>
              <Dado icone="documento" nome="Acordo">{p.acordo === "CONTRATO" ? (p.contratoAte ? `Contrato até ${mostrarDataCurta(p.contratoAte)}` : "Contrato sem data de fim") : "Avulso, por chamado"}</Dado>
              <LinhaArquivoContrato p={p} pode={Boolean(pode.contrato)}
                aoMudar={(texto, tom = "ok") => { setRecado({ tom, texto }); carga.recarregar(); }} />
              <Dado icone="calendario" nome="Desde" acao={p.desde ? undefined : adicionar}>{p.desde ? mostrarDataCurta(p.desde) : falta()}</Dado>
              <Dado icone="trocar" nome="Reserva" acao={p.reserva ? undefined : adicionar}>
                {p.reserva ? <Link href={`/manutencao/prestador?id=${p.reserva.id}`} className="font-medium text-violeta-600 hover:underline">{p.reserva.nome}</Link> : falta("Nenhuma")}
              </Dado>
              {reservaDe.length ? <Dado icone="pessoas" nome="É a reserva de">{reservaDe.map((r) => r.nome).join(", ")}</Dado> : null}
              {p.observacao ? <Dado icone="editar" nome="Observação"><span className="whitespace-pre-line">{p.observacao}</span></Dado> : null}
            </div>
            <p className="t-apoio">Registrar um prestador não é contratar. Se não confirmar um link no prazo, o serviço pode passar para a reserva.</p>
          </Cartao>
        </div>
        <Cartao id="t-feitas" rotulo="Manutenções" icone="ferramenta" className="max-lg:order-2"
          titulo={<>Manutenções{abertas ? <span className="t-apoio font-normal">· {abertas === 1 ? "1 aberta" : `${abertas} abertas`}</span> : null}</>}>
          {manutencoes.length === 0 ? <p className="t-apoio">Nenhuma manutenção com este prestador ainda.</p> : (
            <ul className="divide-y divide-linha">
              {manutencoes.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={ICONE_TIPO[m.tipo]} className="h-4 w-4" /></span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <Link href={`/manutencao/manutencao?id=${m.id}`} className="font-medium hover:text-violeta-600 hover:underline">{m.titulo}</Link>
                    <span className="t-apoio">{m.local}{m.realizadaEm ? ` · feita em ${mostrarDataCurta(m.realizadaEm)}` : ""}</span>
                  </span>
                  <SeloManutencao estado={m.estado} />
                </li>
              ))}
            </ul>
          )}
          {manutencoes.length ? (
            <Link href={`/manutencao?prestador=${p.id}&situacao=TODAS`} className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
              Ver todas na lista de manutenções<Icone nome="dir" className="h-4 w-4" />
            </Link>
          ) : null}
        </Cartao>
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
