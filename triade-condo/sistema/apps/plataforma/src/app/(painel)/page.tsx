import type { Metadata } from "next";
import { Inicio } from "@/telas/Inicio";

export const metadata: Metadata = { title: "Início" };

export default function Pagina() {
  return <Inicio />;
}
