import { describe, expect, it } from "vitest";
import { conferirAntesDeEnviar, enviarArquivoSchema, mostrarTamanho, tirarArquivoSchema } from "./arquivos.ts";
import { descreverEventoPedido } from "./pedidos.ts";

describe("fotos e documentos dos pedidos (F4.8, PT-07)", () => {
  it("confere tipo e tamanho antes de enviar, dizendo o motivo", () => {
    expect(conferirAntesDeEnviar({ name: "a.jpg", type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(conferirAntesDeEnviar({ name: "v.mov", type: "video/quicktime", size: 10 })).toMatch(/Vídeo e áudio chegam com o WhatsApp/);
    expect(conferirAntesDeEnviar({ name: "a.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 }))
      .toMatch(/só fotos/);
    expect(conferirAntesDeEnviar({ name: "planta.pdf", type: "application/pdf", size: 14_890_000 })).toBe(
      "passa de 10 MB (14,2 MB). Diminua o arquivo ou envie as páginas que importam.",
    );
  });

  it("mostra o tamanho curto", () => {
    expect(mostrarTamanho(340 * 1024)).toBe("340 KB");
    expect(mostrarTamanho(2.1 * 1024 * 1024)).toBe("2,1 MB");
    expect(mostrarTamanho(10)).toBe("1 KB");
  });

  it("valida o pedido de envio e o motivo de tirar", () => {
    expect(enviarArquivoSchema.parse({ parte: "RELATO", nome: " foto.jpg ", tipo: "image/jpeg", tamanho: 10, descricao: "" }))
      .toEqual({ parte: "RELATO", nome: "foto.jpg", tipo: "image/jpeg", tamanho: 10, descricao: null });
    expect(enviarArquivoSchema.safeParse({ parte: "OUTRA", nome: "x", tipo: "image/jpeg", tamanho: 10 }).success).toBe(false);
    expect(tirarArquivoSchema.safeParse({ motivo: "x" }).success).toBe(false);
  });

  it("descreve os eventos de arquivo no histórico (AT-17)", () => {
    expect(descreverEventoPedido("pedido.arquivo_enviado", { parte: "RELATO", arquivoNome: "teto.jpg" })).toBe("Arquivo enviado no relato: teto.jpg");
    expect(descreverEventoPedido("pedido.arquivo_recusado", { arquivoNome: "fatura.pdf", motivo: "O conteúdo não é um PDF de verdade." }))
      .toBe("fatura.pdf não liberado: O conteúdo não é um PDF de verdade.");
    expect(descreverEventoPedido("pedido.arquivo_tirado", { arquivoNome: "fatura.pdf", motivo: "Arquivo errado" }))
      .toBe("Tirou fatura.pdf do pedido. Motivo: Arquivo errado");
  });
});
