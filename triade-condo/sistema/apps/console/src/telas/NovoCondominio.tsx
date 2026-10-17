"use client";
// Cadastrar condomínio e escolher o cenário (V-04, V-05, V-06, CF-12). Nasce em implantação,
// com quem cadastrou atribuído como administração.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CENARIOS, UFS, type Cenario } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, classeBotao, textoDoErro, type ErroApi } from "@triade/ui";
import { useSessao } from "./sessao.tsx";

export const DESCRICAO_CENARIO: Record<Cenario, string> = {
  SEM_PORTARIA: "Visitas e entregas direto com o morador. Não presume porteiro, zelador nem administradora.",
  PORTARIA_REMOTA: "Atendimento a distância. Não implica manutenção nem integração com o sistema.",
  PORTARIA_PRESENCIAL: "Atendente no prédio. Os responsáveis vêm das pessoas cadastradas, não do tipo de portaria.",
};

export function EscolhaCenario({ valor, aoMudar, nome = "cenario" }: { valor: Cenario | ""; aoMudar: (c: Cenario) => void; nome?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[13px] font-medium">Cenário do prédio <span className="font-normal text-tinta-suave">(opcional agora)</span></legend>
      <div className="grid gap-2 md:grid-cols-3">
        {(Object.keys(CENARIOS) as Cenario[]).map((c) => (
          <label key={c} className="grid cursor-pointer gap-1 rounded-2xl border border-linha bg-superficie p-3 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:ring-1 has-checked:ring-violeta-600">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <input type="radio" name={nome} value={c} checked={valor === c} onChange={() => aoMudar(c)} className="accent-violeta-600" />
              {CENARIOS[c]}
            </span>
            <span className="text-xs text-tinta-suave">{DESCRICAO_CENARIO[c]}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-tinta-suave">Dá para escolher ou trocar depois; trocar não apaga nada.</p>
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
    <form onSubmit={enviar} className="grid max-w-3xl gap-5" noValidate>
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Cadastrar condomínio</h1>
        <p className="text-tinta-suave">O resto da ficha pode ser preenchido depois.</p>
      </div>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      <CampoTexto id="nome" rotulo="Nome do condomínio" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
        erro={campos.includes("nome") ? "Escreva o nome do condomínio (2 a 120 caracteres)." : null} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <CampoTexto id="cidade" rotulo="Cidade" required maxLength={80} value={cidade} onChange={(e) => setCidade(e.target.value)}
          erro={campos.includes("cidade") ? "Escreva a cidade." : null} />
        <CampoSelecao id="uf" rotulo="UF" required value={uf} onChange={(e) => setUf(e.target.value)}
          opcoes={[{ valor: "", texto: "Escolha" }, ...UFS.map((u) => ({ valor: u, texto: u }))]}
          erro={campos.includes("uf") ? "Escolha a UF." : null} />
      </div>
      <EscolhaCenario valor={cenario} aoMudar={setCenario} />
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>{enviando ? "Cadastrando…" : "Cadastrar condomínio"}</Botao>
        <Link href="/" className={classeBotao("contorno")}>Cancelar</Link>
      </div>
    </form>
  );
}
