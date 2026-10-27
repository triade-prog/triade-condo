// API do Console TRÍADE. Só a equipe ativa, sempre com o autenticador (F0.6, PT-08).
// Passo 1: carteira, ficha, cenário, convite do síndico, notas internas, histórico e equipe.
// Passo 5: a conexão do WhatsApp de cada cliente (piloto pelo Wafly, DC14).
// Planos e pagamentos (peças C3 e C4): plano, conjuntos contratados e liberados, cobranças e recebimentos.
// Tabela de preços (0295): faixas, parâmetros, concorrentes, histórico e a sugestão do plano.
// Retenção de dados (0301): o inventário, as rodadas da rotina e o modo (só contando ou apagando).
// Comercial (0296): interessados, Meu dia, ficha, conversas, cadências, planilha, modelos e a
// entrada do site, que vem de fora do repasse e se protege com o segredo próprio do site.
// Propostas (0304): sugestão pela tabela, versões, desconto, envio, link sem conta com aceite,
// kit para o conselho, respostas prontas e referências.
// Kit pelos critérios do síndico (0307): os critérios e o problema na ficha do prédio e os fatos
// que a equipe confirmou sobre o sistema atual e os concorrentes.
// Contrato pelo gov.br, piloto, virar cliente, troca de sistema e vários condomínios (0308): o
// modelo de contrato, os documentos do aceite, o PDF montado aqui, a conferência automática do PDF
// assinado, a conferência da equipe, virar cliente e o link do síndico depois do aceite.
// Parceiros, comissão, agenda de demonstrações e calculadora do site (0310, R17.6): os parceiros e
// o extrato, o pagamento registrado, a disponibilidade, os bloqueios, o link de agendamento sem
// conta (/a/[codigo]), a fila de e-mails da agenda e a calculadora (só o necessário, nunca a tabela
// inteira). A taxa média de condomínio na versão e no kit (R17.3c).
// Quem pode o quê é decidido no banco (funções internas e clientes atribuídos, PI-10); aqui
// só se valida a entrada e se fala com o Auth para os convites.

import type { Context } from "hono";
import {
  emailDaEquipe,
  abrirSuporteAcessoSchema,
  atribuirSchema,
  atualizarChamadoSchema,
  cadastrarMembroSchema,
  cenarioSchema,
  contratoSchema,
  convidarPessoaSchema,
  COOKIES_CONSOLE,
  criarCondominioSchema,
  decidirSuporteAcessoSchema,
  entregaSchema,
  ErroDominio,
  estagioSchema,
  etapaImplantacaoSchema,
  fichaSchema,
  FILTROS_CHAMADO,
  funcoesSchema,
  mascararEmail,
  notaSchema,
  pedirAcessoExcepcionalSchema,
  pendenciaImplantacaoSchema,
  resolverPendenciaImplantacaoSchema,
  responderChamadoSchema,
  trocaSindicoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  verificarSuporteAcessoSchema,
  versaoSchema,
  credenciaisWhatsappSchema,
  CHAVES_MODELO,
  corpoModeloSchema,
  decidirModeloSchema,
  desconectarWhatsappSchema,
  editarModeloSchema,
  ajusteAnexarSchema,
  ajusteEtapaManutencaoSchema,
  ajusteEtapaSchema,
  ajusteFusoSchema,
  ajusteParecidosSchema,
  conferirParteSchema,
  abrirCompetenciaSchema,
  ajusteCobrancaSchema,
  conferirRecebimentoSchema,
  contratarConjuntoSchema,
  devolverRecebimentoSchema,
  identificarRecebimentoSchema,
  liberarConjuntoSchema,
  planoSchema,
  recebimentoSchema,
  suspenderConjuntoSchema,
  testarConjuntoSchema,
  valorCobrancaSchema,
  centavosDeMicros,
  chaveIaSchema,
  custoNoLimiteCentavos,
  limitesIaSchema,
  PRECOS_IA,
  arquivarConcorrenteSchema,
  CODIGOS_FAIXA,
  concorrenteSchema,
  faixaPrecoSchema,
  parametrosPrecoSchema,
  sugestaoPlanoSchema,
  modoRetencaoSchema,
  cadenciaAcaoSchema,
  cadenciaComercialSchema,
  conversaComercialSchema,
  criteriosInteressadoSchema,
  entradaSiteSchema,
  etapaInteressadoSchema,
  etapaParametrosSchema,
  ETAPAS_COMERCIAL,
  fatoComparativoSchema,
  fichaInteressadoSchema,
  importarComercialSchema,
  mensagemComercialSchema,
  naoContatarSchema,
  novoInteressadoSchema,
  proximoPassoSchema,
  diaDoMes,
  mesComercialSchema,
  metaComercialSchema,
  sindicoNovoSchema,
  tratarJanelaSchema,
  ABAS_PROPOSTAS,
  aceitePropostaSchema,
  acaoVersaoSchema,
  novaPropostaSchema,
  recusarDescontoSchema,
  recusarPropostaSchema,
  referenciaComercialSchema,
  respostaComercialSchema,
  responderDescontoSchema,
  retirarFatoSchema,
  retirarReferenciaSchema,
  revogarLinkSchema,
  salvarVersaoSchema,
  sugestaoPropostaSchema,
  cartaTrocaSchema,
  conferirEnvioSchema,
  documentoAceiteSchema,
  encerrarPilotoSchema,
  envioContratoPublicoSchema,
  envioContratoSchema,
  gerarContratoSchema,
  iniciarPilotoSchema,
  modeloContratoSchema,
  novaOportunidadeSchema,
  PLANILHA_TROCA,
  planilhaTrocaCsv,
  recusarEnvioSchema,
  TAMANHO_MAXIMO_PDF_CONTRATO,
  trocaSistemaSchema,
  usarModeloContratoSchema,
  virarClienteSchema,
  agendarDemonstracaoSchema,
  bloqueioAgendaSchema,
  calculadoraSiteSchema,
  demonstracaoFeitaSchema,
  disponibilidadeSchema,
  encerrarComissaoSchema,
  encerrarDemonstracaoSchema,
  indicacaoParceiroSchema,
  linkAgendaSchema,
  marcarDemonstracaoSchema,
  pagamentoComissaoSchema,
  parceiroSchema,
  regraComissaoSchema,
  remarcarDemonstracaoSchema,
  taxaKitSchema,
  avisoReajusteSchema,
  clienteFicouSchema,
  confirmarCancelamentoSchema,
  dispensarRenovacaoSchema,
  editarExpansaoSchema,
  encerrarExpansaoSchema,
  marcarRiscoSchema,
  modeloAditivoSchema,
  novaExpansaoSchema,
  pedirCancelamentoSchema,
  regraReajusteSchema,
  retencaoCancelamentoSchema,
  tratarRiscoSchema,
  usarModeloAditivoSchema,
} from "@triade/domain";
import type { Correio } from "../_shared/email.ts";
import { type EmailComercialFila, montarEmailComercial } from "./email_comercial.ts";
import { type Armazenamento, verificarArquivo } from "../_shared/arquivos.ts";
import {
  type ConferenciaAssinatura,
  conferirAssinatura,
  gerarPdfAditivo,
  gerarPdfContrato,
  type RetratoAditivo,
  type RetratoContrato,
  sha256Bytes,
} from "./contrato.ts";
import type { AdminAuth } from "../_shared/auth.ts";
import { registrar } from "../_shared/registro.ts";
import { criarApp } from "../_shared/app.ts";
import { ipDaChamada, segredoConfere } from "../_shared/repasse.ts";
import { hmacHex } from "../_shared/cripto.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";
import { lerCorpo } from "../_shared/validar.ts";
import { idDaRota, rotasConfiguracao } from "../_shared/rotas_configuracao.ts";
import { cifrarCredenciais, decifrarCredenciais, type ConectorWhatsapp, type CredenciaisWhatsapp } from "../_shared/whatsapp.ts";

export interface DepsConsole extends DepsSessao {
  admin: AdminAuth;
  /** Endereço do Console (links de senha e convite da equipe). */
  urlApp: string;
  /** Endereço da Plataforma (convite do síndico). */
  urlPlataforma: string;
  /** Imagens dos chamados de suporte (bucket "suporte"), só leitura no Console. */
  armazenamentoSuporte?: Armazenamento;
  /**
   * WhatsApp do condomínio (passo 5): o conector, a chave que cifra as credenciais e o endereço
   * da api-plataforma, onde chegam os avisos do provedor.
   */
  whatsapp?: { conector: ConectorWhatsapp; chave: CryptoKey; urlAvisos: string };
  /** Segredo que o site manda no pedido de demonstração (CM-01). Sem ele, a entrada fica fechada. */
  segredoSite?: string;
  /** Documentos do aceite, contratos gerados e PDFs assinados (bucket "comercial", 0308). */
  armazenamentoContrato?: Armazenamento;
  /** Confirmação e lembrete da demonstração (0310) pelo Resend. Sem correio, a fila registra "sem chave". */
  correio?: Correio;
  /** Remetente dos e-mails da agenda e para onde a resposta vai (o e-mail do Comercial). */
  remetenteComercial?: string;
  responderComercial?: string;
}

/** Cabeçalho com o segredo do site na entrada dos pedidos de demonstração. */
export const CABECALHO_SITE = "x-site-segredo";
/** O IP de quem usa a calculadora, repassado pelo site (que manda o segredo) para o limite por pessoa. */
export const CABECALHO_SITE_CLIENTE = "x-site-cliente";

/** Código do link de agendamento (12 letras e números, 0310). */
const CODIGO_AGENDA = /^[a-z2-9]{12}$/;

/** Código do link da proposta (32 bytes em base64url, 0304). */
const CODIGO_PROPOSTA = /^[A-Za-z0-9_-]{20,64}$/;
const UUID_ROTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Área do acesso excepcional na rota (PI-11). */
const AREAS_ROTA: Record<string, "PEDIDOS" | "MORADORES" | "COMUNICADOS" | "MANUTENCAO"> = {
  pedidos: "PEDIDOS",
  moradores: "MORADORES",
  comunicados: "COMUNICADOS",
  manutencao: "MANUTENCAO",
};

interface LinhaCarteira {
  condominio_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  estagio: string;
  cenario: string | null;
  funcoes: string[];
  situacoes: string[];
  criado_em: string;
}

interface LinhaHistorico {
  id: number;
  ocorrido_em: string;
  autor_tipo?: string;
  autor_id: string | null;
  autor_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados: Record<string, unknown>;
  interno?: boolean;
  alvo_nome?: string | null;
}


function paginacao(c: Context): { p_antes: number | null; p_limite: number } {
  const antes = Number(c.req.query("antes"));
  const limite = Number(c.req.query("limite"));
  return {
    p_antes: Number.isInteger(antes) && antes > 0 ? antes : null,
    p_limite: Number.isInteger(limite) && limite > 0 ? Math.min(limite, 200) : 50,
  };
}

function historico(l: LinhaHistorico) {
  return {
    id: l.id,
    ocorridoEm: l.ocorrido_em,
    autor: l.autor_id ? { id: l.autor_id, nome: l.autor_nome } : null,
    acao: l.acao,
    entidade: l.entidade,
    entidadeId: l.entidade_id,
    dados: l.dados,
    ...(l.interno === undefined ? {} : { interno: l.interno }),
  };
}

// Na equipe, o evento diz de quem fala: o nome atual da pessoa, lido na hora pelo banco (D4.28).
function historicoEquipe(l: LinhaHistorico) {
  return { ...historico(l), alvo: l.alvo_nome && l.entidade_id ? { id: l.entidade_id, nome: l.alvo_nome } : null };
}

export function criarApiConsole(segredo: string | undefined, deps: DepsConsole) {
  const app = criarApp<VarsSessao>("api-console", segredo, [/^\/v1\/site\/interessados$/, /^\/v1\/site\/calculadora$/]);
  const sessao = criarSessao(
    { sistema: "console", cookie: COOKIES_CONSOLE.sessao, autenticadorObrigatorio: true, funcaoAcesso: "acesso_console", urlApp: deps.urlApp },
    deps,
  );
  const rpc = deps.banco.rpc.bind(deps.banco);

  /** Convite pelo Auth, com limite por pessoa da equipe. */
  async function convidar(pessoaId: string, email: string, voltarPara: string) {
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "convite", p_chave: pessoaId }))) throw new ErroDominio("RATE_LIMITED");
    return await deps.admin.convidar(email, `${voltarPara}/convite`);
  }

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-console" }));
  sessao.rotas(app);

  for (const rota of ["/v1/sessao", "/v1/clientes", "/v1/clientes/*", "/v1/equipe", "/v1/equipe/*", "/v1/contagens", "/v1/implantacoes",
                      "/v1/suporte-acesso", "/v1/chamados", "/v1/whatsapp", "/v1/whatsapp/*",
                      "/v1/pagamentos", "/v1/pagamentos/*", "/v1/precos", "/v1/precos/*",
                      "/v1/retencao", "/v1/retencao/*", "/v1/comercial/*"]) app.use(rota, sessao.exigirSessao);
  const pessoa = (c: Context<VarsSessao>) => c.get("sessao").pessoaId;

  // Quem está no Console: nome, funções e o que pode fazer fora de um cliente.
  app.get("/v1/sessao", async (c) => c.json(await rpc("console_sessao", { p_pessoa: pessoa(c) })));

  // Carteira (PI-01, V-10): só os clientes atribuídos.
  app.get("/v1/clientes", async (c) => {
    const linhas = await rpc<LinhaCarteira[]>("console_carteira", { p_pessoa: pessoa(c) });
    return c.json({
      clientes: linhas.map((l) => ({
        id: l.condominio_id,
        nome: l.nome,
        cidade: l.cidade,
        uf: l.uf,
        estagio: l.estagio,
        cenario: l.cenario,
        funcoes: l.funcoes,
        situacoes: l.situacoes,
        criadoEm: l.criado_em,
      })),
    });
  });

  app.post("/v1/clientes", async (c) => {
    const d = await lerCorpo(c, criarCondominioSchema);
    const id = await rpc<string>("console_criar_condominio", {
      p_pessoa: pessoa(c), p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf, p_cenario: d.cenario,
    });
    return c.json({ id }, 201);
  });

  // Ficha (PI-02, CF-01).
  app.get("/v1/clientes/:id", async (c) =>
    c.json(await rpc("console_ficha", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.put("/v1/clientes/:id/ficha", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, fichaSchema);
    const versao = await rpc<number>("console_editar_ficha", {
      p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_nome: d.nome, p_cidade: d.cidade, p_uf: d.uf,
      p_endereco: d.endereco, p_numero_whatsapp: d.numeroWhatsapp, p_contatos: d.contatos,
    });
    return c.json({ versao });
  });

  // Cenário (V-04, V-05, V-06, CF-12).
  app.put("/v1/clientes/:id/cenario", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, cenarioSchema);
    return c.json({ versao: await rpc<number>("console_escolher_cenario", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_cenario: d.cenario }) });
  });

  // Referência do contrato (PI-02): só administração.
  app.put("/v1/clientes/:id/contrato", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, contratoSchema);
    return c.json({
      versao: await rpc<number>("console_alterar_contrato", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_referencia: d.referenciaContrato }),
    });
  });

  // Estágio (PI-01).
  app.put("/v1/clientes/:id/estagio", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, estagioSchema);
    return c.json({
      versao: await rpc<number>("console_mudar_estagio", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_estagio: d.estagio, p_motivo: d.motivo }),
    });
  });

  // Convidar o síndico (CF-02): conta própria, ligada ao condomínio. A permissão é conferida
  // no banco antes do convite sair (console_ficha falha para quem não está atribuído).
  app.post("/v1/clientes/:id/sindicos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, convidarPessoaSchema);
    const ficha = await rpc<{ permissoes: string[] }>("console_ficha", { p_pessoa: pessoa(c), p_condominio: id });
    if (!ficha.permissoes.includes("console.sindicos.convidar")) throw new ErroDominio("FORBIDDEN");
    const conta = await convidar(pessoa(c), d.email, deps.urlPlataforma);
    const vinculoId = await rpc<string>("console_vincular_sindico", {
      p_pessoa: pessoa(c), p_condominio: id, p_convidado: conta.userId, p_nome: d.nome,
    });
    return c.json({ vinculoId, contaNova: conta.contaNova }, 201);
  });

  // Notas internas (PI-06).
  app.get("/v1/clientes/:id/notas", async (c) => {
    const linhas = await rpc<{ id: string; texto: string; criado_em: string; autor_id: string; autor_nome: string | null }[]>(
      "console_notas", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") });
    return c.json({ notas: linhas.map((n) => ({ id: n.id, texto: n.texto, criadoEm: n.criado_em, autor: { id: n.autor_id, nome: n.autor_nome } })) });
  });

  app.post("/v1/clientes/:id/notas", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, notaSchema);
    return c.json({ id: await rpc<string>("console_escrever_nota", { p_pessoa: pessoa(c), p_condominio: id, p_texto: d.texto }) }, 201);
  });

  // Histórico administrativo do cliente (PI-12).
  app.get("/v1/clientes/:id/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historico) });
  });

  // Atribuir e retirar pessoas da equipe no cliente (PI-10).
  app.post("/v1/clientes/:id/equipe", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, atribuirSchema);
    return c.json({ vinculoId: await rpc<string>("console_atribuir", { p_pessoa: pessoa(c), p_condominio: id, p_membro: d.pessoaId, p_funcao: d.funcao }) }, 201);
  });

  app.post("/v1/clientes/:id/equipe/:vinculo/retirar", async (c) => {
    const id = idDaRota(c, "id");
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, versaoSchema);
    return c.json({
      versao: await rpc<number>("console_retirar_atribuicao", { p_pessoa: pessoa(c), p_condominio: id, p_vinculo: vinculo, p_versao: d.versao }),
    });
  });

  // Equipe (PI-10): só administração.
  app.get("/v1/equipe", async (c) => {
    const linhas = await rpc<{ pessoa_id: string; nome: string; ativa: boolean; funcoes: string[]; desde: string }[]>(
      "console_equipe", { p_pessoa: pessoa(c) });
    return c.json({ pessoas: linhas.map((l) => ({ id: l.pessoa_id, nome: l.nome, ativa: l.ativa, funcoes: l.funcoes, desde: l.desde })) });
  });

  app.post("/v1/equipe", async (c) => {
    const d = await lerCorpo(c, cadastrarMembroSchema);
    // Confere a permissão antes de o convite sair.
    await rpc("console_equipe", { p_pessoa: pessoa(c) });
    const conta = await convidar(pessoa(c), d.email, deps.urlApp);
    await rpc("console_cadastrar_membro", { p_pessoa: pessoa(c), p_membro: conta.userId, p_nome: d.nome, p_funcoes: d.funcoes });
    return c.json({ pessoaId: conta.userId, contaNova: conta.contaNova }, 201);
  });

  app.put("/v1/equipe/:pessoa/funcoes", async (c) => {
    const membro = idDaRota(c, "pessoa");
    const d = await lerCorpo(c, funcoesSchema);
    await rpc("console_definir_funcoes", { p_pessoa: pessoa(c), p_membro: membro, p_funcoes: d.funcoes });
    return c.json({ ok: true });
  });

  app.post("/v1/equipe/:pessoa/desativar", async (c) => {
    await rpc("console_desativar_membro", { p_pessoa: pessoa(c), p_membro: idDaRota(c, "pessoa") });
    return c.json({ ok: true });
  });

  app.get("/v1/equipe/historico", async (c) => {
    const linhas = await rpc<LinhaHistorico[]>("console_historico_equipe", { p_pessoa: pessoa(c), ...paginacao(c) });
    return c.json({ eventos: linhas.map(historicoEquipe) });
  });


  // ---------------------------------------------------------------------------------------
  // Peça R4: implantação, troca de síndico, suporte de acesso, acesso excepcional e chamados.
  // A permissão de cada função interna (PI-10) é conferida no banco.

  app.get("/v1/contagens", async (c) => c.json(await rpc("console_contagens", { p_pessoa: pessoa(c) })));

  // Implantação (PI-04, PI-05, SH-01).
  app.get("/v1/implantacoes", async (c) => c.json({ implantacoes: await rpc("console_implantacoes", { p_pessoa: pessoa(c) }) }));

  app.get("/v1/clientes/:id/implantacao", async (c) =>
    c.json(await rpc("console_implantacao", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.put("/v1/clientes/:id/implantacao/etapas/:numero", async (c) => {
    const id = idDaRota(c, "id");
    const numero = Number(c.req.param("numero"));
    if (!Number.isInteger(numero) || numero < 1 || numero > 20) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, etapaImplantacaoSchema);
    return c.json({
      versao: await rpc<number>("console_salvar_etapa", {
        p_pessoa: pessoa(c), p_condominio: id, p_numero: numero, p_versao: d.versao, p_situacao: d.situacao,
        p_responsavel: d.responsavelId, p_substituto: d.substitutoId, p_feito: d.feito, p_motivo: d.motivo,
        p_modalidade: d.modalidade, p_quando: d.quando,
      }),
    });
  });

  async function salvarPendencia(c: Context<VarsSessao>, pendencia: string | null) {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, pendenciaImplantacaoSchema);
    if (pendencia && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_pendencia", {
      p_pessoa: pessoa(c), p_condominio: id, p_id: pendencia, p_versao: d.versao, p_etapa: d.etapa, p_texto: d.texto,
      p_com_quem: d.comQuem, p_responsavel: d.responsavelId, p_proximo_retorno: d.proximoRetorno,
    });
  }
  app.post("/v1/clientes/:id/implantacao/pendencias", async (c) => c.json(await salvarPendencia(c, null), 201));
  app.put("/v1/clientes/:id/implantacao/pendencias/:pendencia", async (c) => c.json(await salvarPendencia(c, idDaRota(c, "pendencia"))));

  app.post("/v1/clientes/:id/implantacao/pendencias/:pendencia/resolver", async (c) => {
    const id = idDaRota(c, "id");
    const pendencia = idDaRota(c, "pendencia");
    const d = await lerCorpo(c, resolverPendenciaImplantacaoSchema);
    return c.json({
      versao: await rpc<number>("console_resolver_pendencia", {
        p_pessoa: pessoa(c), p_condominio: id, p_id: pendencia, p_versao: d.versao, p_resolucao: d.resolucao,
      }),
    });
  });

  app.post("/v1/clientes/:id/implantacao/entregar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, entregaSchema);
    return c.json({ versao: await rpc<number>("console_entregar_implantacao", { p_pessoa: pessoa(c), p_condominio: id, p_versao: d.versao, p_recado: d.recado }) });
  });

  // Configuração na implantação (PI-04, CF-01, CF-09, CF-12): a aba Configuração da ficha. As
  // partes do app passam pelas mesmas rotas e funções que a Plataforma usa; o banco só deixa
  // mudar enquanto o cliente está em implantação. Fuso, etapas e janelas são ajustes técnicos,
  // só daqui, com motivo depois da entrega. A fila de e-mail sai no próximo ciclo.
  const cliente = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") });
  app.get("/v1/clientes/:id/configuracao", async (c) => c.json(await rpc("console_configuracao", cliente(c))));
  app.post("/v1/clientes/:id/configuracao/conferir", async (c) => {
    const d = await lerCorpo(c, conferirParteSchema);
    return c.json(await rpc("console_conferir_parte", { ...cliente(c), p_parte: d.parte, p_nota: d.nota ?? null }));
  });
  rotasConfiguracao(app, "/v1/clientes/:id/condominio", cliente, deps.banco);

  // IA e custo (IA-20, NG-13, NG-15): o uso e o custo do mês em reais, o custo se usar todo o
  // limite, a chave que desliga a IA do condomínio e o limite. Só a Administração muda (no banco).
  interface UsoIa { chamadas: number; custoMicros: number; custoMicrosReais: number; limite: number }
  const reaisDoUso = (u: UsoIa) => centavosDeMicros(u.custoMicros) + centavosDeMicros(u.custoMicrosReais, "BRL");
  app.get("/v1/clientes/:id/ia", async (c) => {
    const r = await rpc<{ sugerir: UsoIa; transcrever: UsoIa } & Record<string, unknown>>("console_ia_cliente", cliente(c));
    const sugerir = reaisDoUso(r.sugerir);
    const transcrever = reaisDoUso(r.transcrever);
    return c.json({
      ...r,
      reais: {
        sugerirCentavos: sugerir, transcreverCentavos: transcrever, totalCentavos: sugerir + transcrever,
        noLimiteCentavos: custoNoLimiteCentavos(r.sugerir.limite, r.transcrever.limite),
        tabelaDe: PRECOS_IA.tabelaDe, dolarCentavos: PRECOS_IA.dolarEmCentavos,
      },
    });
  });
  app.get("/v1/clientes/:id/ia/chamadas", async (c) => c.json({ chamadas: await rpc("console_ia_chamadas", cliente(c)) }));
  app.put("/v1/clientes/:id/ia/chave", async (c) => {
    const d = await lerCorpo(c, chaveIaSchema);
    return c.json(await rpc("console_ia_chave", { ...cliente(c), p_versao: d.versao, p_ligada: d.ligada, p_motivo: d.motivo || null }));
  });
  app.put("/v1/clientes/:id/ia/limites", async (c) => {
    const d = await lerCorpo(c, limitesIaSchema);
    return c.json(await rpc("console_ia_ajustar", {
      ...cliente(c), p_versao: d.versao, p_limite_sugestoes: d.limiteSugestoes, p_limite_minutos: d.limiteMinutos,
      p_provedor: null, p_modelo: null, p_provedor_transcricao: null,
    }));
  });

  app.put("/v1/clientes/:id/condominio/fuso", async (c) => {
    const d = await lerCorpo(c, ajusteFusoSchema);
    return c.json({ versao: await rpc<number>("console_definir_fuso", { ...cliente(c), p_versao: d.versao, p_fuso: d.fuso, p_motivo: d.motivo ?? null }) });
  });
  app.put("/v1/clientes/:id/condominio/regras-parecidos", async (c) => {
    const d = await lerCorpo(c, ajusteParecidosSchema);
    return c.json({
      versao: await rpc<number>("console_definir_parecidos", { ...cliente(c), p_versao: d.versao, p_dias: d.dias, p_motivo: d.motivo ?? null }),
    });
  });
  app.put("/v1/clientes/:id/condominio/whatsapp/anexar", async (c) => {
    const d = await lerCorpo(c, ajusteAnexarSchema);
    return c.json({
      versao: await rpc<number>("console_definir_anexar", { ...cliente(c), p_versao: d.versao, p_minutos: d.minutos, p_motivo: d.motivo ?? null }),
    });
  });
  const salvarEtapaPedido = async (c: Context<VarsSessao>, etapa: string | null) => {
    const d = await lerCorpo(c, ajusteEtapaSchema);
    if (etapa && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_etapa_pedido", {
      ...cliente(c), p_id: etapa, p_versao: etapa ? d.versao : null, p_nome: d.nome, p_situacao: d.situacao ?? null,
      p_categoria: d.categoriaId ?? null, p_pausa_prazo: d.pausaPrazo ?? null, p_ativa: d.ativa ?? null, p_motivo: d.motivo ?? null,
    });
  };
  app.post("/v1/clientes/:id/condominio/etapas", async (c) => c.json(await salvarEtapaPedido(c, null), 201));
  app.put("/v1/clientes/:id/condominio/etapas/:etapa", async (c) => c.json(await salvarEtapaPedido(c, idDaRota(c, "etapa"))));
  const salvarEtapaManutencao = async (c: Context<VarsSessao>, etapa: string | null) => {
    const d = await lerCorpo(c, ajusteEtapaManutencaoSchema);
    if (etapa && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("console_salvar_etapa_manutencao", {
      ...cliente(c), p_id: etapa, p_versao: etapa ? d.versao : null, p_nome: d.nome, p_situacao: d.situacao ?? null,
      p_ativa: d.ativa ?? null, p_motivo: d.motivo ?? null,
    });
  };
  app.post("/v1/clientes/:id/condominio/etapas-manutencao", async (c) => c.json(await salvarEtapaManutencao(c, null), 201));
  app.put("/v1/clientes/:id/condominio/etapas-manutencao/:etapa", async (c) => c.json(await salvarEtapaManutencao(c, idDaRota(c, "etapa"))));

  // Troca de síndico (CT-01). Confere a permissão antes do convite; a troca é uma só operação no banco.
  app.post("/v1/clientes/:id/troca-sindico", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, trocaSindicoSchema);
    const ficha = await rpc<{ permissoes: string[] }>("console_ficha", { p_pessoa: pessoa(c), p_condominio: id });
    if (!ficha.permissoes.includes("console.troca.fazer")) throw new ErroDominio("FORBIDDEN");
    const conta = await convidar(pessoa(c), d.email, deps.urlPlataforma);
    const r = await rpc<{ trocaId: string; vinculoId: string; autorizados: unknown[] }>("console_trocar_sindico", {
      p_pessoa: pessoa(c), p_condominio: id, p_vinculo: d.vinculoId, p_versao: d.versao, p_novo: conta.userId, p_nome: d.nome,
      p_pedido_por: d.pedidoPor, p_canal: d.canal, p_conferido: d.conferido,
    });
    return c.json({ ...r, contaNova: conta.contaNova }, 201);
  });

  app.get("/v1/clientes/:id/trocas", async (c) =>
    c.json({ trocas: await rpc("console_trocas", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") }) }));

  // Suporte de acesso (PI-09). A equipe nunca vê nem escolhe senha: o link vai para o e-mail
  // já cadastrado, que aparece mascarado.
  app.get("/v1/suporte-acesso", async (c) => c.json({ pedidos: await rpc("console_suportes_acesso", { p_pessoa: pessoa(c) }) }));

  app.get("/v1/clientes/:id/pessoas-plataforma", async (c) =>
    c.json({ pessoas: await rpc("console_pessoas_plataforma", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") }) }));

  app.post("/v1/clientes/:id/suporte-acesso", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, abrirSuporteAcessoSchema);
    return c.json({
      id: await rpc<string>("console_abrir_suporte_acesso", {
        p_pessoa: pessoa(c), p_condominio: id, p_alvo: d.pessoaId, p_tipo: d.tipo, p_canal: d.canal, p_descricao: d.descricao,
      }),
    }, 201);
  });

  const pedidoSuporte = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), p_id: idDaRota(c, "pedido") });

  app.get("/v1/clientes/:id/suporte-acesso/:pedido", async (c) => {
    const r = await rpc<{ pessoaId: string }>("console_suporte_acesso", pedidoSuporte(c));
    const email = await deps.admin.emailDe(r.pessoaId);
    return c.json({ ...r, emailMascarado: email ? mascararEmail(email) : null });
  });

  app.put("/v1/clientes/:id/suporte-acesso/:pedido/verificar", async (c) => {
    const ids = pedidoSuporte(c);
    const d = await lerCorpo(c, verificarSuporteAcessoSchema);
    return c.json({
      versao: await rpc<number>("console_verificar_suporte_acesso", {
        ...ids, p_versao: d.versao, p_tipo: d.tipo, p_dados_conferidos: d.dadosConferidos, p_canal_conhecido: d.canalConhecido,
      }),
    });
  });

  app.post("/v1/clientes/:id/suporte-acesso/:pedido/decidir", async (c) => {
    const ids = pedidoSuporte(c);
    const d = await lerCorpo(c, decidirSuporteAcessoSchema);
    const r = await rpc<{ situacao: string; pessoaId: string; versao: number }>("console_decidir_suporte_acesso", {
      ...ids, p_versao: d.versao, p_decisao: d.decisao, p_motivo: d.motivo,
    });
    if (r.situacao !== "ENVIADO" && r.situacao !== "AUTENTICADOR_TIRADO") return c.json(r);
    try {
      if (r.situacao === "ENVIADO") {
        const email = await deps.admin.emailDe(r.pessoaId);
        if (!email) throw new Error("conta sem e-mail");
        await deps.auth.pedirRecuperacao(email, `${deps.urlPlataforma}/redefinir`);
      } else {
        await deps.admin.removerAutenticadores(r.pessoaId);
      }
    } catch (e) {
      registrar("erro", { funcao: "api-console", rota: "suporte-acesso", erro: e });
      await rpc("console_falha_suporte_acesso", ids);
      throw new ErroDominio("INTERNAL_ERROR");
    }
    return c.json(r);
  });

  // Acesso excepcional (PI-11): pedido ao síndico; com a aprovação, só leitura e cada abertura
  // registrada no histórico do condomínio.
  app.get("/v1/clientes/:id/acessos-excepcionais", async (c) =>
    c.json(await rpc("console_acessos_excepcionais", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  app.post("/v1/clientes/:id/acessos-excepcionais", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, pedirAcessoExcepcionalSchema);
    return c.json({
      id: await rpc<string>("console_pedir_acesso_excepcional", {
        p_pessoa: pessoa(c), p_condominio: id, p_motivo: d.motivo, p_areas: d.areas, p_horas: d.horas, p_chamado: d.chamadoId,
      }),
    }, 201);
  });

  app.get("/v1/clientes/:id/excepcional/:area", async (c) => {
    const id = idDaRota(c, "id");
    const area = AREAS_ROTA[c.req.param("area") ?? ""];
    if (!area) throw new ErroDominio("NOT_FOUND");
    const quem = { p_pessoa: pessoa(c), p_condominio: id };
    const acesso = await rpc<{ validoAte: string }>("console_ler_excepcional", { ...quem, p_area: area });
    const pagina = Math.max(1, Number(c.req.query("pagina")) || 1);
    const busca = (c.req.query("busca") ?? "").trim().slice(0, 60) || null;
    let dados: unknown;
    if (area === "PEDIDOS") {
      dados = await rpc("plataforma_pedidos", {
        ...quem, p_situacao: "TODOS", p_responsavel: null, p_prioridade: null, p_categoria: null, p_atencao: null, p_busca: busca, p_pagina: pagina,
      });
    } else if (area === "MORADORES") {
      dados = await rpc("plataforma_moradores", { ...quem, p_busca: busca, p_estado: null, p_pagina: pagina });
    } else if (area === "MANUTENCAO") {
      dados = await rpc("plataforma_manutencoes", {
        ...quem, p_situacao: null, p_tipo: null, p_prestador: null, p_atencao: null, p_busca: busca, p_pagina: pagina,
      });
    } else {
      dados = {
        comunicados: await rpc("plataforma_comunicados", { ...quem, p_filtro: null, p_assunto: null, p_atencao: null, p_busca: busca, p_pagina: pagina }),
        documentos: await rpc("plataforma_documentos", { ...quem, p_filtro: null, p_busca: busca }),
      };
    }
    return c.json({ area, validoAte: acesso.validoAte, dados });
  });

  // Plano e conjuntos do cliente (peça C3; PI-03, CF-11, PI-16, PI-19, NG-06).
  app.get("/v1/clientes/:id/plano", async (c) => c.json(await rpc("console_plano", cliente(c))));

  // Salvar diz de qual tabela o plano veio (0295): FUNDADOR, CHEIA ou MANUAL (vazio é manual).
  app.put("/v1/clientes/:id/plano", async (c) => {
    const d = await lerCorpo(c, planoSchema);
    return c.json(await rpc("console_salvar_plano_tabela", {
      ...cliente(c), p_versao: d.versao, p_nome: d.nome, p_unidades_de: d.unidadesDe, p_unidades_ate: d.unidadesAte, p_valor: d.valor,
      p_ciclo: d.ciclo, p_dia_vencimento: d.diaVencimento, p_implantacao_valor: d.implantacaoValor,
      p_implantacao_sem_cobranca: d.implantacaoSemCobranca, p_implantacao_referencia: d.implantacaoReferencia,
      p_inicio_competencia: d.inicioCompetencia, p_tabela: d.tabela,
    }));
  });

  // "Usar a tabela" (0295): a sugestão do plano pelas unidades ativas. Não grava nada.
  app.get("/v1/clientes/:id/plano/sugestao", async (c) => {
    const q = sugestaoPlanoSchema.safeParse({ ciclo: c.req.query("ciclo") || undefined, inicio: c.req.query("inicio") || undefined });
    if (!q.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(q.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("console_sugestao_plano", { ...cliente(c), p_ciclo: q.data.ciclo, p_inicio: q.data.inicio }));
  });

  /** O conjunto da rota: só os quatro que se vendem; a base não tem rota. */
  function conjunto(c: Context<VarsSessao>) {
    const codigo = c.req.param("conjunto") ?? "";
    if (!["AGENDA", "MANUTENCAO", "VIDA", "COMUNICACAO_AMPLIADA"].includes(codigo)) throw new ErroDominio("NOT_FOUND");
    return { ...cliente(c), p_conjunto: codigo };
  }

  app.put("/v1/clientes/:id/conjuntos/:conjunto/contrato", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, contratarConjuntoSchema);
    return c.json(await rpc("console_contratar_conjunto", {
      ...ids, p_versao: d.versao, p_contratado: d.contratado, p_referencia: d.referencia ?? null, p_motivo: d.motivo ?? null,
    }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/liberar", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, liberarConjuntoSchema);
    return c.json(await rpc("console_liberar_conjunto", { ...ids, p_versao: d.versao, p_referencia: d.referencia, p_motivo: d.motivo }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/teste", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, testarConjuntoSchema);
    return c.json(await rpc("console_testar_conjunto", { ...ids, p_versao: d.versao, p_ate: d.ate, p_motivo: d.motivo }));
  });

  app.post("/v1/clientes/:id/conjuntos/:conjunto/suspender", async (c) => {
    const ids = conjunto(c);
    const d = await lerCorpo(c, suspenderConjuntoSchema);
    return c.json(await rpc("console_suspender_conjunto", { ...ids, p_versao: d.versao, p_porque: d.porque, p_motivo: d.motivo }));
  });

  // Pagamentos dos clientes (peça C4; PI-07, PI-08): só a equipe que pode; nada vai para o cliente.
  app.get("/v1/pagamentos", async (c) => c.json(await rpc("console_pagamentos", { p_pessoa: pessoa(c) })));

  app.post("/v1/pagamentos/competencias", async (c) => {
    const d = await lerCorpo(c, abrirCompetenciaSchema);
    return c.json(await rpc("console_abrir_competencia", { p_pessoa: pessoa(c), p_competencia: d.competencia }));
  });

  app.post("/v1/pagamentos/recebimentos", async (c) => {
    const d = await lerCorpo(c, recebimentoSchema);
    return c.json(await rpc("console_registrar_recebimento", {
      p_pessoa: pessoa(c), p_condominio: d.condominioId, p_cobranca: d.cobrancaId, p_valor: d.valor, p_recebido_em: d.recebidoEm,
      p_forma: d.forma, p_referencia: d.referencia,
    }), 201);
  });

  app.post("/v1/pagamentos/nao-identificados/:avulso/identificar", async (c) => {
    const d = await lerCorpo(c, identificarRecebimentoSchema);
    return c.json(await rpc("console_identificar_recebimento", {
      p_pessoa: pessoa(c), p_avulso: idDaRota(c, "avulso"), p_condominio: d.condominioId, p_cobranca: d.cobrancaId,
    }));
  });

  const recebimento = (c: Context<VarsSessao>) => ({ ...cliente(c), p_id: idDaRota(c, "recebimento") });

  app.post("/v1/clientes/:id/recebimentos/:recebimento/conferir", async (c) => {
    const ids = recebimento(c);
    const d = await lerCorpo(c, conferirRecebimentoSchema);
    return c.json(await rpc("console_conferir_recebimento", { ...ids, p_versao: d.versao }));
  });

  app.post("/v1/clientes/:id/recebimentos/:recebimento/devolver", async (c) => {
    const ids = recebimento(c);
    const d = await lerCorpo(c, devolverRecebimentoSchema);
    return c.json(await rpc("console_devolver_recebimento", { ...ids, p_versao: d.versao, p_motivo: d.motivo }));
  });

  const cobranca = (c: Context<VarsSessao>) => ({ ...cliente(c), p_id: idDaRota(c, "cobranca") });

  app.get("/v1/clientes/:id/cobrancas/:cobranca", async (c) => c.json(await rpc("console_cobranca", cobranca(c))));

  app.post("/v1/clientes/:id/cobrancas/:cobranca/ajustes", async (c) => {
    const ids = cobranca(c);
    const d = await lerCorpo(c, ajusteCobrancaSchema);
    return c.json(await rpc("console_ajustar_cobranca", { ...ids, p_tipo: d.tipo, p_valor: d.valor, p_motivo: d.motivo }), 201);
  });

  app.put("/v1/clientes/:id/cobrancas/:cobranca/valor", async (c) => {
    const ids = cobranca(c);
    const d = await lerCorpo(c, valorCobrancaSchema);
    return c.json(await rpc("console_definir_valor_cobranca", { ...ids, p_valor: d.valor, p_motivo: d.motivo }));
  });

  // Tabela de preços (0295): só Administração e Financeiro (o banco confere); toda escrita com
  // motivo, no histórico dos preços. Mudar a tabela não mexe em plano que já existe.
  app.get("/v1/precos", async (c) => c.json(await rpc("console_tabela_precos", { p_pessoa: pessoa(c) })));

  app.get("/v1/precos/historico", async (c) => c.json(await rpc("console_historico_precos", { p_pessoa: pessoa(c), ...paginacao(c) })));

  app.put("/v1/precos/faixas/:codigo", async (c) => {
    const codigo = c.req.param("codigo") ?? "";
    if (!(CODIGOS_FAIXA as string[]).includes(codigo)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, faixaPrecoSchema);
    return c.json(await rpc("console_salvar_faixa_preco", {
      p_pessoa: pessoa(c), p_codigo: codigo, p_versao: d.versao, p_fundador: d.fundador, p_cheia: d.cheia, p_implantacao: d.implantacao,
      p_motivo: d.motivo,
    }));
  });

  app.put("/v1/precos/parametros", async (c) => {
    const d = await lerCorpo(c, parametrosPrecoSchema);
    return c.json(await rpc("console_salvar_parametros_preco", {
      p_pessoa: pessoa(c), p_versao: d.versao, p_meses_pagos_anual: d.mesesPagosAnual, p_parcelas_implantacao: d.parcelasImplantacao,
      p_vagas_fundador: d.vagasFundador, p_tabela_em_uso: d.tabelaEmUso, p_motivo: d.motivo,
    }));
  });

  async function salvarConcorrente(c: Context<VarsSessao>, id: string | null) {
    const d = await lerCorpo(c, concorrenteSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("console_salvar_concorrente", {
      p_pessoa: pessoa(c), p_id: id, p_versao: id ? d.versao : null, p_nome: d.nome, p_plano: d.plano, p_modelo: d.modelo,
      p_valor: d.valor, p_a_partir_de: d.aPartirDe, p_faixas: d.faixas, p_por_unidade: d.porUnidade, p_minimo: d.minimo,
      p_fonte: d.fonte, p_conferido: d.conferido, p_lido_em: d.lidoEm, p_observacao: d.observacao, p_motivo: d.motivo,
    });
  }
  app.post("/v1/precos/concorrentes", async (c) => c.json(await salvarConcorrente(c, null), 201));
  app.put("/v1/precos/concorrentes/:concorrente", async (c) => c.json(await salvarConcorrente(c, idDaRota(c, "concorrente"))));

  app.post("/v1/precos/concorrentes/:concorrente/arquivar", async (c) => {
    const id = idDaRota(c, "concorrente");
    const d = await lerCorpo(c, arquivarConcorrenteSchema);
    return c.json(await rpc("console_arquivar_concorrente", { p_pessoa: pessoa(c), p_id: id, p_versao: d.versao, p_motivo: d.motivo }));
  });

  // Retenção de dados (F0.11; PT-11, PT-03): o inventário dos 32 tipos, as rodadas da rotina e o
  // modo. A rotina nasce só contando; ligar a exclusão é da Administração (o banco confere).
  app.get("/v1/retencao", async (c) => c.json(await rpc("console_retencao", { p_pessoa: pessoa(c) })));

  app.put("/v1/retencao/modo", async (c) => {
    const d = await lerCorpo(c, modoRetencaoSchema);
    return c.json(await rpc("console_retencao_modo", { p_pessoa: pessoa(c), p_modo: d.modo, p_versao: d.versao }));
  });

  // Chamados (PI-17, PI-20).
  app.get("/v1/chamados", async (c) => {
    const filtro = c.req.query("filtro") ?? "ABERTOS";
    if (!(filtro in FILTROS_CHAMADO)) throw new ErroDominio("VALIDATION_ERROR", { campos: ["filtro"] });
    return c.json({ chamados: await rpc("console_chamados", { p_pessoa: pessoa(c), p_filtro: filtro }) });
  });

  const chamado = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"), p_id: idDaRota(c, "chamado") });

  app.get("/v1/clientes/:id/chamados/:chamado", async (c) => c.json(await rpc("console_chamado", chamado(c))));

  app.post("/v1/clientes/:id/chamados/:chamado/responder", async (c) => {
    const ids = chamado(c);
    const d = await lerCorpo(c, responderChamadoSchema);
    return c.json(await rpc("console_responder_chamado", { ...ids, p_texto: d.texto, p_interna: d.interna }), 201);
  });

  app.put("/v1/clientes/:id/chamados/:chamado", async (c) => {
    const ids = chamado(c);
    const d = await lerCorpo(c, atualizarChamadoSchema);
    return c.json({
      versao: await rpc<number>("console_atualizar_chamado", { ...ids, p_versao: d.versao, p_situacao: d.situacao, p_responsavel: d.responsavelId }),
    });
  });

  app.get("/v1/clientes/:id/chamados/:chamado/imagens/:arquivo/link", async (c) => {
    if (!deps.armazenamentoSuporte) throw new ErroDominio("INTERNAL_ERROR");
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("console_abrir_arquivo_chamado", { ...chamado(c), p_arquivo: idDaRota(c, "arquivo") });
    const url = await deps.armazenamentoSuporte.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  // WhatsApp do condomínio (passo 5; W-01, DC14): credenciais cifradas que nunca voltam para a
  // tela, conexão pelo QR ou por código e conferência do aparelho. Quem pode é o banco que diz.
  const whatsapp = () => {
    if (!deps.whatsapp) throw new ErroDominio("UPSTREAM_UNAVAILABLE");
    return deps.whatsapp;
  };
  interface AcessoWhatsapp { instancia: string; credenciais: string; numero: string | null; situacao: string }
  async function credenciais(c: Context<VarsSessao>, para: "CONSULTAR" | "CONECTAR" | "DESCONECTAR"): Promise<CredenciaisWhatsapp & { numero: string | null }> {
    const a = await rpc<AcessoWhatsapp>("console_whatsapp_acesso", { ...cliente(c), p_para: para });
    const cred = await decifrarCredenciais(whatsapp().chave, a.credenciais);
    return { instancia: a.instancia || cred.instancia, token: cred.token, numero: a.numero };
  }
  /** Falha do provedor vira "indisponível", sem o endereço (que tem o token) no registro. */
  async function noProvedor<T>(oQue: string, f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (erro) {
      registrar("aviso", { funcao: "api-console", rota: `whatsapp/${oQue}`, erro: erro instanceof Error ? erro.message : "falha" });
      throw new ErroDominio("UPSTREAM_UNAVAILABLE", { motivo: "PROVEDOR" });
    }
  }

  app.get("/v1/whatsapp", async (c) => c.json({ numeros: await rpc("console_whatsapp_lista", { p_pessoa: pessoa(c) }) }));

  // Modelos de mensagem (F5.4, W-20): iguais para todos os clientes; só a administração escreve
  // e decide. No piloto, a administração aprova; no oficial, registra a resposta da Meta.
  const chaveModelo = (c: Context) => {
    const ch = c.req.param("chave") ?? "";
    if (!(CHAVES_MODELO as readonly string[]).includes(ch)) throw new ErroDominio("NOT_FOUND");
    return ch;
  };
  const numeroModelo = (c: Context) => {
    const n = Number(c.req.param("numero"));
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new ErroDominio("NOT_FOUND");
    return n;
  };
  app.get("/v1/whatsapp/modelos", async (c) => c.json(await rpc("console_modelos_whatsapp", { p_pessoa: pessoa(c) })));
  app.get("/v1/whatsapp/modelos/:chave", async (c) =>
    c.json(await rpc("console_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: chaveModelo(c) })));
  app.post("/v1/whatsapp/modelos/:chave/versoes", async (c) => {
    const ch = chaveModelo(c);
    const d = await lerCorpo(c, corpoModeloSchema);
    return c.json(await rpc("console_salvar_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: ch, p_numero: null, p_versao: null, p_corpo: d.corpo }), 201);
  });
  app.put("/v1/whatsapp/modelos/:chave/versoes/:numero", async (c) => {
    const ch = chaveModelo(c);
    const n = numeroModelo(c);
    const d = await lerCorpo(c, editarModeloSchema);
    return c.json(await rpc("console_salvar_modelo_whatsapp", { p_pessoa: pessoa(c), p_chave: ch, p_numero: n, p_versao: d.versao, p_corpo: d.corpo }));
  });
  app.post("/v1/whatsapp/modelos/:chave/versoes/:numero/situacao", async (c) => {
    const ch = chaveModelo(c);
    const n = numeroModelo(c);
    const d = await lerCorpo(c, decidirModeloSchema);
    return c.json(await rpc("console_decidir_modelo_whatsapp", {
      p_pessoa: pessoa(c), p_chave: ch, p_numero: n, p_versao: d.versao, p_situacao: d.situacao, p_motivo: d.motivo,
    }));
  });

  app.get("/v1/clientes/:id/whatsapp", async (c) => c.json(await rpc("console_whatsapp", cliente(c))));

  app.put("/v1/clientes/:id/whatsapp/credenciais", async (c) => {
    const d = await lerCorpo(c, credenciaisWhatsappSchema);
    const w = whatsapp();
    const r = await rpc<{ segredo: string; versao: number }>("console_whatsapp_credenciais", {
      ...cliente(c), p_versao: d.versao, p_instancia: d.instancia,
      p_credenciais: await cifrarCredenciais(w.chave, { instancia: d.instancia, token: d.token }),
    });
    // O segredo vai só para o provedor, no endereço dos avisos; nunca volta para a tela.
    let avisos = true;
    try {
      await w.conector.ligarAvisos({ instancia: d.instancia, token: d.token }, `${w.urlAvisos}/v1/whatsapp/${r.segredo}`);
    } catch (erro) {
      registrar("aviso", { funcao: "api-console", rota: "whatsapp/avisos", erro: erro instanceof Error ? erro.message : "falha" });
      avisos = false;
    }
    return c.json({ versao: r.versao, avisos });
  });

  app.post("/v1/clientes/:id/whatsapp/conectar", async (c) => {
    const modo = (await c.req.json().catch(() => ({})) as { modo?: string }).modo === "CODIGO" ? "CODIGO" : "QR";
    const cred = await credenciais(c, "CONECTAR");
    const w = whatsapp();
    if (modo === "CODIGO") {
      const codigo = await noProvedor("codigo", () => w.conector.codigoPareamento(cred, cred.numero ?? ""));
      await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "CONECTANDO", p_aparelho: null, p_motivo: null });
      return c.json({ codigo });
    }
    const qr = await noProvedor("qr", () => w.conector.qrCode(cred));
    if (qr.conectado) return c.json({ conectado: true });
    await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "CONECTANDO", p_aparelho: null, p_motivo: null });
    return c.json({ qr: qr.imagem });
  });

  // Confere no provedor: conectado só vale com o aparelho do número da ficha; outro aparelho é
  // desconectado na hora.
  app.post("/v1/clientes/:id/whatsapp/verificar", async (c) => {
    const cred = await credenciais(c, "CONSULTAR");
    const w = whatsapp();
    const s = await noProvedor("situacao", () => w.conector.situacao(cred));
    if (!s.conectado) {
      return c.json(await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "DESCONECTADO", p_aparelho: null, p_motivo: null }));
    }
    const r = await rpc<{ aparelhoDiferente?: boolean }>("console_whatsapp_situacao", {
      ...cliente(c), p_situacao: "CONECTADO", p_aparelho: s.aparelho, p_motivo: null,
    });
    if (r.aparelhoDiferente) await noProvedor("desconectar", () => w.conector.desconectar(cred));
    return c.json(r);
  });

  app.post("/v1/clientes/:id/whatsapp/desconectar", async (c) => {
    const d = await lerCorpo(c, desconectarWhatsappSchema);
    const cred = await credenciais(c, "DESCONECTAR");
    await noProvedor("desconectar", () => whatsapp().conector.desconectar(cred));
    return c.json(await rpc("console_whatsapp_situacao", { ...cliente(c), p_situacao: "DESCONECTADO", p_aparelho: null, p_motivo: d.motivo }));
  });

  // ---------------------------------------------------------------------------------------
  // Comercial (0296). Quem vê e quem edita, o que cada etapa pede e o que junta são decididos no
  // banco; aqui só se valida a entrada.

  // Pedido de demonstração do site (CM-01): fora do repasse, com o segredo do site e limite
  // por WhatsApp. O site continua mandando o e-mail como aviso.
  app.post("/v1/site/interessados", async (c) => {
    if (!deps.segredoSite || !segredoConfere(c.req.header(CABECALHO_SITE) ?? null, deps.segredoSite)) throw new ErroDominio("FORBIDDEN");
    const d = await lerCorpo(c, entradaSiteSchema);
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "site", p_chave: d.whatsapp }))) throw new ErroDominio("RATE_LIMITED");
    // A taxa só vai quando informada (o banco aceita de R$ 0,01 a R$ 20.000).
    const { taxaCondominio, ...resto } = d;
    return c.json(await rpc("comercial_entrada_site", { p_dados: taxaCondominio === null ? resto : { ...resto, taxaCondominio } }), 201);
  });

  // A calculadora do site (CM-33, quadros 448 e 449): fora do repasse, com o segredo do site, um
  // limite por quem usa (r9: o IP que o site repassa, guardado só como hash) e um limite para o site
  // inteiro. Só a faixa, a tabela aplicada, a mensalidade e o valor por apartamento; nunca a tabela
  // inteira, a implantação ou as vagas.
  app.post("/v1/site/calculadora", async (c) => {
    if (!deps.segredoSite || !segredoConfere(c.req.header(CABECALHO_SITE) ?? null, deps.segredoSite)) throw new ErroDominio("FORBIDDEN");
    const d = await lerCorpo(c, calculadoraSiteSchema);
    const cliente = (c.req.header(CABECALHO_SITE_CLIENTE) ?? "").trim().slice(0, 64) || "sem-ip";
    const chave = await hmacHex(`calculadora-ip|${deps.segredoSite}`, cliente);
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "calculadora_ip", p_chave: chave }))) throw new ErroDominio("RATE_LIMITED");
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "calculadora", p_chave: "site" }))) throw new ErroDominio("RATE_LIMITED");
    return c.json(await rpc("comercial_calculadora_site", { p_unidades: d.unidades }));
  });

  const interessado = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_id: idDaRota(c, "id") });
  const interessadoContrato = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_interessado: idDaRota(c, "id") });

  app.get("/v1/comercial/interessados", async (c) =>
    c.json(await rpc("comercial_lista", { p_pessoa: pessoa(c), p_busca: (c.req.query("q") ?? "").trim().slice(0, 60) || null })));

  app.get("/v1/comercial/meu-dia", async (c) => c.json(await rpc("comercial_meu_dia", { p_pessoa: pessoa(c) })));

  app.post("/v1/comercial/interessados", async (c) => {
    const { parceiroId, ...d } = await lerCorpo(c, novoInteressadoSchema);
    // Origem Parceiro com o parceiro escolhido: é a indicação (0310), com o vínculo que não muda.
    if (parceiroId) {
      const { origem: _o, origemDetalhe: _od, ...indicacao } = d;
      return c.json(await rpc("comercial_indicar", { p_pessoa: pessoa(c), p_parceiro: parceiroId, p_dados: indicacao }), 201);
    }
    return c.json(await rpc("comercial_criar", { p_pessoa: pessoa(c), p_dados: d }), 201);
  });

  app.get("/v1/comercial/interessados/:id", async (c) => c.json(await rpc("comercial_ficha", interessado(c))));

  app.put("/v1/comercial/interessados/:id", async (c) => {
    const { versao, ...d } = await lerCorpo(c, fichaInteressadoSchema);
    return c.json(await rpc("comercial_salvar", { ...interessado(c), p_versao: versao, p_dados: d }));
  });

  app.post("/v1/comercial/interessados/:id/etapa", async (c) => {
    const d = await lerCorpo(c, etapaInteressadoSchema);
    return c.json(await rpc("comercial_mudar_etapa", {
      ...interessado(c), p_versao: d.versao, p_etapa: d.etapa, p_motivo_perda: d.motivoPerda, p_detalhe: d.detalhe, p_vencedor: d.vencedor,
      p_retomar_em: d.retomarEm,
    }));
  });

  app.post("/v1/comercial/interessados/:id/conversas", async (c) => {
    const d = await lerCorpo(c, conversaComercialSchema);
    return c.json(await rpc("comercial_registrar_conversa", {
      ...interessado(c), p_canal: d.canal, p_resumo: d.resumo, p_respondeu: d.respondeu, p_mensagem: d.mensagemId,
    }), 201);
  });

  app.put("/v1/comercial/interessados/:id/proximo-passo", async (c) => {
    const d = await lerCorpo(c, proximoPassoSchema);
    return c.json(await rpc("comercial_proximo_passo", {
      ...interessado(c), p_versao: d.versao, p_texto: d.texto, p_data: d.data, p_hora: d.hora, p_responsavel: d.responsavelId,
    }));
  });

  app.post("/v1/comercial/interessados/:id/cadencia", async (c) => {
    const d = await lerCorpo(c, cadenciaAcaoSchema);
    return c.json(await rpc("comercial_cadencia", { ...interessado(c), p_acao: d.acao, p_resumo: d.resumo }));
  });

  // Pedido de exclusão (CM-12): só a Administração; o contato entra na lista de não contatar.
  app.post("/v1/comercial/interessados/:id/excluir", async (c) => c.json(await rpc("comercial_excluir", interessado(c))));

  // Janelas do condomínio (CM-18, 0309): assembleia, mandato, fidelidade, voltar a falar e síndico novo.
  app.get("/v1/comercial/interessados/:id/janelas", async (c) => c.json(await rpc("comercial_janelas_ficha", interessado(c))));
  app.post("/v1/comercial/interessados/:id/janelas/tratar", async (c) => {
    const d = await lerCorpo(c, tratarJanelaSchema);
    return c.json(await rpc("comercial_tratar_janela", { ...interessado(c), p_tipo: d.tipo, p_data: d.data }));
  });
  app.post("/v1/comercial/interessados/:id/sindico-novo", async (c) => {
    const d = await lerCorpo(c, sindicoNovoSchema);
    return c.json(await rpc("comercial_sindico_novo", { ...interessado(c), p_versao: d.versao, p_desde: d.desde, p_mandato_ate: d.mandatoAte }));
  });

  // Painel comercial (CM-10, 0309): só números; a meta do mês só a Administração muda.
  app.get("/v1/comercial/painel", async (c) => {
    const mes = c.req.query("mes") || null;
    if (mes !== null && !mesComercialSchema.safeParse(mes).success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["mes"] });
    return c.json(await rpc("comercial_painel", { p_pessoa: pessoa(c), p_mes: mes === null ? null : diaDoMes(mes) }));
  });
  app.put("/v1/comercial/painel/meta", async (c) => {
    const d = await lerCorpo(c, metaComercialSchema);
    return c.json(await rpc("comercial_salvar_meta", {
      p_pessoa: pessoa(c), p_mes: diaDoMes(d.mes), p_versao: d.versao, p_total: d.total, p_por_pessoa: d.porPessoa,
    }));
  });

  // O cartão do Comercial no Início do Console (CM-04, CM-18).
  app.get("/v1/comercial/inicio", async (c) => c.json(await rpc("comercial_inicio", { p_pessoa: pessoa(c) })));

  app.post("/v1/comercial/nao-contatar", async (c) => {
    const d = await lerCorpo(c, naoContatarSchema);
    return c.json(await rpc("comercial_nao_contatar", {
      p_pessoa: pessoa(c), p_whatsapp: d.whatsapp, p_email: d.email, p_cnpj: d.cnpj, p_observacao: d.observacao,
    }), 201);
  });

  // Planilha (CM-24): sem confirmar, só confere; com confirmar, grava o lote.
  app.post("/v1/comercial/importar", async (c) => {
    const { confirmar, ...d } = await lerCorpo(c, importarComercialSchema);
    return c.json(await rpc("comercial_importar", { p_pessoa: pessoa(c), p_dados: d, p_confirmar: confirmar }));
  });

  // Exportar (CM-12): só a Administração, com registro no histórico.
  app.get("/v1/comercial/exportar", async (c) => c.json(await rpc("comercial_exportar", { p_pessoa: pessoa(c) })));

  app.get("/v1/comercial/modelos", async (c) => c.json(await rpc("comercial_modelos", { p_pessoa: pessoa(c) })));

  async function salvarMensagem(c: Context<VarsSessao>, id: string | null) {
    const d = await lerCorpo(c, mensagemComercialSchema);
    return await rpc("comercial_salvar_mensagem", {
      p_pessoa: pessoa(c), p_id: id, p_versao: d.versao, p_etapa: d.etapa, p_titulo: d.titulo, p_texto: d.texto, p_ativa: d.ativa,
    });
  }
  app.post("/v1/comercial/mensagens", async (c) => c.json(await salvarMensagem(c, null), 201));
  app.put("/v1/comercial/mensagens/:id", async (c) => c.json(await salvarMensagem(c, idDaRota(c, "id"))));

  async function salvarCadencia(c: Context<VarsSessao>, id: string | null) {
    const d = await lerCorpo(c, cadenciaComercialSchema);
    return await rpc("comercial_salvar_cadencia", {
      p_pessoa: pessoa(c), p_id: id, p_versao: d.versao, p_nome: d.nome, p_gatilho: d.gatilho, p_origem: d.origem, p_passos: d.passos,
      p_termina_sem_resposta: d.terminaSemResposta, p_ativa: d.ativa,
    });
  }
  app.post("/v1/comercial/cadencias", async (c) => c.json(await salvarCadencia(c, null), 201));
  app.put("/v1/comercial/cadencias/:id", async (c) => c.json(await salvarCadencia(c, idDaRota(c, "id"))));

  app.put("/v1/comercial/etapas/:etapa", async (c) => {
    const etapa = c.req.param("etapa");
    if (!(etapa in ETAPAS_COMERCIAL)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, etapaParametrosSchema);
    return c.json(await rpc("comercial_salvar_etapa", {
      p_pessoa: pessoa(c), p_etapa: etapa, p_versao: d.versao, p_probabilidade: d.probabilidade, p_limite_dias: d.limiteDias,
    }));
  });

  // ---------------------------------------------------------------------------------------
  // Propostas (0304, R17.3). O preço sai da Tabela de preços no banco; quem pode aprovar
  // desconto, o que trava o envio e o que a versão enviada guarda também.

  const idsVersao = (c: Context<VarsSessao>) => ({ p_pessoa: pessoa(c), p_proposta: idDaRota(c, "id"), p_id: idDaRota(c, "versaoId") });
  const dadosVersao = (d: { unidades: number | null; ciclo: string; tabela: string | null; valorManual: number | null; valorManualMotivo: string | null;
                            implantacaoManual: number | null; desconto: number | null; descontoMotivo: string | null; respostas: string[];
                            referencias: string[]; notaInterna: string | null; validadeDias: number | null; taxaCondominio?: number | null;
                            interessadoVersao?: number; implantadorId?: string | null }, emailComercial: string | null = null) => ({
    unidades: d.unidades, ciclo: d.ciclo, tabela: d.tabela, valorManual: d.valorManual, valorManualMotivo: d.valorManualMotivo,
    implantacaoManual: d.implantacaoManual, desconto: d.desconto, descontoMotivo: d.descontoMotivo, respostas: d.respostas,
    referencias: d.referencias, notaInterna: d.notaInterna, validadeDias: d.validadeDias,
    // Sem o campo, a versão usa a taxa da ficha (R17.3c); vazio tira a taxa.
    ...(d.taxaCondominio === undefined ? {} : { taxaCondominio: d.taxaCondominio }),
    // Com a taxa mudada, a versão da ficha que a tela viu (r8): o banco confere antes de gravar.
    ...(d.interessadoVersao === undefined ? {} : { interessadoVersao: d.interessadoVersao }),
    // A apresentação (0312, R17.8): quem vai implantar e o e-mail de quem salva, lido na conta
    // (nunca da tela) e só quando é do domínio da TRÍADE; o banco confere de novo.
    implantadorId: d.implantadorId ?? null, emailComercial,
  });
  // O e-mail da conta de quem salva a versão; sem ele (ou fora do domínio), a proposta vai sem e-mail.
  const emailComercial = async (c: Context<VarsSessao>) => {
    try { return emailDaEquipe(await deps.admin.emailDe(pessoa(c))); } catch { return null; }
  };

  app.get("/v1/comercial/propostas", async (c) => {
    const aba = c.req.query("aba") || null;
    if (aba !== null && !(aba in ABAS_PROPOSTAS)) throw new ErroDominio("VALIDATION_ERROR", { campos: ["aba"] });
    const interessadoId = c.req.query("interessado") || null;
    if (interessadoId !== null && !UUID_ROTA.test(interessadoId)) throw new ErroDominio("VALIDATION_ERROR", { campos: ["interessado"] });
    return c.json(await rpc("comercial_propostas", { p_pessoa: pessoa(c), p_aba: aba, p_interessado: interessadoId }));
  });

  // Sugestão pela Tabela de preços (CM-06, H.1): não grava nada.
  app.post("/v1/comercial/propostas/sugestao", async (c) => {
    const d = await lerCorpo(c, sugestaoPropostaSchema);
    const r = await rpc<{ apresentacao?: { equipe?: { comercial?: { nome: string; email?: string } } } }>("comercial_sugestao_proposta", {
      p_pessoa: pessoa(c), p_interessado: d.interessadoId, p_unidades: d.unidades, p_ciclo: d.ciclo, p_tabela: d.tabela,
      p_valor_manual: d.valorManual, p_implantacao_manual: d.implantacaoManual, p_desconto: d.desconto,
    });
    // A prévia "Ver como o síndico vai ver" (quadro 456) com o e-mail que a versão vai guardar.
    const quem = r.apresentacao?.equipe?.comercial;
    const email = quem ? await emailComercial(c) : null;
    if (quem && email) quem.email = email;
    return c.json(r);
  });

  app.post("/v1/comercial/propostas", async (c) => {
    const d = await lerCorpo(c, novaPropostaSchema);
    return c.json(await rpc("comercial_criar_proposta", { p_pessoa: pessoa(c), p_interessado: d.interessadoId, p_dados: dadosVersao(d, await emailComercial(c)) }), 201);
  });

  app.get("/v1/comercial/propostas/:id", async (c) => c.json(await rpc("comercial_proposta", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") })));

  // Kit para o conselho (CM-20): da versão enviada; nada interno.
  app.get("/v1/comercial/propostas/:id/kit", async (c) => c.json(await rpc("comercial_kit", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") })));

  // "Corrigir a taxa" no kit (R17.3c, quadro 447): grava na ficha; vale para o kit e a próxima
  // versão, nunca para a versão enviada.
  app.put("/v1/comercial/interessados/:id/taxa", async (c) => {
    const d = await lerCorpo(c, taxaKitSchema);
    return c.json(await rpc("comercial_salvar_taxa", { ...interessado(c), p_versao: d.versao, p_taxa: d.taxaCondominio }));
  });

  // Critérios do síndico (0307, CM-16): o "Escolher critérios" do kit grava na ficha do prédio.
  app.put("/v1/comercial/interessados/:id/criterios", async (c) => {
    const d = await lerCorpo(c, criteriosInteressadoSchema);
    return c.json(await rpc("comercial_salvar_criterios", {
      ...interessado(c), p_versao: d.versao, p_criterios: d.criterios, p_outro: d.criterioOutro, p_problema: d.problema,
    }));
  });

  // Fatos do comparativo (0307): o que a equipe confirmou, por sistema e critério, com a fonte.
  async function salvarFato(c: Context<VarsSessao>, id: string | null) {
    const { versao, ...d } = await lerCorpo(c, fatoComparativoSchema);
    if (id && !versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("comercial_salvar_fato", { p_pessoa: pessoa(c), p_id: id, p_versao: versao, p_dados: d });
  }
  app.post("/v1/comercial/fatos", async (c) => c.json(await salvarFato(c, null), 201));
  app.put("/v1/comercial/fatos/:id", async (c) => c.json(await salvarFato(c, idDaRota(c, "id"))));
  app.post("/v1/comercial/fatos/:id/retirar", async (c) => {
    const d = await lerCorpo(c, retirarFatoSchema);
    return c.json(await rpc("comercial_retirar_fato", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
  });

  // Versão nova (CM-07): a versão da proposta; a em andamento fica substituída.
  app.post("/v1/comercial/propostas/:id/versoes", async (c) => {
    const d = await lerCorpo(c, salvarVersaoSchema);
    return c.json(await rpc("comercial_nova_versao", {
      p_pessoa: pessoa(c), p_proposta: idDaRota(c, "id"), p_versao: d.versao, p_dados: dadosVersao(d, await emailComercial(c)),
    }), 201);
  });

  // Salvar o rascunho: a versão da linha da versão.
  app.put("/v1/comercial/propostas/:id/versoes/:versaoId", async (c) => {
    const d = await lerCorpo(c, salvarVersaoSchema);
    return c.json(await rpc("comercial_salvar_versao", { ...idsVersao(c), p_versao: d.versao, p_dados: dadosVersao(d, await emailComercial(c)) }));
  });

  // Desconto (F.1): o Comercial pede; aprovar e recusar só a Administração (decidido no banco).
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/desconto/pedir", async (c) => {
    const d = await lerCorpo(c, acaoVersaoSchema);
    return c.json(await rpc("comercial_pedir_desconto", { ...idsVersao(c), p_versao: d.versao }));
  });
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/desconto/aprovar", async (c) => {
    const d = await lerCorpo(c, responderDescontoSchema);
    return c.json(await rpc("comercial_responder_desconto", { ...idsVersao(c), p_versao: d.versao, p_aprovar: true, p_resposta: d.resposta }));
  });
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/desconto/recusar", async (c) => {
    const d = await lerCorpo(c, recusarDescontoSchema);
    return c.json(await rpc("comercial_responder_desconto", { ...idsVersao(c), p_versao: d.versao, p_aprovar: false, p_resposta: d.resposta }));
  });

  // Enviar: devolve o código do link uma vez só (o banco guarda só o resumo).
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/enviar", async (c) => {
    const d = await lerCorpo(c, acaoVersaoSchema);
    return c.json(await rpc("comercial_enviar_proposta", { ...idsVersao(c), p_versao: d.versao }));
  });
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/link", async (c) =>
    c.json(await rpc("comercial_novo_link", idsVersao(c)), 201));
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/revogar", async (c) => {
    const d = await lerCorpo(c, revogarLinkSchema);
    return c.json(await rpc("comercial_revogar_link", { ...idsVersao(c), p_motivo: d.motivo }));
  });
  app.post("/v1/comercial/propostas/:id/versoes/:versaoId/recusada", async (c) => {
    const d = await lerCorpo(c, recusarPropostaSchema);
    return c.json(await rpc("comercial_recusar_proposta", { ...idsVersao(c), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // Respostas prontas (CM-27) e referências (CM-28): o Comercial lê; só a Administração muda.
  app.get("/v1/comercial/respostas", async (c) => c.json(await rpc("comercial_respostas", { p_pessoa: pessoa(c) })));
  async function salvarResposta(c: Context<VarsSessao>, id: string | null) {
    const d = await lerCorpo(c, respostaComercialSchema);
    return await rpc("comercial_salvar_resposta", {
      p_pessoa: pessoa(c), p_id: id, p_versao: d.versao, p_tema: d.tema, p_titulo: d.titulo, p_texto: d.texto, p_revisada: d.revisada, p_ativa: d.ativa,
    });
  }
  app.post("/v1/comercial/respostas", async (c) => c.json(await salvarResposta(c, null), 201));
  app.put("/v1/comercial/respostas/:id", async (c) => c.json(await salvarResposta(c, idDaRota(c, "id"))));

  app.get("/v1/comercial/referencias", async (c) => c.json(await rpc("comercial_referencias", { p_pessoa: pessoa(c) })));
  async function salvarReferencia(c: Context<VarsSessao>, id: string | null) {
    const { versao, ...d } = await lerCorpo(c, referenciaComercialSchema);
    return await rpc("comercial_salvar_referencia", { p_pessoa: pessoa(c), p_id: id, p_versao: versao, p_dados: d });
  }
  app.post("/v1/comercial/referencias", async (c) => c.json(await salvarReferencia(c, null), 201));
  app.put("/v1/comercial/referencias/:id", async (c) => c.json(await salvarReferencia(c, idDaRota(c, "id"))));
  app.post("/v1/comercial/referencias/:id/retirar", async (c) => {
    const d = await lerCorpo(c, retirarReferenciaSchema);
    return c.json(await rpc("comercial_retirar_referencia", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // ---------------------------------------------------------------------------------------
  // Contrato pelo gov.br (0308; CM-13, quadros 440 a 444). O banco decide quem pode e a ordem;
  // aqui ficam o armazenamento, o PDF e a conferência automática do arquivo.
  const contratos = () => {
    if (!deps.armazenamentoContrato) throw new ErroDominio("INTERNAL_ERROR");
    return deps.armazenamentoContrato;
  };
  const linkArquivo = async (a: { caminho: string; nome: string; tipo: string }, baixar: boolean) => ({
    url: await contratos().linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined),
    tipo: a.tipo,
    expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString(),
  });
  type EnvioAVerificar = { caminho: string; baseCaminho: string | null; baseSha256: string; baseTamanho: number };
  const envioPut = async (r: { caminho: string; tipo: string }) => ({ url: await contratos().linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo });
  const dadosDocumento = (d: { tipo: string; nome: string; tamanho: number; cnpj: string | null; mandatoAte: string | null }) =>
    ({ tipo: d.tipo, nome: d.nome, tamanho: d.tamanho, cnpj: d.cnpj, mandatoAte: d.mandatoAte });

  /** Confere o documento enviado: só PDF, até 10 MB, sem conteúdo ativo. O recusado é apagado. */
  async function verificarDocumento(caminho: string, gravar: (r: { liberado: boolean; tamanho: number | null; sha256: string | null; motivo: string | null }) => Promise<unknown>) {
    const bytes = await contratos().ler(caminho);
    const r = bytes ? verificarArquivo(bytes, "application/pdf", TAMANHO_MAXIMO_PDF_CONTRATO) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) return await gravar({ liberado: true, tamanho: r.bytes.length, sha256: await sha256Bytes(r.bytes), motivo: null });
    if (bytes) await contratos().apagar(caminho);
    const fim = await gravar({ liberado: false, tamanho: null, sha256: null, motivo: r.motivo });
    return { ...(fim as Record<string, unknown>), motivoTexto: r.motivo };
  }

  /**
   * Confere o PDF assinado contra a base que o banco aponta (o PDF gerado ou o arquivo conferido do
   * condomínio), lida do armazenamento e conferida pelo resumo; o que vem sem assinatura nova é apagado.
   */
  async function verificarEnvio(a: EnvioAVerificar, gravar: (resultado: unknown) => Promise<{ apagarArquivo?: boolean }>) {
    let resultado: ConferenciaAssinatura;
    if (!a.baseCaminho) {
      resultado = { valido: false, motivo: "O contrato mudou. Baixe o novo, assine pelo gov.br e envie de novo." };
    } else {
      const base = await contratos().ler(a.baseCaminho);
      if (!base || base.length !== a.baseTamanho || (await sha256Bytes(base)) !== a.baseSha256) throw new ErroDominio("INTERNAL_ERROR");
      resultado = await conferirAssinatura(await contratos().ler(a.caminho), base);
    }
    const fim = await gravar(resultado);
    if (fim.apagarArquivo) await contratos().apagar(a.caminho);
    return fim;
  }

  // Modelos › Contrato (quadro 443): o Comercial vê; só a Administração muda e põe em uso.
  app.get("/v1/comercial/modelos/contrato", async (c) => c.json(await rpc("comercial_modelos_contrato", { p_pessoa: pessoa(c) })));
  async function salvarModeloContrato(c: Context<VarsSessao>, id: string | null) {
    const { versao, ...d } = await lerCorpo(c, modeloContratoSchema);
    if (id && !versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("comercial_salvar_modelo_contrato", { p_pessoa: pessoa(c), p_id: id, p_versao: versao, p_dados: d });
  }
  app.post("/v1/comercial/modelos/contrato", async (c) => c.json(await salvarModeloContrato(c, null), 201));
  app.put("/v1/comercial/modelos/contrato/:id", async (c) => c.json(await salvarModeloContrato(c, idDaRota(c, "id"))));
  app.post("/v1/comercial/modelos/contrato/:id/usar", async (c) => {
    const d = await lerCorpo(c, usarModeloContratoSchema);
    return c.json(await rpc("comercial_usar_modelo_contrato", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
  });

  // O contrato do interessado (quadros 440 e 442): documentos, contrato, envios e o que pode.
  app.get("/v1/comercial/interessados/:id/contrato", async (c) =>
    c.json(await rpc("comercial_contrato", { p_pessoa: pessoa(c), p_interessado: idDaRota(c, "id") })));

  // Gerar contrato: o banco grava o retrato; aqui sai o PDF, que é guardado com o sha256.
  app.post("/v1/comercial/interessados/:id/contrato", async (c) => {
    const d = await lerCorpo(c, gerarContratoSchema);
    const arm = contratos();
    const g = await rpc<{ contratoId: string; hash: string; caminho: string; dados: RetratoContrato }>("comercial_gerar_contrato", {
      p_pessoa: pessoa(c), p_interessado: idDaRota(c, "id"), p_data_inicio: d.dataInicio, p_motivo: d.motivo,
    });
    const pdf = await gerarPdfContrato(g.dados, g.hash);
    await arm.gravar(g.caminho, pdf, "application/pdf");
    return c.json(await rpc("comercial_contrato_pronto", {
      p_pessoa: pessoa(c), p_contrato: g.contratoId, p_sha256: await sha256Bytes(pdf), p_tamanho: pdf.length,
    }), 201);
  });

  // Documentos pela equipe (o síndico mandou por outro canal).
  app.post("/v1/comercial/interessados/:id/documentos", async (c) => {
    const d = await lerCorpo(c, documentoAceiteSchema);
    const r = await rpc<{ documentoId: string; caminho: string; tipo: string }>("comercial_iniciar_documento", {
      p_pessoa: pessoa(c), p_interessado: idDaRota(c, "id"), p_dados: dadosDocumento(d),
    });
    return c.json({ documentoId: r.documentoId, envio: await envioPut(r) }, 201);
  });
  app.post("/v1/comercial/documentos/:id/verificar", async (c) => {
    const ids = { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") };
    const a = await rpc<{ caminho: string }>("comercial_documento_a_verificar", ids);
    return c.json(await verificarDocumento(a.caminho, (r) => rpc("comercial_verificar_documento", {
      ...ids, p_liberado: r.liberado, p_tamanho: r.tamanho, p_sha256: r.sha256, p_motivo: r.motivo,
    })));
  });
  app.get("/v1/comercial/documentos/:id/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("comercial_abrir_documento", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") });
    return c.json(await linkArquivo(a, c.req.query("baixar") === "1"));
  });

  // O PDF gerado ou um envio, para conferir no validador (link de 5 minutos).
  app.get("/v1/comercial/contratos/:id/link", async (c) => {
    const envio = c.req.query("envio") || null;
    if (envio !== null && !UUID_ROTA.test(envio)) throw new ErroDominio("VALIDATION_ERROR", { campos: ["envio"] });
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("comercial_abrir_contrato", {
      p_pessoa: pessoa(c), p_contrato: idDaRota(c, "id"), p_envio: envio,
    });
    return c.json(await linkArquivo(a, c.req.query("baixar") === "1"));
  });

  // O PDF assinado pela equipe: a TRÍADE (quem assina por ela) ou o do condomínio que chegou por outro canal.
  app.post("/v1/comercial/contratos/:id/envios", async (c) => {
    const d = await lerCorpo(c, envioContratoSchema);
    const r = await rpc<{ envioId: string; caminho: string; tipo: string }>("comercial_iniciar_envio", {
      p_pessoa: pessoa(c), p_contrato: idDaRota(c, "id"), p_dados: { parte: d.parte, nome: d.nome, tamanho: d.tamanho },
    });
    return c.json({ envioId: r.envioId, envio: await envioPut(r) }, 201);
  });
  app.post("/v1/comercial/envios/:id/verificar", async (c) => {
    const ids = { p_pessoa: pessoa(c), p_envio: idDaRota(c, "id") };
    const a = await rpc<EnvioAVerificar>("comercial_envio_a_verificar", ids);
    return c.json(await verificarEnvio(a, (resultado) => rpc("comercial_verificar_envio", { ...ids, p_resultado: resultado })));
  });
  // Conferir no validador (quadro 442): as três marcas são obrigatórias.
  app.post("/v1/comercial/envios/:id/conferir", async (c) => {
    const { versao, ...d } = await lerCorpo(c, conferirEnvioSchema);
    return c.json(await rpc("comercial_conferir_envio", { p_pessoa: pessoa(c), p_envio: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/envios/:id/recusar", async (c) => {
    const d = await lerCorpo(c, recusarEnvioSchema);
    return c.json(await rpc("comercial_recusar_envio", { p_pessoa: pessoa(c), p_envio: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // Virar cliente (CM-08, quadro 333): só com as duas assinaturas conferidas; tudo de uma vez.
  app.post("/v1/comercial/interessados/:id/virar-cliente", async (c) => {
    const { versao, ...d } = await lerCorpo(c, virarClienteSchema);
    return c.json(await rpc("comercial_virar_cliente", { ...interessadoContrato(c), p_versao: versao, p_dados: d }), 201);
  });

  // Piloto (CM-21, quadro 338).
  app.get("/v1/comercial/interessados/:id/piloto", async (c) => c.json(await rpc("comercial_piloto", interessadoContrato(c))));
  app.post("/v1/comercial/interessados/:id/piloto", async (c) => {
    const { versao, ...d } = await lerCorpo(c, iniciarPilotoSchema);
    return c.json(await rpc("comercial_iniciar_piloto", { ...interessadoContrato(c), p_versao: versao, p_dados: d }), 201);
  });
  app.post("/v1/comercial/pilotos/:id/encerrar", async (c) => {
    const { versao, ...d } = await lerCorpo(c, encerrarPilotoSchema);
    return c.json(await rpc("comercial_encerrar_piloto", { p_pessoa: pessoa(c), p_piloto: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });

  // Troca de sistema (CM-29, quadro 345): carta-modelo, o que falta, planilha-modelo e linha do tempo.
  app.get("/v1/comercial/interessados/:id/troca", async (c) => c.json(await rpc("comercial_troca", interessadoContrato(c))));
  app.put("/v1/comercial/interessados/:id/troca", async (c) => {
    const { versao, ...d } = await lerCorpo(c, trocaSistemaSchema);
    return c.json(await rpc("comercial_salvar_troca", { ...interessadoContrato(c), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/interessados/:id/troca/carta-enviada", async (c) => {
    const d = await lerCorpo(c, cartaTrocaSchema);
    return c.json(await rpc("comercial_carta_troca_enviada", { ...interessadoContrato(c), p_versao: d.versao }));
  });
  app.get("/v1/comercial/troca/planilha-modelo", (c) =>
    c.body(planilhaTrocaCsv(), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${PLANILHA_TROCA.arquivo}"`,
    }));

  // Vários condomínios do mesmo contato (CM-09).
  app.get("/v1/comercial/interessados/:id/oportunidades", async (c) => c.json(await rpc("comercial_oportunidades", interessado(c))));
  app.post("/v1/comercial/interessados/:id/oportunidades", async (c) => {
    const d = await lerCorpo(c, novaOportunidadeSchema);
    return c.json(await rpc("comercial_nova_oportunidade", { ...interessado(c), p_dados: d }), 201);
  });

  // ---------------------------------------------------------------------------------------
  // Parceiros e comissão (0310, CM-22). A regra é da Administração; o pagamento é feito fora do
  // sistema e só registrado.

  const mesDaConsulta = (c: Context) => {
    const mes = c.req.query("mes") || null;
    if (mes !== null && !mesComercialSchema.safeParse(mes).success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["mes"] });
    return mes === null ? null : diaDoMes(mes);
  };
  app.get("/v1/comercial/parceiros", async (c) => c.json(await rpc("comercial_parceiros", { p_pessoa: pessoa(c), p_mes: mesDaConsulta(c) })));
  async function salvarParceiro(c: Context<VarsSessao>, id: string | null) {
    const { versao, ...d } = await lerCorpo(c, parceiroSchema);
    if (id && !versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("comercial_salvar_parceiro", { p_pessoa: pessoa(c), p_id: id, p_versao: versao, p_dados: d });
  }
  app.post("/v1/comercial/parceiros", async (c) => c.json(await salvarParceiro(c, null), 201));
  app.put("/v1/comercial/parceiros/:id", async (c) => c.json(await salvarParceiro(c, idDaRota(c, "id"))));
  app.post("/v1/comercial/parceiros/:id/indicar", async (c) => {
    const d = await lerCorpo(c, indicacaoParceiroSchema);
    return c.json(await rpc("comercial_indicar", { p_pessoa: pessoa(c), p_parceiro: idDaRota(c, "id"), p_dados: d }), 201);
  });
  app.get("/v1/comercial/parceiros/:id/extrato", async (c) =>
    c.json(await rpc("comercial_extrato_parceiro", { p_pessoa: pessoa(c), p_parceiro: idDaRota(c, "id"), p_mes: mesDaConsulta(c) })));
  app.post("/v1/comercial/parceiros/:id/pagamentos", async (c) => {
    const d = await lerCorpo(c, pagamentoComissaoSchema);
    return c.json(await rpc("comercial_registrar_pagamento", {
      p_pessoa: pessoa(c), p_parceiro: idDaRota(c, "id"), p_mes: diaDoMes(d.mes), p_valor: d.valor, p_pago_em: d.pagoEm, p_observacao: d.observacao,
    }), 201);
  });
  // Apagar o contato do parceiro (LGPD): ficam os valores e a origem "Parceiro (dado apagado)".
  app.post("/v1/comercial/parceiros/:id/apagar", async (c) =>
    c.json(await rpc("comercial_apagar_parceiro", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") })));
  app.put("/v1/comercial/comissao/regra", async (c) => {
    const d = await lerCorpo(c, regraComissaoSchema);
    return c.json(await rpc("comercial_salvar_regra_comissao", { p_pessoa: pessoa(c), p_versao: d.versao, p_percentual: d.percentual, p_prazo_meses: d.prazoMeses }));
  });
  // "O prédio deixou de ser cliente": sem comissão desde o mês informado.
  app.post("/v1/comercial/comissoes/:id/encerrar", async (c) => {
    const d = await lerCorpo(c, encerrarComissaoSchema);
    return c.json(await rpc("comercial_encerrar_comissao", {
      p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_desde: diaDoMes(d.desde), p_motivo: d.motivo,
    }));
  });

  // ---------------------------------------------------------------------------------------
  // Renovações (0311; CM-30, CM-31 e CM-32; quadros 346 e 347): reajuste e renovação, sinais de
  // risco, expansão e cancelamentos. O banco decide quem pode, as contas e a ordem; aqui fica o
  // PDF do aditivo, guardado como o contrato.

  app.get("/v1/comercial/renovacoes", async (c) => c.json(await rpc("comercial_renovacoes", { p_pessoa: pessoa(c), p_mes: mesDaConsulta(c) })));
  app.put("/v1/comercial/renovacoes/regra", async (c) => {
    const d = await lerCorpo(c, regraReajusteSchema);
    return c.json(await rpc("comercial_salvar_regra_reajuste", {
      p_pessoa: pessoa(c), p_versao: d.versao, p_indice: d.indice, p_percentual: d.percentual, p_referencia: d.referencia,
      p_prazo_aviso_dias: d.prazoAvisoDias,
    }));
  });

  type AditivoAMontar = { aditivoId: string; caminho: string; hash: string; dados: RetratoAditivo };
  /** Monta o PDF do retrato, guarda e avisa o banco (o mesmo caminho se a API caiu no meio). */
  async function montarAditivo(c: Context<VarsSessao>, a: AditivoAMontar) {
    const pdf = await gerarPdfAditivo(a.dados, a.hash);
    await contratos().gravar(a.caminho, pdf, "application/pdf");
    return await rpc("comercial_aditivo_pronto", { p_pessoa: pessoa(c), p_aditivo: a.aditivoId, p_sha256: await sha256Bytes(pdf), p_tamanho: pdf.length });
  }

  // O aviso enviado ao síndico: o banco registra o valor novo e o retrato do aditivo (com modelo em uso).
  app.post("/v1/comercial/renovacoes/aviso", async (c) => {
    const { interessadoId, aniversario, ...d } = await lerCorpo(c, avisoReajusteSchema);
    if (deps.armazenamentoContrato === undefined) throw new ErroDominio("INTERNAL_ERROR");
    const r = await rpc<{ renovacao: Record<string, unknown>; aditivo: AditivoAMontar | null }>("comercial_registrar_aviso", {
      p_pessoa: pessoa(c), p_interessado: interessadoId, p_aniversario: aniversario, p_dados: d,
    });
    const aditivo = r.aditivo ? await montarAditivo(c, r.aditivo) : null;
    return c.json({ renovacao: { ...r.renovacao, ...(aditivo ? { aditivo } : {}) } }, 201);
  });
  app.post("/v1/comercial/renovacoes/dispensar", async (c) => {
    const d = await lerCorpo(c, dispensarRenovacaoSchema);
    return c.json(await rpc("comercial_dispensar_renovacao", {
      p_pessoa: pessoa(c), p_interessado: d.interessadoId, p_aniversario: d.aniversario, p_motivo: d.motivo,
    }), 201);
  });
  // O aditivo que ficou montando: o mesmo retrato, montado de novo.
  app.post("/v1/comercial/renovacoes/:id/aditivo", async (c) => {
    const a = await rpc<AditivoAMontar>("comercial_aditivo_para_montar", { p_pessoa: pessoa(c), p_renovacao: idDaRota(c, "id") });
    return c.json(await montarAditivo(c, a));
  });
  app.get("/v1/comercial/renovacoes/:id/aditivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("comercial_abrir_aditivo", { p_pessoa: pessoa(c), p_renovacao: idDaRota(c, "id") });
    return c.json(await linkArquivo(a, c.req.query("baixar") === "1"));
  });

  // Modelos › Contrato aditivo: o Comercial vê; só a Administração muda e põe em uso.
  app.get("/v1/comercial/modelos/aditivo", async (c) => c.json(await rpc("comercial_modelos_aditivo", { p_pessoa: pessoa(c) })));
  async function salvarModeloAditivo(c: Context<VarsSessao>, id: string | null) {
    const { versao, ...d } = await lerCorpo(c, modeloAditivoSchema);
    if (id && !versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("comercial_salvar_modelo_aditivo", { p_pessoa: pessoa(c), p_id: id, p_versao: versao, p_dados: d });
  }
  app.post("/v1/comercial/modelos/aditivo", async (c) => c.json(await salvarModeloAditivo(c, null), 201));
  app.put("/v1/comercial/modelos/aditivo/:id", async (c) => c.json(await salvarModeloAditivo(c, idDaRota(c, "id"))));
  app.post("/v1/comercial/modelos/aditivo/:id/usar", async (c) => {
    const d = await lerCorpo(c, usarModeloAditivoSchema);
    return c.json(await rpc("comercial_usar_modelo_aditivo", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
  });

  // Sinais de risco: marcar à mão e "Já vi".
  app.post("/v1/comercial/riscos", async (c) => {
    const { interessadoId, ...d } = await lerCorpo(c, marcarRiscoSchema);
    return c.json(await rpc("comercial_marcar_risco", { p_pessoa: pessoa(c), p_interessado: interessadoId, p_dados: d }), 201);
  });
  app.post("/v1/comercial/riscos/:id/tratar", async (c) => {
    const d = await lerCorpo(c, tratarRiscoSchema);
    return c.json(await rpc("comercial_tratar_risco", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_nota: d.nota }));
  });

  // Cancelamento (quadro 347): o pedido, uma tentativa de retenção, "decidiu ficar" e a confirmação.
  app.post("/v1/comercial/cancelamentos", async (c) => {
    const { interessadoId, ...d } = await lerCorpo(c, pedirCancelamentoSchema);
    return c.json(await rpc("comercial_pedir_cancelamento", { p_pessoa: pessoa(c), p_interessado: interessadoId, p_dados: d }), 201);
  });
  app.post("/v1/comercial/cancelamentos/:id/retencao", async (c) => {
    const { versao, ...d } = await lerCorpo(c, retencaoCancelamentoSchema);
    return c.json(await rpc("comercial_tentar_retencao", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/cancelamentos/:id/ficou", async (c) => {
    const d = await lerCorpo(c, clienteFicouSchema);
    return c.json(await rpc("comercial_cliente_ficou", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_nota: d.nota }));
  });
  app.post("/v1/comercial/cancelamentos/:id/confirmar", async (c) => {
    const { versao, ...d } = await lerCorpo(c, confirmarCancelamentoSchema);
    return c.json(await rpc("comercial_confirmar_cancelamento", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });

  // Expansão: abrir (o mais um prédio abre a oportunidade nova), mudar e encerrar.
  app.post("/v1/comercial/expansoes", async (c) => {
    const d = await lerCorpo(c, novaExpansaoSchema);
    return c.json(await rpc("comercial_salvar_expansao", { p_pessoa: pessoa(c), p_id: null, p_versao: null, p_dados: d }), 201);
  });
  app.put("/v1/comercial/expansoes/:id", async (c) => {
    const { versao, ...d } = await lerCorpo(c, editarExpansaoSchema);
    return c.json(await rpc("comercial_salvar_expansao", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/expansoes/:id/encerrar", async (c) => {
    const d = await lerCorpo(c, encerrarExpansaoSchema);
    return c.json(await rpc("comercial_encerrar_expansao", {
      p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_etapa: d.etapa, p_resultado: d.resultado,
    }));
  });

  // ---------------------------------------------------------------------------------------
  // Agenda de demonstrações (0310, CM-23): a equipe cadastra os horários e os bloqueios; a
  // demonstração entra no funil sozinha.

  app.get("/v1/comercial/agenda", async (c) => c.json(await rpc("comercial_agenda", { p_pessoa: pessoa(c) })));
  app.put("/v1/comercial/agenda/disponibilidade/:pessoaId", async (c) => {
    const { versao, ...d } = await lerCorpo(c, disponibilidadeSchema);
    return c.json(await rpc("comercial_salvar_disponibilidade", { p_pessoa: pessoa(c), p_de: idDaRota(c, "pessoaId"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/agenda/bloqueios", async (c) => {
    const d = await lerCorpo(c, bloqueioAgendaSchema);
    return c.json(await rpc("comercial_bloquear_agenda", { p_pessoa: pessoa(c), p_de: d.pessoaId, p_inicio: d.de, p_fim: d.ate, p_motivo: d.motivo }), 201);
  });
  app.post("/v1/comercial/agenda/bloqueios/:id/cancelar", async (c) =>
    c.json(await rpc("comercial_desbloquear_agenda", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") })));
  app.post("/v1/comercial/agenda/links", async (c) => {
    const d = await lerCorpo(c, linkAgendaSchema);
    return c.json(await rpc("comercial_link_agenda", { p_pessoa: pessoa(c), p_de: d.pessoaId, p_trocar: d.trocar }));
  });
  // O convite da mensagem pronta (0310, A): o link de agendamento com o ?c= desta ficha. O convite
  // em claro só sai aqui; o banco guarda o hash.
  app.post("/v1/comercial/interessados/:id/convite-agenda", async (c) =>
    c.json(await rpc("comercial_convite_agenda", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id") })));
  app.post("/v1/comercial/interessados/:id/demonstracoes", async (c) => {
    const d = await lerCorpo(c, marcarDemonstracaoSchema);
    return c.json(await rpc("comercial_marcar_demonstracao", { p_pessoa: pessoa(c), p_interessado: idDaRota(c, "id"), p_dados: d }), 201);
  });
  app.post("/v1/comercial/demonstracoes/:id/remarcar", async (c) => {
    const { versao, ...d } = await lerCorpo(c, remarcarDemonstracaoSchema);
    return c.json(await rpc("comercial_remarcar_demonstracao", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/demonstracoes/:id/feita", async (c) => {
    const { versao, ...d } = await lerCorpo(c, demonstracaoFeitaSchema);
    return c.json(await rpc("comercial_demonstracao_feita", { p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });
  app.post("/v1/comercial/demonstracoes/:id/encerrar", async (c) => {
    const d = await lerCorpo(c, encerrarDemonstracaoSchema);
    return c.json(await rpc("comercial_encerrar_demonstracao", {
      p_pessoa: pessoa(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_situacao: d.situacao, p_motivo: d.motivo, p_avisar: d.avisar,
    }));
  });

  // O banco chama (pg_cron + pg_net, com o segredo de repasse) quando há e-mail da agenda vencido.
  // Sem a chave do Resend, o que venceu fica como "sem chave" e a fila não falha.
  app.post("/v1/interno/fila-comercial", async (c) => {
    if (!deps.correio) return c.json({ enviados: 0, semChave: await rpc<number>("comercial_emails_sem_chave", {}) });
    let enviados = 0;
    for (let lote = 0; lote < 5; lote++) {
      const msgs = await rpc<EmailComercialFila[]>("comercial_emails_pegar", { p_max: 50 });
      if (msgs.length === 0) break;
      const opcoes = { remetente: deps.remetenteComercial, responderPara: deps.responderComercial };
      const resultados = await deps.correio.enviarLote(msgs.map((m) => montarEmailComercial(m, opcoes)));
      for (const [i, r] of resultados.entries()) {
        await rpc("comercial_email_resultado", {
          p_id: msgs[i]!.id, p_provedor_id: r.ok ? r.id : null, p_erro: r.ok ? null : r.erro, p_tentar_de_novo: r.ok ? false : r.tentarDeNovo,
        });
        if (r.ok) enviados++;
      }
      if (msgs.length < 50) break;
    }
    return c.json({ enviados });
  });

  // Na ficha do cliente: o contrato assinado (com o link do PDF final) e a troca de sistema.
  app.get("/v1/clientes/:id/contrato", async (c) => {
    const r = await rpc<{ contrato: unknown; arquivo?: { caminho: string; nome: string; tipo: string } }>("console_contrato_cliente", {
      p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id"),
    });
    if (!r.arquivo) return c.json({ contrato: r.contrato });
    return c.json({ contrato: r.contrato, pdf: c.req.query("link") === "1" ? await linkArquivo(r.arquivo, c.req.query("baixar") === "1") : undefined });
  });
  app.get("/v1/clientes/:id/troca-sistema", async (c) =>
    c.json(await rpc("console_troca_sistema", { p_pessoa: pessoa(c), p_condominio: idDaRota(c, "id") })));

  // O link da proposta (E.1, quadros 328 e 329): sem sessão, pelo repasse do Console (/o/[codigo]).
  // O código é a chave; cada aparelho tem limite de uso, como o mural. O aparelho é o HMAC do IP
  // com o segredo do repasse: sem o segredo, ninguém refaz o resumo a partir de um IP.
  const aparelho = (c: Context) => hmacHex(`aparelho-proposta|${segredo ?? ""}`, ipDaChamada(c.req.raw.headers) ?? "sem-ip");
  const codigoProposta = (c: Context) => {
    const v = c.req.param("codigo");
    if (!v || !CODIGO_PROPOSTA.test(v)) throw new ErroDominio("NOT_FOUND");
    return v;
  };
  async function dentroDoLimite(tipo: string, chave: string) {
    if (!(await rpc<boolean>("limite_contar", { p_tipo: tipo, p_chave: chave }))) throw new ErroDominio("RATE_LIMITED");
  }

  app.get("/v1/publico/propostas/:codigo", async (c) => {
    const codigo = codigoProposta(c);
    const a = await aparelho(c);
    await dentroDoLimite("proposta", a);
    return c.json(await rpc("publico_proposta", { p_codigo: codigo, p_aparelho: a }));
  });
  app.get("/v1/publico/propostas/:codigo/kit", async (c) => {
    const codigo = codigoProposta(c);
    await dentroDoLimite("proposta", await aparelho(c));
    return c.json(await rpc("publico_kit_proposta", { p_codigo: codigo }));
  });
  app.post("/v1/publico/propostas/:codigo/aceite", async (c) => {
    const codigo = codigoProposta(c);
    const a = await aparelho(c);
    await dentroDoLimite("aceite", a);
    const d = await lerCorpo(c, aceitePropostaSchema);
    return c.json(await rpc("publico_aceitar_proposta", {
      p_codigo: codigo, p_dados: { nome: d.nome, cpf: d.cpf, cargo: d.cargo, concordo: d.concordo }, p_ip: ipDaChamada(c.req.raw.headers), p_aparelho: a,
    }), 201);
  });

  // O link de agendamento (quadro 340): sem sessão, pelo repasse do Console (/a/[codigo]). Abrir e
  // agendar têm limite por aparelho; o código é a chave.
  const codigoAgenda = (c: Context) => {
    const v = c.req.param("codigo");
    if (!v || !CODIGO_AGENDA.test(v)) throw new ErroDominio("NOT_FOUND");
    return v;
  };
  app.get("/v1/publico/agenda/:codigo", async (c) => {
    const codigo = codigoAgenda(c);
    await dentroDoLimite("agenda", await aparelho(c));
    return c.json(await rpc("publico_agenda", { p_codigo: codigo }));
  });
  app.post("/v1/publico/agenda/:codigo", async (c) => {
    const codigo = codigoAgenda(c);
    await dentroDoLimite("agendar", await aparelho(c));
    const d = await lerCorpo(c, agendarDemonstracaoSchema);
    // Quem já tem demonstração marcada recebe a data dela, sem marcar outra (0310, C).
    const r = await rpc<{ jaMarcada?: boolean }>("publico_agendar", { p_codigo: codigo, p_dados: d });
    return c.json(r, r?.jaMarcada ? 200 : 201);
  });

  // Depois do aceite (quadro 441): os documentos, o contrato para assinar pelo gov.br e o PDF
  // assinado, pelo mesmo link, até contrato_link_dias depois do aceite. Só PDF, até 10 MB. Cada
  // aparelho tem limite de envios.
  app.get("/v1/publico/propostas/:codigo/contrato", async (c) => {
    const codigo = codigoProposta(c);
    await dentroDoLimite("proposta", await aparelho(c));
    return c.json(await rpc("publico_contrato", { p_codigo: codigo }));
  });
  app.post("/v1/publico/propostas/:codigo/documentos", async (c) => {
    const codigo = codigoProposta(c);
    await dentroDoLimite("contrato", await aparelho(c));
    const d = await lerCorpo(c, documentoAceiteSchema);
    const r = await rpc<{ documentoId: string; caminho: string; tipo: string }>("publico_iniciar_documento", {
      p_codigo: codigo, p_dados: dadosDocumento(d), p_ip: ipDaChamada(c.req.raw.headers),
    });
    return c.json({ documentoId: r.documentoId, envio: await envioPut(r) }, 201);
  });
  app.post("/v1/publico/propostas/:codigo/documentos/:id/verificar", async (c) => {
    const codigo = codigoProposta(c);
    const id = idDaRota(c, "id");
    await dentroDoLimite("contrato", await aparelho(c));
    const a = await rpc<{ caminho: string }>("publico_documento_a_verificar", { p_codigo: codigo, p_id: id });
    return c.json(await verificarDocumento(a.caminho, (r) => rpc("publico_verificar_documento", {
      p_codigo: codigo, p_id: id, p_liberado: r.liberado, p_tamanho: r.tamanho, p_sha256: r.sha256, p_motivo: r.motivo,
    })));
  });
  // Baixar o contrato para assinar ou, depois das duas assinaturas, o PDF final (?final=1).
  app.get("/v1/publico/propostas/:codigo/contrato/pdf", async (c) => {
    const codigo = codigoProposta(c);
    await dentroDoLimite("proposta", await aparelho(c));
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_abrir_contrato", { p_codigo: codigo, p_final: c.req.query("final") === "1" });
    return c.json(await linkArquivo(a, true));
  });
  app.post("/v1/publico/propostas/:codigo/contrato/assinado", async (c) => {
    const codigo = codigoProposta(c);
    await dentroDoLimite("contrato", await aparelho(c));
    const d = await lerCorpo(c, envioContratoPublicoSchema);
    const r = await rpc<{ envioId: string; caminho: string; tipo: string }>("publico_iniciar_envio", {
      p_codigo: codigo, p_dados: { nome: d.nome, tamanho: d.tamanho }, p_ip: ipDaChamada(c.req.raw.headers),
    });
    return c.json({ envioId: r.envioId, envio: await envioPut(r) }, 201);
  });
  app.post("/v1/publico/propostas/:codigo/contrato/assinado/:id/verificar", async (c) => {
    const codigo = codigoProposta(c);
    const id = idDaRota(c, "id");
    await dentroDoLimite("contrato", await aparelho(c));
    const a = await rpc<EnvioAVerificar>("publico_envio_a_verificar", { p_codigo: codigo, p_id: id });
    return c.json(await verificarEnvio(a, (resultado) => rpc("publico_verificar_envio", { p_codigo: codigo, p_id: id, p_resultado: resultado })));
  });

  return app;
}
