"use client";
// Suporte de acesso (PI-09): quem não consegue entrar. Pedido, verificação e o mesmo acesso de
// volta, sem ninguém ver senha. A fila mostra os pedidos em andamento e os do último mês.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CANAIS_SUPORTE, formatarDataHora, SITUACOES_SUPORTE_ACESSO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import {
  Aviso, Botao, CampoAreaTexto, CampoSelecao, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
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

export function SuporteAcesso() {
  const carga = useCarregar<{ pedidos: PedidoAcesso[] }>("/v1/suporte-acesso");
  const [novo, setNovo] = useState(false);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Suporte de acesso</h1>
          <p className="text-tinta-suave">Quem não consegue entrar: verificar e restabelecer o mesmo acesso.</p>
        </div>
        <Botao onClick={() => setNovo(true)}>Novo pedido</Botao>
      </div>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.pedidos.length === 0 ? <Vazio titulo="Nenhum pedido de suporte de acesso">Os pedidos do último mês aparecem aqui.</Vazio> : null}
      {carga.estado === "pronto" && carga.dados.pedidos.length > 0 ? (
        <ul className="grid gap-2.5">
          {carga.dados.pedidos.map((p) => (
            <li key={p.id} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 sm:grid-cols-[1fr_auto] sm:items-center">
              <span>
                <Link href={`/suporte-acesso/${p.condominioId}/${p.id}`} className="font-semibold text-tinta hover:underline">Pedido de {p.pessoa} · {p.condominio}</Link>
                <span className="block text-sm text-tinta-suave">{TIPOS_SUPORTE_ACESSO[p.tipo]} · {CANAIS_SUPORTE[p.canal]} · {formatarDataHora(p.criadoEm)} · atendido por {p.atendidoPor}</span>
              </span>
              <Selo tom={TOM_SUPORTE[p.situacao]}>{SITUACOES_SUPORTE_ACESSO[p.situacao]}</Selo>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-tinta-suave">E-mail que mudou não se troca aqui: vira troca de síndico (síndico) ou novo convite feito pelo síndico (pessoa autorizada). Cada pedido e cada passo ficam no histórico.</p>
      {novo ? <NovoPedido aoFechar={() => setNovo(false)} /> : null}
    </div>
  );
}
