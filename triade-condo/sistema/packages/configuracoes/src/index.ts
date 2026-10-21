// Configurações do condomínio, as mesmas no app e na aba Configuração do Console (PI-04, CF-01,
// CF-12; decisão 7 do desenho "Configuração na implantação").
export { Configuracoes as PainelConfiguracoes, ABAS_CONFIGURACAO, type IdAba, type PropsAba } from "./Configuracoes.tsx";
export { ProvedorConfiguracao, useAmbiente, naBase, enderecoPlataforma, useCarregar, assinatura, type Ambiente, type Carga } from "./contexto.tsx";
export { ImprimirEtiquetas, enderecoEtiqueta } from "./ImprimirEtiquetas.tsx";
export { Janela, type Campo, type Valores } from "./Janela.tsx";
export { QrCode, enderecoMural } from "./QrCode.tsx";
export { ListaLocais, esquecerLocais } from "./Locais.tsx";
export { Caixa, Escolha, diaHora } from "./comum.tsx";
export { SituacaoDaConexao, TOM_CONEXAO, type Conexao } from "./conexao.tsx";
export { AjusteTecnico, FaixaTriade, PedirMudanca, SeloTriade, type Tecnica } from "./tecnica.tsx";
export type * from "./tipos.ts";
