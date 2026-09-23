# Tipografia

**Fonte global**: Inter, importada via Google Fonts em [src/index.css:1](../../src/index.css#L1). Aplicada em `body` como `font-family: 'Inter', sans-serif`.

## Pesos

| Weight | Classe | Uso típico |
|---|---|---|
| 400 | `font-normal` | Corpo de texto, descrições |
| 500 | `font-medium` | Labels, itens de menu, tabs, texto de botão (default) |
| 600 | `font-semibold` | Títulos de seção, CardTitle, header de grupo na tabela (nível 2/4) |
| 700 | `font-bold` | Título principal, números grandes, nível 1 da tabela |
| 800 | `font-extrabold` | Disponível, raramente usado |

## Escala de tamanhos (real, em uso)

| Classe | Px | Onde |
|---|---|---|
| `text-[9px]` | 9 | Badges pequenas ("Em breve", "Beta") |
| `text-[10px]` | 10 | Badges ON/OFF, avatar fallback pequeno |
| `text-[11px]` | 11 | Email na sidebar, labels muted de KPI |
| `text-xs` | 12 | Botão `size="sm"`, section headers em uppercase, subtítulos |
| `text-sm` | 14 | **Corpo padrão**, itens de menu, células de tabela, inputs |
| `text-base` | 16 | Título "Rottas Control" na sidebar, inputs em mobile (auto via responsive) |
| `text-lg` | 18 | Títulos de dialog/modal, títulos de seção da Home |
| `text-2xl` | 24 | `CardTitle` (shadcn padrão), avatar fallback grande (Perfil) |
| `text-3xl` | 30 | Números de KPI em summary cards (Home) |

Tamanhos acima de `text-3xl` **não** estão em uso. Não invente `text-4xl+`.

## Padrões reutilizáveis

### Section header em uppercase (padrão do app)

```tsx
<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
  Empreendimentos ativos
</h2>
```

Visto em [Empreendimentos.tsx](../../src/pages/Empreendimentos.tsx), [Home.tsx](../../src/pages/Home.tsx). Use **este** padrão para dividir seções dentro de uma página.

### Subtítulo ainda menor

```tsx
<span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
```

### Descrição / texto auxiliar

```tsx
<p className="text-sm text-muted-foreground">...</p>
```

### Truncate

- Single-line: `truncate` (já inclui overflow hidden + ellipsis + nowrap).
- Multi-linha: `line-clamp-2` (ou 3).

## O que evitar

- `font-thin`, `font-light`, `font-black` — não estão em uso, não introduza.
- Tamanhos arbitrários como `text-[13px]`, `text-[15px]` — fique na escala acima.
- Múltiplas fontes — só Inter.
