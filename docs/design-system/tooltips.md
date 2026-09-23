# Tooltips — UI e gráficos

> Há dois mundos de tooltip no app: o componente shadcn (`Tooltip` Radix) usado em botões, KPIs, headers; e o tooltip do recharts dentro de gráficos. Os dois convivem com **3 estilos visuais legados** — este doc registra o que existe e qual escolher para código novo.

## Componente shadcn

[src/components/ui/tooltip.tsx](../../src/components/ui/tooltip.tsx) — re-export de `@radix-ui/react-tooltip`. `TooltipProvider` já está montado no root (App.tsx); use direto.

```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon"><Info /></Button>
  </TooltipTrigger>
  <TooltipContent side="top" sideOffset={4}>
    Texto explicativo
  </TooltipContent>
</Tooltip>
```

Default vindo do shadcn (sem className extra):

```
z-[100] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md
```

`sideOffset` default = `4`.

## Estilos de Tooltip em UI (cards/KPIs/botões) — 3 variantes

| Estilo | className | Usado em | Quando usar |
|---|---|---|---|
| **Default (popover)** | *(sem override)* — `bg-popover text-popover-foreground` | [shared.tsx](../../src/components/analise/shared.tsx#L258), [VersaoHeader.tsx](../../src/components/analise/VersaoHeader.tsx#L100), [AIChatButton](../../src/components/chat/AIChatButton.tsx#L29), [ImportExcelModal](../../src/components/atualizacao/ImportExcelModal.tsx#L1328) | **Padrão para componente novo.** É o que vem do shadcn sem className extra. Adapta a tema (light/dark). |
| **Light explícito** | `bg-white text-black border shadow-md max-w-xs` | [AnaliseHeader.tsx](../../src/components/analise/AnaliseHeader.tsx#L96), [INCCTableKPIs.tsx](../../src/components/incc/INCCTableKPIs.tsx#L252), [INCCTimelineChart.tsx](../../src/components/incc/INCCTimelineChart.tsx#L190), [JustificativaPopover.tsx](../../src/components/atualizacao/JustificativaPopover.tsx#L52), [IRRDonuts.tsx](../../src/components/planejamento/irr/IRRDonuts.tsx#L70) | Legado. **Não replicar** em código novo — força fundo branco mesmo no tema dark. |
| **Dark invertido** | `bg-foreground text-background border-none text-xs` | [IRRKpiCards.tsx](../../src/components/planejamento/irr/IRRKpiCards.tsx#L85) | Legado. Útil só para microcopy curto sobre card claro. Em código novo, prefira o Default. |

> **Regra ao adicionar tooltip novo**: omita o className. Se precisar restringir largura, use `max-w-xs text-xs leading-relaxed` (padrão de [CurvaSChart.tsx:609](../../src/components/analise/CurvaSChart.tsx#L609)). Não use `bg-white text-black` — quebra dark mode.

## Caso especial — Popover + Tooltip combinados

[JustificativaPopover.tsx](../../src/components/atualizacao/JustificativaPopover.tsx) ilustra um padrão raro: o **mesmo botão** é trigger de Popover (textarea editável) e de Tooltip (label de status):

```tsx
<Popover open={open} onOpenChange={…}>
  <Tooltip>
    <TooltipTrigger asChild>
      <PopoverTrigger asChild>
        <button …>{icon}</button>
      </PopoverTrigger>
    </TooltipTrigger>
    <TooltipContent>{statusText}</TooltipContent>
  </Tooltip>
  <PopoverContent>{form}</PopoverContent>
</Popover>
```

Use quando o ícone precisa ao mesmo tempo: (a) explicar seu estado em hover e (b) abrir um formulário inline em click. Não confunda com tooltip puro — Popover persiste após click; Tooltip some no mouse-out.

## Tooltip em gráficos recharts — 2 estilos

### Tipo A — Componente `Tip` custom (PADRÃO DOMINANTE)

Usado em [INCCChart](../../src/components/incc/INCCChart.tsx#L36-L68), [INCCRateChart](../../src/components/incc/INCCRateChart.tsx#L33-L57), [INCCImpactChart](../../src/components/incc/INCCImpactChart.tsx#L64-L101), [IRRBarByPredecessora](../../src/components/planejamento/irr/IRRBarByPredecessora.tsx#L31-L57), [IRRBarByResponsavel.tsx](../../src/components/planejamento/irr/IRRBarByResponsavel.tsx), [IRRTipoRestricaoChart.tsx](../../src/components/planejamento/irr/IRRTipoRestricaoChart.tsx#L31-L57), [IRRDonuts](../../src/components/planejamento/irr/IRRDonuts.tsx#L17-L49), [HomeCurvaS](../../src/components/home/HomeCurvaS.tsx):

```tsx
const Tip = ({ active, payload, label }: TipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[220px]">
      <p className="font-bold text-foreground text-sm">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground truncate">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// uso
<Tooltip content={<Tip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
```

Variações observadas:

- `min-w-[160px]` (donut), `min-w-[180px]` (rate), `min-w-[200px]` (line multi), `min-w-[220px]` (bar empilhado) — escolha pela largura do conteúdo, não estipule.
- Linha de **total** quando há empilhamento: `<div className="border-t border-border pt-1.5 flex …"><span>Total</span><span className="ml-auto font-bold">{total}</span></div>`.
- Label do indicador (bolinha colorida): `w-2.5 h-2.5 rounded-full flex-shrink-0` com `style={{ backgroundColor: p.color }}` — **não** use Tailwind dinâmico (`bg-[${color}]`) porque não compila.
- Valores numéricos sempre com `tabular-nums` para alinhar verticalmente.
- Quando o gráfico tem muitas séries do mesmo tipo (as linhas por obra da Curva S da Home), separe: as séries principais em cima com bolinha colorida, e o resto embaixo de um `border-t`, ordenado por valor desc e com o nome em `truncate`.

`cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}` é o destaque sutil ao hover sobre uma categoria do BarChart — copie quando o gráfico for de barras.

### Tipo B — `contentStyle` inline (LEGADO em CurvaSChart)

Em [CurvaSChart.tsx:517](../../src/components/analise/CurvaSChart.tsx#L517) e similares:

```tsx
<Tooltip
  contentStyle={{
    borderRadius: "8px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
  }}
/>
```

Funciona, respeita tokens, mas **não permite layout custom** (sem bolinha de cor, sem total, sem alinhamento tabular). Em código novo, prefira o Tipo A — vale a pena escrever 30 linhas para ter controle total do payload.

## Quando NÃO usar tooltip

- **Validação de campo de formulário** → texto inline abaixo do input (ver [formularios.md](formularios.md)).
- **Feedback transacional** ("salvo", "erro ao sincronizar") → toast Sonner, ver [feedback.md](feedback.md).
- **Conteúdo longo, com listas, parágrafos** → use `Popover` ou `ResponsiveModal`. Tooltip é para 1-3 linhas.
- **Usuário precisa interagir com o conteúdo** (link, botão dentro do balão) → `Popover`. Tooltip some no mouse-out.

## Checklist ao adicionar tooltip

- **Em UI (botão/KPI/header)**: `<Tooltip><TooltipTrigger asChild>…<TooltipContent side="top|bottom" sideOffset={4}>…</TooltipContent></Tooltip>`. **Sem `className` de cor.** Se precisar limitar largura, `max-w-xs text-xs leading-relaxed`.
- **Em gráfico recharts**: componente `Tip` custom (Tipo A). Receba `{ active, payload, label }`, renderize `<div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5">` com bolinha + nome + valor `tabular-nums`. Linha de total quando empilhado. **Não** use `contentStyle`.
