"use client";
// Janela de formulário usada por todos os cadastros curtos das configurações (categoria,
// prioridade, etapa, modelo, prazo, feriado) e pelas ações dos pedidos. Erro da API aparece dentro dela, com os campos
// destacados; no conflito de versão, o que a pessoa escreveu fica.

import { useState, type FormEvent, type ReactNode } from "react";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Dialogo, textoDoErro, type ErroApi, type Resposta } from "@triade/ui";

export type Campo =
  | { id: string; rotulo: string; tipo: "texto" | "data" | "datahora" | "numero"; obrigatorio?: boolean; max?: number; ajuda?: string; erro?: string }
  | { id: string; rotulo: string; tipo: "area"; obrigatorio?: boolean; max?: number; ajuda?: string; erro?: string }
  | { id: string; rotulo: string; tipo: "selecao"; opcoes: { valor: string; texto: string }[]; ajuda?: string; erro?: string; desligado?: boolean }
  | { id: string; rotulo: string; tipo: "caixa"; ajuda?: string; desligado?: boolean };

export type Valores = Record<string, string | boolean>;

export function Janela({ aberto, titulo, campos, iniciais, textoBotao, aoFechar, aoSalvar, recarregar, explicacao, extra }: {
  aberto: boolean;
  titulo: string;
  campos: Campo[];
  iniciais: Valores;
  textoBotao: string;
  aoFechar: () => void;
  aoSalvar: (v: Valores) => Promise<Resposta<unknown>>;
  recarregar?: () => void;
  explicacao?: string;
  /** Parte a mais do formulário, depois dos campos (ex.: arquivos da conclusão). */
  extra?: ReactNode;
}) {
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={aoFechar}>
      {aberto ? <Formulario campos={campos} iniciais={iniciais} textoBotao={textoBotao} aoFechar={aoFechar} aoSalvar={aoSalvar} recarregar={recarregar} explicacao={explicacao} extra={extra} /> : null}
    </Dialogo>
  );
}

function Formulario({ campos, iniciais, textoBotao, aoFechar, aoSalvar, recarregar, explicacao, extra }: Omit<Parameters<typeof Janela>[0], "aberto" | "titulo">) {
  const [valores, setValores] = useState<Valores>(iniciais);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (id: string, v: string | boolean) => setValores((x) => ({ ...x, [id]: v }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await aoSalvar(valores);
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  }

  const comErro = camposComErro(erro);
  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}
      {explicacao ? <p className="text-sm text-tinta-suave">{explicacao}</p> : null}
      {campos.map((c) => {
        const id = `j-${c.id}`;
        const msg = "erro" in c && comErro.includes(c.id) ? c.erro ?? "Confira este campo." : null;
        if (c.tipo === "caixa") {
          return (
            <label key={c.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-violeta-600" checked={valores[c.id] === true} disabled={c.desligado}
                onChange={(e) => mudar(c.id, e.target.checked)} />
              <span>{c.rotulo}{c.ajuda ? <span className="block text-xs text-tinta-suave">{c.ajuda}</span> : null}</span>
            </label>
          );
        }
        if (c.tipo === "selecao") {
          return <CampoSelecao key={c.id} id={id} rotulo={c.rotulo} opcoes={c.opcoes} ajuda={c.ajuda} erro={msg} disabled={c.desligado}
            value={String(valores[c.id] ?? "")} onChange={(e) => mudar(c.id, e.target.value)} />;
        }
        if (c.tipo === "area") {
          return <CampoAreaTexto key={c.id} id={id} rotulo={c.rotulo} required={c.obrigatorio} maxLength={c.max} ajuda={c.ajuda} erro={msg}
            value={String(valores[c.id] ?? "")} onChange={(e) => mudar(c.id, e.target.value)} />;
        }
        return <CampoTexto key={c.id} id={id} rotulo={c.rotulo} required={c.obrigatorio} maxLength={c.max} ajuda={c.ajuda} erro={msg}
          type={c.tipo === "data" ? "date" : c.tipo === "datahora" ? "datetime-local" : "text"} inputMode={c.tipo === "numero" ? "numeric" : undefined}
          value={String(valores[c.id] ?? "")} onChange={(e) => mudar(c.id, e.target.value)} />;
      })}
      {extra}
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</Botao>
      </div>
    </form>
  );
}
