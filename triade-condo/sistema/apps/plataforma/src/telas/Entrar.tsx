"use client";
// Entrar na Plataforma (PT-08): e-mail e senha. O autenticador é opcional para o síndico;
// quem cadastrou um digita o código em toda sessão.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, CampoTexto, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";

export function Entrar() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"SENHA" | "CODIGO">("SENHA");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarSenha(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ etapa: "CODIGO" | "PRONTO" }>("/v1/auth/entrar", { corpo: { email, senha } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setSenha("");
    if (r.dados.etapa === "PRONTO") return router.replace("/");
    setEtapa("CODIGO");
  }

  async function enviarCodigo(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/auth/autenticador/verificar", { corpo: { codigo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    router.replace("/");
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-[28px] font-normal tracking-tight">Entrar na Plataforma</h1>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      {etapa === "SENHA" ? (
        <form onSubmit={enviarSenha} className="grid gap-4">
          <CampoTexto id="email" rotulo="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <CampoTexto id="senha" rotulo="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Botao type="submit" disabled={enviando}>{enviando ? "Conferindo…" : "Entrar"}</Botao>
          <Link href="/recuperar" className="justify-self-center text-sm font-medium text-acao hover:underline">Esqueci a senha</Link>
          <p className="text-xs text-tinta-suave">Morador não precisa de senha: fala com o condomínio pelo WhatsApp.</p>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className="grid gap-4">
          <p>Abra o aplicativo autenticador e digite o código de 6 números da TRÍADE.</p>
          <CampoTexto id="codigo" rotulo="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          <Botao type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? "Conferindo…" : "Confirmar código"}</Botao>
        </form>
      )}
    </div>
  );
}
