"use client";
// Ficha do cliente › WhatsApp com o número oficial pela Meta (F5.12; W-01, W-17, DC4; quadros 465 e
// 469): o número em destaque como o morador vê, os dados que a Meta dá, Conferir na Meta agora (com
// o resultado na hora; o sistema também confere sozinho todo dia), Desligar o número com motivo no
// rodapé do cartão, o estado Desligado e os modelos deste condomínio. O PIN e o token nunca
// aparecem: o PIN é criado pelo sistema e só muda ao desligar e ligar de novo.

import { useState, type ReactNode } from "react";
import {
  formatarDataHora, LINK_GERENCIADOR_META, mostrarTelefone, QUALIDADES_META, SITUACOES_MODELO_CONDOMINIO,
  type QualidadeMeta, type SituacaoModeloCondominio,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro,
  type ErroApi, type NomeIcone, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

type SaudeMeta = "OK" | "FALTA_CARTAO" | "BLOQUEADA";

interface DadosMeta {
  ligada: boolean;
  numero?: string;
  wabaId?: string;
  numeroId?: string;
  empresaId?: string;
  ligadaEm?: string;
  ligadaPor?: string;
  ligadaPeloSindico?: boolean;
  conferidoEm?: string;
  saude?: SaudeMeta;
  desligadoEm?: string;
  desligadoPor?: string;
  motivoDesligado?: string;
  modelos?: { chave: string; titulo: string; nome?: string; situacao: SituacaoModeloCondominio; motivo?: string; enviadoEm?: string; decididoEm?: string }[];
  pode?: { conectar: boolean };
}

interface Conferencia { conferidoEm: string; mudou: boolean; saude: SaudeMeta; qualidade?: QualidadeMeta; nomeExibicao?: string; limiteDiario?: number }

export interface ConexaoOficialFicha {
  nomeExibicao?: string;
  qualidade?: QualidadeMeta;
  limiteDiario?: number;
  faltaCartaoEm?: string;
  suspensoEm?: string;
  ultimaRecebida?: string;
}

const TOM_QUALIDADE: Record<QualidadeMeta, Tom> = { VERDE: "ok", AMARELO: "atencao", VERMELHO: "erro", DESCONHECIDA: "neutro" };
const TOM_MODELO: Record<SituacaoModeloCondominio, Tom> = { ENVIADO: "atencao", APROVADO: "ok", RECUSADO: "erro", PAUSADO: "atencao", DESATIVADO: "neutro", FALHOU: "erro" };
const SAUDE: Record<SaudeMeta, { tom: Tom; texto: string }> = {
  OK: { tom: "ok", texto: "Sem pendência" },
  FALTA_CARTAO: { tom: "erro", texto: "Falta o cartão" },
  BLOQUEADA: { tom: "erro", texto: "Bloqueada pela Meta" },
};
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

const CONSEQUENCIAS: { icone: NomeIcone; tom: Tom; titulo: string; texto: string }[] = [
  { icone: "balao", tom: "erro", titulo: "As mensagens param", texto: "As dos moradores deixam de chegar e nada mais sai por este número." },
  { icone: "predio", tom: "ok", titulo: "A conta continua do condomínio", texto: "Na Meta, com o número. O síndico pode ligar de novo pela janela da Meta." },
  { icone: "sino", tom: "neutro", titulo: "O síndico fica sabendo", texto: "No sino e por e-mail. A fila parada segue a regra de Quando o WhatsApp cair." },
];

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="grid content-start gap-0.5"><dt className="t-apoio text-tinta-suave">{rotulo}</dt><dd className="t-texto">{children}</dd></div>;
}

/** O número como o morador vê no WhatsApp: nome, conta comercial, número e selos. */
function NumeroComoMoradorVe({ nome, numero, desligado, suspenso }: { nome: string; numero: string | null; desligado: boolean; suspenso: boolean }) {
  return (
    <div className="grid content-start gap-3 rounded-[16px] border border-violeta-100 bg-gradient-to-b from-violeta-50 to-superficie p-5">
      <div className="flex items-center gap-3">
        <span className="ladrilho h-11 w-11 rounded-full" data-tom="violeta" aria-hidden="true"><Icone nome="predio" /></span>
        <div className="grid min-w-0">
          <span className="truncate t-texto font-medium">{nome}</span>
          <span className="flex items-center gap-1 t-apoio text-tinta-suave"><Icone nome="predio" className="h-3.5 w-3.5" />Conta comercial</span>
        </div>
      </div>
      <p className="t-titulo-secao font-mono tracking-wide">{numero ? mostrarTelefone(numero) : "Sem número na ficha"}</p>
      <div className="flex flex-wrap gap-2">
        {desligado ? <Selo tom="neutro">Desligado</Selo> : suspenso ? <Selo tom="erro">Fora do ar</Selo> : <Selo tom="ok">Ligado</Selo>}
        <Selo tom="info">Oficial (Meta)</Selo>
      </div>
      <p className="t-apoio text-tinta-suave">É assim que o morador vê o número.</p>
    </div>
  );
}

function JanelaDesligar({ id, nome, numero, aoFechar, aoDesligar }: { id: string; nome: string; numero: string | null; aoFechar: () => void; aoDesligar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [desligando, setDesligando] = useState(false);
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const curto = faltaMotivo || camposComErro(erro).includes("motivo");

  async function desligar() {
    setErro(null);
    setFaltaMotivo(motivo.trim().length < 3);
    if (motivo.trim().length < 3) return;
    setDesligando(true);
    const r = await chamarApi<{ desligadoEm: string }>(`/v1/clientes/${id}/whatsapp/meta/desligar`, { corpo: { motivo: motivo.trim() } });
    setDesligando(false);
    if (!r.ok) return setErro(r.erro);
    aoDesligar();
  }

  return (
    <Dialogo aberto media fechar titulo={`Desligar o número do ${nome}?`} apoio={`WhatsApp oficial${numero ? ` · ${mostrarTelefone(numero)}` : ""}`} aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro && !curto ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <ul className="grid gap-3">
          {CONSEQUENCIAS.map((c) => (
            <li key={c.titulo} className="flex items-start gap-3">
              <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom={c.tom} aria-hidden="true"><Icone nome={c.icone} className="h-4 w-4" /></span>
              <span className="grid gap-0.5"><span className="t-texto font-medium">{c.titulo}</span><span className="t-apoio text-tinta-suave">{c.texto}</span></span>
            </li>
          ))}
        </ul>
        <CampoAreaTexto id="wa-meta-motivo" rotulo="Motivo" required maxLength={300} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          ajuda="Fica no histórico da conexão, com o seu nome." erro={curto ? "Diga o motivo (3 a 300 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-4">
          <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
          <Botao variante="perigo" disabled={desligando} onClick={() => void desligar()}>{desligando ? "Desligando…" : "Desligar o número"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

/** O número oficial e os modelos deste condomínio (quadros 465 e 469). */
export function WhatsappOficial({ id, nome, numeroFicha, cx, aoMudar }: {
  id: string; nome: string; numeroFicha: string | null; cx: ConexaoOficialFicha; aoMudar: () => void;
}) {
  const carga = useCarregar<DadosMeta>(`/v1/clientes/${id}/whatsapp/meta`);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<{ tom: Tom; titulo?: string; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [desligar, setDesligar] = useState(false);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o número oficial…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const modelos = d.modelos ?? [];
  const conta = (s: SituacaoModeloCondominio[]) => modelos.filter((m) => s.includes(m.situacao)).length;
  const aprovados = conta(["APROVADO"]);
  const emAnalise = conta(["ENVIADO"]);
  const recusados = conta(["RECUSADO", "PAUSADO", "FALHOU"]);
  const numero = d.numero ?? numeroFicha;
  const desligado = !!d.desligadoEm;
  const pode = !!d.pode?.conectar;
  const faltaCartao = d.saude === "FALTA_CARTAO" || !!cx.faltaCartaoEm;
  const saude = SAUDE[d.saude ?? (faltaCartao ? "FALTA_CARTAO" : "OK")];

  async function mandarModelos() {
    setErro(null);
    setRecado(null);
    setEnviando(true);
    const r = await chamarApi<{ modelosEnviados: number }>(`/v1/clientes/${id}/whatsapp/meta/modelos`, { corpo: {} });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const n = r.dados.modelosEnviados;
    setRecado({ tom: "ok", texto: n === 0 ? "Nenhum modelo faltando: todos já estão na Meta." : `${n} ${n === 1 ? "modelo mandado" : "modelos mandados"} para a Meta aprovar.` });
    carga.recarregar();
  }

  async function conferir() {
    setErro(null);
    setRecado(null);
    setConferindo(true);
    const anterior = d.conferidoEm;
    const r = await chamarApi<Conferencia>(`/v1/clientes/${id}/whatsapp/meta/conferir`, { corpo: {} });
    setConferindo(false);
    if (!r.ok) return setErro(r.erro);
    const c = r.dados;
    const titulo = `Conferido agora, ${HORA.format(new Date(c.conferidoEm))}.`;
    const pendencia = c.saude !== "OK" ? ` Situação da conta: ${SAUDE[c.saude].texto.toLowerCase()}.` : "";
    setRecado(c.mudou
      ? { tom: c.saude === "OK" ? "info" : "atencao", titulo, texto: `A Meta mudou algo desde a última conferência; os dados abaixo já estão atualizados.${pendencia}` }
      : { tom: c.saude === "OK" ? "ok" : "atencao", titulo,
          texto: `Situação da conta, cartão e qualidade iguais aos da conferência${anterior ? ` das ${HORA.format(new Date(anterior))}` : " anterior"}.${pendencia}` });
    carga.recarregar();
    aoMudar();
  }

  const ligadoEm = d.ligadaEm
    ? `${formatarDataHora(d.ligadaEm)} · ${d.ligadaPeloSindico ? "pelo síndico, na janela da Meta" : d.ligadaPor ? `por ${d.ligadaPor}` : "pela TRÍADE"}`
    : "Sem registro";

  return (
    <div className="grid max-w-5xl gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {desligado && recado ? <Aviso tom={recado.tom} papel="status">{recado.texto}</Aviso> : null}
      {!desligado && cx.suspensoEm ? (
        <Aviso tom="erro" papel="status" titulo="A Meta suspendeu o número">Desde {formatarDataHora(cx.suspensoEm)}. O síndico vê o aviso em Configurações › WhatsApp.</Aviso>
      ) : null}
      {!desligado && cx.faltaCartaoEm ? (
        <Aviso tom="erro" papel="status" titulo="Falta o cartão na Meta">
          Desde {formatarDataHora(cx.faltaCartaoEm)} a Meta não aceita cobrar os avisos. As respostas ao morador saem; os avisos esperam o síndico pôr o cartão.
        </Aviso>
      ) : null}
      <section aria-labelledby="t-numero-oficial" className="grid gap-5 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <NumeroComoMoradorVe nome={cx.nomeExibicao ?? nome} numero={numero} desligado={desligado} suspenso={!!cx.suspensoEm} />
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="t-numero-oficial" className="flex-1 t-titulo-secao font-medium">Número oficial</h2>
            {desligado ? <Selo tom="neutro">Desligado</Selo> : (
              <Botao variante="contorno" tamanho="m" disabled={conferindo} onClick={() => void conferir()}>
                <Icone nome="trocar" />{conferindo ? "Conferindo na Meta…" : "Conferir na Meta agora"}
              </Botao>
            )}
          </div>
          {desligado ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Dado rotulo="Número"><span className="t-codigo">{numero ? mostrarTelefone(numero) : "Sem número"}</span></Dado>
                <Dado rotulo="Desligado em">{formatarDataHora(d.desligadoEm!)}{d.desligadoPor ? ` · ${d.desligadoPor}` : ""}</Dado>
                <Dado rotulo="Motivo">{d.motivoDesligado ?? "Sem motivo registrado"}</Dado>
                <Dado rotulo="Conta do WhatsApp (WABA)"><span className="t-codigo">{d.wabaId ?? "Sem registro"}</span></Dado>
              </dl>
              <p className="rounded-[12px] bg-superficie-2 p-4 t-apoio text-tinta-suave">
                Ligar de novo é com o síndico, pela janela da Meta. {aprovados > 0 ? `${aprovados === 1 ? "O modelo aprovado fica guardado" : `Os ${aprovados} modelos aprovados ficam guardados`} na conta do condomínio.` : "A conta continua do condomínio."}
              </p>
            </>
          ) : (
            <>
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Dado rotulo="Nome que aparece">{cx.nomeExibicao ?? "Ainda não informado"}</Dado>
                <Dado rotulo="Qualidade">{cx.qualidade ? <Selo tom={TOM_QUALIDADE[cx.qualidade]}>{QUALIDADES_META[cx.qualidade]}</Selo> : "Ainda sem nota"}</Dado>
                <Dado rotulo="Avisos por dia">{cx.limiteDiario ? `${cx.limiteDiario.toLocaleString("pt-BR")} moradores diferentes` : "A Meta ainda não informou"}</Dado>
                <Dado rotulo="Cartão na Meta">{faltaCartao ? <Selo tom="erro">Faltando</Selo> : <Selo tom="ok">Cadastrado</Selo>}</Dado>
                <Dado rotulo="Situação da conta"><Selo tom={saude.tom}>{saude.texto}</Selo></Dado>
                <Dado rotulo="Modelos de mensagem">{modelos.length ? `${aprovados} de ${modelos.length} ${aprovados === 1 ? "aprovado" : "aprovados"}` : "Nenhum mandado ainda"}</Dado>
                <Dado rotulo="Ligado em">{ligadoEm}</Dado>
                <Dado rotulo="Conferido na Meta">
                  {d.conferidoEm ? formatarDataHora(d.conferidoEm) : "Ainda não conferido"}
                  <span className="block t-apoio text-tinta-suave">O sistema confere sozinho todo dia</span>
                </Dado>
                <Dado rotulo="PIN do número">Criado e guardado pelo sistema</Dado>
                <Dado rotulo="Conta do WhatsApp (WABA)"><span className="t-codigo">{d.wabaId ?? "Sem registro"}</span></Dado>
                <Dado rotulo="Empresa na Meta"><span className="t-codigo">{d.empresaId ?? "Sem registro"}</span></Dado>
                {cx.ultimaRecebida ? <Dado rotulo="Última mensagem recebida">{formatarDataHora(cx.ultimaRecebida)}</Dado> : null}
              </dl>
              <div aria-live="polite">
                {recado ? <Aviso tom={recado.tom} titulo={recado.titulo} papel="status">{recado.texto}</Aviso> : null}
              </div>
              <a href={LINK_GERENCIADOR_META} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
                <Icone nome="link" className="h-4 w-4" />Gerenciador do WhatsApp<span className="sr-only"> (abre numa aba nova)</span>
              </a>
              {pode ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-4">
                  <p className="flex-1 t-apoio text-tinta-suave">Desligar tira o número da TRÍADE na Meta. A conta continua do condomínio.</p>
                  <Botao variante="perigo" tamanho="m" onClick={() => setDesligar(true)}>Desligar o número</Botao>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
      <section aria-labelledby="t-modelos-cliente" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="documento" className="h-4 w-4" /></span>
          <h2 id="t-modelos-cliente" className="flex-1 t-titulo-secao font-medium">Modelos de mensagem deste condomínio</h2>
          <Selo tom="neutro">{aprovados} {aprovados === 1 ? "aprovado" : "aprovados"} · {emAnalise} em análise · {recusados} {recusados === 1 ? "recusado" : "recusados"}</Selo>
        </div>
        <p className="t-apoio text-tinta-suave">
          Cada condomínio tem os seus, aprovados na conta dele. O texto vem do catálogo da TRÍADE (Console › WhatsApp › Modelos de mensagem).
        </p>
        {modelos.length === 0 ? <p className="t-apoio text-tinta-suave">Nenhum modelo mandado ainda.</p> : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Modelos, role para o lado">
            <table className="w-full border-collapse t-texto">
              <thead>
                <tr className="text-left t-apoio text-tinta-suave">
                  <th scope="col" className="px-3 py-2 font-medium">Modelo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Nome na Meta</th>
                  <th scope="col" className="px-3 py-2 font-medium">Situação</th>
                  <th scope="col" className="px-3 py-2 font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={`${m.chave}-${m.nome ?? ""}`} className="border-t border-linha">
                    <td className="px-3 py-2 font-medium">{m.titulo}</td>
                    <td className="px-3 py-2"><span className="t-codigo text-tinta-suave">{m.nome ?? m.chave}</span></td>
                    <td className="px-3 py-2"><Selo tom={TOM_MODELO[m.situacao]}>{SITUACOES_MODELO_CONDOMINIO[m.situacao]}</Selo></td>
                    <td className="px-3 py-2 t-apoio text-tinta-suave">
                      {m.motivo ? `“${m.motivo}”` : m.decididoEm ? `decidido em ${formatarDataHora(m.decididoEm)}` : m.enviadoEm ? `enviado em ${formatarDataHora(m.enviadoEm)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pode && !desligado ? (
          <div>
            <Botao variante="contorno" tamanho="m" disabled={enviando} onClick={() => void mandarModelos()}>
              <Icone nome="enviar" />{enviando ? "Mandando…" : "Mandar os modelos que faltam"}
            </Botao>
          </div>
        ) : null}
      </section>
      {desligar ? (
        <JanelaDesligar id={id} nome={nome} numero={numero} aoFechar={() => setDesligar(false)} aoDesligar={() => {
          setDesligar(false);
          setRecado({ tom: "ok", texto: "Número desligado. O síndico foi avisado no sino e por e-mail." });
          carga.recarregar();
          aoMudar();
        }} />
      ) : null}
    </div>
  );
}
