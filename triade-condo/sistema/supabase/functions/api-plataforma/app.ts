// API da Plataforma do síndico. Login (F0.6) e escolha do condomínio na sessão (F0.3):
// o navegador nunca manda o condomínio nas chamadas; ele vem da sessão, conferida no banco.
// Passo 2: painel, configurações, pessoas autorizadas e quem atende. Passo 3: blocos,
// unidades e contatos. Passo 4: pedidos no painel. Passo 4b: fotos e documentos dos pedidos.
// Passos 6 e 7: avisos, regras de aviso, prazo do pedido e indicadores. Peça R7: agenda.
// Peça R6: manutenção, prestadores, preventivas e vistorias. Peça R1: comunicados e documentos,
// com o mural online e o e-mail (CD-12 a CD-14), as primeiras rotas sem conta (/v1/publico).
// Peça R13: etiquetas por local e o link do prestador (AT-30, MP-08, V-11). Peça R10: memória do
// prédio (MP-12, MP-14, CT-02 a CT-04), com a exportação montada aqui em segundo plano. Peça R4:
// Ajuda e suporte (PI-17, PI-20) e a aprovação do acesso excepcional da TRÍADE (PI-11).
// Passo 5: WhatsApp do condomínio (W-05, W-09 a W-16), com o aviso do provedor protegido pelo
// segredo do condomínio no caminho e a fila de envio. Peça R12: Vida em condomínio (áreas comuns
// e reservas; AC-01, AC-06, AC-07), com as enquetes e o link pessoal de cada unidade (AC-03), e as assembleias com o link pessoal de cada unidade (AC-02).
// F7.4: pedidos relacionados (AT-18) e decisões pedidas ao síndico (AT-23), com os dois indicadores.
// Quem pode o quê é
// decidido no banco (vínculo e permissões individuais, CF-03); aqui só se valida a entrada.

import type { Context, MiddlewareHandler } from "hono";
import type { z } from "zod";
import {
  abrirChamadoSchema,
  decidirAcessoExcepcionalSchema,
  iniciarImagemChamadoSchema,
  pedirMudancaSchema,
  responderChamadoSchema,
  tituloMudanca,
  alterarContatoSchema,
  alterarPessoaSchema,
  alterarUnidadeSchema,
  marcarUnidadeSchema,
  alterarVinculoUnidadeSchema,
  blocoSchema,
  buscaMoradoresSchema,
  confirmarContatosSchema,
  encerrarVinculoSchema,
  estruturaSchema,
  importacaoSchema,
  incluirContatoSchema,
  incluirUnidadesSchema,
  mudancaSchema,
  removerDadosSchema,
  atendimentoSchema,
  autorizarPessoaSchema,
  COOKIES_PLATAFORMA,
  ErroDominio,
  escolherCondominioSchema,
  revogarPessoaSchema,
  aceitarPedidoSchema,
  alterarPedidoSchema,
  atribuirPedidoSchema,
  buscaPedidosSchema,
  cancelarPedidoSchema,
  concluirPedidoSchema,
  moverPedidoSchema,
  mudarRetornoSchema,
  notaPedidoSchema,
  ordemPedidosSchema,
  pendenciaSchema,
  previsaoSchema,
  reabrirPedidoSchema,
  registrarPedidoSchema,
  quemAvisarSchema,
  regrasPedidosSchema,
  resolverPendenciaSchema,
  retornoSchema,
  revisarPedidoSchema,
  descartarParecidoSchema,
  desfazerLigacaoSchema,
  filtroDecisoesSchema,
  ligarPedidosSchema,
  pedirDecisaoSchema,
  responderDecisaoSchema,
  retirarDecisaoSchema,
  enviarArquivoSchema,
  tirarArquivoSchema,
  VALIDADE_LINK_ARQUIVO_S,
  type TipoArquivo,
  marcarAvisosSchema,
  periodoIndicadoresSchema,
  alterarCompromissoSchema,
  cancelarCompromissoSchema,
  marcarCompromissoSchema,
  periodoAgendaSchema,
  somarDias,
  reagendarCompromissoSchema,
  situacaoCompromissoSchema,
  alterarManutencaoSchema,
  arquivarPrestadorSchema,
  buscaManutencoesSchema,
  cancelarManutencaoSchema,
  concluirManutencaoSchema,
  enviarArquivoManutencaoSchema,
  fazerProvidenciaSchema,
  itensVistoriaSchema,
  prestadorSchema,
  preventivaSchema,
  previsaoManutencaoSchema,
  providenciaSchema,
  reabrirManutencaoSchema,
  registrarManutencaoSchema,
  responderItemSchema,
  retornoManutencaoSchema,
  situacaoManutencaoSchema,
  virarManutencaoSchema,
  arquivarComunicadoSchema,
  arquivarDocumentoSchema,
  buscaComunicadosSchema,
  buscaDocumentosSchema,
  corrigirComunicadoSchema,
  documentoSchema,
  enviarArquivoComunicadoSchema,
  publicoComunicadoSchema,
  salvarComunicadoSchema,
  TAMANHO_MAXIMO_DOCUMENTO,
  usoComunicadoSchema,
  versaoDocumentoSchema,
  codigoLinkSchema,
  decidirPedidoDocumentoSchema,
  emailContatoSchema,
  enviarDocumentoSchema,
  muralComunicadoSchema,
  pedirDocumentoSchema,
  trocarLinkMuralSchema,
  cancelarLinkSchema,
  chegadaSchema,
  envioLinkSchema,
  fotoPrestadorSchema,
  impedimentoSchema,
  recusarPrestadorSchema,
  buscaUnidadesSchema,
  retirarVeiculoSchema,
  vagaSchema,
  veiculoSchema,
  familiarSchema,
  petSchema,
  retirarFamiliaPetSchema,
  buscaHistoricoSchema,
  buscaAniversariantesSchema,
  criarLinkCadastroSchema,
  encerrarLinkCadastroSchema,
  buscaUnidadeOpcionalSchema,
  aprovarCadastroSchema,
  recusarCadastroSchema,
  enviarCadastroSchema,
  verCadastroSchema,
  abrirQuedaSchema,
  conciliarQuedaSchema,
  editarQuedaSchema,
  encerrarQuedaSchema,
  linkPrestadorSchema,
  termineiSchema,
  anotacaoSchema,
  buscaLinhaDoTempoSchema,
  CHAVE_PRONTUARIO,
  itemProntuarioSchema,
  guardarELigarSchema,
  novoItemProntuarioSchema,
  ordemManualSchema,
  retirarSchema,
  secaoManualSchema,
  comunicadosWhatsappSchema,
  manterRevisaoSchema,
  meusAvisosWhatsappSchema,
  motivoFalhaSchema,
  responderWhatsappSchema,
  TAMANHO_MAXIMO_MIDIA,
  triarWhatsappSchema,
  type MidiaWhatsapp,
  aprovarReservaSchema,
  conferirReservaSchema,
  filtroReservasSchema,
  criarEnqueteSchema,
  ataAssembleiaSchema,
  cancelarAssembleiaSchema,
  direitoVotoSchema,
  fracoesSchema,
  itemAssembleiaSchema,
  linkAssembleiaSchema,
  presencaAssembleiaSchema,
  procuracaoPublicaSchema,
  procuracaoSchema,
  registrarVotoSchema,
  regrasAssembleiaSchema,
  publicarAnuncioSchema,
  recusarAnuncioSchema,
  tirarAnuncioSchema,
  salvarAssembleiaSchema,
  versaoAssembleiaSchema,
  votarAssembleiaSchema,
  linkEnqueteSchema,
  responderEnqueteSchema,
  versaoEnqueteSchema,
  motivoReservaSchema,
  registrarReservaSchema,
  semanaAreaSchema,
} from "@triade/domain";
import { verificarArquivo, verificarMidia, type Armazenamento } from "../_shared/arquivos.ts";
import {
  decifrarCredenciais, motivoMidiaParaMorador, textoComLinkDoPainel, TIPOS_AVISO_WHATSAPP, type ConectorWhatsapp, type TipoAvisoWhatsapp,
} from "../_shared/whatsapp.ts";
import { sha256Hex } from "../_shared/cripto.ts";
import { avisoAssinado, lerEventoResend, montarEmail, type Correio, type MensagemFila } from "../_shared/email.ts";
import { ipDaChamada } from "../_shared/repasse.ts";
import { registrar } from "../_shared/registro.ts";
import type { AdminAuth } from "../_shared/auth.ts";
import { criarApp } from "../_shared/app.ts";
import { criarSessao, type DepsSessao, type VarsSessao } from "../_shared/sessao.ts";
import { lerCorpo } from "../_shared/validar.ts";
import { idDaRota, rotasConfiguracao } from "../_shared/rotas_configuracao.ts";
import { montarZip, planilhaCsv, type ItemZip } from "../_shared/zip.ts";

export type VarsPlataforma = { Variables: VarsSessao["Variables"] & { condominioId: string } };

interface CondominioDaPessoa {
  condominio_id: string;
  nome: string;
  funcoes: string[];
}

export interface DepsPlataforma extends DepsSessao {
  /** Convite das pessoas autorizadas (V-09). */
  admin: AdminAuth;
  urlApp: string;
  /** Armazenamento privado das fotos e documentos (PT-07). */
  armazenamento: Armazenamento;
  /** Armazenamento privado das fotos e documentos da manutenção (peça R6). */
  armazenamentoManutencao?: Armazenamento;
  /** Armazenamento privado das fotos dos comunicados e dos documentos do prédio (peça R1). */
  armazenamentoComunicados?: Armazenamento;
  armazenamentoDocumentos?: Armazenamento;
  /** Pacotes da exportação (peça R10, CT-04). */
  armazenamentoExportacoes?: Armazenamento;
  /** Imagens dos chamados de suporte (peça R4, PI-20). */
  armazenamentoSuporte?: Armazenamento;
  /** E-mail dos comunicados e documentos (CD-13, CD-14). Sem correio, a fila espera. */
  correio?: Correio;
  remetente?: string;
  /** Endereço desta função, para o "parar de receber" em um clique. */
  urlFuncao?: string;
  /** Segredo que assina os avisos do provedor de e-mail. */
  segredoWebhook?: string;
  /** Trabalho que continua depois da resposta (a fila de e-mails). */
  aoFundo?: (p: Promise<unknown>) => void;
  /** WhatsApp do condomínio (passo 5): o conector e a chave que decifra as credenciais. Sem ele, a fila espera. */
  whatsapp?: { conector: ConectorWhatsapp; chave: CryptoKey };
}

const REMETENTE = "nao-responda@t3condo.trihub.com.br";
const CODIGO = /^[A-Za-z0-9_-]{14,64}$/;

/** Código de link sem conta: fora do formato, responde como não encontrado. */
function codigoDaRota(c: Context, nome = "codigo"): string {
  const v = c.req.param(nome);
  if (!v || !CODIGO.test(v)) throw new ErroDominio("NOT_FOUND");
  return v;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export function criarApiPlataforma(segredo: string | undefined, deps: DepsPlataforma) {
  const app = criarApp<VarsPlataforma>("api-plataforma", segredo, [
    /^\/v1\/email\/eventos$/, /^\/v1\/email\/parar\/[A-Za-z0-9_-]{14,64}$/,
    // Avisos do provedor do WhatsApp: protegidos pelo segredo do condomínio no caminho (W-15).
    /^\/v1\/whatsapp\/[A-Za-z0-9_-]{32,64}\/(recebida|entrega|conectado|desconectado)$/,
  ]);
  const sessao = criarSessao(
    { sistema: "plataforma", cookie: COOKIES_PLATAFORMA.sessao, autenticadorObrigatorio: false, funcaoAcesso: "acesso_plataforma", urlApp: deps.urlApp },
    deps,
  );

  app.get("/v1/saude", (c) => c.json({ ok: true, servico: "api-plataforma" }));
  sessao.rotas(app);

  for (const rota of ["/v1/sessao", "/v1/sessao/*", "/v1/condominio", "/v1/condominio/*"]) app.use(rota, sessao.exigirSessao);

  // Quem está logado, os condomínios dele e o escolhido nesta sessão.
  app.get("/v1/sessao", async (c) => {
    const s = c.get("sessao");
    const condominios = await deps.banco.rpc<CondominioDaPessoa[]>("meus_condominios", { p_pessoa: s.pessoaId });
    const atual = await deps.banco.rpc<string | null>("condominio_da_sessao", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId });
    return c.json({
      pessoaId: s.pessoaId,
      condominioAtual: atual,
      condominios: condominios.map((x) => ({ id: x.condominio_id, nome: x.nome, funcoes: x.funcoes })),
    });
  });

  app.put("/v1/sessao/condominio", async (c) => {
    const s = c.get("sessao");
    const { condominioId } = await lerCorpo(c, escolherCondominioSchema);
    await deps.banco.rpc("escolher_condominio", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId, p_condominio: condominioId });
    return c.json({ condominioAtual: condominioId });
  });

  // O condomínio em que a pessoa está agora: o escolhido na sessão, ainda com vínculo ativo.
  app.use("/v1/condominio", exigirCondominio(deps));
  app.use("/v1/condominio/*", exigirCondominio(deps));
  const rpc = deps.banco.rpc.bind(deps.banco);
  /** Pessoa e condomínio que a sessão validou: vão em toda chamada ao banco. */
  const quem = (c: Context<VarsPlataforma>) => ({ p_pessoa: c.get("sessao").pessoaId, p_condominio: c.get("condominioId") });
  app.get("/v1/condominio", async (c) => {
    const id = c.get("condominioId");
    const condominios = await deps.banco.rpc<CondominioDaPessoa[]>("meus_condominios", { p_pessoa: c.get("sessao").pessoaId });
    const atual = condominios.find((x) => x.condominio_id === id);
    if (!atual) throw new ErroDominio("CONDOMINIO_REQUIRED");
    return c.json({ id, nome: atual.nome, funcoes: atual.funcoes });
  });

  // Painel (V-08): o condomínio, o que a pessoa pode fazer e o que falta configurar.
  app.get("/v1/condominio/painel", async (c) => c.json(await rpc("plataforma_painel", quem(c))));

  // Configurações (CF-06, CF-08, CF-10, AT-10, PI-04): as mesmas rotas que o Console usa na
  // implantação. Fuso, etapas e as janelas técnicas são da TRÍADE e só mudam pelo Console.
  rotasConfiguracao(app, "/v1/condominio", quem, deps.banco, { aoLigarEmail: () => esvaziarFila() });

  // A entrada das Configurações numa chamada só (D4.15): o que cada página lê, junto. A parte que o
  // banco recusa (quem não vê o WhatsApp, por exemplo) volta null e a entrada mostra o resto.
  const PARTES_DA_ENTRADA = {
    configuracoes: "plataforma_configuracoes", areas: "plataforma_areas_comuns", manutencao: "plataforma_etapas_manutencao",
    plano: "plataforma_plano_comunicacao", whatsapp: "plataforma_config_whatsapp", links: "plataforma_links_qr",
  } as const;
  app.get("/v1/condominio/configuracoes/entrada", async (c) => {
    const lidas = await Promise.allSettled(Object.values(PARTES_DA_ENTRADA).map((f) => rpc(f, quem(c))));
    if (lidas[0]!.status === "rejected") throw lidas[0]!.reason;
    return c.json(Object.fromEntries(Object.keys(PARTES_DA_ENTRADA).map((k, i) => {
      const l = lidas[i]!;
      return [k, l.status === "fulfilled" ? l.value : null];
    })));
  });

  // Pessoas autorizadas (V-09, CF-02, CF-03, CF-04).
  app.get("/v1/condominio/pessoas", async (c) => c.json(await rpc("plataforma_pessoas", quem(c))));

  app.post("/v1/condominio/pessoas", async (c) => {
    const d = await lerCorpo(c, autorizarPessoaSchema);
    // Confere a permissão no banco antes de o convite sair.
    const painel = await rpc<{ acoes: string[] }>("plataforma_painel", quem(c));
    if (!painel.acoes.includes("pessoas.autorizar")) throw new ErroDominio("FORBIDDEN");
    const pessoaId = c.get("sessao").pessoaId;
    if (!(await rpc<boolean>("limite_contar", { p_tipo: "convite", p_chave: pessoaId }))) throw new ErroDominio("RATE_LIMITED");
    const conta = await deps.admin.convidar(d.email, `${deps.urlApp}/convite`);
    const vinculoId = await rpc<string>("plataforma_autorizar_pessoa", {
      ...quem(c), p_convidado: conta.userId, p_nome: d.nome, p_cargo: d.cargo, p_permissoes: d.permissoes,
    });
    return c.json({ vinculoId, contaNova: conta.contaNova }, 201);
  });

  app.put("/v1/condominio/pessoas/:vinculo", async (c) => {
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, alterarPessoaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_pessoa", { ...quem(c), p_vinculo: vinculo, p_versao: d.versao, p_cargo: d.cargo, p_permissoes: d.permissoes }),
    });
  });

  app.post("/v1/condominio/pessoas/:vinculo/revogar", async (c) => {
    const vinculo = idDaRota(c, "vinculo");
    const d = await lerCorpo(c, revogarPessoaSchema);
    await rpc("plataforma_revogar_pessoa", {
      ...quem(c), p_vinculo: vinculo, p_versao: d.versao, p_substituto: d.substitutoId ?? null, p_deixar_pendente: d.deixarPendente ?? false,
    });
    return c.json({ ok: true });
  });

  // Quem atende (CF-05).
  app.put("/v1/condominio/atendimento", async (c) => {
    const d = await lerCorpo(c, atendimentoSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_atendimento", { ...quem(c), p_versao: d.versao, p_responsaveis: d.responsaveis, p_padrao: d.padraoId }),
    });
  });

  // Blocos e unidades (F3.1).
  app.get("/v1/condominio/unidades", async (c) => c.json(await rpc("plataforma_unidades", quem(c))));

  app.get("/v1/condominio/unidades/:id", async (c) =>
    c.json(await rpc("plataforma_unidade", { ...quem(c), p_unidade: idDaRota(c, "id") })));

  const salvarBloco = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, blocoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_bloco", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_nome: d.nome, p_ordem: d.ordem ?? null, p_ativo: d.ativo ?? null,
    });
  };
  app.post("/v1/condominio/blocos", async (c) => c.json(await salvarBloco(c, null), 201));
  app.put("/v1/condominio/blocos/:id", async (c) => c.json(await salvarBloco(c, idDaRota(c, "id"))));

  // Como o prédio se organiza: torre, bloco, quadra ou prédio (ou nada), com ou sem andar.
  app.put("/v1/condominio/estrutura", async (c) => {
    const d = await lerCorpo(c, estruturaSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_estrutura", { ...quem(c), p_versao: d.versao, p_agrupamento: d.agrupamento, p_usa_andar: d.usaAndar }),
    });
  });

  app.post("/v1/condominio/unidades", async (c) => {
    const d = await lerCorpo(c, incluirUnidadesSchema);
    return c.json(await rpc("plataforma_incluir_unidades", { ...quem(c), p_bloco: d.blocoId, p_unidades: d.unidades }), 201);
  });

  app.put("/v1/condominio/unidades/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarUnidadeSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_unidade", {
        ...quem(c), p_id: id, p_versao: d.versao, p_identificacao: d.identificacao, p_bloco: d.blocoId, p_andar: d.andar, p_ativa: d.ativa ?? null,
      }),
    });
  });

  // Unidade à venda e para alugar (MU-11).
  app.post("/v1/condominio/unidades/:id/situacao", async (c) => {
    const d = await lerCorpo(c, marcarUnidadeSchema);
    return c.json({
      versao: await rpc<number>("plataforma_marcar_unidade", {
        ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_a_venda: d.aVenda, p_para_alugar: d.paraAlugar,
      }),
    });
  });

  // Contatos e vínculo detalhado (MU-01, MU-02, MU-03, MU-08, MU-10).
  app.post("/v1/condominio/unidades/:id/contatos", async (c) => {
    const unidade = idDaRota(c, "id");
    const d = await lerCorpo(c, incluirContatoSchema);
    return c.json(await rpc("plataforma_incluir_pessoa_unidade", {
      ...quem(c), p_unidade: unidade, p_contato: d.contatoId ?? null, p_nome: d.contatoId ? null : d.nome,
      p_telefone: d.contatoId ? null : d.telefone, p_marcas: d.marcas, p_recebe: d.recebeComunicados,
      p_proprietario: d.proprietario ?? null, p_aniversario: d.aniversario ?? null,
    }), 201);
  });

  app.post("/v1/condominio/unidades/:id/mudanca", async (c) => {
    const unidade = idDaRota(c, "id");
    const d = await lerCorpo(c, mudancaSchema);
    return c.json(await rpc("plataforma_registrar_mudanca", { ...quem(c), p_unidade: unidade, p_data: d.data, p_saem: d.saem, p_entram: d.entram }));
  });

  // Busca da lista de unidades e garagens (F3.8; MU-06, MU-11). A placa fica só no banco e na tela.
  app.get("/v1/condominio/busca-unidades", async (c) => {
    const q = buscaUnidadesSchema.safeParse({ busca: c.req.query("busca") ?? "" });
    if (!q.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["busca"] });
    return c.json(await rpc("plataforma_buscar_unidades", { ...quem(c), p_busca: q.data.busca }));
  });
  app.get("/v1/condominio/garagens", async (c) => c.json(await rpc("plataforma_garagens", quem(c))));
  const salvarVaga = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, vagaSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_vaga", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_identificacao: d.identificacao, p_onde: d.onde, p_coberta: d.coberta,
      p_unidade: d.unidadeId, p_ativa: d.ativa,
    });
  };
  app.post("/v1/condominio/vagas", async (c) => c.json(await salvarVaga(c, null), 201));
  app.put("/v1/condominio/vagas/:id", async (c) => c.json(await salvarVaga(c, idDaRota(c, "id"))));
  const salvarVeiculo = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, veiculoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    if (!id && !d.unidadeId) throw new ErroDominio("VALIDATION_ERROR", { campos: ["unidadeId"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_veiculo", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_unidade: id ? null : d.unidadeId, p_placa: d.placa, p_tipo: d.tipo,
      p_modelo: d.modelo, p_contato: d.contatoId, p_vaga: d.vagaId,
    });
  };
  app.post("/v1/condominio/veiculos", async (c) => c.json(await salvarVeiculo(c, null), 201));
  app.put("/v1/condominio/veiculos/:id", async (c) => c.json(await salvarVeiculo(c, idDaRota(c, "id"))));
  app.post("/v1/condominio/veiculos/:id/retirar", async (c) => {
    const d = await lerCorpo(c, retirarVeiculoSchema);
    return c.json(await rpc("plataforma_retirar_veiculo", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
  });

  // Família e pets da unidade (F3.9; MU-06): sem telefone, sem acesso, nunca no mural nem no WhatsApp.
  const salvarFamiliar = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, familiarSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    if (!id && !d.unidadeId) throw new ErroDominio("VALIDATION_ERROR", { campos: ["unidadeId"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_familiar", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_unidade: id ? null : d.unidadeId, p_nome: d.nome,
      p_parentesco: d.parentesco, p_mora: d.mora, p_aniversario: d.aniversario ?? {},
    });
  };
  app.post("/v1/condominio/familiares", async (c) => c.json(await salvarFamiliar(c, null), 201));
  app.put("/v1/condominio/familiares/:id", async (c) => c.json(await salvarFamiliar(c, idDaRota(c, "id"))));
  const salvarPet = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, petSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    if (!id && !d.unidadeId) throw new ErroDominio("VALIDATION_ERROR", { campos: ["unidadeId"] });
    return await rpc<{ id: string; versao: number }>("plataforma_salvar_pet", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_unidade: id ? null : d.unidadeId, p_nome: d.nome,
      p_especie: d.especie, p_porte: d.porte, p_raca: d.raca, p_observacao: d.observacao,
    });
  };
  app.post("/v1/condominio/pets", async (c) => c.json(await salvarPet(c, null), 201));
  app.put("/v1/condominio/pets/:id", async (c) => c.json(await salvarPet(c, idDaRota(c, "id"))));
  for (const [rota, tipo] of [["familiares", "FAMILIAR"], ["pets", "PET"]] as const) {
    app.post(`/v1/condominio/${rota}/:id/retirar`, async (c) => {
      const d = await lerCorpo(c, retirarFamiliaPetSchema);
      return c.json(await rpc("plataforma_retirar_familia_pet", { ...quem(c), p_tipo: tipo, p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
    });
  }

  // Histórico da unidade e aniversariantes (F3.10; MU-11). Telefone e placa não saem daqui.
  app.get("/v1/condominio/unidades/:id/historico", async (c) => {
    const q = buscaHistoricoSchema.safeParse(c.req.query());
    if (!q.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(q.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("plataforma_historico_unidade", {
      ...quem(c), p_unidade: idDaRota(c, "id"), p_categoria: q.data.categoria ?? null, p_antes: q.data.antes ?? null,
    }));
  });
  app.get("/v1/condominio/aniversariantes", async (c) => {
    const q = buscaAniversariantesSchema.safeParse(c.req.query());
    if (!q.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(q.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("plataforma_aniversariantes", { ...quem(c), p_mes: q.data.mes ?? null, p_unidade: q.data.unidade ?? null }));
  });

  app.get("/v1/condominio/moradores", async (c) => {
    const r = buscaMoradoresSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("plataforma_moradores", {
      ...quem(c), p_busca: r.data.busca ?? null, p_estado: r.data.estado ?? null, p_pagina: r.data.pagina, p_unidade: r.data.unidade ?? null,
    }));
  });

  // Link de cadastro (F3.10; MU-09): quem cadastra moradores cria; o que chega espera o síndico.
  const unidadeDaBusca = (c: Context) => {
    const q = buscaUnidadeOpcionalSchema.safeParse(c.req.query());
    if (!q.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["unidade"] });
    return q.data.unidade ?? null;
  };
  app.get("/v1/condominio/links-cadastro", async (c) =>
    c.json(await rpc("plataforma_links_cadastro", { ...quem(c), p_unidade: unidadeDaBusca(c) })));
  app.post("/v1/condominio/links-cadastro", async (c) => {
    const d = await lerCorpo(c, criarLinkCadastroSchema);
    return c.json(await rpc("plataforma_criar_link_cadastro", { ...quem(c), p_unidade: d.unidadeId, p_pede: d.pede, p_dias: d.dias }), 201);
  });
  app.post("/v1/condominio/links-cadastro/:id/encerrar", async (c) => {
    const d = await lerCorpo(c, encerrarLinkCadastroSchema);
    return c.json(await rpc("plataforma_encerrar_link_cadastro", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
  });
  app.get("/v1/condominio/cadastros-link", async (c) =>
    c.json(await rpc("plataforma_cadastros_link", { ...quem(c), p_unidade: unidadeDaBusca(c) })));
  app.post("/v1/condominio/cadastros-link/:id/aprovar", async (c) => {
    const d = await lerCorpo(c, aprovarCadastroSchema);
    const r = await rpc<{ confirmacaoNaFila?: boolean }>("plataforma_aprovar_cadastro_link", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_nome: d.nome, p_telefone: d.telefone, p_ligacao: d.ligacao,
      p_email: d.email, p_familia: d.familia, p_pets: d.pets, p_veiculos: d.veiculos,
    });
    if (r.confirmacaoNaFila) esvaziarFila();
    return c.json(r);
  });
  app.post("/v1/condominio/cadastros-link/:id/recusar", async (c) => {
    const d = await lerCorpo(c, recusarCadastroSchema);
    return c.json(await rpc("plataforma_recusar_cadastro_link", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo, p_explicacao: d.explicacao,
    }));
  });

  app.put("/v1/condominio/contatos/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarContatoSchema);
    // Aniversário ausente fica como está; null tira ({} no banco).
    return c.json(await rpc("plataforma_alterar_contato", {
      ...quem(c), p_contato: id, p_versao: d.versao, p_nome: d.nome, p_telefone: d.telefone,
      p_aniversario: d.aniversario === undefined ? null : (d.aniversario ?? {}),
    }));
  });

  app.post("/v1/condominio/contatos/:id/remover-dados", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, removerDadosSchema);
    await rpc("plataforma_remover_dados_contato", { ...quem(c), p_contato: id, p_versao: d.versao });
    return c.json({ ok: true });
  });

  app.put("/v1/condominio/vinculos-unidade/:id", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, alterarVinculoUnidadeSchema);
    return c.json({
      versao: await rpc<number>("plataforma_alterar_marcas_vinculo", {
        ...quem(c), p_id: id, p_versao: d.versao, p_marcas: d.marcas, p_recebe: d.recebeComunicados,
      }),
    });
  });

  app.post("/v1/condominio/vinculos-unidade/:id/encerrar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, encerrarVinculoSchema);
    await rpc("plataforma_encerrar_vinculo_unidade", { ...quem(c), p_id: id, p_versao: d.versao, p_motivo: d.motivo, p_data_saida: d.dataSaida ?? null });
    return c.json({ ok: true });
  });

  app.post("/v1/condominio/vinculos-unidade/confirmar", async (c) => {
    const d = await lerCorpo(c, confirmarContatosSchema);
    return c.json({ confirmados: await rpc<number>("plataforma_confirmar_contatos", { ...quem(c), p_itens: d.itens }) });
  });

  // Planilha (F3.3): a tela lê o arquivo e mostra a prévia; aqui chegam as linhas já lidas.
  app.post("/v1/condominio/importacoes", async (c) => {
    const d = await lerCorpo(c, importacaoSchema);
    const r = await rpc<{ emails?: number }>("plataforma_importar_moradores", { ...quem(c), p_linhas: d.linhas, p_agrupamento: d.agrupamento ?? null });
    if (r.emails) esvaziarFila();
    return c.json(r, 201);
  });

  // Pedidos no painel (passo 4; AT-01 a AT-17, AT-31, AT-32). Toda ação leva a versão lida
  // do pedido (AT-24) e devolve a nova.
  app.put("/v1/condominio/regras-pedidos", async (c) => {
    const d = await lerCorpo(c, regrasPedidosSchema);
    return c.json({
      versao: await rpc<number>("plataforma_definir_regras_pedidos", { ...quem(c), p_versao: d.versao, p_revisao: d.revisao, p_reabertura: d.reabertura }),
    });
  });

  app.get("/v1/condominio/pedidos/opcoes", async (c) => c.json(await rpc("plataforma_pedidos_opcoes", quem(c))));

  app.get("/v1/condominio/pedidos/contatos/:unidade", async (c) =>
    c.json(await rpc("plataforma_pedido_contatos", { ...quem(c), p_unidade: idDaRota(c, "unidade") })));

  app.get("/v1/condominio/pedidos", async (c) => {
    const r = buscaPedidosSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    const f = r.data;
    return c.json(await rpc("plataforma_pedidos", {
      ...quem(c), p_situacao: f.situacao ?? null, p_responsavel: f.responsavel ?? null, p_prioridade: f.prioridade ?? null,
      p_categoria: f.categoria ?? null, p_atencao: f.atencao ?? null, p_busca: f.busca ?? null, p_pagina: f.pagina,
    }));
  });

  // A ordem da fila fica guardada na pessoa e vale em qualquer aparelho (D4.2, decisão A.1).
  app.put("/v1/condominio/pedidos/ordem", async (c) => {
    const d = await lerCorpo(c, ordemPedidosSchema);
    return c.json(await rpc("plataforma_ordem_pedidos", { ...quem(c), p_ordem: d.ordem }));
  });

  // Registrar já avisa os envolvidos, na mesma gravação (F6.4, AT-26, PT-04): o que vem em
  // avisar é só o que quem registra mudou; o resto segue as regras do condomínio.
  app.post("/v1/condominio/pedidos", async (c) => {
    const d = await lerCorpo(c, registrarPedidoSchema);
    const args = {
      ...quem(c), p_unidade: d.unidadeId, p_contato: d.contatoId, p_local: d.local, p_categoria: d.categoriaId, p_prioridade: d.prioridadeId,
      p_assunto: d.assunto, p_descricao: d.descricao, p_privado: d.privado, p_responsavel: d.responsavelId, p_avisar: d.avisar,
    };
    if (!d.mensagemId) return c.json(await rpc("plataforma_registrar_pedido", { ...args, p_canal: d.canal }), 201);
    // Registrar com as mensagens do WhatsApp (D4.20, decisão A.2): o banco registra com o canal
    // WhatsApp do condomínio e junta a conversa na mesma transação; se um falha, nada fica.
    return c.json(await rpc("plataforma_registrar_pedido_whatsapp", { ...args, p_mensagem: d.mensagemId }), 201);
  });

  // O bloco Quem avisar antes de registrar: as linhas pelas regras, os rascunhos editáveis e a
  // conferência dos textos (dado de morador não sai, PT-11).
  app.post("/v1/condominio/pedidos/quem-avisar", async (c) => {
    const d = await lerCorpo(c, quemAvisarSchema);
    return c.json(await rpc("plataforma_quem_avisar", { ...quem(c), p_dados: d }));
  });

  app.get("/v1/condominio/pedidos/:id", async (c) => c.json(await rpc("plataforma_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Ações sobre um pedido: rota, validação e os parâmetros da função do banco.
  const acoes = [
    { rota: "", metodo: "put", schema: alterarPedidoSchema, funcao: "plataforma_alterar_pedido",
      args: (d: ReturnType<typeof alterarPedidoSchema.parse>) => ({ p_categoria: d.categoriaId, p_prioridade: d.prioridadeId, p_local: d.local, p_privado: d.privado }) },
    { rota: "/etapa", metodo: "post", schema: moverPedidoSchema, funcao: "plataforma_mover_pedido",
      args: (d: ReturnType<typeof moverPedidoSchema.parse>) => ({ p_etapa: d.etapaId }) },
    { rota: "/responsavel", metodo: "post", schema: atribuirPedidoSchema, funcao: "plataforma_atribuir_pedido",
      args: (d: ReturnType<typeof atribuirPedidoSchema.parse>) => ({ p_responsavel: d.responsavelId, p_motivo: d.motivo }) },
    { rota: "/aceitar", metodo: "post", schema: aceitarPedidoSchema, funcao: "plataforma_aceitar_pedido", args: () => ({}) },
    { rota: "/retornos", metodo: "post", schema: retornoSchema, funcao: "plataforma_registrar_retorno",
      args: (d: ReturnType<typeof retornoSchema.parse>) => ({ p_meio: d.meio, p_texto: d.texto }) },
    { rota: "/notas", metodo: "post", schema: notaPedidoSchema, funcao: "plataforma_anotar_pedido",
      args: (d: ReturnType<typeof notaPedidoSchema.parse>) => ({ p_texto: d.texto }) },
    { rota: "/proximo-retorno", metodo: "put", schema: mudarRetornoSchema, funcao: "plataforma_mudar_retorno",
      args: (d: ReturnType<typeof mudarRetornoSchema.parse>) => ({ p_quando: d.quando, p_motivo: d.motivo }) },
    { rota: "/previsao", metodo: "put", schema: previsaoSchema, funcao: "plataforma_definir_previsao",
      args: (d: ReturnType<typeof previsaoSchema.parse>) => ({ p_data: d.data, p_motivo: d.motivo }) },
    { rota: "/pendencias", metodo: "post", schema: pendenciaSchema, funcao: "plataforma_abrir_pendencia",
      args: (d: ReturnType<typeof pendenciaSchema.parse>) => ({ p_tipo: d.tipo, p_motivo: d.motivo, p_responsavel: d.responsavelId }) },
    { rota: "/concluir", metodo: "post", schema: concluirPedidoSchema, funcao: "plataforma_concluir_pedido",
      args: (d: ReturnType<typeof concluirPedidoSchema.parse>) => ({ p_etapa: d.etapaId, p_explicacao: d.explicacao, p_evidencia: d.evidencia }) },
    { rota: "/revisar", metodo: "post", schema: revisarPedidoSchema, funcao: "plataforma_revisar_pedido",
      args: (d: ReturnType<typeof revisarPedidoSchema.parse>) => ({ p_aprovar: d.aprovar, p_motivo: d.motivo }) },
    { rota: "/reabrir", metodo: "post", schema: reabrirPedidoSchema, funcao: "plataforma_reabrir_pedido",
      args: (d: ReturnType<typeof reabrirPedidoSchema.parse>) => ({ p_motivo: d.motivo, p_responsavel: d.responsavelId }) },
    { rota: "/cancelar", metodo: "post", schema: cancelarPedidoSchema, funcao: "plataforma_cancelar_pedido",
      args: (d: ReturnType<typeof cancelarPedidoSchema.parse>) => ({ p_motivo: d.motivo }) },
    { rota: "/ligacoes", metodo: "post", schema: ligarPedidosSchema, funcao: "plataforma_ligar_pedidos",
      args: (d: ReturnType<typeof ligarPedidosSchema.parse>) => ({
        p_outro: d.outroId, p_tipo: d.tipo, p_motivo: d.motivo, p_encerrar: d.encerrar, p_texto: d.texto, p_versao_outro: d.versaoOutro,
      }) },
    { rota: "/decisoes", metodo: "post", schema: pedirDecisaoSchema, funcao: "plataforma_pedir_decisao",
      args: (d: ReturnType<typeof pedirDecisaoSchema.parse>) => ({
        p_pergunta: d.pergunta, p_porque: d.porque, p_prazo: d.prazo, p_decisor: d.decisorId, p_alternativas: d.alternativas,
      }) },
  ];
  for (const a of acoes) {
    app[a.metodo as "put" | "post"](`/v1/condominio/pedidos/:id${a.rota}`, async (c) => {
      const id = idDaRota(c, "id");
      const d = await lerCorpo(c, a.schema as Parameters<typeof lerCorpo>[1]) as { versao: number };
      // deno-lint-ignore no-explicit-any
      return c.json(await rpc(a.funcao, { ...quem(c), p_id: id, p_versao: d.versao, ...(a.args as (x: any) => object)(d) }));
    });
  }

  app.post("/v1/condominio/pedidos/:id/pendencias/:pendencia/resolver", async (c) => {
    const id = idDaRota(c, "id");
    const pendencia = idDaRota(c, "pendencia");
    const d = await lerCorpo(c, resolverPendenciaSchema);
    return c.json(await rpc("plataforma_resolver_pendencia", { ...quem(c), p_id: id, p_versao: d.versao, p_pendencia: pendencia, p_resolucao: d.resolucao }));
  });

  // Pedidos relacionados (F7.4; AT-18): o sistema só sugere os parecidos; quem atende liga o mais
  // novo ao mais antigo, desfaz com motivo ou descarta a sugestão.
  app.post("/v1/condominio/pedidos/:id/ligacoes/:ligacao/desfazer", async (c) => {
    const id = idDaRota(c, "id");
    const ligacao = idDaRota(c, "ligacao");
    const d = await lerCorpo(c, desfazerLigacaoSchema);
    return c.json(await rpc("plataforma_desfazer_ligacao", { ...quem(c), p_id: id, p_versao: d.versao, p_ligacao: ligacao, p_motivo: d.motivo }));
  });

  app.post("/v1/condominio/pedidos/:id/parecidos/descartar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, descartarParecidoSchema);
    await rpc("plataforma_descartar_parecido", { ...quem(c), p_id: id, p_outro: d.outroId });
    return c.json({ ok: true });
  });


  // Decisões pedidas ao síndico (F7.4; AT-23). Pedir fica nas ações do pedido; responder e
  // retirar levam a versão da decisão. Quem pode responder é decidido no banco.
  app.get("/v1/condominio/decisoes", async (c) => {
    const r = filtroDecisoesSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["filtro"] });
    return c.json(await rpc("plataforma_decisoes", { ...quem(c), p_filtro: r.data.filtro }));
  });

  app.post("/v1/condominio/decisoes/:id/responder", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, responderDecisaoSchema);
    return c.json(await rpc("plataforma_responder_decisao", {
      ...quem(c), p_decisao: id, p_versao: d.versao, p_aprovar: d.aprovar, p_alternativa: d.alternativa, p_justificativa: d.justificativa,
    }));
  });

  app.post("/v1/condominio/decisoes/:id/retirar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, retirarDecisaoSchema);
    return c.json(await rpc("plataforma_retirar_decisao", { ...quem(c), p_decisao: id, p_versao: d.versao, p_motivo: d.motivo }));
  });

  // Fotos e documentos (passo 4b; PT-07). O banco decide quem envia, vê e tira; aqui ficam o
  // armazenamento e a verificação do conteúdo. Arquivo não muda a versão do pedido.
  const arquivo = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo") });

  app.get("/v1/condominio/pedidos/:id/arquivos", async (c) =>
    c.json(await rpc("plataforma_arquivos_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/pedidos/:id/arquivos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, enviarArquivoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo", {
      ...quem(c), p_id: id, p_parte: d.parte, p_nome: d.nome, p_descricao: d.descricao, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await deps.armazenamento.linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });

  // Depois do envio: confere o conteúdo, tira a localização das fotos e só então libera.
  app.post("/v1/condominio/pedidos/:id/arquivos/:arquivo/verificar", async (c) => {
    const ids = arquivo(c);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_arquivo_a_verificar", ids);
    const bytes = await deps.armazenamento.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await deps.armazenamento.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_arquivo", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await deps.armazenamento.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_arquivo", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });

  // Abrir ou baixar: link de 5 minutos, gerado só depois de o banco conferir quem pede.
  app.get("/v1/condominio/pedidos/:id/arquivos/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_arquivo", arquivo(c));
    const baixar = c.req.query("baixar") === "1";
    const url = await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  app.post("/v1/condominio/pedidos/:id/arquivos/:arquivo/tirar", async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_arquivo", { ...arquivo(c), p_motivo: d.motivo }));
  });

  // Avisos dentro do painel (passo 6; F6.1, F6.2, AT-08, AT-09). O banco confere os prazos
  // sozinho; aqui só se lê e se marca como visto. Ver o aviso não resolve o pedido.
  app.get("/v1/condominio/avisos", async (c) => c.json(await rpc("plataforma_avisos", quem(c))));

  app.post("/v1/condominio/avisos/vistos", async (c) => {
    const d = await lerCorpo(c, marcarAvisosSchema);
    return c.json({ marcados: await rpc<number>("plataforma_marcar_avisos", { ...quem(c), p_ids: d.ids }) });
  });


  app.get("/v1/condominio/pedidos/:id/prazo", async (c) =>
    c.json(await rpc("plataforma_pedido_prazo", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Indicadores do atendimento (passo 7; F7.2, TR-01, TR-03, TR-07).
  app.get("/v1/condominio/indicadores", async (c) => {
    const r = periodoIndicadoresSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["periodo"] });
    return c.json(await rpc("plataforma_indicadores", { ...quem(c), p_periodo: r.data.periodo }));
  });

  // Agenda do condomínio (peça R7; AG-01 a AG-05, AG-08, AG-09, MP-04). O banco confere quem
  // pode, os conflitos de horário e a repetição; aqui só se valida a entrada.
  app.get("/v1/condominio/agenda/opcoes", async (c) => c.json(await rpc("plataforma_agenda_opcoes", quem(c))));

  app.get("/v1/condominio/agenda", async (c) => {
    const r = periodoAgendaSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return c.json(await rpc("plataforma_agenda", { ...quem(c), p_de: r.data.de, p_ate: r.data.ate }));
  });

  app.get("/v1/condominio/agenda/:id", async (c) =>
    c.json(await rpc("plataforma_compromisso", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/agenda", async (c) => {
    const d = await lerCorpo(c, marcarCompromissoSchema);
    const r = await rpc("plataforma_marcar_compromisso", {
      ...quem(c), p_tipo: d.tipo, p_titulo: d.titulo, p_data: d.data, p_inicio: d.horaInicio, p_fim: d.horaFim, p_onde: d.onde,
      p_unidade: d.unidadeId, p_local: d.local, p_participantes: d.participantes, p_de_fora: d.deFora, p_pedido: d.pedidoId,
      p_observacao: d.observacao, p_estado: d.estado, p_repetir: d.repetir, p_intervalo: d.intervalo, p_ate: d.ate,
      p_vezes: d.vezes, p_aceitar_conflito: d.aceitarConflito,
    });
    return c.json(r, 201);
  });

  app.put("/v1/condominio/agenda/:id", async (c) => {
    const d = await lerCorpo(c, alterarCompromissoSchema);
    return c.json(await rpc("plataforma_alterar_compromisso", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_tipo: d.tipo, p_titulo: d.titulo, p_inicio: d.horaInicio,
      p_fim: d.horaFim, p_onde: d.onde, p_unidade: d.unidadeId, p_local: d.local, p_participantes: d.participantes,
      p_de_fora: d.deFora, p_pedido: d.pedidoId, p_observacao: d.observacao, p_escopo: d.escopo, p_aceitar_conflito: d.aceitarConflito,
    }));
  });

  app.post("/v1/condominio/agenda/:id/reagendar", async (c) => {
    const d = await lerCorpo(c, reagendarCompromissoSchema);
    return c.json(await rpc("plataforma_reagendar_compromisso", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_data: d.data, p_inicio: d.horaInicio, p_fim: d.horaFim,
      p_motivo: d.motivo, p_escopo: d.escopo, p_aceitar_conflito: d.aceitarConflito,
    }));
  });

  app.post("/v1/condominio/agenda/:id/situacao", async (c) => {
    const d = await lerCorpo(c, situacaoCompromissoSchema);
    return c.json(await rpc("plataforma_situacao_compromisso", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_estado: d.estado }));
  });

  app.post("/v1/condominio/agenda/:id/cancelar", async (c) => {
    const d = await lerCorpo(c, cancelarCompromissoSchema);
    return c.json(await rpc("plataforma_cancelar_compromisso", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo, p_escopo: d.escopo,
    }));
  });

  app.get("/v1/condominio/pedidos/:id/agenda", async (c) =>
    c.json(await rpc("plataforma_agenda_do_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Vida em condomínio (peça R12; AC-01, AC-06, AC-07). O banco confere quem pode, a
  // antecedência, a data ocupada e o limite com a tolerância; aqui só se valida a entrada.
  const consulta = <T extends z.ZodTypeAny>(c: Context<VarsPlataforma>, schema: T): z.infer<T> => {
    const r = schema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    return r.data;
  };


  app.get("/v1/condominio/reservas", async (c) => {
    const q = consulta(c, filtroReservasSchema);
    return c.json(await rpc("plataforma_reservas", { ...quem(c), p_filtro: q.filtro, p_area: q.areaId }));
  });

  // O número de cada aba de uma lista, de uma vez (D4.2, D4.9, D4.11). Cada lista já devolve o
  // total da situação pedida; aqui ela é pedida uma vez por situação, com os mesmos filtros da tela.
  // O banco confere a permissão em cada chamada, como na própria lista.
  const contar = async (situacoes: readonly string[], chamar: (s: string) => Promise<number>) =>
    Object.fromEntries(await Promise.all(situacoes.map(async (s) => [s, await chamar(s)] as const))) as Record<string, number>;
  const total = (r: unknown) => Number((r as { total?: number }).total ?? 0);
  app.get("/v1/condominio/contagens/:lista", async (c) => {
    switch (c.req.param("lista")) {
      case "pedidos": {
        const f = consulta(c, buscaPedidosSchema);
        const n = await contar(["ABERTO", "EM_ANDAMENTO", "EM_REVISAO", "ENCERRADO", "CANCELADO"], async (s) => total(await rpc("plataforma_pedidos", {
          ...quem(c), p_situacao: s, p_responsavel: f.responsavel ?? null, p_prioridade: f.prioridade ?? null,
          p_categoria: f.categoria ?? null, p_atencao: f.atencao ?? null, p_busca: f.busca ?? null, p_pagina: 1,
        })));
        return c.json({ ...n, ATIVOS: n.ABERTO! + n.EM_ANDAMENTO! + n.EM_REVISAO!, TODOS: Object.values(n).reduce((a, b) => a + b, 0) });
      }
      case "manutencao": {
        const q = consulta(c, buscaManutencoesSchema);
        const n = await contar(["PLANEJADA", "EM_ANDAMENTO", "PENDENTE", "CONCLUIDA", "CANCELADA"], async (s) => total(await rpc("plataforma_manutencoes", {
          ...quem(c), p_situacao: s, p_tipo: q.tipo ?? null, p_prestador: q.prestador ?? null, p_atencao: q.atencao ?? null, p_busca: q.busca ?? null, p_pagina: 1,
        })));
        return c.json({ ...n, ABERTAS: n.PLANEJADA! + n.EM_ANDAMENTO! + n.PENDENTE!, TODAS: Object.values(n).reduce((a, b) => a + b, 0) });
      }
      case "comunicados": {
        const q = consulta(c, buscaComunicadosSchema);
        return c.json(await contar(["PUBLICADO", "PROGRAMADO", "RASCUNHO", "ARQUIVADO"], async (s) => total(await rpc("plataforma_comunicados", {
          ...quem(c), p_filtro: s, p_assunto: q.assunto ?? null, p_atencao: q.atencao ?? null, p_busca: q.busca ?? null, p_pagina: 1,
        }))));
      }
      case "decisoes":
        return c.json(await contar(["DECIDIDAS", "TODAS"], async (s) =>
          ((await rpc<{ decisoes?: unknown[] }>("plataforma_decisoes", { ...quem(c), p_filtro: s })).decisoes ?? []).length));
      case "reservas": {
        const q = consulta(c, filtroReservasSchema);
        return c.json(await contar(["A_APROVAR", "PROXIMAS", "TODAS"], async (s) =>
          ((await rpc<{ reservas?: unknown[] }>("plataforma_reservas", { ...quem(c), p_filtro: s, p_area: q.areaId })).reservas ?? []).length));
      }
      default:
        throw new ErroDominio("NOT_FOUND");
    }
  });

  app.get("/v1/condominio/reservas/opcoes", async (c) => c.json(await rpc("plataforma_reserva_opcoes", quem(c))));

  app.get("/v1/condominio/reservas/conferir", async (c) => {
    const q = consulta(c, conferirReservaSchema);
    return c.json(await rpc("plataforma_conferir_reserva", { ...quem(c), p_area: q.areaId, p_unidade: q.unidadeId, p_data: q.data }));
  });

  app.get("/v1/condominio/areas-comuns/:id/semana", async (c) => {
    const q = consulta(c, semanaAreaSchema);
    return c.json(await rpc("plataforma_semana_area", { ...quem(c), p_area: idDaRota(c, "id"), p_de: q.de }));
  });

  app.get("/v1/condominio/reservas/:id", async (c) => c.json(await rpc("plataforma_reserva", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/reservas", async (c) => {
    const d = await lerCorpo(c, registrarReservaSchema);
    return c.json(await rpc("plataforma_registrar_reserva", {
      ...quem(c), p_area: d.areaId, p_unidade: d.unidadeId, p_contato: d.contatoId, p_data: d.data, p_inicio: d.horaInicio,
      p_observacao: d.observacao,
    }), 201);
  });

  app.post("/v1/condominio/reservas/:id/aprovar", async (c) => {
    const d = await lerCorpo(c, aprovarReservaSchema);
    return c.json(await rpc("plataforma_aprovar_reserva", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_recado: d.recado }));
  });

  for (const acao of ["recusar", "cancelar"] as const) {
    app.post(`/v1/condominio/reservas/:id/${acao}`, async (c) => {
      const d = await lerCorpo(c, motivoReservaSchema);
      return c.json(await rpc(`plataforma_${acao}_reserva`, { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
    });
  }

  // Enquetes (AC-03): o banco faz os convites, os envios e o resultado; aqui só se valida a entrada.
  app.get("/v1/condominio/enquetes", async (c) => c.json(await rpc("plataforma_enquetes", quem(c))));

  app.post("/v1/condominio/enquetes", async (c) => {
    const d = await lerCorpo(c, criarEnqueteSchema);
    const r = await rpc("plataforma_criar_enquete", { ...quem(c), p_dados: d });
    esvaziarFila();
    return c.json(r, 201);
  });

  app.get("/v1/condominio/enquetes/:id", async (c) => c.json(await rpc("plataforma_enquete", { ...quem(c), p_id: idDaRota(c, "id") })));

  for (const acao of ["encerrar", "publicar"] as const) {
    app.post(`/v1/condominio/enquetes/:id/${acao}`, async (c) => {
      const d = await lerCorpo(c, versaoEnqueteSchema);
      return c.json(await rpc(`plataforma_${acao}_enquete`, { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao }));
    });
  }

  app.post("/v1/condominio/enquetes/:id/link", async (c) => {
    const d = await lerCorpo(c, linkEnqueteSchema);
    return c.json(await rpc("plataforma_link_enquete", { ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId }));
  });

  // Assembleias (AC-02): o banco confere antecedência, frações, quórum e o resultado; aqui só se
  // valida a entrada.
  app.get("/v1/condominio/assembleias", async (c) => c.json(await rpc("plataforma_assembleias", quem(c))));

  app.put("/v1/condominio/assembleias/regras", async (c) => {
    const d = await lerCorpo(c, regrasAssembleiaSchema);
    return c.json(await rpc("plataforma_regras_assembleia", { ...quem(c), p_versao: d.versao, p_antecedencia: d.antecedencia, p_peso: d.peso }));
  });

  // Classificados entre moradores (AC-05): a aba, a foto e as decisões.
  app.get("/v1/condominio/classificados", async (c) => c.json(await rpc("plataforma_classificados", quem(c))));
  app.get("/v1/condominio/classificados/:id/foto", async (c) => {
    const a = await rpc<{ caminho: string; tipo: string; nome: string }>("plataforma_foto_classificado", { ...quem(c), p_id: idDaRota(c, "id") });
    const url = await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });
  app.post("/v1/condominio/classificados/:id/publicar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, publicarAnuncioSchema);
    const r = await rpc("plataforma_publicar_classificado", { ...quem(c), p_id: id, p_versao: d.versao, p_titulo: d.titulo, p_valor_centavos: d.valorCentavos });
    noFundo(processarFilaWhatsapp);
    return c.json(r);
  });
  app.post("/v1/condominio/classificados/:id/recusar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, recusarAnuncioSchema);
    const r = await rpc("plataforma_recusar_classificado", { ...quem(c), p_id: id, p_versao: d.versao, p_motivo: d.motivo });
    noFundo(processarFilaWhatsapp);
    return c.json(r);
  });
  app.post("/v1/condominio/classificados/:id/tirar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, tirarAnuncioSchema);
    const r = await rpc("plataforma_tirar_classificado", { ...quem(c), p_id: id, p_versao: d.versao, p_motivo: d.motivo });
    noFundo(processarFilaWhatsapp);
    return c.json(r);
  });

  app.get("/v1/condominio/fracoes", async (c) => c.json(await rpc("plataforma_fracoes", quem(c))));
  app.put("/v1/condominio/fracoes", async (c) => {
    const d = await lerCorpo(c, fracoesSchema);
    return c.json(await rpc("plataforma_salvar_fracoes", { ...quem(c), p_fracoes: d.fracoes }));
  });

  app.post("/v1/condominio/assembleias", async (c) => {
    const { versao: _v, ...d } = await lerCorpo(c, salvarAssembleiaSchema);
    return c.json(await rpc("plataforma_salvar_assembleia", { ...quem(c), p_id: null, p_versao: null, p_dados: d }), 201);
  });

  app.get("/v1/condominio/assembleias/:id", async (c) => c.json(await rpc("plataforma_assembleia", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.put("/v1/condominio/assembleias/:id", async (c) => {
    const { versao, ...d } = await lerCorpo(c, salvarAssembleiaSchema);
    if (versao === null) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return c.json(await rpc("plataforma_salvar_assembleia", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: versao, p_dados: d }));
  });

  for (const acao of ["convocar", "iniciar", "encerrar"] as const) {
    app.post(`/v1/condominio/assembleias/:id/${acao}`, async (c) => {
      const d = await lerCorpo(c, versaoAssembleiaSchema);
      const r = await rpc(`plataforma_${acao}_assembleia`, { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao });
      if (acao === "convocar") esvaziarFila();
      return c.json(r);
    });
  }

  app.post("/v1/condominio/assembleias/:id/cancelar", async (c) => {
    const d = await lerCorpo(c, cancelarAssembleiaSchema);
    return c.json(await rpc("plataforma_cancelar_assembleia", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  for (const acao of ["abrir", "encerrar"] as const) {
    app.post(`/v1/condominio/assembleias/:id/itens/${acao}`, async (c) => {
      const d = await lerCorpo(c, itemAssembleiaSchema);
      return c.json(await rpc(`plataforma_${acao}_item`, { ...quem(c), p_id: idDaRota(c, "id"), p_item: d.itemId }));
    });
  }

  app.post("/v1/condominio/assembleias/:id/presenca", async (c) => {
    const d = await lerCorpo(c, presencaAssembleiaSchema);
    return c.json(await rpc("plataforma_presenca_assembleia", { ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId, p_presente: d.presente }));
  });

  app.post("/v1/condominio/assembleias/:id/direito", async (c) => {
    const d = await lerCorpo(c, direitoVotoSchema);
    return c.json(await rpc("plataforma_direito_voto", {
      ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId, p_sem_direito: d.semDireito, p_motivo: d.motivo ?? null,
    }));
  });

  app.post("/v1/condominio/assembleias/:id/procuracao", async (c) => {
    const d = await lerCorpo(c, procuracaoSchema);
    return c.json(await rpc("plataforma_procuracao", {
      ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId, p_aceitar: d.aceitar, p_motivo: d.motivo ?? null,
    }));
  });

  app.post("/v1/condominio/assembleias/:id/voto", async (c) => {
    const d = await lerCorpo(c, registrarVotoSchema);
    return c.json(await rpc("plataforma_registrar_voto", {
      ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId, p_item: d.itemId, p_opcao: d.opcao,
    }));
  });

  app.put("/v1/condominio/assembleias/:id/ata", async (c) => {
    const d = await lerCorpo(c, ataAssembleiaSchema);
    return c.json(await rpc("plataforma_ata_assembleia", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_texto: d.texto ?? null, p_documento: d.documentoId,
    }));
  });

  app.post("/v1/condominio/assembleias/:id/link", async (c) => {
    const d = await lerCorpo(c, linkAssembleiaSchema);
    return c.json(await rpc("plataforma_link_assembleia", { ...quem(c), p_id: idDaRota(c, "id"), p_convite: d.conviteId }));
  });

  // Manutenção e prestadores (peça R6; MP-01 a MP-05, MP-07, MP-09, MP-13). O banco decide quem
  // vê e quem mexe, confere quem executa, as situações e as preventivas; aqui só se valida a entrada.
  const executorArgs = (d: { prestadorId: string | null; executorVinculoId: string | null; executorTexto: string | null }) =>
    ({ p_prestador: d.prestadorId, p_executor_vinculo: d.executorVinculoId, p_executor_texto: d.executorTexto });

  app.get("/v1/condominio/manutencao/opcoes", async (c) => c.json(await rpc("plataforma_manutencao_opcoes", quem(c))));

  app.get("/v1/condominio/manutencao", async (c) => {
    const r = buscaManutencoesSchema.safeParse(c.req.query());
    if (!r.success) throw new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
    const q = r.data;
    return c.json(await rpc("plataforma_manutencoes", {
      ...quem(c), p_situacao: q.situacao ?? null, p_tipo: q.tipo ?? null, p_prestador: q.prestador ?? null,
      p_atencao: q.atencao ?? null, p_busca: q.busca ?? null, p_pagina: q.pagina,
    }));
  });

  app.post("/v1/condominio/manutencao", async (c) => {
    const d = await lerCorpo(c, registrarManutencaoSchema);
    return c.json(await rpc("plataforma_registrar_manutencao", {
      ...quem(c), p_tipo: d.tipo, p_titulo: d.titulo, p_local: d.local, p_detalhes: d.detalhes, p_prioridade: d.prioridadeId,
      p_responsavel: d.responsavelId, ...executorArgs(d), p_proximo_retorno: d.proximoRetorno, p_previsao: d.previsao,
      p_pedido: d.pedidoId, p_itens: d.itens,
    }), 201);
  });

  // Preventivas e prestadores vêm antes de /:id para não se confundirem com um id.
  app.get("/v1/condominio/manutencao/preventivas", async (c) => c.json(await rpc("plataforma_preventivas", quem(c))));

  const salvarPreventiva = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, preventivaSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_preventiva", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_atividade: d.atividade, p_local: d.local, p_unidade_tempo: d.unidadeTempo,
      p_intervalo: d.intervalo, p_proxima_data: d.proximaData, p_antecedencia: d.antecedenciaDias, p_responsavel: d.responsavelId,
      ...executorArgs(d), p_observacao: d.observacao, p_ativa: d.ativa,
    });
  };
  app.post("/v1/condominio/manutencao/preventivas", async (c) => c.json(await salvarPreventiva(c, null), 201));
  app.put("/v1/condominio/manutencao/preventivas/:id", async (c) => c.json(await salvarPreventiva(c, idDaRota(c, "id"))));

  app.get("/v1/condominio/manutencao/prestadores", async (c) =>
    c.json(await rpc("plataforma_prestadores", { ...quem(c), p_arquivados: c.req.query("arquivados") === "1" })));
  app.get("/v1/condominio/manutencao/prestadores/:id", async (c) =>
    c.json(await rpc("plataforma_prestador", { ...quem(c), p_id: idDaRota(c, "id") })));

  const salvarPrestador = async (c: Context<VarsPlataforma>, id: string | null) => {
    const d = await lerCorpo(c, prestadorSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_prestador", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_nome: d.nome, p_servico: d.servico, p_contato: d.contato,
      p_telefone: d.telefone, p_email: d.email, p_documento: d.documento, p_acordo: d.acordo, p_contrato_ate: d.contratoAte,
      p_desde: d.desde, p_reserva: d.reservaId, p_observacao: d.observacao,
    });
  };
  app.post("/v1/condominio/manutencao/prestadores", async (c) => c.json(await salvarPrestador(c, null), 201));
  app.put("/v1/condominio/manutencao/prestadores/:id", async (c) => c.json(await salvarPrestador(c, idDaRota(c, "id"))));
  app.post("/v1/condominio/manutencao/prestadores/:id/arquivar", async (c) => {
    const d = await lerCorpo(c, arquivarPrestadorSchema);
    return c.json(await rpc("plataforma_arquivar_prestador", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_arquivar: d.arquivar }));
  });


  app.get("/v1/condominio/manutencao/:id", async (c) => c.json(await rpc("plataforma_manutencao", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.put("/v1/condominio/manutencao/:id", async (c) => {
    const d = await lerCorpo(c, alterarManutencaoSchema);
    return c.json(await rpc("plataforma_alterar_manutencao", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_titulo: d.titulo, p_local: d.local, p_detalhes: d.detalhes,
      p_prioridade: d.prioridadeId, p_responsavel: d.responsavelId, ...executorArgs(d), p_pedido: d.pedidoId,
      p_acesso: d.acesso, p_impedimento: d.impedimento,
    }));
  });

  const acoesManutencao = [
    { rota: "/proximo-retorno", metodo: "put", schema: retornoManutencaoSchema, funcao: "plataforma_retorno_manutencao",
      args: (d: ReturnType<typeof retornoManutencaoSchema.parse>) => ({ p_quando: d.quando, p_motivo: d.motivo }) },
    { rota: "/previsao", metodo: "put", schema: previsaoManutencaoSchema, funcao: "plataforma_previsao_manutencao",
      args: (d: ReturnType<typeof previsaoManutencaoSchema.parse>) => ({ p_data: d.data, p_motivo: d.motivo }) },
    { rota: "/situacao", metodo: "post", schema: situacaoManutencaoSchema, funcao: "plataforma_situacao_manutencao",
      args: (d: ReturnType<typeof situacaoManutencaoSchema.parse>) => ({
        p_estado: d.estado, p_etapa: d.etapaId, p_pendencia_tipo: d.pendenciaTipo, p_pendencia_motivo: d.pendenciaMotivo }) },
    { rota: "/cancelar", metodo: "post", schema: cancelarManutencaoSchema, funcao: "plataforma_cancelar_manutencao",
      args: (d: ReturnType<typeof cancelarManutencaoSchema.parse>) => ({ p_motivo: d.motivo }) },
    { rota: "/reabrir", metodo: "post", schema: reabrirManutencaoSchema, funcao: "plataforma_reabrir_manutencao",
      args: (d: ReturnType<typeof reabrirManutencaoSchema.parse>) => ({ p_motivo: d.motivo }) },
    { rota: "/providencias", metodo: "post", schema: providenciaSchema, funcao: "plataforma_incluir_providencia",
      args: (d: ReturnType<typeof providenciaSchema.parse>) => ({ p_texto: d.texto, ...executorArgs(d) }) },
    { rota: "/itens", metodo: "put", schema: itensVistoriaSchema, funcao: "plataforma_itens_vistoria",
      args: (d: ReturnType<typeof itensVistoriaSchema.parse>) => ({ p_incluir: d.incluir, p_tirar: d.tirar }) },
  ];
  for (const a of acoesManutencao) {
    app[a.metodo as "put" | "post"](`/v1/condominio/manutencao/:id${a.rota}`, async (c) => {
      const id = idDaRota(c, "id");
      const d = await lerCorpo(c, a.schema as Parameters<typeof lerCorpo>[1]) as { versao: number };
      // deno-lint-ignore no-explicit-any
      return c.json(await rpc(a.funcao, { ...quem(c), p_id: id, p_versao: d.versao, ...(a.args as (x: any) => object)(d) }));
    });
  }

  // Concluir com a foto do depois numa chamada só (D4.22): conclui e já abre o envio de cada foto;
  // a tela sobe o arquivo e pede a verificação. A foto cujo envio não abre volta sem link, e a
  // manutenção fica concluída.
  app.post("/v1/condominio/manutencao/:id/concluir", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, concluirManutencaoSchema);
    const r = await rpc<Record<string, unknown>>("plataforma_concluir_manutencao", {
      ...quem(c), p_id: id, p_versao: d.versao, p_conclusao: d.conclusao, p_realizada_em: d.realizadaEm, p_fechar_providencias: d.fecharProvidencias,
    });
    if (!d.fotos.length) return c.json(r);
    const envios = [];
    for (const f of d.fotos) {
      try {
        const a = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo_manutencao", {
          ...quem(c), p_id: id, p_item: null, p_nome: f.nome, p_descricao: f.descricao, p_tipo: f.tipo, p_tamanho: f.tamanho,
        });
        envios.push({ nome: f.nome, arquivoId: a.arquivoId, envio: { url: await armazenamentoManutencao().linkEnvio(a.caminho), metodo: "PUT", tipo: a.tipo } });
      } catch {
        envios.push({ nome: f.nome });
      }
    }
    return c.json({ ...r, envios });
  });

  app.post("/v1/condominio/manutencao/:id/providencias/:providencia/fazer", async (c) => {
    const d = await lerCorpo(c, fazerProvidenciaSchema);
    return c.json(await rpc("plataforma_fazer_providencia", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_providencia: idDaRota(c, "providencia"), p_resultado: d.resultado,
    }));
  });

  app.post("/v1/condominio/manutencao/:id/itens/:item/responder", async (c) => {
    const d = await lerCorpo(c, responderItemSchema);
    return c.json(await rpc("plataforma_responder_item", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_item: idDaRota(c, "item"), p_resultado: d.resultado, p_observacao: d.observacao,
    }));
  });

  app.post("/v1/condominio/manutencao/:id/itens/:item/manutencao", async (c) => {
    const d = await lerCorpo(c, virarManutencaoSchema);
    return c.json(await rpc("plataforma_item_virar_manutencao", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_item: idDaRota(c, "item"),
    }), 201);
  });

  // Visita marcada a partir da manutenção: nasce ligada a ela (MP-04).
  app.post("/v1/condominio/manutencao/:id/visita", async (c) => {
    const d = await lerCorpo(c, marcarCompromissoSchema);
    if (d.repetir) throw new ErroDominio("VALIDATION_ERROR", { campos: ["repetir"] });
    return c.json(await rpc("plataforma_marcar_visita_manutencao", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_tipo: d.tipo, p_titulo: d.titulo, p_data: d.data, p_inicio: d.horaInicio,
      p_fim: d.horaFim, p_onde: d.onde, p_unidade: d.unidadeId, p_local: d.local, p_participantes: d.participantes,
      p_de_fora: d.deFora, p_observacao: d.observacao, p_estado: d.estado, p_aceitar_conflito: d.aceitarConflito,
    }), 201);
  });

  app.get("/v1/condominio/pedidos/:id/manutencao", async (c) =>
    c.json(await rpc("plataforma_manutencoes_do_pedido", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Fotos e documentos da manutenção: as mesmas regras dos pedidos, no bucket "manutencoes".
  const armazenamentoManutencao = () => {
    if (!deps.armazenamentoManutencao) throw new ErroDominio("INTERNAL_ERROR");
    return deps.armazenamentoManutencao;
  };
  const arquivoManutencao = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo") });

  app.get("/v1/condominio/manutencao/:id/arquivos", async (c) =>
    c.json(await rpc("plataforma_arquivos_manutencao", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/manutencao/:id/arquivos", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, enviarArquivoManutencaoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo_manutencao", {
      ...quem(c), p_id: id, p_item: d.itemId, p_nome: d.nome, p_descricao: d.descricao, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await armazenamentoManutencao().linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });

  app.post("/v1/condominio/manutencao/:id/arquivos/:arquivo/verificar", async (c) => {
    const ids = arquivoManutencao(c);
    const guarda = armazenamentoManutencao();
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_arquivo_manutencao_a_verificar", ids);
    const bytes = await guarda.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await guarda.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_arquivo_manutencao", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await guarda.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_arquivo_manutencao", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });

  app.get("/v1/condominio/manutencao/:id/arquivos/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_arquivo_manutencao", arquivoManutencao(c));
    const baixar = c.req.query("baixar") === "1";
    const url = await armazenamentoManutencao().linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? a.nome : undefined);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  app.post("/v1/condominio/manutencao/:id/arquivos/:arquivo/tirar", async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_arquivo_manutencao", { ...arquivoManutencao(c), p_motivo: d.motivo }));
  });

  // ---------------------------------------------------------------------------------------
  // Links e QR (peça R13; AT-30, V-11): etiquetas por local e o link do prestador na manutenção.
  // As etiquetas ficam nas rotas das Configurações.

  app.get("/v1/condominio/manutencao/:id/link-prestador", async (c) =>
    c.json(await rpc("plataforma_link_prestador", { ...quem(c), p_manutencao: idDaRota(c, "id") })));
  app.post("/v1/condominio/manutencao/:id/link-prestador", async (c) => {
    const d = await lerCorpo(c, linkPrestadorSchema);
    return c.json(await rpc("plataforma_criar_link_prestador", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_versao: d.versao, p_o_que_fazer: d.oQueFazer, p_quando: d.quando,
      p_como_entrar: d.comoEntrar, p_vale_ate: d.valeAte, p_arquivos: d.arquivos, p_responder_horas: d.responderHoras,
    }), 201);
  });
  // "Não trocar sozinho": desliga a troca automática para a reserva deste link (MP-09).
  app.post("/v1/condominio/manutencao/:id/link-prestador/:link/nao-trocar", async (c) =>
    c.json(await rpc("plataforma_desligar_troca", { ...quem(c), p_manutencao: idDaRota(c, "id"), p_link: idDaRota(c, "link") })));
  app.post("/v1/condominio/manutencao/:id/link-prestador/:link/envio", async (c) => {
    const d = await lerCorpo(c, envioLinkSchema);
    return c.json(await rpc("plataforma_envio_link_prestador", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_link: idDaRota(c, "link"), p_canal: d.canal,
    }));
  });
  app.post("/v1/condominio/manutencao/:id/link-prestador/:link/cancelar", async (c) => {
    const d = await lerCorpo(c, cancelarLinkSchema);
    return c.json(await rpc("plataforma_cancelar_link_prestador", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_link: idDaRota(c, "link"), p_motivo: d.motivo,
    }));
  });
  app.get("/v1/condominio/manutencao/:id/fotos-prestador/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_foto_prestador", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo"),
    });
    const url = await armazenamentoManutencao().linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S, c.req.query("baixar") === "1" ? a.nome : undefined);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });
  app.post("/v1/condominio/manutencao/:id/fotos-prestador/:arquivo/tirar", async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_foto_prestador", {
      ...quem(c), p_manutencao: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo"), p_motivo: d.motivo,
    }));
  });

  // Comunicados e documentos (peça R1; CD-01, CD-02, CD-04 a CD-07, CD-09, CD-11, MP-12). O banco
  // decide quem vê e quem publica, calcula quem recebe e guarda as versões; aqui só se valida a entrada.
  const invalido = (r: { error: { issues: { path: PropertyKey[] }[] } }) =>
    new ErroDominio("VALIDATION_ERROR", { campos: [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "")))] });
  const guarda = (a: Armazenamento | undefined) => {
    if (!a) throw new ErroDominio("INTERNAL_ERROR");
    return a;
  };
  const linkArquivo = async (a: Armazenamento, x: { caminho: string; nome: string; tipo: string }, baixar: boolean) => ({
    url: await a.linkLeitura(x.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? x.nome : undefined),
    tipo: x.tipo,
    expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString(),
  });

  // ---------------------------------------------------------------------------------------
  // Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04).
  app.get("/v1/condominio/memoria/prontuario", async (c) => c.json(await rpc("plataforma_prontuario", quem(c))));
  app.post("/v1/condominio/memoria/prontuario/itens", async (c) => {
    const d = await lerCorpo(c, novoItemProntuarioSchema);
    return c.json(await rpc("plataforma_item_prontuario", {
      ...quem(c), p_id: null, p_chave: null, p_versao: null, p_acao: "CRIAR", p_nome: d.nome, p_grupo: d.grupo,
      p_documento: null, p_avisar_dias: null, p_motivo: null,
    }), 201);
  });
  // O item é o id (já guardado) ou a chave da lista sugerida (CONVENCAO, AVCB...).
  app.post("/v1/condominio/memoria/prontuario/itens/:item", async (c) => {
    const item = c.req.param("item");
    const porId = UUID.test(item);
    if (!porId && !CHAVE_PRONTUARIO.test(item)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, itemProntuarioSchema);
    return c.json(await rpc("plataforma_item_prontuario", {
      ...quem(c), p_id: porId ? item.toLowerCase() : null, p_chave: porId ? null : item, p_versao: d.versao ?? null, p_acao: d.acao,
      p_nome: null, p_grupo: null, p_documento: d.acao === "LIGAR" ? d.documentoId : null,
      p_avisar_dias: d.acao === "LIGAR" ? d.avisarDias : null, p_motivo: d.acao === "NAO_SE_APLICA" ? d.motivo : null,
    }));
  });

  // Guardar e ligar numa chamada só (D4.18): cria o documento em Documentos e liga ao item, nessa
  // ordem; o arquivo sobe depois, como versão 1. Se a ligação falha, o documento fica guardado e a
  // resposta diz que não ligou, para a tela oferecer Ligar de novo.
  app.post("/v1/condominio/memoria/prontuario/itens/:item/documento", async (c) => {
    const item = c.req.param("item");
    const porId = UUID.test(item);
    if (!porId && !CHAVE_PRONTUARIO.test(item)) throw new ErroDominio("NOT_FOUND");
    const d = await lerCorpo(c, guardarELigarSchema);
    const doc = await rpc<{ id: string }>("plataforma_salvar_documento", {
      ...quem(c), p_id: null, p_versao: null, p_tipo: d.documento.tipo, p_titulo: d.documento.titulo, p_descricao: d.documento.descricao,
      p_restrito: d.documento.restrito, p_ao_morador: d.documento.aoMorador, p_vale_ate: d.documento.valeAte,
    });
    try {
      await rpc("plataforma_item_prontuario", {
        ...quem(c), p_id: porId ? item.toLowerCase() : null, p_chave: porId ? null : item, p_versao: d.versao ?? null, p_acao: "LIGAR",
        p_nome: null, p_grupo: null, p_documento: doc.id, p_avisar_dias: d.avisarDias, p_motivo: null,
      });
      return c.json({ id: doc.id, ligado: true }, 201);
    } catch {
      return c.json({ id: doc.id, ligado: false }, 201);
    }
  });

  app.get("/v1/condominio/memoria/linha-do-tempo", async (c) => {
    const r = buscaLinhaDoTempoSchema.safeParse({ filtro: c.req.query("filtro") || undefined, antes: c.req.query("antes") || undefined });
    if (!r.success) throw invalido(r);
    return c.json(await rpc("plataforma_linha_do_tempo", { ...quem(c), p_filtro: r.data.filtro, p_antes: r.data.antes ?? null }));
  });
  app.get("/v1/condominio/memoria/opcoes", async (c) => c.json(await rpc("plataforma_opcoes_memoria", quem(c))));
  app.get("/v1/condominio/memoria/anotacoes/:id", async (c) => c.json(await rpc("plataforma_anotacao", { ...quem(c), p_id: idDaRota(c, "id") })));
  async function salvarAnotacao(c: Context<VarsPlataforma>, id: string | null) {
    const d = await lerCorpo(c, anotacaoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_anotacao", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_tipo: d.tipo, p_titulo: d.titulo, p_texto: d.texto, p_aconteceu_em: d.aconteceuEm,
      p_documento: d.documentoId, p_pedido: d.pedidoId, p_manutencao: d.manutencaoId,
    });
  }
  app.post("/v1/condominio/memoria/anotacoes", async (c) => c.json(await salvarAnotacao(c, null), 201));
  app.put("/v1/condominio/memoria/anotacoes/:id", async (c) => c.json(await salvarAnotacao(c, idDaRota(c, "id"))));
  app.post("/v1/condominio/memoria/anotacoes/:id/retirar", async (c) => {
    const d = await lerCorpo(c, retirarSchema);
    return c.json(await rpc("plataforma_retirar_anotacao", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  app.get("/v1/condominio/memoria/manual", async (c) => c.json(await rpc("plataforma_manual", quem(c))));
  app.put("/v1/condominio/memoria/manual/ordem", async (c) => {
    const d = await lerCorpo(c, ordemManualSchema);
    return c.json(await rpc("plataforma_ordem_manual", { ...quem(c), p_ids: d.ids }));
  });
  app.get("/v1/condominio/memoria/manual/:id", async (c) => c.json(await rpc("plataforma_secao_manual", { ...quem(c), p_id: idDaRota(c, "id") })));
  async function salvarSecao(c: Context<VarsPlataforma>, id: string | null) {
    const d = await lerCorpo(c, secaoManualSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_secao_manual", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_titulo: d.titulo, p_resumo: d.resumo, p_texto: d.texto, p_no_mural: d.noMural ?? null,
    });
  }
  app.post("/v1/condominio/memoria/manual", async (c) => c.json(await salvarSecao(c, null), 201));
  app.put("/v1/condominio/memoria/manual/:id", async (c) => c.json(await salvarSecao(c, idDaRota(c, "id"))));
  app.post("/v1/condominio/memoria/manual/:id/retirar", async (c) => {
    const d = await lerCorpo(c, retirarSchema);
    return c.json(await rpc("plataforma_retirar_secao_manual", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // O que vai no dossiê hoje (D4.18): quantas anotações, quem tem acesso e quantos compromissos,
  // com as leituras das próprias telas e os cortes do dossiê (as 40 últimas anotações; os
  // compromissos dos próximos 60 dias, sem os cancelados e os realizados). A parte que o banco
  // recusa volta null e a tela mostra só o texto.
  app.get("/v1/condominio/memoria/dossie-hoje", async (c) => {
    const de = c.req.query("de") ?? "";
    const p = periodoAgendaSchema.safeParse({ de, ate: /^\d{4}-\d{2}-\d{2}$/.test(de) ? somarDias(de, 60) : de });
    if (!p.success) throw new ErroDominio("VALIDATION_ERROR", { campos: ["de"] });
    const [anotacoes, acesso, agenda] = await Promise.allSettled([
      rpc<{ eventos: unknown[] }>("plataforma_linha_do_tempo", { ...quem(c), p_filtro: "ANOTADO", p_antes: null }),
      rpc<{ pessoas: unknown[] }>("plataforma_pessoas", quem(c)),
      rpc<{ compromissos: { estado: string }[] }>("plataforma_agenda", { ...quem(c), p_de: p.data.de, p_ate: p.data.ate }),
    ]);
    return c.json({
      anotacoes: anotacoes.status === "fulfilled" ? Math.min(anotacoes.value.eventos.length, 40) : null,
      acesso: acesso.status === "fulfilled" ? acesso.value.pessoas.length : null,
      compromissos: agenda.status === "fulfilled" ? agenda.value.compromissos.filter((x) => x.estado !== "CANCELADO" && x.estado !== "REALIZADO").length : null,
    });
  });
  app.get("/v1/condominio/memoria/dossies", async (c) => c.json(await rpc("plataforma_dossies", quem(c))));
  app.post("/v1/condominio/memoria/dossies", async (c) => c.json(await rpc("plataforma_gerar_dossie", quem(c)), 201));
  app.get("/v1/condominio/memoria/dossies/:id", async (c) => c.json(await rpc("plataforma_dossie", { ...quem(c), p_id: idDaRota(c, "id") })));

  // Exportação (CT-04): o banco monta a lista dos pacotes e esta função monta cada um em segundo
  // plano. Abrir a tela continua a montagem, mesmo sem a chamada do banco a cada minuto.
  app.get("/v1/condominio/memoria/exportacoes", async (c) => {
    const r = await rpc<{ montando?: boolean }>("plataforma_exportacoes", quem(c));
    if (r.montando) montarAoFundo();
    return c.json(r);
  });
  app.post("/v1/condominio/memoria/exportacoes", async (c) => {
    const r = await rpc("plataforma_pedir_exportacao", quem(c));
    montarAoFundo();
    return c.json(r, 201);
  });
  app.get("/v1/condominio/memoria/exportacoes/:id/pacotes/:numero/link", async (c) => {
    const numero = Number(c.req.param("numero"));
    if (!Number.isInteger(numero) || numero < 1 || numero > 999) throw new ErroDominio("NOT_FOUND");
    const x = await rpc<{ caminho: string; arquivo: string }>("plataforma_baixar_exportacao", { ...quem(c), p_id: idDaRota(c, "id"), p_numero: numero });
    const url = await guarda(deps.armazenamentoExportacoes).linkLeitura(x.caminho, VALIDADE_LINK_ARQUIVO_S, x.arquivo);
    return c.json({ url, arquivo: x.arquivo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  app.get("/v1/condominio/comunicados/opcoes", async (c) => c.json(await rpc("plataforma_comunicado_opcoes", quem(c))));

  app.post("/v1/condominio/comunicados/publico", async (c) => {
    const d = await lerCorpo(c, publicoComunicadoSchema);
    return c.json(await rpc("plataforma_publico_comunicado", {
      ...quem(c), p_assunto: d.assunto, p_publico: d.publico, p_blocos: d.blocos, p_unidades: d.unidades, p_contatos: d.contatos,
    }));
  });

  app.get("/v1/condominio/comunicados", async (c) => {
    const r = buscaComunicadosSchema.safeParse(c.req.query());
    if (!r.success) throw invalido(r);
    const q = r.data;
    return c.json(await rpc("plataforma_comunicados", {
      ...quem(c), p_filtro: q.filtro ?? null, p_assunto: q.assunto ?? null, p_atencao: q.atencao ?? null, p_busca: q.busca ?? null,
      p_pagina: q.pagina,
    }));
  });

  async function salvarComunicado(c: Context<VarsPlataforma>, id: string | null) {
    const d = await lerCorpo(c, salvarComunicadoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_comunicado", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_assunto: d.assunto, p_titulo: d.titulo, p_texto: d.texto,
      p_publico: d.publico, p_blocos: d.blocos, p_unidades: d.unidades, p_contatos: d.contatos, p_pedido: d.pedidoId,
      p_manutencao: d.manutencaoId, p_acao: d.acao, p_programado_para: d.programadoPara, p_no_mural: d.noMural,
      p_por_email: d.porEmail, p_por_whatsapp: d.porWhatsapp,
    }).finally(() => {
      if (d.acao === "PUBLICAR") {
        esvaziarFila();
        noFundo(processarFilaWhatsapp);
      }
    });
  }
  app.post("/v1/condominio/comunicados", async (c) => c.json(await salvarComunicado(c, null), 201));
  app.get("/v1/condominio/comunicados/:id", async (c) => c.json(await rpc("plataforma_comunicado", { ...quem(c), p_id: idDaRota(c, "id") })));
  app.put("/v1/condominio/comunicados/:id", async (c) => c.json(await salvarComunicado(c, idDaRota(c, "id"))));

  app.post("/v1/condominio/comunicados/:id/corrigir", async (c) => {
    const d = await lerCorpo(c, corrigirComunicadoSchema);
    const r = await rpc("plataforma_corrigir_comunicado", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_titulo: d.titulo, p_texto: d.texto, p_mudanca: d.mudanca,
      p_avisar_email: d.avisarEmail, p_avisar_whatsapp: d.avisarWhatsapp,
    });
    if (d.avisarEmail) esvaziarFila();
    if (d.avisarWhatsapp) noFundo(processarFilaWhatsapp);
    return c.json(r, 201);
  });
  // O mural visto do painel (CD-15): o mesmo do link, sem contar abertura e sem o limite por aparelho.
  app.get("/v1/condominio/mural", async (c) => c.json(await rpc("plataforma_mural", quem(c))));
  app.put("/v1/condominio/comunicados/:id/mural", async (c) => {
    const d = await lerCorpo(c, muralComunicadoSchema);
    return c.json(await rpc("plataforma_mural_comunicado", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_no_mural: d.noMural }));
  });
  app.post("/v1/condominio/comunicados/:id/arquivar", async (c) => {
    const d = await lerCorpo(c, arquivarComunicadoSchema);
    return c.json(await rpc("plataforma_arquivar_comunicado", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });
  app.post("/v1/condominio/comunicados/:id/uso", async (c) => {
    const d = await lerCorpo(c, usoComunicadoSchema);
    return c.json(await rpc("plataforma_uso_comunicado", { ...quem(c), p_id: idDaRota(c, "id"), p_uso: d.uso }));
  });

  app.get("/v1/condominio/pedidos/:id/comunicados", async (c) =>
    c.json(await rpc("plataforma_comunicados_ligados", { ...quem(c), p_pedido: idDaRota(c, "id"), p_manutencao: null })));
  app.get("/v1/condominio/manutencao/:id/comunicados", async (c) =>
    c.json(await rpc("plataforma_comunicados_ligados", { ...quem(c), p_pedido: null, p_manutencao: idDaRota(c, "id") })));

  // Fotos e PDF do comunicado: as regras dos pedidos, até 4, no bucket "comunicados".
  const arquivoComunicado = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo") });
  app.post("/v1/condominio/comunicados/:id/arquivos", async (c) => {
    const d = await lerCorpo(c, enviarArquivoComunicadoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo_comunicado", {
      ...quem(c), p_id: idDaRota(c, "id"), p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    const url = await guarda(deps.armazenamentoComunicados).linkEnvio(r.caminho);
    return c.json({ arquivoId: r.arquivoId, envio: { url, metodo: "PUT", tipo: r.tipo } }, 201);
  });
  app.post("/v1/condominio/comunicados/:id/arquivos/:arquivo/verificar", async (c) => {
    const ids = arquivoComunicado(c);
    const g = guarda(deps.armazenamentoComunicados);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_arquivo_comunicado_a_verificar", ids);
    const bytes = await g.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await g.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_arquivo_comunicado", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await g.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_arquivo_comunicado", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });
  app.get("/v1/condominio/comunicados/:id/arquivos/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_arquivo_comunicado", arquivoComunicado(c));
    return c.json(await linkArquivo(guarda(deps.armazenamentoComunicados), a, c.req.query("baixar") === "1"));
  });
  app.post("/v1/condominio/comunicados/:id/arquivos/:arquivo/tirar", async (c) => {
    const d = await lerCorpo(c, tirarArquivoSchema);
    return c.json(await rpc("plataforma_tirar_arquivo_comunicado", { ...arquivoComunicado(c), p_motivo: d.motivo }));
  });


  // Documentos (CD-07, CD-04, MP-12): cada arquivo é uma versão, no bucket "documentos", até 20 MB.
  app.get("/v1/condominio/documentos", async (c) => {
    const r = buscaDocumentosSchema.safeParse(c.req.query());
    if (!r.success) throw invalido(r);
    return c.json(await rpc("plataforma_documentos", { ...quem(c), p_filtro: r.data.filtro ?? null, p_busca: r.data.busca ?? null }));
  });
  async function salvarDocumento(c: Context<VarsPlataforma>, id: string | null) {
    const d = await lerCorpo(c, documentoSchema);
    if (id && !d.versao) throw new ErroDominio("VALIDATION_ERROR", { campos: ["versao"] });
    return await rpc("plataforma_salvar_documento", {
      ...quem(c), p_id: id, p_versao: id ? d.versao : null, p_tipo: d.tipo, p_titulo: d.titulo, p_descricao: d.descricao,
      p_restrito: d.restrito, p_ao_morador: d.aoMorador, p_vale_ate: d.valeAte,
    });
  }
  // Pedidos de documento pelo mural (CD-14), antes das rotas de um documento.
  app.get("/v1/condominio/documentos/pedidos", async (c) => c.json(await rpc("plataforma_pedidos_documento", quem(c))));
  app.post("/v1/condominio/documentos/pedidos/:id/decidir", async (c) => {
    const d = await lerCorpo(c, decidirPedidoDocumentoSchema);
    const r = await rpc("plataforma_decidir_pedido_documento", { ...quem(c), p_id: idDaRota(c, "id"), p_enviar: d.enviar, p_motivo: d.motivo });
    if (d.enviar) esvaziarFila();
    return c.json(r);
  });
  app.post("/v1/condominio/documentos", async (c) => c.json(await salvarDocumento(c, null), 201));
  app.get("/v1/condominio/documentos/:id", async (c) => c.json(await rpc("plataforma_documento", { ...quem(c), p_id: idDaRota(c, "id") })));
  app.put("/v1/condominio/documentos/:id", async (c) => c.json(await salvarDocumento(c, idDaRota(c, "id"))));
  app.post("/v1/condominio/documentos/:id/arquivar", async (c) => {
    const d = await lerCorpo(c, arquivarDocumentoSchema);
    return c.json(await rpc("plataforma_arquivar_documento", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_motivo: d.motivo }));
  });

  const versaoDocumento = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_versao: idDaRota(c, "versao") });
  app.post("/v1/condominio/documentos/:id/versoes", async (c) => {
    const d = await lerCorpo(c, versaoDocumentoSchema);
    const r = await rpc<{ versaoId: string; caminho: string; tipo: string }>("plataforma_iniciar_versao_documento", {
      ...quem(c), p_id: idDaRota(c, "id"), p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho, p_mudanca: d.mudanca,
      p_vigente_desde: d.vigenteDesde, p_aprovado_em: d.aprovadoEm,
    });
    const url = await guarda(deps.armazenamentoDocumentos).linkEnvio(r.caminho);
    return c.json({ versaoId: r.versaoId, envio: { url, metodo: "PUT", tipo: r.tipo } }, 201);
  });
  app.post("/v1/condominio/documentos/:id/versoes/:versao/verificar", async (c) => {
    const ids = versaoDocumento(c);
    const g = guarda(deps.armazenamentoDocumentos);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_versao_documento_a_verificar", ids);
    const bytes = await g.ler(a.caminho);
    const r = bytes
      ? verificarArquivo(bytes, a.tipo as TipoArquivo, TAMANHO_MAXIMO_DOCUMENTO)
      : { ok: false as const, motivo: "O arquivo não chegou. Envie de novo." };
    if (r.ok) {
      await g.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_versao_documento", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await g.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_versao_documento", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });
  app.get("/v1/condominio/documentos/:id/versoes/:versao/link", async (c) => {
    const baixar = c.req.query("baixar") === "1";
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_versao_documento", {
      ...versaoDocumento(c), p_baixar: baixar,
    });
    return c.json(await linkArquivo(guarda(deps.armazenamentoDocumentos), a, baixar));
  });
  app.post("/v1/condominio/documentos/:id/email", async (c) => {
    const d = await lerCorpo(c, enviarDocumentoSchema);
    const r = await rpc("plataforma_enviar_documento", {
      ...quem(c), p_id: idDaRota(c, "id"), p_contatos: d.contatos, p_emails: d.emails, p_recado: d.recado,
    });
    esvaziarFila();
    return c.json(r, 201);
  });
  app.post("/v1/condominio/documentos/:id/envios/:envio/cancelar", async (c) =>
    c.json(await rpc("plataforma_cancelar_envio_documento", { ...quem(c), p_id: idDaRota(c, "id"), p_envio: idDaRota(c, "envio") })));

  // Trocar o link do mural é só do condomínio (CD-12, CF-03).
  app.post("/v1/condominio/mural/trocar-link", async (c) => {
    const d = await lerCorpo(c, trocarLinkMuralSchema);
    return c.json(await rpc("plataforma_trocar_link_mural", { ...quem(c), p_versao: d.versao, p_motivo: d.motivo }));
  });

  // E-mail do contato: a gestão grava; só a própria pessoa confirma (CD-13).
  app.put("/v1/condominio/contatos/:id/email", async (c) => {
    const d = await lerCorpo(c, emailContatoSchema);
    const r = await rpc<{ confirmacaoNaFila?: boolean }>("plataforma_email_contato", {
      ...quem(c), p_contato: idDaRota(c, "id"), p_versao: d.versao, p_email: d.email, p_recebe: d.recebe,
    });
    if (r.confirmacaoNaFila) esvaziarFila();
    return c.json(r);
  });
  app.post("/v1/condominio/contatos/:id/email/reenviar", async (c) => {
    const r = await rpc("plataforma_reenviar_confirmacao", { ...quem(c), p_contato: idDaRota(c, "id") });
    esvaziarFila();
    return c.json(r);
  });

  // ---------------------------------------------------------------------------------------
  // Sem conta (CD-12 a CD-14): o mural e os links do e-mail. Nenhuma sessão; o código do link
  // é a chave e o banco entra só no condomínio dele. Cada aparelho tem limite de uso.
  const aparelho = (c: Context) => sha256Hex(`aparelho|${ipDaChamada(c.req.raw.headers) ?? "sem-ip"}`);
  async function dentroDoLimite(tipo: string, chave: string) {
    if (!(await rpc<boolean>("limite_contar", { p_tipo: tipo, p_chave: chave }))) throw new ErroDominio("RATE_LIMITED");
  }
  const linkPublico = async (a: Armazenamento, x: { caminho: string; nome: string; tipo: string }, baixar = false) => ({
    url: await a.linkLeitura(x.caminho, VALIDADE_LINK_ARQUIVO_S, baixar ? x.nome : undefined),
    nome: x.nome,
    tipo: x.tipo,
  });

  app.get("/v1/publico/mural/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("mural", await aparelho(c));
    return c.json(await rpc("publico_mural", { p_codigo: codigo }));
  });
  app.get("/v1/publico/mural/:codigo/comunicados/:id/arquivos/:arquivo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("mural", await aparelho(c));
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_mural_arquivo", {
      p_codigo: codigo, p_comunicado: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo"),
    });
    return c.json(await linkPublico(guarda(deps.armazenamentoComunicados), a));
  });
  app.get("/v1/publico/mural/:codigo/classificados/:id/foto", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("mural", await aparelho(c));
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_mural_classificado_foto", {
      p_codigo: codigo, p_id: idDaRota(c, "id"),
    });
    return c.json(await linkPublico(guarda(deps.armazenamento), a));
  });
  app.post("/v1/publico/mural/:codigo/documentos", async (c) => {
    const codigo = codigoDaRota(c);
    const d = await lerCorpo(c, pedirDocumentoSchema);
    await dentroDoLimite("pedido_aparelho", await aparelho(c));
    await dentroDoLimite("pedido_documento", await sha256Hex(`pedido|${d.email.toLowerCase()}`));
    const r = await rpc("publico_pedir_documento", { p_codigo: codigo, p_documento: d.documentoId, p_email: d.email });
    esvaziarFila();
    return c.json(r);
  });

  app.get("/v1/publico/c/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_comunicado", { p_codigo: codigo }));
  });
  app.get("/v1/publico/c/:codigo/arquivos/:arquivo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_comunicado_arquivo", {
      p_codigo: codigo, p_arquivo: idDaRota(c, "arquivo"),
    });
    return c.json(await linkPublico(guarda(deps.armazenamentoComunicados), a));
  });
  app.get("/v1/publico/d/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    const a = await rpc<{ caminho: string; nome: string; tipo: string; titulo: string; numero: number; condominio: string }>(
      "publico_documento", { p_codigo: codigo },
    );
    return c.json({ ...(await linkPublico(guarda(deps.armazenamentoDocumentos), a, true)), titulo: a.titulo, numero: a.numero, condominio: a.condominio });
  });
  for (const [rota, funcao] of [["confirmar", "publico_confirmar_email"], ["parar", "publico_parar_email"], ["voltar", "publico_voltar_email"]]) {
    app.post(`/v1/publico/email/${rota}`, async (c) => {
      const d = await lerCorpo(c, codigoLinkSchema);
      await dentroDoLimite("link", await aparelho(c));
      return c.json(await rpc(funcao!, { p_codigo: d.codigo }));
    });
  }

  // Link de cadastro (MU-09): sem conta. A chave de quem mandou vai no corpo, nunca no endereço.
  app.get("/v1/publico/cadastro/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_cadastro", { p_codigo: codigo, p_chave: null }));
  });
  app.post("/v1/publico/cadastro/:codigo/ver", async (c) => {
    const codigo = codigoDaRota(c);
    const d = await lerCorpo(c, verCadastroSchema);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_cadastro", { p_codigo: codigo, p_chave: d.chave }));
  });
  app.post("/v1/publico/cadastro/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    const { chave, ...dados } = await lerCorpo(c, enviarCadastroSchema);
    await dentroDoLimite("cadastro", await aparelho(c));
    return c.json(await rpc("publico_enviar_cadastro", { p_codigo: codigo, p_chave: chave, p_dados: dados }));
  });

  // Etiqueta por local (AT-30): quem aponta a câmera vê o local e o botão do WhatsApp.
  app.get("/v1/publico/etiqueta/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("etiqueta", await aparelho(c));
    return c.json(await rpc("publico_etiqueta", { p_codigo: codigo }));
  });

  // O link pessoal da enquete (AC-03): sem conta; o código é só da unidade ou da pessoa.
  app.get("/v1/publico/v/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_enquete", { p_codigo: codigo }));
  });
  app.post("/v1/publico/v/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    const d = await lerCorpo(c, responderEnqueteSchema);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_responder_enquete", { p_codigo: codigo, p_opcao: d.opcao }));
  });

  // O link pessoal da assembleia (AC-02): abrir durante a assembleia registra a presença online.
  app.get("/v1/publico/a/:codigo", async (c) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_assembleia", { p_codigo: codigo }));
  });
  app.post("/v1/publico/a/:codigo/voto", async (c) => {
    const codigo = codigoDaRota(c);
    const d = await lerCorpo(c, votarAssembleiaSchema);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_votar_assembleia", { p_codigo: codigo, p_item: d.itemId, p_opcao: d.opcao }));
  });
  app.post("/v1/publico/a/:codigo/procuracao", async (c) => {
    const codigo = codigoDaRota(c);
    const d = await lerCorpo(c, procuracaoPublicaSchema);
    await dentroDoLimite("link", await aparelho(c));
    return c.json(await rpc("publico_procuracao_assembleia", { p_codigo: codigo, p_nome: d.nome, p_unidade_procurador: d.unidadeId }));
  });

  // Link do prestador (V-11, MP-08): o serviço, a chegada, o "não consegui fazer", o "terminei" e as fotos.
  const prestador = async (c: Context) => {
    const codigo = codigoDaRota(c);
    await dentroDoLimite("prestador", await aparelho(c));
    return codigo;
  };
  app.get("/v1/publico/p/:codigo", async (c) => c.json(await rpc("publico_prestador", { p_codigo: await prestador(c) })));
  app.get("/v1/publico/p/:codigo/arquivos/:arquivo", async (c) => {
    const codigo = await prestador(c);
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("publico_prestador_arquivo", {
      p_codigo: codigo, p_arquivo: idDaRota(c, "arquivo"),
    });
    return c.json(await linkPublico(armazenamentoManutencao(), a));
  });
  // Confirmar ou dizer que não pode atender (MP-09): recusar passa o serviço para a reserva.
  app.post("/v1/publico/p/:codigo/confirmar", async (c) =>
    c.json(await rpc("publico_prestador_confirmar", { p_codigo: await prestador(c) })));
  app.post("/v1/publico/p/:codigo/recusar", async (c) => {
    const codigo = await prestador(c);
    const d = await lerCorpo(c, recusarPrestadorSchema);
    const r = await rpc("publico_prestador_recusar", { p_codigo: codigo, p_texto: d.texto });
    noFundo(processarFilaWhatsapp);
    return c.json(r);
  });
  app.post("/v1/publico/p/:codigo/chegada", async (c) => {
    const codigo = await prestador(c);
    const d = await lerCorpo(c, chegadaSchema);
    return c.json(await rpc("publico_prestador_chegada", { p_codigo: codigo, p_etiqueta: d.etiqueta }));
  });
  app.post("/v1/publico/p/:codigo/fotos", async (c) => {
    const codigo = await prestador(c);
    const d = await lerCorpo(c, fotoPrestadorSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("publico_prestador_iniciar_foto", {
      p_codigo: codigo, p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await armazenamentoManutencao().linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });
  app.post("/v1/publico/p/:codigo/fotos/:arquivo/verificar", async (c) => {
    const codigo = await prestador(c);
    const ids = { p_codigo: codigo, p_arquivo: idDaRota(c, "arquivo") };
    const guarda = armazenamentoManutencao();
    const a = await rpc<{ caminho: string; tipo: string }>("publico_prestador_foto_a_verificar", ids);
    const bytes = await guarda.ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "A foto não chegou. Envie de novo." };
    if (r.ok) {
      await guarda.gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("publico_prestador_verificar_foto", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await guarda.apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("publico_prestador_verificar_foto", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });
  app.post("/v1/publico/p/:codigo/impedimento", async (c) => {
    const codigo = await prestador(c);
    const d = await lerCorpo(c, impedimentoSchema);
    return c.json(await rpc("publico_prestador_impedimento", { p_codigo: codigo, p_impedimento: d.impedimento, p_texto: d.texto, p_fotos: d.fotos }));
  });
  app.post("/v1/publico/p/:codigo/terminei", async (c) => {
    const codigo = await prestador(c);
    const d = await lerCorpo(c, termineiSchema);
    return c.json(await rpc("publico_prestador_terminei", {
      p_codigo: codigo, p_texto: d.texto, p_ficou_pendente: d.ficouPendente, p_pendente_texto: d.pendenteTexto, p_quem_fez: d.quemFez,
      p_fotos: d.fotos,
    }));
  });

  // "Parar de receber" em um clique, chamado pelo próprio programa de e-mail (sem repasse).
  app.post("/v1/email/parar/:codigo", async (c) => {
    await rpc("publico_parar_email", { p_codigo: codigoDaRota(c) });
    return c.json({ ok: true });
  });

  // Avisos do provedor: entregue, devolvido e spam (CD-13). Só vale o aviso assinado.
  app.post("/v1/email/eventos", async (c) => {
    const corpo = await c.req.text();
    if (!deps.segredoWebhook || !(await avisoAssinado(deps.segredoWebhook, c.req.raw.headers, corpo))) {
      throw new ErroDominio("FORBIDDEN");
    }
    let json: unknown;
    try {
      json = JSON.parse(corpo);
    } catch {
      throw new ErroDominio("VALIDATION_ERROR");
    }
    const ev = lerEventoResend(json);
    if (ev) {
      await rpc("email_evento", { p_condominio: ev.condominio, p_envio: ev.envio, p_provedor_id: ev.provedorId, p_tipo: ev.tipo, p_detalhe: ev.detalhe });
      if (ev.tipo === "ADIADO") esvaziarFila();
    }
    return c.json({ ok: true });
  });

  // O banco chama (pg_cron + pg_net, com o segredo de repasse) quando há e-mail esperando.
  app.post("/v1/interno/fila-email", async (c) => c.json({ enviados: await processarFila() }));

  /** Pega lotes da fila, manda pelo provedor e devolve o resultado de cada envio. */
  async function processarFila(lotes = 5): Promise<number> {
    if (!deps.correio) return 0;
    const enderecos = {
      urlApp: deps.urlApp,
      urlFuncao: deps.urlFuncao ?? "",
      remetente: deps.remetente ?? REMETENTE,
    };
    let total = 0;
    for (let i = 0; i < lotes; i++) {
      const msgs = await rpc<MensagemFila[]>("email_pegar_lote", { p_max: 100 });
      if (!msgs.length) break;
      const resultados = await deps.correio.enviarLote(msgs.map((m) => montarEmail(m, enderecos)));
      for (const [j, m] of msgs.entries()) {
        const r = resultados[j] ?? { ok: false as const, erro: "Sem resultado", tentarDeNovo: true };
        await rpc("email_resultado", {
          p_condominio: m.condominio, p_envio: m.envio, p_provedor_id: r.ok ? r.id : null, p_erro: r.ok ? null : r.erro,
          p_tentar_de_novo: r.ok ? false : r.tentarDeNovo,
        });
        if (r.ok) total++;
      }
      if (msgs.length < 100) break;
    }
    return total;
  }
  /** Depois de pôr e-mail na fila, manda sem fazer a pessoa esperar. */
  function esvaziarFila() {
    if (!deps.correio) return;
    const p = processarFila().catch((erro) => registrar("erro", { funcao: "api-plataforma", rota: "fila-email", erro }));
    (deps.aoFundo ?? (() => {}))(p);
  }

  // O banco chama (pg_cron + pg_net, com o segredo de repasse) quando há pacote da exportação esperando.
  app.post("/v1/interno/exportacao", async (c) => c.json({ montados: await montarExportacao() }));

  interface ParteExportacao {
    condominio: string;
    exportacao: string;
    parte: string;
    numero: number;
    tipo: "DADOS" | "ARQUIVOS";
    caminho: string;
    arquivos: { b: "pedidos" | "manutencoes" | "comunicados" | "documentos"; c: string; n: string }[];
  }
  const LEIA_ME = [
    "Exportação da TRÍADE Condo",
    "",
    "dados.json: tudo o que o condomínio guardou, tabela por tabela, com o histórico.",
    "planilhas/: as mesmas tabelas em CSV (separadas por ponto e vírgula), para abrir no Excel ou no LibreOffice.",
    "Os arquivos (fotos, PDFs e documentos) vêm nos pacotes \"arquivos\", em pastas por pedido, manutenção, comunicado e documento.",
    "",
    "Guarde com cuidado: há dados pessoais dos moradores.",
  ].join("\r\n");

  /** Um pacote: o dos dados (JSON e planilhas) ou um dos arquivos. Arquivo que sumiu entra numa lista. */
  async function montarPacote(p: ParteExportacao): Promise<Uint8Array> {
    const enc = new TextEncoder();
    if (p.tipo === "DADOS") {
      const dados = await rpc<{ tabelas: Record<string, Record<string, unknown>[]> }>("exportacao_dados", {
        p_condominio: p.condominio, p_parte: p.parte,
      }, 60_000);
      const itens: ItemZip[] = [
        { nome: "LEIA-ME.txt", bytes: enc.encode(LEIA_ME), comprimir: true },
        { nome: "dados.json", bytes: enc.encode(JSON.stringify(dados, null, 1)), comprimir: true },
        ...Object.entries(dados.tabelas).map(([t, linhas]) => ({ nome: `planilhas/${t}.csv`, bytes: enc.encode(planilhaCsv(linhas)), comprimir: true })),
      ];
      return await montarZip(itens);
    }
    const guardas = {
      pedidos: deps.armazenamento,
      manutencoes: armazenamentoManutencao(),
      comunicados: guarda(deps.armazenamentoComunicados),
      documentos: guarda(deps.armazenamentoDocumentos),
    };
    const itens: ItemZip[] = [];
    const faltando: string[] = [];
    for (const a of p.arquivos) {
      const bytes = await guardas[a.b].ler(a.c);
      if (bytes) itens.push({ nome: a.n, bytes });
      else faltando.push(a.n);
    }
    if (faltando.length) itens.push({ nome: "arquivos-que-nao-vieram.txt", bytes: enc.encode(faltando.join("\r\n")), comprimir: true });
    return await montarZip(itens);
  }

  /** Monta pacotes até acabar ou até perto do tempo da função. */
  async function montarExportacao(tempoMs = 90_000): Promise<number> {
    const destino = deps.armazenamentoExportacoes;
    if (!destino) return 0;
    const inicio = Date.now();
    let n = 0;
    while (Date.now() - inicio < tempoMs) {
      const p = await rpc<ParteExportacao | null>("exportacao_pegar_parte", {});
      if (!p) break;
      try {
        const bytes = await montarPacote(p);
        await destino.gravar(p.caminho, bytes, "application/zip");
        await rpc("exportacao_parte_pronta", { p_condominio: p.condominio, p_parte: p.parte, p_tamanho: bytes.length, p_erro: null });
        n++;
      } catch (erro) {
        registrar("erro", { funcao: "api-plataforma", rota: "exportacao", erro });
        await rpc("exportacao_parte_pronta", {
          p_condominio: p.condominio, p_parte: p.parte, p_tamanho: null, p_erro: String(erro instanceof Error ? erro.message : erro).slice(0, 200),
        });
      }
    }
    return n;
  }
  function montarAoFundo() {
    if (!deps.armazenamentoExportacoes) return;
    const p = montarExportacao().catch((erro) => registrar("erro", { funcao: "api-plataforma", rota: "exportacao", erro }));
    (deps.aoFundo ?? (() => {}))(p);
  }

  // Ajuda e suporte (peça R4; PI-17, PI-20): chamados de suporte técnico com até 3 imagens,
  // com as regras das fotos dos pedidos.
  app.get("/v1/condominio/chamados", async (c) => c.json(await rpc("plataforma_chamados", quem(c))));

  app.post("/v1/condominio/chamados", async (c) => {
    const d = await lerCorpo(c, abrirChamadoSchema);
    return c.json(await rpc("plataforma_abrir_chamado", { ...quem(c), p_tipo: d.tipo, p_area: d.area, p_titulo: d.titulo, p_texto: d.texto }), 201);
  });

  // Pedir mudança à TRÍADE (0286; PI-04, CF-09): o chamado de mudança, com a parte e o valor de
  // hoje, e as mudanças pedidas que a Configuração mostra ao lado de cada parte.
  app.get("/v1/condominio/chamados/mudancas", async (c) => c.json({ itens: await rpc("plataforma_mudancas_pedidas", quem(c)) }));

  app.post("/v1/condominio/chamados/mudanca", async (c) => {
    const d = await lerCorpo(c, pedirMudancaSchema);
    return c.json(await rpc("plataforma_pedir_mudanca", {
      ...quem(c), p_parte: d.parte, p_titulo: tituloMudanca(d.parte), p_hoje: d.hoje, p_texto: d.texto,
    }), 201);
  });

  app.get("/v1/condominio/chamados/:id", async (c) => c.json(await rpc("plataforma_chamado", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/chamados/:id/responder", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, responderChamadoSchema);
    return c.json(await rpc("plataforma_responder_chamado", { ...quem(c), p_id: id, p_texto: d.texto }), 201);
  });

  app.post("/v1/condominio/chamados/:id/resolver", async (c) =>
    c.json(await rpc("plataforma_resolver_chamado", { ...quem(c), p_id: idDaRota(c, "id") })));

  const suporte = () => {
    if (!deps.armazenamentoSuporte) throw new ErroDominio("INTERNAL_ERROR");
    return deps.armazenamentoSuporte;
  };
  const imagem = (c: Context<VarsPlataforma>) => ({ ...quem(c), p_id: idDaRota(c, "id"), p_arquivo: idDaRota(c, "arquivo") });

  app.post("/v1/condominio/chamados/:id/imagens", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, iniciarImagemChamadoSchema);
    const r = await rpc<{ arquivoId: string; caminho: string; tipo: string }>("plataforma_iniciar_arquivo_chamado", {
      ...quem(c), p_id: id, p_nome: d.nome, p_tipo: d.tipo, p_tamanho: d.tamanho,
    });
    return c.json({ arquivoId: r.arquivoId, envio: { url: await suporte().linkEnvio(r.caminho), metodo: "PUT", tipo: r.tipo } }, 201);
  });

  app.post("/v1/condominio/chamados/:id/imagens/:arquivo/verificar", async (c) => {
    const ids = imagem(c);
    const a = await rpc<{ caminho: string; tipo: string }>("plataforma_arquivo_chamado_a_verificar", ids);
    const bytes = await suporte().ler(a.caminho);
    const r = bytes ? verificarArquivo(bytes, a.tipo as TipoArquivo) : { ok: false as const, motivo: "A imagem não chegou. Envie de novo." };
    if (r.ok) {
      await suporte().gravar(a.caminho, r.bytes, a.tipo);
      return c.json(await rpc("plataforma_verificar_arquivo_chamado", { ...ids, p_liberado: true, p_tamanho: r.bytes.length, p_motivo: null }));
    }
    if (bytes) await suporte().apagar(a.caminho);
    const fim = await rpc<{ situacao: string }>("plataforma_verificar_arquivo_chamado", { ...ids, p_liberado: false, p_tamanho: null, p_motivo: r.motivo });
    return c.json({ ...fim, motivo: r.motivo });
  });

  app.get("/v1/condominio/chamados/:id/imagens/:arquivo/link", async (c) => {
    const a = await rpc<{ caminho: string; nome: string; tipo: string }>("plataforma_abrir_arquivo_chamado", imagem(c));
    const url = await suporte().linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  // Acesso excepcional da TRÍADE (PI-11): só o síndico aprova, recusa ou encerra.
  app.get("/v1/condominio/acessos-excepcionais", async (c) => c.json({ acessos: await rpc("plataforma_acessos_excepcionais", quem(c)) }));

  app.post("/v1/condominio/acessos-excepcionais/:id/decidir", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, decidirAcessoExcepcionalSchema);
    return c.json(await rpc("plataforma_decidir_acesso_excepcional", { ...quem(c), p_id: id, p_aprovar: d.aprovar, p_motivo: d.motivo }));
  });

  app.post("/v1/condominio/acessos-excepcionais/:id/encerrar", async (c) =>
    c.json(await rpc("plataforma_encerrar_acesso_excepcional", { ...quem(c), p_id: idDaRota(c, "id") })));

  // WhatsApp do condomínio (passo 5; W-05, W-09 a W-16). O aviso do provedor vem com o segredo
  // do condomínio no caminho; quem é o condomínio o banco decide pelo segredo, nunca pelo texto.
  app.post("/v1/whatsapp/:segredo/:tipo", async (c) => {
    const tipo = c.req.param("tipo") as TipoAvisoWhatsapp;
    const segredoGancho = c.req.param("segredo");
    if (!deps.whatsapp || !TIPOS_AVISO_WHATSAPP.includes(tipo)) throw new ErroDominio("NOT_FOUND");
    const corpo = await c.req.text();
    if (corpo.length > 262_144) throw new ErroDominio("VALIDATION_ERROR");
    let json: unknown;
    try {
      json = JSON.parse(corpo);
    } catch {
      throw new ErroDominio("VALIDATION_ERROR");
    }
    const ev = deps.whatsapp.conector.lerAviso(tipo, json);
    if (!ev) return c.json({ ok: true });
    if (ev.tipo === "RECEBIDA") {
      const r = await rpc<{ repetida: boolean; midias: MidiaPendente[] }>("whatsapp_receber", {
        p_segredo: segredoGancho, p_instancia: ev.instancia, p_msg: ev.mensagem,
      });
      if (!r.repetida) noFundo(async () => {
        for (const m of r.midias) await baixarMidia(m);
        await processarFilaWhatsapp();
      });
    } else if (ev.tipo === "ENTREGUE" || ev.tipo === "LIDA") {
      for (const id of ev.ids.slice(0, 50)) {
        await rpc("whatsapp_evento", { p_segredo: segredoGancho, p_instancia: ev.instancia, p_tipo: ev.tipo, p_provedor_id: id, p_aparelho: null });
      }
    } else if (ev.tipo === "CONECTADO" || ev.tipo === "DESCONECTADO") {
      await rpc("whatsapp_evento", { p_segredo: segredoGancho, p_instancia: ev.instancia, p_tipo: ev.tipo, p_provedor_id: null, p_aparelho: ev.aparelho });
    }
    return c.json({ ok: true });
  });

  // O banco chama (pg_cron + pg_net, com o segredo de repasse) quando há envio ou mídia esperando.
  app.post("/v1/interno/fila-whatsapp", async (c) => {
    let baixadas = 0;
    for (const m of await rpc<MidiaPendente[]>("whatsapp_midias_pendentes", {})) {
      await baixarMidia(m);
      baixadas++;
    }
    return c.json({ enviados: await processarFilaWhatsapp(), baixadas });
  });

  interface MidiaPendente { condominio: string; mensagem: string; url: string; tipo: MidiaWhatsapp; caminho: string }
  interface LoteWhatsapp {
    condominio: string;
    instancia: string;
    credenciais: string;
    envios: { envio: string; para: string; texto: string; pedido?: string; link?: string; rota?: "v" | "a" | "p" | "c" }[];
  }

  function noFundo(trabalho: () => Promise<unknown>) {
    const p = trabalho().catch((erro) => registrar("erro", { funcao: "api-plataforma", rota: "whatsapp", erro }));
    (deps.aoFundo ?? (() => {}))(p);
  }

  /** Baixa a mídia do provedor, confere (W-05) e guarda no armazenamento dos pedidos. */
  async function baixarMidia(m: MidiaPendente) {
    if (!deps.whatsapp) return;
    const bytes = await deps.whatsapp.conector.baixar(m.url, TAMANHO_MAXIMO_MIDIA);
    const r = bytes ? verificarMidia(bytes, m.tipo) : { ok: false as const, motivo: "O arquivo passa de 16 MB." };
    if (r.ok) await deps.armazenamento.gravar(m.caminho, r.bytes, m.tipo);
    await rpc("whatsapp_midia_resultado", {
      p_condominio: m.condominio, p_mensagem: m.mensagem, p_tamanho: r.ok ? r.bytes.length : null,
      p_motivo: r.ok ? null : motivoMidiaParaMorador(r.motivo),
    });
  }

  /** Pega os lotes da fila, manda pelo conector, um por vez, e devolve o resultado de cada envio. */
  async function processarFilaWhatsapp(rodadas = 3): Promise<number> {
    if (!deps.whatsapp) return 0;
    const { conector, chave } = deps.whatsapp;
    let total = 0;
    for (let i = 0; i < rodadas; i++) {
      const lotes = await rpc<LoteWhatsapp[]>("whatsapp_pegar_lote", { p_max: 20 });
      if (!lotes.length) break;
      for (const l of lotes) {
        const cred = await decifrarCredenciais(chave, l.credenciais);
        for (const e of l.envios) {
          // O link pessoal da enquete (/v), da assembleia (/a), do prestador reserva (/p) ou do
          // comunicado (/c) entra só aqui: o banco guarda o texto com [link] (peça R12, MP-09, F6.6).
          const comLink = e.link ? e.texto.replaceAll("[link]", `${deps.urlApp.replace(/\/$/, "")}/${e.rota ?? "v"}/${e.link}`) : e.texto;
          const texto = textoComLinkDoPainel(comLink, e.pedido ? `${deps.urlApp}/pedidos/pedido?id=${e.pedido}` : null);
          const r = await conector.enviarTexto({ instancia: l.instancia || cred.instancia, token: cred.token }, e.para, texto);
          await rpc("whatsapp_resultado", {
            p_condominio: l.condominio, p_envio: e.envio, p_provedor_id: r.ok ? r.id : null,
            p_erro: r.ok ? null : r.erro, p_falha: r.ok ? null : r.falha,
          });
          if (r.ok) total++;
        }
      }
    }
    return total;
  }

  app.get("/v1/condominio/whatsapp", async (c) => c.json(await rpc("plataforma_whatsapp", quem(c))));

  app.post("/v1/condominio/whatsapp/mensagens/:id/triar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, triarWhatsappSchema);
    return c.json(await rpc("plataforma_triar_whatsapp", {
      ...quem(c), p_mensagem: id, p_acao: d.acao, p_motivo: d.motivo, p_pedido: d.pedidoId, p_contato: d.contatoId,
    }));
  });

  app.get("/v1/condominio/whatsapp/mensagens/:id/midia", async (c) => {
    const a = await rpc<{ caminho: string; tipo: string; nome: string }>("plataforma_midia_whatsapp", { ...quem(c), p_mensagem: idDaRota(c, "id") });
    const url = await deps.armazenamento.linkLeitura(a.caminho, VALIDADE_LINK_ARQUIVO_S);
    return c.json({ url, tipo: a.tipo, expiraEm: new Date(Date.now() + VALIDADE_LINK_ARQUIVO_S * 1000).toISOString() });
  });

  app.post("/v1/condominio/whatsapp/envios/:id/reenviar", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, motivoFalhaSchema);
    const r = await rpc("plataforma_reenviar_whatsapp", { ...quem(c), p_envio: id, p_motivo: d.motivo });
    noFundo(processarFilaWhatsapp);
    return c.json(r, 201);
  });

  app.post("/v1/condominio/whatsapp/envios/:id/resolver", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, motivoFalhaSchema);
    await rpc("plataforma_resolver_falha_whatsapp", { ...quem(c), p_envio: id, p_motivo: d.motivo });
    return c.json({ ok: true });
  });

  app.get("/v1/condominio/pedidos/:id/whatsapp", async (c) =>
    c.json(await rpc("plataforma_pedido_whatsapp", { ...quem(c), p_id: idDaRota(c, "id") })));

  app.post("/v1/condominio/pedidos/:id/whatsapp", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, responderWhatsappSchema);
    const r = await rpc("plataforma_responder_whatsapp", { ...quem(c), p_id: id, p_versao: d.versao, p_texto: d.texto });
    noFundo(processarFilaWhatsapp);
    return c.json(r, 201);
  });

  app.post("/v1/condominio/whatsapp/revisoes/:id/manter", async (c) => {
    const id = idDaRota(c, "id");
    const d = await lerCorpo(c, manterRevisaoSchema);
    const r = await rpc("plataforma_manter_revisao_whatsapp", { ...quem(c), p_revisao: id, p_resposta: d.resposta });
    noFundo(processarFilaWhatsapp);
    return c.json(r);
  });

  // Queda do WhatsApp (F5.10; W-17): abrir à mão, canal alternativo, conferir o que ficou parado e encerrar.
  app.post("/v1/condominio/whatsapp/quedas", async (c) => {
    const d = await lerCorpo(c, abrirQuedaSchema);
    return c.json(await rpc("plataforma_abrir_queda", { ...quem(c), p_o_que_aconteceu: d.oQueAconteceu }), 201);
  });
  app.get("/v1/condominio/whatsapp/quedas/:id", async (c) => c.json(await rpc("plataforma_queda", { ...quem(c), p_id: idDaRota(c, "id") })));
  app.put("/v1/condominio/whatsapp/quedas/:id", async (c) => {
    const d = await lerCorpo(c, editarQuedaSchema);
    return c.json(await rpc("plataforma_editar_queda", {
      ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_canal: d.canalAlternativo, p_o_que_aconteceu: d.oQueAconteceu,
    }));
  });
  app.post("/v1/condominio/whatsapp/quedas/:id/voltou", async (c) =>
    c.json(await rpc("plataforma_queda_voltou", { ...quem(c), p_id: idDaRota(c, "id") })));
  app.post("/v1/condominio/whatsapp/quedas/:id/conciliar", async (c) => {
    const d = await lerCorpo(c, conciliarQuedaSchema);
    const r = await rpc("plataforma_conciliar_queda", {
      ...quem(c), p_id: idDaRota(c, "id"), p_envios: d.envios, p_decisao: d.decisao, p_motivo: d.motivo,
    });
    if (d.decisao === "MANDAR") noFundo(processarFilaWhatsapp);
    return c.json(r);
  });
  app.post("/v1/condominio/whatsapp/quedas/:id/encerrar", async (c) => {
    const d = await lerCorpo(c, encerrarQuedaSchema);
    return c.json(await rpc("plataforma_encerrar_queda", { ...quem(c), p_id: idDaRota(c, "id"), p_versao: d.versao, p_resumo: d.resumo }));
  });

  app.post("/v1/condominio/whatsapp/termo", async (c) => c.json(await rpc("plataforma_aceitar_termo_whatsapp", quem(c))));

  // Comunicados pelo WhatsApp do condomínio (F6.6): ligar, desligar e o convite.
  app.get("/v1/condominio/whatsapp/comunicados", async (c) => c.json(await rpc("plataforma_comunicados_whatsapp", quem(c))));
  app.put("/v1/condominio/whatsapp/comunicados", async (c) => {
    const d = await lerCorpo(c, comunicadosWhatsappSchema);
    return c.json(await rpc("plataforma_definir_comunicados_whatsapp", { ...quem(c), p_versao: d.versao, p_ligado: d.ligado }));
  });

  app.put("/v1/condominio/whatsapp/meus-avisos", async (c) => {
    const d = await lerCorpo(c, meusAvisosWhatsappSchema);
    return c.json({ versao: await rpc("plataforma_meus_avisos_whatsapp", {
      ...quem(c), p_versao: d.versao, p_telefone: d.telefone, p_tipos: d.tipos, p_ligado: d.ligado,
    }) });
  });

  return app;
}

/** Rotas de dado de condomínio: sessão completa e o condomínio escolhido, ainda com vínculo ativo. */
export function exigirCondominio(deps: DepsSessao): MiddlewareHandler<VarsPlataforma> {
  return async (c, next) => {
    const s = c.get("sessao");
    const condominio = await deps.banco.rpc<string | null>("condominio_da_sessao", { p_pessoa: s.pessoaId, p_sessao: s.sessaoId });
    if (!condominio) throw new ErroDominio("CONDOMINIO_REQUIRED");
    c.set("condominioId", condominio);
    await next();
  };
}
