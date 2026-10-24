"use client";
// Configurações do condomínio (CF-06, CF-08, CF-10, CF-12, AT-10, AT-14, AT-15; áreas comuns, AC-07),
// por tarefa (decisões A.1 a D.1 da análise de Configurações, 22/10/2026): uma entrada com 5 grupos
// e uma página por tarefa, cada uma com um Salvar na barra do rodapé. Quem só vê (pessoa autorizada
// sem a permissão Configurar) não encontra botão de mudar (CF-03). As mesmas páginas servem ao app e
// à aba Configuração do Console (PI-04, decisão 7); quem hospeda guarda a página aberta.

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { resumoAjudaIa } from "@triade/domain";
import { Aviso, Carregando, ErroCarregar, Icone, Selo, type NomeIcone } from "@triade/ui";
import { assinatura, ProvedorConfiguracao, useAmbiente, useCarregar, naBase, type Ambiente } from "./contexto.tsx";
import { SeloTriade, type Tecnica } from "./tecnica.tsx";
import type { AreasComuns, Configuracoes as Config, LinksQr, PlanoComunicacao, Recado } from "./tipos.ts";
import { GRUPOS_TAREFA, grupoDaPagina, PAGINAS_CONFIGURACAO, PAGINAS_DA_TRIADE, type IdGrupo, type IdPagina } from "./paginas.ts";
import { PaginaSalvavel } from "./salvar.tsx";
import { AbaHorarios, resumoHorario } from "./AbaHorarios.tsx";
import { AbaFeriados } from "./AbaFeriados.tsx";
import { AbaCategorias } from "./AbaCategorias.tsx";
import { AbaEtapas } from "./AbaEtapas.tsx";
import { AbaPrazos, EXEMPLO_PRAZO } from "./AbaPrazos.tsx";
import { AbaManutencao } from "./AbaManutencao.tsx";
import { AbaPortaria, resumoPortaria, type Portaria } from "./AbaPortaria.tsx";
import { AbaComunicados, AbaMural } from "./AbaComunicados.tsx";
import { AbaLinksQr } from "./AbaLinksQr.tsx";
import { AbaWhatsapp } from "./AbaWhatsapp.tsx";
import { AbaAreasComuns } from "./AbaAreasComuns.tsx";
import { AbaIa, type AjudaIa } from "./AbaIa.tsx";
import type { Conexao } from "./conexao.tsx";

export interface PropsAba {
  config: Config;
  pode: boolean;
  recarregar: () => void;
  /** Depois de salvar: recarrega, avisa e atualiza as pendências do painel. */
  salvo: (texto: string) => void;
  /** Ajustes que são só da TRÍADE (CF-09): no app, só leitura; no Console, com motivo depois da entrega. */
  tecnica: Tecnica;
}

export const APOIO_CONFIGURACOES = "A TRÍADE montou tudo na implantação. Ajuste o que mudar no seu condomínio.";

/** O "Como funciona" de cada página: a regra por trás, sem mudar uma palavra do que se ajusta. */
const COMO: Partial<Record<IdPagina, string>> = {
  horarios: "O horário de atendimento conta os prazos de retorno: fora dele, nos feriados e nas etapas que pausam, o prazo para. O de funcionamento é quando o prédio está aberto e quando chegam os avisos no WhatsApp de quem trabalha nele.",
  feriados: "No feriado não há atendimento: o prazo de retorno para e volta a contar no dia seguinte, no horário de atendimento.",
  prazos: EXEMPLO_PRAZO,
  categorias: "Renomear não quebra o histórico. Desativar tira a categoria dos pedidos novos; os que já têm continuam com ela, no histórico e nos indicadores.",
  areas: "Só pessoas com vínculo confirmado em Moradores e unidades reservam. Área inativa não aparece para ninguém.",
  comunicados: "O plano fica à vista de quem escreve comunicados. No horário sem envio, nada sai por e-mail nem pelo WhatsApp: programar nesse horário mostra um aviso.",
  portaria: "Só registra e entrega quem tem conta própria e a permissão Cuidar da portaria; cada registro guarda o nome de quem fez. O aviso sai pelo modelo Encomenda guardada a quem mora na unidade e tem WhatsApp, e quem pediu PARAR não recebe. O texto da Portaria, no menu e nas telas vazias, segue o cenário do prédio.",
  whatsapp: "A conexão do número fica com a TRÍADE. Aqui o condomínio escolhe o que o morador recebe fora do horário, como o pedido chega e quem cuida quando o número cai.",
};

/** Uma página das Configurações no ambiente dado. No Console, `aoVoltar` volta à lista das partes. */
export function PaginaConfiguracao({ ambiente, pagina, aoVoltar }: { ambiente: Ambiente; pagina: IdPagina; aoVoltar?: () => void }) {
  return (
    <ProvedorConfiguracao ambiente={ambiente}>
      <Pagina_ pagina={pagina} aoVoltar={aoVoltar} />
    </ProvedorConfiguracao>
  );
}

function Voltar({ aoVoltar, children }: { aoVoltar?: () => void; children: ReactNode }) {
  const { endereco } = useAmbiente();
  const cls = "inline-flex min-h-8 items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline";
  if (aoVoltar) return <button type="button" onClick={aoVoltar} className={cls}><Icone nome="esq" className="h-4 w-4" />{children}</button>;
  if (endereco) return <Link href={endereco(null)} className={cls}><Icone nome="esq" className="h-4 w-4" />{children}</Link>;
  return null;
}

function Pagina_({ pagina, aoVoltar }: { pagina: IdPagina; aoVoltar?: () => void }) {
  const ambiente = useAmbiente();
  const config = useCarregar<Config>(naBase("/configuracoes"));
  const [recado, setRecado] = useState<Recado>(null);
  const [como, setComo] = useState(false);
  const idComo = useId();
  const info = PAGINAS_CONFIGURACAO[pagina];
  const textoComo = COMO[pagina];

  const cabecalho = (
    <div className="grid gap-2">
      <Voltar aoVoltar={aoVoltar}>Configurações · {grupoDaPagina(pagina).nome}</Voltar>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          {ambiente.onde === "app" ? <h1 className="t-titulo-tela font-normal tracking-tight">{info.nome}</h1> : <h2 className="t-titulo-secao font-medium">{info.nome}</h2>}
          <p className="t-apoio text-tinta-suave">{info.apoio}</p>
        </div>
        {textoComo ? (
          <button type="button" aria-expanded={como} aria-controls={idComo} onClick={() => setComo(!como)}
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 t-apoio font-medium text-violeta-600 hover:bg-violeta-50 aria-expanded:bg-violeta-50">
            <Icone nome="info" className="h-4 w-4" />Como funciona<Icone nome="baixo" className={`h-3.5 w-3.5 ${como ? "rotate-180" : ""}`} />
          </button>
        ) : null}
      </div>
      {textoComo ? <p id={idComo} hidden={!como} className="rounded-[14px] border border-violeta-200 bg-violeta-50 px-4 py-3 t-apoio text-tinta-suave">{textoComo}</p> : null}
    </div>
  );

  if (config.estado === "carregando") return <div className="grid gap-5">{cabecalho}<Carregando rotulo="Carregando as configurações…" /></div>;
  if (config.estado === "erro") return <div className="grid gap-5">{cabecalho}<ErroCarregar texto={config.texto} tentarDeNovo={config.recarregar} /></div>;

  const c = config.dados;
  const salvo = (texto: string) => { setRecado({ tom: "ok", texto }); config.recarregar(); ambiente.aoMudar?.(); };
  const props: PropsAba = { config: c, pode: c.podeEditar, recarregar: config.recarregar, salvo, tecnica: c.tecnica ?? { pode: false, motivo: false } };
  const daTriade = PAGINAS_DA_TRIADE.includes(pagina) && ambiente.onde === "app";

  return (
    <div className="grid gap-5">
      {cabecalho}
      {!c.podeEditar && ambiente.onde === "app" && !daTriade ? <Aviso tom="info">Você pode ver as configurações. Para mudar, o síndico precisa dar a você a permissão Configurar.</Aviso> : null}
      {recado ? <Aviso tom={recado.tom} papel="status">{recado.texto}</Aviso> : null}
      <PaginaSalvavel key={`${pagina}-${assinatura(c)}`} aoSalvar={salvo}>
        {pagina === "horarios" ? <AbaHorarios {...props} /> : null}
        {pagina === "feriados" ? <AbaFeriados {...props} /> : null}
        {pagina === "prazos" ? <AbaPrazos {...props} /> : null}
        {pagina === "categorias" ? <AbaCategorias {...props} /> : null}
        {pagina === "respostas" ? <AbaEtapas {...props} parte="modelos" /> : null}
        {pagina === "etapas" ? <AbaEtapas {...props} parte="etapas" /> : null}
        {pagina === "areas" ? <AbaAreasComuns {...props} /> : null}
        {pagina === "manutencao" ? <AbaManutencao {...props} /> : null}
        {pagina === "portaria" ? <AbaPortaria {...props} /> : null}
        {pagina === "comunicados" ? <AbaComunicados {...props} /> : null}
        {pagina === "mural" ? <AbaMural {...props} /> : null}
        {pagina === "whatsapp" ? <AbaWhatsapp aoSalvar={salvo} tecnica={props.tecnica} /> : null}
        {pagina === "etiquetas" ? <AbaLinksQr {...props} parte="etiquetas" /> : null}
        {pagina === "abertos" ? <AbaLinksQr {...props} parte="abertos" /> : null}
        {pagina === "ia" ? <AbaIa /> : null}
      </PaginaSalvavel>
    </div>
  );
}

const ICONE_GRUPO: Record<IdGrupo, NomeIcone> = { atendimento: "relogio", pedidos: "pedido", predio: "predio", comunicacao: "megafone", links: "link" };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const hora = (h: string) => h.replace(/^0(\d)/, "$1").replace(":00", "h").replace(/:(\d\d)$/, "h$1");

/** O que a entrada lê numa chamada só (D4.15); a parte que a pessoa não pode ver vem null. */
type Entrada = {
  configuracoes: Config; areas: AreasComuns | null; manutencao: { etapas: { ativa: boolean }[] } | null;
  plano: PlanoComunicacao | null; whatsapp: { conexao: Conexao } | null; links: LinksQr | null; ia?: AjudaIa | null; portaria?: Portaria | null;
};

/** O resumo de cada página na entrada. */
function resumos(e: Entrada) {
  const c = e.configuracoes;
  const ano = new Date().getFullYear();
  const deste = c.feriados.filter((f) => f.data.startsWith(String(ano))).length;
  const geral = c.prazos.find((p) => !p.categoriaId && !p.prioridadeId);
  const excecoes = c.prazos.length - (geral ? 1 : 0);
  const atendimento = resumoHorario(c.horarios.ATENDIMENTO.intervalos);
  const pronto = <T,>(x: T | null, f: (d: T) => string) => (x ? f(x) : "");
  const SITUACAO_ZAP: Record<Conexao["situacao"], string> = { SEM_CREDENCIAIS: "Ainda não ligado", DESCONECTADO: "Desconectado", CONECTANDO: "Conectando", CONECTADO: "Conectado" };
  const r: Record<IdPagina, string> = {
    horarios: atendimento ? `Atendimento: ${atendimento}` : "Atendimento ainda sem horário",
    feriados: deste ? `${plural(deste, "feriado", "feriados")} em ${ano}` : `Nenhum em ${ano} · traga os nacionais`,
    prazos: [geral ? `Prazo geral ${geral.horas} h` : "Sem prazo geral", excecoes ? plural(excecoes, "exceção", "exceções") : null].filter(Boolean).join(" · "),
    categorias: `${plural(c.categorias.filter((x) => x.ativa).length, "categoria", "categorias")} · ${plural(c.prioridades.filter((x) => x.ativa).length, "prioridade", "prioridades")}`,
    respostas: plural(c.modelos.filter((m) => m.ativo).length, "resposta", "respostas"),
    etapas: plural(c.etapas.filter((e) => e.ativa).length, "etapa", "etapas"),
    areas: pronto(e.areas, (d) => `${plural(d.areas.length, "área", "áreas")} · ${plural(d.areas.filter((a) => a.ativa).length, "ativa", "ativas")}`),
    manutencao: pronto(e.manutencao, (d) => plural(d.etapas.filter((e) => e.ativa).length, "etapa", "etapas")),
    portaria: pronto(e.portaria ?? null, resumoPortaria),
    comunicados: pronto(e.plano, (d) => `${plural(d.assuntos.length, "assunto", "assuntos")} · sem envio das ${hora(d.silencioInicio)} às ${hora(d.silencioFim)}`),
    mural: pronto(e.plano, (d) => `Mural ${d.mural.ligado ? "ligado" : "desligado"} · e-mail ${d.email.ligado ? "ligado" : "desligado"}`),
    whatsapp: pronto(e.whatsapp, (d) => SITUACAO_ZAP[d.conexao.situacao] + (d.conexao.oficial === false ? " · conexão de teste" : "")),
    etiquetas: pronto(e.links, (d) => {
      const uso = d.etiquetas.filter((e) => e.ativa).length;
      const fora = d.etiquetas.length - uso;
      return d.etiquetas.length ? `${uso} em uso${fora ? ` · ${plural(fora, "desativada", "desativadas")}` : ""}` : "Nenhuma etiqueta ainda";
    }),
    ia: pronto(e.ia ?? null, resumoAjudaIa),
    abertos: pronto(e.links, (d) => `Mural ${d.mural.ligado ? "ligado" : "desligado"} · ${plural(d.prestador.validos, "link de prestador", "links de prestador")}`),
  };
  return r;
}

/** Gestão: o plano do condomínio, só no app (NG-21, 0291). */
function CartaoGestao({ endereco }: { endereco: string }) {
  return (
    <section aria-labelledby="g-gestao" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 md:p-5">
      <div className="flex items-center gap-3">
        <span className="ladrilho h-10 w-10 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="camadas" className="h-5 w-5" /></span>
        <span className="grid">
          <h2 id="g-gestao" className="t-titulo-secao font-semibold">Gestão</h2>
          <span className="t-apoio text-tinta-suave">O que está no plano do condomínio.</span>
        </span>
      </div>
      <ul className="mt-1 grid">
        <li className="border-t border-linha">
          <Link href={endereco} className="flex min-h-[52px] items-center gap-3 py-2.5 hover:text-violeta-600">
            <span className="grid min-w-0 flex-1">
              <span className="t-texto font-medium">Meu plano</span>
              <span className="t-apoio text-tinta-suave">O plano, os conjuntos e as telas de cada um.</span>
            </span>
            <Icone nome="dir" className="h-[18px] w-[18px] shrink-0 text-tinta-suave" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** A entrada das Configurações (A.1): 5 grupos por tarefa, o que falta e onde ficaram os avisos de cada pessoa. */
export function EntradaConfiguracoes({ ambiente, enderecoMeusAvisos, enderecoMeuPlano }: { ambiente: Ambiente; enderecoMeusAvisos?: string; enderecoMeuPlano?: string }) {
  return (
    <ProvedorConfiguracao ambiente={ambiente}>
      <Entrada_ enderecoMeusAvisos={enderecoMeusAvisos} enderecoMeuPlano={enderecoMeuPlano} />
    </ProvedorConfiguracao>
  );
}

function Entrada_({ enderecoMeusAvisos, enderecoMeuPlano }: { enderecoMeusAvisos?: string; enderecoMeuPlano?: string }) {
  const config = useCarregar<Entrada>(naBase("/configuracoes/entrada"));
  const cab = (
    <div className="grid gap-1">
      <h1 className="t-titulo-tela font-normal tracking-tight">Configurações</h1>
      <p className="t-apoio text-tinta-suave">{APOIO_CONFIGURACOES}</p>
    </div>
  );
  if (config.estado === "carregando") return <div className="grid gap-5">{cab}<Carregando rotulo="Carregando as configurações…" /></div>;
  if (config.estado === "erro") return <div className="grid gap-5">{cab}<ErroCarregar texto={config.texto} tentarDeNovo={config.recarregar} /></div>;
  return <EntradaPronta e={config.dados} cab={cab} enderecoMeusAvisos={enderecoMeusAvisos} enderecoMeuPlano={enderecoMeuPlano} />;
}

function EntradaPronta({ e, cab, enderecoMeusAvisos, enderecoMeuPlano }: { e: Entrada; cab: ReactNode; enderecoMeusAvisos?: string; enderecoMeuPlano?: string }) {
  const { endereco, onde } = useAmbiente();
  const c = e.configuracoes;
  const resumo = resumos(e);
  const falta = new Set<IdPagina>(c.pendencias.includes("SEM_HORARIO_ATENDIMENTO") ? ["horarios"] : []);
  const href = (p: IdPagina) => endereco?.(p) ?? "#";
  const colunas: IdGrupo[][] = [["atendimento", "links"], ["pedidos", "predio"], ["comunicacao"]];
  const cartao = (id: IdGrupo) => {
    const g = GRUPOS_TAREFA.find((x) => x.id === id)!;
    const comFalta = g.paginas.some((p) => falta.has(p));
    return (
      <section key={g.id} aria-labelledby={`g-${g.id}`} className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 md:p-5">
        <div className="flex items-center gap-3">
          <span className="ladrilho h-10 w-10 rounded-xl" data-tom={comFalta ? "atencao" : "violeta"} aria-hidden="true"><Icone nome={ICONE_GRUPO[g.id]} className="h-5 w-5" /></span>
          <span className="grid">
            <h2 id={`g-${g.id}`} className="t-titulo-secao font-semibold">{g.nome}</h2>
            <span className="t-apoio text-tinta-suave">{g.apoio}</span>
          </span>
        </div>
        <ul className="mt-1 grid">
          {g.paginas.map((p) => {
            const triade = PAGINAS_DA_TRIADE.includes(p) && onde === "app";
            return (
              <li key={p} className="border-t border-linha">
                <Link href={href(p)} className="flex min-h-[52px] items-center gap-3 py-2.5 hover:text-violeta-600">
                  <span className="grid min-w-0 flex-1">
                    <span className="t-texto font-medium">{PAGINAS_CONFIGURACAO[p].nome}</span>
                    <span className="t-apoio text-tinta-suave">{resumo[p] || " "}</span>
                  </span>
                  {falta.has(p) ? <Selo tom="atencao">Falta</Selo> : triade ? <span className="max-sm:hidden"><SeloTriade /></span> : null}
                  <Icone nome="dir" className="h-[18px] w-[18px] shrink-0 text-tinta-suave" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };
  return (
    <div className="grid gap-5">
      {cab}
      {falta.has("horarios") ? (
        <Aviso tom="atencao" titulo="Falta 1 coisa: horário de atendimento">
          Sem ele, os prazos contam em horas corridas, de dia e de noite. Nada aqui é obrigatório; o painel só avisa.{" "}
          <Link href={href("horarios")} className="font-medium text-violeta-600 underline-offset-2 hover:underline">Definir o horário</Link>
        </Aviso>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-5">
        {colunas.map((col, i) => (
          <div key={i} className="grid content-start gap-4 lg:gap-5">
            {col.map(cartao)}
            {i === colunas.length - 1 && enderecoMeuPlano ? <CartaoGestao endereco={enderecoMeuPlano} /> : null}
          </div>
        ))}
      </div>
      {enderecoMeusAvisos ? (
        <p className="t-apoio text-tinta-suave">
          Os avisos no seu WhatsApp agora ficam no menu da sua conta, em{" "}
          <Link href={enderecoMeusAvisos} className="font-semibold text-violeta-600 hover:underline">Meus avisos</Link>.
        </p>
      ) : null}
    </div>
  );
}
