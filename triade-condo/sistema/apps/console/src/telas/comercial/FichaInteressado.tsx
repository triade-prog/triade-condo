"use client";
// Ficha do interessado (quadros 323 e 324, aprovados em 24/10/2026): a barra das etapas, as
// mensagens prontas da etapa, as conversas, o próximo passo, a cadência, o prédio, as objeções e os
// concorrentes e o contato com a base legal. O prédio traz também os critérios que o síndico
// marcou na visita e o problema do prédio (0307), que alimentam o kit para o conselho. ?etapa=X chega do quadro quando falta algo para a
// etapa; ?juntado=1 chega do Novo interessado quando o contato já existia. O cartão Proposta leva à
// proposta do interessado ou abre a nova (R17.3, quadro 325). Da R17.4 (0308): o piloto com
// critério de sucesso (quadro 338, CM-21), o contrato pelo gov.br (quadro 440, CM-13) com o Virar
// cliente que só liga com as duas assinaturas conferidas (quadro 331, CM-08), a troca de sistema (quadro 345, CM-29) e os outros condomínios do
// mesmo contato com a oportunidade nova (CM-09). Da R17.5 (0309): as janelas do condomínio (CM-18), com o síndico novo.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CAMPO_LINK_AGENDA, ETAPAS_ABERTAS, formatarWhatsapp, SITUACOES_CONTRATO, SITUACOES_PILOTO, linkWhatsappComercial, mostrarDataSemHora, MOTIVOS_PERDA, PAPEIS_CONTATO, preencherMensagem, taxaTexto, type EtapaComercial } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, Dado, diaHora, LinhaDoTempo, MenuAcoes, plural, Voltar, type ItemMenu, type PassoTempo } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import { ROTAS_CLIENTE, TELAS_CLIENTE, textoMedida, textoMeta, textoPrazo, textoRecebidos, TOM_PILOTO, type ClienteCriado, type RespostaPiloto, type RespostaTroca } from "./cliente.ts";
import { TELAS_CONTRATO } from "./contrato.ts";
import { JanelaEncerrarPiloto, JanelaNovaOportunidade, JanelaPiloto, JanelaVirarCliente, textoFaltaGanho } from "./janelasCliente.tsx";
import { urlAgenda } from "./agenda.ts";
import { iconeCanal, linkComConvite, nomeCanal, nomeEtapa, nomeFaixa, nomeOrigem, quandoCurto, ROTAS_COMERCIAL, SeloEtapa, SelosAtencao, textoTarefa, TOM_SITUACAO } from "./comum.tsx";
import { JanelaConfirmar, JanelaConversa, JanelaFicha, JanelaPerdido, JanelaProximoPasso } from "./janelas.tsx";
import { CartaoJanelas } from "./JanelasCondominio.tsx";
import { nomeCriterio, ROTAS_PROPOSTAS, resumoVersao, TELAS_PROPOSTAS, textoAberturas, textoSituacao, TOM_SITUACAO_PROPOSTA, type ListaPropostas } from "./propostas.ts";
import type { FichaInteressado as Ficha } from "./tipos.ts";

type Janela =
  | { tipo: "ficha"; marcar?: string[] }
  | { tipo: "perdido" }
  | { tipo: "conversa"; canal?: string; resumo?: string; mensagemId?: string }
  | { tipo: "passo" }
  | { tipo: "naoContatar" }
  | { tipo: "excluir" }
  | { tipo: "piloto" }
  | { tipo: "encerrarPiloto"; podePerder: boolean; piloto: NonNullable<RespostaPiloto["piloto"]> }
  | { tipo: "virarCliente" }
  | { tipo: "oportunidade" };

const CANAL_OPTIN: Record<string, string> = { SITE: "pelo site", WHATSAPP: "pelo WhatsApp", LIGACAO: "por ligação", EMAIL: "por e-mail", PRESENCIAL: "em pessoa" };
const data = (d?: string) => (d ? mostrarDataSemHora(d) : undefined);

/** A barra das etapas abertas; a atual em destaque. Ganho e Perdido ficam ao lado. */
function BarraFunil({ f, mudar }: { f: Ficha; mudar: (e: EtapaComercial) => void }) {
  const atual = ETAPAS_ABERTAS.indexOf(f.etapa);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Etapas do funil">
      {ETAPAS_ABERTAS.map((e, n) => {
        const ja = atual >= 0 && n <= atual;
        const texto = `${nomeEtapa(e)}${f.falta?.[e]?.length && n > atual ? " ·" : ""}`;
        return (
          <li key={e}>
            <button type="button" disabled={!f.podeEditar || e === f.etapa || f.anonimizado} onClick={() => mudar(e)} aria-current={e === f.etapa ? "step" : undefined}
              className={`min-h-11 rounded-full border px-3 t-apoio ${e === f.etapa ? "border-violeta-600 bg-violeta-600 font-semibold text-white" : ja ? "border-violeta-300 bg-violeta-50 text-violeta-700" : "border-linha"} enabled:hover:border-violeta-600 disabled:cursor-default`}>
              {texto}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Conversas({ f }: { f: Ficha }) {
  const itens: PassoTempo[] = [
    ...f.conversas.map((c) => ({
      chave: c.id, icone: iconeCanal(c.canal), tom: c.respondeu ? ("ok" as const) : ("violeta" as const), quando: diaHora(c.em),
      quem: c.autor?.nome ?? "Sistema", texto: c.resumo, nota: true,
      selo: c.passo ? { texto: `Cadência · passo ${c.passo}`, tom: "info" as const } : { texto: nomeCanal(c.canal), tom: "neutro" as const },
    })),
    ...f.etapas.filter((e) => e.de).map((e, n) => ({
      chave: `etapa-${n}`, icone: "camadas" as const, tom: "neutro" as const, quando: diaHora(e.em), quem: e.autor?.nome ?? "Sistema",
      texto: `${nomeEtapa(e.de!)} → ${nomeEtapa(e.para)}${e.motivoPerda ? ` (${MOTIVOS_PERDA[e.motivoPerda]})` : ""}`,
    })),
  ];
  // O mais novo em cima, pela data original (o texto curto não ordena entre meses).
  const ordem = new Map<string | number, string>([...f.conversas.map((c) => [c.id, c.em] as const), ...f.etapas.filter((e) => e.de).map((e, n) => [`etapa-${n}`, e.em] as const)]);
  itens.sort((a, b) => (ordem.get(a.chave)! < ordem.get(b.chave)! ? 1 : -1));
  if (!itens.length) return <Vazio titulo="Nenhuma conversa ainda" icone="balao">Registre a primeira conversa depois de falar com a pessoa.</Vazio>;
  return <LinhaDoTempo itens={itens} rotulo="Conversas e mudanças de etapa" />;
}

/** O atalho para a proposta (CM-06, CM-07): a que existe, com a situação, ou a nova. */
function CartaoProposta({ f }: { f: Ficha }) {
  const carga = useCarregar<ListaPropostas>(ROTAS_PROPOSTAS.lista(null, f.id));
  const p = carga.estado === "pronto" ? carga.dados.propostas[0] : undefined;
  const aberto = ETAPAS_ABERTAS.includes(f.etapa) && !f.anonimizado && !f.naoContatar;
  return (
    <Cartao id="ficha-proposta" titulo="Proposta" icone="documento">
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <p className="t-apoio">{carga.texto}</p> : null}
      {p ? (
        <>
          <p className="flex flex-wrap items-center gap-2"><Selo tom={TOM_SITUACAO_PROPOSTA[p.atual.situacao]}>{textoSituacao(p.atual.numero, p.atual.situacao)}</Selo>
            <span className="t-apoio">{resumoVersao(p.atual)}</span></p>
          {p.atual.situacao === "ENVIADA" ? <p className="t-apoio">{textoAberturas(p.aberturas)}</p> : null}
          <Link href={TELAS_PROPOSTAS.lista(p.id)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="documento" />Abrir a proposta</Link>
        </>
      ) : carga.estado === "pronto" ? (
        <>
          <p className="t-apoio">Ainda sem proposta. Os valores vêm da Tabela de preços, com as unidades da ficha do prédio.</p>
          {carga.dados.podeEditar && aberto ? (
            <Link href={TELAS_PROPOSTAS.nova(f.id)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="mais" />Fazer proposta</Link>
          ) : null}
        </>
      ) : null}
    </Cartao>
  );
}

/** Virar cliente (quadro 331, CM-08): o botão só liga com as duas assinaturas conferidas. */
/** O contrato pelo gov.br (quadro 440, CM-13) e o Virar cliente (quadro 331, CM-08), que só liga com as duas assinaturas conferidas. */
function CartaoContrato({ f, abrir, criado }: { f: Ficha; abrir: () => void; criado: ClienteCriado | null }) {
  const sessao = useSessao();
  const pode = sessao.acoes.includes("console.comercial.cliente") && sessao.acoes.includes("console.condominios.criar");
  const abrirContrato = (texto: string) => <Link href={TELAS_CONTRATO.contrato(f.id)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="documento" />{texto}</Link>;
  if (f.virouClienteEm || criado) {
    return (
      <Cartao id="ficha-cliente" titulo="Virou cliente" icone="predio">
        <p className="t-texto">{`Virou cliente em ${diaHora(f.virouClienteEm ?? new Date().toISOString())}. O contrato assinado e o resto ficam na ficha do cliente.`}</p>
        {criado ? <Link href={TELAS_CLIENTE.cliente(criado.condominioId)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="predio" />Abrir a implantação</Link> : null}
      </Cartao>
    );
  }
  const s = f.contratoSituacao;
  const assinado = s === "ASSINADO";
  return (
    <Cartao id="ficha-cliente" titulo="Contrato" icone="documento" acao={s ? <Selo tom={assinado ? "ok" : "atencao"}>{SITUACOES_CONTRATO[s]}</Selo> : undefined}>
      <p className="t-apoio">
        {s ? "Cada parte assina o mesmo PDF pelo gov.br: primeiro o condomínio, depois a TRÍADE." : "Sai da proposta aceita e do modelo revisado por advogado, com o CNPJ e a ata que o síndico envia pelo link."}
      </p>
      <div className="flex flex-wrap gap-2 max-md:grid">
        {abrirContrato(s ? "Abrir o contrato" : "Preparar o contrato")}
        <Botao variante="contorno" disabled={!assinado || !pode} onClick={abrir} aria-describedby="ficha-cliente-aviso">
          <Icone nome="predio" />Virar cliente
        </Botao>
      </div>
      <p id="ficha-cliente-aviso" className="t-apoio">
        {!assinado ? "Libera quando as duas assinaturas estiverem conferidas." : !pode ? "Contrato assinado pelos dois. Só a Administração cria o cliente." : "Contrato assinado pelos dois."}
      </p>
    </Cartao>
  );
}

/** Piloto com critério de sucesso (quadro 338, CM-21): começar, ver em andamento e encerrar. */
function CartaoPiloto({ f, abrir, encerrar }: { f: Ficha; abrir: () => void; encerrar: (p: NonNullable<RespostaPiloto["piloto"]>, podePerder: boolean) => void }) {
  const sessao = useSessao();
  const carga = useCarregar<RespostaPiloto>(ROTAS_CLIENTE.piloto(f.id));
  const aberto = ETAPAS_ABERTAS.includes(f.etapa) && !f.virouClienteEm;
  if (carga.estado === "carregando") return <Cartao id="ficha-piloto" titulo="Piloto" icone="relogio"><Carregando linhas={1} /></Cartao>;
  if (carga.estado === "erro") return <Cartao id="ficha-piloto" titulo="Piloto" icone="relogio"><p className="t-apoio">{carga.texto}</p></Cartao>;
  const { piloto: p, podeComecar, podeEncerrar } = carga.dados;
  if (!p && !aberto) return null;
  const criaCondominio = sessao.acoes.includes("console.condominios.criar");
  return (
    <Cartao id="ficha-piloto" titulo="Piloto" icone="relogio"
      acao={p ? <Selo tom={TOM_PILOTO[p.situacao]}>{SITUACOES_PILOTO[p.situacao]}</Selo> : undefined}>
      {p ? (
        <>
          <Dado icone="calendario" nome="Prazo">{textoPrazo(p)}</Dado>
          <Dado icone="grafico" nome="Meta">{textoMeta(p.meta, p.metaPercentual)}</Dado>
          {p.combinadoCom ? <Dado icone="pessoa" nome="Combinado com">{p.combinadoCom}</Dado> : null}
          <Dado icone="check" nome={p.situacao === "EM_ANDAMENTO" ? "Até agora" : "Resultado"}>{textoMedida(p.situacao === "EM_ANDAMENTO" ? p.medida : p.resultado)}</Dado>
          {p.motivoPerda ? <Dado icone="fechar" nome="Por que não fechou">{MOTIVOS_PERDA[p.motivoPerda as keyof typeof MOTIVOS_PERDA] ?? p.motivoPerda}</Dado> : null}
          {podeEncerrar ? (
            <Botao variante="contorno" className="justify-self-start" onClick={() => encerrar(p, sessao.acoes.includes("console.comercial.cliente"))}>
              <Icone nome="check" />Encerrar o piloto
            </Botao>
          ) : null}
          {p.situacao === "EM_ANDAMENTO" ? <p className="t-apoio">No fim, o piloto vira proposta ou perdido com motivo. Enquanto isso, o condomínio fica Em piloto, sem cobrança.</p> : null}
        </>
      ) : (
        <>
          <p className="t-apoio">Prazo curto e meta combinada antes, para a assembleia decidir com números. O condomínio entra na carteira como Em piloto, sem cobrança.</p>
          {podeComecar && criaCondominio && !f.anonimizado && !f.naoContatar ? (
            <Botao variante="contorno" className="justify-self-start" onClick={abrir}><Icone nome="tocar" />Começar o piloto</Botao>
          ) : <p className="t-apoio">Só a Administração começa o piloto.</p>}
        </>
      )}
    </Cartao>
  );
}

/** A troca de sistema (quadro 345, CM-29): o resumo e o atalho para a página. */
function CartaoTroca({ f }: { f: Ficha }) {
  const carga = useCarregar<RespostaTroca>(ROTAS_CLIENTE.troca(f.id));
  const t = carga.estado === "pronto" ? carga.dados.troca : undefined;
  return (
    <Cartao id="ficha-troca" titulo="Troca de sistema" icone="trocar">
      {carga.estado === "carregando" ? <Carregando linhas={1} /> : null}
      {carga.estado === "erro" ? <p className="t-apoio">{carga.texto}</p> : null}
      {carga.estado === "pronto" && carga.dados.restrito ? (
        <p className="t-apoio">Seguiu para a implantação: o que faltava receber virou pendência do cliente.</p>
      ) : t ? (
        <p className="t-texto">{`Da ${t.empresaAnterior} em ${t.dataTroca.split("-").reverse().join("/")} · ${textoRecebidos(t.itens)} · carta ${t.cartaEnviadaEm ? "mandada" : "ainda não mandada"}`}</p>
      ) : carga.estado === "pronto" ? (
        <p className="t-apoio">Carta à empresa anterior, o que falta receber, a planilha-modelo e a linha do tempo. Ao virar cliente, tudo segue para a implantação.</p>
      ) : null}
      {carga.estado === "pronto" && !carga.dados.restrito && (t || carga.dados.podeEditar) ? (
        <Link href={TELAS_CLIENTE.troca(f.id)} className={classeBotao("contorno", "justify-self-start")}><Icone nome="trocar" />{t ? "Abrir a troca de sistema" : "Preparar a troca de sistema"}</Link>
      ) : null}
    </Cartao>
  );
}

/** Os outros condomínios da mesma pessoa (CM-09), cada um com a sua etapa. */
function CartaoOportunidades({ f, nova }: { f: Ficha; nova: () => void }) {
  const lista = f.oportunidades ?? [];
  const pode = f.podeEditar && !f.anonimizado && !f.naoContatar;
  return (
    <Cartao id="ficha-oportunidades" titulo="Outros condomínios desta pessoa" icone="camadas"
      acao={pode ? <Botao variante="discreto" onClick={nova}><Icone nome="mais" />Nova oportunidade</Botao> : undefined}>
      {lista.length ? (
        <ul className="grid">
          {lista.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha py-2.5 first:border-t-0">
              <span className="grid">
                <Link href={`/comercial/${o.id}`} className="min-h-11 content-center font-medium underline">{o.condominio}</Link>
                <span className="t-apoio">{[o.cidade, o.uf, o.unidades ? plural(o.unidades, "unidade", "unidades") : null].filter(Boolean).join(" · ") || "Sem endereço"}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">{o.virouCliente ? <Selo tom="ok">Virou cliente</Selo> : null}<SeloEtapa etapa={o.etapa} /></span>
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio">Nenhum. Síndico profissional ou administradora aparece aqui com cada condomínio e a sua etapa.</p>}
    </Cartao>
  );
}

function Cadencia({ f, agir }: { f: Ficha; agir: (acao: "FEITO" | "PARAR") => void }) {
  const c = f.cadencia;
  if (!c) return <p className="t-apoio">Sem cadência. Ela começa sozinha em Novo pelo site, depois da demonstração e depois da proposta.</p>;
  const ativa = !c.fimEm;
  const FIM: Record<string, string> = { RESPONDEU: "a pessoa respondeu", CONCLUIDA: "todos os passos feitos", PARADA: "parada à mão", ETAPA: "mudou de etapa", NAO_CONTATAR: "não contatar" };
  return (
    <div className="grid gap-3">
      <p className="t-texto font-medium">{c.nome}</p>
      <ol className="grid gap-1.5">
        {c.passos.map((p, n) => (
          <li key={n} className={`flex gap-2 t-apoio ${n < c.feitos ? "text-tinta-suave line-through" : n === c.feitos && ativa ? "font-semibold text-tinta" : ""}`}>
            <span className="t-codigo">{`dia ${p.dia}`}</span><span>{`${nomeCanal(p.canal)}: ${p.texto}`}</span>
          </li>
        ))}
      </ol>
      {ativa ? (
        f.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => agir("FEITO")}><Icone nome="check" />{`Passo ${c.feitos + 1} feito`}</Botao>
            <Botao variante="discreto" onClick={() => agir("PARAR")}><Icone nome="fechar" />Parar a cadência</Botao>
          </div>
        ) : null
      ) : <p className="t-apoio">{`Terminou ${diaHora(c.fimEm!)}: ${FIM[c.fimMotivo ?? ""] ?? c.fimMotivo}.`}</p>}
    </div>
  );
}

export function FichaInteressado() {
  const { id } = useParams<{ id: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const carga = useCarregar<Ficha>(ROTAS_COMERCIAL.interessado(id));
  const pedida = busca.get("etapa") as EtapaComercial | null;
  const [janela, setJanela] = useState<Janela | null>(null);
  const [criado, setCriado] = useState<ClienteCriado | null>(null);
  const [vez, setVez] = useState(0);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro" | "atencao"; texto: string } | null>(busca.get("juntado") ? { tom: "atencao", texto: "Este contato já existia: os dados novos foram juntados neste interessado." } : null);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a ficha…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href="/comercial" texto="Voltar aos interessados" />
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }
  const f = carga.dados;
  const pronto = (texto?: string) => { setJanela(null); if (texto) setAviso({ tom: "ok", texto }); carga.recarregar(); setVez((v) => v + 1); };
  const faltaPedida = pedida && f.etapa !== pedida ? f.falta?.[pedida] : undefined;

  async function mudar(etapa: EtapaComercial) {
    if (etapa === "PERDIDO") return setJanela({ tipo: "perdido" });
    const r = await chamarApi(ROTAS_COMERCIAL.etapa(f.id), { corpo: { versao: f.versao, etapa } });
    if (r.ok) return pronto(`Etapa mudada para ${nomeEtapa(etapa)}.`);
    if (r.erro.detalhes?.motivo === "FALTA_PARA_ETAPA") {
      router.replace(`/comercial/${f.id}?etapa=${etapa}`);
      return setJanela({ tipo: "ficha", marcar: (r.erro.detalhes.campos as string[] | undefined) ?? [] });
    }
    setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    if (r.erro.codigo === "VERSION_CONFLICT") carga.recarregar();
  }

  async function cadencia(acao: "FEITO" | "PARAR") {
    const r = await chamarApi(ROTAS_COMERCIAL.cadencia(f.id), { corpo: { acao, resumo: null } });
    if (!r.ok) return setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    pronto(acao === "FEITO" ? "Passo da cadência registrado nas conversas." : "Cadência parada.");
  }

  // Os campos das mensagens prontas; o [link de agendamento] é o /a/[codigo] deste Console (R17.6b).
  const campos = { nome: f.pessoa, condominio: f.condominio,
                   linkAgenda: f.linkAgenda && typeof window !== "undefined" ? urlAgenda(window.location.origin, f.linkAgenda) : null };
  const comLink = !!f.linkAgenda && f.mensagens.some((m) => m.texto.includes(CAMPO_LINK_AGENDA));

  async function mensagem(m: { id: string; texto: string }) {
    // Com o [link de agendamento], o link sai com o convite desta ficha (0310, A). A aba abre já no
    // clique (o navegador bloqueia a que abre depois de esperar a API) e recebe o endereço depois.
    const pedeConvite = !!f.linkAgenda && m.texto.includes(CAMPO_LINK_AGENDA);
    const aba = pedeConvite ? window.open("", "_blank") : null;
    const l = await linkComConvite(f.id, f.linkAgenda, m.texto);
    if (!l.ok) {
      aba?.close();
      return setAviso({ tom: "erro", texto: textoDoErro(l.erro) });
    }
    const url = linkWhatsappComercial(f.whatsapp!, preencherMensagem(m.texto, { ...campos, linkAgenda: l.link ?? campos.linkAgenda }));
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else window.open(url, "_blank", "noopener");
    // A conversa registrada leva o link sem o convite: o convite em claro não fica guardado.
    setJanela({ tipo: "conversa", canal: "WHATSAPP", resumo: preencherMensagem(m.texto, { ...campos, linkAgenda: l.semConvite ?? campos.linkAgenda }), mensagemId: m.id });
  }

  const mais: ItemMenu[] = f.anonimizado ? [] : [
    ...(f.podeEditar ? [
      { texto: "Editar a ficha", icone: "editar" as const, acao: () => setJanela({ tipo: "ficha" }) },
      ...(ETAPAS_ABERTAS.includes(f.etapa) ? [
        { texto: "Marcar como ganho", icone: "check" as const, acao: () => void mudar("GANHO") },
        { texto: "Marcar como perdido", icone: "fechar" as const, acao: () => setJanela({ tipo: "perdido" }) },
      ] : [{ texto: "Reabrir em Em contato", icone: "dir" as const, acao: () => void mudar("EM_CONTATO") }]),
      ...(!f.naoContatar ? [{ texto: "Não contatar mais", icone: "alerta" as const, acao: () => setJanela({ tipo: "naoContatar" }) }] : []),
    ] : []),
    ...(f.podeExcluir ? [{ texto: "Pedido de exclusão (LGPD)", icone: "alerta" as const, acao: () => setJanela({ tipo: "excluir" }) }] : []),
  ];
  const fechado = !ETAPAS_ABERTAS.includes(f.etapa);

  return (
    <div className="grid gap-5">
      <Voltar href="/comercial" texto="Voltar aos interessados" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h1 className="t-titulo-tela [overflow-wrap:anywhere]">{f.condominio}</h1>
          <p className="flex flex-wrap items-center gap-2 t-apoio">
            <SeloEtapa etapa={f.etapa} />
            {f.probabilidade !== undefined && !fechado ? <span>{`Chance de fechar: ${f.probabilidade}%`}</span> : null}
            <span>{`Origem: ${nomeOrigem(f)}`}</span>
            <span>{`Responsável: ${f.responsavel?.nome ?? "ninguém"}`}</span>
            <SelosAtencao i={f} />
            {f.naoContatar ? <Selo tom="erro">Não contatar</Selo> : null}
          </p>
        </div>
        {mais.length ? <MenuAcoes rotulo={`Mais ações de ${f.condominio}`} texto="Mais ações" itens={mais} /> : null}
      </header>
      {f.anonimizado ? <Aviso tom="atencao" titulo="Dados apagados">Nome, contato e conversas foram apagados (LGPD). Ficam só os números do funil.</Aviso> : null}
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {f.possivelDuplicado && !f.anonimizado ? (
        <Aviso tom="atencao" titulo="Possível duplicado">
          {"Agendou pelo link com o WhatsApp ou o e-mail de outro interessado, mas não os dois. Confira se é a mesma pessoa antes de falar dos dados do outro: "}
          <Link href={`/comercial/${f.possivelDuplicado.id}`} className="font-semibold underline">{f.possivelDuplicado.condominio}</Link>.
        </Aviso>
      ) : null}
      {f.agendamentoRecusado ? (
        <Aviso tom="atencao" titulo={f.agendamentoRecusado.motivo === "NAO_CONTATAR" ? "Pediu demonstração, mas está no não contatar" : "Pediu outra demonstração pelo link"}>
          {f.agendamentoRecusado.motivo === "NAO_CONTATAR"
            ? `Alguém com este contato tentou marcar pelo link para ${f.agendamentoRecusado.pedido}. Nada foi marcado nem enviado, e a página mostrou que deu certo. Confira antes de falar com a pessoa. `
            : `Já existe demonstração marcada; o pedido para ${f.agendamentoRecusado.pedido} não foi marcado, e a pessoa viu a data da que existe. Confira se ela quer remarcar. `}
          O aviso sai quando você registrar uma conversa.
        </Aviso>
      ) : null}
      {faltaPedida?.length ? (
        <Aviso tom="atencao" titulo={`Para ir a ${nomeEtapa(pedida!)}`}>
          {`Falta preencher: ${faltaPedida.map((k) => ({ demonstracaoEm: "a data da demonstração", faixa: "a faixa de unidades", decisor: "quem decide", decisaoEm: "a data da decisão" }[k] ?? k)).join(", ")}. `}
          {f.podeEditar ? <Botao variante="contorno" className="mt-2" onClick={() => setJanela({ tipo: "ficha", marcar: faltaPedida })}><Icone nome="editar" />Preencher agora</Botao> : null}
        </Aviso>
      ) : null}
      {!f.anonimizado ? <BarraFunil f={f} mudar={(e) => void mudar(e)} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {!fechado && !f.anonimizado ? (
            <Cartao id="ficha-1" titulo={`Mensagens prontas · ${nomeEtapa(f.etapa)}`} icone="whats">
              {!f.temWhatsapp ? (
                <p className="t-apoio">{f.naoContatar ? "Este contato pediu para não ser procurado." : !f.whatsapp ? "Sem WhatsApp na ficha." : "Sem o aceite de mensagens pelo WhatsApp os botões ficam desligados. Registre o aceite em Editar a ficha."}</p>
              ) : null}
              {f.mensagens.length ? (
                <ul className="grid gap-2">
                  {f.mensagens.map((m) => (
                    <li key={m.id} className="grid gap-2 rounded-[14px] border border-linha p-3">
                      <span className="font-medium">{m.titulo}</span>
                      <span className="t-apoio whitespace-pre-wrap [overflow-wrap:anywhere]">{preencherMensagem(m.texto, campos)}</span>
                      {f.podeEditar ? (
                        <Botao variante="contorno" className="justify-self-start" disabled={!f.temWhatsapp} onClick={() => void mensagem(m)}><Icone nome="whats" />Abrir no WhatsApp</Botao>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">Nenhuma mensagem pronta para esta etapa. Elas ficam em Modelos.</p>}
              <p className="t-apoio">Abre o WhatsApp com o texto pronto; você aperta enviar. A conversa fica registrada aqui.</p>
              {comLink ? <p className="t-apoio">O link de agendamento sai com um código desta ficha: quem marcar por ele entra aqui, mesmo sem o e-mail.</p> : null}
            </Cartao>
          ) : null}
          <Cartao id="ficha-2" titulo="Conversas" icone="balao"
            acao={f.podeEditar && !f.anonimizado ? <Botao variante="contorno" onClick={() => setJanela({ tipo: "conversa" })}><Icone nome="mais" />Registrar conversa</Botao> : undefined}>
            <Conversas f={f} />
          </Cartao>
        </div>

        <div className="grid content-start gap-5">
          {!fechado ? (
            <Cartao id="ficha-3" titulo="Próximo passo" icone="calendario"
              acao={f.podeEditar && !f.anonimizado ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "passo" })}><Icone nome="editar" />Mudar</Botao> : undefined}>
              <p className="t-texto" data-tom={TOM_SITUACAO[f.tarefa.situacao]}>{textoTarefa(f)}</p>
              {f.proximoPasso && f.tarefa.tarefa !== "PROXIMO_PASSO" ? <p className="t-apoio">{`Depois: ${f.proximoPasso.texto} · ${quandoCurto(f.proximoPasso.data, f.proximoPasso.hora)}`}</p> : null}
              {f.primeiraRespostaEm ? <p className="t-apoio">{`Primeiro retorno feito em ${diaHora(f.primeiraRespostaEm)}.`}</p> : null}
            </Cartao>
          ) : null}
          {!f.anonimizado ? <CartaoProposta f={f} /> : null}
          {!f.anonimizado && (!fechado || f.etapa === "GANHO") ? <CartaoContrato f={f} criado={criado} abrir={() => setJanela({ tipo: "virarCliente" })} /> : null}
          {!f.anonimizado ? (
            <CartaoPiloto key={`piloto-${vez}`} f={f} abrir={() => setJanela({ tipo: "piloto" })}
              encerrar={(piloto, podePerder) => setJanela({ tipo: "encerrarPiloto", piloto, podePerder })} />
          ) : null}
          {f.perda ? (
            <Cartao id="ficha-4" titulo="Por que não fechou" icone="fechar">
              <Dado icone="alerta" nome="Motivo">{MOTIVOS_PERDA[f.perda.motivo]}</Dado>
              {f.perda.vencedor ? <Dado icone="predio" nome="Quem ganhou">{f.perda.vencedor}</Dado> : null}
              {f.perda.detalhe ? <Dado icone="balao" nome="O que aconteceu">{f.perda.detalhe}</Dado> : null}
              {f.perda.retomarEm ? <Dado icone="calendario" nome="Voltar a falar em">{data(f.perda.retomarEm)}</Dado> : null}
            </Cartao>
          ) : null}
          {!f.anonimizado && !f.virouClienteEm && f.etapa !== "GANHO" ? (
            <CartaoJanelas key={`janelas-${vez}`} id={f.id} condominio={f.condominio} aoMudar={(t) => pronto(t)} />
          ) : null}
          <Cartao id="ficha-5" titulo="Cadência" icone="relogio"><Cadencia f={f} agir={(a) => void cadencia(a)} /></Cartao>
          <Cartao id="ficha-6" titulo="Prédio" icone="predio"
            acao={f.podeEditar && !f.anonimizado ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "ficha" })}><Icone nome="editar" />Editar</Botao> : undefined}>
            <Dado icone="pessoas" nome="Unidades">{[nomeFaixa(f.faixa), f.unidades ? plural(f.unidades, "unidade", "unidades") : null].filter(Boolean).join(" · ") || "Não informado"}</Dado>
            {f.predio.taxaCondominioMedia ? <Dado icone="dinheiro" nome="Taxa média de condomínio">{`${taxaTexto(f.predio.taxaCondominioMedia)} por mês`}</Dado> : null}
            <Dado icone="pin" nome="Onde">{[f.endereco, f.cidade, f.uf].filter(Boolean).join(" · ") || "Não informado"}</Dado>
            {f.cnpj ? <Dado icone="documento" nome="CNPJ">{f.cnpj}</Dado> : null}
            <Dado icone="predio" nome="Administradora">{f.predio.administradora ? `${f.predio.administradora}${f.predio.appAdministradora ? " (tem app próprio)" : ""}` : "Não informado"}</Dado>
            <Dado icone="lista" nome="Sistema atual">{f.predio.sistemaAtual ?? "Não informado"}{f.predio.fidelidadeAte ? ` · fidelidade até ${data(f.predio.fidelidadeAte)}` : ""}</Dado>
            <Dado icone="pessoa" nome="Quem decide">{f.predio.decisor ?? "Não informado"}</Dado>
            {f.predio.decisaoEm ? <Dado icone="calendario" nome="Conselho ou assembleia">{data(f.predio.decisaoEm)}</Dado> : null}
            {f.predio.assembleiaOrdinaria ? <Dado icone="calendario" nome="Assembleia ordinária">{data(f.predio.assembleiaOrdinaria)}</Dado> : null}
            {f.predio.mandatoAte ? <Dado icone="calendario" nome="Mandato do síndico até">{data(f.predio.mandatoAte)}</Dado> : null}
            {f.predio.demonstracaoEm ? <Dado icone="calendario" nome="Demonstração">{diaHora(f.predio.demonstracaoEm)}</Dado> : null}
            {f.predio.visitaEm ? <Dado icone="predio" nome="Visita">{`${data(f.predio.visitaEm)}${f.predio.visitaNota ? ` · ${f.predio.visitaNota}` : ""}`}</Dado> : null}
            <Dado icone="alerta" nome="Problema do prédio">{f.predio.problema ?? "Não informado"}</Dado>
            <Dado icone="check" nome="Critérios do síndico">
              {f.predio.criterios?.length ? f.predio.criterios.map((c) => nomeCriterio(c, f.predio.criterioOutro)).join(" · ")
                : "Nenhum marcado. Eles viram as linhas do comparativo do kit."}
            </Dado>
            {f.observacao ? <Dado icone="balao" nome="Observação">{f.observacao}</Dado> : null}
          </Cartao>
          {!f.anonimizado && !f.virouClienteEm ? <CartaoTroca f={f} /> : null}
          <Cartao id="ficha-7" titulo="Objeções e concorrentes" icone="alerta">
            {f.objecoes.length ? (
              <ul className="grid gap-2">
                {f.objecoes.map((o) => {
                  const ob = f.objecoesLista.find((x) => x.codigo === o);
                  return (
                    <li key={o} className="grid gap-1">
                      <span className="font-medium">{ob?.texto ?? o}</span>
                      {ob?.resposta ? <span className="t-apoio">{`Como responder: ${ob.resposta}`}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="t-apoio">Nenhuma objeção registrada.</p>}
            {f.concorrentes.length ? (
              <ul className="grid gap-1 border-t border-linha pt-3">
                {f.concorrentes.map((c) => (
                  <li key={c.nome} className="flex justify-between gap-2 t-texto">
                    <span>{c.nome}</span>
                    <span className="t-codigo">{c.preco ? (c.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "preço não informado"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhum concorrente na disputa.</p>}
          </Cartao>
          {!f.anonimizado ? (
            <Cartao id="ficha-8" titulo="Contato" icone="pessoa">
              <Dado icone="pessoa" nome="Pessoa">{[f.pessoa, f.papel ? PAPEIS_CONTATO[f.papel] : null].filter(Boolean).join(" · ") || "Não informado"}</Dado>
              {f.whatsapp ? (
                <Dado icone="whats" nome="WhatsApp"><a className="font-medium underline" href={`tel:+${f.whatsapp}`}>{formatarWhatsapp(f.whatsapp)}</a></Dado>
              ) : null}
              {f.email ? <Dado icone="email" nome="E-mail"><a className="font-medium underline" href={`mailto:${f.email}`}>{f.email}</a></Dado> : null}
              <Dado icone="escudo" nome="Base legal">
                {`${f.baseLegal.tipo === "CONSENTIMENTO" ? "Consentimento" : "Legítimo interesse"} · ${diaHora(f.baseLegal.em)}`}
                <span className="block t-apoio">{f.baseLegal.texto}</span>
              </Dado>
              <Dado icone="check" nome="Aceite do WhatsApp">
                {f.optin ? `${diaHora(f.optin.em)} · ${CANAL_OPTIN[f.optin.canal] ?? f.optin.canal}` : "Sem aceite"}
                {f.optin ? <span className="block t-apoio">{f.optin.texto}</span> : null}
              </Dado>
              {f.lote ? <Dado icone="documento" nome="Planilha">{`${f.lote.arquivo} · ${f.lote.origem}`}</Dado> : null}
              {f.utm && Object.keys(f.utm).length ? <Dado icone="link" nome="Campanha">{Object.entries(f.utm).map(([k, v]) => `${k}: ${v}`).join(" · ")}</Dado> : null}
              <p className="t-apoio">Sem conversa por 12 meses depois de fechado, nome e contato são apagados sozinhos.</p>
            </Cartao>
          ) : null}
          {!f.anonimizado ? <CartaoOportunidades f={f} nova={() => setJanela({ tipo: "oportunidade" })} /> : null}
          <p className="t-apoio"><Link href="/comercial/modelos" className="underline">Mensagens, cadências e etapas ficam em Modelos.</Link></p>
        </div>
      </div>

      {janela?.tipo === "ficha" ? <JanelaFicha i={f} marcar={janela.marcar} aoFechar={() => setJanela(null)} feito={() => pronto("Ficha salva.")} /> : null}
      {janela?.tipo === "perdido" ? <JanelaPerdido i={f} aoFechar={() => setJanela(null)} feito={() => pronto("Marcado como perdido.")} /> : null}
      {janela?.tipo === "conversa" ? (
        <JanelaConversa i={f} inicial={janela} aoFechar={() => setJanela(null)} feito={() => pronto("Conversa registrada.")} />
      ) : null}
      {janela?.tipo === "passo" ? <JanelaProximoPasso i={f} equipe={f.equipe} aoFechar={() => setJanela(null)} feito={() => pronto("Próximo passo salvo.")} /> : null}
      {janela?.tipo === "piloto" ? <JanelaPiloto i={f} aoFechar={() => setJanela(null)} feito={() => pronto("Piloto combinado. O condomínio entrou na carteira como Em piloto.")} /> : null}
      {janela?.tipo === "encerrarPiloto" ? (
        <JanelaEncerrarPiloto piloto={janela.piloto} podePerder={janela.podePerder} aoFechar={() => setJanela(null)} feito={(t) => pronto(t)} />
      ) : null}
      {janela?.tipo === "virarCliente" ? (
        <JanelaVirarCliente f={f} aoFechar={() => setJanela(null)}
          feito={(r) => { setCriado(r); pronto(`Cliente criado na carteira, com o plano e a implantação abertos${r.pendencias ? ` e ${plural(r.pendencias, "pendência", "pendências")} da troca de sistema` : ""}.`); }}
          aoFaltar={(campos) => { setAviso({ tom: "atencao", texto: textoFaltaGanho(campos) }); setJanela({ tipo: "ficha", marcar: campos }); }} />
      ) : null}
      {janela?.tipo === "oportunidade" ? (
        <JanelaNovaOportunidade i={f} equipe={f.equipe} aoFechar={() => setJanela(null)}
          feito={(novo) => { setJanela(null); router.push(`/comercial/${novo}`); }} />
      ) : null}
      {janela?.tipo === "naoContatar" ? (
        <JanelaConfirmar titulo="Não contatar mais" botao="Pôr na lista de não contatar" aoFechar={() => setJanela(null)}
          texto={<>O WhatsApp, o e-mail e o CNPJ deste interessado entram na lista de não contatar. A cadência para e ninguém consegue registrar este contato de novo. Não dá para desfazer.</>}
          aoConfirmar={async (): Promise<ErroApi | null> => {
            const r = await chamarApi(ROTAS_COMERCIAL.naoContatar, { corpo: { whatsapp: f.whatsapp ?? null, email: f.email ?? null, cnpj: f.cnpj ?? null, observacao: `Pedido na ficha de ${f.condominio}` } });
            if (!r.ok) return r.erro;
            pronto("Contato na lista de não contatar.");
            return null;
          }} />
      ) : null}
      {janela?.tipo === "excluir" ? (
        <JanelaConfirmar titulo="Pedido de exclusão (LGPD)" botao="Apagar os dados pessoais" aoFechar={() => setJanela(null)}
          texto={<>Nome, WhatsApp, e-mail e o texto das conversas são apagados agora, e o contato entra na lista de não contatar. Ficam só a etapa, a origem e as datas, para os números do funil. Não dá para desfazer.</>}
          aoConfirmar={async (): Promise<ErroApi | null> => {
            const r = await chamarApi(ROTAS_COMERCIAL.excluir(f.id), { corpo: {} });
            if (!r.ok) return r.erro;
            pronto("Dados pessoais apagados. O pedido fica no histórico.");
            return null;
          }} />
      ) : null}
    </div>
  );
}
