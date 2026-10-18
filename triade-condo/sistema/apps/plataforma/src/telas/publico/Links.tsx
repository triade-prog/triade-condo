"use client";
// Os links do e-mail (CD-13, CD-14), sem conta: o comunicado do link pessoal, confirmar o
// e-mail, parar de receber (e voltar) e abrir o documento enviado. Confirmar, parar e abrir pedem
// um toque: programa de e-mail que abre links sozinho não faz nada por engano.

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Aviso, Botao, Carregando, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { ComunicadoPublico } from "../tipos.ts";
import { Cartao, ComunicadoLido, TelaPublica } from "./comum.tsx";

const vencido = (e: ErroApi) => textoDoErro(e);

export function ComunicadoDoLink() {
  const { codigo } = useParams<{ codigo: string }>();
  const [d, setD] = useState<{ condominio: string; comunicado?: ComunicadoPublico; foraDeUso?: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    void chamarApi<{ condominio: string; comunicado?: ComunicadoPublico; foraDeUso?: boolean }>(`/v1/publico/c/${encodeURIComponent(codigo)}`)
      .then((r) => (r.ok ? setD(r.dados) : setErro(r.status === 404 ? "Este link não existe. Confira o endereço." : vencido(r.erro))));
  }, [codigo]);
  const linkArquivo = useCallback((arquivo: string) => `/v1/publico/c/${encodeURIComponent(codigo)}/arquivos/${arquivo}`, [codigo]);
  if (erro) return <TelaPublica titulo="Comunicado do condomínio"><Aviso tom="atencao">{erro}</Aviso></TelaPublica>;
  if (!d) return <TelaPublica titulo="Comunicado do condomínio"><Carregando rotulo="Abrindo o comunicado…" /></TelaPublica>;
  return (
    <TelaPublica titulo={`Comunicado do ${d.condominio}`}>
      {d.comunicado ? <ComunicadoLido c={d.comunicado} linkArquivo={linkArquivo} />
        : <Aviso tom="info" titulo="Este comunicado saiu de uso">O condomínio arquivou este comunicado.</Aviso>}
    </TelaPublica>
  );
}

export function ConfirmarEmail() {
  const codigo = useSearchParams().get("c") ?? "";
  const [estado, setEstado] = useState<"livre" | "enviando">("livre");
  const [feito, setFeito] = useState<{ nome?: string; email: string; condominio: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function confirmar() {
    setErro(null);
    setEstado("enviando");
    const r = await chamarApi<{ nome?: string; email: string; condominio: string }>("/v1/publico/email/confirmar", { corpo: { codigo } });
    setEstado("livre");
    if (r.ok) setFeito(r.dados);
    else setErro(r.status === 404 || r.erro.codigo === "VALIDATION_ERROR" ? "Este link venceu ou foi cancelado. Peça um novo ao condomínio." : vencido(r.erro));
  }
  if (feito) {
    return (
      <TelaPublica titulo={`Comunicados do ${feito.condominio}`}>
        <Cartao>
          <h2 className="font-medium">E-mail confirmado</h2>
          <p className="text-sm">Pronto{feito.nome ? `, ${feito.nome.split(" ")[0]}` : ""}. Você vai receber os comunicados do {feito.condominio} em {feito.email}.
            Dá para parar quando quiser, pelo link no fim de cada e-mail.</p>
        </Cartao>
      </TelaPublica>
    );
  }
  return (
    <TelaPublica titulo="Confirmar o e-mail">
      <Cartao>
        <h2 className="font-medium">Receber os comunicados do condomínio por e-mail</h2>
        <p className="text-sm">A gestão do condomínio cadastrou este e-mail para você receber os comunicados. Se é seu, confirme.</p>
        {erro ? <Aviso tom="atencao">{erro}</Aviso> : null}
        <Botao className="justify-self-start" disabled={!codigo || estado === "enviando"} onClick={() => void confirmar()}>
          {estado === "enviando" ? "Confirmando…" : "Confirmar meu e-mail"}
        </Botao>
      </Cartao>
    </TelaPublica>
  );
}

export function PararEmail() {
  const codigo = useSearchParams().get("c") ?? "";
  const [estado, setEstado] = useState<"livre" | "enviando">("livre");
  const [r, setR] = useState<{ condominio: string; parou: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function chamar(acao: "parar" | "voltar") {
    setErro(null);
    setEstado("enviando");
    const x = await chamarApi<{ condominio: string; parou: boolean }>(`/v1/publico/email/${acao}`, { corpo: { codigo } });
    setEstado("livre");
    if (x.ok) setR(x.dados);
    else setErro(x.status === 404 || x.erro.codigo === "VALIDATION_ERROR" ? "Este link venceu. Peça ajuda ao condomínio." : vencido(x.erro));
  }
  return (
    <TelaPublica titulo={r ? `Comunicados do ${r.condominio}` : "Parar de receber por e-mail"}>
      <Cartao>
        {r?.parou ? (
          <>
            <h2 className="font-medium">Você não recebe mais e-mails do {r.condominio}</h2>
            <p className="text-sm">Os avisos continuam no mural e no grupo do prédio.</p>
            <Botao variante="contorno" className="justify-self-start" disabled={estado === "enviando"} onClick={() => void chamar("voltar")}>Voltar a receber</Botao>
          </>
        ) : r ? (
          <>
            <h2 className="font-medium">Você voltou a receber os comunicados por e-mail</h2>
            <p className="text-sm">Dá para parar quando quiser, pelo link no fim de cada e-mail.</p>
          </>
        ) : (
          <>
            <h2 className="font-medium">Parar de receber os comunicados por e-mail</h2>
            <p className="text-sm">Os avisos continuam no mural e no grupo do prédio. Só você consegue voltar a receber, por este mesmo link.</p>
            <Botao className="justify-self-start" disabled={!codigo || estado === "enviando"} onClick={() => void chamar("parar")}>
              {estado === "enviando" ? "Parando…" : "Parar de receber"}
            </Botao>
          </>
        )}
        {erro ? <Aviso tom="atencao">{erro}</Aviso> : null}
      </Cartao>
    </TelaPublica>
  );
}

export function DocumentoDoLink() {
  const { codigo } = useParams<{ codigo: string }>();
  const [estado, setEstado] = useState<"livre" | "abrindo">("livre");
  const [aberto, setAberto] = useState<{ titulo: string; numero: number; condominio: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function abrir() {
    setErro(null);
    setEstado("abrindo");
    const r = await chamarApi<{ url: string; titulo: string; numero: number; condominio: string }>(`/v1/publico/d/${encodeURIComponent(codigo)}`);
    setEstado("livre");
    if (!r.ok) return setErro(r.status === 404 ? "Este link não existe. Confira o endereço." : vencido(r.erro));
    setAberto(r.dados);
    window.location.href = r.dados.url;
  }
  return (
    <TelaPublica titulo={aberto ? `${aberto.titulo} · ${aberto.condominio}` : "Documento do condomínio"}>
      <Cartao>
        <h2 className="font-medium">{aberto ? `Baixando a versão ${aberto.numero}` : "Documento enviado pelo condomínio"}</h2>
        <p className="text-sm">O link vale 7 dias e pode ser cancelado pelo condomínio. Depois de baixado, guarde o arquivo com cuidado.</p>
        {erro ? <Aviso tom="atencao">{erro}</Aviso> : null}
        <Botao className="justify-self-start" disabled={estado === "abrindo"} onClick={() => void abrir()}>{estado === "abrindo" ? "Abrindo…" : aberto ? "Baixar de novo" : "Abrir o documento"}</Botao>
      </Cartao>
    </TelaPublica>
  );
}
