"use client";
// Situação da conexão do WhatsApp do condomínio (passo 5, W-15), nas Configurações e na tela do
// WhatsApp.

import { formatarDataHora, mostrarTelefone, SITUACOES_CONEXAO, type SituacaoConexao } from "@triade/domain";
import { Aviso, Selo, type Tom } from "@triade/ui";

export interface Conexao {
  situacao: SituacaoConexao;
  oficial?: boolean;
  conectadoEm?: string;
  desconectadoEm?: string;
  ultimaRecebida?: string;
  termoAceitoEm?: string;
  termoAceitoPor?: string;
}

export const TOM_CONEXAO: Record<SituacaoConexao, Tom> = { SEM_CREDENCIAIS: "neutro", DESCONECTADO: "erro", CONECTANDO: "atencao", CONECTADO: "ok" };

export function SituacaoDaConexao({ numero, conexao }: { numero: string | null; conexao: Conexao }) {
  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{numero ? mostrarTelefone(numero) : "Sem número na ficha"}</span>
        <Selo tom={TOM_CONEXAO[conexao.situacao]}>{SITUACOES_CONEXAO[conexao.situacao]}</Selo>
        {conexao.oficial === false || conexao.situacao === "SEM_CREDENCIAIS" ? <Selo tom="atencao">Piloto</Selo> : null}
      </p>
      {conexao.situacao === "DESCONECTADO" && conexao.desconectadoEm ? (
        <Aviso tom="erro" titulo="O WhatsApp do condomínio está desconectado">
          Desde {formatarDataHora(conexao.desconectadoEm)}. As mensagens dos moradores não chegam e os envios esperam na fila. A TRÍADE já foi avisada.
          Enquanto isso, atenda por telefone e registre no painel.
        </Aviso>
      ) : null}
      {conexao.situacao === "SEM_CREDENCIAIS" ? <p className="text-sm text-tinta-suave">A TRÍADE ainda não ligou o WhatsApp deste condomínio.</p> : null}
      {conexao.situacao === "CONECTADO" ? (
        <p className="text-sm text-tinta-suave">
          Conectado desde {formatarDataHora(conexao.conectadoEm ?? "")}{conexao.ultimaRecebida ? ` · última mensagem recebida ${formatarDataHora(conexao.ultimaRecebida)}` : ""}.
        </p>
      ) : null}
      <Aviso tom="atencao" titulo="Conexão de piloto, não oficial">
        O número está ligado pelo WhatsApp Web, como um aparelho conectado. O WhatsApp pode restringir ou bloquear o número sem aviso.
        {conexao.termoAceitoEm ? ` Termo do piloto aceito por ${conexao.termoAceitoPor ?? "o síndico"} em ${formatarDataHora(conexao.termoAceitoEm)}.` : ""}
      </Aviso>
    </div>
  );
}
