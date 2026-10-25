"use client";
// Propostas (quadros 326 e 327, CM-06, CM-07, CM-12 e CM-19): a lista com as abas (Em aberto,
// Aguardando aprovação, Aceitas, Vencidas, Recusadas) e, embaixo, a proposta escolhida com as
// versões e o envio. Versão enviada não muda; mudar cria uma versão nova. O link sai uma vez só,
// na resposta do envio (ou de um link novo): a tela mostra para copiar e não guarda em lugar nenhum.
// A equipe vê quantas vezes e em quantos aparelhos a proposta foi aberta, sem saber quem abriu.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_PROPOSTAS, TEXTO_LINK_UMA_VEZ, type AbaProposta } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { AbasLista, CabecaPagina, CaixaLista, Cartao, CLASSE_LINHA, CLASSE_LINK_LINHA, diaHora, useCelular } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { ROTAS_COMERCIAL } from "./comum.tsx";
import { JanelaAprovarDesconto, JanelaEscolherInteressado, JanelaMandarWhatsapp, JanelaMotivo } from "./janelasPropostas.tsx";
import {
  conteudoDaVersao, depoisDoEnvio, diaMes, documentoProposta, enderecoDoLink, horaCompleta, mensagemDoLink, percentual, resumoVersao, ROTAS_PROPOSTAS, TELAS_PROPOSTAS,
  textoAberturas, textoSituacao, TOM_SITUACAO_PROPOSTA, type FichaProposta, type ItemListaProposta, type ListaPropostas, type VersaoProposta,
} from "./propostas.ts";
import type { FichaInteressado } from "./tipos.ts";

const ABAS = Object.keys(ABAS_PROPOSTAS) as AbaProposta[];
const COLUNAS = "md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1.2fr)_90px_minmax(0,1fr)_20px]";
const dataCurta = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

const FEITO: Record<string, string> = {
  salvo: "Rascunho salvo. Confira e envie quando estiver pronto.",
  pedido: "Pedido de desconto enviado à Administração. A proposta sai depois da aprovação.",
};

function Linha({ p, escolhida }: { p: ItemListaProposta; escolhida: boolean }) {
  return (
    <li className={`${CLASSE_LINHA} ${COLUNAS} ${escolhida ? "md:bg-violeta-50/60" : ""}`}>
      <span className="ladrilho self-start md:self-center" data-tom={p.aba === "AGUARDANDO_APROVACAO" ? "laranja" : "violeta"} aria-hidden="true"><Icone nome="documento" /></span>
      <span className="grid min-w-0 justify-items-start gap-1">
        <Link href={`${TELAS_PROPOSTAS.lista(p.id)}#proposta`} scroll={false} aria-current={escolhida ? "true" : undefined} className={CLASSE_LINK_LINHA}>{p.interessado.condominio}</Link>
        <span className="t-apoio">{p.interessado.responsavel?.nome ?? "Sem responsável"}</span>
      </span>
      <span className="max-md:col-span-2 max-md:col-start-2"><Selo tom={TOM_SITUACAO_PROPOSTA[p.atual.situacao]}>{textoSituacao(p.atual.numero, p.atual.situacao)}</Selo></span>
      <span className="t-codigo max-md:col-span-2 max-md:col-start-2">{p.atual.validoAte ? <><span className="md:sr-only">Vale até </span>{diaMes(p.atual.validoAte)}</> : "—"}</span>
      <span className="t-apoio max-md:col-span-2 max-md:col-start-2">{depoisDoEnvio(p)}</span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
    </li>
  );
}

export function Propostas() {
  const busca = useSearchParams();
  const router = useRouter();
  const celular = useCelular();
  const carga = useCarregar<ListaPropostas>(ROTAS_PROPOSTAS.lista());
  const [aba, setAba] = useState<AbaProposta | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const pedida = busca.get("proposta");
  const feito = busca.get("feito");
  const d = carga.estado === "pronto" ? carga.dados : null;
  const daPedida = d?.propostas.find((p) => p.id === pedida)?.aba;
  // A proposta pedida no endereço leva para a aba dela; trocar de aba tira o pedido.
  const abaAtual: AbaProposta = daPedida ?? aba ?? "EM_ABERTO";
  const naAba = d?.propostas.filter((p) => p.aba === abaAtual) ?? [];
  // No computador a primeira da aba já vem aberta, como no quadro; no celular, só a que foi tocada.
  const escolhida = pedida ?? (celular ? null : naAba[0]?.id ?? null);

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Propostas" apoio="Todas as propostas, com a versão em vigor de cada uma. Versão enviada não muda; mudar cria uma versão nova."
        acao={d?.podeEditar ? <Botao onClick={() => setEscolhendo(true)}><Icone nome="mais" />Nova proposta</Botao> : undefined} />
      {feito && FEITO[feito] ? <Aviso tom="ok" papel="status">{FEITO[feito]}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <CaixaLista titulo="Propostas" colunas={COLUNAS} cabecalho={naAba.length ? ["", "Interessado", "Situação", "Vale até", "Depois do envio", ""] : undefined}
          abas={<AbasLista rotulo="Abas das propostas" atual={abaAtual} aoMudar={(a) => { setAba(a); if (pedida) router.replace("/comercial/propostas", { scroll: false }); }}
            abas={ABAS.map((a) => ({ valor: a, texto: ABAS_PROPOSTAS[a], n: d.contagens[a] ?? 0 }))} />}>
          {naAba.length ? (
            <ul className="grid max-md:gap-3 max-md:pt-3">{naAba.map((p) => <Linha key={p.id} p={p} escolhida={p.id === escolhida} />)}</ul>
          ) : (
            <div className="md:p-5">
              <Vazio titulo="Nenhuma proposta nesta aba" icone="documento">
                {d.propostas.length ? "Veja as outras abas." : "A proposta nasce do interessado: abra a ficha e use Fazer proposta, ou o botão Nova proposta."}
              </Vazio>
            </div>
          )}
        </CaixaLista>
      ) : null}
      {d && escolhida ? <DetalheProposta key={escolhida} id={escolhida} aoMudar={carga.recarregar} /> : null}
      {escolhendo ? <JanelaEscolherInteressado aoFechar={() => setEscolhendo(false)} aoEscolher={(id) => router.push(TELAS_PROPOSTAS.nova(id))} /> : null}
    </div>
  );
}

type Janela = { tipo: "desconto" } | { tipo: "revogar" } | { tipo: "recusada" } | { tipo: "whatsapp"; texto: string } | null;

/** Uma versão na lista do cartão Versões (quadro 326). */
function ItemVersao({ v }: { v: VersaoProposta }) {
  const quando = v.enviadaEm ? `Enviada ${diaHora(v.enviadaEm)}${v.enviadaPor ? ` por ${v.enviadaPor.nome}` : ""}`
    : v.substituidaEm ? `Substituída ${diaHora(v.substituidaEm)}` : `Criada ${diaHora(v.criadoEm)}${v.criadoPor ? ` por ${v.criadoPor.nome}` : ""}`;
  const depois = v.aceite ? `Aceita ${diaHora(v.aceite.em)} por ${v.aceite.nome} (${v.aceite.cargo})` : v.enviadaEm ? textoAberturas(v.aberturas) : "Nunca enviada";
  return (
    <li className="grid gap-x-4 gap-y-1 border-t border-linha py-3 first:border-t-0 md:grid-cols-[minmax(0,140px)_minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
      <span><Selo tom={TOM_SITUACAO_PROPOSTA[v.situacao]}>{textoSituacao(v.numero, v.situacao)}</Selo></span>
      <span className="grid gap-0.5">
        <span className="t-texto">{resumoVersao(v)}</span>
        <span className="t-apoio">{quando}</span>
      </span>
      <span className="t-apoio">{depois}</span>
    </li>
  );
}

function DetalheProposta({ id, aoMudar }: { id: string; aoMudar: () => void }) {
  const router = useRouter();
  const carga = useCarregar<FichaProposta>(ROTAS_PROPOSTAS.proposta(id));
  const fi = carga.estado === "pronto" ? carga.dados : null;
  const interessado = useCarregar<FichaInteressado>(fi ? ROTAS_COMERCIAL.interessado(fi.interessado.id) : null);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro" | "atencao"; texto: string; pedirDesconto?: boolean } | null>(null);
  const [link, setLink] = useState<{ versaoId: string; codigo: string; expiraEm: string } | null>(null);
  const [fazendo, setFazendo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a proposta…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const f = carga.dados;
  const v = f.versoes[0];
  if (!v) return null;
  const pessoa = f.interessado.pessoa;
  const pronto = (texto?: string) => {
    setJanela(null);
    if (texto) setAviso({ tom: "ok", texto });
    // A proposta fica escolhida mesmo que mude de aba.
    router.replace(TELAS_PROPOSTAS.lista(f.id), { scroll: false });
    carga.recarregar();
    aoMudar();
  };
  const falhou = (e: ErroApi) => {
    setAviso({ tom: "erro", texto: textoDoErro(e), pedirDesconto: e.detalhes?.motivo === "DESCONTO_SEM_APROVACAO" });
    if (e.codigo === "VERSION_CONFLICT") carga.recarregar();
  };
  const endereco = link && link.versaoId === v.id ? enderecoDoLink(window.location.origin, link.codigo) : null;
  // Rascunho com o valor abaixo da tabela tem desconto ainda não pedido.
  const temDesconto = v.tabela !== "MANUAL" && v.mensal !== undefined && v.mensalTabela !== undefined && v.mensal < v.mensalTabela;
  const fechada = v.situacao === "ACEITA";

  async function acao(nome: string, faz: () => Promise<void>) {
    setAviso(null);
    setFazendo(nome);
    try { await faz(); } finally { setFazendo(null); }
  }
  const enviar = () => acao("enviar", async () => {
    const r = await chamarApi<{ link: { codigo: string; expiraEm: string } }>(ROTAS_PROPOSTAS.acao(f.id, v.id, "enviar"), { corpo: { versao: v.versaoRegistro } });
    if (!r.ok) return falhou(r.erro);
    setLink({ versaoId: v.id, ...r.dados.link });
    pronto(`Proposta v${v.numero} enviada. Copie o link agora e mande ao síndico.`);
  });
  const pedirDesconto = () => acao("pedir", async () => {
    const r = await chamarApi(ROTAS_PROPOSTAS.acao(f.id, v.id, "desconto/pedir"), { corpo: { versao: v.versaoRegistro } });
    if (!r.ok) return falhou(r.erro);
    pronto("Pedido de desconto enviado à Administração. A proposta sai depois da aprovação.");
  });
  const linkNovo = () => acao("link", async () => {
    const r = await chamarApi<{ link: { codigo: string; expiraEm: string } }>(ROTAS_PROPOSTAS.acao(f.id, v.id, "link"), { corpo: {} });
    if (!r.ok) return falhou(r.erro);
    setLink({ versaoId: v.id, ...r.dados.link });
    pronto("Link novo gerado. O anterior parou de abrir.");
  });
  const pdf = () => acao("pdf", async () => {
    try {
      const { baixarPdf } = await import("./pdf.ts");
      await baixarPdf(documentoProposta(conteudoDaVersao(v, pessoa)));
    } catch {
      setAviso({ tom: "erro", texto: "Não deu para montar o PDF. Tente de novo." });
    }
  });
  async function copiar() {
    if (!endereco) return;
    try { await navigator.clipboard.writeText(endereco); setCopiado(true); } catch { setCopiado(false); }
  }

  const botaoPdf = <Botao variante="contorno" disabled={fazendo === "pdf"} onClick={() => void pdf()}><Icone nome="baixar" />{fazendo === "pdf" ? "Montando o PDF…" : "Baixar o PDF"}</Botao>;
  const botaoKit = f.kitDisponivel ? <Link href={TELAS_PROPOSTAS.kit(f.id)} className={classeBotao("contorno")}><Icone nome="documento" />Montar o kit do conselho</Link> : null;
  const tituloEnvio = v.situacao === "ENVIADA" ? `Link da v${v.numero}` : v.situacao === "ACEITA" ? `v${v.numero} aceita` : v.situacao === "VENCIDA" ? `v${v.numero} vencida`
    : v.situacao === "RECUSADA" ? `v${v.numero} recusada` : `Enviar a v${v.numero}`;

  return (
    <section id="proposta" aria-label={`Proposta de ${f.interessado.condominio}`} className="grid scroll-mt-6 gap-5">
      {aviso ? (
        <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>
          {aviso.texto}
          {aviso.pedirDesconto && f.podeEditar ? <span className="mt-2 block"><Botao variante="contorno" onClick={() => void pedirDesconto()}>Pedir aprovação do desconto</Botao></span> : null}
        </Aviso>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Cartao id="prop-versoes" titulo={`${f.interessado.condominio} · versões`} icone="camadas"
          acao={f.podeEditar && !fechada ? <Link href={TELAS_PROPOSTAS.versaoNova(f.id)} className={classeBotao("contorno")}><Icone nome="editar" />Fazer versão nova</Link> : undefined}>
          <ul className="grid">{f.versoes.map((x) => <ItemVersao key={x.id} v={x} />)}</ul>
          <p className="t-apoio"><Link href={`/comercial/${f.interessado.id}`} className="underline">{`Abrir a ficha de ${f.interessado.condominio}`}</Link></p>
        </Cartao>

        <Cartao id="prop-envio" titulo={tituloEnvio} icone="enviar">
          {v.situacao === "RASCUNHO" || v.situacao === "PRONTA" ? (
            <>
              {v.descontoSituacao === "RECUSADO" && v.descontoPedido ? (
                <Aviso tom="atencao" titulo="A Administração recusou o desconto">
                  {`${v.descontoPedido.resposta ?? ""} Mude ou tire o desconto no rascunho e salve.`.trim()}
                </Aviso>
              ) : null}
              {v.situacao === "PRONTA" && v.descontoSituacao === "APROVADO" ? (
                <Aviso tom="ok">{`Desconto de ${percentual(v.descontoPedido?.percentual ?? v.desconto ?? 0)} aprovado${v.descontoPedido?.respondidoPor ? ` por ${v.descontoPedido.respondidoPor.nome}` : ""}.${v.descontoPedido?.resposta ? ` ${v.descontoPedido.resposta}` : ""}`}</Aviso>
              ) : null}
              <p className="t-apoio">{`${resumoVersao(v)}. O link vale ${v.validadeDias ?? 15} dias a partir do envio e pode ser revogado a qualquer hora.`}</p>
              {f.podeEditar ? (
                <div className="flex flex-wrap gap-2 max-md:grid">
                  {v.situacao === "RASCUNHO" && temDesconto && v.descontoSituacao !== "RECUSADO"
                    ? <Botao disabled={!!fazendo} onClick={() => void pedirDesconto()}><Icone nome="enviar" />{fazendo === "pedir" ? "Pedindo…" : "Pedir aprovação do desconto"}</Botao>
                    : <Botao disabled={!!fazendo} onClick={() => void enviar()}><Icone nome="enviar" />{fazendo === "enviar" ? "Enviando…" : `Enviar a v${v.numero}`}</Botao>}
                  <Link href={TELAS_PROPOSTAS.editar(f.id, v.id)} className={classeBotao("contorno")}><Icone nome="editar" />Editar o rascunho</Link>
                </div>
              ) : null}
            </>
          ) : null}

          {v.situacao === "AGUARDA_DESCONTO" ? (
            <>
              <Aviso tom="atencao" titulo="Esperando a Administração">
                {`Desconto de ${percentual(v.descontoPedido?.percentual ?? 0)} pedido${v.descontoPedido?.pedidoPor ? ` por ${v.descontoPedido.pedidoPor.nome}` : ""}`
                  + `${v.descontoPedido?.pedidoEm ? ` em ${diaHora(v.descontoPedido.pedidoEm)}` : ""}. A proposta sai depois da resposta.`}
              </Aviso>
              {f.podeAprovarDesconto
                ? <Botao className="justify-self-start" onClick={() => setJanela({ tipo: "desconto" })}><Icone nome="check" />Responder ao desconto</Botao>
                : <p className="t-apoio">Só a Administração aprova.</p>}
            </>
          ) : null}

          {v.situacao === "ENVIADA" ? (
            <>
              {endereco ? (
                <>
                  <CampoTexto id="prop-link" rotulo="Link da proposta" value={endereco} readOnly onFocus={(e) => e.currentTarget.select()}
                    ajuda={`Abre sem conta. Vale até ${dataCurta(v.validoAte)} e pode ser revogado a qualquer hora.`} />
                  <Aviso tom="atencao">{TEXTO_LINK_UMA_VEZ}</Aviso>
                </>
              ) : (
                <p className="t-apoio">
                  {v.link?.revogadoEm ? `Link revogado em ${diaHora(v.link.revogadoEm)}${v.link.revogadoMotivo ? `: ${v.link.revogadoMotivo}` : ""}.`
                    : v.link?.ativo ? `Link entregue em ${diaHora(v.link.criadoEm)}, vale até ${dataCurta(v.validoAte)}. Para copiar de novo, gere um link novo.` : "Sem link aberto."}
                </p>
              )}
              <p className="t-apoio">{textoAberturas(v.aberturas)}</p>
              {copiado ? <p className="t-apoio" role="status">Link copiado.</p> : null}
              <div className="flex flex-wrap gap-2 max-md:grid">
                {endereco ? (
                  <>
                    <Botao variante="contorno" onClick={() => void copiar()}><Icone nome="copiar" />Copiar o link</Botao>
                    <Botao variante="contorno" onClick={() => setJanela({ tipo: "whatsapp", texto: mensagemDoLink(pessoa, f.interessado.condominio, endereco) })}>
                      <Icone nome="whats" />Mandar pelo WhatsApp comercial
                    </Botao>
                  </>
                ) : f.podeEditar ? <Botao variante="contorno" disabled={!!fazendo} onClick={() => void linkNovo()}><Icone nome="link" />Gerar link novo</Botao> : null}
                {botaoPdf}
                {botaoKit}
                {f.podeEditar && v.link?.ativo ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "revogar" })}><Icone nome="cadeado" />Revogar o link</Botao> : null}
                {f.podeEditar ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "recusada" })}><Icone nome="fechar" />O síndico disse não</Botao> : null}
              </div>
            </>
          ) : null}

          {v.situacao === "ACEITA" && v.aceite ? (
            <>
              <Aviso tom="ok" titulo={`Aceita por ${v.aceite.nome} (${v.aceite.cargo})`}>
                {`Em ${horaCompleta(v.aceite.em)}${v.aceite.cpfMascarado ? `, CPF ${v.aceite.cpfMascarado}` : ""}. Aceitar não é contratar: o próximo é o contrato.`}
              </Aviso>
              {endereco ? <CampoTexto id="prop-link" rotulo="Link da proposta" value={endereco} readOnly ajuda={TEXTO_LINK_UMA_VEZ} /> : null}
              <div className="flex flex-wrap gap-2 max-md:grid">
                {botaoPdf}
                {botaoKit}
                {f.podeEditar && !endereco ? <Botao variante="discreto" disabled={!!fazendo} onClick={() => void linkNovo()}><Icone nome="link" />Gerar link novo</Botao> : null}
              </div>
            </>
          ) : null}

          {v.situacao === "VENCIDA" ? (
            <>
              <p className="t-texto">{`Esta proposta valia até ${dataCurta(v.validoAte)}. Para seguir, faça uma versão nova com a tabela do dia.`}</p>
              <div className="flex flex-wrap gap-2 max-md:grid">
                {f.podeEditar ? <Link href={TELAS_PROPOSTAS.versaoNova(f.id)} className={classeBotao()}><Icone nome="editar" />Refazer com a tabela do dia</Link> : null}
                {botaoPdf}
              </div>
            </>
          ) : null}

          {v.situacao === "RECUSADA" ? (
            <p className="t-texto">{v.recusa ? `O síndico disse não em ${diaHora(v.recusa.em)}: ${v.recusa.motivo}` : "O síndico disse não."}</p>
          ) : null}
        </Cartao>
      </div>

      {v.notaInterna || v.descontoPedido ? (
        <Cartao id="prop-interno" titulo="Só para a equipe" icone="cadeado">
          {v.notaInterna ? <p className="t-texto whitespace-pre-wrap">{v.notaInterna}</p> : null}
          {v.descontoPedido ? (
            <p className="t-apoio">
              {`Desconto de ${percentual(v.descontoPedido.percentual)} pedido: ${v.descontoPedido.motivo}`}
              {v.descontoPedido.resposta ? ` · Resposta da Administração: ${v.descontoPedido.resposta}` : ""}
            </p>
          ) : null}
          <p className="t-apoio">Nada disto vai na proposta, no link, no PDF nem no kit (CM-12).</p>
        </Cartao>
      ) : null}

      {janela?.tipo === "desconto" ? <JanelaAprovarDesconto f={f} v={v} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {janela?.tipo === "revogar" ? (
        <JanelaMotivo titulo="Revogar o link" apoio="Quem abrir o link vê que a proposta não está mais disponível. A versão continua enviada; para mandar de novo, gere um link novo."
          rotulo="Motivo" botao="Revogar o link" maximo={300} aoFechar={() => setJanela(null)}
          aoConfirmar={async (motivo) => {
            const r = await chamarApi(ROTAS_PROPOSTAS.acao(f.id, v.id, "revogar"), { corpo: { motivo } });
            if (!r.ok) return r.erro;
            setLink(null);
            pronto("Link revogado.");
            return null;
          }} />
      ) : null}
      {janela?.tipo === "recusada" ? (
        <JanelaMotivo titulo="O síndico disse não" apoio="Registra a recusa nas conversas e revoga o link. Para tentar de novo, faça uma versão nova."
          rotulo="O que ele disse" botao="Registrar a recusa" maximo={500} aoFechar={() => setJanela(null)}
          aoConfirmar={async (motivo) => {
            const r = await chamarApi(ROTAS_PROPOSTAS.acao(f.id, v.id, "recusada"), { corpo: { versao: v.versaoRegistro, motivo } });
            if (!r.ok) return r.erro;
            setLink(null);
            pronto("Recusa registrada.");
            return null;
          }} />
      ) : null}
      {janela?.tipo === "whatsapp" ? (
        <JanelaMandarWhatsapp interessado={interessado.estado === "pronto" ? interessado.dados : null} texto={janela.texto} aoFechar={() => setJanela(null)}
          feito={() => pronto("Conversa registrada na ficha.")} />
      ) : null}
    </section>
  );
}
