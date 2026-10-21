"use client";
// Queda do WhatsApp (F5.10; W-17), telas 6 e 7 do desenho "Garagens, prestador reserva e queda do
// WhatsApp": quando o número cai, abre uma queda com quem cuida dela. Quem cuida escreve o canal
// alternativo, que aparece nas etiquetas e no mural enquanto durar, e pode avisar os moradores por
// comunicado (nada é publicado sem a pessoa). Quando o número volta, nada do que estava na fila sai
// sozinho: quem cuida decide cada mensagem, e a queda só se encerra com tudo decidido e um resumo.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DECISOES_QUEDA, descreverEventoQueda, ESTADOS_ENVIO_WHATSAPP, ESTADOS_QUEDA, FINALIDADES_ENVIO, ORIGENS_QUEDA, type DecisaoQueda } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi,
} from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { EnvioDaQueda, QuedaWhatsapp } from "../tipos.ts";

const BASE = "/v1/condominio/whatsapp/quedas";

/** "6 h 28 min". */
export function duracao(de: string, ate: string): string {
  const min = Math.max(0, Math.round((Date.parse(ate) - Date.parse(de)) / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`;
}

function quantas(n: number, uma: string, varias: string): string {
  return n === 1 ? `1 ${uma}` : `${n} ${varias}`;
}

/** A faixa no alto da tela do WhatsApp enquanto há queda aberta. */
export function FaixaQueda({ q }: { q: QuedaWhatsapp }) {
  if (q.estado === "CONFERINDO") {
    return (
      <Aviso tom="atencao" titulo={`O número voltou${q.voltouEm ? ` às ${diaHora(q.voltouEm).slice(-5)}` : ""}`}>
        Confira o que ficou parado antes de encerrar a queda. Nada do que estava na fila sai sozinho.
      </Aviso>
    );
  }
  return (
    <Aviso tom="erro" titulo={`WhatsApp fora do ar desde ${diaHora(q.inicio)}`}>
      {q.responsavel ? `${q.responsavel} cuida da queda. ` : ""}
      {q.canalAlternativo
        ? <>Enquanto isso, as etiquetas e o mural mostram: “{q.canalAlternativo}”</>
        : "Escreva o canal alternativo na aba Quedas para os moradores saberem por onde falar."}
    </Aviso>
  );
}

function textoComunicado(q: QuedaWhatsapp): { titulo: string; texto: string } {
  return {
    titulo: "WhatsApp do condomínio fora do ar",
    texto: `O WhatsApp do condomínio está fora do ar desde ${diaHora(q.inicio)}.\n\nEnquanto isso: ${q.canalAlternativo ?? ""}\n\nAvisamos aqui quando voltar.`,
  };
}

function ForaDoAr({ q, pode, aoMudar }: { q: QuedaWhatsapp; pode: boolean; aoMudar: (texto: string) => void }) {
  const [canal, setCanal] = useState(q.canalAlternativo ?? "");
  const [oQue, setOQue] = useState(q.oQueAconteceu ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [voltou, setVoltou] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`${BASE}/${q.id}`, { metodo: "PUT", corpo: { versao: q.versao, canalAlternativo: canal, oQueAconteceu: oQue } });
    if (!r.ok) return setErro(r.erro);
    aoMudar(canal.trim() ? "Queda salva. As etiquetas e o mural já mostram o canal alternativo." : "Queda salva.");
  }

  const comunicado = q.canalAlternativo ? textoComunicado(q) : null;
  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-tinta-suave">Começou</dt><dd>{diaHora(q.inicio)} · {q.origem === "PROVEDOR" ? "o provedor avisou" : `aberta à mão${q.abertaPor ? ` por ${q.abertaPor}` : ""}`}</dd></div>
        <div><dt className="text-tinta-suave">Quem cuida</dt><dd>{q.responsavel ?? "O síndico"}</dd></div>
        <div><dt className="text-tinta-suave">Mensagens paradas</dt><dd>{quantas(q.faltam, "na fila", "na fila")}</dd></div>
      </dl>
      <CampoAreaTexto id="q-canal" rotulo="Canal alternativo (aparece nas etiquetas e no mural)" rows={2} maxLength={300} value={canal} disabled={!pode}
        onChange={(e) => setCanal(e.target.value)} placeholder="Ligue para a portaria, (61) 3333-0000, das 7h às 22h."
        erro={comErro.includes("canalAlternativo") ? "De 5 a 300 caracteres." : null} />
      <CampoAreaTexto id="q-oque" rotulo="O que aconteceu" opcional rows={2} maxLength={1000} value={oQue} disabled={!pode}
        onChange={(e) => setOQue(e.target.value)} ajuda="Para o registro. Quem cuida escreve e completa depois."
        erro={comErro.includes("oQueAconteceu") ? "De 3 a 1.000 caracteres." : null} />
      {pode ? (
        <div className="flex flex-wrap justify-end gap-2">
          {q.origem === "MANUAL" ? <Botao variante="discreto" onClick={() => setVoltou(true)}>O número voltou</Botao> : null}
          {comunicado ? (
            <Link href={`/comunicados/escrever?titulo=${encodeURIComponent(comunicado.titulo)}&texto=${encodeURIComponent(comunicado.texto)}`}
              className={classeBotao("contorno")}>Avisar os moradores por comunicado</Link>
          ) : null}
          <Botao type="submit">Salvar</Botao>
        </div>
      ) : null}
      <p className="text-xs text-tinta-suave">
        {comunicado ? "O comunicado já vem escrito com o canal alternativo e sai pelo mural e pelo e-mail de quem confirmou o e-mail. Nada é mandado sem a pessoa publicar."
          : "Salve o canal alternativo para avisar os moradores por comunicado."}
        {q.origem === "PROVEDOR" ? " A queda passa para a conferência sozinha quando o número reconectar." : ""}
      </p>
      {voltou ? (
        <Confirmar titulo="O número voltou" texto="A queda passa para a conferência. Só dá quando o número está conectado de novo." botao="O número voltou"
          aoFechar={() => setVoltou(false)} enviar={() => chamarApi(`${BASE}/${q.id}/voltou`, { corpo: {} })}
          aoConfirmar={() => { setVoltou(false); aoMudar("A queda passou para a conferência."); }} />
      ) : null}
    </form>
  );
}

function Confirmar({ titulo, texto, botao, aoFechar, enviar, aoConfirmar }: {
  titulo: string; texto: string; botao: string; aoFechar: () => void; enviar: () => Promise<{ ok: true } | { ok: false; erro: ErroApi }>; aoConfirmar: () => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      <div className="grid gap-3">
        <p className="text-sm">{texto}</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao disabled={enviando} onClick={async () => {
            setErro(null);
            setEnviando(true);
            const r = await enviar();
            setEnviando(false);
            if (!r.ok) return setErro(r.erro);
            aoConfirmar();
          }}>{botao}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function Decidir({ q, envios, decisao, aoFechar, aoDecidir }: {
  q: QuedaWhatsapp; envios: EnvioDaQueda[]; decisao: DecisaoQueda; aoFechar: () => void; aoDecidir: (texto: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ decididas: number }>(`${BASE}/${q.id}/conciliar`, { corpo: { envios: envios.map((e) => e.id), decisao, motivo: motivo || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoDecidir(`${DECISOES_QUEDA[decisao]}: ${quantas(r.dados.decididas, "mensagem", "mensagens")}.`);
  }
  const explica = {
    MANDAR: "Sai agora pelo número do condomínio. Resposta automática fora da conversa de 24 horas não sai: fica como não mandada.",
    OUTRO_CANAL: "A mensagem não sai. Diga por onde foi resolvido, para o registro.",
    NAO_MANDAR: "A mensagem não sai e fica no registro da queda.",
  }[decisao];
  return (
    <Dialogo aberto titulo={`${DECISOES_QUEDA[decisao]} · ${quantas(envios.length, "mensagem", "mensagens")}`} aoFechar={aoFechar}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="text-sm">{explica}</p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {decisao !== "MANDAR" ? (
          <CampoAreaTexto id="q-motivo" rotulo={decisao === "OUTRO_CANAL" ? "Por onde foi resolvido" : "Motivo"} opcional={decisao === "NAO_MANDAR"}
            rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={decisao === "OUTRO_CANAL" ? "Liguei para o morador e combinei a visita." : undefined}
            erro={comErro.includes("motivo") ? "De 3 a 300 caracteres." : null} />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : DECISOES_QUEDA[decisao]}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function situacaoDoEnvio(e: EnvioDaQueda): string {
  if (e.conciliacao) return DECISOES_QUEDA[e.conciliacao];
  const estado = ESTADOS_ENVIO_WHATSAPP[e.estado as keyof typeof ESTADOS_ENVIO_WHATSAPP] ?? e.estado;
  return e.automatica && e.estado === "CANCELADA" ? `${estado} · resposta automática vencida` : estado;
}

function ListaEnvios({ q, pode, aoMudar }: { q: QuedaWhatsapp; pode: boolean; aoMudar?: (texto: string) => void }) {
  const envios = q.envios ?? [];
  const paradas = envios.filter((e) => e.parada);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [decidir, setDecidir] = useState<{ envios: EnvioDaQueda[]; decisao: DecisaoQueda } | null>(null);
  const conferindo = q.estado === "CONFERINDO" && pode && aoMudar;
  const escolhidas = paradas.filter((e) => marcadas.includes(e.id));
  if (!envios.length) return <p className="text-sm text-tinta-suave">Nada ficou parado na fila durante esta queda.</p>;
  return (
    <div className="grid gap-2">
      {conferindo && paradas.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={escolhidas.length === paradas.length}
              onChange={(ev) => setMarcadas(ev.target.checked ? paradas.map((e) => e.id) : [])} />
            Todas as paradas
          </label>
          {escolhidas.length ? (Object.keys(DECISOES_QUEDA) as DecisaoQueda[]).map((d) => (
            <Botao key={d} variante={d === "MANDAR" ? "contorno" : "discreto"} tamanho="m" onClick={() => setDecidir({ envios: escolhidas, decisao: d })}>
              {DECISOES_QUEDA[d]} ({escolhidas.length})
            </Botao>
          )) : null}
        </div>
      ) : null}
      <ul className="grid gap-2">
        {envios.map((e) => (
          <li key={e.id} className={`grid gap-1.5 rounded-2xl border p-3 text-sm ${e.parada ? "border-atencao-borda bg-superficie" : "border-linha bg-superficie-2"}`}>
            <span className="flex flex-wrap items-center gap-2">
              {conferindo && e.parada && paradas.length > 1 ? (
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" aria-label={`Escolher a mensagem para ${e.para ?? "o destinatário"}`}
                  checked={marcadas.includes(e.id)} onChange={(ev) => setMarcadas(ev.target.checked ? [...marcadas, e.id] : marcadas.filter((x) => x !== e.id))} />
              ) : null}
              <strong className="font-semibold">
                {FINALIDADES_ENVIO[e.finalidade as keyof typeof FINALIDADES_ENVIO] ?? e.finalidade}{e.pedido ? ` do pedido ${e.pedido.protocolo}` : ""}
              </strong>
              {e.parada ? <Selo tom="atencao">Parada</Selo> : <Selo tom="neutro">{situacaoDoEnvio(e)}</Selo>}
            </span>
            <span className="text-tinta-suave">
              {[e.para, e.unidades, e.automatica ? `automática · ${diaHora(e.criadoEm)}` : `por ${e.por ?? "alguém da equipe"}, ${diaHora(e.criadoEm)}`].filter(Boolean).join(" · ")}
            </span>
            <span className="line-clamp-2 whitespace-pre-line break-words">“{e.texto}”</span>
            {e.conciliacao && (e.conciliacaoMotivo || e.conciliadaPor) ? (
              <span className="break-words text-tinta-suave">{[e.conciliacaoMotivo, e.conciliadaPor ? `decidido por ${e.conciliadaPor}` : null].filter(Boolean).join(" · ")}</span>
            ) : null}
            {conferindo && e.parada ? (
              <span className="flex flex-wrap gap-2">
                {(Object.keys(DECISOES_QUEDA) as DecisaoQueda[]).map((d) => (
                  <Botao key={d} variante={d === "MANDAR" ? "contorno" : "discreto"} tamanho="m" onClick={() => setDecidir({ envios: [e], decisao: d })}>{DECISOES_QUEDA[d]}</Botao>
                ))}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {decidir && aoMudar ? (
        <Decidir q={q} envios={decidir.envios} decisao={decidir.decisao} aoFechar={() => setDecidir(null)}
          aoDecidir={(t) => { setDecidir(null); setMarcadas([]); aoMudar(t); }} />
      ) : null}
    </div>
  );
}

function Conferindo({ q, pode, aoMudar }: { q: QuedaWhatsapp; pode: boolean; aoMudar: (texto: string) => void }) {
  const [resumo, setResumo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comErro = camposComErro(erro);
  async function encerrar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`${BASE}/${q.id}/encerrar`, { corpo: { versao: q.versao, resumo } });
    if (!r.ok) return setErro(r.erro);
    aoMudar("Queda encerrada. O canal alternativo saiu das etiquetas e do mural.");
  }
  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-tinta-suave">Fora do ar</dt><dd>{diaHora(q.inicio)} a {q.voltouEm ? `${diaHora(q.voltouEm).slice(-5)} (${duracao(q.inicio, q.voltouEm)})` : "agora"}</dd></div>
        <div><dt className="text-tinta-suave">Paradas na fila</dt><dd>{q.paradas}{q.faltam ? `, faltam ${q.faltam}` : ", todas decididas"}</dd></div>
        <div><dt className="text-tinta-suave">Chegaram atrasadas</dt><dd>{q.atrasadas}{q.atrasadas ? ", em A identificar" : ""}</dd></div>
      </dl>
      <ListaEnvios q={q} pode={pode} aoMudar={aoMudar} />
      {q.outroCanal ? (
        <p className="text-sm text-tinta-suave">Pedidos registrados por outro canal durante a queda: {q.outroCanal}. Ficam no resumo, sem nada a fazer.</p>
      ) : null}
      {pode ? (
        <form onSubmit={encerrar} noValidate className="grid gap-3">
          {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <CampoAreaTexto id="q-resumo" rotulo="O que foi feito (para encerrar)" rows={3} maxLength={2000} value={resumo} onChange={(e) => setResumo(e.target.value)}
            erro={comErro.includes("resumo") ? "Escreva de 10 a 2.000 caracteres." : null} />
          <div className="flex justify-end">
            <Botao type="submit" disabled={q.faltam > 0}>Encerrar a queda{q.faltam ? ` · faltam ${q.faltam}` : ""}</Botao>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Historico({ q }: { q: QuedaWhatsapp }) {
  if (!q.historico?.length) return null;
  return (
    <section aria-label="Histórico da queda" className="grid gap-2">
      <h3 className="text-base font-medium">Histórico da queda</h3>
      <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
        {q.historico.map((h, i) => (
          <li key={i} className="grid gap-0.5 px-4 py-2.5 text-sm">
            <span>{descreverEventoQueda(h.acao, h.dados) ?? h.acao}</span>
            <span className="text-xs text-tinta-suave">{h.autor ?? "Sistema"} · {diaHora(h.em)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuedaAberta({ q, pode, aoMudar }: { q: QuedaWhatsapp; pode: boolean; aoMudar: (texto: string) => void }) {
  return (
    <section aria-labelledby="t-queda" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-queda" className="flex flex-wrap items-center gap-2 text-lg font-medium">
        Queda de {diaHora(q.inicio).slice(0, 5)}
        <Selo tom={q.estado === "FORA_DO_AR" ? "erro" : "atencao"}>{q.estado === "FORA_DO_AR" ? "Fora do ar" : "Conferindo"}</Selo>
      </h2>
      {q.estado === "FORA_DO_AR"
        ? <ForaDoAr key={q.versao} q={q} pode={pode} aoMudar={aoMudar} />
        : <Conferindo key={q.versao} q={q} pode={pode} aoMudar={aoMudar} />}
      <Historico q={q} />
    </section>
  );
}

function VerQueda({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const carga = useCarregar<QuedaWhatsapp>(`${BASE}/${id}`);
  return (
    <Dialogo aberto titulo="Queda do WhatsApp" aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando /> : carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : (
        <div className="grid gap-3 text-sm">
          <p>
            {diaHora(carga.dados.inicio)} a {carga.dados.voltouEm ? `${diaHora(carga.dados.voltouEm)} (${duracao(carga.dados.inicio, carga.dados.voltouEm)})` : "sem volta registrada"}
            {" · "}{ORIGENS_QUEDA[carga.dados.origem]}{carga.dados.encerradaPor ? ` · encerrada por ${carga.dados.encerradaPor}` : ""}
          </p>
          {carga.dados.oQueAconteceu ? <p><span className="text-tinta-suave">O que aconteceu: </span>{carga.dados.oQueAconteceu}</p> : null}
          {carga.dados.resumo ? <p><span className="text-tinta-suave">O que foi feito: </span>{carga.dados.resumo}</p> : null}
          <ListaEnvios q={carga.dados} pode={false} />
          <Historico q={carga.dados} />
          <Botao variante="contorno" className="justify-self-end" onClick={aoFechar}>Fechar</Botao>
        </div>
      )}
    </Dialogo>
  );
}

/** A aba Quedas do WhatsApp: a queda aberta, abrir à mão e as últimas encerradas. */
export function AbaQuedas({ queda, quedas, responsavel, pode, recarregar }: {
  queda?: QuedaWhatsapp; quedas: QuedaWhatsapp[]; responsavel?: string; pode: boolean; recarregar: () => void;
}) {
  const { atualizar } = usePlataforma();
  const [recado, setRecado] = useState<string | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [ver, setVer] = useState<string | null>(null);
  const mudou = (t: string) => { setRecado(t); recarregar(); atualizar(); };

  return (
    <div className="grid gap-4">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {queda ? <QuedaAberta q={queda} pode={pode} aoMudar={mudou} /> : (
        <Vazio titulo="Nenhuma queda aberta"
          acao={pode ? <Botao variante="contorno" onClick={() => setAbrir(true)}>Abrir queda à mão</Botao> : undefined}>
          Quando o número do condomínio desconecta, a queda abre sozinha e {responsavel ?? "o síndico"} recebe o aviso no sino.
          Se as mensagens pararem de chegar sem aviso, abra à mão.
        </Vazio>
      )}
      {quedas.length ? (
        <section aria-labelledby="t-quedas" className="grid gap-2">
          <h2 id="t-quedas" className="text-lg font-medium">Quedas anteriores</h2>
          <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
            {quedas.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{diaHora(x.inicio)}</span>
                  <span className="block text-xs text-tinta-suave">
                    {x.voltouEm ? `${duracao(x.inicio, x.voltouEm)} fora do ar` : ESTADOS_QUEDA[x.estado]} · {quantas(x.paradas, "mensagem parada", "mensagens paradas")}
                    {x.encerradaPor ? ` · encerrada por ${x.encerradaPor}` : ""}
                  </span>
                </span>
                <Botao variante="discreto" onClick={() => setVer(x.id)} aria-label={`Ver a queda de ${diaHora(x.inicio)}`}>Ver</Botao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {abrir ? (
        <Confirmar titulo="Abrir queda à mão" botao="Abrir queda"
          texto="Use quando as mensagens pararem de chegar e o provedor não avisou. O que entrar na fila espera a sua decisão quando o número voltar."
          aoFechar={() => setAbrir(false)} enviar={() => chamarApi(BASE, { corpo: { oQueAconteceu: null } })}
          aoConfirmar={() => { setAbrir(false); mudou("Queda aberta. Escreva o canal alternativo para os moradores."); }} />
      ) : null}
      {ver ? <VerQueda id={ver} aoFechar={() => setVer(null)} /> : null}
    </div>
  );
}
