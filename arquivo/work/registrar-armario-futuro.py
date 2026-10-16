from pathlib import Path
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Armário de encomendas: hipótese após os primeiros clientes — 07/10/2026
A usuária decidiu adiar a idealização detalhada e a implantação de armário de encomendas para uma fase de ampliação futura, após os primeiros clientes. Fica fora do MVP, sem escopo aprovado. Hipótese discutida: locação a prédios/condomínios com sistema, manutenção/suporte e notificações ao morador via WhatsApp; viabilidade comercial ainda não confirmada.

Somente depois de haver clientes, avaliar no local necessidade, espaço e acesso do entregador, possibilidade externa/área separada/hall com integração, depósito, guarda, retirada individual e rastreabilidade, exceções e suporte, custos e responsabilidades. Não prometer ausência de extravio nem integração disponível. Não iniciar desenvolvimento, compra, parceria ou instalação. Esta decisão não cria operação de portaria no prédio simples, não torna o módulo obrigatório e preserva morador exclusivamente WhatsApp, síndico com painel/avisos WhatsApp, módulos opcionais e assessoria humana opcional. Registro apenas; sem pesquisa nova.
'''
for relative in ['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md','memory/2026-10-07.md']:
 p=root/relative;p.write_text(p.read_text()+note)
p=root/'work/comparativo-template.html';t=p.read_text();old="'<p>Recorte candidato:"  # Section is built as one HTML string; insert before its closing article.
anchor='Outros tipos e regras' # No remote dependency or new functionality is introduced.
needle='MVP continua focado. Morador 100% WhatsApp'
assert needle in t
t=t.replace(needle,'MVP continua focado.</p><p><strong>Armário de encomendas, só após os primeiros clientes:</strong> hipótese futura de locação com sistema, manutenção/suporte e avisos WhatsApp; viabilidade comercial não confirmada. Fora do MVP; idealização detalhada e implantação adiadas. Depois de haver clientes, avaliar no local necessidade, espaço, acesso do entregador, alternativa externa/área separada/hall com integração, depósito, guarda, retirada individual/rastreabilidade, exceções/suporte, custos e responsabilidades. Sem promessa de ausência de extravio ou integração disponível. Não iniciar desenvolvimento, compra, parceria ou instalação.</p><p>Morador 100% WhatsApp')
p.write_text(t)
print('Hipótese futura registrada; nenhuma implementação ou pesquisa nova.')
