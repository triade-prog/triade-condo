// Ícones de traço fino do sistema de design (docs/identidade/sistema.html, parte Ícones).
// Sempre com palavra junto; sozinho, só com rótulo para quem usa leitor de tela.

import type { ReactNode } from "react";

const ICONES = {
  casa: <path d="m3 10.5 9-7 9 7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pedido: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  decisao: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 3.5h6v3H9zM8.5 12l2 2 4-4M8.5 17h7" /></>,
  predio: <path d="M4 21V7l8-4v18M12 10h8v11M2 21h20M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2" />,
  pessoas: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M21 20v-1a6 6 0 0 0-3-5" /></>,
  pessoa: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  "pessoa-mais": <><circle cx="10" cy="8" r="4" /><path d="M2 21a8 8 0 0 1 13-6M19 14v6M16 17h6" /></>,
  grafico: <path d="M4 20V11m6 9V4m6 16v-7m5 7H3" />,
  ajuste: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  busca: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  sino: <><path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  pata: <><circle cx="4.8" cy="11.2" r="1.9" /><circle cx="8.6" cy="6.2" r="2.1" /><circle cx="15.4" cy="6.2" r="2.1" /><circle cx="19.2" cy="11.2" r="1.9" /><path d="M12 11.5c-2.6 0-6 4.6-6 7.2 0 1.4 1 2.1 2.3 2.1 1.6 0 2.4-.8 3.7-.8s2.1.8 3.7.8c1.3 0 2.3-.7 2.3-2.1 0-2.6-3.4-7.2-6-7.2z" /></>,
  bolo: <path d="M3.5 21h17M5 21v-6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V21M5 16.5c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M8 12.5V9.5M12 12.5V9.5M16 12.5V9.5M8 7h.01M12 7h.01M16 7h.01" />,
  etiqueta: <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0zM8 8h.01" />,
  mais: <path d="M12 5v14M5 12h14" />,
  seta: <path d="M5 12h14m-5-5 5 5-5 5" />,
  baixo: <path d="m6 9 6 6 6-6" />,
  esq: <path d="m15 6-6 6 6 6" />,
  dir: <path d="m9 6 6 6-6 6" />,
  fechar: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pontos: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  balao: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-3A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 10h8M8 14h5" /></>,
  retorno: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  ferramenta: <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5 6.5 20.5l5.7-5.7a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z" />,
  chave: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></>,
  escudo: <path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" />,
  clipe: <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7-7l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3" />,
  documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  whats: <><path d="M4 20l1.3-3.8A8.5 8.5 0 1 1 8 19z" /><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1.3-1.2 2 1-.4 1.6c-3.5.5-7.6-3.6-7.1-7.1L11 8l1 2z" /></>,
  trocar: <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />,
  alerta: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  preparar: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></>,
  mudanca: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  engrenagem: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
  copiar: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".9" /><circle cx="4.5" cy="12" r=".9" /><circle cx="4.5" cy="18" r=".9" /></>,
  compartilhar: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  estrela: <path d="m12 3 2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z" />,
  filtro: <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />,
  editar: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  baixar: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M4 19h16" />,
  enviar: <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M4 19h16" />,
  olho: <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>,
  cadeado: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  dinheiro: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>,
  camadas: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" />,
  pausa: <path d="M9 5v14M15 5v14" />,
  tocar: <path d="M8 5.5v13l10.5-6.5z" />,
  telefone: <path d="M5 3.5h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6.5 6.5l1.5-2.3 4.5 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></>,
  imprimir: <><path d="M7 9V3.5h10V9M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1" /></>,
  sair: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.5" /></>,
  megafone: <path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1zM18.5 9a4 4 0 0 1 0 6" />,
  convivio: <path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 0 4 0" />,
  // Encomenda guardada na portaria (Portaria 1, PA-01).
  caixa: <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.3l8.5 4.5" />,
  carrinho: <path d="M3 4h2.5l2.2 11h10.6l2-8H6.6M9.5 19.5a1.2 1.2 0 1 0 0 .1M17 19.5a1.2 1.2 0 1 0 0 .1" />,
  // O que vence o prazo e é apagado (F0.11, Privacidade e dados).
  lixeira: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" />,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof ICONES;

export const NOMES_ICONES = Object.keys(ICONES) as NomeIcone[];

export function Icone({ nome, rotulo, className = "h-5 w-5" }: { nome: NomeIcone; rotulo?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    >
      {ICONES[nome]}
    </svg>
  );
}
