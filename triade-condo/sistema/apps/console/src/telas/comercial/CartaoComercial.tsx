"use client";
// O cartão Comercial no Início do Console (quadro 335; CM-04, CM-18): para quem tem o Comercial ou
// a Administração. Junta o primeiro retorno fora da meta de 1 hora útil, os atrasados, os parados e
// as janelas do condomínio que se aproximam, do que é da pessoa primeiro. Some quando nada pede
// atenção. Da R17.7 (0311): os clientes com o aniversário do contrato perto do "avisar até" (CM-30)
// e os sinais de risco sem tratar (CM-31), que levam à tela de Renovações. Mostra condomínio, etapa e
// responsável; nunca a pessoa de contato.

import Link from "next/link";
import { Carregando, ErroCarregar, Icone, Selo } from "@triade/ui";
import { Cartao, plural } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeLocal } from "./comum.tsx";
import { detalheInicio, linkInicio, ROTAS_PAINEL, seloInicio, type InicioComercial } from "./painel.ts";

export function CartaoComercial() {
  const carga = useCarregar<InicioComercial>(ROTAS_PAINEL.inicio);
  if (carga.estado === "pronto" && !carga.dados.total) return null;
  const d = carga.estado === "pronto" ? carga.dados : null;
  const hoje = hojeLocal();
  const soClientes = d ? d.itens.length > 0 && d.itens.every((i) => i.motivo === "RENOVACAO" || i.motivo === "RISCO") : false;
  return (
    <Cartao id="t-comercial" titulo="Comercial" icone="grafico"
      acao={d ? <Selo tom="atencao">{`${plural(d.total, "pede atenção", "pedem atenção")}`}</Selo> : undefined}>
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <>
          <ul className="divide-y divide-linha">
            {d.itens.map((i) => {
              const s = seloInicio(i, hoje);
              return (
                <li key={`${i.motivo}-${i.id}`} className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 hover:bg-violeta-50/50">
                  <span className="grid min-w-0 gap-0.5">
                    <Link href={linkInicio(i)} className="font-medium [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{i.condominio}</Link>
                    <span className="t-apoio">{detalheInicio(i)}</span>
                  </span>
                  <Selo tom={s.tom}>{s.texto}</Selo>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-3">
            {d.total > d.itens.length ? <span className="t-apoio">{`Mostrando ${d.itens.length} de ${d.total}.`}</span> : <span />}
            <Link href={soClientes ? "/comercial/renovacoes" : "/comercial"} className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
              {soClientes ? "Ver as renovações" : "Ver os interessados"}<Icone nome="dir" className="h-4 w-4" />
            </Link>
          </div>
        </>
      ) : null}
    </Cartao>
  );
}
