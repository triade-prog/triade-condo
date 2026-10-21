"use client";
// Mural online do prédio (design "Mural online e e-mail", tela 1; CD-12, CD-14): os comunicados
// para todo o condomínio, do mais novo ao mais antigo, sem conta nem senha, e o pedido de
// documento por e-mail, com resposta sempre neutra. Nada de nomes, telefones ou unidades. As
// seções do manual do prédio marcadas "no mural" ficam numa aba ao lado (peça R10, MP-14). As
// enquetes abertas aparecem no topo; responde-se pelo link pessoal (peça R12, AC-03). Os anúncios
// dos moradores ficam na aba Classificados, com o aviso de que o condomínio não vende nem garante
// nada (peça R12, AC-05). Com os comunicados pelo WhatsApp ligados, o botão "Receber pelo
// WhatsApp" abre a conversa com COMUNICADOS (F6.6, W-20).

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ASSUNTOS_COMUNICADO, AVISO_CLASSIFICADOS, reais, TIPOS_ANUNCIO, type AssuntoComunicado } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, Chip, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { prazoCurto } from "../vida/Enquetes.tsx";
import type { AnuncioPublico, MuralPublico } from "../tipos.ts";
import { Cartao, ComunicadoLido, FaixaQueda, ReceberPeloWhatsapp, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: MuralPublico };

export function Mural() {
  const { codigo } = useParams<{ codigo: string }>();
  const busca = useSearchParams();
  const aberto = busca.get("c");
  const verManual = busca.get("aba") === "manual";
  const verClassificados = busca.get("aba") === "classificados";
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [pedir, setPedir] = useState(false);

  useEffect(() => {
    void chamarApi<MuralPublico>(`/v1/publico/mural/${encodeURIComponent(codigo)}`).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este mural não existe. Confira o endereço ou peça o link ao condomínio." : textoDoErro(r.erro) });
    });
  }, [codigo]);
  const linkArquivo = useCallback((comunicado: string) => (arquivo: string) =>
    `/v1/publico/mural/${encodeURIComponent(codigo)}/comunicados/${comunicado}/arquivos/${arquivo}`, [codigo]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Mural do condomínio"><Carregando rotulo="Abrindo o mural…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Mural do condomínio"><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const m = carga.dados;
  const titulo = `Mural do ${m.condominio}`;
  if (m.trocado) return <TelaPublica titulo={titulo}><Aviso tom="atencao" titulo="Este endereço mudou">Peça o link novo ao condomínio.</Aviso></TelaPublica>;
  if (m.foraDoAr) return <TelaPublica titulo={titulo}><Aviso tom="info" titulo="Este mural está fora do ar">Os avisos continuam chegando pelo condomínio.</Aviso></TelaPublica>;

  const subtitulo = `Avisos para todo o condomínio${m.atualizadoEm ? ` · atualizado ${diaHora(m.atualizadoEm)}` : ""}`;
  const comunicado = aberto ? m.comunicados?.find((c) => c.id === aberto) : undefined;
  const voltar = () => { setPedir(false); router.replace(`/m/${codigo}`, { scroll: false }); };
  const ir = (aba?: string) => router.replace(`/m/${codigo}${aba ? `?aba=${aba}` : ""}`, { scroll: false });
  const temClassificados = !!m.classificados?.length;
  const abas = m.manual?.length || temClassificados ? (
    <span className="trilho" role="group" aria-label="Mostrar">
      <button type="button" className="chip" aria-pressed={!verManual && !verClassificados} data-escolhido={!verManual && !verClassificados ? "" : undefined}
        onClick={() => ir()}>Avisos</button>
      {temClassificados ? (
        <button type="button" className="chip" aria-pressed={verClassificados} data-escolhido={verClassificados ? "" : undefined}
          onClick={() => ir("classificados")}>Classificados</button>
      ) : null}
      {m.manual?.length ? (
        <button type="button" className="chip" aria-pressed={verManual} data-escolhido={verManual ? "" : undefined}
          onClick={() => ir("manual")}>Manual do prédio</button>
      ) : null}
    </span>
  ) : null;

  if (verClassificados && m.classificados?.length) {
    return (
      <TelaPublica titulo={titulo} subtitulo="Classificados entre moradores">
        {abas}
        <FaixaQueda canal={m.canalAlternativo} />
        <ul className="grid gap-3" aria-label="Classificados entre moradores">
          {m.classificados.map((a) => <li key={a.id}><Anuncio a={a} codigo={codigo} /></li>)}
        </ul>
        <p className="text-sm text-tinta-suave">{AVISO_CLASSIFICADOS}</p>
      </TelaPublica>
    );
  }

  if (verManual && m.manual?.length) {
    return (
      <TelaPublica titulo={titulo} subtitulo="Manual do prédio">
        {abas}
        <ul className="grid gap-3" aria-label="Manual do prédio">
          {m.manual.map((s) => (
            <li key={s.id}>
              <Cartao>
                <h2 className="text-base font-medium">{s.titulo}</h2>
                <p className="text-sm whitespace-pre-line">{s.texto}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      </TelaPublica>
    );
  }

  if (comunicado) {
    return (
      <TelaPublica titulo={titulo} subtitulo={subtitulo}>
        <button type="button" onClick={voltar} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Voltar ao mural</button>
        <ComunicadoLido c={comunicado} linkArquivo={linkArquivo(comunicado.id)} />
      </TelaPublica>
    );
  }
  if (pedir && m.documentos?.length) {
    return (
      <TelaPublica titulo={titulo} subtitulo={subtitulo}>
        <button type="button" onClick={voltar} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Voltar ao mural</button>
        <PedirDocumento codigo={codigo} documentos={m.documentos} />
      </TelaPublica>
    );
  }
  return (
    <TelaPublica titulo={titulo} subtitulo={subtitulo}>
      {abas}
      <FaixaQueda canal={m.canalAlternativo} />
      <ReceberPeloWhatsapp numero={m.comunicadosWhatsapp} />
      {m.enquetes?.length ? (
        <ul className="grid gap-3" aria-label="Enquetes abertas">
          {m.enquetes.map((e) => (
            <li key={e.id}>
              <Cartao className="border-violeta-200">
                <span className="justify-self-start rounded-md bg-violeta-50 px-2 py-0.5 text-xs text-violeta-700">Enquete · aberta até {prazoCurto(e.abertaAte)}</span>
                <h2 className="text-base font-medium">{e.pergunta}</h2>
                <p className="text-sm text-tinta-suave">Opções: {e.opcoes.join(" · ")}.</p>
                <p className="text-sm">
                  Responda pelo link pessoal que chegou pelo WhatsApp ou pelo e-mail, {e.por === "UNIDADE" ? "um por unidade" : "um por pessoa"}. Não recebeu? Peça ao condomínio.
                </p>
              </Cartao>
            </li>
          ))}
        </ul>
      ) : null}
      {m.comunicados?.length ? (
        <ul className="grid gap-3" aria-label="Comunicados">
          {m.comunicados.map((c) => (
            <li key={c.id}>
              <Cartao>
                <span className="justify-self-start rounded-md bg-superficie-2 px-2 py-0.5 text-xs text-tinta-suave">{ASSUNTOS_COMUNICADO[c.assunto as AssuntoComunicado] ?? "Comunicado"}</span>
                <h2 className="text-base font-medium">{c.titulo}</h2>
                <p className="line-clamp-3 text-sm text-tinta-suave">{c.texto}</p>
                <p className="text-[13px] text-tinta-suave">
                  {diaHora(c.publicadoEm)}{c.numero > 1 ? " · corrigido" : ""}{c.arquivos.length ? ` · ${c.arquivos.length === 1 ? "1 arquivo" : `${c.arquivos.length} arquivos`}` : ""}
                  {" · "}<a href={`/m/${codigo}?c=${c.id}`} onClick={(e) => { e.preventDefault(); router.push(`/m/${codigo}?c=${c.id}`, { scroll: true }); }}
                    className="font-medium text-violeta-600 hover:underline">Ler tudo<span className="sr-only">: {c.titulo}</span></a>
                </p>
              </Cartao>
            </li>
          ))}
        </ul>
      ) : <Cartao><h2 className="font-medium">Nenhum aviso agora</h2><p className="text-sm text-tinta-suave">Quando o condomínio publicar um aviso para todos, ele aparece aqui.</p></Cartao>}
      {m.documentos?.length ? (
        <Cartao>
          <h2 className="font-medium">Documentos do prédio</h2>
          <p className="text-sm text-tinta-suave">{m.documentos.map((d) => d.titulo).join(", ")}. Peça e receba no seu e-mail.</p>
          <Botao variante="contorno" className="justify-self-start" onClick={() => setPedir(true)}>Pedir por e-mail</Botao>
        </Cartao>
      ) : null}
    </TelaPublica>
  );
}

function PedirDocumento({ codigo, documentos }: { codigo: string; documentos: NonNullable<MuralPublico["documentos"]> }) {
  const [documentoId, setDocumentoId] = useState(documentos[0]!.id);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "feito">("livre");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEstado("enviando");
    const r = await chamarApi(`/v1/publico/mural/${encodeURIComponent(codigo)}/documentos`, { corpo: { documentoId, email } });
    if (r.ok) return setEstado("feito");
    setEstado("livre");
    setErro(r.erro.codigo === "VALIDATION_ERROR" ? "Confira o e-mail: precisa do @ e do domínio." : textoDoErro(r.erro));
  }

  if (estado === "feito") {
    return (
      <Cartao>
        <h2 className="font-medium">Pedido recebido</h2>
        <p className="text-sm">Se este e-mail estiver cadastrado no condomínio, o documento chega em instantes. Se não estiver, a síndica vai olhar o pedido. O link do documento vale 7 dias.</p>
      </Cartao>
    );
  }
  return (
    <Cartao>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <h2 className="font-medium">Pedir documento por e-mail</h2>
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-[13px] font-medium">Documento</legend>
          <span className="flex flex-wrap gap-2">
            {documentos.map((d) => <Chip key={d.id} ativo={documentoId === d.id} onClick={() => setDocumentoId(d.id)}>{d.titulo}</Chip>)}
          </span>
        </fieldset>
        <CampoTexto id="pd-email" rotulo="Seu e-mail" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erro} />
        <Botao type="submit" className="justify-self-start" disabled={estado === "enviando" || !email.trim()}>{estado === "enviando" ? "Pedindo…" : "Pedir"}</Botao>
      </form>
    </Cartao>
  );
}

/** Um anúncio no mural: a foto por link que expira, o texto e como falar com quem anunciou. */
function Anuncio({ a, codigo }: { a: AnuncioPublico; codigo: string }) {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    if (!a.foto) return;
    void chamarApi<{ url: string }>(`/v1/publico/mural/${encodeURIComponent(codigo)}/classificados/${a.id}/foto`).then((r) => {
      if (r.ok) setFoto(r.dados.url);
    });
  }, [a.foto, a.id, codigo]);
  const quem = [a.quem, a.bloco].filter(Boolean).join(" · ");
  return (
    <Cartao>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- link assinado de 5 min do armazenamento privado
          <img src={foto} alt={`Foto do anúncio ${a.titulo}`} className="h-20 w-20 rounded-xl object-cover" />
        ) : null}
        <div className={`grid min-w-0 content-start gap-1 ${foto ? "" : "col-span-2"}`}>
          <span className="text-xs font-medium text-violeta-600">{TIPOS_ANUNCIO[a.tipo]}</span>
          <h2 className="text-base font-medium">{a.titulo}{a.valorCentavos ? ` · ${reais(a.valorCentavos)}` : ""}</h2>
          <p className="text-sm whitespace-pre-line">{a.texto}</p>
          <p className="text-[13px] text-tinta-suave">
            {quem ? `${quem} · ` : ""}até {a.ate.slice(8, 10)}/{a.ate.slice(5, 7)} · {a.whatsapp ? (
              <a href={`https://wa.me/${a.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium text-violeta-600 hover:underline">
                Chamar no WhatsApp
              </a>
            ) : "contato pelo condomínio"}
          </p>
        </div>
      </div>
    </Cartao>
  );
}
