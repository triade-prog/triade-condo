"use client";
// Configurações do condomínio no app (CF-06, CF-08, CF-10, CF-12, AT-10), por tarefa (decisão A.1):
// a entrada com os 5 grupos e uma página por tarefa. As páginas são as mesmas da aba Configuração
// do Console (@triade/configuracoes); aqui ficam os endereços e as pendências do painel. Os
// endereços antigos com ?aba= levam à página nova.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Carregando } from "@triade/ui";
import { EntradaConfiguracoes, PaginaConfiguracao, paginaDe, PaginaMeusAvisos, ProvedorConfiguracao, type Ambiente, type IdPagina } from "@triade/configuracoes";
import { usePlataforma } from "../sessao.tsx";

export const enderecoConfiguracao = (p: IdPagina | null) => (p ? `/configuracoes/${p}` : "/configuracoes");

function useAmbienteApp(): Ambiente {
  const { atualizar } = usePlataforma();
  return { onde: "app", base: "/v1/condominio", aoMudar: atualizar, endereco: enderecoConfiguracao };
}

export function Configuracoes() {
  const ambiente = useAmbienteApp();
  const busca = useSearchParams();
  const router = useRouter();
  const antiga = paginaDe(busca.get("aba"));
  useEffect(() => { if (antiga) router.replace(enderecoConfiguracao(antiga)); }, [antiga, router]);
  if (antiga) return <Carregando />;
  return <EntradaConfiguracoes ambiente={ambiente} enderecoMeusAvisos="/conta/avisos" />;
}

export function PaginaDaConfiguracao({ pagina }: { pagina: string }) {
  const ambiente = useAmbienteApp();
  const router = useRouter();
  const id = paginaDe(pagina);
  useEffect(() => { if (!id) router.replace("/configuracoes"); }, [id, router]);
  if (!id) return <Carregando />;
  return <PaginaConfiguracao key={id} ambiente={ambiente} pagina={id} />;
}

/** Meus avisos, no menu da conta (decisão C.1). */
export function MeusAvisos() {
  const ambiente = useAmbienteApp();
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="t-titulo-tela font-normal tracking-tight">Meus avisos</h1>
        <p className="t-apoio text-tinta-suave">Vale só para você. Cada pessoa liga os seus, para o próprio celular. Decisões continuam no painel.</p>
      </div>
      <ProvedorConfiguracao ambiente={ambiente}><PaginaMeusAvisos /></ProvedorConfiguracao>
    </div>
  );
}
