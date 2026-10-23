"use client";
// Peças comuns de Ajuda e suporte (DC15, telas-modelo suporte-*; decisões C.1 e D.1 de 23/10/2026):
// as partes num trilho (Chamados e, para o síndico, Acesso da TRÍADE), a situação do chamado em
// selo e os tipos que a API devolve.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { rotuloSituacaoChamadoCliente, type AREAS_CHAMADO, type AreaExcepcional, type TIPOS_CHAMADO } from "@triade/domain";
import { Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { usePlataforma } from "../sessao.tsx";

export interface Chamado {
  id: string;
  numero: number;
  tipo: keyof typeof TIPOS_CHAMADO;
  area: keyof typeof AREAS_CHAMADO;
  titulo: string;
  situacao: string;
  abertoPor: string;
  imagens: number;
  /** Só no chamado de mudança (0286): a parte e como estava quando foi pedido. */
  parte?: string;
  hoje?: string;
  ultima?: { lado: "CLIENTE" | "TRIADE"; autor: string; em: string };
  resolvidoEm?: string;
  criadoEm: string;
}

export interface DetalheChamado extends Chamado {
  mensagens: { id: string; lado: "CLIENTE" | "TRIADE"; autor: string; texto: string; criadoEm: string }[];
  arquivos: { id: string; nome: string; situacao: string; motivoRecusa?: string }[];
  pode: { responder: boolean; resolver: boolean; enviarImagem: boolean };
}

export interface PedidoAcessoExcepcional {
  id: string;
  pedidoPor: string;
  funcoes?: string[];
  motivo: string;
  areas: AreaExcepcional[];
  horas: number;
  situacao: string;
  validoAte?: string;
  leituras: number;
  criadoEm: string;
  decididoEm?: string;
  decididoPor?: string;
  motivoRecusa?: string;
  encerradoEm?: string;
  encerradoPor?: string;
}

const TOM: Record<string, Tom> = { NOVO: "info", ANDAMENTO: "info", ESPERANDO_CLIENTE: "atencao", RESOLVIDO: "ok" };

export function SeloChamado({ situacao }: { situacao: string }) {
  return <Selo tom={TOM[situacao] ?? "info"}>{rotuloSituacaoChamadoCliente(situacao)}</Selo>;
}

export const ICONE_TIPO: Record<keyof typeof TIPOS_CHAMADO, NomeIcone> = { DUVIDA: "balao", PROBLEMA: "alerta", SUGESTAO: "estrela", MUDANCA: "trocar" };

/** As partes de Ajuda e suporte, juntas no topo de cada uma. Acesso da TRÍADE só para quem aprova. */
export function PartesSuporte() {
  const caminho = usePathname();
  const { pode } = usePlataforma();
  if (!pode("acesso_excepcional.aprovar")) return null;
  const partes = [
    { href: "/suporte", texto: "Chamados", icone: "balao", atual: caminho === "/suporte" },
    { href: "/suporte/acesso", texto: "Acesso da TRÍADE", icone: "escudo", atual: caminho.startsWith("/suporte/acesso") },
  ] as const;
  return (
    <nav aria-label="Partes de ajuda e suporte" className="trilho justify-self-start max-md:flex max-md:w-full max-md:justify-self-stretch">
      {partes.map((p) => (
        <Link key={p.href} href={p.href} className="chip max-md:flex-1 max-md:justify-center" aria-current={p.atual ? "page" : undefined} data-escolhido={p.atual ? "" : undefined}>
          <Icone nome={p.icone} className="max-md:hidden" />{p.texto}
        </Link>
      ))}
    </nav>
  );
}

export const TEXTO_SUPORTE = "Dúvidas, problemas e pedidos de mudança no que a TRÍADE configurou, respondidos em dias úteis, das 9h às 18h. Não é reparo nem canal de emergência: vazamento, elevador parado ou segurança vão para o síndico ou para os serviços de emergência.";
