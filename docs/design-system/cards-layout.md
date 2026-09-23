# Cards e Layout de Página

## Wrapper padrão de página

Duas variantes convivem:

### A) Página com header via portal (Análise, Versões, Atualização, Planejamento)

```tsx
<div className="flex-1 min-h-full flex flex-col bg-background">
  {/* header injetado via createPortal em #header-slot */}
  <main className="flex-1 overflow-auto">
    {/* controls bar */}
    <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
      ...
    </div>
    {/* conteúdo */}
  </main>
</div>
```

### B) Página com header local (Home, Empreendimentos, Perfil, Reports)

```tsx
<div className="min-h-full bg-[hsl(var(--page-bg))]">
  <header className="bg-card border-b border-border px-6 py-4 ...">...</header>
  <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 space-y-6">
    ...
  </main>
</div>
```

## Max-width por página (estado atual)

| Página | Max-width | Observação |
|---|---|---|
| Home | `1400px` | Padrão |
| Reports (Novidades) | `1400px` (lista) / `900px` (editor) | Padrão |
| Perfil | `1100px` | Mais estreito, intencional |
| Empreendimentos | `1600px` | **Legado** — único lugar com 1600 |
| Análise / Versões / Planejamento / Atualização | sem max-width | Full width para tabela |

**Regra**: para **página nova** use `max-w-[1400px] mx-auto`. Não introduza outro valor sem justificativa forte.

**Container global** do Tailwind (`2xl: 1400px`) existe em [tailwind.config.ts](../../tailwind.config.ts#L11), mas o app usa `max-w-[1400px]` direto em vez de `container`.

## Grids responsivos de referência

| Contexto | Grid |
|---|---|
| KPIs (Home) | `grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]` — sem split fixo, os cards da Home (KPIs, Curva S, tabela, Equipe) empilham em `flex flex-col gap-5` |
| ObraCards | `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4` |
| Perfil info cards | `grid-cols-1 md:grid-cols-3 gap-6` |
| Gráficos lado a lado | `grid-cols-1 md:grid-cols-2 gap-6` |

## Gaps convencionais

- Entre seções grandes: `space-y-6`
- Grid de cards: `gap-4` (denso) ou `gap-6` (folgado)
- Dentro de card: `space-y-3`
- Ícone + texto: `gap-2`
- Sidebar items: `gap-1.5`

## Section titles (dentro da página)

```tsx
<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
  Empreendimentos ativos
</h2>
```

Ver [tipografia.md](tipografia.md#padr%C3%B5es-reutiliz%C3%A1veis).

---

## Card — componente base

[src/components/ui/card.tsx](../../src/components/ui/card.tsx)

```
rounded-lg border bg-card text-card-foreground shadow-sm
```

Subcomponentes:
- `CardHeader` — `p-6 space-y-1.5`
- `CardTitle` — `text-2xl font-semibold leading-none tracking-tight`
- `CardDescription` — `text-sm text-muted-foreground`
- `CardContent` — `p-6 pt-0`
- `CardFooter` — `p-6 pt-0 flex items-center`

## Variações observadas

| Variação | Classes extras | Quando |
|---|---|---|
| Summary card (Home KPI) | `rounded-xl shadow-sm border border-border` + `CardContent px-[18px] py-4` | KPIs da Home |
| Perfil card | `rounded-2xl shadow-sm border-0` | Info grid do Perfil |
| ObraCard | `rounded-xl bg-card shadow-sm hover:shadow-md border cursor-pointer` | Grid de empreendimentos |
| ObraCard selecionado | + `border-primary ring-2 ring-primary/20` | Destaque |
| ObraCard bloqueado (sem acesso) | + `opacity-50 grayscale hover:grayscale-0` | Sem permissão |
| Chart container (sub-card) | `border border-border/50 rounded-lg p-4` | Dentro de cards maiores |
| Session card (Atualização) | `rounded-xl border border-border bg-card p-5` + `hover:shadow-md hover:border-border/80` | Lista de sessões em `/atualizacao-orcamentaria` — split layout (badge `#N` + título + meta na esquerda; autor + botões na direita). Ver [SessionCard.tsx](../../src/components/atualizacao/SessionCard.tsx). |

## Padrão KPI / Summary card (Home)

Ver [HomeKpis.tsx](../../src/components/home/HomeKpis.tsx).

```tsx
<Card className="rounded-xl shadow-sm border border-border">
  <CardContent className="px-[18px] py-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-[17px] w-[17px] text-primary" />
      <h3 className="text-[13px] font-medium">{label}</h3>
    </div>
    <div className="mt-2.5 flex items-baseline gap-2">
      <span className="text-[23px] font-bold leading-[1.1] tabular-nums text-foreground">{value}</span>
      {extra}
    </div>
    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">{footer}</p>
  </CardContent>
</Card>
```

## Sombras

| Classe | Quando |
|---|---|
| `shadow-sm` | Cards, summary cards, ObraCard (estado normal) |
| `shadow-md` | Hover de ObraCard, popover, tooltip, dropdown, toast |
| `shadow-lg` | Dialog, sheet, modal custom, avatar grande |

## Bordas (cores)

| Classe | Cor | Uso |
|---|---|---|
| `border-border` | #e2e8f0 | Cards, separadores, tabela |
| `border-input` | #e2e8f0 | Inputs, selects |
| `border-sidebar-border` | #e4e4e7 | Sidebar header/footer |
| `border-primary` | #f29f05 | Card selecionado |
| `border-0` | — | Cards do Perfil |

Espessura padrão: `1px` (sem classe extra).
