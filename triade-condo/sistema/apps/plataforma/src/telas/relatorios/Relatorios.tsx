"use client";
// Relatórios do mês (TR-02, TR-10; canvas do novo frontend, quadro 231, decisão A.1 de 23/10/2026):
// mora dentro de Indicadores. O botão principal monta o do último mês fechado; a lista mostra os
// gerados, com a versão; o cartão do modelo diz quais partes já vêm marcadas nos próximos meses.

import Link from "next/link";
import { mesPorExtenso, nomeDoMes, PARTES_RELATORIO, PERMISSOES, tituloDoMes } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, Icone, SemPermissao, Selo } from "@triade/ui";
import { CartaoFicha } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { quandoGerado, Voltar, type ListaRelatorios } from "./comum.tsx";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function Relatorios() {
  const { pode } = usePlataforma();
  const carga = useCarregar<ListaRelatorios>(pode("pedidos.ver") ? "/v1/condominio/relatorios" : null);
  const cabecalho = (botao?: React.ReactNode) => (
    <div className="grid gap-3">
      <Voltar href="/indicadores" texto="Indicadores" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela font-normal tracking-tight">Relatórios do mês</h1>
          <p className="t-apoio">Para a assembleia e para o conselho: os números do mês fechado, com o seu texto e os anexos, num PDF só.</p>
        </div>
        {botao}
      </div>
    </div>
  );
  if (!pode("pedidos.ver")) return <SemPermissao tela="Relatórios do mês" permissao={PERMISSOES.ACOMPANHAR} />;
  if (carga.estado === "carregando") return <div className="grid gap-4">{cabecalho()}<Carregando rotulo="Abrindo os relatórios…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{cabecalho()}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const d = carga.dados;
  const nomeFechado = nomeDoMes(d.mesFechado);
  const montar = (
    <Link href={`/indicadores/relatorios/montar?mes=${d.mesFechado}`} className={classeBotao("primario")}>
      <Icone nome="mais" />{d.mesFechadoGerado ? `Montar de novo o de ${nomeFechado}` : `Montar o de ${nomeFechado}`}
    </Link>
  );
  return (
    <div className="grid gap-6">
      {cabecalho(montar)}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <CartaoFicha id="gerados" titulo="Gerados" icone="documento">
          {d.gerados.length ? (
            <ul aria-label="Relatórios gerados">
              {d.gerados.map((r) => (
                <li key={r.id} className="border-t border-linha">
                  <Link href={`/indicadores/relatorio?id=${r.id}`} className="flex items-center gap-3 py-3 text-tinta no-underline hover:text-violeta-700">
                    <span className="ladrilho h-10 w-10 rounded-xl" data-tom={r.ultimo ? "violeta" : "neutro"} aria-hidden="true"><Icone nome="documento" className="h-5 w-5" /></span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">{tituloDoMes(r.mes)}<Selo tom={r.ultimo ? "info" : "neutro"}>versão {r.numero}</Selo></span>
                      <span className="t-apoio">
                        Gerado em {quandoGerado(r.geradoEm)}{r.autor ? ` por ${r.autor}` : ""} · {plural(r.partes.length, "parte", "partes")}
                        {r.anexos ? ` · ${plural(r.anexos, "anexo", "anexos")}` : ""}{r.ultimo ? "" : " · há uma versão mais nova"}
                      </span>
                    </span>
                    <Icone nome="dir" className="h-[18px] w-[18px] text-tinta-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="t-apoio">Nenhum relatório gerado ainda. O primeiro sai com os números de {mesPorExtenso(d.mesFechado)}.</p>}
        </CartaoFicha>
        <CartaoFicha id="modelo" titulo="Modelo do condomínio" icone="lista">
          <p className="t-apoio">
            {d.modelo.guardadoEm
              ? `Guardado em ${quandoGerado(d.modelo.guardadoEm)}${d.modelo.guardadoPor ? ` por ${d.modelo.guardadoPor}` : ""}. Estas partes já vêm marcadas ao montar.`
              : "Ainda não há modelo guardado: ao montar, vêm marcadas as partes de costume. Guarde as suas escolhas ao gerar."}
          </p>
          <ul className="grid gap-1.5 t-texto" aria-label="Partes do modelo">
            {d.modelo.partes.map((p) => (
              <li key={p} className="flex items-center gap-2"><Icone nome="check" className="h-4 w-4 text-ok" />{PARTES_RELATORIO[p].titulo}</li>
            ))}
          </ul>
        </CartaoFicha>
      </div>
    </div>
  );
}
