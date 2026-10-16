"use client";
// Quem atende (CF-05): o síndico escolhe quem atende os pedidos e marca quem está
// disponível. O responsável padrão da fila precisa estar disponível.

import { useState, type FormEvent } from "react";
import { FUNCOES_PLATAFORMA } from "@triade/domain";
import { AvisoErro, Botao, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { PropsPessoas } from "./Pessoas.tsx";

export function AbaAtendimento({ dados, recarregar, salvo }: PropsPessoas) {
  const [linhas, setLinhas] = useState(() => dados.pessoas.map((p) => ({ id: p.vinculoId, nome: p.nome, papel: p.cargo ?? FUNCOES_PLATAFORMA[p.funcao], atende: p.responsavel, disponivel: p.responsavel ? p.disponivel : true })));
  const [padrao, setPadrao] = useState<string | null>(dados.responsavelPadrao);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const valido = (id: string | null) => !!id && linhas.some((l) => l.id === id && l.atende && l.disponivel);
  const padraoValido = valido(padrao) ? padrao : null;

  function mudar(id: string, campo: "atende" | "disponivel", valor: boolean) {
    setLinhas((l) => l.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const responsaveis = linhas.filter((l) => l.atende).map((l) => ({ vinculoId: l.id, disponivel: l.disponivel }));
    const r = await chamarApi("/v1/condominio/atendimento", { metodo: "PUT", corpo: { versao: dados.versao, responsaveis, padraoId: padraoValido } });
    if (!r.ok) return setErro(r.erro);
    salvo({ tom: "ok", texto: "Quem atende foi salvo." });
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <p className="text-sm text-tinta-suave">Novos pedidos caem para o responsável padrão da fila. Ele precisa estar disponível; quem sai de férias fica indisponível.</p>
      <div className="overflow-x-auto rounded-lg border border-linha">
        <table className="w-full text-sm">
          <caption className="sr-only">Quem atende os pedidos</caption>
          <thead className="bg-superficie-2 text-left text-tinta-suave">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Pessoa</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Atende os pedidos</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Disponível</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Padrão da fila</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-t border-linha">
                <td className="px-4 py-3"><span className="font-medium">{l.nome}</span><span className="block text-xs text-tinta-suave">{l.papel}</span></td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-acao)]" checked={l.atende} aria-label={`${l.nome} atende os pedidos`}
                    onChange={(e) => mudar(l.id, "atende", e.target.checked)} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-acao)]" checked={l.atende && l.disponivel} disabled={!l.atende}
                    aria-label={`${l.nome} está disponível`} onChange={(e) => mudar(l.id, "disponivel", e.target.checked)} />
                </td>
                <td className="px-4 py-3">
                  <input type="radio" name="padrao" className="h-5 w-5 accent-[var(--color-acao)]" checked={padraoValido === l.id} disabled={!valido(l.id)}
                    aria-label={`${l.nome} é o padrão da fila`} onChange={() => setPadrao(l.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.some((l) => l.atende) && !padraoValido ? <p role="status" className="text-sm text-atencao">Escolha o padrão da fila entre quem atende e está disponível.</p> : null}
      <Botao type="submit" className="justify-self-start">Salvar quem atende</Botao>
    </form>
  );
}
