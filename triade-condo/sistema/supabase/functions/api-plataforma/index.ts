// Entrada da Edge Function api-plataforma. As dependências reais ficam aqui; os testes montam o
// mesmo app com dependências falsas.

import { adminGoTrue, authGoTrue } from "../_shared/auth.ts";
import { armazenamentoSupabase } from "../_shared/arquivos.ts";
import { bancoPostgrest } from "../_shared/banco.ts";
import { correioResend } from "../_shared/email.ts";
import { criarApiPlataforma } from "./app.ts";

// O runtime do Supabase deixa terminar o que continua depois da resposta.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function exigir(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta a variável ${nome}`);
  return v;
}

const url = exigir("SUPABASE_URL");
const chaveServico = exigir("SUPABASE_SERVICE_ROLE_KEY");
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
  // E-mail (CD-13, CD-14): sem RESEND_API_KEY, a fila só espera.
  correio: Deno.env.get("RESEND_API_KEY") ? correioResend(Deno.env.get("RESEND_API_KEY")!) : undefined,
  remetente: Deno.env.get("EMAIL_REMETENTE") || undefined,
  urlFuncao: `${url}/functions/v1/api-plataforma`,
  segredoWebhook: Deno.env.get("RESEND_WEBHOOK_SECRET") || undefined,
  aoFundo: (p) => (typeof EdgeRuntime !== "undefined" ? EdgeRuntime.waitUntil(p) : void p),
});

Deno.serve(app.fetch);
