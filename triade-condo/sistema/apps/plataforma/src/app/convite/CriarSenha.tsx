"use client";
// Síndico convidado cria a própria senha pelo link do e-mail (CF-02).

import { useSearchParams } from "next/navigation";
import { Aviso, FormSenhaNova } from "@triade/ui";

export function CriarSenha() {
  const token = useSearchParams().get("token_hash");
  return (
    <FormSenhaNova
      rota="/v1/auth/criar-senha"
      tokenHash={token}
      textoBotao="Criar senha"
      aoConcluir={<Aviso tom="ok">Senha criada. Use o seu e-mail e esta senha para entrar no painel do síndico.</Aviso>}
    />
  );
}
