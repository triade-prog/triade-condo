"use client";
// Um pedido de suporte de acesso (PI-09): a verificação (vínculo ativo, dados que só a pessoa
// sabe, canal já conhecido) e a decisão. O link de senha nova vai só para o e-mail já cadastrado,
// que aparece mascarado; o autenticador perdido e o caso duvidoso ficam com a administração.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CANAIS_SUPORTE, formatarData, formatarDataHora, SITUACOES_SUPORTE_ACESSO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, Carregando, chamarApi, ErroCarregar, IconeMarca, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { TOM_SUPORTE, type PedidoAcesso } from "./SuporteAcesso.tsx";

interface Detalhe extends PedidoAcesso {
  emailMascarado: string | null;
  pode: { verificar: boolean; decidir: boolean; tirarAutenticador: boolean };
}

const NOMES_FUNCAO: Record<string, string> = { SINDICO: "síndico", AUTORIZADO: "pessoa autorizada" };

export function PedidoSuporteAcesso() {
  const { condominio, pedido } = useParams<{ condominio: string; pedido: string }>();
  const base = `/v1/clientes/${condominio}/suporte-acesso/${pedido}`;
  const carga = useCarregar<Detalhe>(base);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const p = carga.dados;

  async function verificar(campo: "tipo" | "dadosConferidos" | "canalConhecido", valor: string | boolean) {
    setErro(null);
    const corpo = { versao: p.versao, tipo: p.tipo, dadosConferidos: p.dadosConferidos, canalConhecido: p.canalConhecido, [campo]: valor };
    const r = await chamarApi(`${base}/verificar`, { metodo: "PUT", corpo });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }

  async function decidir(decisao: "ENVIAR" | "TIRAR_AUTENTICADOR" | "DUVIDOSO" | "RECUSAR") {
    setErro(null);
    const r = await chamarApi(`${base}/decidir`, { corpo: { versao: p.versao, decisao, motivo } });
    if (!r.ok) return setErro(r.erro);
    setRecado({
      ENVIAR: "Link para criar senha nova enviado ao e-mail cadastrado.",
      TIRAR_AUTENTICADOR: "Autenticador tirado. No próximo acesso a pessoa cadastra outro.",
      DUVIDOSO: "Caso passado à administração.",
      RECUSAR: "Pedido recusado.",
    }[decisao]);
    carga.recarregar();
  }

  const checks = [
    { ok: !!p.vinculo, texto: p.vinculo ? `Tem vínculo ativo no ${p.condominio} (${p.vinculo.funcoes.map((f) => NOMES_FUNCAO[f] ?? f).join(", ")} desde ${formatarData(p.vinculo.desde)})` : "Sem vínculo ativo neste condomínio" },
  ];
  const aberto = p.situacao === "ABERTO" || p.situacao === "DUVIDOSO";
  const verificado = !!p.vinculo && p.dadosConferidos && p.canalConhecido;

  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/suporte-acesso" className="text-violeta-600 hover:underline">Voltar ao suporte de acesso</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Pedido de {p.pessoa}</h1>
          <p className="text-tinta-suave">{p.condominio} · recebido por {CANAIS_SUPORTE[p.canal]} em {formatarDataHora(p.criadoEm)} · atendido por {p.atendidoPor}</p>
        </div>
        <Selo tom={TOM_SUPORTE[p.situacao]}>{SITUACOES_SUPORTE_ACESSO[p.situacao]}</Selo>
      </div>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}
      {p.descricao ? <p className="rounded-2xl border border-linha bg-superficie p-4">&ldquo;{p.descricao}&rdquo;</p> : null}
      {p.motivo ? <Aviso tom="atencao" titulo="Motivo registrado">{p.motivo}</Aviso> : null}

      <fieldset className="grid gap-2" disabled={!p.pode.verificar}>
        <legend className="mb-1 text-sm font-medium">O que aconteceu</legend>
        <div className="trilho flex-wrap">
          {Object.entries(TIPOS_SUPORTE_ACESSO).map(([k, t]) => (
            <button key={k} type="button" className="chip" aria-pressed={p.tipo === k} onClick={() => verificar("tipo", k)}>{t}</button>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4" aria-labelledby="titulo-verificacao">
        <h2 id="titulo-verificacao" className="font-medium">Verificação</h2>
        {checks.map((c) => (
          <p key={c.texto} className="flex items-start gap-2 text-sm">
            <span className={c.ok ? "text-ok" : "text-erro"}><IconeMarca marca={c.ok ? "ok" : "atencao"} className="mt-1 h-3.5 w-3.5" /></span>{c.texto}
          </p>
        ))}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={p.dadosConferidos} disabled={!p.pode.verificar} onChange={(e) => verificar("dadosConferidos", e.target.checked)} />
          Confirmou dados que só a pessoa sabe, sem a equipe ver a senha
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={p.canalConhecido} disabled={!p.pode.verificar} onChange={(e) => verificar("canalConhecido", e.target.checked)} />
          Pedido feito pelo canal já conhecido (o e-mail ou o telefone do cadastro)
        </label>
        <Aviso tom="info">
          A redefinição vai só para o e-mail já cadastrado{p.emailMascarado ? ` ${p.emailMascarado}` : ""}. A equipe nunca vê nem escolhe a senha e nunca muda o e-mail por aqui.
        </Aviso>
      </section>

      {aberto && p.pode.decidir ? (
        <section className="grid gap-3" aria-label="Decisão">
          <CampoAreaTexto id="sa-motivo" rotulo="Motivo (para passar à administração ou recusar)" opcional maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {p.tipo !== "AUTENTICADOR" ? <Botao disabled={!verificado} onClick={() => decidir("ENVIAR")}>Enviar link para criar senha nova</Botao> : null}
            {p.tipo === "AUTENTICADOR" && p.pode.tirarAutenticador ? <Botao disabled={!verificado} onClick={() => decidir("TIRAR_AUTENTICADOR")}>Tirar o autenticador perdido</Botao> : null}
            {p.situacao === "ABERTO" ? <Botao variante="secundario" onClick={() => decidir("DUVIDOSO")}>Caso duvidoso: passar à administração</Botao> : null}
            <Botao variante="contorno" onClick={() => decidir("RECUSAR")}>Recusar com motivo</Botao>
          </div>
          {p.tipo === "AUTENTICADOR" && !p.pode.tirarAutenticador ? <p className="text-sm text-tinta-suave">Autenticador perdido só sai com a administração: passe o caso a ela.</p> : null}
        </section>
      ) : null}
      {p.situacao === "DUVIDOSO" && !p.pode.decidir ? <Aviso tom="atencao">Este caso está com a administração.</Aviso> : null}
    </div>
  );
}
