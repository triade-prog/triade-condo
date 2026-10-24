"use client";
// Pessoas › Conselho (R5, V-14; quadros 410, 411, 412 e 422): o conselho e o subsíndico do
// condomínio, como na ata da eleição; como o conselho decide; a ausência do síndico; incluir,
// alterar, renovar e retirar membro. Ser do conselho não dá acesso ao painel: cada um vê só o que
// for mandado para ele. Retirar não apaga: fica no histórico.

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CANAIS_CONSELHO, PAPEIS_CONSELHO, textoComoDecide, textoMandato, textoSemQuorum, type CanalConselho, type PapelConselho } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone,
  Iniciais, Selo, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { AusenciaSindico, CandidatoConselho, Conselho, MembroConselho, Recado } from "../tipos.ts";
import { diaDoPrazo } from "../decisoes/comum.tsx";
import { Escolha } from "../decisoes/Despesas.tsx";
import type { Moldura } from "./Pessoas.tsx";

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem_18px]";
const PAPEIS = Object.keys(PAPEIS_CONSELHO) as PapelConselho[];

/** Por onde o membro vota: "Painel e link", "Link pelo WhatsApp", "Link pelo e-mail". */
export const votaPor = (m: Pick<MembroConselho, "painel" | "canal" | "vota">) =>
  !m.vota ? "Não vota (suplente)" : m.painel ? "Painel e link" : m.canal === "WHATSAPP" ? "Link pelo WhatsApp" : "Link pelo e-mail";

/** Dias entre duas datas AAAA-MM-DD. */
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** O selo do mandato: vencido, vence em N dias ou nada. */
export function avisoMandato(m: Pick<MembroConselho, "emDia" | "mandatoFim" | "mandatoVencendo" | "mandatoInicio">, hoje: string): { texto: string; tom: "atencao" | "erro" } | null {
  if (!m.emDia && m.mandatoFim < hoje) return { texto: "Mandato vencido", tom: "erro" };
  if (!m.emDia && m.mandatoInicio > hoje) return { texto: `Começa em ${diaDoPrazo(m.mandatoInicio)}`, tom: "atencao" };
  if (m.mandatoVencendo) {
    const n = diasEntre(hoje, m.mandatoFim);
    return { texto: n <= 0 ? "Mandato vence hoje" : n === 1 ? "Mandato vence amanhã" : `Mandato vence em ${n} dias`, tom: "atencao" };
  }
  return null;
}

const somarAnos = (data: string, n: number) => `${Number(data.slice(0, 4)) + n}${data.slice(4)}`;

export function AbaConselho({ moldura, contar }: { moldura: Moldura; contar: (n: number) => void }) {
  const { atualizar } = usePlataforma();
  const carga = useCarregar<Conselho>("/v1/condominio/conselho");
  const [recado, setRecado] = useState<Recado>(null);
  const [incluir, setIncluir] = useState(false);
  const [ver, setVer] = useState<MembroConselho | null>(null);
  const [alterar, setAlterar] = useState<{ m: MembroConselho; renovar: boolean } | null>(null);
  const [retirar, setRetirar] = useState<MembroConselho | null>(null);
  const [ausencia, setAusencia] = useState(false);
  const [encerrar, setEncerrar] = useState<AusenciaSindico | null>(null);
  const pronto = carga.estado === "pronto" ? carga.dados : null;
  useEffect(() => { if (pronto) contar(pronto.membros.length); }, [pronto, contar]);

  const titulo = (botao?: React.ReactNode) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="t-titulo-tela">Pessoas e acesso</h1>
        <p className="t-apoio mt-1">O conselho e o subsíndico do condomínio, como na ata da eleição. Ser do conselho não dá acesso ao painel: cada um vê só o que for mandado para ele.</p>
      </div>
      {botao}
    </div>
  );
  if (carga.estado === "carregando") return <div className="grid gap-5">{titulo()}{moldura(<Carregando rotulo="Carregando o conselho…" />)}</div>;
  if (carga.estado === "erro") return <div className="grid gap-5">{titulo()}{moldura(<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />)}</div>;

  const c = carga.dados;
  const gerencia = c.pode.gerenciar;
  const salvo = (texto: string) => { setRecado({ tom: "ok", texto }); carga.recarregar(); atualizar(); };
  const botaoIncluir = gerencia ? <Botao onClick={() => setIncluir(true)}><Icone nome="mais" />Incluir membro</Botao> : null;
  const r = c.regras;
  const semQuorum = r.titularesEmDia > 0 && !r.podePedir;

  return (
    <div className="grid gap-5">
      {titulo(botaoIncluir)}
      {moldura(<>
        {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
        {semQuorum ? (
          <Aviso tom="atencao" titulo="Sem quórum possível">
            {textoSemQuorum(r)} {gerencia ? <Link href="/configuracoes/decisoes" className="font-medium text-violeta-600 hover:underline">Abrir Regras</Link> : null}
          </Aviso>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="t-como" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <div className="flex items-start gap-3">
              <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="pessoas" /></span>
              <div className="grid flex-1 gap-0.5">
                <h2 id="t-como" className="t-titulo-cartao">Como o conselho decide</h2>
                <p className="t-apoio">{textoComoDecide(r)}</p>
              </div>
            </div>
            {gerencia ? <Link href="/configuracoes/decisoes" className={classeBotao("contorno", "justify-self-start", "m")}><Icone nome="editar" />Mudar em Regras</Link> : null}
          </section>
          <CartaoAusencia c={c} marcar={() => setAusencia(true)} encerrar={setEncerrar} />
        </div>

        {c.membros.length === 0 ? (
          <Vazio titulo="Conselho vazio" icone="pessoas">
            Ainda não há conselho cadastrado. &quot;O conselho&quot; não aparece em Quem decide até haver pelo menos um titular com mandato em dia.
            {gerencia ? <span className="mt-3 block"><Botao variante="secundario" tamanho="m" onClick={() => setIncluir(true)}><Icone nome="mais" />Incluir membro</Botao></span> : null}
          </Vazio>
        ) : (
          <section aria-labelledby="t-membros" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
            <h2 id="t-membros" className="sr-only">Membros do conselho</h2>
            <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-superficie-2 px-5 py-2.5 t-rotulo md:grid ${COLUNAS}`}>
              <span /><span>Membro</span><span>Papel</span><span>Mandato</span><span>Vota por</span><span />
            </div>
            <ul className="grid max-md:gap-3">
              {c.membros.map((m) => {
                const aviso = avisoMandato(m, c.hoje);
                return (
                  <li key={m.id} className={`relative grid grid-cols-[40px_minmax(0,1fr)_18px] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:border-linha md:last:border-b-0 ${COLUNAS}`}>
                    <Iniciais nome={m.nome} className="h-9 w-9 self-start md:self-center" />
                    <span className="grid min-w-0 gap-0.5">
                      <button type="button" className="elo justify-self-start text-left font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600"
                        onClick={() => setVer(m)}>{m.nome}</button>
                      <span className="t-apoio">{m.unidade ?? (m.pessoaId ? "Pessoa com acesso" : m.contatoId ? "Morador" : "Só no conselho")}</span>
                      <span className="flex flex-wrap items-center gap-1.5 pt-1 md:hidden">
                        <span className="t-texto">{PAPEIS_CONSELHO[m.papel]}</span>
                        {m.titular ? <Selo tom="andamento">Titular</Selo> : <Selo tom="neutro">Suplente</Selo>}
                        {aviso ? <Selo tom={aviso.tom}>{aviso.texto}</Selo> : null}
                      </span>
                      <span className="t-apoio md:hidden">{textoMandato(m.mandatoInicio, m.mandatoFim)} · {votaPor(m)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 max-md:hidden">
                      <span className="t-texto">{PAPEIS_CONSELHO[m.papel]}</span>
                      {m.titular ? <Selo tom="andamento">Titular</Selo> : <Selo tom="neutro">Suplente</Selo>}
                    </span>
                    <span className="grid gap-1 max-md:hidden">
                      <span className="t-codigo">{textoMandato(m.mandatoInicio, m.mandatoFim)}</span>
                      {aviso ? <span><Selo tom={aviso.tom}>{aviso.texto}</Selo></span> : null}
                    </span>
                    <span className="t-apoio max-md:hidden">{votaPor(m)}</span>
                    <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <p className="t-apoio">
          O aviso do mandato chega no sino 30 dias antes do fim. Membro com mandato vencido continua na lista, sem votar, até você renovar ou retirar. Retirar fica no histórico.
        </p>
        {c.retirados?.length ? (
          <details className="t-texto">
            <summary className="cursor-pointer font-medium text-violeta-600">{c.retirados.length === 1 ? "1 membro retirado" : `${c.retirados.length} membros retirados`}</summary>
            <ul className="mt-2 grid gap-2">
              {c.retirados.map((m) => (
                <li key={m.id} className="grid gap-0.5 rounded-2xl border border-linha bg-superficie p-3">
                  <span className="font-medium">{m.nome} · {PAPEIS_CONSELHO[m.papel]}</span>
                  <span className="t-apoio">Retirado{m.retiradoEm ? ` em ${diaDoPrazo(m.retiradoEm.slice(0, 10))}` : ""}{m.retiradoMotivo ? `: ${m.retiradoMotivo}` : ""}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </>)}

      <IncluirMembro aberto={incluir} c={c} aoFechar={() => setIncluir(false)} salvo={(t) => { setIncluir(false); salvo(t); }} />
      <FichaMembro m={ver} c={c} aoFechar={() => setVer(null)}
        alterar={(m, renovar) => { setVer(null); setAlterar({ m, renovar }); }} retirar={(m) => { setVer(null); setRetirar(m); }} />
      <AlterarMembro alvo={alterar} hoje={c.hoje} aoFechar={() => setAlterar(null)} recarregar={carga.recarregar} salvo={(t) => { setAlterar(null); salvo(t); }} />
      <Janela aberto={retirar !== null} titulo="Retirar do conselho" aoFechar={() => setRetirar(null)} recarregar={carga.recarregar}
        campos={[{ id: "motivo", rotulo: "Por que retirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Retirar"
        explicacao={retirar ? `${retirar.nome} sai do conselho e os links que tinha param de valer. Os votos que já deu ficam. Nada é apagado: fica no histórico.` : undefined}
        aoSalvar={async (v) => {
          const res = await chamarApi(`/v1/condominio/conselho/${retirar?.id}/retirar`, { corpo: { versao: retirar?.versao, motivo: String(v.motivo ?? "").trim() } });
          if (res.ok) { const nome = retirar?.nome; setRetirar(null); salvo(`${nome} saiu do conselho. Fica no histórico.`); }
          return res;
        }} />
      <MarcarAusencia aberto={ausencia} c={c} aoFechar={() => setAusencia(false)} salvo={(t) => { setAusencia(false); salvo(t); }} />
      <EncerrarAusencia a={encerrar} aoFechar={() => setEncerrar(null)} salvo={(t) => { setEncerrar(null); salvo(t); }} />
    </div>
  );
}

/** A ausência do síndico, no cartão (quadros 410 e 422). */
function CartaoAusencia({ c, marcar, encerrar }: { c: Conselho; marcar: () => void; encerrar: (a: AusenciaSindico) => void }) {
  const a = c.ausencia;
  const sub = c.subsindico?.nome;
  const texto = a
    ? a.ativa ? `${a.sindico ?? c.sindico ?? "O síndico"} está ausente de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)}. Decisões pedidas ao síndico estão indo para ${a.substituto}.`
      : `Marcada de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)}. Nesses dias, as decisões pedidas ao síndico vão para ${a.substituto}.`
    : sub ? `Nenhuma marcada. Quando você marcar as datas, as decisões pedidas ao síndico vão para ${sub}, o subsíndico.`
      : "Nenhuma marcada. Sem subsíndico no conselho, a ausência não pode ser marcada.";
  return (
    <section aria-labelledby="t-ausencia" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom={a?.ativa ? "info" : "violeta"} aria-hidden="true"><Icone nome="calendario" /></span>
        <div className="grid flex-1 gap-0.5">
          <h2 id="t-ausencia" className="t-titulo-cartao">Ausência do síndico</h2>
          <p className="t-apoio">{texto}</p>
        </div>
      </div>
      {c.pode.marcarAusencia ? (
        a ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => encerrar(a)}><Icone nome="fechar" />{a.ativa ? "Encerrar a ausência" : "Desmarcar a ausência"}</Botao>
          : sub ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={marcar}><Icone nome="calendario" />Marcar ausência</Botao> : null
      ) : null}
    </section>
  );
}

/** A ficha do membro, com Alterar, Renovar mandato e Retirar. */
function FichaMembro({ m, c, aoFechar, alterar, retirar }: {
  m: MembroConselho | null; c: Conselho; aoFechar: () => void; alterar: (m: MembroConselho, renovar: boolean) => void; retirar: (m: MembroConselho) => void;
}) {
  const aviso = m ? avisoMandato(m, c.hoje) : null;
  return (
    <Dialogo aberto={m !== null} titulo={m?.nome ?? "Membro do conselho"} aoFechar={aoFechar} fechar media apoio={m ? `${PAPEIS_CONSELHO[m.papel]} · ${m.titular ? "Titular" : "Suplente"}` : undefined}>
      {m ? (
        <div className="grid gap-4">
          {aviso ? (
            <Aviso tom="atencao" titulo={aviso.texto}>
              {aviso.tom === "erro" ? `O mandato de ${m.nome} venceu em ${diaDoPrazo(m.mandatoFim)}. Não vota até você renovar ou retirar. Os votos que já deu ficam.`
                : `O mandato vai até ${diaDoPrazo(m.mandatoFim)}. Renove quando houver a ata da nova eleição.`}
            </Aviso>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            {[["Mandato", textoMandato(m.mandatoInicio, m.mandatoFim)], ["Vota por", votaPor(m)],
              ["Recebe o link", `${CANAIS_CONSELHO[m.canal]}${m.canal === "WHATSAPP" ? ` · ${m.celular ?? m.celularMascarado ?? "sem celular"}` : ` · ${m.email ?? m.emailMascarado ?? "sem e-mail"}`}`],
              ["Quem é", m.unidade ?? (m.pessoaId ? "Pessoa com acesso ao painel" : m.contatoId ? "Morador cadastrado" : "Só no conselho")]].map(([a, b]) => (
              <div key={a} className="grid gap-0.5">
                <dt className="t-apoio">{a}</dt>
                <dd className="t-texto">{b}</dd>
              </div>
            ))}
          </dl>
          <p className="t-apoio">O papel não dá permissão no painel; para isso, use Pessoas e acesso.</p>
          {c.pode.gerenciar ? (
            <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
              <Botao variante="discreto" onClick={() => retirar(m)}><Icone nome="fechar" />Retirar</Botao>
              <Botao variante="contorno" onClick={() => alterar(m, false)}><Icone nome="editar" />Alterar</Botao>
              {aviso ? <Botao onClick={() => alterar(m, true)}><Icone nome="relogio" />Renovar mandato</Botao> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialogo>
  );
}

/** Os campos do mandato e do contato, comuns a incluir e alterar. */
function CamposMandato({ v, mudar, comErro, contatoDaFicha }: {
  v: DadosMandato; mudar: (x: Partial<DadosMandato>) => void; comErro: string[]; contatoDaFicha?: { celular?: string; email?: string };
}) {
  return (
    <>
      <CampoSelecao id="membro-papel" rotulo="Papel" value={v.papel} onChange={(e) => mudar({ papel: e.target.value as PapelConselho })}
        opcoes={PAPEIS.map((p) => ({ valor: p, texto: p === "SUPLENTE" ? "Suplente (não vota)" : `${PAPEIS_CONSELHO[p]} (titular)` }))}
        erro={comErro.includes("papel") ? "Escolha o papel." : null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="membro-inicio" rotulo="Início do mandato" type="date" required value={v.inicio} onChange={(e) => mudar({ inicio: e.target.value })}
          erro={comErro.includes("mandatoInicio") ? "Confira a data." : null} />
        <CampoTexto id="membro-fim" rotulo="Fim do mandato" type="date" required value={v.fim} min={v.inicio} onChange={(e) => mudar({ fim: e.target.value })}
          ajuda="Como na ata da eleição." erro={comErro.includes("mandatoFim") ? "O fim do mandato vem depois do início." : null} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-apoio font-medium">Como recebe o link para votar</legend>
        <Escolha nome="membro-canal" valor="WHATSAPP" atual={v.canal} mudar={(x) => mudar({ canal: x as CanalConselho })} texto="WhatsApp"
          sub={contatoDaFicha?.celular ? `${contatoDaFicha.celular}, o celular da ficha` : "O link vai para copiar e mandar da sua conversa, até o WhatsApp do condomínio mandar sozinho"} />
        <Escolha nome="membro-canal" valor="EMAIL" atual={v.canal} mudar={(x) => mudar({ canal: x as CanalConselho })} texto="E-mail"
          sub={contatoDaFicha?.email ?? "O link chega pelo e-mail"} />
      </fieldset>
      {v.canal === "WHATSAPP" ? (
        <CampoTexto id="membro-celular" rotulo="Celular" type="tel" inputMode="tel" maxLength={30} opcional={!!contatoDaFicha?.celular} value={v.celular}
          onChange={(e) => mudar({ celular: e.target.value })} ajuda={contatoDaFicha?.celular ? "Em branco, vale o da ficha." : "Com o DDD."}
          erro={comErro.includes("celular") ? "Escreva o celular com o DDD." : null} />
      ) : (
        <CampoTexto id="membro-email" rotulo="E-mail" type="email" maxLength={254} opcional={!!contatoDaFicha?.email} value={v.email}
          onChange={(e) => mudar({ email: e.target.value })} ajuda={contatoDaFicha?.email ? "Em branco, vale o da ficha." : undefined}
          erro={comErro.includes("email") ? "Escreva um e-mail válido." : null} />
      )}
    </>
  );
}

interface DadosMandato { papel: PapelConselho; inicio: string; fim: string; canal: CanalConselho; celular: string; email: string }

/** Incluir membro do conselho (quadro 411). */
function IncluirMembro({ aberto, c, aoFechar, salvo }: { aberto: boolean; c: Conselho; aoFechar: () => void; salvo: (t: string) => void }) {
  return (
    <Dialogo aberto={aberto} titulo="Incluir membro do conselho" aoFechar={aoFechar} fechar media>
      {aberto ? <FormIncluir c={c} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormIncluir({ c, aoFechar, salvo }: { c: Conselho; aoFechar: () => void; salvo: (t: string) => void }) {
  const [quem, setQuem] = useState<"CADASTRADA" | "NOVA">("CADASTRADA");
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const candidatos = useCarregar<{ candidatos: CandidatoConselho[] }>(quem === "CADASTRADA" ? `/v1/condominio/conselho/candidatos${termo ? `?busca=${encodeURIComponent(termo)}` : ""}` : null);
  const [escolhido, setEscolhido] = useState<CandidatoConselho | null>(null);
  const [nome, setNome] = useState("");
  const [v, setV] = useState<DadosMandato>({ papel: c.subsindico ? "CONSELHEIRO" : "SUBSINDICO", inicio: c.hoje, fim: somarAnos(c.hoje, 2), canal: "WHATSAPP", celular: "", email: "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  useEffect(() => { const t = setTimeout(() => setTermo(busca.trim()), 300); return () => clearTimeout(t); }, [busca]);
  const daFicha = escolhido?.tipo === "CONTATO" ? { celular: escolhido.celularMascarado, email: escolhido.emailMascarado } : undefined;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (quem === "CADASTRADA" && !escolhido) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["pessoaId"] } });
    setEnviando(true);
    const r = await chamarApi<{ id: string }>("/v1/condominio/conselho", {
      corpo: {
        pessoaId: quem === "CADASTRADA" && escolhido?.tipo === "PESSOA" ? escolhido.id : null,
        contatoId: quem === "CADASTRADA" && escolhido?.tipo === "CONTATO" ? escolhido.id : null,
        nome: quem === "NOVA" ? nome.trim() : null,
        papel: v.papel, mandatoInicio: v.inicio, mandatoFim: v.fim, canal: v.canal,
        celular: v.canal === "WHATSAPP" ? v.celular.trim() || null : null, email: v.canal === "EMAIL" ? v.email.trim() || null : null,
      },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const quemFoi = quem === "NOVA" ? nome.trim() : escolhido?.nome ?? "O membro";
    salvo(`${quemFoi} entrou no conselho como ${PAPEIS_CONSELHO[v.papel].toLowerCase()}.`);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !["pessoaId", "contatoId", "nome", "papel", "mandatoInicio", "mandatoFim", "celular", "email"].some((x) => comErro.includes(x))
        ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-apoio font-medium">Quem é</legend>
        <Escolha nome="membro-quem" valor="CADASTRADA" atual={quem} mudar={(x) => setQuem(x as "CADASTRADA")} texto="Pessoa já cadastrada"
          sub="Morador, proprietário ou pessoa com acesso. Busque pelo nome ou pela unidade." />
        <Escolha nome="membro-quem" valor="NOVA" atual={quem} mudar={(x) => setQuem(x as "NOVA")} texto="Só o nome e o contato"
          sub="Para quem não está cadastrado. Fica só no conselho." />
      </fieldset>
      {quem === "CADASTRADA" ? (
        <div className="grid gap-2">
          <CampoTexto id="membro-busca" rotulo="Pessoa" type="search" maxLength={60} value={busca} onChange={(e) => setBusca(e.target.value)}
            ajuda="O nome ou a unidade." erro={comErro.includes("pessoaId") || comErro.includes("contatoId") ? "Escolha a pessoa na lista." : null} />
          {candidatos.estado === "carregando" ? <Carregando linhas={2} rotulo="Buscando…" />
            : candidatos.estado === "erro" ? <ErroCarregar erro={candidatos.erro} texto={candidatos.texto} tentarDeNovo={candidatos.recarregar} />
              : candidatos.dados.candidatos.length ? (
                <fieldset className="grid max-h-60 gap-2 overflow-y-auto">
                  <legend className="sr-only">Escolha a pessoa</legend>
                  {candidatos.dados.candidatos.map((x) => (
                    <Escolha key={x.id} nome="membro-pessoa" valor={x.id} atual={escolhido?.id ?? ""} mudar={() => setEscolhido(x)}
                      texto={x.nome} sub={x.detalhe ?? (x.tipo === "PESSOA" ? "Pessoa com acesso ao painel" : "Morador cadastrado")} />
                  ))}
                </fieldset>
              ) : <p className="t-apoio">Ninguém com esse nome. Para quem não está cadastrado, escolha Só o nome e o contato.</p>}
        </div>
      ) : (
        <CampoTexto id="membro-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
          erro={comErro.includes("nome") ? "Escreva o nome (2 a 120 caracteres)." : null} />
      )}
      <CamposMandato v={v} mudar={(x) => setV((y) => ({ ...y, ...x }))} comErro={comErro} contatoDaFicha={daFicha} />
      <p className="flex items-start gap-2 t-apoio">
        <Icone nome="info" className="mt-px h-4 w-4 shrink-0" />
        Papéis: Subsíndico, Conselheiro, Conselheiro fiscal ou Suplente. Só um subsíndico por vez. O papel não dá permissão no painel; para isso, use Pessoas e acesso.
      </p>
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Incluindo…" : "Incluir"}</Botao>
      </div>
    </form>
  );
}

/** Alterar o papel, o mandato e o canal; renovar o mandato é a mesma janela, com as datas novas. */
function AlterarMembro({ alvo, hoje, aoFechar, recarregar, salvo }: {
  alvo: { m: MembroConselho; renovar: boolean } | null; hoje: string; aoFechar: () => void; recarregar: () => void; salvo: (t: string) => void;
}) {
  return (
    <Dialogo aberto={alvo !== null} titulo={alvo?.renovar ? "Renovar mandato" : "Alterar membro do conselho"} aoFechar={aoFechar} fechar media apoio={alvo?.m.nome}>
      {alvo ? <FormAlterar key={alvo.m.id} {...alvo} hoje={hoje} aoFechar={aoFechar} recarregar={recarregar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormAlterar({ m, renovar, hoje, aoFechar, recarregar, salvo }: {
  m: MembroConselho; renovar: boolean; hoje: string; aoFechar: () => void; recarregar: () => void; salvo: (t: string) => void;
}) {
  const inicio = renovar ? (m.mandatoFim < hoje ? hoje : m.mandatoFim) : m.mandatoInicio;
  const [v, setV] = useState<DadosMandato>({
    papel: m.papel, inicio, fim: renovar ? somarAnos(inicio, 2) : m.mandatoFim, canal: m.canal, celular: m.celular ?? "", email: m.email ?? "",
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/conselho/${m.id}`, {
      metodo: "PUT",
      corpo: { versao: m.versao, papel: v.papel, mandatoInicio: v.inicio, mandatoFim: v.fim, canal: v.canal, celular: v.celular.trim() || null, email: v.email.trim() || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(renovar ? `Mandato de ${m.nome} renovado até ${diaDoPrazo(v.fim)}/${v.fim.slice(0, 4)}.` : `${m.nome}: dados do conselho salvos.`);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !["papel", "mandatoInicio", "mandatoFim", "celular", "email"].some((x) => comErro.includes(x))
        ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <CamposMandato v={v} mudar={(x) => setV((y) => ({ ...y, ...x }))} comErro={comErro} />
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}><Icone nome="check" />{renovar ? "Renovar" : "Salvar"}</Botao>
      </div>
    </form>
  );
}

/** Ausência do síndico (quadro 412). */
function MarcarAusencia({ aberto, c, aoFechar, salvo }: { aberto: boolean; c: Conselho; aoFechar: () => void; salvo: (t: string) => void }) {
  return (
    <Dialogo aberto={aberto} titulo="Ausência do síndico" aoFechar={aoFechar} fechar media apoio={c.sindico ? `${c.sindico} · síndico` : undefined}>
      {aberto ? <FormAusencia c={c} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormAusencia({ c, aoFechar, salvo }: { c: Conselho; aoFechar: () => void; salvo: (t: string) => void }) {
  const sub = c.subsindico?.nome ?? "o subsíndico";
  const primeiro = sub.split(" ")[0];
  const [de, setDe] = useState(c.hoje);
  const [ate, setAte] = useState(c.hoje);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const limite = (() => { const t = Date.parse(`${de}T12:00:00Z`) + 60 * 86_400_000; return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10); })();
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/ausencia", { corpo: { de, ate, motivo: motivo.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(`Ausência marcada de ${diaDoPrazo(de)} a ${diaDoPrazo(ate)}. ${sub} responde no lugar do síndico e foi avisado.`);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !["de", "ate", "motivo"].some((x) => comErro.includes(x)) ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="aus-de" rotulo="De" type="date" required min={c.hoje} value={de} onChange={(e) => setDe(e.target.value)}
          erro={comErro.includes("de") ? "A ausência começa hoje ou depois." : null} />
        <CampoTexto id="aus-ate" rotulo="Até" type="date" required min={de} max={limite} value={ate} onChange={(e) => setAte(e.target.value)}
          ajuda="Até 60 dias." erro={comErro.includes("ate") ? "O fim vem depois do começo, em até 60 dias." : null} />
      </div>
      <div className="grid gap-1">
        <p className="t-apoio font-medium">Quem substitui</p>
        <p className="t-texto">{sub} · Subsíndico</p>
        <p className="t-apoio">Vem do conselho. Sem subsíndico, a ausência não pode ser marcada.</p>
      </div>
      <CampoAreaTexto id="aus-motivo" rotulo="Motivo" opcional maxLength={200} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
        erro={comErro.includes("motivo") ? "De 2 a 200 caracteres." : null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-1.5 rounded-[14px] border border-linha bg-superficie p-4">
          <span className="flex items-center gap-2 t-texto font-semibold text-ok"><Icone nome="check" />Vai para {primeiro}</span>
          <span className="t-apoio text-tinta">As decisões pedidas a você, as novas e as que estão aguardando. Os avisos de decisão vencida. As despesas que pedem a sua aprovação.</span>
        </div>
        <div className="grid content-start gap-1.5 rounded-[14px] border border-linha bg-superficie p-4">
          <span className="flex items-center gap-2 t-texto font-semibold text-tinta-suave"><Icone nome="cadeado" />Fica com você</span>
          <span className="t-apoio text-tinta">Configurações, Pessoas e acesso, o contrato com a TRÍADE e a fila de pedidos, que segue a pessoa marcada em Para quem vão os pedidos novos.</span>
        </div>
      </div>
      <p className="flex items-start gap-2 t-apoio">
        <Icone nome="info" className="mt-px h-4 w-4 shrink-0" />
        {primeiro} é avisado quando a ausência começa e quando termina. No fim, o que ele não respondeu volta para você, com tudo o que ele já decidiu no histórico.
      </p>
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}><Icone nome="check" />Marcar ausência</Botao>
      </div>
    </form>
  );
}

function EncerrarAusencia({ a, aoFechar, salvo }: { a: AusenciaSindico | null; aoFechar: () => void; salvo: (t: string) => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function encerrar() {
    if (!a) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/ausencia/${a.id}/encerrar`, { corpo: { versao: a.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo("Ausência encerrada. O que estava com o subsíndico e não foi respondido voltou para o síndico.");
  }
  return (
    <Dialogo aberto={a !== null} titulo={a?.ativa ? "Encerrar a ausência" : "Desmarcar a ausência"} aoFechar={() => { setErro(null); aoFechar(); }}>
      {a ? (
        <div className="grid gap-4">
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <p className="t-texto">
            {a.ativa ? `A ausência de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)} termina agora.` : `A ausência marcada de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)} deixa de valer.`}{" "}
            O que {a.substituto} não respondeu volta para o síndico, e os links de substituto param de valer. O que ele já decidiu fica no histórico.
          </p>
          <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
            <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
            <Botao disabled={enviando} onClick={() => void encerrar()}><Icone nome="fechar" />{a.ativa ? "Encerrar" : "Desmarcar"}</Botao>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}
