"use client";
// As janelas da Tabela de preços (quadros 269 e 270): mudar os valores e os parâmetros com motivo,
// cadastrar ou corrigir o preço de um concorrente com fonte e data e arquivar com motivo. Valor
// vazio fica Valor a definir, nunca zero. Nada aqui muda o plano de quem já é cliente.

import { useState, type FormEvent } from "react";
import { mostrarValor } from "@triade/domain";
import { Aviso, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, type ErroApi } from "@triade/ui";
import {
  campoDosCentavos, centavosDoCampo, corpoConcorrente, corpoFaixa, corpoParametros, EscolhaBotoes, ErroJanela, hojeBrasilia, NOMES_TABELA, nomeFaixa,
  RodapeJanela, ROTAS_PRECOS, type Concorrente, type FaixaConcorrente, type ModeloConcorrente, type TabelaEmUso, type TabelaPrecos,
} from "./comum.tsx";

interface PropsJanela {
  aoFechar: () => void;
  feito: (texto: string) => void;
  recarregar: () => void;
}

const MOTIVO_CURTO = "Diga o motivo, com pelo menos 3 letras.";
const igual = (a: number | null, b: number | undefined) => (a ?? undefined) === b;

/** Lê um número inteiro do campo; fora do intervalo vira erro. */
function inteiroDoCampo(texto: string, min: number, max: number): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

/** Mudar a tabela (quadro 269): os valores de cada faixa, a tabela em uso, as vagas, o anual e as parcelas. */
export function JanelaMudarTabela({ d, aoFechar, feito, recarregar }: PropsJanela & { d: TabelaPrecos }) {
  const comValor = d.faixas.filter((f) => !f.sobConsulta);
  const acima = d.faixas.find((f) => f.sobConsulta);
  const [valores, setValores] = useState(() => Object.fromEntries(comValor.map((f) => [f.codigo, {
    fundador: campoDosCentavos(f.fundador), cheia: campoDosCentavos(f.cheia), implantacao: campoDosCentavos(f.implantacao),
  }])));
  const [emUso, setEmUso] = useState<TabelaEmUso>(d.parametros.tabelaEmUso);
  const [meses, setMeses] = useState(String(d.parametros.mesesPagosAnual));
  const [parcelas, setParcelas] = useState(String(d.parametros.parcelasImplantacao));
  const [vagas, setVagas] = useState(String(d.parametros.vagasFundador));
  const [motivo, setMotivo] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const mudaValor = (codigo: string, k: "fundador" | "cheia" | "implantacao") => (e: { target: { value: string } }) =>
    setValores((v) => ({ ...v, [codigo]: { ...v[codigo]!, [k]: e.target.value } }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const erros: Record<string, string> = {};
    const pedidos: { caminho: string; corpo: unknown }[] = [];
    for (const f of comValor) {
      const v = valores[f.codigo]!;
      const lido = { fundador: centavosDoCampo(v.fundador), cheia: centavosDoCampo(v.cheia), implantacao: centavosDoCampo(v.implantacao) };
      for (const [k, r] of Object.entries(lido)) if ("erro" in r) erros[`${f.codigo}.${k}`] = r.erro;
      if ("erro" in lido.fundador || "erro" in lido.cheia || "erro" in lido.implantacao) continue;
      const novo = { fundador: lido.fundador.centavos, cheia: lido.cheia.centavos, implantacao: lido.implantacao.centavos };
      if (!igual(novo.fundador, f.fundador) || !igual(novo.cheia, f.cheia) || !igual(novo.implantacao, f.implantacao)) {
        pedidos.push({ caminho: ROTAS_PRECOS.faixa(f.codigo), corpo: corpoFaixa(f, novo, motivo.trim()) });
      }
    }
    const m = inteiroDoCampo(meses, 1, 12), pa = inteiroDoCampo(parcelas, 1, 12), va = inteiroDoCampo(vagas, d.vagas.usadas, 100);
    if (m === null) erros.mesesPagosAnual = "De 1 a 12 meses.";
    if (pa === null) erros.parcelasImplantacao = "De 1 a 12 parcelas.";
    if (va === null) erros.vagasFundador = `Pelo menos ${d.vagas.usadas}, as vagas já usadas.`;
    if (motivo.trim().length < 3) erros.motivo = MOTIVO_CURTO;
    setLocal(erros);
    setErro(null);
    if (Object.keys(erros).length) return setGeral(null);
    const p = d.parametros;
    if (m !== p.mesesPagosAnual || pa !== p.parcelasImplantacao || va !== p.vagasFundador || emUso !== p.tabelaEmUso) {
      pedidos.push({ caminho: ROTAS_PRECOS.parametros, corpo: corpoParametros({ mesesPagosAnual: m!, parcelasImplantacao: pa!, vagasFundador: va!, tabelaEmUso: emUso }, p.versao, motivo.trim()) });
    }
    if (!pedidos.length) return setGeral("Nada mudou na tabela. Mude um valor ou feche a janela.");
    setGeral(null);
    setEnviando(true);
    for (const [i, pedido] of pedidos.entries()) {
      const r = await chamarApi(pedido.caminho, { metodo: "PUT", corpo: pedido.corpo });
      if (!r.ok) {
        setEnviando(false);
        if (i > 0) recarregar();
        return setErro(r.erro);
      }
    }
    setEnviando(false);
    feito("Tabela salva. Quem já tem plano continua com o valor dele.");
  }

  const erroDe = (k: string, texto: string) => local[k] ?? (campos.includes(k) ? texto : null);
  const caixaFixa = "flex min-h-10 items-center justify-end rounded-[10px] border border-linha bg-superficie-2 px-2.5 t-texto tabular-nums";
  const colunas = "md:grid-cols-[1.1fr_.8fr_1fr_1fr_1fr_1fr]";
  const valor = (f: (typeof comValor)[number], k: "fundador" | "cheia" | "implantacao", rotulo: string) => (
    <CampoTexto id={`mt-${f.codigo}-${k}`} rotulo={rotulo} inputMode="decimal" value={valores[f.codigo]![k]} onChange={mudaValor(f.codigo, k)}
      placeholder="Valor a definir" className="md:[&>label]:sr-only [&_input]:text-right [&_input]:tabular-nums"
      erro={erroDe(`${f.codigo}.${k}`, "Use um valor maior que zero ou deixe vazio.")} />
  );

  return (
    <Dialogo aberto larga titulo="Mudar a tabela de preços" apoio="Só Administração e Financeiro. Cada mudança fica no histórico com quem, quando e o motivo." aoFechar={aoFechar} fechar>
      <form className="grid gap-4" onSubmit={(e) => void salvar(e)} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} recarregar={recarregar} /> : null}
        {geral ? <Aviso tom="atencao" papel="alert">{geral}</Aviso> : null}
        <div className="grid gap-3 md:gap-2">
          <div aria-hidden="true" className={`hidden gap-2.5 md:grid ${colunas}`}>
            {["Faixa", "Até unidades", "Fundador/mês", "Implantação fundador", "Cheia/mês", "Implantação cheia"].map((t) => <span key={t} className="t-rotulo font-semibold">{t}</span>)}
          </div>
          {comValor.map((f) => (
            <div key={f.codigo} role="group" aria-labelledby={`mt-${f.codigo}`}
              className={`grid grid-cols-2 items-start gap-x-2.5 gap-y-2 max-md:rounded-[14px] max-md:border max-md:border-linha max-md:p-3 ${colunas}`}>
              <span id={`mt-${f.codigo}`} className="t-texto font-medium max-md:col-span-2 md:self-center">{nomeFaixa(f)}</span>
              <span className="grid gap-1"><span className="t-apoio font-medium md:sr-only">Até unidades</span><span className={caixaFixa}>{f.unidadesAte}</span></span>
              {valor(f, "fundador", "Fundador/mês")}
              <span className="grid gap-1"><span className="t-apoio font-medium md:sr-only">Implantação fundador</span><span className={`${caixaFixa} text-tinta-suave`}>Sem cobrança</span></span>
              {valor(f, "cheia", "Cheia/mês")}
              {valor(f, "implantacao", "Implantação cheia")}
            </div>
          ))}
          {acima ? (
            <div className={`grid gap-2.5 ${colunas}`}>
              <span className="t-texto font-medium">{nomeFaixa(acima)}</span>
              <span className="t-apoio md:col-span-5">Sob consulta: o plano fica com Valor a definir.</span>
            </div>
          ) : null}
        </div>
        <p className="t-apoio">
          {`Cada campo é um valor: vazio fica “Valor a definir”, nunca zero. Os limites das faixas e a implantação sem custo do fundador são fixos, e as vagas não podem ficar abaixo das já usadas (${d.vagas.usadas}). Os 12 meses do fundador são regra fixa.`}
        </p>
        <EscolhaBotoes nome="tabela-em-uso" legenda="Tabela em uso para plano novo" valor={emUso} aoMudar={setEmUso}
          opcoes={(["FUNDADOR", "CHEIA"] as const).map((v) => ({ valor: v, texto: NOMES_TABELA[v] }))} />
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoTexto id="mt-meses" rotulo="Meses pagos no anual" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} ajuda="de 12"
            erro={erroDe("mesesPagosAnual", "De 1 a 12 meses.")} />
          <CampoTexto id="mt-parcelas" rotulo="Parcelas da implantação" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} ajuda="no plano mensal"
            erro={erroDe("parcelasImplantacao", "De 1 a 12 parcelas.")} />
          <CampoTexto id="mt-vagas" rotulo="Vagas de fundador" inputMode="numeric" value={vagas} onChange={(e) => setVagas(e.target.value)} ajuda={`${d.vagas.usadas} já usadas`}
            erro={erroDe("vagasFundador", `Pelo menos ${d.vagas.usadas}, as vagas já usadas.`)} />
        </div>
        <CampoTexto id="mt-motivo" rotulo="Motivo da mudança" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
          ajuda="Obrigatório. Fica no histórico com o seu nome e a hora." erro={erroDe("motivo", MOTIVO_CURTO)} />
        <Aviso tom="info">Quem já tem plano continua com o valor dele. Para mudar um cliente, abra o plano dele e use <b>Usar a tabela</b>.</Aviso>
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a tabela" />
      </form>
    </Dialogo>
  );
}

const MODELOS: { valor: ModeloConcorrente; texto: string }[] = [
  { valor: "FIXO", texto: "Preço fixo" }, { valor: "FAIXA", texto: "Por faixa" }, { valor: "POR_UNIDADE", texto: "Por unidade" },
];
const DEGRAUS = 4;

/** Cadastrar ou corrigir o preço de um concorrente, à mão, com fonte e data (quadro 270). */
export function JanelaConcorrente({ c, aoFechar, feito, recarregar }: PropsJanela & { c?: Concorrente }) {
  const [nome, setNome] = useState(c?.nome ?? "");
  const [modelo, setModelo] = useState<ModeloConcorrente>(c?.modelo ?? "FIXO");
  const [valor, setValor] = useState(campoDosCentavos(c?.valor));
  const [aPartirDe, setAPartirDe] = useState(c?.aPartirDe ?? false);
  const [porUnidade, setPorUnidade] = useState(campoDosCentavos(c?.porUnidade));
  const [minimo, setMinimo] = useState(campoDosCentavos(c?.minimo));
  const [degraus, setDegraus] = useState(() => Array.from({ length: DEGRAUS }, (_, i) => ({
    ate: c?.faixas[i]?.ate?.toString() ?? "", valor: campoDosCentavos(c?.faixas[i]?.valor),
  })));
  const [fonte, setFonte] = useState(c?.fonte ?? "");
  const [lidoEm, setLidoEm] = useState(c?.lidoEm ?? hojeBrasilia());
  const [conferido, setConferido] = useState(c?.conferido ?? true);
  const [motivo, setMotivo] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const erroDe = (k: string, texto: string) => local[k] ?? (campos.includes(k) ? texto : null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const erros: Record<string, string> = {};
    const ler = (k: string, t: string, obrigatorio: boolean) => {
      const r = centavosDoCampo(t);
      if ("erro" in r) { erros[k] = r.erro; return undefined; }
      if (r.centavos === null && obrigatorio) erros[k] = "Diga o valor.";
      return r.centavos ?? undefined;
    };
    const fixo = modelo === "FIXO" ? ler("valor", valor, true) : undefined;
    const unidade = modelo === "POR_UNIDADE" ? ler("porUnidade", porUnidade, true) : undefined;
    const min = modelo === "POR_UNIDADE" ? ler("minimo", minimo, false) : undefined;
    const faixas: FaixaConcorrente[] = [];
    if (modelo === "FAIXA") {
      degraus.forEach((g, i) => {
        if (!g.ate.trim() && !g.valor.trim()) return;
        const ate = inteiroDoCampo(g.ate, 1, 999_999_999);
        const v = ler(`faixa${i}`, g.valor, true);
        if (ate === null) erros[`faixa${i}`] = "Diga até quantas unidades, em número.";
        else if (v !== undefined) faixas.push({ ate, valor: v });
      });
      if (!faixas.length && !Object.keys(erros).some((k) => k.startsWith("faixa"))) erros.faixa0 = "Diga pelo menos uma faixa.";
      if (faixas.some((f, i) => i > 0 && f.ate <= faixas[i - 1]!.ate)) erros.faixa0 = "As faixas precisam subir em ordem.";
    }
    if (nome.trim().length < 2) erros.nome = "Diga o nome do concorrente.";
    if (fonte.trim().length < 3) erros.fonte = "Diga de onde saiu o preço.";
    if (!lidoEm || lidoEm > hojeBrasilia()) erros.lidoEm = "Diga quando o preço foi lido (até hoje).";
    if (motivo.trim().length < 3) erros.motivo = MOTIVO_CURTO;
    setLocal(erros);
    if (Object.keys(erros).length) return;
    const corpo = corpoConcorrente({
      // O plano e a observação não têm campo nesta janela: corrigir mantém os que já estavam.
      nome: nome.trim(), plano: c?.plano, observacao: c?.observacao, modelo, valor: fixo, aPartirDe: modelo === "FIXO" && aPartirDe, porUnidade: unidade, minimo: min, faixas,
      conferido, fonte: fonte.trim(), lidoEm,
    }, motivo.trim(), c?.versao);
    setEnviando(true);
    const r = await chamarApi(c ? ROTAS_PRECOS.concorrente(c.id) : ROTAS_PRECOS.concorrentes, { metodo: c ? "PUT" : "POST", corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(c ? `Preço de ${nome.trim()} corrigido.` : `Preço de ${nome.trim()} cadastrado.`);
  }

  return (
    <Dialogo aberto media titulo={c ? `Corrigir o preço de ${c.nome}` : "Cadastrar preço de concorrente"}
      apoio="À mão, com a fonte e a data em que o preço foi lido. Fica no histórico com o motivo." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => void salvar(e)} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} recarregar={recarregar} /> : null}
        <CampoTexto id="cc-nome" rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} erro={erroDe("nome", "Diga o nome do concorrente.")} />
        <EscolhaBotoes nome="cc-modelo" legenda="Como cobra" valor={modelo} aoMudar={setModelo} opcoes={MODELOS} />
        {modelo === "FIXO" ? (
          <>
            <CampoTexto id="cc-valor" rotulo="Preço por mês" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              erro={erroDe("valor", "Use um valor maior que zero.")} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={aPartirDe} onChange={(e) => setAPartirDe(e.target.checked)} className="h-5 w-5 accent-violeta-600" />
              <span className="t-texto">O site diz “a partir de”</span>
            </label>
          </>
        ) : null}
        {modelo === "POR_UNIDADE" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto id="cc-unidade" rotulo="Preço por unidade" inputMode="decimal" value={porUnidade} onChange={(e) => setPorUnidade(e.target.value)}
              erro={erroDe("porUnidade", "Use um valor maior que zero.")} />
            <CampoTexto id="cc-minimo" rotulo="Mínimo por mês" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} opcional
              erro={erroDe("minimo", "Use um valor maior que zero ou deixe vazio.")} />
          </div>
        ) : null}
        {modelo === "FAIXA" ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 t-apoio font-medium">Faixas</legend>
            {degraus.map((g, i) => (
              <div key={i} role="group" aria-label={`Faixa ${i + 1}`} className="grid grid-cols-2 gap-3">
                <CampoTexto id={`cc-ate-${i}`} rotulo={`Faixa ${i + 1}, até unidades`} inputMode="numeric" value={g.ate} opcional={i > 0}
                  onChange={(e) => setDegraus((x) => x.map((y, j) => (j === i ? { ...y, ate: e.target.value } : y)))} />
                <CampoTexto id={`cc-fv-${i}`} rotulo={`Faixa ${i + 1}, preço por mês`} inputMode="decimal" value={g.valor} opcional={i > 0}
                  onChange={(e) => setDegraus((x) => x.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))}
                  erro={local[`faixa${i}`] ?? (i === 0 && campos.includes("faixas") ? "Diga as faixas em ordem." : null)} />
              </div>
            ))}
            <span className="t-apoio">Em ordem, do menor teto para o maior. Acima da última faixa, sob consulta.</span>
          </fieldset>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto id="cc-fonte" rotulo="Fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} maxLength={200} ajuda="O site ou o documento de onde saiu o preço."
            erro={erroDe("fonte", "Diga de onde saiu o preço.")} />
          <CampoTexto id="cc-lido" type="date" rotulo="Lido em" value={lidoEm} max={hojeBrasilia()} onChange={(e) => setLidoEm(e.target.value)}
            erro={erroDe("lidoEm", "Diga quando o preço foi lido (até hoje).")} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)} className="h-5 w-5 accent-violeta-600" />
          <span className="t-texto">Conferi o preço na fonte oficial</span>
        </label>
        {conferido ? null : <p className="t-apoio">Sem conferência, o preço aparece como de terceiros, com a barra tracejada.</p>}
        <CampoAreaTexto id="cc-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2}
          ajuda="Por exemplo: conferência dos sites em 24/10." erro={erroDe("motivo", MOTIVO_CURTO)} />
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={c ? "Salvar o preço" : "Cadastrar preço"} />
      </form>
    </Dialogo>
  );
}

/** Arquivar um concorrente: sai da comparação e fica no histórico, com motivo. */
export function JanelaArquivarConcorrente({ c, aoFechar, feito, recarregar }: PropsJanela & { c: Concorrente }) {
  const [motivo, setMotivo] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function arquivar(ev: FormEvent) {
    ev.preventDefault();
    if (motivo.trim().length < 3) return setLocal(MOTIVO_CURTO);
    setLocal(null);
    setEnviando(true);
    const r = await chamarApi(ROTAS_PRECOS.arquivar(c.id), { corpo: { versao: c.versao, motivo: motivo.trim() } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(`${c.nome} arquivado. Ele sai da comparação e continua no histórico.`);
  }

  return (
    <Dialogo aberto media titulo={`Arquivar ${c.nome}?`} apoio="Sai da comparação e continua no histórico. Nada se apaga." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => void arquivar(e)} noValidate>
        {erro && !campos.length ? <ErroJanela erro={erro} recarregar={recarregar} /> : null}
        <p className="t-texto">{`${c.nome}: ${c.modelo === "FIXO" ? mostrarValor(c.valor) : "preço por faixa ou por unidade"}, lido em ${c.lidoEm.split("-").reverse().join("/")}.`}</p>
        <CampoAreaTexto id="ar-motivo" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
          ajuda="Por exemplo: o site tirou o preço do ar." erro={local ?? (campos.includes("motivo") ? MOTIVO_CURTO : null)} />
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Arquivar" perigo />
      </form>
    </Dialogo>
  );
}
