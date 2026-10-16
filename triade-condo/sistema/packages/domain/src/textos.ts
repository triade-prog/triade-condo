// Textos que a pessoa lê quando algo não dá certo. Escritos para quem usa o sistema:
// dizem o que aconteceu e o que fazer, sem termo técnico.

import type { CodigoErro } from "./erros.ts";

export const TEXTOS_ERRO: Record<CodigoErro, string> = {
  VALIDATION_ERROR: "Confira os campos destacados e tente de novo.",
  UNAUTHORIZED: "Sua sessão terminou. Entre de novo para continuar.",
  INVALID_CREDENTIALS: "E-mail ou senha não conferem.",
  EMAIL_NOT_VERIFIED: "Confirme o seu e-mail pelo link que enviamos antes de entrar.",
  MFA_REQUIRED: "Digite o código do aplicativo autenticador para continuar.",
  FORBIDDEN: "Você não tem acesso a esta ação.",
  CONDOMINIO_REQUIRED: "Escolha o condomínio para continuar.",
  NOT_FOUND: "Não encontramos o que você procurou.",
  VERSION_CONFLICT: "Outra pessoa alterou este registro enquanto você editava. Veja a versão nova; o que você escreveu continua aqui.",
  TOKEN_INVALID: "Este link já foi usado ou venceu. Peça um novo.",
  MFA_INVALID: "Código do autenticador não confere. Confira o aplicativo e tente de novo.",
  PASSWORD_WEAK: "Escolha uma senha mais forte: 12 caracteres ou mais, sem sequências comuns.",
  RATE_LIMITED: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  INTERNAL_ERROR: "Algo deu errado do nosso lado. Tente de novo em instantes.",
  UPSTREAM_UNAVAILABLE: "O serviço está fora do ar agora. Tente de novo em instantes.",
};

/** Resposta da recuperação de senha: a mesma para conta que existe e para a que não existe (PT-08). */
export const TEXTO_RECUPERACAO_ENVIADA =
  "Se este e-mail tiver acesso à TRÍADE Condo, enviamos um link para criar uma senha nova. O link vale por uma hora e só pode ser usado uma vez.";
