// Entrada da Edge Function api-plataforma. As dependências reais ficam aqui; os testes montam o
// mesmo app com dependências falsas.

import { adminGoTrue, authGoTrue } from "../_shared/auth.ts";
import { armazenamentoSupabase } from "../_shared/arquivos.ts";
import { bancoPostgrest } from "../_shared/banco.ts";
import { correioResend } from "../_shared/email.ts";
import { conectorAnthropic, conectorIaTeste, conectorTranscricaoTeste } from "../_shared/ia.ts";
import { chaveCredenciais, conectorWafly } from "../_shared/whatsapp.ts";
import { criarApiPlataforma } from "./app.ts";

// O runtime do Supabase deixa terminar o que continua depois da resposta.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function exigir(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta a variável ${nome}`);
  return v;
}

const url = exigir("SUPABASE_URL");
// WhatsApp (passo 5, piloto pelo Wafly): sem WAFLY_CLIENT_TOKEN e WHATSAPP_CHAVE, a fila espera.
const waflyToken = Deno.env.get("WAFLY_CLIENT_TOKEN");
const chaveWhatsapp = Deno.env.get("WHATSAPP_CHAVE");
const chaveServico = exigir("SUPABASE_SERVICE_ROLE_KEY");
// Motor de IA (IA-20): a chave fica só no segredo da função; sem ela, a sugestão fica indisponível
// e o pedido segue como sempre. IA_TESTE=1 liga o provedor de teste (local e testes, nunca em produção).
// Ainda não há serviço de transcrição contratado: sem ele, o áudio aparece só com o som.
const chaveAnthropic = Deno.env.get("ANTHROPIC_API_KEY");
const iaTeste = Deno.env.get("IA_TESTE") === "1";
const app = criarApiPlataforma(Deno.env.get("REPASSE_SEGREDO"), {
  banco: bancoPostgrest(url, chaveServico),
  auth: authGoTrue(url, exigir("SUPABASE_ANON_KEY")),
  admin: adminGoTrue(url, chaveServico),
  urlApp: exigir("PLATAFORMA_URL"),
  armazenamento: armazenamentoSupabase(url, chaveServico),
  armazenamentoManutencao: armazenamentoSupabase(url, chaveServico, fetch, "manutencoes"),
  armazenamentoComunicados: armazenamentoSupabase(url, chaveServico, fetch, "comunicados"),
  armazenamentoDocumentos: armazenamentoSupabase(url, chaveServico, fetch, "documentos"),
  armazenamentoExportacoes: armazenamentoSupabase(url, chaveServico, fetch, "exportacoes"),
  armazenamentoSuporte: armazenamentoSupabase(url, chaveServico, fetch, "suporte"),
  armazenamentoRelatorios: armazenamentoSupabase(url, chaveServico, fetch, "relatorios"),
  armazenamentoPortaria: armazenamentoSupabase(url, chaveServico, fetch, "portaria"),
  armazenamentoComercial: armazenamentoSupabase(url, chaveServico, fetch, "comercial"),
  // E-mail (CD-13, CD-14): sem RESEND_API_KEY, a fila só espera.
  correio: Deno.env.get("RESEND_API_KEY") ? correioResend(Deno.env.get("RESEND_API_KEY")!) : undefined,
  remetente: Deno.env.get("EMAIL_REMETENTE") || undefined,
  urlFuncao: `${url}/functions/v1/api-plataforma`,
  segredoWebhook: Deno.env.get("RESEND_WEBHOOK_SECRET") || undefined,
  aoFundo: (p) => (typeof EdgeRuntime !== "undefined" ? EdgeRuntime.waitUntil(p) : void p),
  ia: {
    sugerir: { ...(chaveAnthropic ? { ANTHROPIC: conectorAnthropic(chaveAnthropic) } : {}), ...(iaTeste ? { TESTE: conectorIaTeste() } : {}) },
    transcrever: iaTeste ? { TESTE: conectorTranscricaoTeste() } : {},
  },
  whatsapp: waflyToken && chaveWhatsapp ? { conector: conectorWafly(waflyToken), chave: await chaveCredenciais(chaveWhatsapp) } : undefined,
});

Deno.serve(app.fetch);
