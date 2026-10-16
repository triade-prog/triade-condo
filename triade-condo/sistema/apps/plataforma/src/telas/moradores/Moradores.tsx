"use client";
// Moradores e unidades (passo 3; design "Telas do passo 3", aprovado em 16/10/2026): as
// unidades por bloco, a lista de moradores e o que espera confirmação do síndico (MU-02).
// Cada botão só aparece para quem pode (CF-03): a pessoa com Cadastrar moradores inclui, mas
// só o síndico confirma.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Abas, Aviso, Botao, Carregando, classeBotao, ErroCarregar } from "@triade/ui";
import { assinatura, useCarregar, usePlataforma } from "../sessao.tsx";
import type { Recado, Unidades } from "../tipos.ts";
import { AbaUnidades, IncluirUnidades, JanelaBloco } from "./AbaUnidades.tsx";
import { ListaContatos } from "./ListaContatos.tsx";

type IdAba = "unidades" | "moradores" | "confirmar";

export function Moradores() {
  const { atualizar } = usePlataforma();
  const carga = useCarregar<Unidades>("/v1/condominio/unidades");
  const busca = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState<IdAba>((["moradores", "confirmar"] as const).find((a) => a === busca.get("aba")) ?? "unidades");
  const [recado, setRecado] = useState<Recado>(null);
  const [janela, setJanela] = useState<"bloco" | "unidades" | null>(null);
  const [blocoAtual, setBlocoAtual] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as unidades…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Moradores e unidades</h1>
        <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }

  const dados = carga.dados;
  const salvo = (r: Recado) => { setRecado(r); carga.recarregar(); atualizar(); };
  const abas = [
    { id: "unidades" as const, texto: "Unidades" },
    { id: "moradores" as const, texto: "Moradores" },
    { id: "confirmar" as const, texto: `A confirmar (${dados.resumo.aConfirmar})` },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moradores e unidades</h1>
          <p className="mt-1 text-tinta-suave">Quem fala por cada unidade. O morador não tem senha: usa o WhatsApp do condomínio.</p>
        </div>
        {dados.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/moradores/importar" className={classeBotao("secundario")}>Importar planilha</Link>
            <Botao variante="secundario" onClick={() => setJanela("bloco")}>+ Bloco</Botao>
            <Botao onClick={() => setJanela("unidades")}>+ Unidades</Botao>
          </div>
        ) : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} rotulo="Partes de moradores e unidades"
        aoMudar={(id) => { setAba(id); setRecado(null); router.replace(id === "unidades" ? "/moradores" : `/moradores?aba=${id}`, { scroll: false }); }}>
        <div key={`${aba}-${assinatura(dados)}`} className="pt-5">
          {aba === "unidades" ? (
            <AbaUnidades dados={dados} filtroInicial={busca.get("filtro") === "sem-contato" ? "sem-contato" : "todos"} aoMudarBloco={setBlocoAtual}
              aoIncluir={() => setJanela("unidades")} salvo={salvo} recarregar={carga.recarregar} />
          ) : (
            <ListaContatos estado={aba === "confirmar" ? "PENDENTE" : undefined} salvo={salvo} />
          )}
        </div>
      </Abas>
      <JanelaBloco aberto={janela === "bloco"} bloco={null} aoFechar={() => setJanela(null)} salvo={salvo} recarregar={carga.recarregar} />
      <IncluirUnidades aberto={janela === "unidades"} dados={dados} blocoInicial={blocoAtual} aoFechar={() => setJanela(null)} salvo={salvo} />
    </div>
  );
}
