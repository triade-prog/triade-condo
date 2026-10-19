"use client";
// WhatsApp no menu do Console (passo 5; W-01, W-17): os números dos clientes atribuídos, os
// desconectados primeiro, para a equipe agir quando um número cai.

import Link from "next/link";
import { formatarDataHora, mostrarTelefone, SITUACOES_CONEXAO, type SituacaoConexao } from "@triade/domain";
import { Carregando, ErroCarregar, Selo, Vazio, type Tom } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

interface Numero {
  condominioId: string;
  nome: string;
  numero?: string;
  situacao: SituacaoConexao;
  oficial?: boolean;
  desde?: string;
  termo?: boolean;
}

const TOM: Record<SituacaoConexao, Tom> = { SEM_CREDENCIAIS: "neutro", DESCONECTADO: "erro", CONECTANDO: "atencao", CONECTADO: "ok" };

export function NumerosWhatsapp() {
  const carga = useCarregar<{ numeros: Numero[] }>("/v1/whatsapp");
  return (
    <div className="grid gap-5 pt-4">
      <p className="text-tinta-suave">Os números dos clientes atribuídos a você. Desconectado vem primeiro: as mensagens dos moradores não chegam.</p>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.numeros.length === 0 ? <Vazio titulo="Nenhum número ainda">Cadastre o número na ficha do cliente e conecte na aba WhatsApp.</Vazio> : null}
      {carga.estado === "pronto" && carga.dados.numeros.length > 0 ? (
        <ul className="grid gap-2.5">
          {carga.dados.numeros.map((n) => (
            <li key={n.condominioId} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 sm:grid-cols-[1fr_auto] sm:items-center">
              <span>
                <Link href={`/clientes/${n.condominioId}?aba=whatsapp`} className="font-semibold hover:underline">{n.nome}</Link>
                <span className="block text-sm text-tinta-suave">
                  {n.numero ? mostrarTelefone(n.numero) : "Sem número na ficha"}
                  {n.desde ? ` · ${n.situacao === "CONECTADO" ? "desde" : "desconectado desde"} ${formatarDataHora(n.desde)}` : ""}
                  {n.termo === false && n.situacao !== "CONECTADO" ? " · termo do piloto esperando o síndico" : ""}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                {n.oficial === false || n.situacao === "SEM_CREDENCIAIS" ? <Selo tom="atencao">Piloto</Selo> : null}
                <Selo tom={TOM[n.situacao]}>{SITUACOES_CONEXAO[n.situacao]}</Selo>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
