// QR do mural online (CD-12), desenhado aqui mesmo em SVG: o endereço não sai para serviço de fora.

import qrcode from "qrcode-generator";

export function QrCode({ texto, rotulo, className = "h-36 w-36" }: { texto: string; rotulo: string; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let l = 0; l < n; l++) for (let c = 0; c < n; c++) if (qr.isDark(l, c)) d += `M${c + 2} ${l + 2}h1v1h-1z`;
  return (
    <svg viewBox={`0 0 ${n + 4} ${n + 4}`} className={`text-tinta ${className}`} role="img" aria-label={rotulo} shapeRendering="crispEdges">
      <rect width={n + 4} height={n + 4} className="fill-superficie" />
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** O endereço do mural, no domínio da própria Plataforma. */
export function enderecoMural(codigo: string): string {
  return `${typeof window === "undefined" ? "" : window.location.origin}/m/${codigo}`;
}
