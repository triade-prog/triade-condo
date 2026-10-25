// Foto da faixa do Início (Plataforma e Console): os prédios ao entardecer à direita e o violeta
// liso à esquerda, onde ficam a data, a saudação e o lugar. O arquivo fica em
// public/marca/faixa-predios.webp de cada aplicação (2060 × 292). No celular a faixa é estreita e
// alta, então a foto cobre tudo e o degradê da esquerda garante a leitura do texto.
export const FOTO_FAIXA = { src: "/marca/faixa-predios.webp", largura: 2060, altura: 292 } as const;

export function FotoFaixa() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- pacote compartilhado, sem next/image */}
      <img aria-hidden="true" src={FOTO_FAIXA.src} width={FOTO_FAIXA.largura} height={FOTO_FAIXA.altura} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(24_5_103/.55)_0%,transparent_45%)] max-md:bg-[linear-gradient(90deg,rgb(24_5_103/.9)_0%,rgb(24_5_103/.65)_55%,rgb(24_5_103/.2)_100%)]" />
    </>
  );
}
