"use client";
// Regras dos orçamentos (R8, OC-10; quadro 484): quantas propostas pedir e quem aprova, por faixa
// de valor; o que fazer quando não chega o mínimo; os prazos e a validade que já vêm escritos em
// todo orçamento novo. É do condomínio, não uma regra da TRÍADE: começa desligado. A alçada do
// conselho é a mesma de Decisões (um número só). Grava quando a pessoa clica em Guardar.

import { useState } from "react";
import { ABAIXO_MINIMO, lerReais, mostrarCusto, QUEM_APROVA_FAIXA, type AbaixoMinimo, type QuemAprovaFaixa } from "@triade/domain";
import { AvisoErro, Botao, Carregando, chamarApi, ErroCarregar, Icone, Interruptor, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, ParteNumerada } from "./comum.tsx";
import { useParte, useVersao } from "./salvar.tsx";
import { naBase, useCarregar } from "./contexto.tsx";

export interface RegrasOrcamento {
  versao: number;
  pode: { editar: boolean };
  ligada: boolean;
  faixas: { ate: number | null; minimo: number; quemAprova: QuemAprovaFaixa }[];
  abaixoMinimo: AbaixoMinimo;
  prazoDias: number;
  validadeDias: number;
  linkDias: number;
  alcadaConselho: number | null;
}

interface Faixa { chave: number; ate: string; minimo: string; quemAprova: QuemAprovaFaixa }

const reais = (c: number) => mostrarCusto(c).replace(/^R\$\s?/, "");
const semCentavos = (c: number) => mostrarCusto(c).replace(/,00$/, "");
let n = 0;

/** "Até R$ 1.000", "De R$ 1.000 a R$ 3.000", "Acima de R$ 3.000". */
export function nomeDaFaixa(faixas: { ate: number | null }[], i: number): string {
  const f = faixas[i]!;
  const anterior = i > 0 ? faixas[i - 1]!.ate : null;
  if (f.ate === null) return anterior !== null ? `Acima de ${semCentavos(anterior)}` : "Qualquer valor";
  return anterior !== null ? `De ${semCentavos(anterior)} a ${semCentavos(f.ate)}` : `Até ${semCentavos(f.ate)}`;
}

function Radio({ nome, valor, atual, mudar, texto, sub, desligado }: { nome: string; valor: string; atual: string; mudar: (v: string) => void; texto: string; sub?: string; desligado?: boolean }) {
  const marcada = atual === valor;
  return (
    <label className={`flex items-start gap-3 rounded-[14px] p-4 t-texto ${desligado ? "" : "cursor-pointer"} ${marcada ? "border-2 border-violeta-600 bg-violeta-50 p-[15px]" : "border border-linha bg-superficie hover:border-violeta-300"}`}>
      <input type="radio" name={nome} value={valor} checked={marcada} disabled={desligado} onChange={() => mudar(valor)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
      <span className="grid gap-0.5"><span className="font-medium">{texto}</span>{sub ? <span className="t-apoio">{sub}</span> : null}</span>
    </label>
  );
}

export function AbaOrcamentos() {
  const carga = useCarregar<RegrasOrcamento>(naBase("/regras-orcamento"));
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as regras dos orçamentos…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return <FormRegras key={carga.dados.versao} r={carga.dados} recarregar={carga.recarregar} />;
}

const SUB_ABAIXO: Record<AbaixoMinimo, string> = {
  MOTIVO: "Ex.: “só dois fornecedores atendem elevador desta marca”. O motivo vai para a planilha e para quem aprova.",
  BLOQUEIA: "Para condomínios cuja convenção exige o número de propostas",
};

function FormRegras({ r, recarregar }: { r: RegrasOrcamento; recarregar: () => void }) {
  const pode = r.pode.editar;
  const [ligada, setLigada] = useState(r.ligada);
  const [faixas, setFaixas] = useState<Faixa[]>(r.faixas.map((f) => ({ chave: ++n, ate: f.ate === null ? "" : reais(f.ate), minimo: String(f.minimo), quemAprova: f.quemAprova })));
  const [abaixo, setAbaixo] = useState<AbaixoMinimo>(r.abaixoMinimo);
  const [prazo, setPrazo] = useState(String(r.prazoDias));
  const [validade, setValidade] = useState(String(r.validadeDias));
  const [link, setLink] = useState(String(r.linkDias));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [faixaErrada, setFaixaErrada] = useState<number | null>(null);
  const versao = useVersao("regras-orcamento", r.versao);

  const lidas = faixas.map((f, i) => {
    let ate: number | null | undefined = null;
    try { ate = i === faixas.length - 1 && !f.ate.trim() ? null : f.ate.trim() ? lerReais(f.ate).centavos : undefined; } catch { ate = undefined; }
    return { ate, minimo: /^\d+$/.test(f.minimo) ? Number(f.minimo) : NaN, quemAprova: f.quemAprova };
  });
  const iguais = lidas.length === r.faixas.length && lidas.every((f, i) => f.ate === r.faixas[i]!.ate && f.minimo === r.faixas[i]!.minimo && f.quemAprova === r.faixas[i]!.quemAprova);
  const mudancas = Number(ligada !== r.ligada) + Number(!iguais) + Number(abaixo !== r.abaixoMinimo) + Number(prazo !== String(r.prazoDias)) + Number(validade !== String(r.validadeDias)) + Number(link !== String(r.linkDias));
  const mudarFaixa = (chave: number, x: Partial<Faixa>) => { setFaixas((fs) => fs.map((f) => (f.chave === chave ? { ...f, ...x } : f))); setFaixaErrada(null); };
  const incluirFaixa = () => setFaixas((fs) => [...fs.slice(0, -1), { ...fs[fs.length - 1]!, ate: "" }, { chave: ++n, ate: "", minimo: "3", quemAprova: "CONSELHO" }]);

  async function salvar(): Promise<string | null> {
    setErro(null);
    setFaixaErrada(null);
    for (let i = 0; i < lidas.length; i++) {
      const f = lidas[i]!;
      const anterior = i > 0 ? lidas[i - 1]!.ate : null;
      if (f.ate === undefined || Number.isNaN(f.minimo) || f.minimo < 1 || f.minimo > 10 || (f.ate !== null && anterior !== null && anterior !== undefined && f.ate <= anterior) || (f.ate === null && i < lidas.length - 1)) {
        setFaixaErrada(i);
        return null;
      }
    }
    const res = await chamarApi(naBase("/regras-orcamento"), {
      metodo: "PUT",
      corpo: { versao: versao.atual(), ligada, faixas: lidas.map((f) => ({ ate: f.ate ?? null, minimo: f.minimo, quemAprova: f.quemAprova })), abaixoMinimo: abaixo,
        prazoDias: Number(prazo), validadeDias: Number(validade), linkDias: Number(link), alcadaConselho: r.alcadaConselho },
    });
    if (!res.ok) { setErro(res.erro); return null; }
    versao.gravou(res.dados);
    recarregar();
    return "Regras dos orçamentos salvas. Valem para os orçamentos novos.";
  }
  useParte("regras-orcamento", { nome: "Orçamentos", mudancas, salvar });
  const campos = erro?.codigo === "VALIDATION_ERROR" ? ((erro.detalhes as { campos?: string[] } | undefined)?.campos ?? []) : [];
  const numero = (id: string, rotulo: string, valor: string, mudar: (v: string) => void, ajuda: string, max: number) => (
    <div className="grid gap-1">
      <label htmlFor={id} className="t-apoio font-medium">{rotulo}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="number" min={1} max={max} inputMode="numeric" disabled={!pode} value={valor} onChange={(e) => mudar(e.target.value)} aria-describedby={`${id}-ajuda`}
          aria-invalid={campos.includes(id.replace("regra-oc-", "")) || undefined} className="min-h-11 w-24 rounded-xl border border-linha bg-superficie px-3 t-texto" />
        <span className="t-texto">dias</span>
      </div>
      <p id={`${id}-ajuda`} className="t-apoio">{ajuda}</p>
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1 border-t border-linha pt-6">
        <h2 className="t-titulo-secao font-medium">Regras dos orçamentos</h2>
        <p className="t-apoio">Quantas propostas pedir e quem aprova, por faixa de valor. Grava quando você clica em Guardar.</p>
      </div>
      {erro && !campos.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <ParteNumerada n={5} id="t-oc-minimo" titulo="Mínimo de propostas por valor" direita={<Selo tom={ligada ? "ok" : "neutro"}>{ligada ? "Ligado" : "Desligado"}</Selo>}>
        <p className="t-apoio">Do condomínio, não uma regra da TRÍADE. Começa desligado.</p>
        {pode ? <Interruptor id="regra-oc-ligada" rotulo="Pedir um mínimo de propostas por faixa de valor" marcado={ligada} aoMudar={setLigada} ajuda="Desligado, o sistema não avisa nem bloqueia; quem decide é o síndico." /> : null}
        <div className="grid gap-2" role="group" aria-label="Faixas de valor">
          <div aria-hidden="true" className="grid grid-cols-[minmax(0,1.3fr)_7rem_minmax(0,1fr)_auto] gap-3 px-1 t-rotulo max-md:hidden"><span>Valor estimado</span><span>Mínimo</span><span>Quem aprova</span><span /></div>
          {faixas.map((f, i) => (
            <fieldset key={f.chave} disabled={!pode || !ligada} className="grid grid-cols-[minmax(0,1.3fr)_7rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-linha p-3 max-md:grid-cols-2">
              <legend className="sr-only">Faixa {i + 1}: {nomeDaFaixa(lidas.map((x) => ({ ate: x.ate ?? null })), i)}</legend>
              <div className="grid gap-1 max-md:col-span-2">
                <span className="t-apoio">{nomeDaFaixa(lidas.map((x) => ({ ate: x.ate ?? null })), i)}</span>
                {i === faixas.length - 1 ? <span className="t-apoio text-tinta-suave">Sem teto: pega o resto</span> : (
                  <div className="flex items-center gap-2">
                    <label htmlFor={`regra-oc-ate-${f.chave}`} className="t-apoio">até</label>
                    <input id={`regra-oc-ate-${f.chave}`} inputMode="decimal" maxLength={20} value={f.ate} onChange={(e) => mudarFaixa(f.chave, { ate: e.target.value })} placeholder="1.000,00"
                      aria-invalid={faixaErrada === i || undefined} className="min-h-11 w-36 rounded-xl border border-linha bg-superficie px-3 t-codigo" />
                  </div>
                )}
              </div>
              <div className="grid gap-1">
                <label htmlFor={`regra-oc-minimo-${f.chave}`} className="t-apoio md:sr-only">Mínimo</label>
                <input id={`regra-oc-minimo-${f.chave}`} type="number" min={1} max={10} inputMode="numeric" value={f.minimo} onChange={(e) => mudarFaixa(f.chave, { minimo: e.target.value })}
                  aria-invalid={faixaErrada === i || undefined} className="min-h-11 rounded-xl border border-linha bg-superficie px-3 t-texto" />
              </div>
              <div className="grid gap-1">
                <label htmlFor={`regra-oc-quem-${f.chave}`} className="t-apoio md:sr-only">Quem aprova</label>
                <select id={`regra-oc-quem-${f.chave}`} value={f.quemAprova} onChange={(e) => mudarFaixa(f.chave, { quemAprova: e.target.value as QuemAprovaFaixa })} className="min-h-11 rounded-xl border border-linha bg-superficie px-3 t-texto">
                  {(Object.keys(QUEM_APROVA_FAIXA) as QuemAprovaFaixa[]).map((q) => <option key={q} value={q}>{q === "CONSELHO" ? "Conselho (a alçada de Decisões)" : QUEM_APROVA_FAIXA[q]}</option>)}
                </select>
              </div>
              {faixas.length > 1 ? <Botao variante="discreto" tamanho="m" soIcone aria-label={`Tirar a faixa ${i + 1}`} onClick={() => setFaixas((fs) => fs.filter((x) => x.chave !== f.chave).map((x, j, arr) => (j === arr.length - 1 ? { ...x, ate: "" } : x)))}><Icone nome="fechar" /></Botao> : <span />}
            </fieldset>
          ))}
          {faixaErrada !== null ? <p className="t-apoio text-erro" role="alert">Confira a faixa {faixaErrada + 1}: o teto em reais, maior que o da faixa anterior, e o mínimo de 1 a 10. Só a última fica sem teto.</p> : null}
          {campos.includes("faixas") ? <p className="t-apoio text-erro" role="alert">As faixas precisam subir de valor, e só a última fica sem teto.</p> : null}
          {pode && ligada && faixas.length < 6 ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={incluirFaixa}><Icone nome="mais" />Incluir faixa</Botao> : null}
        </div>
        <p className="t-apoio">{r.alcadaConselho !== null ? `A alçada do conselho é a mesma de Decisões (${semCentavos(r.alcadaConselho)}). Mudar aqui muda lá: é um número só.` : "A alçada do conselho é a de Decisões, logo acima; sem alçada, o conselho entra só quando a faixa pedir."}</p>
      </ParteNumerada>
      <ParteNumerada n={6} id="t-oc-abaixo" titulo="Quando não chega o mínimo">
        <p className="t-apoio">O sistema avisa; quem decide é o síndico.</p>
        <fieldset className="grid gap-2" disabled={!pode}>
          <legend className="sr-only">Quando não chega o mínimo</legend>
          {(Object.keys(ABAIXO_MINIMO) as AbaixoMinimo[]).map((a) => (
            <Radio key={a} nome="regra-oc-abaixo" valor={a} atual={abaixo} mudar={(v) => setAbaixo(v as AbaixoMinimo)} desligado={!pode} texto={ABAIXO_MINIMO[a]} sub={SUB_ABAIXO[a]} />
          ))}
        </fieldset>
      </ParteNumerada>
      <ParteNumerada n={7} id="t-oc-prazos" titulo="Prazos e validade">
        <p className="t-apoio">Valores que já vêm escritos em todo orçamento novo.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {numero("regra-oc-prazoDias", "Prazo para propostas", prazo, setPrazo, "Até 30 dias", 30)}
          {numero("regra-oc-validadeDias", "Validade mínima pedida", validade, setValidade, "O fornecedor diz até quando o preço vale", 180)}
          {numero("regra-oc-linkDias", "Link vale no máximo", link, setLink, "Depois disso fecha sozinho", 90)}
        </div>
        <div className="grid gap-2">
          <Caixa id="regra-oc-motivo" rotulo="Escolha que não é a de menor total pede o motivo por escrito (sempre ligado)" marcada aoMudar={() => {}} />
          <Caixa id="regra-oc-vencida" rotulo="Proposta vencida só pode ser escolhida depois que o fornecedor confirmar o preço" marcada aoMudar={() => {}} />
        </div>
      </ParteNumerada>
    </div>
  );
}
