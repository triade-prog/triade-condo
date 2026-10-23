"use client";
// Um pedido de suporte de acesso (PI-09; DC15, telas-modelo console-suporte-acesso-verificar e
// console-suporte-acesso-decidir, rodada Console de 23/10/2026): dois passos, Verificar (vínculo
// ativo, dados que só a pessoa sabe, canal já conhecido) e Decidir. Enviar link é a saída
// principal e só sai com as três conferências; o caso duvidoso e a recusa ficam em Outras saídas,
// com o motivo só na escolhida. O link vai só para o e-mail já cadastrado, que aparece mascarado;
// o autenticador perdido e o caso duvidoso ficam com a administração.

import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { formatarData, SITUACOES_SUPORTE_ACESSO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, Carregando, chamarApi, ErroCarregar, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { Cartao, diaHora, plural, Voltar } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { PELO_CANAL, pedidoAberto, TOM_SUPORTE, type PedidoAcesso } from "./SuporteAcesso.tsx";

interface Detalhe extends PedidoAcesso {
  emailMascarado: string | null;
  pode: { verificar: boolean; decidir: boolean; tirarAutenticador: boolean };
}

type Decisao = "ENVIAR" | "TIRAR_AUTENTICADOR" | "DUVIDOSO" | "RECUSAR";

const NOMES_FUNCAO: Record<string, string> = { SINDICO: "Síndico", AUTORIZADO: "Pessoa autorizada" };

/** Uma conferência: feita pelo sistema (só o ícone) ou marcada pela equipe (caixa). */
function Conferencia({ ok, titulo, apoio, marcar }: { ok: boolean; titulo: string; apoio: string; marcar?: { desligado: boolean; aoMudar: (v: boolean) => void } }) {
  const corpo = (
    <span className="grid gap-0.5">
      <span className="text-[15px] font-medium">{titulo}</span>
      <span className="t-apoio">{apoio}</span>
    </span>
  );
  if (!marcar) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] border border-linha px-4 py-3">
        <span className="ladrilho h-6 w-6 rounded-full" data-tom={ok ? "ok" : "erro"} aria-hidden="true"><Icone nome={ok ? "check" : "alerta"} className="h-3.5 w-3.5" /></span>
        {corpo}
      </div>
    );
  }
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-linha px-4 py-3 has-checked:border-violeta-300 has-checked:bg-violeta-50/60">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={ok} disabled={marcar.desligado} onChange={(e) => marcar.aoMudar(e.target.checked)} />
      {corpo}
    </label>
  );
}

/** Uma saída de Outras saídas, em cartão de escolha; o motivo aparece só na escolhida. */
function Saida({ valor, escolhida, aoEscolher, titulo, apoio, children }: {
  valor: Decisao; escolhida: Decisao | null; aoEscolher: (v: Decisao) => void; titulo: string; apoio: string; children: ReactNode;
}) {
  const marcada = escolhida === valor;
  return (
    <div className={`grid gap-3 rounded-[14px] border px-4 py-3.5 ${marcada ? "border-violeta-600 bg-violeta-50 ring-1 ring-violeta-600" : "border-linha bg-superficie"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="radio" name="saida" value={valor} checked={marcada} onChange={() => aoEscolher(valor)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
        <span className="grid gap-0.5">
          <span className="text-[15px] font-medium">{titulo}</span>
          <span className="t-apoio">{apoio}</span>
        </span>
      </label>
      {marcada ? children : null}
    </div>
  );
}

export function PedidoSuporteAcesso() {
  const { condominio, pedido } = useParams<{ condominio: string; pedido: string }>();
  const base = `/v1/clientes/${condominio}/suporte-acesso/${pedido}`;
  const carga = useCarregar<Detalhe>(base);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [saida, setSaida] = useState<Decisao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const voltar = <Voltar href="/suporte-acesso" texto="Voltar ao suporte de acesso" />;

  if (carga.estado === "carregando") return <Carregando />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const p = carga.dados;

  async function verificar(campo: "tipo" | "dadosConferidos" | "canalConhecido", valor: string | boolean) {
    setErro(null);
    const corpo = { versao: p.versao, tipo: p.tipo, dadosConferidos: p.dadosConferidos, canalConhecido: p.canalConhecido, [campo]: valor };
    const r = await chamarApi(`${base}/verificar`, { metodo: "PUT", corpo });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }

  async function decidir(decisao: Decisao) {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`${base}/decidir`, { corpo: { versao: p.versao, decisao, motivo } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setRecado({
      ENVIAR: "Link para criar senha nova enviado ao e-mail cadastrado.",
      TIRAR_AUTENTICADOR: "Autenticador tirado. No próximo acesso a pessoa cadastra outro.",
      DUVIDOSO: "Caso passado à administração.",
      RECUSAR: "Pedido recusado.",
    }[decisao]);
    setSaida(null);
    setMotivo("");
    carga.recarregar();
  }

  const aberto = pedidoAberto(p);
  const conferidas = [!!p.vinculo, p.dadosConferidos, p.canalConhecido].filter(Boolean).length;
  const verificado = conferidas === 3;
  const decidindo = aberto && p.pode.decidir && passo === 2;
  const nomes: Record<string, string> = { vinculo: "vínculo", dados: "dados", canal: "canal" };
  const feitas = [p.vinculo ? nomes.vinculo : null, p.dadosConferidos ? nomes.dados : null, p.canalConhecido ? nomes.canal : null].filter(Boolean) as string[];
  const autenticador = p.tipo === "AUTENTICADOR";

  return (
    <div className="grid max-w-[760px] gap-5">
      {voltar}
      {aberto && p.pode.decidir ? (
        <div className="grid gap-2">
          <span className="t-rotulo">Passo {passo} de 2</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(["Verificar", "Decidir"] as const).map((t, i) => (
              <span key={t} className="grid gap-1.5">
                <span className={`h-1.5 rounded-full ${i < passo ? "bg-violeta-600" : "bg-superficie-2"}`} aria-hidden="true" />
                <span className={i + 1 === passo ? "font-semibold text-violeta-600" : "text-tinta-suave"} aria-current={i + 1 === passo ? "step" : undefined}>{t}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <header className="grid gap-2">
        <span className="selo justify-self-start" data-tom={TOM_SUPORTE[p.situacao]}>{SITUACOES_SUPORTE_ACESSO[p.situacao]}</span>
        <h1 className="t-titulo-tela">Pedido de {p.pessoa}</h1>
        <p className="t-apoio">{p.condominio} · {PELO_CANAL[p.canal]} em {diaHora(p.criadoEm)} · com {p.atendidoPor}</p>
      </header>
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}
      {p.motivo ? <Aviso tom="atencao" titulo="Motivo registrado">{p.motivo}</Aviso> : null}
      {p.situacao === "DUVIDOSO" && !p.pode.decidir ? <Aviso tom="atencao">Este caso está com a administração.</Aviso> : null}

      {decidindo ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-linha bg-superficie px-4 py-3">
            <span className="ladrilho" data-tom={verificado ? "ok" : "atencao"} aria-hidden="true"><Icone nome={verificado ? "check" : "alerta"} /></span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-semibold">{conferidas} de 3 conferências</span>
              <span className="t-apoio">{TIPOS_SUPORTE_ACESSO[p.tipo]}{feitas.length ? ` · ${feitas.join(", ").replace(/, ([^,]*)$/, " e $1")} ${feitas.length === 1 ? "conferido" : "conferidos"}` : " · nada conferido"}</span>
            </span>
            <Botao variante="discreto" tamanho="m" onClick={() => setPasso(1)}>Rever</Botao>
          </div>

          {!autenticador ? (
            <Cartao id="t-enviar" titulo="Enviar link para criar senha nova" icone="email">
              <p className="t-apoio">
                O link vai só para o e-mail já cadastrado{p.emailMascarado ? <>, <span className="t-codigo">{p.emailMascarado}</span></> : null}. A equipe nunca vê nem escolhe a senha e nunca muda o e-mail por aqui.
              </p>
              {!verificado ? <p className="text-sm text-atencao">Sem as três conferências, o link não sai. Volte e reveja.</p> : null}
              <Botao className="justify-self-start max-md:justify-self-stretch" disabled={!verificado || enviando} onClick={() => void decidir("ENVIAR")}><Icone nome="enviar" />Enviar link</Botao>
            </Cartao>
          ) : p.pode.tirarAutenticador ? (
            <Cartao id="t-autenticador" titulo="Tirar o autenticador perdido" icone="cadeado">
              <p className="t-apoio">No próximo acesso, a pessoa entra com a senha e cadastra outro autenticador.</p>
              {!verificado ? <p className="text-sm text-atencao">Sem as três conferências, o autenticador não sai. Volte e reveja.</p> : null}
              <Botao className="justify-self-start max-md:justify-self-stretch" disabled={!verificado || enviando} onClick={() => void decidir("TIRAR_AUTENTICADOR")}>Tirar o autenticador</Botao>
            </Cartao>
          ) : (
            <Aviso tom="info" titulo="Autenticador perdido só sai com a administração">Passe o caso a ela em Outras saídas.</Aviso>
          )}

          <details className="group grid rounded-[18px] border border-linha bg-superficie shadow-s1" open={autenticador && !p.pode.tirarAutenticador ? true : undefined}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold">
              Outras saídas<Icone nome="baixo" className="h-5 w-5 text-tinta-suave group-open:rotate-180" />
            </summary>
            <fieldset className="grid gap-2.5 border-t border-linha p-5 max-md:p-4">
              <legend className="sr-only">Outras saídas</legend>
              {(["DUVIDOSO", "RECUSAR"] as const).filter((d) => d !== "DUVIDOSO" || p.situacao === "ABERTO").map((d) => {
                const duvidoso = d === "DUVIDOSO";
                return (
                  <Saida key={d} valor={d} escolhida={saida} aoEscolher={(v) => { setSaida(v); setMotivo(""); }}
                    titulo={duvidoso ? "Caso duvidoso: passar à administração" : "Recusar"}
                    apoio={duvidoso ? "Quando algo não bate. A administração decide." : "Quando não dá para confirmar que é a pessoa."}>
                    <CampoAreaTexto id="sa-motivo" rotulo={duvidoso ? "O que não bate" : "Motivo da recusa"} maxLength={500} placeholder="Escreva o motivo"
                      value={motivo} onChange={(e) => setMotivo(e.target.value)} ajuda="Fica no histórico do pedido." />
                    <Botao variante={duvidoso ? "secundario" : "perigo"} tamanho="m" className="justify-self-start max-md:justify-self-stretch"
                      disabled={!motivo.trim() || enviando} onClick={() => void decidir(d)}>
                      {duvidoso ? "Passar à administração" : "Recusar com este motivo"}
                    </Botao>
                  </Saida>
                );
              })}
            </fieldset>
          </details>
        </>
      ) : (
        <>
          {p.descricao ? <blockquote className="rounded-[16px] border-l-4 border-violeta-300 bg-superficie px-4 py-3 text-[15px]">&ldquo;{p.descricao}&rdquo;</blockquote> : null}
          <Cartao id="t-verificacao" titulo="Verificação" icone="escudo">
            <fieldset className="grid gap-2" disabled={!p.pode.verificar || !aberto}>
              <legend className="t-rotulo mb-1">O que aconteceu</legend>
              <div className="trilho justify-self-start">
                {Object.entries(TIPOS_SUPORTE_ACESSO).map(([k, t]) => (
                  <button key={k} type="button" className="chip" aria-pressed={p.tipo === k} onClick={() => void verificar("tipo", k)}>{t}</button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2">
              <Conferencia ok={!!p.vinculo}
                titulo={p.vinculo ? `Tem vínculo ativo no ${p.condominio}` : "Sem vínculo ativo neste condomínio"}
                apoio={p.vinculo ? `${p.vinculo.funcoes.map((f) => NOMES_FUNCAO[f] ?? f).join(", ")} desde ${formatarData(p.vinculo.desde)} · conferido pelo sistema` : "Conferido pelo sistema: sem vínculo, o acesso não volta."} />
              <Conferencia ok={p.dadosConferidos} titulo="Confirmou dados que só a pessoa sabe" apoio="Sem a equipe ver a senha"
                marcar={{ desligado: !p.pode.verificar || !aberto, aoMudar: (v) => void verificar("dadosConferidos", v) }} />
              <Conferencia ok={p.canalConhecido} titulo="Pedido feito pelo canal já conhecido" apoio="O e-mail ou o telefone do cadastro"
                marcar={{ desligado: !p.pode.verificar || !aberto, aoMudar: (v) => void verificar("canalConhecido", v) }} />
            </div>
            {aberto && p.pode.decidir ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-4">
                <Botao onClick={() => setPasso(2)} className="max-md:w-full">Continuar para decidir<Icone nome="dir" /></Botao>
                <span className="t-apoio flex-1">
                  {verificado ? "As três conferências feitas." : `${conferidas === 2 ? "Falta 1 conferência" : `Faltam ${plural(3 - conferidas, "conferência", "conferências")}`}. Dá para decidir mesmo assim: sem as três, o link não sai.`}
                </span>
              </div>
            ) : null}
          </Cartao>
        </>
      )}
    </div>
  );
}
