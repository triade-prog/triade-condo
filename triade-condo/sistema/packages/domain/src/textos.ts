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
  INVALID_TRANSITION: "Esta mudança não é permitida agora.",
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

/** Motivo de uma recusa do banco (detalhes.motivo), dito para quem usa o Console. */
export const TEXTOS_MOTIVO: Record<string, string> = {
  SEM_SINDICO: "Convide o síndico antes de concluir a implantação.",
  MESMO_ESTAGIO: "O cliente já está neste estágio.",
  JA_SINDICO: "Esta pessoa já é síndica deste condomínio.",
  JA_NA_EQUIPE: "Esta pessoa já está na equipe.",
  JA_ATRIBUIDO: "Esta pessoa já atende o cliente com esta função.",
  FUNCAO_NAO_ATRIBUIDA: "Esta pessoa não tem esta função na equipe. Reveja as funções dela antes.",
  ULTIMA_ADMINISTRACAO: "Sempre precisa sobrar alguém com administração.",
  PROPRIA_CONTA: "Você não pode desativar a sua própria conta.",
  FERIADO_REPETIDO: "Já existe um feriado nesta data.",
  NOME_REPETIDO: "Já existe um item ativo com este nome.",
  PRIORIDADE_ESSENCIAL: "Mantenha ao menos uma prioridade ativa.",
  ETAPA_ESSENCIAL: "Mantenha ao menos uma etapa geral ativa de aberto e uma de encerrado.",
  ETAPA_IDENTIDADE_FIXA: "A situação e a categoria de uma etapa não mudam. Para outra, crie uma etapa nova.",
  PRAZO_REPETIDO: "Já existe um prazo para esta combinação. Mude as horas dele.",
  PRAZO_GERAL: "A regra geral não sai. Mude as horas dela.",
  JA_TEM_ACESSO: "Esta pessoa já tem acesso a este condomínio.",
  SUBSTITUTO_NECESSARIO: "Esta pessoa é a responsável padrão da fila. Escolha quem assume ou deixe a pendência explícita.",
  SUBSTITUTO_INVALIDO: "Quem assume precisa estar entre os responsáveis e disponível.",
  PADRAO_NECESSARIO: "Escolha o responsável padrão da fila.",
  PADRAO_INDISPONIVEL: "O responsável padrão precisa estar na lista e disponível.",
  RESPONSAVEL_INVALIDO: "Só o síndico ou uma pessoa autorizada, com acesso ativo, atende os pedidos.",
  BLOCO_COM_UNIDADES: "Ainda há unidades ativas aqui. Desative-as ou mude-as de lugar antes.",
  UNIDADE_REPETIDA: "Já existe uma unidade ativa com esta identificação neste lugar (torre ou bloco e andar).",
  UNIDADE_COM_CONTATOS: "Esta unidade ainda tem contatos. Registre a mudança ou encerre os vínculos antes de desativar.",
  UNIDADE_INATIVA: "Esta unidade está desativada.",
  CONTATO_JA_NA_UNIDADE: "Este contato já está nesta unidade.",
  CONTATO_REMOVIDO: "Os dados deste contato foram removidos. Cadastre a pessoa de novo, se for o caso.",
  CONTATO_COM_UNIDADE: "Este contato ainda está em alguma unidade. Encerre os vínculos antes de remover os dados.",
  VINCULO_ENCERRADO: "Este vínculo já foi encerrado.",
  NAO_PENDENTE: "Este contato já não está a confirmar. Atualize a lista.",
  PENDENTE_SE_RECUSA: "Contato a confirmar não sai por mudança: confirme ou recuse.",
  MUDANCA_VAZIA: "Diga quem sai ou quem entra na unidade.",
  ESTRUTURA_COM_BLOCOS: "Ainda há torres ou blocos ativos. Desative-os antes de tirar a divisão.",
  ESTRUTURA_COM_ANDARES: "Ainda há unidades com andar. Tire o andar delas antes de deixar de usar andar.",
  SEM_ANDAR: "Este condomínio não usa andar. Ligue o uso de andar em Como o prédio se organiza.",
  LINHA_INVALIDA: "Uma linha da planilha tem dado inválido. Corrija e envie de novo; nada foi gravado.",
};

/** Convite enviado para quem já tinha conta: nenhum e-mail novo sai, o acesso aparece no próximo login. */
export const TEXTO_CONVITE_CONTA_EXISTENTE =
  "Esta pessoa já tem conta na TRÍADE Condo. O novo acesso aparece para ela na próxima vez que entrar.";
export const TEXTO_CONVITE_ENVIADO =
  "Convite enviado. A pessoa recebe um e-mail para criar a senha; o link vale por um dia e só pode ser usado uma vez.";
