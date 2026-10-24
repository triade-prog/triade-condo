"use client";
// Moradores e unidades (passo 3; DC15, telas-modelo moradores-*): as unidades do jeito que o
// prédio se organiza (torre, bloco, quadra ou prédio, com ou sem andar), as pessoas de cada
// unidade, as garagens e o que espera confirmação do síndico (MU-02). Um só botão principal,
// Cadastrar pessoa; montar o prédio (planilha, divisões, unidades, vagas e a organização) fica
// num menu. No celular, o Cadastrar pessoa flutua sobre a barra de baixo. Cada botão só aparece
// para quem pode (CF-03): a pessoa com Cadastrar moradores inclui, mas só o síndico confirma.
// O link de cadastro do prédio todo (F3.10; MU-09) também fica em Montar o prédio.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_LIGACAO, nomeDaUnidade, type AbaLigacao } from "@triade/domain";
import { Abas, Aviso, Botao, Carregando, ErroCarregar, Icone } from "@triade/ui";
import { assinatura, useCarregar, usePlataforma } from "../sessao.tsx";
import type { Recado, Unidades } from "../tipos.ts";
import { AbaUnidades, IncluirUnidades, JanelaBloco, JanelaEstrutura, textoEstrutura } from "./AbaUnidades.tsx";
import { MenuAcoes, nomesDivisao, type ItemMenu } from "./comum.tsx";
import { AbaGaragens, JanelaVaga } from "./Garagens.tsx";
import { CadastrarMorador } from "./JanelasUnidade.tsx";
import { ListaContatos } from "./ListaContatos.tsx";
import { JanelaLinkCadastro } from "./LinkCadastro.tsx";

type IdAba = "unidades" | "pessoas" | "garagens" | "confirmar";

/** Filtros que o Início abre pelo endereço. */
const FILTROS_DO_ENDERECO = ["sem-contato", "sem-proprietario"] as const;
const LIGACOES_DO_ENDERECO = Object.keys(ABAS_LIGACAO) as AbaLigacao[];

/** "Nova torre", "Novo bloco". */
const nova = (um: string) => `${["Torre", "Quadra"].includes(um) ? "Nova" : "Novo"} ${um.toLowerCase()}`;

export function Moradores() {
  const { atualizar } = usePlataforma();
  const carga = useCarregar<Unidades>("/v1/condominio/unidades");
  const busca = useSearchParams();
  const router = useRouter();
  const doEndereco = busca.get("aba") === "moradores" ? "pessoas" : busca.get("aba");
  const abaDoEndereco: IdAba = (["pessoas", "garagens", "confirmar"] as const).find((a) => a === doEndereco) ?? "unidades";
  const [aba, setAba] = useState<IdAba>(abaDoEndereco);
  // Um link para a própria tela (Pendentes, no menu da unidade) muda o endereço sem montar de novo.
  const [abaVista, setAbaVista] = useState(abaDoEndereco);
  if (abaVista !== abaDoEndereco) { setAbaVista(abaDoEndereco); setAba(abaDoEndereco); }
  const [recado, setRecado] = useState<Recado>(null);
  const [janela, setJanela] = useState<"bloco" | "unidades" | "estrutura" | "morador" | "vaga" | "link" | null>(null);
  const [blocoAtual, setBlocoAtual] = useState<string | null>(null);
  const [garagens, setGaragens] = useState(0);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as unidades…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="t-titulo-tela">Moradores e unidades</h1>
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }

  const dados = carga.dados;
  const div = nomesDivisao(dados.estrutura);
  const salvo = (r: Recado) => { setRecado(r); carga.recarregar(); atualizar(); };
  const abas = [
    { id: "unidades" as const, texto: "Unidades" },
    { id: "pessoas" as const, texto: "Pessoas" },
    { id: "garagens" as const, texto: "Garagens" },
    { id: "confirmar" as const, texto: "A confirmar", contagem: dados.resumo.aConfirmar },
  ];
  const temUnidade = dados.unidades.some((u) => u.ativa);
  const montar: ItemMenu[] = dados.podeEditar ? [
    { texto: "Importar planilha", icone: "baixar", apoio: "Moradores e proprietários de uma vez", href: "/moradores/importar" },
    ...(div.usa ? [{ texto: nova(div.um), icone: "mais" as const, acao: () => setJanela("bloco") }] : []),
    { texto: "Novas unidades", icone: "mais", apoio: "Uma ou várias, pela numeração", acao: () => setJanela("unidades") },
    { texto: "Nova vaga de garagem", icone: "pin", acao: () => setJanela("vaga") },
    ...(temUnidade ? [{ texto: "Link de cadastro", icone: "link" as const, apoio: "Para mandar no grupo de moradores", acao: () => setJanela("link") }] : []),
    { texto: "Organização do prédio", icone: "ajuste", apoio: `Hoje: ${textoEstrutura(dados.estrutura).toLowerCase()}`, acao: () => setJanela("estrutura") },
  ] : [];
  const cadastrar = <Botao onClick={() => setJanela("morador")}><Icone nome="pessoa-mais" />Cadastrar pessoa</Botao>;
  const unidadesDaVaga = dados.unidades.filter((u) => u.ativa)
    .map((u) => ({ id: u.id, nome: nomeDaUnidade(dados.blocos.find((b) => b.id === u.blocoId)?.nome, u.andar, u.identificacao) }));

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-titulo-tela">Moradores e unidades</h1>
          <p className="t-apoio mt-1">Quem fala por cada unidade. Ninguém aqui tem senha: falam com o condomínio pelo WhatsApp.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <MenuAcoes rotulo="Montar o prédio" texto="Montar o prédio" icone="predio" itens={montar} />
          {dados.podeEditar && temUnidade ? <span className="max-md:hidden">{cadastrar}</span> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} rotulo="Partes de moradores e unidades"
        aoMudar={(id) => { setAba(id); setRecado(null); router.replace(id === "unidades" ? "/moradores" : `/moradores?aba=${id}`, { scroll: false }); }}>
        <div key={`${aba}-${assinatura(dados)}-${garagens}`} className="pt-5">
          {aba === "unidades" ? (
            <AbaUnidades dados={dados} filtroInicial={FILTROS_DO_ENDERECO.find((f) => f === busca.get("filtro")) ?? ""} aoMudarBloco={setBlocoAtual}
              aoIncluir={() => setJanela("unidades")} aoOrganizar={() => setJanela("estrutura")} salvo={salvo} recarregar={carga.recarregar} />
          ) : aba === "garagens" ? (
            <AbaGaragens salvo={(r) => { setRecado(r); atualizar(); }} />
          ) : (
            <ListaContatos estado={aba === "confirmar" ? "PENDENTE" : undefined} salvo={salvo} buscaInicial={aba === "pessoas" ? busca.get("busca") ?? "" : ""}
              ligacaoInicial={aba === "pessoas" ? LIGACOES_DO_ENDERECO.find((l) => l === busca.get("ligacao")) ?? null : null}
              unidade={aba === "confirmar" ? busca.get("unidade") ?? undefined : undefined} />
          )}
        </div>
      </Abas>
      {dados.podeEditar && temUnidade ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{cadastrar}</div> : null}
      <JanelaBloco aberto={janela === "bloco"} bloco={null} estrutura={dados.estrutura} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={carga.recarregar} />
      <JanelaEstrutura aberto={janela === "estrutura"} estrutura={dados.estrutura} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={carga.recarregar} />
      <CadastrarMorador aberto={janela === "morador"} dados={dados} aoFechar={() => setJanela(null)} salvo={salvo} />
      <IncluirUnidades aberto={janela === "unidades"} dados={dados} blocoInicial={blocoAtual} aoFechar={() => setJanela(null)} salvo={salvo} />
      {janela === "link" ? <JanelaLinkCadastro unidade={null} aoFechar={() => setJanela(null)} salvo={setRecado} /> : null}
      <JanelaVaga aberto={janela === "vaga"} vaga={null} unidades={unidadesDaVaga} aoFechar={() => setJanela(null)} recarregar={carga.recarregar}
        salvo={(r) => { setJanela(null); setRecado(r); setGaragens((n) => n + 1); }} />
    </div>
  );
}
