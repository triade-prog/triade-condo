"use client";
// Modelos de mensagem (F5.4, W-20), tela 6 do desenho de textos: os textos que o condomínio
// usa para puxar conversa depois de fechada a janela de 24h do WhatsApp. Iguais para todos os
// clientes, da categoria Utilidade. Aprovado não se edita: mudar cria a versão seguinte, que só
// vale depois de aprovada. No piloto, a administração aprova; no oficial, registra a resposta
// da Meta.

import { useState, type FormEvent, type ReactNode } from "react";
import {
  formatarDataHora, modeloCorpoValido, PROXIMAS_SITUACOES_MODELO, renderizarModelo, SITUACOES_MODELO, type ChaveModelo, type SituacaoModelo,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

interface Modelo {
  chave: ChaveModelo;
  numero: number;
  titulo: string;
  para: "MORADOR" | "EQUIPE" | "PRESTADOR";
  uso: string;
  variaveis: string[];
  corpo: string;
  rodape?: string;
  situacao: SituacaoModelo;
  motivo?: string;
  nota?: string;
  criadoEm: string;
  criadoPor?: string;
  decididoEm?: string;
  decididoPor?: string;
  versao: number;
  emUsoPiloto?: number;
  emUsoOficial?: number;
}

interface Detalhe {
  versoes: Modelo[];
  eventos: { numero: number; situacao: SituacaoModelo; motivo?: string; em: string; por?: string }[];
  emUsoPiloto?: number;
  emUsoOficial?: number;
  pode: { editar: boolean };
}

export const TOM_MODELO: Record<SituacaoModelo, Tom> = {
  RASCUNHO: "neutro", APROVADO_PILOTO: "ok", ENVIADO: "andamento", APROVADO: "ok", RECUSADO: "erro", PAUSADO: "atencao", DESATIVADO: "neutro",
};

/** Exemplo de cada modelo, para ver como chega. */
const PARA_MODELO: Record<Modelo["para"], string> = { MORADOR: "Morador", EQUIPE: "Equipe", PRESTADOR: "Prestador" };

const EXEMPLOS: Record<ChaveModelo, string[]> = {
  noticia_pedido: ["2026-0142", "Residencial Ipê", "O eletricista vem amanhã de manhã para trocar o reator.", "Ana"],
  pedido_concluido: ["2026-0142", "Residencial Ipê", "o reator da luminária do subsolo 1 foi trocado.", "Ana", "20/11"],
  revisao_respondida: ["2026-0131", "Residencial Ipê", "A vedação foi refeita ontem; se voltar, abra um pedido novo.", "Ana"],
  aviso_pedido_novo: ["Residencial Ipê", "2026-0142", "Luz da garagem piscando (apto 302)", "condominio.trihub.com.br/pedidos/…"],
  aviso_retorno_vencido: ["Residencial Ipê", "2026-0137", "Portão da garagem (apto 101)", "às 14:00", "Bruna", "condominio.trihub.com.br/pedidos/…"],
  aviso_revisao: ["Residencial Ipê", "2026-0131", "pedido privado (apto 402)", "condominio.trihub.com.br/pedidos/…"],
  reserva_decidida: ["2026-R014", "Residencial Ipê", "aprovada. Salão de festas, sábado, 25/10, das 10h às 23h, para a Torre A · 302.", "Ana"],
  enquete_convite: ["Residencial Ipê", "Qual cor para a fachada?", "31/10, às 23:59", "da Torre A · 302", "(link pessoal da unidade)"],
  enquete_lembrete: ["Residencial Ipê", "Qual cor para a fachada?", "31/10, às 23:59", "da Torre A · 302", "(link pessoal da unidade)"],
  assembleia_convocacao: ["Residencial Ipê", "assembleia geral ordinária", "sábado, 08/11, às 19:00", "da Torre A · 302", "(link pessoal da unidade)"],
  assembleia_lembrete: ["Residencial Ipê", "assembleia geral ordinária", "sábado, 08/11, às 19:00", "da Torre A · 302", "(link pessoal da unidade)"],
  anuncio_decidido: ["Residencial Ipê", "está no mural até 18/11, com o título \"Vendo bicicleta aro 29\". Quem se interessar fala com você por aqui.", "Ana"],
  link_prestador: ["Residencial Ipê", "AquaFix", "Bomba de recalque com ruído (Casa de bombas)", "21/10, 14:00", "https://condominio.trihub.com.br/p/…"],
};

/** O texto com as variáveis destacadas e o nome de cada uma. */
function TextoComVariaveis({ m }: { m: Pick<Modelo, "corpo" | "rodape" | "variaveis"> }) {
  const partes: ReactNode[] = [];
  m.corpo.split(/(\{\{[1-9][0-9]*\}\})/).forEach((p, i) => {
    const v = /^\{\{([1-9][0-9]*)\}\}$/.exec(p);
    partes.push(v
      ? <span key={i} className="rounded bg-violeta-100 px-1 font-mono text-xs text-violeta-800">{p} {m.variaveis[Number(v[1]) - 1] ?? ""}</span>
      : <span key={i}>{p}</span>);
  });
  return (
    <p className="whitespace-pre-line rounded-xl border border-dashed border-violeta-300 bg-superficie p-3 text-sm">
      {partes}
      {m.rodape ? <span className="text-tinta-suave">{`\n\n${m.rodape}`}</span> : null}
    </p>
  );
}

function JanelaModelo({ chave, aoFechar, aoMudar }: { chave: ChaveModelo; aoFechar: () => void; aoMudar: () => void }) {
  const carga = useCarregar<Detalhe>(`/v1/whatsapp/modelos/${chave}`);
  const [escrevendo, setEscrevendo] = useState<{ numero: number | null; versao: number | null; corpo: string } | null>(null);
  const [decidindo, setDecidindo] = useState<SituacaoModelo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Dialogo aberto titulo="Modelo de mensagem" aoFechar={aoFechar}><Carregando /></Dialogo>;
  if (carga.estado === "erro") return <Dialogo aberto titulo="Modelo de mensagem" aoFechar={aoFechar}><ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></Dialogo>;
  const d = carga.dados;
  const atual = d.versoes[0]!;
  const valido = escrevendo ? modeloCorpoValido(escrevendo.corpo.trim(), atual.variaveis.length) && escrevendo.corpo.trim().length >= 20 : true;

  function pronto(texto: string) {
    setErro(null);
    setEscrevendo(null);
    setDecidindo(null);
    setMotivo("");
    setRecado(texto);
    carga.recarregar();
    aoMudar();
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!escrevendo) return;
    setErro(null);
    const r = escrevendo.numero === null
      ? await chamarApi(`/v1/whatsapp/modelos/${chave}/versoes`, { corpo: { corpo: escrevendo.corpo } })
      : await chamarApi(`/v1/whatsapp/modelos/${chave}/versoes/${escrevendo.numero}`, { metodo: "PUT", corpo: { versao: escrevendo.versao, corpo: escrevendo.corpo } });
    if (!r.ok) return setErro(r.erro);
    pronto("Rascunho salvo. Ele só passa a valer depois de aprovado.");
  }

  async function decidir() {
    if (!decidindo) return;
    setErro(null);
    const r = await chamarApi(`/v1/whatsapp/modelos/${chave}/versoes/${atual.numero}/situacao`, {
      corpo: { versao: atual.versao, situacao: decidindo, motivo: motivo || null },
    });
    if (!r.ok) return setErro(r.erro);
    pronto(`Versão ${atual.numero}: ${SITUACOES_MODELO[decidindo].toLowerCase()}.`);
  }

  const proximas = PROXIMAS_SITUACOES_MODELO[atual.situacao];
  const pendente = d.versoes.some((v) => v.situacao === "RASCUNHO" || v.situacao === "ENVIADO");
  const pedeMotivo = decidindo === "RECUSADO" || decidindo === "PAUSADO";

  return (
    <Dialogo aberto titulo={atual.titulo} aoFechar={aoFechar}>
      <div className="grid gap-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
          <Selo tom={TOM_MODELO[atual.situacao]}>{SITUACOES_MODELO[atual.situacao]}</Selo>
          versão {atual.numero} · categoria Utilidade · português (Brasil) · <span className="font-mono">{atual.chave}</span>
        </p>
        <p className="text-sm">
          Em uso no piloto: {d.emUsoPiloto ? `versão ${d.emUsoPiloto}` : "nenhuma"} · no conector oficial: {d.emUsoOficial ? `versão ${d.emUsoOficial}` : "nenhuma (falta a Meta aprovar)"}
        </p>
        {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {!d.emUsoPiloto ? (
          <Aviso tom="atencao" titulo="Sem versão aprovada">Com a conversa fechada, a mensagem não sai: vira falha de envio com responsável.</Aviso>
        ) : null}

        {escrevendo ? (
          <form onSubmit={salvar} noValidate className="grid gap-3">
            <CampoAreaTexto id="modelo-corpo" rotulo={escrevendo.numero === null ? `Texto da versão ${atual.numero + 1}` : `Texto da versão ${escrevendo.numero}`}
              maxLength={1024} value={escrevendo.corpo} onChange={(e) => setEscrevendo({ ...escrevendo, corpo: e.target.value })}
              ajuda={`Use ${atual.variaveis.map((v, i) => `{{${i + 1}}} ${v}`).join(", ")}. Não comece nem termine com uma variável.`}
              erro={!valido || camposComErro(erro).includes("corpo") ? `Use as variáveis {{1}} a {{${atual.variaveis.length}}}, sem começar nem terminar com uma delas (20 a 1024 caracteres).` : null} />
            <p className="text-xs text-tinta-suave">Como chega</p>
            <p className="whitespace-pre-line rounded-xl border border-linha bg-superficie-2 p-3 text-sm">{renderizarModelo(escrevendo.corpo, atual.rodape, EXEMPLOS[chave])}</p>
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setEscrevendo(null)}>Voltar</Botao>
              <Botao type="submit" disabled={!valido}>Salvar rascunho</Botao>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-semibold">Texto</h3>
              <TextoComVariaveis m={atual} />
              <p className="text-xs text-tinta-suave">A variável não leva quebra de linha: cada uma vai em parágrafo único.</p>
            </div>
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-semibold">Exemplo</h3>
              <p className="whitespace-pre-line rounded-xl border border-linha bg-superficie-2 p-3 text-sm">{renderizarModelo(atual.corpo, atual.rodape, EXEMPLOS[chave])}</p>
            </div>
          </div>
        )}

        {d.pode.editar && !escrevendo ? (
          <div className="flex flex-wrap gap-2">
            {atual.situacao === "RASCUNHO" ? (
              <Botao variante="contorno" tamanho="m" onClick={() => setEscrevendo({ numero: atual.numero, versao: atual.versao, corpo: atual.corpo })}>Editar o rascunho</Botao>
            ) : !pendente ? (
              <Botao variante="contorno" tamanho="m" onClick={() => setEscrevendo({ numero: null, versao: null, corpo: atual.corpo })}>Criar versão nova</Botao>
            ) : null}
            {proximas.map((s) => (
              <Botao key={s} variante={s === "RECUSADO" || s === "DESATIVADO" || s === "PAUSADO" ? "discreto" : "contorno"} tamanho="m" onClick={() => { setDecidindo(s); setMotivo(""); }}>
                {s === "APROVADO_PILOTO" ? "Aprovar no piloto" : s === "ENVIADO" ? "Registrar envio à Meta" : s === "APROVADO" ? "Registrar aprovação da Meta"
                  : s === "RECUSADO" ? "Registrar recusa da Meta" : s === "PAUSADO" ? "Registrar pausa da Meta" : "Desativar"}
              </Botao>
            ))}
          </div>
        ) : null}

        {decidindo ? (
          <div className="grid gap-3 rounded-xl border border-linha p-3">
            <p className="text-sm">Versão {atual.numero} passa a: <b className="font-semibold">{SITUACOES_MODELO[decidindo]}</b>.
              {decidindo === "APROVADO_PILOTO" ? " Ela passa a valer no Wafly, no lugar da anterior." : ""}
              {decidindo === "DESATIVADO" ? " Sem outra versão aprovada, a mensagem com a conversa fechada deixa de sair." : ""}</p>
            {pedeMotivo ? (
              <CampoAreaTexto id="modelo-motivo" rotulo="Motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (3 a 300 caracteres)." : null} />
            ) : null}
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setDecidindo(null)}>Voltar</Botao>
              <Botao onClick={() => void decidir()}>Confirmar</Botao>
            </div>
          </div>
        ) : null}

        <section aria-labelledby="t-hist-modelo" className="grid gap-1">
          <h3 id="t-hist-modelo" className="text-sm font-semibold">Histórico</h3>
          <ul className="divide-y divide-linha text-sm">
            {d.eventos.map((e, i) => (
              <li key={i} className="py-1.5">
                Versão {e.numero}: {SITUACOES_MODELO[e.situacao]}{e.motivo ? `. ${e.motivo}` : ""}
                <span className="block text-xs text-tinta-suave">{formatarDataHora(e.em)}{e.por ? ` · ${e.por}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialogo>
  );
}

export function ModelosWhatsapp() {
  const carga = useCarregar<{ modelos: Modelo[]; pode: { editar: boolean } }>("/v1/whatsapp/modelos");
  const [aberto, setAberto] = useState<ChaveModelo | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando os modelos…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return (
    <div className="grid gap-4 pt-4">
      <p className="text-tinta-suave">
        Os textos que o condomínio usa para puxar conversa no WhatsApp depois de 24 horas da última mensagem da pessoa. Iguais para todos os clientes;
        o nome do condomínio entra como variável. No piloto, a administração aprova; no conector oficial, quem aprova é a Meta.
      </p>
      <ul className="grid gap-2.5">
        {carga.dados.modelos.map((m) => (
          <li key={m.chave}>
            <button type="button" onClick={() => setAberto(m.chave)}
              className="grid w-full gap-1 rounded-2xl border border-linha bg-superficie p-4 text-left shadow-s1 hover:border-violeta-300 sm:grid-cols-[1fr_auto] sm:items-center">
              <span>
                <span className="font-semibold">{m.titulo}</span>
                <span className="block text-sm text-tinta-suave">{PARA_MODELO[m.para]} · {m.uso} · versão {m.numero}</span>
              </span>
              <Selo tom={TOM_MODELO[m.situacao]}>{SITUACOES_MODELO[m.situacao]}</Selo>
            </button>
          </li>
        ))}
      </ul>
      {aberto ? <JanelaModelo chave={aberto} aoFechar={() => setAberto(null)} aoMudar={carga.recarregar} /> : null}
    </div>
  );
}
