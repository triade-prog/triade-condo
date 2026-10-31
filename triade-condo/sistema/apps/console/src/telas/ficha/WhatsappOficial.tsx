"use client";
// Ficha do cliente › WhatsApp com o número oficial pela Meta (F5.12; W-01, W-17, DC4; quadro 465):
// o número, a qualidade e o limite que a Meta dá, o cartão, as contas da Meta e os modelos deste
// condomínio, cada um com a situação e o motivo da recusa. O PIN e o token nunca aparecem. A
// conexão de piloto (Wafly, QR) continua na mesma aba para quem ainda usa.

import { useState, type ReactNode } from "react";
import {
  formatarDataHora, LINK_GERENCIADOR_META, mostrarTelefone, QUALIDADES_META, SITUACOES_MODELO_CONDOMINIO,
  type QualidadeMeta, type SituacaoModeloCondominio,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

interface DadosMeta {
  ligada: boolean;
  wabaId?: string;
  numeroId?: string;
  empresaId?: string;
  ligadaEm?: string;
  ligadaPor?: string;
  modelos?: { chave: string; titulo: string; nome?: string; situacao: SituacaoModeloCondominio; motivo?: string; enviadoEm?: string; decididoEm?: string }[];
  pode?: { conectar: boolean };
}

export interface ConexaoOficialFicha {
  nomeExibicao?: string;
  qualidade?: QualidadeMeta;
  limiteDiario?: number;
  faltaCartaoEm?: string;
  suspensoEm?: string;
  ultimaRecebida?: string;
}

const TOM_QUALIDADE: Record<QualidadeMeta, Tom> = { VERDE: "ok", AMARELO: "atencao", VERMELHO: "erro", DESCONHECIDA: "neutro" };
const TOM_MODELO: Record<SituacaoModeloCondominio, Tom> = { ENVIADO: "atencao", APROVADO: "ok", RECUSADO: "erro", PAUSADO: "atencao", DESATIVADO: "neutro", FALHOU: "erro" };

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">{rotulo}</dt><dd className="t-texto">{children}</dd></div>;
}

/** O número oficial e os modelos deste condomínio (quadro 465). */
export function WhatsappOficial({ id, numeroFicha, cx }: { id: string; numeroFicha: string | null; cx: ConexaoOficialFicha }) {
  const carga = useCarregar<DadosMeta>(`/v1/clientes/${id}/whatsapp/meta`);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o número oficial…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const modelos = d.modelos ?? [];
  const conta = (s: SituacaoModeloCondominio[]) => modelos.filter((m) => s.includes(m.situacao)).length;
  const aprovados = conta(["APROVADO"]);
  const emAnalise = conta(["ENVIADO"]);
  const recusados = conta(["RECUSADO", "PAUSADO", "FALHOU"]);

  async function mandarModelos() {
    setErro(null);
    setRecado(null);
    setEnviando(true);
    const r = await chamarApi<{ modelosEnviados: number }>(`/v1/clientes/${id}/whatsapp/meta/modelos`, { corpo: {} });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const n = r.dados.modelosEnviados;
    setRecado(n === 0 ? "Nenhum modelo faltando: todos já estão na Meta." : `${n} ${n === 1 ? "modelo mandado" : "modelos mandados"} para a Meta aprovar.`);
    carga.recarregar();
  }

  const situacao = cx.suspensoEm ? <Selo tom="erro">Fora do ar</Selo> : <Selo tom="ok">Ligado</Selo>;
  return (
    <div className="grid max-w-5xl gap-4">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {cx.suspensoEm ? (
        <Aviso tom="erro" papel="status" titulo="A Meta suspendeu o número">Desde {formatarDataHora(cx.suspensoEm)}. O síndico vê o aviso em Configurações › WhatsApp.</Aviso>
      ) : null}
      {cx.faltaCartaoEm ? (
        <Aviso tom="erro" papel="status" titulo="Falta o cartão na Meta">
          Desde {formatarDataHora(cx.faltaCartaoEm)} a Meta não aceita cobrar os avisos. As respostas ao morador saem; os avisos esperam o síndico pôr o cartão.
        </Aviso>
      ) : null}
      <section aria-labelledby="t-numero-oficial" className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ladrilho h-10 w-10" data-tom={cx.suspensoEm ? "erro" : "ok"} aria-hidden="true"><Icone nome="whats" /></span>
          <h2 id="t-numero-oficial" className="flex-1 t-titulo-secao font-medium">Número oficial</h2>
          {situacao}<Selo tom="info">Oficial (Meta)</Selo>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dado rotulo="Número"><span className="t-codigo">{numeroFicha ? mostrarTelefone(numeroFicha) : "Sem número na ficha"}</span></Dado>
          <Dado rotulo="Nome que aparece">{cx.nomeExibicao ?? "Ainda não informado"}</Dado>
          <Dado rotulo="Qualidade">{cx.qualidade ? <Selo tom={TOM_QUALIDADE[cx.qualidade]}>{QUALIDADES_META[cx.qualidade]}</Selo> : "Ainda sem nota"}</Dado>
          <Dado rotulo="Avisos por dia">{cx.limiteDiario ? `${cx.limiteDiario.toLocaleString("pt-BR")} moradores diferentes` : "A Meta ainda não informou"}</Dado>
          <Dado rotulo="Conta do WhatsApp (WABA)"><span className="t-codigo">{d.wabaId}</span></Dado>
          <Dado rotulo="Empresa na Meta"><span className="t-codigo">{d.empresaId ?? "—"}</span></Dado>
          <Dado rotulo="Cartão na Meta">{cx.faltaCartaoEm ? <Selo tom="erro">Faltando</Selo> : <Selo tom="neutro">Sem recusa de cobrança</Selo>}</Dado>
          <Dado rotulo="Ligado em">{d.ligadaEm ? `${formatarDataHora(d.ligadaEm)}${d.ligadaPor ? ` por ${d.ligadaPor}` : ""}` : "—"}</Dado>
          {cx.ultimaRecebida ? <Dado rotulo="Última mensagem recebida">{formatarDataHora(cx.ultimaRecebida)}</Dado> : null}
        </dl>
        <div className="flex flex-wrap gap-3">
          <a href={LINK_GERENCIADOR_META} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
            <Icone nome="link" className="h-4 w-4" />Gerenciador do WhatsApp<span className="sr-only"> (abre numa aba nova)</span>
          </a>
        </div>
      </section>
      <section aria-labelledby="t-modelos-cliente" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="documento" className="h-4 w-4" /></span>
          <h2 id="t-modelos-cliente" className="flex-1 t-titulo-secao font-medium">Modelos de mensagem deste condomínio</h2>
          <Selo tom="neutro">{aprovados} {aprovados === 1 ? "aprovado" : "aprovados"} · {emAnalise} em análise · {recusados} {recusados === 1 ? "recusado" : "recusados"}</Selo>
        </div>
        <p className="t-apoio text-tinta-suave">
          Cada condomínio tem os seus, aprovados na conta dele. O texto vem do catálogo da TRÍADE (Console › WhatsApp › Modelos de mensagem).
        </p>
        {modelos.length === 0 ? <p className="t-apoio text-tinta-suave">Nenhum modelo mandado ainda.</p> : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Modelos, role para o lado">
            <table className="w-full border-collapse t-texto">
              <thead>
                <tr className="text-left t-apoio text-tinta-suave">
                  <th scope="col" className="px-3 py-2 font-medium">Modelo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Nome na Meta</th>
                  <th scope="col" className="px-3 py-2 font-medium">Situação</th>
                  <th scope="col" className="px-3 py-2 font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={`${m.chave}-${m.nome ?? ""}`} className="border-t border-linha">
                    <td className="px-3 py-2 font-medium">{m.titulo}</td>
                    <td className="px-3 py-2"><span className="t-codigo text-tinta-suave">{m.nome ?? m.chave}</span></td>
                    <td className="px-3 py-2"><Selo tom={TOM_MODELO[m.situacao]}>{SITUACOES_MODELO_CONDOMINIO[m.situacao]}</Selo></td>
                    <td className="px-3 py-2 t-apoio text-tinta-suave">
                      {m.motivo ? `“${m.motivo}”` : m.decididoEm ? `decidido em ${formatarDataHora(m.decididoEm)}` : m.enviadoEm ? `enviado em ${formatarDataHora(m.enviadoEm)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.pode?.conectar ? (
          <div>
            <Botao variante="contorno" tamanho="m" disabled={enviando} onClick={() => void mandarModelos()}>
              <Icone nome="enviar" />{enviando ? "Mandando…" : "Mandar os modelos que faltam"}
            </Botao>
          </div>
        ) : null}
      </section>
    </div>
  );
}
