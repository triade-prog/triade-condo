"use client";
// Regras: decisões e conselho (R5, V-14, FC-10; quadro 421): como o conselho aprova, o que
// acontece no empate ou sem votos no prazo, quem é avisado da decisão vencida e a alçada do
// conselho. Quem decide continua sendo o condomínio: estas regras só organizam o que a convenção
// e a assembleia já dizem. A alçada só avisa; o sistema não paga nada. Só no app.

import { useState } from "react";
import type { EMPATES_CONSELHO, VENCIDA_AVISA } from "@triade/domain";
import { lerReais, mostrarCusto, QUORUNS_CONSELHO, votosQueAprovam, type QuorumConselho } from "@triade/domain";
import { AvisoErro, Carregando, chamarApi, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, ParteNumerada } from "./comum.tsx";
import { useParte, useVersao } from "./salvar.tsx";
import { naBase, useCarregar } from "./contexto.tsx";

type Empate = keyof typeof EMPATES_CONSELHO;
type Vencida = keyof typeof VENCIDA_AVISA;

export interface RegrasDecisoes {
  versao: number;
  pode: { editar: boolean };
  quorum: QuorumConselho;
  minimo?: number | null;
  empate: Empate;
  vencidaAvisa: Vencida;
  alcada?: number | null;
  sindico?: string;
  subsindico?: string;
  podePedir: boolean;
  necessarios?: number | null;
  titularesEmDia: number;
}

const votos = (n: number | null) => (n === null ? "sem quórum possível" : n === 1 ? "1 voto aprova" : `${n} votos aprovam`);
const reais = (c: number) => mostrarCusto(c).replace(/^R\$\s?/, "").replace(/^(\d{1,3}(?:\.\d{3})*)$/, "$1,00");

/** O sub de cada quórum: "Com 4 titulares, 3 votos aprovam". */
export function subQuorum(q: QuorumConselho, n: number, minimo: number | null): string {
  if (q === "MINIMO") return minimo ? `Com ${n === 1 ? "1 titular" : `${n} titulares`}, ${votos(votosQueAprovam(q, n, minimo))}` : "Escolha de 1 até o número de titulares";
  return `Com ${n === 1 ? "1 titular" : `${n} titulares`}, ${votos(votosQueAprovam(q, n, minimo))}`;
}

function Radio({ nome, valor, atual, mudar, texto, sub, desligado }: {
  nome: string; valor: string; atual: string; mudar: (v: string) => void; texto: string; sub?: string; desligado?: boolean;
}) {
  const marcada = atual === valor;
  return (
    <label className={`flex items-start gap-3 rounded-[14px] p-4 t-texto ${desligado ? "" : "cursor-pointer"} ${marcada ? "border-2 border-violeta-600 bg-violeta-50 p-[15px]" : "border border-linha bg-superficie hover:border-violeta-300"}`}>
      <input type="radio" name={nome} value={valor} checked={marcada} disabled={desligado} onChange={() => mudar(valor)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
      <span className="grid gap-0.5"><span className="font-medium">{texto}</span>{sub ? <span className="t-apoio">{sub}</span> : null}</span>
    </label>
  );
}

export function AbaDecisoes() {
  const carga = useCarregar<RegrasDecisoes>(naBase("/regras-decisoes"));
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as regras…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return <FormRegras key={carga.dados.versao} r={carga.dados} recarregar={carga.recarregar} />;
}

function FormRegras({ r, recarregar }: { r: RegrasDecisoes; recarregar: () => void }) {
  const pode = r.pode.editar;
  const n = r.titularesEmDia;
  const [quorum, setQuorum] = useState<QuorumConselho>(r.quorum);
  const [minimo, setMinimo] = useState(r.minimo ? String(r.minimo) : "");
  const [empate, setEmpate] = useState<Empate>(r.empate);
  const [vencida, setVencida] = useState<Vencida>(r.vencidaAvisa);
  const [semAlcada, setSemAlcada] = useState(!r.alcada);
  const [alcada, setAlcada] = useState(r.alcada ? reais(r.alcada) : "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [alcadaErrada, setAlcadaErrada] = useState(false);
  const versao = useVersao("regras-decisoes", r.versao);
  const sindico = r.sindico ?? "o síndico";

  const minimoN = quorum === "MINIMO" && /^\d+$/.test(minimo) ? Number(minimo) : null;
  let alcadaC: number | null = null;
  try { alcadaC = semAlcada || !alcada.trim() ? null : lerReais(alcada).centavos; } catch { alcadaC = -1; }
  const mudancas = Number(quorum !== r.quorum) + Number(quorum === "MINIMO" && minimoN !== (r.minimo ?? null)) + Number(empate !== r.empate)
    + Number(vencida !== r.vencidaAvisa) + Number((alcadaC ?? null) !== (r.alcada ?? null));

  async function salvar(): Promise<string | null> {
    setErro(null);
    setAlcadaErrada(false);
    if (alcadaC !== null && alcadaC <= 0) { setAlcadaErrada(true); return null; }
    const res = await chamarApi(naBase("/regras-decisoes"), {
      metodo: "PUT",
      corpo: { versao: versao.atual(), quorum, minimo: quorum === "MINIMO" ? minimoN : null, empate, vencidaAvisa: vencida, alcada: alcadaC },
    });
    if (!res.ok) { setErro(res.erro); return null; }
    versao.gravou(res.dados);
    recarregar();
    return "Regras das decisões salvas. Valem para os pedidos ao conselho feitos daqui em diante.";
  }
  useParte("regras-decisoes", { nome: "Decisões e conselho", mudancas, salvar });
  const campos = erro?.codigo === "VALIDATION_ERROR" ? ((erro.detalhes as { campos?: string[] } | undefined)?.campos ?? []) : [];

  return (
    <div className="grid gap-4">
      {erro && !campos.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <ParteNumerada n={1} id="t-quorum" titulo="Como o conselho aprova">
        <p className="t-apoio">Vale para decisões dos pedidos e para despesas pedidas ao conselho. Só os titulares com mandato em dia votam.</p>
        <fieldset className="grid gap-2" disabled={!pode}>
          <legend className="sr-only">Como o conselho aprova</legend>
          {(Object.keys(QUORUNS_CONSELHO) as QuorumConselho[]).map((q) => (
            <Radio key={q} nome="regra-quorum" valor={q} atual={quorum} mudar={(v) => setQuorum(v as QuorumConselho)} desligado={!pode}
              texto={q === "MINIMO" ? "Um número mínimo" : QUORUNS_CONSELHO[q]} sub={subQuorum(q, n, q === "MINIMO" ? minimoN : null)} />
          ))}
        </fieldset>
        {quorum === "MINIMO" ? (
          <div className="grid max-w-[220px] gap-1">
            <label htmlFor="regra-minimo" className="t-apoio font-medium">Quantos votos aprovam</label>
            <input id="regra-minimo" type="number" min={1} max={50} inputMode="numeric" disabled={!pode} value={minimo} onChange={(e) => setMinimo(e.target.value)}
              aria-invalid={campos.includes("minimo") || undefined} aria-describedby={campos.includes("minimo") ? "regra-minimo-erro" : undefined}
              className="min-h-11 rounded-xl border border-linha bg-superficie px-3 t-texto" />
            {campos.includes("minimo") ? <p id="regra-minimo-erro" className="t-apoio text-erro">Diga quantos votos, de 1 a 50.</p> : null}
          </div>
        ) : null}
        {r.titularesEmDia && !r.podePedir ? <p className="t-apoio text-atencao">Hoje há {n === 1 ? "1 titular" : `${n} titulares`} com mandato em dia: com esta regra, ainda não dá para pedir ao conselho.</p> : null}
      </ParteNumerada>
      <ParteNumerada n={2} id="t-empate" titulo="Empate ou sem votos no prazo">
        <p className="t-apoio">O que acontece quando nenhuma alternativa chega ao quórum até o prazo.</p>
        <fieldset className="grid gap-2" disabled={!pode}>
          <legend className="sr-only">Empate ou sem votos no prazo</legend>
          <Radio nome="regra-empate" valor="SINDICO" atual={empate} mudar={(v) => setEmpate(v as Empate)} desligado={!pode}
            texto="Volta para o síndico decidir" sub={`${sindico} recebe no sino, com os votos e as justificativas`} />
          <Radio nome="regra-empate" valor="DEVOLVIDA" atual={empate} mudar={(v) => setEmpate(v as Empate)} desligado={!pode}
            texto="Fica como devolvida" sub="Quem pediu decide se pede de novo. Na despesa, ela fica recusada." />
        </fieldset>
      </ParteNumerada>
      <ParteNumerada n={3} id="t-vencida" titulo="Decisão vencida sem resposta">
        <p className="t-apoio">Quando o prazo passa e quem decide não respondeu. Hoje: só o aviso no sino de quem decide.</p>
        <fieldset className="grid gap-2" disabled={!pode}>
          <legend className="sr-only">Decisão vencida sem resposta</legend>
          <Radio nome="regra-vencida" valor="NINGUEM" atual={vencida} mudar={(v) => setVencida(v as Vencida)} desligado={!pode} texto="Só avisar quem decide" sub="Como hoje" />
          <Radio nome="regra-vencida" valor="SUBSINDICO" atual={vencida} mudar={(v) => setVencida(v as Vencida)} desligado={!pode}
            texto="Avisar também o subsíndico" sub={r.subsindico ?? "Ainda não há subsíndico no conselho"} />
          <Radio nome="regra-vencida" valor="CONSELHO" atual={vencida} mudar={(v) => setVencida(v as Vencida)} desligado={!pode}
            texto="Avisar também o conselho" sub={n ? `${n === 1 ? "O titular" : `Os ${n} titulares`}, pelo link` : "Ainda não há titular com mandato em dia"} />
        </fieldset>
      </ParteNumerada>
      <ParteNumerada n={4} id="t-alcada" titulo="Alçada do conselho">
        <p className="t-apoio">A partir de que valor uma despesa ou uma alternativa pede o conselho. Passar só avisa: não bloqueia, porque o sistema não paga nada.</p>
        <div className="grid items-end gap-3 sm:grid-cols-[220px_1fr]">
          <div className="grid gap-1">
            <label htmlFor="regra-alcada" className="t-apoio font-medium">A partir de</label>
            <input id="regra-alcada" inputMode="decimal" maxLength={20} disabled={!pode || semAlcada} value={alcada} placeholder="3.000,00"
              onChange={(e) => setAlcada(e.target.value)} aria-invalid={alcadaErrada || campos.includes("alcada") || undefined}
              aria-describedby="regra-alcada-ajuda" className="min-h-11 rounded-xl border border-linha bg-superficie px-3 t-codigo" />
            <p id="regra-alcada-ajuda" className={`t-apoio ${alcadaErrada || campos.includes("alcada") ? "text-erro" : ""}`}>
              {alcadaErrada || campos.includes("alcada") ? "Escreva o valor em reais, como 3.000,00." : "Em reais, como 3.000,00."}
            </p>
          </div>
          {pode ? <div className="min-h-11 content-center"><Caixa id="regra-sem-alcada" rotulo="Sem alçada: não avisar" marcada={semAlcada} aoMudar={setSemAlcada} /></div>
            : <p className="t-texto">{r.alcada ? `A partir de ${mostrarCusto(r.alcada)}` : "Sem alçada: não avisa"}</p>}
        </div>
      </ParteNumerada>
    </div>
  );
}
