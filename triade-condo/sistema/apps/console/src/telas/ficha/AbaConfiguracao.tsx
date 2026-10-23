"use client";
// Parte Configuração da ficha (PI-04, CF-01, CF-12; desenho "Configuração na implantação", telas 1,
// 2, 3 e 7, e no padrão novo a tela-modelo console-ficha-configuracao-*, rodada Console de
// 23/10/2026): a barra com as partes conferidas e o que falta no alto; as 11 partes na ordem do
// app, cada uma em duas linhas, com quem conferiu e quando, e "Só a TRÍADE" só onde é; abrir uma
// parte mostra as mesmas abas do app, gravando como TRÍADE; o que é só do síndico aparece só com
// a situação. Depois da entrega, o que o síndico ajusta fica em leitura e a equipe vê quem mudou.
// O Resumo para o síndico saiu daqui e foi para Mais ações (decisão D.1).

import { useState } from "react";
import { formatarData, GRUPOS_CONFIGURACAO, PARTES_CONFIGURACAO, type GrupoConfiguracao, type ParteConfiguracao } from "@triade/domain";
import { PaginaConfiguracao, paginaDe, type IdPagina } from "@triade/configuracoes";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, Carregando, chamarApi, Dialogo, ErroCarregar, FaixaInterna, Icone, Selo, textoDoErro,
  type ErroApi, type Tom,
} from "@triade/ui";
import { BarraEtapas, Cartao } from "../comum.tsx";
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
        <p className="t-apoio text-tinta-suave">Diz que a parte foi montada a partir do levantamento. Mudar a parte depois tira a marca.</p>
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
  const [aberta, setAberta_] = useState<IdPagina[] | null>(null);
  // A parte Comunicados do roteiro abrange duas páginas: Comunicados e Mural e e-mail.
  const setAberta = (aba: string) => { const p = paginaDe(aba); if (p) setAberta_(p === "comunicados" ? ["comunicados", "mural"] : [p]); };
  const [conferindo, setConferindo] = useState<ParteConfiguracao | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a configuração…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const conferidas = d.partes.filter((p) => p.conferida).length;
  const faltando = d.partes.filter((p) => !p.conferida).map((p) => PARTES_CONFIGURACAO[p.parte].nome);
  const depois = !d.emImplantacao;

  if (aberta) {
    return (
      <div className="grid gap-4">
        <p className="t-texto">
          <button type="button" className="elo min-h-8 gap-1" onClick={() => { setAberta_(null); carga.recarregar(); }}>
            <Icone nome="esq" className="h-4 w-4" />Voltar às partes
          </button>
        </p>
        <FaixaInterna>{d.pode.montar
          ? "Você muda como TRÍADE. O que salvar vale no app do condomínio e entra no histórico dele."
          : depois ? "Cliente ativo: o que a TRÍADE montou, o síndico ajusta. Aqui fica em leitura; os ajustes técnicos continuam com a TRÍADE."
            : "Sua função só vê a configuração."}</FaixaInterna>
        {aberta.map((p) => (
          <PaginaConfiguracao key={p} pagina={p}
            ambiente={{ onde: "console", base: `/v1/clientes/${id}/condominio`, origemPlataforma: URL_PLATAFORMA, aoMudar: carga.recarregar }} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
      <Cartao id="t-partes" titulo={`As ${d.partes.length} partes`} icone="ajuste" className="lg:row-span-3">
        {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
        <div className="grid gap-2">
          <div className="flex flex-wrap justify-between gap-x-3 t-apoio text-tinta-suave">
            <h3 className="font-normal">{depois ? `Configuração · ${d.estagio === "ATIVO" ? "cliente ativo" : "fora da implantação"}` : `${conferidas} de ${d.partes.length} partes conferidas`}</h3>
            {!depois && faltando.length ? <span>falta: {faltando.join(", ")}</span> : null}
          </div>
          {depois ? null : <BarraEtapas feitas={conferidas} total={d.partes.length} rotulo={`${conferidas} de ${d.partes.length} partes conferidas`} />}
          <p className="t-apoio">
            {depois ? "O que a TRÍADE montou, o síndico ajusta no app; aqui fica em leitura. Onde diz Só a TRÍADE, os ajustes continuam aqui, com motivo e aviso ao síndico."
              : faltando.length ? "A TRÍADE monta e o síndico ajusta no app, menos onde diz Só a TRÍADE."
                : "Tudo conferido. A etapa 4 do roteiro pode ser marcada como realizada."}
          </p>
        </div>
        <ul>
          {d.partes.map((p) => {
            const info = PARTES_CONFIGURACAO[p.parte];
            const falta = d.emImplantacao && !p.conferida;
            return (
              <li key={p.parte} className="grid gap-1.5 border-t border-linha py-3 first:border-t-0">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="t-texto font-medium">{info.nome}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <Botao variante="discreto" className="gap-1"
                      onClick={() => setAberta(info.aba)} aria-label={`Abrir ${info.nome}`}>Abrir<Icone nome="dir" className="h-4 w-4" /></Botao>
                    {d.pode.conferir && !p.conferida ? (
                      <Botao variante="contorno" tamanho="m" onClick={() => setConferindo(p.parte)} aria-label={`Marcar ${info.nome} como conferida`}><Icone nome="check" />Conferida</Botao>
                    ) : null}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 t-apoio ${falta ? "font-medium text-atencao" : d.emImplantacao ? "text-ok" : "text-tinta-suave"}`}>
                    <Icone nome={falta ? "relogio" : "check"} className="h-3.5 w-3.5" />{situacaoParte(p, d.emImplantacao)}
                  </span>
                  {info.grupo === "MONTA" && !depois ? null : <SeloGrupo grupo={info.grupo} depois={depois} />}
                </span>
              </li>
            );
          })}
        </ul>
      </Cartao>

      <Cartao id="t-tecnicos" titulo="Ajustes da TRÍADE" icone="engrenagem">
        <span className="justify-self-start"><SeloGrupo grupo="TRIADE" /></span>
        <p className="t-apoio">
          Fuso {d.ajustes.fuso} · pedidos parecidos dos últimos {d.ajustes.parecidosDias} dias · o que chega pelo WhatsApp entra no mesmo pedido por {d.ajustes.anexarMinutos} min.
          {d.motivoObrigatorio ? " Com o cliente ativo, mudar pede motivo e avisa o síndico no sino." : " Na implantação, mudam livremente."}
        </p>
        <span className="flex flex-wrap gap-2">
          {([["horarios", "Fuso"], ["etapas", "Etapas dos pedidos"], ["manutencao", "Etapas da manutenção"], ["prazos", "Pedidos parecidos"], ["whatsapp", "Mensagens seguintes do WhatsApp"]] as const).map(([aba, texto]) => (
            <button key={aba} type="button" className="chip border-violeta-200 text-violeta-600" onClick={() => setAberta(aba)}>{texto}</button>
          ))}
        </span>
      </Cartao>

      <Cartao id="t-sindico" titulo="O que o síndico faz no app" icone="pessoa">
        <span className="justify-self-start"><SeloGrupo grupo="SINDICO" /></span>
        <p className="t-apoio">A TRÍADE não muda nada disto; só acompanha.</p>
        <ul className="divide-y divide-linha t-texto">
          <li className="flex justify-between gap-3 py-2.5"><span>Termo do piloto do WhatsApp</span>
            <span className="text-right text-tinta-suave">{d.sindico.termoAceito ? "Aceito" : "Ainda não aceito"}</span></li>
          <li className="flex justify-between gap-3 py-2.5"><span>Revisar a conclusão</span>
            <span className="text-right text-tinta-suave">{d.sindico.revisao ? "Ligado" : "Desligado (padrão)"}</span></li>
          <li className="flex justify-between gap-3 py-2.5"><span>Reabrir pedido encerrado</span>
            <span className="text-right text-tinta-suave">{d.sindico.reabertura ? "Ligado (padrão)" : "Desligado"}</span></li>
          <li className="flex justify-between gap-3 py-2.5"><span>Avisos no WhatsApp de cada pessoa</span>
            <span className="text-right text-tinta-suave">{d.sindico.avisosLigados} de {d.sindico.pessoas} {d.sindico.pessoas === 1 ? "pessoa ligou" : "pessoas ligaram"}</span></li>
        </ul>
      </Cartao>

      {conferindo ? (
        <Conferir condominio={id} parte={conferindo} aoFechar={() => setConferindo(null)}
          aoConferir={(t) => { setConferindo(null); setRecado(t); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}
