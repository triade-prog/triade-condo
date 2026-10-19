"use client";
// Link pessoal da enquete (design "Vida em condomínio", tela 5; AC-03): só daquela unidade ou
// pessoa, sem conta e sem senha. A escolha pode ser trocada até o prazo; depois, o link mostra o
// resultado. Na secreta, quando a enquete fecha, nem a própria unidade vê mais o que escolheu.

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ESCOPOS_ENQUETE } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { Barras, prazoCurto } from "../vida/Enquetes.tsx";
import type { EnquetePublica } from "../tipos.ts";
import { Cartao, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: EnquetePublica };

export function Enquete() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/v/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [escolha, setEscolha] = useState<number | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [registrada, setRegistrada] = useState(false);

  useEffect(() => {
    void chamarApi<EnquetePublica>(base).then((r) => {
      if (r.ok) { setCarga({ estado: "pronto", dados: r.dados }); setEscolha(r.dados.escolha ?? null); }
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao condomínio." : textoDoErro(r.erro) });
    });
  }, [base]);

  const rodape = "Não precisa de conta nem senha. O link é só seu: não repasse.";
  if (carga.estado === "carregando") return <TelaPublica titulo="Enquete do condomínio" icone="grafico" rodape={rodape}><Carregando rotulo="Abrindo a enquete…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Enquete do condomínio" icone="grafico" rodape={rodape}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const e = carga.dados;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!escolha) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<EnquetePublica>(base, { corpo: { opcao: escolha } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setCarga({ estado: "pronto", dados: r.dados });
    setRegistrada(true);
  }

  const regra = [`Aberta até ${prazoCurto(e.abertaAte)}`, ESCOPOS_ENQUETE[e.por].toLowerCase(), e.secreta ? "secreta" : "não secreta"].join(" · ");
  return (
    <TelaPublica titulo={`Enquete do ${e.condominio}`} subtitulo={e.para} icone="grafico" rodape={rodape}>
      {!e.aberta ? (
        <>
          <Aviso tom="info" titulo="A enquete fechou">
            {e.respondeuEm ? `A resposta de ${e.para} foi registrada em ${diaHora(e.respondeuEm)}.` : "Esta enquete não aceita mais resposta."}
          </Aviso>
          <Cartao>
            <h2 className="text-xl font-medium">{e.pergunta}</h2>
            {e.resultado ? (
              <>
                <Barras r={e.resultado} marcar={e.escolha} />
                <p className="text-[13px] text-tinta-suave">Responderam {e.resultado.responderam} de {e.resultado.total}. A enquete é uma consulta e não tem valor de decisão de assembleia.</p>
              </>
            ) : null}
          </Cartao>
        </>
      ) : (
        <Cartao>
          <form onSubmit={enviar} noValidate className="grid gap-3">
            <fieldset className="grid gap-2">
              <legend className="text-xl font-medium">{e.pergunta}</legend>
              <p className="text-[13px] text-tinta-suave">{regra}</p>
              {e.opcoes.map((o, i) => (
                <label key={i} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-[15px] ${escolha === i + 1 ? "border-violeta-500 bg-violeta-50" : "border-linha"}`}>
                  <input type="radio" name="opcao" value={i + 1} checked={escolha === i + 1} onChange={() => { setEscolha(i + 1); setRegistrada(false); }} />
                  {o}
                </label>
              ))}
            </fieldset>
            {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
            {registrada || e.respondeuEm ? (
              <Aviso tom="ok">
                Resposta de {e.para} registrada{e.respondeuEm ? ` em ${diaHora(e.respondeuEm)}` : ""}. Dá para trocar até {prazoCurto(e.abertaAte)} por este link.
              </Aviso>
            ) : null}
            <Botao type="submit" disabled={enviando || !escolha || (registrada && escolha === e.escolha)}>
              {e.respondeuEm ? "Trocar a resposta" : "Enviar resposta"}
            </Botao>
          </form>
        </Cartao>
      )}
    </TelaPublica>
  );
}
