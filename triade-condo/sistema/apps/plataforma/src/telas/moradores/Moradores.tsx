"use client";
// Moradores e unidades (passo 3; design "Telas do passo 3", aprovado em 16/10/2026): as
// unidades do jeito que o prédio se organiza (torre, bloco, quadra ou prédio, com ou sem
// andar), a lista de moradores e proprietários e o que espera confirmação do síndico (MU-02).
// Cada botão só aparece para quem pode (CF-03): a pessoa com Cadastrar moradores inclui, mas
// só o síndico confirma. A aba Garagens mostra todas as vagas (MU-06).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Abas, Aviso, Botao, Carregando, classeBotao, ErroCarregar } from "@triade/ui";
import { assinatura, useCarregar, usePlataforma } from "../sessao.tsx";
import type { Recado, Unidades } from "../tipos.ts";
import { AbaUnidades, IncluirUnidades, JanelaBloco, JanelaEstrutura } from "./AbaUnidades.tsx";
import { nomesDivisao } from "./comum.tsx";
import { AbaGaragens } from "./Garagens.tsx";
import { CadastrarMorador } from "./JanelasUnidade.tsx";
import { ListaContatos } from "./ListaContatos.tsx";

type IdAba = "unidades" | "moradores" | "garagens" | "confirmar";

/** Filtros que o Início abre pelo endereço. */
const FILTROS_DO_ENDERECO = ["sem-contato", "sem-proprietario"] as const;

export function Moradores() {
  const { atualizar } = usePlataforma();
  const carga = useCarregar<Unidades>("/v1/condominio/unidades");
  const busca = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState<IdAba>((["moradores", "garagens", "confirmar"] as const).find((a) => a === busca.get("aba")) ?? "unidades");
  const [recado, setRecado] = useState<Recado>(null);
  const [janela, setJanela] = useState<"bloco" | "unidades" | "estrutura" | "morador" | null>(null);
  const [blocoAtual, setBlocoAtual] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as unidades…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="text-[28px] font-normal tracking-tight">Moradores e unidades</h1>
        <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }

  const dados = carga.dados;
  const div = nomesDivisao(dados.estrutura);
  const salvo = (r: Recado) => { setRecado(r); carga.recarregar(); atualizar(); };
  const abas = [
    { id: "unidades" as const, texto: "Unidades" },
    { id: "moradores" as const, texto: "Moradores" },
    { id: "garagens" as const, texto: "Garagens" },
    { id: "confirmar" as const, texto: `A confirmar (${dados.resumo.aConfirmar})` },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Moradores e unidades</h1>
          <p className="mt-1 text-tinta-suave">Moradores e proprietários de cada unidade. Ninguém aqui tem senha: falam com o condomínio pelo WhatsApp.</p>
        </div>
        {dados.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/moradores/importar" className={classeBotao("contorno")}>Importar planilha</Link>
            {div.usa ? <Botao variante="contorno" onClick={() => setJanela("bloco")}>+ {div.um}</Botao> : null}
            <Botao variante="contorno" onClick={() => setJanela("unidades")}>+ Unidades</Botao>
            {dados.unidades.some((u) => u.ativa) ? <Botao onClick={() => setJanela("morador")}>+ Morador ou proprietário</Botao> : null}
          </div>
        ) : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} rotulo="Partes de moradores e unidades"
        aoMudar={(id) => { setAba(id); setRecado(null); router.replace(id === "unidades" ? "/moradores" : `/moradores?aba=${id}`, { scroll: false }); }}>
        <div key={`${aba}-${assinatura(dados)}`} className="pt-5">
          {aba === "unidades" ? (
            <AbaUnidades dados={dados} filtroInicial={FILTROS_DO_ENDERECO.find((f) => f === busca.get("filtro")) ?? "todos"} aoMudarBloco={setBlocoAtual}
              aoIncluir={() => setJanela("unidades")} aoOrganizar={() => setJanela("estrutura")} salvo={salvo} recarregar={carga.recarregar} />
          ) : aba === "garagens" ? (
            <AbaGaragens salvo={(r) => { setRecado(r); atualizar(); }} />
          ) : (
            <ListaContatos estado={aba === "confirmar" ? "PENDENTE" : undefined} salvo={salvo} buscaInicial={aba === "moradores" ? busca.get("busca") ?? "" : ""} />
          )}
        </div>
      </Abas>
      <JanelaBloco aberto={janela === "bloco"} bloco={null} estrutura={dados.estrutura} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={carga.recarregar} />
      <JanelaEstrutura aberto={janela === "estrutura"} estrutura={dados.estrutura} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={carga.recarregar} />
      <CadastrarMorador aberto={janela === "morador"} dados={dados} aoFechar={() => setJanela(null)} salvo={salvo} />
      <IncluirUnidades aberto={janela === "unidades"} dados={dados} blocoInicial={blocoAtual} aoFechar={() => setJanela(null)} salvo={salvo} />
    </div>
  );
}
