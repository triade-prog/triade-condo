// Entrada da Edge Function api-console. As dependências reais ficam aqui; os testes montam o
// mesmo app com dependências falsas.

import { armazenamentoSupabase } from "../_shared/arquivos.ts";
import { adminGoTrue, authGoTrue } from "../_shared/auth.ts";
import { bancoPostgrest } from "../_shared/banco.ts";
import { chaveCredenciais, conectorWafly } from "../_shared/whatsapp.ts";
import { criarApiConsole } from "./app.ts";

function exigir(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta a variável ${nome}`);
  return v;
}

const url = exigir("SUPABASE_URL");
// WhatsApp (passo 5, piloto pelo Wafly): sem WAFLY_CLIENT_TOKEN e WHATSAPP_CHAVE, a aba avisa que está desligado.
const waflyToken = Deno.env.get("WAFLY_CLIENT_TOKEN");
const chaveWhatsapp = Deno.env.get("WHATSAPP_CHAVE");
const chaveServico = exigir("SUPABASE_SERVICE_ROLE_KEY");
const app = criarApiConsole(Deno.env.get("REPASSE_SEGREDO"), {
  banco: bancoPostgrest(url, chaveServico),
  auth: authGoTrue(url, exigir("SUPABASE_ANON_KEY")),
  admin: adminGoTrue(url, chaveServico),
  urlApp: exigir("CONSOLE_URL"),
  urlPlataforma: exigir("PLATAFORMA_URL"),
  armazenamentoSuporte: armazenamentoSupabase(url, chaveServico, fetch, "suporte"),
  // Documentos do aceite e contratos do Comercial (0308): bucket privado "comercial", só PDF, até 10 MB.
  armazenamentoContrato: armazenamentoSupabase(url, chaveServico, fetch, "comercial"),
  whatsapp: waflyToken && chaveWhatsapp
    ? { conector: conectorWafly(waflyToken), chave: await chaveCredenciais(chaveWhatsapp), urlAvisos: `${url}/functions/v1/api-plataforma` }
    : undefined,
  // Pedido de demonstração do site (0296, CM-01): sem SITE_SEGREDO, a entrada fica fechada.
  segredoSite: Deno.env.get("SITE_SEGREDO"),
});

Deno.serve(app.fetch);
