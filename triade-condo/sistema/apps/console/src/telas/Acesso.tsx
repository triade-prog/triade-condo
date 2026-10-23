"use client";
// Recuperar a senha (resposta neutra, PT-08) e criar a senha pelo link do e-mail (redefinir
// ou convite, CF-02).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, CampoTexto, chamarApi, FormSenhaNova, textoDoErro, useCredencialDoLink, type ErroApi } from "@triade/ui";

export function Recuperar() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const r = await chamarApi<{ mensagem: string }>("/v1/auth/recuperar", { corpo: { email } });
    if (r.ok) setMensagem(r.dados.mensagem);
    else setErro(r.erro);
  }

  if (mensagem) {
    return (
      <div className="grid gap-4">
        <Aviso tom="info">{mensagem}</Aviso>
        <Link href="/entrar" className="t-texto font-medium text-violeta-600 hover:underline">Voltar para entrar</Link>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className="grid gap-4">
      <p className="text-tinta-suave">Digite o e-mail da sua conta. Se ele tiver acesso, enviamos um link para criar uma senha nova.</p>
      {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
      <CampoTexto id="email" rotulo="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Botao type="submit">Enviar link</Botao>
      <Link href="/entrar" className="justify-self-center t-texto font-medium text-violeta-600 hover:underline">Voltar para entrar</Link>
    </form>
  );
}

export function SenhaPeloLink({ tipo }: { tipo: "redefinir" | "convite" }) {
  const { credencial, vencido } = useCredencialDoLink(useSearchParams().get("token_hash"));
  return (
    <FormSenhaNova
      rota={tipo === "convite" ? "/v1/auth/criar-senha" : "/v1/auth/redefinir"}
      credencial={credencial}
      vencido={vencido}
      textoBotao={tipo === "convite" ? "Criar senha" : "Salvar senha nova"}
      aoConcluir={
        <div className="grid gap-4">
          <Aviso tom="ok">
            {tipo === "convite"
              ? "Senha criada. Agora entre com o seu e-mail e a senha; no primeiro acesso, você cadastra o aplicativo autenticador."
              : "Senha nova salva. Por segurança, todas as sessões abertas foram encerradas."}
          </Aviso>
          <Link href="/entrar" className="t-texto font-medium text-violeta-600 hover:underline">Entrar no Console</Link>
        </div>
      }
    />
  );
}
