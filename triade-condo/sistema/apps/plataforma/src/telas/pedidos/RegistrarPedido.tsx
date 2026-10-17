"use client";
// Registrar pedido (AT-01, AT-03, AT-32; design "Telas do passo 4", tela 3): onde é (unidade
// ou área comum), quem pediu (só contato confirmado da unidade, MU-02), como chegou,
// categoria, prioridade com o significado, assunto e o relato. O responsável vem com o padrão
// da fila. O protocolo aparece depois de salvar. Fotos e documentos (opcional, passo 4b) entram
// como parte do relato, enviados logo depois do registro.

import { useEffect, useState, type FormEvent } from "react";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, chamarApi, camposComErro, Dialogo, textoDoErro, type ErroApi } from "@triade/ui";
import type { OpcoesPedidos } from "../tipos.ts";
import { Caixa, Escolha, nomeRelacao } from "../moradores/comum.tsx";
import { opcoesCanal } from "./comum.tsx";
import { EscolherArquivos, enviarArquivos, type ItemEnvio } from "./Arquivos.tsx";

interface ContatoConfirmado { contatoId: string; nome: string; relacao: string; principal: boolean }

export function RegistrarPedido({ aberto, opcoes, aoFechar, registrado }: {
  aberto: boolean;
  opcoes: OpcoesPedidos;
  aoFechar: () => void;
  registrado: (protocolo: string, id: string) => void;
}) {
  return (
    <Dialogo aberto={aberto} titulo="Registrar pedido" aoFechar={aoFechar}>
      {aberto ? <Formulario opcoes={opcoes} aoFechar={aoFechar} registrado={registrado} /> : null}
    </Dialogo>
  );
}

function Formulario({ opcoes, aoFechar, registrado }: { opcoes: OpcoesPedidos; aoFechar: () => void; registrado: (protocolo: string, id: string) => void }) {
  const categorias = opcoes.categorias.filter((c) => c.ativa);
  const prioridades = opcoes.prioridades.filter((p) => p.ativa);
  const disponiveis = opcoes.responsaveis.filter((r) => r.disponivel);
  const normal = prioridades.find((p) => p.nome.toLowerCase() === "normal") ?? prioridades[prioridades.length - 1];
  const [onde, setOnde] = useState<"UNIDADE" | "AREA">(opcoes.unidades.length ? "UNIDADE" : "AREA");
  const [v, setV] = useState({
    unidadeId: "", contatoId: "", local: "", canal: "TELEFONE", categoriaId: categorias[0]?.id ?? "", prioridadeId: normal?.id ?? "",
    assunto: "", descricao: "", responsavelId: opcoes.responsavelPadrao ?? "", privado: false,
  });
  const [carga, setCarga] = useState<{ unidade: string; lista: ContatoConfirmado[] } | null>(null);
  const contatos = carga && carga.unidade === v.unidadeId ? carga.lista : null;
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [arquivos, setArquivos] = useState<ItemEnvio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const mudar = (m: Partial<typeof v>) => setV((x) => ({ ...x, ...m }));

  useEffect(() => {
    if (onde !== "UNIDADE" || !v.unidadeId) return;
    const unidade = v.unidadeId;
    const controle = new AbortController();
    chamarApi<ContatoConfirmado[]>(`/v1/condominio/pedidos/contatos/${unidade}`, { sinal: controle.signal }).then((r) => {
      if (!controle.signal.aborted) setCarga({ unidade, lista: r.ok ? r.dados : [] });
    });
    return () => controle.abort();
  }, [onde, v.unidadeId]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ id: string; protocolo: string }>("/v1/condominio/pedidos", { corpo: {
      unidadeId: onde === "UNIDADE" ? v.unidadeId || null : null,
      contatoId: onde === "UNIDADE" ? v.contatoId || null : null,
      local: v.local.trim() || null,
      canal: v.canal, categoriaId: v.categoriaId, prioridadeId: v.prioridadeId,
      assunto: v.assunto, descricao: v.descricao, privado: v.privado, responsavelId: v.responsavelId || null,
    } });
    if (!r.ok) { setEnviando(false); return setErro(r.erro); }
    await enviarArquivos(r.dados.id, "RELATO", arquivos, (chave, p) => setArquivos((xs) => xs.map((x) => (x.chave === chave ? { ...x, progresso: p } : x))));
    setEnviando(false);
    registrado(r.dados.protocolo, r.dados.id);
  }

  const comErro = camposComErro(erro);
  const msg = (c: string, texto: string) => (comErro.includes(c) ? texto : null);
  const prioridade = prioridades.find((p) => p.id === v.prioridadeId);

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <Escolha rotulo="Onde é" atual={onde} aoMudar={(x) => { setOnde(x); mudar({ unidadeId: "", contatoId: "" }); }}
        opcoes={[{ valor: "UNIDADE", texto: "Numa unidade" }, { valor: "AREA", texto: "Em área comum" }]} />
      {onde === "UNIDADE" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao id="p-unidade" rotulo="Unidade" value={v.unidadeId} erro={msg("unidadeId", "Escolha a unidade.")}
            onChange={(e) => mudar({ unidadeId: e.target.value, contatoId: "" })}
            opcoes={[{ valor: "", texto: "Escolha a unidade" }, ...opcoes.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]} />
          <CampoSelecao id="p-contato" rotulo="Quem pediu" value={v.contatoId} disabled={!v.unidadeId || contatos === null}
            onChange={(e) => mudar({ contatoId: e.target.value })}
            ajuda={v.unidadeId && contatos?.length === 0 ? "Esta unidade não tem contato confirmado." : "Só contato confirmado da unidade."}
            opcoes={[{ valor: "", texto: "Ninguém da unidade (visto pela gestão)" },
              ...(contatos ?? []).map((c) => ({ valor: c.contatoId, texto: `${c.nome} · ${nomeRelacao(c.relacao).toLowerCase()}` }))]} />
        </div>
      ) : null}
      <CampoTexto id="p-local" rotulo={onde === "AREA" ? "Local" : "Onde, na unidade"} opcional={onde === "UNIDADE"} maxLength={120} value={v.local}
        onChange={(e) => mudar({ local: e.target.value })} erro={msg("local", "Diga onde é (2 a 120 caracteres).")}
        ajuda={onde === "AREA" ? "Ex.: portão da garagem, elevador social da Torre A." : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao id="p-canal" rotulo="Como chegou" value={v.canal} onChange={(e) => mudar({ canal: e.target.value })} opcoes={opcoesCanal} />
        <CampoSelecao id="p-categoria" rotulo="Categoria" value={v.categoriaId} erro={msg("categoriaId", "Escolha uma categoria ativa.")}
          onChange={(e) => mudar({ categoriaId: e.target.value })} opcoes={categorias.map((c) => ({ valor: c.id, texto: c.nome }))} />
      </div>
      <CampoSelecao id="p-prioridade" rotulo="Prioridade" value={v.prioridadeId} erro={msg("prioridadeId", "Escolha uma prioridade ativa.")}
        onChange={(e) => mudar({ prioridadeId: e.target.value })} ajuda={prioridade?.significado}
        opcoes={prioridades.map((p) => ({ valor: p.id, texto: p.nome }))} />
      <CampoTexto id="p-assunto" rotulo="Assunto" required maxLength={120} value={v.assunto} onChange={(e) => mudar({ assunto: e.target.value })}
        erro={msg("assunto", "Assunto de 3 a 120 caracteres.")} ajuda="Curto, para achar na fila. Ex.: Vazamento no banheiro." />
      <CampoAreaTexto id="p-descricao" rotulo="O que foi relatado" required maxLength={4000} rows={4} value={v.descricao}
        onChange={(e) => mudar({ descricao: e.target.value })} erro={msg("descricao", "Descreva o pedido (3 a 4000 caracteres).")} />
      <CampoSelecao id="p-responsavel" rotulo="Responsável" value={v.responsavelId} onChange={(e) => mudar({ responsavelId: e.target.value })}
        ajuda={disponiveis.length ? "Quem recebe confirma que aceitou." : "Ninguém disponível na lista de quem atende: o pedido fica sem responsável, à vista na fila."}
        opcoes={[{ valor: "", texto: "Sem responsável agora" },
          ...disponiveis.map((r) => ({ valor: r.vinculoId, texto: `${r.eu ? "Eu" : r.nome}${r.vinculoId === opcoes.responsavelPadrao ? " (padrão da fila)" : ""}` }))]} />
      <Caixa id="p-privado" rotulo="Pedido privado" ajuda="Só o síndico, quem registrou e o responsável veem." marcada={v.privado} aoMudar={(x) => mudar({ privado: x })} />
      <EscolherArquivos rotulo="Fotos e documentos (opcional)" itens={arquivos} aoMudar={setArquivos} enviando={enviando} />
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Registrando…" : "Registrar pedido"}</Botao>
      </div>
    </form>
  );
}
