"use client";
// Plano e pagamentos na ficha do cliente (decisão A.1; quadros 241, 243 a 246): os conjuntos com
// contratado e liberado separados (PI-03, CF-11), o plano com "Usar a tabela" de preços (0295) e
// as últimas cobranças.
// Liberar, testar e suspender pedem motivo e ficam registrados; quem pode cada coisa vem da ficha.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AVISOS_SUGESTAO, CICLOS_PLANO, formatarData, MOTIVOS_SUSPENSAO, mostrarDataSemHora, mostrarValor, nomeCompetencia, SITUACOES_COBRANCA, type CicloPlano, type MotivoSuspensao,
} from "@triade/domain";
import { Aviso, Botao, Carregando, CampoAreaTexto, CampoTexto, chamarApi, camposComErro, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { AcaoCartao, Cartao } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import {
  campoDosCentavos, centavosDoCampo, EscolhaBotoes, ErroJanela, hojeBrasilia, ICONE_CONJUNTO, lerSugestao, NOMES_TABELA, nomeFaixa, RodapeJanela, ROTAS_PRECOS,
  SelosConjunto, somarDias, testeAcabou, TOM_COBRANCA, type Cobranca, type ConjuntoCliente, type OrigemPlano, type PlanoDaFicha, type SugestaoPlano,
} from "../planos/comum.tsx";
import type { PropsAba } from "./tipos.ts";

type Janela =
  | { tipo: "liberar" | "teste" | "suspender" | "contratar" | "descontratar"; conjunto: ConjuntoCliente }
  | { tipo: "plano" }
  | null;

/** A frase sob a situação do conjunto: quem liberou, quando e a referência. */
function frase(c: ConjuntoCliente): string {
  if (c.base) return "Vem com todo plano. Nada do atendimento é vendido à parte.";
  if (c.estado === "LIBERADO") return [`Liberado em ${formatarData(c.liberadoEm!)}`, c.liberadoPor && `por ${c.liberadoPor}`, c.liberacaoReferencia && `· ${c.liberacaoReferencia}`].filter(Boolean).join(" ");
  if (c.estado === "TESTE" && !testeAcabou(c)) return `${c.testeMotivo ?? ""}${c.liberadoPor ? ` · liberado por ${c.liberadoPor}` : ""}`;
  if (testeAcabou(c)) return `O teste terminou em ${mostrarDataSemHora(c.testeAte!)}. O que foi criado continua para consultar.`;
  if (c.estado === "SUSPENSO") return `${MOTIVOS_SUSPENSAO[c.suspensaoPorque as MotivoSuspensao] ?? "Suspenso"} em ${formatarData(c.suspensoEm!)}. Consulta e exportação continuam.`;
  return c.contratado ? `Contratado${c.contratoReferencia ? ` · ${c.contratoReferencia}` : ""}` : "Não contratado";
}

function LinhaConjunto({ c, libera, contrata, abrir }: { c: ConjuntoCliente; libera: boolean; contrata: boolean; abrir: (j: Janela) => void }) {
  const acoes: { texto: string; tipo: NonNullable<Janela>["tipo"] }[] = [];
  if (!c.base) {
    const emTeste = c.estado === "TESTE" && !testeAcabou(c);
    if (libera && c.contratado && c.estado !== "LIBERADO") acoes.push({ texto: "Liberar", tipo: "liberar" });
    if (libera && emTeste) acoes.push({ texto: "Encerrar teste", tipo: "suspender" });
    if (libera && c.estado === "LIBERADO") acoes.push({ texto: "Suspender", tipo: "suspender" });
    if (libera && !c.contratado && !emTeste) acoes.push({ texto: "Liberar para teste", tipo: "teste" });
    if (contrata && !c.contratado) acoes.push({ texto: "Contratar", tipo: "contratar" });
    if (contrata && c.contratado) acoes.push({ texto: "Tirar do contrato", tipo: "descontratar" });
  }
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-linha py-3.5 first:border-t-0 md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1.2fr)_auto]">
      <span className="ladrilho h-9 w-9" data-tom="andamento" aria-hidden="true"><Icone nome={ICONE_CONJUNTO[c.codigo] ?? "camadas"} /></span>
      <span className="grid gap-0.5">
        <span className="t-texto font-medium">{c.nome}</span>
        <span className="t-apoio text-tinta-suave">{c.resumo}</span>
      </span>
      <span className="grid gap-1 max-md:col-start-2">
        <span className="flex flex-wrap gap-1.5"><SelosConjunto c={c} /></span>
        <span className="t-apoio text-tinta-suave">{frase(c)}</span>
      </span>
      <span className="flex flex-wrap justify-end gap-1.5 max-md:col-start-2 max-md:justify-start">
        {acoes.map((a) => (
          <Botao key={a.tipo} variante={a.tipo === "liberar" ? "contorno" : "discreto"} tamanho="m" onClick={() => abrir({ tipo: a.tipo, conjunto: c })}
            aria-label={`${a.texto}: ${c.nome}`}>
            {a.tipo === "liberar" ? <Icone nome="check" /> : null}{a.texto}
          </Botao>
        ))}
      </span>
    </li>
  );
}

function Par({ nome, valor, apoio }: { nome: string; valor: string; apoio?: string }) {
  return (
    <div className="grid content-start gap-0.5">
      <span className="t-apoio text-tinta-suave">{nome}</span>
      <span className="t-texto font-medium">{valor}</span>
      {apoio ? <span className="t-apoio text-tinta-suave">{apoio}</span> : null}
    </div>
  );
}

export function nomeCobranca(c: Cobranca): string {
  return c.tipo === "IMPLANTACAO" ? "Implantação" : nomeCompetencia(c.competencia!);
}

export function SeloCobranca({ c }: { c: Cobranca }) {
  return (
    <>
      <Selo tom={c.emAtraso ? "atencao" : TOM_COBRANCA[c.situacao]}>{SITUACOES_COBRANCA[c.situacao]}{c.emAtraso ? " · em atraso" : ""}</Selo>
      {c.aConferir > 0 ? <Selo tom="info">A conferir</Selo> : null}
    </>
  );
}

export function AbaPlano(props: PropsAba) {
  const { ficha, pode } = props;
  const id = ficha.condominio.id;
  const dados = useCarregar<PlanoDaFicha>(`/v1/clientes/${id}/plano`);
  const [janela, setJanela] = useState<Janela>(null);

  if (dados.estado === "carregando") return <Carregando rotulo="Abrindo o plano…" />;
  if (dados.estado === "erro") return <ErroCarregar erro={dados.erro} texto={dados.texto} tentarDeNovo={dados.recarregar} />;

  const d = dados.dados;
  const libera = pode("console.conjuntos.liberar");
  const contrata = pode("console.contrato.editar");
  const pl = d.plano;
  const atrasada = d.cobrancas?.find((c) => c.emAtraso);
  const fechar = () => setJanela(null);
  const feito = (texto: string) => { fechar(); props.avisar({ tom: "ok", texto }); dados.recarregar(); };
  const comuns = { condominio: id, aoFechar: fechar, feito, recarregar: dados.recarregar };
  const faixa = pl ? [pl.unidadesDe !== undefined ? `${pl.unidadesDe}` : null, pl.unidadesAte !== undefined ? `${pl.unidadesAte}` : null] : [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
      <Cartao id="t-conjuntos" titulo="Conjuntos" icone="camadas">
        <p className="t-apoio text-tinta-suave">Fica disponível só o que está contratado e liberado. Libera-se o conjunto inteiro, nunca uma tela solta.</p>
        <ul aria-label="Conjuntos do cliente" className="grid">
          {d.conjuntos.map((c) => <LinhaConjunto key={c.codigo} c={c} libera={libera} contrata={contrata} abrir={setJanela} />)}
        </ul>
      </Cartao>

      <div className="grid min-w-0 gap-6">
        <Cartao id="t-plano" titulo="Plano contratado" icone="documento"
          acao={contrata ? <AcaoCartao icone="editar" rotulo="Editar o plano" aoClicar={() => setJanela({ tipo: "plano" })}>{pl ? "Editar" : "Definir"}</AcaoCartao> : undefined}>
          <p className="t-apoio text-tinta-suave">Interno. O cliente vê só o nome do plano e os conjuntos.</p>
          {pl ? (
            <div className="grid gap-x-5 gap-y-3.5 sm:grid-cols-2">
              <Par nome="Plano" valor={pl.nome} />
              <Par nome="Faixa de unidades" valor={faixa[0] && faixa[1] ? `${faixa[0]} a ${faixa[1]}` : faixa[1] ? `Até ${faixa[1]}` : faixa[0] ? `A partir de ${faixa[0]}` : "Sem faixa"}
                apoio={`${d.unidadesAtivas} unidades ativas hoje`} />
              {"ciclo" in pl ? (
                <>
                  <Par nome={pl.ciclo === "ANUAL" ? "Valor por ano" : "Valor por mês"} valor={mostrarValor(pl.valor)}
                    apoio={pl.valor === undefined ? "Sem valor, a cobrança fica como Valor a definir; nunca vira zero." : undefined} />
                  <Par nome="Ciclo e vencimento" valor={`${CICLOS_PLANO[pl.ciclo as CicloPlano]} · dia ${pl.diaVencimento}`} />
                  <Par nome="Implantação" valor={pl.implantacaoSemCobranca ? "Sem cobrança" : mostrarValor(pl.implantacaoValor)}
                    apoio={pl.implantacaoReferencia ? `Referência: ${pl.implantacaoReferencia}` : undefined} />
                  <Par nome="Desde a competência" valor={nomeCompetencia(pl.inicioCompetencia!)} apoio={ficha.cliente.referenciaContrato ? `Contrato ${ficha.cliente.referenciaContrato}` : undefined} />
                </>
              ) : <Par nome="Desde" valor={formatarData(pl.desde)} />}
            </div>
          ) : (
            <Aviso tom="neutro">Ainda sem plano. {contrata ? "Defina o nome, a faixa e o vencimento; o valor pode ficar a definir." : "Quem define é a Administração."}</Aviso>
          )}
        </Cartao>

        {d.cobrancas ? (
          <Cartao id="t-pagamentos" titulo="Pagamentos" icone="dinheiro"
            acao={<Link href="/pagamentos" className="t-apoio font-semibold text-violeta-600 hover:underline">Ver todos</Link>}>
            <p className="t-apoio text-tinta-suave">Só a equipe vê. Nada é cobrado nem enviado ao cliente pelo sistema.</p>
            {atrasada ? (
              <Aviso tom="atencao" titulo={`${nomeCobranca(atrasada)} em atraso há ${atrasada.diasDeAtraso} ${atrasada.diasDeAtraso === 1 ? "dia" : "dias"}`}>
                {mostrarValor(atrasada.falta)} em aberto de {mostrarValor(atrasada.devido)}. O atraso não bloqueia o condomínio.
              </Aviso>
            ) : null}
            {d.cobrancas.length ? (
              <ul className="grid">
                {d.cobrancas.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/pagamentos/${id}/${c.id}`} className="flex min-h-[52px] items-center gap-3 border-t border-linha py-2 hover:text-violeta-600">
                      <span className="grid flex-1">
                        <span className="t-texto font-medium">{nomeCobranca(c)}</span>
                        <span className="t-apoio text-tinta-suave">{c.tipo === "IMPLANTACAO" ? c.referencia : "Mensalidade"} · {mostrarValor(c.devido)} · vence {mostrarDataSemHora(c.venceEm)}</span>
                      </span>
                      <span className="flex flex-wrap justify-end gap-1.5"><SeloCobranca c={c} /></span>
                      <Icone nome="dir" className="h-[18px] w-[18px] shrink-0 text-tinta-suave" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhuma cobrança ainda. A do mês nasce quando o Financeiro abre a competência, em Pagamentos.</p>}
          </Cartao>
        ) : null}
      </div>

      {janela?.tipo === "liberar" ? <JanelaLiberar {...comuns} c={janela.conjunto} sindico={ficha.sindicos[0]?.nome} /> : null}
      {janela?.tipo === "teste" ? <JanelaTeste {...comuns} c={janela.conjunto} /> : null}
      {janela?.tipo === "suspender" ? <JanelaSuspender {...comuns} c={janela.conjunto} /> : null}
      {janela?.tipo === "contratar" || janela?.tipo === "descontratar" ? <JanelaContrato {...comuns} c={janela.conjunto} contratar={janela.tipo === "contratar"} /> : null}
      {janela?.tipo === "plano" ? <JanelaPlano {...comuns} plano={pl} unidadesAtivas={d.unidadesAtivas} /> : null}
    </div>
  );
}

interface PropsJanela {
  condominio: string;
  aoFechar: () => void;
  feito: (texto: string) => void;
  recarregar: () => void;
}

/** Envia e devolve o erro, se houver; dá certo, avisa e recarrega. */
function useEnviar(p: PropsJanela) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(caminho: string, corpo: unknown, texto: string, metodo: "POST" | "PUT" = "POST") {
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${p.condominio}${caminho}`, { metodo, corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    p.feito(texto);
  }
  return { erro, enviando, enviar };
}

function CabecaConjunto({ c, apoio }: { c: ConjuntoCliente; apoio: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_CONJUNTO[c.codigo] ?? "camadas"} /></span>
      <span className="grid"><span className="t-texto font-semibold">{c.nome}</span><span className="t-apoio text-tinta-suave">{apoio}</span></span>
    </div>
  );
}

/** Liberar com a prévia do que o síndico passa a ter (PI-19). */
function JanelaLiberar(p: PropsJanela & { c: ConjuntoCliente; sindico?: string }) {
  const { c } = p;
  const [referencia, setReferencia] = useState(c.contratoReferencia ?? "");
  const [motivo, setMotivo] = useState("");
  const { erro, enviando, enviar } = useEnviar(p);
  const campos = camposComErro(erro);
  return (
    <Dialogo aberto media titulo={`Liberar ${c.nome}`} apoio="Fica registrado com quem liberou, quando, a referência e o motivo." aoFechar={p.aoFechar}>
      <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void enviar(`/conjuntos/${c.codigo}/liberar`, { versao: c.versao, referencia, motivo }, `${c.nome} liberado.`); }}>
        {erro ? <ErroJanela erro={erro} recarregar={p.recarregar} /> : null}
        <CabecaConjunto c={c} apoio={c.contratoReferencia ? `Contratado · ${c.contratoReferencia}` : "Contratado"} />
        <div className="grid gap-2 rounded-2xl border border-violeta-100 bg-violeta-50 p-4">
          <span className="t-texto font-semibold">{sindicoPassa(p.sindico)}</span>
          <ul className="grid list-disc gap-1 pl-5 t-texto">{c.telas.map((t) => <li key={t}>{t}</li>)}</ul>
          <span className="t-apoio text-tinta-suave">Os moradores não veem diferença. As pessoas da equipe do condomínio continuam com as permissões que já têm.</span>
        </div>
        <CampoTexto id="lib-referencia" rotulo="Referência" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120}
          ajuda="O contrato ou aditivo que inclui o conjunto." erro={campos.includes("referencia") ? "Diga o contrato ou aditivo." : null} />
        <CampoAreaTexto id="lib-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        <RodapeJanela aoFechar={p.aoFechar} enviando={enviando} texto={`Liberar ${c.nome}`} />
      </form>
    </Dialogo>
  );
}

const sindicoPassa = (nome?: string) => (nome ? `O que ${nome} passa a ter` : "O que o síndico passa a ter");

/** Teste com data para acabar (até 30 dias) e motivo (B.1, NG-06). */
function JanelaTeste(p: PropsJanela & { c: ConjuntoCliente }) {
  const { c } = p;
  const hoje = hojeBrasilia();
  const [ate, setAte] = useState(somarDias(hoje, 14));
  const [motivo, setMotivo] = useState("");
  const { erro, enviando, enviar } = useEnviar(p);
  const campos = camposComErro(erro);
  return (
    <Dialogo aberto media titulo="Liberar para teste" apoio="Uma exceção com regra: data para acabar, motivo e registro." aoFechar={p.aoFechar}>
      <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void enviar(`/conjuntos/${c.codigo}/teste`, { versao: c.versao, ate, motivo }, `${c.nome} em teste até ${mostrarDataSemHora(ate)}.`); }}>
        {erro ? <ErroJanela erro={erro} recarregar={p.recarregar} /> : null}
        <CabecaConjunto c={c} apoio={c.estado === "SUSPENSO" || testeAcabou(c) ? "Suspenso" : "Fora do plano"} />
        <CampoTexto id="teste-ate" type="date" rotulo="Termina em" value={ate} min={somarDias(hoje, 1)} max={somarDias(hoje, 30)} onChange={(e) => setAte(e.target.value)}
          ajuda="Até 30 dias. Ao terminar, fica só para consultar, sozinho." erro={campos.includes("ate") ? "O teste termina entre amanhã e daqui a 30 dias." : null} />
        <CampoAreaTexto id="teste-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        <Aviso tom="info" titulo="O que fica depois do teste">O que a síndica criar continua guardado e dá para consultar. Para criar coisas novas, o conjunto precisa ser contratado.</Aviso>
        <RodapeJanela aoFechar={p.aoFechar} enviando={enviando} texto="Liberar para teste" icone="relogio" />
      </form>
    </Dialogo>
  );
}

/** Suspender ou encerrar o teste sem perder o histórico (C.1, PI-16). */
function JanelaSuspender(p: PropsJanela & { c: ConjuntoCliente }) {
  const { c } = p;
  const teste = c.estado === "TESTE";
  const [porque, setPorque] = useState<MotivoSuspensao | null>(teste ? "TESTE_ENCERRADO" : null);
  const [motivo, setMotivo] = useState("");
  const { erro, enviando, enviar } = useEnviar(p);
  const campos = camposComErro(erro);
  const titulo = teste ? `Encerrar o teste de ${c.nome}` : `Suspender ${c.nome}`;
  return (
    <Dialogo aberto media titulo={titulo} apoio="O histórico continua consultável e exportável." aoFechar={p.aoFechar}>
      <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void enviar(`/conjuntos/${c.codigo}/suspender`, { versao: c.versao, porque, motivo }, teste ? "Teste encerrado." : `${c.nome} suspenso.`); }}>
        {erro ? <ErroJanela erro={erro} recarregar={p.recarregar} /> : null}
        <CabecaConjunto c={c} apoio={teste ? `Em teste até ${mostrarDataSemHora(c.testeAte!)}` : `Liberado desde ${formatarData(c.liberadoEm!)}`} />
        {teste ? null : (
          <EscolhaBotoes nome="porque" legenda="Por quê" valor={porque} aoMudar={setPorque}
            opcoes={(["CONTRATO_ENCERRADO", "PEDIDO_CLIENTE", "OUTRO"] as const).map((v) => ({ valor: v, texto: MOTIVOS_SUSPENSAO[v] }))}
            ajuda={campos.includes("porque") ? <span className="text-erro">Escolha por quê.</span> : undefined} />
        )}
        <CampoAreaTexto id="susp-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
        <Aviso tom="info" titulo="Nada se perde">A síndica continua vendo e exportando o que já existe; só não cria nada novo. Para voltar, libere de novo.</Aviso>
        <RodapeJanela aoFechar={p.aoFechar} enviando={enviando} texto={teste ? "Encerrar teste" : `Suspender ${c.nome}`} icone="pausa" perigo />
      </form>
    </Dialogo>
  );
}

/** Contratado ou não (só Administração). Tirar do contrato o que está liberado suspende. */
function JanelaContrato(p: PropsJanela & { c: ConjuntoCliente; contratar: boolean }) {
  const { c, contratar } = p;
  const [texto, setTexto] = useState("");
  const { erro, enviando, enviar } = useEnviar(p);
  const campos = camposComErro(erro);
  const ativo = c.estado === "LIBERADO" || (c.estado === "TESTE" && !testeAcabou(c));
  return (
    <Dialogo aberto media titulo={contratar ? `Contratar ${c.nome}` : `Tirar ${c.nome} do contrato`}
      apoio={contratar ? "Contratar não libera: a liberação é um passo à parte, com motivo." : "O que já existe continua para consultar e exportar."} aoFechar={p.aoFechar}>
      <form className="grid gap-4" onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void enviar(`/conjuntos/${c.codigo}/contrato`, contratar ? { versao: c.versao, contratado: true, referencia: texto } : { versao: c.versao, contratado: false, motivo: texto },
          contratar ? `${c.nome} contratado. Falta liberar.` : `${c.nome} fora do contrato.`, "PUT");
      }}>
        {erro ? <ErroJanela erro={erro} recarregar={p.recarregar} /> : null}
        <CabecaConjunto c={c} apoio={c.resumo} />
        {contratar ? (
          <CampoTexto id="ct-referencia" rotulo="Contrato ou aditivo" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={120}
            erro={campos.includes("referencia") ? "Diga o contrato ou aditivo." : null} />
        ) : (
          <>
            <CampoAreaTexto id="ct-motivo" rotulo="Motivo" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={3}
              erro={campos.includes("motivo") ? "Diga o motivo, com pelo menos 3 letras." : null} />
            {ativo ? <Aviso tom="atencao">Ele está em uso agora: sai do contrato e fica suspenso, com consulta e exportação.</Aviso> : null}
          </>
        )}
        <RodapeJanela aoFechar={p.aoFechar} enviando={enviando} texto={contratar ? "Contratar" : "Tirar do contrato"} perigo={!contratar} />
      </form>
    </Dialogo>
  );
}

/** A frase da caixa "Pela tabela": o que a tabela sugere, a vaga de fundador e até quando vale. */
function fraseSugestao(s: SugestaoPlano): string {
  if (!s.faixa) return "";
  if (s.sobConsulta) return "Acima de 400 unidades, sob consulta: preenche Valor a definir.";
  const anual = s.ciclo === "ANUAL";
  const impl = s.implantacaoSemCobranca ? (anual ? "implantação isenta" : "implantação sem custo") : `implantação ${mostrarValor(s.implantacao)}`;
  const base = `${s.tabela ? NOMES_TABELA[s.tabela] : s.nome} ${mostrarValor(s.valor)} por ${anual ? "ano" : "mês"}, ${impl}.`;
  if (!s.fundador || s.tabela !== "FUNDADOR") return base;
  const ate = s.fundador.ate ? ` Fundador até ${nomeCompetencia(s.fundador.ate)}.` : "";
  const vaga = s.fundador.posicao ? ` Este ${s.fundador.jaOcupa ? "é" : "seria"} o ${s.fundador.posicao}º fundador de ${s.fundador.vagas}.` : "";
  return `${base}${ate}${vaga}`;
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** O plano do cliente: faixa, valor que pode ficar vazio, ciclo, vencimento e implantação. Com a
 * tabela de preços (0295), "Usar a tabela" preenche os campos sem gravar; nada muda até Salvar. */
function JanelaPlano(p: PropsJanela & { plano?: PlanoDaFicha["plano"]; unidadesAtivas: number }) {
  const pl = p.plano && "ciclo" in p.plano ? p.plano : undefined;
  const veTabela = useSessao().acoes.includes("console.precos.ver");
  const [f, setF] = useState({
    nome: p.plano?.nome ?? "", de: pl?.unidadesDe?.toString() ?? "", ate: pl?.unidadesAte?.toString() ?? "", valor: campoDosCentavos(pl?.valor),
    ciclo: (pl?.ciclo ?? "MENSAL") as CicloPlano, dia: String(pl?.diaVencimento ?? 10), impl: campoDosCentavos(pl?.implantacaoValor),
    semCobranca: pl?.implantacaoSemCobranca ?? true, implRef: pl?.implantacaoReferencia ?? "", inicio: (pl?.inicioCompetencia ?? `${hojeBrasilia().slice(0, 7)}-01`).slice(0, 7),
  });
  const [tabela, setTabela] = useState<OrigemPlano>(pl?.tabelaOrigem ?? "MANUAL");
  // A sugestão usada: com ela, trocar o ciclo busca de novo. Mexer à mão num valor solta a tabela.
  const [usada, setUsada] = useState<SugestaoPlano | null>(null);
  const [erroTabela, setErroTabela] = useState<string | null>(null);
  const inicio = /^\d{4}-\d{2}$/.test(f.inicio) ? `${f.inicio}-01` : undefined;
  const carga = useCarregar<Record<string, unknown>>(veTabela ? ROTAS_PRECOS.sugestao(p.condominio, f.ciclo, inicio) : null);
  const sugestao = carga.estado === "pronto" ? lerSugestao(carga.dados) : null;
  const [local, setLocal] = useState<Record<string, string>>({});
  const { erro, enviando, enviar } = useEnviar(p);
  const campos = camposComErro(erro);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const mudaValor = (k: "de" | "ate" | "valor" | "impl") => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setTabela("MANUAL"); setUsada(null); };
  const erroDe = (k: string, texto: string) => local[k] ?? (campos.includes(k) ? texto : null);

  function aplicar(s: SugestaoPlano) {
    setF((x) => ({
      ...x, nome: s.nome || x.nome, de: String(s.unidadesDe ?? s.faixa?.unidadesDe ?? ""), ate: (s.unidadesAte ?? (s.unidadesDe === undefined ? s.faixa?.unidadesAte : undefined))?.toString() ?? "",
      valor: campoDosCentavos(s.valor), ciclo: s.ciclo,
      semCobranca: s.implantacaoSemCobranca, impl: s.implantacaoSemCobranca ? "" : campoDosCentavos(s.implantacao),
    }));
    setTabela(s.sobConsulta || !s.tabela ? "MANUAL" : s.tabela);
    setUsada(s);
    setLocal({});
    setErroTabela(null);
  }

  async function mudarCiclo(ciclo: CicloPlano) {
    setF((x) => ({ ...x, ciclo }));
    if (!usada) {
      // Sem a sugestão aberta, o valor não acompanha o ciclo novo (o mensal viraria o anual):
      // deixa de ser o da tabela e vai como manual.
      if (ciclo !== f.ciclo && tabela !== "MANUAL") setTabela("MANUAL");
      return;
    }
    const r = await chamarApi<Record<string, unknown>>(ROTAS_PRECOS.sugestao(p.condominio, ciclo, inicio));
    if (!r.ok) { setErroTabela(textoDoErro(r.erro)); setUsada(null); setTabela("MANUAL"); return; }
    aplicar(lerSugestao(r.dados));
  }

  function salvar(ev: FormEvent) {
    ev.preventDefault();
    const valor = centavosDoCampo(f.valor);
    const impl = f.semCobranca ? { centavos: null } : centavosDoCampo(f.impl);
    const erros: Record<string, string> = {};
    if ("erro" in valor) erros.valor = valor.erro;
    if ("erro" in impl) erros.implantacaoValor = impl.erro;
    setLocal(erros);
    if ("erro" in valor || "erro" in impl) return;
    const inteiro = (t: string) => (t.trim() ? Number(t) : null);
    void enviar("/plano", {
      versao: pl?.versao ?? null, nome: f.nome, unidadesDe: inteiro(f.de), unidadesAte: inteiro(f.ate), valor: valor.centavos, ciclo: f.ciclo,
      diaVencimento: Number(f.dia), implantacaoValor: impl.centavos, implantacaoSemCobranca: f.semCobranca, implantacaoReferencia: f.implRef,
      inicioCompetencia: `${f.inicio}-01`, tabela,
    }, "Plano salvo.", "PUT");
  }

  const anualSugerido = sugestao?.faixa && sugestao.ciclo === "ANUAL" && sugestao.valor !== undefined ? ` (${nomeFaixa(sugestao.faixa)}: ${mostrarValor(sugestao.valor)} por ano)` : "";
  const fundadorAte = tabela === "FUNDADOR" ? (usada ? usada.fundador?.ate : pl?.fundadorAte) : undefined;
  const mesesAnual = sugestao?.mesesPagosAnual ?? usada?.mesesPagosAnual;

  return (
    <Dialogo aberto media titulo="Plano do cliente" apoio="Interno. Só a Administração muda o plano e o contrato." aoFechar={p.aoFechar}>
      <form className="grid gap-4" onSubmit={salvar} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} recarregar={p.recarregar} /> : null}
        {veTabela ? (
          <section aria-label="Pela tabela" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-violeta-200 bg-violeta-100 px-4 py-3.5">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="t-texto font-semibold">
                  {sugestao?.faixa ? `Pela tabela: ${sugestao.unidadesAtivas} unidades ativas, faixa ${minuscula(nomeFaixa(sugestao.faixa))}` : sugestao ? `Pela tabela: ${sugestao.unidadesAtivas} unidades ativas` : "Pela tabela"}
                </span>
                <span className="t-apoio">
                  {carga.estado === "carregando" ? "Lendo a tabela de preços…" : carga.estado === "erro" ? `Não deu para ler a tabela: ${carga.texto}` : sugestao ? fraseSugestao(sugestao) : ""}
                </span>
              </span>
              <Botao variante="contorno" disabled={!sugestao?.faixa} onClick={() => sugestao && aplicar(sugestao)}><Icone nome="etiqueta" />Usar a tabela</Botao>
            </div>
            {sugestao?.avisos.filter((a) => a in AVISOS_SUGESTAO).map((a) => (
              <Aviso key={a} tom={a === "SEM_VAGA_FUNDADOR" || a === "FUNDADOR_SO_MENSAL" ? "atencao" : "info"}>{AVISOS_SUGESTAO[a]}</Aviso>
            ))}
            {erroTabela ? <Aviso tom="erro" papel="alert">{erroTabela}</Aviso> : null}
          </section>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto id="pl-nome" rotulo="Nome do plano" value={f.nome} onChange={muda("nome")} maxLength={60} ajuda="O síndico vê este nome em Meu plano."
            erro={erroDe("nome", "Diga o nome do plano.")} />
          <CampoTexto id="pl-ativas" rotulo="Unidades ativas hoje" value={String(p.unidadesAtivas)} readOnly ajuda="Só unidades cadastradas e ativas." />
          <CampoTexto id="pl-de" rotulo="Faixa de unidades, de" inputMode="numeric" value={f.de} onChange={mudaValor("de")} opcional
            erro={erroDe("unidadesDe", "A faixa de unidades não fecha.")} />
          <CampoTexto id="pl-ate" rotulo="até" inputMode="numeric" value={f.ate} onChange={mudaValor("ate")} opcional ajuda="Vazio quando não há limite."
            erro={erroDe("unidadesAte", "A faixa de unidades não fecha.")} />
          <CampoTexto id="pl-valor" rotulo={f.ciclo === "ANUAL" ? "Valor por ano" : "Valor por mês"} inputMode="decimal" value={f.valor} onChange={mudaValor("valor")} opcional
            ajuda="No anual vira Valor por ano. Vazio fica Valor a definir." erro={erroDe("valor", "Use um valor maior que zero ou deixe vazio.")} />
          <CampoTexto id="pl-dia" rotulo="Dia do vencimento" inputMode="numeric" value={f.dia} onChange={muda("dia")}
            erro={erroDe("diaVencimento", "Do dia 1 ao 28.")} />
        </div>
        <EscolhaBotoes nome="ciclo" legenda="Ciclo" valor={f.ciclo} aoMudar={(v) => void mudarCiclo(v)}
          opcoes={(Object.keys(CICLOS_PLANO) as CicloPlano[]).map((v) => ({ valor: v, texto: CICLOS_PLANO[v] }))}
          ajuda={veTabela
            ? `Fundador é só mensal. Na tabela cheia anual, a tabela sugere ${mesesAnual ?? 11} vezes o mês${anualSugerido} e a implantação isenta. No anual, uma cobrança por ano, no mês em que o plano começa.`
            : "No anual, uma cobrança por ano, no mês em que o plano começa."} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={f.semCobranca} onChange={(e) => { setF((x) => ({ ...x, semCobranca: e.target.checked })); setTabela("MANUAL"); setUsada(null); }}
            className="h-5 w-5 accent-violeta-600" />
          <span className="t-texto">Implantação sem cobrança</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {f.semCobranca ? null : (
            <CampoTexto id="pl-impl" rotulo="Implantação, valor" inputMode="decimal" value={f.impl} onChange={mudaValor("impl")}
              ajuda="Vazio fica Valor a definir." erro={erroDe("implantacaoValor", "Use um valor maior que zero.")} />
          )}
          <CampoTexto id="pl-implref" rotulo="Referência do serviço" value={f.implRef} onChange={muda("implRef")} maxLength={120} opcional />
          <CampoTexto id="pl-inicio" type="month" rotulo="Começa na competência" value={f.inicio} onChange={muda("inicio")}
            erro={erroDe("inicioCompetencia", "Diga a competência em que o plano começa.")} />
          {fundadorAte ? (
            <CampoTexto id="pl-fundador-ate" rotulo="Preço de fundador até" value={nomeCompetencia(fundadorAte)} readOnly
              ajuda="Nada é cobrado nem enviado ao cliente pelo sistema." />
          ) : null}
        </div>
        <p className="t-apoio text-tinta-suave">
          {veTabela ? "“Usar a tabela” só preenche os campos; nada muda até Salvar. Você pode ajustar qualquer valor antes. Mudar a tabela depois não mexe neste plano. Acima de 400 unidades, preenche Valor a definir. " : ""}
          Mudar o plano vale para as competências que ainda não foram abertas; as já abertas se corrigem por ajuste, com motivo.
        </p>
        <RodapeJanela aoFechar={p.aoFechar} enviando={enviando} texto="Salvar o plano" />
      </form>
    </Dialogo>
  );
}
