"use client";
// Mural online do prédio (design "Mural online e e-mail", tela 1; CD-12, CD-14): os comunicados
// para todo o condomínio, do mais novo ao mais antigo, sem conta nem senha, e o pedido de
// documento por e-mail, com resposta sempre neutra. Nada de nomes, telefones ou unidades. As
// seções do manual do prédio marcadas "no mural" ficam numa aba ao lado (peça R10, MP-14).

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ASSUNTOS_COMUNICADO, type AssuntoComunicado } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, Chip, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { MuralPublico } from "../tipos.ts";
import { Cartao, ComunicadoLido, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: MuralPublico };

export function Mural() {
  const { codigo } = useParams<{ codigo: string }>();
  const busca = useSearchParams();
  const aberto = busca.get("c");
  const verManual = busca.get("aba") === "manual";
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
  const abas = m.manual?.length ? (
    <span className="trilho" role="group" aria-label="Mostrar">
      <button type="button" className="chip" aria-pressed={!verManual} data-escolhido={!verManual ? "" : undefined}
        onClick={() => router.replace(`/m/${codigo}`, { scroll: false })}>Avisos</button>
      <button type="button" className="chip" aria-pressed={verManual} data-escolhido={verManual ? "" : undefined}
        onClick={() => router.replace(`/m/${codigo}?aba=manual`, { scroll: false })}>Manual do prédio</button>
    </span>
  ) : null;

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
