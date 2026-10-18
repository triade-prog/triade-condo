"use client";
// Aba Síndico (CF-02): quem é síndico deste condomínio e o convite. Conta nova recebe o
// link para criar a senha; quem já tem conta (MU-04) só ganha o acesso. A troca de síndico
// (CT-01, peça R4) sai daqui, com o registro das trocas já feitas.

import { useState, type FormEvent } from "react";
import { CANAIS_SUPORTE, formatarData, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO } from "@triade/domain";
import { Aviso, Botao, CampoTexto, camposComErro, chamarApi, Dialogo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { TrocaSindico } from "./TrocaSindico.tsx";
import type { Ficha, PropsAba } from "./tipos.ts";

interface Troca {
  id: string;
  feitaEm: string;
  feitaPor: string;
  anterior: string;
  novo: string;
  pedidoPor: string;
  canal: keyof typeof CANAIS_SUPORTE;
  conferido: string[];
}

function Trocas({ condominio }: { condominio: string }) {
  const carga = useCarregar<{ trocas: Troca[] }>(`/v1/clientes/${condominio}/trocas`);
  if (carga.estado !== "pronto" || carga.dados.trocas.length === 0) return null;
  return (
    <section aria-labelledby="titulo-trocas" className="grid gap-2">
      <h3 id="titulo-trocas" className="font-medium">Trocas de síndico</h3>
      <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie text-sm">
        {carga.dados.trocas.map((t) => (
          <li key={t.id} className="grid gap-0.5 px-4 py-3">
            <span><span className="font-medium">{t.anterior}</span> → <span className="font-medium">{t.novo}</span> · {formatarData(t.feitaEm)} por {t.feitaPor}</span>
            <span className="text-xs text-tinta-suave">Pedido de {t.pedidoPor} por {CANAIS_SUPORTE[t.canal] ?? t.canal}. Conferido: {t.conferido.join("; ")}.</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AbaSindico({ ficha, pode, recarregar, avisar }: PropsAba) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const podeConvidar = pode("console.sindicos.convidar");
  const podeTrocar = pode("console.troca.fazer");
  const [trocando, setTrocando] = useState<Ficha["sindicos"][number] | null>(null);

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
            <li key={s.vinculoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium">{s.nome}</span>
                <span className="block text-sm text-tinta-suave">Síndico desde {formatarData(s.desde)}</span>
              </span>
              {podeTrocar ? <Botao variante="contorno" tamanho="m" onClick={() => setTrocando(s)}>Trocar síndico</Botao> : null}
            </li>
          ))}
        </ul>
      )}

      <Trocas condominio={ficha.condominio.id} />
      {trocando ? (
        <TrocaSindico ficha={ficha} sindico={trocando} aoFechar={() => setTrocando(null)} aoTrocar={(r) => {
          setTrocando(null);
          const revisar = r.autorizados.length ? ` Reveja com o novo síndico as pessoas autorizadas: ${r.autorizados.map((a) => a.nome).join(", ")}.` : "";
          avisar({ tom: "ok", texto: `Síndico trocado. ${r.contaNova ? TEXTO_CONVITE_ENVIADO : TEXTO_CONVITE_CONTA_EXISTENTE}${revisar}` });
          recarregar();
        }} />
      ) : null}

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
