"use client";
// Nova proposta e versão nova (quadro 325, CM-06, CM-07, CM-16, CM-19, CM-27 e CM-28): a faixa e os
// valores saem da Tabela de preços pela sugestão da api-console, que não grava nada; não existe
// cálculo de preço na tela (H.1). As unidades vêm da ficha do prédio. Acima de 400 unidades a
// proposta fica sob consulta e o valor é digitado com motivo. O texto do incluído e do planejado
// vem pronto (EM-07). Desconto pede motivo e a aprovação da Administração antes de enviar (F.1).
// A nota interna fica só para a equipe (CM-12). Quem vê a Tabela de preços abre o simulador já
// com as unidades do prédio.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { custoPorApartamento, mensalComDesconto, mostrarValor, sugestaoPropostaSchema, TEMAS_RESPOSTA, ESCOPOS_REFERENCIA } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Cartao, Voltar } from "../comum.tsx";
import { campoDosCentavos, centavosDoCampo } from "../planos/comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import {
  AVISOS_PROPOSTA, percentual, ROTAS_PROPOSTAS, TELAS_PROPOSTAS, textoImplantacao, textoNoAno, textoVaiJunto, type Ciclo, type FichaProposta, type Sugestao,
  type VersaoProposta,
} from "./propostas.ts";

const brl = (c?: number) => mostrarValor(c ?? null);
const dataCurta = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Uma opção em cartão (Mensal, Anual, Fundador, Cheia): um rádio com o nome e o apoio. */
function Opcao({ nome, valor, marcada, desligada, aoMarcar, titulo, apoio }: {
  nome: string; valor: string; marcada: boolean; desligada?: boolean; aoMarcar: () => void; titulo: string; apoio: string;
}) {
  return (
    <label className={`grid cursor-pointer gap-1 rounded-[14px] border px-4 py-3.5 ${marcada ? "border-2 border-violeta-600 bg-violeta-50" : "border-linha bg-superficie hover:border-violeta-300"} ${desligada ? "cursor-not-allowed opacity-60" : ""}`}>
      <span className="flex items-center gap-2">
        <input type="radio" name={nome} value={valor} checked={marcada} disabled={desligada} onChange={aoMarcar} className="h-5 w-5 shrink-0 accent-violeta-600" />
        <span className="t-texto font-semibold">{titulo}</span>
      </span>
      <span className="t-apoio">{apoio}</span>
    </label>
  );
}

/** Uma linha do resumo: o nome à esquerda e o que vai na proposta. */
function Linha({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t border-linha py-3 first:border-t-0 md:grid-cols-[150px_minmax(0,1fr)] md:gap-4">
      <dt className="t-apoio text-tinta-suave">{nome}</dt>
      <dd className="t-texto [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

interface Formulario {
  unidades: string;
  ciclo: Ciclo;
  tabela: "FUNDADOR" | "CHEIA" | null;
  desconto: string;
  descontoMotivo: string;
  valorManual: string;
  implantacaoManual: string;
  valorManualMotivo: string;
  respostas: string[];
  referencias: string[];
  notaInterna: string;
  validadeDias: number | null;
}

const vazio: Formulario = {
  unidades: "", ciclo: "MENSAL", tabela: null, desconto: "", descontoMotivo: "", valorManual: "", implantacaoManual: "", valorManualMotivo: "",
  respostas: [], referencias: [], notaInterna: "", validadeDias: null,
};

/** A versão em que a nova se baseia (ou o rascunho que se edita) → o formulário. */
function formularioDe(v: VersaoProposta): Formulario {
  const pedido = v.descontoPedido?.percentual ?? v.desconto;
  return {
    unidades: v.unidades ? String(v.unidades) : "", ciclo: v.ciclo, tabela: v.tabela === "MANUAL" ? null : v.tabela ?? null,
    desconto: pedido ? String(pedido).replace(".", ",") : "", descontoMotivo: v.descontoPedido?.motivo ?? "",
    valorManual: v.tabela === "MANUAL" ? campoDosCentavos(v.mensalTabela ?? v.mensal) : "", implantacaoManual: v.tabela === "MANUAL" ? campoDosCentavos(v.implantacao) : "",
    valorManualMotivo: v.valorManualMotivo ?? "",
    respostas: (v.respostas ?? []).map((r) => r.id).filter((x): x is string => !!x), referencias: (v.referencias ?? []).filter((r) => !r.retirada).map((r) => r.id),
    notaInterna: v.notaInterna ?? "", validadeDias: v.validadeDias ?? null,
  };
}

const lerDesconto = (t: string): number | null | "erro" => {
  if (!t.trim()) return null;
  const n = Number(t.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 && n < 100 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? n : "erro";
};
const lerUnidades = (t: string): number | null | "erro" => {
  if (!t.trim()) return null;
  const n = Number(t.trim());
  return Number.isInteger(n) && n >= 1 && n <= 20000 ? n : "erro";
};

type Modo = { tipo: "criar"; interessadoId: string } | { tipo: "versao"; ficha: FichaProposta; base: VersaoProposta; editar: boolean };

/** Página de Nova proposta: ?interessado=<id>. */
export function NovaProposta() {
  const busca = useSearchParams();
  const interessado = busca.get("interessado");
  if (!interessado) {
    return (
      <div className="grid gap-4">
        <Voltar href="/comercial/propostas" texto="Voltar às propostas" />
        <Aviso tom="atencao">Abra a nova proposta pela ficha do interessado ou pelo botão Nova proposta da lista.</Aviso>
      </div>
    );
  }
  return <Gerador modo={{ tipo: "criar", interessadoId: interessado }} />;
}

/** Página de versão nova ou de editar o rascunho: /comercial/propostas/<id>/versao[?editar=<versão>]. */
export function VersaoNovaProposta() {
  const { id } = useParams<{ id: string }>();
  const editar = useSearchParams().get("editar");
  const carga = useCarregar<FichaProposta>(ROTAS_PROPOSTAS.proposta(id));
  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a proposta…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href="/comercial/propostas" texto="Voltar às propostas" />
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }
  const f = carga.dados;
  const base = (editar ? f.versoes.find((v) => v.id === editar) : undefined) ?? f.versoes[0];
  if (!base) return <Aviso tom="erro">Esta proposta não tem versão.</Aviso>;
  return <Gerador modo={{ tipo: "versao", ficha: f, base, editar: !!editar && base.id === editar }} />;
}

function Gerador({ modo }: { modo: Modo }) {
  const router = useRouter();
  const sessao = useSessao();
  const interessadoId = modo.tipo === "criar" ? modo.interessadoId : modo.ficha.interessado.id;
  const [f, setF] = useState<Formulario>(() => (modo.tipo === "versao" ? formularioDe(modo.base) : vazio));
  const [sug, setSug] = useState<Sugestao | null>(null);
  const [erroSug, setErroSug] = useState<ErroApi | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [falhaLocal, setFalhaLocal] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const muda = (p: Partial<Formulario>) => setF((x) => ({ ...x, ...p }));

  const unidades = lerUnidades(f.unidades);
  const desconto = lerDesconto(f.desconto);
  const valorManual = centavosDoCampo(f.valorManual);
  const implantacaoManual = centavosDoCampo(f.implantacaoManual);
  const pedidoSug = useMemo(() => sugestaoPropostaSchema.safeParse({
    interessadoId, unidades: typeof unidades === "number" ? unidades : null, ciclo: f.ciclo, tabela: f.tabela,
    desconto: typeof desconto === "number" ? desconto : null,
    valorManual: "centavos" in valorManual ? valorManual.centavos : null, implantacaoManual: "centavos" in implantacaoManual ? implantacaoManual.centavos : null,
  }), [interessadoId, unidades, f.ciclo, f.tabela, desconto, valorManual, implantacaoManual]);
  const chaveSug = pedidoSug.success ? JSON.stringify(pedidoSug.data) : null;

  // A sugestão a cada mudança, com uma pausa curta: não grava nada.
  useEffect(() => {
    if (!chaveSug) return;
    const controle = new AbortController();
    const t = setTimeout(() => {
      void chamarApi<Sugestao>(ROTAS_PROPOSTAS.sugestao, { corpo: JSON.parse(chaveSug), sinal: controle.signal }).then((r) => {
        if (controle.signal.aborted) return;
        if (!r.ok) return setErroSug(r.erro);
        setSug(r.dados);
        setErroSug(null);
        // As unidades da ficha do prédio entram no campo vazio (CM-16).
        const daFicha = r.dados.interessado.unidades;
        if (daFicha) setF((x) => (x.unidades ? x : { ...x, unidades: String(daFicha) }));
      });
    }, 250);
    return () => { clearTimeout(t); controle.abort(); };
  }, [chaveSug]);

  const daFicha = sug?.interessado.unidades;

  if (!sug) {
    if (erroSug) {
      return (
        <div className="grid gap-4">
          <Voltar href={`/comercial/${interessadoId}`} texto="Voltar ao interessado" />
          <ErroCarregar erro={erroSug} texto={textoDoErro(erroSug)} />
        </div>
      );
    }
    return <Carregando rotulo="Buscando os valores da Tabela de preços…" />;
  }

  const s = sug;
  const campos = camposComErro(erro);
  const sobConsulta = s.avisos.includes("SOB_CONSULTA") || s.tabela === "MANUAL";
  const temDesconto = typeof desconto === "number";
  const jaTem = modo.tipo === "criar" && s.propostaId ? s.propostaId : null;
  const vagas = s.vagasFundador;
  const semVaga = !!vagas && vagas.livres <= 0;
  const tabelaUsada = s.tabela ?? f.tabela ?? s.tabelaEmUso ?? "CHEIA";
  // Enquanto digita, a conta da tela usa as funções do domínio; o valor que vale é o do banco.
  const mensalPrevisto = s.mensalTabela !== undefined ? mensalComDesconto(s.mensalTabela, temDesconto ? desconto : null) : s.mensal;
  const apPrevisto = mensalPrevisto !== undefined && typeof unidades === "number" ? custoPorApartamento(mensalPrevisto, unidades) : s.porApartamento;
  const escolhidasResp = (s.respostas ?? []).filter((r) => f.respostas.includes(r.id));
  const escolhidasRef = (s.referencias ?? []).filter((r) => f.referencias.includes(r.id));
  const condominio = s.interessado.condominio;
  const titulo = modo.tipo === "criar" ? "Nova proposta" : modo.editar ? `Editar o rascunho v${modo.base.numero}` : "Versão nova";
  const podeSimular = sessao.acoes.includes("console.precos.ver");

  function corpo() {
    return {
      unidades: typeof unidades === "number" ? unidades : null, ciclo: f.ciclo, tabela: sobConsulta ? null : f.tabela,
      valorManual: sobConsulta && "centavos" in valorManual ? valorManual.centavos : null, valorManualMotivo: sobConsulta ? f.valorManualMotivo.trim() || null : null,
      implantacaoManual: sobConsulta && f.ciclo === "MENSAL" && "centavos" in implantacaoManual ? implantacaoManual.centavos : null,
      desconto: temDesconto ? desconto : null, descontoMotivo: temDesconto ? f.descontoMotivo.trim() || null : null,
      respostas: f.respostas.filter((id) => (s.respostas ?? []).some((r) => r.id === id)),
      referencias: f.referencias.filter((id) => (s.referencias ?? []).some((r) => r.id === id)),
      notaInterna: f.notaInterna.trim() || null, validadeDias: f.validadeDias,
    };
  }

  function conferir(): boolean {
    const falhas: Record<string, string> = {};
    if (unidades === "erro" || unidades === null) falhas.unidades = "Digite as unidades ativas, de 1 a 20.000.";
    if (desconto === "erro") falhas.desconto = "Desconto de 0,01% a 99,99%, com até duas casas.";
    if (temDesconto && !f.descontoMotivo.trim()) falhas.descontoMotivo = "Diga por que o desconto. Vai só para a Administração.";
    if (sobConsulta && !("centavos" in valorManual && valorManual.centavos)) falhas.valorManual = "Digite o valor combinado, como 1.290,00.";
    if (sobConsulta && !f.valorManualMotivo.trim()) falhas.valorManualMotivo = "Diga de onde veio o valor.";
    if ("erro" in implantacaoManual) falhas.implantacaoManual = implantacaoManual.erro;
    setFalhaLocal(falhas);
    return Object.keys(falhas).length === 0;
  }

  async function salvar(pedir: boolean) {
    setErro(null);
    if (!conferir()) return;
    setEnviando(true);
    let propostaId: string;
    let versaoId: string;
    let registro: number | null = null;
    if (modo.tipo === "criar") {
      const r = await chamarApi<{ id: string; versaoId: string; versao: number }>(ROTAS_PROPOSTAS.criar, { corpo: { interessadoId, ...corpo() } });
      if (!r.ok) { setEnviando(false); return setErro(r.erro); }
      propostaId = r.dados.id; versaoId = r.dados.versaoId; registro = r.dados.versao;
    } else if (modo.editar) {
      const r = await chamarApi<{ id: string; versao: number }>(ROTAS_PROPOSTAS.versao(modo.ficha.id, modo.base.id), { metodo: "PUT", corpo: { versao: modo.base.versaoRegistro, ...corpo() } });
      if (!r.ok) { setEnviando(false); return setErro(r.erro); }
      propostaId = modo.ficha.id; versaoId = modo.base.id; registro = r.dados.versao;
    } else {
      const r = await chamarApi<{ id: string; versaoId: string }>(ROTAS_PROPOSTAS.versoes(modo.ficha.id), { corpo: { versao: modo.ficha.versao, ...corpo() } });
      if (!r.ok) { setEnviando(false); return setErro(r.erro); }
      propostaId = r.dados.id; versaoId = r.dados.versaoId;
    }
    if (pedir) {
      if (registro === null) {
        // Versão nova: a versão de registro dela vem da ficha.
        const fi = await chamarApi<FichaProposta>(ROTAS_PROPOSTAS.proposta(propostaId));
        registro = fi.ok ? fi.dados.versoes.find((v) => v.id === versaoId)?.versaoRegistro ?? null : null;
      }
      const p = registro === null ? null : await chamarApi(ROTAS_PROPOSTAS.acao(propostaId, versaoId, "desconto/pedir"), { corpo: { versao: registro } });
      if (!p?.ok) {
        setEnviando(false);
        return router.push(`${TELAS_PROPOSTAS.lista(propostaId)}&feito=salvo`);
      }
    }
    setEnviando(false);
    router.push(`${TELAS_PROPOSTAS.lista(propostaId)}&feito=${pedir ? "pedido" : "salvo"}`);
  }

  const erroCampo = (nome: string, texto: string) => falhaLocal[nome] ?? (campos.includes(nome) ? texto : undefined);
  const avisos = s.avisos.filter((a) => a !== "SEM_UNIDADES" || !f.unidades);
  const submeter = (ev: FormEvent) => { ev.preventDefault(); void salvar(temDesconto); };

  const resumoMensal = () => {
    if (mensalPrevisto === undefined) return <>Valor a definir na Tabela de preços</>;
    const tabelaTxt = tabelaUsada === "FUNDADOR" ? `, preço de fundador por ${s.fundadorMeses ?? 12} meses${s.depoisFundador ? `; depois ${brl(s.depoisFundador)}` : ""}` : tabelaUsada === "MANUAL" ? ", sob consulta" : ", tabela cheia";
    const ano = textoNoAno({ ...s, ciclo: f.ciclo }, mensalPrevisto);
    return (
      <>
        <b>{brl(mensalPrevisto)}</b>{` por mês${tabelaTxt}`}
        {temDesconto && s.mensalTabela !== undefined ? ` · desconto de ${percentual(desconto)} sobre ${brl(s.mensalTabela)}` : ""}
        {ano ? ` · no ano ${ano}` : ""}
      </>
    );
  };

  return (
    <form className="grid gap-5" onSubmit={submeter} noValidate>
      <Voltar href={`/comercial/${interessadoId}`} texto={condominio} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">{titulo}</h1>
          <p className="t-apoio">Os valores vêm da Tabela de preços de hoje. Mudar a tabela depois não muda proposta já enviada.</p>
        </div>
        {podeSimular ? (
          <Link href={`/precos?parte=simular${typeof unidades === "number" ? `&unidades=${unidades}` : ""}`} className={classeBotao("contorno")}>
            <Icone nome="grafico" />Abrir o simulador
          </Link>
        ) : null}
      </div>

      {jaTem ? (
        <Aviso tom="atencao" titulo="Este interessado já tem proposta">
          Abra a proposta e faça uma versão nova; uma proposta por negociação.
          <span className="mt-2 flex flex-wrap gap-2">
            <Link href={TELAS_PROPOSTAS.lista(jaTem)} className={classeBotao("contorno")}><Icone nome="documento" />Abrir a proposta</Link>
            <Link href={TELAS_PROPOSTAS.versaoNova(jaTem)} className={classeBotao("discreto")}><Icone nome="editar" />Fazer versão nova</Link>
          </span>
        </Aviso>
      ) : null}
      {avisos.length ? (
        <Aviso tom="atencao" papel="status">{avisos.map((a) => <span key={a} className="block">{AVISOS_PROPOSTA[a]}</span>)}</Aviso>
      ) : null}
      {erro && !campos.length ? (
        <Aviso tom="erro" papel="alert">
          {textoDoErro(erro)}
          {erro.detalhes?.motivo === "PROPOSTA_EXISTE" && typeof erro.detalhes.propostaId === "string" ? (
            <span className="mt-2 block"><Link href={TELAS_PROPOSTAS.lista(erro.detalhes.propostaId)} className={classeBotao("contorno")}>Abrir a proposta</Link></span>
          ) : null}
          {erro.codigo === "VERSION_CONFLICT" ? <span className="mt-2 block"><Botao variante="contorno" onClick={() => window.location.reload()}>Carregar a versão nova</Botao></span> : null}
        </Aviso>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <Cartao id="np-plano" titulo="Plano" icone="dinheiro">
            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto id="np-condominio" rotulo="Condomínio" value={condominio} readOnly />
              <CampoTexto id="np-unidades" rotulo="Unidades ativas" inputMode="numeric" maxLength={5} value={f.unidades}
                onChange={(e) => muda({ unidades: e.target.value.replace(/\D/g, "") })}
                ajuda={`${daFicha ? "Informadas pelo síndico na ficha do prédio." : "A ficha não tem as unidades: digite as ativas."}${s.faixa ? ` Faixa: ${s.faixa.nome}.` : ""}`}
                erro={erroCampo("unidades", "Digite as unidades ativas, de 1 a 20.000.")} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 t-apoio font-medium">Ciclo</legend>
              <div className="grid gap-3 md:grid-cols-2">
                <Opcao nome="np-ciclo" valor="MENSAL" marcada={f.ciclo === "MENSAL"} aoMarcar={() => muda({ ciclo: "MENSAL" })} titulo="Mensal"
                  apoio={f.ciclo === "MENSAL" && s.mensalTabela !== undefined ? `${brl(s.mensalTabela)} por mês` : "Paga todo mês"} />
                <Opcao nome="np-ciclo" valor="ANUAL" marcada={f.ciclo === "ANUAL"} aoMarcar={() => muda({ ciclo: "ANUAL" })} titulo="Anual"
                  apoio={`12 por ${s.mesesPagos ?? 11} · implantação sem custo`} />
              </div>
            </fieldset>
            {!sobConsulta ? (
              <fieldset className="grid gap-2">
                <legend className="mb-1 t-apoio font-medium">Tabela</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <Opcao nome="np-tabela" valor="FUNDADOR" marcada={tabelaUsada === "FUNDADOR"} desligada={f.ciclo === "ANUAL" || semVaga}
                    aoMarcar={() => muda({ tabela: "FUNDADOR" })} titulo="Fundador"
                    apoio={f.ciclo === "ANUAL" ? "Só no mensal" : vagas ? `${vagas.livres} ${vagas.livres === 1 ? "vaga" : "vagas"} de ${vagas.total} · por ${s.fundadorMeses ?? 12} meses` : `Por ${s.fundadorMeses ?? 12} meses`} />
                  <Opcao nome="np-tabela" valor="CHEIA" marcada={tabelaUsada === "CHEIA"} aoMarcar={() => muda({ tabela: "CHEIA" })} titulo="Cheia"
                    apoio={tabelaUsada === "CHEIA" && s.mensalTabela !== undefined ? `${brl(s.mensalTabela)} por mês` : s.depoisFundador ? `${brl(s.depoisFundador)} por mês` : "Preço cheio da tabela"} />
                </div>
              </fieldset>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <CampoTexto id="np-valor" rotulo="Mensalidade combinada" inputMode="decimal" value={f.valorManual} onChange={(e) => muda({ valorManual: e.target.value })}
                  ajuda="Acima de 400 unidades a tabela diz sob consulta." erro={erroCampo("valorManual", "Digite o valor combinado, como 1.290,00.")} />
                {f.ciclo === "MENSAL" ? (
                  <CampoTexto id="np-implantacao" rotulo="Implantação" opcional inputMode="decimal" value={f.implantacaoManual} onChange={(e) => muda({ implantacaoManual: e.target.value })}
                    erro={erroCampo("implantacaoManual", "Escreva o valor em reais, como 900,00.")} />
                ) : null}
                <CampoTexto id="np-valor-motivo" rotulo="De onde veio o valor" className="md:col-span-2" maxLength={500} value={f.valorManualMotivo}
                  onChange={(e) => muda({ valorManualMotivo: e.target.value })} erro={erroCampo("valorManualMotivo", "Diga de onde veio o valor.")} />
              </div>
            )}
          </Cartao>

          <Cartao id="np-desconto" titulo="Desconto" icone="etiqueta" acao={temDesconto ? <Selo tom="atencao">Precisa de aprovação</Selo> : undefined}>
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <CampoTexto id="np-desconto-pct" rotulo="Desconto na mensalidade (%)" opcional inputMode="decimal" maxLength={6} value={f.desconto}
                onChange={(e) => muda({ desconto: e.target.value })} ajuda="Sobre o valor da tabela." erro={erroCampo("desconto", "Desconto de 0,01% a 99,99%, com até duas casas.")} />
              <CampoTexto id="np-desconto-motivo" rotulo="Motivo" maxLength={500} value={f.descontoMotivo} disabled={!temDesconto} onChange={(e) => muda({ descontoMotivo: e.target.value })}
                ajuda="Vai para a Administração; nunca para o síndico." erro={erroCampo("descontoMotivo", "Diga por que o desconto. Vai só para a Administração.")} />
            </div>
            <p className="t-apoio">A proposta com desconto só pode ser enviada depois que a Administração aprovar (F.1). Sem desconto, envia direto.</p>
          </Cartao>

          <Cartao id="np-junto" titulo="Vai junto" icone="clipe">
            <fieldset className="grid gap-1">
              <legend className="mb-1 t-apoio font-medium">Respostas prontas (CM-27)</legend>
              {(s.respostas ?? []).length ? (s.respostas ?? []).map((r) => (
                <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={f.respostas.includes(r.id)}
                    onChange={(e) => muda({ respostas: e.target.checked ? [...f.respostas, r.id] : f.respostas.filter((x) => x !== r.id) })} />
                  <span className="t-texto">{r.titulo}<span className="t-apoio"> · {TEMAS_RESPOSTA[r.tema] ?? r.tema}</span></span>
                </label>
              )) : <p className="t-apoio">Nenhuma resposta revisada ainda. A Administração revisa em Modelos.</p>}
              {campos.includes("respostas") ? <span className="t-apoio text-erro">Uma resposta escolhida saiu de uso. Confira a lista.</span> : null}
            </fieldset>
            <fieldset className="grid gap-1 border-t border-linha pt-3">
              <legend className="mb-1 t-apoio font-medium">Referências de síndicos (CM-28)</legend>
              {(s.referencias ?? []).length ? (s.referencias ?? []).map((r) => (
                <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-violeta-600" checked={f.referencias.includes(r.id)}
                    onChange={(e) => muda({ referencias: e.target.checked ? [...f.referencias, r.id] : f.referencias.filter((x) => x !== r.id) })} />
                  <span className="t-texto">{`${r.sindico}, ${r.condominio}`}<span className="t-apoio">{` · ${ESCOPOS_REFERENCIA[r.escopo] ?? r.escopo}`}</span></span>
                </label>
              )) : <p className="t-apoio">Nenhuma referência autorizada ainda.</p>}
              {campos.includes("referencias") ? <span className="t-apoio text-erro">Uma referência escolhida teve a autorização retirada. Confira a lista.</span> : null}
            </fieldset>
          </Cartao>

          <Cartao id="np-nota" titulo="Nota interna" icone="cadeado">
            <CampoAreaTexto id="np-nota-texto" rotulo="Só para a equipe" opcional maxLength={1000} value={f.notaInterna} onChange={(e) => muda({ notaInterna: e.target.value })}
              ajuda="Nunca vai na proposta, no link, no PDF nem no kit (CM-12)." />
          </Cartao>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <section aria-labelledby="np-resumo" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
            <h2 id="np-resumo" className="t-titulo-cartao">O que vai na proposta</h2>
            <dl className="grid">
              <Linha nome="Mensalidade">{resumoMensal()}</Linha>
              <Linha nome="Implantação">
                {textoImplantacao(s) ? `${textoImplantacao(s)!.replace(/^sem custo$/, "Sem custo")}${s.implantacaoSemCusto ? (f.ciclo === "ANUAL" ? " (anual)" : tabelaUsada === "FUNDADOR" ? " (fundador)" : "") : ""}` : "A combinar"}
              </Linha>
              {tabelaUsada === "FUNDADOR" && vagas ? (
                <Linha nome="Vaga de fundador">{`Sobram ${vagas.livres} de ${vagas.total}. A vaga só é ocupada quando virar cliente.`}</Linha>
              ) : null}
              <Linha nome="O que está incluído">{(s.oferta?.incluido ?? []).join("; ") || "—"}</Linha>
              <Linha nome="Ainda planejado">{`${(s.oferta?.planejado ?? []).join(", ")}. Aparece como planejado, sem data prometida (EM-07).`}</Linha>
              <Linha nome="Por apartamento">
                {apPrevisto !== undefined && apPrevisto !== null && typeof unidades === "number"
                  ? <><b>{brl(apPrevisto)}</b>{` por mês com ${unidades} unidades (estimativa; implantação à parte) (CM-19, L.1)`}</>
                  : "Precisa das unidades e do valor"}
              </Linha>
              <Linha nome="Vai junto">{textoVaiJunto(escolhidasResp.map((r) => r.titulo), escolhidasRef.length)}</Linha>
              <Linha nome="Validade">{`${f.validadeDias ?? s.validadeDias} dias, contados do envio${s.validoAtePrevisto ? `; enviando hoje, até ${dataCurta(s.validoAtePrevisto)}` : ""}`}</Linha>
            </dl>
          </section>
          {modo.tipo === "versao" && !modo.editar ? (
            <p className="t-apoio">{`A v${modo.base.numero} fica como substituída e o link dela para de abrir.`}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 max-md:grid">
            {temDesconto ? (
              <>
                <Botao type="submit" disabled={enviando || !!jaTem}><Icone nome="enviar" />{enviando ? "Salvando…" : "Pedir aprovação do desconto"}</Botao>
                <Botao variante="contorno" disabled={enviando || !!jaTem} onClick={() => void salvar(false)}><Icone nome="check" />Salvar rascunho</Botao>
              </>
            ) : (
              <Botao type="submit" disabled={enviando || !!jaTem}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar rascunho"}</Botao>
            )}
          </div>
          <p className="t-apoio">O envio é na lista de propostas, com o link e o PDF.</p>
        </div>
      </div>
    </form>
  );
}
