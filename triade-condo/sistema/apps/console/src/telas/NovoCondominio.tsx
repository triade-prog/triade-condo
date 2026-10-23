"use client";
// Cadastrar condomínio e escolher o cenário (V-04, V-05, V-06, CF-12; DC15, tela-modelo
// console-cadastrar-computador): um cartão só, com nome, cidade e UF; o resto se preenche
// depois, na Visão geral. Os cenários são cartões de escolha, o escolhido em violeta. Nasce em
// implantação, com quem cadastrou atribuído como administração.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CENARIOS, UFS, type Cenario } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, classeBotao, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { CabecaPagina, Cartao, Voltar } from "./comum.tsx";
import { useSessao } from "./sessao.tsx";

/** O que o cenário quer dizer, e, embaixo, o que ele não presume. */
export const DESCRICAO_CENARIO: Record<Cenario, [string, string]> = {
  SEM_PORTARIA: ["Visitas e entregas direto com o morador.", "Não presume porteiro, zelador nem administradora."],
  PORTARIA_REMOTA: ["Atendimento a distância.", "Não implica manutenção nem integração com o sistema."],
  PORTARIA_PRESENCIAL: ["Atendente no prédio.", "Os responsáveis vêm das pessoas cadastradas, não do tipo de portaria."],
};

export function EscolhaCenario({ valor, aoMudar, nome = "cenario", legenda = true }: { valor: Cenario | ""; aoMudar: (c: Cenario) => void; nome?: string; legenda?: boolean }) {
  return (
    <fieldset className="grid gap-2">
      <legend className={legenda ? "mb-1 t-apoio font-medium" : "sr-only"}>Cenário do prédio{legenda ? <span className="font-normal text-tinta-suave"> (opcional agora)</span> : null}</legend>
      {(Object.keys(CENARIOS) as Cenario[]).map((c) => (
        <label key={c} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-linha bg-superficie px-4 py-3.5 hover:border-violeta-300 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:ring-1 has-checked:ring-violeta-600">
          <input type="radio" name={nome} value={c} checked={valor === c} onChange={() => aoMudar(c)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
          <span className="grid gap-0.5">
            <span className="t-texto font-medium">{CENARIOS[c]}</span>
            <span className="t-apoio text-tinta-suave">{DESCRICAO_CENARIO[c][0]}</span>
            <span className="t-apoio text-tinta-suave">{DESCRICAO_CENARIO[c][1]}</span>
          </span>
        </label>
      ))}
      <p className="t-apoio text-tinta-suave">Dá para escolher ou trocar depois, na Visão geral; trocar não apaga nada.</p>
    </fieldset>
  );
}

export function NovoCondominio() {
  const sessao = useSessao();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cenario, setCenario] = useState<Cenario | "">("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!sessao.acoes.includes("console.condominios.criar")) {
    return <Aviso tom="atencao" titulo="Só a administração cadastra condomínios">Peça a alguém da administração para cadastrar e atribuir o cliente a você.</Aviso>;
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ id: string }>("/v1/clientes", { corpo: { nome, cidade, uf, cenario: cenario || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    router.push(`/clientes/${r.dados.id}`);
  }

  const campos = camposComErro(erro);
  return (
    <div className="grid max-w-[640px] gap-5">
      <Voltar href="/clientes" texto="Voltar à carteira" />
      <CabecaPagina titulo="Cadastrar condomínio" apoio="O resto da ficha pode ser preenchido depois." />
      <Cartao id="t-novo" titulo="Condomínio" icone="predio">
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <CampoTexto id="nome" rotulo="Nome do condomínio" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
            erro={campos.includes("nome") ? "Escreva o nome do condomínio (2 a 120 caracteres)." : null} />
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <CampoTexto id="cidade" rotulo="Cidade" required maxLength={80} value={cidade} onChange={(e) => setCidade(e.target.value)}
              erro={campos.includes("cidade") ? "Escreva a cidade." : null} />
            <CampoSelecao id="uf" rotulo="UF" required value={uf} onChange={(e) => setUf(e.target.value)}
              opcoes={[{ valor: "", texto: "Escolha" }, ...UFS.map((u) => ({ valor: u, texto: u }))]}
              erro={campos.includes("uf") ? "Escolha a UF." : null} />
          </div>
          <EscolhaCenario valor={cenario} aoMudar={setCenario} />
          <div className="flex flex-wrap items-center justify-end gap-2 max-md:grid">
            <Link href="/clientes" className={classeBotao("discreto")}>Cancelar</Link>
            <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Cadastrando…" : "Cadastrar condomínio"}</Botao>
          </div>
        </form>
      </Cartao>
    </div>
  );
}
