"use client";
// Ficha da pessoa (DC15, telas-modelo pessoas-ficha-*; V-09, CF-03, CF-05, CF-12): o acesso por
// área, na ordem do menu (decisão B.1), o atendimento, com Atende os pedidos e Disponível gravando
// na hora (A.1), e os dados. Mudar o acesso é o botão; Revogar fica em Mais ações. O síndico vem
// do contrato com a TRÍADE: na ficha dele só o atendimento muda.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatarData, FUNCOES_PLATAFORMA } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, ErroCarregar, Icone, Iniciais, Interruptor, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, Dado, MaisAcoes } from "../Ficha.tsx";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { PessoaDoCondominio, Pessoas, Recado } from "../tipos.ts";
import { GRUPOS_ACESSO, gruposDisponiveis, resumoDaArea } from "./acesso.ts";
import { MudarAcesso, Revogar, salvarAtendimento, TrocarPadrao } from "./janelas.tsx";
import { SeloAtendimento } from "./Pessoas.tsx";

function Acesso({ p, dados }: { p: PessoaDoCondominio; dados: Pessoas }) {
  if (p.funcao === "SINDICO") {
    return (
      <Cartao id="t-acesso" titulo="Acesso" icone="cadeado">
        <Aviso tom="info" titulo="Todas as permissões">O síndico vem do contrato com a TRÍADE. A troca de síndico é feita pela TRÍADE, com a passagem de bastão.</Aviso>
      </Cartao>
    );
  }
  // As áreas que o banco tem; o que a pessoa tem de uma área que não aparece também conta.
  const disponiveis = new Set([...dados.permissoesDisponiveis.map((x) => x.codigo), ...p.permissoes]);
  const grupos = gruposDisponiveis([...disponiveis]);
  return (
    <Cartao id="t-acesso" titulo="Acesso" icone="cadeado">
      <div className="grid gap-2">
        {(grupos.length ? grupos : GRUPOS_ACESSO).map((g) => (
          <section key={g.grupo} aria-label={g.grupo}>
            <h3 className="t-rotulo pt-2 pb-1">{g.grupo}</h3>
            <ul>
              {g.areas.map((a) => {
                const r = resumoDaArea(a, p.permissoes);
                return (
                  <li key={a.id} className="flex items-center gap-3 border-t border-linha py-2.5">
                    <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={a.icone} className="h-4 w-4" /></span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-medium">{a.nome}</span>
                      {r.detalhe ? <span className="t-apoio">{r.detalhe}</span> : null}
                    </span>
                    <Selo tom={r.tom === "violeta" ? "andamento" : r.tom}>{r.nivel}</Selo>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Cartao>
  );
}

function Atendimento({ p, dados, salvo, recarregar, aoTrocar }: {
  p: PessoaDoCondominio; dados: Pessoas; salvo: (r: Recado) => void; recarregar: () => void; aoTrocar: () => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [gravando, setGravando] = useState(false);
  // O interruptor muda na hora; se o banco recusar, volta ao que era.
  const [local, setLocal] = useState({ atende: p.responsavel, disponivel: p.disponivel });
  const ehPadrao = dados.responsavelPadrao === p.vinculoId && p.responsavel;
  const outros = dados.pessoas.filter((x) => x.vinculoId !== p.vinculoId && x.responsavel);
  const padrao = dados.pessoas.find((x) => x.vinculoId === dados.responsavelPadrao && x.responsavel && x.disponivel);
  // O padrão só sai da fila depois de trocar; se ninguém mais atende, pode deixar de atender.
  const travado = ehPadrao && outros.length > 0;

  async function gravar(mudanca: Parameters<typeof salvarAtendimento>[1], padraoId: string | null, texto: string) {
    setErro(null);
    setGravando(true);
    const r = await salvarAtendimento(dados, mudanca, padraoId);
    setGravando(false);
    if (!r.ok) {
      setLocal({ atende: p.responsavel, disponivel: p.disponivel });
      return setErro(r.erro);
    }
    salvo({ tom: "ok", texto });
  }

  function mudar(campo: "atende" | "disponivel", valor: boolean) {
    setLocal((l) => ({ ...l, [campo]: valor, ...(campo === "atende" && valor && !p.responsavel ? { disponivel: true } : {}) }));
    const textos = { atende: valor ? `${p.nome} passa a atender os pedidos.` : `${p.nome} não atende mais os pedidos.`,
      disponivel: valor ? `${p.nome} está disponível de novo.` : `${p.nome} ficou indisponível: os pedidos novos não caem para esta pessoa.` };
    void gravar({ vinculoId: p.vinculoId, [campo]: valor }, dados.responsavelPadrao, textos[campo]);
  }

  return (
    <Cartao id="t-atendimento" titulo="Atendimento" icone="pedido">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <fieldset disabled={gravando || travado} className="grid gap-2">
        <legend className="sr-only">Atendimento de {p.nome}</legend>
        <Interruptor id="at-atende" rotulo="Atende os pedidos" ajuda="Pode ser escolhida como responsável e receber os pedidos da fila."
          marcado={local.atende} aoMudar={(v) => mudar("atende", v)} />
        {p.responsavel ? (
          <Interruptor id="at-disponivel" rotulo="Disponível" ajuda={travado ? "Para ficar indisponível, troque antes o padrão da fila." : "Desligue nas férias: os pedidos novos não caem para esta pessoa."}
            marcado={local.disponivel} aoMudar={(v) => mudar("disponivel", v)} />
        ) : null}
      </fieldset>
      {p.responsavel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-linha bg-fundo px-3.5 py-3">
          <span className="grid gap-0.5">
            <span className="t-texto font-medium">{ehPadrao ? "É o padrão da fila" : padrao ? `Padrão da fila: ${padrao.nome}` : "Falta o padrão da fila"}</span>
            <span className="t-apoio">Todo pedido novo cai para o padrão, até alguém assumir.</span>
          </span>
          {ehPadrao ? (outros.length ? <Botao variante="contorno" tamanho="m" onClick={aoTrocar}><Icone nome="trocar" />Trocar</Botao> : null)
            : p.disponivel ? <Botao variante="contorno" tamanho="m" disabled={gravando} onClick={() => void gravar(null, p.vinculoId, `Os pedidos novos agora vão para ${p.nome}.`)}><Icone nome="pedido" />Tornar padrão da fila</Botao> : null}
        </div>
      ) : null}
      <p className="t-apoio">Cada interruptor grava na hora e fica no histórico.</p>
    </Cartao>
  );
}

export function Pessoa() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { pode, atualizar } = usePlataforma();
  const carga = useCarregar<Pessoas>("/v1/condominio/pessoas");
  const [janela, setJanela] = useState<"acesso" | "revogar" | "padrao" | "cargo" | null>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const fechar = () => setJanela(null);
  const salvo = (r: Recado) => { setRecado(r); carga.recarregar(); atualizar(); };
  const voltar = (
    <Link href="/pessoas" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Voltar às pessoas
    </Link>
  );

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a pessoa…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const dados = carga.dados;
  const p = dados.pessoas.find((x) => x.vinculoId === id);
  if (!p) return <div className="grid gap-3">{voltar}<Vazio titulo="Pessoa não encontrada">Ela pode ter tido o acesso revogado.</Vazio></div>;

  const muda = pode("pessoas.autorizar") && p.funcao === "AUTORIZADO";
  const mudarAcesso = muda ? <Botao onClick={() => setJanela("acesso")}><Icone nome="cadeado" />Mudar o acesso</Botao> : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 max-md:pb-24">
      <header className="grid gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-5">
        <div className="flex items-center justify-between gap-3">
          {voltar}
          <MaisAcoes itens={muda ? [{ texto: "Revogar acesso", icone: "sair", acao: () => setJanela("revogar"), perigo: true }] : []} />
        </div>
        <div className="flex items-center gap-5 max-md:gap-4">
          <Iniciais nome={p.nome} className="h-16 w-16 shrink-0 t-titulo-secao max-md:h-14 max-md:w-14" />
          <div className="grid min-w-0 flex-1 gap-2">
            <h1 className="t-titulo-ficha [overflow-wrap:anywhere]">{p.nome}</h1>
            <p className="flex flex-wrap items-center gap-2">
              <Selo tom={p.funcao === "SINDICO" ? "andamento" : "info"}>{FUNCOES_PLATAFORMA[p.funcao]}</Selo>
              <SeloAtendimento p={p} padrao={dados.responsavelPadrao} />
              {p.cargo ? <span className="t-apoio">{p.cargo}</span> : null}
            </p>
          </div>
        </div>
        {mudarAcesso ? <div className="flex flex-wrap gap-2 max-md:hidden">{mudarAcesso}</div> : null}
      </header>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <div className="max-lg:order-2"><Acesso p={p} dados={dados} /></div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 max-lg:contents">
          {pode("atendimento.responsaveis") ? (
            <div className="max-lg:order-1">
              <Atendimento key={`${p.versao}-${dados.versao}`} p={p} dados={dados} salvo={salvo} recarregar={carga.recarregar} aoTrocar={() => setJanela("padrao")} />
            </div>
          ) : null}
          <Cartao id="t-dados" titulo="Dados" icone="lista" className="max-lg:order-3">
            <div>
              <Dado icone="pessoa" nome="Função">{FUNCOES_PLATAFORMA[p.funcao]}</Dado>
              {p.funcao === "AUTORIZADO" ? (
                <Dado icone="documento" nome="Cargo" acao={muda ? <Botao variante="discreto" tamanho="m" onClick={() => setJanela("cargo")}>Mudar</Botao> : undefined}>
                  {p.cargo ?? <span className="text-tinta-suave">Sem cargo</span>}
                </Dado>
              ) : null}
              <Dado icone="calendario" nome="Desde">{formatarData(p.desde)}</Dado>
            </div>
            {p.funcao === "AUTORIZADO" ? <p className="t-apoio">O cargo é só um nome: não dá nem tira permissão.</p> : null}
          </Cartao>
        </div>
      </div>

      {mudarAcesso ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 grid gap-1.5 border-t border-linha bg-superficie/95 px-4 pt-3 pb-3 md:hidden">
          <Botao className="w-full" onClick={() => setJanela("acesso")}><Icone nome="cadeado" />Mudar o acesso</Botao>
        </div>
      ) : null}

      {janela === "acesso" ? <MudarAcesso dados={dados} pessoa={p} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} /> : null}
      {janela === "padrao" ? <TrocarPadrao dados={dados} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} /> : null}
      {janela === "revogar" ? (
        <Revogar dados={dados} pessoa={p} aoFechar={fechar} recarregar={carga.recarregar}
          salvo={() => { atualizar(); router.push(`/pessoas?revogada=${encodeURIComponent(p.nome)}`); }} />
      ) : null}
      {janela === "cargo" ? (
        <Janela aberto titulo={`Cargo de ${p.nome}`} textoBotao="Salvar cargo" aoFechar={fechar} recarregar={carga.recarregar}
          campos={[{ id: "cargo", rotulo: "Cargo", tipo: "texto", max: 60, ajuda: "Secretária, subsíndico, conselho… O cargo não dá permissão.", erro: "Até 60 caracteres." }]}
          iniciais={{ cargo: p.cargo ?? "" }}
          aoSalvar={async (v) => {
            const r = await chamarApi(`/v1/condominio/pessoas/${p.vinculoId}`, { metodo: "PUT", corpo: { versao: p.versao, cargo: v.cargo, permissoes: p.permissoes } });
            if (r.ok) { fechar(); salvo({ tom: "ok", texto: "Cargo salvo." }); }
            return r;
          }} />
      ) : null}
    </div>
  );
}
