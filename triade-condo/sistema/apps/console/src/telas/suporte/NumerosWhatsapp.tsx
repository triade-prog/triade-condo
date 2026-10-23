"use client";
// Números do WhatsApp no Console (passo 5; W-01, W-17; DC15, tela-modelo console-whatsapp-computador):
// os números dos clientes atribuídos. Sem credenciais e desconectado vêm primeiro, em selo âmbar ou
// vermelho com ícone, e com o botão do próximo passo na linha.

import Link from "next/link";
import { formatarDataHora, mostrarTelefone, SITUACOES_CONEXAO, type SituacaoConexao } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, Icone, Vazio, type NomeIcone, type Tom } from "@triade/ui";
import { Cartao } from "../comum.tsx";
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

const TOM: Record<SituacaoConexao, Tom> = { SEM_CREDENCIAIS: "atencao", DESCONECTADO: "erro", CONECTANDO: "atencao", CONECTADO: "ok" };
const ICONE: Record<SituacaoConexao, NomeIcone> = { SEM_CREDENCIAIS: "alerta", DESCONECTADO: "alerta", CONECTANDO: "relogio", CONECTADO: "check" };
const ORDEM: Record<SituacaoConexao, number> = { DESCONECTADO: 0, SEM_CREDENCIAIS: 1, CONECTANDO: 2, CONECTADO: 3 };

/** O próximo passo de cada situação, aberto na parte WhatsApp da ficha. */
function proximoPasso(n: Numero): { texto: string; abrir?: string } {
  if (n.situacao === "SEM_CREDENCIAIS") return { texto: "Guardar credenciais", abrir: "credenciais" };
  if (n.situacao === "DESCONECTADO" || n.situacao === "CONECTANDO") return { texto: "Conectar" };
  return { texto: "Abrir" };
}

export function NumerosWhatsapp() {
  const carga = useCarregar<{ numeros: Numero[] }>("/v1/whatsapp");
  const numeros = carga.estado === "pronto" ? [...carga.dados.numeros].sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]) : [];
  return (
    <Cartao id="t-numeros" titulo="Números dos condomínios" icone="whats">
      <p className="t-apoio">Os números dos clientes atribuídos a você. Desconectado e sem credenciais vêm primeiro: as mensagens dos moradores não chegam.</p>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && numeros.length === 0 ? <Vazio titulo="Nenhum número ainda" icone="whats">Cadastre o número na Visão geral da ficha do cliente e conecte na parte WhatsApp.</Vazio> : null}
      {numeros.length > 0 ? (
        <ul className="divide-y divide-linha">
          {numeros.map((n) => {
            const passo = proximoPasso(n);
            const href = `/clientes/${n.condominioId}?aba=whatsapp${passo.abrir ? `&abrir=${passo.abrir}` : ""}`;
            return (
              <li key={n.condominioId} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="ladrilho" data-tom={n.situacao === "CONECTADO" ? "ok" : "atencao"} aria-hidden="true"><Icone nome="whats" /></span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold">{n.nome}</span>
                  <span className="t-apoio text-tinta-suave">
                    <span className="t-codigo">{n.numero ? mostrarTelefone(n.numero) : "Sem número na ficha"}</span>
                    {n.desde ? ` · ${n.situacao === "CONECTADO" ? "desde" : "desconectado desde"} ${formatarDataHora(n.desde)}` : ""}
                    {n.termo === false && n.situacao !== "CONECTADO" ? " · termo do piloto esperando o síndico" : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="selo" data-tom={TOM[n.situacao]}><Icone nome={ICONE[n.situacao]} className="h-3.5 w-3.5" />{SITUACOES_CONEXAO[n.situacao]}</span>
                  {n.oficial === false || n.situacao === "SEM_CREDENCIAIS" ? <span className="selo" data-tom="neutro">Piloto</span> : null}
                </span>
                <Link href={href} className={classeBotao(n.situacao === "CONECTADO" ? "contorno" : "primario", "", "m")} aria-label={`${passo.texto}: ${n.nome}`}>{passo.texto}</Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Cartao>
  );
}
