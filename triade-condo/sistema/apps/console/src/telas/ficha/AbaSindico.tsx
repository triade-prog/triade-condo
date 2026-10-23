"use client";
// O síndico na parte Pessoas da ficha (CF-02; DC15, tela-modelo console-ficha-pessoas-computador,
// rodada Console de 23/10/2026): quem é síndico deste condomínio e o convite, o botão principal
// enquanto não há síndico. Conta nova recebe o link para criar a senha; quem já tem conta (MU-04)
// só ganha o acesso. A troca de síndico (CT-01, peça R4) sai daqui, com o registro das trocas.

import { useState, type FormEvent } from "react";
import { CANAIS_SUPORTE, formatarData, TEXTO_CONVITE_CONTA_EXISTENTE, TEXTO_CONVITE_ENVIADO } from "@triade/domain";
import { Aviso, Botao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Iniciais, textoDoErro, type ErroApi } from "@triade/ui";
import { AcaoCartao, Cartao } from "../comum.tsx";
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
    <section aria-labelledby="titulo-trocas" className="grid gap-2 border-t border-linha pt-3">
      <h3 id="titulo-trocas" className="t-rotulo">Trocas de síndico</h3>
      <ul className="divide-y divide-linha text-sm">
        {carga.dados.trocas.map((t) => (
          <li key={t.id} className="grid gap-0.5 py-2.5">
            <span><span className="font-medium">{t.anterior}</span> → <span className="font-medium">{t.novo}</span> · {formatarData(t.feitaEm)} por {t.feitaPor}</span>
            <span className="text-xs text-tinta-suave">Pedido de {t.pedidoPor} por {CANAIS_SUPORTE[t.canal] ?? t.canal}. Conferido: {t.conferido.join("; ")}.</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CartaoSindico({ ficha, pode, recarregar, avisar, pedido }: PropsAba) {
  const [aberto, setAberto] = useState(pedido === "convidar" && pode("console.sindicos.convidar"));
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
  const nenhum = ficha.sindicos.length === 0;
  return (
    <Cartao id="t-sindico" titulo="Síndico" icone="pessoa"
      acao={podeConvidar && !nenhum ? <AcaoCartao icone="mais" aoClicar={abrir}>Convidar síndico</AcaoCartao> : undefined}>
      {nenhum ? (
        <div className="grid justify-items-start gap-2.5 py-1">
          <span className="ladrilho h-11 w-11 rounded-xl" data-tom="atencao" aria-hidden="true"><Icone nome="pessoa" /></span>
          <p className="font-semibold">Nenhum síndico convidado ainda</p>
          <p className="t-apoio">A implantação só se conclui depois do convite. Cada pessoa tem o seu acesso; nada de conta compartilhada.</p>
          {podeConvidar ? <Botao tamanho="m" onClick={abrir}><Icone nome="mais" />Convidar síndico</Botao> : null}
        </div>
      ) : (
        <ul className="divide-y divide-linha">
          {ficha.sindicos.map((s) => (
            <li key={s.vinculoId} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
              <Iniciais nome={s.nome} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{s.nome}</span>
                <span className="t-apoio">Síndico desde {formatarData(s.desde)}</span>
              </span>
              {podeTrocar ? <Botao variante="contorno" tamanho="m" onClick={() => setTrocando(s)}><Icone nome="trocar" />Trocar síndico</Botao> : null}
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
    </Cartao>
  );
}
