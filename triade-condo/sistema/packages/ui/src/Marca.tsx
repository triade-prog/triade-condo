// Marca: o logo violeta da TRÍADE Condo, assinatura do produto (DC13), e o nome do sistema.
// O arquivo fica em public/marca/logo.png de cada aplicação (480 × 153, fundo transparente).

export const LOGO = { src: "/marca/logo.png", largura: 480, altura: 153 } as const;

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- pacote compartilhado, sem next/image
  return <img src={LOGO.src} width={LOGO.largura} height={LOGO.altura} alt="TRÍADE Condo" className={className} />;
}

export function Marca({ sistema }: { sistema: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Logo />
      <small className="block text-[10px] font-medium tracking-widest text-tinta-suave uppercase">{sistema}</small>
    </span>
  );
}
