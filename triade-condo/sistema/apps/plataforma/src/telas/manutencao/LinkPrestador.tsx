"use client";
// Link do prestador na manutenção (design "Links e QR", tela 5; V-11, MP-08): mandar o serviço a
// quem executa, sem conta, e ver o que ele mandou (chegada, não consegui fazer, terminei e fotos).
// Nada muda sozinho: quem é responsável confere e conclui. O código do link aparece só ao mandar;
// depois, mandar de novo gera um link novo e o anterior para.

import { useState, type FormEvent } from "react";
import { IMPEDIMENTOS_PRESTADOR, LINK_PRESTADOR_DIAS, linkWhatsapp, mensagemPrestador } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { LinkPrestadorInfo, RegistroPrestador } from "../tipos.ts";

function diasDepois(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SITUACAO: Record<NonNullable<LinkPrestadorInfo["link"]>["situacao"], string> = {
  VALE: "Valendo",
  CANCELADO: "Cancelado",
  CONCLUIDA: "Parou: manutenção concluída",
  MANUTENCAO_CANCELADA: "Parou: manutenção cancelada",
  VENCIDO: "Vencido",
};

function textoRegistro(r: RegistroPrestador): string {
  if (r.tipo === "CHEGOU") return r.confirmado ? `Chegou, confirmado pela etiqueta ${r.etiqueta?.rotulo ?? ""}` : "Chegou, informado pelo prestador";
  if (r.tipo === "IMPEDIMENTO") return `Não conseguiu fazer · ${IMPEDIMENTOS_PRESTADOR[r.impedimento ?? "OUTRO"]}: ${r.texto}`;
  return `Terminou: ${r.texto}${r.ficouPendente ? ` Ficou para depois: ${r.pendenteTexto}` : " Nada ficou para depois."}`;
}

export function LinkPrestador({ manutencaoId, titulo, versao, recarregarManutencao }: {
  manutencaoId: string; titulo: string; versao: number; recarregarManutencao: () => void;
}) {
  const carga = useCarregar<LinkPrestadorInfo>(`/v1/condominio/manutencao/${manutencaoId}/link-prestador`);
  const [mandar, setMandar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  if (carga.estado === "carregando") return <Carregando linhas={2} />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const l = d.link;
  const terminou = d.registros.find((r) => r.tipo === "TERMINOU");

  async function abrirFoto(id: string) {
    setFalha(null);
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(`/v1/condominio/manutencao/${manutencaoId}/fotos-prestador/${id}/link`);
    if (!r.ok) { aba?.close(); return setFalha("Não deu para abrir a foto agora. Tente de novo."); }
    if (aba) aba.location.href = r.dados.url;
  }

  return (
    <section aria-labelledby="t-link-prestador" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-link-prestador" className="text-lg font-medium">Link do prestador</h2>
      {terminou && l?.situacao === "VALE" ? (
        <Aviso tom="ok" titulo={`${l.para} contou o que fez`}>Confira as fotos e o relato. A manutenção só fica concluída quando você concluir.</Aviso>
      ) : null}
      {l ? (
        <div className="grid gap-1 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{l.para}</span>
            <Selo tom={l.situacao === "VALE" ? "andamento" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
          </span>
          <span className="text-xs text-tinta-suave">
            Mandado em {diaHora(l.criadoEm)}{l.criadoPor ? ` por ${l.criadoPor}` : ""} · vale até {diaHora(l.expiraEm)}
            {l.abertoEm ? ` · aberto em ${diaHora(l.abertoEm)}` : " · ainda não foi aberto"}
          </span>
          {l.motivoCancelamento ? <span className="text-xs text-tinta-suave">Motivo: {l.motivoCancelamento}</span> : null}
        </div>
      ) : d.semExecutor
        ? <p className="text-sm text-tinta-suave">Escolha antes quem executa (um prestador do cadastro ou um nome) para mandar o serviço por link.</p>
        : <p className="text-sm text-tinta-suave">Mande o serviço por link: o prestador vê o que fazer, registra a chegada pela etiqueta do local e conta o que fez, sem conta.</p>}

      {d.registros.length ? (
        <ol className="grid gap-2 text-sm">
          {d.registros.map((r) => (
            <li key={r.id} className={`grid gap-0.5 rounded-xl border px-3 py-2 ${r.tipo === "TERMINOU" ? "border-ok-borda bg-ok-fundo" : r.tipo === "IMPEDIMENTO" ? "border-atencao-borda bg-atencao-fundo" : "border-linha"}`}>
              <span>{textoRegistro(r)}</span>
              <span className="text-xs text-tinta-suave">{diaHora(r.em)}{r.quemFez ? ` · feito por ${r.quemFez}` : ""}</span>
              {d.fotos.filter((f) => f.registroId === r.id).map((f) => (
                <button key={f.id} type="button" onClick={() => void abrirFoto(f.id)}
                  className="flex items-center gap-1.5 justify-self-start text-xs font-medium text-violeta-600 hover:underline">
                  <Icone nome="camera" className="h-4 w-4" />{f.nome}
                </button>
              ))}
            </li>
          ))}
        </ol>
      ) : null}
      {falha ? <p className="text-sm text-erro" role="alert">{falha}</p> : null}

      <span className="flex flex-wrap gap-2">
        {d.pode.mandar ? <Botao variante={l ? "contorno" : "primario"} tamanho="m" onClick={() => setMandar(true)}><Icone nome="enviar" />{l?.situacao === "VALE" ? "Mandar de novo" : "Mandar link"}</Botao> : null}
        {d.pode.cancelar ? <Botao variante="discreto" tamanho="m" onClick={() => setCancelar(true)}><Icone nome="fechar" />Cancelar link</Botao> : null}
      </span>
      {l?.situacao === "VALE" ? <p className="text-xs text-tinta-suave">Mandar de novo gera um link novo; o anterior para na hora.</p> : null}

      {mandar ? (
        <MandarLink manutencaoId={manutencaoId} titulo={titulo} versao={versao} info={d}
          aoFechar={() => setMandar(false)} aoMandar={() => { carga.recarregar(); recarregarManutencao(); }} />
      ) : null}
      {cancelar && l ? (
        <CancelarLink manutencaoId={manutencaoId} linkId={l.id} aoFechar={() => setCancelar(false)}
          aoCancelar={() => { setCancelar(false); carga.recarregar(); recarregarManutencao(); }} />
      ) : null}
    </section>
  );
}

function MandarLink({ manutencaoId, titulo, versao, info, aoFechar, aoMandar }: {
  manutencaoId: string; titulo: string; versao: number; info: LinkPrestadorInfo; aoFechar: () => void; aoMandar: () => void;
}) {
  const { painel } = usePlataforma();
  const [v, setV] = useState({ oQueFazer: info.sugestao.oQueFazer, quando: "", comoEntrar: "", valeAte: diasDepois(LINK_PRESTADOR_DIAS.padrao) });
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState<{ id: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const comErro = camposComErro(erro);
  const base = `/v1/condominio/manutencao/${manutencaoId}/link-prestador`;

  async function criar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ id: string; codigo: string }>(base, { corpo: { ...v, versao, arquivos } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setPronto({ id: r.dados.id, link: `${window.location.origin}/p/${r.dados.codigo}` });
    aoMandar();
  }
  const registrar = (canal: "COPIADO" | "WHATSAPP" | "EMAIL") => { if (pronto) void chamarApi(`${base}/${pronto.id}/envio`, { corpo: { canal } }); };

  if (pronto) {
    const msg = mensagemPrestador({ condominio: painel.condominio.nome, titulo, quando: v.quando || null, link: pronto.link });
    const telefone = info.para?.telefone;
    const zap = telefone ? linkWhatsapp(telefone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    return (
      <Dialogo aberto titulo="Link pronto" aoFechar={aoFechar}>
        <div className="grid gap-3">
          <Aviso tom="ok" titulo={`Link para ${info.para?.nome ?? "o prestador"}`}>Mande agora. Depois de fechar esta janela o link não aparece de novo: mandar de novo gera um link novo.</Aviso>
          <code className="rounded-lg border border-violeta-200 bg-violeta-50 px-3 py-2 text-[13px] break-all text-violeta-800">{pronto.link}</code>
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={() => { void navigator.clipboard?.writeText(msg).catch(() => {}); setCopiado(true); registrar("COPIADO"); }}>
              <Icone nome="copiar" />{copiado ? "Mensagem copiada" : "Copiar mensagem"}
            </Botao>
            {info.para?.email ? (
              <a href={`mailto:${info.para.email}?subject=${encodeURIComponent(`Serviço no ${painel.condominio.nome}: ${titulo}`)}&body=${encodeURIComponent(msg)}`}
                className={classeBotao("contorno")} onClick={() => registrar("EMAIL")}><Icone nome="email" />Por e-mail</a>
            ) : null}
            <a href={zap} target="_blank" rel="noopener noreferrer" className={classeBotao("primario")} onClick={() => registrar("WHATSAPP")}>
              <Icone nome="whats" />Mandar pelo WhatsApp
            </a>
          </div>
          <p className="text-xs text-tinta-suave">
            {telefone ? "Abre o seu WhatsApp com a mensagem pronta para o telefone do prestador." : "O prestador não tem telefone no cadastro: o WhatsApp abre para você escolher o contato."}
            {" "}Com o WhatsApp oficial (passo 5), sai pelo número do condomínio.
          </p>
          <Botao variante="discreto" className="justify-self-end" onClick={aoFechar}>Fechar</Botao>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo aberto titulo="Mandar link ao prestador" aoFechar={aoFechar}>
      <form onSubmit={criar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="text-sm">Para: <span className="font-medium">{info.para?.nome}</span>{info.para?.telefone ? ` · ${info.para.telefone}` : ""}</p>
        <CampoAreaTexto id="lp-fazer" rotulo="O que fazer" required rows={4} maxLength={2000} value={v.oQueFazer} onChange={(e) => setV({ ...v, oQueFazer: e.target.value })}
          ajuda="Os detalhes internos, o pedido ligado e o morador não vão." erro={comErro.includes("oQueFazer") ? "Diga o que fazer (de 10 a 2.000 caracteres)." : null} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto id="lp-quando" rotulo="Quando" opcional maxLength={120} value={v.quando} onChange={(e) => setV({ ...v, quando: e.target.value })}
            placeholder="Hoje, 14h às 17h" erro={comErro.includes("quando") ? "De 2 a 120 caracteres." : null} />
          <CampoTexto id="lp-ate" rotulo="Vale até" type="date" required min={diasDepois(0)} max={diasDepois(LINK_PRESTADOR_DIAS.maximo)} value={v.valeAte}
            onChange={(e) => setV({ ...v, valeAte: e.target.value })} ajuda={`Ou até concluir. Padrão ${LINK_PRESTADOR_DIAS.padrao} dias; no máximo ${LINK_PRESTADOR_DIAS.maximo}.`}
            erro={comErro.includes("valeAte") ? `Escolha entre hoje e daqui a ${LINK_PRESTADOR_DIAS.maximo} dias.` : null} />
        </div>
        <CampoAreaTexto id="lp-entrar" rotulo="Como entrar" opcional rows={2} maxLength={500} value={v.comoEntrar} onChange={(e) => setV({ ...v, comoEntrar: e.target.value })}
          placeholder="Procurar o zelador na portaria do bloco A." erro={comErro.includes("comoEntrar") ? "De 2 a 500 caracteres." : null} />
        {info.arquivos.length ? (
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Enviar junto <span className="font-normal text-tinta-suave">(só os que você marcar)</span></legend>
            {info.arquivos.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" checked={arquivos.includes(a.id)}
                  onChange={() => setArquivos(arquivos.includes(a.id) ? arquivos.filter((x) => x !== a.id) : [...arquivos, a.id].slice(0, 10))} />
                {a.nome}
              </label>
            ))}
          </fieldset>
        ) : null}
        <p className="text-xs text-tinta-suave">
          {info.etiqueta ? `A chegada é confirmada pela etiqueta ${info.etiqueta.rotulo} (${info.etiqueta.local}).` : `O local "${info.local}" não tem etiqueta: a chegada fica informada pelo prestador.`}
          {info.link?.situacao === "VALE" ? " O link anterior para na hora." : ""}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Gerando…" : "Gerar link"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function CancelarLink({ manutencaoId, linkId, aoFechar, aoCancelar }: { manutencaoId: string; linkId: string; aoFechar: () => void; aoCancelar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/manutencao/${manutencaoId}/link-prestador/${linkId}/cancelar`, { corpo: { motivo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoCancelar();
  }
  return (
    <Dialogo aberto titulo="Cancelar o link do prestador" aoFechar={aoFechar}>
      <div className="grid gap-3">
        <Aviso tom="atencao">O link para na hora. O que o prestador já mandou continua na manutenção.</Aviso>
        {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="lp-motivo" rotulo="Por que cancelar" required rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (de 3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={() => void enviar()} disabled={enviando}>{enviando ? "Cancelando…" : "Cancelar link"}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}
