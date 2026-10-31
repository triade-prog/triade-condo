import { describe, expect, it } from "vitest";
import { clienteProvavel } from "./ContasMeta.tsx";

describe("Contas recebidas da Meta (F5.12, quadro 463)", () => {
  const conta = { wabaId: "1029384756", recebidaEm: "2026-10-31T17:01:00Z" };
  it("o provável é quem tocou em Já terminei mais perto da chegada da conta", () => {
    const terminaram = [
      { condominioId: "a", nome: "Aurora", em: "2026-10-31T12:00:00Z" },
      { condominioId: "b", nome: "Residencial Ipê", em: "2026-10-31T17:02:00Z" },
    ];
    expect(clienteProvavel(conta, terminaram)?.nome).toBe("Residencial Ipê");
  });
  it("longe demais da chegada não conta", () => {
    expect(clienteProvavel(conta, [{ condominioId: "a", nome: "Aurora", em: "2026-10-30T09:00:00Z" }])).toBeNull();
    expect(clienteProvavel(conta, [])).toBeNull();
  });
});
