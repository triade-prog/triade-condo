import type { Metadata } from "next";
import { Recuperar } from "@/telas/Acesso";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function Pagina() {
  return (
    <>
      <h1 className="text-[28px] font-normal tracking-tight">Recuperar acesso</h1>
      <Recuperar />
    </>
  );
}
