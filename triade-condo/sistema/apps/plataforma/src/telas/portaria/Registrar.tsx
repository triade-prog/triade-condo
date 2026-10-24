"use client";
// Registrar encomenda (PA-01, PA-07, W-20, W-21; telas-modelo encomendas-registrar-*): no
// computador, uma tela com "Quem fica sabendo" ao lado; no celular, três passos (unidade e
// etiqueta; de quem veio e onde guardou; pronto para avisar). O aviso sai junto com o registro,
// para todos da unidade ao mesmo tempo; a foto da etiqueta fica só no painel. Depois, a tela
// "Encomenda guardada" diz quem foi avisado.

import { useState } from "react";
import { MOTIVOS_NAO_RECEBE, previaEncomenda, REMETENTES_SUGERIDOS, textoVolumes, type Encomenda } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro } from "@triade/ui";
import { conferirArquivo, enviarUm } from "../comunicados/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hora, type OpcoesEncomenda, type QuemDaUnidade } from "./comum.tsx";

type Dados = { unidadeId: string; remetente: string; outro: boolean; volumes: number; lugarId: string; observacao: string };

function QuemFicaSabendo({ quem, eu }: { quem: QuemDaUnidade | null; eu: string }) {
  if (!quem) return <p className="t-apoio">Escolha a unidade para ver quem fica sabendo.</p>;
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {quem.pessoas.filter((p) => p.mora).map((p) => (
          <li key={p.contatoId} className="grid gap-0.5 rounded-xl border border-linha bg-superficie p-3">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.nome}</span>
              {p.recebe ? <Selo tom="ok">WhatsApp</Selo> : <Selo tom={p.motivo === "PAROU" ? "atencao" : "neutro"}>Não recebe</Selo>}
            </span>
            <span className="t-apoio">
              {p.recebe ? "Recebe agora o aviso Encomenda guardada."
                : p.motivo === "PAROU" ? `Pediu PARAR pelo WhatsApp${p.parouEm ? ` em ${new Date(p.parouEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}. Não recebe; se precisar, avise por outro meio.`
                  : `${MOTIVOS_NAO_RECEBE[p.motivo ?? "NAO_MORA"]}. Se precisar, avise por outro meio.`}
            </span>
          </li>
        ))}
        {quem.pessoas.every((p) => !p.mora) ? <li className="t-apoio">Ninguém que mora na unidade está confirmado. A encomenda fica Sem aviso; avise por outro meio.</li> : null}
      </ul>
      <p className="t-apoio">Todos os contatos da unidade são avisados ao mesmo tempo. Ninguém de fora da unidade recebe, e a foto da etiqueta não vai na mensagem.</p>
      <p className="t-apoio"><b>Quem guardou:</b> fica registrado como guardada por você, {eu}.</p>
    </div>
  );
}

export function RegistrarEncomenda({ opcoes, aoFechar, registrada, verGuardadas }: {
  opcoes: OpcoesEncomenda; aoFechar: () => void; registrada: () => void; verGuardadas: () => void;
}) {
  const vazio: Dados = { unidadeId: "", remetente: "", outro: false, volumes: 1, lugarId: opcoes.lugares[0]?.id ?? "", observacao: "" };
  const [d, setD] = useState<Dados>(vazio);
  const [busca, setBusca] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [passo, setPasso] = useState(1);
  const [falha, setFalha] = useState<string | null>(null);
  const [campos, setCampos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState<{ e: Encomenda; avisos: number; fotoFalhou?: string } | null>(null);
  const quem = useCarregar<QuemDaUnidade>(d.unidadeId ? `/v1/condominio/encomendas/unidades/${d.unidadeId}/quem` : null);
  const q = d.unidadeId && quem.estado === "pronto" ? quem.dados : null;
  const unidade = opcoes.unidades.find((u) => u.id === d.unidadeId);
  const lugar = opcoes.lugares.find((l) => l.id === d.lugarId);
  const recebem = q?.recebem ?? 0;
  const nomesRecebem = q?.pessoas.filter((p) => p.recebe).map((p) => p.nome.split(" ")[0]) ?? [];

  const escolherUnidade = (texto: string) => {
    setBusca(texto);
    const u = opcoes.unidades.find((x) => x.rotulo.toLowerCase() === texto.trim().toLowerCase())
      ?? (opcoes.unidades.filter((x) => x.identificacao === texto.trim()).length === 1 ? opcoes.unidades.find((x) => x.identificacao === texto.trim()) : undefined);
    setD((v) => ({ ...v, unidadeId: u?.id ?? "" }));
  };

  async function registrar() {
    setFalha(null);
    if (!d.unidadeId) { setPasso(1); setCampos(["unidadeId"]); return setFalha("Escolha a unidade."); }
    if (d.remetente.trim().length < 2) { setPasso(2); setCampos(["remetente"]); return setFalha("Diga de quem veio."); }
    if (foto) {
      const erroFoto = conferirArquivo(foto, 10 * 1024 * 1024);
      if (erroFoto || foto.type === "application/pdf") { setPasso(1); return setFalha(erroFoto ?? "A etiqueta é só foto (JPG, PNG ou WEBP)."); }
    }
    setEnviando(true);
    const r = await chamarApi<{ id: string; avisos: number; encomenda: Encomenda }>("/v1/condominio/encomendas", {
      corpo: { unidadeId: d.unidadeId, remetente: d.remetente.trim(), volumes: d.volumes, lugarId: d.lugarId, observacao: d.observacao.trim() || null },
    });
    if (!r.ok) { setEnviando(false); setCampos(camposComErro(r.erro)); return setFalha(textoDoErro(r.erro)); }
    let fotoFalhou: string | undefined;
    if (foto) {
      const f = await enviarUm(`/v1/condominio/encomendas/${r.dados.id}/fotos`, { tipoFoto: "ETIQUETA" }, foto, (x) => x.fotoId!);
      if (!f.liberado) fotoFalhou = f.motivo ?? "Envie de novo pelo menu da encomenda.";
    }
    setEnviando(false);
    setPronto({ e: r.dados.encomenda, avisos: r.dados.avisos, fotoFalhou });
    registrada();
  }

  if (pronto) {
    const e = pronto.e;
    return (
      <Dialogo aberto media fechar titulo="Encomenda guardada" aoFechar={aoFechar}>
        <div className="grid gap-4">
          <div className="grid justify-items-start gap-1">
            <Selo tom="ok">Pronto</Selo>
            <p className="t-titulo-tela">Encomenda guardada</p>
            <p className="t-texto">{e.unidade.rotulo} · {e.remetente} · {textoVolumes(e.volumes)}</p>
            <p className="t-apoio">{e.lugar?.nome} · guardada por você às {hora(e.guardadaEm)}</p>
          </div>
          <section aria-labelledby="t-avisado" className="grid gap-2 rounded-2xl border border-linha p-4">
            <h3 id="t-avisado" className="t-titulo-cartao">Quem foi avisado</h3>
            {(e.avisados ?? []).map((n) => (
              <p key={n} className="flex flex-wrap items-center justify-between gap-2 t-texto"><span className="font-medium">{n}</span><span className="flex items-center gap-2"><Selo tom="ok">Enviado</Selo><span className="t-apoio">WhatsApp · {hora(e.guardadaEm)}</span></span></p>
            ))}
            {(e.pararam ?? []).map((n) => (
              <p key={n} className="flex flex-wrap items-center justify-between gap-2 t-texto"><span className="font-medium">{n}</span><span className="t-apoio">Não recebe: pediu PARAR</span></p>
            ))}
            {pronto.avisos === 0 ? <Aviso tom="atencao">Ninguém da unidade recebeu pelo WhatsApp. A encomenda está Sem aviso: avise por outro meio.</Aviso> : null}
          </section>
          <p className="t-apoio">Se o envio falhar, a encomenda aparece como Aviso falhou na lista, com Avisar de novo.</p>
          {pronto.fotoFalhou ? <Aviso tom="atencao">A foto da etiqueta não foi guardada: {pronto.fotoFalhou}</Aviso> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={verGuardadas}>Ver as guardadas</Botao>
            <Botao onClick={() => { setPronto(null); setD(vazio); setBusca(""); setFoto(null); setPasso(1); }}><Icone nome="mais" />Registrar outra encomenda</Botao>
          </div>
        </div>
      </Dialogo>
    );
  }

  const parte1 = (
    <section aria-labelledby="t-re-1" className={`grid gap-3 ${passo === 1 ? "" : "max-md:hidden"}`}>
      <h3 id="t-re-1" className="t-titulo-cartao"><span className="max-md:hidden">1 · </span>Para quem e a etiqueta</h3>
      <div className="grid gap-1">
        <CampoTexto id="re-unidade" rotulo="Unidade" icone="busca" list="re-unidades" placeholder="Buscar por unidade, como 101 ou Torre B · 304"
          value={busca} onChange={(x) => escolherUnidade(x.target.value)} autoComplete="off"
          erro={campos.includes("unidadeId") && !d.unidadeId ? "Escolha uma unidade da lista" : undefined}
          ajuda={unidade ? `Escolhida: ${unidade.rotulo}` : undefined} />
        <datalist id="re-unidades">{opcoes.unidades.map((u) => <option key={u.id} value={u.rotulo} />)}</datalist>
      </div>
      <div className="grid gap-1">
        <label htmlFor="re-foto" className="t-rotulo">Foto da etiqueta <span className="font-normal text-tinta-suave">(opcional)</span></label>
        <input id="re-foto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="t-texto" onChange={(x) => setFoto(x.target.files?.[0] ?? null)} />
        <span className="t-apoio">JPG, PNG ou WEBP · até 10 MB · fica só no painel, não vai na mensagem.</span>
      </div>
    </section>
  );

  const parte2 = (
    <section aria-labelledby="t-re-2" className={`grid gap-3 ${passo === 2 ? "" : "max-md:hidden"}`}>
      <h3 id="t-re-2" className="t-titulo-cartao"><span className="max-md:hidden">2 · </span>De quem veio e onde guardou</h3>
      <div role="group" aria-label="De quem veio" className="flex flex-wrap gap-2">
        {REMETENTES_SUGERIDOS.map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={!d.outro && d.remetente === r} onClick={() => setD({ ...d, remetente: r, outro: false })}>{r}</button>
        ))}
        <button type="button" className="chip" aria-pressed={d.outro} onClick={() => setD({ ...d, remetente: "", outro: true })}>Outro</button>
      </div>
      {d.outro ? (
        <CampoTexto id="re-remetente" rotulo="De quem veio" placeholder="Nome da loja ou de quem mandou" value={d.remetente} maxLength={60}
          onChange={(x) => setD({ ...d, remetente: x.target.value })} erro={campos.includes("remetente") ? "De 2 a 60 caracteres" : undefined} />
      ) : null}
      <div className="flex items-center gap-3">
        <span className="t-rotulo">Volumes</span>
        <Botao variante="contorno" tamanho="m" soIcone aria-label="Um volume a menos" disabled={d.volumes <= 1} onClick={() => setD({ ...d, volumes: d.volumes - 1 })}><span aria-hidden="true" className="t-codigo">−</span></Botao>
        <output aria-live="polite" className="t-codigo min-w-8 text-center">{d.volumes}</output>
        <Botao variante="contorno" tamanho="m" soIcone aria-label="Um volume a mais" disabled={d.volumes >= 50} onClick={() => setD({ ...d, volumes: d.volumes + 1 })}><Icone nome="mais" /></Botao>
      </div>
      <div className="grid gap-1">
        <span className="t-rotulo" id="re-lugar">Onde guardou</span>
        <div role="group" aria-labelledby="re-lugar" className="flex flex-wrap gap-2">
          {opcoes.lugares.map((l) => (
            <button key={l.id} type="button" className="chip" aria-pressed={d.lugarId === l.id} onClick={() => setD({ ...d, lugarId: l.id })}>{l.nome}</button>
          ))}
        </div>
        <span className="t-apoio">Os lugares vêm de Configurações › Portaria.</span>
      </div>
      <CampoAreaTexto id="re-obs" rotulo="Observação" opcional value={d.observacao} maxLength={200} onChange={(x) => setD({ ...d, observacao: x.target.value })} />
    </section>
  );

  const previa = opcoes.modelo && unidade && d.remetente.trim() && lugar ? previaEncomenda(opcoes.modelo, {
    unidade: unidade.rotulo, remetente: d.remetente.trim(), volumes: d.volumes, lugar: lugar.nome,
    quando: `${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })} às ${hora(new Date().toISOString())}`,
    recebidaPor: opcoes.eu.nome, condominio: opcoes.condominio,
  }) : null;

  const lateral = (
    <aside aria-labelledby="t-re-quem" className={`grid content-start gap-3 rounded-2xl bg-fundo p-4 ${passo === 3 ? "" : "max-md:hidden"}`}>
      <h3 id="t-re-quem" className="t-titulo-cartao">Quem fica sabendo · {recebem === 1 ? "1 aviso" : `${recebem} avisos`}</h3>
      <div className="grid gap-2 md:hidden">
        <p className="t-texto"><b>{unidade?.rotulo ?? "Sem unidade"}</b> · {d.remetente || "de quem veio?"} · {textoVolumes(d.volumes)} · {lugar?.nome}</p>
        <Botao variante="discreto" tamanho="m" className="justify-self-start" onClick={() => setPasso(1)}>Alterar</Botao>
      </div>
      <QuemFicaSabendo quem={q} eu={opcoes.eu.nome} />
      {previa ? (
        <details className="md:hidden">
          <summary className="t-rotulo">Como chega no WhatsApp</summary>
          <p className="whitespace-pre-line rounded-xl bg-superficie p-3 t-apoio">{previa}</p>
          <p className="t-apoio">Modelo aprovado Encomenda guardada, assinado pela Nina.</p>
        </details>
      ) : null}
    </aside>
  );

  const botaoRegistrar = (
    <Botao disabled={enviando} onClick={() => void registrar()}>
      <Icone nome="caixa" />{recebem ? `Registrar e avisar ${recebem}` : "Registrar"}
    </Botao>
  );

  return (
    <Dialogo aberto larga fechar titulo="Registrar encomenda" aoFechar={aoFechar}
      apoio="A unidade é avisada no WhatsApp junto com o registro. Quem fica sabendo aparece ao lado.">
      <div className="grid gap-4">
        <div className="grid gap-1 md:hidden">
          <span className="t-apoio">Passo {passo} de 3</span>
          <span aria-hidden="true" className="h-1.5 rounded-full bg-superficie-2"><span className="block h-1.5 rounded-full bg-violeta-600" style={{ width: `${(passo / 3) * 100}%` }} /></span>
          <p className="t-titulo-cartao">{["Unidade e etiqueta", "De quem veio e onde guardou", "Pronto para avisar"][passo - 1]}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">{parte1}{parte2}</div>
          {lateral}
        </div>
        {falha ? <Aviso tom="erro" papel="alert">{falha}</Aviso> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-4">
          <span className="t-apoio max-md:hidden">
            {d.unidadeId ? (recebem ? `Sai ${recebem === 1 ? "1 aviso" : `${recebem} avisos`} junto com o registro: para ${nomesRecebem.join(", ")}.` : "Ninguém da unidade recebe pelo WhatsApp: a encomenda fica Sem aviso.") : "Escolha a unidade."}
          </span>
          <div className="flex gap-2 max-md:w-full max-md:justify-between">
            {passo > 1 ? <Botao variante="contorno" className="md:hidden" onClick={() => setPasso(passo - 1)}><Icone nome="esq" />Voltar</Botao> : null}
            <Botao variante="discreto" className={passo > 1 ? "max-md:hidden" : ""} onClick={aoFechar}>Cancelar</Botao>
            {passo < 3 ? (
              <>
                <Botao className="md:hidden" onClick={() => setPasso(passo + 1)}>Continuar<Icone nome="dir" /></Botao>
                <span className="max-md:hidden">{botaoRegistrar}</span>
              </>
            ) : botaoRegistrar}
          </div>
        </div>
      </div>
    </Dialogo>
  );
}
