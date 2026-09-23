# Gráficos — Recharts, paleta, eixos, donut

> Toda a visualização de dados do app é feita com [recharts](https://recharts.org/). Não há wrapper centralizado em uso — cada gráfico é um componente próprio dentro do seu domínio. Este doc lista os padrões observados e as regras para adicionar gráficos novos sem agravar a divergência atual.

## Inventário (2026-04-30)

| Componente | Tipo | Altura | Domínio |
|---|---|---|---|
| [INCCChart.tsx](../../src/components/incc/INCCChart.tsx) | LineChart (multi-linha por tipo de orçamento) | `400` | INCC |
| [INCCRateChart.tsx](../../src/components/incc/INCCRateChart.tsx) | LineChart (variação % do INCC) | `260` | INCC |
| [INCCImpactChart.tsx](../../src/components/incc/INCCImpactChart.tsx) | BarChart empilhado (Original + Correção) | `360` | INCC |
| [INCCTimelineChart.tsx](../../src/components/incc/INCCTimelineChart.tsx) | **Sem recharts** — barras CSS com `Tooltip` shadcn | n/a | INCC |
| [CurvaSChart.tsx](../../src/components/analise/CurvaSChart.tsx) | LineChart + BarChart + AreaChart (3 abas) | `100%` (container ~450/360/320) | Análise |
| [IRRBarByPredecessora.tsx](../../src/components/planejamento/irr/IRRBarByPredecessora.tsx) | BarChart vertical empilhado | `300` | Planejamento/IRR |
| [IRRBarByResponsavel.tsx](../../src/components/planejamento/irr/IRRBarByResponsavel.tsx) | BarChart vertical empilhado | similar | Planejamento/IRR |
| [IRRTipoRestricaoChart.tsx](../../src/components/planejamento/irr/IRRTipoRestricaoChart.tsx) | BarChart **horizontal** empilhado | `Math.max(220, n*48)` | Planejamento/IRR |
| [IRRDonuts.tsx](../../src/components/planejamento/irr/IRRDonuts.tsx) | PieChart donut (innerRadius 55, outerRadius 75) | `180` | Planejamento/IRR |
| [HomeCurvaS.tsx](../../src/components/home/HomeCurvaS.tsx) | ComposedChart (Area "realizado" + Line "previsto" + 1 Line cinza por obra) | `300` | Home |

## Wrapper de container

Padrão único:

```tsx
<ResponsiveContainer width="100%" height={N}>
  <BarChart data={data} margin={{ top, right, left, bottom }}>
    …
  </BarChart>
</ResponsiveContainer>
```

- `height` é **número fixo** em todos os gráficos (não `100%`) — exceto `CurvaSChart`, que usa container dinâmico.
- O wrapper visual sempre é `bg-card border border-border rounded-xl p-4` com um `<h3 className="text-sm font-semibold text-foreground">` no topo.
- `margin` padrão: `{ top: 5, right: 20, left: 10, bottom: 5 }`. Quando há `LabelList position="top"`, sobe `top` para `20-28` para caber o rótulo.

## Paleta — `STATUS_COLORS` é a única compartilhada

[irrCalc.ts](../../src/components/planejamento/irr/irrCalc.ts#L464-L470) exporta:

```ts
export const STATUS_COLORS: Record<string, string> = {
  "Em andamento": "#f59229",
  "Menos de 30 dias para resolução": "#fbbf24",
  Atrasado: "#ef4444",
  Finalizado: "#22c55e",
  "Não se aplica": "#9ca3af",
};
```

**Reutilize** essa constante em todo gráfico cujo eixo seja status de restrição/atividade. É o único contrato de cor estabelecido.

### Outras paletas (privadas, divergência consciente)

| Origem | Constante / hex |
|---|---|
| INCC — tipo de orçamento | `TYPE_COLORS = { Viabilidade: "#9ca3af", Lançamento: "#427bde", Executivo: "#d695ff", Atualização: "#ffd988" }` em [INCCChart.tsx](../../src/components/incc/INCCChart.tsx#L20-L25) |
| INCC — taxa | `stroke="#f29f05"` (linha do INCC mensal/anual) |
| INCC — impacto | `#94a3b8` (Original), `#f59229` (Correção) |
| Análise — Curva S | `#2196F3` (planejado), `#FF9800` (real), `#FF5722` (desvio) |

> **Regra ao adicionar gráfico novo**: se o eixo for status, use `STATUS_COLORS`. Caso contrário, prefira **token** (`hsl(var(--primary))`, `hsl(var(--muted-foreground))`) em vez de criar mais um array hex inline. Não unifique as paletas legadas acima — só não agrave.

## Eixos, grid e tipografia

Padrão dominante observado em INCC e IRR:

```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
<XAxis
  dataKey="…"
  tick={{ fontSize: 11, fill: "#71717a" }}
  axisLine={false}
  tickLine={false}
/>
<YAxis
  tick={{ fontSize: 11, fill: "#71717a" }}
  width={60}
  domain={["auto", "auto"]}
/>
```

| Detalhe | Valor |
|---|---|
| Grid stroke | `"#e2e8f0"` (literal) — *deveria* mapear para `hsl(var(--border))` |
| Tick fill | `"#71717a"` (literal) — *deveria* mapear para `hsl(var(--muted-foreground))` |
| Tick fontSize XAxis | `10` (compacto, BarChart) ou `11` (LineChart) ou `12` (categorias destaque) |
| Tick fontSize YAxis | `11` |
| `axisLine` / `tickLine` | `false` em quase todos os charts (estilo "limpo") |
| `barCategoryGap` | `"25%"` em barras |
| `maxBarSize` | `28` (horizontal) a `80` (vertical) |
| Bar `radius` | `[4, 4, 0, 0]` (top da última barra empilhada) ou `[0, 4, 4, 0]` (extremo direito em horizontal) |

**Hex literal de eixo/grid é divergência consciente** com `tokens.md`. Documentado, não corrigido nesta passada.

## Linha "Hoje" / Reference line

INCC e IRR marcam o mês corrente com `<ReferenceLine />`:

```tsx
{hasTodayInData && (
  <ReferenceLine
    x={todayLabel}
    stroke="#ef4444"
    strokeDasharray="4 4"
    label={{ value: "Hoje", position: "top", fill: "#ef4444", fontSize: 11, fontWeight: 600 }}
  />
)}
```

Em `INCCChart.tsx` o label é desenhado como pill SVG custom (rect arredondado + text). Use o `label` simples acima como padrão; a pill só vale a pena quando o gráfico é grande o suficiente para o texto não atropelar.

## Legend

Padrão: `<Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 | 12 }} />`. Sempre que houver mais de uma série, ligue Legend.

## Bar — empilhamento e LabelList

Para barras empilhadas com proporção visível, o padrão é:

```tsx
<Bar dataKey="Em andamento" stackId="s" fill={STATUS_COLORS["Em andamento"]} maxBarSize={70}>
  <LabelList
    dataKey="pctEmAndamento"
    position="center"
    formatter={fmtPct}
    style={{ fontSize: 11, fontWeight: 700, fill: "#fff" }}
  />
</Bar>
```

- `position="center"` para % dentro da barra; `position="top"` para % total acima da barra.
- `fill` do label: `"#fff"` em fatias escuras (`Em andamento`/`Atrasado`/`Finalizado`), `"#374151"` em fatias claras (`Menos de 30 dias` que é amarelo).
- Só renderiza valor se > 0 (`fmtPct` retorna `""` para zero) — evita poluir quando a fatia some.

## Rótulo dentro da fatia (Bar e Donut)

Padrão usado em IRR e Home: **percentual em branco**, `font-weight: 700`, `font-size: 11`, `position="center"`, escondido para fatias muito pequenas.

### Em `<Bar>` — `LabelList`

```tsx
<Bar dataKey="Replanejado" fill="#f29f05" radius={[0, 4, 4, 0]} barSize={20}>
  <LabelList
    dataKey="Replanejado"
    position="center"
    formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ""}
    style={{ fontSize: 11, fontWeight: 700, fill: "#fff" }}
  />
</Bar>
```

- Em fatias **claras** (amarelo `#fbbf24`, cinza `#9ca3af`, base) prefira `fill: "#374151"` para legibilidade — exemplo em [IRRBarByPredecessora.tsx](../../src/components/planejamento/irr/IRRBarByPredecessora.tsx#L138).
- O `formatter` retorna `""` quando o valor é zero/pequeno — evita poluição.

### Em `<Pie>` — função `label`

```tsx
const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null; // esconde fatias < 6%
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, pointerEvents: "none" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

<Pie … label={renderSliceLabel} labelLine={false}>…</Pie>
```

- `pointerEvents: "none"` no `<text>` evita que o label "engula" o hover do tooltip.
- `labelLine={false}` para não puxar linhas de fora do donut.
- Threshold `percent < 0.06` (6%) é o limiar onde o texto começa a atropelar a fatia. Ajuste para 0.04 em donuts grandes ou 0.08 em donuts compactos.

Implementação em [IRRDonuts.tsx](../../src/components/planejamento/irr/IRRDonuts.tsx). A Home não tem mais donut — o gráfico da Home hoje é a Curva S em [HomeCurvaS.tsx](../../src/components/home/HomeCurvaS.tsx) (ComposedChart, ver inventário acima).

## Donut (PieChart)

Padrão em [IRRDonuts.tsx](../../src/components/planejamento/irr/IRRDonuts.tsx):

```tsx
<ResponsiveContainer width="100%" height="100%">
  <PieChart style={{ overflow: "visible" }}>
    <RechartsTooltip
      content={<SliceTip />}
      wrapperStyle={{ zIndex: 9999, outline: "none", pointerEvents: "none" }}
      allowEscapeViewBox={{ x: true, y: true }}
    />
    <Pie
      data={dataWithTotal}
      cx="50%" cy="50%"
      innerRadius={55} outerRadius={75}
      paddingAngle={2}
      dataKey="value"
      startAngle={90} endAngle={-270}
    >
      {data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
    </Pie>
  </PieChart>
</ResponsiveContainer>
```

Detalhes que valem repetir:

- O texto central (label do donut) é renderizado **fora** do PieChart, em `<div className="absolute inset-0 flex items-center justify-center pointer-events-none">`.
- Para o tooltip mostrar o % real do slice, cada item de `data` recebe `__total` antes de ir para o `<Pie>` (recharts só passa o slice ativo no payload).
- `allowEscapeViewBox` deixa o tooltip vazar do container; `wrapperStyle.zIndex: 9999` evita ser cortado por outros cards.

## Paleta categórica por obra (Curva S da Home)

`CORES_OBRA` em [carteira.ts](../../src/components/home/carteira.ts) é a única paleta categórica do
projeto: 12 cores, uma por obra na Curva S da Home. Validada com o validador da skill de dataviz na
superfície clara (a única que o app renderiza): pior par vizinho ΔE 9,1 em protanopia e 19,6 na
visão normal. Cinco delas ficam abaixo de 3:1 de contraste com o branco, então **a identificação
nunca pode depender só da cor**: a legenda nominal embaixo do gráfico e o tooltip cumprem esse
papel. A cor é atribuída por `coresPorObra`, na ordem do `codigo_mega`, nunca na ordem de exibição,
senão a obra troca de cor quando a lista é reordenada. Acima de 12 obras a paleta repete.

## Tooltip dos gráficos

Ver [tooltips.md](tooltips.md). Padrão dominante: componente custom `Tip` com `<div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[200px|220px]">`.

## Wrapper shadcn `chart.tsx` — disponível, NÃO adotado

[src/components/ui/chart.tsx](../../src/components/ui/chart.tsx) traz o pacote shadcn-charts (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`). **Nenhum gráfico do app o utiliza hoje.** Não introduza agora — siga os padrões observados acima para manter consistência. Se for adotar no futuro, faça migração coordenada de todos os charts em uma PR única.

## Checklist para adicionar gráfico novo

1. Cria componente em `src/components/<dominio>/`.
2. Importa de `recharts` direto (não use `chart.tsx` shadcn).
3. Envolve em `<div className="bg-card border border-border rounded-xl p-4">` + `<h3 className="text-sm font-semibold text-foreground">` no topo.
4. `<ResponsiveContainer width="100%" height={N}>` com `N` fixo (260/300/360/400).
5. Eixos: `tick={{ fontSize: 11, fill: "#71717a" }}`, grid `stroke="#e2e8f0" strokeDasharray="3 3"`, `axisLine={false}` e `tickLine={false}`.
6. Cor: se for status, `STATUS_COLORS` de `irrCalc.ts`; senão `hsl(var(--primary))` ou pedir paleta.
7. Tooltip: padrão `Tip` (Tipo A) de [tooltips.md](tooltips.md). **Não use `contentStyle` inline** (Tipo B é legado).
8. `<Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />` se >1 série.
9. Formatadores: `fNum`/`fMoeda`/`formatPct` de [src/components/analise/shared.tsx](../../src/components/analise/shared.tsx).
