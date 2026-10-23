"use client";
// Comunicados pelo WhatsApp do condomínio (design "Comunicado pelo WhatsApp", tela 4; CD-11, W-20,
// CF-11): o cartão de Configurações › Comunicados (antes em WhatsApp) que liga e desliga, conta quem aceitou por telefone
// e dá o convite pronto para o grupo do prédio, com o cartaz de QR. Quem aceita é sempre o morador,
// do próprio celular: aqui ninguém marca o aceite. Fica só no app (o Console não liga). A chave
// entra na barra de salvar da página, como as outras mudanças (D4.15).

import Link from "next/link";
import { useState } from "react";
import { formatarData } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { naBase, useCarregar } from "./contexto.tsx";
import { useParte } from "./salvar.tsx";
import type { ComunicadosWhatsapp } from "./tipos.ts";

export function CartaoComunicadosWhatsapp() {
  const carga = useCarregar<ComunicadosWhatsapp>(naBase("/whatsapp/comunicados"));
  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo os comunicados pelo WhatsApp…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return <Cartao key={carga.dados.versao} d={carga.dados} recarregar={carga.recarregar} />;
}

function Cartao({ d, recarregar }: { d: ComunicadosWhatsapp; recarregar: () => void }) {
  const [ligado, setLigado] = useState(d.ligado);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [copiado, setCopiado] = useState(false);
  const n = d.contagens;

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi<{ versao: number }>(naBase("/whatsapp/comunicados"), { metodo: "PUT", corpo: { versao: d.versao, ligado } });
    if (!r.ok) { setErro(r.erro); return null; }
    return ligado ? "Comunicados pelo WhatsApp ligados." : "Comunicados pelo WhatsApp desligados. O que estava na fila foi cancelado.";
  }
  useParte("comunicados-whatsapp", { nome: "Comunicados pelo WhatsApp", mudancas: ligado !== d.ligado ? 1 : 0, salvar });

  async function copiar() {
    if (!d.convite) return;
    await navigator.clipboard?.writeText(d.convite).catch(() => {});
    setCopiado(true);
  }

  const semNumero = !d.conectado && !d.ligado;
  return (
    <section aria-labelledby="t-cw" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-cw" className="t-titulo-secao font-medium">Comunicados pelo WhatsApp</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <label htmlFor="cw-ligado" className="flex items-start gap-3 t-texto">
        <input id="cw-ligado" type="checkbox" role="switch" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={ligado}
          disabled={!d.pode.editar || semNumero} onChange={(e) => setLigado(e.target.checked)} />
        <span className="grid gap-0.5"><span className="font-medium">Mandar comunicados pelo WhatsApp do condomínio</span>
          <span className="t-apoio text-tinta-suave">
            {semNumero ? "Conecte o WhatsApp do condomínio para usar."
              : <>Só para quem aceitou.{d.mudadoEm ? ` ${d.ligado ? "Ligado" : "Desligado"} desde ${formatarData(d.mudadoEm)}${d.mudadoPor ? `, por ${d.mudadoPor}` : ""}.` : ""}</>}
          </span></span>
      </label>
      {ligado && !d.ligado ? <p className="t-apoio text-tinta-suave">Liga ao salvar a página.</p> : null}
      {!ligado && d.ligado ? <p className="t-apoio text-tinta-suave">Desliga ao salvar a página; o que estiver na fila é cancelado.</p> : null}
      {d.ligado && !d.conectado ? <Aviso tom="atencao">O número está desconectado. Nada sai até ele voltar; o que passar de 24 horas na fila é cancelado.</Aviso> : null}

      <ul className="grid grid-cols-2 gap-2 t-texto sm:grid-cols-4" aria-label="Respostas por telefone">
        {[[n.aceitaram, "aceitaram"], [n.recusaram, "disseram não"], [n.pararam, "pararam"], [n.semResposta, "ainda não responderam"]].map(([q, t]) => (
          <li key={t} className="grid rounded-xl border border-linha px-3 py-2"><span className="t-titulo-secao font-medium">{q}</span><span className="t-apoio text-tinta-suave">{t}</span></li>
        ))}
      </ul>

      {d.convite && d.numero ? (
        <div className="grid gap-2">
          <span className="t-texto font-medium">Convite para o grupo do prédio</span>
          <p className="rounded-xl border border-linha bg-superficie-2 px-3 py-2 t-texto break-words">{d.convite}</p>
          <span className="flex flex-wrap gap-2">
            <Botao variante="contorno" tamanho="m" onClick={() => void copiar()}><Icone nome="copiar" />{copiado ? "Convite copiado" : "Copiar o convite"}</Botao>
            <Link href="/mural/cartaz-whatsapp" target="_blank" className={classeBotao("contorno", "", "m")}><Icone nome="imprimir" />Cartaz com QR</Link>
          </span>
          <span className="t-apoio text-tinta-suave">
            O convite só abre a conversa. Quem recebe os comunicados é quem manda COMUNICADOS do próprio celular e está no cadastro.
          </span>
        </div>
      ) : null}
      <p className="t-apoio text-tinta-suave">
        As mensagens saem {d.porMinuto} por minuto, para não parecer disparo em massa. O horário sem envio ({d.silencio.inicio} às {d.silencio.fim}) é o mesmo do
        e-mail, na parte 3 desta página.
        Desligar cancela o que está na fila; os aceites ficam guardados.
      </p>
    </section>
  );
}
