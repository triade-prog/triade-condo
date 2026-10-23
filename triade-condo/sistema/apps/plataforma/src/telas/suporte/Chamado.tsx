"use client";
// O chamado de suporte (DC15, telas-modelo suporte-chamado-*; PI-20; decisão C.1 de 23/10/2026): a
// conversa em bolhas, como a do WhatsApp (o condomínio à direita, a TRÍADE à esquerda), a faixa
// quando a TRÍADE espera a resposta, Resolveu como botão principal e, embaixo, a caixa de resposta
// com o modelo de anexar. Resolvido há até 7 dias reabre ao responder. O chamado de mudança (0286)
// troca os dados do chamado pelo cartão "Mudança pedida", com a parte, o valor de hoje e o caminho
// para a Configuração; nele, Resolveu fica com borda, porque quem resolve é a TRÍADE.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AREAS_CHAMADO, DIAS_REABRIR_CHAMADO, formatarDataHora, nomeDaParte, PARTES_MUDANCA, TIPOS_CHAMADO } from "@triade/domain";
import { PAGINAS_CONFIGURACAO } from "@triade/configuracoes";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Cartao, Dado } from "../Ficha.tsx";
import { useCarregar } from "../sessao.tsx";
import { Bolha, comDias } from "../whatsapp/ConversaWhatsapp.tsx";
import { CampoImagens, enviarImagens } from "./imagens.tsx";
import { ICONE_TIPO, SeloChamado, type DetalheChamado } from "./comum.tsx";

const hora = (iso: string) => formatarDataHora(iso).slice(-5);

export function Chamado({ id, falhouImagem }: { id: string; falhouImagem: boolean }) {
  const carga = useCarregar<DetalheChamado>(`/v1/condominio/chamados/${id}`);
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [anexar, setAnexar] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<{ tom: "ok" | "atencao"; texto: string } | null>(falhouImagem
    ? { tom: "atencao", texto: "O chamado foi aberto, mas alguma imagem não passou na conferência." } : null);
  const voltar = (
    <Link href="/suporte" className="inline-flex items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Voltar aos chamados
    </Link>
  );

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o chamado…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const c = carga.dados;

  async function responder(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ reaberto: boolean }>(`/v1/condominio/chamados/${id}/responder`, { corpo: { texto } });
    if (!r.ok) {
      setEnviando(false);
      return setErro(r.erro);
    }
    const problemas = imagens.length ? await enviarImagens(id, imagens) : [];
    setEnviando(false);
    setTexto("");
    setImagens([]);
    setAnexar(false);
    setRecado(problemas.length ? { tom: "atencao", texto: `Resposta enviada. ${problemas.join(" ")}` }
      : { tom: "ok", texto: r.dados.reaberto ? "Resposta enviada. O chamado voltou a abrir." : "Resposta enviada." });
    carga.recarregar();
  }

  async function resolver() {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/chamados/${id}/resolver`, { corpo: {} });
    if (!r.ok) return setErro(r.erro);
    setRecado({ tom: "ok", texto: "Obrigado. O chamado ficou resolvido." });
    carga.recarregar();
  }

  async function abrirImagem(arquivo: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/chamados/${id}/imagens/${arquivo}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  const ultimaTriade = [...c.mensagens].reverse().find((m) => m.lado === "TRIADE");
  const mudanca = c.tipo === "MUDANCA" && c.parte ? c.parte : null;
  const pagina = mudanca ? (PARTES_MUDANCA as Record<string, { pagina: keyof typeof PAGINAS_CONFIGURACAO }>)[mudanca]?.pagina : undefined;
  const resolveu = c.pode.resolver
    ? <Botao variante={mudanca ? "contorno" : "primario"} onClick={() => void resolver()}><Icone nome="check" />Resolveu</Botao> : null;
  const agora = new Date().toISOString();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 max-md:pb-24">
      <header className="grid gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-5">
        {voltar}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-5 max-md:gap-4">
            <span className="ladrilho h-16 w-16 shrink-0 rounded-[18px] max-md:hidden" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_TIPO[c.tipo] ?? "balao"} className="h-7 w-7" /></span>
            <div className="grid min-w-0 flex-1 gap-2">
              <p className="flex flex-wrap items-center gap-2"><SeloChamado situacao={c.situacao} /><Selo tom="neutro">{TIPOS_CHAMADO[c.tipo]}</Selo></p>
              <h1 className="t-titulo-ficha [overflow-wrap:anywhere]">{c.titulo}</h1>
              <p className="t-apoio">Chamado {c.numero} · {AREAS_CHAMADO[c.area]} · aberto por {c.abertoPor} em {formatarDataHora(c.criadoEm)}</p>
            </div>
          </div>
          {resolveu ? <div className="max-md:hidden">{resolveu}</div> : null}
        </div>
      </header>
      {recado ? <Aviso tom={recado.tom} papel="status">{recado.texto}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {c.situacao === "ESPERANDO_CLIENTE" ? (
        <Aviso tom="atencao" titulo="A TRÍADE espera a sua resposta">
          {ultimaTriade ? `${ultimaTriade.autor} escreveu em ${formatarDataHora(ultimaTriade.criadoEm)}.` : null} Se já resolveu, toque em Resolveu.
        </Aviso>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <Cartao id="t-conversa" titulo="Conversa" icone="balao">
          <ol aria-label="Conversa" className="grid gap-3">
            {comDias(c.mensagens, (m) => m.criadoEm, agora, (m) => (
              <Bolha key={m.id} lado={m.lado === "TRIADE" ? "MORADOR" : "CONDOMINIO"}
                rodape={<span>{m.autor}{m.lado === "TRIADE" ? " · TRÍADE" : ""} · {hora(m.criadoEm)}</span>}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
              </Bolha>
            ))}
          </ol>
          {c.arquivos.length ? (
            <section aria-label="Imagens do chamado" className="grid gap-2 border-t border-linha pt-3">
              <span className="t-rotulo">Imagens</span>
              <ul className="flex flex-wrap gap-2">
                {c.arquivos.map((a) => (
                  <li key={a.id}>
                    {a.situacao === "LIBERADO"
                      ? <Botao variante="contorno" tamanho="m" onClick={() => void abrirImagem(a.id)}><Icone nome="camera" />Abrir {a.nome}</Botao>
                      : <span className="text-xs text-erro">{a.nome}: {a.motivoRecusa ?? "não liberada"}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {c.pode.responder ? (
            <form onSubmit={responder} noValidate className="grid gap-3 rounded-[16px] border border-linha bg-superficie p-4">
              <CampoAreaTexto id="cha-resposta" rotulo="Responder" maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
                erro={camposComErro(erro).includes("texto") ? "Escreva a resposta." : null} />
              {anexar && c.pode.enviarImagem ? <CampoImagens id="cha-resposta-imagens" imagens={imagens} mudar={setImagens} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {c.pode.enviarImagem && !anexar ? <Botao variante="discreto" tamanho="m" onClick={() => setAnexar(true)}><Icone nome="clipe" />Anexar imagem</Botao> : <span />}
                <Botao type="submit" variante="contorno" tamanho="m" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Enviar resposta"}</Botao>
              </div>
            </form>
          ) : (
            <Aviso tom="neutro">Este chamado foi resolvido há mais de {DIAS_REABRIR_CHAMADO} dias. Se o problema voltou, abra outro chamado.</Aviso>
          )}
        </Cartao>
        {mudanca ? (
          <Cartao id="t-mudanca-pedida" titulo="Mudança pedida" icone="trocar">
            <div>
              <Dado icone="ajuste" nome="Parte">{nomeDaParte(mudanca)}</Dado>
              <Dado icone="relogio" nome="Como está hoje">{c.hoje}</Dado>
              <Dado icone="pessoa" nome="Pedida por">{c.abertoPor}</Dado>
              {c.resolvidoEm ? <Dado icone="check" nome="Resolvido em">{formatarDataHora(c.resolvidoEm)}</Dado> : null}
            </div>
            {pagina ? (
              <Link href={`/configuracoes/${pagina}`} className="inline-flex items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
                Ver em Configurações › {PAGINAS_CONFIGURACAO[pagina].nome}<Icone nome="dir" className="h-4 w-4" />
              </Link>
            ) : null}
          </Cartao>
        ) : (
        <Cartao id="t-dados-chamado" titulo="Dados do chamado" icone="lista">
          <div>
            <Dado icone={ICONE_TIPO[c.tipo] ?? "balao"} nome="Tipo">{TIPOS_CHAMADO[c.tipo]}</Dado>
            <Dado icone="lista" nome="Onde no sistema">{AREAS_CHAMADO[c.area]}</Dado>
            <Dado icone="pessoa" nome="Aberto por">{c.abertoPor}</Dado>
            <Dado icone="relogio" nome="Aberto em">{formatarDataHora(c.criadoEm)}</Dado>
            {c.resolvidoEm ? <Dado icone="check" nome="Resolvido em">{formatarDataHora(c.resolvidoEm)}</Dado> : null}
          </div>
        </Cartao>
        )}
      </div>

      {resolveu ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 grid border-t border-linha bg-superficie/95 px-4 py-3 md:hidden">
          <Botao className="w-full" variante={mudanca ? "contorno" : "primario"} onClick={() => void resolver()}><Icone nome="check" />Resolveu</Botao>
        </div>
      ) : null}
    </div>
  );
}
