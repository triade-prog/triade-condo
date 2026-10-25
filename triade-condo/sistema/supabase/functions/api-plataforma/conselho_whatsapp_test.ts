// O link do conselheiro pelo WhatsApp (R5.3, 0305; V-14, W-20): quando o banco põe o link na fila
// do WhatsApp (envio "WHATSAPP"), a API manda na hora, sem esperar o minuto; o código vem à parte
// no lote e entra no lugar de [link] na rota /conselho, a mesma do e-mail. Quando o banco diz
// "COPIAR" (sem WhatsApp no condomínio), nada vai para a fila. O resto fica no banco
// (046_conselho_whatsapp_retencao_test.sql).
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { algumPorEmail, algumPorWhatsapp } from "./aprovacoes.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { chaveCredenciais, cifrarCredenciais, type ConectorWhatsapp } from "../_shared/whatsapp.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const IPE = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const DECISAO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const MEMBRO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const SEM_WHATSAPP = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ENVIO = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const CODIGO = "oKScGnkVm4SEIzrunT7G1S2WQqE0wJ7WPrEW_5Pfs58";
const TEXTO = "Votação do conselho do Residencial Ipê: Qual conserto fazer na laje da G2\n\nVote até 31/07/2026 pelo seu link pessoal:\n[link]";

async function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, { instancia: "ipe-inst", token: "t-123456789" });
  const credenciais = btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  let lotes: unknown[] = [{ condominio: IPE, instancia: "ipe-inst", credenciais,
    envios: [{ envio: ENVIO, para: "+5561999990002", texto: TEXTO, link: CODIGO, rota: "conselho" }] }];
  const enviados: { para: string; texto: string }[] = [];
  const conector = {
    provedor: "TESTE",
    enviarTexto(_cred: unknown, para: string, texto: string) {
      enviados.push({ para, texto });
      return Promise.resolve({ ok: true, id: "P1" });
    },
  } as unknown as ConectorWhatsapp;
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: IPE, nome: "Residencial Ipê", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), IPE);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    whatsapp_pegar_lote: () => {
      const l = lotes;
      lotes = [];
      return l;
    },
    whatsapp_resultado: () => null,
    whatsapp_midias_pendentes: () => [],
    plataforma_reenviar_link_conselho: (a) => (a.p_membro === MEMBRO
      ? { membroId: MEMBRO, nome: "Lúcia Prado", canal: "WHATSAPP", finalidade: "VOTO", decisaoId: DECISAO, envio: "WHATSAPP", estado: "NA_FILA", codigo: CODIGO }
      : { membroId: SEM_WHATSAPP, nome: "Joana", canal: "WHATSAPP", finalidade: "VOTO", decisaoId: DECISAO, envio: "COPIAR",
          semWhatsapp: "WHATSAPP_DESLIGADO", codigo: CODIGO }),
    plataforma_marcar_ausencia: () => ({ id: DECISAO, versao: 1,
      links: [{ membroId: MEMBRO, canal: "WHATSAPP", finalidade: "SUBSTITUTO", envio: "WHATSAPP", estado: "NA_FILA" }] }),
  });
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, aoFundo: (p) => fundo.push(p), whatsapp: { conector, chave },
  });
  return { pedir: pedido(app, "api-plataforma"), enviados, fundo, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: IPE }, cookie });
  return cookie;
}

Deno.test("V-14: o link que foi pelo WhatsApp é reconhecido na resposta, solto ou na lista de links", () => {
  assert(algumPorWhatsapp({ envio: "WHATSAPP" }));
  assert(algumPorWhatsapp({ links: [null, { envio: "COPIAR" }, { envio: "WHATSAPP" }] }));
  assert(!algumPorWhatsapp({ envio: "COPIAR" }));
  assert(!algumPorWhatsapp({ links: [{ envio: "EMAIL" }] }));
  assert(!algumPorEmail({ envio: "WHATSAPP" }), "o WhatsApp não esvazia a fila do e-mail");
  assert(!algumPorWhatsapp(null));
});

Deno.test("W-20: reenviar pelo WhatsApp manda na hora, com o código na rota /conselho", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/decisoes/${DECISAO}/reenviar-link`, { corpo: { membroId: MEMBRO }, cookie });
  assertEquals(r.status, 200);
  const corpo = await r.json();
  assertEquals([corpo.envio, corpo.estado, corpo.codigo], ["WHATSAPP", "NA_FILA", CODIGO], "a síndica ainda pode copiar o link");
  assertEquals(m.fundo.length, 1, "a fila do WhatsApp começa sem esperar o minuto");
  await Promise.all(m.fundo);
  assertEquals(m.enviados, [{ para: "+5561999990002", texto: TEXTO.replace("[link]", `https://plataforma.exemplo/conselho/${CODIGO}`) }]);
});

Deno.test("V-14: sem WhatsApp no condomínio, o link fica para copiar e nada vai para a fila", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/decisoes/${DECISAO}/reenviar-link`, { corpo: { membroId: SEM_WHATSAPP }, cookie });
  const corpo = await r.json();
  assertEquals([corpo.envio, corpo.semWhatsapp], ["COPIAR", "WHATSAPP_DESLIGADO"]);
  assertEquals(m.fundo.length, 0);
});

Deno.test("V-14: o link do substituto pelo WhatsApp, ao marcar a ausência, também sai na hora", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/ausencia", { corpo: { de: "2026-07-28", ate: "2026-08-05", motivo: "Viagem" }, cookie });
  assertEquals(r.status, 201);
  assertEquals(m.fundo.length, 1);
});
