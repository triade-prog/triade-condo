"use client";
// Aba Configuração da ficha (PI-04, CF-01, CF-12; desenho "Configuração na implantação", telas 1,
// 2, 3 e 7): as 11 partes na ordem do app, com o grupo e quem conferiu; abrir uma parte mostra as
// mesmas abas do app, gravando como TRÍADE; o que é só do síndico aparece só com a situação.
// Depois da entrega, o que o síndico ajusta fica em leitura e a equipe vê quem mudou.

import Link from "next/link";
import { useState } from "react";
import { formatarData, GRUPOS_CONFIGURACAO, PARTES_CONFIGURACAO, type GrupoConfiguracao, type ParteConfiguracao } from "@triade/domain";
import { PainelConfiguracoes, type IdAba } from "@triade/configuracoes";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, FaixaInterna, Selo, textoDoErro,
  type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { PropsAba } from "./tipos.ts";

interface Parte {
  parte: ParteConfiguracao;
  conferida: boolean;
  conferencia?: { em: string; por: string; nota?: string };
  mudanca?: { em: string; por: string; equipe?: boolean };
}

export interface ConfiguracaoCliente {
  estagio: string;
  emImplantacao: boolean;
  partes: Parte[];
  sindico: { termoAceito: boolean | null; revisao: boolean; reabertura: boolean; avisosLigados: number; pessoas: number };
  ajustes: { fuso: string; parecidosDias: number; anexarMinutos: number; versao: number };
  pode: { conferir: boolean; montar: boolean; tecnica: boolean };
  motivoObrigatorio: boolean;
}

/** Endereço da Plataforma, para os links do mural e das etiquetas. */
const URL_PLATAFORMA = process.env.NEXT_PUBLIC_URL_PLATAFORMA ?? "https://condominio.trihub.com.br";

const TOM_GRUPO: Record<GrupoConfiguracao, Tom> = { TRIADE: "neutro", MONTA: "info", SINDICO: "atencao" };

export function SeloGrupo({ grupo, depois }: { grupo: GrupoConfiguracao; depois?: boolean }) {
  // Depois da entrega, o que a TRÍADE montou é o síndico quem ajusta (tela 7).
  return <Selo tom={TOM_GRUPO[grupo]}>{depois && grupo === "MONTA" ? "O síndico ajusta" : GRUPOS_CONFIGURACAO[grupo]}</Selo>;
}

function situacaoParte(p: Parte, emImplantacao: boolean): string {
  if (!emImplantacao) {
    return p.mudanca ? `Mudado por ${p.mudanca.por} em ${formatarData(p.mudanca.em)}` : "Sem mudança desde a entrega";
  }
  if (p.conferida && p.conferencia) return `Conferida por ${p.conferencia.por}, ${formatarData(p.conferencia.em)}`;
  if (p.conferencia && p.mudanca) return `Mudada depois de conferida (${p.mudanca.por}, ${formatarData(p.mudanca.em)}): confira de novo`;
  return "Falta conferir";
}

function Conferir({ condominio, parte, aoFechar, aoConferir }: {
  condominio: string; parte: ParteConfiguracao; aoFechar: () => void; aoConferir: (texto: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function conferir() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ conferidas: number; total: number }>(`/v1/clientes/${condominio}/configuracao/conferir`, {
      corpo: { parte, nota: nota.trim() || undefined },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoConferir(`${PARTES_CONFIGURACAO[parte].nome} conferida. ${r.dados.conferidas} de ${r.dados.total} partes.`);
  }
  return (
    <Dialogo aberto titulo={`Marcar como conferida: ${PARTES_CONFIGURACAO[parte].nome}`} aoFechar={aoFechar}>
      <div className="grid gap-3">
        <p className="text-sm text-tinta-suave">Diz que a parte foi montada a partir do levantamento. Mudar a parte depois tira a marca.</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="conf-nota" rotulo="De onde veio" opcional maxLength={500} rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
          ajuda="Fica só no Console, nunca aparece para o cliente." />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={() => void conferir()} disabled={enviando}>{enviando ? "Marcando…" : "Marcar como conferida"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

export function AbaConfiguracao({ ficha }: PropsAba) {
  const id = ficha.condominio.id;
  const carga = useCarregar<ConfiguracaoCliente>(`/v1/clientes/${id}/configuracao`);
  const [aberta, setAberta] = useState<IdAba | null>(null);
  const [conferindo, setConferindo] = useState<ParteConfiguracao | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a configuração…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const conferidas = d.partes.filter((p) => p.conferida).length;
  const faltando = d.partes.filter((p) => !p.conferida).map((p) => PARTES_CONFIGURACAO[p.parte].nome);
  const depois = !d.emImplantacao;

  if (aberta) {
    return (
      <div className="grid gap-4">
        <p className="text-sm">
          <button type="button" className="text-violeta-600 hover:underline" onClick={() => { setAberta(null); carga.recarregar(); }}>Voltar às partes</button>
        </p>
        <FaixaInterna>{d.pode.montar
          ? "Você muda como TRÍADE. O que salvar vale no app do condomínio e entra no histórico dele."
          : depois ? "Cliente ativo: o que a TRÍADE montou, o síndico ajusta. Aqui fica em leitura; os ajustes técnicos continuam com a TRÍADE."
            : "Sua função só vê a configuração."}</FaixaInterna>
        <PainelConfiguracoes aba={aberta} aoMudarAba={setAberta}
          ambiente={{ onde: "console", base: `/v1/clientes/${id}/condominio`, origemPlataforma: URL_PLATAFORMA, aoMudar: carga.recarregar }} />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <FaixaInterna>Interno da TRÍADE. O que você muda aqui vale no app do condomínio e entra no histórico dele como TRÍADE.</FaixaInterna>
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{depois ? `Configuração · ${d.estagio === "ATIVO" ? "cliente ativo" : "fora da implantação"}` : `${conferidas} de ${d.partes.length} partes conferidas`}</h2>
          <p className="text-sm text-tinta-suave">
            {depois ? "O que a TRÍADE montou, o síndico ajusta no app. Os ajustes técnicos continuam aqui, com motivo e aviso ao síndico."
              : faltando.length ? `Falta conferir: ${faltando.join(", ")}.` : "Tudo conferido. A etapa 4 do roteiro pode ser marcada como realizada."}
          </p>
        </div>
        <Link href={`/clientes/${id}/resumo-configuracao`} target="_blank" className={classeBotao("contorno", "", "m")}>Resumo para o síndico</Link>
      </div>

      <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
        {d.partes.map((p) => {
          const info = PARTES_CONFIGURACAO[p.parte];
          return (
            <li key={p.parte} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{info.nome}</span>
                <span className={`block text-xs ${d.emImplantacao && !p.conferida ? "font-medium text-atencao-texto" : "text-tinta-suave"}`}>
                  {situacaoParte(p, d.emImplantacao)}
                </span>
              </span>
              <SeloGrupo grupo={info.grupo} depois={depois} />
              <span className="flex flex-wrap gap-2">
                <Botao variante="contorno" tamanho="m" onClick={() => setAberta(info.aba)} aria-label={`Abrir ${info.nome}`}>Abrir</Botao>
                {d.pode.conferir && !p.conferida ? (
                  <Botao variante="secundario" tamanho="m" onClick={() => setConferindo(p.parte)} aria-label={`Marcar ${info.nome} como conferida`}>Conferida</Botao>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="t-tecnicos" className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="t-tecnicos" className="font-medium">Ajustes da TRÍADE</h3>
          <SeloGrupo grupo="TRIADE" />
        </div>
        <p className="text-sm text-tinta-suave">
          Fuso {d.ajustes.fuso} · pedidos parecidos dos últimos {d.ajustes.parecidosDias} dias · o que chega pelo WhatsApp entra no mesmo pedido por {d.ajustes.anexarMinutos} min.
          {d.motivoObrigatorio ? " Com o cliente ativo, mudar pede motivo e avisa o síndico no sino." : " Na implantação, mudam livremente."}
        </p>
        <span className="flex flex-wrap gap-2">
          <Botao variante="contorno" tamanho="m" onClick={() => setAberta("horarios")}>Fuso</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => setAberta("etapas")}>Etapas dos pedidos</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => setAberta("manutencao")}>Etapas da manutenção</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => setAberta("regras")}>Pedidos parecidos</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => setAberta("whatsapp")}>Mensagens seguintes do WhatsApp</Botao>
        </span>
      </section>

      <section aria-labelledby="t-sindico" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="t-sindico" className="font-medium">O que o síndico faz no app</h3>
          <SeloGrupo grupo="SINDICO" />
        </div>
        <p className="text-sm text-tinta-suave">A TRÍADE não muda nada disto; só acompanha.</p>
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie text-sm">
          <li className="flex justify-between gap-3 px-4 py-2.5"><span>Termo do piloto do WhatsApp</span>
            <span className="text-tinta-suave">{d.sindico.termoAceito ? "Aceito" : "Ainda não aceito"}</span></li>
          <li className="flex justify-between gap-3 px-4 py-2.5"><span>Revisar a conclusão</span>
            <span className="text-tinta-suave">{d.sindico.revisao ? "Ligado" : "Desligado (padrão)"}</span></li>
          <li className="flex justify-between gap-3 px-4 py-2.5"><span>Reabrir pedido encerrado</span>
            <span className="text-tinta-suave">{d.sindico.reabertura ? "Ligado (padrão)" : "Desligado"}</span></li>
          <li className="flex justify-between gap-3 px-4 py-2.5"><span>Avisos no WhatsApp de cada pessoa</span>
            <span className="text-tinta-suave">{d.sindico.avisosLigados} de {d.sindico.pessoas} {d.sindico.pessoas === 1 ? "pessoa ligou" : "pessoas ligaram"}</span></li>
        </ul>
      </section>

      {conferindo ? (
        <Conferir condominio={id} parte={conferindo} aoFechar={() => setConferindo(null)}
          aoConferir={(t) => { setConferindo(null); setRecado(t); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}
