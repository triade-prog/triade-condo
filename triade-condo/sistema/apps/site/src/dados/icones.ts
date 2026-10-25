// Ícones de traço das telas de exemplo e dos recursos da página Plataforma, do conjunto do painel.
export const icones = {
  pedido: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
  pessoa: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  reabrir: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4.5V9h-4.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2"/>',
  megafone: '<path d="M4 10v4h3l7 4V6L7 10H4z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  mural: '<rect x="3.5" y="4.5" width="17" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h6"/>',
  voto: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chave: '<path d="M14.5 5.5a4 4 0 0 0-5.3 5.3L4 16v4h4l5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-2.5z"/>',
  pasta: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  equipe: '<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4.5 4.5 0 0 1 7-3.7"/>',
  agenda: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>',
  grafico: '<path d="M5 19V11M10 19V6M15 19v-5M20 19V9"/>',
  casa: '<path d="M4.5 10.5L12 4l7.5 6.5V20h-15z"/>',
};

export type NomeIcone = keyof typeof icones;
