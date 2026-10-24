"use client";
// O arquivo do contrato do prestador (D4.34, decisão D.2 de 24/10/2026; quadros 266 e 267 do canvas;
// MP-05): o arquivo é um documento do tipo Contrato em Documentos, ligado ao prestador. Versões, quem
// vê e o aviso de vencimento são os de Documentos, e a data Vale até é a mesma nos dois. Enviar o
// contrato guarda o documento, liga e sobe o arquivo como versão 1; Enviar a versão nova sobe outra
// versão e, se a data mudou, muda nos dois.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { mostrarDataCurta, TAMANHO_MAXIMO_DOCUMENTO } from "@triade/domain";
import { AvisoErro, Botao, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { abrirLink, conferirArquivo, enviarUm } from "../comunicados/comum.tsx";
import { Dado } from "../Ficha.tsx";
import { CampoArquivo } from "../memoria/Prontuario.tsx";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { usePlataforma } from "../sessao.tsx";
import type { PrestadorItem } from "../tipos.ts";

const QUEM_VE = { GESTAO: "Quem vê documentos", RESTRITO: "Só quem cuida dos documentos" } as const;
type QuemVe = keyof typeof QUEM_VE;

/** A linha Arquivo do contrato do cartão Como trabalha com o condomínio. */
export function LinhaArquivoContrato({ p, pode, aoMudar }: {
  p: PrestadorItem; pode: boolean; aoMudar: (texto: string, tom?: "ok" | "atencao") => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const c = p.contratoDocumento;
  if (p.acordo !== "CONTRATO") return null;
  // O contrato restrito, para quem não o vê, fica com quem cuida dos documentos restritos.
  const botao = pode && !p.arquivado && !c?.oculto ? (
    <Botao variante="discreto" tamanho="m" onClick={() => setEnviando(true)}>
      <Icone nome="enviar" />{c && !c.oculto && c.arquivo ? "Enviar a versão nova" : "Enviar o contrato"}
    </Botao>
  ) : undefined;

  let valor;
  if (c?.oculto) valor = <span className="text-tinta-suave">Guardado em Documentos, para quem vê documentos</span>;
  else if (c) {
    valor = (
      <span className="grid gap-0.5">
        {c.arquivo && c.versaoId ? (
          <button type="button" className="elo justify-self-start"
            onClick={() => void abrirLink(`/v1/condominio/documentos/${c.id}/versoes/${c.versaoId}/link`).then((e) => { if (e) aoMudar(e, "atencao"); })}>
            {c.arquivo}
          </button>
        ) : <span className="text-tinta-suave">{c.enviando ? "O arquivo ainda está sendo conferido" : "Sem arquivo ainda"}</span>}
        <span className="t-apoio">
          {c.numero ? `Versão ${c.numero} · ` : ""}guardado em <Link href={`/documentos/documento?id=${c.id}`} className="font-medium text-violeta-600 hover:underline">Documentos</Link>, tipo Contrato
          {c.numero && c.numero > 1 ? " · as anteriores ficam guardadas" : ""}
        </span>
      </span>
    );
  } else valor = <span className="text-tinta-suave">Não enviado</span>;

  return (
    <>
      <Dado icone="documento" nome="Arquivo do contrato" acao={botao}>{valor}</Dado>
      {enviando ? (
        <EnviarContrato p={p} aoFechar={() => setEnviando(false)}
          aoMudar={(t, tom) => { setEnviando(false); aoMudar(t, tom); }} />
      ) : null}
    </>
  );
}

function EnviarContrato({ p, aoFechar, aoMudar }: {
  p: PrestadorItem; aoFechar: () => void; aoMudar: (texto: string, tom?: "ok" | "atencao") => void;
}) {
  const { pode } = usePlataforma();
  const atual = p.contratoDocumento && !p.contratoDocumento.oculto ? p.contratoDocumento : null;
  const proxima = (atual?.numero ?? 0) + 1;
  const [v, setV] = useState({ valeAte: p.contratoAte ?? "", quem: (atual?.restrito ? "RESTRITO" : "GESTAO") as QuemVe });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const problema = arquivo ? conferirArquivo(arquivo, TAMANHO_MAXIMO_DOCUMENTO) : null;
  const comErro = camposComErro(erro);
  const hoje = hojeEmBrasilia();
  const quem = (Object.keys(QUEM_VE) as QuemVe[]).filter((q) => q !== "RESTRITO" || pode("documentos.restritos"));

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!arquivo || problema) return;
    setErro(null);
    setProgresso(0);
    let id = atual?.id;
    let ligado = true;
    if (!id) {
      // Guarda e liga numa transação só: se não der para ligar, nada fica guardado e o erro aparece aqui.
      const doc = await chamarApi<{ id: string }>(`/v1/condominio/manutencao/prestadores/${p.id}/contrato`, {
        corpo: {
          versao: p.versao,
          documento: { tipo: "CONTRATO", titulo: `Contrato com ${p.nome}`.slice(0, 120), descricao: null, valeAte: v.valeAte || null, restrito: v.quem === "RESTRITO", aoMorador: false },
        },
      });
      if (!doc.ok) { setProgresso(null); return setErro(doc.erro); }
      id = doc.dados.id;
    }
    const envio = await enviarUm(`/v1/condominio/documentos/${id}/versoes`, { mudanca: atual ? "Versão nova do contrato" : null, vigenteDesde: hoje, aprovadoEm: null },
      arquivo, (x) => x.versaoId!, setProgresso);
    if (atual && v.valeAte && v.valeAte !== p.contratoAte) {
      const r = await chamarApi(`/v1/condominio/manutencao/prestadores/${p.id}/contrato`, { metodo: "PUT", corpo: { versao: p.versao, documentoId: atual.id, valeAte: v.valeAte } });
      if (!r.ok) ligado = false;
    }
    setProgresso(null);
    if (!envio.liberado) return aoMudar(`${envio.nome}: ${envio.motivo ?? "não foi liberado."} O contrato está em Documentos; envie o arquivo de novo lá.`, "atencao");
    if (!ligado) return aoMudar("Versão nova guardada, mas a data de fim não mudou. Mude em Editar.", "atencao");
    aoMudar(atual ? `Versão ${proxima} do contrato guardada${v.valeAte ? `, vale até ${mostrarDataCurta(v.valeAte)}` : ""}.` : "Contrato guardado em Documentos e ligado ao prestador.");
  }

  return (
    <Dialogo aberto media titulo={atual ? "Enviar a versão nova" : "Enviar o contrato"} fechar aoFechar={aoFechar}
      apoio={`${p.nome}. O arquivo vira a versão ${proxima} do contrato em Documentos${atual ? "; a anterior fica guardada" : ""}.`}>
      <form onSubmit={guardar} noValidate className="grid gap-4">
        {erro && !comErro.includes("valeAte") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoArquivo arquivo={arquivo} setArquivo={setArquivo} problema={problema} desligado={progresso !== null} rotulo="Escolher o arquivo ou tirar foto" />
        <div className="grid gap-3 md:grid-cols-2">
          <CampoTexto id="ec-vale" rotulo="Vale até" type="date" opcional value={v.valeAte} onChange={(e) => setV({ ...v, valeAte: e.target.value })}
            ajuda="Avisa 60 dias antes, no Início." erro={comErro.includes("valeAte") ? "Data fora do esperado." : null} />
          {atual ? null : (
            <CampoSelecao id="ec-quem" rotulo="Quem vê" value={v.quem} onChange={(e) => setV({ ...v, quem: e.target.value as QuemVe })}
              opcoes={quem.map((q) => ({ valor: q, texto: QUEM_VE[q] }))} />
          )}
        </div>
        <p className="t-apoio">O contrato também aparece em Documentos, no atalho Contratos, e o arquivo continua num lugar só.</p>
        {progresso !== null ? <progress className="h-1.5 w-full accent-violeta-600" max={100} value={progresso} aria-label="Envio do arquivo" /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" disabled={progresso !== null} onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={!arquivo || Boolean(problema) || progresso !== null}>
            <Icone nome="enviar" />{progresso !== null ? "Enviando…" : atual ? "Enviar a versão nova" : "Enviar o contrato"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
