# ADR 0012 · Visões por regra e por causa (HU-04)

- **Estado:** aceito
- **Data:** 25/10/2026
- **Etapa:** 3.4

## Decisões

1. **Três abas** com o padrão ARIA de abas (`tablist`/`tab`/`tabpanel`, setas, Home/End): por trabalhador (padrão), por regra e por causa. Filtro de severidade, busca e "Comece por aqui" valem nas três.
2. **Por regra:** um grupo por regra (`R002 · título`), pior severidade primeiro e, no empate, a regra com mais achados.
3. **Por causa:** um grupo por `causa` (ex.: "Corrija a rubrica 77 (tabela 001)"), da que mais resolve para a que menos, com "resolve N achado(s)" no cabeçalho. Achados sem causa ficam num grupo final, "Achados sem causa comum": nada some da visão.
4. **A busca passou a olhar cada achado**, não o grupo: CPF (a partir de 3 dígitos), matrícula do achado ou do trabalhador, ou código da regra. Assim, buscar um CPF na aba por regra mostra só os achados dele.
5. Fora da visão por trabalhador, a linha do achado mostra o trabalhador (CPF mascarado) no lugar do evento.
6. **Voz:** quando o pago é menor que o demonstrativo, a frase da R002 diz "Diferença de R$ 1,00 a menos" em vez de "-R$ 1,00".
