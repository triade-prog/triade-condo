// O Console de mentira para os testes do site (porta 4399): a rota da calculadora devolve a Tabela de
// preços com o preço de fundador, como o banco (comercial_calculadora_site), e a faixa de 101 a 200
// unidades fica sempre "fora do ar", para o teste da tabela cheia do site (r9). O pedido de
// demonstração e o de proposta são aceitos. Confere o segredo do site e guarda o último IP repassado.
import { createServer } from "node:http";

const SEGREDO = "segredo-do-site-e2e";
const TABELA = [
  { codigo: "ATE_40", ate: 40, nome: "Até 40 unidades", fundador: 12900, cheia: 19900 },
  { codigo: "DE_41_A_100", ate: 100, nome: "41 a 100 unidades", fundador: 22900, cheia: 34900 },
  { codigo: "DE_101_A_200", ate: 200, nome: "101 a 200 unidades", fundador: 34900, cheia: 54900 },
  { codigo: "DE_201_A_400", ate: 400, nome: "201 a 400 unidades", fundador: 54900, cheia: 84900 },
];
let ultimoCliente = null;

const responder = (res, status, dados) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(dados));
};

createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    if (req.method === "GET" && req.url === "/ultimo-cliente") return responder(res, 200, { cliente: ultimoCliente });
    if (req.method === "GET" && req.url === "/") return responder(res, 200, { ok: true });
    if (req.headers["x-site-segredo"] !== SEGREDO) return responder(res, 403, { codigo: "FORBIDDEN" });
    if (req.method === "POST" && req.url === "/api-console/v1/site/calculadora") {
      ultimoCliente = req.headers["x-site-cliente"] ?? null;
      const { unidades } = JSON.parse(corpo || "{}");
      const f = TABELA.find((t) => unidades <= t.ate);
      if (!f) return responder(res, 200, { unidades, faixa: { codigo: "ACIMA_DE_400", nome: "Acima de 400 unidades", sobConsulta: true } });
      if (f.codigo === "DE_101_A_200") return responder(res, 503, { codigo: "INDISPONIVEL" });
      return responder(res, 200, {
        unidades, faixa: { codigo: f.codigo, nome: f.nome, sobConsulta: false }, tabela: "FUNDADOR", mensal: f.fundador,
        porApartamento: Math.max(Math.round(f.fundador / unidades), 1), depoisFundador: f.cheia, fundadorMeses: 12,
      });
    }
    if (req.method === "POST" && req.url === "/api-console/v1/site/interessados") return responder(res, 201, { id: "00000000-0000-4000-8000-000000000001", juntado: false });
    return responder(res, 404, { codigo: "NOT_FOUND" });
  });
}).listen(4399, "127.0.0.1");
