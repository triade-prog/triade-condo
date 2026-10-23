"use client";
// Registrar pedido (AT-01, AT-03, AT-32; DC15, telas-modelo/pedido-registrar-*): onde é (unidade
// ou área comum), quem pediu (só contato confirmado da unidade, MU-02), como chegou,
// categoria, prioridade com o significado, assunto e o relato. O responsável vem com o padrão
// da fila. O protocolo aparece depois de salvar. Fotos e documentos (opcional, passo 4b) entram
// como parte do relato, enviados logo depois do registro. Quem fica sabendo (F6.4, AT-26) fica
// ao lado no computador: os avisos saem junto com o registro e a confirmação mostra o que saiu.
// No computador o formulário é uma tela só, em três partes numeradas; no celular são três
// passos com barra de progresso, e nada do que foi preenchido se perde ao voltar.
// Do WhatsApp (decisão B.1 de 22/10/2026, quadros 105 a 107 do canvas), o relato vem das
// mensagens de um número em "A identificar" e, depois de registrar, elas são juntadas ao pedido.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, chamarApi, camposComErro, Dialogo, Icone, Interruptor, textoDoErro, type ErroApi } from "@triade/ui";
import type { AvisoDoRegistro, OpcoesPedidos } from "../tipos.ts";
import { Escolha, nomeRelacao } from "../moradores/comum.tsx";
import { CANAIS_PEDIDO_EXIBICAO } from "@triade/domain";
import { ICONE_CANAL, iconeDaCategoria, opcoesCanal } from "./comum.tsx";
import { EscolherArquivos, enviarArquivos, type ItemEnvio } from "./Arquivos.tsx";
import { ListaLocais } from "../Locais.tsx";
import { useCelular } from "../celular.ts";
import { acompanharRascunhos, BlocoQuemAvisar, contarAvisos, ESCOLHA_INICIAL, faltasNoLink, juntar, paraEnviar, usePrevia, type EscolhaAvisos } from "./QuemAvisar.tsx";
import { ConfirmacaoRegistro, type Registrado } from "./AvisosDoRegistro.tsx";

interface ContatoConfirmado { contatoId: string; nome: string; relacao: string; principal: boolean }

/** Registrar com as mensagens do WhatsApp. Como chegou é o WhatsApp do condomínio, fixo: o banco
 * grava esse canal só com a mensagem, e registra e junta a conversa juntos (D4.20, decisão A.2). */
export interface DaMensagem {
  /** De onde vêm as mensagens, no alto do formulário. */
  origem: ReactNode;
  relato: string;
  /** A mensagem de onde o pedido nasce: o banco junta a conversa no mesmo registro. */
  mensagemId: string;
}

export function RegistrarPedido({ aberto, opcoes, aoFechar, registrado, aoRegistrar, daMensagem }: {
  aberto: boolean;
  opcoes: OpcoesPedidos;
  aoFechar: () => void;
  /** Abrir o pedido registrado. */
  registrado: (protocolo: string, id: string) => void;
  /** Avisa a fila que entrou um pedido, antes de a pessoa sair da confirmação. */
  aoRegistrar?: () => void;
  daMensagem?: DaMensagem;
}) {
  const [chave, setChave] = useState(0);
  return (
    <Dialogo aberto={aberto} titulo="Registrar pedido" aoFechar={aoFechar} larga fechar
      apoio={daMensagem ? "Com as mensagens do WhatsApp. O protocolo sai na hora." : "O protocolo sai na hora. Quem fica sabendo aparece ao lado antes de registrar."}>
      {aberto ? <Formulario key={chave} opcoes={opcoes} aoFechar={aoFechar} registrado={registrado} aoRegistrar={aoRegistrar} daMensagem={daMensagem}
        outro={() => setChave((n) => n + 1)} /> : null}
    </Dialogo>
  );
}

const PARTES = ["Quem pediu e onde", "O que aconteceu", "Como tratar"] as const;
type Passo = 1 | 2 | 3;
/** Em que passo cada campo fica, para voltar a ele quando o banco recusar. */
const PASSO_DO_CAMPO: Record<string, Passo> = { unidadeId: 1, contatoId: 1, local: 1, canal: 1, assunto: 2, descricao: 2 };

/** Uma parte do formulário: com número no computador; no celular, só aparece no seu passo. */
function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`rp-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h3 id={`rp-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h3>
      </div>
      {children}
    </section>
  );
}

function Formulario({ opcoes, aoFechar, registrado, aoRegistrar, outro, daMensagem }: {
  opcoes: OpcoesPedidos; aoFechar: () => void; registrado: (protocolo: string, id: string) => void; aoRegistrar?: () => void; outro: () => void; daMensagem?: DaMensagem;
}) {
  const celular = useCelular();
  const categorias = opcoes.categorias.filter((c) => c.ativa);
  const prioridades = opcoes.prioridades.filter((p) => p.ativa);
  const disponiveis = opcoes.responsaveis.filter((r) => r.disponivel);
  const normal = prioridades.find((p) => p.nome.toLowerCase() === "normal") ?? prioridades[prioridades.length - 1];
  const [onde, setOnde] = useState<"UNIDADE" | "AREA">(opcoes.unidades.length ? "UNIDADE" : "AREA");
  const [v, setV] = useState({
    unidadeId: "", contatoId: "", local: "", canal: daMensagem ? "WHATSAPP" : "TELEFONE", categoriaId: categorias[0]?.id ?? "", prioridadeId: normal?.id ?? "",
    assunto: "", descricao: daMensagem?.relato ?? "", responsavelId: opcoes.responsavelPadrao ?? "", privado: false,
  });
  const [carga, setCarga] = useState<{ unidade: string; lista: ContatoConfirmado[] } | null>(null);
  const contatos = carga && carga.unidade === v.unidadeId ? carga.lista : null;
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [arquivos, setArquivos] = useState<ItemEnvio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [escolha, setEscolha] = useState<EscolhaAvisos>(ESCOLHA_INICIAL);
  const [feito, setFeito] = useState<Registrado | null>(null);
  const [faltas, setFaltas] = useState<string[]>([]);
  const [passo, setPasso] = useState<Passo>(1);
  // Os campos que faltam no passo, apontados ao tentar seguir (antes de ir ao banco).
  const [faltaNoPasso, setFaltaNoPasso] = useState<string[]>([]);
  const mudar = (m: Partial<typeof v>) => setV((x) => ({ ...x, ...m }));
  const previa = usePrevia({
    unidadeId: onde === "UNIDADE" ? v.unidadeId || null : null, contatoId: onde === "UNIDADE" ? v.contatoId || null : null,
    prioridadeId: v.prioridadeId, responsavelId: v.responsavelId || null, privado: v.privado, canal: v.canal,
    local: v.local.trim() || null, assunto: v.assunto, descricao: v.descricao,
  }, escolha);
  // Enquanto ninguém edita, os textos do prestador e do comunicado seguem o rascunho mais novo.
  const escolhaVista = acompanharRascunhos(previa, escolha);
  const avisos = contarAvisos(previa, escolhaVista);

  useEffect(() => {
    if (onde !== "UNIDADE" || !v.unidadeId) return;
    const unidade = v.unidadeId;
    const controle = new AbortController();
    chamarApi<ContatoConfirmado[]>(`/v1/condominio/pedidos/contatos/${unidade}`, { sinal: controle.signal }).then((r) => {
      if (!controle.signal.aborted) setCarga({ unidade, lista: r.ok ? r.dados : [] });
    });
    return () => controle.abort();
  }, [onde, v.unidadeId]);

  /** O que falta para sair do passo (as mesmas regras do banco). */
  function faltasDoPasso(n: Passo): string[] {
    if (n === 1) {
      if (onde === "UNIDADE") return v.unidadeId ? [] : ["unidadeId"];
      const l = v.local.trim().length;
      return l >= 2 && l <= 120 ? [] : ["local"];
    }
    if (n === 2) {
      return [
        ...(v.assunto.trim().length < 3 ? ["assunto"] : []),
        ...(v.descricao.trim().length < 3 ? ["descricao"] : []),
      ];
    }
    return [];
  }

  function irPara(n: Passo) {
    // Para a frente, cada passo do caminho precisa estar completo.
    for (let p = passo; p < n; p++) {
      const f = faltasDoPasso(p as Passo);
      if (f.length) {
        setPasso(p as Passo);
        setFaltaNoPasso(f);
        setTimeout(() => document.getElementById(ID_DO_CAMPO[f[0]!] ?? "")?.focus(), 0);
        return;
      }
    }
    setFaltaNoPasso([]);
    setPasso(n);
    document.getElementById("rp-topo")?.scrollIntoView({ block: "nearest" });
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    // No celular, o Enter num campo segue para o próximo passo.
    if (celular && passo < 3) return irPara((passo + 1) as Passo);
    setErro(null);
    const antes = ([1, 2] as Passo[]).flatMap((n) => faltasDoPasso(n));
    if (antes.length) {
      setFaltaNoPasso(antes);
      setPasso(PASSO_DO_CAMPO[antes[0]!] ?? 1);
      setTimeout(() => document.getElementById(ID_DO_CAMPO[antes[0]!] ?? "")?.focus(), 0);
      return;
    }
    // Quando e como entrar faltando: aponta o campo antes de ir ao banco (nada grava pela metade).
    const falta = faltasNoLink(previa, escolhaVista);
    setFaltas(falta);
    if (falta.length) {
      document.getElementById(falta[0] === "textoPrestador" ? "qa-o-que-fazer" : falta[0] === "quando" ? "qa-quando" : "qa-como-entrar")?.focus();
      return;
    }
    setEnviando(true);
    const r = await chamarApi<{ id: string; protocolo: string; avisos?: AvisoDoRegistro[] }>("/v1/condominio/pedidos", { corpo: {
      unidadeId: onde === "UNIDADE" ? v.unidadeId || null : null,
      contatoId: onde === "UNIDADE" ? v.contatoId || null : null,
      local: v.local.trim() || null,
      canal: daMensagem ? undefined : v.canal, categoriaId: v.categoriaId, prioridadeId: v.prioridadeId,
      assunto: v.assunto, descricao: v.descricao, privado: v.privado, responsavelId: v.responsavelId || null,
      avisar: paraEnviar(previa, escolhaVista),
      mensagemId: daMensagem?.mensagemId ?? null,
    } });
    if (!r.ok) {
      setEnviando(false);
      const primeiro = camposComErro(r.erro).find((c) => PASSO_DO_CAMPO[c]);
      if (primeiro) setPasso(PASSO_DO_CAMPO[primeiro]!);
      return setErro(r.erro);
    }
    await enviarArquivos(r.dados.id, "RELATO", arquivos, (chave, p) => setArquivos((xs) => xs.map((x) => (x.chave === chave ? { ...x, progresso: p } : x))));
    setEnviando(false);
    aoRegistrar?.();
    const resp = opcoes.responsaveis.find((x) => x.vinculoId === v.responsavelId);
    const categoria = categorias.find((x) => x.id === v.categoriaId)?.nome;
    const unidade = opcoes.unidades.find((u) => u.id === v.unidadeId)?.nome;
    setFeito({ id: r.dados.id, protocolo: r.dados.protocolo, avisos: r.dados.avisos ?? [], arquivos: arquivos.filter((x) => !x.problema).length,
      linha: [v.assunto.trim(), onde === "UNIDADE" ? unidade : v.local.trim(), categoria, prioridades.find((x) => x.id === v.prioridadeId)?.nome,
        resp ? `responsável ${resp.eu ? "você" : resp.nome}` : null].filter(Boolean).join(" · ") });
  }

  if (feito) {
    const extra = !daMensagem ? null : (
      <Aviso tom="ok" titulo="As mensagens estão no pedido">
        Chegou pelo WhatsApp do condomínio. As mensagens e os arquivos foram para a conversa do pedido e saíram de A identificar.
      </Aviso>
    );
    return <ConfirmacaoRegistro feito={feito} outro={daMensagem ? undefined : outro} abrir={() => registrado(feito.protocolo, feito.id)} extra={extra} />;
  }

  const comErro = [...camposComErro(erro), ...faltaNoPasso];
  const msg = (c: string, texto: string) => (comErro.includes(c) ? texto : null);
  const prioridade = prioridades.find((p) => p.id === v.prioridadeId);
  const categoria = categorias.find((c) => c.id === v.categoriaId);
  const contato = (contatos ?? []).find((c) => c.contatoId === v.contatoId);
  const resumo1 = [onde === "UNIDADE" ? opcoes.unidades.find((u) => u.id === v.unidadeId)?.nome : "Área comum", onde === "AREA" ? v.local.trim() : null,
    contato?.nome, daMensagem ? CANAIS_PEDIDO_EXIBICAO.WHATSAPP : opcoesCanal.find((c) => c.valor === v.canal)?.texto].filter(Boolean).join(" · ");
  const prontos = arquivos.filter((x) => !x.problema).length;
  const resumo2 = [v.assunto.trim(), prontos ? (prontos === 1 ? "1 arquivo" : `${prontos} arquivos`) : null].filter(Boolean).join(" · ");
  const textoRegistrar = enviando ? "Registrando…" : avisos.n ? `Registrar e avisar ${avisos.n}` : "Registrar pedido";

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      <div id="rp-topo" className="grid gap-3 md:hidden">
        <p className="grid">
          <span className="t-apoio">Passo {passo} de 3</span>
          <span className="t-titulo-cartao">{PARTES[passo - 1]}</span>
        </p>
        <div className="passos" role="progressbar" aria-label="Passos do registro" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo}
          aria-valuetext={`Passo ${passo} de 3: ${PARTES[passo - 1]}`}>
          {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
        </div>
        {passo > 1 ? (
          <div className="grid gap-2">
            {([[1, resumo1], [2, resumo2]] as const).filter(([n]) => n < passo).map(([n, texto]) => (
              <button key={n} type="button" className="resumo-passo" onClick={() => setPasso(n)}>
                <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="t-apoio">{PARTES[n - 1]}</span>
                  <span className="truncate">{texto}</span>
                </span>
                <span className="alterar">Alterar</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {erro ? <AvisoErro erro={erro} texto={daMensagem && !camposComErro(erro).length
        ? "Nada foi gravado: o pedido e as mensagens vão juntos. As mensagens continuam em A identificar e o que você escreveu está aqui. Tente de novo."
        : textoDoErro(erro)} /> : null}
      {daMensagem ? daMensagem.origem : null}

      <div className="grid gap-x-7 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="grid">
          <Parte n={1} passo={passo}>
            <Escolha rotulo="Onde é" atual={onde} aoMudar={(x) => { setOnde(x); mudar({ unidadeId: "", contatoId: "" }); setFaltaNoPasso([]); }}
              opcoes={[{ valor: "UNIDADE", texto: <><Icone nome="predio" className="h-4 w-4" />Numa unidade</> },
                { valor: "AREA", texto: <><Icone nome="pin" className="h-4 w-4" />Em área comum</> }]} />
            {onde === "UNIDADE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoSelecao id="p-unidade" rotulo="Unidade" icone="predio" value={v.unidadeId} erro={msg("unidadeId", "Escolha a unidade.")}
                  onChange={(e) => { mudar({ unidadeId: e.target.value, contatoId: "" }); setFaltaNoPasso((f) => f.filter((x) => x !== "unidadeId")); }}
                  opcoes={[{ valor: "", texto: "Escolha a unidade" }, ...opcoes.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]} />
                <CampoSelecao id="p-contato" rotulo="Quem pediu" icone="pessoa" value={v.contatoId} disabled={!v.unidadeId || contatos === null}
                  onChange={(e) => mudar({ contatoId: e.target.value })}
                  ajuda={v.unidadeId && contatos?.length === 0 ? "Esta unidade não tem contato confirmado." : "Só contato confirmado da unidade."}
                  opcoes={[{ valor: "", texto: "Ninguém da unidade (visto pela gestão)" },
                    ...(contatos ?? []).map((c) => ({ valor: c.contatoId, texto: `${c.nome} · ${nomeRelacao(c.relacao).toLowerCase()}` }))]} />
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="p-local" rotulo={onde === "AREA" ? "Local" : "Onde, na unidade"} opcional={onde === "UNIDADE"} maxLength={120} value={v.local}
                list={onde === "AREA" ? "p-locais" : undefined}
                onChange={(e) => { mudar({ local: e.target.value }); setFaltaNoPasso((f) => f.filter((x) => x !== "local")); }}
                erro={msg("local", "Diga onde é (2 a 120 caracteres).")}
                ajuda={onde === "AREA" ? "Ex.: portão da garagem, elevador social da Torre A." : undefined} />
              {daMensagem ? (
                <CampoSelecao id="p-canal" rotulo="Como chegou" icone="whats" value="WHATSAPP" disabled onChange={() => undefined}
                  opcoes={[{ valor: "WHATSAPP", texto: CANAIS_PEDIDO_EXIBICAO.WHATSAPP }]}
                  ajuda="Vem das mensagens, por isso não muda. Fica assim na ficha e nos números." />
              ) : (
                <CampoSelecao id="p-canal" rotulo="Como chegou" icone={ICONE_CANAL[v.canal] ?? "info"} value={v.canal}
                  onChange={(e) => mudar({ canal: e.target.value })} opcoes={opcoesCanal} />
              )}
            </div>
            {onde === "AREA" ? <ListaLocais id="p-locais" /> : null}
          </Parte>

          <Parte n={2} passo={passo}>
            <CampoTexto id="p-assunto" rotulo="Assunto" required maxLength={120} value={v.assunto}
              onChange={(e) => { mudar({ assunto: e.target.value }); setFaltaNoPasso((f) => f.filter((x) => x !== "assunto")); }}
              erro={msg("assunto", "Assunto de 3 a 120 caracteres.")} ajuda="Curto, para achar na fila. Ex.: Vazamento no banheiro." />
            <CampoAreaTexto id="p-descricao" rotulo="O que foi relatado" required maxLength={4000} rows={4} value={v.descricao}
              onChange={(e) => { mudar({ descricao: e.target.value }); setFaltaNoPasso((f) => f.filter((x) => x !== "descricao")); }}
              erro={msg("descricao", "Descreva o pedido (3 a 4000 caracteres).")} />
            <EscolherArquivos rotulo="Fotos e documentos" opcional itens={arquivos} aoMudar={setArquivos} enviando={enviando} />
          </Parte>

          <Parte n={3} passo={passo}>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoSelecao id="p-categoria" rotulo="Categoria" icone={iconeDaCategoria(categoria?.nome)} value={v.categoriaId}
                erro={msg("categoriaId", "Escolha uma categoria ativa.")}
                onChange={(e) => mudar({ categoriaId: e.target.value })} opcoes={categorias.map((c) => ({ valor: c.id, texto: c.nome }))} />
              <CampoSelecao id="p-responsavel" rotulo="Responsável" icone="pessoa" value={v.responsavelId} onChange={(e) => mudar({ responsavelId: e.target.value })}
                ajuda={disponiveis.length ? "Quem recebe confirma que aceitou." : "Ninguém disponível na lista de quem atende: o pedido fica sem responsável, à vista na fila."}
                opcoes={[{ valor: "", texto: "Sem responsável agora" },
                  ...disponiveis.map((r) => ({ valor: r.vinculoId, texto: `${r.eu ? "Eu" : r.nome}${r.vinculoId === opcoes.responsavelPadrao ? " (padrão da fila)" : ""}` }))]} />
            </div>
            <div className="grid gap-1.5">
              <span aria-hidden="true" className="t-apoio font-medium">Prioridade</span>
              <Escolha rotulo="Prioridade" atual={v.prioridadeId} aoMudar={(x) => mudar({ prioridadeId: x })}
                opcoes={prioridades.map((p) => ({ valor: p.id,
                  texto: <>{/urgente/i.test(p.nome) ? <Icone nome="alerta" className="h-4 w-4" /> : null}{p.nome}</> }))} />
              {msg("prioridadeId", "Escolha uma prioridade ativa.")
                ? <span className="t-apoio text-erro">Escolha uma prioridade ativa.</span>
                : prioridade?.significado ? <span className="t-apoio">{prioridade.nome}: {prioridade.significado.charAt(0).toLowerCase() + prioridade.significado.slice(1)}</span> : null}
            </div>
            <Interruptor id="p-privado" rotulo="Pedido privado" icone="cadeado" ajuda="Só o síndico, quem registrou e o responsável veem."
              marcado={v.privado} aoMudar={(x) => mudar({ privado: x })} />
          </Parte>
        </div>

        <div className={`md:sticky md:top-0 md:pt-2 ${passo === 3 ? "max-md:pt-4" : "max-md:hidden"}`}>
          <BlocoQuemAvisar previa={previa} escolha={escolhaVista} mudar={setEscolha} opcoes={opcoes}
            faltas={[...faltas, ...comErro.filter((c) => c === "quando" || c === "comoEntrar")]} />
        </div>
      </div>

      <div className="sticky -bottom-6 -mx-6 -mb-6 grid gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:rounded-none md:flex md:items-center md:justify-between">
        <p className="t-apoio flex items-center gap-2 max-md:hidden">
          <Icone nome="info" className="h-4 w-4" />
          {avisos.n ? `Saem ${avisos.n === 1 ? "1 aviso" : `${avisos.n} avisos`} junto com o registro: ${juntar(avisos.nomes)}.` : "Ninguém é avisado neste registro."}
        </p>
        <div className="flex gap-2 max-md:hidden">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{textoRegistrar}</Botao>
        </div>
        <div className="grid gap-2 md:hidden">
          {passo === 1 ? (
            <>
              <Botao type="submit" className="w-full">Continuar<Icone nome="dir" /></Botao>
              <Botao variante="discreto" className="w-full" onClick={aoFechar}>Cancelar</Botao>
            </>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Botao variante="contorno" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao>
              {passo === 2
                ? <Botao type="submit">Continuar<Icone nome="dir" /></Botao>
                : <Botao type="submit" disabled={enviando}><Icone nome="check" />{textoRegistrar}</Botao>}
            </div>
          )}
          <p className="t-apoio text-center">
            {passo === 3 ? (avisos.n ? `Saem ${avisos.n === 1 ? "1 aviso" : `${avisos.n} avisos`} junto com o registro.` : "Ninguém é avisado neste registro.")
              : passo === 2 ? "O que você já preencheu fica guardado se voltar." : null}
          </p>
        </div>
      </div>
    </form>
  );
}

const ID_DO_CAMPO: Record<string, string> = { unidadeId: "p-unidade", local: "p-local", assunto: "p-assunto", descricao: "p-descricao" };
