"use client";
// Comunicados pelo WhatsApp do condomínio (design "Comunicado pelo WhatsApp", tela 4; CD-11, W-20,
// CF-11): o cartão de Configurações › Comunicados (antes em WhatsApp) que liga e desliga, conta quem aceitou por telefone
// e dá o convite pronto para o grupo do prédio, com o cartaz de QR. Quem aceita é sempre o morador,
// do próprio celular: aqui ninguém marca o aceite. Fica só no app (o Console não liga).

import Link from "next/link";
import { useState } from "react";
import { formatarData } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { naBase, useCarregar } from "./contexto.tsx";
import type { ComunicadosWhatsapp } from "./tipos.ts";

export function CartaoComunicadosWhatsapp({ aoSalvar }: { aoSalvar: (texto: string) => void }) {
  const carga = useCarregar<ComunicadosWhatsapp>(naBase("/whatsapp/comunicados"));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo os comunicados pelo WhatsApp…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const n = d.contagens;

  async function mudar(ligado: boolean) {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ versao: number }>(naBase("/whatsapp/comunicados"), { metodo: "PUT", corpo: { versao: d.versao, ligado } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
    aoSalvar(ligado ? "Comunicados pelo WhatsApp ligados." : "Comunicados pelo WhatsApp desligados. O que estava na fila foi cancelado.");
  }

  async function copiar() {
    if (!d.convite) return;
    await navigator.clipboard?.writeText(d.convite).catch(() => {});
    setCopiado(true);
  }

  const semNumero = !d.conectado && !d.ligado;
  return (
    <section aria-labelledby="t-cw" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-cw" className="text-lg font-medium">Comunicados pelo WhatsApp</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}
      <label htmlFor="cw-ligado" className="flex items-start gap-3 text-sm">
        <input id="cw-ligado" type="checkbox" role="switch" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={d.ligado}
          disabled={!d.pode.editar || enviando || semNumero} onChange={(e) => void mudar(e.target.checked)} />
        <span className="grid gap-0.5"><span className="font-medium">Mandar comunicados pelo WhatsApp do condomínio</span>
          <span className="text-[13px] text-tinta-suave">
            {semNumero ? "Conecte o WhatsApp do condomínio para usar."
              : <>Só para quem aceitou.{d.mudadoEm ? ` ${d.ligado ? "Ligado" : "Desligado"} desde ${formatarData(d.mudadoEm)}${d.mudadoPor ? `, por ${d.mudadoPor}` : ""}.` : ""}</>}
          </span></span>
      </label>
      {d.ligado && !d.conectado ? <Aviso tom="atencao">O número está desconectado. Nada sai até ele voltar; o que passar de 24 horas na fila é cancelado.</Aviso> : null}

      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-label="Respostas por telefone">
        {[[n.aceitaram, "aceitaram"], [n.recusaram, "disseram não"], [n.pararam, "pararam"], [n.semResposta, "ainda não responderam"]].map(([q, t]) => (
          <li key={t} className="grid rounded-xl border border-linha px-3 py-2"><span className="text-xl font-medium">{q}</span><span className="text-xs text-tinta-suave">{t}</span></li>
        ))}
      </ul>

      {d.convite && d.numero ? (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Convite para o grupo do prédio</span>
          <p className="rounded-xl border border-linha bg-superficie-2 px-3 py-2 text-sm break-words">{d.convite}</p>
          <span className="flex flex-wrap gap-2">
            <Botao variante="contorno" tamanho="m" onClick={() => void copiar()}><Icone nome="copiar" />{copiado ? "Convite copiado" : "Copiar o convite"}</Botao>
            <Link href="/mural/cartaz-whatsapp" target="_blank" className={classeBotao("contorno", "", "m")}><Icone nome="imprimir" />Cartaz com QR</Link>
          </span>
          <span className="text-[13px] text-tinta-suave">
            O convite só abre a conversa. Quem recebe os comunicados é quem manda COMUNICADOS do próprio celular e está no cadastro.
          </span>
        </div>
      ) : null}
      <p className="text-xs text-tinta-suave">
        As mensagens saem {d.porMinuto} por minuto, para não parecer disparo em massa. O horário sem envio ({d.silencio.inicio} às {d.silencio.fim}) é o mesmo do
        e-mail, na parte 3 desta página.
        Desligar cancela o que está na fila; os aceites ficam guardados.
      </p>
    </section>
  );
}
