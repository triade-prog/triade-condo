"use client";
// Criar a senha pelo link de uso único: o do convite (CF-02) e o da recuperação (PT-08).
// O token vem na URL: token_hash (modelo de e-mail próprio) ou, no modelo padrão do Supabase,
// o access_token depois do #. O # sai do endereço assim que é lido; a página não guarda nada e
// não envia referrer.

import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { chamarApi, camposComErro, textoDoErro, type ErroApi } from "./api.ts";
import { Aviso, Botao, CampoTexto } from "./componentes.tsx";

export type CredencialDoLink = { tokenHash: string } | { accessToken: string };

let hashLido: string | null = null;
const lerHash = () => (hashLido ??= window.location.hash);

/** O que o link do e-mail trouxe: token_hash na consulta ou access_token (ou erro) depois do #. */
export function useCredencialDoLink(tokenHash: string | null): { credencial: CredencialDoLink | null; vencido: boolean } {
  const hash = useSyncExternalStore(() => () => undefined, lerHash, () => "");
  useEffect(() => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  if (tokenHash) return { credencial: { tokenHash }, vencido: false };
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = p.get("access_token");
  return { credencial: accessToken ? { accessToken } : null, vencido: !accessToken && !!(p.get("error_code") || p.get("error")) };
}

export function FormSenhaNova({
  rota, credencial, vencido = false, textoBotao, aoConcluir,
}: {
  rota: "/v1/auth/criar-senha" | "/v1/auth/redefinir";
  credencial: CredencialDoLink | null;
  vencido?: boolean;
  textoBotao: string;
  aoConcluir: ReactNode;
}) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [diferentes, setDiferentes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  if (vencido) {
    return <Aviso tom="erro" titulo="Link vencido ou já usado">Este link não vale mais. Peça um novo em Esqueci a senha.</Aviso>;
  }
  if (!credencial) {
    return <Aviso tom="erro" titulo="Link incompleto">Abra o link do e-mail de novo, do jeito que chegou. Se ele venceu, peça um novo.</Aviso>;
  }
  if (pronto) return <>{aoConcluir}</>;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setDiferentes(senha !== confirmacao);
    if (senha !== confirmacao) return;
    setEnviando(true);
    const r = await chamarApi(rota, { corpo: { ...credencial, novaSenha: senha } });
    setEnviando(false);
    if (r.ok) setPronto(true);
    else setErro(r.erro);
  }

  const erroSenha = camposComErro(erro).includes("novaSenha") || erro?.codigo === "PASSWORD_WEAK"
    ? "Use 12 caracteres ou mais, sem sequências comuns."
    : null;

  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      <CampoTexto id="senha" rotulo="Senha nova" type="password" autoComplete="new-password" required minLength={12}
        value={senha} onChange={(e) => setSenha(e.target.value)} ajuda="12 caracteres ou mais. Uma frase fácil de lembrar funciona bem." erro={erroSenha} />
      <CampoTexto id="confirmacao" rotulo="Repita a senha" type="password" autoComplete="new-password" required
        value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} erro={diferentes ? "As duas senhas não são iguais." : null} />
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</Botao>
    </form>
  );
}
