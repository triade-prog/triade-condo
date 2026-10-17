"use client";
// Aba Síndico (CF-02): quem é síndico deste condomínio e o convite. Conta nova recebe o
// link para criar a senha; quem já tem conta (MU-04) só ganha o acesso.

import { useState, type FormEvent } from "react";
import { formatarData, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO } from "@triade/domain";
import { Aviso, Botao, CampoTexto, camposComErro, chamarApi, Dialogo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import type { PropsAba } from "./tipos.ts";

export function AbaSindico({ ficha, pode, recarregar, avisar }: PropsAba) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const podeConvidar = pode("console.sindicos.convidar");

  function abrir() {
    setNome("");
    setEmail("");
    setErro(null);
    setAberto(true);
  }

  async function convidar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ contaNova: boolean }>(`/v1/clientes/${ficha.condominio.id}/sindicos`, { corpo: { nome, email } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setAberto(false);
    avisar({ tom: "ok", texto: r.dados.contaNova ? TEXTO_CONVITE_ENVIADO : TEXTO_CONVITE_CONTA_EXISTENTE });
    recarregar();
  }

  const campos = camposComErro(erro);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Síndico</h2>
        {podeConvidar ? <Botao onClick={abrir}>Convidar síndico</Botao> : null}
      </div>
      {ficha.sindicos.length === 0 ? (
        <Vazio titulo="Nenhum síndico convidado ainda">A implantação só conclui depois do convite. Cada pessoa tem o seu acesso; nada de conta compartilhada.</Vazio>
      ) : (
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
          {ficha.sindicos.map((s) => (
            <li key={s.vinculoId} className="flex flex-wrap justify-between gap-2 px-4 py-3">
              <span className="font-medium">{s.nome}</span>
              <span className="text-sm text-tinta-suave">Síndico desde {formatarData(s.desde)}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialogo aberto={aberto} titulo="Convidar síndico" aoFechar={() => setAberto(false)}>
        <form onSubmit={convidar} noValidate className="grid gap-4">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <CampoTexto id="s-nome" rotulo="Nome" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
            erro={campos.includes("nome") ? "Escreva o nome da pessoa." : null} />
          <CampoTexto id="s-email" rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            erro={campos.includes("email") ? "Confira o e-mail." : null} />
          <p className="text-sm text-tinta-suave">
            A pessoa recebe um e-mail para criar a própria senha. O link só pode ser usado uma vez. Se ela já tiver conta, o condomínio aparece no próximo acesso.
          </p>
          <div className="flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar convite"}</Botao>
          </div>
        </form>
      </Dialogo>
    </div>
  );
}
