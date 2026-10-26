"use client";
// Parceiros (quadro 339, CM-22, O.1): quem indica condomínios para a TRÍADE, com as abas de ativos,
// indicações do mês e sem indicação há 90 dias, a comissão do mês de cada um e a regra. A regra é
// da Administração (console.comercial.comissao); o Comercial cadastra e indica. A comissão é
// calculada pelo banco e paga fora do sistema.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FAIXAS_PRECO, mesComercialSchema, TEXTO_PAGAMENTO_FORA, TIPOS_PARCEIRO, type TipoParceiro } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Interruptor, Selo, Vazio, type ErroApi } from "@triade/ui";
import { AbasLista, CabecaPagina, Cartao, plural } from "../comum.tsx";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeLocal } from "./comum.tsx";
import { mesesDoSeletor, reais, textoMes } from "./painel.ts";
import {
  contarAbas, filtrarParceiros, linhasRegra, nomeTipo, ROTAS_PARCEIROS, TELAS_PARCEIROS, textoPercentual, type AbaParceiros, type ParceiroLinha, type RegraComissao,
  type TelaParceiros,
} from "./parceiros.ts";

const TIPOS = (Object.keys(TIPOS_PARCEIRO) as TipoParceiro[]).map((t) => ({ valor: t, texto: TIPOS_PARCEIRO[t] }));
const FAIXAS = Object.entries(FAIXAS_PRECO).map(([valor, f]) => ({ valor, texto: f.nome }));
const erroDe = (campos: string[], nome: string, texto: string) => (campos.includes(nome) ? texto : undefined);

/** Os meses do seletor: o atual e os 12 de antes (o extrato do mês que vem ainda não existe). */
export const mesesParceiros = (atual: string) => mesesDoSeletor(atual).slice(1);

/** Novo parceiro ou mudança no cadastro (o mesmo WhatsApp, e-mail ou CNPJ não entra duas vezes). */
export function JanelaParceiro({ p, aoFechar, feito }: { p?: ParceiroLinha; aoFechar: () => void; feito: (id: string) => void }) {
  const [tipo, setTipo] = useState<TipoParceiro | null>(p?.tipo ?? null);
  const [f, setF] = useState({ nome: p?.nome ?? "", whatsapp: p?.whatsapp ?? "", email: p?.email ?? "", cnpj: p?.cnpj ?? "", observacao: p?.observacao ?? "" });
  const [ativo, setAtivo] = useState(p?.ativo ?? true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const duplicado = erro?.detalhes?.motivo === "DUPLICADO";
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const corpo = { ...f, tipo, ativo, ...(p ? { versao: p.versao } : {}) };
    const r = await chamarApi<{ id: string }>(p ? ROTAS_PARCEIROS.parceiro(p.id) : ROTAS_PARCEIROS.novo, { metodo: p ? "PUT" : "POST", corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.id);
  }

  return (
    <Dialogo aberto titulo={p ? `Editar ${p.nome}` : "Novo parceiro"} aoFechar={aoFechar} media
      apoio="Síndico profissional, administradora, construtora ou cliente que indica. Quem chega por ele entra com a origem Parceiro e o nome dele.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <EscolhaBotoes nome="parceiro-tipo" legenda="Tipo" opcoes={TIPOS} valor={tipo} aoMudar={setTipo}
          ajuda={campos.includes("tipo") ? <span className="text-erro">Escolha o tipo de parceiro.</span> : undefined} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="parceiro-nome" rotulo="Nome" maxLength={120} value={f.nome} onChange={muda("nome")} autoComplete="off"
            erro={erroDe(campos, "nome", "Escreva o nome do parceiro.")} />
          <CampoTexto id="parceiro-whatsapp" rotulo="WhatsApp" opcional type="tel" inputMode="tel" maxLength={30} value={f.whatsapp} onChange={muda("whatsapp")}
            erro={erroDe(campos, "whatsapp", duplicado ? "Este contato já é de outro parceiro." : "WhatsApp com DDD, do Brasil.")} />
          <CampoTexto id="parceiro-email" rotulo="E-mail" opcional type="email" maxLength={120} value={f.email} onChange={muda("email")}
            erro={erroDe(campos, "email", duplicado ? "Este contato já é de outro parceiro." : "Confira o e-mail.")} />
          <CampoTexto id="parceiro-cnpj" rotulo="CNPJ" opcional maxLength={20} value={f.cnpj} onChange={muda("cnpj")}
            erro={erroDe(campos, "cnpj", duplicado ? "Este CNPJ já é de outro parceiro." : "CNPJ com 14 dígitos.")} />
        </div>
        <CampoAreaTexto id="parceiro-obs" rotulo="Observação" opcional maxLength={500} rows={3} value={f.observacao} onChange={muda("observacao")}
          ajuda="Como combinar o pagamento (Pix, conta), quem é o contato. Só a equipe vê." erro={erroDe(campos, "observacao", "Observação de 2 a 500 letras.")} />
        {p ? (
          <Interruptor id="parceiro-ativo" rotulo="Parceiro ativo" marcado={ativo} aoMudar={setAtivo}
            ajuda="Inativo não recebe indicação nova. As comissões dos prédios que já indicou continuam." />
        ) : null}
        {duplicado && !campos.length ? <Aviso tom="atencao">Este contato já é de outro parceiro.</Aviso> : null}
        {erro && !campos.length && !duplicado ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={p ? "Salvar" : "Cadastrar parceiro"} icone={p ? "check" : "mais"} />
      </form>
    </Dialogo>
  );
}

/** A regra da comissão: só a Administração muda; vale para os prédios que virarem cliente depois. */
function JanelaRegra({ r, aoFechar, feito }: { r: RegraComissao; aoFechar: () => void; feito: () => void }) {
  const [percentual, setPercentual] = useState(String(r.percentual).replace(".", ","));
  const [prazo, setPrazo] = useState(r.prazoMeses ? String(r.prazoMeses) : "");
  const [falha, setFalha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const pct = Number(percentual.trim().replace(",", "."));
    const meses = prazo.trim() ? Number(prazo.trim()) : null;
    const f: Record<string, string> = {};
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || Math.round(pct * 100) !== pct * 100) f.percentual = "De 0,01% a 100%, com até duas casas.";
    if (meses !== null && (!Number.isInteger(meses) || meses < 1 || meses > 120)) f.prazoMeses = "De 1 a 120 meses, ou vazio.";
    setFalha(f);
    if (Object.keys(f).length) return;
    setEnviando(true);
    const res = await chamarApi(ROTAS_PARCEIROS.regra, { metodo: "PUT", corpo: { versao: r.versao, percentual: pct, prazoMeses: meses } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Regra da comissão" aoFechar={aoFechar} media
      apoio="Vale para os prédios que virarem cliente depois de salvar. Quem já é cliente fica com o percentual e o prazo do dia em que virou.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="regra-percentual" rotulo="Percentual da mensalidade (%)" inputMode="decimal" maxLength={6} value={percentual}
            onChange={(e) => setPercentual(e.target.value)} erro={falha.percentual} />
          <CampoTexto id="regra-prazo" rotulo="Por quantos meses" opcional inputMode="numeric" maxLength={3} value={prazo} onChange={(e) => setPrazo(e.target.value)}
            ajuda="Vazio: enquanto o prédio for cliente." erro={falha.prazoMeses} />
        </div>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a regra" />
      </form>
    </Dialogo>
  );
}

/** A indicação (quadro 339): um interessado novo com a origem Parceiro e o nome dele. */
export function JanelaIndicar({ p, aoFechar, feito }: { p: Pick<ParceiroLinha, "id" | "nome">; aoFechar: () => void; feito: (id: string, juntado: boolean) => void }) {
  const [f, setF] = useState({ pessoa: "", whatsapp: "", email: "", condominio: "", cidade: "", uf: "", faixa: "" });
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi<{ id: string; juntado: boolean }>(ROTAS_PARCEIROS.indicar(p.id), {
      corpo: { ...f, faixa: f.faixa || null, uf: f.uf || null, contatoAceito: aceito },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados.id, r.dados.juntado);
  }

  return (
    <Dialogo aberto titulo={`Indicação de ${p.nome}`} aoFechar={aoFechar} media
      apoio="Entra como Novo, com a origem Parceiro e o nome dele. Se o contato já estiver no Comercial, junta no que existe e não vira indicação.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="indicar-condominio" rotulo="Condomínio" maxLength={120} value={f.condominio} onChange={muda("condominio")}
            erro={erroDe(campos, "condominio", "Escreva o nome do condomínio.")} />
          <CampoTexto id="indicar-pessoa" rotulo="Nome da pessoa" opcional maxLength={80} value={f.pessoa} onChange={muda("pessoa")} />
          <CampoTexto id="indicar-whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" maxLength={30} value={f.whatsapp} onChange={muda("whatsapp")}
            erro={erroDe(campos, "whatsapp", "WhatsApp com DDD, do Brasil. Sem WhatsApp, informe o e-mail.")} />
          <CampoTexto id="indicar-email" rotulo="E-mail" opcional type="email" maxLength={120} value={f.email} onChange={muda("email")} erro={erroDe(campos, "email", "Confira o e-mail.")} />
          <CampoTexto id="indicar-cidade" rotulo="Cidade" opcional maxLength={80} value={f.cidade} onChange={muda("cidade")} />
          <CampoTexto id="indicar-uf" rotulo="UF" opcional maxLength={2} value={f.uf} onChange={muda("uf")} erro={erroDe(campos, "uf", "Duas letras, como DF.")} />
          <CampoSelecao id="indicar-faixa" rotulo="Faixa de unidades" opcional value={f.faixa} onChange={muda("faixa")} opcoes={[{ valor: "", texto: "Ainda não sei" }, ...FAIXAS]} />
        </div>
        <Interruptor id="indicar-aceito" rotulo="A pessoa aceitou o contato da TRÍADE" marcado={aceito} aoMudar={setAceito}
          ajuda="O parceiro combinou com a pessoa que a TRÍADE vai procurar. Sem isso o interessado não entra." />
        {campos.includes("contatoAceito") ? <span className="t-apoio text-erro">Sem isso o interessado não entra.</span> : null}
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar a indicação" icone="mais" />
      </form>
    </Dialogo>
  );
}

function TabelaParceiros({ lista, mes }: { lista: ParceiroLinha[]; mes: string | null }) {
  return (
    <>
      <table className="w-full t-texto max-md:hidden">
        <caption className="sr-only">Parceiros, indicações, prédios ativos e comissão do mês</caption>
        <thead>
          <tr className="t-rotulo text-left text-tinta-suave">
            <th scope="col" className="px-5 py-2.5 font-medium">Parceiro</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Tipo</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Indicações</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Prédios ativos</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Comissão do mês</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {lista.map((p) => (
            <tr key={p.id} className="hover:bg-violeta-50/50">
              <th scope="row" className="px-5 py-3 text-left font-normal">
                <Link href={TELAS_PARCEIROS.parceiro(p.id, mes)} className="font-medium hover:text-violeta-600 hover:underline">{p.nome}</Link>
                {!p.ativo ? <span className="ml-2"><Selo tom="neutro">{p.anonimizado ? "Dado apagado" : "Inativo"}</Selo></span> : null}
              </th>
              <td className="px-3 py-3">{nomeTipo(p.tipo)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{p.indicacoes}</td>
              <td className="px-3 py-3 text-right tabular-nums">{p.prediosAtivos}</td>
              <td className="px-5 py-3 text-right tabular-nums">{reais(p.comissaoMes)}{p.pagoMes ? <span className="block t-apoio text-ok">pago</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-3 md:hidden" aria-label="Parceiros">
        {lista.map((p) => (
          <li key={p.id} className="relative grid gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
            <Link href={TELAS_PARCEIROS.parceiro(p.id, mes)} className="font-medium text-tinta after:absolute after:inset-0 after:content-['']">{p.nome}</Link>
            <span className="t-apoio">{`${nomeTipo(p.tipo)} · ${plural(p.indicacoes, "indicação", "indicações")} · ${plural(p.prediosAtivos, "prédio ativo", "prédios ativos")}`}</span>
            <span className="t-texto tabular-nums">{`Comissão do mês: ${reais(p.comissaoMes)}${p.pagoMes ? " (pago)" : ""}`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Parceiros() {
  const busca = useSearchParams();
  const router = useRouter();
  const atual = hojeLocal().slice(0, 7);
  const pedido = busca.get("mes");
  const mes = pedido && mesComercialSchema.safeParse(pedido).success && pedido <= atual ? pedido : null;
  const carga = useCarregar<TelaParceiros>(ROTAS_PARCEIROS.lista(mes));
  const [aba, setAba] = useState<AbaParceiros>("ATIVOS");
  const [janela, setJanela] = useState<"novo" | "regra" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const d = carga.estado === "pronto" ? carga.dados : null;
  const mostrado = d?.mes ?? mes ?? atual;
  const meses = mesesParceiros(atual);
  const conta = d ? contarAbas(d.parceiros) : null;
  const naAba = d ? filtrarParceiros(d.parceiros, aba) : [];
  const abas: { valor: AbaParceiros; texto: string; n?: number }[] = [
    { valor: "ATIVOS", texto: "Ativos", n: conta?.ATIVOS }, { valor: "MES", texto: "Indicações do mês", n: conta?.MES },
    { valor: "SEM_INDICACAO", texto: "Sem indicação há 90 dias", n: conta?.SEM_INDICACAO }, { valor: "INATIVOS", texto: "Inativos", n: conta?.INATIVOS },
  ];

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Parceiros"
        apoio="Quem indica condomínios para a TRÍADE. A comissão é calculada aqui e paga fora do sistema (O.1)."
        acao={(
          <div className="flex flex-wrap items-end gap-2 max-md:w-full">
            <CampoSelecao id="parceiros-mes" rotulo="Mês" icone="calendario" className="min-w-[200px] max-md:w-full" value={mostrado} opcoes={meses}
              onChange={(e) => router.replace(e.target.value === atual ? TELAS_PARCEIROS.lista : `${TELAS_PARCEIROS.lista}?mes=${e.target.value}`, { scroll: false })} />
            {d?.podeEditar ? <Botao className="max-md:w-full" onClick={() => setJanela("novo")}><Icone nome="mais" />Novo parceiro</Botao> : null}
          </div>
        )} />
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando os parceiros…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-label="Parceiros" className="grid content-start gap-3 md:overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
            <AbasLista rotulo="Filtrar parceiros" abas={abas} atual={aba} aoMudar={setAba} />
            {naAba.length ? <TabelaParceiros lista={naAba} mes={mes} /> : (
              <div className="p-5 max-md:p-0">
                <Vazio titulo={d.parceiros.length ? "Nenhum parceiro nesta aba" : "Nenhum parceiro ainda"} icone="pessoas"
                  acao={!d.parceiros.length && d.podeEditar ? <Botao onClick={() => setJanela("novo")}><Icone nome="mais" />Novo parceiro</Botao> : undefined}>
                  {d.parceiros.length ? "Troque de aba para ver os outros." : "Cadastre quem indica condomínios: síndico profissional, administradora, construtora ou cliente."}
                </Vazio>
              </div>
            )}
            <p className="px-5 pb-4 t-apoio max-md:px-0">{`Comissão de ${textoMes(mostrado)}, calculada hoje.`}</p>
          </section>
          <Cartao id="parceiros-regra" titulo="Regra da comissão" icone="dinheiro"
            acao={d.podeComissao ? <Botao variante="discreto" onClick={() => setJanela("regra")}><Icone nome="editar" />Mudar</Botao> : undefined}>
            <dl className="grid gap-2">
              {linhasRegra(d.regra).map(([k, v]) => (
                <div key={k} className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">{k}</dt><dd className="t-texto">{v}</dd></div>
              ))}
              <div className="grid gap-0.5"><dt className="t-apoio text-tinta-suave">Vários prédios</dt>
                <dd className="t-texto">Contrato-quadro com adesão por prédio e desconto por volume da Tabela de preços (T.1)</dd></div>
            </dl>
            <p className="t-apoio">{TEXTO_PAGAMENTO_FORA}</p>
            {!d.podeComissao ? <p className="t-apoio">{`A regra (${textoPercentual(d.regra.percentual)}) é da Administração.`}</p> : null}
          </Cartao>
        </div>
      ) : null}
      {d && janela === "novo" ? (
        <JanelaParceiro aoFechar={() => setJanela(null)} feito={(id) => { setJanela(null); router.push(TELAS_PARCEIROS.parceiro(id)); }} />
      ) : null}
      {d && janela === "regra" ? (
        <JanelaRegra r={d.regra} aoFechar={() => setJanela(null)} feito={() => { setJanela(null); setAviso("Regra da comissão salva. Vale para os próximos prédios."); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}
