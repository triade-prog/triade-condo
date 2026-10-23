// Abas no padrão do WAI-ARIA: clique ou setas trocam a aba, e só a aba escolhida fica na ordem do Tab.
export function ligarAbas(seletorAbas: string, painelDe: (aba: HTMLElement) => string, seletorPaineis: string) {
  const abas = [...document.querySelectorAll<HTMLElement>(seletorAbas)];
  const escolher = (aba: HTMLElement, focar = false) => {
    for (const a of abas) {
      a.setAttribute("aria-selected", String(a === aba));
      a.tabIndex = a === aba ? 0 : -1;
    }
    const id = painelDe(aba);
    document.querySelectorAll<HTMLElement>(seletorPaineis).forEach((p) => p.classList.toggle("atual", p.id === id));
    if (focar) aba.focus();
  };
  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => escolher(aba));
    aba.addEventListener("keydown", (e) => {
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      escolher(abas[(i + passo + abas.length) % abas.length], true);
    });
  });
}
