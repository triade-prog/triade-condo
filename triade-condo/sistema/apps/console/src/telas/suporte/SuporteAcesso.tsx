"use client";
// Suporte de acesso (PI-09; DC15, tela-modelo console-suporte-acesso-computador, rodada Console de
// 23/10/2026): quem não consegue entrar. Pedido, verificação e o mesmo acesso de volta, sem ninguém
// ver senha. A fila mostra os pedidos em andamento e os do último mês, em abas Abertos e
// Concluídos; a linha inteira abre o pedido. A regra do e-mail que mudou é um aviso no alto.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CANAIS_SUPORTE, SITUACOES_SUPORTE_ACESSO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import {
  Aviso, Botao, CampoAreaTexto, CampoSelecao, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
import { AbasLista, CabecaPagina, CaixaLista, CLASSE_LINHA, CLASSE_LINK_LINHA, diaHora, plural } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";

export interface PedidoAcesso {
  id: string;
  condominioId: string;
  condominio: string;
  pessoaId: string;
  pessoa: string;
  tipo: keyof typeof TIPOS_SUPORTE_ACESSO;
  canal: keyof typeof CANAIS_SUPORTE;
  descricao?: string;
  vinculo?: { funcoes: string[]; desde: string };
  dadosConferidos: boolean;
  canalConhecido: boolean;
  situacao: keyof typeof SITUACOES_SUPORTE_ACESSO;
  motivo?: string;
  atendidoPor: string;
  decididoPor?: string;
  criadoEm: string;
  versao: number;
}

export const TOM_SUPORTE: Record<string, Tom> = { ABERTO: "andamento", DUVIDOSO: "atencao", ENVIADO: "ok", AUTENTICADOR_TIRADO: "ok", RECUSADO: "neutro" };

function NovoPedido({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const carteira = useCarregar<{ clientes: { id: string; nome: string }[] }>("/v1/clientes");
  const [condominio, setCondominio] = useState("");
  const pessoas = useCarregar<{ pessoas: { pessoaId: string; nome: string }[] }>(condominio ? `/v1/clientes/${condominio}/pessoas-plataforma` : null);
  const [pessoa, setPessoa] = useState("");
  const [tipo, setTipo] = useState("SENHA");
  const [canal, setCanal] = useState("WHATSAPP");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function abrir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi<{ id: string }>(`/v1/clientes/${condominio}/suporte-acesso`, { corpo: { pessoaId: pessoa, tipo, canal, descricao } });
    if (!r.ok) return setErro(r.erro);
    router.push(`/suporte-acesso/${condominio}/${r.dados.id}`);
  }

  const campos = camposComErro(erro);
  return (
    <Dialogo aberto titulo="Novo pedido de suporte de acesso" aoFechar={aoFechar}>
      <form onSubmit={abrir} noValidate className="grid gap-4">
        {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
        <CampoSelecao id="sa-cond" rotulo="Condomínio" value={condominio} onChange={(e) => { setCondominio(e.target.value); setPessoa(""); }}
          opcoes={[{ valor: "", texto: "Escolha" }, ...(carteira.estado === "pronto" ? carteira.dados.clientes.map((c) => ({ valor: c.id, texto: c.nome })) : [])]} />
        <CampoSelecao id="sa-pessoa" rotulo="Quem não consegue entrar" value={pessoa} onChange={(e) => setPessoa(e.target.value)} disabled={!condominio}
          opcoes={[{ valor: "", texto: "Escolha" }, ...(pessoas.estado === "pronto" ? pessoas.dados.pessoas.map((p) => ({ valor: p.pessoaId, texto: p.nome })) : [])]}
          erro={campos.includes("pessoaId") ? "Escolha a pessoa." : null} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao id="sa-tipo" rotulo="O que aconteceu" value={tipo} onChange={(e) => setTipo(e.target.value)}
            opcoes={Object.entries(TIPOS_SUPORTE_ACESSO).map(([valor, texto]) => ({ valor, texto }))} />
          <CampoSelecao id="sa-canal" rotulo="Por qual canal chegou" value={canal} onChange={(e) => setCanal(e.target.value)}
            opcoes={Object.entries(CANAIS_SUPORTE).map(([valor, texto]) => ({ valor, texto }))} />
        </div>
        <CampoAreaTexto id="sa-desc" rotulo="O que a pessoa contou" required maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)}
          erro={campos.includes("descricao") ? "Escreva o que a pessoa contou." : null} />
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={!condominio || !pessoa}>Abrir pedido</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Por onde o pedido chegou, numa frase ("pelo WhatsApp da TRÍADE"). */
export const PELO_CANAL: Record<keyof typeof CANAIS_SUPORTE, string> = {
  WHATSAPP: "pelo WhatsApp da TRÍADE", EMAIL: "por e-mail", TELEFONE: "por telefone", PRESENCIAL: "presencialmente", OUTRO: "por outro canal",
};

/** Pedido que ainda pede um passo da equipe ou da administração. */
export const pedidoAberto = (p: Pick<PedidoAcesso, "situacao">) => p.situacao === "ABERTO" || p.situacao === "DUVIDOSO";

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_20px]";

export function SuporteAcesso() {
  const carga = useCarregar<{ pedidos: PedidoAcesso[] }>("/v1/suporte-acesso");
  const [novo, setNovo] = useState(false);
  const [aba, setAba] = useState<"abertos" | "concluidos">("abertos");
  const todos = carga.estado === "pronto" ? carga.dados.pedidos : [];
  const abertos = todos.filter(pedidoAberto);
  const visiveis = aba === "abertos" ? abertos : todos.filter((p) => !pedidoAberto(p));
  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Suporte de acesso" apoio="Quem não consegue entrar: verificar e restabelecer o mesmo acesso."
        acao={<Botao onClick={() => setNovo(true)}><Icone nome="mais" />Novo pedido</Botao>} />
      <Aviso tom="info" titulo="E-mail que mudou não se troca aqui">
        Vira troca de síndico, para o síndico, ou novo convite feito pelo síndico, para a pessoa autorizada.
      </Aviso>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (
        <CaixaLista titulo="Pedidos de suporte de acesso" colunas={COLUNAS} cabecalho={visiveis.length ? ["", "Pedido", "Recebido", "Situação", ""] : undefined}
          abas={<AbasLista rotulo="Filtrar os pedidos" atual={aba} aoMudar={setAba}
            abas={[{ valor: "abertos", texto: "Abertos", n: abertos.length }, { valor: "concluidos", texto: "Concluídos", n: todos.length - abertos.length }]} />}
          rodape={visiveis.length ? (
            <>
              <span className="t-apoio">{plural(abertos.length, "pedido aberto", "pedidos abertos")}</span>
              <span className="t-apoio">Cada pedido e cada passo ficam no histórico.</span>
            </>
          ) : undefined}>
          {visiveis.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={aba === "abertos" ? "Nenhum pedido aberto" : "Nenhum pedido concluído no último mês"} icone="chave">
                {aba === "abertos" ? "Quando alguém não conseguir entrar, abra o pedido aqui." : "Os pedidos do último mês aparecem aqui."}
              </Vazio>
            </div>
          ) : (
            <ul className="grid max-md:gap-3 max-md:pt-3">
              {visiveis.map((p) => (
                <li key={p.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
                  <span className="ladrilho self-start md:self-center" data-tom={p.situacao === "DUVIDOSO" ? "atencao" : "violeta"} aria-hidden="true"><Icone nome="chave" /></span>
                  <span className="grid min-w-0 justify-items-start gap-1">
                    <Link href={`/suporte-acesso/${p.condominioId}/${p.id}`} className={CLASSE_LINK_LINHA}>{p.pessoa} · {p.condominio}</Link>
                    <span className="t-apoio">{TIPOS_SUPORTE_ACESSO[p.tipo]} · {PELO_CANAL[p.canal]}</span>
                  </span>
                  <span className="t-apoio min-w-0 max-md:col-span-2 max-md:col-start-2">{diaHora(p.criadoEm)} · com {p.atendidoPor}</span>
                  <span className="max-md:col-span-2 max-md:col-start-2">
                    <span className="selo" data-tom={TOM_SUPORTE[p.situacao]}>{SITUACOES_SUPORTE_ACESSO[p.situacao]}</span>
                  </span>
                  <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                </li>
              ))}
            </ul>
          )}
        </CaixaLista>
      ) : null}
      {novo ? <NovoPedido aoFechar={() => setNovo(false)} /> : null}
    </div>
  );
}
