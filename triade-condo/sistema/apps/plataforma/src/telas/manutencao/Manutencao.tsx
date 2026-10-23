"use client";
// Manutenção aberta (DC15, telas-modelo manutencao-ficha-*, manutencao-situacoes e
// manutencao-quem-executa; MP-01, MP-02, MP-04, MP-05, MP-07, MP-09). No modelo da ficha do
// pedido (decisão A.1 de 22/10/2026): um botão principal por situação (Iniciar, Concluir,
// Resolver pendência ou Reabrir) e o resto em "Mais ações"; o próximo retorno num cartão, separado
// da previsão; os dados em lista, cada linha com a sua ação; providências com o resultado, a lista
// da vistoria logo abaixo do retorno, fotos e documentos. Do lado, Quem executa com o link do
// prestador num cartão só (B.1), com Ligar e Chamar no WhatsApp; as ligações com o pedido e a
// visita; e o histórico curto, com o completo a um toque. No celular, Quem executa vem logo
// depois do retorno e o principal fica no pé. Concluir não encerra o pedido ligado.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  descreverEventoManutencao, descreverFrequencia, linkWhatsapp, mostrarDataCurta, mostrarHorario, mostrarTelefone, RESULTADOS_ITEM, SITUACOES_MANUTENCAO, TIPOS_PENDENCIA,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Iniciais, Selo, textoDoErro, Vazio, type ErroApi, type NomeIcone, type Resposta } from "@triade/ui";
import { Janela, type Campo, type Valores } from "../Janela.tsx";
import { Cartao, Dado, MaisAcoes } from "../Ficha.tsx";
import { EscolherArquivos, resumoEnvio, type ItemEnvio } from "../pedidos/Arquivos.tsx";
import { deDataHoraLocal, diaHora, faltaPara, opcoesDe, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ItemVistoria, ManutencaoDetalhe, OpcoesManutencao, Providencia, Recado } from "../tipos.ts";
import { ArquivosManutencao, enviarArquivosManutencao } from "./ArquivosManutencao.tsx";
import { executorParaApi, ICONE_TIPO, nomeExecutor, nomePendencia, opcoesExecutor, SeloManutencao, textoTipo, valorExecutor } from "./comum.tsx";
import { FormManutencao } from "./FormManutencao.tsx";
import { MarcarVisita } from "./MarcarVisita.tsx";
import { LinkPrestador } from "./LinkPrestador.tsx";
import { NosComunicados } from "../comunicados/NosComunicados.tsx";

type Acao =
  | { tipo: "editar" | "pendencia" | "etapa" | "retorno" | "previsao" | "concluir" | "cancelar" | "reabrir" | "providencia" | "itens" | "visita" | "repassar" }
  | { tipo: "fazer"; providencia: Providencia }
  | { tipo: "responder"; item: ItemVistoria }
  | null;

const TOM_ITEM = { CERTO: "ok", PROBLEMA: "erro", NAO_DEU: "neutro" } as const;
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** "Hoje, 17:37", "Amanhã, 09:00" ou "23/10, 01:37", no horário de Brasília. */
function quando(iso: string, agora: Date): string {
  const d = new Date(iso);
  const amanha = new Date(agora.getTime() + 86400000);
  const dia = DIA.format(d) === DIA.format(agora) ? "Hoje" : DIA.format(d) === DIA.format(amanha) ? "Amanhã" : DIA.format(d);
  return `${dia}, ${HORA.format(d)}`;
}

/** Próximo retorno: o horário grande, quanto falta e o que ele não é (a previsão). */
function CartaoRetorno({ m, mudar }: { m: ManutencaoDetalhe["manutencao"]; mudar?: () => void }) {
  const agora = new Date();
  const tom = m.retornoVencido ? "erro" : m.proximoRetorno && Date.parse(m.proximoRetorno) - agora.getTime() < 6 * 3600000 ? "atencao" : "andamento";
  return (
    <section aria-label="Próximo retorno" data-tom={tom}
      className="relative grid gap-2 overflow-hidden rounded-[18px] border border-linha bg-superficie p-5 pl-6 shadow-s1 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-laranja-500 data-[tom=andamento]:before:bg-violeta-500 data-[tom=erro]:before:bg-erro">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-rotulo">Próximo retorno</h2>
        {mudar ? <Botao variante="discreto" tamanho="m" onClick={mudar}><Icone nome="editar" />{m.proximoRetorno ? "Mudar" : "Definir"}</Botao> : null}
      </div>
      {m.proximoRetorno ? (
        <p className="flex flex-wrap items-center gap-3">
          <span className="t-titulo-ficha">{quando(m.proximoRetorno, agora)}</span>
          <Selo tom={tom}>{faltaPara(m.proximoRetorno, agora.toISOString())}</Selo>
        </p>
      ) : <p className="t-apoio">Sem retorno combinado.</p>}
      <p className="t-apoio">
        Quando dar notícia de como está. Não é a previsão de conclusão: essa fica nos dados.{m.proximoRetorno ? ` Vencido, ${m.responsavel.nome ?? "o responsável"} é avisado.` : ""}
      </p>
    </section>
  );
}

/** Quem executa (B.1): o prestador com o contato, ligar e chamar no WhatsApp, a reserva e o link. */
function QuemExecuta({ d, condominio, trocar, children, className }: {
  d: ManutencaoDetalhe; condominio: string; trocar?: () => void; children?: ReactNode; className?: string;
}) {
  const m = d.manutencao;
  const p = d.prestador;
  const acao = trocar ? <Botao variante="discreto" tamanho="m" onClick={trocar}><Icone nome="trocar" />{m.executor ? "Trocar" : "Escolher"}</Botao> : undefined;
  let corpo: ReactNode;
  if (p) {
    const msg = `${condominio}: sobre a manutenção "${m.titulo}" (${m.local}).`;
    corpo = (
      <>
        <div className="flex items-center gap-3">
          <Iniciais nome={p.nome} className="h-10 w-10" />
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">{p.nome}</span>
            <span className="t-apoio">{p.servico} · {p.acordo === "CONTRATO" ? "com contrato" : "por chamado"}</span>
            {p.contato || p.telefone ? <span className="text-sm">{[p.contato, p.telefone ? mostrarTelefone(p.telefone) : null].filter(Boolean).join(" · ")}</span> : null}
          </span>
          <Link href={`/manutencao/prestador?id=${p.id}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
            Ver ficha<Icone nome="dir" className="h-4 w-4" />
          </Link>
        </div>
        {p.telefone ? (
          <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
            <a href={`tel:${p.telefone}`} className={classeBotao("contorno", "", "m")}><Icone nome="telefone" />Ligar</a>
            <a href={linkWhatsapp(p.telefone, msg)} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "", "m")}>
              <Icone nome="whats" /><span className="md:hidden">WhatsApp</span><span className="max-md:hidden">Chamar no WhatsApp</span>
            </a>
          </div>
        ) : (
          <p className="aviso items-center justify-between text-sm" data-tom="atencao">
            <span className="texto">Sem telefone no cadastro: Ligar e Chamar no WhatsApp aparecem quando tiver.</span>
            <Link href={`/manutencao/prestador?id=${p.id}`} className="shrink-0 font-medium text-violeta-600 hover:underline">Adicionar</Link>
          </p>
        )}
        {p.reserva ? <p className="t-apoio">Reserva no cadastro: {p.reserva.nome}. Sem resposta ao link no prazo, o serviço passa para ela.</p> : null}
      </>
    );
  } else if (m.executor) {
    corpo = (
      <div className="flex items-center gap-3">
        <Iniciais nome={m.executor.nome} className="h-10 w-10" />
        <span className="grid min-w-0">
          <span className="font-semibold">{m.executor.nome}</span>
          <span className="t-apoio">{m.executor.tipo === "EQUIPE" ? "Equipe do prédio" : "Escrito à mão, fora do cadastro"}</span>
        </span>
      </div>
    );
  } else {
    corpo = (
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <span className="ladrilho h-10 w-10" aria-hidden="true"><Icone nome="pessoa" /></span>
          <span className="grid">
            <span className="font-medium">Ninguém ainda</span>
            <span className="t-apoio">Escolha um prestador do cadastro, alguém da equipe ou escreva um nome.</span>
          </span>
        </div>
      </div>
    );
  }
  return (
    <Cartao id="t-executor" titulo="Quem executa" icone="ferramenta" acao={acao} className={className}>
      {corpo}
      {children}
    </Cartao>
  );
}

/** Uma ligação da manutenção: o pedido, a visita, a vistoria de onde veio ou o que ela abriu. */
function Ligacao({ href, icone, titulo, apoio }: { href: string; icone: NomeIcone; titulo: string; apoio: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[14px] border border-linha px-3 py-2.5 text-sm hover:border-violeta-300">
      <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
      <span className="grid min-w-0 flex-1">
        <span className="font-medium">{titulo}</span>
        <span className="t-apoio truncate">{apoio}</span>
      </span>
      <Icone nome="dir" className="h-4 w-4 text-tinta-suave" />
    </Link>
  );
}

/** O histórico em linha do tempo curta (os três últimos), com o completo a um toque. */
function Historico({ d, className }: { d: ManutencaoDetalhe; className?: string }) {
  const [completo, setCompleto] = useState(false);
  const ultimos = [...d.historico].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 3);
  const ver = (h: ManutencaoDetalhe["historico"][number]) => `${h.autor ?? "Sistema"} · ${diaHora(h.em)}${typeof h.dados.motivo === "string" ? ` · "${h.dados.motivo}"` : ""}`;
  return (
    <Cartao id="t-hist" titulo="Histórico" icone="relogio" className={className}>
      <ol className="grid">
        {ultimos.map((h, i) => (
          <li key={i} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 pb-4 before:absolute before:top-9 before:bottom-0 before:left-4 before:w-px before:bg-linha last:pb-0 last:before:hidden">
            <span className="ladrilho h-8 w-8 rounded-full" data-tom={i === 0 ? "violeta" : undefined} aria-hidden="true"><Icone nome="relogio" className="h-4 w-4" /></span>
            <div className="grid gap-0.5">
              <p className="font-medium">{descreverEventoManutencao(h.acao, h.dados)}</p>
              <p className="t-apoio">{ver(h)}</p>
            </div>
          </li>
        ))}
      </ol>
      {d.historico.length > 3 ? (
        <button type="button" className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline" aria-expanded={completo}
          aria-controls="historico-completo" onClick={() => setCompleto(!completo)}>
          {completo ? "Esconder o histórico completo" : `Ver histórico completo · ${d.historico.length} registros`}
          <Icone nome={completo ? "baixo" : "dir"} className="h-4 w-4" />
        </button>
      ) : null}
      {completo ? (
        <ol id="historico-completo" aria-label="Histórico completo" className="divide-y divide-linha rounded-[14px] border border-linha">
          {d.historico.map((h, i) => (
            <li key={i} className="grid gap-0.5 px-3 py-2.5 text-sm">
              <span>{descreverEventoManutencao(h.acao, h.dados)}</span>
              <span className="t-apoio">{ver(h)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Cartao>
  );
}

export function Manutencao() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const { atualizar, painel } = usePlataforma();
  const carga = useCarregar<ManutencaoDetalhe>(id ? `/v1/condominio/manutencao/${id}` : null);
  const opcoes = useCarregar<OpcoesManutencao>("/v1/condominio/manutencao/opcoes");
  const [acao, setAcao] = useState<Acao>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const [fotoDepois, setFotoDepois] = useState<ItemEnvio[]>([]);
  const voltar = (
    <Link href="/manutencao" className="inline-flex items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Voltar às manutenções
    </Link>
  );

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Manutenção</h1><Vazio titulo="Manutenção não encontrada" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a manutenção…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Manutenção</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }

  const d = carga.dados;
  const m = d.manutencao;
  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const fechar = () => { setAcao(null); setFotoDepois([]); };
  const salvo = (texto: string, tom: "ok" | "atencao" = "ok") => { fechar(); setRecado({ tom, texto }); setFalha(null); carga.recarregar(); atualizar(); };
  const url = `/v1/condominio/manutencao/${m.id}`;
  const abertas = d.providencias.filter((p) => !p.feitaEm);
  const etapas = (o?.etapas ?? []).filter((e) => e.situacao === m.estado);
  const encerrada = m.estado === "CONCLUIDA" || m.estado === "CANCELADA";
  const editar = d.pode.editar && !encerrada;

  async function situacao(estado: "PLANEJADA" | "EM_ANDAMENTO", texto: string) {
    const r = await chamarApi(`${url}/situacao`, { corpo: { versao: m.versao, estado } });
    if (!r.ok) return setFalha(r.erro);
    salvo(texto);
  }
  const enviar = (rota: string, corpo: Record<string, unknown>, texto: string, metodo?: "PUT") => async (): Promise<Resposta<unknown>> => {
    const r = await chamarApi(`${url}${rota}`, { metodo, corpo: { versao: m.versao, ...corpo } });
    if (r.ok) salvo(texto);
    return r;
  };

  async function concluir(v: Valores): Promise<Resposta<unknown>> {
    const r = await chamarApi(`${url}/concluir`, { corpo: { versao: m.versao, conclusao: v.conclusao, realizadaEm: v.realizadaEm, fecharProvidencias: v.fechar === true } });
    if (!r.ok) return r;
    const texto = m.preventiva ? "Manutenção concluída. A preventiva já tem a próxima data." : "Manutenção concluída.";
    const fotos = fotoDepois.map((f) => ({ ...f, descricao: f.descricao.trim() || "Foto do depois" }));
    if (fotos.some((f) => !f.problema)) {
      const envio = resumoEnvio(await enviarArquivosManutencao(m.id, null, fotos, () => {}));
      salvo(envio ? `${texto} ${envio.texto}` : texto, envio?.tom ?? "ok");
    } else salvo(texto);
    return r;
  }

  function janela(): { titulo: string; campos: Campo[]; iniciais: Valores; botao: string; explicacao?: string; salvar: (v: Valores) => Promise<Resposta<unknown>>; extra?: ReactNode } | null {
    if (!acao) return null;
    switch (acao.tipo) {
      case "pendencia":
        return { titulo: "Marcar como pendente", botao: "Marcar pendente", explicacao: "Pendente é o que espera alguma coisa de fora. Sair de pendente resolve a pendência.",
          campos: [
            { id: "pendenciaTipo", rotulo: "O que impede", tipo: "selecao", opcoes: [{ valor: "", texto: "Escolha" }, ...opcoesDe(TIPOS_PENDENCIA)], erro: "Diga o que impede." },
            { id: "pendenciaMotivo", rotulo: "Explique", tipo: "area", obrigatorio: true, max: 300, erro: "Explique a pendência (de 3 a 300 caracteres)." },
          ],
          iniciais: { pendenciaTipo: "", pendenciaMotivo: "" },
          salvar: (v) => enviar("/situacao", { estado: "PENDENTE", pendenciaTipo: v.pendenciaTipo || null, pendenciaMotivo: v.pendenciaMotivo || null },
            "Manutenção marcada como pendente.")() };
      case "etapa":
        return { titulo: "Mudar a etapa", botao: "Salvar etapa", explicacao: `As etapas de ${SITUACOES_MANUTENCAO[m.estado].toLowerCase()} vêm das Configurações.`,
          campos: [{ id: "etapa", rotulo: "Etapa", tipo: "selecao", opcoes: [{ valor: "", texto: "Sem etapa" }, ...etapas.map((e) => ({ valor: e.id, texto: e.nome }))] }],
          iniciais: { etapa: m.etapa?.id ?? "" },
          salvar: (v) => enviar("/situacao", { estado: m.estado, etapaId: v.etapa || null,
            pendenciaTipo: m.pendencia?.tipo ?? null, pendenciaMotivo: m.pendencia?.motivo ?? null }, "Etapa salva.")() };
      case "repassar":
        return { titulo: "Repassar a manutenção", botao: "Repassar", explicacao: "Quem fica responsável acompanha e dá notícia. Precisa ver a manutenção.",
          campos: [{ id: "responsavelId", rotulo: "Responsável", tipo: "selecao", erro: "Escolha alguém que vê a manutenção.",
            opcoes: (o?.pessoas ?? []).filter((p) => p.veManutencao || p.vinculoId === m.responsavel.vinculoId)
              .map((p) => ({ valor: p.vinculoId, texto: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome })) }],
          iniciais: { responsavelId: m.responsavel.vinculoId },
          salvar: (v) => {
            const exec = valorExecutor(m.executor);
            return enviar("", {
              titulo: m.titulo, local: m.local, detalhes: m.detalhes ?? null, prioridadeId: m.prioridade?.id ?? null, responsavelId: v.responsavelId,
              pedidoId: m.pedido?.id ?? null, ...executorParaApi(exec.escolha, exec.texto), acesso: m.acesso ?? null, impedimento: m.impedimento ?? null,
            }, "Manutenção repassada.", "PUT")();
          } };
      case "retorno":
        return { titulo: "Próximo retorno", botao: "Salvar retorno", explicacao: "Quando dar notícia. Mudar pede motivo, que fica no histórico.",
          campos: [
            { id: "quando", rotulo: "Quando", tipo: "datahora", ajuda: "Deixe em branco para tirar o retorno.", erro: "Entre agora e dois anos à frente." },
            { id: "motivo", rotulo: "Por que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." },
          ],
          iniciais: { quando: m.proximoRetorno ? paraDataHoraLocal(m.proximoRetorno) : "", motivo: "" },
          salvar: (v) => enviar("/proximo-retorno", { quando: v.quando ? deDataHoraLocal(String(v.quando)) : null, motivo: v.motivo }, "Próximo retorno salvo.", "PUT")() };
      case "previsao":
        return { titulo: "Previsão de conclusão", botao: "Salvar previsão", explicacao: "Só quando souber. Não muda o próximo retorno.",
          campos: [
            { id: "data", rotulo: "Data", tipo: "data", ajuda: "Deixe em branco para tirar a previsão.", erro: "Entre hoje e dois anos à frente." },
            { id: "motivo", rotulo: "Por que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." },
          ],
          iniciais: { data: m.previsao ?? "", motivo: "" },
          salvar: (v) => enviar("/previsao", { data: v.data || null, motivo: v.motivo }, "Previsão salva.", "PUT")() };
      case "concluir":
        return { titulo: "Concluir manutenção", botao: "Concluir",
          campos: [
            { id: "conclusao", rotulo: "O que foi feito", tipo: "area", obrigatorio: true, max: 2000, erro: "Diga o que foi feito (de 10 a 2000 caracteres)." },
            { id: "realizadaEm", rotulo: "Data em que foi feita", tipo: "data", obrigatorio: true, ajuda: "Entre o registro e hoje.", erro: "Entre o registro e hoje." },
            ...(abertas.length ? [{ id: "fechar", rotulo: abertas.length === 1 ? "Fechar junto a providência aberta" : `Fechar junto as ${abertas.length} providências abertas`,
              tipo: "caixa", ajuda: abertas.map((p) => p.texto).join(" · ") } as Campo] : []),
          ],
          iniciais: { conclusao: "", realizadaEm: d.hoje, fechar: false },
          extra: (
            <div className="grid gap-4">
              <EscolherArquivos rotulo="Anexar a foto do depois" opcional itens={fotoDepois} aoMudar={setFotoDepois} />
              {m.pedido ? <Aviso tom="atencao" titulo={`O pedido ${m.pedido.protocolo} continua aberto`}>Concluir a manutenção não encerra o pedido. Dê o retorno ao morador e conclua o pedido por lá.</Aviso> : null}
            </div>
          ),
          salvar: concluir };
      case "cancelar":
        return { titulo: "Cancelar manutenção", botao: "Cancelar manutenção", explicacao: "O motivo fica no histórico. Dá para reabrir depois, também com motivo.",
          campos: [{ id: "motivo", rotulo: "Por que cancelar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }],
          iniciais: { motivo: "" },
          salvar: (v) => enviar("/cancelar", { motivo: v.motivo }, "Manutenção cancelada.")() };
      case "reabrir":
        return { titulo: "Reabrir manutenção", botao: "Reabrir", explicacao: m.estado === "CONCLUIDA" ? "Volta em andamento; a conclusão anterior fica no histórico." : "Volta planejada.",
          campos: [{ id: "motivo", rotulo: "Por que reabrir", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }],
          iniciais: { motivo: "" },
          salvar: (v) => enviar("/reabrir", { motivo: v.motivo }, "Manutenção reaberta.")() };
      case "providencia":
        return { titulo: "Nova providência", botao: "Incluir providência",
          campos: [
            { id: "texto", rotulo: "O que fazer", tipo: "texto", obrigatorio: true, max: 300, erro: "De 3 a 300 caracteres." },
            { id: "executor", rotulo: "Quem executa", tipo: "selecao", opcoes: o ? opcoesExecutor(o) : [{ valor: "", texto: "Ninguém ainda" }], erro: "Escolha um só." },
            { id: "executorTexto", rotulo: "Nome de quem executa (se escolheu Outro)", tipo: "texto", max: 120 },
          ],
          iniciais: { texto: "", executor: "", executorTexto: "" },
          salvar: (v) => enviar("/providencias", { texto: v.texto, ...executorParaApi(String(v.executor), String(v.executorTexto)) }, "Providência incluída.")() };
      case "fazer":
        return { titulo: "Providência feita", botao: "Marcar como feita", explicacao: acao.providencia.texto,
          campos: [{ id: "resultado", rotulo: "Resultado", tipo: "area", obrigatorio: true, max: 1000, erro: "Diga o resultado, de 2 a 1000 caracteres." }],
          iniciais: { resultado: "" },
          salvar: async (v) => {
            const r = await chamarApi(`${url}/providencias/${acao.providencia.id}/fazer`, { corpo: { versao: m.versao, resultado: v.resultado } });
            if (r.ok) salvo("Providência feita.");
            return r;
          } };
      case "itens":
        return { titulo: "Mudar a lista da vistoria", botao: "Salvar lista",
          explicacao: "A lista é desta vistoria. Só sai o item que ainda não tem resposta.",
          campos: [
            { id: "incluir", rotulo: "Incluir itens (um por linha)", tipo: "area", erro: "Cada item de 2 a 200 caracteres." },
            ...d.itens.filter((i) => !i.resultado).map((i) => ({ id: `tirar-${i.id}`, rotulo: `Tirar "${i.texto}"`, tipo: "caixa" } as Campo)),
          ],
          iniciais: { incluir: "" },
          salvar: (v) => enviar("/itens", {
            incluir: String(v.incluir ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
            tirar: Object.entries(v).filter(([k, x]) => k.startsWith("tirar-") && x === true).map(([k]) => k.slice(6)),
          }, "Lista da vistoria salva.", "PUT")() };
      case "responder":
        return { titulo: acao.item.texto, botao: "Salvar resposta",
          campos: [
            { id: "resultado", rotulo: "Como está", tipo: "selecao", opcoes: [{ valor: "", texto: "Sem resposta" }, ...opcoesDe(RESULTADOS_ITEM)] },
            { id: "observacao", rotulo: "Observação", tipo: "area", max: 500, ajuda: "Em \"não deu\", diga por quê.", erro: "De 2 a 500 caracteres; em \"não deu\", diga por quê." },
          ],
          iniciais: { resultado: acao.item.resultado ?? "", observacao: acao.item.observacao ?? "" },
          salvar: async (v) => {
            const r = await chamarApi(`${url}/itens/${acao.item.id}/responder`, { corpo: { versao: m.versao, resultado: v.resultado || null, observacao: v.observacao || null } });
            if (r.ok) salvo("Resposta salva.");
            return r;
          } };
      default:
        return null;
    }
  }

  async function virar(item: ItemVistoria) {
    const r = await chamarApi<{ id: string }>(`${url}/itens/${item.id}/manutencao`, { corpo: { versao: m.versao } });
    if (!r.ok) return setFalha(r.erro);
    salvo(`"${item.texto}" virou uma manutenção corretiva, ligada a esta vistoria.`);
  }

  const j = janela();

  // Um botão principal por situação (A.1); o resto, só o que cabe na situação, em Mais ações.
  const principal: { texto: string; icone: NomeIcone; acao: () => void } | null = d.pode.editar && m.estado === "PLANEJADA"
    ? { texto: "Iniciar", icone: "seta", acao: () => void situacao("EM_ANDAMENTO", "Manutenção em andamento.") }
    : d.pode.editar && m.estado === "EM_ANDAMENTO" ? { texto: "Concluir", icone: "check", acao: () => setAcao({ tipo: "concluir" }) }
      : d.pode.editar && m.estado === "PENDENTE" ? { texto: "Resolver pendência", icone: "check", acao: () => void situacao("EM_ANDAMENTO", "Pendência resolvida.") }
        : d.pode.reabrir ? { texto: "Reabrir", icone: "trocar", acao: () => setAcao({ tipo: "reabrir" }) } : null;
  const mais = editar ? [
    { texto: "Editar", icone: "editar" as NomeIcone, acao: () => setAcao({ tipo: "editar" }) },
    ...(m.estado !== "PENDENTE" ? [{ texto: "Marcar pendência", icone: "relogio" as NomeIcone, acao: () => setAcao({ tipo: "pendencia" }) }] : []),
    ...(m.estado === "PENDENTE" ? [{ texto: "Concluir", icone: "check" as NomeIcone, acao: () => setAcao({ tipo: "concluir" }) }] : []),
    ...(d.pode.marcarVisita ? [{ texto: "Marcar visita", icone: "calendario" as NomeIcone, acao: () => setAcao({ tipo: "visita" }) }] : []),
    ...(m.estado === "EM_ANDAMENTO" ? [{ texto: "Voltar a planejada", icone: "trocar" as NomeIcone, acao: () => void situacao("PLANEJADA", "Manutenção voltou a planejada.") }] : []),
    { texto: "Cancelar manutenção", icone: "fechar" as NomeIcone, acao: () => setAcao({ tipo: "cancelar" }), perigo: true },
  ] : [];
  const mudar = (tipo: "etapa" | "previsao" | "repassar", texto: string) => <Botao variante="discreto" tamanho="m" onClick={() => setAcao({ tipo })}>{texto}</Botao>;
  const prioridadeAlta = m.prioridade && /^(alta|urgente)/i.test(m.prioridade.nome);

  const dados = (
    <Cartao id="t-dados" titulo="Dados da manutenção" icone="lista" className="max-lg:order-4"
      acao={editar ? <Botao variante="discreto" tamanho="m" disabled={!o} onClick={() => setAcao({ tipo: "editar" })}><Icone nome="editar" />Editar</Botao> : undefined}>
      <div>
        <Dado icone="trocar" nome="Situação"><SeloManutencao estado={m.estado} /></Dado>
        <Dado icone="pessoa" nome="Responsável" acao={editar && o && !m.pedidoOculto ? mudar("repassar", "Repassar") : undefined}>
          {m.responsavel.nome ? (
            <span className="flex items-center gap-2">
              <Iniciais nome={m.responsavel.nome} />
              <span className="grid"><span>{m.responsavel.nome}</span><span className="t-apoio">Acompanha e dá notícia</span></span>
            </span>
          ) : <Selo tom="atencao">Sem acesso agora</Selo>}
        </Dado>
        <Dado icone="lista" nome="Etapa" acao={editar && etapas.length ? mudar("etapa", "Mudar") : undefined}>{m.etapa?.nome ?? "Sem etapa"}</Dado>
        {!encerrada ? (
          <Dado icone="calendario" nome="Previsão de conclusão" regiao acao={editar ? mudar("previsao", m.previsao ? "Mudar" : "Definir") : undefined}>
            <span className="grid">
              <span className={m.previsao ? "t-codigo" : ""}>{m.previsao ? mostrarDataCurta(m.previsao).slice(0, 5) : "Sem previsão"}</span>
              <span className="t-apoio">Só quando souber. Não muda o próximo retorno.</span>
            </span>
          </Dado>
        ) : null}
        <Dado icone="pin" nome="Local ou equipamento">{m.local}</Dado>
        <Dado icone="relogio" nome="Registrada">
          <span className="t-codigo">{diaHora(m.criadoEm).replace(" ", ", ")}</span> <span className="t-apoio">{m.registradaPor ? `por ${m.registradaPor}` : "pela preventiva"}</span>
        </Dado>
        <Dado icone={ICONE_TIPO[m.tipo]} nome="Tipo e prioridade">
          {textoTipo(m)}{m.prioridade ? <> · <span className={prioridadeAlta ? "font-medium text-atencao" : ""}>{m.prioridade.nome}</span></> : null}
        </Dado>
        {m.preventiva ? <Dado icone="calendario" nome="Preventiva">{descreverFrequencia(m.preventiva.unidadeTempo, m.preventiva.intervalo)}, prevista para {m.dataPrevista ? mostrarDataCurta(m.dataPrevista) : ""}</Dado> : null}
        {m.acesso ? <Dado icone="chave" nome="Acesso">{m.acesso}</Dado> : null}
        {m.impedimento ? <Dado icone="alerta" nome="Impedimento">{m.impedimento}</Dado> : null}
        {m.detalhes ? <Dado icone="editar" nome="Detalhes"><span className="whitespace-pre-line">{m.detalhes}</span></Dado> : null}
      </div>
    </Cartao>
  );

  const providencias = (
    <Cartao id="t-providencias" titulo="Providências" icone="lista" className="max-lg:order-5"
      acao={editar ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao({ tipo: "providencia" })}><Icone nome="mais" />Nova providência</Botao> : undefined}>
      {d.providencias.length === 0 ? <p className="t-apoio">Nenhuma providência ainda. Divida o trabalho em passos, cada um com quem executa.</p> : (
        <ul className="divide-y divide-linha">
          {d.providencias.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom={p.feitaEm ? "ok" : undefined} aria-hidden="true"><Icone nome={p.feitaEm ? "check" : "lista"} className="h-4 w-4" /></span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{p.texto}</span>
                <span className="t-apoio">{nomeExecutor(p.executor)}{p.feitaEm ? ` · feita em ${diaHora(p.feitaEm).replace(" ", ", ")}${p.feitaPor ? ` por ${p.feitaPor}` : ""}` : ""}</span>
                {p.resultado ? <span className="mt-1 rounded-lg bg-ok-fundo px-2.5 py-1.5 text-[13px]">{p.resultado}</span> : null}
              </span>
              {p.feitaEm ? <Selo tom="ok">Feita</Selo> : editar
                ? <Botao variante="contorno" tamanho="p" onClick={() => setAcao({ tipo: "fazer", providencia: p })}><Icone nome="check" />Marcar feita</Botao>
                : <Selo tom="neutro">Aberta</Selo>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );

  const respondidos = d.itens.filter((i) => i.resultado).length;
  const vistoria = m.tipo === "VISTORIA" ? (
    <Cartao id="t-vistoria" titulo="O que olhar" icone="olho" className="max-lg:order-2"
      acao={editar ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao({ tipo: "itens" })}><Icone nome="editar" />Mudar a lista</Botao> : undefined}>
      {d.itens.length === 0 ? <p className="t-apoio">A lista está vazia. Inclua o que olhar nesta vistoria.</p> : (
        <ul className="divide-y divide-linha">
          {d.itens.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <span className="grid min-w-0 gap-0.5">
                <span>{i.texto}</span>
                {i.observacao || i.fotos ? <span className="t-apoio">{[i.observacao, i.fotos ? (i.fotos === 1 ? "1 foto" : `${i.fotos} fotos`) : null].filter(Boolean).join(" · ")}</span> : null}
                {i.gerada ? <Link href={`/manutencao/manutencao?id=${i.gerada.id}`} className="text-[13px] font-medium text-violeta-600 hover:underline">Virou manutenção: {i.gerada.titulo}</Link> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {i.resultado ? <Selo tom={TOM_ITEM[i.resultado]}>{RESULTADOS_ITEM[i.resultado]}</Selo> : <Selo tom="neutro">Sem resposta</Selo>}
                {editar ? <Botao variante="discreto" tamanho="p" onClick={() => setAcao({ tipo: "responder", item: i })} aria-label={`Responder ${i.texto}`}>Responder</Botao> : null}
                {editar && i.resultado === "PROBLEMA" && !i.gerada
                  ? <Botao variante="contorno" tamanho="p" onClick={() => void virar(i)}><Icone nome="ferramenta" />Virar manutenção</Botao> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="t-apoio">{d.itens.length ? `${respondidos} de ${d.itens.length} respondidos. ` : ""}Item com problema pode virar uma manutenção corretiva, ligada a esta vistoria.</p>
    </Cartao>
  ) : null;

  const ligacoes = (
    <Cartao id="t-ligacoes" titulo="Ligações" icone="link" rotulo="Ligações" className="max-lg:order-7">
      <div className="grid gap-2">
        {m.pedido ? <Ligacao href={`/pedidos/pedido?id=${m.pedido.id}`} icone="pedido" titulo={`Pedido ${m.pedido.protocolo}`} apoio={m.pedido.assunto} />
          : m.pedidoOculto ? <p className="t-apoio">Ligada a um pedido que você não vê.</p> : null}
        {(d.compromissos ?? []).map((c) => (
          <Ligacao key={c.id} href={`/agenda/compromisso?id=${c.id}`} icone="calendario" titulo={`Visita ${mostrarDataCurta(c.data).slice(0, 5)}, ${mostrarHorario(c)}`} apoio={c.titulo} />
        ))}
        {m.origem ? <Ligacao href={`/manutencao/manutencao?id=${m.origem.id}`} icone="olho" titulo="Veio da vistoria" apoio={`${m.origem.titulo} (as fotos do item ficam lá)`} /> : null}
        {d.geradas.map((g) => <Ligacao key={g.id} href={`/manutencao/manutencao?id=${g.id}`} icone="ferramenta" titulo={`Abriu: ${g.titulo}`} apoio={SITUACOES_MANUTENCAO[g.estado]} />)}
        {!m.pedido && !m.pedidoOculto && !(d.compromissos ?? []).length && !m.origem && !d.geradas.length
          ? <p className="t-apoio">Sem pedido nem visita ligados.</p> : null}
      </div>
      <p className="t-apoio">Concluir a manutenção não encerra o pedido. Cancelar a visita não apaga a manutenção.</p>
    </Cartao>
  );

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${principal ? "max-md:pb-28" : ""}`}>
      <header className="grid gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-5">
        <div className="flex items-center justify-between gap-3">
          {voltar}
          <MaisAcoes itens={mais} />
        </div>
        <div className="flex gap-5 max-md:gap-4">
          <span className="ladrilho h-16 w-16 shrink-0 rounded-[18px] max-md:h-14 max-md:w-14" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_TIPO[m.tipo]} className="h-7 w-7" /></span>
          <div className="grid min-w-0 flex-1 content-start gap-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="selo inline-flex items-center gap-1" data-tom="neutro"><Icone nome={ICONE_TIPO[m.tipo]} className="h-3.5 w-3.5" />{textoTipo(m)}</span>
              {prioridadeAlta ? <Selo tom="atencao">Prioridade {m.prioridade!.nome.toLowerCase()}</Selo> : null}
              <Selo tom={m.estado === "PLANEJADA" ? "info" : m.estado === "EM_ANDAMENTO" ? "andamento" : m.estado === "PENDENTE" ? "atencao" : m.estado === "CONCLUIDA" ? "ok" : "neutro"}>
                {SITUACOES_MANUTENCAO[m.estado]}{m.etapa && !encerrada ? ` · ${m.etapa.nome}` : ""}
              </Selo>
              {m.atrasada ? <Selo tom="erro">Atrasada</Selo> : null}
            </p>
            <h1 className="t-titulo-ficha [overflow-wrap:anywhere]">{m.titulo}</h1>
            <p className="t-apoio">{m.local} · registrada em {diaHora(m.criadoEm).replace(" ", ", ")}{m.registradaPor ? ` por ${m.registradaPor}` : " pela preventiva"}</p>
          </div>
        </div>
        {principal ? <div className="max-md:hidden"><Botao onClick={principal.acao}><Icone nome={principal.icone} />{principal.texto}</Botao></div> : null}
      </header>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}
      {m.pendencia ? <Aviso tom="atencao" titulo={`Pendente · ${nomePendencia(m.pendencia.tipo)}`} papel="status">{m.pendencia.motivo} Desde {diaHora(m.pendencia.desde).replace(" ", ", ")}.</Aviso> : null}
      {m.conclusao ? (
        <Aviso tom="ok" titulo={`Concluída · feita em ${mostrarDataCurta(m.conclusao.realizadaEm)}`}>
          {m.conclusao.texto} <span className="text-tinta-suave">({m.conclusao.por ?? "alguém"}, {diaHora(m.conclusao.em).replace(" ", ", ")})</span>
        </Aviso>
      ) : null}
      {m.cancelamento ? <Aviso tom="info" titulo="Manutenção cancelada">{m.cancelamento.por ?? "Alguém"} em {diaHora(m.cancelamento.em).replace(" ", ", ")}. Motivo: {m.cancelamento.motivo}</Aviso> : null}
      {m.estado === "CONCLUIDA" && m.pedido && m.pedido.estado !== "ENCERRADO" && m.pedido.estado !== "CANCELADO" ? (
        <Aviso tom="info">O pedido {m.pedido.protocolo} continua aberto: dê o retorno ao morador e conclua por lá.</Aviso>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <div className="contents lg:grid lg:min-w-0 lg:grid-cols-[minmax(0,1fr)] lg:gap-5">
          {!encerrada ? <div className="max-lg:order-1"><CartaoRetorno m={m} mudar={editar ? () => setAcao({ tipo: "retorno" }) : undefined} /></div> : null}
          {vistoria}
          {dados}
          {providencias}
          <div className="max-lg:order-6">
            <ArquivosManutencao key={`arq-${m.versao}`} manutencaoId={m.id} itens={d.itens}
              avisar={(r) => { setRecado(r); if (r) carga.recarregar(); }} />
          </div>
        </div>
        <div className="contents lg:grid lg:min-w-0 lg:grid-cols-[minmax(0,1fr)] lg:gap-5">
          <QuemExecuta d={d} condominio={painel.condominio.nome} trocar={editar && o ? () => setAcao({ tipo: "editar" }) : undefined} className="max-lg:order-3">
            {m.executor ? <LinkPrestador manutencaoId={m.id} titulo={m.titulo} versao={m.versao} recarregarManutencao={carga.recarregar} /> : null}
          </QuemExecuta>
          {ligacoes}
          <div className="max-lg:order-8"><NosComunicados manutencaoId={m.id} ativo={!encerrada} /></div>
          <Historico d={d} className="max-lg:order-9" />
        </div>
      </div>

      {principal ? (
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 grid gap-1 border-t border-linha bg-superficie px-4 pt-3 pb-2 shadow-s2 md:hidden">
          <Botao className="w-full" onClick={principal.acao}><Icone nome={principal.icone} />{principal.texto}</Botao>
          {mais.length ? <p className="t-apoio text-center">O resto fica em Mais ações, no alto.</p> : null}
        </div>
      ) : null}

      {j ? (
        <Janela key={acao?.tipo === "fazer" ? `f-${acao.providencia.id}` : acao?.tipo === "responder" ? `r-${acao.item.id}` : acao?.tipo} aberto titulo={j.titulo} campos={j.campos} iniciais={j.iniciais} textoBotao={j.botao} explicacao={j.explicacao}
          aoFechar={fechar} aoSalvar={j.salvar} recarregar={carga.recarregar} extra={j.extra} />
      ) : null}
      {o ? <FormManutencao aberto={acao?.tipo === "editar"} manutencao={m} opcoes={o} aoFechar={fechar} recarregar={carga.recarregar}
        salvo={(_, texto) => salvo(texto)} /> : null}
      {acao?.tipo === "visita" ? <MarcarVisita manutencaoId={m.id} aoFechar={fechar} salvo={salvo} /> : null}
    </div>
  );
}
