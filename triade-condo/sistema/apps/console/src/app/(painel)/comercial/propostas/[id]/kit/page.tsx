import type { Metadata } from "next";
import { KitConselho } from "@/telas/comercial/KitConselho";

export const metadata: Metadata = { title: "Kit para o conselho" };

export default function Pagina() {
  return <KitConselho />;
}
