"use client";
// O link da proposta para o síndico (quadros 328 e 329, CM-07, CM-19 e CM-20; E.1): sem conta e
// sem a moldura do Console, no celular e no computador. Mostra a proposta, o kit para o conselho,
// o PDF com a impressão digital e o aceite com nome, CPF e cargo. Vencida, revogada, trocada ou
// inexistente: a página diz que não está disponível, sem dizer qual. O código fica só no
// endereço: nada vai para o armazenamento do navegador, e a página não tem referrer (cabecalhos.ts).
// Cada abertura conta uma vez (a equipe vê em quantos aparelhos), por isso a leitura é uma só.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cpfValido, formatarCpf, linkWhatsappComercial, mostrarValor, TEXTO_ACEITE, TEXTO_CONCORDO, TEXTO_PLANEJADO } from "@triade/domain";
import { Aviso, Botao, CampoTexto, Carregando, chamarApi, classeBotao, Icone, Logo, Marca, textoDoErro, type ErroApi } from "@triade/ui";
import {
  conteudoDoLink, documentoKit, documentoProposta, horaCompleta, linhasDoPreco, ondeFica, ORDEM_PECAS, ROTAS_PROPOSTAS, textoImpressao, tituloPreco, type Kit,
  type PropostaPublica,
} from "./propostas.ts";

/** O WhatsApp comercial da TRÍADE, o mesmo do site (apps/site/src/dados/empresa.ts). */
export const WHATSAPP_COMERCIAL = (process.env.NEXT_PUBLIC_WHATSAPP_COMERCIAL ?? "5511957850073").replace(/\D/g, "");

type Carga =
  | { estado: "carregando" }
  | { estado: "indisponivel" }
  | { estado: "vencida"; validoAte?: string }
  | { estado: "limite" }
  | { estado: "falha"; texto: string }
  | { estado: "pronto"; p: PropostaPublica };

const dataCurta = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

export function Pagina({ children, rotulo = "Proposta comercial" }: { children: ReactNode; rotulo?: string }) {
  return (
    <div className="min-h-dvh bg-fundo">
      <header className="flex items-center justify-between gap-3 border-b border-linha bg-superficie px-4 py-3.5">
        <Logo className="h-8 w-auto" />
        <span className="t-apoio">{rotulo}</span>
      </header>
      <main id="conteudo" className="mx-auto grid max-w-2xl gap-3 px-4 pt-4 pb-10 sm:pt-8">
        {children}
        <footer className="grid gap-2 pt-3 t-apoio text-tinta-suave">
          <p>Não precisa de conta nem senha. A TRÍADE nunca pede senha, código ou pagamento por mensagem.</p>
          <Marca sistema="Condomínio" />
        </footer>
      </main>
    </div>
  );
}

export const Bloco = ({ children, rotulo }: { children: ReactNode; rotulo?: string }) => (
  <section aria-label={rotulo} className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 sm:p-5">{children}</section>
);

export function Duvida({ texto = "Tenho uma dúvida", mensagem = "Olá! Tenho uma dúvida sobre a proposta da TRÍADE Condo." }: { texto?: string; mensagem?: string }) {
  if (!WHATSAPP_COMERCIAL) return null;
  return (
    <a href={linkWhatsappComercial(WHATSAPP_COMERCIAL, mensagem)} target="_blank" rel="noopener noreferrer"
      className={classeBotao("discreto", "w-full sm:w-auto")}>
      <Icone nome="whats" />{texto}
    </a>
  );
}

export function LinkProposta() {
  const { codigo } = useParams<{ codigo: string }>();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const lido = useRef(false);

  useEffect(() => {
    // Uma leitura por visita: cada chamada conta uma abertura.
    if (lido.current) return;
    lido.current = true;
    void chamarApi<PropostaPublica>(ROTAS_PROPOSTAS.publico(codigo)).then((r) => {
      if (r.ok) return setCarga({ estado: "pronto", p: r.dados });
      if (r.status === 404) return setCarga({ estado: "indisponivel" });
      if (r.status === 429) return setCarga({ estado: "limite" });
      if (r.erro.detalhes?.motivo === "PROPOSTA_VENCIDA") return setCarga({ estado: "vencida", validoAte: r.erro.detalhes.validoAte as string | undefined });
      setCarga({ estado: "falha", texto: textoDoErro(r.erro) });
    });
  }, [codigo]);

  if (carga.estado === "carregando") return <Pagina><h1 className="sr-only">Proposta comercial</h1><Carregando rotulo="Abrindo a proposta…" /></Pagina>;
  if (carga.estado !== "pronto") {
    const t = carga.estado === "vencida"
      ? { titulo: "Esta proposta venceu", texto: `Ela valia até ${dataCurta(carga.validoAte) || "a data combinada"}. Fale com a equipe da TRÍADE para receber uma nova, com a tabela do dia.` }
      : carga.estado === "limite" ? { titulo: "Muitas tentativas agora", texto: "Tente de novo mais tarde. Se precisar, fale com a TRÍADE pelo WhatsApp comercial." }
      : carga.estado === "falha" ? { titulo: "Não deu para abrir agora", texto: carga.texto }
      : { titulo: "Esta proposta não está mais disponível", texto: "Fale com a TRÍADE pelo WhatsApp comercial." };
    return (
      <Pagina>
        <h1 className="t-titulo-tela">{t.titulo}</h1>
        <Aviso tom={carga.estado === "falha" ? "erro" : "atencao"}>{t.texto}</Aviso>
        <Duvida texto="Falar com a TRÍADE" />
      </Pagina>
    );
  }
  return <Proposta codigo={codigo} inicial={carga.p} />;
}

function Proposta({ codigo, inicial }: { codigo: string; inicial: PropostaPublica }) {
  const [p, setP] = useState(inicial);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [concordo, setConcordo] = useState(false);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState<"pdf" | "kit" | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const c = conteudoDoLink(p);
  const aceita = p.situacao === "ACEITA" && p.aceite;

  async function aceitar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const f = [
      ...(nome.trim().length < 2 ? ["nome"] : []), ...(!cpfValido(cpf) ? ["cpf"] : []), ...(cargo.trim().length < 2 ? ["cargo"] : []), ...(!concordo ? ["concordo"] : []),
    ];
    setFalhas(f);
    if (f.length) return;
    setEnviando(true);
    const r = await chamarApi<{ situacao: "ACEITA"; numero: number; nome: string; cargo: string; aceitoEm: string; hash: string }>(ROTAS_PROPOSTAS.publicoAceite(codigo),
      { corpo: { nome: nome.trim(), cpf, cargo: cargo.trim(), concordo: true } });
    setEnviando(false);
    if (!r.ok) {
      const campos = r.erro.detalhes?.campos;
      if (Array.isArray(campos) && campos.length) return setFalhas(campos.map(String));
      return setErro(r.erro);
    }
    setP((x) => ({ ...x, situacao: "ACEITA", podeAceitar: false, aceite: { nome: r.dados.nome, cargo: r.dados.cargo, em: r.dados.aceitoEm, numero: r.dados.numero, hash: r.dados.hash } }));
    window.scrollTo({ top: 0 });
  }

  async function baixar(qual: "pdf" | "kit") {
    setProblema(null);
    setBaixando(qual);
    try {
      const { baixarPdf } = await import("./pdf.ts");
      if (qual === "pdf") await baixarPdf(documentoProposta(c));
      else {
        const r = await chamarApi<Kit>(ROTAS_PROPOSTAS.publicoKit(codigo));
        if (!r.ok) { setProblema(r.status === 404 ? "O kit não está mais disponível neste link." : textoDoErro(r.erro)); return; }
        await baixarPdf(documentoKit({ ...r.dados, proposta: { ...r.dados.proposta, aosCuidados: p.aosCuidados } }, ORDEM_PECAS));
      }
    } catch {
      setProblema("Não deu para montar o PDF. Tente de novo.");
    } finally {
      setBaixando(null);
    }
  }

  const erroDe = (campo: string, texto: string) => (falhas.includes(campo) ? texto : undefined);
  const para = [p.condominio, ondeFica(p)].filter(Boolean).join(" · ");

  return (
    <Pagina>
      {aceita ? (
        <>
          <div role="status" className="flex gap-2.5 rounded-[14px] border border-ok/30 bg-ok-fundo p-3.5 text-ok">
            <Icone nome="check" className="h-5.5 w-5.5 shrink-0" />
            <p className="t-texto"><b>{`Proposta aceita, ${p.aceite!.nome.split(/\s+/)[0]}.`}</b>{` Registramos ${horaCompleta(p.aceite!.em)}, versão v${p.aceite!.numero}.`}</p>
          </div>
          <Bloco rotulo="O que acontece agora">
            <h2 className="t-titulo-cartao">O que acontece agora</h2>
            <ol className="grid list-decimal gap-1.5 pl-5 t-texto">
              <li>Mande o CNPJ e a ata da eleição com o fim do mandato (e a ata que aprovou, se a convenção pedir).</li>
              <li>Você assina o contrato pelo gov.br, de graça, com o termo de tratamento de dados no mesmo arquivo.</li>
              <li>Depois de assinado, começamos a implantação e combinamos a data com você.</li>
              <li>A primeira cobrança sai do contrato assinado, na data combinada.</li>
            </ol>
          </Bloco>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Link href={`/o/${codigo}/contrato`} className={classeBotao("primario", "w-full sm:w-auto")}><Icone nome="enviar" />Enviar o CNPJ e a ata</Link>
            <Botao variante="contorno" className="w-full sm:w-auto" disabled={!!baixando} onClick={() => void baixar("pdf")}>
              <Icone nome="baixar" />{baixando === "pdf" ? "Montando o PDF…" : "Baixar a proposta aceita"}
            </Botao>
          </div>
          <p className="t-apoio">Mudou de ideia? Fale pelo WhatsApp comercial antes de assinar o contrato.</p>
          <Duvida texto="Falar pelo WhatsApp comercial" />
        </>
      ) : null}

      <p className="t-apoio">{`Para ${para}${p.aosCuidados ? ` · aos cuidados de ${p.aosCuidados}` : ""}`}</p>
      {aceita ? <h2 className="t-titulo-tela">Proposta para organizar os pedidos do seu prédio</h2> : <h1 className="t-titulo-tela">Proposta para organizar os pedidos do seu prédio</h1>}

      <Bloco rotulo="Preço">
        <span className="t-apoio">{tituloPreco(c)}</span>
        <span className="text-[30px] leading-tight font-bold tabular-nums">{mostrarValor(c.mensal ?? null)}<span className="t-texto font-medium text-tinta-suave"> por mês</span></span>
        <dl className="grid">
          {linhasDoPreco(c).map(([r, v]) => (
            <div key={r} className="flex justify-between gap-3 border-t border-linha py-2.5 t-texto">
              <dt className="text-tinta-suave">{r}</dt><dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        {c.premissasTexto ? <p className="t-apoio">{c.premissasTexto}</p> : null}
      </Bloco>

      <Bloco rotulo="O que está incluído">
        <h2 className="t-titulo-cartao">O que já funciona</h2>
        <ul className="grid list-disc gap-1 pl-5 t-texto">{c.incluido.map((i) => <li key={i}>{i}</li>)}</ul>
        <h2 className="pt-2 t-titulo-cartao">O que ainda é planejado</h2>
        <p className="t-texto text-tinta-suave">{`${c.planejado.join(" e ")}. ${TEXTO_PLANEJADO}`}</p>
      </Bloco>

      {c.respostas.length ? (
        <Bloco rotulo="Respostas para o conselho">
          <h2 className="t-titulo-cartao">Respostas para o conselho</h2>
          {c.respostas.map((r) => (
            <details key={r.titulo} className="border-t border-linha py-2 first:border-t-0">
              <summary className="min-h-11 cursor-pointer content-center t-texto font-medium">{r.titulo}</summary>
              <p className="t-texto whitespace-pre-wrap text-tinta-suave">{r.texto}</p>
            </details>
          ))}
        </Bloco>
      ) : null}

      {c.referencias.length ? (
        <Bloco rotulo="Referências">
          <h2 className="t-titulo-cartao">Síndicos que aceitaram ser referência</h2>
          <ul className="grid gap-2 t-texto">
            {c.referencias.map((r) => (
              <li key={`${r.sindico}-${r.condominio}`} className="grid gap-0.5">
                <span>{`${r.sindico}, ${r.condominio}${r.unidades ? ` (${r.unidades} unidades)` : ""}`}</span>
                {r.contato ? <span className="t-apoio">{r.contato}</span> : null}
                {r.caso ? <span className="t-apoio">{r.caso.texto}</span> : null}
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}

      {p.kitDisponivel !== false ? (
        <Bloco rotulo="Para levar ao conselho">
          <h2 className="t-titulo-cartao">Para levar ao conselho</h2>
          <p className="t-texto">Apresentação curta, comparativo e minuta para a ata, em PDF.</p>
          <Botao variante="contorno" className="w-full sm:w-auto sm:justify-self-start" disabled={!!baixando} onClick={() => void baixar("kit")}>
            <Icone nome="baixar" />{baixando === "kit" ? "Montando o kit…" : "Baixar o kit do conselho"}
          </Botao>
        </Bloco>
      ) : null}
      {problema ? <Aviso tom="erro" papel="alert">{problema}</Aviso> : null}

      {p.podeAceitar && !aceita ? (
        <form onSubmit={aceitar} noValidate className="grid gap-3">
          <Bloco rotulo="Quem aceita">
            <h2 className="t-titulo-cartao">Quem aceita</h2>
            <CampoTexto id="aceite-nome" rotulo="Nome" autoComplete="name" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)}
              erro={erroDe("nome", "Escreva o seu nome.")} />
            <CampoTexto id="aceite-cpf" rotulo="CPF" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" value={cpf}
              onChange={(e) => setCpf(e.target.value)} onBlur={() => setCpf((v) => formatarCpf(v))} erro={erroDe("cpf", "Confira o CPF: os números não batem.")} />
            <CampoTexto id="aceite-cargo" rotulo="Cargo" maxLength={60} placeholder="Síndica, síndico, subsíndico…" value={cargo} onChange={(e) => setCargo(e.target.value)}
              erro={erroDe("cargo", "Escreva o seu cargo no condomínio.")} />
            <p className="t-apoio">Para o contrato vamos pedir o CNPJ e a ata da eleição com o fim do mandato.</p>
          </Bloco>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 t-texto">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={concordo} onChange={(e) => setConcordo(e.target.checked)}
              aria-describedby={falhas.includes("concordo") ? "aceite-concordo-erro" : undefined} />
            <span>{TEXTO_CONCORDO}</span>
          </label>
          {falhas.includes("concordo") ? <span id="aceite-concordo-erro" className="t-apoio text-erro">Marque que leu a proposta para aceitar.</span> : null}
          {erro ? <Aviso tom="erro" papel="alert">{erro.codigo === "RATE_LIMITED" ? "Muitas tentativas agora. Tente de novo mais tarde." : textoDoErro(erro)}</Aviso> : null}
          <Botao type="submit" className="w-full" disabled={enviando || !concordo}><Icone nome="check" />{enviando ? "Registrando…" : "Aceitar a proposta"}</Botao>
          <Botao variante="contorno" className="w-full" disabled={!!baixando} onClick={() => void baixar("pdf")}>
            <Icone nome="baixar" />{baixando === "pdf" ? "Montando o PDF…" : "Baixar o PDF"}
          </Botao>
          <Duvida />
          <p className="t-apoio">{TEXTO_ACEITE.replace("esta versão", `esta versão (v${p.numero})`)}</p>
        </form>
      ) : !aceita ? (
        <>
          <Aviso tom="info">Esta proposta não aceita mais o aceite pelo link. Fale com a TRÍADE pelo WhatsApp comercial.</Aviso>
          <Botao variante="contorno" className="w-full" disabled={!!baixando} onClick={() => void baixar("pdf")}><Icone nome="baixar" />Baixar o PDF</Botao>
        </>
      ) : null}

      <p className="t-codigo break-all text-tinta-suave">{textoImpressao(p.numero, p.hash)}</p>
      {p.validoAte && !aceita ? <p className="t-apoio">{`Vale até ${dataCurta(p.validoAte)}.`}</p> : null}
    </Pagina>
  );
}
