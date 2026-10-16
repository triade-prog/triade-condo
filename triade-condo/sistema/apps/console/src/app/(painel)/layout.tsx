import { PainelConsole } from "@/telas/PainelConsole";

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return <PainelConsole>{children}</PainelConsole>;
}
