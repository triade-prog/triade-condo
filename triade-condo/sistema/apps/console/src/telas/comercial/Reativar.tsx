"use client";
// Reativar quem voltou depois do último dia (quadro 488; estados do 491; CM-31 e CM-32; escolha da
// Carol em 30/10/2026): a volta é um aditivo de retorno ao contrato antigo, com o plano do dia e a
// data da volta, assinado pelos dois pelo gov.br. A equipe envia aqui o PDF que o síndico assinou e
// o da TRÍADE e confere como no contrato. Reativar só liga com as duas assinaturas conferidas e diz o
// que falta. Só a Administração gera e reativa; o Comercial vê e envia o PDF do síndico.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Aviso, Botao, Carregando, classeBotao, ErroCarregar, Icone, Selo } from "@triade/ui";
import { Cartao, Dado, diaHora, Voltar } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hashCurto } from "./contrato.ts";
import { CartaoAssinaturasAditivo, JanelaConferirAditivo, JanelaEnviarAditivo, type JanelaAssinatura } from "./janelasAditivo.tsx";
import { useBaixar } from "./janelasContrato.tsx";
import { JanelaGerarRetorno, JanelaReativar, ListaMarcada } from "./janelasRenovacoes.tsx";
import type { ModeloAditivo } from "./ModeloAditivo.tsx";
import { reais } from "./painel.ts";
import {
  AO_REATIVAR_VOLTA, envioConferido, faltaParaReativar, linhasRetorno, NAO_VOLTA, podeEnviarParte, ROTAS_RENOVACOES, TELA_RENOVACOES, textoReativado,
  type TelaCancelamento,
} from "./renovacoes.ts";

type Janela = { tipo: "gerar" } | { tipo: "reativar" } | JanelaAssinatura;
const ICONES_LINHA = { Contrato: "documento", Representante: "pessoa", Plano: "dinheiro", Volta: "calendario" } as const;
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function Reativar() {
  const { id } = useParams<{ id: string }>();
  const carga = useCarregar<TelaCancelamento>(ROTAS_RENOVACOES.cancelamento(id));
  const modelos = useCarregar<{ versoes: ModeloAditivo[] }>(ROTAS_RENOVACOES.modelos);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const b = useBaixar();

  const voltar = <Voltar href={`${TELA_RENOVACOES}?aba=cancelamentos`} texto="Renovações · Cancelamentos" />;
  if (carga.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Abrindo o cancelamento…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const d = carga.dados;
  const k = d.cancelamento;

  // Sem a lista de modelos (por exemplo, sem permissão de ler), Gerar fica ligado e o banco decide.
  const modeloEmUso = modelos.estado === "pronto" ? modelos.dados.versoes.find((m) => m.tipo === "RETORNO" && m.situacao === "EM_USO") : undefined;
  const semModelo = modelos.estado === "pronto" && !modeloEmUso;
  const pronto = (texto: string) => { setJanela(null); setAviso({ tom: "ok", texto }); carga.recarregar(); };
  const a = k.retorno && k.retorno.situacao !== "SUBSTITUIDO" ? k.retorno : undefined;
  const encerrado = k.situacao === "ENCERRADO";
  const admin = !!d.pode.reativar;
  const podeAssinar = !!(d.pode.assinar ?? d.pode.confirmar);
  const falta = faltaParaReativar(k, !semModelo);
  const doCondominio = a ? envioConferido(a, "CONDOMINIO") : undefined;
  const linhas = linhasRetorno(a?.dados?.campos);
  const plano = k.retornoPlano;
  const saiu = `${k.ultimoDia.slice(5, 7)}/${k.ultimoDia.slice(0, 4)}`;

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-3xl gap-1">
          <h1 className="t-titulo-tela [overflow-wrap:anywhere]">{`Reativar · ${k.condominio}`}</h1>
          <p className="t-apoio">{`Saiu em ${saiu} (último dia ${dataBr(k.ultimoDia)}). A volta é um aditivo ao contrato: o plano novo e a data da volta, assinados pelos dois pelo gov.br.`}</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full">
          {a ? (
            <Botao variante="contorno" disabled={!doCondominio || !!b.baixando} onClick={() => doCondominio && void b.baixar(ROTAS_RENOVACOES.linkAditivoPdf(a.id, doCondominio.id))}>
              <Icone nome="baixar" />Baixar o PDF assinado pelo condomínio
            </Botao>
          ) : null}
          {a && podeAssinar && encerrado ? (
            <Botao variante="contorno" disabled={!podeEnviarParte(a, "TRIADE")} onClick={() => setJanela({ tipo: "enviarAditivo", parte: "TRIADE" })}>
              <Icone nome="enviar" />Enviar o PDF assinado pela TRÍADE
            </Botao>
          ) : null}
          {admin && k.situacao !== "REATIVADO" ? (
            <Botao disabled={!!falta || !encerrado} onClick={() => setJanela({ tipo: "reativar" })} aria-describedby={falta ? "reativar-falta" : undefined}>
              <Icone nome="retorno" />Reativar o cliente
            </Botao>
          ) : null}
        </div>
      </div>
      {admin && falta && k.situacao !== "REATIVADO" ? (
        <p id="reativar-falta" className="-mt-3 t-apoio md:text-right">{`Reativar libera quando o aditivo de retorno estiver assinado pelos dois e conferido. ${falta}`}</p>
      ) : null}
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {b.problema ? <Aviso tom="erro" papel="alert">{b.problema}</Aviso> : null}
      {k.situacao === "REATIVADO" ? <Aviso tom="ok" titulo="Cliente de novo">{textoReativado(k)}</Aviso> : null}
      {k.situacao === "CONFIRMADO" ? (
        <Aviso tom="info" titulo="O último dia ainda não passou">Até o último dia, a Administração desfaz o cancelamento na aba Cancelamentos. Reativar é para depois dele.</Aviso>
      ) : null}
      {!admin && encerrado ? (
        <Aviso tom="info" titulo="Só a Administração">O Comercial vê o pedido e a volta e envia o PDF que o síndico assinou, mas gerar o aditivo e reativar são da Administração.</Aviso>
      ) : null}
      {encerrado && semModelo && !a ? (
        <Aviso tom="atencao" titulo="Sem modelo de retorno">
          Nenhuma versão do aditivo de retorno está em uso. Cadastre o texto do advogado em Modelos › Aditivo › Retorno.
          {d.pode.regra ? (
            <span className="mt-2 block"><Link href="/comercial/modelos?aba=aditivo&parte=retorno" className={classeBotao("contorno")}><Icone nome="documento" />Abrir Modelos › Aditivo</Link></span>
          ) : null}
        </Aviso>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Cartao id="reativar-aditivo" titulo={a ? `Aditivo de retorno nº ${a.numero}` : "Aditivo de retorno"} icone="documento"
            acao={a && admin && encerrado ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "gerar" })}><Icone nome="editar" />Gerar de novo</Botao> : undefined}>
            {a ? (
              <>
                <div>
                  {linhas.map(([n, v]) => <Dado key={n} icone={ICONES_LINHA[n as keyof typeof ICONES_LINHA] ?? "check"} nome={n}>{v}</Dado>)}
                  {modeloEmUso ? <Dado icone="camadas" nome="Modelo">{`${modeloEmUso.titulo} v${modeloEmUso.numero}`}</Dado> : null}
                  {a.geradoEm ? <Dado icone="relogio" nome="Gerado em">{diaHora(a.geradoEm)}</Dado> : null}
                  <Dado icone="escudo" nome="Impressão digital">
                    <span className="t-codigo" title={a.hash}>{`sha256 ${hashCurto(a.hash)}`}</span><span className="t-apoio"> · impressa em cada folha</span>
                  </Dado>
                </div>
                {a.situacao === "GERANDO" ? <Aviso tom="atencao">O PDF do aditivo não ficou pronto. Gere de novo.</Aviso> : null}
                <Botao variante="contorno" className="justify-self-start max-md:justify-self-stretch" disabled={a.situacao !== "PRONTO" || !!b.baixando}
                  onClick={() => void b.baixar(ROTAS_RENOVACOES.linkAditivoPdf(a.id))}>
                  <Icone nome="baixar" />Baixar o PDF
                </Botao>
                <p className="t-apoio">Gerar de novo (por exemplo, para corrigir um dado) cria um PDF novo e pede as duas assinaturas outra vez; o anterior fica guardado como substituído.</p>
              </>
            ) : (
              <>
                <p className="t-texto">O texto vem de Modelos › Aditivo › Retorno, com o contrato, o último dia, quem assina pelo condomínio, o plano e a data da volta.</p>
                {plano ? (
                  <Dado icone="dinheiro" nome="Plano da volta">
                    {plano.sobConsulta
                      ? `Tabela cheia do dia${plano.unidades ? ` · ${plano.unidades} unidades` : ""} · faixa sob consulta: o valor é combinado com a Administração`
                      : `Tabela cheia do dia${plano.unidades ? ` · ${plano.unidades} unidades` : ""}${plano.faixa ? ` (${plano.faixa})` : ""}${plano.valor ? ` · ${reais(plano.valor)} por mês` : ""}`}
                  </Dado>
                ) : <p className="t-apoio">O plano vem da Tabela de preços do dia, pela faixa de unidades, sem fundador. Acima de 400 unidades, o valor é combinado com a Administração.</p>}
                {admin ? (
                  <Botao className="justify-self-start max-md:justify-self-stretch" disabled={!encerrado || semModelo} onClick={() => setJanela({ tipo: "gerar" })}
                    aria-describedby={!encerrado || semModelo ? "reativar-sem-gerar" : undefined}>
                    <Icone nome="documento" />Gerar o aditivo
                  </Botao>
                ) : null}
                {admin && semModelo ? <p id="reativar-sem-gerar" className="t-apoio">Gerar fica desligado até haver uma versão do aditivo de retorno em uso.</p> : null}
                {admin && !semModelo && !encerrado ? <p id="reativar-sem-gerar" className="t-apoio">O aditivo de retorno é para depois do último dia.</p> : null}
              </>
            )}
          </Cartao>
          {a && a.situacao === "PRONTO" ? (
            <CartaoAssinaturasAditivo id="reativar-assinaturas" aditivo={a} quemCondominio={a.dados?.campos?.representante ?? "O síndico"}
              podeEditar={d.pode.editar && encerrado} podeAssinar={podeAssinar && encerrado} abrir={setJanela} triadeNaCabeca />
          ) : null}
        </div>
        <div className="grid content-start gap-5">
          <Cartao id="reativar-volta" titulo="Ao reativar, volta" icone="retorno">
            <ListaMarcada itens={AO_REATIVAR_VOLTA} tom="ok" rotulo="O que volta" />
          </Cartao>
          <Cartao id="reativar-nao-volta" titulo="Não volta" icone="cadeado" acao={<Selo tom="neutro">Fica no histórico</Selo>}>
            <ListaMarcada itens={NAO_VOLTA} tom="neutro" rotulo="O que não volta" />
          </Cartao>
        </div>
      </div>
      <p className="t-apoio">Só a Administração gera o aditivo de retorno e reativa. O Comercial vê e envia o PDF que o síndico assinou. Ao reativar, o último dia é revogado (fica no histórico), a reconquista aberta fica Ganha e o cliente volta para Reajuste e renovação.</p>

      {janela?.tipo === "gerar" ? <JanelaGerarRetorno k={k} hoje={d.hoje} sobConsulta={plano?.sobConsulta} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "reativar" ? <JanelaReativar k={k} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "enviarAditivo" && a ? <JanelaEnviarAditivo aditivo={a} parte={janela.parte} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "conferirAditivo" && a ? (
        <JanelaConferirAditivo aditivo={a} envio={janela.envio} condominio={k.condominio} aoFechar={() => setJanela(null)} feito={pronto} />
      ) : null}
    </div>
  );
}
