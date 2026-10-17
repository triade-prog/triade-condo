// Marca provisória (o logo oficial está pendente, E5): símbolo triangular e o nome.

export function Marca({ sistema }: { sistema: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 text-violeta-500">
        <path d="M16 3 29 27H3Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <span>
        TRÍADE Condo
        <small className="block text-[10px] font-medium tracking-widest text-tinta-suave uppercase">{sistema}</small>
      </span>
    </span>
  );
}
