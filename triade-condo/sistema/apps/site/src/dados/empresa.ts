// Dados da empresa e dos canais (EM-01, EM-03). Vêm do ambiente para não publicar
// número ou CNPJ provisórios: sem o valor, o site esconde o que depende dele.

const digitos = (v: string | undefined) => (v ?? "").replace(/\D/g, "");
// As páginas são geradas no build: vale o .env e também a variável do ambiente (a da Vercel).
const ler = (nome: string): string => (import.meta.env[nome] as string | undefined) ?? (typeof process !== "undefined" ? process.env[nome] : undefined) ?? "";

// Número comercial passado pela Carolina em 23/10/2026; a variável do ambiente, se existir, vale mais.
export const whatsappComercial = digitos(ler("PUBLIC_WHATSAPP_COMERCIAL")) || "5511957850073";
export const razaoSocial = ler("PUBLIC_RAZAO_SOCIAL").trim();
export const cnpj = ler("PUBLIC_CNPJ").trim();

export const cidade = "Brasília, DF";
export const horarioAtendimento = "dias úteis, das 9h às 18h";
export const promessaRetorno = "até o fim do próximo dia útil";
export const duracaoDemonstracao = "30 minutos";
export const enderecoPlataforma = "https://condominio.trihub.com.br";
// E-mail de contato passado pela Carolina em 23/10/2026.
export const emailContato = "suporte@trihub.com.br";
export const endereco = "Brasília, Distrito Federal, CEP 72006-080";
export const redes = [
  { nome: "Instagram", url: "https://www.instagram.com/triadecondo" },
  { nome: "Facebook", url: "https://www.facebook.com/triadecondo" },
];

/** Link do WhatsApp comercial com a mensagem pronta, ou null se o número não estiver configurado. */
export function linkWhatsapp(mensagem?: string): string | null {
  if (!whatsappComercial) return null;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${whatsappComercial}${texto}`;
}

/** Número formatado para leitura: +55 61 9 0000-0000. */
export function whatsappLegivel(): string | null {
  const n = whatsappComercial;
  if (n.length < 12) return n || null;
  const ddi = n.slice(0, 2), ddd = n.slice(2, 4), resto = n.slice(4);
  const meio = resto.length === 9 ? `${resto[0]} ${resto.slice(1, 5)}-${resto.slice(5)}` : `${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `+${ddi} ${ddd} ${meio}`;
}
